import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describeTumTable, type TumFrameMetadata, type TumSourceInfo, type TumStream, type TumTableMetadata } from '../src/data';
import type { FrameRecord, ReaderResult, RecordingMetadata, RecordingReader } from '../src/shared/types';
import { exampleBinding, exampleManifest } from '../src/demo/recording/example';
import { ReaderSession } from '../src/playback/readerSession';
import { MetadataPanel, formatFrameTime } from '../src/ui/recording/MetadataPanel';
import { FrameViewer } from '../src/ui/recording/FrameViewer';
import { matchingFrameMetadata, metadataIndex, metadataNumber, metadataText } from '../src/ui/recording/metadataPresentation';

// ARTIFICIAL presentation fixtures, never original TUM measurements/files.
function fixture(stream: TumStream = 'rgb', index = 1) {
  const manifest = structuredClone(exampleManifest);
  manifest.recording = { ...manifest.recording, id: 'ARTIFICIAL-METADATA', name: 'YAPAY TEST — gerçek TUM değildir', provenance: 'real',
    source: { title: 'YAPAY TEST kaynağı', url: null }, license: { status: 'unknown' } };
  manifest.citation = 'YAPAY TEST atıf metni'; manifest.versionOrAccessDate = 'YAPAY sürüm';
  const metadata: RecordingMetadata = { recording: manifest.recording, frameCount: 3, format: `YAPAY ${stream} PNG`,
    reader: { id: `YAPAY-${stream}`, version: 'test' }, timing: manifest.timing, radiometry: manifest.radiometry };
  const listFile = `ARTIFICIAL/${stream}.txt`;
  const rawText = '# YAPAY TEST\n' + Array.from({ length: 9 }, (_, i) => `${i}.123456789012345678900 ${stream}/${i}.png`).join('\n');
  const parsed = describeTumTable(rawText, stream, listFile); assert.ok(parsed.ok);
  const tableMetadata = parsed.value;
  const sourceInfo: TumSourceInfo = { stream, mode: 'manifest-subset', listFile, sourceRowCount: 9, frameCount: 3, unselectedSourceRows: 6,
    frames: [0, 4, 8].map((sourceIndex, apiIndex) => ({ ...tableMetadata.original.rows[sourceIndex], apiIndex, file: `ARTIFICIAL/${stream}/${sourceIndex}.png` })) };
  const source = sourceInfo.frames[index];
  const frameMetadata: TumFrameMetadata = {
    original: { stream, sourceFile: source.file, sourceListFile: listFile, sourceIndex: source.sourceIndex,
      lineNumber: source.lineNumber, timestampRaw: source.timestampRaw, timestampValue: source.timestampValue,
      timestampUnit: 'unknown', clockOrigin: 'YAPAY TEST: saat kökeni bilinmiyor',
      png: { status: 'verified', value: { width: 640, height: 480, bitDepth: stream === 'rgb' ? 8 : 16, colorType: stream === 'rgb' ? 2 : 0 }, source: `${source.file}: YAPAY PNG metadata fixture` },
      measurementUnit: { status: 'known', value: stream === 'depth' ? 'encoded-uint16' : '8-bit RGB channel code', evidence: 'YAPAY: kodlama açıklaması' },
      documentedDepthConversion: stream === 'depth' ? { divisor: 5000, outputUnit: 'metres', invalidRawValue: 0, evidence: 'YAPAY: documented conversion fixture', appliedToPreview: false } : null },
    derived: { apiIndex: { value: index, unit: 'index', inputs: { file: listFile, lineNumber: source.lineNumber, sourceIndex: source.sourceIndex },
      method: 'YAPAY TEST: seçili kaynak sırasının API pozisyonu', scope: { kind: 'selected-stream', stream, mode: 'manifest-subset' } } },
  };
  const frame: FrameRecord = { index, image: { url: `blob:ARTIFICIAL-${stream}-${index}`, width: 640, height: 480, alt: 'YAPAY TEST görüntüsü' }, time: { kind: 'unknown' } };
  return { metadata, frame, frameMetadata, sourceInfo, tableMetadata, manifest, index, activeStream: stream, opened: true, loading: false, error: null };
}
const render = (props: Parameters<typeof MetadataPanel>[0]) => renderToStaticMarkup(createElement(MetadataPanel, props));

