# AeroObserve-Sim

> **Güncel proje yönü:** [AeroObserve ortak proje bağlamı ve araştırma çerçevesi](docs/project-context.md) ekip için esas belgedir. Hedef; gerçek sensör kayıtlarını yerel açmak, oynatmak, metadata/veri kalitesini incelemek ve rapor dışa aktarmaktır. Bu repodaki mevcut uygulama yalnızca sentetik başlangıç demosudur; gerçek kayıt okuyucusu ve raporlama henüz uygulanmamıştır. Aşağıdaki özellikler ve eski görev dosyaları bu başlangıç sürümünü anlatır.

Güncel görev dağılımı: **Murathan:** sistem bütünleştirme ve ortak sözleşme; **Ahmet:** gerçek veri araştırması, lisans ve manifest; **Efe:** okuyucular ve kalite analizi; **Derviş:** arayüz ve oynatıcı. Kişisel görev kapsamı belirlenmeden tüm ekip işleri üstlenilmez; ortak sözleşme tek taraflı değiştirilmez.

Tarayıcıda çalışan, dört kişilik öğrenci ekibi için sentetik sensör gözlem ve veri kalitesi laboratuvarı. React + TypeScript + Vite + Canvas; backend, API anahtarı, GPU veya ücretli servis gerektirmez. Tüm veriler sentetiktir.

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
```

Build çıktısı `dist/` altına yazılır; sürüm kontrolüne alınmaz. `package-lock.json` kurulum sürümlerini sabitler; sonraki temiz kurulumlarda `npm ci` kullanılabilir.

## Çalışan başlangıç özellikleri

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
| Murathan | Bütünleştirme, sözleşme, değerlendirme, README | [murathan.md](docs/team/murathan.md) |
| Ahmet | Dünya ve tekrar üretilebilir senaryolar | [ahmet.md](docs/team/ahmet.md) |
| Efe | Sensör gürültüsü, gecikme, eksik veri, kesinti | [efe.md](docs/team/efe.md) |
| Derviş | Arayüz, Canvas ve olay günlüğü | [dervis.md](docs/team/dervis.md) |

Ortak veri sözleşmesi ekip koordinasyonu olmadan değiştirilmemelidir. Başlangıç modülleri örnek uygulamadır. [Mimari ve zaman kuralları](docs/architecture.md), [sınırlamalar](docs/limitations.md).

## Planlanan işler

Senaryo seçimi ve doğrulaması, ayarlanabilir sensör parametreleri, nesne-gözlem eşleştirme ve konum hatası, veri dışa aktarma, daha geniş erişilebilirlik ve tarayıcı testleri. Bunlar mevcut sürümde uygulanmış değildir.

## Bu simülasyon neyi kanıtlamaz?

Gerçek algılama menzilini, saha doğruluğunu, fiziksel termal görünürlüğü veya donanım dayanıklılığını doğrulamaz. Fiziksel olarak doğrulanmış sensör simülatörü değildir. Gerçek donanım, fiziksel radar sinyal işleme, drone/tehdit sınıflandırması, hedef kilitleme, önleme ve atış koordinatları kapsam dışıdır.
