import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';
import { decodeTumDepth, tumDepthToMetres } from '../src/data/tum/depth';

// Generated PNGs below are artificial numerical fixtures, never presented as real sensor data.
const WIDTH = 640;
const HEIGHT = 480;
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name: string, data: Buffer = Buffer.alloc(0)): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length);
  header.write(name, 4);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])));
  return Buffer.concat([header, data, crc]);
}
function fixtureValues(): Uint16Array {
  const values = Uint16Array.from({ length: WIDTH * HEIGHT }, (_, index) => ((index * 257) ^ ((index >> 4) * 113)) & 65535);
  values.set([0, 5000, 10000, 65535, 1, 255, 256, 32768, 513]);
  return values;
}
function predictor(a: number, b: number, c: number): number {
  const distances = [Math.abs(b - c), Math.abs(a - c), Math.abs(a + b - 2 * c)];
  return [a, b, c][distances.indexOf(Math.min(...distances))];
}
function filteredPixels(values: Uint16Array, chooseFilter: (row: number) => number): Buffer {
  const bytes = Buffer.alloc((WIDTH * 2 + 1) * HEIGHT);
  const rows = Buffer.alloc(WIDTH * HEIGHT * 2);
  values.forEach((value, index) => rows.writeUInt16BE(value, index * 2));
  for (let row = 0; row < HEIGHT; row++) {
    const filter = chooseFilter(row);
    const output = row * (WIDTH * 2 + 1);
    bytes[output] = filter;
    for (let column = 0; column < WIDTH * 2; column++) {
      const index = row * WIDTH * 2 + column;
      const left = column >= 2 ? rows[index - 2] : 0;
      const up = row ? rows[index - WIDTH * 2] : 0;
      const diagonal = row && column >= 2 ? rows[index - WIDTH * 2 - 2] : 0;
      const predicted = [0, left, up, Math.floor((left + up) / 2), predictor(left, up, diagonal)][filter];
      bytes[output + 1 + column] = (rows[index] - predicted) & 255;
    }
  }
  return bytes;
}
function fixture(raw: Uint16Array, chooseFilter: (row: number) => number = () => 0): Blob {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 16;
  const compressed = deflateSync(filteredPixels(raw, chooseFilter));
  return new Blob([Uint8Array.from(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from('Comment\0Artificial uint16 depth fixture')),
    chunk('IDAT', compressed.subarray(0, 7)),
    chunk('IDAT', compressed.subarray(7)),
    chunk('IEND'),
  ]))]);
}
function expectPixels(actual: Uint16Array, expected: Uint16Array): void {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < expected.length; index++) assert.equal(actual[index], expected[index], `raw pixel ${index}`);
}

test('Artificial numerical inputs: documented TUM scaling preserves raw values and treats zero as invalid', async () => {
  assert.equal(tumDepthToMetres(0), null);
  assert.equal(tumDepthToMetres(5000), 1);
  assert.equal(tumDepthToMetres(10000), 2);
  assert.equal(tumDepthToMetres(65535), 13.107);
  for (const invalid of [-1, .5, 65536, Infinity, -Infinity, NaN]) assert.equal(tumDepthToMetres(invalid), null);
  const expected = fixtureValues();
  const result = await decodeTumDepth(fixture(expected), 'artificial-depth.png');
  assert.ok(result.ok);
  expectPixels(result.value.raw, expected);
  assert.equal(result.value.rawUnit, 'encoded-uint16');
  assert.equal(result.value.unitsPerMetre, 5000);
  assert.equal(result.value.invalidRawValue, 0);
  assert.equal(result.value.source.file, 'artificial-depth.png');
  assert.match(result.value.source.evidence, /tum.de\/data\/datasets\/rgbd-dataset\/file_formats/);
  assert.equal('temperature' in result.value, false);
});

test('Artificial PNGs: every filter 0–4 reconstructs all 307200 original big-endian uint16 samples', async () => {
  const expected = fixtureValues();
  for (let filter = 0; filter <= 4; filter++) {
    const result = await decodeTumDepth(fixture(expected, () => filter), `artificial-filter-${filter}.png`);
    assert.ok(result.ok, result.ok ? undefined : result.error.message);
    expectPixels(result.value.raw, expected);
    assert.deepEqual(Array.from(result.value.raw.subarray(0, 4)), [0, 5000, 10000, 65535]);
  }
  const mixed = await decodeTumDepth(fixture(expected, (row) => row % 5), 'artificial-mixed-filters.png');
  assert.ok(mixed.ok);
  expectPixels(mixed.value.raw, expected);
});

test('Artificial Paeth edges: left/up/diagonal prediction and specified tie order reconstruct correctly', async () => {
  const expected = new Uint16Array(WIDTH * HEIGHT);
  // At columns 1,3,5,7,9,11 of row 1 these byte triples exercise diagonal, left,
  // up, left/up tie, left/diagonal tie, and up/diagonal tie respectively.
  const triples = [[10, 20, 15], [20, 10, 5], [10, 20, 5], [10, 10, 0], [0, 15, 10], [15, 0, 10]];
  const prediction = [15, 20, 20, 10, 0, 0];
  for (let pair = 0; pair < triples.length; pair++) {
    const [a, b, c] = triples[pair];
    const column = pair * 2;
    expected[column] = c * 257;
    expected[column + 1] = b * 257;
    expected[WIDTH + column] = a * 257;
    expected[WIDTH + column + 1] = 42 * 257;
  }
  const bytes = filteredPixels(expected, (row) => row === 1 ? 4 : 0);
  for (let pair = 0; pair < triples.length; pair++) {
    const bytePosition = (WIDTH * 2 + 1) + 1 + (pair * 2 + 1) * 2;
    assert.equal(bytes[bytePosition], (42 - prediction[pair]) & 255, `fixed Paeth residual ${pair}`);
  }
  const result = await decodeTumDepth(fixture(expected, (row) => row === 1 ? 4 : 0), 'artificial-paeth-edges.png');
  assert.ok(result.ok);
  expectPixels(result.value.raw, expected);
});