test('ARTIFICIAL metadata: provenance sections distinguish manifest, original TXT/PNG and derived API position', () => {
  const p = fixture(); const html = render(p);
  for (const title of ['Kayıt Bilgileri', 'Seçili Kare', 'Özgün Metadata', 'Türetilmiş Metadata', 'Birimler ve Sınırlamalar']) assert.ok(html.includes(title));
  assert.match(html, /manifestten gelir; PNG veya TXT ölçüm alanı değildir/);
  assert.ok(html.includes(p.manifest.recording.name)); assert.ok(html.includes(p.manifest.citation!));
  assert.match(html, /YAPAY-rgb/); assert.match(html, /640 × 480 px · 8 bit · renk tipi 2/);
  assert.match(html, /Görsel sıra numarası<\/dt><dd>2 \/ 3/);
  assert.match(html, /Seçili API indeksi<\/dt><dd>1 · sıfır tabanlı/);
  assert.match(html, /Özgün kaynak kare indeksi<\/dt><dd>4/);
  assert.ok(html.includes(p.frameMetadata.original.sourceFile));
  assert.match(html, /Fiziksel kaynak satırı · 1 tabanlı<\/dt><dd>6/);
  assert.ok(html.includes(p.tableMetadata.original.rows[4].originalLine));
  assert.ok(html.includes(p.frameMetadata.derived.apiIndex.method));
  assert.match(html, /FrameRecord.index \+ 1 = 2/);
});

test('ARTIFICIAL metadata: raw decimal time token survives unchanged and never inherits a seconds/epoch unit', () => {
  const p = fixture(); const html = render(p); const raw = p.frameMetadata.original.timestampRaw;
  assert.ok(html.includes(`<code class="recording-raw-token">${raw}</code>`));
  assert.match(html, /Ham token zaman birimi<\/dt><dd>Bilinmiyor/);
  assert.match(html, /Zaman tabanı<\/dt><dd>Bilinmiyor/);
  assert.match(html, /Kaynak zaman birimi bilinmiyor/);
  assert.doesNotMatch(html, new RegExp(`${raw.replaceAll('.', '\\.')} s`));
  assert.match(html, /Unix tarihi veya yerel saat dönüşümü desteklenmiyor/);
});

test('ARTIFICIAL metadata: derived and original FrameTime are labeled with their actual method/source in separate sections', () => {
  const p = fixture();
  p.frame.time = { kind: 'derived', seconds: 0, timeBase: 'YAPAY zaman tabanı', method: 'YAPAY türetme yöntemi' };
  const derived = render(p);
  assert.match(derived, /Türetilmiş FrameRecord zamanı<\/dt><dd>0 s · Türetilmiş · YAPAY zaman tabanı · YAPAY türetme yöntemi/);
  assert.match(derived, /Özgün FrameRecord zamanı<\/dt><dd>Bu kayıt için sağlanmamış/);
  p.frame.time = { kind: 'original', seconds: 0, timeBase: 'YAPAY belgeli saniye tabanı', source: 'YAPAY dosya kaynağı' };
  const original = render(p);
  assert.match(original, /Özgün FrameRecord zamanı<\/dt><dd>0 s · Özgün/);
  assert.match(original, /Türetilmiş FrameRecord zamanı<\/dt><dd>Bu kayıt için sağlanmamış/);
});

