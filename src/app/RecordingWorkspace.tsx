import { useState } from 'react';
import type { RecordingBinding } from '../shared/types';
import { useRecording } from '../playback/useRecording';
import { RecordingWorkbench } from '../ui/RecordingWorkbench';

export function RecordingWorkspace({ binding }: { binding: RecordingBinding }) {
  const [opened, setOpened] = useState(false);
  const [session, setSession] = useState(0);
  const model = useRecording(binding, opened, session);
  return <RecordingWorkbench {...model} recording={binding.input.manifest.recording} opened={opened}
    onOpen={() => { setSession(s => s + 1); setOpened(true); }}
    onClose={() => setOpened(false)}
    onSeek={model.seek} onPlayingChange={model.setPlaying} onSpeedChange={model.setSpeed}/>;
}