test('Artificial malformed PNG: numerical decoder propagates structured PNG errors', async () => {
  const result = await decodeTumDepth(new Blob(['clearly not a PNG']), 'artificial-broken.png');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'DECODE_FAILED');
    assert.equal(result.error.file, 'artificial-broken.png');
    assert.ok(result.error.recovery.length > 0);
  }
});

test('Artificial cancellation: already-aborted numerical decode reads nothing', async () => {
  let reads = 0;
  class CountingBlob extends Blob {
    override slice(start?: number, end?: number, contentType?: string): Blob {
      reads++;
      return super.slice(start, end, contentType);
    }
  }
  const controller = new AbortController(); controller.abort();
  const result = await decodeTumDepth(new CountingBlob(['unused']), 'artificial-aborted.png', controller.signal);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'CLOSED');
  assert.equal(reads, 0);
});

test('Artificial control fixture: cancellation stops the second, numerical decompression pass', async () => {
  const original = globalThis.DecompressionStream;
  let calls = 0;
  let cancellations = 0;
  let notifyRead!: () => void;
  const started = new Promise<void>((resolve) => { notifyRead = resolve; });
  function ControlledDecompressor(format: CompressionFormat) {
    calls++;
    if (calls === 1) return new original(format); // Preserve real PNG validation in the first pass.
    return {
      readable: new ReadableStream<Uint8Array>({ pull: () => { notifyRead(); }, cancel: () => { cancellations++; } }),
      writable: new WritableStream<Uint8Array>(),
    };
  }
  try {
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, writable: true, value: ControlledDecompressor });
    const controller = new AbortController();
    const pending = decodeTumDepth(fixture(fixtureValues()), 'artificial-aborted.png', controller.signal);
    await started;
    controller.abort();
    const result = await pending;
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'CLOSED');
    assert.equal(calls, 2);
    assert.equal(cancellations, 1);
  } finally {
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, writable: true, value: original });
  }
});

test('Real local TUM depth originals: every decoded pixel matches an independent Pillow reference', async (context) => {
  // Independent Pillow 11.3.0 PNG mode I;16 reference, 2026-10-18.
  // Hashes cover all decoded uint16 samples in canonical big-endian order.
  // These are local decoder reference results, not official publisher checksums or sensor-accuracy claims.
  const reference = [
    { file: '1305031453.374112.png', zeros: 52010, firstValidIndex: 1, firstValidRaw: 7343, firstValidMetres: 1.4686, centreRaw: 5398, rawBigEndianSha256: 'cfa54e427d98f4e2f2d20848af848e1820ad8fad705e23b0c0fbca74c2449b18' },
    { file: '1305031463.278737.png', zeros: 65218, firstValidIndex: 0, firstValidRaw: 6061, firstValidMetres: 1.2122, centreRaw: 3604, rawBigEndianSha256: '66489b27d8f4c0c18b224fa6984629001462b7e8915b8067551a8414e368a0ad' },
    { file: '1305031473.190828.png', zeros: 62569, firstValidIndex: 0, firstValidRaw: 5896, firstValidMetres: 1.1792, centreRaw: 3483, rawBigEndianSha256: '40ad6145dc97bfc928821db5bbc0e4f589690dea23a4fc460239eddeb76929cb' },
  ];
  const root = new URL('../data/local/tum-rgbd-freiburg1-desk/rgbd_dataset_freiburg1_desk/depth/', import.meta.url);
  let files: Buffer[];
  try {
    files = await Promise.all(reference.map(({ file }) => readFile(new URL(file, root))));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    context.skip('Real ignored TUM sample absent; install the official sample from docs/datasets.md.');
    return;
  }
  for (let index = 0; index < reference.length; index++) {
    const expected = reference[index];
    const result = await decodeTumDepth(new Blob([Uint8Array.from(files[index])]), `depth/${expected.file}`);
    assert.ok(result.ok, result.ok ? undefined : result.error.message);
    assert.equal(result.value.width, WIDTH);
    assert.equal(result.value.height, HEIGHT);
    assert.equal(result.value.raw.length, WIDTH * HEIGHT);
    let zeros = 0;
    let firstValidIndex = -1;
    const canonical = Buffer.alloc(result.value.raw.length * 2);
    result.value.raw.forEach((raw, pixel) => {
      canonical.writeUInt16BE(raw, pixel * 2);
      if (raw === 0) zeros++;
      else if (firstValidIndex === -1) firstValidIndex = pixel;
    });
    const hash = createHash('sha256').update(canonical).digest('hex');
    assert.equal(hash, expected.rawBigEndianSha256, `${expected.file}: all decoded pixels must match the independent Pillow reference.`);
    assert.equal(zeros, expected.zeros);
    assert.equal(firstValidIndex, expected.firstValidIndex);
    assert.equal(result.value.raw[firstValidIndex], expected.firstValidRaw);
    assert.equal(result.value.raw[240 * WIDTH + 320], expected.centreRaw);
    assert.equal(tumDepthToMetres(result.value.raw[firstValidIndex]), expected.firstValidMetres);
    context.diagnostic(JSON.stringify({ file: expected.file, pixels: result.value.raw.length, zeros, firstValidIndex, firstValidRaw: result.value.raw[firstValidIndex], centreRaw: result.value.raw[240 * WIDTH + 320], rawBigEndianSha256: hash, reference: 'independent Pillow 11.3.0, 2026-10-18' }));
  }
});
