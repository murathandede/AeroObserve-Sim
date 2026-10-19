import { useId } from 'react';
import type { RecordingInput, TumStream } from '../../data';

export interface ActiveRecordingControlsProps {
  selectedStream?: TumStream;
  activeStream?: TumStream;
  onStreamChange?: (stream: TumStream) => void;
  onOpenReal?: () => void;
}

export function ActiveRecordingControls(p: ActiveRecordingControlsProps & { preparedInput?: RecordingInput | null; opened: boolean }) {
  const helpId = useId();
  return <div className="recording-active-controls">
    <label>Gerçek kayıt akışı <select value={p.selectedStream ?? 'rgb'} disabled={!p.preparedInput || !p.onStreamChange}
      aria-describedby={helpId} onChange={e => { if (e.target.value === 'rgb' || e.target.value === 'depth') p.onStreamChange?.(e.target.value); }}>
      <option value="rgb">RGB · Görünür görüntü</option><option value="depth">Depth · Derinlik önizlemesi</option>
    </select></label>
    <button type="button" className="recording-primary-button" disabled={!p.preparedInput || !p.onOpenReal} onClick={p.onOpenReal}>
      {p.opened && p.activeStream ? 'Gerçek kaydı yeniden aç' : 'Gerçek kaydı aç'}
    </button>
    <p id={helpId} className="recording-note">{p.preparedInput ? 'Dosyalar hazır. Seçili akışı açmak için düğmeye basın.' : 'Gerçek kayıt açmak için önce geçerli dosya seçimi hazırlayın.'} Akış değişikliği önceki kaydı kapatır; yeni akış otomatik açılmaz. Aynı indeks eşzamanlılık anlamına gelmez.</p>
  </div>;
}
