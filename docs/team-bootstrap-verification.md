# Ortak modül başlangıcı — doğrulama

18 Ekim 2026. Bu rapor yeni kayıt geliştirme alanı içindir; önceki `verification.md` eski simülasyonun raporudur.

| Kontrol | Sonuç |
| --- | --- |
| npm run build | Başarılı; Vite 46 modülü derledi. |
| npm run typecheck | Başarılı; sentetik sınıf RecordingReader uygular ve testte arayüz üzerinden kullanılır. |
| npm test | 9 test geçti: 4 kayıt sözleşmesi + korunan 5 simülasyon testi. |
| npm run example:reader | Başarılı: 3 kare, indeks 0, zaman unknown, sıcaklık yok. |
| git diff --check | Başarılı; yalnızca Windows satır sonu bilgilendirmeleri. |

Kayıt kontrolleri open → metadata → getFrame → close → yeniden açma akışını, tüm SVG'lerin yerel ve sentetik etiketli olmasını, geçersiz indeksleri, gerçek kayıt/yanlış biçimin reddini, metadata kopyalarını, bilinmeyen zaman/sıcaklık bilgisini, kalite kapsamını ve tüketici hata verse bile kaynakların kapanmasını doğrular.

Tarayıcı aracı yoktu. Görsel yerleşim, klavye kullanımı, arama/oynatma etkileşimleri ve React yaşam döngüsü gerçek tarayıcıda test edilmiş sayılmaz. Kodda timer temizliği ve eski async sonuçların elenmesi vardır; otomatik testler React etkileşim testleri değildir.

## Manuel kontrol

1. npm run dev; ana sayfada Kaydı aç. Sentetik etiket, 3 kare, bilinmeyen zaman ve sıcaklık yok bilgilerini kontrol et.
2. Önceki/sonraki ve kaydırıcıyla 0–2 aralığında gezin. Oynat/duraklat/hız değiştir; son karede dursun.
3. Kaydı kapat; kare ve metadata temizlensin. Yeniden aç; indeks 0 olsun. Hızlı aç/kapat/arama ile eski sonuçların geri gelmediğini kontrol et.
4. Klavye ve dar ekran kontrolü yap. Önceki sentetik simülasyon bağlantısının çalıştığını kontrol et.

Gerçek veri kaynağı, gerçek termal okuyucu, yerel dosya seçimi, kaynak zamanlı oynatma ve tam kayıt kalite raporu bu teslimin tamamlanmış özellikleri değildir. Yeni bağımlılık eklenmedi. Commit, push veya merge yapılmadı.
