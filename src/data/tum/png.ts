import type { ReaderError, ReaderResult } from '../../shared/types';

/** The documented, non-interlaced TUM image formats; no numerical depth decoding. */
export interface TumPngInfo {
  width: number;
  height: number;
  bitDepth: 8 | 16;
  colorType: 0 | 2;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, entry) => {
  let value = entry;
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function failure(code: ReaderError['code'], message: string, file: string): ReaderResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      recovery: code === 'CLOSED'
        ? 'Kaydı yeniden açın ve görüntü isteğini açık oturumda tekrar deneyin.'
        : code === 'UNSUPPORTED_FORMAT'
          ? 'Belgelenmiş 640×480, geçişsiz RGB 8-bit veya tek kanallı depth 16-bit PNG kullanın. Tarayıcınızın DecompressionStream deflate desteğini kontrol edin.'
          : 'İlgili özgün PNG dosyasını resmî arşivden yeniden çıkarın; dosyayı yeniden kodlayarak derinlik ölçümlerini değiştirmeyin.',
      file,
    },
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('PNG validation aborted');
}

function cancelled(file: string): ReaderResult<never> {
  return failure('CLOSED', 'PNG doğrulaması iptal edildi; kayıt oturumu kapatılmış veya değiştirilmiş olabilir.', file);
}

async function readBytes(blob: Blob, start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
  throwIfAborted(signal);
  const buffer = await blob.slice(start, end).arrayBuffer();
  throwIfAborted(signal);
  return new Uint8Array(buffer);
}

function updateCrc(crc: number, bytes: Uint8Array): number {
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return crc >>> 0;
}

async function validCrc(blob: Blob, start: number, end: number, type: Uint8Array, expected: number, signal?: AbortSignal): Promise<boolean> {
  throwIfAborted(signal);
  let crc = updateCrc(0xffffffff, type);
  // Bound each temporary buffer even for a maliciously large ancillary chunk.
  for (let offset = start; offset < end; offset += 64 * 1024) {
    crc = updateCrc(crc, await readBytes(blob, offset, Math.min(offset + 64 * 1024, end), signal));
  }
  return ((crc ^ 0xffffffff) >>> 0) === expected;
}

