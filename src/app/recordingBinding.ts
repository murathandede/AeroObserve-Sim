import type { RecordingBinding, RecordingInput } from '../shared/types';
import { TumRecordingReader, type TumStream } from '../data';
import { analyzeMetadata } from '../quality';
import { exampleBinding } from '../demo/recording/example';

// The original synthetic entry remains an explicit user choice.
export const recordingBinding: RecordingBinding = exampleBinding;

export function createTumRecordingBinding(input: RecordingInput, stream: TumStream): RecordingBinding {
  return { input, createReader: () => new TumRecordingReader({ stream, mode: 'manifest-subset' }), analyze: analyzeMetadata };
}
