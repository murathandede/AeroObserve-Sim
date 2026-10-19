import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DatasetManifest, RecordingInput } from '../src/shared/types';
import type { TumStream } from '../src/data';
import { prepareTumJsonDownload, type TumJsonDownload } from '../src/quality';
import { loadTumLocalInput } from '../src/data/examples/tum-local';
import { createTumRecordingBinding } from '../src/app/recordingBinding';
import { ReaderSession } from '../src/playback/readerSession';
import { activeQualityTarget, QualityAnalysisController } from '../src/ui/recording/qualityController';
import { completedReportContext, ReportDownloadLease, reportFilename, triggerJsonDownload, type ReportSelection } from '../src/ui/recording/reportDownload';
import { ReportPanel } from '../src/ui/recording/ReportPanel';
import { SourcePanel, safeExternalUrl } from '../src/ui/recording/SourcePanel';

const manifest = JSON.parse(await readFile(new URL('../data/manifests/tum-rgbd-freiburg1-desk.json', import.meta.url), 'utf8')) as DatasetManifest;
const noop = () => {};
// ARTIFICIAL TXT and opaque placeholder Blobs. These are never decoded or labelled original TUM pixels.
function artificialInput(): RecordingInput {
  const fixture = structuredClone(manifest);
  fixture.recording.id = 'ARTIFICIAL-REPORT'; fixture.recording.name = 'YAPAY RAPOR TESTİ';
  const root = 'ARTIFICIAL-REPORT';
  const files = new Map<string, Blob>();
  for (const stream of ['rgb', 'depth']) {
    files.set(`${root}/${stream}.txt`, new Blob([`1.000000 ${stream}/0.png\n2.000000 ${stream}/1.png\n3.000000 ${stream}/2.png\n`]));
    for (let i = 0; i < 3; i++) files.set(`${root}/${stream}/${i}.png`, new Blob(['ARTIFICIAL undecoded placeholder']));
  }
  files.set(`${root}/groundtruth.txt`, new Blob(['1 0 0 0 0 0 0 1\n2 0 0 0 0 0 0 1\n']));
  files.set(`${root}/accelerometer.txt`, new Blob(['1 0 0 1\n2 0 0 1\n']));
  fixture.acquisition.files = [...files.keys()]; return { manifest: fixture, files };
}

async function completed(input = artificialInput(), stream: TumStream = 'rgb', inspectImages = false) {
  const binding = createTumRecordingBinding(input, stream), session = new ReaderSession(binding);
  const metadata = await session.open(), source = session.getSourceInfo(); assert.ok(metadata?.ok); assert.ok(source?.ok);
  const target = activeQualityTarget({}, binding, true, metadata.value, source.value, stream); assert.ok(target);
  const controller = new QualityAnalysisController(target, noop);
  await controller.start(inspectImages);
  const p: ReportSelection = { opened: true, qualityTarget: target, qualityState: controller.getSnapshot(), metadata: metadata.value,
    sourceInfo: source.value, activeStream: stream };
  assert.equal(p.qualityState?.status, 'completed');
  const context = completedReportContext(p); assert.ok(context);
  return { p, context, controller, session };
}

for (const stream of ['rgb', 'depth'] as const) {
  test(`ARTIFICIAL report UI: completed ${stream} analysis produces Efe UTF-8 JSON without re-analysis`, async () => {
    const a = await completed(artificialInput(), stream), lease = new ReportDownloadLease();
    try {
      const before = a.controller.getSnapshot(); let triggered: TumJsonDownload | null = null;
      const result = lease.download(a.context, () => true, resource => { triggered = resource; }); assert.ok(result.ok);
      assert.equal(triggered, result.value); assert.equal(a.controller.getSnapshot(), before);
      assert.equal(result.value.filename, `ARTIFICIAL-REPORT-${stream}-quality.json`);
      assert.equal(result.value.blob.type, 'application/json;charset=utf-8');
      const text = await result.value.blob.text(), report = JSON.parse(text);
      assert.equal(report.schema, 'aeroobserve.efe-recording-report'); assert.equal(report.schemaVersion, 1);
      assert.equal(report.provenance, 'real'); assert.equal(report.recordingId, 'ARTIFICIAL-REPORT');
      assert.equal(report.reader.id, `tum-rgbd-${stream}`); assert.equal(report.selectedSource.stream, stream);
      assert.deepEqual(report.analysis.report, before.analysis!.report); assert.deepEqual(report.analysis.limitations, before.analysis!.limitations);
      assert.equal(report.scope, 'metadata-only'); assert.equal(report.analysis.coverage.completed, true);
      assert.deepEqual(report.analysis.coverage.streams, [stream]); assert.equal(report.analysis.coverage.cancelled, false);
      assert.equal(report.analysis.coverage.images.inspectedFiles, 0); assert.ok(report.unsupported.length);
      assert.equal(report.originalMetadata.manifest.citation, inputCitation(a));
      assert.doesNotMatch(text, /blob:|downloadedAt|generatedAt/);
      assert.equal(await (await fetch(result.value.url)).text(), text);
      const html = renderToStaticMarkup(createElement(ReportPanel, a.p));
      assert.match(html, /<button type="button" aria-describedby="[^"]+">JSON raporu indir/);
      assert.doesNotMatch(html, /disabled=""/); assert.match(html, /Metadata-only/);
    } finally { lease.clear(); a.controller.dispose(); await a.session.close(); }
  });
}
function inputCitation(a: Awaited<ReturnType<typeof completed>>) { return a.context.target.input.manifest.citation; }

