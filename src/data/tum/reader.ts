import type { FrameRecord, ReaderError, ReaderResult, ReaderState, RecordingInput, RecordingMetadata, RecordingReader } from '../../shared/types';
import { snapshotTumInput } from './manifest';
import { validateTumPng, type TumPngInfo } from './png';
import { describeTumTable, toTumFrameTime, type TumTableMetadata } from './metadata';
import { describeTumFrame, type TumFrameMetadata } from './provenance';
import type { TumImageRow, TumStream } from './text';

export interface TumReaderOptions {
  stream: TumStream;
  /** Required: a small manifest subset must never silently become a full recording. */
  mode: 'manifest-subset' | 'full-recording';
}
export interface TumFrameSource {
  apiIndex: number;
  sourceIndex: number;
  lineNumber: number;
  timestampRaw: string;
  /** Convenience number only; timestampRaw preserves the exact source token. No time unit is inferred. */
  timestampValue: number;
  file: string;
}
export interface TumSourceInfo {
  stream: TumStream;
  mode: TumReaderOptions['mode'];
  listFile: string;
  sourceRowCount: number;
  frameCount: number;
  unselectedSourceRows: number;
  frames: readonly TumFrameSource[];
}
interface FrameJob { index: number; resolve: (result: ReaderResult<FrameRecord>) => void }
interface Session {
  token: number;
  signal: AbortSignal;
  metadata: RecordingMetadata;
  source: TumSourceInfo;
  tableMetadata: TumTableMetadata;
  pngMetadata: Map<number, TumPngInfo>;
  files: Map<string, Blob>;
  urls: Set<string>;
  frames: Map<number, FrameRecord>;
  pending: Map<number, Promise<ReaderResult<FrameRecord>>>;
  queue: FrameJob[];
  active: number;
}
const CANCELLED = Symbol('closed-reader-session');
const MAX_TEXT_BYTES = 32 * 1024 * 1024;

function fail(code: ReaderError['code'], message: string, recovery: string, file?: string): ReaderResult<never> {
  return { ok: false, error: { code, message, recovery, ...(file ? { file } : {}) } };
}
function closed(): ReaderResult<never> {
  return fail('CLOSED', 'İşlem ait olduğu kayıt oturumu kapandığı için tamamlanmadı.', 'Yeni kaydı open(input) ile açın; eski oturumun sonuçlarını kullanmayın.');
}

/** Settle cancellation promptly even when Blob/native decompression cannot itself be aborted. */
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T | typeof CANCELLED> {
  return new Promise((resolve, reject) => {
    const stop = () => { signal.removeEventListener('abort', stop); resolve(CANCELLED); };
    // Both handlers stay attached after cancellation, including for a late rejection.
    work.then(value => { signal.removeEventListener('abort', stop); resolve(value); }, error => {
      signal.removeEventListener('abort', stop); reject(error);
    });
    if (signal.aborted) stop();
    else signal.addEventListener('abort', stop, { once: true });
  });
}

/** One independently owned RGB or depth stream; never pairs streams or produces depth measurements. */
export class TumRecordingReader implements RecordingReader {
  private readonly options: TumReaderOptions;
  private state: ReaderState = { status: 'idle' };
  private token = 0;
  private controller: AbortController | null = null;
  private session: Session | null = null;

  constructor(options: TumReaderOptions) { this.options = { ...options }; }

  getState(): ReaderState { return structuredClone(this.state); }

  private notOpen(): ReaderResult<never> {
    return this.state.status === 'closed' ? closed() :
      fail('NOT_OPEN', 'Hazır bir kayıt açık değil.', 'Önce open(input) çağrısının başarılı tamamlanmasını bekleyin.');
  }
  private current(token: number): boolean { return token === this.token; }

  private discard(): void {
    ++this.token;
    this.controller?.abort();
    this.controller = null;
    const old = this.session;
    this.session = null;
    if (!old) return;
    for (const job of old.queue.splice(0)) job.resolve(closed());
    for (const url of old.urls) {
      try { URL.revokeObjectURL(url); } catch { /* close remains safe on repeated/partial cleanup */ }
    }
    old.urls.clear(); old.frames.clear(); old.pending.clear(); old.files.clear(); old.pngMetadata.clear();
  }

  private openingFailed(token: number, result: ReaderResult<never>): ReaderResult<never> {
    if (!this.current(token)) return closed();
    if (!result.ok) this.state = { status: 'error', error: structuredClone(result.error) };
    this.controller?.abort();
    return result;
  }

