import type { QualityIssue, QualityReport } from '../../shared/types';
import type { TumDerivedTime, TumStream, TumTableMetadata } from '../../data';
import type { TumQualityAnalysis } from '../../quality';

export type SeverityFilter = 'all' | QualityIssue['severity'];
export const severityLabels = { info: 'Bilgi', warning: 'Uyarı', error: 'Hata' } as const;
const priority = { error: 0, warning: 1, info: 2 };

/** Sort/filter references only; original issueIndex always addresses Efe's details. */
export function qualityIssuePage(report: QualityReport, filter: SeverityFilter, requestedPage: number, size = 20) {
  const rows = report.issues.map((issue, issueIndex) => ({ issue, issueIndex }))
    .filter(row => filter === 'all' || row.issue.severity === filter)
    .sort((a, b) => priority[a.issue.severity] - priority[b.issue.severity] || a.issueIndex - b.issueIndex);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.max(0, Math.min(pages - 1, Number.isInteger(requestedPage) ? requestedPage : 0));
  return { total: report.issues.length, filtered: rows.length, pages, page, rows: rows.slice(page * size, (page + 1) * size) };
}

/** Check plotting provenance, not timestamp arithmetic. Never calculate a time interval here. */
export function intervalPlotProblem(interval: TumDerivedTime, table: TumTableMetadata, stream: TumStream): string | null {
  if (interval.value === null) return 'Sayısal değer sağlanmamış';
  if (!Number.isFinite(interval.value)) return 'Geçersiz sayısal değer; çizilmedi';
  if (table.original.kind !== stream || interval.scope.kind !== 'source-table' || interval.scope.file !== table.original.file || interval.scope.tableKind !== stream ||
    interval.scope.selection !== 'all-source-data-rows-in-original-order') return 'Aralık kapsamı seçili kaynak tabloyla eşleşmiyor';
  if (!['seconds', 'unknown'].includes(table.original.timestamp.unit)) return 'Kaynak birim açıklaması sağlanmamış';
  const expectedUnit = table.original.timestamp.unit === 'seconds' ? 'seconds' : 'source-timestamp-unit-unknown';
  if (interval.unit !== expectedUnit) return 'Birim kanıtı aralık verisiyle eşleşmiyor';
  if (interval.inputs.length !== 2 || interval.inputs.some(input => input.file !== table.original.file ||
    !Number.isInteger(input.sourceIndex) || input.sourceIndex < 0 || !Number.isInteger(input.lineNumber) || input.lineNumber < 1 || !input.timestampRaw)) return 'İki özgün kaynak ucu sağlanmamış';
  return null;
}

export function qualityIntervalPage(analysis: TumQualityAnalysis, stream: TumStream, requestedPage: number, size = 40) {
  const covered = analysis.coverage.sourceTables.find(table => table.kind === stream);
  const table = covered?.valid && covered.metadata?.original.kind === stream && covered.file === covered.metadata.original.file ? covered.metadata : null;
  if (!table) return null;
  const intervals = table.derived.intervals;
  const pages = Math.max(1, Math.ceil(intervals.length / size));
  const page = Math.max(0, Math.min(pages - 1, Number.isInteger(requestedPage) ? requestedPage : 0));
  const points = intervals.slice(page * size, (page + 1) * size).map(interval => ({ interval, problem: intervalPlotProblem(interval, table, stream) }));
  return { table, total: intervals.length, pages, page, points };
}