test('report eligibility: no job, running/error/cancelled/partial and closed/prepared/synthetic/mismatched sessions stay disabled', async () => {
  const a = await completed();
  try {
    const state = a.p.qualityState!;
    const cases: Partial<ReportSelection>[] = [{ opened: false }, { qualityTarget: null }, { metadata: null }, { sourceInfo: null },
      { qualityState: null }, { activeStream: 'depth' },
      ...(['idle','running','error','cancelled','partial'] as const).map(status => ({ qualityState: { ...state, status } })),
      { qualityState: { ...state, analysis: { ...state.analysis!, coverage: { ...state.analysis!.coverage, cancelled: true } } } },
      { qualityState: { ...state, analysis: { ...state.analysis!, coverage: { ...state.analysis!.coverage, completed: false } } } },
      { qualityState: { ...state, analysis: { ...state.analysis!, report: { ...state.analysis!.report, recordingId: 'OTHER' } } } },
      { qualityTarget: { ...a.context.target, recording: { ...a.context.target.recording, provenance: 'synthetic' } } },
      { sourceInfo: { ...a.context.source, stream: 'depth' } },
      { metadata: { ...a.context.metadata, reader: { id: 'synthetic-svg', version: 'test' } } }];
    for (const change of cases) {
      const p = { ...a.p, ...change }; assert.equal(completedReportContext(p), null);
      const html = renderToStaticMarkup(createElement(ReportPanel, p));
      assert.match(html, /<button[^>]*disabled=""/); assert.doesNotMatch(html, /href=|download=/);
    }
  } finally { a.controller.dispose(); await a.session.close(); }
});

test('report ownership: stale clicks and changed owner during preparation never trigger a download', async () => {
  const a = await completed(); let live = true, clicks = 0, url = '';
  const lease = new ReportDownloadLease((report, name) => {
    const result = prepareTumJsonDownload(report, name); if (result.ok) url = result.value.url;
    live = false; return result;
  });
  try {
    assert.equal(lease.download(a.context, () => false, () => clicks++).ok, false);
    assert.equal(lease.download(a.context, () => live, () => clicks++).ok, false);
    assert.equal(clicks, 0); assert.ok(url); await assert.rejects(fetch(url));
  } finally { lease.clear(); a.controller.dispose(); await a.session.close(); }
});

test('REAL TUM download resources: repeated actions release old URLs, cleanup is idempotent, reader URLs stay owned by reader', async context => {
  let input: RecordingInput;
  try { input = await loadTumLocalInput(); }
  catch (error) {
    if ((error as Error & { cause?: NodeJS.ErrnoException }).cause?.code !== 'ENOENT') throw error;
    context.skip('Original TUM files absent; real download/reader ownership verification not completed.'); return;
  }
  const a = await completed(input), lease = new ReportDownloadLease();
  const frame = await a.session.getFrame(0); assert.ok(frame?.ok);
  try {
    const first = lease.download(a.context, () => true, noop), second = lease.download(a.context, () => true, noop);
    assert.ok(first.ok && second.ok); assert.notEqual(first.value.url, second.value.url);
    await assert.rejects(fetch(first.value.url)); assert.equal((await fetch(second.value.url)).status, 200);
    lease.clear(); lease.clear(); await assert.rejects(fetch(second.value.url));
    assert.equal((await fetch(frame.value.frame.image.url)).status, 200);
  } finally { lease.clear(); a.controller.dispose(); await a.session.close(); }
  await assert.rejects(fetch(frame.value.frame.image.url));
});

test('download errors: helper failure, report rejection and DOM failure retain no stale successful URL', async () => {
  const a = await completed(); let resource: TumJsonDownload | null = null;
  const lease = new ReportDownloadLease((report, name) => {
    const result = prepareTumJsonDownload(report, name); if (result.ok) resource = result.value; return result;
  });
  try {
    const failed = lease.download(a.context, () => true, () => { throw new Error('MOCK DOM download failure'); });
    assert.ok(!failed.ok); assert.equal(failed.error.code, 'DOWNLOAD_UNAVAILABLE');
    assert.ok(resource); await assert.rejects(fetch((resource as TumJsonDownload).url));
    const invalid = lease.download({ ...a.context, source: { ...a.context.source, frameCount: 99 } }, () => true, noop);
    assert.ok(!invalid.ok); assert.equal(invalid.error.code, 'INVALID_REPORT');
    const unavailable = new ReportDownloadLease(() => ({ ok: false, error: { code: 'DOWNLOAD_UNAVAILABLE', message: 'MOCK URL unsupported', recovery: 'MOCK recovery' } }));
    const error = unavailable.download(a.context, () => true, () => assert.fail('must not click'));
    assert.ok(!error.ok); assert.equal(error.error.message, 'MOCK URL unsupported'); unavailable.clear();
  } finally { lease.clear(); a.controller.dispose(); await a.session.close(); }
});

