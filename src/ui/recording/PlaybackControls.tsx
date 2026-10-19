import { useId, useState } from 'react';
import type { RecordingWorkbenchProps } from '../RecordingWorkbench';
import { isPresentationSpeed, playbackAvailability, presentationSpeeds } from '../../playback/playbackPolicy';
import { seekFromInput } from './playbackInput';

function PositionSearch({ count, disabled, onSeek }: { count: number; disabled: boolean; onSeek: (index: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  return <form className="recording-position-search" noValidate onSubmit={event => {
    event.preventDefault();
    if (disabled) return;
    const result = seekFromInput(draft, count, onSeek);
    setMessage(result.ok ? null : result.message);
    if (result.ok) setDraft('');
  }}>
    <label htmlFor={id}>API pozisyonuna git <span>(0 tabanlı)</span></label>
    <div className="recording-search-fields">
      <input id={id} type="text" inputMode="numeric" autoComplete="off" value={draft}
        placeholder={count ? `0–${count - 1}` : '—'} disabled={disabled}
        aria-invalid={!!message} aria-describedby={`${id}-help${message ? ` ${id}-error` : ''}`}
        onChange={event => { setDraft(event.target.value); setMessage(null); }} />
      <button type="submit" disabled={disabled}>Kareye git</button>
    </div>
    <p id={`${id}-help`} className="recording-note">Tam sayı girin. Görsel sıra 1, API pozisyonu 0'dır. Özgün kaynak indeksiyle arama yapılmaz.</p>
    {message && <p id={`${id}-error`} role="alert" className="recording-input-error">{message}</p>}
  </form>;
}

type PlaybackProps = Pick<RecordingWorkbenchProps, 'metadata' | 'opened' | 'loading' | 'error' | 'index' | 'playing' | 'speed' | 'onSeek' | 'onPlayingChange' | 'onSpeedChange' | 'playbackSessionKey'>;

/** Stateless controls: callbacks belong to useRecording, never to a second controller. */
export function PlaybackNavigation(p: PlaybackProps & { helpId: string; timelineId: string }) {
  const count = p.opened ? p.metadata?.frameCount ?? 0 : 0;
  const available = playbackAvailability(p.opened, count, p.index, p.loading, !!p.error, p.playing);
  const position = count ? `${p.index + 1} / ${count}` : '—';
  return <>
    <div className="recording-toolbar">
      <button type="button" disabled={!available.previous} onClick={() => p.onSeek(0)}>İlk kare</button>
      <button type="button" disabled={!available.previous} onClick={() => p.onSeek(p.index - 1)}>← Önceki</button>
      <button type="button" className="recording-primary-button" disabled={p.playing ? !available.pause : !available.play} onClick={() => p.onPlayingChange(!p.playing)}>{p.playing ? 'Duraklat' : 'Oynat'}</button>
      <button type="button" disabled={!available.next} onClick={() => p.onSeek(p.index + 1)}>Sonraki →</button>
      <button type="button" disabled={!available.next} onClick={() => p.onSeek(count - 1)}>Son kare</button>
      <label className="recording-speed">Oynatma hızı <select value={p.speed} disabled={!available.navigable || count < 2} aria-describedby={p.helpId} onChange={event => {
        const speed = Number(event.target.value);
        if (isPresentationSpeed(speed)) p.onSpeedChange(speed);
      }}>{presentationSpeeds.map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></label>
    </div>
    <label className="recording-slider">
      <span>Seçili kare: <strong>{position}</strong></span>
      <span>API pozisyonu <strong>{count ? p.index : '—'}</strong></span>
      <input aria-label="API kare pozisyonu" aria-describedby={p.timelineId} aria-valuetext={count ? `Görsel sıra ${position}; API pozisyonu ${p.index}` : 'Kare yok'} type="range"
        min={0} max={Math.max(0, count - 1)} step={1} value={count ? p.index : 0} disabled={!available.navigable}
        onChange={event => { seekFromInput(event.target.value, count, p.onSeek); }} />
    </label>
    <div className="recording-timeline-bounds" aria-hidden="true"><span>{count ? 'İlk · API 0' : 'Kare yok'}</span><span>{count ? `Son · API ${count - 1}` : '—'}</span></div>
  </>;
}

export function PlaybackControls(p: PlaybackProps) {
  const helpId = useId();
  const timelineId = useId();
  const count = p.opened ? p.metadata?.frameCount ?? 0 : 0;
  const available = playbackAvailability(p.opened, count, p.index, p.loading, !!p.error, p.playing);
  const status = !p.opened ? 'Kapalı' : p.error ? 'Hata — kaydı yeniden açın' : p.loading ? (p.metadata ? 'Kare yükleniyor' : 'Reader açılıyor') : count === 0 ? 'Boş kayıt' : p.playing ? 'Oynatılıyor' : p.index === count - 1 ? 'Son kare · duraklatıldı' : 'Duraklatıldı';
  return <section className="recording-playback" aria-label="Oynatma kontrolleri">
    <div className="recording-playback-heading"><h3>Kare gezinmesi</h3><p role="status" className="recording-status">{status}</p></div>
    <PlaybackNavigation {...p} helpId={helpId} timelineId={timelineId} />
    <p id={timelineId} className="recording-note">Çizelge API kare pozisyonlarını gösterir. Gerçek TUM seçimi küçük manifest alt kümesidir; tam sensör kaydı veya saniye ekseni değildir. RGB ve Depth pozisyonları bağımsızdır.</p>
    <PositionSearch key={`${p.playbackSessionKey ?? ''}:${p.opened}:${p.metadata?.recording.id ?? ''}:${p.metadata?.reader.id ?? ''}:${count}`} count={count} disabled={!available.navigable} onSeek={p.onSeek} />
    <p id={helpId} className="recording-note">Bu ayar kare gösterim temposunu değiştirir. Kaynağın gerçek kayıt hızı veya sensör FPS'i değildir. 1×: kare yüklendikten sonra 1 saniye bekleme; 2×: 0,5 saniye; 0,5×: 2 saniye. Son karede durur, başa dönmez.</p>
    <p className="recording-note">Kaynak zamanına göre arama desteklenmiyor. Ham zaman tokeni ve birim bilgisi, reader sağlıyorsa görüntü kimliğinde ayrı gösterilir.</p>
  </section>;
}
