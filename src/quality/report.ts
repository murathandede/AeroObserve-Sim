import type { DatasetManifest, QualityReport, RecordingInput, RecordingMetadata } from '../shared/types';
import type { TumFrameMetadata, TumSourceInfo, TumTableMetadata, TumDerivedTime } from '../data';
import type { TumQualityAnalysis } from './tum';

export type TumReportResult<T> = { ok: true; value: T } | {
  ok: false;
  error: { code: 'INVALID_REPORT' | 'SERIALIZATION_FAILED' | 'DOWNLOAD_UNAVAILABLE'; message: string; recovery: string };
};

function error(code: 'INVALID_REPORT' | 'SERIALIZATION_FAILED' | 'DOWNLOAD_UNAVAILABLE', message: string): TumReportResult<never> {
  const recovery = code === 'SERIALIZATION_FAILED'
    ? 'Döngüsel referansları, okunamayan getter alanlarını veya aşırı iç içe nesneleri kaldırıp yeniden serileştirin.'
    : code === 'DOWNLOAD_UNAVAILABLE'
      ? 'Blob URL desteği olan bir tarayıcı kullanın; JSON metnini serializeTumReport ile ayrıca alabilirsiniz.'
      : 'Aynı kayda ait manifest, okuyucu metadata ve kalite sonucunu sağlayın; rapor hazırlandıktan sonra JSON sonucunu kontrol edin.';
  return { ok: false, error: { code, message, recovery } };
}

/** Aggregate input references are a complete source-table range, not a claim that every PNG exists. */
function compactDerived(value: TumDerivedTime) {
  return {
    value: value.value, exactDecimal: value.exactDecimal, unit: value.unit,
    method: value.method, scope: value.scope, limitations: value.limitations,
    sourceInputs: { count: value.inputs.length, first: value.inputs[0] ?? null, last: value.inputs.at(-1) ?? null },
  };
}
function originalTable(table: TumTableMetadata) {
  return {
    kind: table.original.kind, file: table.original.file, columns: table.original.columns,
    timestamp: table.original.timestamp,
    rowsIncluded: 'first-and-last-source-rows-only' as const,
    firstRow: table.original.rows[0] ?? null, lastRow: table.original.rows.at(-1) ?? null,
  };
}
function summaryTable(table: TumTableMetadata) {
  const d = table.derived;
  return {
    file: table.original.file, kind: table.original.kind, scope: d.scope,
    observedCount: { value: d.observedCount.value, unit: d.observedCount.unit, method: d.observedCount.method, scope: d.observedCount.scope, sourceInputCount: d.observedCount.inputs.length },
    intervalCount: d.intervals.length,
    firstToLastDuration: compactDerived(d.firstToLastDuration),
    minimumInterval: compactDerived(d.minimumInterval), maximumInterval: compactDerived(d.maximumInterval),
    meanInterval: compactDerived(d.meanInterval), medianInterval: compactDerived(d.medianInterval),
    intervalExamples: { first: d.intervals[0] ? compactDerived(d.intervals[0]) : null, last: d.intervals.at(-1) ? compactDerived(d.intervals.at(-1)!) : null },
  };
}

export interface TumExportReport {
  schema: 'aeroobserve.efe-recording-report';
  schemaVersion: 1;
  recordingId: string;
  scope: QualityReport['scope'];
  reader: RecordingMetadata['reader'] | null;
  selectedReaderMetadata: RecordingMetadata | null;
  source: DatasetManifest['recording']['source'];
  license: DatasetManifest['recording']['license'];
  provenance: DatasetManifest['recording']['provenance'];
  analysis: Omit<TumQualityAnalysis, 'coverage'> & {
    coverage: Omit<TumQualityAnalysis['coverage'], 'sourceTables'> & {
      sourceTables: { kind: string; file: string | null; rowCount: number | null; valid: boolean }[];
    };
  };
  originalMetadata: {
    manifest: DatasetManifest;
    selectedFrames: readonly TumFrameMetadata[];
    sourceTables: ReturnType<typeof originalTable>[];
  };
  derivedSummaries: ReturnType<typeof summaryTable>[];
  selectedSource: TumSourceInfo | null;
  unsupported: readonly string[];
  limitations: readonly string[];
}
export interface TumReportOptions {
  input: RecordingInput;
  metadata: RecordingMetadata | null;
  analysis: TumQualityAnalysis;
  source?: TumSourceInfo;
  frameMetadata?: readonly TumFrameMetadata[];
}

