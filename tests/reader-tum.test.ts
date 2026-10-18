import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { TumRecordingReader } from '../src/data';
import type {
  DatasetManifest, RecordingInput, RecordingReader, ReaderError, ReaderResult,
} from '../src/shared/types';

// YAPAY TEST: Bunlar TUM'dan alınmış dosyalar değildir. PNG pikselleri ve TXT
// kayıtları yalnızca okuyucu davranışını tekrar üretilebilir şekilde sınar.
const ROOT = 'yapay-test';
const RGB = [0, 2, 4].map(index => `${ROOT}/rgb/${index}.png`);
const DEPTH = [0, 2, 4].map(index => `${ROOT}/depth/${index}.png`);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, payload: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, payload])));
  return Buffer.concat([length, name, payload, checksum]);
}

function png(bitDepth: 8 | 16, colorType: 0 | 2): Uint8Array<ArrayBuffer> {
  const width = 640; const height = 480;
  const channels = colorType === 2 ? 3 : 1;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = bitDepth; header[9] = colorType;
  const rows = Buffer.alloc(height * (1 + width * channels * bitDepth / 8));
  // All-zero pixels are intentional artificial data. Each scanline has filter 0.
  return new Uint8Array(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

const rgbBytes = png(8, 2);
const depthBytes = png(16, 0);

function fixture(): RecordingInput {
  const manifest: DatasetManifest = {
    contractVersion: 1,
    recording: {
      id: 'YAPAY-TEST-reader-only', name: 'YAPAY TEST — TUM okuyucu girdisi',
      // Contract shape exercises the real-reader path; the test's identity,
      // source and evidence explicitly distinguish these bytes from real data.
      provenance: 'real',
      source: { title: 'YAPAY TEST: Node zlib ile üretilen PNG/TXT', url: null },
      license: { status: 'unknown' },
    },
    format: { status: 'known', value: 'TUM RGB-D PNG/TXT', evidence: 'YAPAY TEST fixture' },
    acquisition: {
      instructions: 'YAPAY TEST: Bu dosyalar indirilmez; test içinde oluşturulur.',
      files: [
        `${ROOT}/rgb.txt`, `${ROOT}/depth.txt`, `${ROOT}/groundtruth.txt`,
        `${ROOT}/accelerometer.txt`, ...RGB, ...DEPTH,
      ],
    },
    timing: {
      kind: 'unknown', timeBase: null,
      description: 'YAPAY TEST: akışlar arası saat ilişkisi yok.', nominalFps: { status: 'unknown' },
    },
    radiometry: { status: 'unavailable', unit: null, evidence: 'YAPAY TEST: sıcaklık yok.' },
    citation: null, versionOrAccessDate: null,
  };
  const list = (stream: 'rgb' | 'depth') => [
    '# YAPAY TEST — özgün TUM verisi değildir', '# timestamp filename', '',
    ...Array.from({ length: 5 }, (_, index) => `130000000${index}.000001 ${stream}/${index}.png`),
    '',
  ].join('\n');
  const files = new Map<string, Blob>([
    [`${ROOT}/rgb.txt`, new Blob([list('rgb')])],
    [`${ROOT}/depth.txt`, new Blob([list('depth')])],
    [`${ROOT}/groundtruth.txt`, new Blob(['# YAPAY TEST\n1300000000.1 0 0 0 0 0 0 1\n'])],
    [`${ROOT}/accelerometer.txt`, new Blob(['# YAPAY TEST\n1300000000.2 0 0 1\n'])],
    ...RGB.map(file => [file, new Blob([rgbBytes], { type: 'image/png' })] as [string, Blob]),
    ...DEPTH.map(file => [file, new Blob([depthBytes], { type: 'image/png' })] as [string, Blob]),
  ]);
  return { manifest, files };
}

function value<T>(result: ReaderResult<T>): T {
  assert.ok(result.ok, result.ok ? undefined : `${result.error.code}: ${result.error.message}`);
  return result.value;
}

function error(result: ReaderResult<unknown>, code: ReaderError['code']): ReaderError {
  assert.equal(result.ok, false);
  if (result.ok) assert.fail('Hata sonucu bekleniyordu.');
  assert.equal(result.error.code, code);
  assert.ok(result.error.message.length > 0);
  assert.ok(result.error.recovery.length > 0);
  return result.error;
}

function withFile(input: RecordingInput, file: string, blob: Blob): RecordingInput {
  return { ...input, files: new Map([...input.files, [file, blob]]) };
}

function deferred() {
  let resolvePromise!: () => void; let resolved = false;
  const promise = new Promise<void>(done => { resolvePromise = done; });
  return {
    promise,
    resolve: () => { resolved = true; resolvePromise(); },
    get resolved() { return resolved; },
  };
}

async function beforeDeadline<T>(work: Promise<T>): Promise<T> {
  // This is a failure deadline, not a scheduling sleep: cancellation must settle
  // without releasing the Blob gate, and a regression must still run cleanup.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('İptal edilen işlem, Blob kapısı hâlâ kapalıyken tamamlanmadı.')), 2000);
  });
  try { return await Promise.race([work, deadline]); }
  finally { clearTimeout(timeout); }
}

