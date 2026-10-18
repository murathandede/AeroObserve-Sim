> Güncel görev kapsamı için [ortak proje çerçevesi](../project-context.md) bölüm 13 esas alınır. Aşağıdaki metin sentetik başlangıç demosunun önceki görev kapsamını belgeler.

# Derviş — arayüz

- **Kapsam:** Türkçe araştırma paneli, Canvas, olay günlüğü ve görsel durumlar.
- **Dosya sahipliği:** `src/ui/`; `src/app/App.tsx` etkileşimleri için Murathan ile koordinasyon.
- **Girdi:** WorldFrame, SensorFrame, ThermalFrame, SimulationEvent ve hesaplanan metrikler.
- **Çıktı:** Erişilebilir katmanlar, okunaklı sahne, termal ölçek, kontroller ve günlük.
- **Tamamlanma ölçütleri:** Klavye ile kullanım; görünür odak; mobil/masaüstü düzen; sentetik veri etiketi; boş/duraklatılmış/kullanılamıyor durumları ayrı; Canvas alternatifi; unmount sırasında zamanlayıcı temizliği; render içinde rastgele veri üretimi yok.

Başlangıç: `src/ui/Scene.tsx`, `src/ui/styles.css`. Sonraki iş tarayıcıda görsel ve klavye testleri, yüksek DPI Canvas ve otomatik etkileşim kontrolleridir.

Ortak veri sözleşmesi ekip koordinasyonu olmadan değiştirilmemelidir. Arayüz uğruna fiziksel birim veya hesaplanmamış başarı oranı eklemeyin.
