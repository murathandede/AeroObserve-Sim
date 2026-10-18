> Güncel görev kapsamı için [ortak proje çerçevesi](../project-context.md) bölüm 13 esas alınır. Aşağıdaki metin sentetik başlangıç demosunun önceki görev kapsamını belgeler.

# Ahmet — sentetik dünya

- **Kapsam:** Genel hareketli nesneler ve tekrar üretilebilir senaryolar.
- **Dosya sahipliği:** `src/simulation/`, `scenarios/`, ilgili dünya testleri.
- **Girdi:** SimConfig, seed, simülasyon zamanı, senaryo parametreleri.
- **Çıktı:** WorldFrame ve deterministik dünya olayları; soyut sahne birimleriyle konum/hız.
- **Tamamlanma ölçütleri:** Aynı seed ve zaman aynı sonucu verir; render sıklığı sonucu değiştirmez; sınır davranışı tanımlıdır; sıfırlama PRNG ve saati geri kurar; yeni senaryolar testle doğrulanır.

Başlangıç: `src/simulation/world.ts`, `src/simulation/engine.ts`, `scenarios/default.json`. Bunlar örnek uygulamadır; sonraki iş senaryo şeması, doğrulama ve farklı hareket örnekleridir. Tick süresi şu an motor içinde 0.1 s olarak sabittir; JSON'daki açıklayıcı alanla birlikte koordine edilmelidir.

Ortak veri sözleşmesi ekip koordinasyonu olmadan değiştirilmemelidir. Efe ile örnekleme zamanı; Murathan ile saat sahipliği üzerinde uzlaşın.
