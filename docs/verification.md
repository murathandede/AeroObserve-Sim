# Başlangıç sürümü doğrulaması

18 Ekim 2026 · Node 24.15.0 · npm 11.12.1 · `feat/bootstrap`

| Kontrol | Sonuç |
| --- | --- |
| `npm.cmd install` | Başarılı; 24 paket, kurulum anında audit 0 güvenlik açığı bildirdi. |
| `npm.cmd run build` | Başarılı; Vite üretim çıktısı `dist/`. |
| `npm.cmd run typecheck` | Başarılı. |
| `npm.cmd test` | 5 test geçti, 0 hata. |
| `npm.cmd run dev` | Vite 127.0.0.1:5173 üzerinde başlatıldı. |
| HTTP kontrolü | `/`, ana TSX modülü, App, Scene ve React/React DOM optimize modülleri HTTP 200 döndürdü. |

Motor testleri: aynı seed ile farklı adım/render sıklıklarında eşitlik; yeni motorla sıfırlama; teslimden önce veri görünmemesi ve benzersiz teslim; saat ilerletilmediğinde durumun sabit kalması ve süre sınırı; kesinti, yeniden erişim, yoğunluk aralığı ve metrik hesabı.

İlk sandbox içi dev denemesinde esbuild dizin erişim hatası verdi. Aynı komut gerekli erişimle yeniden çalıştırıldı ve HTTP kontrolleri geçti. PowerShell npm.ps1 çalıştırmayı kısıtladığı için `npm.cmd` kullanıldı; sistem yürütme politikası değiştirilmedi. Doğrulama sonrası dev sunucusu kapatıldı.

Tarayıcı aracı mevcut değildi. Görsel görünüm, gerçek tıklama/klavye akışı, requestAnimationFrame temizliği ve mobil görünüm tarayıcıda doğrulanmış değildir. Bunlar kaynak kod incelemesiyle ele alındı; motor testleri arayüz uçtan uca testlerinin yerine geçmez.

## Elle tamamlanacak kontroller

1. `npm run dev` ile açın; sentetik veri etiketini ve termal açıklamayı kontrol edin.
2. Başlatın, duraklatın; zaman ve nesneler durmalı. Devam edin; duraklatılan süre eklenmemeli.
3. Hızı değiştirin; aynı seed ve aynı simülasyon zamanında sonuçlar değişmemeli.
4. Seed'i değiştirin; sıfırlayana kadar etkin seed değişmemeli. Sıfırlayın; zaman, günlük ve ölçümler yeniden başlamalı.
5. Katmanları ayrı açıp kapatın. İlk anda boş veri, 20–28 s aralığında kullanılamıyor durumu görünmeli.
6. Tab/Enter/Space ile kontrolleri deneyin; dar ekran ve sayısal veri alternatifini inceleyin.
7. 120 s sonunda otomatik durmayı ve sıfırlama ile yeni oturumu kontrol edin.
