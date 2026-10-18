import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';
import { TumRecordingReader } from '../src/data';
import { runTumLocalExample } from '../src/data/examples/tum-local';
import {
  analyzeMetadata, analyzeTumRecording, createTumReport, prepareTumJsonDownload, serializeTumReport,
  type TumExportReport, type TumReportResult,
} from '../src/quality';
import type { DatasetManifest, ReaderResult, RecordingInput, RecordingMetadata } from '../src/shared/types';

const ROOT = 'artificial-report';
/** Artificial control tables; missing PNGs deliberately produce genuine quality errors. */
function fixture(includeUnreadPlaceholders = false): RecordingInput {
  const manifest: DatasetManifest = {
    contractVersion: 1,
    recording: {
      id: 'ARTIFICIAL-report-only', name: 'ARTIFICIAL TEST — report capsule', provenance: 'real',
      source: { title: 'ARTIFICIAL locally generated fixture, not original TUM sensor data', url: null },
      license: { status: 'unknown' },
    },
    format: { status: 'known', value: 'TUM-shaped artificial TXT/PNG fixture', evidence: 'Generated control fixture.' },
    acquisition: {
      instructions: 'ARTIFICIAL fixture generated in the test; do not download.',
      files: ['rgb.txt', 'depth.txt', 'groundtruth.txt', 'accelerometer.txt', 'rgb/a.png', 'depth/a.png'].map(file => `${ROOT}/${file}`),
    },
    timing: { kind: 'unknown', timeBase: null, description: 'ARTIFICIAL: separate unknown clocks.', nominalFps: { status: 'unknown' } },
    radiometry: { status: 'unavailable', unit: null, evidence: 'ARTIFICIAL fixture contains no temperature.' },
    citation: null, versionOrAccessDate: null,
  };
  const files = new Map<string, Blob>([
    [`${ROOT}/rgb.txt`, new Blob(['# ARTIFICIAL RGB\n1.000000 rgb/a.png\n2.000000 rgb/b.png\n'])],
    [`${ROOT}/depth.txt`, new Blob(['# ARTIFICIAL depth; distinct timestamps\n1.050000 depth/a.png\n2.050000 depth/b.png\n'])],
    [`${ROOT}/groundtruth.txt`, new Blob(['# ARTIFICIAL poses\n1 0 0 0 0 0 0 1\n2 1 0 0 0 0 0 1\n'])],
    [`${ROOT}/accelerometer.txt`, new Blob(['# ARTIFICIAL accelerometer\n1 0 0 1\n2 0 1 0\n'])],
  ]);
  if (includeUnreadPlaceholders) {
    // Used exclusively to open TXT metadata. These labelled invalid bytes must never be decoded as images.
    files.set(`${ROOT}/rgb/a.png`, new Blob(['ARTIFICIAL unread placeholder, not PNG']));
    files.set(`${ROOT}/depth/a.png`, new Blob(['ARTIFICIAL unread placeholder, not PNG']));
  }
  return { manifest, files };
}
function value<T>(result: TumReportResult<T> | ReaderResult<T>): T {
  assert.ok(result.ok, result.ok ? undefined : `${result.error.code}: ${result.error.message}`);
  return result.value;
}
function expectError(result: TumReportResult<unknown>, code: 'INVALID_REPORT' | 'SERIALIZATION_FAILED' | 'DOWNLOAD_UNAVAILABLE') {
  assert.equal(result.ok, false);
  if (result.ok) assert.fail('Expected structured report error.');
  assert.equal(result.error.code, code);
  assert.ok(result.error.message.length > 0);
  assert.ok(result.error.recovery.length > 0);
}
async function capsule(): Promise<TumExportReport> {
  const input = fixture();
  const analysis = await analyzeTumRecording(input, { mode: 'manifest-subset', inspectImages: false });
  assert.ok(analysis.report.issues.some(issue => issue.code === 'MISSING_FILE' && issue.severity === 'error'));
  assert.equal(analysis.report.scope, 'metadata-only');
  return value(createTumReport({ input, metadata: null, analysis }));
}
function artificialMetadata(): RecordingMetadata {
  const { manifest } = fixture();
  return {
    recording: structuredClone(manifest.recording), frameCount: 1, format: 'ARTIFICIAL metadata-only fixture',
    timing: structuredClone(manifest.timing), radiometry: structuredClone(manifest.radiometry),
    reader: { id: 'tum-rgbd-rgb', version: 'ARTIFICIAL-test' },
  };
}

