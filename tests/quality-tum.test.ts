import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';
import { analyzeTumRecording, type TumQualityAnalysis, type TumQualityOptions } from '../src/quality/tum';
import type { DatasetManifest, RecordingInput } from '../src/shared/types';
import type { TumTableKind } from '../src/data/tum/metadata';

// These generated control files exercise the real-input contract. They are artificial
// fixtures, not measurements or proof of real sensor performance. The final tests load
// the separately acquired, ignored, original TUM sample and skip honestly if absent.
function chunk(type: string, data = Buffer.alloc(0)): Buffer {
  const header = Buffer.alloc(8); header.writeUInt32BE(data.length); header.write(type, 4);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([Buffer.from(type), data])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  const footer = Buffer.alloc(4); footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, data, footer]);
}
function artificialPng(stream: 'rgb' | 'depth'): Blob {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(640); ihdr.writeUInt32BE(480, 4);
  ihdr[8] = stream === 'rgb' ? 8 : 16; ihdr[9] = stream === 'rgb' ? 2 : 0;
  const raw = Buffer.alloc((1 + 640 * (stream === 'rgb' ? 3 : 2)) * 480);
  return new Blob([Uint8Array.from(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)), chunk('IEND'),
  ]))]);
}
const pngs = { rgb: artificialPng('rgb'), depth: artificialPng('depth') };
const root = 'artificial-control/';
const tableTexts: Record<TumTableKind, string> = {
  rgb: '# Artificial RGB list\n1.000000 rgb/a.png\n2.000000 rgb/b.png\n',
  depth: '# Artificial depth list\n1.050000 depth/a.png\n2.050000 depth/b.png\n',
  groundtruth: '# Artificial poses\n1 0 0 0 0 0 0 1\n2 1 2 3 0 0 0 1\n',
  accelerometer: '# Artificial accelerometer values; unit is unknown\n1 1 2 3\n2 4 5 6\n',
};
function fixture(overrides: Partial<Record<TumTableKind, string>> = {}): RecordingInput {
  const files = new Map<string, Blob>();
  for (const kind of ['rgb', 'depth', 'groundtruth', 'accelerometer'] as const) files.set(`${root}${kind}.txt`, new Blob([overrides[kind] ?? tableTexts[kind]]));
  for (const stream of ['rgb', 'depth'] as const) for (const name of ['a', 'b']) files.set(`${root}${stream}/${name}.png`, pngs[stream]);
  const manifest: DatasetManifest = {
    contractVersion: 1,
    recording: { id: 'artificial-tum-quality-control', name: 'ARTIFICIAL TEST CONTROL — NOT SENSOR DATA', provenance: 'real',
      source: { title: 'Artificial files for contract tests only', url: null }, license: { status: 'known', value: 'Test fixture', evidence: 'tests/quality-tum.test.ts' } },
    format: { status: 'known', value: 'TUM PNG/TXT artificial contract control', evidence: 'tests/quality-tum.test.ts' },
    acquisition: { instructions: 'Artificial fixtures are generated only in test memory.', files: [...files.keys()] },
    timing: { kind: 'unknown', timeBase: null, description: 'Test values; no physical clock.', nominalFps: { status: 'unknown' } },
    radiometry: { status: 'unavailable', unit: null, evidence: 'Artificial RGB/depth encoding controls; not temperature.' },
    citation: null, versionOrAccessDate: 'artificial-test-v1',
  };
  return { manifest, files };
}
const defaults: TumQualityOptions = { mode: 'full-recording' };
const codes = (analysis: TumQualityAnalysis) => analysis.report.issues.map(issue => issue.code);
const errors = (analysis: TumQualityAnalysis) => analysis.report.issues.filter(issue => issue.severity === 'error');
const table = (analysis: TumQualityAnalysis, kind: TumTableKind) => {
  const found = analysis.coverage.sourceTables.find(item => item.kind === kind); assert.ok(found); return found;
};

