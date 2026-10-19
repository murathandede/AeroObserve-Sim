import type { RecordingMetadata } from '../../shared/types';
import type { TumSourceInfo, TumStream } from '../../data';
import { createTumReport, prepareTumJsonDownload, type TumJsonDownload, type TumReportResult } from '../../quality';
import type { QualityAnalysisState, QualityTarget } from './qualityController';

export interface ReportSelection {
  opened?: boolean;
  qualityTarget?: QualityTarget | null;
  qualityState?: QualityAnalysisState | null;
  metadata?: RecordingMetadata | null;
  sourceInfo?: TumSourceInfo | null;
  activeStream?: TumStream;
}

/** References from one active quality job; not another report/data schema. */
export function completedReportContext(p: ReportSelection) {
  const { qualityTarget: target, qualityState: state, metadata, sourceInfo: source } = p;
  const analysis = state?.analysis;
  if (!p.opened || !target || !metadata || !source || state?.status !== 'completed' || !analysis ||
    !analysis.coverage.completed || analysis.coverage.cancelled || state.error ||
    target.recording.provenance !== 'real' || target.input.manifest.recording.provenance !== 'real' ||
    metadata.recording.provenance !== 'real' || metadata.recording.id !== target.recording.id ||
    target.input.manifest.recording.id !== target.recording.id || analysis.report.recordingId !== target.recording.id ||
    target.stream !== p.activeStream || source.stream !== target.stream || source.mode !== target.mode ||
    source.frameCount !== metadata.frameCount || metadata.reader.id !== `tum-rgbd-${target.stream}` ||
    analysis.coverage.selectionMode !== target.mode || analysis.coverage.streams.length !== 1 ||
    analysis.coverage.streams[0] !== target.stream || analysis.coverage.inspectionRequested !== state.inspectImages) return null;
  return { target, metadata, source, analysis };
}
export type CompletedReportContext = NonNullable<ReturnType<typeof completedReportContext>>;

export function reportFilename(recordingId: string, stream: TumStream) {
  const safe = recordingId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || 'recording';
  return `${safe}-${stream}-quality.json`;
}

const unavailable = (): TumReportResult<never> => ({ ok: false, error: { code: 'DOWNLOAD_UNAVAILABLE',
  message: 'JSON indirme isteği tamamlanamadı.', recovery: 'Aktif kaydın analizini kontrol edip yeniden deneyin; Blob indirmeyi destekleyen bir tarayıcı kullanın.' } });

/** Owns only Efe's download resource. Never revokes reader URLs or re-runs analysis. */
export class ReportDownloadLease {
  private resource: TumJsonDownload | null = null;
  constructor(private readonly prepare: typeof prepareTumJsonDownload = prepareTumJsonDownload) {}
  clear() { this.resource?.dispose(); this.resource = null; }
  download(context: CompletedReportContext, isCurrent: () => boolean,
    trigger: (resource: TumJsonDownload) => void): TumReportResult<TumJsonDownload> {
    this.clear();
    if (!isCurrent()) return unavailable();
    try {
      const made = createTumReport({ input: context.target.input, metadata: context.metadata,
        analysis: context.analysis, source: context.source });
      if (!made.ok) return made;
      if (!isCurrent()) return unavailable();
      const prepared = this.prepare(made.value, reportFilename(context.target.recording.id, context.target.stream));
      if (!prepared.ok) return prepared;
      this.resource = prepared.value;
      if (!isCurrent()) { this.clear(); return unavailable(); }
      trigger(prepared.value);
      // Keep the URL alive after click. Replace on next download or dispose at cleanup.
      return prepared;
    } catch { this.clear(); return unavailable(); }
  }
}

/** Called only by the user's button; the helper itself never triggers a DOM download. */
export function triggerJsonDownload(resource: TumJsonDownload) {
  const anchor = document.createElement('a');
  anchor.href = resource.url; anchor.download = resource.filename; anchor.hidden = true;
  try { document.body.append(anchor); anchor.click(); } finally { anchor.remove(); }
}
