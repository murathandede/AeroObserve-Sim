import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SyntheticRecordingReader } from '../src/demo/recording/reader';
import { exampleInput, exampleManifest } from '../src/demo/recording/example';
import { withFirstFrame } from '../src/data/readFirstFrame';
import { analyzeMetadata } from '../src/quality';
import type { RecordingReader } from '../src/shared/types';

test('Ortak okuyucu: aç, metadata, indeksli kare, kaynakları kapat, tekrar aç', async () => {
  const reader: RecordingReader = new SyntheticRecordingReader(); // Compile-time contract check.
  assert.equal(reader.getState().status, 'idle');
  assert.equal((await reader.getFrame(0)).ok, false);
  const opened = await reader.open(exampleInput); assert.ok(opened.ok);
  assert.equal(reader.getState().status, 'ready');
  assert.equal(opened.value.frameCount, 3);
  for (let i = 0; i < 3; i++) {
    const result = await reader.getFrame(i); assert.ok(result.ok);
    assert.equal(result.value.index, i); assert.deepEqual(result.value.time, { kind: 'unknown' });
    assert.equal(result.value.temperature, undefined);
    const svg = await readFile(new URL(result.value.image.url), 'utf8');
    assert.match(svg, /GELİŞTİRME ÖRNEĞİ — SENTETİK/);
    assert.doesNotMatch(svg, /(?:href|src)="https?:/);
  }
  for (const index of [-1, .5, 3, NaN]) { const result = await reader.getFrame(index); assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, 'INVALID_INDEX'); }
  await reader.close(); await reader.close(); assert.equal(reader.getState().status, 'closed');
  assert.equal(reader.getMetadata().ok, false);
  assert.ok((await reader.open(exampleInput)).ok); await reader.close();
});
test('Gerçek veya desteklenmeyen kayıt sessizce örneğe dönüşmez', async () => {
  const reader = new SyntheticRecordingReader();
  await reader.open(exampleInput);
  const result = await reader.open({ ...exampleInput, manifest: { ...exampleManifest, recording: { ...exampleManifest.recording, provenance: 'real' } } });
  assert.equal(result.ok, false); assert.equal(reader.getMetadata().ok, false); assert.equal(reader.getState().status, 'error');
  if (!result.ok) { assert.equal(result.error.code, 'UNSUPPORTED_FORMAT'); assert.ok(result.error.recovery.length); }
  await reader.close();
});
test('Metadata değiştirilemez; bilinmeyen zaman/sıcaklık kalite raporunda korunur', async () => {
  const reader = new SyntheticRecordingReader(); const result = await reader.open(exampleInput); assert.ok(result.ok);
  const report = analyzeMetadata(result.value);
  assert.equal(report.scope, 'metadata-only');
  assert.deepEqual(report.issues.map(i => i.code), ['TIME_UNKNOWN', 'NO_TEMPERATURE']);
  result.value.frameCount = 999;
  const current = reader.getMetadata(); assert.ok(current.ok); assert.equal(current.value.frameCount, 3);
  await reader.close();
});
test('Teslim örneği tüketici hata verse de kaynakları kapatır', async () => {
  const reader = new SyntheticRecordingReader();
  await assert.rejects(withFirstFrame(reader, exampleInput, () => { throw new Error('Tüketici hatası'); }));
  assert.equal(reader.getState().status, 'closed');
  const result = await withFirstFrame(reader, exampleInput, (metadata, frame) => { assert.equal(metadata.frameCount, 3); assert.equal(frame.index, 0); });
  assert.ok(result.ok); assert.equal(reader.getState().status, 'closed');
});
