import { useState, type ReactNode } from 'react';
import type { FrameRecord } from '../../shared/types';
import type { RecordingWorkbenchProps } from '../RecordingWorkbench';
import { EmptyState, Panel } from './Panel';
import { frameAtPosition, matchingFrameMetadata } from './metadataPresentation';

function FrameImage({ frame }: { frame: FrameRecord }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  return status === 'error'
    ? <div role="alert"><EmptyState title="Görüntü yüklenemedi">Kaydı yeniden açın ve dosya referansını kontrol edin.</EmptyState></div>
    : <div className="recording-image-content" aria-busy={status === 'loading'}>
      <p role="status" className="recording-note">{status === 'loading' ? 'Görüntü tarayıcıda yükleniyor…' : 'Kare görüntüleniyor.'}</p>
      <img src={frame.image.url} width={frame.image.width} height={frame.image.height} alt={frame.image.alt}
        onLoad={() => setStatus('ready')} onError={() => setStatus('error')} />
    </div>;
}

export function FrameViewer(p: Pick<RecordingWorkbenchProps, 'recording' | 'opened' | 'loading' | 'error' | 'frame'> &
  Partial<Pick<RecordingWorkbenchProps, 'metadata' | 'activeStream' | 'frameMetadata' | 'closedReason' | 'index' | 'sourceInfo'>> & { children?: ReactNode }) {
  const candidate = p.opened && !p.loading && !p.error ? frameAtPosition(p.frame, p.index, p.metadata?.frameCount) : null;
  const identity = p.recording.provenance === 'real' ? matchingFrameMetadata(candidate, p.frameMetadata, p.index, p.activeStream, p.sourceInfo)?.original : null;
  const mismatched = !!candidate && p.recording.provenance === 'real' && !!p.frameMetadata && !identity;
  const visibleFrame = mismatched ? null : candidate;
  const stream = identity?.stream ?? p.activeStream;
  const closedTitle = p.closedReason === 'ready' ? 'Dosyalar hazır; kayıt açılmadı' : p.closedReason === 'unselected' ? 'Kayıt seçilmedi' : p.closedReason === 'closed' ? 'Kayıt kapatıldı' : 'Kayıt kapalı';
  return <Panel title="Kayıt görüntüsü" label="GÖRÜNTÜLEME" className="recording-view">
    <div className="recording-view-caption"><span>{p.recording.provenance === 'synthetic' ? 'SENTETİK ÖRNEK GÖRÜNÜMÜ' : `${stream?.toUpperCase() ?? 'GERÇEK KAYNAK'} · GÖRSEL ÖNİZLEME`}</span><span>{visibleFrame ? `${visibleFrame.image.width} × ${visibleFrame.image.height} px · API ${visibleFrame.index}` : 'Görüntü yok'}</span></div>
    <div className="recording-image" aria-busy={p.loading}>
      {!p.opened ? <EmptyState title={closedTitle}>Gerçek dosyaları hazırlayıp RGB veya Depth akışını seçin ve kaydı açın. Sentetik geliştirme örneği ayrı bir eylemle açılır.</EmptyState>
        : p.loading ? <div role="status"><EmptyState title={p.metadata ? 'Kare yükleniyor…' : 'Reader açılıyor…'}>İşlem tamamlandığında okuyucunun sağladığı görüntü burada görünecek.</EmptyState></div>
          : p.error ? <EmptyState title="Kare gösterilemiyor">Okuma hatasını ve düzeltme önerisini inceleyin. Örnek veriye otomatik geçilmedi.</EmptyState>
            : mismatched ? <div role="alert"><EmptyState title="Kare kimliği eşleşmiyor">Görüntü ve metadata aynı API pozisyonu/akışa ait değil. Kaydı yeniden açın.</EmptyState></div>
              : visibleFrame ? <FrameImage key={`${visibleFrame.index}-${visibleFrame.image.url}`} frame={visibleFrame} />
              : <EmptyState title="Görüntülenecek kare yok">Açık kayıt için görüntü içeriği bulunmuyor.</EmptyState>}
    </div>
    <p className="recording-view-note">{p.recording.provenance === 'synthetic' ? 'Geliştirme çizimi · Gerçek sensör kaydı veya ölçüm değildir.' : stream === 'depth' ? 'Depth: 16-bit derinlik PNG’sinin görsel önizlemesi. Parlaklık ve renkler sıcaklık veya sayısal derinlik ölçümü değildir; ham değerler dönüştürülmedi.' : stream === 'rgb' ? 'RGB: görünür görüntü önizlemesi; sıcaklık ölçümü değildir.' : 'Gerçek kaynak seçimi · RGB ve depth bağımsız akışlardır; önizleme sayısal ölçüm değildir.'}</p>
    {identity && <dl className="recording-frame-identity recording-facts">
      <div><dt>Kaynak dosya</dt><dd>{identity.sourceFile}</dd></div>
      <div><dt>Özgün kaynak kare indeksi</dt><dd>{identity.sourceIndex}</dd></div>
      <div><dt>Özgün zaman tokeni</dt><dd>{identity.timestampRaw} · Birim: {identity.timestampUnit === 'unknown' ? 'bilinmiyor' : identity.timestampUnit}</dd></div>
    </dl>}
    {p.children}
  </Panel>;
}
