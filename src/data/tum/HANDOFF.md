# Efe → Derviş / Murathan teknik teslim

Ortak sözleşme `src/shared/types.ts` v1 olarak korunur. Veri modülünün kamuya
açık girişi `src/data/index.ts` dosyasıdır. Ayrıntılı kullanım ve kapsam
[`docs/readers.md`](../../../docs/readers.md) içindedir. Bu belge entegrasyon
önerisidir; UI veya `src/app/recordingBinding.ts` dosyasını değiştirmez.

Bu kısa API haritasına ek olarak [Derviş tam kılavuzu](DERVIS-HANDOFF.md),
[Murathan bütünleştirme raporu](MURATHAN-HANDOFF.md) ve
[proje geçmişi/durumu](PROJECT-STATUS.md) okunmalıdır.

## Derviş: görüntü ve kullanıcı etkileşimi

`src/ui/` içinden `TumRecordingReader` ve veri tipleri `../data` ile alınabilir.
Her görüntü akışı bağımsız okuyucuya sahiptir:

```ts
const rgb = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
const depth = new TumRecordingReader({ stream: 'depth', mode: 'manifest-subset' });
```

Dosya seçiciden gelen gerçek `File` nesnelerini, manifestteki göreli yollara
bağlayan `Map<string, Blob>` oluşturun. Manifestte beklenen on dosya haritada
bulunmalı. `open(input)` sonucunu bekleyin; başarılı olduğunda metadata ve
`frameCount` kullanılır. RGB veya depth için küçük örnek üç kare açar.

`getFrame(index)` başarıda ortak `FrameRecord` verir. `index`, seçili akışın API
indeksidir; kaynak TXT indeksi veya diğer akışın eşzamanlı karesi değildir.
`getSourceInfo()` kaynak/API eşlemesini; `getTableMetadata()` özgün/türetilmiş TXT
metadata'sını; `getFrameMetadata(index)` dosya/satır/zaman ve PNG doğrulama
durumunu verir. PNG doğrulanmadan `png.status` değeri `not-read` kalır.

Sonraki kare `index + 1`, önceki kare `index - 1` olarak istenir; yalnız
`0 ≤ index < frameCount` sınırları içinde ilerleyin. UI sınırı aşarsa
`INVALID_INDEX` sonucu döner ve mevcut kayıt hazır kalır. İki akışın aynı API
indeksine birlikte ilerlemesi fiziksel kare eşlemesi değildir.

Başarılı `rgb.open(input)` sonrasında temel gezinme API'si:

```ts
const metadata = rgb.getMetadata();
if (metadata.ok && metadata.value.frameCount > 0) {
  const first = await rgb.getFrame(0);
  const next = metadata.value.frameCount > 1 ? await rgb.getFrame(1) : first;
  const previous = await rgb.getFrame(0);
  // Her sonucun ok alanını kontrol edin. Başarıda image.url; hatada
  // error.message/recovery/file kullanılır. URL tüketimi oturum içinde yapılır.
}
// Kayıt/bileşen bırakılırken: await rgb.close();
```

`FrameTime.kind: unknown` durumunda özgün tokeni silmeyin: Efe metadata'sındaki
`timestampRaw`, birim ve saat belirsizliği birlikte gösterilebilir. RGB/depth
tokenlerini tarihi bilinen Unix saati gibi biçimlendirmeyin. Groundtruth ve
accelerometer tabloları görüntü kareleri olarak sunulmaz.

Hızlı aramada UI kendi istek kuşağını tutmalı ve geç kalan eski sonucu ekrana
taşımamalıdır. Okuyucu en fazla iki PNG işini paralel çalıştırır; aynı kare
istekleri işi/URL'yi paylaşır. İndeks hatası tek başına okuyucuyu kapatmaz.

`ReaderResult.ok: false` olduğunda `error.message`, `error.recovery` ve varsa
`error.file` gösterilir. Hata durumunda sentetik kayda geçilmez. Manifest alt
kümesi dışında kalan 610 RGB / 592 depth referansı kayıp kare diye gösterilmez.

Görüntü URL'leri yalnız açık oturum boyunca geçerlidir. Bileşen kaydı bırakırken
`close()` çağırın ve eski kareyi ekrandan kaldırın. Tekrar close güvenlidir.
React StrictMode cleanup/reopen akışı desteklenir. `withFirstFrame` callback'i
bittiğinde okuyucu kapandığından callback dışına image URL taşımayın.

