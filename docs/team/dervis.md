# Derviş — kayıt arayüzü

- **Değiştirebileceğin dosyalar:** `src/ui/`, `tests/ui-*.test.ts`. Yeni kayıt ekranı `RecordingWorkbench.tsx` ve `recording.css`; eski `Scene.tsx/styles.css` simülasyon tarafından kullanılır, koru.
- **Dal:** `feat/recording-ui`.
- **Başlama:** `npm ci`, `npm run dev`; ana sayfada **Kaydı aç**. Komut satırı bağlantı örneği: `npm run example:reader`.
- **Ortak tipler:** `RecordingInfo`, `RecordingMetadata`, `FrameRecord`, `FrameTime`, `ReaderError`, `QualityReport`.
- **Girdi:** `RecordingWorkbenchProps` ile kare, metadata, rapor, durum ve callback'ler.
- **Çıktı:** klavyeyle kullanılabilen kayıt ekranı; kaynak/lisans/zaman/kalite gösterimi.

## Küçük kullanım örneği

Mevcut çalışan bağlantı `src/app/RecordingWorkspace.tsx` içindedir:

```tsx
<RecordingWorkbench
  {...model}
  recording={binding.input.manifest.recording}
  opened={opened}
  onOpen={open} onClose={close}
  onSeek={model.seek}
  onPlayingChange={model.setPlaying}
  onSpeedChange={model.setSpeed}
/>
```

Bu parça üst bileşendeki model/callback'leri kullanır; gerçek çalışan dosyayı referans al. Ekranın içinde okuyucu sınıfı veya zamanlayıcı kurma. Yerel sentetik SVG'ler ağ istemez; görünür etiketi koru. Efe'nin okuyucusu geldiğinde aynı props kullanılır, yalnızca Murathan'ın binding'i değişir.

## Tamamlanma ölçütleri

Aç/yeniden aç/kapat, oynat/duraklat, önceki/sonraki, indeksle arama, hız; kapalı/yükleniyor/boş/hata durumları; bilinen/özgün/türetilmiş/bilinmeyen zaman ayrımı; sentetik etiket; sıcaklık yoksa uydurma ölçek yok; kaynak ve lisans görünür. Klavye/dar ekran kontrollerini yap ve sonucunu belirt. `npm run build`, `npm run typecheck`, `npm test` geçer.

## Doğrudan teslim

Efe'den okuyucu kullanım ve hata örneklerini doğrudan al. Murathan'a UI bileşeni, props kullanım örneği ve manuel kontrol sonucunu ilet. Yeni callback veya ortak tip gereksinimini ilgili üyelerle koordine et; `src/app/` veya `src/playback/` dosyalarını kendin değiştirme.
