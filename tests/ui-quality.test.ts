import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DatasetManifest, RecordingInput } from '../src/shared/types';
import type { TumStream } from '../src/data';
import { analyzeTumRecording, type TumQualityAnalysis, type TumQualityOptions } from '../src/quality';
import { createTumRecordingBinding } from '../src/app/recordingBinding';
import { ReaderSession } from '../src/playback/readerSession';
import { exampleBinding } from '../src/demo/recording/example';
import { activeQualityTarget, QualityAnalysisController, type QualityTarget, type QualityAnalysisState } from '../src/ui/recording/qualityController';
import { QualityPanel } from '../src/ui/recording/QualityPanel';
import { QualityIntervals } from '../src/ui/recording/QualityIntervals';
import { qualityIntervalPage, qualityIssuePage } from '../src/ui/recording/qualityPresentation';

// ARTIFICIAL PNG/TXT test files only; no original TUM pixels or measurements.
function chunk(type: string, bytes: Buffer) {
  const name = Buffer.from(type), header = Buffer.alloc(4), footer = Buffer.alloc(4); header.writeUInt32BE(bytes.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, bytes])) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
  footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0); return Buffer.concat([header, name, bytes, footer]);
}
function artificialPng(stream: TumStream) {
  const header = Buffer.alloc(13); header.writeUInt32BE(640); header.writeUInt32BE(480, 4);
  header[8] = stream === 'rgb' ? 8 : 16; header[9] = stream === 'rgb' ? 2 : 0;
  return new Blob([Uint8Array.from(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc(480 * (1 + 640 * (stream === 'rgb' ? 3 : 2))))), chunk('IEND', Buffer.alloc(0))]))]);
}
const root = 'ARTIFICIAL-UI-QUALITY';
function fixture(anomalies = false): RecordingInput {
  const files = new Map<string, Blob>();
  for (const stream of ['rgb', 'depth'] as const) {
    const times = anomalies ? ['1.0000', '1.0000', '0.5000', '4.0000', '5.0000'] : ['1.0000', '2.0000', '3.0000', '4.0000', '5.0000'];
    files.set(`${root}/${stream}.txt`, new Blob([`# YAPAY TEST\n${times.map((time, i) => `${time} ${stream}/${i}.png`).join('\n')}\n`]));
    for (const index of [0, 2, 4]) files.set(`${root}/${stream}/${index}.png`, artificialPng(stream));
  }
  files.set(`${root}/groundtruth.txt`, new Blob(['1 0 0 0 0 0 0 1\n2 1 0 0 0 0 0 1\n']));
  files.set(`${root}/accelerometer.txt`, new Blob(['1 0 0 1\n2 0 0 1\n']));
  const manifest: DatasetManifest = { contractVersion: 1,
    recording: { id: 'ARTIFICIAL-UI-QUALITY', name: 'YAPAY KALİTE TESTİ — gerçek TUM değildir', provenance: 'real',
      source: { title: 'YAPAY kontrol dosyaları', url: null }, license: { status: 'known', value: 'YAPAY test', evidence: 'tests/ui-quality.test.ts' } },
    format: { status: 'known', value: 'TUM encoding — ARTIFICIAL TEST', evidence: 'YAPAY TEST' },
    acquisition: { instructions: 'Yalnız test belleğinde oluşturulur', files: [...files.keys()] },
    timing: { kind: 'unknown', timeBase: null, nominalFps: { status: 'unknown' }, description: 'YAPAY; sensör zamanı değildir' },
    radiometry: { status: 'unavailable', unit: null, evidence: 'YAPAY; sıcaklık yok' }, citation: null, versionOrAccessDate: null };
  return { manifest, files };
}

