# AeroObserve-Sim

> **Güncel proje yönü:** [AeroObserve ortak proje bağlamı ve araştırma çerçevesi](docs/project-context.md) ekip için esas belgedir. Hedef; gerçek termal kayıtları yerel açmak, oynatmak, metadata/veri kalitesini incelemek ve rapor dışa aktarmaktır. Ortak modül başlangıcı hazırdır; gerçek veri kaynağı seçilmedi ve gerçek okuyucu henüz uygulanmadı. Yerel geliştirme çizimleri gerçek kayıt değildir.

Güncel görev dağılımı: **Murathan:** sistem bütünleştirme ve ortak sözleşme; **Ahmet:** gerçek veri araştırması, lisans ve manifest; **Efe:** okuyucular ve kalite analizi; **Derviş:** arayüz ve oynatıcı. Kişisel görev kapsamı belirlenmeden tüm ekip işleri üstlenilmez; ortak sözleşme tek taraflı değiştirilmez.

Tarayıcıda çalışan, dört kişilik öğrenci ekibi için sentetik sensör gözlem ve veri kalitesi laboratuvarı. React + TypeScript + Vite + Canvas; backend, API anahtarı, GPU veya ücretli servis gerektirmez. Tüm veriler sentetiktir.

## Ekip için ortak başlangıç

Ana sayfa artık **kayıt geliştirme alanı**: Kaydı aç → üç yerel SVG → kareler arasında gezinme/oynatma → metadata ve sınırlı kalite bulguları. Görseller sürekli **GELİŞTİRME ÖRNEĞİ — SENTETİK** etiketlidir. Zaman bilinmiyor; sıcaklık alanı yok. Gösterim temposu kayıt zamanı gibi kullanılmaz. İnternet gerektiren varlık yoktur; yalnızca ilk paket kurulumu internet gerektirebilir.

- Tek ortak tip dosyası: `src/shared/types.ts`; [sözleşme](docs/data-contract.md).
- Ahmet'in [manifest şablonu](data/manifests/template.json) ve [alan açıklamaları](data/manifests/README.md).
- Efe'nin [okuyucu arayüzü ve kullanım örneği](docs/readers.md); `src/data/readFirstFrame.ts`.
- Derviş'in bağımsız ekranı: `src/ui/RecordingWorkbench.tsx`; veri bağlantısı `src/app/recordingBinding.ts` içinde değişir.
- [Git çalışma düzeni](docs/git-workflow.md): herkes bu değişiklikler yayımlandıktan sonra aynı commit SHA'sından kendi dalını açar.
- [Yeni başlangıç kontrol raporu](docs/team-bootstrap-verification.md).

Önceki simülasyon taşınmadı: `?view=simulation` adresinden açılır. Eski dünya/sensör modülleri yeni gerçek kayıt okuyucusu değildir.

## Kurulum

Node.js 22.12+ (veya 24 LTS) ve npm kullanın.

```sh
npm install
npm run dev
```

Terminaldeki yerel adresi açın (varsayılan http://127.0.0.1:5173). PowerShell betik yürütme kısıtı varsa aynı komutları `npm.cmd` ile çalıştırın. Dev sunucusu Ctrl+C ile kapanır.

```sh
npm run typecheck
npm test
npm run build
npm run example:reader
```

Build çıktısı `dist/` altına yazılır; sürüm kontrolüne alınmaz. `package-lock.json` kurulum sürümlerini sabitler; sonraki temiz kurulumlarda `npm ci` kullanılabilir.

## Korunan eski simülasyon özellikleri

- Seed'li altı genel hareketli nesne, sınırda yansıma ve sabit 10 Hz simülasyon saati.
- Başlat/duraklat, sıfırla, 0.5×–4× oynatma; seed sıfırlamayla uygulanır.
- Gürültü, eksik örnek, 0.2–0.8 s teslim gecikmesi ve 20–28 s sensör kesintisi.
- Ayrı gerçek durum/gözlem katmanları, Canvas sahnesi, 48×48 temsili yoğunluk matrisi.
- Hesaplanan kullanılabilirlik, ortalama gecikme, teslim sayısı ve olay günlüğü.
- Türkçe duyarlı arayüz, klavye kontrolleri, sayısal sahne alternatifi.
- Tekrar üretilebilirlik, sıfırlama, teslim sırası, süre sınırı ve kesinti kontrolleri.

Başlat’a basın. İlk gözlemler 0.7 s ve sonrasında teslim edilir. 20–28 s kesintisini görmek için 4× hızı seçebilirsiniz. Duraklatın, seed'i değiştirin ve sıfırlayın; saat 0'a ve başlangıç durumuna döner. Henüz hesaplanmayan konum hatası `—` görünür.

## Ekip ve başlangıç noktaları

| Üye | Sorumluluk | Görev dosyası |
| --- | --- | --- |
| Murathan | src/app/, src/playback/, sözleşme ve bütünleştirme | [murathan.md](docs/team/murathan.md) |
| Ahmet | docs/datasets.md, data/manifests/ | [ahmet.md](docs/team/ahmet.md) |
| Efe | src/data/, src/quality/ | [efe.md](docs/team/efe.md) |
| Derviş | src/ui/ | [dervis.md](docs/team/dervis.md) |

Ortak veri sözleşmesi ekip koordinasyonu olmadan değiştirilmemelidir. Başlangıç modülleri örnek uygulamadır. [Mimari ve zaman kuralları](docs/architecture.md), [sınırlamalar](docs/limitations.md).

## Planlanan işler

Belgeli gerçek termal kaynağın seçimi, lisans doğrulama, biçime özel okuyucu, yerel dosya seçim akışı, tam kayıt kalite analizi ve JSON rapor indirme. Kaynak zamanına göre oynatma sonraki geliştirmedir; mevcut denetleyici açıkça etiketlenmiş gösterim temposu kullanır. Tarayıcı etkileşim/erişilebilirlik testleri de tamamlanmalıdır. Bu özellikler uygulanmış gibi sunulmaz.

## Bu simülasyon neyi kanıtlamaz?

Gerçek algılama menzilini, saha doğruluğunu, fiziksel termal görünürlüğü veya donanım dayanıklılığını doğrulamaz. Fiziksel olarak doğrulanmış sensör simülatörü değildir. Gerçek donanım, fiziksel radar sinyal işleme, drone/tehdit sınıflandırması, hedef kilitleme, önleme ve atış koordinatları kapsam dışıdır.