/** Actual PNG structure for artificial full-inspection controls; all pixels are generated zeros. */
function artificialPng(stream: 'rgb' | 'depth'): Blob {
  const chunk = (name: string, data: Buffer): Buffer => {
    const type = Buffer.from(name);
    let crc = 0xffffffff;
    for (const byte of Buffer.concat([type, data])) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, type, data, checksum]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(640); ihdr.writeUInt32BE(480, 4);
  ihdr[8] = stream === 'rgb' ? 8 : 16; ihdr[9] = stream === 'rgb' ? 2 : 0;
  return new Blob([Uint8Array.from(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.alloc(480 * (1 + 640 * (stream === 'rgb' ? 3 : 2))))), chunk('IEND', Buffer.alloc(0)),
  ]))]);
}

test('ARTIFICIAL report: deterministic JSON preserves nested shared QualityReport without wall-clock or Blob URLs', async () => {
  const report = await capsule();
  const first = value(serializeTumReport(report));
  const second = value(serializeTumReport(structuredClone(report)));
  assert.equal(first, second);
  const parsed = JSON.parse(first);
  assert.equal(parsed.schema, 'aeroobserve.efe-recording-report');
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.recordingId, 'ARTIFICIAL-report-only');
  assert.equal(parsed.scope, 'metadata-only');
  assert.deepEqual(parsed.analysis.report, report.analysis.report);
  assert.equal(parsed.reader, null);
  assert.equal(parsed.selectedReaderMetadata, null);
  assert.doesNotMatch(first, /blob:|"(?:generatedAt|createdAt|exportedAt|wallClock)"\s*:/u);
  assert.ok(first.endsWith('\n'));
  assert.equal(value(serializeTumReport(parsed as TumExportReport)), first);
});

test('ARTIFICIAL report: diagnostic nonfinite/undefined values become null and bigint retains its decimal string', async () => {
  const report = await capsule();
  const diagnostic = { nan: NaN, positiveInfinity: Infinity, negativeInfinity: -Infinity, unknown: undefined, exact: 123456789012345678901234567890n, array: [undefined, NaN, Infinity, 9007199254740993n] };
  Object.assign(report, { diagnostic });
  const parsed = JSON.parse(value(serializeTumReport(report)));
  assert.deepEqual(parsed.diagnostic, {
    nan: null, positiveInfinity: null, negativeInfinity: null, unknown: null,
    exact: '123456789012345678901234567890', array: [null, null, null, '9007199254740993'],
  });
  assert.ok(Number.isNaN(diagnostic.nan), 'Serialization must not mutate caller diagnostics.');
  assert.equal(typeof diagnostic.exact, 'bigint');
});

test('ARTIFICIAL report: circular diagnostics return SERIALIZATION_FAILED without throwing', async () => {
  const report = await capsule();
  Object.assign(report, { diagnostic: { circular: report } });
  expectError(serializeTumReport(report), 'SERIALIZATION_FAILED');
  expectError(prepareTumJsonDownload(report), 'SERIALIZATION_FAILED');
});

test('ARTIFICIAL report: mismatched recording identity is rejected', async () => {
  const input = fixture();
  const analysis = await analyzeTumRecording(input, { mode: 'manifest-subset', inspectImages: false });
  const mismatchedAnalysis = structuredClone(analysis);
  mismatchedAnalysis.report.recordingId = 'OTHER-ARTIFICIAL-RECORDING';
  expectError(createTumReport({ input, metadata: null, analysis: mismatchedAnalysis }), 'INVALID_REPORT');
  const metadata = artificialMetadata(); metadata.recording.id = 'OTHER-ARTIFICIAL-RECORDING';
  expectError(createTumReport({ input, metadata, analysis }), 'INVALID_REPORT');
});

