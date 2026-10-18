export interface Position2D { x: number; y: number }
export interface SimConfig { seed: number; durationSeconds: number }
export interface WorldObject { id: string; position: Position2D; velocity: Position2D; thermalIntensity: number }
export interface WorldFrame { timeSeconds: number; objects: WorldObject[] }
export interface SensorObservation { id: string; sensorId: string; observedAtSeconds: number; receivedAtSeconds: number; position: Position2D; quality: number }
export interface SensorFrame { sensorId: string; timeSeconds: number; observations: SensorObservation[]; available: boolean }
export interface ThermalFrame { timeSeconds: number; width: number; height: number; pixels: number[]; available: boolean }
export interface SimulationEvent { timeSeconds: number; severity: 'info' | 'warning'; source: string; message: string }

// Recording contract v1. Coordinate changes with the team; legacy demo types above stay intact.
export const RECORDING_CONTRACT_VERSION = 1 as const;
export type Known<T> = { status: 'known'; value: T; evidence: string } | { status: 'unknown' };
export type FrameTime =
  | { kind: 'original'; seconds: number; timeBase: string; source: string }
  | { kind: 'derived'; seconds: number; timeBase: string; method: string }
  | { kind: 'unknown' };
export interface RecordingInfo {
  id: string;
  name: string;
  provenance: 'real' | 'synthetic';
  source: { title: string; url: string | null };
  license: Known<string>;
}
export interface DatasetManifest {
  contractVersion: 1;
  recording: RecordingInfo;
  format: Known<string>;
  acquisition: { instructions: string; files: string[] };
  timing: { kind: 'original' | 'derived' | 'unknown'; timeBase: string | null; description: string; nominalFps: Known<number> };
  radiometry: { status: 'available' | 'unavailable' | 'unknown'; unit: string | null; evidence: string };
  citation: string | null;
  versionOrAccessDate: string | null;
}
export interface FrameRecord {
  index: number;
  image: { url: string; width: number; height: number; alt: string };
  time: FrameTime;
  // Omit unless actual, documented radiometric data exists.
  temperature?: { unit: 'C' | 'K'; values: readonly number[] };
}
export interface RecordingMetadata {
  recording: RecordingInfo;
  frameCount: number;
  format: string;
  timing: DatasetManifest['timing'];
  radiometry: DatasetManifest['radiometry'];
  reader: { id: string; version: string };
}
export interface ReaderError {
  code: 'NOT_OPEN' | 'UNSUPPORTED_FORMAT' | 'MISSING_FILE' | 'INVALID_INDEX' | 'DECODE_FAILED' | 'CLOSED' | 'INVALID_MANIFEST';
  message: string;
  recovery: string;
  file?: string;
}
export type ReaderResult<T> = { ok: true; value: T } | { ok: false; error: ReaderError };
export type ReaderState =
  | { status: 'idle' | 'opening' | 'ready' | 'closed' }
  | { status: 'error'; error: ReaderError };
export interface RecordingInput {
  manifest: DatasetManifest;
  // Keys are manifest-relative paths, never absolute machine paths.
  files: ReadonlyMap<string, Blob>;
}
export interface RecordingReader {
  getState(): ReaderState;
  open(input: RecordingInput): Promise<ReaderResult<RecordingMetadata>>;
  getMetadata(): ReaderResult<RecordingMetadata>;
  getFrame(index: number): Promise<ReaderResult<FrameRecord>>;
  close(): Promise<void>;
}
export interface QualityIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  recordingId: string;
  frameIndex?: number;
  message: string;
  rule: string;
}
export interface QualityReport {
  recordingId: string;
  scope: 'metadata-only' | 'full-recording';
  issues: readonly QualityIssue[];
  unsupported: readonly string[];
}
export interface RecordingBinding {
  createReader: () => RecordingReader;
  input: RecordingInput;
  analyze: (metadata: RecordingMetadata) => QualityReport;
}
