import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TumRecordingReader, type DatasetManifest, type TumStream } from '../src/data';
import type { FrameRecord, ReaderError, ReaderResult, RecordingBinding, RecordingInput, RecordingMetadata, RecordingReader } from '../src/shared/types';
import { createTumRecordingBinding } from '../src/app/recordingBinding';
import { ReaderSession } from '../src/playback/readerSession';
import { exampleBinding, exampleInput } from '../src/demo/recording/example';
import { analyzeMetadata } from '../src/quality';
import { FrameViewer } from '../src/ui/recording/FrameViewer';
import { ActiveRecordingControls } from '../src/ui/recording/ActiveRecordingControls';
import { RecordingSelection } from '../src/ui/recording/RecordingContext';
import { ReaderErrorNotice } from '../src/ui/recording/Panel';
import { MetadataPanel } from '../src/ui/recording/MetadataPanel';

// ARTIFICIAL PNG/TXT fixtures only. No original TUM pixels or sensor measurements.
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, payload: Buffer) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(payload.length); crc.writeUInt32BE(crc32(Buffer.concat([name, payload])));
  return Buffer.concat([size, name, payload, crc]);
}
function artificialPng(stream: TumStream) {
  const header = Buffer.alloc(13); header.writeUInt32BE(640); header.writeUInt32BE(480, 4);
  header[8] = stream === 'rgb' ? 8 : 16; header[9] = stream === 'rgb' ? 2 : 0;
  const rows = Buffer.alloc(480 * (1 + 640 * (stream === 'rgb' ? 3 : 2)));
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
}
function fixture(): RecordingInput {
  const root = 'artificial-integration';
  const selected = [0, 2, 4];
  const manifest: DatasetManifest = {
    contractVersion: 1,
    recording: { id: 'ARTIFICIAL-INTEGRATION', name: 'YAPAY TEST — gerçek TUM değildir', provenance: 'real', source: { title: 'YAPAY TEST: Node ile üretilen PNG/TXT', url: null }, license: { status: 'unknown' } },
    format: { status: 'known', value: 'TUM PNG/TXT test encoding', evidence: 'ARTIFICIAL TEST ONLY' },
    acquisition: { instructions: 'YAPAY TEST: dosyalar test içinde üretilir.', files: [`${root}/rgb.txt`, `${root}/depth.txt`, `${root}/groundtruth.txt`, `${root}/accelerometer.txt`, ...(['rgb', 'depth'] as const).flatMap(stream => selected.map(i => `${root}/${stream}/${i}.png`))] },
    timing: { kind: 'unknown', timeBase: null, description: 'YAPAY TEST: ortak saat yok', nominalFps: { status: 'unknown' } },
    radiometry: { status: 'unavailable', unit: null, evidence: 'YAPAY TEST: sıcaklık yok' }, citation: null, versionOrAccessDate: null,
  };
  const files = new Map<string, Blob>([ [`${root}/groundtruth.txt`, new Blob(['10 0 0 0 0 0 0 1\n'])], [`${root}/accelerometer.txt`, new Blob(['10.5 0 0 1\n'])] ]);
  for (const stream of ['rgb', 'depth'] as const) {
    files.set(`${root}/${stream}.txt`, new Blob([`# ARTIFICIAL SOURCE\n${Array.from({ length: 5 }, (_, i) => `${10 + i}.${stream === 'rgb' ? '000001' : '500001'} ${stream}/${i}.png`).join('\n')}\n`]));
    for (const i of selected) files.set(`${root}/${stream}/${i}.png`, new Blob([artificialPng(stream)], { type: 'image/png' }));
  }
  return { manifest, files };
}
function unwrap<T>(result: ReaderResult<T> | null): T {
  assert.ok(result); assert.ok(result.ok, result.ok ? undefined : result.error.message); return result.value;
}

