import { useId, useMemo, useState } from 'react';
import type { QualityReport, RecordingInfo } from '../../shared/types';
import type { TumStream } from '../../data';
import type { TumQualityAnalysis, TumQualityOptions } from '../../quality';
import type { QualityAnalysisState, QualityTarget } from './qualityController';
import { qualityIssuePage, severityLabels, type SeverityFilter } from './qualityPresentation';
import { QualityIntervals } from './QualityIntervals';
import { metadataIndex, metadataText } from './metadataPresentation';
import { EmptyState, Panel } from './Panel';

export interface QualityControlsProps {
  qualityTarget?: QualityTarget | null;
  qualityState?: QualityAnalysisState | null;
  qualityRecording?: RecordingInfo;
  qualityStream?: TumStream;
  qualityMode?: TumQualityOptions['mode'];
  qualityUnavailableReason?: string;
  onAnalyze?: (inspectImages: boolean) => void;
  onCancelAnalysis?: () => void;
}

function AnalysisActions(p: QualityControlsProps & { available: boolean }) {
  const [inspectImages, setInspectImages] = useState(false);
  const helpId = useId();
  const running = p.qualityState?.status === 'running';
  return <form className="recording-analysis-actions" onSubmit={event => {
    event.preventDefault(); if (p.available && !running) p.onAnalyze?.(inspectImages);
  }}>
    <label><input type="checkbox" checked={inspectImages} disabled={!p.available || running}
      aria-describedby={helpId} onChange={event => setInspectImages(event.target.checked)} />Seçili akışın PNG yapısını da incele</label>
    <p id={helpId} className="recording-note">Dört TXT tablosu bağımsız incelenir. PNG incelemesi yalnız aktif akışın açık kapsamına uygulanır; CRC/zlib/yapı kontrolüdür, fiziksel görüntü kalitesi değildir. İşlem kullanıcı başlatmadan çalışmaz.</p>
    <div className="recording-toolbar">
      <button type="submit" className="recording-primary-button" disabled={!p.available || running}>Analizi başlat</button>
      <button type="button" disabled={!running || !p.onCancelAnalysis} onClick={() => p.onCancelAnalysis?.()}>Analizi iptal et</button>
    </div>
  </form>;
}

function QualityFindings({ analysis }: { analysis: TumQualityAnalysis }) {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [page, setPage] = useState(0);
  const data = useMemo(() => qualityIssuePage(analysis.report, filter, page), [analysis.report, filter, page]);
  const details = useMemo(() => new Map(analysis.details.map(detail => [detail.issueIndex, detail])), [analysis]);
  return <section className="recording-quality-section" aria-label="Kalite bulguları">
    <h3>Kalite Bulguları</h3>
    <label className="recording-quality-filter">Önem filtresi <select value={filter} onChange={event => { setFilter(event.target.value as SeverityFilter); setPage(0); }}>
      <option value="all">Tüm sorunlar</option><option value="error">Hatalar</option><option value="warning">Uyarılar</option><option value="info">Bilgilendirmeler</option>
    </select></label>
    <p className="recording-note" role="status">Toplam {data.total} bulgu · filtrede {data.filtered} · bu sayfada {data.rows.length}. Önce hata, sonra uyarı ve bilgi; motor sonucu değiştirilmez.</p>
    {!data.filtered ? <p className="recording-note">{data.total ? 'Bu filtrede bulgu yok.' : analysis.coverage.completed && !analysis.coverage.cancelled ? 'İncelenen kapsamda sorun tespit edilmedi. Bu, tüm veri setinin hatasız olduğu anlamına gelmez.' : 'Bu kısmi/iptal edilmiş çıktıda henüz bulgu yok; kontrol tamamlanmış sayılmaz.'}</p>
      : <ul className="recording-issues">{data.rows.map(({ issue, issueIndex }) => {
        const detail = details.get(issueIndex);
        return <li key={issueIndex}>
          <span className={`recording-severity recording-severity-${issue.severity}`}>{severityLabels[issue.severity]}</span>
          <div><strong>{issue.message}</strong><p className="recording-note">{issue.code} · kayıt {issue.recordingId}</p><p className="recording-rule">Kural: {issue.rule}</p>
            <dl className="recording-facts">
              <div><dt>Kaynak dosya</dt><dd>{metadataText(detail?.file)}</dd></div>
              {detail?.sourceListFile && <div><dt>Kaynak liste dosyası</dt><dd>{detail.sourceListFile}</dd></div>}
              {detail?.stream && <div><dt>Akış</dt><dd>{detail.stream.toUpperCase()}</dd></div>}
              {detail?.lineNumber !== undefined && <div><dt>Fiziksel kaynak satırı · 1 tabanlı</dt><dd>{metadataIndex(detail.lineNumber)}</dd></div>}
              {detail?.sourceIndex !== undefined && <div><dt>Özgün kaynak indeksi</dt><dd>{metadataIndex(detail.sourceIndex)}</dd></div>}
              {(detail?.apiIndex !== undefined || issue.frameIndex !== undefined) && <div><dt>Seçili kapsamın API pozisyonu</dt><dd>{metadataIndex(detail?.apiIndex ?? issue.frameIndex)}</dd></div>}
              {detail?.timestampRaw !== undefined && <div><dt>Ham zaman tokeni</dt><dd><code className="recording-raw-token">{detail.timestampRaw}</code></dd></div>}
            </dl>
            {detail?.originalLine && <details><summary>Özgün satır</summary><code className="recording-raw-token">{detail.originalLine}</code></details>}
            {detail?.previous && <details><summary>İlgili önceki kaynak</summary><p className="recording-note">{detail.previous.file} · satır {metadataIndex(detail.previous.lineNumber)} · kaynak indeksi {metadataIndex(detail.previous.sourceIndex)} · <code>{detail.previous.timestampRaw}</code></p></details>}
          </div>
        </li>;
      })}</ul>}
    <div className="recording-quality-pages" aria-label="Bulgu sayfaları">
      <button type="button" disabled={data.page === 0} onClick={() => setPage(data.page - 1)}>Önceki bulgu sayfası</button><span>{data.page + 1} / {data.pages}</span>
      <button type="button" disabled={data.page + 1 >= data.pages} onClick={() => setPage(data.page + 1)}>Sonraki bulgu sayfası</button>
    </div>
  </section>;
}

