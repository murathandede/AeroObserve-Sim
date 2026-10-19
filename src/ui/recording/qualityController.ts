import type { RecordingBinding, RecordingInfo, RecordingMetadata } from '../../shared/types';
import type { TumSourceInfo, TumStream } from '../../data';
import { analyzeTumRecording, type TumQualityAnalysis, type TumQualityOptions } from '../../quality';

/** UI job identity only; all quality data remains Efe's unchanged result. */
export interface QualityTarget {
  owner: object;
  input: RecordingBinding['input'];
  recording: RecordingInfo;
  stream: TumStream;
  mode: TumQualityOptions['mode'];
}

export function activeQualityTarget(owner: object, binding: RecordingBinding | null, opened: boolean,
  metadata: RecordingMetadata | null, source: TumSourceInfo | null | undefined, stream?: TumStream): QualityTarget | null {
  if (!opened || !binding || !metadata || !source || !stream || binding.input.manifest.recording.provenance !== 'real' ||
    metadata.recording.provenance !== 'real' || metadata.recording.id !== binding.input.manifest.recording.id ||
    source.stream !== stream || source.frameCount !== metadata.frameCount) return null;
  return { owner, input: binding.input, recording: metadata.recording, stream, mode: source.mode };
}

export interface QualityAnalysisState {
  status: 'idle' | 'running' | 'completed' | 'partial' | 'cancelled' | 'error';
  analysis: TumQualityAnalysis | null;
  error: string | null;
  runId: number;
  inspectImages: boolean;
}

const initialState = (): QualityAnalysisState => ({ status: 'idle', analysis: null, error: null, runId: 0, inspectImages: false });

/** One active session's analysis job. No reader, decoder, clock, or quality algorithm. */
export class QualityAnalysisController {
  private state = initialState();
  private generation = 0;
  private abort: AbortController | null = null;
  private disposed = false;
  constructor(private target: QualityTarget | null, private notify: ((state: QualityAnalysisState) => void) | null,
    private readonly run: typeof analyzeTumRecording = analyzeTumRecording) {}

  getSnapshot() { return this.state; }
  private publish(state: QualityAnalysisState) { this.state = state; this.notify?.(state); }

  async start(inspectImages: boolean): Promise<void> {
    const target = this.target;
    if (this.disposed || !target || this.state.status === 'running') return;
    this.abort?.abort();
    const abort = new AbortController(); this.abort = abort;
    const request = ++this.generation;
    const current = () => !this.disposed && request === this.generation;
    this.publish({ status: 'running', analysis: null, error: null, runId: request, inspectImages });
    try {
      const analysis = await this.run(target.input, { mode: target.mode, streams: [target.stream], inspectImages, signal: abort.signal });
      if (!current()) return;
      const matches = analysis.report.recordingId === target.recording.id && analysis.coverage.streams.length === 1 &&
        analysis.coverage.streams[0] === target.stream && analysis.coverage.selectionMode === target.mode &&
        analysis.coverage.inspectionRequested === inspectImages;
      if (abort.signal.aborted) {
        // Keep only an acknowledged engine cancellation, never a late completed result.
        if (matches && analysis.coverage.cancelled) this.publish({ ...this.state, status: 'cancelled', analysis });
        return;
      }
      if (!matches) throw new Error('Analiz sonucu aktif kayıt, akış veya istenen kapsamla eşleşmiyor.');
      this.publish({ ...this.state, analysis, error: null,
        status: analysis.coverage.cancelled ? 'cancelled' : analysis.coverage.completed ? 'completed' : 'partial' });
    } catch (error) {
      if (current() && !abort.signal.aborted) this.publish({ ...this.state, status: 'error', analysis: null,
        error: error instanceof Error ? error.message : 'Kalite analizi tamamlanamadı.' });
    } finally { if (current()) this.abort = null; }
  }

  cancel() {
    if (this.disposed || this.state.status !== 'running') return;
    this.abort?.abort();
    this.publish({ ...this.state, status: 'cancelled', analysis: null, error: null });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; ++this.generation;
    this.abort?.abort(); this.abort = null; this.notify = null; this.target = null; this.state = initialState();
  }
}