  async open(input: RecordingInput): Promise<ReaderResult<RecordingMetadata>> {
    this.discard();
    const token = this.token;
    const controller = new AbortController();
    this.controller = controller;
    this.state = { status: 'opening' };
    let listFile: string | undefined;
    try {
      const { stream, mode } = this.options;
      if (!['rgb', 'depth'].includes(stream) || !['manifest-subset', 'full-recording'].includes(mode)) {
        return this.openingFailed(token, fail('UNSUPPORTED_FORMAT', 'Akış veya kapsam seçimi desteklenmiyor.', 'Okuyucuyu stream: rgb/depth ve açık mode: manifest-subset/full-recording seçenekleriyle oluşturun.'));
      }
      const snapshot = snapshotTumInput(input, stream);
      if (!snapshot.ok) return this.openingFailed(token, snapshot);
      const { manifest, files, root } = snapshot.value;
      listFile = snapshot.value.listFile;
      const list = files.get(listFile)!;
      if (list.size > MAX_TEXT_BYTES) {
        return this.openingFailed(token, fail('UNSUPPORTED_FORMAT', 'Seçili TXT listesi bu okuyucunun 32 MiB metin sınırını aşıyor.', 'Daha küçük ve açıkça belgelenmiş bir kayıt kapsamı sağlayın.', listFile));
      }
      const buffer = await abortable(list.arrayBuffer(), controller.signal);
      if (buffer === CANCELLED || !this.current(token)) return closed();
      const parsed = describeTumTable(new TextDecoder('utf-8', { fatal: true }).decode(buffer), stream, listFile);
      if (!parsed.ok) {
        const first = parsed.issues[0];
        return this.openingFailed(token, fail('DECODE_FAILED', `${listFile}, satır ${first.lineNumber}: ${first.message} Toplam ${parsed.issues.length} ayrıştırma bulgusu.`, 'TXT kaynağını kontrol edin; hatalı satırları sessizce atlamadan özgün dosyayı yeniden sağlayın. Ayrıntılar için describeTumTable kullanın.', listFile));
      }
      const tableMetadata = parsed.value;
      const rows: readonly TumImageRow[] = tableMetadata.original.rows.filter(row => 'path' in row);
      if (rows.length !== tableMetadata.original.rows.length) return this.openingFailed(token, fail('DECODE_FAILED', 'Seçili görüntü tablosunda görüntü dışı satır yapısı var.', 'Doğru RGB/depth TXT dosyasını sağlayın.', listFile));
      const prefix = `${root}${stream}/`;
      const selected = new Set(manifest.acquisition.files.filter(path => path.startsWith(prefix) && path.endsWith('.png')));
      const paths = new Set(rows.map(row => `${root}${row.path}`));
      for (const path of selected) {
        if (!paths.has(path)) return this.openingFailed(token, fail('INVALID_MANIFEST', 'Manifest PNG dosyası seçili TXT listesinde bulunmuyor.', 'Manifest ve değiştirilmemiş kaynak TXT listesinin aynı kayda ait olduğunu kontrol edin.', path));
      }
      if (mode === 'manifest-subset' && selected.size === 0) {
        return this.openingFailed(token, fail('INVALID_MANIFEST', 'Manifest seçili akış için hiçbir PNG belirtmiyor.', 'Yerel örneğin seçili PNG yollarını açıkça belirten manifesti sağlayın.', listFile));
      }
      const frames: TumFrameSource[] = [];
      for (const row of rows) {
        const file = `${root}${row.path}`;
        if (mode === 'manifest-subset' && !selected.has(file)) continue;
        if (!files.has(file)) {
          return this.openingFailed(token, fail('MISSING_FILE', 'Seçili tam akış listesinin görüntü dosyası sağlanmadı; kayıt sessizce alt kümeye indirgenmedi.', 'Tam mod için seçili TXT listesindeki tüm PNG dosyalarını sağlayın veya açıkça manifest-subset modunu seçin.', file));
        }
        frames.push({ apiIndex: frames.length, sourceIndex: row.sourceIndex, lineNumber: row.lineNumber, timestampRaw: row.timestampRaw, timestampValue: row.timestampValue, file });
      }
      const source: TumSourceInfo = { stream, mode, listFile, sourceRowCount: rows.length, frameCount: frames.length, unselectedSourceRows: rows.length - frames.length, frames };
      const metadata: RecordingMetadata = {
        recording: { ...manifest.recording, name: `${manifest.recording.name} · ${stream.toUpperCase()} · ${mode}` },
        frameCount: frames.length,
        format: stream === 'rgb' ? 'TUM RGB PNG (640×480, 8-bit RGB)' : 'TUM depth PNG (640×480, 16-bit grayscale; yalnız görsel önizleme)',
        timing: { kind: 'unknown', timeBase: null, nominalFps: { status: 'unknown' }, description: `Ham damgalar ${listFile} içinde korunur; birim/saat kökeni ve akışlar arası eşleme doğrulanmadı. ${mode}: ${frames.length}/${rows.length} kaynak satırı seçildi; diğerleri kayıp sensör karesi sayılmaz.` },
        radiometry: { status: 'unavailable', unit: null, evidence: 'TUM RGB görünür görüntüdür; depth uzaklık kodlamasıdır. Bu okuyucu sıcaklık veya sayısal depth üretmez.' },
        reader: { id: `tum-rgbd-${stream}`, version: '1.1.0' },
      };
      if (!this.current(token)) return closed();
      this.session = { token, signal: controller.signal, metadata, source, tableMetadata, pngMetadata: new Map(), files, urls: new Set(), frames: new Map(), pending: new Map(), queue: [], active: 0 };
      this.state = { status: 'ready' };
      return { ok: true, value: structuredClone(metadata) };
    } catch {
      return this.openingFailed(token, fail('DECODE_FAILED', 'Seçili kayıt listesi açılamadı veya geçerli UTF-8 olarak okunamadı.', 'Özgün TXT dosyasını ve Blob erişimini kontrol edip kaydı yeniden açın.', listFile));
    }
  }