test('Artificial quality control: four independent tables and explicit structural full coverage', async () => {
  const analysis = await analyzeTumRecording(fixture(), { ...defaults, inspectImages: true });
  assert.equal(analysis.report.scope, 'full-recording'); assert.deepEqual(errors(analysis), []);
  assert.deepEqual(analysis.coverage.sourceTables.map(item => [item.kind, item.rowCount, item.valid]), [
    ['rgb', 2, true], ['depth', 2, true], ['groundtruth', 2, true], ['accelerometer', 2, true],
  ]);
  assert.deepEqual(analysis.coverage.images, { sourceReferences: 4, expectedFiles: 4, presentFiles: 4, inspectedFiles: 4,
    validatedFiles: 4, missingFiles: 0, missingFilePaths: [], notSelectedSourceReferences: { rgb: 0, depth: 0 } });
  assert.equal(analysis.coverage.completed, true); assert.equal(analysis.coverage.cancelled, false);
  assert.equal(table(analysis, 'groundtruth').metadata!.original.timestamp.unit, 'seconds');
  assert.equal(table(analysis, 'accelerometer').metadata!.original.columns[1].unit, 'unknown');
  assert.match(analysis.report.unsupported.join(' '), /piksel kalitesi/);
  const parsed = JSON.parse(JSON.stringify(analysis)) as TumQualityAnalysis;
  assert.deepEqual(parsed, analysis, 'All public quality output is serializable without Blob, Map, signal or BigInt.');
});

test('Artificial quality control: metadata-only does not read PNG bytes or infer FPS/clock units', async () => {
  let reads = 0;
  class CountingBlob extends Blob { override slice(start?: number, end?: number, type?: string): Blob { reads++; return super.slice(start, end, type); } }
  const input = fixture();
  (input.files as Map<string, Blob>).set(`${root}rgb/a.png`, new CountingBlob([await pngs.rgb.arrayBuffer()]));
  input.manifest.timing.nominalFps = { status: 'known', value: 30, evidence: 'Global artificial manifest value, not per-stream sampling evidence' };
  const analysis = await analyzeTumRecording(input, defaults);
  assert.equal(reads, 0); assert.equal(analysis.coverage.images.inspectedFiles, 0); assert.equal(analysis.report.scope, 'metadata-only');
  assert.deepEqual(errors(analysis), []);
  assert.equal(table(analysis, 'rgb').metadata!.derived.meanInterval.unit, 'source-timestamp-unit-unknown');
  assert.match(analysis.report.unsupported.join(' '), /ortak manifest FPS/);
  assert.ok(!codes(analysis).some(code => /LOST|DROPPED|GAP/u.test(code)));
});

test('Artificial quality control: subset scope remains metadata-only even when every selected image validates', async () => {
  const analysis = await analyzeTumRecording(fixture(), { mode: 'manifest-subset', inspectImages: true, streams: ['rgb'] });
  assert.equal(analysis.coverage.images.validatedFiles, 2); assert.equal(analysis.coverage.images.sourceReferences, 2);
  assert.deepEqual(analysis.coverage.streams, ['rgb']); assert.equal(analysis.report.scope, 'metadata-only');
  assert.match(analysis.limitations.join(' '), /alt kümesi/);
});

test('Artificial quality control: manifest-missing files are findings and other tables still get checked', async () => {
  const input = fixture({ accelerometer: '1 2 3\n' });
  const files = input.files as Map<string, Blob>; files.delete(`${root}groundtruth.txt`); files.delete(`${root}rgb/b.png`);
  const analysis = await analyzeTumRecording(input, defaults);
  assert.equal(codes(analysis).filter(code => code === 'MISSING_FILE').length, 2);
  assert.ok(codes(analysis).includes('TXT_ROW_INVALID'));
  assert.equal(table(analysis, 'groundtruth').rowCount, null); assert.equal(table(analysis, 'accelerometer').rowCount, 1);
  assert.equal(analysis.coverage.images.missingFiles, 1);
  const missing = analysis.details.find(detail => detail.file === `${root}rgb/b.png`); assert.ok(missing);
  assert.equal(missing.sourceListFile, `${root}rgb.txt`); assert.equal(missing.sourceIndex, 1); assert.equal(missing.lineNumber, 3);
  assert.equal(missing.apiIndex, 1); assert.equal(analysis.report.issues[missing.issueIndex].frameIndex, 1);
  assert.equal(analysis.report.scope, 'metadata-only');
});