test('ARTIFICIAL report: equal frame counts cannot combine RGB metadata with depth source or selected-frame provenance', async () => {
  const input = fixture(true);
  const rgb = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  const depth = new TumRecordingReader({ stream: 'depth', mode: 'manifest-subset' });
  try {
    const [rgbMetadata, depthMetadata] = (await Promise.all([rgb.open(input), depth.open(input)])).map(value);
    assert.equal(rgbMetadata.frameCount, depthMetadata.frameCount);
    assert.equal(rgbMetadata.frameCount, 1);
    const analysis = await analyzeTumRecording(input, { mode: 'manifest-subset', inspectImages: false });
    const rgbSource = value(rgb.getSourceInfo()); const depthSource = value(depth.getSourceInfo());
    const rgbFrame = value(rgb.getFrameMetadata(0)); const depthFrame = value(depth.getFrameMetadata(0));
    value(createTumReport({ input, metadata: rgbMetadata, analysis, source: rgbSource, frameMetadata: [rgbFrame] }));
    expectError(createTumReport({ input, metadata: rgbMetadata, analysis, source: depthSource }), 'INVALID_REPORT');
    expectError(createTumReport({ input, metadata: rgbMetadata, analysis, source: rgbSource, frameMetadata: [depthFrame] }), 'INVALID_REPORT');
    assert.equal(rgbFrame.original.png.status, 'not-read');
    assert.equal(depthFrame.original.png.status, 'not-read');
  } finally { await rgb.close(); await depth.close(); }
});

test('ARTIFICIAL report: optional source omission still validates every frame against its analyzed TXT/API row', async () => {
  const input = fixture(true);
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    const metadata = value(await reader.open(input));
    const original = value(reader.getFrameMetadata(0));
    const analysis = await analyzeTumRecording(input, { mode: 'manifest-subset' });
    const correct = value(createTumReport({ input, metadata, analysis, frameMetadata: [original] }));
    value(serializeTumReport(correct));

    const differentRecording = structuredClone(original);
    differentRecording.original.sourceListFile = 'other-recording/rgb.txt';
    differentRecording.original.sourceFile = 'other-recording/rgb/other.png';
    expectError(createTumReport({ input, metadata, analysis, frameMetadata: [differentRecording] }), 'INVALID_REPORT');

    // This is a real row in the artificial source TXT, but outside the explicit
    // subset. It cannot be relabelled as selected API frame zero.
    const unselected = structuredClone(original);
    Object.assign(unselected.original, { sourceFile: `${ROOT}/rgb/b.png`, sourceIndex: 1, lineNumber: 3, timestampRaw: '2.000000', timestampValue: 2 });
    Object.assign(unselected.derived.apiIndex.inputs, { sourceIndex: 1, lineNumber: 3 });
    expectError(createTumReport({ input, metadata, analysis, frameMetadata: [unselected] }), 'INVALID_REPORT');

    const inconsistentInputs = structuredClone(original);
    inconsistentInputs.derived.apiIndex.inputs.file = 'other-recording/rgb.txt';
    expectError(createTumReport({ input, metadata, analysis, frameMetadata: [inconsistentInputs] }), 'INVALID_REPORT');
    const mutatedCapsule = structuredClone(correct);
    mutatedCapsule.originalMetadata.selectedFrames[0].original.sourceListFile = 'other-recording/rgb.txt';
    expectError(serializeTumReport(mutatedCapsule), 'INVALID_REPORT');
  } finally { await reader.close(); }
});

test('ARTIFICIAL report: subset without image inspection cannot be relabelled full-recording by factory or serializer', async () => {
  const input = fixture();
  const analysis = await analyzeTumRecording(input, { mode: 'manifest-subset', inspectImages: false });
  assert.equal(analysis.coverage.inspectionRequested, false);
  const escalated = structuredClone(analysis); escalated.report.scope = 'full-recording';
  expectError(createTumReport({ input, metadata: null, analysis: escalated }), 'INVALID_REPORT');
  const report = value(createTumReport({ input, metadata: null, analysis }));
  report.scope = 'full-recording'; report.analysis.report.scope = 'full-recording';
  expectError(serializeTumReport(report), 'INVALID_REPORT');
});

