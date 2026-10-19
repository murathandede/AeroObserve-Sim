import type { TumFrameMetadata, TumRecordingReader, TumSourceInfo, TumTableMetadata } from '../data';
import type { FrameRecord, ReaderError, ReaderResult, RecordingBinding, RecordingMetadata, RecordingReader } from '../shared/types';

export interface PresentedFrame { frame: FrameRecord; frameMetadata: TumFrameMetadata | null }
const unexpected = (message: string): ReaderResult<never> => ({ ok: false, error: {
  code: 'DECODE_FAILED', message, recovery: 'Kaydı yeniden açın; sorun sürerse okuyucu geliştiricisine bildirin.',
} });

/** Async frontend adapter only. The existing hook still owns all playback timing. */
export class ReaderSession {
  private active = true;
  private frameRequest = 0;
  private reader: RecordingReader | null = null;
  constructor(private readonly binding: RecordingBinding) {}

  async open(): Promise<ReaderResult<RecordingMetadata> | null> {
    if (!this.active) return null;
    try {
      this.reader = this.binding.createReader();
      const result = await this.reader.open(this.binding.input);
      return this.active ? result : null;
    } catch { return this.active ? unexpected('Okuyucu başlatılamadı veya kayıt açılamadı.') : null; }
  }

  cancelFrame() { ++this.frameRequest; }

  // Snapshot getters only: Efe returns already-parsed session data without file I/O.
  // The hook calls each once after open, never during seek/render/polling.
  getSourceInfo(): ReaderResult<TumSourceInfo> | null {
    if (!this.active || !this.reader) return null;
    const reader = this.reader as RecordingReader & Partial<Pick<TumRecordingReader, 'getSourceInfo'>>;
    try { return typeof reader.getSourceInfo === 'function' ? reader.getSourceInfo() : null; }
    catch { return unexpected('Kaynak kapsamı metadata’sı alınamadı.'); }
  }

  getTableMetadata(): ReaderResult<TumTableMetadata> | null {
    if (!this.active || !this.reader) return null;
    const reader = this.reader as RecordingReader & Partial<Pick<TumRecordingReader, 'getTableMetadata'>>;
    try { return typeof reader.getTableMetadata === 'function' ? reader.getTableMetadata() : null; }
    catch { return unexpected('Kaynak tablo metadata’sı alınamadı.'); }
  }

  async getFrame(index: number): Promise<ReaderResult<PresentedFrame> | null> {
    const request = ++this.frameRequest;
    const current = () => this.active && request === this.frameRequest;
    if (!this.active) return null;
    if (!this.reader) return { ok: false, error: { code: 'NOT_OPEN', message: 'Kayıt açık değil.', recovery: 'Önce kaydı açın.' } };
    try {
      const result = await this.reader.getFrame(index);
      if (!current()) return null;
      if (!result.ok) return result;
      let frameMetadata: TumFrameMetadata | null = null;
      // Optional Efe diagnostics stay outside the shared v1 reader contract.
      const reader = this.reader as RecordingReader & { getFrameMetadata?: (index: number) => ReaderResult<TumFrameMetadata> };
      if (typeof reader.getFrameMetadata === 'function') {
        const metadata = reader.getFrameMetadata(index);
        if (!metadata.ok) return metadata;
        frameMetadata = metadata.value;
      }
      return current() ? { ok: true, value: { frame: result.value, frameMetadata } } : null;
    } catch { return current() ? unexpected('Kare veya kaynak kimliği okunamadı.') : null; }
  }

  async close(): Promise<ReaderError | null> {
    if (!this.active) return null;
    this.active = false;
    this.cancelFrame();
    const reader = this.reader;
    this.reader = null;
    try { await reader?.close(); return null; }
    catch { return { code: 'DECODE_FAILED', message: 'Okuyucu kaynak temizliği tamamlanamadı.', recovery: 'Kaydı kapatıp yeniden açın; sorun sürerse okuyucu geliştiricisine bildirin.' }; }
  }
}
