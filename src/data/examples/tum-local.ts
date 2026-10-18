/** Node-only real-file example. Not exported from browser entry points. No synthetic fallback. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TumRecordingReader } from '../index';
import { analyzeTumRecording, createTumReport, serializeTumReport } from '../../quality';
import type { DatasetManifest, RecordingInput, ReaderResult } from '../../shared/types';
import type { TumReportResult } from '../../quality';
import { isSafeRelativePath } from '../tum/text';

function unwrap<T>(result: ReaderResult<T> | TumReportResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message} ${result.error.recovery}`);
  return result.value;
}

export async function loadTumLocalInput(sampleRoot?: string): Promise<RecordingInput> {
  const manifestUrl = new URL('../../../data/manifests/tum-rgbd-freiburg1-desk.json', import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8')) as DatasetManifest;
  const root = sampleRoot ? resolve(sampleRoot) : fileURLToPath(new URL('../../../data/local/tum-rgbd-freiburg1-desk/', import.meta.url));
  const files = new Map<string, Blob>();
  for (const relative of manifest.acquisition.files) {
    if (!isSafeRelativePath(relative)) throw new Error('Manifestte güvenli olmayan göreli dosya yolu var; yerel dosya okunmadı.');
    try {
      const bytes = await readFile(resolve(root, relative));
      files.set(relative, new Blob([new Uint8Array(bytes)], { type: relative.endsWith('.png') ? 'image/png' : 'text/plain' }));
    } catch (error) {
      throw new Error(`Gerçek TUM dosyası okunamadı: ${relative}. Beklenen kök: ${root}. docs/datasets.md resmî edinme adımlarını uygulayın; gerçek veri örneği tamamlanmadı.`, { cause: error });
    }
  }
  return { manifest, files };
}

export async function runTumLocalExample(sampleRoot?: string, outputFile?: string) {
  const input = await loadTumLocalInput(sampleRoot);
  const reader = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  try {
    unwrap(await reader.open(input));
    const metadata = unwrap(reader.getMetadata());
    for (let index = 0; index < metadata.frameCount; index++) unwrap(await reader.getFrame(index));
    const source = unwrap(reader.getSourceInfo());
    const frameMetadata = source.frames.map(frame => unwrap(reader.getFrameMetadata(frame.apiIndex)));
    const analysis = await analyzeTumRecording(input, { mode: 'manifest-subset', streams: ['rgb', 'depth'], inspectImages: true });
    const report = unwrap(createTumReport({ input, metadata, analysis, source, frameMetadata }));
    const json = unwrap(serializeTumReport(report));
    if (outputFile) {
      const output = resolve(outputFile);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, json, 'utf8');
    }
    return { report, json };
  } finally { await reader.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runTumLocalExample(process.argv[2], process.argv[3]).then(({ report, json }) => {
    console.log(JSON.stringify({ recordingId: report.recordingId, scope: report.scope, reader: report.reader,
      sourceTables: report.analysis.coverage.sourceTables, images: report.analysis.coverage.images,
      issues: report.analysis.report.issues, unsupported: report.unsupported,
      jsonBytes: new TextEncoder().encode(json).length, outputFile: process.argv[3] ?? null }, null, 2));
    if (!process.argv[3]) console.log(json);
  }).catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