async function active(input = fixture(), stream: TumStream = 'rgb') {
  const binding = createTumRecordingBinding(input, stream); const session = new ReaderSession(binding);
  const metadata = await session.open(), source = session.getSourceInfo();
  assert.ok(metadata?.ok); assert.ok(source?.ok);
  const target = activeQualityTarget({}, binding, true, metadata.value, source.value, stream); assert.ok(target);
  return { binding, session, metadata: metadata.value, source: source.value, target };
}
async function result(input = fixture(), stream: TumStream = 'rgb', inspectImages = false) {
  return analyzeTumRecording(input, { mode: 'manifest-subset', streams: [stream], inspectImages });
}
const noop = () => {};
function render(analysis: TumQualityAnalysis | null, target: QualityTarget, override: Partial<QualityAnalysisState> = {}) {
  const state: QualityAnalysisState = { status: analysis ? 'completed' : 'idle', analysis, error: null, runId: 1, inspectImages: analysis?.coverage.inspectionRequested ?? false, ...override };
  return renderToStaticMarkup(createElement(QualityPanel, { report: null, qualityState: state, qualityRecording: target.recording,
    qualityStream: target.stream, qualityMode: target.mode, onAnalyze: noop, onCancelAnalysis: noop }));
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

for (const stream of ['rgb', 'depth'] as const) {
  test(`ARTIFICIAL quality UI: active ${stream} input invokes Efe only on start and preserves actual limited coverage`, async () => {
    const a = await active(fixture(), stream); const states: QualityAnalysisState[] = [];
    const controller = new QualityAnalysisController(a.target, state => states.push(state));
    try {
      assert.equal(controller.getSnapshot().status, 'idle'); assert.equal(controller.getSnapshot().analysis, null);
      assert.equal(a.target.input, a.binding.input);
      const idle = render(null, a.target); assert.match(idle, /henüz başlatılmadı/); assert.doesNotMatch(idle, /Kapsam Özeti|İncelenen kapsamda sorun tespit edilmedi/);
      await controller.start(true); const state = controller.getSnapshot();
      assert.equal(states[0].status, 'running'); assert.equal(state.status, 'completed'); assert.ok(state.analysis);
      assert.deepEqual(state.analysis.coverage.streams, [stream]); assert.equal(state.analysis.coverage.selectionMode, 'manifest-subset');
      assert.equal(state.analysis.report.scope, 'metadata-only'); assert.equal(state.analysis.coverage.images.inspectedFiles, 3);
      assert.equal(state.analysis.coverage.images.validatedFiles, 3); assert.equal(state.analysis.coverage.sourceTables.length, 4);
      assert.equal(state.analysis.coverage.images.notSelectedSourceReferences[stream], 2);
      const html = render(state.analysis, a.target, state);
      assert.match(html, /Metadata-only · tam görüntü kaydı doğrulaması değil/);
      assert.match(html, /İncelenen kapsamda sorun tespit edilmedi/); assert.match(html, /tüm veri setinin hatasız olduğu anlamına gelmez/);
      assert.match(html, /Kaynak damga farkı · birim bilinmiyor/); assert.match(html, /<svg/);
      assert.match(html, /Dört TXT tablosu bağımsız incelenir/); assert.match(html, /Temel metadata kontrolü/);
      assert.ok(state.analysis.limitations.every(text => html.includes(text.replaceAll("'", '&#x27;')) || html.includes(text)));
    } finally { controller.dispose(); await a.session.close(); }
  });
}

test('quality eligibility: prepared/closed/synthetic/mismatched record or stream cannot become an active TUM analysis target', async () => {
  const a = await active();
  try {
    for (const value of [activeQualityTarget({}, a.binding, false, a.metadata, a.source, 'rgb'),
      activeQualityTarget({}, null, true, a.metadata, a.source, 'rgb'), activeQualityTarget({}, a.binding, true, null, a.source, 'rgb'),
      activeQualityTarget({}, exampleBinding, true, a.metadata, a.source, 'rgb'), activeQualityTarget({}, a.binding, true, a.metadata, a.source, 'depth'),
      activeQualityTarget({}, a.binding, true, { ...a.metadata, recording: { ...a.metadata.recording, id: 'OTHER' } }, a.source, 'rgb')]) assert.equal(value, null);
    const controller = new QualityAnalysisController(null, noop, async () => { throw new Error('Must not run'); });
    await controller.start(false); assert.equal(controller.getSnapshot().status, 'idle'); controller.dispose();
  } finally { await a.session.close(); }
});

test('ARTIFICIAL quality UI: metadata-only option performs no PNG inspection and shows unsupported controls honestly', async () => {
  const a = await active(); const controller = new QualityAnalysisController(a.target, noop);
  try {
    await controller.start(false); const analysis = controller.getSnapshot().analysis!;
    assert.equal(analysis.coverage.inspectionRequested, false); assert.equal(analysis.coverage.images.inspectedFiles, 0);
    const html = render(analysis, a.target); assert.match(html, /PNG dosyaları istek üzerine incelenmedi/);
    assert.match(html, /Motorun desteklemediği kontroller/); assert.match(html, /sensörün kayıp kare sayısı değildir/);
    assert.doesNotMatch(html, /100%|Veri tamamen sağlıklı/);
  } finally { controller.dispose(); await a.session.close(); }
});

test('ARTIFICIAL quality findings: missing/corrupt PNGs preserve Efe codes, file and selected API/source identities', async () => {
  for (const kind of ['missing', 'corrupt', 'missing-other-stream'] as const) {
    const input = fixture(), files = input.files as Map<string, Blob>, path = `${root}/${kind === 'missing-other-stream' ? 'depth' : 'rgb'}/2.png`;
    // Open with valid input; the analyzer also handles subsequent file-access problems.
    const a = await active(input);
    if (kind !== 'corrupt') files.delete(path); else files.set(path, new Blob(['ARTIFICIAL CORRUPT PNG']));
    try {
      const analysis = await result(input, 'rgb', true); const html = render(analysis, a.target);
      assert.ok(analysis.report.issues.some(issue => issue.code === (kind !== 'corrupt' ? 'MISSING_FILE' : 'PNG_DECODE_FAILED')));
      assert.ok(html.includes(path)); assert.match(html, /Hata/); assert.match(html, /Kural:/);
      if (kind === 'missing-other-stream') {
        assert.equal(analysis.coverage.images.missingFiles, 0);
        assert.match(html, /Seçili PNG kapsamındaki eksik dosya<\/dt><dd>0/);
        assert.match(html, /manifestin diğer eksik girdileri bulgularda ayrıca yer alır/);
        assert.doesNotMatch(html, /Seçili kapsamın API pozisyonu/);
      } else {
        assert.match(html, /Özgün kaynak indeksi<\/dt><dd>2/); assert.match(html, /Seçili kapsamın API pozisyonu<\/dt><dd>1/);
      }
      assert.doesNotMatch(html, /Kareye git/);
    } finally { await a.session.close(); }
  }
});

test('ARTIFICIAL timestamp findings: duplicates, zero and negative intervals keep full TXT provenance without inventing an API mapping', async () => {
  const input = fixture(true), a = await active(input);
  try {
    const analysis = await result(input); const html = render(analysis, a.target);
    for (const code of ['DUPLICATE_TIMESTAMP', 'ZERO_INTERVAL', 'NEGATIVE_INTERVAL']) assert.ok(analysis.report.issues.some(issue => issue.code === code));
    const duplicate = analysis.details.find(detail => analysis.report.issues[detail.issueIndex].code === 'DUPLICATE_TIMESTAMP' && detail.stream === 'rgb')!;
    assert.equal(duplicate.sourceIndex, 1); assert.equal(duplicate.apiIndex, undefined);
    const negative = analysis.details.find(detail => analysis.report.issues[detail.issueIndex].code === 'NEGATIVE_INTERVAL' && detail.stream === 'rgb')!;
    assert.equal(negative.sourceIndex, 2); assert.equal(negative.apiIndex, 1);
    assert.match(html, /DUPLICATE_TIMESTAMP|ZERO_INTERVAL|NEGATIVE_INTERVAL/);
    assert.match(html, /İlgili önceki kaynak/); assert.match(html, /0.5000/);
    assert.match(html, /kayıp sensör karesi veya senkronizasyon kanıtı değildir/);
  } finally { await a.session.close(); }
});

test('ARTIFICIAL bad TXT: parser errors remain source errors, unavailable series is not replaced by a synthetic graph', async () => {
  const input = fixture(), a = await active(input);
  (input.files as Map<string, Blob>).set(`${root}/rgb.txt`, new Blob(['NOT A TIMESTAMP rgb/0.png\n']));
  try {
    const analysis = await result(input); assert.ok(analysis.report.issues.some(issue => issue.code === 'TXT_ROW_INVALID'));
    const html = render(analysis, a.target); assert.match(html, /Grafik için veri yetersiz \/ desteklenmiyor/);
    assert.doesNotMatch(html, /<svg/); assert.match(html, /NOT A TIMESTAMP/);
  } finally { await a.session.close(); }
});

test('ARTIFICIAL real engine cancellation: AbortSignal returns acknowledged partial coverage and handles a late Blob failure', async () => {
  const started = deferred<void>(), blocked = deferred<ArrayBuffer>();
  class DelayedBlob extends Blob { override arrayBuffer() { started.resolve(); return blocked.promise; } }
  const input = fixture(); (input.files as Map<string, Blob>).set(`${root}/groundtruth.txt`, new DelayedBlob(['YAPAY blocked']));
  const a = await active(input), controller = new QualityAnalysisController(a.target, noop);
  try {
    const running = controller.start(true); await started.promise; assert.equal(controller.getSnapshot().status, 'running');
    controller.cancel(); assert.equal(controller.getSnapshot().status, 'cancelled'); await running;
    const state = controller.getSnapshot(); assert.ok(state.analysis?.coverage.cancelled); assert.equal(state.analysis.coverage.completed, false);
    const html = render(state.analysis, a.target, state); assert.match(html, /Motor iptal bildirimi<\/dt><dd>Evet/);
    assert.match(html, /ANALYSIS_CANCELLED/); assert.match(html, /Kısmi\/iptal edilmiş analiz çıktısı/);
    blocked.reject(new Error('LATE ARTIFICIAL BLOB FAILURE')); await Promise.resolve();
  } finally { controller.dispose(); await a.session.close(); }
});

test('MOCK job: running state rejects parallel start; engine exception is caught and retry clears the old error', async () => {
  const a = await active(), done = deferred<TumQualityAnalysis>(); let calls = 0;
  const analysis = await result(a.target.input);
  const controller = new QualityAnalysisController(a.target, noop, () => { calls++; return calls === 1 ? done.promise : Promise.resolve(analysis); });
  try {
    const first = controller.start(false); await controller.start(true); assert.equal(calls, 1);
    assert.match(render(null, a.target, controller.getSnapshot()), /Analiz çalışıyor/);
    done.reject(new Error('ARTIFICIAL ANALYSIS FAILURE')); await first;
    assert.equal(controller.getSnapshot().status, 'error'); assert.match(render(null, a.target, controller.getSnapshot()), /ARTIFICIAL ANALYSIS FAILURE/);
    await controller.start(false); assert.equal(controller.getSnapshot().status, 'completed'); assert.equal(controller.getSnapshot().error, null);
    assert.equal(controller.getSnapshot().analysis, analysis);
  } finally { controller.dispose(); await a.session.close(); }
});

test('MOCK job: cancel/restart supersedes late old success/rejection without replacing the new result', async () => {
  for (const lateError of [false, true]) {
    const a = await active(), old = deferred<TumQualityAnalysis>(), analysis = await result(a.target.input); let calls = 0; let oldSignal: AbortSignal | undefined;
    const controller = new QualityAnalysisController(a.target, noop, (_input, options) => { calls++; if (calls === 1) { oldSignal = options.signal; return old.promise; } return Promise.resolve(analysis); });
    try {
      const pending = controller.start(false); controller.cancel(); assert.ok(oldSignal?.aborted);
      assert.equal(controller.getSnapshot().analysis, null); await controller.start(false);
      const current = controller.getSnapshot();
      if (lateError) old.reject(new Error('OLD MOCK ERROR')); else old.resolve(analysis);
      await pending; assert.equal(controller.getSnapshot(), current); assert.equal(current.runId, 2);
    } finally { controller.dispose(); await a.session.close(); }
  }
});

test('MOCK job: cancellation ignores a late completed result when an analyzer fails to acknowledge AbortSignal', async () => {
  const a = await active(), done = deferred<TumQualityAnalysis>(); const controller = new QualityAnalysisController(a.target, noop, () => done.promise);
  try {
    const pending = controller.start(false); controller.cancel(); done.resolve(await result(a.target.input)); await pending;
    assert.equal(controller.getSnapshot().status, 'cancelled'); assert.equal(controller.getSnapshot().analysis, null);
  } finally { controller.dispose(); await a.session.close(); }
});

test('MOCK sessions: RGB ↔ Depth, close, new input, synthetic switch and unmount invalidate old success/error and abort work', async () => {
  for (const transition of ['rgb-depth', 'depth-rgb', 'close', 'new-input', 'synthetic', 'unmount', 'StrictMode cleanup/setup']) {
    const oldStream = transition === 'depth-rgb' ? 'depth' : 'rgb';
    const nextStream = transition === 'rgb-depth' ? 'depth' : transition === 'depth-rgb' ? 'rgb' : oldStream;
    const a = await active(fixture(), oldStream), next = await active(fixture(), nextStream), done = deferred<TumQualityAnalysis>();
    const oldStates: QualityAnalysisState[] = []; let signal: AbortSignal | undefined;
    const old = new QualityAnalysisController(a.target, state => oldStates.push(state), (_input, options) => { signal = options.signal; return done.promise; });
    const fresh = new QualityAnalysisController(next.target, noop);
    try {
      const pending = old.start(false); old.dispose(); old.dispose(); assert.ok(signal?.aborted);
      await fresh.start(false); const current = fresh.getSnapshot();
      if (transition === 'new-input' || transition === 'unmount') done.reject(new Error('OLD SESSION FAILURE')); else done.resolve(await result(a.target.input, oldStream));
      await pending; assert.equal(oldStates.length, 1, transition); assert.equal(fresh.getSnapshot(), current);
      assert.equal(current.analysis?.coverage.streams[0], nextStream); assert.notEqual(a.target.owner, next.target.owner);
      assert.notEqual(a.target.input, next.target.input);
      if (transition === 'synthetic') {
        const html = renderToStaticMarkup(createElement(QualityPanel, { report: null, qualityState: current,
          qualityRecording: exampleBinding.input.manifest.recording, qualityStream: oldStream, qualityMode: 'manifest-subset', onAnalyze: noop }));
        assert.doesNotMatch(html, /Kapsam Özeti|<svg/);
      }
      assert.equal(old.getSnapshot().analysis, null);
    } finally { old.dispose(); fresh.dispose(); await a.session.close(); await next.session.close(); }
  }
});

test('MOCK result identity: wrong recording, stream, mode or requested inspection never enters the current panel', async () => {
  const a = await active();
  try {
    for (const mismatch of ['recording', 'stream', 'mode', 'inspection']) {
      const analysis = await result(a.target.input);
      if (mismatch === 'recording') analysis.report.recordingId = 'OLD RECORD';
      if (mismatch === 'stream') analysis.coverage.streams = ['depth'];
      if (mismatch === 'mode') analysis.coverage.selectionMode = 'full-recording';
      if (mismatch === 'inspection') analysis.coverage.inspectionRequested = true;
      const controller = new QualityAnalysisController(a.target, noop, async () => analysis);
      await controller.start(false); assert.equal(controller.getSnapshot().status, 'error'); assert.equal(controller.getSnapshot().analysis, null); controller.dispose();
    }
    const old = await result(a.target.input); old.report.recordingId = 'OLD RECORD';
    assert.doesNotMatch(render(old, a.target), /Kapsam Özeti|<svg/);
  } finally { await a.session.close(); }
});

test('MOCK partial/idle presentation: no premature completion or zero-error claim, raw coverage/limitations survive', async () => {
  const a = await active();
  try {
    const analysis = await result(a.target.input); analysis.coverage.completed = false; analysis.limitations.push('MOCK PARTIAL LIMITATION');
    const controller = new QualityAnalysisController(a.target, noop, async () => analysis); await controller.start(false);
    assert.equal(controller.getSnapshot().status, 'partial'); assert.equal(controller.getSnapshot().analysis, analysis);
    const html = render(analysis, a.target, controller.getSnapshot());
    assert.match(html, /Analiz kısmi/); assert.match(html, /Bu kısmi\/iptal edilmiş çıktıda henüz bulgu yok/); assert.match(html, /MOCK PARTIAL LIMITATION/);
    assert.doesNotMatch(render(analysis, a.target, { status: 'idle' }), /Kapsam Özeti|<svg/);
    controller.dispose();
  } finally { await a.session.close(); }
});

test('ARTIFICIAL graph: actual Efe intervals keep input pairs, exact decimal, unknown unit and original source order', async () => {
  const analysis = await result(fixture(true)); const before = JSON.stringify(analysis);
  const data = qualityIntervalPage(analysis, 'rgb', 0)!; assert.equal(data.total, 4);
  assert.deepEqual(data.points.map(point => point.interval.value), [0, -.5, 3.5, 1]);
  assert.ok(data.points.every(point => point.problem === null));
  const html = renderToStaticMarkup(createElement(QualityIntervals, { analysis, stream: 'rgb' }));
  assert.match(html, /Kaynak damga farkı · birim bilinmiyor/); assert.match(html, /<caption>/); assert.match(html, /0.5000/);
  assert.match(html, /Kaynak 1 · satır 3/); assert.match(html, /Kaynak 2 · satır 4/);
  assert.doesNotMatch(html, /Dikey eksen: Saniye/); assert.equal(JSON.stringify(analysis), before);
});

test('MOCK graph: missing/nonfinite values and wrong unit/source scope are not drawn; gaps never connect', async () => {
  for (const invalid of [null, NaN, Infinity, -Infinity, 'unit', 'source'] as const) {
    const analysis = await result(); const table = analysis.coverage.sourceTables.find(table => table.kind === 'rgb')!.metadata!;
    const interval = table.derived.intervals[1];
    if (invalid === 'unit') interval.unit = 'seconds'; else if (invalid === 'source') interval.inputs = interval.inputs.map((input, i) => i === 0 ? { ...input, file: 'WRONG FILE' } : input); else interval.value = invalid;
    const html = renderToStaticMarkup(createElement(QualityIntervals, { analysis, stream: 'rgb' }));
    assert.equal((html.match(/<circle/g) ?? []).length, 3);
    assert.equal((html.match(/class="recording-chart-line"/g) ?? []).length, 1);
    assert.match(html, /×/); assert.doesNotMatch(html, /(?:cx|cy|x1|y1|x2|y2)="(?:NaN|Infinity|-Infinity)"/);
    assert.ok(qualityIntervalPage(analysis, 'rgb', 0)!.points[1].problem);
  }
});

test('MOCK graph: no valid table/series/value has an explicit unsupported/empty state; known units require supplied evidence', async () => {
  const analysis = await result(); const table = analysis.coverage.sourceTables.find(table => table.kind === 'rgb')!;
  table.metadata!.original.timestamp.unit = 'seconds'; table.metadata!.derived.intervals.forEach(interval => { interval.unit = 'seconds'; });
  assert.match(renderToStaticMarkup(createElement(QualityIntervals, { analysis, stream: 'rgb' })), /Saniye · belgelenmiş kaynak birimi/);
  table.metadata!.derived.intervals.forEach(interval => { interval.value = null; });
  const unavailable = renderToStaticMarkup(createElement(QualityIntervals, { analysis, stream: 'rgb' }));
  assert.match(unavailable, /çizilebilir sayısal değer yok/); assert.doesNotMatch(unavailable, /<svg/);
  table.metadata!.derived.intervals = [];
  assert.match(renderToStaticMarkup(createElement(QualityIntervals, { analysis, stream: 'rgb' })), /Grafik için veri yetersiz/);
  table.valid = false; assert.equal(qualityIntervalPage(analysis, 'rgb', 0), null);
});

test('MOCK large results: bounded issue pages retain original detail indices, severity filter counts and escaped source text', async () => {
  const a = await active(); const analysis = await result(a.target.input);
  analysis.report.issues = Array.from({ length: 205 }, (_, i) => ({ code: 'MOCK_BULK', severity: i % 3 === 0 ? 'error' : i % 3 === 1 ? 'warning' : 'info',
    recordingId: a.target.recording.id, message: `<script>MOCK-${i}</script>`, rule: 'MOCK rule' }));
  analysis.details = analysis.report.issues.map((_, issueIndex) => ({ issueIndex, file: `MOCK/${issueIndex}.txt`, sourceIndex: issueIndex }));
  try {
    const snapshot = JSON.stringify(analysis); const page = qualityIssuePage(analysis.report, 'warning', 1);
    assert.equal(page.total, 205); assert.equal(page.filtered, 68); assert.equal(page.rows.length, 20);
    assert.ok(page.rows.every(row => analysis.report.issues[row.issueIndex] === row.issue && row.issue.severity === 'warning'));
    assert.equal(qualityIssuePage(analysis.report, 'all', 999).page, 10);
    const html = render(analysis, a.target); assert.match(html, /Toplam 205 bulgu · filtrede 205 · bu sayfada 20/);
    assert.equal((html.match(/&lt;script&gt;MOCK-/g) ?? []).length, 20); assert.doesNotMatch(html, /<script>/);
    assert.match(html, /Önem filtresi/); assert.match(html, /Bulgu sayfaları/); assert.equal(JSON.stringify(analysis), snapshot);
  } finally { await a.session.close(); }
});

test('MOCK long series: chart/table use bounded 40-interval windows without changing the analysis', async () => {
  const analysis = await result(); const table = analysis.coverage.sourceTables.find(table => table.kind === 'rgb')!.metadata!;
  table.derived.intervals = Array.from({ length: 205 }, () => table.derived.intervals[0]);
  const last = qualityIntervalPage(analysis, 'rgb', 5)!; assert.equal(last.points.length, 5); assert.equal(last.pages, 6);
  const html = renderToStaticMarkup(createElement(QualityIntervals, { analysis, stream: 'rgb' }));
  assert.equal((html.match(/<circle/g) ?? []).length, 40); assert.match(html, /toplam 205 aralık/);
});

test('REAL TUM quality UI: active RGB/Depth analysis, selected PNG coverage and interval provenance when originals exist', async context => {
  const manifest = JSON.parse(await readFile(new URL('../data/manifests/tum-rgbd-freiburg1-desk.json', import.meta.url), 'utf8')) as DatasetManifest;
  const files = new Map<string, Blob>();
  for (const path of manifest.acquisition.files) {
    try { files.set(path, new Blob([new Uint8Array(await readFile(new URL(`../data/local/tum-rgbd-freiburg1-desk/${path}`, import.meta.url)))])); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; context.skip(`Original TUM file absent: ${path}; real quality UI verification not completed.`); return; }
  }
  for (const stream of ['rgb', 'depth'] as const) {
    const a = await active({ manifest, files }, stream), controller = new QualityAnalysisController(a.target, noop);
    try {
      await controller.start(true); const state = controller.getSnapshot(), analysis = state.analysis!;
      assert.equal(state.status, 'completed'); assert.equal(analysis.coverage.cancelled, false); assert.equal(analysis.report.scope, 'metadata-only');
      assert.equal(analysis.coverage.images.expectedFiles, 3); assert.equal(analysis.coverage.images.inspectedFiles, 3);
      assert.equal(analysis.coverage.sourceTables.length, 4); assert.deepEqual(analysis.coverage.streams, [stream]);
      const html = render(analysis, a.target, state); assert.ok(html.includes(manifest.recording.id));
      const data = qualityIntervalPage(analysis, stream, 0)!; assert.ok(data.points.length);
      assert.ok(data.points.every(point => point.interval.inputs.every(input => input.file === data.table.original.file)));
      assert.match(html, /birim bilinmiyor/);
    } finally { controller.dispose(); await a.session.close(); }
  }
});
