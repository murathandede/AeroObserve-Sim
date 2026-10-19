import type { DatasetManifest, RecordingInput } from '../../data';
import { snapshotTumInput } from '../../data/tum/manifest';
import { isSafeRelativePath } from '../../data/tum/text';

export type SelectionStatus = 'idle' | 'selecting' | 'checking' | 'valid' | 'missing' | 'invalid' | 'access-error' | 'unsupported' | 'cancelled';
export interface SelectionIssue { code: string; message: string; file?: string }
/** UI validation state, not a replacement for the shared RecordingInput contract. */
export interface SelectionState {
  status: SelectionStatus;
  selectedCount: number;
  input: RecordingInput | null;
  missingFiles: string[];
  extraFiles: string[];
  issues: SelectionIssue[];
}
export const emptySelection = (status: SelectionStatus = 'idle', selectedCount = 0): SelectionState => ({
  status, selectedCount, input: null, missingFiles: [], extraFiles: [], issues: [],
});

export type SelectionManifest = { ok: true; manifest: DatasetManifest; root: string; streams: readonly ['rgb', 'depth'] }
  | { ok: false; issue: SelectionIssue; status: 'invalid' | 'unsupported' };

/** Reuse Efe's runtime validator without opening a reader or inventing placeholder files. */
export function inspectSelectionManifest(candidate: unknown): SelectionManifest {
  const probe = snapshotTumInput({ manifest: candidate as DatasetManifest, files: new Map() }, 'rgb');
  if (!probe.ok && probe.error.code !== 'MISSING_FILE') {
    return { ok: false, status: probe.error.code === 'UNSUPPORTED_FORMAT' ? 'unsupported' : 'invalid',
      issue: { code: probe.error.code, message: `${probe.error.message} ${probe.error.recovery}` } };
  }
  // MISSING_FILE is emitted only after all required v1 manifest fields pass validation.
  let manifest: DatasetManifest;
  try { manifest = structuredClone(candidate as DatasetManifest); }
  catch { return { ok: false, status: 'invalid', issue: { code: 'INVALID_MANIFEST', message: 'Manifest güvenli bir veri kopyasına dönüştürülemedi; geçerli v1 JSON kullanın.' } }; }
  const paths = manifest.acquisition.files;
  const rgbLists = paths.filter(path => path === 'rgb.txt' || path.endsWith('/rgb.txt'));
  if (rgbLists.length !== 1) return { ok: false, status: 'invalid', issue: { code: 'INVALID_MANIFEST', message: 'Manifest tam bir adet rgb.txt yolu belirtmeli.' } };
  const root = rgbLists[0].slice(0, -'rgb.txt'.length);
  const requiredTables = ['rgb.txt', 'depth.txt', 'groundtruth.txt', 'accelerometer.txt'];
  if (requiredTables.some(name => !paths.includes(`${root}${name}`)) ||
    !['rgb', 'depth'].every(stream => paths.some(path => path.startsWith(`${root}${stream}/`) && path.endsWith('.png')))) {
    return { ok: false, status: 'invalid', issue: { code: 'INVALID_MANIFEST', message: 'Bu seçim iki görüntü akışı ve dört TXT içeren TUM manifestini gerektirir.' } };
  }
  if (paths.some(path => !requiredTables.some(name => path === `${root}${name}`) &&
    !['rgb', 'depth'].some(stream => path.startsWith(`${root}${stream}/`) && path.endsWith('.png')))) {
    return { ok: false, status: 'unsupported', issue: { code: 'UNSUPPORTED_FORMAT', message: 'Manifest bu seçicinin desteklemediği dosya yolları veya biçimler içeriyor.' } };
  }
  return { ok: true, manifest, root, streams: ['rgb', 'depth'] };
}

/** One-byte access probe only: no image decode, TXT parsing, full-file read or hash claim. */
async function canRead(file: File, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false;
  const work = file.slice(0, 1).arrayBuffer();
  if (!signal) return (await work).byteLength === 1;
  return new Promise<boolean>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); resolve(false); };
    work.then(bytes => { signal.removeEventListener('abort', abort); resolve(bytes.byteLength === 1); }, error => {
      signal.removeEventListener('abort', abort); reject(error);
    });
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}

