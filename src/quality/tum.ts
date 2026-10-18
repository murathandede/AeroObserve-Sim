import type { QualityIssue, QualityReport, RecordingInput } from '../shared/types';
import { snapshotTumInput } from '../data/tum/manifest';
import { describeTumTable, type TumTableKind, type TumTableMetadata } from '../data/tum/metadata';
import { validateTumPng } from '../data/tum/png';
import type { TumImageRow, TumSourceLocation, TumStream } from '../data/tum/text';

export interface TumQualityOptions {
  mode: 'manifest-subset' | 'full-recording';
  streams?: readonly TumStream[];
  inspectImages?: boolean;
  signal?: AbortSignal;
}
export interface TumQualitySourceReference {
  file: string;
  lineNumber: number;
  sourceIndex: number;
  timestampRaw: string;
}
/** Extra provenance stays outside the unchanged shared QualityIssue contract. */
export interface TumQualityIssueDetail {
  issueIndex: number;
  file?: string;
  sourceListFile?: string;
  lineNumber?: number;
  sourceIndex?: number;
  stream?: TumStream;
  apiIndex?: number;
  timestampRaw?: string;
  originalLine?: string;
  previous?: TumQualitySourceReference;
}
export interface TumQualityTableCoverage {
  kind: TumTableKind;
  file: string | null;
  /** Physical data-line count, including malformed rows; null means unread/unavailable. */
  rowCount: number | null;
  valid: boolean;
  metadata: TumTableMetadata | null;
}
export interface TumQualityAnalysis {
  report: QualityReport;
  details: TumQualityIssueDetail[];
  coverage: {
    selectionMode: TumQualityOptions['mode'];
    streams: TumStream[];
    inspectionRequested: boolean;
    completed: boolean;
    cancelled: boolean;
    sourceTables: TumQualityTableCoverage[];
    selectedSourceReferences: Record<TumStream, number>;
    images: {
      sourceReferences: number;
      expectedFiles: number;
      presentFiles: number;
      inspectedFiles: number;
      validatedFiles: number;
      missingFiles: number;
      missingFilePaths: string[];
      notSelectedSourceReferences: Record<TumStream, number>;
    };
  };
  limitations: string[];
}

const TABLE_KINDS: readonly TumTableKind[] = ['rgb', 'depth', 'groundtruth', 'accelerometer'];
const MAX_TEXT_BYTES = 32 * 1024 * 1024;
const CANCELLED = Symbol('cancelled-quality-inspection');

/** The original tokens, rather than rounded Number values, determine equality. */
function timestampKey(raw: string): string | null {
  if (raw.length > 4096) return null;
  const match = /^([+-]?)(\d*(?:\.\d*)?)(?:[eE]([+-]?\d+))?$/u.exec(raw);
  if (!match) return null;
  const exponent = Number(match[3] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 4096) return null;
  const [integer, fraction = ''] = match[2].split('.');
  let digits = (integer + fraction).replace(/^0+/u, '');
  if (!digits) return '0';
  let scale = fraction.length - exponent;
  while (digits.endsWith('0')) { digits = digits.slice(0, -1); --scale; }
  return `${match[1] === '-' ? '-' : ''}${digits}e${-scale}`;
}

/** A late Blob rejection remains handled after an abort has returned to the caller. */
function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T | typeof CANCELLED> {
  if (!signal) return work;
  return new Promise((resolve, reject) => {
    const stop = () => { signal.removeEventListener('abort', stop); resolve(CANCELLED); };
    work.then(value => { signal.removeEventListener('abort', stop); resolve(value); }, error => {
      signal.removeEventListener('abort', stop); reject(error);
    });
    if (signal.aborted) stop();
    else signal.addEventListener('abort', stop, { once: true });
  });
}

interface ImageReference extends TumQualitySourceReference {
  sourceListFile: string;
  stream: TumStream;
  apiIndex: number;
}

/**
 * Structural inspection of original TXT tables and optionally selected PNG files.
 * No stream pairing, missing-sensor-frame estimate, pixel-quality score or temperature
 * is produced. Full scope describes inspection coverage, never a clean-data guarantee.
 */