test('metadata formatting: valid zero stays zero; null/undefined/nonfinite values never become measurements', () => {
  assert.equal(metadataNumber(0), '0'); assert.equal(metadataIndex(0), '0');
  for (const absent of [null, undefined]) { assert.equal(metadataNumber(absent), 'Bilinmiyor'); assert.match(metadataIndex(absent), /sağlanmamış/); assert.match(metadataText(absent), /sağlanmamış/); }
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.equal(metadataNumber(invalid), 'Geçersiz sayısal değer'); assert.equal(metadataIndex(invalid), 'Geçersiz indeks');
    assert.equal(formatFrameTime({ kind: 'original', seconds: invalid, timeBase: 'YAPAY', source: 'YAPAY' }), 'Geçersiz sayısal zaman değeri');
  }
  assert.equal(formatFrameTime(undefined), 'Bilinmiyor'); assert.equal(formatFrameTime({ kind: 'unknown' }), 'Bilinmiyor');
  const p = fixture('rgb', 0); const html = render(p);
  assert.match(html, /Seçili API indeksi<\/dt><dd>0/); assert.match(html, /Özgün kaynak kare indeksi<\/dt><dd>0/);
});

test('ARTIFICIAL metadata: invalid numeric frame dimensions and summary stay explicitly invalid', () => {
  const p = fixture(); p.frame.image.width = NaN; p.frame.image.height = Infinity;
  p.tableMetadata.derived.firstToLastDuration.value = Infinity;
  const html = render(p);
  assert.match(html, /Geçersiz sayısal değer × Geçersiz sayısal değer px/);
  assert.match(html, /Sayısal sonuç<\/dt><dd>Geçersiz sayısal değer/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('ARTIFICIAL metadata: depth documents code/conversion/invalid zero without computing pixels or temperature', () => {
  const p = fixture('depth'); const html = render(p);
  assert.match(html, /encoded-uint16/); assert.match(html, /16 bit · renk tipi 0/);
  assert.match(html, /Ham kod \/ 5000 → metres/);
  assert.match(html, /0 → ölçüm yok; geçerli fiziksel değer değildir/);
  assert.match(html, /Uygulanmadı; özgün PNG görsel önizlemesi/);
  assert.match(html, /Sayısal depth örnekleri<\/dt><dd>Bu görüntü bağlantısında sağlanmamış/);
  assert.doesNotMatch(html, /°C|°K|0 m<|5000 =|Ölçülen sıcaklık/);
  p.frameMetadata.original.documentedDepthConversion = null;
  const absent = render(p); assert.doesNotMatch(absent, /Ham kod \/ 5000/);
  p.frameMetadata.original.measurementUnit = { status: 'unknown' };
  assert.match(render(p), /Ham kod birimi<\/dt><dd>Bilinmiyor/);
});

test('ARTIFICIAL metadata: RGB never displays depth conversion even when an inconsistent field is supplied', () => {
  const p = fixture('rgb'); p.frameMetadata.original.documentedDepthConversion = fixture('depth').frameMetadata.original.documentedDepthConversion;
  assert.doesNotMatch(render(p), /Depth kodlaması ve belgelenmiş dönüşüm|Ham kod \/ 5000|encoded-uint16/);
});

test('ARTIFICIAL metadata: subset counts are reader-provided and source index gaps do not imply missing frames', () => {
  const p = fixture(); const html = render(p);
  assert.match(html, /Reader’ın erişebildiği kare sayısı<\/dt><dd>3/);
  assert.match(html, /Kaynak TXT veri satırı sayısı<\/dt><dd>9/);
  assert.match(html, /Manifest alt kümesi · seçili tek akış/);
  assert.match(html, /kayıp sensör karesi sayılmaz/);
  assert.ok(html.includes(p.tableMetadata.derived.firstToLastDuration.exactDecimal!));
  assert.ok(html.includes(p.tableMetadata.derived.firstToLastDuration.method));
  assert.match(html, /Bu fark oturum süresi veya seçili PNG alt kümesinin süresi değildir/);
  p.sourceInfo.mode = 'full-recording'; p.frameMetadata.derived.apiIndex.scope.mode = 'full-recording';
  assert.match(render(p), /Seçili akışın tam TXT görüntü listesi/);
});

test('ARTIFICIAL metadata: absent frame/source/table diagnostics are explicit and never filled from API position', () => {
  const p = fixture(); const html = render({ ...p, frameMetadata: null, sourceInfo: null, tableMetadata: null });
  assert.match(html, /Özgün kaynak kare indeksi<\/dt><dd>Bu kayıt için sağlanmamış/);
  assert.match(html, /TUM özgün metadata’sı sağlanmamış/);
  assert.doesNotMatch(html, /ARTIFICIAL\/rgb\/4.png|Kaynak TXT ilk–son damga farkı/);
  assert.match(html, /Seçili API indeksi<\/dt><dd>1/);
});

test('ARTIFICIAL metadata: PNG not-read, missing manifest citation/license and unknown time remain distinct', () => {
  const p = fixture(); p.frameMetadata.original.png = { status: 'not-read' };
  p.manifest.citation = null; p.manifest.recording.license = { status: 'unknown' }; p.metadata.recording.license = { status: 'unknown' };
  p.manifest.recording.source = { title: '', url: null };
  const html = render(p);
  assert.match(html, /Henüz okunmadı \/ doğrulanmadı/);
  assert.match(html, /Atıf<\/dt><dd>Bu kayıt için sağlanmamış/);
  assert.match(html, /Lisans<\/dt><dd>Bilinmiyor/); assert.match(html, /Kaynak başlığı<\/dt><dd>Bu kayıt için sağlanmamış/);
});

test('ARTIFICIAL metadata: native details/dl and long escaped text preserve safe readable raw values', () => {
  const p = fixture(); const path = `ARTIFICIAL/${'uzun-yol/'.repeat(200)}<script>bad</script>.png`;
  p.frameMetadata.original.sourceFile = path; p.sourceInfo.frames[1].file = path;
  p.manifest.citation = '<img src=x onerror=bad()> & YAPAY';
  const html = render(p);
  assert.match(html, /<details[^>]*><summary>Özgün Metadata<\/summary>/);
  assert.match(html, /<dl class="recording-facts">/);
  assert.ok(html.includes('uzun-yol/'.repeat(200))); assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=bad\(\)&gt;/); assert.doesNotMatch(html, /<script>|<img src=x/);
});

test('ARTIFICIAL metadata: unselected/prepared/closed states discard all supplied previous-session details', () => {
  const p = fixture();
  for (const [closedReason, title] of [['unselected', 'Kayıt seçilmedi'], ['ready', 'Dosyalar hazır; reader açılmadı'], ['closed', 'Kayıt kapatıldı']] as const) {
    const html = render({ ...p, opened: false, closedReason }); assert.ok(html.includes(title));
    assert.doesNotMatch(html, /YAPAY-rgb|ARTIFICIAL\/rgb|123456789012345678900/);
  }
});

test('ARTIFICIAL metadata: opening/absent metadata/frame loading/empty states expose no previous frame identity', () => {
  const p = fixture();
  const opening = render({ ...p, metadata: null, loading: true });
  assert.match(opening, /Reader açılıyor; metadata bekleniyor/); assert.match(opening, /aria-busy="true"/);
  const absent = render({ ...p, metadata: null }); assert.match(absent, /Kayıt açık; okuyucu metadata sağlamadı/);
  const loading = render({ ...p, loading: true }); assert.match(loading, /Kare yükleniyor; kare metadata’sı bekleniyor/);
  assert.doesNotMatch(loading, /ARTIFICIAL\/rgb\/4.png|640 × 480 px/);
  const empty = render({ ...p, metadata: { ...p.metadata, frameCount: 0 } }); assert.match(empty, /Boş kayıt/);
  assert.doesNotMatch(empty, /ARTIFICIAL\/rgb\/4.png|Görsel sıra numarası/);
});

test('ARTIFICIAL metadata: reader/frame/optional metadata failures keep code/recovery without old frame fields', () => {
  const p = fixture(); const error = { code: 'DECODE_FAILED' as const, message: 'YAPAY hata', recovery: 'YAPAY yeniden açın', file: 'ARTIFICIAL/broken.png' };
  const reader = render({ ...p, metadata: null, error }); assert.match(reader, /Reader hatası/);
  const frame = render({ ...p, error }); assert.match(frame, /Kare hatası/); assert.doesNotMatch(frame, /ARTIFICIAL\/rgb\/4.png/);
  for (const html of [reader, frame]) { assert.match(html, /DECODE_FAILED/); assert.match(html, /YAPAY yeniden açın/); assert.match(html, /role="alert"/); }
  const optional = render({ ...p, metadataError: error, tableMetadata: null });
  assert.match(optional, /Ek kaynak metadata&#x27;sı alınamadı/); assert.match(optional, /Seçili API indeksi<\/dt><dd>1/);
});

test('ARTIFICIAL metadata: rapid seek with mismatched position hides both the old preview and frame metadata', () => {
  const p = fixture('rgb', 0);
  const next = { ...p, index: 2 };
  const panel = render(next); const viewer = renderToStaticMarkup(createElement(FrameViewer, { ...next, recording: p.metadata.recording }));
  assert.doesNotMatch(panel, /ARTIFICIAL\/rgb\/0.png|Görsel sıra numarası/);
  assert.doesNotMatch(viewer, /<img|blob:ARTIFICIAL-rgb-0/);
  assert.equal(matchingFrameMetadata(p.frame, p.frameMetadata, 2, 'rgb', p.sourceInfo), null);
});

test('ARTIFICIAL metadata: mismatched frame metadata API/source file hides image and provenance together', () => {
  for (const kind of ['api', 'file'] as const) {
    const p = fixture();
    if (kind === 'api') p.frameMetadata.derived.apiIndex.value = 0;
    else p.frameMetadata.original.sourceFile = 'ARTIFICIAL/OLD-SESSION.png';
    const panel = render(p); const viewer = renderToStaticMarkup(createElement(FrameViewer, { ...p, recording: p.metadata.recording }));
    assert.match(panel, /Kare metadata’sı görüntü kimliğiyle eşleşmiyor/);
    assert.match(viewer, /Kare kimliği eşleşmiyor/); assert.doesNotMatch(viewer, /<img/);
    assert.doesNotMatch(panel, /ARTIFICIAL\/OLD-SESSION.png|Özgün kaynak kare indeksi/);
  }
});

test('ARTIFICIAL metadata: RGB ↔ Depth switches reject stale frame metadata even at the same API position', () => {
  for (const [oldStream, nextStream] of [['rgb', 'depth'], ['depth', 'rgb']] as const) {
    const previous = fixture(oldStream); const next = fixture(nextStream);
    const p = { ...next, frameMetadata: previous.frameMetadata };
    const panel = render(p); const viewer = renderToStaticMarkup(createElement(FrameViewer, { ...p, recording: next.metadata.recording }));
    assert.match(panel, /görüntü kimliğiyle eşleşmiyor/); assert.doesNotMatch(panel, new RegExp(`ARTIFICIAL/${oldStream}/4.png`));
    assert.doesNotMatch(viewer, /<img/);
    assert.ok(render(next).includes(next.frameMetadata.original.sourceFile));
  }
});

test('metadata synthetic demo: explicit synthetic label never borrows real TUM identity or depth conversion', () => {
  const p = fixture('depth');
  const metadata = { ...p.metadata, recording: exampleManifest.recording };
  const html = render({ ...p, metadata, manifest: exampleManifest, activeStream: undefined });
  assert.match(html, /SENTETİK GELİŞTİRME ÖRNEĞİ/);
  assert.doesNotMatch(html, /ARTIFICIAL\/depth\/4.png|Ham kod \/ 5000|encoded-uint16/);
});

test('MOCK metadata adapter: optional synchronous getters forward once, add no per-frame calls, and stop after close', async () => {
  const p = fixture(); let sourceCalls = 0, tableCalls = 0, metadataCalls = 0;
  const reader: RecordingReader & { getSourceInfo: () => ReaderResult<TumSourceInfo>; getTableMetadata: () => ReaderResult<TumTableMetadata> } = {
    open: async () => ({ ok: true, value: p.metadata }), getState: () => ({ status: 'ready' }), close: async () => {},
    getMetadata: () => { metadataCalls++; return { ok: true, value: p.metadata }; }, getFrame: async index => ({ ok: true, value: { ...p.frame, index } }),
    getSourceInfo: () => { sourceCalls++; return { ok: true, value: p.sourceInfo }; },
    getTableMetadata: () => { tableCalls++; return { ok: true, value: p.tableMetadata }; },
  };
  const session = new ReaderSession({ ...exampleBinding, createReader: () => reader });
  assert.equal(session.getSourceInfo(), null); await session.open();
  assert.deepEqual(session.getSourceInfo(), { ok: true, value: p.sourceInfo });
  assert.deepEqual(session.getTableMetadata(), { ok: true, value: p.tableMetadata });
  for (const i of [0, 1, 2]) await session.getFrame(i);
  assert.deepEqual([sourceCalls, tableCalls, metadataCalls], [1, 1, 0]);
  await session.close(); assert.equal(session.getSourceInfo(), null); assert.equal(session.getTableMetadata(), null);
  assert.deepEqual([sourceCalls, tableCalls, metadataCalls], [1, 1, 0]);
});

test('MOCK metadata adapter: absent/throwing/failing getters are explicit without changing the shared reader API', async () => {
  const absent = new ReaderSession(exampleBinding); await absent.open();
  assert.equal(absent.getSourceInfo(), null); assert.equal(absent.getTableMetadata(), null); await absent.close();
  const p = fixture(); const reader = { ...exampleBinding.createReader(),
    open: async () => ({ ok: true as const, value: p.metadata }), close: async () => {},
    getFrame: async () => ({ ok: true as const, value: p.frame }), getMetadata: () => ({ ok: true as const, value: p.metadata }), getState: () => ({ status: 'ready' as const }),
    getSourceInfo: () => { throw new Error('YAPAY throw'); },
    getTableMetadata: (): ReaderResult<TumTableMetadata> => ({ ok: false, error: { code: 'DECODE_FAILED', message: 'YAPAY table error', recovery: 'YAPAY retry' } }),
  };
  const session = new ReaderSession({ ...exampleBinding, createReader: () => reader }); await session.open();
  const source = session.getSourceInfo(), table = session.getTableMetadata();
  assert.ok(source && !source.ok); assert.match(source.error.message, /Kaynak kapsamı/);
  assert.ok(table && !table.ok); assert.equal(table.error.message, 'YAPAY table error');
  assert.ok((await session.getFrame(1))?.ok); await session.close();
});

test('MOCK metadata race: superseded/closed frame requests never request or publish their old frame metadata', async () => {
  const p = fixture(); let resolve!: (value: ReaderResult<FrameRecord>) => void;
  const pending = new Promise<ReaderResult<FrameRecord>>(done => { resolve = done; });
  const metadataCalls: number[] = [];
  const reader: RecordingReader & { getFrameMetadata: (index: number) => ReaderResult<TumFrameMetadata> } = {
    open: async () => ({ ok: true, value: p.metadata }), getState: () => ({ status: 'ready' }), close: async () => {},
    getMetadata: () => ({ ok: true, value: p.metadata }),
    getFrame: index => index === 0 ? pending : Promise.resolve({ ok: true, value: p.frame }),
    getFrameMetadata: index => { metadataCalls.push(index); return { ok: true, value: p.frameMetadata }; },
  };
  const session = new ReaderSession({ ...exampleBinding, createReader: () => reader }); await session.open();
  const stale = session.getFrame(0); const latest = await session.getFrame(1);
  assert.ok(latest?.ok); assert.equal(latest.value.frame.index, latest.value.frameMetadata?.derived.apiIndex.value);
  resolve({ ok: true, value: { ...p.frame, index: 0 } }); assert.equal(await stale, null);
  assert.deepEqual(metadataCalls, [1]);
  await session.close(); assert.equal(await session.getFrame(0), null); assert.deepEqual(metadataCalls, [1]);
  const closingSession = new ReaderSession({ ...exampleBinding, createReader: () => reader }); await closingSession.open();
  const closingFrame = closingSession.getFrame(0); await closingSession.close();
  assert.equal(await closingFrame, null); assert.deepEqual(metadataCalls, [1]);
});
