import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';
import { TumRecordingReader } from '../src/data';
import type { DatasetManifest, ReaderError, ReaderResult, RecordingInput } from '../src/shared/types';

const ROOT = 'artificial-regression';
const tables = ['rgb', 'depth', 'groundtruth', 'accelerometer'] as const;
const emptyText = '# ARTIFICIAL EMPTY TABLE — not original TUM sensor data\n\n';

function value<T>(result: ReaderResult<T>): T {
  assert.ok(result.ok, result.ok ? undefined : `${result.error.code}: ${result.error.message}`);
  return result.value;
}
function expectError(result: ReaderResult<unknown>, code: ReaderError['code']): ReaderError {
  assert.equal(result.ok, false);
  if (result.ok) assert.fail('Expected a structured reader error.');
  assert.equal(result.error.code, code);
  assert.ok(result.error.message.length > 0);
  assert.ok(result.error.recovery.length > 0);
  return result.error;
}
function artificialInput(): { manifest: DatasetManifest; files: Map<string, Blob> } {
  return {
    manifest: {
      contractVersion: 1,
      recording: {
        id: 'ARTIFICIAL-regression-only', name: 'ARTIFICIAL TEST — empty/mutation regression',
        // The adapter requires this contract discriminator; every descriptive field labels the generated fixture.
        provenance: 'real', source: { title: 'ARTIFICIAL generated fixture, not original TUM data', url: null },
        license: { status: 'known', value: 'ARTIFICIAL test-only label', evidence: 'Generated locally in this test.' },
      },
      format: { status: 'known', value: 'TUM-shaped PNG/TXT artificial fixture', evidence: 'Generated test fixture.' },
      acquisition: { instructions: 'ARTIFICIAL: generated in the test; do not download.', files: tables.map(kind => `${ROOT}/${kind}.txt`) },
      timing: { kind: 'unknown', timeBase: null, description: 'ARTIFICIAL: no shared clock is established.', nominalFps: { status: 'unknown' } },
      radiometry: { status: 'unavailable', unit: null, evidence: 'ARTIFICIAL fixture has no temperature measurements.' },
      citation: null, versionOrAccessDate: null,
    },
    files: new Map(tables.map(kind => [`${ROOT}/${kind}.txt`, new Blob([emptyText])])),
  };
}

// Artificial all-zero RGB PNG, generated independently of ignored real-data files.
function artificialRgbPng(): Uint8Array<ArrayBuffer> {
  const chunk = (name: string, data: Buffer): Buffer => {
    const type = Buffer.from(name);
    let crc = 0xffffffff;
    for (const byte of Buffer.concat([type, data])) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    const header = Buffer.alloc(4); header.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([header, type, data, checksum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(640); ihdr.writeUInt32BE(480, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Uint8Array.from(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.alloc(480 * (640 * 3 + 1)))), chunk('IEND', Buffer.alloc(0)),
  ]));
}
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

test('ARTIFICIAL regression: empty full recordings stay ready with zero count and undefined time statistics across reopen', async () => {
  for (const stream of ['rgb', 'depth'] as const) {
    const reader = new TumRecordingReader({ stream, mode: 'full-recording' });
    try {
      for (let cycle = 0; cycle < 2; cycle++) {
        assert.equal(value(await reader.open(artificialInput())).frameCount, 0);
        assert.equal(reader.getState().status, 'ready');
        assert.equal(value(reader.getMetadata()).frameCount, 0);
        assert.deepEqual(value(reader.getSourceInfo()), {
          stream, mode: 'full-recording', listFile: `${ROOT}/${stream}.txt`, sourceRowCount: 0,
          frameCount: 0, unselectedSourceRows: 0, frames: [],
        });
        const table = value(reader.getTableMetadata());
        assert.deepEqual(table.original.rows, []);
        assert.equal(table.derived.observedCount.value, 0);
        assert.deepEqual(table.derived.observedCount.inputs, []);
        assert.deepEqual(table.derived.intervals, []);
        for (const statistic of [table.derived.firstToLastDuration, table.derived.minimumInterval, table.derived.maximumInterval, table.derived.meanInterval, table.derived.medianInterval]) {
          assert.equal(statistic.value, null);
          assert.equal(statistic.exactDecimal, null);
        }
        expectError(await reader.getFrame(0), 'INVALID_INDEX');
        expectError(reader.getFrameMetadata(0), 'INVALID_INDEX');
        assert.equal(reader.getState().status, 'ready');
        await reader.close(); await reader.close();
        assert.equal(reader.getState().status, 'closed');
        expectError(reader.getMetadata(), 'CLOSED');
        expectError(reader.getSourceInfo(), 'CLOSED');
        expectError(reader.getTableMetadata(), 'CLOSED');
      }
    } finally { await reader.close(); }
  }
});

