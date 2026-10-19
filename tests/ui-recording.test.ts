import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FrameRecord, QualityReport, ReaderError, RecordingMetadata } from '../src/shared/types';
import { exampleManifest } from '../src/demo/recording/example';
import { FrameViewer } from '../src/ui/recording/FrameViewer';
import { PlaybackControls } from '../src/ui/recording/PlaybackControls';
import { MetadataPanel, formatFrameTime } from '../src/ui/recording/MetadataPanel';
import { QualityPanel } from '../src/ui/recording/QualityPanel';
import { RecordingSelection, ReportPanel, SourcePanel, WorkbenchHeader } from '../src/ui/recording/RecordingContext';
import { ReaderErrorNotice } from '../src/ui/recording/Panel';

// Presentation fixtures only. These are explicitly synthetic, never real-data evidence.
const recording = exampleManifest.recording;
const metadata: RecordingMetadata = {
  recording, frameCount: 3, format: 'SVG (sentetik çizim)',
  timing: exampleManifest.timing, radiometry: exampleManifest.radiometry,
  reader: { id: 'synthetic-svg', version: '1.0.0' },
};
const frame: FrameRecord = {
  index: 0, image: { url: 'blob:synthetic-ui-test', width: 640, height: 480, alt: 'Yapay sunum testi' },
  time: { kind: 'unknown' },
};
const error: ReaderError = {
  code: 'MISSING_FILE', message: 'Dosya bulunamadı.', recovery: 'Özgün dosyayı yeniden seçin.', file: 'sample/rgb/missing.png',
};
const noop = () => {};

test('UI: closed/loading/error states never expose a stale image URL', () => {
  for (const state of [
    { opened: false, loading: false, error: null, expected: 'Kayıt kapalı' },
    { opened: true, loading: true, error: null, expected: 'Reader açılıyor…' },
    { opened: true, loading: false, error, expected: 'Kare gösterilemiyor' },
  ]) {
    const html = renderToStaticMarkup(createElement(FrameViewer, { recording, frame, ...state }));
    assert.ok(html.includes(state.expected));
    assert.doesNotMatch(html, /<img|blob:synthetic-ui-test/);
    if (state.loading) assert.match(html, /aria-busy="true"/);
    if (state.error) assert.match(html, /Örnek veriye otomatik geçilmedi/);
  }
});

test('UI: ready preview keeps its actual alt/dimensions and empty is distinct from closed', () => {
  const ready = renderToStaticMarkup(createElement(FrameViewer, { recording, frame, opened: true, loading: false, error: null }));
  assert.match(ready, /alt="Yapay sunum testi"/);
  assert.match(ready, /width="640" height="480"/);
  assert.match(ready, /SENTETİK ÖRNEK GÖRÜNÜMÜ/);
  const empty = renderToStaticMarkup(createElement(FrameViewer, { recording, frame: null, opened: true, loading: false, error: null }));
  assert.match(empty, /Görüntülenecek kare yok/);
  assert.doesNotMatch(empty, /Kayıt kapalı|<img/);
});

test('UI: real selection has native labeled inputs; synthetic action and unavailable export stay distinct', () => {
  const selection = renderToStaticMarkup(createElement(RecordingSelection, { recording, opened: false, onOpen: noop, onClose: noop }));
  assert.match(selection, /type="file" multiple="" webkitdirectory=""/);
  assert.match(selection, /Veri seti klasörünü seç/);
  assert.match(selection, /<button[^>]*>Sentetik örneği aç<\/button>/);
  assert.match(selection, /GERÇEK VERİ SEÇİMİ/);
  assert.match(selection, /MEVCUT SENTETİK ÖRNEK/);
  const report = renderToStaticMarkup(createElement(ReportPanel));
  assert.match(report, /<button[^>]*disabled=""[^>]*>JSON raporu indir<\/button>/);
  assert.doesNotMatch(report, /href=|download=/);
});

