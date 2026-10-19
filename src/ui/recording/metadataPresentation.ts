import type { FrameRecord, FrameTime } from '../../shared/types';
import type { TumFrameMetadata, TumSourceInfo, TumStream } from '../../data';

export const notProvided = 'Bu kayıt için sağlanmamış';
export function metadataText(value: string | null | undefined, fallback = notProvided): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}
export function metadataNumber(value: number | null | undefined): string {
  return value == null ? 'Bilinmiyor' : Number.isFinite(value) ? String(value) : 'Geçersiz sayısal değer';
}
export function metadataIndex(value: number | null | undefined): string {
  return value == null ? notProvided : Number.isInteger(value) && value >= 0 ? String(value) : 'Geçersiz indeks';
}
export function formatFrameTime(time: FrameTime | null | undefined): string {
  if (!time || time.kind === 'unknown') return 'Bilinmiyor';
  if (!Number.isFinite(time.seconds)) return 'Geçersiz sayısal zaman değeri';
  return `${time.seconds} s · ${time.kind === 'original' ? 'Özgün' : 'Türetilmiş'} · ${metadataText(time.timeBase, 'Bilinmiyor')} · ${metadataText(time.kind === 'original' ? time.source : time.method)}`;
}

export function frameAtPosition(frame: FrameRecord | null, index?: number, count?: number): FrameRecord | null {
  if (!frame || !Number.isInteger(frame.index) || frame.index < 0 || (index !== undefined && frame.index !== index) ||
    (count !== undefined && (!Number.isInteger(count) || frame.index >= count))) return null;
  return frame;
}

/** UI consistency check only. Owner/session isolation remains in useRecording. */
export function matchingFrameMetadata(frame: FrameRecord | null, metadata: TumFrameMetadata | null | undefined,
  index: number | undefined, stream?: TumStream, source?: TumSourceInfo | null): TumFrameMetadata | null {
  if (!frameAtPosition(frame, index) || !frame || !metadata || metadata.derived?.apiIndex?.value !== frame.index ||
    metadata.original?.stream !== metadata.derived.apiIndex.scope.stream || (stream && metadata.original?.stream !== stream)) return null;
  if (source) {
    const row = source.frames[frame.index];
    if (source.stream !== metadata.original.stream || source.mode !== metadata.derived.apiIndex.scope.mode || !row || row.apiIndex !== frame.index ||
      row.sourceIndex !== metadata.original.sourceIndex || row.file !== metadata.original.sourceFile ||
      row.lineNumber !== metadata.original.lineNumber || row.timestampRaw !== metadata.original.timestampRaw ||
      source.listFile !== metadata.original.sourceListFile) return null;
  }
  return metadata;
}
