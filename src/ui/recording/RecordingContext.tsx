import type { RecordingInfo } from '../../shared/types';
import type { RecordingWorkbenchProps } from '../RecordingWorkbench';
import { Panel } from './Panel';
export { SourcePanel } from './SourcePanel';
export { ReportPanel } from './ReportPanel';
import { LocalRecordingSelection, type PreparedSelectionProps } from './LocalRecordingSelection';
import { ActiveRecordingControls, type ActiveRecordingControlsProps } from './ActiveRecordingControls';

export function WorkbenchHeader({ recording }: { recording: RecordingInfo }) {
  const synthetic = recording.provenance === 'synthetic';
  return <header className="recording-header">
    <div className="recording-brand"><span className="recording-brandmark" aria-hidden="true">◈</span><div><h1>AeroObserve</h1><p>Sensör kayıtlarını inceleme çalışma alanı</p></div></div>
    <div className="recording-header-context"><span className={`recording-badge ${synthetic ? 'recording-badge-synthetic' : ''}`}>{synthetic ? 'GELİŞTİRME ÖRNEĞİ — SENTETİK' : 'GERÇEK VERİ KAYNAĞI'}</span><a href="?view=simulation">Önceki sentetik simülasyon ↗</a></div>
  </header>;
}

export function RecordingSelection(p: Pick<RecordingWorkbenchProps, 'recording' | 'opened' | 'onOpen' | 'onClose' | 'demoRecording'> & PreparedSelectionProps & ActiveRecordingControlsProps) {
  const demo = p.demoRecording ?? p.recording;
  const synthetic = demo.provenance === 'synthetic';
  return <Panel title="Kayıt seçimi" label="KAYIT" className="recording-selection">
    <LocalRecordingSelection preparedInput={p.preparedInput} onPrepareInput={p.onPrepareInput} />
    <ActiveRecordingControls {...p} />
    <div className="recording-current"><p className="recording-kicker">{synthetic ? 'MEVCUT SENTETİK ÖRNEK' : 'BAŞLANGIÇ KAYNAĞI'}</p><p className="recording-name">{demo.name}</p><p className="recording-note">{synthetic ? 'Repo ile gelen geliştirme çizimleri. Gerçek sensör verisi değildir.' : 'Kaynak tanımı, dosyaların açıldığı veya doğrulandığı anlamına gelmez.'}</p></div>
    <div className="recording-session-actions"><button type="button" onClick={p.onOpen}>{synthetic ? p.opened && p.recording.provenance === 'synthetic' ? 'Sentetik örneği yeniden aç' : 'Sentetik örneği aç' : 'Başlangıç kaynağını aç'}</button><button type="button" onClick={p.onClose} disabled={!p.opened}>Kaydı kapat</button></div>
  </Panel>;
}