test('Artificial quality control: corrupt PNG and unsupported RGB/depth encoding retain file/source provenance', async () => {
  const input = fixture(); const files = input.files as Map<string, Blob>;
  files.set(`${root}rgb/a.png`, new Blob(['invalid PNG'])); files.set(`${root}depth/a.png`, pngs.rgb);
  const analysis = await analyzeTumRecording(input, { ...defaults, inspectImages: true });
  assert.ok(codes(analysis).includes('PNG_DECODE_FAILED')); assert.ok(codes(analysis).includes('PNG_UNSUPPORTED_FORMAT'));
  assert.equal(analysis.coverage.images.inspectedFiles, 4); assert.equal(analysis.coverage.images.validatedFiles, 2);
  for (const detail of analysis.details.filter(detail => detail.file?.endsWith('/a.png'))) {
    assert.equal(detail.lineNumber, 2); assert.equal(detail.sourceIndex, 0); assert.equal(detail.apiIndex, 0);
    assert.ok(detail.sourceListFile?.endsWith('.txt')); assert.ok(detail.timestampRaw);
    assert.equal(analysis.report.issues[detail.issueIndex].severity, 'error');
  }
  assert.equal(analysis.report.scope, 'metadata-only');
});

test('Artificial quality control: unreadable Blob data and invalid UTF-8 become structured findings', async () => {
  class UnreadableBlob extends Blob { override arrayBuffer(): Promise<ArrayBuffer> { return Promise.reject(new Error('artificial read failure')); } }
  class UnreadableImage extends Blob { override slice(): Blob { throw new Error('artificial image read failure'); } }
  const input = fixture(); const files = input.files as Map<string, Blob>;
  files.set(`${root}rgb.txt`, new UnreadableBlob(['unreadable']));
  files.set(`${root}accelerometer.txt`, new Blob([new Uint8Array([0xff, 0xfe, 0xff])]));
  files.set(`${root}depth/a.png`, new UnreadableImage(['unreadable']));
  const analysis = await analyzeTumRecording(input, { ...defaults, inspectImages: true });
  assert.equal(codes(analysis).filter(code => code === 'TEXT_READ_FAILED').length, 2);
  assert.ok(codes(analysis).includes('PNG_DECODE_FAILED'));
  assert.equal(table(analysis, 'groundtruth').valid, true); assert.equal(table(analysis, 'rgb').metadata, null);
  assert.equal(analysis.report.scope, 'metadata-only');
});

test('Artificial quality control: malformed TXT columns preserve exact physical line and data ordinal', async () => {
  const input = fixture({ groundtruth: '# comment\n\n1 0 0 0 0 0 0 1\n2 0 0\n3 0 0 0 0 0 0 1 EXTRA\n' });
  const analysis = await analyzeTumRecording(input, defaults);
  const findings = analysis.details.filter(detail => analysis.report.issues[detail.issueIndex].code === 'TXT_ROW_INVALID');
  assert.deepEqual(findings.map(detail => [detail.file, detail.lineNumber, detail.sourceIndex, detail.originalLine]), [
    [`${root}groundtruth.txt`, 4, 1, '2 0 0'], [`${root}groundtruth.txt`, 5, 2, '3 0 0 0 0 0 0 1 EXTRA'],
  ]);
  assert.equal(table(analysis, 'groundtruth').rowCount, 3); assert.equal(table(analysis, 'groundtruth').valid, false);
  assert.equal(table(analysis, 'groundtruth').metadata, null, 'A valid partial table must not masquerade as the whole table.');
  assert.match(analysis.report.unsupported.join(' '), /groundtruth.txt:.*sessiz bir alt dizi/u);
});

test('Artificial quality control: nonnumeric, NaN, Infinity, overflow and absent numeric fields are rejected', async () => {
  for (const token of ['text', 'NaN', 'Infinity', '-Infinity', '1e309']) {
    const analysis = await analyzeTumRecording(fixture({ accelerometer: `1 1 ${token} 3\n` }), defaults);
    assert.ok(codes(analysis).includes('TXT_ROW_INVALID'), token);
    assert.equal(table(analysis, 'accelerometer').metadata, null);
    assert.match(analysis.report.issues.find(issue => issue.code === 'TXT_ROW_INVALID')!.message, /sonlu ondalık/);
  }
  const absent = await analyzeTumRecording(fixture({ rgb: '1\n' }), defaults);
  assert.ok(codes(absent).includes('TXT_ROW_INVALID'));
});