function QualityCoverage({ analysis }: { analysis: TumQualityAnalysis }) {
  const { coverage, report } = analysis;
  const images = coverage.images;
  return <section className="recording-quality-section" aria-label="Analiz kapsamı">
    <h3>Kapsam Özeti</h3>
    <p className="recording-scope"><span className="recording-tag">{report.scope === 'metadata-only' ? 'Metadata-only · tam görüntü kaydı doğrulaması değil' : 'Seçili akış kapsamının tam kayıt incelemesi'}</span></p>
    <dl className="recording-facts recording-quality-counts">
      <div><dt>İşlem tamamlandı</dt><dd>{coverage.completed ? 'Evet' : 'Hayır'}</dd></div>
      <div><dt>Motor iptal bildirimi</dt><dd>{coverage.cancelled ? 'Evet' : 'Hayır'}</dd></div>
      <div><dt>Seçim modu</dt><dd>{coverage.selectionMode}</dd></div>
      <div><dt>PNG yapısal inceleme istendi</dt><dd>{coverage.inspectionRequested ? 'Evet' : 'Hayır'}</dd></div>
      <div><dt>Seçili akışın beklenen / mevcut PNG dosyası</dt><dd>{images.expectedFiles} / {images.presentFiles}</dd></div>
      <div><dt>İncelenen / yapısal doğrulanan PNG</dt><dd>{images.inspectedFiles} / {images.validatedFiles}</dd></div>
      <div><dt>Seçili PNG kapsamındaki eksik dosya</dt><dd>{images.missingFiles} · sensörün kayıp kare sayısı değildir</dd></div>
      {coverage.streams.map(stream => <div key={stream}><dt>{stream.toUpperCase()} seçili kaynak referansı / kapsam dışı referans</dt><dd>{coverage.selectedSourceReferences[stream]} / {images.notSelectedSourceReferences[stream]}</dd></div>)}
      <div><dt>Bulgu önem dağılımı</dt><dd>{(['error', 'warning', 'info'] as const).map(severity => `${severityLabels[severity]}: ${report.issues.filter(issue => issue.severity === severity).length}`).join(' · ')}</dd></div>
    </dl>
    <p className="recording-note">PNG sayaçları seçili akışa aittir; manifestin diğer eksik girdileri bulgularda ayrıca yer alır.</p>
    <div className="recording-quality-table" tabIndex={0} role="region" aria-label="İncelenen kaynak TXT tabloları"><table>
      <caption>Bağımsız kaynak TXT kapsamları</caption><thead><tr><th scope="col">Tablo / dosya</th><th scope="col">Veri satırı</th><th scope="col">Kaynak ayrıştırması</th></tr></thead>
      <tbody>{coverage.sourceTables.map((table, index) => <tr key={index}><td>{table.kind}<br />{metadataText(table.file)}</td><td>{metadataIndex(table.rowCount)}</td><td>{table.valid ? 'Başarılı ayrıştırıldı; görüntü bütünlüğü değildir' : 'Tamamlanmadı / geçersiz'}</td></tr>)}</tbody>
    </table></div>
    {images.missingFilePaths.length > 0 && <details><summary>Eksik beklenen PNG yolları ({images.missingFilePaths.length})</summary><ul>{images.missingFilePaths.slice(0, 20).map((path, i) => <li key={i}>{path}</li>)}</ul>{images.missingFilePaths.length > 20 && <p className="recording-note">İlk 20 yol gösteriliyor; diğer yollar bulgu sayfalarında incelenebilir.</p>}</details>}
  </section>;
}

