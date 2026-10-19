import { useEffect, useMemo, useRef, useState } from 'react';
import type { FrameRecord, QualityReport, ReaderError, RecordingBinding, RecordingMetadata } from '../shared/types';
import type { TumFrameMetadata, TumSourceInfo, TumTableMetadata } from '../data';
import { ReaderSession } from './readerSession';
import { isApiPosition, isPresentationSpeed, playbackAvailability } from './playbackPolicy';

interface PresentationStep {
  current: boolean;
  playing: boolean;
  count: number;
  index: number;
  frameIndex: number | null;
  loading: boolean;
  failed: boolean;
  speed: number;
}

interface PresentationClock {
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
}

/** One effect-owned step, not a second clock or a loop. Injection permits Node timer tests. */
export function schedulePresentationStep(state: PresentationStep, advance: (index: number) => void,
  stop: () => void, isCurrent: () => boolean, clock: PresentationClock): (() => void) | undefined {
  if (!state.current || !state.playing) return;
  if (state.failed || !isApiPosition(state.index, state.count) || state.index >= state.count - 1 || !isPresentationSpeed(state.speed)) {
    stop(); return;
  }
  if (state.loading || state.frameIndex !== state.index) return;
  let active = true;
  const timer = clock.setTimeout(() => {
    if (active && isCurrent()) advance(state.index + 1);
  }, 1000 / state.speed);
  return () => { active = false; clock.clearTimeout(timer); };
}

/** Owns the single playback clock; UI components never create their own timers. */
export function useRecording(binding: RecordingBinding, opened: boolean, session: number) {
  const owner = useMemo(() => ({}), [binding, opened, session]);
  const renderedOwner = useRef(owner);
  renderedOwner.current = owner;
  const clockRevision = useRef(0);
  const [stateOwner, setStateOwner] = useState<object | null>(null);
  const [reader, setReader] = useState<ReaderSession | null>(null);
  const [metadata, setMetadata] = useState<RecordingMetadata | null>(null);
  const [details, setDetails] = useState<{ sourceInfo: TumSourceInfo | null; tableMetadata: TumTableMetadata | null; error: ReaderError | null }>({ sourceInfo: null, tableMetadata: null, error: null });
  const [frame, setFrame] = useState<FrameRecord | null>(null);
  const [frameMetadata, setFrameMetadata] = useState<TumFrameMetadata | null>(null);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [error, setError] = useState<ReaderError | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, updatePlaying] = useState(false);
  const [speed, updateSpeed] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStateOwner(owner);
    setDetails({ sourceInfo: null, tableMetadata: null, error: null });
    setReader(null); setMetadata(null); setFrame(null); setFrameMetadata(null); setReport(null); setError(null); setIndex(0); updatePlaying(false); setLoading(opened);
    if (!opened) return;
    const instance = new ReaderSession(binding);
    let active = true;
    void instance.open().then(result => {
        if (!active || !result) return;
        setLoading(false);
        if (!result.ok) { setError(result.error); return; }
        const source = instance.getSourceInfo();
        const table = instance.getTableMetadata();
        setDetails({ sourceInfo: source?.ok ? source.value : null, tableMetadata: table?.ok ? table.value : null,
          error: source && !source.ok ? source.error : table && !table.ok ? table.error : null });
        setMetadata(result.value); setReport(binding.analyze(result.value)); setReader(instance);
      }).catch(() => {
        if (active) { setLoading(false); setError({ code: 'DECODE_FAILED', message: 'Okuyucu beklenmeyen bir hata verdi.', recovery: 'Kaydı yeniden açın; okuyucu geliştiricisine bildirin.' }); }
      });
    return () => {
      active = false;
      void instance.close().then(error => { if (error) console.error(error.message); });
    };
  }, [binding, opened, owner]);

  useEffect(() => {
    if (!opened || stateOwner !== owner || !reader || !metadata || metadata.frameCount === 0) return;
    let active = true;
    setLoading(true); setFrame(null); setFrameMetadata(null); setError(null);
    void reader.getFrame(index).then(result => {
      if (!active || !result) return;
      setLoading(false);
      if (result.ok) { setFrame(result.value.frame); setFrameMetadata(result.value.frameMetadata); }
      else { setError(result.error); updatePlaying(false); }
    }).catch(() => {
      if (active) { setLoading(false); updatePlaying(false); setError({ code: 'DECODE_FAILED', message: 'Kare okunamadı.', recovery: 'Kaydı yeniden açın.' }); }
    });
    return () => { active = false; reader.cancelFrame(); };
  }, [reader, metadata, index, opened, owner, stateOwner]);

  useEffect(() => {
    const revision = clockRevision.current;
    return schedulePresentationStep({ current: opened && stateOwner === owner, playing,
      count: metadata?.frameCount ?? 0, index, frameIndex: frame?.index ?? null, loading, failed: !!error, speed },
      setIndex, () => updatePlaying(false),
      () => renderedOwner.current === owner && clockRevision.current === revision, window);
  }, [playing, metadata, frame, loading, error, index, speed, opened, owner, stateOwner]);

  function seek(next: number) {
    if (!availability.navigable || !isApiPosition(next, metadata?.frameCount ?? 0)) return;
    clockRevision.current++;
    updatePlaying(false);
    setIndex(next);
  }
  function setPlaying(next: boolean) {
    if (next === playing || (next && !availability.play)) return;
    clockRevision.current++;
    updatePlaying(next);
  }
  function setSpeed(next: number) {
    if (!isPresentationSpeed(next) || next === speed) return;
    clockRevision.current++;
    updateSpeed(next);
  }
  // Hide previous-session data during render, before effect cleanup/setup has run.
  const current = opened && stateOwner === owner;
  const visibleFrame = current && frame?.index === index ? frame : null;
  const visibleLoading = opened && (!current || loading || (!!metadata?.frameCount && !visibleFrame && !error));
  const availability = playbackAvailability(current && !!reader, metadata?.frameCount ?? 0, index, visibleLoading, !!error, playing);
  return {
    metadata: current ? metadata : null, frame: visibleFrame,
    frameMetadata: visibleFrame ? frameMetadata : null,
    sourceInfo: current ? details.sourceInfo : null, tableMetadata: current ? details.tableMetadata : null,
    metadataError: current ? details.error : null, manifest: current ? binding.input.manifest : null,
    report: current ? report : null, error: current ? error : null,
    index: current ? index : 0, playing: current && playing, speed,
    loading: visibleLoading,
    seek, setPlaying, setSpeed,
  };
}
