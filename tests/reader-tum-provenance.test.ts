import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TumRecordingReader } from '../src/data';
import type { DatasetManifest, ReaderResult, RecordingInput } from '../src/shared/types';

function value<T>(result: ReaderResult<T>): T {
  assert.ok(result.ok, result.ok ? undefined : result.error.message);
  return result.value;
}

test('GERÇEK VERİ: TXT/PNG özgün bilgileri, seçili API indeksi ve türetilmiş özetler ayrıdır', async t => {
  const manifest = JSON.parse(await readFile(new URL('../data/manifests/tum-rgbd-freiburg1-desk.json', import.meta.url), 'utf8')) as DatasetManifest;
  const files = new Map<string, Blob>();
  for (const file of manifest.acquisition.files) {
    try {
      files.set(file, new Blob([new Uint8Array(await readFile(new URL(`../data/local/tum-rgbd-freiburg1-desk/${file}`, import.meta.url)))]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      t.skip(`Özgün dosya yok: ${file}; gerçek metadata doğrulanmadı.`); return;
    }
  }
  const input: RecordingInput = { manifest, files };
  const before = structuredClone(manifest);
  for (const stream of ['rgb', 'depth'] as const) {
    const reader = new TumRecordingReader({ stream, mode: 'manifest-subset' });
    try {
      value(await reader.open(input));
      const table = value(reader.getTableMetadata());
      assert.equal(table.original.kind, stream);
      assert.equal(table.original.rows.length, stream === 'rgb' ? 613 : 595);
      assert.equal(table.derived.observedCount.value, table.original.rows.length);
      assert.equal(table.derived.scope.selection, 'all-source-data-rows-in-original-order');
      assert.equal(table.derived.firstToLastDuration.exactDecimal, stream === 'rgb' ? '20.404349' : '19.816716');
      assert.equal(table.derived.firstToLastDuration.unit, 'source-timestamp-unit-unknown');
      const frame = value(reader.getFrameMetadata(1));
      assert.equal(frame.original.sourceIndex, stream === 'rgb' ? 306 : 297);
      assert.equal(frame.original.lineNumber, stream === 'rgb' ? 310 : 301);
      assert.equal(frame.derived.apiIndex.value, 1);
      assert.equal(frame.derived.apiIndex.scope.kind, 'selected-stream');
      assert.equal(frame.original.timestampRaw, stream === 'rgb' ? '1305031462.995550' : '1305031463.278737');
      assert.equal(frame.original.png.status, 'not-read');
      assert.match(frame.original.clockOrigin, /doğrulanmadı/);
      assert.equal(value(await reader.getFrame(1)).time.kind, 'unknown');
      const inspected = value(reader.getFrameMetadata(1));
      assert.ok(inspected.original.png.status === 'verified');
      assert.equal(inspected.original.png.value.width, 640);
      assert.equal(inspected.original.png.value.height, 480);
      assert.equal(inspected.original.png.value.bitDepth, stream === 'rgb' ? 8 : 16);
      assert.equal(inspected.original.png.value.colorType, stream === 'rgb' ? 2 : 0);
      assert.equal(value(reader.getFrameMetadata(0)).original.png.status, 'not-read');
      inspected.original.png.value.width = 1;
      const stable = value(reader.getFrameMetadata(1));
      assert.ok(stable.original.png.status === 'verified'); assert.equal(stable.original.png.value.width, 640);
      assert.equal(stable.original.documentedDepthConversion?.appliedToPreview ?? false, false);
      if (stream === 'depth') assert.equal(stable.original.documentedDepthConversion?.invalidRawValue, 0);
      const bad = reader.getFrameMetadata(Object.create(null) as number);
      assert.ok(!bad.ok); assert.equal(bad.error.code, 'INVALID_INDEX');
      table.original.rows[0].timestampRaw = 'changed by consumer';
      assert.notEqual(value(reader.getTableMetadata()).original.rows[0].timestampRaw, 'changed by consumer');
      await reader.close();
      const closed = reader.getFrameMetadata(1); assert.ok(!closed.ok); assert.equal(closed.error.code, 'CLOSED');
      value(await reader.open(input));
      assert.equal(value(reader.getFrameMetadata(1)).original.png.status, 'not-read');
    } finally { await reader.close(); }
  }
  assert.deepEqual(manifest, before);
  assert.equal(manifest.timing.kind, 'unknown');
});