test('UI: metadata never converts unknown time or absent temperature into measurements', () => {
  const empty = renderToStaticMarkup(createElement(MetadataPanel, { metadata: null, frame: null }));
  assert.match(empty, /Kayıt bilgisi bekleniyor/);
  assert.doesNotMatch(empty, /synthetic-svg|<dd>0<\/dd>/);
  const shown = renderToStaticMarkup(createElement(MetadataPanel, { metadata, frame }));
  assert.match(shown, /<dt>Zaman<\/dt><dd>Bilinmiyor<\/dd>/);
  assert.match(shown, /<dt>Zaman tabanı<\/dt><dd>Bilinmiyor<\/dd>/);
  assert.match(shown, /Ölçüm yok \/ bilinmiyor/);
  assert.match(shown, /Seçili API indeksi/);
  assert.doesNotMatch(shown, /°C|30 Hz|30 FPS/);
  assert.equal(formatFrameTime({ kind: 'unknown' }), 'Bilinmiyor');
  assert.match(formatFrameTime({ kind: 'original', seconds: 12, timeBase: 'test-clock', source: 'source.txt' }), /Özgün · test-clock · source.txt/);
  assert.match(formatFrameTime({ kind: 'derived', seconds: 3, timeBase: 'test-clock', method: 'test-method' }), /Türetilmiş · test-clock · test-method/);
});

test('UI: no report does not claim completed metadata analysis; subset scope/rules remain visible', () => {
  const empty = renderToStaticMarkup(createElement(QualityPanel, { report: null }));
  assert.match(empty, /İnceleme sonucu yok/);
  assert.doesNotMatch(empty, /Yalnızca metadata incelemesi|hatasız|başarılı/);
  const report: QualityReport = {
    recordingId: recording.id, scope: 'metadata-only',
    issues: [{ code: 'TIME_UNKNOWN', severity: 'info', recordingId: recording.id, frameIndex: 0, message: 'Zaman bilinmiyor.', rule: 'timing.kind === unknown' }],
    unsupported: ['PNG bütünlüğü incelenmedi'],
  };
  const shown = renderToStaticMarkup(createElement(QualityPanel, { report }));
  assert.match(shown, /Yalnızca metadata incelemesi/);
  assert.match(shown, /Bilgi/);
  assert.match(shown, /API kare indeksi: 0/);
  assert.match(shown, /timing.kind === unknown/);
  assert.match(shown, /PNG bütünlüğü incelenmedi/);
  const noIssues = renderToStaticMarkup(createElement(QualityPanel, { report: { ...report, issues: [] } }));
  assert.match(noIssues, /tüm verinin hatasız olduğu anlamına gelmez/);
});

test('UI: playback boundaries stay disabled for closed/empty/error and at the last frame', () => {
  const base = { metadata, opened: true, loading: false, error: null, index: 0, playing: false, speed: 1, onSeek: noop, onPlayingChange: noop, onSpeedChange: noop };
  for (const override of [{ opened: false }, { metadata: null, loading: true }, { error }, { metadata: { ...metadata, frameCount: 0 } }]) {
    const html = renderToStaticMarkup(createElement(PlaybackControls, { ...base, ...override }));
    assert.equal((html.match(/<button[^>]*disabled=""/g) ?? []).length, 6);
    assert.match(html, /<input[^>]*disabled=""/);
  }
  const last = renderToStaticMarkup(createElement(PlaybackControls, { ...base, index: 2 }));
  assert.equal((last.match(/<button[^>]*disabled=""/g) ?? []).length, 3);
  assert.match(last, /gerçek kayıt hızı veya sensör FPS/);
});

test('UI: source identity/license remain available before open; real source never inherits synthetic label', () => {
  const source = renderToStaticMarkup(createElement(SourcePanel, { recording }));
  assert.ok(source.includes(recording.source.title));
  assert.match(source, /CC0-1.0/);
  const real = { ...recording, provenance: 'real' as const, license: { status: 'unknown' as const } };
  const header = renderToStaticMarkup(createElement(WorkbenchHeader, { recording: real }));
  assert.match(header, /GERÇEK VERİ KAYNAĞI/);
  assert.doesNotMatch(header, /GELİŞTİRME ÖRNEĞİ — SENTETİK|GERÇEK KAYIT/);
  const unknown = renderToStaticMarkup(createElement(SourcePanel, { recording: real }));
  assert.match(unknown, /Lisansın bilinmemesi kullanım izni anlamına gelmez/);
});

test('UI: reader error retains code, recovery and file; untrusted text is escaped', () => {
  const html = renderToStaticMarkup(createElement(ReaderErrorNotice, { error: { ...error, message: '<script>bad</script>' } }));
  assert.match(html, /role="alert"/);
  assert.match(html, /MISSING_FILE/);
  assert.ok(html.includes(error.recovery));
  assert.ok(html.includes(error.file!));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