class DelayedTextBlob extends Blob {
  constructor(parts: BlobPart[], private readonly gate: ReturnType<typeof deferred>, private readonly entered: ReturnType<typeof deferred>) {
    super(parts);
  }
  override async text(): Promise<string> {
    this.entered.resolve(); await this.gate.promise; return super.text();
  }
  override async arrayBuffer(): Promise<ArrayBuffer> {
    this.entered.resolve(); await this.gate.promise; return super.arrayBuffer();
  }
}

class DelayedSliceBlob extends Blob {
  constructor(parts: BlobPart[], private readonly gate: ReturnType<typeof deferred>, private readonly entered: ReturnType<typeof deferred>, private readonly onRead?: () => void) {
    super(parts, { type: 'image/png' });
  }
  override slice(start?: number, end?: number, contentType?: string): Blob {
    const part = super.slice(start, end, contentType);
    const gate = this.gate; const entered = this.entered; const onRead = this.onRead;
    return new class extends Blob {
      override async arrayBuffer(): Promise<ArrayBuffer> {
        onRead?.(); entered.resolve(); await gate.promise; return super.arrayBuffer();
      }
    }([part]);
  }
}

for (const stream of ['rgb', 'depth'] as const) {
  test(`YAPAY TEST: ${stream} alt kümesi açılır; ilk/son kare ve kaynak eşlemesi korunur`, async () => {
    const reader = new TumRecordingReader({ stream, mode: 'manifest-subset' });
    const contractReader: RecordingReader = reader;
    try {
      assert.deepEqual(contractReader.getState(), { status: 'idle' });
      error(contractReader.getMetadata(), 'NOT_OPEN');
      error(await contractReader.getFrame(0), 'NOT_OPEN');
      const metadata = value(await contractReader.open(fixture()));
      assert.equal(metadata.frameCount, 3);
      assert.equal(contractReader.getState().status, 'ready');
      assert.equal(value(contractReader.getMetadata()).recording.id, 'YAPAY-TEST-reader-only');
      assert.equal(metadata.timing.kind, 'unknown');
      const source = value(reader.getSourceInfo());
      assert.equal(source.stream, stream); assert.equal(source.mode, 'manifest-subset');
      assert.equal(source.sourceRowCount, 5); assert.equal(source.frameCount, 3);
      assert.equal(source.unselectedSourceRows, 2);
      assert.deepEqual(source.frames.map(frame => frame.apiIndex), [0, 1, 2]);
      assert.deepEqual(source.frames.map(frame => frame.sourceIndex), [0, 2, 4]);
      assert.deepEqual(source.frames.map(frame => frame.lineNumber), [4, 6, 8]);
      assert.deepEqual(source.frames.map(frame => frame.timestampRaw), [
        '1300000000.000001', '1300000002.000001', '1300000004.000001',
      ]);
      assert.equal(source.listFile, `${ROOT}/${stream}.txt`);
      for (const index of [0, 2]) {
        const frame = value(await contractReader.getFrame(index));
        assert.equal(frame.index, index); assert.deepEqual(frame.time, { kind: 'unknown' });
        assert.equal(frame.temperature, undefined);
        assert.equal(frame.image.width, 640); assert.equal(frame.image.height, 480);
        assert.match(frame.image.url, /^blob:/);
        const actual = new Uint8Array(await (await fetch(frame.image.url)).arrayBuffer());
        assert.deepEqual(actual, stream === 'rgb' ? rgbBytes : depthBytes);
      }
    } finally { await contractReader.close(); }
  });
}

