import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';
import { validateTumPng } from '../src/data/tum/png';

// Artificial test PNGs, not sensor measurements. Only the optional final test uses real TUM files.
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer = Buffer.alloc(0)): Buffer {
  const prefix = Buffer.alloc(8);
  prefix.writeUInt32BE(data.length);
  prefix.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([prefix.subarray(4), data])));
  return Buffer.concat([prefix, data, crc]);
}
function header(stream: 'rgb' | 'depth'): Buffer {
  const bytes = Buffer.alloc(13);
  bytes.writeUInt32BE(640);
  bytes.writeUInt32BE(480, 4);
  bytes[8] = stream === 'rgb' ? 8 : 16;
  bytes[9] = stream === 'rgb' ? 2 : 0;
  return bytes;
}
function scanlines(stream: 'rgb' | 'depth'): Buffer {
  return Buffer.alloc((1 + 640 * (stream === 'rgb' ? 3 : 2)) * 480);
}
function assemble(chunks: Buffer[]): Blob {
  return new Blob([Uint8Array.from(Buffer.concat([signature, ...chunks]))]);
}
function png(stream: 'rgb' | 'depth', overrides: { ihdr?: Buffer; raw?: Buffer; compressed?: Buffer } = {}): Blob {
  return assemble([
    chunk('IHDR', overrides.ihdr ?? header(stream)),
    chunk('IDAT', overrides.compressed ?? deflateSync(overrides.raw ?? scanlines(stream))),
    chunk('IEND'),
  ]);
}
async function expectError(blob: Blob, code: 'DECODE_FAILED' | 'UNSUPPORTED_FORMAT', stream: 'rgb' | 'depth' = 'rgb') {
  const result = await validateTumPng(blob, stream, 'artificial-test.png');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, code, result.error.message);
    assert.equal(result.error.file, 'artificial-test.png');
    assert.ok(result.error.recovery.length > 0);
  }
}

test('Artificial PNG: documented RGB and depth formats validate without invented numerical measurements', async () => {
  for (const stream of ['rgb', 'depth'] as const) {
    const result = await validateTumPng(png(stream), stream, `${stream}.png`);
    assert.ok(result.ok);
    assert.deepEqual(result.value, { width: 640, height: 480, bitDepth: stream === 'rgb' ? 8 : 16, colorType: stream === 'rgb' ? 2 : 0 });
    assert.deepEqual(Object.keys(result.value).sort(), ['bitDepth', 'colorType', 'height', 'width']);
  }
});

test('Artificial PNG: optional ancillary chunks and consecutive IDAT chunks are accepted', async () => {
  const compressed = deflateSync(scanlines('rgb'));
  const image = assemble([
    chunk('IHDR', header('rgb')),
    chunk('tEXt', Buffer.from('Comment\0Artificial fixture')),
    chunk('PLTE', Buffer.from([0, 0, 0])),
    chunk('IDAT', compressed.subarray(0, 10)),
    chunk('IDAT', compressed.subarray(10)),
    chunk('tEXt', Buffer.from('Comment\0Post-image metadata')),
    chunk('IEND'),
  ]);
  assert.ok((await validateTumPng(image, 'rgb', 'artificial-test.png')).ok);
});

test('Artificial PNG: invalid signatures, truncated chunks and CRC corruption return structured errors', async () => {
  const valid = png('rgb');
  const bytes = Buffer.from(await valid.arrayBuffer());
  bytes[0] ^= 1;
  await expectError(new Blob([Uint8Array.from(bytes)]), 'DECODE_FAILED');
  await expectError(valid.slice(0, 7), 'DECODE_FAILED');
  await expectError(valid.slice(0, valid.size - 1), 'DECODE_FAILED');
  const corrupted = Buffer.from(await valid.arrayBuffer());
  corrupted[41] ^= 1; // IDAT compressed byte; intentionally retain its original chunk CRC.
  await expectError(new Blob([Uint8Array.from(corrupted)]), 'DECODE_FAILED');
  const maliciousLength = Buffer.from(await valid.arrayBuffer());
  maliciousLength.writeUInt32BE(0x80000000, 33);
  await expectError(new Blob([Uint8Array.from(maliciousLength)]), 'DECODE_FAILED');
});

