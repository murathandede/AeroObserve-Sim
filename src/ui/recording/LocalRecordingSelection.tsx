import { useEffect, useId, useRef, useState } from 'react';
import manifestJson from '../../../data/manifests/tum-rgbd-freiburg1-desk.json';
import type { RecordingInput } from '../../data';
import { emptySelection, inspectSelectionManifest, type SelectionState } from './selection';
import { SelectionController } from './selectionController';

const catalog = inspectSelectionManifest(manifestJson);
export interface PreparedSelectionProps {
  preparedInput?: RecordingInput | null;
  onPrepareInput?: (input: RecordingInput | null) => void;
}
const statusText = {
  idle: 'Henüz dosya seçilmedi.', selecting: 'Dosyalar seçiliyor…', checking: 'Dosyalar kontrol ediliyor…',
  valid: 'Seçim geçerli; yollar ve sınırlı dosya erişimi kontrol edildi.', missing: 'Seçim eksik.',
  invalid: 'Seçim geçersiz.', 'access-error': 'Dosya erişim hatası oluştu.',
  unsupported: 'Desteklenmeyen dosya biçimi seçildi.', cancelled: 'Seçim iptal edildi.',
} as const;

export function SelectionFeedback({ state, prepared }: { state: SelectionState; prepared: boolean }) {
  const hasError = state.issues.length > 0;
  return <div className={`recording-selection-feedback recording-selection-${state.status}`} aria-busy={state.status === 'checking'}>
    <div role="status" aria-live="polite" aria-atomic="true"><strong>{statusText[state.status]}</strong><p>Seçilen dosya: {state.selectedCount}</p></div>
    {hasError && <div role="alert"><ul>{state.issues.map((issue, i) => <li key={i}>{issue.message}{issue.file && <span className="recording-selection-path">{issue.file}</span>}</li>)}</ul></div>}
    {!!state.missingFiles.length && <details open><summary>Eksik dosyalar ({state.missingFiles.length})</summary><ul>{state.missingFiles.map(path => <li key={path} className="recording-selection-path">{path}</li>)}</ul></details>}
    {!!state.extraFiles.length && <details><summary>Manifest dışı dosyalar ({state.extraFiles.length})</summary><ul>{state.extraFiles.slice(0, 20).map(path => <li key={path} className="recording-selection-path">{path}</li>)}</ul>{state.extraFiles.length > 20 && <p>İlk 20 yol gösteriliyor. Ek dosyalar kayda alınmadı.</p>}</details>}
    {state.status === 'valid' && <p>{prepared ? 'RecordingInput uygulama state’inde hazır.' : 'RecordingInput entegrasyon sınırında hazır.'} Akışı seçip gerçek kaydı açık bir eylemle açın. Yeni dosya seçimi önceki kaydı kapatır; hazırlanan seçim otomatik açılmaz.</p>}
  </div>;
}