test('Artificial quality control: unsafe and repeated source paths are structural TXT findings', async () => {
  for (const text of ['1 ../rgb/a.png\n', '1 rgb/a.png\n2 rgb/a.png\n']) {
    const analysis = await analyzeTumRecording(fixture({ rgb: text }), defaults);
    assert.ok(codes(analysis).includes('TXT_ROW_INVALID')); assert.equal(table(analysis, 'rgb').valid, false);
  }
});

test('Artificial quality control: duplicate, zero and descending intervals use original decimal order', async () => {
  const text = '# original order\n1 0 0 0 0 0 0 1\n2 0 0 0 0 0 0 1\n1.0 0 0 0 0 0 0 1\n+10e-1 0 0 0 0 0 0 1\n';
  const analysis = await analyzeTumRecording(fixture({ groundtruth: text }), defaults);
  assert.equal(codes(analysis).filter(code => code === 'DUPLICATE_TIMESTAMP').length, 2);
  assert.equal(codes(analysis).filter(code => code === 'NEGATIVE_INTERVAL').length, 1);
  assert.equal(codes(analysis).filter(code => code === 'ZERO_INTERVAL').length, 1);
  assert.deepEqual(table(analysis, 'groundtruth').metadata!.original.rows.map(row => row.timestampRaw), ['1', '2', '1.0', '+10e-1']);
  assert.deepEqual(table(analysis, 'groundtruth').metadata!.derived.intervals.map(interval => interval.exactDecimal), ['1', '-1', '0']);
  const duplicate = analysis.details.find(detail => detail.timestampRaw === '1.0'); assert.ok(duplicate);
  assert.deepEqual(duplicate.previous, { file: `${root}groundtruth.txt`, lineNumber: 2, sourceIndex: 0, timestampRaw: '1' });
  assert.equal(analysis.report.issues[duplicate.issueIndex].severity, 'warning');
});

test('Artificial quality control: rounded/underflowed Number equality never invents duplicate timestamps', async () => {
  const precise = await analyzeTumRecording(fixture({ accelerometer: '1305031452.0000000001 1 2 3\n1305031452.0000000002 1 2 3\n' }), defaults);
  assert.ok(!codes(precise).includes('DUPLICATE_TIMESTAMP')); assert.ok(!codes(precise).includes('ZERO_INTERVAL'));
  assert.equal(table(precise, 'accelerometer').metadata!.derived.intervals[0].exactDecimal, '0.0000000001');
  const underflow = await analyzeTumRecording(fixture({ accelerometer: '1e-400 1 2 3\n0 1 2 3\n' }), defaults);
  assert.ok(!codes(underflow).includes('DUPLICATE_TIMESTAMP')); assert.ok(!codes(underflow).includes('ZERO_INTERVAL'));
  assert.ok(codes(underflow).includes('NEGATIVE_INTERVAL'));
  assert.equal(table(underflow, 'accelerometer').metadata!.derived.intervals[0].value, null);
});

test('Artificial quality control: empty/single-row tables have null interval summaries and unsupported explanations', async () => {
  const analysis = await analyzeTumRecording(fixture({ groundtruth: '# empty table\n', accelerometer: '1 1 2 3\n' }), defaults);
  assert.deepEqual(errors(analysis), []);
  for (const kind of ['groundtruth', 'accelerometer'] as const) {
    const described = table(analysis, kind).metadata!;
    assert.equal(described.derived.firstToLastDuration.value, null); assert.equal(described.derived.meanInterval.value, null);
    assert.equal(described.derived.minimumInterval.value, null); assert.equal(described.derived.maximumInterval.value, null);
    assert.equal(described.derived.medianInterval.value, null);
  }
  assert.match(analysis.report.unsupported.join(' '), /en az iki timestamp/);
  const emptyImages = fixture({ rgb: '# empty\n', depth: '# empty\n' });
  emptyImages.manifest.acquisition.files = emptyImages.manifest.acquisition.files.filter(file => !file.endsWith('.png'));
  const empty = await analyzeTumRecording(emptyImages, { ...defaults, inspectImages: true });
  assert.deepEqual(errors(empty), []); assert.equal(empty.coverage.images.sourceReferences, 0);
  assert.equal(empty.report.scope, 'metadata-only');
});

