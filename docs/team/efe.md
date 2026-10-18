> Güncel görev kapsamı için [ortak proje çerçevesi](../project-context.md) bölüm 13 esas alınır. Aşağıdaki metin sentetik başlangıç demosunun önceki görev kapsamını belgeler.

# Efe — örnek sensörler

- **Kapsam:** Sentetik gürültü, gecikme, eksik veri ve kesinti.
- **Dosya sahipliği:** `src/sensors/` ve ilgili sensör testleri; teslim kuyruğu için Ahmet ile koordinasyon.
- **Girdi:** WorldFrame, deterministik rastgele sayı kaynağı ve erişilebilirlik.
- **Çıktı:** SensorObservation dizisi ve ThermalFrame; teslim zamanları üretimden sonra, yoğunluklar 0–1 aralığında.
- **Tamamlanma ölçütleri:** Erken teslim yok; aynı seed aynı gözlemleri verir; kesintide yeni gözlem üretilmez; eksik veri açıkça modellenir; boş/kullanılamıyor ayrımı korunur; modeller fiziksel ölçüm gibi sunulmaz.

Başlangıç: `src/sensors/example.ts`. Bu örnek uygulamadır; sonraki iş ayarlanabilir gürültü/gecikme profilleri ve bağımsız sensör kesintileridir. Quality alanı fiziksel güven skoru değildir.

Ortak veri sözleşmesi ekip koordinasyonu olmadan değiştirilmemelidir. Zaman alanlarını Murathan ve Ahmet ile birlikte değerlendirin.