test('Artificial PNG: IHDR dimensions, RGB/depth encoding and methods are checked separately', async () => {
  const zeroWidth = header('rgb'); zeroWidth.writeUInt32BE(0);
  await expectError(png('rgb', { ihdr: zeroWidth }), 'DECODE_FAILED');
  const wrongSize = header('rgb'); wrongSize.writeUInt32BE(320);
  await expectError(png('rgb', { ihdr: wrongSize }), 'UNSUPPORTED_FORMAT');
  await expectError(png('rgb'), 'UNSUPPORTED_FORMAT', 'depth');
  await expectError(png('depth'), 'UNSUPPORTED_FORMAT', 'rgb');
  const rgba = header('rgb'); rgba[9] = 6;
  await expectError(png('rgb', { ihdr: rgba }), 'UNSUPPORTED_FORMAT');
  for (const index of [10, 11, 12]) {
    const altered = header('rgb'); altered[index] = 1;
    await expectError(png('rgb', { ihdr: altered }), 'UNSUPPORTED_FORMAT');
  }
  await expectError(png('rgb', { ihdr: header('rgb').subarray(0, 12) }), 'DECODE_FAILED');
});

test('Artificial PNG: critical chunk order, missing terminators and trailing bytes are rejected', async () => {
  const ihdr = chunk('IHDR', header('rgb'));
  const idat = chunk('IDAT', deflateSync(scanlines('rgb')));
  const iend = chunk('IEND');
  for (const chunks of [
    [idat, ihdr, iend],
    [ihdr, ihdr, idat, iend],
    [ihdr, iend],
    [ihdr, idat],
    [ihdr, idat, chunk('tEXt'), idat, iend],
    [ihdr, idat, chunk('PLTE', Buffer.from([0, 0, 0])), iend],
    [ihdr, idat, iend, Buffer.from([0])],
  ]) await expectError(assemble(chunks), 'DECODE_FAILED');
  await expectError(assemble([ihdr, chunk('ABCD'), idat, iend]), 'UNSUPPORTED_FORMAT');
  await expectError(assemble([ihdr, chunk('abca'), idat, iend]), 'DECODE_FAILED');
  await expectError(assemble([chunk('IHDR', header('depth')), chunk('PLTE', Buffer.from([0, 0, 0])), chunk('IDAT', deflateSync(scanlines('depth'))), iend]), 'DECODE_FAILED', 'depth');
});

test('Artificial PNG: CRC-correct but invalid IDAT, zlib checksum and scanline data fail validation', async () => {
  await expectError(png('rgb', { compressed: Buffer.from('not a zlib stream') }), 'DECODE_FAILED');
  const badChecksum = Buffer.from(deflateSync(scanlines('rgb'))); badChecksum[badChecksum.length - 1] ^= 1;
  await expectError(png('rgb', { compressed: badChecksum }), 'DECODE_FAILED');
  await expectError(png('rgb', { raw: scanlines('rgb').subarray(0, -1) }), 'DECODE_FAILED');
  await expectError(png('rgb', { raw: Buffer.concat([scanlines('rgb'), Buffer.from([0])]) }), 'DECODE_FAILED');
  const invalidFilter = scanlines('depth'); invalidFilter[1281 * 300] = 5;
  await expectError(png('depth', { raw: invalidFilter }), 'DECODE_FAILED', 'depth');
  // A small compressed input cannot inflate indefinitely; exact documented layout bounds output.
  await expectError(png('rgb', { raw: Buffer.alloc(scanlines('rgb').length * 5) }), 'DECODE_FAILED');
});

test('Artificial PNG: absent native deflate support returns an actionable unsupported-format error', async () => {
  const original = globalThis.DecompressionStream;
  try {
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, writable: true, value: undefined });
    await expectError(png('rgb'), 'UNSUPPORTED_FORMAT');
  } finally {
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, writable: true, value: original });
  }
});

