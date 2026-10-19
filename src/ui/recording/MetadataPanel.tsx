import type { ReactNode } from 'react';
import type { RecordingWorkbenchProps } from '../RecordingWorkbench';
import type { TumDerivedTime, TumFrameMetadata } from '../../data';
import { EmptyState, Panel, ReaderErrorNotice } from './Panel';
import { formatFrameTime, frameAtPosition, matchingFrameMetadata, metadataIndex, metadataNumber, metadataText, notProvided } from './metadataPresentation';

export { formatFrameTime } from './metadataPresentation';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function TableDuration({ duration }: { duration: TumDerivedTime }) {
  return <div className="recording-metadata-derived">
    <h4>Kaynak TXT ilk–son damga farkı</h4>
    <dl className="recording-facts">
      <Fact label="Sayısal sonuç">{metadataNumber(duration.value)}</Fact>
      <Fact label="Tam ondalık sonuç">{metadataText(duration.exactDecimal)}</Fact>
      <Fact label="Sonuç birimi">{duration.unit === 'seconds' ? 'Saniye · reader tarafından belgelenmiş' : duration.unit === 'source-timestamp-unit-unknown' ? 'Kaynak zaman birimi bilinmiyor' : duration.unit}</Fact>
      <Fact label="Yöntem">{metadataText(duration.method)}</Fact>
      <Fact label="Kapsam">{metadataText(duration.scope.file)} · tüm özgün TXT veri satırları</Fact>
      <Fact label="Kaynak alanlar">{duration.inputs.length ? duration.inputs.map((input, index) => <span className="recording-metadata-input" key={index}>{input.file} · satır {metadataIndex(input.lineNumber)} · kaynak indeksi {metadataIndex(input.sourceIndex)} · token <code>{input.timestampRaw}</code></span>) : notProvided}</Fact>
    </dl>
    <p className="recording-note">Bu fark oturum süresi veya seçili PNG alt kümesinin süresi değildir; kayıp kare veya sensör FPS'i göstermez.</p>
    {duration.limitations.map((limitation, index) => <p className="recording-note" key={index}>{limitation}</p>)}
  </div>;
}

function DepthDescription({ original }: { original: TumFrameMetadata['original'] }) {
  const conversion = original.documentedDepthConversion;
  return <div className="recording-metadata-derived">
    <h4>Depth kodlaması ve belgelenmiş dönüşüm</h4>
    <dl className="recording-facts">
      <Fact label="Ham kod birimi">{original.measurementUnit?.status === 'known' ? metadataText(original.measurementUnit.value) : 'Bilinmiyor'}</Fact>
      <Fact label="Sayısal depth örnekleri">Bu görüntü bağlantısında sağlanmamış</Fact>
      <Fact label="Belgelenmiş dönüşüm">{conversion ? `Ham kod / ${metadataNumber(conversion.divisor)} → ${conversion.outputUnit}` : notProvided}</Fact>
      <Fact label="Geçersiz ham kod">{conversion ? `${metadataNumber(conversion.invalidRawValue)} → ölçüm yok; geçerli fiziksel değer değildir` : notProvided}</Fact>
      <Fact label="Önizlemeye uygulama">{conversion?.appliedToPreview === false ? 'Uygulanmadı; özgün PNG görsel önizlemesi' : notProvided}</Fact>
      <Fact label="Dönüşüm kaynağı">{metadataText(conversion?.evidence)}</Fact>
    </dl>
    <p className="recording-note">UI fiziksel derinlik hesaplamaz. Depth termal görüntü değildir; önizleme parlaklığı ölçüm veya sıcaklık olarak yorumlanamaz.</p>
  </div>;
}

type MetadataPanelProps = Pick<RecordingWorkbenchProps, 'metadata' | 'frame'> & Partial<Pick<RecordingWorkbenchProps,
  'frameMetadata' | 'sourceInfo' | 'tableMetadata' | 'metadataError' | 'manifest' | 'opened' | 'loading' | 'error' | 'index' | 'activeStream' | 'closedReason'>>;