test('ARTIFICIAL regression: invalid UTF-8 in either selected TXT returns DECODE_FAILED and allows recovery', async () => {
  for (const stream of ['rgb', 'depth'] as const) {
    const input = artificialInput();
    const file = `${ROOT}/${stream}.txt`;
    input.files.set(file, new Blob([Uint8Array.from([0xc3, 0x28])]));
    const reader = new TumRecordingReader({ stream, mode: 'full-recording' });
    try {
      assert.equal(expectError(await reader.open(input), 'DECODE_FAILED').file, file);
      assert.equal(reader.getState().status, 'error');
      expectError(reader.getMetadata(), 'NOT_OPEN');
      assert.equal(value(await reader.open(artificialInput())).frameCount, 0);
      assert.equal(reader.getState().status, 'ready');
    } finally { await reader.close(); }
  }
});

test('ARTIFICIAL regression: caller mutations during pending open cannot replace snapshotted manifest or Blob references', { timeout: 5000 }, async () => {
  const input = artificialInput();
  const gate = deferred(); const entered = deferred();
  const listFile = `${ROOT}/rgb.txt`;
  const pngFile = `${ROOT}/rgb/original.png`;
  const originalBytes = artificialRgbPng();
  class DeferredTextBlob extends Blob {
    reads = 0;
    override async arrayBuffer(): Promise<ArrayBuffer> {
      this.reads++; entered.release(); await gate.promise; return super.arrayBuffer();
    }
  }
  class OriginalPngBlob extends Blob {
    slices = 0;
    override slice(start?: number, end?: number, type?: string): Blob {
      this.slices++; return super.slice(start, end, type);
    }
  }
  const originalText = new DeferredTextBlob(['# ARTIFICIAL deferred source\n123.456789 rgb/original.png\n']);
  const originalPng = new OriginalPngBlob([originalBytes]);
  input.manifest.acquisition.files.push(pngFile);
  input.files.set(listFile, originalText); input.files.set(pngFile, originalPng);
  const originalManifest = structuredClone(input.manifest);
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  const opening = reader.open(input);
  try {
    await entered.promise;
    assert.equal(reader.getState().status, 'opening');
    input.manifest.recording.id = 'CALLER-MUTATION';
    input.manifest.recording.name = 'CALLER-MUTATION';
    input.manifest.recording.source.title = 'CALLER-MUTATION';
    input.manifest.recording.license = { status: 'unknown' };
    input.manifest.acquisition.files.splice(0, input.manifest.acquisition.files.length, 'caller/replaced.txt');
    input.manifest.format = { status: 'unknown' };
    input.files.clear();
    input.files.set(listFile, new Blob(['invalid replacement TXT']));
    input.files.set(pngFile, new Blob(['invalid replacement PNG']));
    gate.release();
    const metadata = value(await opening);
    assert.equal(metadata.recording.id, originalManifest.recording.id);
    assert.equal(metadata.recording.name, `${originalManifest.recording.name} · RGB · manifest-subset`);
    assert.deepEqual(metadata.recording.source, originalManifest.recording.source);
    assert.deepEqual(metadata.recording.license, originalManifest.recording.license);
    assert.equal(metadata.frameCount, 1);
    assert.equal(originalText.reads, 1);
    assert.equal(originalPng.slices, 0, 'open must keep image Blob references without reading or cloning their bytes.');
    const source = value(reader.getSourceInfo());
    assert.equal(source.listFile, listFile);
    assert.equal(source.frames[0].file, pngFile);
    assert.equal(source.frames[0].timestampRaw, '123.456789');
    const frame = value(await reader.getFrame(0));
    assert.ok(originalPng.slices > 0, 'getFrame must validate the originally supplied Blob reference.');
    assert.deepEqual(new Uint8Array(await (await fetch(frame.image.url)).arrayBuffer()), originalBytes);
  } finally {
    gate.release();
    await reader.close();
    await opening;
  }
});