for (const stream of ['rgb', 'depth'] as const) {
  test(`ARTIFICIAL integration: ${stream} binding uses Efe, first/middle/last preview reaches FrameViewer with separate source indices`, async () => {
    const input = fixture(); const binding = createTumRecordingBinding(input, stream);
    assert.equal(binding.input, input);
    const direct = binding.createReader(); assert.ok(direct instanceof TumRecordingReader); await direct.close();
    const session = new ReaderSession(binding);
    try {
      const metadata = unwrap(await session.open()); assert.equal(metadata.frameCount, 3);
      const sourceInfo = unwrap(session.getSourceInfo());
      const tableMetadata = unwrap(session.getTableMetadata());
      assert.equal(metadata.reader.id, `tum-rgbd-${stream}`); assert.equal(metadata.timing.kind, 'unknown');
      for (let i = 0; i < 3; i++) {
        const presented = unwrap(await session.getFrame(i));
        assert.equal(presented.frame.index, i); assert.equal(presented.frameMetadata?.original.sourceIndex, [0, 2, 4][i]);
        assert.equal(presented.frameMetadata?.original.stream, stream);
        assert.deepEqual(presented.frame.time, { kind: 'unknown' }); assert.equal(presented.frame.temperature, undefined);
        const path = presented.frameMetadata!.original.sourceFile;
        const bytes = await (await fetch(presented.frame.image.url)).arrayBuffer();
        assert.deepEqual(new Uint8Array(bytes), new Uint8Array(await input.files.get(path)!.arrayBuffer()));
        const html = renderToStaticMarkup(createElement(FrameViewer, { recording: metadata.recording, metadata,
          frame: presented.frame, frameMetadata: presented.frameMetadata, activeStream: stream, opened: true, loading: false, error: null }));
        assert.ok(html.includes(presented.frame.image.url)); assert.ok(html.includes(path));
        assert.match(html, /width="640" height="480"/); assert.ok(html.includes(`API ${i}`));
        assert.match(html, /Özgün kaynak kare indeksi/); assert.match(html, /Birim: bilinmiyor/);
        assert.ok(html.includes(`${stream.toUpperCase()} · GÖRSEL ÖNİZLEME`));
        if (stream === 'depth') { assert.match(html, /16-bit/); assert.match(html, /ham değerler dönüştürülmedi/); }
        const details = renderToStaticMarkup(createElement(MetadataPanel, { metadata, ...presented, index: i,
          opened: true, activeStream: stream, sourceInfo, tableMetadata, manifest: input.manifest }));
        assert.ok(details.includes(path)); assert.ok(details.includes(presented.frameMetadata!.original.timestampRaw));
        assert.ok(details.includes(tableMetadata.original.rows[[0, 2, 4][i]].originalLine));
        assert.match(details, /Özgün Metadata/); assert.match(details, /Türetilmiş Metadata/);
        assert.match(details, /Manifest alt kümesi/); assert.match(details, /Kaynak zaman birimi bilinmiyor/);
        assert.ok(details.includes(`Özgün kaynak kare indeksi</dt><dd>${[0, 2, 4][i]}`));
        if (stream === 'depth') { assert.match(details, /encoded-uint16/); assert.match(details, /Ham kod \/ 5000/); }
        else assert.doesNotMatch(details, /Ham kod \/ 5000/);
      }
    } finally { assert.equal(await session.close(), null); }
  });
}

test('ARTIFICIAL integration: RGB → depth → RGB → synthetic → depth closes reader-owned URLs and keeps independent streams', async () => {
  const input = fixture(); let oldUrl = ''; let priorTimestamp = '';
  for (const choice of ['rgb', 'depth', 'rgb', 'synthetic', 'depth'] as const) {
    const binding = choice === 'synthetic' ? exampleBinding : createTumRecordingBinding(input, choice);
    const session = new ReaderSession(binding);
    try {
      const metadata = unwrap(await session.open()); const shown = unwrap(await session.getFrame(0));
      if (choice === 'synthetic') {
        assert.equal(metadata.recording.provenance, 'synthetic'); assert.equal(shown.frameMetadata, null);
        assert.ok(shown.frame.image.url.endsWith('frame-0.svg'));
      } else {
        assert.equal(metadata.recording.provenance, 'real'); assert.equal(shown.frameMetadata?.original.stream, choice);
        if (choice === 'depth') assert.notEqual(shown.frameMetadata?.original.timestampRaw, priorTimestamp);
        priorTimestamp = shown.frameMetadata!.original.timestampRaw; oldUrl = shown.frame.image.url;
      }
    } finally { await session.close(); }
    if (oldUrl) await assert.rejects(fetch(oldUrl), 'Old real preview URL must be revoked by Efe close');
  }
});

