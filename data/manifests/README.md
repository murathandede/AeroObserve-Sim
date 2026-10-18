# Manifest şablonu — Ahmet'in alanı

`template.json` tamamlanmış bir veri kaynağı değildir; gerçek dosya içermez ve uygulama tarafından otomatik açılmaz. Kopyalayarak `<kaynak>-<kayit>.json` oluşturun. Şema: `DatasetManifest` (`src/shared/types.ts`). JSON yorum kabul etmediği için açıklamalar burada tutulur.

| Alan | Nasıl doldurulur? |
| --- | --- |
| contractVersion | Şimdilik 1. Sözleşme değişikliği ekipçe kararlaştırılır. |
| recording.id/name | Kararlı kayıt kimliği ve okunaklı ad. |
| recording.provenance | Gerçek kayıtta real; geliştirme çiziminde synthetic. Şablondaki real bir veri doğrulaması değildir. |
| recording.source | Resmî başlık ve URL. Bilinmiyorsa url=null. |
| recording.license | Bilinmiyorsa status=unknown. Doğrulanırsa status=known, value=lisans, evidence=lisans belgesi URL'si veya yolu. Makaleye erişim veri kullanım izni değildir. |
| format | Bilinmiyorsa unknown. Biliniyorsa value=biçim/sürüm, evidence=biçim belgesi. |
| acquisition.instructions | Erişim koşulları, küçük örneğin indirme adımları, varsa arşivden çıkarılacak dosyalar; token/parola yazmayın. |
| acquisition.files | Seçilen küçük örneğin göreli dosya yolları. Mutlak bilgisayar yolu yazmayın. Boş liste tamamlanmamış şablon demektir. |
| timing.kind | original / derived / unknown. Dosya adından otomatik zaman üretmeyin. |
| timing.timeBase | Belgelenmiş zaman tabanı; ör. kayıt başlangıcına göre saniye. Bilinmiyorsa null. |
| timing.description | Özgün zamanın kaynağı veya türetme yöntemi ve varsayımı. |
| timing.nominalFps | Belgelenmişse known/value/evidence; yoksa unknown. Oynatma hızı buraya yazılmaz. |
| radiometry.status | available / unavailable / unknown; renklendirilmiş görüntü sıcaklık ölçümü değildir. |
| radiometry.unit/evidence | Belgelenmiş birim ve dönüşüm belgesi; bilinmiyorsa null ve açıklama. |
| citation | Kaynağın istediği atıf veya null. |
| versionOrAccessDate | Kaynak sürümü veya gerçekten erişilen tarih; bilinmiyorsa null. |

Gerçek kayıt seçilmeden biçim tahmin etmeyin. Ahmet tamamlanmış manifesti, biçim belgesini ve küçük örneği **doğrudan Efe'ye** iletir. Ham dosyalar `data/local/` altında kalır; Git'e eklenmez. Derviş bunları beklemeden sentetik adaptörle çalışır.
