import type { DatasetManifest, ReaderError, ReaderResult, RecordingInput } from '../../shared/types';
import { isSafeRelativePath, type TumStream } from './text';

export interface TumInputSnapshot {
  manifest: DatasetManifest;
  files: Map<string, Blob>;
  listFile: string;
  root: string;
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function known(value: unknown, numeric = false): boolean {
  if (!object(value)) return false;
  return value.status === 'unknown' || (value.status === 'known' && text(value.evidence) &&
    (numeric ? typeof value.value === 'number' && Number.isFinite(value.value) && value.value > 0 : text(value.value)));
}
function fail(code: ReaderError['code'], message: string, recovery: string, file?: string): ReaderResult<never> {
  return { ok: false, error: { code, message, recovery, ...(file ? { file } : {}) } };
}

/** Runtime validation is required: the input may have come from untyped JSON/File selection. */
export function snapshotTumInput(input: RecordingInput, stream: TumStream): ReaderResult<TumInputSnapshot> {
  const invalid = (message: string) => fail('INVALID_MANIFEST', message, 'Geçerli v1 TUM manifestini ve göreli yol → Blob haritasını yeniden sağlayın.');
  try {
    if (!object(input) || !object(input.manifest)) return invalid('Manifest eksik veya nesne değil.');
    const m = input.manifest;
    if (m.contractVersion !== 1 || !object(m.recording) || !text(m.recording.id) || !text(m.recording.name) ||
      !['real', 'synthetic'].includes(m.recording.provenance) || !object(m.recording.source) ||
      !text(m.recording.source.title) || !(m.recording.source.url === null || text(m.recording.source.url)) ||
      !known(m.recording.license) || !known(m.format) || !object(m.acquisition) || !text(m.acquisition.instructions) ||
      !Array.isArray(m.acquisition.files) || m.acquisition.files.length === 0 ||
      !m.acquisition.files.every((file: unknown) => typeof file === 'string' && isSafeRelativePath(file)) ||
      new Set(m.acquisition.files).size !== m.acquisition.files.length || !object(m.timing) ||
      !['unknown', 'original', 'derived'].includes(m.timing.kind) || !text(m.timing.description) ||
      !(m.timing.timeBase === null || text(m.timing.timeBase)) ||
      (m.timing.kind !== 'unknown' && !text(m.timing.timeBase)) || !known(m.timing.nominalFps, true) ||
      !object(m.radiometry) || !['unknown', 'available', 'unavailable'].includes(m.radiometry.status) ||
      !(m.radiometry.unit === null || text(m.radiometry.unit)) || !text(m.radiometry.evidence) ||
      !(m.citation === null || text(m.citation)) || !(m.versionOrAccessDate === null || text(m.versionOrAccessDate))) {
      return invalid('Manifestin zorunlu v1 alanları, değerleri veya dosya yolları geçersiz.');
    }
    if (m.recording.provenance !== 'real' || m.format.status !== 'known' || m.radiometry.status === 'available') {
      return fail('UNSUPPORTED_FORMAT', 'TUM okuyucusu gerçek RGB/depth PNG kaydı içindir; sıcaklık verisi veya sentetik adaptör değildir.', 'Belgelenmiş gerçek TUM RGB-D manifestini kullanın.');
    }
    const supplied = input.files;
    if (!supplied || typeof supplied.entries !== 'function' || typeof supplied.get !== 'function') {
      return invalid('files göreli yolları Blob/File nesnelerine bağlayan bir ReadonlyMap olmalı.');
    }
    // Snapshot the entries, not image bytes. File is accepted because it extends Blob.
    const files = new Map<string, Blob>();
    for (const [path, blob] of supplied.entries()) {
      if (typeof path !== 'string' || !isSafeRelativePath(path) || !(blob instanceof Blob)) {
        return invalid('Dosya haritasında güvenli olmayan yol veya Blob/File olmayan değer var.');
      }
      files.set(path, blob);
    }
    for (const file of m.acquisition.files) {
      if (!files.has(file)) return fail('MISSING_FILE', 'Manifestte beklenen dosya sağlanmadı.', 'Eksik özgün dosyayı manifestteki göreli yoluyla dosya haritasına ekleyin; örnek kapsamını değiştirmeyin.', file);
    }
    const lists = m.acquisition.files.filter(file => file === `${stream}.txt` || file.endsWith(`/${stream}.txt`));
    if (lists.length !== 1) return invalid(`Manifest seçili ${stream} akışı için tam bir adet ${stream}.txt belirtmeli.`);
    const listFile = lists[0];
    return { ok: true, value: { manifest: structuredClone(m), files, listFile, root: listFile.slice(0, -`${stream}.txt`.length) } };
  } catch {
    return invalid('Manifest veya dosya haritası okunamadı; giriş geçerli v1 JSON ve Blob değerleri içermeli.');
  }
}
