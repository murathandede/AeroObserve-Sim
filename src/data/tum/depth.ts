import type { ReaderError, ReaderResult } from '../../shared/types';
import { validateTumPng } from './png';

/** Numerical PNG samples, independent of any browser-rendered image preview. */
export interface TumDepthData {
  width: number;
  height: number;
  /** Row-major original unsigned 16-bit samples. Zero means no valid measurement. */
  raw: Uint16Array;
  rawUnit: 'encoded-uint16';
  unitsPerMetre: 5000;
  invalidRawValue: 0;
  source: { file: string; evidence: string; conversion: string };
}

/**
 * TUM documents metres = raw / 5000. Zero is invalid, not zero metres.
 * Invalid inputs (nonfinite, noninteger or outside uint16) also return null.
 * This conversion does not establish physical sensor accuracy or temperature.
 */
export function tumDepthToMetres(raw: number): number | null {
  return Number.isInteger(raw) && raw > 0 && raw <= 65535 ? raw / 5000 : null;
}

function failure(code: ReaderError['code'], message: string, file: string): ReaderResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      file,
      recovery: code === 'CLOSED'
        ? 'Kaydı yeniden açın ve derinlik çözümleme isteğini açık oturumda tekrar deneyin.'
        : code === 'UNSUPPORTED_FORMAT'
          ? 'DecompressionStream deflate destekleyen bir ortamda özgün 640×480 16-bit gri TUM depth PNG kullanın.'
          : 'Özgün depth PNG dosyasını resmî TUM arşivinden yeniden çıkarın; önizleme piksellerini ölçüm olarak kullanmayın.',
    },
  };
}

function cancelled(file: string): ReaderResult<never> {
  return failure('CLOSED', 'Derinlik çözümlemesi iptal edildi; kayıt oturumu kapanmış veya değişmiş olabilir.', file);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Depth decoding aborted');
}

async function readBytes(blob: Blob, start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
  throwIfAborted(signal);
  const result = await blob.slice(start, end).arrayBuffer();
  throwIfAborted(signal);
  return new Uint8Array(result);
}