export function MetadataPanel(p: MetadataPanelProps) {
  const opened = p.opened ?? true;
  const metadata = opened ? p.metadata : null;
  const closedTitle = p.closedReason === 'ready' ? 'Dosyalar hazır; reader açılmadı' : p.closedReason === 'closed' ? 'Kayıt kapatıldı' : 'Kayıt seçilmedi';
  const candidate = opened && !p.loading && !p.error ? frameAtPosition(p.frame, p.index, metadata?.frameCount) : null;
  const source = metadata?.recording.provenance === 'real' && p.sourceInfo && p.sourceInfo.frameCount === metadata.frameCount && (!p.activeStream || p.sourceInfo.stream === p.activeStream) ? p.sourceInfo : null;
  const table = source && p.tableMetadata?.original.file === source.listFile && p.tableMetadata.original.kind === source.stream ? p.tableMetadata : null;
  const identity = metadata?.recording.provenance === 'real' ? matchingFrameMetadata(candidate, p.frameMetadata, p.index, p.activeStream, p.sourceInfo) : null;
  const mismatched = !!candidate && metadata?.recording.provenance === 'real' && !!p.frameMetadata && !identity;
  const frame = mismatched ? null : candidate;
  const original = identity?.original;
  const originalRow = original && table?.original.rows.find(row => row.sourceIndex === original.sourceIndex && row.lineNumber === original.lineNumber && row.timestampRaw === original.timestampRaw);
  const manifest = metadata && p.manifest?.recording.id === metadata.recording.id && p.manifest.recording.provenance === metadata.recording.provenance ? p.manifest : null;
  const stream = metadata?.recording.provenance === 'real' ? p.activeStream ?? source?.stream ?? original?.stream : undefined;
  const mode = source?.mode ?? identity?.derived.apiIndex.scope.mode;
  const frameTime = frame?.time;

  return <Panel title="Metadata incelemesi" label="VERİ KÖKENİ" className="recording-meta">
    {!opened ? <EmptyState title={closedTitle}>Aktif reader metadata'sı gösterilmiyor. Kaydı açtığınızda bu oturumun bilgileri görünür.</EmptyState>
      : !metadata ? p.error ? <><EmptyState title="Reader hatası">Kayıt metadata'sı alınamadı.</EmptyState><ReaderErrorNotice error={p.error} /></>
        : <div role="status" aria-busy={!!p.loading}><EmptyState title={p.loading ? 'Reader açılıyor; metadata bekleniyor' : 'Kayıt bilgisi bekleniyor'}>{p.loading ? 'Başarılı açılış bekleniyor; eski kayıt bilgileri gösterilmez.' : 'Kayıt açık; okuyucu metadata sağlamadı.'}</EmptyState></div>
      : <>
        {p.metadataError && <><p className="recording-note">Ek kaynak metadata'sı alınamadı; eksik alanlar sağlanmamış olarak gösterilir.</p><ReaderErrorNotice error={p.metadataError} /></>}
        <h3 className="recording-metadata-heading">Kayıt Bilgileri</h3>
        <p className="recording-tag">{metadata.recording.provenance === 'synthetic' ? 'SENTETİK GELİŞTİRME ÖRNEĞİ' : 'GERÇEK VERİ KAYNAĞI'}</p>
        <dl className="recording-facts">
          <Fact label="Veri seti / kayıt adı">{metadataText(manifest?.recording.name ?? metadata.recording.name)}</Fact>
          <Fact label="Kayıt kimliği">{metadataText(metadata.recording.id)}</Fact>
          <Fact label="Aktif akış">{stream ? stream === 'rgb' ? 'RGB · görünür görüntü' : 'Depth · derinlik önizlemesi' : metadata.recording.provenance === 'synthetic' ? 'Sentetik çizim' : notProvided}</Fact>
          <Fact label="Reader">{metadataText(metadata.reader.id)} / {metadataText(metadata.reader.version)}</Fact>
          <Fact label="Dosya biçimi · reader">{metadataText(metadata.format)}</Fact>
          <Fact label="Reader’ın erişebildiği kare sayısı">{metadataIndex(metadata.frameCount)}</Fact>
          <Fact label="Kayıt kapsamı">{mode === 'manifest-subset' ? 'Manifest alt kümesi · seçili tek akış' : mode === 'full-recording' ? 'Seçili akışın tam TXT görüntü listesi' : metadata.recording.provenance === 'synthetic' ? 'Sentetik geliştirme örneği' : notProvided}</Fact>
          <Fact label="Kaynak TXT veri satırı sayısı">{source ? metadataIndex(source.sourceRowCount) : notProvided}</Fact>
          <Fact label="Oturum süresi">Bu metadata akışında sağlanmamış</Fact>
        </dl>
        <details className="recording-metadata-details">
          <summary>Kayıt tanımı ve atıf</summary>
          <p className="recording-note">{manifest ? 'Bu tanımlayıcılar manifestten gelir; PNG veya TXT ölçüm alanı değildir.' : 'Manifest ayrıca sağlanmamış; mevcut kaynak/lisans reader’ın kayıt tanımından gösterilir.'}</p>
          <dl className="recording-facts">
            <Fact label="Kaynak başlığı">{metadataText((manifest?.recording ?? metadata.recording).source.title)}</Fact>
            <Fact label="Kaynak adresi">{metadataText((manifest?.recording ?? metadata.recording).source.url)}</Fact>
            <Fact label="Lisans">{metadata.recording.license.status === 'known' ? metadataText(metadata.recording.license.value) : 'Bilinmiyor'}</Fact>
            <Fact label="Atıf">{metadataText(manifest?.citation)}</Fact>
            <Fact label="Sürüm / erişim tarihi">{metadataText(manifest?.versionOrAccessDate)}</Fact>
          </dl>
        </details>

        <h3 className="recording-subheading">Seçili Kare</h3>
        {p.error ? <><EmptyState title="Kare hatası">Önceki karenin metadata'sı gizlendi. Kaydı yeniden açın.</EmptyState><ReaderErrorNotice error={p.error} /></>
          : !frame ? <div role={mismatched ? 'alert' : 'status'} aria-busy={!!p.loading}><EmptyState title={mismatched ? 'Kare metadata’sı görüntü kimliğiyle eşleşmiyor' : p.loading ? 'Kare yükleniyor; kare metadata’sı bekleniyor' : metadata.frameCount === 0 ? 'Boş kayıt' : 'Seçili kare metadata’sı bekleniyor'}>Hazır görüntü ve aynı API pozisyonuna ait kimlik gelmeden eski kare bilgileri gösterilmez.</EmptyState></div>
          : <>
            <dl className="recording-facts">
              <Fact label="Görsel sıra numarası">{metadataIndex(frame.index + 1)} / {metadataIndex(metadata.frameCount)}</Fact>
              <Fact label="Seçili API indeksi">{metadataIndex(frame.index)} · sıfır tabanlı</Fact>
              <Fact label="Özgün kaynak kare indeksi">{metadataIndex(original?.sourceIndex)}</Fact>
              <Fact label="Kaynak dosya yolu">{metadataText(original?.sourceFile)}</Fact>
              <Fact label="Kare akışı">{original?.stream.toUpperCase() ?? (metadata.recording.provenance === 'synthetic' ? 'SENTETİK' : notProvided)}</Fact>
              <Fact label="Görüntü boyutları · FrameRecord">{metadataNumber(frame.image.width)} × {metadataNumber(frame.image.height)} px</Fact>
              <Fact label="Özgün zaman tokeni">{original ? <code className="recording-raw-token">{metadataText(original.timestampRaw)}</code> : notProvided}</Fact>
            </dl>
            {!identity && <p className="recording-note">{p.frameMetadata && metadata.recording.provenance === 'real' ? 'Kare metadata’sı görüntü kimliğiyle eşleşmiyor; özgün alanlar gizlendi.' : 'Bu kare için TUM özgün metadata’sı sağlanmamış.'}</p>}
          </>}

        <details className="recording-metadata-details">
          <summary>Özgün Metadata</summary>
          <p className="recording-note">Reader’ın kaynak TXT/PNG'den aktardığı alanlar. Kaynak indeksi yorum ve boş satırlar dışındaki veri sırasıdır; fiziksel satır numarasından ayrıdır.</p>
          <dl className="recording-facts">
            <Fact label="Kaynak liste dosyası">{metadataText(original?.sourceListFile)}</Fact>
            <Fact label="Fiziksel kaynak satırı · 1 tabanlı">{metadataIndex(original?.lineNumber)}</Fact>
            <Fact label="Özgün kaynak satırı">{originalRow ? <code className="recording-raw-token">{originalRow.originalLine}</code> : notProvided}</Fact>
            <Fact label="PNG bilgisi">{original?.png?.status === 'verified' ? `${metadataNumber(original.png.value.width)} × ${metadataNumber(original.png.value.height)} px · ${metadataNumber(original.png.value.bitDepth)} bit · renk tipi ${metadataNumber(original.png.value.colorType)}` : original?.png?.status === 'not-read' ? 'Henüz okunmadı / doğrulanmadı' : notProvided}</Fact>
            <Fact label="PNG alanlarının kaynağı">{original?.png?.status === 'verified' ? metadataText(original.png.source) : notProvided}</Fact>
            <Fact label="Özgün FrameRecord zamanı">{frameTime?.kind === 'original' ? formatFrameTime(frameTime) : notProvided}</Fact>
          </dl>
        </details>

        <details className="recording-metadata-details">
          <summary>Türetilmiş Metadata</summary>
          <dl className="recording-facts">
            <Fact label="API pozisyonu · birim: indeks">{metadataIndex(identity?.derived.apiIndex.value ?? frame?.index)}</Fact>
            <Fact label="API türetme yöntemi">{identity ? metadataText(identity.derived.apiIndex.method) : frame ? 'FrameRecord.index aktarımı; özgün kaynak sırası için ek türetme yöntemi sağlanmamış.' : notProvided}</Fact>
            <Fact label="API kaynak girdisi">{identity ? `${identity.derived.apiIndex.inputs.file} · satır ${metadataIndex(identity.derived.apiIndex.inputs.lineNumber)} · kaynak indeksi ${metadataIndex(identity.derived.apiIndex.inputs.sourceIndex)}` : notProvided}</Fact>
            <Fact label="UI sıra yöntemi">{frame ? `FrameRecord.index + 1 = ${metadataIndex(frame.index + 1)}; yalnız sunum sırası, fiziksel ölçüm değildir.` : notProvided}</Fact>
            <Fact label="Türetilmiş FrameRecord zamanı">{frameTime?.kind === 'derived' ? formatFrameTime(frameTime) : notProvided}</Fact>
          </dl>
          {table && <TableDuration duration={table.derived.firstToLastDuration} />}
          <p className="recording-note">Özet tüm kaynak TXT sırasına aittir; görüntüler yalnız seçili PNG alt kümesi olabilir. UI yeni zaman veya özet hesaplamaz.</p>
        </details>

        <h3 className="recording-subheading">Birimler ve Sınırlamalar</h3>
        <dl className="recording-facts">
          <Fact label="Zaman">{frameTime ? formatFrameTime(frameTime) : 'Bilinmiyor'}</Fact>
          <Fact label="Ham token zaman birimi">{original ? original.timestampUnit === 'unknown' ? 'Bilinmiyor' : original.timestampUnit : notProvided}</Fact>
          <Fact label="Zaman tabanı">{frameTime && frameTime.kind !== 'unknown' ? metadataText(frameTime.timeBase, 'Bilinmiyor') : metadataText(metadata.timing.timeBase, 'Bilinmiyor')}</Fact>
          <Fact label="Saat kökeni açıklaması">{metadataText(original?.clockOrigin)}</Fact>
          <Fact label="Zaman bilgisi kaynağı">{frameTime?.kind === 'original' ? metadataText(frameTime.source) : frameTime?.kind === 'derived' ? metadataText(frameTime.method) : metadataText(original?.sourceListFile)}</Fact>
          <Fact label="Ölçüm / kod birimi">{original?.measurementUnit?.status === 'known' ? metadataText(original.measurementUnit.value) : 'Bilinmiyor'}</Fact>
          <Fact label="Birim kanıtı">{original?.measurementUnit?.status === 'known' ? metadataText(original.measurementUnit.evidence) : notProvided}</Fact>
          <Fact label="Radyometri">{metadata.radiometry.status === 'available' && !stream ? metadataText(metadata.radiometry.unit, 'Bilinmiyor') : 'Ölçüm yok / bilinmiyor'}</Fact>
        </dl>
        {original?.stream === 'depth' && <DepthDescription original={original} />}
        <p className="recording-note">{metadataText(metadata.timing.description)}</p>
        <p className="recording-panel-note">Ham token değiştirilmez. Bilinmeyen birimden saniye, Unix tarihi veya yerel saat dönüşümü desteklenmiyor. Gösterim hızı sensör FPS'i değildir. Alt küme dışındaki görüntüler ve kaynak indeks boşlukları kayıp sensör karesi sayılmaz; RGB/Depth eşzamanlılığı varsayılmaz.</p>
      </>}
  </Panel>;
}
