# Mimari ve ortak sözleşme

Bu başlangıç modülleri **örnek uygulamadır**; ekip tarafından genişletilecektir. Backend, gerçek sensör ve dış veri kaynağı yoktur.

Akış: `scenarios/default.json` → `simulation/world.ts` → `simulation/engine.ts` → `sensors/example.ts` → teslim kuyruğu → `evaluation/metrics.ts` → `app/App.tsx` ve `ui/Scene.tsx`.

## Birimler ve alanlar

Ortak sözleşme `src/shared/types.ts` içindedir. Ekip koordinasyonu olmadan değiştirilmemelidir.

| Tip | Alanların anlamı |
| --- | --- |
| Position2D | x, y: 0–100 soyut sahne birimi; metre veya coğrafi koordinat değildir. Y yukarı doğru artar. |
| SimConfig | seed: 0–4294967295 tam sayı; durationSeconds: pozitif simülasyon süresi (s). |
| WorldObject | id: genel nesne kimliği; position: gerçek sentetik durum; velocity: sahne birimi/s; thermalIntensity: 0–1 boyutsuz temsili yoğunluk. |
| WorldFrame | timeSeconds: simülasyon zamanı; objects: o andaki tüm nesneler. |
| SensorObservation | id: örneklem ve nesneye göre benzersiz gözlem; sensorId: kaynak; observedAtSeconds: üretim zamanı; receivedAtSeconds: teslim zamanı; position: gürültülü koordinat; quality: enjekte edilen konum sapmasından hesaplanan 0–1 örnek kalite, kalibre edilmiş güven değildir. |
| SensorFrame | sensorId, timeSeconds, observations: teslim edilmiş son 1 saniyelik gözlemler; available: bu anda sensör kullanılabilir mi. |
| ThermalFrame | timeSeconds; width/height: matris boyutu; pixels: satır öncelikli 0–1 boyutsuz yoğunluk (ilk satır y=0); available: erişilebilirlik. Kesintide pixels boş. |
| SimulationEvent | timeSeconds: olayın simülasyon zamanı; severity: info/warning; source: modül; message: Türkçe açıklama. |

## Tek saat ve tekrar üretilebilirlik

Motor 0.1 s tam sayı tick kullanır; her 5 tick'te örnekleme yapılır. `advanceTo` eksik bütün adımları sırayla işler. Dünya başlangıç seed'inden üretilir; konumlar başlangıç durumu ve zamandan analitik hesaplanır, sınırda yansır. Sensör için ayrı seed'li PRNG kullanılır. Render ve `snapshot` rastgele sayı tüketmez. Aynı seed ve simülasyon zamanı, aynı çıktıyı verir.

Arayüz `performance.now` farkını oynatma hızıyla çarpar; tek saat hedefini motora iletir. requestAnimationFrame yalnızca bu saate sürücüdür. Duraklatmada ve bileşen temizliğinde callback iptal edilir; devam ederken yeni duvar saati referansı alınır. Gizli sekmede geçen çalışma süresi dönüşte işlenir; duraklatılan süre eklenmez. Süre bitince otomatik durur. Yeni seed yalnızca sıfırlamada uygulanır; yeni motor, kuyruk, PRNG, saat, ölçümler ve olaylar baştan kurulur.

Gözlemler 0.2–0.8 s gecikmeyle kuyruğa girer; `receivedAtSeconds <= timeSeconds` olmadan yayınlanmaz. %12 örnek düşürme olasılığı vardır; bu bir başarı metriği değildir. Kesintide yeni örnek üretilmez; önceden kuyruktaki veriler teslim edilebilir ve toplam sayıya katılır, görünür gözlem katmanı kesinti boyunca boş tutulur. Termal panel aynı saati kullanır, gecikmesiz örnek matristir. Olay günlüğü son 80 motor olayını tutar; oynatma durumu ayrıca başlıkta gösterilir.

## Ölçümler

Kullanılabilirlik = erişilebilir örnekleme anları / tüm örnekleme anları. Eksik tekil gözlemler bu oranı değiştirmez. Teslim gecikmesi = tüm teslim edilmiş gözlemlerde `(receivedAtSeconds - observedAtSeconds)` ortalaması, ms cinsinden. Veri yoksa `—`. Konum hatası henüz uygulanmadığı için `—`. Eski gözlemler toplam metriklerde korunur, sahnede teslimden itibaren yalnızca 1 saniye görünür.

Canvas sabit iç çözünürlükte ve CSS ile duyarlıdır. Sayısal alternatif HTML tabloda sunulur. Termal görünüm bir görüntüleme örneğidir; fiziksel sıcaklık ölçeği yoktur.
