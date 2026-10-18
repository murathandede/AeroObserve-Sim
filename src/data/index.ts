// Efe's public entry point. The shared v1 contract is unchanged.
export type { RecordingReader, RecordingInput, ReaderResult, ReaderError, ReaderState, RecordingMetadata, FrameRecord, FrameTime, DatasetManifest } from '../shared/types';
export { withFirstFrame } from './readFirstFrame';
export { TumRecordingReader } from './tum/reader';
export type { TumReaderOptions, TumFrameSource, TumSourceInfo } from './tum/reader';
export { parseTumImageList, parseTumGroundtruth, parseTumAccelerometer } from './tum/text';
export type { TumStream, TumSourceLocation, TumImageRow, TumGroundtruthRow, TumAccelerometerRow, TumParseResult, TumTextIssue } from './tum/text';
export { describeTumTable, getTumTimestampDescription, toTumFrameTime } from './tum/metadata';
export type { TumTableMetadata, TumTableKind, TumTimeUnit, TumMetadataResult, TumDerived, TumDerivedTime, TumTimestampDescription, TumColumnDescription, TumOriginalRow, TumTimestampInput, TumTableScope } from './tum/metadata';
export type { TumFrameMetadata } from './tum/provenance';
export type { TumPngInfo } from './tum/png';
export { decodeTumDepth, tumDepthToMetres } from './tum/depth';
export type { TumDepthData } from './tum/depth';