test('YAPAY TEST: tarayıcı File nesneleri Blob girdisi olarak kabul edilir', async () => {
  const input = fixture();
  const files = new Map([...input.files].map(([file, blob]) => [file, new File([blob], file.split('/').at(-1)!)]));
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    value(await reader.open({ ...input, files })); value(await reader.getFrame(0));
  } finally { await reader.close(); }
});

test('YAPAY TEST: akışlar ayrı zaman damgalarını ve kaynak satır sırasını korur', async () => {
  const input = withFile(fixture(), `${ROOT}/depth.txt`, new Blob([
    '# YAPAY TEST: zamanlar RGB ile eşleştirilmez, sıra yeniden düzenlenmez.\n',
    '2300000004.987654 depth/4.png\n',
    '2300000000.123456 depth/0.png\n',
    '2300000002.111111 depth/2.png\n',
  ]));
  const rgb = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  const depth = new TumRecordingReader({ stream: 'depth', mode: 'manifest-subset' });
  try {
    value(await rgb.open(input)); value(await depth.open(input));
    const rgbSource = value(rgb.getSourceInfo()); const depthSource = value(depth.getSourceInfo());
    assert.equal(rgbSource.frames[0].timestampRaw, '1300000000.000001');
    assert.deepEqual(depthSource.frames.map(frame => frame.file), [DEPTH[2], DEPTH[0], DEPTH[1]]);
    assert.deepEqual(depthSource.frames.map(frame => frame.sourceIndex), [0, 1, 2]);
    assert.deepEqual(depthSource.frames.map(frame => frame.timestampRaw), [
      '2300000004.987654', '2300000000.123456', '2300000002.111111',
    ]);
    assert.deepEqual(value(await rgb.getFrame(0)).time, { kind: 'unknown' });
    assert.deepEqual(value(await depth.getFrame(0)).time, { kind: 'unknown' });
  } finally { await rgb.close(); await depth.close(); }
});

test('YAPAY TEST: tam kayıt modu kaynak listesindeki eksik dosyayı sessizce atlamaz', async () => {
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'full-recording' });
  try {
    const failure = error(await reader.open(fixture()), 'MISSING_FILE');
    assert.equal(failure.file, `${ROOT}/rgb/1.png`);
    assert.equal(reader.getState().status, 'error');
    error(reader.getMetadata(), 'NOT_OPEN');
  } finally { await reader.close(); }
});

test('YAPAY TEST: tam kayıt modu manifest dışındaki tamamlayıcı kaynak PNG dosyalarını okur', async () => {
  let input = fixture();
  for (const index of [1, 3]) input = withFile(input, `${ROOT}/rgb/${index}.png`, new Blob([rgbBytes]));
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'full-recording' });
  try {
    assert.equal(value(await reader.open(input)).frameCount, 5);
    const source = value(reader.getSourceInfo());
    assert.equal(source.unselectedSourceRows, 0);
    assert.deepEqual(source.frames.map(frame => frame.sourceIndex), [0, 1, 2, 3, 4]);
    assert.equal(value(await reader.getFrame(4)).index, 4);
  } finally { await reader.close(); }
});

