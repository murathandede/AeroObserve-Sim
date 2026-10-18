import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TumRecordingReader } from '../src/data';
import type { DatasetManifest, RecordingInput, ReaderResult } from '../src/shared/types';

function value<T>(result: ReaderResult<T>): T {
  assert.ok(result.ok, result.ok ? undefined : `${result.error.code}: ${result.error.message}`);
  return result.value;
}

test('GERÇEK VERİ: yerel özgün TUM örneği RGB 3 + depth 3 kare olarak açılır', async t => {
  const manifest = JSON.parse(await readFile(new URL('../data/manifests/tum-rgbd-freiburg1-desk.json', import.meta.url), 'utf8')) as DatasetManifest;
  const files = new Map<string, Blob>();
  for (const file of manifest.acquisition.files) {
    try {
      // Filesystem use belongs only to this Node fixture loader. The reader
      // itself receives exactly the browser-compatible relative path → Blob map.
      const bytes = await readFile(new URL(`../data/local/tum-rgbd-freiburg1-desk/${file}`, import.meta.url));
      files.set(file, new Blob([new Uint8Array(bytes)], { type: file.endsWith('.png') ? 'image/png' : 'text/plain' }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      t.skip(`Gerçek dosya yok: ${file}. docs/datasets.md edinme adımları uygulanmalı; gerçek veri testi tamamlanmadı.`);
      return;
    }
  }
  assert.equal(files.size, 10);
  const input: RecordingInput = { manifest, files };
  let verifiedFrames = 0;
  for (const stream of ['rgb', 'depth'] as const) {
    const reader = new TumRecordingReader({ stream, mode: 'manifest-subset' });
    try {
      const metadata = value(await reader.open(input));
      assert.equal(metadata.recording.provenance, 'real');
      assert.equal(metadata.recording.id, 'tum-rgbd-freiburg1-desk');
      assert.equal(metadata.frameCount, 3); assert.equal(metadata.timing.kind, 'unknown');
      const source = value(reader.getSourceInfo());
      assert.equal(source.stream, stream); assert.equal(source.mode, 'manifest-subset');
      assert.equal(source.sourceRowCount, stream === 'rgb' ? 613 : 595);
      assert.equal(source.unselectedSourceRows, stream === 'rgb' ? 610 : 592);
      assert.deepEqual(source.frames.map(frame => frame.sourceIndex), stream === 'rgb' ? [0, 306, 612] : [0, 297, 594]);
      assert.deepEqual(source.frames.map(frame => frame.apiIndex), [0, 1, 2]);
      for (let index = 0; index < 3; index++) {
        const frame = value(await reader.getFrame(index));
        assert.equal(frame.index, index); assert.equal(frame.image.width, 640); assert.equal(frame.image.height, 480);
        assert.deepEqual(frame.time, { kind: 'unknown' }); assert.equal(frame.temperature, undefined);
        const supplied = files.get(source.frames[index].file); assert.ok(supplied);
        const actualBytes = await (await fetch(frame.image.url)).arrayBuffer();
        assert.deepEqual(new Uint8Array(actualBytes), new Uint8Array(await supplied.arrayBuffer()));
        assert.equal(source.frames[index].timestampRaw, source.frames[index].file.split('/').at(-1)!.slice(0, -4));
        verifiedFrames++;
      }
    } finally { await reader.close(); }
  }
  assert.equal(verifiedFrames, 6);
  t.diagnostic('Gerçek özgün dosyalarda doğrulanan: RGB 3/3, depth 3/3; listelerdeki seçilmemiş kayıtlar kayıp kare değildir.');
});