test('ARTIFICIAL integration: missing PNG fails open, corrupt PNG fails frame read with original file/recovery and no fallback', async () => {
  for (const kind of ['missing', 'corrupt'] as const) {
    const input = fixture(); const files = new Map(input.files); const path = 'artificial-integration/rgb/0.png';
    if (kind === 'missing') files.delete(path); else files.set(path, new Blob(['NOT A PNG']));
    const session = new ReaderSession(createTumRecordingBinding({ ...input, files }, 'rgb'));
    try {
      const opened = await session.open();
      const result = kind === 'missing' ? opened : (unwrap(opened), await session.getFrame(0));
      assert.ok(result && !result.ok); assert.equal(result.error.file, path);
      assert.equal(result.error.code, kind === 'missing' ? 'MISSING_FILE' : 'DECODE_FAILED'); assert.ok(result.error.recovery);
      const html = renderToStaticMarkup(createElement(ReaderErrorNotice, { error: result.error }));
      assert.ok(html.includes(path)); assert.match(html, /role="alert"/);
    } finally { await session.close(); }
  }
});

const mockMetadata: RecordingMetadata = {
  recording: exampleInput.manifest.recording, frameCount: 3, format: 'ARTIFICIAL MOCK',
  timing: exampleInput.manifest.timing, radiometry: exampleInput.manifest.radiometry, reader: { id: 'ARTIFICIAL-MOCK', version: 'test' },
};
const mockFrame = (index = 0): FrameRecord => ({ index, image: { url: `blob:ARTIFICIAL-MOCK-${index}`, width: 640, height: 480, alt: 'ARTIFICIAL MOCK' }, time: { kind: 'unknown' } });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function mockReader(overrides: Partial<RecordingReader> = {}) {
  let closes = 0;
  const reader: RecordingReader = {
    getState: () => ({ status: 'ready' }), getMetadata: () => ({ ok: true, value: mockMetadata }),
    open: async () => ({ ok: true, value: mockMetadata }), getFrame: async index => ({ ok: true, value: mockFrame(index) }),
    close: async () => { closes++; }, ...overrides,
  };
  return { reader, get closes() { return closes; } };
}
const mockBinding = (reader: RecordingReader): RecordingBinding => ({ input: exampleInput, createReader: () => reader, analyze: analyzeMetadata });

test('MOCK integration: close while opening suppresses late success and is idempotent', async () => {
  const open = deferred<ReaderResult<RecordingMetadata>>(); const mock = mockReader({ open: () => open.promise });
  const session = new ReaderSession(mockBinding(mock.reader)); const pending = session.open();
  await session.close(); await session.close(); assert.equal(mock.closes, 1);
  open.resolve({ ok: true, value: mockMetadata }); assert.equal(await pending, null);
  assert.equal(await session.getFrame(0), null); assert.equal(await session.open(), null);
});

test('ARTIFICIAL integration: a failed open can be retried in a fresh session without poisoning the binding or later frames', async () => {
  const input = fixture(); const files = new Map(input.files); files.delete('artificial-integration/rgb/0.png');
  const bad = new ReaderSession(createTumRecordingBinding({ ...input, files }, 'rgb'));
  const error = await bad.open(); assert.ok(error && !error.ok); await bad.close();
  const good = new ReaderSession(createTumRecordingBinding(input, 'rgb'));
  try { unwrap(await good.open()); assert.equal(unwrap(await good.getFrame(2)).frame.index, 2); }
  finally { await good.close(); }
});