function fullCoverageProblem(analysis: TumExportReport['analysis']): string | null {
  const c = analysis.coverage;
  const images = c.images;
  const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (![images.sourceReferences, images.expectedFiles, images.presentFiles, images.inspectedFiles,
    images.validatedFiles, images.missingFiles, images.notSelectedSourceReferences.rgb,
    images.notSelectedSourceReferences.depth, c.selectedSourceReferences.rgb,
    c.selectedSourceReferences.depth].every(count) ||
    !Array.isArray(images.missingFilePaths) || images.missingFilePaths.length !== images.missingFiles ||
    !images.missingFilePaths.every(file => typeof file === 'string' && file.length > 0) ||
    !Array.isArray(c.sourceTables) || c.sourceTables.some(table =>
      !(table.rowCount === null || count(table.rowCount)) || (table.valid && table.rowCount === null)) ||
    images.validatedFiles > images.inspectedFiles || images.inspectedFiles > images.presentFiles ||
    images.presentFiles + images.missingFiles > images.expectedFiles) {
    return 'Çekirdek kapsam sayaçları sonlu, negatif olmayan güvenli tam sayı olmalı ve inceleme zinciriyle uyuşmalı.';
  }
  if (analysis.report.scope !== 'full-recording') return null;
  if (c.selectionMode !== 'full-recording' || !c.inspectionRequested || !c.completed || c.cancelled ||
    c.sourceTables.length !== 4 || new Set(c.sourceTables.map(table => table.kind)).size !== 4 ||
    c.sourceTables.some(table => !table.valid) || images.sourceReferences <= 0 ||
    images.expectedFiles !== images.sourceReferences || images.presentFiles !== images.sourceReferences ||
    images.inspectedFiles !== images.sourceReferences ||
    images.validatedFiles !== images.sourceReferences || images.missingFiles !== 0 ||
    analysis.report.issues.some(issue => issue.severity === 'error')) {
    return 'full-recording iddiası gerçek dosya/tablo inceleme kapsamıyla uyuşmuyor.';
  }
  return null;
}

/** Checks capsule invariants again at serialization, after consumers may have mutated a snapshot. */
function capsuleProblem(report: TumExportReport): string | null {
  if (typeof report.recordingId !== 'string' || !report.recordingId || !['metadata-only', 'full-recording'].includes(report.scope) ||
    !['manifest-subset', 'full-recording'].includes(report.analysis.coverage.selectionMode) ||
    !Array.isArray(report.analysis.report.issues) || !Array.isArray(report.analysis.report.unsupported)) return 'Raporun zorunlu kimlik/kapsam alanları geçersiz.';
  if (report.scope !== report.analysis.report.scope || report.recordingId !== report.analysis.report.recordingId ||
    report.recordingId !== report.originalMetadata.manifest.recording.id ||
    (report.selectedReaderMetadata && report.selectedReaderMetadata.recording.id !== report.recordingId)) return 'Rapor kimlikleri veya kapsam alanları çelişiyor.';
  const coverageProblem = fullCoverageProblem(report.analysis);
  if (coverageProblem) return coverageProblem;
  const selected = report.selectedSource;
  const reader = report.selectedReaderMetadata;
  if (reader && (!Number.isInteger(reader.frameCount) || reader.frameCount < 0)) return 'Okuyucu kare sayısı sonlu ve sıfırdan büyük/eşit tam sayı olmalı.';
  const stream = reader?.reader.id === 'tum-rgbd-rgb' ? 'rgb' : reader?.reader.id === 'tum-rgbd-depth' ? 'depth' : null;
  if (selected) {
    if (!reader || !stream || selected.stream !== stream || selected.mode !== report.analysis.coverage.selectionMode ||
      !report.analysis.coverage.streams.includes(selected.stream) || selected.frameCount !== reader.frameCount ||
      selected.frames.length !== selected.frameCount || !report.originalMetadata.manifest.acquisition.files.includes(selected.listFile)) {
      return 'Seçili okuyucu, akış, kaynak listesi veya kare kapsamı farklı girdilere ait.';
    }
    if (selected.frames.some((frame, index) => frame.apiIndex !== index || !Number.isInteger(frame.sourceIndex) || frame.sourceIndex < 0 || !Number.isFinite(frame.timestampValue))) return 'Seçili kaynak indeksleri veya zaman değerleri geçersiz.';
  }
  for (const frame of report.originalMetadata.selectedFrames) {
    if (!stream || frame.original.stream !== stream || frame.derived.apiIndex.scope.stream !== stream ||
      frame.derived.apiIndex.scope.mode !== report.analysis.coverage.selectionMode) return 'Kare metadata seçili okuyucu akışı/kapsamıyla uyuşmuyor.';
    const table = report.analysis.coverage.sourceTables.find(table => table.kind === stream);
    const apiIndex = frame.derived.apiIndex;
    const original = frame.original;
    if (!reader || !table?.valid || table.file !== original.sourceListFile || table.rowCount === null ||
      !Number.isSafeInteger(apiIndex.value) || apiIndex.value < 0 || apiIndex.value >= reader.frameCount ||
      !Number.isSafeInteger(original.sourceIndex) || original.sourceIndex < 0 || original.sourceIndex >= table.rowCount ||
      !Number.isSafeInteger(original.lineNumber) || original.lineNumber < 1 ||
      apiIndex.inputs.file !== original.sourceListFile || apiIndex.inputs.lineNumber !== original.lineNumber ||
      apiIndex.inputs.sourceIndex !== original.sourceIndex ||
      (report.analysis.coverage.selectionMode === 'manifest-subset' && !report.originalMetadata.manifest.acquisition.files.includes(original.sourceFile))) {
      return 'Kare metadata kaynak tablosu, özgün satır veya türetilmiş API indeksiyle uyuşmuyor.';
    }
    if (selected) {
      const source = selected.frames[frame.derived.apiIndex.value];
      if (!source || frame.original.sourceListFile !== selected.listFile || frame.original.sourceFile !== source.file ||
        frame.original.sourceIndex !== source.sourceIndex || frame.original.lineNumber !== source.lineNumber ||
        frame.original.timestampRaw !== source.timestampRaw) return 'Kare metadata kaynak/API eşlemesiyle uyuşmuyor.';
    }
  }
  return null;
}