test('Artificial quality control: unknown regime keeps a large source interval without missing-frame claims', async () => {
  const analysis = await analyzeTumRecording(fixture({ groundtruth: '1 0 0 0 0 0 0 1\n1000000 0 0 0 0 0 0 1\n' }), defaults);
  assert.deepEqual(errors(analysis), []); assert.equal(table(analysis, 'groundtruth').metadata!.derived.maximumInterval.exactDecimal, '999999');
  assert.ok(!codes(analysis).some(code => /MISSING_FRAME|LOST|GAP/u.test(code)));
  assert.ok(!Object.hasOwn(analysis.coverage, 'missingFrameCount'));
});

test('Artificial quality control: subset exclusions are neither missing files nor API indices', async () => {
  const input = fixture({ rgb: '# source order preserved\n3 rgb/a.png\n2 rgb/b.png\n1 rgb/c.png\n' });
  input.manifest.acquisition.files = input.manifest.acquisition.files.filter(file => file !== `${root}rgb/b.png`);
  input.manifest.acquisition.files.push(`${root}rgb/c.png`);
  const files = input.files as Map<string, Blob>; files.delete(`${root}rgb/b.png`); files.set(`${root}rgb/c.png`, pngs.rgb);
  const analysis = await analyzeTumRecording(input, { mode: 'manifest-subset', inspectImages: true, streams: ['rgb'] });
  assert.equal(analysis.coverage.images.notSelectedSourceReferences.rgb, 1); assert.equal(analysis.coverage.images.expectedFiles, 2);
  assert.equal(analysis.coverage.images.missingFiles, 0); assert.ok(!codes(analysis).includes('MISSING_FILE'));
  assert.equal(analysis.coverage.selectedSourceReferences.rgb, 2);
  assert.deepEqual(table(analysis, 'rgb').metadata!.original.rows.map(row => row.sourceIndex), [0, 1, 2]);
  const unselectedIssue = analysis.details.find(detail => detail.stream === 'rgb' && detail.sourceIndex === 1); assert.ok(unselectedIssue);
  const selectedIssue = analysis.details.find(detail => detail.stream === 'rgb' && detail.sourceIndex === 2); assert.ok(selectedIssue);
  assert.equal(unselectedIssue.apiIndex, undefined); assert.equal(analysis.report.issues[unselectedIssue.issueIndex].frameIndex, undefined);
  assert.equal(selectedIssue.apiIndex, 1); assert.equal(analysis.report.issues[selectedIssue.issueIndex].frameIndex, 1);
  assert.equal(analysis.report.scope, 'metadata-only');
});

test('Artificial quality control: full mode requires source images outside the manifest subset', async () => {
  const input = fixture({ rgb: '1 rgb/a.png\n2 rgb/b.png\n3 rgb/c.png\n' });
  const analysis = await analyzeTumRecording(input, { ...defaults, inspectImages: true, streams: ['rgb'] });
  assert.equal(analysis.coverage.images.sourceReferences, 3); assert.equal(analysis.coverage.images.expectedFiles, 3);
  assert.equal(analysis.coverage.images.missingFiles, 1); assert.equal(analysis.report.scope, 'metadata-only');
  const detail = analysis.details.find(item => item.file === `${root}rgb/c.png`); assert.ok(detail);
  assert.equal(detail.sourceIndex, 2); assert.equal(detail.apiIndex, 2); assert.equal(detail.timestampRaw, '3');
});

test('Artificial quality control: malformed manifest, options and ambiguous source tables return findings', async () => {
  const invalid = fixture(); invalid.manifest.contractVersion = 2 as 1;
  assert.ok(codes(await analyzeTumRecording(invalid, defaults)).includes('INVALID_MANIFEST'));
  assert.ok(codes(await analyzeTumRecording(fixture(), { ...defaults, streams: [] })).includes('INVALID_OPTIONS'));
  assert.ok(codes(await analyzeTumRecording(fixture(), { ...defaults, streams: ['rgb', 'rgb'] })).includes('INVALID_OPTIONS'));
  const absent = fixture(); absent.manifest.acquisition.files = absent.manifest.acquisition.files.filter(file => file !== `${root}accelerometer.txt`);
  assert.ok(codes(await analyzeTumRecording(absent, defaults)).includes('SOURCE_TABLE_UNAVAILABLE'));
});

