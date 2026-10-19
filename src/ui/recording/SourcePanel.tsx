import type { DatasetManifest, RecordingInfo } from '../../shared/types';
import type { TumSourceInfo } from '../../data';
import { Panel } from './Panel';

export function safeExternalUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function SourceLink({ value }: { value: string | null | undefined }) {
  const href = safeExternalUrl(value);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{value}<span className="recording-sr-only"> (yeni sekmede açılır)</span></a>
    : <span>{value || 'Bu kaynak için sağlanmamış'}</span>;
}

export function SourcePanel({ recording, manifest, sourceInfo }: {
  recording: RecordingInfo; manifest?: DatasetManifest | null; sourceInfo?: TumSourceInfo | null;
}) {
  const catalog = manifest?.recording.id === recording.id && manifest.recording.provenance === recording.provenance ? manifest : null;
  const info = catalog?.recording ?? recording;
  const scope = catalog?.acquisition.files.includes(sourceInfo?.listFile ?? '') ? sourceInfo : null;
  return <Panel title="Kaynak bilgileri" label="İZLENEBİLİRLİK">
    <p className="recording-note">Kaynak tanımları manifest/kayıt kataloğundan gelir; doğrudan sensör ölçümü değildir.</p>
    <dl className="recording-facts">
      <div><dt>Veri seti / kayıt</dt><dd>{info.name}</dd></div>
      <div><dt>Veri türü</dt><dd>{info.provenance === 'synthetic' ? 'Sentetik geliştirme örneği' : 'Gerçek veri kaynağı'}</dd></div>
      <div><dt>Kaynak</dt><dd>{info.source.title}</dd></div>
      <div><dt>Yayımlayıcı</dt><dd>Kaynak tanımında sağlanmamış</dd></div>
      <div><dt>Resmî kaynak adresi</dt><dd><SourceLink value={info.source.url} /></dd></div>
      <div><dt>Lisans</dt><dd>{info.license.status === 'known' ? info.license.value : 'Bilinmiyor'}</dd></div>
      {info.license.status === 'known' && <div><dt>Lisans kanıtı / bağlantıları</dt><dd className="recording-source-links">{info.license.evidence.split(/\s*;\s*/).map((value, index) => <SourceLink key={index} value={value} />)}</dd></div>}
      <div><dt>Akademik atıf</dt><dd>{catalog?.citation || 'Bu kaynak için sağlanmamış'}</dd></div>
      <div><dt>Sürüm / erişim tarihi</dt><dd>{catalog?.versionOrAccessDate || 'Bu kaynak için sağlanmamış'}</dd></div>
      <div><dt>Kayıt kapsamı</dt><dd>{scope ? scope.mode === 'manifest-subset'
        ? `${scope.stream.toUpperCase()} · manifest alt kümesi · ${scope.frameCount} erişilebilir görüntü; kaynak TXT ${scope.sourceRowCount} satır`
        : `${scope.stream.toUpperCase()} · seçili akışın kaynak TXT listesi`
        : 'Kaynak tanımı; aktif reader kapsamı sağlanmamış'}</dd></div>
    </dl>
    {info.license.status === 'unknown' && <p className="recording-note">Lisansın bilinmemesi kullanım izni anlamına gelmez.</p>}
    <p className="recording-panel-note">Küçük manifest alt kümesi tam sensör kaydı değildir. Seçilmeyen görüntüler kayıp sensör karesi olarak sayılmaz.</p>
  </Panel>;
}
