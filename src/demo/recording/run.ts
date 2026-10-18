import { withFirstFrame } from '../../data/readFirstFrame';
import { exampleInput } from './example';
import { SyntheticRecordingReader } from './reader';
const result = await withFirstFrame(new SyntheticRecordingReader(), exampleInput, (metadata, frame) => {
  console.log(metadata.recording.name);
  console.log(`Kare sayısı: ${metadata.frameCount}; ilk indeks: ${frame.index}; zaman: ${frame.time.kind}; sıcaklık: ${frame.temperature ? 'var' : 'yok'}`);
});
if (!result.ok) { console.error(result.error); process.exitCode = 1; }