test('MOCK integration: old getFrame success or rejection after switch/unmount cannot overwrite the next session', async () => {
  for (const reject of [false, true]) {
    const frame = deferred<ReaderResult<FrameRecord>>(); const mock = mockReader({ getFrame: () => frame.promise });
    const old = new ReaderSession(mockBinding(mock.reader)); unwrap(await old.open()); const pending = old.getFrame(0);
    await old.close();
    const next = new ReaderSession(mockBinding(mockReader().reader)); unwrap(await next.open());
    assert.equal(unwrap(await next.getFrame(1)).frame.index, 1);
    if (reject) frame.reject(new Error('OLD MOCK FAILURE')); else frame.resolve({ ok: true, value: mockFrame(0) });
    assert.equal(await pending, null); assert.equal(mock.closes, 1); await next.close();
  }
});

test('MOCK integration: overlapping frame requests and effect cleanup accept only the latest request', async () => {
  const first = deferred<ReaderResult<FrameRecord>>();
  const mock = mockReader({ getFrame: index => index === 0 ? first.promise : Promise.resolve({ ok: true, value: mockFrame(index) }) });
  const session = new ReaderSession(mockBinding(mock.reader)); unwrap(await session.open());
  const stale = session.getFrame(0); session.cancelFrame();
  assert.equal(unwrap(await session.getFrame(2)).frame.index, 2);
  first.resolve({ ok: true, value: mockFrame(0) }); assert.equal(await stale, null); await session.close();
});

test('MOCK integration: thrown factory/open/frame failures become ReaderResult, while close rejection is handled', async () => {
  const factory = new ReaderSession({ ...exampleBinding, createReader: () => { throw new Error('FACTORY'); } });
  const failedFactory = await factory.open(); assert.ok(failedFactory && !failedFactory.ok); await factory.close();
  const openFailure = new ReaderSession(mockBinding(mockReader({ open: async () => { throw new Error('OPEN'); } }).reader));
  const failedOpen = await openFailure.open(); assert.ok(failedOpen && !failedOpen.ok); await openFailure.close();
  const frameFailure = new ReaderSession(mockBinding(mockReader({ getFrame: async () => { throw new Error('FRAME'); }, close: async () => { throw new Error('CLOSE'); } }).reader));
  unwrap(await frameFailure.open()); const result = await frameFailure.getFrame(0); assert.ok(result && !result.ok);
  assert.equal(result.error.code, 'DECODE_FAILED'); assert.equal((await frameFailure.close())?.code, 'DECODE_FAILED');
});

test('MOCK integration: explicit reader errors keep their original code/file/recovery', async () => {
  const error: ReaderError = { code: 'UNSUPPORTED_FORMAT', message: 'MOCK unsupported', recovery: 'MOCK recovery', file: 'MOCK/depth.png' };
  const failed = new ReaderSession(mockBinding(mockReader({ open: async () => ({ ok: false, error }) }).reader));
  assert.deepEqual(await failed.open(), { ok: false, error }); await failed.close();
  const session = new ReaderSession(mockBinding(mockReader({ getFrame: async () => ({ ok: false, error }) }).reader));
  unwrap(await session.open()); assert.deepEqual(await session.getFrame(0), { ok: false, error }); await session.close();
});

test('ARTIFICIAL integration: StrictMode-style setup/cleanup/setup and reopen create fresh readers, release old URLs', async () => {
  const input = fixture(); const binding = createTumRecordingBinding(input, 'rgb');
  const abandoned = new ReaderSession(binding); const opening = abandoned.open(); await abandoned.close(); assert.equal(await opening, null);
  let previous = '';
  for (let i = 0; i < 2; i++) {
    const session = new ReaderSession(binding); unwrap(await session.open()); const frame = unwrap(await session.getFrame(0));
    assert.notEqual(frame.frame.image.url, previous); previous = frame.frame.image.url;
    await session.close(); await assert.rejects(fetch(previous));
  }
});

