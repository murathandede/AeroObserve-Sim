# Ortak kayıt sözleşmesi v1

Tek kaynak: `src/shared/types.ts`. Eski simülasyon tipleri korunmuştur; yeni kayıt tipleri aynı dosyaya eklenmiştir. Değişiklik gerektiğinde örnek JSON, tüketiciler ve testlere etkisini ekipçe değerlendirin. Farklı modüllerde kopya tip tanımlamayın.

| Tip | Girdi/çıktı anlamı |
| --- | --- |
| RecordingInfo | id, name, provenance, source başlığı/URL'si, license. Kaynak URL'si bilinmiyorsa null. |
| Known<T> | unknown veya known/value/evidence; boş sayısal değer yerine unknown. |
| DatasetManifest | Kaynak, biçim, edinme, zaman ve radyometri bilgileri. contractVersion=1. |
| RecordingInput | Manifest + göreli yol → Blob haritası. Gerçek File nesneleri Blob olarak kullanılabilir. |
| RecordingMetadata | Kayıt bilgisi, doğrulanmış kare sayısı, biçim, zaman/radyometri, okuyucu id/sürümü. |
| FrameRecord | Sıfırdan başlayan index, image URL/boyut/alt açıklaması, time. Sıcaklık yalnızca gerçekten varsa opsiyonel temperature alanındadır. |
| FrameTime | original: seconds/timeBase/source; derived: seconds/timeBase/method; unknown: başka alan yok. |
| ReaderResult<T> | ok=true/value veya ok=false/error; sessiz sentetik fallback yok. |
| ReaderState | idle/opening/ready/error/closed. Hata durumunda ReaderError içerir. |
| ReaderError | code/message/recovery; varsa ilgili göreli file. Kullanıcıya neyi düzelteceğini açıklar. |
| QualityIssue | code/severity/recordingId/opsiyonel frameIndex/message/rule. Bulguyu doğuran kural görünür. |
| QualityReport | metadata-only veya full-recording kapsamı, bulgular, desteklenmeyen analizler. |
| RecordingBinding | createReader, input ve metadata analiz fonksiyonu; uygulamadaki değiştirilebilir bağlantı. |

## Kurallar

- İndeks tam sayı, `0 <= index < frameCount`; `frameCount=0` boş kayıt demektir.
- Zamanın sayısal birimi saniyedir, sonlu sayı olmalıdır. Başlangıç noktası `timeBase` ile açıklanır. Farklı tabanlar doğrudan karşılaştırılmaz. Özgün birimden saniyeye dönüşüm source açıklamasına yazılır.
- Özgün zaman yoksa unknown kullanılır. Belgeli örnekleme hızından türetilirse method alanı zorunludur. Gösterim hızı zaman üretmez.
- `temperature` verilirse gerçek radyometrik değerler, belgeli birim, `width*height` uzunluk ve kaynak dönüşüm yöntemi gerekir. SVG örneğinde bu alan hiç yoktur.
- Görüntü URL'si yerel paket varlığı veya okuyucunun oluşturduğu blob URL'sidir. Okuyucu URL'leri close'a kadar geçerli tutar. close sonrası UI eski kareyi kullanmaz. Uzaktaki dosyaları UI kendi kendine indirmez.
- TypeScript dış JSON'u çalışma anında doğrulamaz. Gerçek okuyucu manifesti ve dosyaları doğrulamak zorundadır; şablon hazır veri kaynağı değildir.
- Lisansın unknown olması kullanım izni anlamına gelmez. Gerçek kaynak Efe'ye teslim edilmeden edinme/kullanım koşulları belgelenir.

## Sınır haritası

Ahmet `DatasetManifest` üretir → Efe `RecordingReader` ve `QualityReport` üretir → Murathan `RecordingBinding` ile bağlar → Derviş `RecordingWorkbench` içinde ortak çıktıları gösterir. Dosya okuma ve zamanlayıcı UI içine taşınmaz.