test('Artificial PNG: abort before validation or during a Blob read stops further chunk work', async () => {
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  let slices = 0;
  class CountingBlob extends Blob {
    override slice(start?: number, end?: number, contentType?: string): Blob {
      slices++;
      return super.slice(start, end, contentType);
    }
  }
  const aborted = await validateTumPng(new CountingBlob([await png('rgb').arrayBuffer()]), 'rgb', 'artificial-abort.png', alreadyAborted.signal);
  assert.equal(aborted.ok, false);
  if (!aborted.ok) assert.equal(aborted.error.code, 'CLOSED');
  assert.equal(slices, 0);

  let releaseRead!: () => void;
  let notifyRead!: () => void;
  const gate = new Promise<void>((resolve) => { releaseRead = resolve; });
  const started = new Promise<void>((resolve) => { notifyRead = resolve; });
  const readOffsets: number[] = [];
  class DelayedCrcBlob extends Blob {
    override slice(start = 0, end?: number, contentType?: string): Blob {
      readOffsets.push(start);
      const part = super.slice(start, end, contentType);
      if (start === 41) {
        const originalRead = part.arrayBuffer.bind(part);
        Object.defineProperty(part, 'arrayBuffer', { value: async () => { notifyRead(); await gate; return originalRead(); } });
      }
      return part;
    }
  }
  const controller = new AbortController();
  const pending = validateTumPng(new DelayedCrcBlob([await png('rgb').arrayBuffer()]), 'rgb', 'artificial-abort.png', controller.signal);
  await started;
  const countAtAbort = readOffsets.length;
  controller.abort();
  releaseRead();
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'CLOSED');
    assert.equal(result.error.file, 'artificial-abort.png');
    assert.match(result.error.recovery, /yeniden açın/);
  }
  assert.equal(readOffsets.length, countAtAbort, 'Abort must prevent subsequent chunk reads.');
});

test('Artificial control fixture: abort cancels a pending decompression reader', async () => {
  const original = globalThis.DecompressionStream;
  let notifyRead!: () => void;
  const started = new Promise<void>((resolve) => { notifyRead = resolve; });
  let cancellations = 0;
  class PendingDecompressionStream {
    readonly readable = new ReadableStream<Uint8Array>({ pull: () => { notifyRead(); }, cancel: () => { cancellations++; } });
    readonly writable = new WritableStream<Uint8Array>();
  }
  try {
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, writable: true, value: PendingDecompressionStream });
    const controller = new AbortController();
    const pending = validateTumPng(png('rgb'), 'rgb', 'artificial-abort.png', controller.signal);
    await started;
    controller.abort();
    const result = await pending;
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'CLOSED');
    assert.equal(cancellations, 1);
  } finally {
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, writable: true, value: original });
  }
});

test('Real local TUM sample: all six original PNGs validate, when installed', async (context) => {
  const files = [
    ['rgb', '1305031452.791720.png'], ['rgb', '1305031462.995550.png'], ['rgb', '1305031473.196069.png'],
    ['depth', '1305031453.374112.png'], ['depth', '1305031463.278737.png'], ['depth', '1305031473.190828.png'],
  ] as const;
  const root = new URL('../data/local/tum-rgbd-freiburg1-desk/rgbd_dataset_freiburg1_desk/', import.meta.url);
  let bytes: Buffer[];
  try {
    bytes = await Promise.all(files.map(([stream, name]) => readFile(new URL(`${stream}/${name}`, root))));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    context.skip('Real ignored TUM sample is absent; install the official ten-file sample from docs/datasets.md.');
    return;
  }
  for (let index = 0; index < files.length; index++) {
    const [stream, name] = files[index];
    const result = await validateTumPng(new Blob([Uint8Array.from(bytes[index])]), stream, `${stream}/${name}`);
    assert.ok(result.ok, result.ok ? undefined : result.error.message);
    assert.equal(result.value.width, 640);
    assert.equal(result.value.height, 480);
    assert.equal(result.value.bitDepth, stream === 'rgb' ? 8 : 16);
  }
});
