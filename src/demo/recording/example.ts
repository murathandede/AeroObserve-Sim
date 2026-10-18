import type { DatasetManifest, RecordingBinding, RecordingInput } from '../../shared/types';
import { analyzeMetadata } from '../../quality';
import { SyntheticRecordingReader } from './reader';

export const exampleManifest: DatasetManifest = {
  contractVersion: 1,
  recording: { id: 'synthetic-ui-v1', name: 'GELİŞTİRME ÖRNEĞİ — SENTETİK', provenance: 'synthetic', source: { title: 'Repo içindeki özgün SVG geliştirme görselleri', url: null }, license: { status: 'known', value: 'CC0-1.0 (yalnızca bu üç örnek SVG)', evidence: 'src/demo/recording/README.md' } },
  format: { status: 'known', value: 'synthetic-svg-v1', evidence: 'src/demo/recording/reader.ts' },
  acquisition: { instructions: 'Repo ile gelir; indirme gerekmez.', files: ['frame-0.svg', 'frame-1.svg', 'frame-2.svg'] },
  timing: { kind: 'unknown', timeBase: null, description: 'Bu çizimlerin kayıt zaman damgası ve örnekleme hızı yoktur.', nominalFps: { status: 'unknown' } },
  radiometry: { status: 'unavailable', unit: null, evidence: 'Temsili çizimlerdir; sıcaklık ölçümü içermez.' },
  citation: null, versionOrAccessDate: 'v1',
};
export const exampleInput: RecordingInput = { manifest: exampleManifest, files: new Map() };
export const exampleBinding: RecordingBinding = { createReader: () => new SyntheticRecordingReader(), input: exampleInput, analyze: analyzeMetadata };
