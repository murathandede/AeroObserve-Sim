import { useId, useMemo, useState } from 'react';
import type { TumStream } from '../../data';
import type { TumQualityAnalysis } from '../../quality';
import { qualityIntervalPage } from './qualityPresentation';
import { metadataIndex, metadataNumber, metadataText } from './metadataPresentation';
import { EmptyState } from './Panel';

export function QualityIntervals({ analysis, stream }: { analysis: TumQualityAnalysis; stream: TumStream }) {
  const [page, setPage] = useState(0);
  const id = useId();
  const data = useMemo(() => qualityIntervalPage(analysis, stream, page), [analysis, stream, page]);
  if (!data || !data.total) return <section className="recording-quality-section" aria-label="Zaman aralıkları">
    <h3>Zaman Aralıkları</h3><EmptyState title="Grafik için veri yetersiz / desteklenmiyor">Seçili akışın geçerli kaynak tablosundan, iki kaynağı belirtilmiş sayısal aralık dizisi sağlanmadı. UI ham tokenlerden aralık hesaplamaz.</EmptyState>
  </section>;
  const valid = data.points.filter(point => !point.problem);
  const maxAbs = Math.max(0, ...valid.map(point => Math.abs(point.interval.value!)));
  const x = (index: number) => 60 + index * 620 / Math.max(1, data.points.length - 1);
  const y = (value: number) => 115 - value / (maxAbs || 1) * 80;
  const tick = (value: number) => String(value).length > 8 ? value.toExponential(2) : String(value);
  const unit = data.table.original.timestamp.unit === 'seconds' ? 'Saniye · belgelenmiş kaynak birimi' : 'Kaynak damga farkı · birim bilinmiyor';
  return <section className="recording-quality-section" aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>Zaman Aralıkları · {stream.toUpperCase()}</h3>
    <p className="recording-note">{data.table.original.file} · tüm özgün TXT veri satırları; PNG alt kümesinin kare aralıkları değildir. {analysis.coverage.completed && !analysis.coverage.cancelled ? 'Analiz çıktısı.' : 'Kısmi/iptal edilmiş analiz çıktısı.'}</p>
    <p className="recording-note">Dikey eksen: {unit}. Yatay eksen: aşağıdaki tablodaki özgün kaynak satır çiftleri, kaynak sırasında. Saat kökeni: {data.table.original.timestamp.origin} Birimi bilinmeyen seri doğrulanmış fiziksel süre olarak yorumlanamaz.</p>
    {valid.length ? <svg className="recording-interval-chart" viewBox="0 0 720 245" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`${stream.toUpperCase()} kaynak TXT zaman aralıkları`}</title>
      <desc id={`${id}-desc`}>{unit}. Bu pencerede {valid.length} sayısal aralık çizildi. Eksik/geçersiz değerler çarpıyla işaretlenir, çizgiyle birleştirilmez. Kesin değerler ve kaynak çiftleri aşağıdaki tablodadır.</desc>
      <line x1="60" y1="35" x2="60" y2="195" className="recording-chart-axis" />
      <line x1="60" y1="115" x2="680" y2="115" className="recording-chart-axis" />
      <text x="4" y="119">0</text>
      {maxAbs > 0 && <><text x="4" y="30">{tick(maxAbs)}</text><text x="4" y="212">{tick(-maxAbs)}</text></>}
      {data.points.map((point, index) => point.problem ? <text key={index} x={x(index)} y="230" className="recording-chart-missing">×</text> : <g key={index}>
        {index > 0 && !data.points[index - 1].problem && <line className="recording-chart-line" x1={x(index - 1)} y1={y(data.points[index - 1].interval.value!)} x2={x(index)} y2={y(point.interval.value!)} />}
        <circle className="recording-chart-point" cx={x(index)} cy={y(point.interval.value!)} r="4"><title>{`${point.interval.inputs.map(input => `kaynak ${input.sourceIndex}, satır ${input.lineNumber}`).join(' → ')}: ${point.interval.exactDecimal ?? metadataNumber(point.interval.value)} · ${unit}`}</title></circle>
      </g>)}
    </svg> : <EmptyState title="Bu pencerede çizilebilir sayısal değer yok">Eksik/geçersiz veya kapsamı doğrulanamayan değerler ölçüm olarak çizilmedi.</EmptyState>}
    <p className="recording-note">Grafik geometri için sayısal value alanını kullanır; eksen etiketleri kısaltılabilir, tam ondalık değer aşağıdadır. ×: çizilmeyen değer. Büyük aralık kayıp sensör karesi veya senkronizasyon kanıtı değildir.</p>
    <div className="recording-quality-table" tabIndex={0} role="region" aria-label="Zaman aralıklarının metinsel tablosu">
      <table><caption>{unit} · pencere {data.page + 1}/{data.pages} · toplam {data.total} aralık</caption>
        <thead><tr><th scope="col">Özgün kaynak çifti</th><th scope="col">Değer / tam ondalık</th><th scope="col">Durum ve yöntem</th></tr></thead>
        <tbody>{data.points.map((point, index) => <tr key={index}>
          <td>{point.interval.inputs.map((input, i) => <span className="recording-metadata-input" key={i}>Kaynak {metadataIndex(input.sourceIndex)} · satır {metadataIndex(input.lineNumber)} · <code>{input.timestampRaw}</code></span>)}</td>
          <td>{metadataNumber(point.interval.value)}<br /><code>{metadataText(point.interval.exactDecimal)}</code></td>
          <td>{point.problem ?? 'Sayısal aralık · Efe çıktısı'}<details><summary>Yöntem ve sınırlar</summary><p>{point.interval.method}</p>{point.interval.limitations.map((item, i) => <p key={i}>{item}</p>)}</details></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="recording-quality-pages" aria-label="Aralık pencereleri">
      <button type="button" disabled={data.page === 0} onClick={() => setPage(data.page - 1)}>Önceki aralık penceresi</button>
      <span>{data.page + 1} / {data.pages}</span>
      <button type="button" disabled={data.page + 1 >= data.pages} onClick={() => setPage(data.page + 1)}>Sonraki aralık penceresi</button>
    </div>
  </section>;
}