Depth önizlemesi sayısal ölçüm değildir. Sayısal kullanım istenirse ayrı
`decodeTumDepth(blob, file, signal?)` çağrısı ve `tumDepthToMetres(raw)` kullanılır.
Ham `0`, geçerli ölçüm yok demektir; metre dönüşümü `null` döndürür. Canvas
renklerinden uzaklık/sıcaklık hesaplanmaz. Tüketici kendi AbortSignal ve büyük
sonuç dizilerinin yaşam döngüsünü yönetir.

Kalite görünümü için `src/quality` girişindeki `analyzeTumRecording(input, {
mode: 'manifest-subset', streams: ['rgb', 'depth'], inspectImages: true })`
sonucunu bekleyin. Ortak `report.issues`, önem seviyesi ve kuralı içerir;
`details[issueIndex]` ile kaynak dosya/satır eşlemesi kurulur. `coverage`, gerçekten
incelenen dosya sayılarını ve iptali gösterir. Alt küme taramasında `scope`
`metadata-only` kalır; seçilmeyen referanslar sensör kaybı değildir.

JSON için `createTumReport({ input, metadata, analysis, source?, frameMetadata? })`
sonucunun `ok` alanını denetleyin. Başarıyı `serializeTumReport` veya
`prepareTumJsonDownload` ile dışa aktarın; bu yardımcılar da kontrollü sonuç
döndürür. İndirme yardımcısı kendiliğinden tıklama yapmaz. URL kullanımından
sonra `dispose()` çağrısı UI sahibine aittir. Rapor Blob görüntü URL'sini veya
ham PNG/piksel dizisini taşımaz.

## Murathan: factory, input ve uygulama bağlantısı

Teslim edilen modüller:

| Modül | Sorumluluk / API |
| --- | --- |
| `src/data/tum/reader.ts` | `TumRecordingReader`; ortak API + `getSourceInfo`, `getTableMetadata`, `getFrameMetadata` |
| `src/data/tum/text.ts` | Üç saf TXT ayrıştırıcısı; özgün sıra ve hata satırları |
| `src/data/tum/manifest.ts` | Çalışma anında manifest/map doğrulaması ve Blob referans kopyası |
| `src/data/tum/png.ts` | Lazy PNG yapı/CRC/zlib doğrulaması |
| `src/data/tum/depth.ts` | Açık sayısal uint16 çözümleme ve belgeli metre dönüşümü |
| `src/data/tum/metadata.ts`, `provenance.ts` | Özgün alanlar ve yöntem/kapsam taşıyan türetilen özetler |
| `src/quality/tum.ts` | Asenkron kaynak tablo / seçili görüntü analizi |
| `src/quality/report.ts` | Sürümlü rapor kapsülü, kararlı JSON, indirme kaynağı |
| `src/data/examples/tum-local.ts` | Node yerel dosya yükleyicisi ve gerçek örnek/JSON çalıştırması |

Veri akışı: manifest + Blob haritası → doğrulama → seçili görüntü tablosu ve
kaynak/API eşlemesi → metadata → istenen kare PNG doğrulaması/Blob URL.
Bağımsız analiz aynı girdiden dört TXT'yi ve istenirse seçili PNG'leri tarar →
ortak `QualityReport` + Efe coverage/details → sürümlü JSON kapsülü.
Sayısal depth yalnız açık decoder çağrısıyla bu akışın dışında alınır.

`RecordingBinding.createReader`, her çağrıda yeni bağımsız okuyucu oluşturmalı:

```ts
const createReader = () => new TumRecordingReader({
  stream: 'rgb',
  mode: 'manifest-subset',
});
```

`input`, doğrulanacak TUM manifesti ve manifest-göreli Blob/File haritasıdır.
Platforma özgü mutlak yollar okuyucuya eklenmez. Node dosya okuma/CLI adaptörü
tarayıcı veri API'sinden ayrıdır. Kullanıcı akış/mod seçimini açık yapmalıdır.
İkinci akış gerekiyorsa ayrı binding/reader oturumu kurulur; otomatik eşleme
yapılmaz. Mevcut sentetik binding çalışma örneği olarak korunur.

