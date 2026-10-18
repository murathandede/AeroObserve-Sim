import type { QualityIssue, QualityReport, RecordingMetadata } from '../shared/types';

/** Only examines metadata. Does not claim frame validation or missing-frame counts. */
export function analyzeMetadata(metadata: RecordingMetadata): QualityReport {
  const issues: QualityIssue[] = [];
  const add = (code: string, message: string, rule: string) => issues.push({
    code, message, rule, severity: 'info', recordingId: metadata.recording.id,
  });
  if (metadata.timing.kind === 'unknown') add('TIME_UNKNOWN', 'Kayıt zamanı bilinmiyor.', 'metadata.timing.kind === unknown');
  if (metadata.recording.license.status === 'unknown') add('LICENSE_UNKNOWN', 'Lisans bilgisi doğrulanmamış.', 'recording.license.status === unknown');
  if (metadata.radiometry.status !== 'available') add('NO_TEMPERATURE', 'Doğrulanmış sıcaklık ölçümü yok.', 'radiometry.status !== available');
  return { recordingId: metadata.recording.id, scope: 'metadata-only', issues, unsupported: ['Kare içeriği doğrulaması', 'Zamansal boşluk ve kayıp kare analizi'] };
}