test('ARTIFICIAL full inspection: present-file mismatch or infinite core counts cannot serialize a full-recording claim', async () => {
  const input = fixture();
  const files = new Map(input.files);
  for (const stream of ['rgb', 'depth'] as const) {
    const png = artificialPng(stream);
    for (const name of ['a', 'b']) files.set(`${ROOT}/${stream}/${name}.png`, png);
  }
  const fullInput = { ...input, files };
  const analysis = await analyzeTumRecording(fullInput, { mode: 'full-recording', inspectImages: true });
  assert.equal(analysis.report.scope, 'full-recording');
  assert.equal(analysis.coverage.images.sourceReferences, 4);
  assert.equal(analysis.coverage.images.validatedFiles, 4);
  assert.ok(!analysis.report.issues.some(issue => issue.severity === 'error'));
  const baseline = value(createTumReport({ input: fullInput, metadata: null, analysis }));
  assert.equal(JSON.parse(value(serializeTumReport(baseline))).scope, 'full-recording');

  const absentPresentFiles = structuredClone(baseline);
  absentPresentFiles.analysis.coverage.images.presentFiles = 0;
  expectError(serializeTumReport(absentPresentFiles), 'INVALID_REPORT');
  const missingAnalysis = structuredClone(analysis); missingAnalysis.coverage.images.presentFiles = 0;
  expectError(createTumReport({ input: fullInput, metadata: null, analysis: missingAnalysis }), 'INVALID_REPORT');

  const infinite = structuredClone(baseline);
  Object.assign(infinite.analysis.coverage.images, {
    sourceReferences: Infinity, expectedFiles: Infinity, presentFiles: Infinity, inspectedFiles: Infinity, validatedFiles: Infinity,
  });
  expectError(serializeTumReport(infinite), 'INVALID_REPORT');
  const infiniteAnalysis = structuredClone(analysis);
  Object.assign(infiniteAnalysis.coverage.images, {
    sourceReferences: Infinity, expectedFiles: Infinity, presentFiles: Infinity, inspectedFiles: Infinity, validatedFiles: Infinity,
  });
  expectError(createTumReport({ input: fullInput, metadata: null, analysis: infiniteAnalysis }), 'INVALID_REPORT');
});

test('ARTIFICIAL subset report: negative or fractional core coverage counts are rejected rather than normalized', async () => {
  const input = fixture();
  const original = await analyzeTumRecording(input, { mode: 'manifest-subset', inspectImages: false });
  value(createTumReport({ input, metadata: null, analysis: original }));
  const mutations: Array<(analysis: typeof original, invalid: number) => void> = [
    ...(['sourceReferences', 'expectedFiles', 'presentFiles', 'inspectedFiles', 'validatedFiles', 'missingFiles'] as const)
      .map(key => (analysis: typeof original, invalid: number) => { analysis.coverage.images[key] = invalid; }),
    ...(['rgb', 'depth'] as const).flatMap(stream => [
      (analysis: typeof original, invalid: number) => { analysis.coverage.selectedSourceReferences[stream] = invalid; },
      (analysis: typeof original, invalid: number) => { analysis.coverage.images.notSelectedSourceReferences[stream] = invalid; },
    ]),
    (analysis, invalid) => { analysis.coverage.sourceTables[0].rowCount = invalid; },
  ];
  for (const invalid of [-1, .5]) {
    for (const mutate of mutations) {
      const analysis = structuredClone(original); mutate(analysis, invalid);
      expectError(createTumReport({ input, metadata: null, analysis }), 'INVALID_REPORT');
      const report = value(createTumReport({ input, metadata: null, analysis: original }));
      // Export coverage omits source-table metadata; all fields mutated here are retained unchanged.
      const capsuleAnalysis = report.analysis as typeof original;
      mutate(capsuleAnalysis, invalid);
      expectError(serializeTumReport(report), 'INVALID_REPORT');
    }
  }
});

test('ARTIFICIAL download: Blob MIME/text/fetch match JSON and disposal is idempotent without automatic DOM triggering', async () => {
  const report = await capsule();
  const json = value(serializeTumReport(report));
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let domAccesses = 0;
  let prepared: ReturnType<typeof prepareTumJsonDownload>;
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: new Proxy({}, { get() { domAccesses++; throw new Error('Test forbids automatic DOM/download triggering.'); } }) });
    prepared = prepareTumJsonDownload(report, 'artificial-quality.json');
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
  const download = value(prepared);
  try {
    assert.equal(domAccesses, 0);
    assert.equal(download.filename, 'artificial-quality.json');
    assert.equal(download.blob.type, 'application/json;charset=utf-8');
    assert.equal(await download.blob.text(), json);
    assert.equal(await (await fetch(download.url)).text(), json);
    download.dispose(); download.dispose();
    await assert.rejects(fetch(download.url));
  } finally { download.dispose(); }
});