test('UI: real open/stream require a prepared input and explicit callback; demo switch remains a separate action', () => {
  const noop = () => {}; const input = fixture();
  const closed = renderToStaticMarkup(createElement(ActiveRecordingControls, { opened: false, onOpenReal: noop, onStreamChange: noop }));
  assert.match(closed, /<select[^>]*disabled=""/); assert.match(closed, /<button[^>]*disabled=""/);
  const ready = renderToStaticMarkup(createElement(ActiveRecordingControls, { preparedInput: input, opened: false, selectedStream: 'depth', onOpenReal: noop, onStreamChange: noop }));
  assert.doesNotMatch(ready, /disabled=/); assert.match(ready, /value="depth" selected=""/);
  const panel = renderToStaticMarkup(createElement(RecordingSelection, { recording: input.manifest.recording, demoRecording: exampleInput.manifest.recording,
    preparedInput: input, opened: true, activeStream: 'rgb', onOpen: noop, onClose: noop, onOpenReal: noop, onStreamChange: noop }));
  assert.match(panel, /Gerçek kaydı yeniden aç/); assert.match(panel, /Sentetik örneği aç/); assert.doesNotMatch(panel, /Sentetik örneği yeniden aç/);
});

test('UI: unselected/prepared/closed/opening/frame loading states are distinct and never show old images', () => {
  for (const [closedReason, expected] of [['unselected', 'Kayıt seçilmedi'], ['ready', 'Dosyalar hazır; kayıt açılmadı'], ['closed', 'Kayıt kapatıldı']] as const) {
    const html = renderToStaticMarkup(createElement(FrameViewer, { recording: mockMetadata.recording, opened: false, loading: false, error: null, frame: mockFrame(), closedReason }));
    assert.ok(html.includes(expected)); assert.doesNotMatch(html, /<img|blob:ARTIFICIAL/);
  }
  for (const metadata of [null, mockMetadata]) {
    const html = renderToStaticMarkup(createElement(FrameViewer, { recording: mockMetadata.recording, opened: true, loading: true, error: null, frame: mockFrame(), metadata }));
    assert.ok(html.includes(metadata ? 'Kare yükleniyor' : 'Reader açılıyor')); assert.doesNotMatch(html, /<img|blob:ARTIFICIAL/);
  }
});

test('REAL TUM integration: first/middle/last RGB and depth frames traverse the production binding/session when files exist', async context => {
  const manifest = JSON.parse(await readFile(new URL('../data/manifests/tum-rgbd-freiburg1-desk.json', import.meta.url), 'utf8')) as DatasetManifest;
  const files = new Map<string, Blob>();
  for (const path of manifest.acquisition.files) {
    try { const bytes = await readFile(new URL(`../data/local/tum-rgbd-freiburg1-desk/${path}`, import.meta.url)); files.set(path, new Blob([new Uint8Array(bytes)])); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; context.skip(`Original TUM file absent: ${path}; real integration not completed.`); return; }
  }
  for (const stream of ['rgb', 'depth'] as const) {
    const session = new ReaderSession(createTumRecordingBinding({ manifest, files }, stream));
    try {
      const metadata = unwrap(await session.open()); assert.equal(metadata.frameCount, 3);
      const sourceInfo = unwrap(session.getSourceInfo()); const tableMetadata = unwrap(session.getTableMetadata());
      for (const i of [0, 1, 2]) {
        const result = unwrap(await session.getFrame(i)); assert.equal(result.frame.index, i);
        assert.equal(result.frameMetadata?.original.sourceIndex, (stream === 'rgb' ? [0, 306, 612] : [0, 297, 594])[i]);
        const html = renderToStaticMarkup(createElement(FrameViewer, { recording: manifest.recording, opened: true, loading: false, error: null, ...result, activeStream: stream }));
        assert.ok(html.includes(result.frame.image.url));
        const panel = renderToStaticMarkup(createElement(MetadataPanel, { metadata, ...result, index: i,
          opened: true, activeStream: stream, sourceInfo, tableMetadata, manifest }));
        assert.ok(panel.includes(result.frameMetadata!.original.timestampRaw));
        assert.ok(panel.includes(result.frameMetadata!.original.sourceFile));
        assert.ok(panel.includes(`Özgün kaynak kare indeksi</dt><dd>${result.frameMetadata!.original.sourceIndex}`));
      }
    } finally { await session.close(); }
  }
});
