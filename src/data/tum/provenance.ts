import type { Known } from '../../shared/types';
import type { TumPngInfo } from './png';
import type { TumFrameSource, TumReaderOptions } from './reader';

/** File-derived facts and API selection are deliberately separate. No pixel values are inferred. */
export interface TumFrameMetadata {
  original: {
    stream: TumReaderOptions['stream'];
    sourceFile: string;
    sourceListFile: string;
    lineNumber: number;
    sourceIndex: number;
    timestampRaw: string;
    timestampValue: number;
    timestampUnit: 'unknown';
    clockOrigin: string;
    png: { status: 'not-read' } | { status: 'verified'; value: TumPngInfo; source: string };
    measurementUnit: Known<string>;
    documentedDepthConversion: null | { divisor: 5000; outputUnit: 'metres'; invalidRawValue: 0; evidence: string; appliedToPreview: false };
  };
  derived: {
    apiIndex: {
      value: number;
      unit: 'index';
      inputs: { file: string; lineNumber: number; sourceIndex: number };
      method: string;
      scope: { kind: 'selected-stream'; stream: TumReaderOptions['stream']; mode: TumReaderOptions['mode'] };
    };
  };
}

export function describeTumFrame(
  source: TumFrameSource,
  listFile: string,
  options: TumReaderOptions,
  png?: TumPngInfo,
): TumFrameMetadata {
  const evidence = 'https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats';
  return {
    original: {
      stream: options.stream, sourceFile: source.file, sourceListFile: listFile,
      lineNumber: source.lineNumber, sourceIndex: source.sourceIndex,
      timestampRaw: source.timestampRaw, timestampValue: source.timestampValue,
      timestampUnit: 'unknown', clockOrigin: 'Bu TXT akışının fiziksel saat başlangıcı/pozlama saati kaynak belgelerinde doğrulanmadı.',
      png: png ? { status: 'verified', value: { ...png }, source: `${source.file}: PNG IHDR ve zlib/scanline doğrulaması` } : { status: 'not-read' },
      measurementUnit: options.stream === 'depth'
        ? { status: 'known', value: 'encoded-uint16', evidence }
        : { status: 'known', value: '8-bit RGB channel code; fiziksel radyometrik birim yok', evidence },
      documentedDepthConversion: options.stream === 'depth'
        ? { divisor: 5000, outputUnit: 'metres', invalidRawValue: 0, evidence, appliedToPreview: false }
        : null,
    },
    derived: {
      apiIndex: {
        value: source.apiIndex, unit: 'index',
        inputs: { file: listFile, lineNumber: source.lineNumber, sourceIndex: source.sourceIndex },
        method: 'Seçili manifest/tam-akış satırlarının özgün kaynak sırasındaki kesintisiz sıfır tabanlı sırası; timestamp sıralaması uygulanmaz.',
        scope: { kind: 'selected-stream', stream: options.stream, mode: options.mode },
      },
    },
  };
}
