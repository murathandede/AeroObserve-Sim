import { isApiPosition } from '../../playback/playbackPolicy';

export type PositionInputResult = { ok: true; index: number } | { ok: false; message: string };

/** Search is explicitly zero-based API position, never an original source index. */
export function parseApiPosition(text: string, count: number): PositionInputResult {
  if (!text.trim()) return { ok: false, message: 'Bir API pozisyonu girin.' };
  if (!/^-?\d+$/.test(text.trim())) return { ok: false, message: 'API pozisyonu tam sayı olmalıdır.' };
  const index = Number(text);
  if (!isApiPosition(index, count)) return { ok: false, message: count > 0 ? `API pozisyonu 0 ile ${count - 1} arasında olmalıdır.` : 'Gezinilebilecek kare yok.' };
  return { ok: true, index };
}

export function seekFromInput(text: string, count: number, onSeek: (index: number) => void): PositionInputResult {
  const result = parseApiPosition(text, count);
  if (result.ok) onSeek(result.index);
  return result;
}