export function LocalRecordingSelection({ preparedInput, onPrepareInput }: PreparedSelectionProps) {
  const helpId = useId();
  const folderId = useId();
  const filesId = useId();
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [directorySupported, setDirectorySupported] = useState<boolean | null>(null);
  const [state, setState] = useState<SelectionState>(() => emptySelection());
  const prepareRef = useRef(onPrepareInput);
  useEffect(() => { prepareRef.current = onPrepareInput; }, [onPrepareInput]);
  const controllerRef = useRef<SelectionController | null>(null);
  if (!controllerRef.current) controllerRef.current = new SelectionController(manifestJson, next => {
    setState(next);
    prepareRef.current?.(next.input);
  });
  const controller = controllerRef.current;
  useEffect(() => {
    setDirectorySupported(!!folderRef.current && 'webkitdirectory' in folderRef.current);
    const folder = folderRef.current;
    const files = filesRef.current;
    const cancel = () => controller.cancel();
    folder?.addEventListener('cancel', cancel);
    files?.addEventListener('cancel', cancel);
    return () => {
      controller.invalidate();
      folder?.removeEventListener('cancel', cancel);
      files?.removeEventListener('cancel', cancel);
    };
  }, [controller]);

  function handleFiles(input: HTMLInputElement) {
    try {
      const files = Array.from(input.files ?? []);
      input.value = ''; // Selecting the same folder again must still produce a change event.
      void controller.select(files);
    } catch { controller.accessError(); }
  }
  function reset() {
    if (folderRef.current) folderRef.current.value = '';
    if (filesRef.current) filesRef.current.value = '';
    controller.reset();
  }

  if (!catalog.ok) return <div role="alert">{catalog.issue.message}</div>;
  const { manifest, root, streams } = catalog;
  return <div className="recording-local-selection">
    <span className="recording-badge">GERÇEK VERİ SEÇİMİ</span>
    <h3>{manifest.recording.name}</h3>
    <p className="recording-note">{manifest.recording.source.title}</p>
    <dl className="recording-facts">
      <div><dt>Resmî kaynak</dt><dd>{manifest.recording.source.url ? <a href={manifest.recording.source.url}>{manifest.recording.source.url}</a> : 'Bilinmiyor'}</dd></div>
      <div><dt>Lisans</dt><dd>{manifest.recording.license.status === 'known' ? manifest.recording.license.value : 'Bilinmiyor'}</dd></div>
      <div><dt>Desteklenen akışlar</dt><dd>{streams.join(' / ')} · Bağımsız akışlar</dd></div>
      <div><dt>Kayıt süresi</dt><dd>Manifestte belirtilmemiş</dd></div>
      <div><dt>Beklenen dosya</dt><dd>{manifest.acquisition.files.length} · Manifest alt kümesi</dd></div>
    </dl>
    <details className="recording-acquisition"><summary>Biçim, kaynak ve edinme bilgileri</summary>
      <p>{manifest.format.status === 'known' ? manifest.format.value : 'Biçim bilinmiyor'}</p>
      <p>{manifest.acquisition.instructions}</p>
      {manifest.recording.license.status === 'known' && <p>Lisans kanıtı: {manifest.recording.license.evidence}</p>}
      {manifest.citation && <p>Atıf: {manifest.citation}</p>}
      {manifest.versionOrAccessDate && <p>{manifest.versionOrAccessDate}</p>}
    </details>
    <p id={helpId} className="recording-note">{root || 'Manifest'} klasörünü veya onu içeren {manifest.recording.id} örnek klasörünü seçin. TGZ arşivini önce çıkarın. Yalnız manifestteki dosyalar kabul edilir. Dosyalar dış servise gönderilmez.</p>
    <div className="recording-file-picker">
      <label htmlFor={folderId}>Veri seti klasörünü seç</label>
      <input id={folderId} ref={folderRef} type="file" multiple {...{ webkitdirectory: '' }} disabled={directorySupported === false}
        aria-describedby={helpId} onClick={() => controller.beginPicking()} onChange={e => handleFiles(e.currentTarget)} />
      {directorySupported === false && <p role="status">Bu tarayıcı klasör seçimini desteklemiyor. Göreli klasör yollarını sağlayan bir tarayıcı kullanın; yalnız dosya adlarıyla eşleme yapılamaz.</p>}
      <details><summary>Çoklu dosya seçimi</summary><p>Bu seçenek de göreli yol bilgisi gerektirir. Tarayıcı yalnız dosya adlarını verirse seçim reddedilir; klasör seçimini kullanın.</p>
        <label htmlFor={filesId}>PNG ve TXT dosyalarını seç</label>
        <input id={filesId} ref={filesRef} type="file" multiple accept=".png,.txt" aria-describedby={helpId}
          onClick={() => controller.beginPicking()} onChange={e => handleFiles(e.currentTarget)} />
      </details>
    </div>
    <SelectionFeedback state={state} prepared={state.input !== null && state.input === preparedInput} />
    <button type="button" onClick={reset} disabled={state.status === 'idle'}>Seçimi temizle / kontrolü iptal et</button>
    <p className="recording-note">Kontrol yalnız manifest alanları, göreli yollar, File türü, uzantı/MIME ve dosya başına ilk 1 bayta erişimi kapsar. Tam dosya, PNG/TXT yapısı veya SHA-256 doğrulanmadı.</p>
  </div>;
}
