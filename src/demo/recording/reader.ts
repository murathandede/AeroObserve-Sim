import type { FrameRecord, ReaderError, ReaderResult, ReaderState, RecordingInput, RecordingMetadata, RecordingReader } from '../../shared/types';

const images = [0, 1, 2].map(i => new URL(`./frames/frame-${i}.svg`, import.meta.url).href);
export class SyntheticRecordingReader implements RecordingReader {
  private state: ReaderState = { status: 'idle' };
  private metadata: RecordingMetadata | null = null;
  getState(): ReaderState { return structuredClone(this.state); }
  private fail<T>(code: ReaderError['code'], message: string, recovery: string): ReaderResult<T> {
    return { ok: false, error: { code, message, recovery } };
  }
  async open(input: RecordingInput): Promise<ReaderResult<RecordingMetadata>> {
    this.metadata = null;
    this.state = { status: 'opening' };
    const m = input.manifest;
    if (m.contractVersion !== 1 || m.recording.id !== 'synthetic-ui-v1' || m.recording.provenance !== 'synthetic' || m.format.status !== 'known' || m.format.value !== 'synthetic-svg-v1') {
      const result = this.fail<RecordingMetadata>('UNSUPPORTED_FORMAT', 'Bu adaptör yalnızca yerel sentetik geliştirme örneğini açar.', 'Gerçek kayıt için Efe’nin biçime özel okuyucusunu bağlayın.');
      if (!result.ok) this.state = { status: 'error', error: result.error };
      return result;
    }
    if (m.timing.kind !== 'unknown' || m.radiometry.status !== 'unavailable' || m.timing.nominalFps.status !== 'unknown' || m.acquisition.files.join(',') !== 'frame-0.svg,frame-1.svg,frame-2.svg') {
      const result = this.fail<RecordingMetadata>('INVALID_MANIFEST', 'Örnek manifesti sabit üç görüntüyle uyuşmuyor.', 'exampleInput içindeki değişmemiş örnek manifesti kullanın.');
      if (!result.ok) this.state = { status: 'error', error: result.error };
      return result;
    }
    this.metadata = structuredClone({ recording: m.recording, frameCount: images.length, format: 'SVG (sentetik çizim)', timing: m.timing, radiometry: m.radiometry, reader: { id: 'synthetic-svg', version: '1.0.0' } });
    this.state = { status: 'ready' };
    return { ok: true, value: structuredClone(this.metadata) };
  }
  getMetadata(): ReaderResult<RecordingMetadata> {
    if (!this.metadata) return this.fail(this.state.status === 'closed' ? 'CLOSED' : 'NOT_OPEN', 'Açık kayıt yok.', 'Önce open(input) çağırın.');
    return { ok: true, value: structuredClone(this.metadata) };
  }
  async getFrame(index: number): Promise<ReaderResult<FrameRecord>> {
    const result = this.getMetadata();
    if (!result.ok) return result;
    if (!Number.isInteger(index) || index < 0 || index >= images.length) return this.fail('INVALID_INDEX', `Kare indeksi geçersiz: ${index}.`, `0–${images.length - 1} arasında tam sayı kullanın.`);
    return { ok: true, value: { index, image: { url: images[index], width: 640, height: 400, alt: `GELİŞTİRME ÖRNEĞİ — SENTETİK; ${index + 1}. çizim, sıcaklık ölçümü değildir.` }, time: { kind: 'unknown' } } };
  }
  async close(): Promise<void> { this.metadata = null; this.state = { status: 'closed' }; }
}
