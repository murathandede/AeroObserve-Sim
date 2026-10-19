import { useId } from 'react';
import type { DatasetManifest, QualityReport, ReaderError, RecordingMetadata, FrameRecord, RecordingInfo } from '../shared/types';
import { WorkbenchHeader, RecordingSelection, SourcePanel, ReportPanel } from './recording/RecordingContext';
import { FrameViewer } from './recording/FrameViewer';
import { PlaybackControls } from './recording/PlaybackControls';
import { MetadataPanel } from './recording/MetadataPanel';
import { QualityPanel, type QualityControlsProps } from './recording/QualityPanel';
import { ReaderErrorNotice } from './recording/Panel';
import type { PreparedSelectionProps } from './recording/LocalRecordingSelection';
import type { ActiveRecordingControlsProps } from './recording/ActiveRecordingControls';
import type { TumFrameMetadata, TumSourceInfo, TumTableMetadata } from '../data';
import './recording.css';

// Preserve the application's presentation boundary. No reader or clock lives here.
export interface RecordingWorkbenchProps extends PreparedSelectionProps, ActiveRecordingControlsProps, QualityControlsProps {
  demoRecording?: RecordingInfo;
  closedReason?: 'unselected' | 'ready' | 'closed';
  frameMetadata?: TumFrameMetadata | null;
  sourceInfo?: TumSourceInfo | null;
  tableMetadata?: TumTableMetadata | null;
  metadataError?: ReaderError | null;
  manifest?: DatasetManifest | null;
  playbackSessionKey?: number;
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

export { formatFrameTime } from './recording/MetadataPanel';

export function RecordingWorkbench(p: RecordingWorkbenchProps) {
  const mainId = useId();
  const metadata = p.opened ? p.metadata : null;
  const sourceManifest = p.opened ? p.manifest : p.preparedInput?.manifest;
  return <div className="recording-workbench">
    <a className="recording-skip" href={`#${mainId}`}>İnceleme alanına geç</a>
    <WorkbenchHeader recording={p.recording} />
    <div className="recording-intro">
      <div><p className="recording-kicker">ARAŞTIRMA ÇALIŞMA ALANI</p><p className="recording-lead">Kaydı görün. Kaynağını anlayın.</p></div>
      <p className="recording-intro-note">Görüntü, metadata ve inceleme kapsamı tek çalışma alanında.</p>
    </div>
    {p.error && <ReaderErrorNotice error={p.error} />}
    <main id={mainId} tabIndex={-1} className="recording-grid" aria-label="Kayıt inceleme alanı">
      <div className="recording-sidebar">
        <RecordingSelection recording={p.recording} opened={p.opened} onOpen={p.onOpen} onClose={p.onClose}
          preparedInput={p.preparedInput} onPrepareInput={p.onPrepareInput} demoRecording={p.demoRecording}
          selectedStream={p.selectedStream} activeStream={p.activeStream} onStreamChange={p.onStreamChange} onOpenReal={p.onOpenReal} />
        <SourcePanel recording={sourceManifest?.recording ?? metadata?.recording ?? p.recording}
          manifest={sourceManifest} sourceInfo={p.opened ? p.sourceInfo : null} />
      </div>
      <div className="recording-primary">
        <FrameViewer {...p}><PlaybackControls {...p} /></FrameViewer>
      </div>
      <MetadataPanel {...p} />
      <div className="recording-bottom">
        <QualityPanel key={p.playbackSessionKey} {...p} report={p.opened ? p.report : null}
          qualityState={p.opened ? p.qualityState : null} qualityRecording={p.opened ? p.qualityRecording : undefined} />
        <ReportPanel {...p} />
      </div>
    </main>
    <footer className="recording-footer"><span>AeroObserve · Kayıt araştırma paneli</span><span>Gösterim temposu, kaynak kayıt zamanı değildir.</span></footer>
  </div>;
}
