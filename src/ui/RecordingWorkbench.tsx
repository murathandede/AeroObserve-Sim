import { useState } from 'react';
import type { FrameTime, QualityReport, ReaderError, RecordingMetadata, FrameRecord, RecordingInfo } from '../shared/types';
import './recording.css';

export interface RecordingWorkbenchProps {
  recording: RecordingInfo;
  metadata: RecordingMetadata | null;
  frame: FrameRecord | null;
  report: QualityReport | null;
  error: ReaderError | null;
  opened: boolean;
  loading: boolean;
  index: number;
  playing: boolean;
  speed: number;
  onOpen: () => void;
  onClose: () => void;
  onSeek: (index: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: number) => void;
}
export function formatFrameTime(time: FrameTime): string {
  if (time.kind === 'unknown') return 'Bilinmiyor';
  return `${time.seconds} s · ${time.kind === 'original' ? 'Özgün' : 'Türetilmiş'} · ${time.timeBase} · ${time.kind === 'original' ? time.source : time.method}`;
}
function FrameImage({ frame }: { frame: FrameRecord }) {
  const [failed, setFailed] = useState(false);
  return failed ? <p role="alert">Görüntü yüklenemedi. Kaydı yeniden açın ve dosya referansını kontrol edin.</p> : <img src={frame.image.url} width={frame.image.width} height={frame.image.height} alt={frame.image.alt} onError={() => setFailed(true)} />;
}
export function RecordingWorkbench(p: RecordingWorkbenchProps) {
  const count = p.metadata?.frameCount ?? 0;
  const usable = count > 0 && !p.loading;
  return <div className="recording-workbench">
    <header><div><h1>AeroObserve</h1><p>Termal kayıt araştırması · {p.recording.name}</p></div><span className="demo">{p.recording.provenance === 'real' ? 'GERÇEK KAYIT' : 'GELİŞTİRME ÖRNEĞİ — SENTETİK'}</span></header>
    <div className="recording-toolbar"><button onClick={p.onOpen}>{p.opened ? 'Kaydı yeniden aç' : 'Kaydı aç'}</button><button onClick={p.onClose} disabled={!p.opened}>Kaydı kapat</button><a href="?view=simulation">Önceki sentetik simülasyon</a></div>
    <p>{p.recording.provenance === 'synthetic' ? 'Bu sayfa ortak arayüzü yerel çizimlerle denemek içindir. Gerçek sensör kaydı değildir.' : 'Gerçek kayıt; kaynak, lisans ve desteklenen metadata bilgilerini aşağıdan inceleyin.'}</p>
    {p.error && <div role="alert" className="recording-error"><strong>{p.error.code}: {p.error.message}</strong><p>{p.error.recovery}{p.error.file ? ` Dosya: ${p.error.file}` : ''}</p></div>}
    <main className="recording-grid">
      <section className="panel recording-view"><h2>Kayıt görüntüsü</h2><div className="recording-image" aria-busy={p.loading}>
        {p.loading ? <p role="status">Yükleniyor…</p> : p.frame ? <FrameImage key={`${p.frame.index}-${p.frame.image.url}`} frame={p.frame}/> : <p>{!p.opened ? 'Kayıt kapalı. Başlamak için kaydı açın.' : p.error ? 'Okuma hatası; örnek veriye otomatik geçilmedi.' : 'Bu kayıtta görüntülenecek kare yok.'}</p>}
      </div><div className="recording-toolbar"><button disabled={!usable || p.index === 0} onClick={() => p.onSeek(p.index - 1)}>← Önceki</button><button disabled={!usable || !!p.error || (!p.playing && p.index >= count - 1)} onClick={() => p.onPlayingChange(!p.playing)}>{p.playing ? 'Duraklat' : 'Oynat'}</button><button disabled={!usable || p.index >= count - 1} onClick={() => p.onSeek(p.index + 1)}>Sonraki →</button><label>Gösterim hızı <select value={p.speed} onChange={e => p.onSpeedChange(Number(e.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label></div>
      <label className="recording-slider">Kare indeksi: {count ? `${p.index} / ${count - 1}` : '—'}<input aria-label="Kare indeksi" type="range" min={0} max={Math.max(0, count - 1)} value={p.index} disabled={!usable} onChange={e => p.onSeek(Number(e.target.value))}/></label>
      <p className="hint">Gösterim: 1× hızda kare başına 1 saniye. Bu arayüz tercihidir; kayıt hızı veya türetilmiş zaman damgası değildir.</p><p role="status">{!p.opened ? 'Kapalı' : p.loading ? 'Yükleniyor' : p.error ? 'Hata' : p.playing ? 'Oynatılıyor' : 'Duraklatıldı'}</p></section>
      <aside className="panel recording-meta"><h2>Metadata ve kaynak</h2><dl><div><dt>Kayıt</dt><dd>{p.metadata?.recording.name ?? '—'}</dd></div><div><dt>Kare sayısı</dt><dd>{p.metadata?.frameCount ?? '—'}</dd></div><div><dt>Zaman</dt><dd>{p.frame ? formatFrameTime(p.frame.time) : 'Bilinmiyor'}</dd></div><div><dt>Biçim</dt><dd>{p.metadata?.format ?? 'Bilinmiyor'}</dd></div><div><dt>Sıcaklık</dt><dd>{p.frame?.temperature ? `Mevcut (${p.frame.temperature.unit})` : 'Ölçüm yok / bilinmiyor'}</dd></div><div><dt>Kaynak</dt><dd>{p.metadata?.recording.source.title ?? '—'}{p.metadata?.recording.source.url && <p>{p.metadata.recording.source.url}</p>}</dd></div><div><dt>Lisans</dt><dd>{p.metadata?.recording.license.status === 'known' ? p.metadata.recording.license.value : 'Bilinmiyor'}</dd></div><div><dt>Okuyucu</dt><dd>{p.metadata ? `${p.metadata.reader.id} / ${p.metadata.reader.version}` : '—'}</dd></div></dl></aside>
      <section className="panel recording-quality"><h2>Veri kalitesi · {p.report?.scope === 'full-recording' ? 'Kayıt incelemesi' : 'Yalnızca metadata incelemesi'}</h2>{p.report ? <><ul>{p.report.issues.map((issue, i) => <li key={`${issue.code}-${i}`}><strong>{issue.severity} · {issue.message}</strong><br/><code>Kural: {issue.rule}</code></li>)}</ul><p>Desteklenmiyor: {p.report.unsupported.length ? p.report.unsupported.join('; ') : 'Bildirilmedi'}.</p></> : <p>İnceleme için önce kayıt açın.</p>}<p className="hint">Bulgular yalnızca belirtilen kuralları kapsar; sensör doğruluğunu kanıtlamaz. Renkler tek başına sıcaklık ölçümü değildir.</p></section>
    </main>
  </div>;
}