test('YAPAY TEST: geçersiz indeksler hazır okuyucuyu bozmaz', async () => {
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    value(await reader.open(fixture()));
    const invalid: unknown[] = [
      -1, 0.5, 3, NaN, Infinity, Symbol('YAPAY TEST indeks'), Object.create(null),
      { [Symbol.toPrimitive]() { throw new TypeError('YAPAY TEST: indeksi metne dönüştürme'); } },
    ];
    for (const index of invalid) {
      // Runtime JavaScript callers can bypass the TypeScript number signature.
      error(await reader.getFrame(index as number), 'INVALID_INDEX');
      assert.equal(reader.getState().status, 'ready');
    }
    value(await reader.getFrame(0));
  } finally { await reader.close(); }
});

test('YAPAY TEST: manifestte beklenen dosyanın eksikliği açık hata verir', async () => {
  const input = fixture(); const files = new Map(input.files);
  // Also require the opposite stream's manifest file: no partial success is implied.
  files.delete(DEPTH[2]);
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    assert.equal(error(await reader.open({ ...input, files }), 'MISSING_FILE').file, DEPTH[2]);
  } finally { await reader.close(); }
});

test('YAPAY TEST: eksik veya hatalı manifestler kontrollü hata verir', async () => {
  const input = fixture();
  const malformed: unknown[] = [
    undefined, null, {}, { ...input.manifest, contractVersion: 99 },
    { ...input.manifest, recording: null },
    { ...input.manifest, acquisition: { instructions: '', files: ['/absolute/rgb.txt'] } },
  ];
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    for (const manifest of malformed) {
      error(await reader.open({ ...input, manifest } as RecordingInput), 'INVALID_MANIFEST');
      assert.equal(reader.getState().status, 'error');
      error(reader.getMetadata(), 'NOT_OPEN');
    }
    value(await reader.open(input));
  } finally { await reader.close(); }
});

test('YAPAY TEST: hatalı TXT satırı dosya ve özgün satır numarasıyla raporlanır', async () => {
  const file = `${ROOT}/rgb.txt`;
  const input = withFile(fixture(), file, new Blob(['# YAPAY TEST\n\nNaN rgb/0.png\n']));
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    const failure = error(await reader.open(input), 'DECODE_FAILED');
    assert.equal(failure.file, file); assert.match(failure.message, /3/);
  } finally { await reader.close(); }
});

test('YAPAY TEST: açılışta Blob okuma hatası exception olarak dışarı çıkmaz', async () => {
  const unreadable = new class extends Blob {
    override async text(): Promise<string> { throw new Error('YAPAY TEST okuma hatası'); }
    override async arrayBuffer(): Promise<ArrayBuffer> { throw new Error('YAPAY TEST okuma hatası'); }
  }(['# YAPAY TEST']);
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    error(await reader.open(withFile(fixture(), `${ROOT}/rgb.txt`, unreadable)), 'DECODE_FAILED');
    assert.equal(reader.getState().status, 'error');
  } finally { await reader.close(); }
});

test('YAPAY TEST: PNG başlangıçta okunmaz; geçerli olmayan görüntü getFrame sırasında reddedilir', async () => {
  let slices = 0;
  const invalid = new class extends Blob {
    override slice(start?: number, end?: number, contentType?: string): Blob {
      slices++; return super.slice(start, end, contentType);
    }
  }(['YAPAY TEST: PNG değildir']);
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    value(await reader.open(withFile(fixture(), RGB[0], invalid)));
    value(reader.getMetadata()); assert.equal(slices, 0);
    assert.equal(error(await reader.getFrame(0), 'DECODE_FAILED').file, RGB[0]);
    assert.ok(slices > 0);
  } finally { await reader.close(); }
});