export async function prepareRecordingSelection(candidate: unknown, selection: readonly File[], signal?: AbortSignal): Promise<SelectionState> {
  const result = emptySelection('checking', selection.length);
  const checked = inspectSelectionManifest(candidate);
  if (!checked.ok) return { ...result, status: checked.status, issues: [checked.issue] };
  const { manifest, root } = checked;
  if (signal?.aborted) return emptySelection('cancelled');
  if (!selection.length) return { ...result, status: 'invalid', issues: [{ code: 'EMPTY_SELECTION', message: 'Hiç dosya seçilmedi. Lütfen veri setinin ilgili klasörünü seçin.' }] };
  const expected = new Set(manifest.acquisition.files);
  const files = new Map<string, File>();
  const seen = new Set<string>();
  let invalid = false;
  let unsupported = false;
  const add = (code: string, message: string, file?: string) => {
    // Keep error rendering bounded even when a large unrelated folder is selected.
    if (result.issues.length < 20) result.issues.push({ code, message, ...(file ? { file } : {}) });
  };
  for (const file of selection) {
    if (signal?.aborted) return emptySelection('cancelled');
    if (typeof File === 'undefined' || !(file instanceof File)) {
      invalid = true; add('NOT_A_FILE', 'Seçilen girdi okunabilir bir File nesnesi olmalı.'); continue;
    }
    const rawPath = file.webkitRelativePath;
    if (!rawPath) {
      invalid = true; add('RELATIVE_PATH_REQUIRED', 'Göreli klasör yolu alınamadı. Yalnız dosya adlarıyla eşleme yapılmaz; veri seti klasörünü seçin.', file.name); continue;
    }
    if (!isSafeRelativePath(rawPath)) {
      invalid = true; add('INVALID_PATH', 'Seçilen dosyanın göreli yolu güvenli veya geçerli değil.', rawPath); continue;
    }
    // Only the documented optional sample wrapper may be removed. Never match arbitrary suffixes.
    const wrapper = `${manifest.recording.id}/`;
    const path = rawPath.startsWith(root) ? rawPath : rawPath.startsWith(wrapper) ? rawPath.slice(wrapper.length) : rawPath;
    if (!path.startsWith(root) || file.name !== path.split('/').at(-1)) {
      invalid = true; add('WRONG_FOLDER', 'Seçilen klasör yapısı manifest köküyle eşleşmiyor. Belgelenen kayıt klasörünü seçin.', rawPath); continue;
    }
    if (seen.has(path)) {
      invalid = true; add('DUPLICATE_PATH', 'Aynı göreli dosya yolu birden fazla kez seçildi.', path); continue;
    }
    seen.add(path);
    if (!expected.has(path)) result.extraFiles.push(path);
    const png = path.endsWith('.png');
    const txt = path.endsWith('.txt');
    const acceptedMime = !file.type || file.type === 'application/octet-stream' || file.type === (png ? 'image/png' : 'text/plain');
    if ((!png && !txt) || !acceptedMime) {
      unsupported = true; add('UNSUPPORTED_FORMAT', 'Bu dosyanın uzantısı veya bildirilen MIME türü mevcut PNG/TXT seçimiyle uyumlu değil.', path); continue;
    }
    if (!expected.has(path)) continue;
    if (file.size === 0) {
      invalid = true; add('EMPTY_FILE', 'Beklenen dosya boş; özgün dosyayı yeniden sağlayın.', path); continue;
    }
    files.set(path, file);
  }
  result.missingFiles = manifest.acquisition.files.filter(path => !seen.has(path));
  if (result.extraFiles.length) add('EXTRA_FILES', 'Manifest dışı dosyalar seçildi. Yalnız manifestteki küçük örneği içeren klasörü seçin; ek dosyalar kayda alınmadı.');
  if (unsupported || invalid || result.extraFiles.length || result.missingFiles.length) {
    if (result.missingFiles.length) add('MISSING_FILES', 'Beklenen dosyalar bulunamadı. Lütfen veri setinin ilgili klasörünü seçin.');
    return { ...result, status: unsupported ? 'unsupported' : invalid || result.extraFiles.length ? 'invalid' : 'missing' };
  }
  for (const [path, file] of files) {
    try {
      const readable = await canRead(file, signal);
      if (signal?.aborted) return emptySelection('cancelled');
      if (!readable) throw new Error('Unreadable file probe');
    } catch {
      if (signal?.aborted) return emptySelection('cancelled');
      return { ...result, status: 'access-error', issues: [{ code: 'FILE_ACCESS', message: 'Dosyaya erişilemedi. Özgün dosyayı yeniden seçin ve yerel erişim iznini kontrol edin.', file: path }] };
    }
  }
  const input: RecordingInput = { manifest, files };
  for (const stream of checked.streams) {
    const snapshot = snapshotTumInput(input, stream);
    if (!snapshot.ok) return { ...result, status: 'invalid', issues: [{ code: snapshot.error.code, message: snapshot.error.message, file: snapshot.error.file }] };
  }
  return { ...result, status: 'valid', input };
}
