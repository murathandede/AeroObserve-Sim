import { useEffect, useState } from 'react';
import type { FrameRecord, QualityReport, ReaderError, RecordingBinding, RecordingMetadata, RecordingReader } from '../shared/types';

/** Owns the single playback clock; UI components never create their own timers. */
export function useRecording(binding: RecordingBinding, opened: boolean, session: number) {
  const [reader, setReader] = useState<RecordingReader | null>(null);
  const [metadata, setMetadata] = useState<RecordingMetadata | null>(null);
  const [frame, setFrame] = useState<FrameRecord | null>(null);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [error, setError] = useState<ReaderError | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const instance = binding.createReader();
    setReader(null); setMetadata(null); setFrame(null); setReport(null); setError(null); setIndex(0); setPlaying(false); setLoading(opened);
    if (opened) {
      void instance.open(binding.input).then(result => {
        if (!active) return;
        setLoading(false);
        if (!result.ok) { setError(result.error); return; }
        setMetadata(result.value); setReport(binding.analyze(result.value)); setReader(instance);
      }).catch(() => {
        if (active) { setLoading(false); setError({ code: 'DECODE_FAILED', message: 'Okuyucu beklenmeyen bir hata verdi.', recovery: 'Kaydı yeniden açın; okuyucu geliştiricisine bildirin.' }); }
      });
    }
    return () => { active = false; void instance.close(); };
  }, [binding, opened, session]);

  useEffect(() => {
    if (!reader || !metadata || metadata.frameCount === 0) return;
    let active = true;
    setLoading(true); setFrame(null); setError(null);
    void reader.getFrame(index).then(result => {
      if (!active) return;
      setLoading(false);
      if (result.ok) setFrame(result.value);
      else { setError(result.error); setPlaying(false); }
    }).catch(() => {
      if (active) { setLoading(false); setPlaying(false); setError({ code: 'DECODE_FAILED', message: 'Kare okunamadı.', recovery: 'Başka kare deneyin veya kaydı yeniden açın.' }); }
    });
    return () => { active = false; };
  }, [reader, metadata, index]);

  useEffect(() => {
    if (!playing || !metadata || !frame || loading || error) return;
    if (index >= metadata.frameCount - 1) { setPlaying(false); return; }
    // Explicit presentation cadence; never written into FrameTime or source metadata.
    const timer = window.setTimeout(() => setIndex(i => i + 1), 1000 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, metadata, frame, loading, error, index, speed]);

  function seek(next: number) {
    setPlaying(false);
    if (metadata && Number.isInteger(next) && next >= 0 && next < metadata.frameCount) setIndex(next);
  }
  return { metadata, frame, report, error, index, playing, speed, loading, seek, setPlaying, setSpeed };
}