export async function analyzeTumRecording(input: RecordingInput, suppliedOptions: TumQualityOptions): Promise<TumQualityAnalysis> {
  let options: TumQualityOptions;
  try {
    // A caller may reuse/mutate its options while a Blob read is pending. Mode,
    // inspection and stream selection belong to this one invocation. Keep only
    // the AbortSignal reference live so cancellation still works as intended.
    const mode = suppliedOptions?.mode;
    const inspectImages = suppliedOptions?.inspectImages;
    const signal = suppliedOptions?.signal;
    const streams = suppliedOptions?.streams;
    options = { mode, inspectImages, signal, ...(streams === undefined ? {} : { streams: [...streams] }) };
  } catch {
    // Unreadable options still go through the normal structured INVALID_OPTIONS
    // path, without letting a throwing getter escape the analysis promise.
    options = { mode: 'manifest-subset', streams: [] };
  }
  const result: TumQualityAnalysis = {
    report: { recordingId: 'unknown-recording', scope: 'metadata-only', issues: [], unsupported: [] },
    details: [],
    coverage: {
      selectionMode: options?.mode ?? 'manifest-subset', streams: [],
      inspectionRequested: options?.inspectImages === true, completed: false, cancelled: false,
      sourceTables: [], selectedSourceReferences: { rgb: 0, depth: 0 },
      images: { sourceReferences: 0, expectedFiles: 0, presentFiles: 0, inspectedFiles: 0, validatedFiles: 0,
        missingFiles: 0, missingFilePaths: [], notSelectedSourceReferences: { rgb: 0, depth: 0 } },
    },
    limitations: [
      'Kayıp sensör karesi sayısı hesaplanmaz: akış başına belgelenmiş örnekleme düzeni yok; ortak manifest FPS bilgisi karma akışlara uygulanmaz.',
      'Akışlar eşleştirilmez; saat hizalaması, fiziksel pozlama zamanı ve RGB-depth eşzamanlılığı doğrulanmaz.',
      'İvmeölçer ax/ay/az fiziksel birimi doğrulanmadı; fiziksel ivme büyüklüğü, birim dönüşümü ve diğer sensörlerle fiziksel karşılaştırma desteklenmez.',
      'PNG incelemesi yapısal doğrulama, CRC ve sıkıştırılmış tarama satırlarıyla sınırlıdır; piksel kalitesi, sayısal depth dağılımı ve sıcaklık analiz edilmez.',
    ],
  };
  const issues: QualityIssue[] = [];
  const unsupported = new Set(result.limitations);
  const add = (code: string, severity: QualityIssue['severity'], message: string, rule: string, detail: Omit<TumQualityIssueDetail, 'issueIndex'> = {}) => {
    const issueIndex = issues.length;
    issues.push({ code, severity, recordingId: result.report.recordingId, message, rule,
      ...(detail.apiIndex === undefined ? {} : { frameIndex: detail.apiIndex }) });
    result.details.push({ issueIndex, ...detail });
    return issueIndex;
  };
  const missing = new Map<string, number>();
  const missingFile = (file: string, detail: Omit<TumQualityIssueDetail, 'issueIndex'> = {}) => {
    const previous = missing.get(file);
    if (previous !== undefined) {
      Object.assign(result.details[previous], detail, { file });
      if (detail.apiIndex !== undefined) issues[previous].frameIndex = detail.apiIndex;
      return;
    }
    missing.set(file, add('MISSING_FILE', 'error', 'İncelenen kapsamın gerektirdiği özgün dosya sağlanmadı; bu bulgu sensörün kare kaybettiğini kanıtlamaz.',
      'Manifestte açıkça beklenen dosya veya full-recording modunda seçili kaynak TXT referansı Blob haritasında bulunmalı.', { ...detail, file }));
  };
  const finish = () => {
    for (const table of result.coverage.sourceTables) if (!table.valid) unsupported.add(
      `${table.file ?? `${table.kind}.txt`}: kaynak tablo okuması/ayrıştırması tamamlanmadı; zaman ve metadata analizi yapılmadı, geçerli satırlardan sessiz bir alt dizi oluşturulmadı.`,
    );
    result.report = { ...result.report, issues, unsupported: [...unsupported] };
    if (result.report.scope === 'metadata-only') {
      const limitation = options?.mode === 'manifest-subset'
        ? 'Manifest alt kümesi incelendi; bu seçim tüm kaynak kaydının doğrulanması değildir ve kapsam metadata-only kalır.'
        : 'Tüm kaynak kayıt incelemesi tamamlanmadı; kapsam metadata-only, görüntü ve tablo sayıları coverage içinde açıktır.';
      if (!result.limitations.includes(limitation)) result.limitations.push(limitation);
      if (!result.report.unsupported.includes(limitation)) result.report.unsupported = [...result.report.unsupported, limitation];
    }
    return result;
  };
  const cancelled = () => {
    if (!options.signal?.aborted) return false;
    if (!result.coverage.cancelled) add('ANALYSIS_CANCELLED', 'info', 'Kalite incelemesi iptal edildi; tamamlanmayan dosyalar doğrulanmış sayılmadı.', 'AbortSignal.aborted === true');
    result.coverage.cancelled = true;
    return true;
  };

  try {
    const id = input?.manifest?.recording?.id;
    if (typeof id === 'string' && id.trim()) result.report.recordingId = id;
    const streams = options?.streams === undefined ? ['rgb', 'depth'] as const : options.streams;
    if (!options || !['manifest-subset', 'full-recording'].includes(options.mode) || !Array.isArray(streams) ||
      (options.inspectImages !== undefined && typeof options.inspectImages !== 'boolean') ||
      streams.length === 0 || streams.some(stream => stream !== 'rgb' && stream !== 'depth') || new Set(streams).size !== streams.length) {
      add('INVALID_OPTIONS', 'error', 'Kalite analizi açık kapsam ve tekrarsız rgb/depth akış seçimi gerektirir.', 'mode geçerli, streams boş olmayan tekrarsız bir rgb/depth dizisi olmalı.');
      return finish();
    }
    const selectedStreams: TumStream[] = [...streams];
    result.coverage.streams = [...selectedStreams];
    if (cancelled()) return finish();
    // The reader validator checks manifest/map shape before checking missing files.
    // Missing data is retained as a quality finding; no placeholder Blob is invented.
    const snapshot = snapshotTumInput(input, selectedStreams[0]);
    if (!snapshot.ok && snapshot.error.code !== 'MISSING_FILE') {
      add(snapshot.error.code, 'error', snapshot.error.message, 'Girdi belgelenmiş v1 TUM manifesti ve güvenli göreli yol → Blob haritası olmalı.',
        snapshot.error.file ? { file: snapshot.error.file } : {});
      result.coverage.completed = true;
      return finish();
    }
    const manifest = snapshot.ok ? snapshot.value.manifest : structuredClone(input.manifest);
    const files = snapshot.ok ? snapshot.value.files : new Map(input.files);
    for (const file of manifest.acquisition.files) if (!files.has(file)) missingFile(file);
    if (manifest.recording.license.status === 'unknown') add('LICENSE_UNKNOWN', 'info', 'Kaynak lisansı doğrulanmamış.', 'recording.license.status === unknown');

    const tableRoots = new Map<TumTableKind, string>();
    for (const kind of TABLE_KINDS) {
      if (cancelled()) return finish();
      const candidates = manifest.acquisition.files.filter(file => file === `${kind}.txt` || file.endsWith(`/${kind}.txt`));
      const coverage: TumQualityTableCoverage = { kind, file: candidates.length === 1 ? candidates[0] : null, rowCount: null, valid: false, metadata: null };
      result.coverage.sourceTables.push(coverage);
      if (candidates.length !== 1) {
        add('SOURCE_TABLE_UNAVAILABLE', 'error', `${kind}.txt için manifestte tam bir adet kaynak tablo yolu bulunmalı; bulunan ${candidates.length}.`, 'Her kaynak tablo bağımsız ve tek anlamlı dosya yoluyla tanımlanmalı.');
        continue;
      }
      const file = candidates[0];
      tableRoots.set(kind, file.slice(0, -`${kind}.txt`.length));
      const blob = files.get(file);
      if (!blob) { missingFile(file); continue; }
      if (blob.size > MAX_TEXT_BYTES) {
        add('TEXT_TOO_LARGE', 'error', 'Kaynak TXT bu inceleyicinin 32 MiB metin sınırını aşıyor.', 'blob.size ≤ 32 MiB olmalı; büyük içerik başarı sayılmaz.', { file });
        continue;
      }
      let text: string;
      try {
        const bytes = await abortable(blob.arrayBuffer(), options.signal);
        if (bytes === CANCELLED) { cancelled(); return finish(); }
        if (cancelled()) return finish();
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        if (cancelled()) return finish();
        add('TEXT_READ_FAILED', 'error', 'Kaynak TXT okunamadı veya geçerli UTF-8 değil.', 'Blob okunabilir ve UTF-8 çözülebilir olmalı.', { file });
        continue;
      }
      const lines = text.split(/\r\n|\n|\r/u);
      coverage.rowCount = lines.filter(line => line.trim().length > 0 && !line.trim().startsWith('#')).length;
      const described = describeTumTable(text, kind, file);
      if (!described.ok) {
        for (const issue of described.issues) add('TXT_ROW_INVALID', 'error', issue.message,
          'Kaynak TXT satırı belgelenmiş sütun sayısı, sonlu ondalık alanlar ve güvenli dosya yolu kurallarını sağlamalı; hatalı satırlar atlanmaz.',
          { file, lineNumber: issue.lineNumber, sourceIndex: issue.sourceIndex, originalLine: lines[issue.lineNumber - 1],
            ...(kind === 'rgb' || kind === 'depth' ? { stream: kind } : {}) });
        continue;
      }
      const metadata = described.value;
      coverage.valid = true;
      coverage.metadata = metadata;
      if (metadata.original.timestamp.unit === 'unknown') unsupported.add(`${kind}: özgün zaman birimi doğrulanmadı; aralıklar kaynak damga birimindedir, saniye veya ortak saat olarak yorumlanamaz.`);
      if (metadata.original.rows.length < 2) unsupported.add(`${file}: boş veya tek satırlı kaynakta süre/aralık istatistiği için en az iki timestamp gerekir; null sonuç hata değildir.`);
      const seen = new Map<string, TumSourceLocation>();
      for (const [index, row] of metadata.original.rows.entries()) {
        const detail = { file, lineNumber: row.lineNumber, sourceIndex: row.sourceIndex, timestampRaw: row.timestampRaw,
          ...(kind === 'rgb' || kind === 'depth' ? { stream: kind } : {}) };
        const key = timestampKey(row.timestampRaw);
        const first = key === null ? undefined : seen.get(key);
        if (first) add('DUPLICATE_TIMESTAMP', 'warning', 'Kaynak tablonun özgün sırasında aynı sayısal zaman damgası yeniden görülüyor.',
          'timestampRaw tokenleri tam ondalık eşitlikle karşılaştırılır; Number yuvarlanması eşitlik kanıtı değildir.',
          { ...detail, previous: { file, lineNumber: first.lineNumber, sourceIndex: first.sourceIndex, timestampRaw: first.timestampRaw } });
        else if (key !== null) seen.set(key, row);
        if (index === 0) continue;
        const interval = metadata.derived.intervals[index - 1];
        const previousRow = metadata.original.rows[index - 1];
        const previous = { file, lineNumber: previousRow.lineNumber, sourceIndex: previousRow.sourceIndex, timestampRaw: previousRow.timestampRaw };
        if (interval.exactDecimal === '0') add('ZERO_INTERVAL', 'warning', 'Ardışık özgün kaynak satırları arasında sıfır zaman aralığı var.',
          'Sonraki timestampRaw − önceki timestampRaw tam ondalık farkı 0.', { ...detail, previous });
        else if (interval.exactDecimal?.startsWith('-')) add('NEGATIVE_INTERVAL', 'warning', 'Zaman damgası kaynak sırasına göre geriye gidiyor; ardışık aralık negatif.',
          'Sonraki timestampRaw − önceki timestampRaw tam ondalık farkı < 0; kaynak sırası değiştirilmez.', { ...detail, previous });
        else if (interval.exactDecimal === null) unsupported.add(`${file}: en az bir ardışık fark tam ondalık işlem sınırında hesaplanamadı; sıfır/negatif veya boşluk sınıfı uydurulmadı.`);
      }
    }

    const expected = new Map<string, { stream: TumStream; reference?: ImageReference }>();
    const referencesByRow = new Map<string, ImageReference>();
    for (const stream of selectedStreams) {
      const table = result.coverage.sourceTables.find(item => item.kind === stream);
      const root = tableRoots.get(stream);
      if (root === undefined) continue;
      const selected = new Set(manifest.acquisition.files.filter(file => file.startsWith(`${root}${stream}/`) && file.endsWith('.png')));
      for (const file of selected) expected.set(file, { stream });
      if (!table?.metadata) continue;
      let apiIndex = 0;
      for (const row of table.metadata.original.rows) {
        if (!('path' in row)) continue;
        const imageRow: TumImageRow = row;
        const file = `${root}${imageRow.path}`;
        result.coverage.images.sourceReferences++;
        const included = options.mode === 'full-recording' || selected.has(file);
        if (!included) { result.coverage.images.notSelectedSourceReferences[stream]++; continue; }
        const reference: ImageReference = { file, sourceListFile: table.file!, stream, apiIndex: apiIndex++,
          lineNumber: row.lineNumber, sourceIndex: row.sourceIndex, timestampRaw: row.timestampRaw };
        referencesByRow.set(`${table.file!}:${row.sourceIndex}`, reference);
        expected.set(file, { stream, reference });
        result.coverage.selectedSourceReferences[stream]++;
      }
      const allSourcePaths = new Set(table.metadata.original.rows.filter(row => 'path' in row).map(row => `${root}${row.path}`));
      for (const file of selected) if (!allSourcePaths.has(file)) add('IMAGE_NOT_IN_SOURCE_TABLE', 'error', 'Manifestte seçilen PNG özgün kaynak TXT listesinde bulunmuyor.',
        'Seçili manifest PNG yolu aynı akışın kaynak TXT listesinde bulunmalı.', { file, stream, sourceListFile: table.file! });
    }
    // Timestamp findings refer to all source rows; only rows in the explicit
    // selected image sequence receive a derived API/frame index.
    for (const detail of result.details) {
      if (detail.stream === undefined || detail.sourceIndex === undefined) continue;
      const reference = referencesByRow.get(`${detail.sourceListFile ?? detail.file}:${detail.sourceIndex}`);
      if (reference) {
        detail.apiIndex = reference.apiIndex;
        issues[detail.issueIndex].frameIndex = reference.apiIndex;
      }
    }
    result.coverage.images.expectedFiles = expected.size;
    for (const [file, entry] of expected) {
      if (cancelled()) return finish();
      const detail = entry.reference ?? { file, stream: entry.stream };
      const blob = files.get(file);
      if (!blob) {
        result.coverage.images.missingFilePaths.push(file);
        result.coverage.images.missingFiles++;
        missingFile(file, detail);
        continue;
      }
      result.coverage.images.presentFiles++;
      if (!options.inspectImages) continue;
      result.coverage.images.inspectedFiles++;
      const validation = await abortable(validateTumPng(blob, entry.stream, file, options.signal), options.signal);
      if (validation === CANCELLED) { cancelled(); return finish(); }
      if (cancelled()) return finish();
      if (validation.ok) result.coverage.images.validatedFiles++;
      else add(validation.error.code === 'UNSUPPORTED_FORMAT' ? 'PNG_UNSUPPORTED_FORMAT' : 'PNG_DECODE_FAILED', 'error', validation.error.message,
        'Seçili özgün PNG belgelenmiş TUM boyut/bit/renk biçimi, chunk CRC ve sınırlı zlib/tarama satırı kontrollerini sağlamalı.', detail);
    }
    if (!options.inspectImages) unsupported.add('PNG dosyaları istek üzerine incelenmedi; dosya varlığı görüntü bütünlüğü kanıtı değildir.');
    const everyTableValid = result.coverage.sourceTables.length === TABLE_KINDS.length && result.coverage.sourceTables.every(table => table.valid);
    const everySourceImageValidated = result.coverage.images.sourceReferences > 0 &&
      result.coverage.images.validatedFiles === result.coverage.images.sourceReferences &&
      result.coverage.images.missingFiles === 0;
    if (options.mode === 'full-recording' && options.inspectImages && everyTableValid && everySourceImageValidated &&
      !issues.some(issue => issue.severity === 'error')) result.report.scope = 'full-recording';
    result.coverage.completed = true;
    return finish();
  } catch {
    if (options?.signal?.aborted) { cancelled(); return finish(); }
    add('INPUT_READ_FAILED', 'error', 'Kalite girdisi okunamadı; tamamlanmayan içerik doğrulanmış sayılmadı.', 'Manifest, Blob haritası ve yerel dosya erişimi okunabilir olmalı.');
    return finish();
  }
}