test('YAPAY TEST: geçerli fakat seçilen akışa uygun olmayan PNG biçimi reddedilir', async () => {
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    value(await reader.open(withFile(fixture(), RGB[0], new Blob([png(8, 0)]))));
    assert.equal(error(await reader.getFrame(0), 'UNSUPPORTED_FORMAT').file, RGB[0]);
  } finally { await reader.close(); }
});

test('YAPAY TEST: başlığı doğru olsa da kesilmiş veya CRC değeri bozuk PNG reddedilir', async () => {
  const corrupt = rgbBytes.slice(); corrupt[corrupt.length - 1] ^= 1;
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    for (const bytes of [rgbBytes.slice(0, 40), corrupt]) {
      value(await reader.open(withFile(fixture(), RGB[0], new Blob([bytes]))));
      error(await reader.getFrame(0), 'DECODE_FAILED');
    }
  } finally { await reader.close(); }
});

test('YAPAY TEST: eşzamanlı aynı kare istekleri aynı oturum URL kaynağını paylaşır', async () => {
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    value(await reader.open(fixture()));
    const frames = (await Promise.all([reader.getFrame(1), reader.getFrame(1), reader.getFrame(1)])).map(value);
    assert.equal(new Set(frames.map(frame => frame.image.url)).size, 1);
    assert.equal(value(await reader.getFrame(1)).image.url, frames[0].image.url);
  } finally { await reader.close(); }
});

test('YAPAY TEST: metadata ve kaynak eşlemesi tüketici değişikliğinden korunur', async () => {
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    const metadata = value(await reader.open(fixture()));
    const originalName = metadata.recording.name;
    metadata.frameCount = 999;
    metadata.recording.name = 'Tüketici değişikliği';
    assert.equal(value(reader.getMetadata()).frameCount, 3);
    assert.equal(value(reader.getMetadata()).recording.name, originalName);
    const source = value(reader.getSourceInfo());
    // Runtime callers can bypass readonly; they still must not corrupt internals.
    try { (source.frames[0] as { sourceIndex: number }).sourceIndex = 999; } catch { /* frozen snapshots are also valid */ }
    assert.equal(value(reader.getSourceInfo()).frames[0].sourceIndex, 0);
  } finally { await reader.close(); }
});

test('YAPAY TEST: close tekrarlanabilir; kare URL kaynakları bırakılır; yeniden open çalışır', async () => {
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  value(await reader.open(fixture()));
  const urls = [value(await reader.getFrame(0)).image.url, value(await reader.getFrame(2)).image.url];
  await reader.close(); await reader.close();
  assert.equal(reader.getState().status, 'closed');
  error(reader.getMetadata(), 'CLOSED'); error(reader.getSourceInfo(), 'CLOSED');
  error(await reader.getFrame(0), 'CLOSED');
  for (const url of urls) await assert.rejects(fetch(url));
  try {
    value(await reader.open(fixture()));
    const reopened = value(await reader.getFrame(0));
    assert.ok(!urls.includes(reopened.image.url));
  } finally { await reader.close(); }
});

test('YAPAY TEST: başarısız yeniden open eski metadata ve kare URL kaynaklarını siler', async () => {
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    value(await reader.open(fixture()));
    const url = value(await reader.getFrame(0)).image.url;
    const input = fixture(); const files = new Map(input.files); files.delete(RGB[0]);
    error(await reader.open({ ...input, files }), 'MISSING_FILE');
    error(reader.getMetadata(), 'NOT_OPEN'); error(reader.getSourceInfo(), 'NOT_OPEN');
    assert.equal(reader.getState().status, 'error');
    await assert.rejects(fetch(url));
    value(await reader.open(fixture()));
    assert.equal(value(reader.getMetadata()).frameCount, 3);
  } finally { await reader.close(); }
});