test('native DOM download adapter: href/filename click then anchor removal, including a throwing click (MOCK document)', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const calls: string[] = []; let throws = false;
  const anchor = { href: '', download: '', hidden: false, click() { calls.push('click'); if (throws) throw new Error('MOCK click'); }, remove() { calls.push('remove'); } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: (tag: string) => { assert.equal(tag, 'a'); return anchor; }, body: { append: (item: unknown) => { assert.equal(item, anchor); calls.push('append'); } } } });
  try {
    const resource = { url: 'blob:MOCK-DOM', filename: 'MOCK-rgb-quality.json', blob: new Blob(), dispose: noop };
    triggerJsonDownload(resource); assert.equal(anchor.href, resource.url); assert.equal(anchor.download, resource.filename);
    assert.deepEqual(calls, ['append','click','remove']); calls.length = 0; throws = true;
    assert.throws(() => triggerJsonDownload(resource)); assert.deepEqual(calls, ['append','click','remove']);
  } finally { if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document'); }
});

test('report filenames: hostile IDs become bounded, path-free Windows-safe names with independent streams', () => {
  for (const id of ['../CON/\\:*?"<>|\u0000', '', 'ü'.repeat(300), 'normal_id-1']) {
    const name = reportFilename(id, 'depth'); assert.match(name, /^[A-Za-z0-9_-]+-depth-quality\.json$/);
    assert.ok(name.length < 130); assert.notEqual(name, reportFilename(id, 'rgb'));
  }
});

test('manifest sources: official URL, license links, citation and access date are provided without invented publisher', () => {
  const html = renderToStaticMarkup(createElement(SourcePanel, { recording: manifest.recording, manifest }));
  assert.ok(html.includes(manifest.recording.source.url!)); assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/); assert.match(html, /creativecommons.org\/licenses\/by\/4.0\/legalcode/);
  assert.match(html, /CC BY 4.0/); assert.match(html, /Sturm/); assert.match(html, /IROS, 2012/);
  assert.ok(html.includes(manifest.versionOrAccessDate!)); assert.match(html, /Kaynak tanımında sağlanmamış/);
  assert.match(html, /tam sensör kaydı değildir/); assert.match(html, /doğrudan sensör ölçümü değildir/);
});

test('source safety: unknown license, mismatched manifest, long text and malicious external URL stay safe', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'file:///C:/test', '//example.org', 'https://user:pass@example.org']) assert.equal(safeExternalUrl(url), null);
  const record = { ...manifest.recording, id: 'OTHER', source: { title: '<script>LONG</script>' + 'x'.repeat(4000), url: 'javascript:alert(1)' }, license: { status: 'unknown' as const } };
  const html = renderToStaticMarkup(createElement(SourcePanel, { recording: record, manifest }));
  assert.match(html, /Lisansın bilinmemesi kullanım izni anlamına gelmez/); assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /href=|<script>|Sturm|CC BY 4.0/); assert.match(html, /Bu kaynak için sağlanmamış/);
});

for (const stream of ['rgb', 'depth'] as const) {
  test(`REAL TUM report UI: active ${stream} analysis exports three inspected originals with source/coverage/limitations`, async context => {
    let input: RecordingInput;
    try { input = await loadTumLocalInput(); }
    catch (error) {
      if ((error as Error & { cause?: NodeJS.ErrnoException }).cause?.code !== 'ENOENT') throw error;
      context.skip('Original TUM files absent; real JSON verification not completed.'); return;
    }
    const a = await completed(input, stream, true), lease = new ReportDownloadLease();
    try {
      const download = lease.download(a.context, () => true, noop); assert.ok(download.ok);
      const report = JSON.parse(await download.value.blob.text());
      assert.equal(report.recordingId, manifest.recording.id); assert.equal(report.reader.id, `tum-rgbd-${stream}`);
      assert.equal(report.scope, 'metadata-only'); assert.equal(report.analysis.coverage.images.validatedFiles, 3);
      assert.deepEqual(report.selectedSource.frames.map((frame: { sourceIndex: number }) => frame.sourceIndex), stream === 'rgb' ? [0,306,612] : [0,297,594]);
      assert.deepEqual(report.analysis.report, a.context.analysis.report); assert.equal(report.license.value, 'CC BY 4.0');
      assert.equal(report.originalMetadata.manifest.citation, manifest.citation); assert.ok(report.limitations.length);
      assert.equal(report.analysis.coverage.sourceTables.length, 4);
      const html = renderToStaticMarkup(createElement(SourcePanel, { recording: input.manifest.recording, manifest: input.manifest, sourceInfo: a.context.source }));
      assert.ok(html.includes(`${stream.toUpperCase()} · manifest alt kümesi · 3 erişilebilir görüntü`));
    } finally { lease.clear(); a.controller.dispose(); await a.session.close(); }
  });
}
