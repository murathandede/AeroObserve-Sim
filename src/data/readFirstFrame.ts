import type { FrameRecord, ReaderResult, RecordingInput, RecordingMetadata, RecordingReader } from '../shared/types';

/** Efe → Derviş usage example. Returned image is used only while the reader is open. */
export async function withFirstFrame(
  reader: RecordingReader,
  input: RecordingInput,
  consume: (metadata: RecordingMetadata, frame: FrameRecord) => void | Promise<void>,
): Promise<ReaderResult<void>> {
  try {
    const opened = await reader.open(input);
    if (!opened.ok) return opened;
    const metadata = reader.getMetadata();
    if (!metadata.ok) return metadata;
    const frame = await reader.getFrame(0);
    if (!frame.ok) return frame;
    await consume(metadata.value, frame.value);
    return { ok: true, value: undefined };
  } finally { await reader.close(); }
}