async function validateScanlines(idat: readonly Blob[], info: TumPngInfo, file: string, signal?: AbortSignal): Promise<ReaderResult<TumPngInfo>> {
  if (signal?.aborted) return cancelled(file);
  if (typeof DecompressionStream === 'undefined') {
    return failure('UNSUPPORTED_FORMAT', 'Bu çalışma ortamında PNG zlib akışını doğrulayan DecompressionStream desteği yok.', file);
  }
  let decompressor: DecompressionStream;
  try {
    decompressor = new DecompressionStream('deflate');
  } catch {
    return failure('UNSUPPORTED_FORMAT', 'Bu çalışma ortamı PNG zlib/deflate doğrulamasını desteklemiyor.', file);
  }
  const bytesPerPixel = info.colorType === 2 ? 3 : 2;
  const scanlineLength = 1 + info.width * bytesPerPixel;
  const expectedLength = scanlineLength * info.height;
  // Blob composition keeps references to compressed chunks; no whole-image Uint8Array concatenation.
  const reader = new Blob([...idat]).stream().pipeThrough(decompressor).getReader();
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', onAbort, { once: true });
  let length = 0;
  let ended = false;
  try {
    while (true) {
      if (signal?.aborted) return cancelled(file);
      const part = await reader.read();
      if (signal?.aborted) return cancelled(file);
      if (part.done) { ended = true; break; }
      if (length + part.value.length > expectedLength) {
        return failure('DECODE_FAILED', 'PNG açılmış verisi beklenen tarama satırı boyutunu aşıyor.', file);
      }
      // Verify filter-byte positions only. Do not reconstruct pixels or interpret 16-bit depth.
      for (let offset = (scanlineLength - length % scanlineLength) % scanlineLength; offset < part.value.length; offset += scanlineLength) {
        if (part.value[offset] > 4) return failure('DECODE_FAILED', 'PNG tarama satırında geçersiz filtre baytı var.', file);
      }
      length += part.value.length;
    }
    if (length !== expectedLength) return failure('DECODE_FAILED', 'PNG açılmış verisi eksik veya tarama satırı boyutu hatalı.', file);
    return { ok: true, value: info };
  } catch {
    if (signal?.aborted) return cancelled(file);
    return failure('DECODE_FAILED', 'PNG IDAT zlib verisi açılamadı veya bütünlük kontrolünden geçemedi.', file);
  } finally {
    signal?.removeEventListener('abort', onAbort);
    if (!ended) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * Called lazily for a requested frame. Checks PNG structure, every chunk CRC and
 * bounded decompression/scanline layout, without decoding numerical depth pixels.
 * A browser preview of the original 16-bit PNG is not a numerical measurement.
 */
export async function validateTumPng(blob: Blob, stream: 'rgb' | 'depth', file: string, signal?: AbortSignal): Promise<ReaderResult<TumPngInfo>> {
  try {
    const signature = await readBytes(blob, 0, 8, signal);
    if (signature.length !== 8 || !SIGNATURE.every((byte, index) => signature[index] === byte)) {
      return failure('DECODE_FAILED', 'PNG dosya imzası eksik veya geçersiz.', file);
    }
    let offset = 8;
    let info: TumPngInfo | undefined;
    let sawIdat = false;
    let endedIdat = false;
    let sawPalette = false;
    const idat: Blob[] = [];
    while (offset < blob.size) {
      throwIfAborted(signal);
      if (blob.size - offset < 12) return failure('DECODE_FAILED', 'PNG chunk başlığı veya CRC alanı eksik.', file);
      const header = await readBytes(blob, offset, offset + 8, signal);
      const length = new DataView(header.buffer, header.byteOffset, 4).getUint32(0);
      const typeBytes = header.subarray(4, 8);
      const type = String.fromCharCode(...typeBytes);
      if (!/^[A-Za-z]{4}$/.test(type) || (typeBytes[2] & 32) !== 0) return failure('DECODE_FAILED', 'PNG chunk türü geçersiz.', file);
      if (length > 0x7fffffff || length > blob.size - offset - 12) return failure('DECODE_FAILED', 'PNG chunk uzunluğu geçersiz veya dosya kesilmiş.', file);
      const start = offset + 8;
      const end = start + length;
      const crcBytes = await readBytes(blob, end, end + 4, signal);
      const crc = new DataView(crcBytes.buffer, crcBytes.byteOffset, 4).getUint32(0);
      const crcMatches = await validCrc(blob, start, end, typeBytes, crc, signal);
      throwIfAborted(signal);
      if (!crcMatches) return failure('DECODE_FAILED', `PNG ${type} chunk CRC kontrolü başarısız.`, file);
      if (!info && type !== 'IHDR') return failure('DECODE_FAILED', 'PNG ilk chunk IHDR olmalıdır.', file);

      if (type === 'IHDR') {
        if (info || offset !== 8 || length !== 13) return failure('DECODE_FAILED', 'PNG IHDR sırası, sayısı veya uzunluğu geçersiz.', file);
        const data = await readBytes(blob, start, end, signal);
        const view = new DataView(data.buffer, data.byteOffset);
        const width = view.getUint32(0);
        const height = view.getUint32(4);
        if (!width || !height || width > 0x7fffffff || height > 0x7fffffff) return failure('DECODE_FAILED', 'PNG görüntü boyutu geçersiz.', file);
        if (width !== 640 || height !== 480) return failure('UNSUPPORTED_FORMAT', 'TUM okuyucusu yalnızca belgelenmiş 640×480 PNG boyutunu destekler.', file);
        if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0) return failure('UNSUPPORTED_FORMAT', 'PNG sıkıştırma, filtre yöntemi veya geçişli görüntü biçimi desteklenmiyor.', file);
        if ((stream === 'rgb' && (data[8] !== 8 || data[9] !== 2)) || (stream === 'depth' && (data[8] !== 16 || data[9] !== 0))) {
          return failure('UNSUPPORTED_FORMAT', `${stream} akışı için ${stream === 'rgb' ? '8-bit RGB (renk tipi 2)' : '16-bit tek kanallı (renk tipi 0)'} PNG gerekli.`, file);
        }
        info = { width, height, bitDepth: data[8] as 8 | 16, colorType: data[9] as 0 | 2 };
      } else if (type === 'IDAT') {
        if (endedIdat) return failure('DECODE_FAILED', 'PNG IDAT chunk dizisi kesintisiz olmalıdır.', file);
        sawIdat = true;
        idat.push(blob.slice(start, end));
      } else if (type === 'IEND') {
        if (length !== 0 || !sawIdat || end + 4 !== blob.size) return failure('DECODE_FAILED', 'PNG IEND geçersiz; görüntü verisi eksik veya dosya sonunda ek bayt var.', file);
        return await validateScanlines(idat, info!, file, signal);
      } else {
        if (sawIdat) endedIdat = true;
        if (type === 'PLTE') {
          if (sawPalette || sawIdat || stream === 'depth' || length === 0 || length > 768 || length % 3 !== 0) return failure('DECODE_FAILED', 'PNG PLTE palette chunk sırası veya biçimi geçersiz.', file);
          sawPalette = true;
        } else if ((typeBytes[0] & 32) === 0) {
          return failure('UNSUPPORTED_FORMAT', `Bilinmeyen kritik PNG chunk türü: ${type}.`, file);
        }
      }
      offset = end + 4;
    }
    return failure('DECODE_FAILED', 'PNG IEND chunk eksik.', file);
  } catch {
    if (signal?.aborted) return cancelled(file);
    return failure('DECODE_FAILED', 'PNG dosyası okunamadı; Blob içeriği veya dosya yapısı geçersiz.', file);
  }
}