V1 `RecordingBinding.analyze`, senkron olarak yalnız `RecordingMetadata` alır.
PNG/dosya taraması yapan asenkron gerçek kayıt analizi bu fonksiyonun içine
gizlenemez. Tam analiz açık bir adımda `RecordingInput` ile çalıştırılmalı;
sonuç kayıt kimliği, dosya seçimi, akış ve kapsamıyla eşlenerek sunulmalıdır.
Ortak `analyzeMetadata` hızlı metadata-only görünümü için kullanılabilir.
Ortak sözleşmenin asenkron analiz alanı ihtiyacı ekipçe koordine edilir.

Önerilen entegrasyon sırası: kullanıcı dosyaları ve kapsamını seçer; input kurulur;
factory ile okuyucu açılır; ilk/sonraki kare temel ortak API ile gösterilir;
ayrı kullanıcı eylemi analiz başlatır; analiz bittiğinde aynı kayıt/seçime ait
report gösterilir ve isteğe bağlı JSON dışa aktarılır; kayıt değişince görüntü
ve analiz iptal edilir, URL kaynakları bırakılır. Bu adımlar burada yalnız
teknik teslimdir; mevcut uygulama bağlantısı otomatik değiştirilmemiştir.

Efe'ye özgü kaynak tablosu/derinlik/provenance alanlarını ortak `FrameRecord`
üzerine zorla eklemeyin. Yalnız `RecordingReader` bekleyen tüketici temel API'yi
kullanabilir; ayrıntılı inceleme ekranı modülün ek API'sine açıkça bağlanabilir.

Gelecekte ortak sözleşme için öneriler: açık `StreamDescriptor`, ham özgün zaman
tokeni/birimi/saat kökenini ayıran zaman alanı, kaynak/API indeks eşlemesi, sayısal
depth payload'ı ve asenkron analiz ilerleme/iptal/kapsam alanları. Bunlar mevcut
v1'e eklenmiş değildir; tüketici ve örnek JSON etkileri ekipçe değerlendirilmelidir.

Teknik borç/sınırlar: TXT'nin tümü belleğe alınır ve 32 MiB üst sınır vardır;
ziyaret edilmiş kare URL'leri oturum sonuna kadar tutulur; sayısal depth için
tam doğrulama ardından ikinci zlib geçişi gerekir; tam arşiv taraması küçük
örnek sonucundan çıkarılamaz. `DecompressionStream('deflate')` ortam yeteneğidir;
tarayıcı File/React etkileşimi ayrı doğrulanmalıdır. Rapor veri setinin orijinal
bütün baytlarını taşıyan arşiv değildir; yalnız izlenebilir metadata ve özet içerir.

Gerçek örneği yeniden üretmek için önce `docs/datasets.md` içindeki resmî edinme
ve yerel referans hash kontrollerini uygulayın. `data/local/` Git dışında
kalmalıdır. Çalışan kontrol komutları:

```sh
npm run typecheck
npm test
npm run build
```

Gerçek dosyaları bulamayan testin skip sonucu başarıyla doğrulanmış gerçek veri
demek değildir. Node kontrolleri tarayıcı File seçimi ve gerçek UI gezinmesinin
yerine geçmez. Veri paylaşımında TUM/CC BY 4.0 ve IROS 2012 atfı korunmalıdır.

18 Ekim 2026 son teslim kontrolü: **104 test geçti, 0 hata, 0 skip**;
typecheck/build ve mevcut sentetik `example:reader` başarılıdır. Gerçek CLI
örneği ayrıca çalıştı: 613/595/2.335/11.815 TXT kaydı; altı seçili PNG; 1.202
örnek dışı referans; `metadata-only` JSON. Native tarayıcı API kontrolü altı
görüntüyü, üç sayısal depth dizisini ve URL cleanup'ını doğruladı; UI dosya
seçici/React uygulama bütünleştirmesi ve büyük kayıt bellek ölçümü yapılmadı.

Nihai denetim sonucu **107 test geçti, 0 hata, 0 skip**; typecheck/build ve
iki kullanım örneği başarılı. Yeni regresyonlar close/reopen ile kare sonucunun
teslimi arasındaki yarış ve source opsiyonu verilmeden rapora yanlış kare
provenance bağlanmasını kapsar. Derviş tam kılavuzundaki TypeScript örneği de
derlenip gerçek dosyalarda çalıştırıldı; indirme ve reader URL temizliği doğrulandı.
