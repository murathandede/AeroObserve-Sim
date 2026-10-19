import { useState } from 'react';
import type { RecordingBinding, RecordingInput } from '../shared/types';
import type { TumStream } from '../data';
import { createTumRecordingBinding } from './recordingBinding';
import { useRecording } from '../playback/useRecording';
import { RecordingWorkbench } from '../ui/RecordingWorkbench';
import { useQualityAnalysis } from '../ui/recording/useQualityAnalysis';

export function RecordingWorkspace({ binding }: { binding: RecordingBinding }) {
  const [opened, setOpened] = useState(false);
  const [session, setSession] = useState(0);
  const [preparedInput, setPreparedInput] = useState<RecordingInput | null>(null);
  const [selectedStream, setSelectedStream] = useState<TumStream>('rgb');
  const [active, setActive] = useState<{ binding: RecordingBinding; stream?: TumStream } | null>(null);
  const [lastRecording, setLastRecording] = useState(binding.input.manifest.recording);
  const [closedReason, setClosedReason] = useState<'unselected' | 'ready' | 'closed'>('unselected');
  const model = useRecording(active?.binding ?? binding, opened, session);
  const quality = useQualityAnalysis(active?.binding ?? null, opened, session, model.metadata, model.sourceInfo, active?.stream);

  function close(reason: typeof closedReason = 'closed') {
    setOpened(false); setActive(null); setClosedReason(reason); setSession(s => s + 1);
  }
  function prepare(input: RecordingInput | null) {
    setPreparedInput(input);
    close(input ? 'ready' : 'unselected');
  }
  function changeStream(stream: TumStream) {
    if (stream === selectedStream) return;
    setSelectedStream(stream);
    close(preparedInput ? 'ready' : 'unselected');
  }
  function openReal() {
    if (!preparedInput) return;
    setActive({ binding: createTumRecordingBinding(preparedInput, selectedStream), stream: selectedStream });
    setLastRecording(preparedInput.manifest.recording); setOpened(true); setSession(s => s + 1);
  }
  function openDemo() {
    setActive({ binding }); setLastRecording(binding.input.manifest.recording);
    setOpened(true); setSession(s => s + 1);
  }
  return <RecordingWorkbench {...model} {...quality} recording={active?.binding.input.manifest.recording ?? lastRecording} opened={opened}
    demoRecording={binding.input.manifest.recording} closedReason={closedReason} playbackSessionKey={session}
    preparedInput={preparedInput} onPrepareInput={prepare}
    selectedStream={selectedStream} activeStream={active?.stream} onStreamChange={changeStream} onOpenReal={openReal}
    onOpen={openDemo}
    onClose={() => close()}
    onSeek={model.seek} onPlayingChange={model.setPlaying} onSpeedChange={model.setSpeed}/>;
}