for (const action of ['close', 'reopen'] as const) {
  test(`ARTIFICIAL regression: ${action} between completed PNG work and public frame delivery returns CLOSED`, async () => {
    const input = artificialInput();
    const pngFile = `${ROOT}/rgb/completion.png`;
    input.manifest.acquisition.files.push(pngFile);
    input.files.set(`${ROOT}/rgb.txt`, new Blob(['# ARTIFICIAL completion race\n1 rgb/completion.png\n']));
    input.files.set(pngFile, new Blob([artificialRgbPng()]));
    const next = { manifest: structuredClone(input.manifest), files: new Map(input.files) };
    next.manifest.recording.id = 'ARTIFICIAL-next-completion-session';
    const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
    const createUrl = URL.createObjectURL;
    const previousUrls: string[] = [];
    let changing: Promise<unknown> | undefined;
    try {
      value(await reader.open(input));
      // Schedule a real session change precisely after the native URL has been created,
      // before the decoder's resolved result reaches getFrame's caller.
      URL.createObjectURL = blob => {
        const url = createUrl(blob);
        previousUrls.push(url);
        queueMicrotask(() => { changing = action === 'close' ? reader.close() : reader.open(next); });
        return url;
      };
      expectError(await reader.getFrame(0), 'CLOSED');
      await changing;
      URL.createObjectURL = createUrl;
      assert.equal(previousUrls.length, 1);
      await assert.rejects(fetch(previousUrls[0]));
      assert.equal(reader.getState().status, action === 'close' ? 'closed' : 'ready');
      if (action === 'reopen') {
        assert.equal(value(reader.getMetadata()).recording.id, next.manifest.recording.id);
        const current = value(await reader.getFrame(0));
        assert.notEqual(current.image.url, previousUrls[0]);
        assert.ok((await fetch(current.image.url)).ok);
      } else expectError(reader.getMetadata(), 'CLOSED');
    } finally {
      URL.createObjectURL = createUrl;
      await changing;
      await reader.close();
    }
  });
}

test('REAL regression: concurrent independent RGB/depth readers and 30 rapid seeks isolate URLs and preserve separate clocks', async (context) => {
  const manifest = JSON.parse(await readFile(new URL('../data/manifests/tum-rgbd-freiburg1-desk.json', import.meta.url), 'utf8')) as DatasetManifest;
  const files = new Map<string, Blob>();
  for (const file of manifest.acquisition.files) {
    try {
      files.set(file, new Blob([Uint8Array.from(await readFile(new URL(`../data/local/tum-rgbd-freiburg1-desk/${file}`, import.meta.url)))]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      context.skip(`Real original sample file absent: ${file}. Install official sample using docs/datasets.md; real regression is not completed.`);
      return;
    }
  }
  assert.equal(files.size, 10);
  const input: RecordingInput = { manifest, files };
  const rgb = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  const depth = new TumRecordingReader({ stream: 'depth', mode: 'manifest-subset' });
  try {
    const opened = (await Promise.all([rgb.open(input), depth.open(input)])).map(value);
    assert.deepEqual(opened.map(metadata => metadata.frameCount), [3, 3]);
    const indices = Array.from({ length: 30 }, (_, index) => [0, 2, 1][index % 3]);
    const [results, depthResult] = await Promise.all([
      Promise.all(indices.map(index => rgb.getFrame(index))), depth.getFrame(1),
    ]);
    const frames = results.map(value); const depthMiddle = value(depthResult);
    assert.deepEqual(frames.map(frame => frame.index), indices);
    const rgbUrls = new Set(frames.map(frame => frame.image.url));
    assert.equal(rgbUrls.size, 3);
    for (let index = 0; index < frames.length; index++) {
      assert.equal(frames[index].image.url, value(await rgb.getFrame(indices[index])).image.url);
      assert.deepEqual(frames[index].time, { kind: 'unknown' });
    }
    assert.deepEqual(depthMiddle.time, { kind: 'unknown' });
    assert.ok(!rgbUrls.has(depthMiddle.image.url));
    const rgbSource = value(rgb.getSourceInfo()); const depthSource = value(depth.getSourceInfo());
    assert.equal(rgbSource.frames[1].sourceIndex, 306);
    assert.equal(depthSource.frames[1].sourceIndex, 297);
    assert.notEqual(rgbSource.frames[1].timestampRaw, depthSource.frames[1].timestampRaw);
    assert.equal(value(rgb.getTableMetadata()).original.kind, 'rgb');
    assert.equal(value(depth.getTableMetadata()).original.kind, 'depth');
    assert.equal(value(rgb.getMetadata()).timing.kind, 'unknown');
    assert.equal(value(depth.getMetadata()).timing.kind, 'unknown');
    await rgb.close(); await rgb.close();
    for (const url of rgbUrls) await assert.rejects(fetch(url));
    assert.equal(depth.getState().status, 'ready');
    assert.equal(value(await depth.getFrame(1)).image.url, depthMiddle.image.url);
    const stillAvailable = await (await fetch(depthMiddle.image.url)).arrayBuffer();
    assert.deepEqual(new Uint8Array(stillAvailable), new Uint8Array(await files.get(depthSource.frames[1].file)!.arrayBuffer()));
    assert.deepEqual(value(await depth.getFrame(1)).time, { kind: 'unknown' });
    await depth.close();
    await assert.rejects(fetch(depthMiddle.image.url));
    context.diagnostic('Real data: same 10 Blob inputs, independently opened RGB/depth; 30 RGB requests share exactly 3 URLs; closing RGB leaves depth ready and its URL readable.');
  } finally { await rgb.close(); await depth.close(); }
});
