> Güncel görev kapsamı için [ortak proje çerçevesi](../project-context.md) bölüm 13 esas alınır. Aşağıdaki metin sentetik başlangıç demosunun önceki görev kapsamını belgeler.

# Murathan — bütünleştirme

- **Kapsam:** Uygulama bütünleştirmesi, ortak sözleşme, değerlendirme, ana README.
- **Dosya sahipliği:** `src/app/`, `src/shared/types.ts`, `src/evaluation/`, `README.md`, `docs/architecture.md`, bütünleştirme kontrolleri.
- **Girdi:** Dünya ve sensör kareleri, teslim edilmiş gözlemler, ekip değişiklikleri.
- **Çıktı:** Tek saatle çalışan uygulama, tanımlı ölçümler, güncel kullanım belgesi.
- **Tamamlanma ölçütleri:** Build/typecheck/test geçer; ölçümler gerçek veriden hesaplanır; boş metrik `—` olur; modüller sözleşmeye uyar; sıfırlama bütün durumları temizler.

Başlangıç: `src/app/App.tsx`, `src/evaluation/metrics.ts`, `tests/simulation.test.ts`. Sonraki iş: gözlem eşleştirmesini ekipçe tanımlayıp konum hatasını eklemek.

Ortak veri sözleşmesi ekip koordinasyonu olmadan değiştirilmemelidir. Sözleşme değişikliklerini diğer üç üye ile birlikte değerlendirin.