/** Called only after full PNG structure/CRC validation; composed slices retain compressed bytes. */
async function compressedPixels(blob: Blob, signal?: AbortSignal): Promise<Blob> {
  const parts: Blob[] = [];
  let offset = 8;
  while (offset < blob.size) {
    const header = await readBytes(blob, offset, offset + 8, signal);
    if (header.length !== 8 || blob.size - offset < 12) throw new Error('Incomplete PNG chunk');
    const length = new DataView(header.buffer, header.byteOffset, 4).getUint32(0);
    if (length > 0x7fffffff || length > blob.size - offset - 12) throw new Error('Invalid PNG chunk size');
    const type = String.fromCharCode(...header.subarray(4));
    if (type === 'IDAT') parts.push(blob.slice(offset + 8, offset + 8 + length));
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  throwIfAborted(signal);
  if (!parts.length) throw new Error('No PNG IDAT');
  return new Blob(parts);
}

function paeth(left: number, up: number, upperLeft: number): number {
  const predictor = left + up - upperLeft;
  const leftDistance = Math.abs(predictor - left);
  const upDistance = Math.abs(predictor - up);
  const diagonalDistance = Math.abs(predictor - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= diagonalDistance) return left;
  if (upDistance <= diagonalDistance) return up;
  return upperLeft;
}

async function reconstruct(compressed: Blob, width: number, height: number, file: string, signal?: AbortSignal): Promise<ReaderResult<TumDepthData>> {
  if (signal?.aborted) return cancelled(file);
  let decompressor: DecompressionStream;
  try {
    if (typeof DecompressionStream === 'undefined') throw new Error('No native decompressor');
    decompressor = new DecompressionStream('deflate');
  } catch {
    return failure('UNSUPPORTED_FORMAT', 'Sayısal depth çözümlemesi için yerel zlib/deflate desteği bulunamadı.', file);
  }
  // Keep only two reconstructed byte rows in addition to the requested raw result.
  // Native zlib output is streamed and bounded before processing each chunk.
  const rowBytes = width * 2;
  const expectedBytes = (rowBytes + 1) * height;
  const raw = new Uint16Array(width * height);
  let previous = new Uint8Array(rowBytes);
  let current = new Uint8Array(rowBytes);
  let column = -1;
  let row = 0;
  let filter = 0;
  let byteCount = 0;
  let ended = false;
  // Allocate fixed, validated dimensions before acquiring a stream reader/listener.
  const reader = compressed.stream().pipeThrough(decompressor).getReader();
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) return cancelled(file);
      const part = await reader.read();
      if (signal?.aborted) return cancelled(file);
      if (part.done) { ended = true; break; }
      if (byteCount + part.value.length > expectedBytes) return failure('DECODE_FAILED', 'Depth PNG açılmış verisi beklenen boyutu aşıyor.', file);
      byteCount += part.value.length;
      for (const byte of part.value) {
        if (column === -1) {
          filter = byte;
          if (filter > 4) return failure('DECODE_FAILED', 'Depth PNG tarama satırı filtresi geçersiz.', file);
          column = 0;
          continue;
        }
        const left = column >= 2 ? current[column - 2] : 0;
        const up = previous[column];
        const upperLeft = column >= 2 ? previous[column - 2] : 0;
        let reconstructed = byte;
        switch (filter) {
          case 1: reconstructed += left; break;
          case 2: reconstructed += up; break;
          case 3: reconstructed += Math.floor((left + up) / 2); break;
          case 4: reconstructed += paeth(left, up, upperLeft); break;
        }
        current[column] = reconstructed & 0xff;
        // PNG stores 16-bit samples most-significant byte first; typed-array host endianness is irrelevant.
        if (column % 2 === 1) raw[row * width + (column >> 1)] = (current[column - 1] << 8) | current[column];
        column++;
        if (column === rowBytes) {
          const complete = current;
          current = previous;
          previous = complete;
          column = -1;
          row++;
        }
      }
    }
    if (byteCount !== expectedBytes || row !== height || column !== -1) return failure('DECODE_FAILED', 'Depth PNG piksel satırları eksik veya boyutu hatalı.', file);
    return {
      ok: true,
      value: {
        width, height, raw,
        rawUnit: 'encoded-uint16', unitsPerMetre: 5000, invalidRawValue: 0,
        source: {
          file,
          evidence: 'https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats',
          conversion: 'metres = raw / 5000; raw = 0 means no valid measurement. PNG filters are reconstructed bytewise; 16-bit samples use PNG big-endian order.',
        },
      },
    };
  } catch {
    if (signal?.aborted) return cancelled(file);
    return failure('DECODE_FAILED', 'Depth PNG sayısal pikselleri zlib akışından çözümlenemedi.', file);
  } finally {
    signal?.removeEventListener('abort', onAbort);
    if (!ended) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * Explicit numerical decoder, separate from RecordingReader.getFrame() previews.
 * Supports the validated TUM 640×480, non-interlaced 16-bit grayscale PNG encoding.
 * Full PNG validation precedes a second bounded zlib pass that reconstructs filters 0–4.
 */
export async function decodeTumDepth(blob: Blob, file: string, signal?: AbortSignal): Promise<ReaderResult<TumDepthData>> {
  try {
    const validation = await validateTumPng(blob, 'depth', file, signal);
    if (signal?.aborted) return cancelled(file);
    if (!validation.ok) return validation;
    const compressed = await compressedPixels(blob, signal);
    if (signal?.aborted) return cancelled(file);
    return await reconstruct(compressed, validation.value.width, validation.value.height, file, signal);
  } catch {
    if (signal?.aborted) return cancelled(file);
    return failure('DECODE_FAILED', 'Depth PNG sayısal çözümleme sırasında okunamadı.', file);
  }
}