test('YAPAY TEST: açılış sürerken close eski işlemin ready durumunu geri getirmesini engeller', { timeout: 5000 }, async () => {
  const gate = deferred(); const entered = deferred(); const input = fixture();
  const text = input.files.get(`${ROOT}/rgb.txt`)!;
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  const opening = reader.open(withFile(input, `${ROOT}/rgb.txt`, new DelayedTextBlob([text], gate, entered)));
  try {
    await entered.promise;
    assert.equal(reader.getState().status, 'opening');
    error(await reader.getFrame(0), 'NOT_OPEN');
    await reader.close();
    error(await beforeDeadline(opening), 'CLOSED');
    assert.equal(gate.resolved, false);
    assert.equal(reader.getState().status, 'closed');
    error(reader.getMetadata(), 'CLOSED');
  } finally { gate.resolve(); await reader.close(); }
});

test('YAPAY TEST: yeni open eski bekleyen açılıştan sonra da seçili kayıt olarak kalır', { timeout: 5000 }, async () => {
  const gate = deferred(); const entered = deferred(); const input = fixture();
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  const old = reader.open(withFile(input, `${ROOT}/rgb.txt`, new DelayedTextBlob([input.files.get(`${ROOT}/rgb.txt`)!], gate, entered)));
  try {
    await entered.promise;
    const next = fixture(); next.manifest.recording.id = 'YAPAY-TEST-new-session';
    value(await reader.open(next));
    error(await beforeDeadline(old), 'CLOSED');
    assert.equal(gate.resolved, false);
    assert.equal(reader.getState().status, 'ready');
    assert.equal(value(reader.getMetadata()).recording.id, 'YAPAY-TEST-new-session');
  } finally { gate.resolve(); await reader.close(); }
});

for (const action of ['close', 'reopen'] as const) {
  test(`YAPAY TEST: bekleyen getFrame ${action} sonrasında eski oturumu etkinleştiremez`, { timeout: 5000 }, async () => {
    const gate = deferred(); const entered = deferred();
    const input = withFile(fixture(), RGB[0], new DelayedSliceBlob([rgbBytes], gate, entered));
    const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
    try {
      value(await reader.open(input));
      const pending = reader.getFrame(0);
      await entered.promise;
      if (action === 'close') await reader.close();
      else {
        const next = fixture(); next.manifest.recording.id = 'YAPAY-TEST-frame-new-session';
        value(await reader.open(next));
      }
      error(await beforeDeadline(pending), 'CLOSED');
      assert.equal(gate.resolved, false);
      assert.equal(reader.getState().status, action === 'close' ? 'closed' : 'ready');
      if (action === 'reopen') {
        assert.equal(value(reader.getMetadata()).recording.id, 'YAPAY-TEST-frame-new-session');
        value(await reader.getFrame(0));
      }
    } finally { gate.resolve(); await reader.close(); }
  });
}

test('YAPAY TEST: iki etkin ve üç kuyruktaki kare isteği Blob beklemeden CLOSED olur', { timeout: 5000 }, async () => {
  const gate = deferred(); const bothStarted = deferred(); const started: number[] = [];
  let input = fixture();
  for (let index = 0; index < 5; index++) {
    input = withFile(input, `${ROOT}/rgb/${index}.png`, new DelayedSliceBlob(
      [rgbBytes], gate, deferred(), () => {
        if (!started.includes(index)) started.push(index);
        if (started.length === 2) bothStarted.resolve();
      },
    ));
  }
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'full-recording' });
  try {
    assert.equal(value(await reader.open(input)).frameCount, 5);
    const pending = Array.from({ length: 5 }, (_, index) => reader.getFrame(index));
    await beforeDeadline(bothStarted.promise);
    assert.deepEqual(started, [0, 1]);
    await reader.close();
    const results = await beforeDeadline(Promise.all(pending));
    for (const result of results) error(result, 'CLOSED');
    assert.equal(gate.resolved, false);
    assert.deepEqual(started, [0, 1]);
    assert.equal(reader.getState().status, 'closed');
  } finally { gate.resolve(); await reader.close(); }
  assert.deepEqual(started, [0, 1], 'Kuyruktaki üç PNG okuması kapandıktan sonra başlatılmamalı.');
});
