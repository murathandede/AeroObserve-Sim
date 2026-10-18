import type { QualityIssue, QualityReport, RecordingMetadata } from '../shared/types';
export type { QualityIssue, QualityReport } from '../shared/types';
export { analyzeTumRecording } from './tum';
export type { TumQualityAnalysis, TumQualityOptions, TumQualitySourceReference, TumQualityIssueDetail, TumQualityTableCoverage } from './tum';
export { createTumReport, serializeTumReport, prepareTumJsonDownload } from './report';
export type { TumExportReport, TumReportOptions, TumReportResult, TumJsonDownload } from './report';

/** Only examines metadata. Does not claim frame validation or missing-frame counts. */
export function analyzeMetadata(metadata: RecordingMetadata): QualityReport {
  const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
  try {
    metadata = structuredClone(metadata);
    const nonempty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
    const known = (value: unknown, numeric = false) => object(value) && (value.status === 'unknown' ||
      (value.status === 'known' && nonempty(value.evidence) && (numeric ? typeof value.value === 'number' && Number.isFinite(value.value) && value.value > 0 : nonempty(value.value))));
    if (!object(metadata) || !object(metadata.recording) || typeof metadata.recording.id !== 'string' || !metadata.recording.id ||
      !nonempty(metadata.recording.name) || !['real', 'synthetic'].includes(metadata.recording.provenance) ||
      !object(metadata.recording.source) || !nonempty(metadata.recording.source.title) ||
      !(metadata.recording.source.url === null || nonempty(metadata.recording.source.url)) ||
      !Number.isInteger(metadata.frameCount) || metadata.frameCount < 0 || typeof metadata.format !== 'string' || !metadata.format ||
      !object(metadata.timing) || !['unknown', 'original', 'derived'].includes(metadata.timing.kind) ||
      !known(metadata.recording.license) || !known(metadata.timing.nominalFps, true) || !nonempty(metadata.timing.description) ||
      !(metadata.timing.timeBase === null || nonempty(metadata.timing.timeBase)) ||
      (metadata.timing.kind !== 'unknown' && !nonempty(metadata.timing.timeBase)) ||
      !object(metadata.radiometry) || !['available', 'unavailable', 'unknown'].includes(metadata.radiometry.status) ||
      !(metadata.radiometry.unit === null || nonempty(metadata.radiometry.unit)) || !nonempty(metadata.radiometry.evidence) ||
      !object(metadata.reader) || !nonempty(metadata.reader.id) || !nonempty(metadata.reader.version)) {
      return invalidMetadata(object(metadata) && object(metadata.recording) && typeof metadata.recording.id === 'string' ? metadata.recording.id : 'unknown-recording');
    }
  } catch { return invalidMetadata('unknown-recording'); }
  const issues: QualityIssue[] = [];
  const add = (code: string, message: string, rule: string) => issues.push({
    code, message, rule, severity: 'info', recordingId: metadata.recording.id,
  });
  if (metadata.timing.kind === 'unknown') add('TIME_UNKNOWN', 'Kayıt zamanı bilinmiyor.', 'metadata.timing.kind === unknown');
  if (metadata.recording.license.status === 'unknown') add('LICENSE_UNKNOWN', 'Lisans bilgisi doğrulanmamış.', 'recording.license.status === unknown');
  if (metadata.radiometry.status !== 'available') add('NO_TEMPERATURE', 'Doğrulanmış sıcaklık ölçümü yok.', 'radiometry.status !== available');
  return { recordingId: metadata.recording.id, scope: 'metadata-only', issues, unsupported: ['Kare içeriği doğrulaması', 'Zamansal boşluk ve kayıp kare analizi'] };
}

function invalidMetadata(recordingId: string): QualityReport {
  return {
    recordingId, scope: 'metadata-only',
    issues: [{ code: 'INVALID_METADATA', severity: 'error', recordingId, message: 'Metadata zorunlu alanları veya kare sayısı geçersiz; unknown-recording yalnız bilinmeyen kimlik yer tutucusudur.', rule: 'recording.id, frameCount integer ≥ 0, format, timing.kind, license.status, radiometry.status, reader kimliği çalışma anında doğrulanır' }],
    unsupported: ['Geçersiz metadata üzerinde içerik/zaman analizi yapılmadı.'],
  };
}