test('Artificial quality control: input manifest/map are snapshotted before asynchronous Blob reads', async () => {
  let release!: () => void; let notify!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }); const started = new Promise<void>(resolve => { notify = resolve; });
  class DelayedBlob extends Blob {
    override async arrayBuffer(): Promise<ArrayBuffer> { notify(); await gate; return super.arrayBuffer(); }
  }
  const input = fixture(); (input.files as Map<string, Blob>).set(`${root}rgb.txt`, new DelayedBlob([tableTexts.rgb]));
  const pending = analyzeTumRecording(input, defaults); await started;
  input.manifest.acquisition.files.length = 0; (input.files as Map<string, Blob>).clear(); release();
  const analysis = await pending;
  assert.equal(analysis.coverage.images.presentFiles, 4); assert.deepEqual(errors(analysis), []);
});

test('Artificial quality control: pending work retains its initial options despite caller mutations', async () => {
  let release!: () => void; let notify!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { notify = resolve; });
  class DelayedBlob extends Blob {
    override async arrayBuffer(): Promise<ArrayBuffer> { notify(); await gate; return super.arrayBuffer(); }
  }
  const input = fixture({ rgb: '1 rgb/a.png\n2 rgb/b.png\n3 rgb/outside-subset.png\n' });
  (input.files as Map<string, Blob>).set(`${root}rgb.txt`, new DelayedBlob(['1 rgb/a.png\n2 rgb/b.png\n3 rgb/outside-subset.png\n']));
  const originalController = new AbortController();
  const options: TumQualityOptions = { mode: 'manifest-subset', inspectImages: false, streams: ['rgb'], signal: originalController.signal };
  const pending = analyzeTumRecording(input, options);
  await started;
  options.mode = 'full-recording'; options.inspectImages = true;
  (options.streams as ('rgb' | 'depth')[]).push('depth');
  const replacementController = new AbortController(); replacementController.abort();
  options.signal = replacementController.signal;
  release();
  const analysis = await pending;
  assert.equal(analysis.report.scope, 'metadata-only');
  assert.equal(analysis.coverage.selectionMode, 'manifest-subset'); assert.equal(analysis.coverage.inspectionRequested, false);
  assert.deepEqual(analysis.coverage.streams, ['rgb']);
  assert.equal(analysis.coverage.images.sourceReferences, 3); assert.equal(analysis.coverage.images.expectedFiles, 2);
  assert.equal(analysis.coverage.images.inspectedFiles, 0); assert.equal(analysis.coverage.images.validatedFiles, 0);
  assert.equal(analysis.coverage.images.missingFiles, 0); assert.equal(analysis.coverage.images.notSelectedSourceReferences.rgb, 1);
  assert.deepEqual(errors(analysis), []); assert.equal(analysis.coverage.completed, true);
});

test('Artificial quality control: unreadable options and nonboolean inspection return controlled findings', async () => {
  const options = Object.defineProperty({}, 'mode', { get() { throw new Error('Artificial unreadable option'); } });
  assert.ok(codes(await analyzeTumRecording(fixture(), options as TumQualityOptions)).includes('INVALID_OPTIONS'));
  assert.ok(codes(await analyzeTumRecording(fixture(), { ...defaults, inspectImages: 'yes' as unknown as boolean })).includes('INVALID_OPTIONS'));
});