/** Versioned envelope: v1 QualityReport remains untouched at analysis.report. No Blob URLs or wall clock. */
export function createTumReport(options: TumReportOptions): TumReportResult<TumExportReport> {
  try {
    const { input, metadata, analysis } = options;
    const manifest = input.manifest;
    const id = manifest.recording.id;
    if (typeof id !== 'string' || !id || analysis.report.recordingId !== id ||
      (metadata !== null && metadata.recording.id !== id) ||
      !['metadata-only', 'full-recording'].includes(analysis.report.scope) ||
      !Array.isArray(analysis.report.issues) || !Array.isArray(analysis.report.unsupported) ||
      !Array.isArray(analysis.coverage.sourceTables)) {
      return error('INVALID_REPORT', 'Rapor girdileri geçersiz veya farklı kayıtlara ait.');
    }
    if (metadata && (!Number.isInteger(metadata.frameCount) || metadata.frameCount < 0)) return error('INVALID_REPORT', 'Seçili okuyucu kare sayısı geçersiz.');
    if (options.source && metadata && options.source.frameCount !== metadata.frameCount) return error('INVALID_REPORT', 'Seçili kaynak ve okuyucu kare sayıları uyuşmuyor.');
    if (options.source) {
      const source = options.source;
      const table = analysis.coverage.sourceTables.find(table => table.kind === source.stream);
      if (!table?.valid || !table.metadata || table.file !== source.listFile || table.rowCount !== source.sourceRowCount ||
        source.frameCount !== analysis.coverage.selectedSourceReferences[source.stream]) return error('INVALID_REPORT', 'Seçili kaynak listesi analiz edilen kaynak tablosuyla uyuşmuyor.');
      const root = source.listFile.slice(0, -`${source.stream}.txt`.length);
      for (const frame of source.frames) {
        const row = table.metadata.original.rows[frame.sourceIndex];
        if (!row || !('path' in row) || `${root}${row.path}` !== frame.file || row.lineNumber !== frame.lineNumber ||
          row.timestampRaw !== frame.timestampRaw || row.timestampValue !== frame.timestampValue) return error('INVALID_REPORT', 'Seçili kare analizin özgün TXT satırıyla uyuşmuyor.');
      }
    }
    // Frame provenance is useful without the optional selectedSource diagnostic.
    // Validate it against the complete analyzed table before that table is
    // compacted into first/last examples for export.
    const selectedRows = new Map<string, TumTableMetadata['original']['rows']>();
    for (const frame of options.frameMetadata ?? []) {
      const stream = frame.original.stream;
      const table = analysis.coverage.sourceTables.find(table => table.kind === stream);
      if (!table?.valid || !table.metadata || table.file !== frame.original.sourceListFile) return error('INVALID_REPORT', 'Kare metadata analiz edilen özgün kaynak tablosuna ait değil.');
      const root = table.file.slice(0, -`${stream}.txt`.length);
      let rows = selectedRows.get(stream);
      if (!rows) {
        const manifestPaths = new Set(manifest.acquisition.files);
        rows = table.metadata.original.rows.filter(row => 'path' in row &&
          (analysis.coverage.selectionMode === 'full-recording' || manifestPaths.has(`${root}${row.path}`)));
        selectedRows.set(stream, rows);
      }
      const row = rows[frame.derived.apiIndex.value];
      if (!row || !('path' in row) || row.sourceIndex !== frame.original.sourceIndex ||
        `${root}${row.path}` !== frame.original.sourceFile || row.lineNumber !== frame.original.lineNumber ||
        row.timestampRaw !== frame.original.timestampRaw || row.timestampValue !== frame.original.timestampValue) {
        return error('INVALID_REPORT', 'Kare metadata kaynak/API eşlemesi analiz edilen özgün TXT satırıyla uyuşmuyor.');
      }
    }
    const tables = analysis.coverage.sourceTables.flatMap(table => table.metadata ? [table.metadata] : []);
    const capsule: TumExportReport = {
      schema: 'aeroobserve.efe-recording-report', schemaVersion: 1,
      recordingId: id, scope: analysis.report.scope, reader: metadata?.reader ?? null,
      selectedReaderMetadata: metadata,
      source: manifest.recording.source, license: manifest.recording.license, provenance: manifest.recording.provenance,
      analysis: {
        ...analysis,
        coverage: { ...analysis.coverage, sourceTables: analysis.coverage.sourceTables.map(table => ({ kind: table.kind, file: table.file, rowCount: table.rowCount, valid: table.valid })) },
      },
      originalMetadata: { manifest, selectedFrames: options.frameMetadata ?? [], sourceTables: tables.map(originalTable) },
      derivedSummaries: tables.map(summaryTable), selectedSource: options.source ?? null,
      unsupported: [...analysis.report.unsupported],
      limitations: [...analysis.limitations, 'Özgün tabloların yalnız ilk/son satırları ve aralık örnekleri JSON içine alınır; istatistikler belirtilen tam kaynak tablo kapsamındadır. Ham TXT/PNG ve bütün piksel dizileri rapora gömülmez.'],
    };
    const problem = capsuleProblem(capsule);
    if (problem) return error('INVALID_REPORT', problem);
    // Copies sever mutable references, without copying any raw PNG/TXT Blob bytes.
    return { ok: true, value: structuredClone(capsule) };
  } catch {
    return error('INVALID_REPORT', 'Manifest, metadata veya kalite sonucu rapor kapsülüne dönüştürülemedi.');
  }
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
function stableJson(value: unknown, active = new WeakSet<object>(), depth = 0): Json {
  if (depth > 100) throw new Error('Report nesting too deep');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return null; // undefined/functions/symbols are explicit null, never invalid JSON.
  if (active.has(value)) throw new Error('Cyclic report');
  active.add(value);
  try {
    if (Array.isArray(value)) return Array.from(value, item => stableJson(item, active, depth + 1));
    const result: { [key: string]: Json } = Object.create(null);
    for (const key of Object.keys(value).sort()) result[key] = stableJson((value as Record<string, unknown>)[key], active, depth + 1);
    return result;
  } finally { active.delete(value); }
}

/** Deterministic keys, no current timestamp; nonfinite/undefined→null and bigint→exact decimal string. */
export function serializeTumReport(report: TumExportReport): TumReportResult<string> {
  try {
    if (!report || report.schema !== 'aeroobserve.efe-recording-report' || report.schemaVersion !== 1) return error('INVALID_REPORT', 'Desteklenen Efe rapor şeması/sürümü gerekli.');
    const problem = capsuleProblem(report);
    if (problem) return error('INVALID_REPORT', problem);
    return { ok: true, value: JSON.stringify(stableJson(report), null, 2) + '\n' };
  } catch {
    return error('SERIALIZATION_FAILED', 'Rapor JSON olarak yazılamadı; döngüsel veya okunamayan alan bulunuyor.');
  }
}

export interface TumJsonDownload { blob: Blob; url: string; filename: string; dispose(): void }
/** Prepares a download resource only; the UI owner decides whether/when to click/download it. */
export function prepareTumJsonDownload(report: TumExportReport, filename?: string): TumReportResult<TumJsonDownload> {
  const serialized = serializeTumReport(report);
  if (!serialized.ok) return serialized;
  try {
    const name = filename ?? `${report.recordingId.replace(/[^a-zA-Z0-9._-]/g, '_')}-quality.json`;
    if (typeof name !== 'string' || !name.endsWith('.json') || /[\\/:\u0000-\u001f]/u.test(name)) return error('INVALID_REPORT', 'İndirme adı yol içermeyen bir .json dosya adı olmalı.');
    if (typeof URL.createObjectURL !== 'function') return error('DOWNLOAD_UNAVAILABLE', 'Bu ortam Blob indirme URL oluşturmayı desteklemiyor.');
    const blob = new Blob([serialized.value], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    let disposed = false;
    return { ok: true, value: { blob, url, filename: name, dispose() { if (!disposed) { disposed = true; try { URL.revokeObjectURL(url); } catch { /* Cleanup is idempotent even during environment teardown. */ } } } } };
  } catch {
    return error('DOWNLOAD_UNAVAILABLE', 'JSON indirme kaynağı oluşturulamadı.');
  }
}
