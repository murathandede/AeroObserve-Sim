# Veri kataloğu

Sahip: Ahmet. Henüz gerçek veri kaynağı seçilmedi, lisansı doğrulanmadı veya okuyucuya bağlanmadı.

| Kayıt | Durum | Konum | Sınır |
| --- | --- | --- | --- |
| synthetic-ui-v1 | GELİŞTİRME ÖRNEĞİ — SENTETİK | src/demo/recording/ | Üç özgün SVG, yalnızca bu SVG'ler için CC0-1.0; zaman/sıcaklık verisi yok. |
| template | Doldurulacak şablon | data/manifests/template.json | Gerçek kaynak veya dosya olduğu anlamına gelmez. |

## Ahmet → Efe teslimi

1. Resmî kaynak URL'sini, başlığı, sürüm/erişim tarihini, atfı ve lisansın kanıtını yaz.
2. `data/manifests/template.json` kopyasını doldur; alan açıklamaları aynı dizinin README'sinde.
3. Dosya biçimi ve metadata düzenini gerçek küçük örnek üzerinden belgele; zaman/radyometri belirsizliğini koru.
4. Küçük örneği `data/local/<recording-id>/` içine yerleştir; dosya listesini ve mümkünse SHA-256 özetlerini bu belgede belirt. Özetlerin hangi dosyaya ait olduğunu yaz.
5. Efe'ye manifest yolu, biçim belgesi, edinme adımları ve küçük örneğin yerel konumunu doğrudan ilet. Lisans izin vermiyorsa örneği yeniden dağıtma; edinme talimatı ilet.

Hedef ilk etapta tek belgeli gerçek termal akıştır. Ortak kayıt/kalibrasyon kanıtı yoksa sensör ilişkisi varsayılmaz. Büyük zaman aralığı tek başına kayıp kare kanıtı değildir.