test('Artificial quality control: abort before or during a pending read returns promptly with partial coverage', { timeout: 3000 }, async () => {
  const aborted = new AbortController(); aborted.abort();
  const initial = await analyzeTumRecording(fixture(), { ...defaults, signal: aborted.signal });
  assert.equal(initial.coverage.cancelled, true); assert.equal(initial.coverage.completed, false);
  let notify!: () => void; const started = new Promise<void>(resolve => { notify = resolve; });
  let rejectLate!: (reason: Error) => void;
  class PendingBlob extends Blob {
    override arrayBuffer(): Promise<ArrayBuffer> { notify(); return new Promise((_, reject) => { rejectLate = reject; }); }
  }
  const input = fixture(); (input.files as Map<string, Blob>).set(`${root}rgb.txt`, new PendingBlob(['pending']));
  const controller = new AbortController(); const pending = analyzeTumRecording(input, { ...defaults, signal: controller.signal });
  await started; controller.abort(); const analysis = await pending; rejectLate(new Error('Artificial late rejection'));
  assert.equal(analysis.coverage.cancelled, true); assert.equal(analysis.coverage.completed, false);
  assert.equal(analysis.report.scope, 'metadata-only'); assert.ok(codes(analysis).includes('ANALYSIS_CANCELLED'));
});

async function realInput(): Promise<RecordingInput | null> {
  const manifest = JSON.parse(await readFile(new URL('../data/manifests/tum-rgbd-freiburg1-desk.json', import.meta.url), 'utf8')) as DatasetManifest;
  const files = new Map<string, Blob>();
  try {
    for (const file of manifest.acquisition.files) files.set(file, new Blob([Uint8Array.from(await readFile(new URL(`../data/local/tum-rgbd-freiburg1-desk/${file}`, import.meta.url)))]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  return { manifest, files };
}

test('REAL TUM sample: four original full TXT lists, six PNGs and 1202 explicit subset exclusions', async context => {
  const input = await realInput();
  if (!input) { context.skip('Original local ten-file TUM sample absent; acquire it using docs/datasets.md.'); return; }
  const analysis = await analyzeTumRecording(input, { mode: 'manifest-subset', inspectImages: true });
  assert.equal(input.files.size, 10); assert.deepEqual(errors(analysis), []);
  assert.deepEqual(analysis.coverage.sourceTables.map(item => [item.kind, item.rowCount, item.valid]), [
    ['rgb', 613, true], ['depth', 595, true], ['groundtruth', 2335, true], ['accelerometer', 11815, true],
  ]);
  assert.equal(analysis.coverage.images.sourceReferences, 1208); assert.equal(analysis.coverage.images.expectedFiles, 6);
  assert.equal(analysis.coverage.images.presentFiles, 6); assert.equal(analysis.coverage.images.inspectedFiles, 6);
  assert.equal(analysis.coverage.images.validatedFiles, 6); assert.equal(analysis.coverage.images.missingFiles, 0);
  assert.deepEqual(analysis.coverage.images.notSelectedSourceReferences, { rgb: 610, depth: 592 });
  assert.deepEqual(analysis.coverage.selectedSourceReferences, { rgb: 3, depth: 3 });
  assert.equal(analysis.report.scope, 'metadata-only'); assert.ok(!codes(analysis).includes('MISSING_FILE'));
  assert.equal(table(analysis, 'rgb').metadata!.derived.firstToLastDuration.exactDecimal, '20.404349');
  assert.equal(table(analysis, 'depth').metadata!.derived.firstToLastDuration.exactDecimal, '19.816716');
});

test('REAL TUM sample: full mode reports 1202 unsupplied source files with exact source paths', async context => {
  const input = await realInput();
  if (!input) { context.skip('Original local TUM sample absent; this is not a completed real-data test.'); return; }
  const analysis = await analyzeTumRecording(input, { mode: 'full-recording' });
  assert.equal(analysis.coverage.images.expectedFiles, 1208); assert.equal(analysis.coverage.images.presentFiles, 6);
  assert.equal(analysis.coverage.images.missingFiles, 1202); assert.equal(analysis.report.scope, 'metadata-only');
  assert.equal(codes(analysis).filter(code => code === 'MISSING_FILE').length, 1202);
  const detail = analysis.details.find(item => item.stream === 'rgb' && item.sourceIndex === 1); assert.ok(detail);
  assert.equal(detail.sourceListFile, 'rgbd_dataset_freiburg1_desk/rgb.txt'); assert.equal(detail.lineNumber, 5); assert.equal(detail.apiIndex, 1);
  assert.ok(detail.file?.startsWith('rgbd_dataset_freiburg1_desk/rgb/')); assert.ok(detail.timestampRaw);
  assert.match(analysis.report.issues[detail.issueIndex].message, /sensörün kare kaybettiğini kanıtlamaz/);
});