test('ARTIFICIAL download: unsafe filenames and absent Object URL support return controlled errors', async () => {
  const report = await capsule();
  for (const filename of ['../quality.json', 'folder/quality.json', 'folder\\quality.json', 'drive:quality.json', 'quality.txt', '\u0000quality.json']) {
    expectError(prepareTumJsonDownload(report, filename), 'INVALID_REPORT');
  }
  const original = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  try {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: undefined });
    expectError(prepareTumJsonDownload(report), 'DOWNLOAD_UNAVAILABLE');
  } finally {
    if (original) Object.defineProperty(URL, 'createObjectURL', original);
    else Reflect.deleteProperty(URL, 'createObjectURL');
  }
});

test('ARTIFICIAL metadata: malformed/null/nonfinite/invalid known fields return INVALID_METADATA; valid unknowns remain informational', () => {
  const valid = artificialMetadata();
  const variants: unknown[] = [null, undefined, {},
    ...[NaN, Infinity, -1, .5].map(frameCount => ({ ...valid, frameCount })),
    { ...valid, recording: { ...valid.recording, license: { status: 'known', value: 'label', evidence: '' } } },
    { ...valid, recording: { ...valid.recording, license: { status: 'known', value: '', evidence: 'test' } } },
    { ...valid, timing: { ...valid.timing, nominalFps: { status: 'known', value: NaN, evidence: 'test' } } },
    { ...valid, timing: { ...valid.timing, nominalFps: { status: 'known', value: 0, evidence: 'test' } } },
    { ...valid, reader: { id: '', version: 'test' } },
  ];
  for (const candidate of variants) {
    const result = analyzeMetadata(candidate as RecordingMetadata);
    assert.equal(result.scope, 'metadata-only');
    assert.ok(result.issues.some(issue => issue.code === 'INVALID_METADATA' && issue.severity === 'error'));
  }
  const original = structuredClone(valid);
  const unknowns = analyzeMetadata(valid);
  assert.deepEqual(unknowns.issues.map(issue => issue.code), ['TIME_UNKNOWN', 'LICENSE_UNKNOWN', 'NO_TEMPERATURE']);
  assert.ok(unknowns.issues.every(issue => issue.severity === 'info'));
  assert.deepEqual(valid, original);
});

test('REAL report example: full source counts, six inspected subset PNGs and closed preview URLs', async (context) => {
  const originalCreate = URL.createObjectURL;
  const urls: string[] = [];
  let result: Awaited<ReturnType<typeof runTumLocalExample>>;
  try {
    URL.createObjectURL = (blob: Blob) => { const url = originalCreate.call(URL, blob); urls.push(url); return url; };
    try { result = await runTumLocalExample(); }
    catch (error) {
      // Only the example loader's wrapped actual-file ENOENT is an honest missing-data skip.
      const cause = error instanceof Error ? error.cause : undefined;
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ENOENT') {
        context.skip('Real original TUM sample absent; install docs/datasets.md official sample. Real report example is not completed.');
        return;
      }
      throw error;
    }
  } finally { URL.createObjectURL = originalCreate; }
  const { report, json } = result;
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.scope, 'metadata-only');
  assert.equal(report.analysis.report.scope, 'metadata-only');
  assert.equal(report.selectedReaderMetadata?.frameCount, 3);
  assert.deepEqual(Object.fromEntries(report.analysis.coverage.sourceTables.map(table => [table.kind, table.rowCount])), {
    rgb: 613, depth: 595, groundtruth: 2335, accelerometer: 11815,
  });
  const images = report.analysis.coverage.images;
  assert.equal(images.sourceReferences, 1208);
  assert.equal(images.expectedFiles, 6);
  assert.equal(images.presentFiles, 6);
  assert.equal(images.inspectedFiles, 6);
  assert.equal(images.validatedFiles, 6);
  assert.equal(images.missingFiles, 0);
  assert.deepEqual(images.notSelectedSourceReferences, { rgb: 610, depth: 592 });
  assert.equal(images.notSelectedSourceReferences.rgb + images.notSelectedSourceReferences.depth, 1202);
  assert.deepEqual(JSON.parse(json), JSON.parse(value(serializeTumReport(report))));
  assert.doesNotMatch(json, /blob:/u);
  assert.equal(urls.length, 3);
  for (const url of urls) await assert.rejects(fetch(url), 'Example must close every preview URL in finally before returning.');
});