  getMetadata(): ReaderResult<RecordingMetadata> {
    return this.session ? { ok: true, value: structuredClone(this.session.metadata) } : this.notOpen();
  }

  /** Efe-specific provenance diagnostic; the shared FrameRecord/RecordingReader contract is unchanged. */
  getSourceInfo(): ReaderResult<TumSourceInfo> {
    return this.session ? { ok: true, value: structuredClone(this.session.source) } : this.notOpen();
  }

  /** Original TXT fields and derived summaries for this one source table, never a merged clock. */
  getTableMetadata(): ReaderResult<TumTableMetadata> {
    return this.session ? { ok: true, value: structuredClone(this.session.tableMetadata) } : this.notOpen();
  }

  /** Does not read/decode a PNG: its facts remain not-read until getFrame validates that file. */
  getFrameMetadata(index: number): ReaderResult<TumFrameMetadata> {
    const session = this.session;
    if (!session) return this.notOpen();
    if (!Number.isInteger(index) || index < 0 || index >= session.source.frameCount) {
      return fail('INVALID_INDEX', 'Metadata için geçerli bir kare indeksi gerekli.', `0 ≤ index < ${session.source.frameCount} koşulunu sağlayan tam sayı kullanın.`);
    }
    return { ok: true, value: describeTumFrame(session.source.frames[index], session.source.listFile, this.options, session.pngMetadata.get(index)) };
  }

  async getFrame(index: number): Promise<ReaderResult<FrameRecord>> {
    const session = this.session;
    if (!session) return this.notOpen();
    if (!Number.isInteger(index) || index < 0 || index >= session.source.frameCount) {
      const description = typeof index === 'number' ? String(index) : `sayı olmayan ${typeof index}`;
      return fail('INVALID_INDEX', `Kare indeksi geçersiz: ${description}.`, `0 ≤ index < ${session.source.frameCount} koşulunu sağlayan tam sayı kullanın.`);
    }
    const cached = session.frames.get(index);
    if (cached) return { ok: true, value: structuredClone(cached) };
    let pending = session.pending.get(index);
    if (!pending) {
      pending = new Promise(resolve => { session.queue.push({ index, resolve }); this.drain(session); });
      session.pending.set(index, pending);
    }
    const result = await pending;
    session.pending.delete(index);
    // close/reopen can run after loadFrame resolves but before this public request resumes.
    // Never hand out an old session's already-revoked URL as a successful frame.
    if (!this.current(session.token)) return closed();
    return structuredClone(result);
  }

  private drain(session: Session): void {
    // A bounded decoder pool avoids opening every requested PNG at once during fast seeks.
    while (this.current(session.token) && session.active < 2 && session.queue.length > 0) {
      const job = session.queue.shift()!;
      ++session.active;
      void this.loadFrame(session, job.index).then(job.resolve).finally(() => {
        --session.active;
        this.drain(session);
      });
    }
  }

  private async loadFrame(session: Session, index: number): Promise<ReaderResult<FrameRecord>> {
    const source = session.source.frames[index];
    try {
      const blob = session.files.get(source.file)!;
      const validated = await abortable(validateTumPng(blob, this.options.stream, source.file, session.signal), session.signal);
      if (validated === CANCELLED || !this.current(session.token)) return closed();
      if (!validated.ok) return validated;
      session.pngMetadata.set(index, { ...validated.value });
      if (typeof URL.createObjectURL !== 'function') {
        return fail('UNSUPPORTED_FORMAT', 'Bu ortam Blob görüntü URL oluşturmayı desteklemiyor.', 'Blob URL desteği olan güncel bir tarayıcı veya Node ortamı kullanın.', source.file);
      }
      const url = URL.createObjectURL(blob);
      session.urls.add(url);
      const frame: FrameRecord = { index, image: { url, width: validated.value.width, height: validated.value.height, alt: `${this.options.stream.toUpperCase()} görsel önizleme; ${source.file}; kaynak satırı ${source.lineNumber}, kaynak indeksi ${source.sourceIndex}; özgün damga ${source.timestampRaw}, zaman tabanı bilinmiyor. Sıcaklık veya sayısal derinlik ölçümü değildir.` }, time: toTumFrameTime(source, this.options.stream, session.source.listFile) };
      session.frames.set(index, frame);
      return { ok: true, value: frame };
    } catch {
      if (!this.current(session.token)) return closed();
      return fail('DECODE_FAILED', 'PNG dosyası okunamadı veya görüntü kaynağı oluşturulamadı.', 'İlgili özgün PNG dosyasını ve tarayıcı Blob erişimini kontrol edin; başka bir kareyi deneyebilirsiniz.', source.file);
    }
  }

  async close(): Promise<void> {
    this.discard();
    this.state = { status: 'closed' };
  }
}