function BasicMetadataReport({ report }: { report: QualityReport | null }) {
  return <details className="recording-basic-quality"><summary>Temel metadata kontrolü</summary>
    {!report ? <EmptyState title="İnceleme sonucu yok">Bu temel kontrol gerçek TUM dosya analizi değildir.</EmptyState> : <>
      <p className="recording-scope"><span className="recording-tag">{report.scope === 'full-recording' ? 'Kayıt incelemesi' : 'Yalnızca metadata incelemesi'}</span></p>
      {report.issues.length ? <ul className="recording-issues">{report.issues.slice(0, 20).map((issue, i) => <li key={`${issue.code}-${i}`}>
        <span className={`recording-severity recording-severity-${issue.severity}`}>{severityLabels[issue.severity]}</span>
        <div><strong>{issue.message}</strong><p className="recording-note">{issue.code}{issue.frameIndex !== undefined ? ` · API kare indeksi: ${issue.frameIndex}` : ''}</p><p className="recording-rule">Kural: {issue.rule}</p></div>
      </li>)}</ul> : <p className="recording-note">Bu rapor kapsamında bulgu bildirilmedi. Bu, tüm verinin hatasız olduğu anlamına gelmez.</p>}
      <div className="recording-unsupported"><h3>Desteklenmeyen kontroller</h3>{report.unsupported.length ? <ul>{report.unsupported.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="recording-note">Bildirilmedi.</p>}</div>
    </>}
    </details>;
}

export function QualityPanel(p: { report: QualityReport | null } & QualityControlsProps) {
  const state = p.qualityState;
  const available = !!state && !!p.qualityRecording && p.qualityRecording.provenance === 'real' && !!p.qualityStream && !!p.qualityMode && !!p.onAnalyze && !p.qualityUnavailableReason;
  const supplied = state?.analysis;
  const matches = !!supplied && supplied.report.recordingId === p.qualityRecording?.id && supplied.coverage.streams.length === 1 &&
    supplied.coverage.streams[0] === p.qualityStream && supplied.coverage.selectionMode === p.qualityMode;
  const analysis = available && matches && state && ['completed', 'partial', 'cancelled'].includes(state.status) ? supplied : null;
  const status = !available ? 'Analiz kullanılamıyor' : state?.status === 'idle' ? 'Analize hazır · henüz başlatılmadı' : state?.status === 'running' ? 'Analiz çalışıyor' :
    state?.status === 'cancelled' ? analysis?.coverage.cancelled ? 'Analiz iptal edildi · motor onayı' : 'Analiz iptali istendi · geç sonuçlar eleniyor' : state?.status === 'error' ? 'Analiz hatası' : supplied && !matches ? 'Sonuç aktif kayıtla eşleşmiyor; gizlendi' :
      state?.status === 'partial' ? 'Analiz kısmi; işlem tamamlanmadı' : 'Analiz işlemi tamamlandı · kapsam sınırlarını inceleyin';
  return <Panel title="Veri kalitesi" label="ANALİZ VE KAPSAM" className="recording-quality">
    <h3>Analiz Durumu</h3><p role="status" aria-busy={state?.status === 'running'} className="recording-quality-status">{status}</p>
    {p.qualityRecording && <p className="recording-note">{p.qualityRecording.name} · kayıt {p.qualityRecording.id} · {p.qualityStream?.toUpperCase()} · {p.qualityMode}</p>}
    {p.qualityUnavailableReason && <p className="recording-note">{p.qualityUnavailableReason}</p>}
    <AnalysisActions {...p} available={available} />
    {state?.error && <p role="alert" className="recording-input-error">{state.error} Analizi yeniden başlatabilir veya kaydı yeniden açabilirsiniz.</p>}
    {state?.status === 'cancelled' && <p className="recording-note">AbortSignal ile gerçek analiz iptali istendi. Geç tamamlanan başarı sonuçları elenir. Native dosya okuma/sıkıştırma işinin anında durduğu iddia edilmez; motorun iptal onayı varsa kısmi kapsam aşağıdadır.</p>}
    {analysis && <>
      <QualityCoverage analysis={analysis} />
      <QualityFindings key={state?.runId} analysis={analysis} />
      {p.qualityStream && <QualityIntervals key={state?.runId} analysis={analysis} stream={p.qualityStream} />}
      <section className="recording-quality-section" aria-label="Analiz sınırlamaları"><h3>Sınırlamalar</h3>
        <h4>Motorun desteklemediği kontroller</h4><ul>{analysis.report.unsupported.map((text, i) => <li key={i}>{text}</li>)}</ul>
        <h4>Motorun kapsam açıklamaları</h4><ul>{analysis.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul>
      </section>
    </>}
    <BasicMetadataReport report={p.report} />
    <p className="recording-panel-note">Bulgular belirtilen kapsam ve kurallarla sınırlıdır. Kayıp sensör karesi, fiziksel sensör doğruluğu veya RGB/Depth senkronizasyonu kanıtlanmaz.</p>
  </Panel>;
}
