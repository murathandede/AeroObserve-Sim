import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { EmptyState, Panel } from './Panel';
import { completedReportContext, ReportDownloadLease, triggerJsonDownload, type ReportSelection } from './reportDownload';

export function ReportPanel(p: ReportSelection) {
  const helpId = useId();
  const context = useMemo(() => completedReportContext(p),
    [p.opened, p.qualityTarget, p.qualityState, p.metadata, p.sourceInfo, p.activeStream]);
  const lease = useMemo(() => new ReportDownloadLease(), [context]);
  const live = useRef(context); live.current = context;
  const [notice, setNotice] = useState<{ owner: typeof context; error: boolean; text: string } | null>(null);
  useEffect(() => {
    live.current = context;
    return () => { if (live.current === context) live.current = null; lease.clear(); };
  }, [context, lease]);
  const visible = notice?.owner === context ? notice : null;
  return <Panel title="İnceleme raporu" label="RAPORLAMA" className="recording-report">
    <span className="recording-tag">{context ? 'Tamamlanmış analiz · JSON hazır' : 'Tamamlanmış aktif analiz bekleniyor'}</span>
    {context ? <>
      <p className="recording-note">{context.target.recording.name} · {context.target.stream.toUpperCase()} · {context.analysis.report.scope}</p>
      <p className="recording-note">Rapor mevcut analizden hazırlanır; yeniden analiz başlatılmaz. Bulgular, kaynak, lisans, kapsam ve sınırlamalar Efe'nin rapor biçiminde korunur.</p>
    </> : <EmptyState title="İndirilebilir analiz yok">Gerçek kaydı açıp kalite analizini tamamlayın. Çalışan, iptal edilen, kısmi veya hatalı analiz ve sentetik demo dışa aktarılmaz.</EmptyState>}
    <p id={helpId} className="recording-note">Metadata-only, tüm sensör kaydının veya tüm görüntülerin doğrulandığı anlamına gelmez. Dosya adı aktif kayıt ve akış kimliğini içerir.</p>
    <button type="button" disabled={!context} aria-describedby={helpId} onClick={() => {
      if (!context || live.current !== context) return;
      const result = lease.download(context, () => live.current === context, triggerJsonDownload);
      if (live.current !== context) return;
      setNotice({ owner: context, error: !result.ok, text: result.ok
        ? `İndirme isteği tarayıcıya iletildi: ${result.value.filename}. Dosyanın kaydedilmesini tarayıcı yönetir.`
        : `${result.error.code}: ${result.error.message} ${result.error.recovery}` });
    }}>JSON raporu indir</button>
    {visible && <p role={visible.error ? 'alert' : 'status'} className={visible.error ? 'recording-input-error' : 'recording-note'}>{visible.text}</p>}
  </Panel>;
}
