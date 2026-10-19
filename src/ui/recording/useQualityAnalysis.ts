import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecordingBinding, RecordingMetadata } from '../../shared/types';
import type { TumSourceInfo, TumStream } from '../../data';
import { activeQualityTarget, QualityAnalysisController, type QualityAnalysisState } from './qualityController';

/** Bound to the Workspace's active binding/session, never to its prepared selection. */
export function useQualityAnalysis(binding: RecordingBinding | null, opened: boolean, session: number,
  metadata: RecordingMetadata | null, source: TumSourceInfo | null, stream?: TumStream) {
  const owner = useMemo(() => ({}), [binding, opened, session, stream]);
  const liveOwner = useRef(owner); liveOwner.current = owner;
  const target = useMemo(() => activeQualityTarget(owner, binding, opened, metadata, source, stream), [owner, binding, opened, metadata, source, stream]);
  const [snapshot, setSnapshot] = useState<{ owner: object; controller: QualityAnalysisController; state: QualityAnalysisState } | null>(null);

  useEffect(() => {
    if (!target) { setSnapshot(null); return; }
    // Create inside the effect: StrictMode cleanup/setup must get a fresh controller.
    const controller = new QualityAnalysisController(target, state => {
      if (liveOwner.current === owner) setSnapshot({ owner, controller, state });
    });
    setSnapshot({ owner, controller, state: controller.getSnapshot() });
    return () => controller.dispose();
  }, [target, owner]);

  const current = !!target && snapshot?.owner === owner;
  return {
    // The export UI needs this active input, never the merely prepared selection.
    qualityTarget: current ? target : null,
    qualityState: current ? snapshot.state : null,
    qualityRecording: target?.recording,
    qualityStream: target?.stream,
    qualityMode: target?.mode,
    qualityUnavailableReason: !opened ? 'Analiz için hazırlanmış seçimi gerçek kayıtta açın.'
      : binding?.input.manifest.recording.provenance === 'synthetic' ? 'Sentetik örnekte gerçek TUM analizi çalıştırılmaz.'
        : !target ? 'Aktif TUM reader metadata’sı ve akış kapsamı bekleniyor.' : !current ? 'Analiz bağlantısı hazırlanıyor.' : undefined,
    onAnalyze: (inspectImages: boolean) => { if (current && liveOwner.current === owner) void snapshot.controller.start(inspectImages); },
    onCancelAnalysis: () => { if (current && liveOwner.current === owner) snapshot.controller.cancel(); },
  };
}
