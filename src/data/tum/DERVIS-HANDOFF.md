# Efe → Derviş: gerçek kayıt arayüzü ve oynatıcı devir kılavuzu

Bu belge UI uygulaması değildir. `src/ui/` değiştirilmedi. Ortak API ve biçim
ayrıntıları [docs/readers.md](../../../docs/readers.md), kısa ekip bağlantısı
[HANDOFF.md](HANDOFF.md), kanıtlı proje durumu [PROJECT-STATUS.md](PROJECT-STATUS.md).

## A. Genel mimari ve teslim sınırı

AeroObserve, gerçek kayıtları kaynak/birim/zaman belirsizlikleriyle birlikte
inceleyen araştırma altyapısıdır. Radar–termal füzyonu veya saha algılama başarısı
bu teslimin sonucu değildir. Efe dosya/metadata/kalite/JSON katmanını sağlar;
Derviş dosya seçimini, görüntüyü, gezinmeyi ve panelleri; Murathan uygulama
binding'i ve sistem yaşam döngüsünü bağlar. Mevcut uygulama sentetik binding ile
çalışır; gerçek TUM modülünün bulunması UI bütünleştirmesinin tamamlandığı anlamına gelmez.

Çalışan veri zinciri: gerçek Blob/File haritası + manifest → tek akış okuyucusu
→ metadata/istenen kare → ayrı asenkron kalite analizi → sürümlü JSON → cleanup.
Görüntü decode ve kaynak analizi UI bileşenlerinin içine yeniden yazılmamalıdır.

## B. Gerçek veri edinme ve yerleşim

Veri seti **TUM RGB-D / freiburg1_desk**. [Resmî kaynak](https://cvg.cit.tum.de/data/datasets/rgbd-dataset),
[indirme sayfası](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/download),
[biçim belgesi](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats).
CC BY 4.0 lisansı ve Sturm ve diğerleri, IROS2012 atfı korunur. Başka sitelerden
örnek veya yeniden kodlanmış depth alınmaz. Tam edinme komutları ve dosya
hash tablosu [docs/datasets.md](../../../docs/datasets.md) içinde Ahmet'e aittir.
SHA-256 değerleri yerel referanstır; resmî yayımlayıcı checksum'ı değildir.

Manifest: `data/manifests/tum-rgbd-freiburg1-desk.json`. Özgün TGZ içinden bu
manifestteki **10 üye** değiştirilmeden çıkarılır; bütün arşivi açmak zorunlu değildir.
Yerel düzen:

```text
data/local/tum-rgbd-freiburg1-desk/
  rgbd_dataset_freiburg1_desk/
    rgb.txt                 # tam liste: 613 kayıt
    depth.txt               # tam liste: 595 kayıt
    groundtruth.txt         # 2335 kayıt
    accelerometer.txt       # 11815 kayıt
    rgb/                    # manifestteki üç özgün PNG
    depth/                  # manifestteki üç özgün PNG
```

`data/local/` ve `reports/local/` Git dışında kalır. Tam TXT listesi yerel bütün
PNG'lerin mevcut olduğu anlamına gelmez. `manifest-subset` üç kare/akış verir;
`full-recording` seçili kaynak listesinin bütün PNG'lerini gerektirir.

## C. API, manifest ve File bağlama

UI içindeki import girişleri `../data` ve `../quality` olur. `TumRecordingReader`,
`RecordingInput`, `DatasetManifest`, `FrameRecord`, `ReaderError`, metadata/depth
tipleri veri girişinde; kalite/report/download işlevleri kalite girişindedir.
Node'a özgü `tum-local.ts` tarayıcı uygulamasına import edilmez.

JSON dosyası `JSON.parse(await manifestFile.text())` ile okunabilir; JSON parse
hatası dosya seçim katmanında gösterilmelidir. `DatasetManifest` cast'i yalnız
TypeScript içindir; manifest doğrulaması `open(input)` sırasında yapılır.
Yerleşik gerçek manifestin kullanıldığı tam örnek L bölümündedir.

Dosya seçimi `Map<string, Blob>` üretmelidir. Anahtar örneği:
`rgbd_dataset_freiburg1_desk/rgb/1305031452.791720.png`.
`File` zaten Blob alt türüdür. `File.name` yalnız basename olduğundan tek başına
dosya anahtarı olamaz. Klasör seçiminde `webkitRelativePath` önüne eklenen
`tum-rgbd-freiburg1-desk/` seçici kökü kontrollü kaldırılır; kalan yol manifest
anahtarıyla birebir eşleşir. Yolun keyfî son kısmını almak veya sadece basename'e
göre birleştirmek farklı klasörlerdeki dosyaları karıştırabilir. Yinelenen anahtar
UI'da reddedilir. Okuyucu güvenli göreli yolları ve Blob değerlerini ayrıca doğrular.

RGB: `new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' })`.
Depth için ayrı örnek, `stream: 'depth'`. `await open(input)` sonucunu bekleyin;
`ok:false` ise `error.message/recovery/file` gösterin, sentetik kayıt açmayın.

## D. İlk/son/sonraki/önceki kare

Kare sayısı başarılı `open` veya `getMetadata().value.frameCount` alanından gelir.
İlk indeks0; son indeks `frameCount - 1`; sıfır karede getFrame çağrılmaz.
Sonraki/önceki istek `getFrame(index + 1)` / `getFrame(index - 1)` olur ve sınır
UI'da kontrol edilir. Başarıdaki `FrameRecord.index` API indeksidir; hata mevcut
başarılı kareyi otomatik değiştirmemelidir. `INVALID_INDEX` kaydı bozmaz.

Gerçek alt küme: API `[0,1,2]`; RGB kaynak `[0,306,612]`, depth kaynak `[0,297,594]`.
`getSourceInfo()` fiziksel satır, kaynak indeks, dosya ve ham zaman eşlemesini
verir. Kaynak indeksiyle doğrudan getFrame çağrısı yapılmaz. Aynı API indeksi iki
akışta eşzamanlı görüntü demek değildir.

## E. Metadata paneli

| Kaynak / API | Gösterilecek anlam |
| --- | --- |
| `getMetadata()` | Kayıt kimliği/kaynak/lisans, seçili kare sayısı, biçim, reader sürümü, global unknown zaman ve unavailable radyometri |
| `getSourceInfo()` | Seçili akış/mod; tam kaynak sayısı; API ↔ kaynak indeks/satır/yol/token |
| `getTableMetadata().original` | Özgün TXT tokenleri/satırları, sütunlar ve birim kanıtları |
| `getTableMetadata().derived` | Tam TXT sırasından süre/aralık/adet özetleri; her birinde yöntem/birim/girdi/kapsam |
| `getFrameMetadata(i).original` | Dosya/satır/kaynak indeks/özgün zaman; PNG okunmadıysa not-read, getFrame doğruladıysa verified |
| `getFrameMetadata(i).derived` | Seçili kapsamın türetilmiş API indeksi |

Groundtruth zaman birimi saniye ve referansı Unix epoch; yaklaşık20ms referans
düzeltmesi kaynakta zaten uygulanmış, tekrar uygulanmaz. RGB/depth ve accel
ham zaman tokenleri mevcut; bu sürümde bağımsız birim/köken kanıtı unknown kalır.
Accelerometer fiziksel birimi de unknown'dur. Depth encoded-uint16 ve belgeli
raw/5000 metre dönüşümü vardır. RGB kanal kodları fiziksel sıcaklık değildir.
Sayı uydurarak paneli doldurmayın; null/unknown/not-read ayrı gösterilsin.

## F. Kalite paneli

`await analyzeTumRecording(input, { mode: 'manifest-subset', streams: ['rgb','depth'],
inspectImages: true, signal })` sonucu `TumQualityAnalysis` verir; ortak
`QualityReport`, `analysis.report` içindedir. Bu işlev ReaderResult değildir;
beklenen veri sorunları `report.issues` bulgularıdır. `coverage.completed` ve
`cancelled` kontrol edilmeden tarama tamamlandı yazılmamalıdır.

`info` bilgi/belirsizlik; `warning` örneğin yinelenen veya geriye giden kaynak
zaman; `error` geçersiz/okunamayan/eksik beklenen içerik anlamındadır. `code`,
`message`, `rule`, varsa `frameIndex` gösterilir. `details` girdileri `issueIndex`
ile ilgili issue'ya bağlanır; dosya/satır/kaynak indeks ayrıntısı kaybolmaz.
`report.unsupported` ve `limitations` hata listesine karıştırılmadan görünür tutulur.

Alt kümenin altı PNG'si doğrulansa da scope metadata-only kalır. Tam TXT'lerde
zaman analizi yapıldığı, görüntü incelemesinin altı dosyayla sınırlı olduğu ayrı
yazılır. Örnek dışı610RGB/592depth referansı kayıp sensör karesi değildir.
`MISSING_FILE`, manifestte beklenen yerel dosyanın eksikliğini gösterir. Görüntü
tarama seçeneği kapalıysa varlık kontrolünü bütünlük doğrulaması gibi sunmayın.

## G. Zaman çizelgesi ve oynatma

Mevcut v1 görüntü FrameTime unknown'dur. Böyle durumda çizelge kare indeksini
ve kullanıcının seçtiği **gösterim hızını** kullanabilir; bunu sensör FPS'i olarak
etiketlemeyin. Saniyeli ölçüm çizelgesi üretmek için akışa özgü doğrulanmış
zaman birimi/kökeni gerekir. `timestampRaw` kaynaktaki özgün token demektir;
fiziksel pozlama saati garantisi değildir. `metadata.timing.kind: unknown`
sayısal token olmadığı anlamına gelmez.

Uygulama oynatma saati, dosyanın kayıt saati değildir. Ortak denetleyici Murathan
ile bağlanır; her panelin bağımsız timer kurması önlenir. RGB/depth eşleştirmesi,
aynı indeks, dosya adı veya ortalama20ms fark üzerinden otomatik yapılmaz.
Groundtruth ve accelerometer ayrı tablolar olarak değerlendirilir.

## H. Depth gösterimi

`getFrame().value.image.url` özgün16-bit PNG'nin görsel önizlemesidir. Tarayıcı
ve canvas renklerinin16-bit ham sayıları koruduğu varsayılmaz. Sayısal kullanım
`decodeTumDepth(blob, relativePath, signal)` ile ayrı yapılır; filtreler0–4
açılır, uint16 big-endian örnekler `raw: Uint16Array` içinde korunur.
`tumDepthToMetres(raw)` ham/5000 döndürür; raw0 ve geçersiz girdide null.
Null, sıfır metrede geçerli nesne demek değildir. Önizleme renkleri sıcaklık
değildir; temperature alanı üretilmez. Sayısal çözümleyici fiziksel kalibrasyon
veya sensör doğruluğunu doğrulamış olmaz.

## I. Hata ve kurtarma

| Kod | UI eylemi |
| --- | --- |
| INVALID_MANIFEST | Manifest JSON'unu/kapsamını ve dosya haritasını yeniden seçtir |
| MISSING_FILE | error.file içindeki beklenen özgün dosyayı eklet |
| DECODE_FAILED | İlgili TXT/PNG'yi resmî arşivden yeniden edin; kaynak satırını göster |
| UNSUPPORTED_FORMAT | Desteklenen640×480 RGB8/type2 veya depth16/type0 ve native deflate gereksinimini açıkla |
| INVALID_INDEX | Geçerli tam sayı sınırını uygula; oturumu otomatik kapatma |
| NOT_OPEN | Başarılı açılışı bekle veya kaydı aç |
| CLOSED | Eski sonucu/URL'yi kullanma; gerekiyorsa yeni oturumda iste |

Hata nesnesinin `message`, `recovery`, `file` alanları doğrudan gösterilebilir.
Manifest yükleme JSON parse/File erişim hatası okuyucu çağrısından önce oluşabilir;
seçici katmanı bunları yakalamalıdır. Ağdan ham dosya indirmek okuyucunun işi değildir.

## J. React ve kaynak yaşam döngüsü

Reader seçili kayıt/akış oturumu boyunca açık tutulur. Effect setup, cleanup
ve yeni kayıt seçimi aynı reader oturumuna sahip olmalıdır. Cleanup: eski görüntü
gösterimini kaldır; UI istek kuşağını geçersiz kıl; kalite/depth AbortController'ını
abort et; okuyucuda `void reader.close()`; varsa JSON indirme `dispose()` çağır.
Async effect doğrudan Promise döndürmemeli; cleanup fonksiyonu dönmeli. StrictMode
tekrar setup/cleanup davranışı reader tarafından desteklenir; UI stale-state
koruması yine gereklidir. UI dosyalarında bu bağlantı henüz yapılmadı.

Örtüşen aramalarda UI bir sayaç tutmalı; yalnız en son istek sonucunu render
etmelidir. Reader aynı kare isteğini paylaşır ve en fazla iki PNG doğrular.
URL'ler close/reopen'a kadar geçerli; UI reader'a ait URL'yi kendi başına revoke
etmez. Ziyaret edilen kare URL'leri oturum sonuna kadar tutulduğundan uzun
oturum önbelleği büyür. Native GC bellek miktarı ölçülmüş değildir.

## K. JSON ve indirme butonu

`createTumReport({ input, metadata, analysis, source?, frameMetadata? })` aynı
girdiden sürümlü kapsül üretir. `serializeTumReport` geçerli, deterministik JSON;
`prepareTumJsonDownload` Blob/url/filename/dispose kaynağı verir. Her biri
`ok` kontrollü sonuçtur. Ortak QualityReport kapsülde analysis.report olarak korunur.
Factory ve serializer kimlik/kapsam/sayaç çelişkilerini reddeder.

UI, başarılı indirme kaynağını state/ref'te tutabilir; kullanıcıya
`<a href={resource.url} download={resource.filename}>JSON indir</a>` gösterebilir.
Yardımcı kendi başına tıklamaz. URL'yi render veya onClick biter bitmez revoke
etmeyin; bağlantı kullanımdan kaldırıldığında, rapor değiştiğinde veya bileşen
cleanup'ında dispose edin. İndirme kaynağı reader'dan bağımsızdır; reader kapanması
onu temizlemez. Büyük ham dosyalar ve piksel dizileri JSON'a gömülmez.

## L. Derlenen, gerçek API kullanan TypeScript örneği

Aşağıdaki tam modülün import yolları `src/ui/` içindeki tüketici içindir.
Yerleşik gerçek TUM manifestini kullanır; `files` seçiciden gelen özgün haritadır.
`consume` yalnız oturum açıkken görüntüyü kullanır; bu örnek incelemeyi bitirip
kapatır. Etkileşimli oynatıcıda aynı reader yaşamı bileşen cleanup'ına kadar
sürdürülmelidir. Gerçek Node uçtan uca örnek [tum-local.ts](../examples/tum-local.ts)
ile yerel dosyalarda ayrıca çalıştırılabilir.

```ts
import manifestJson from '../../data/manifests/tum-rgbd-freiburg1-desk.json';
import {
  TumRecordingReader, decodeTumDepth, tumDepthToMetres,
  type DatasetManifest, type RecordingInput, type FrameRecord, type ReaderError,
} from '../data';
import {
  analyzeTumRecording, createTumReport, serializeTumReport, prepareTumJsonDownload,
  type TumExportReport,
} from '../quality';

export async function inspectTumSelection(
  files: ReadonlyMap<string, Blob>,
  consume: (stream: 'rgb' | 'depth', frame: FrameRecord) => void | Promise<void>,
  signal?: AbortSignal,
) {
  const input: RecordingInput = { manifest: manifestJson as DatasetManifest, files };
  const rgb = new TumRecordingReader({ stream: 'rgb', mode: 'manifest-subset' });
  const depth = new TumRecordingReader({ stream: 'depth', mode: 'manifest-subset' });
  const showError = (error: ReaderError) => console.error(error.message, error.recovery, error.file);
  try {
    const opened = await rgb.open(input);
    if (!opened.ok) { showError(opened.error); return; }
    const metadata = rgb.getMetadata();
    if (!metadata.ok) { showError(metadata.error); return; }
    if (metadata.value.frameCount > 0) {
      // İlk, sonraki, önceki ve son: bütün değerler API indeksidir.
      const last = metadata.value.frameCount - 1;
      for (const index of [0, Math.min(1, last), 0, last]) {
        const frame = await rgb.getFrame(index);
        if (!frame.ok) { showError(frame.error); return; }
        await consume('rgb', frame.value);
      }
    }
    const depthOpened = await depth.open(input);
    if (!depthOpened.ok) { showError(depthOpened.error); return; }
    if (depthOpened.value.frameCount > 0) {
      const frame = await depth.getFrame(0);
      if (!frame.ok) { showError(frame.error); return; }
      await consume('depth', frame.value);
      const source = depth.getSourceInfo();
      if (!source.ok) { showError(source.error); return; }
      const path = source.value.frames[0].file;
      const blob = files.get(path);
      if (blob) {
        const decoded = await decodeTumDepth(blob, path, signal);
        if (!decoded.ok) { showError(decoded.error); return; }
        console.log({ raw: decoded.value.raw[0], metres: tumDepthToMetres(decoded.value.raw[0]) });
      }
    }
    const analysis = await analyzeTumRecording(input, {
      mode: 'manifest-subset', streams: ['rgb', 'depth'], inspectImages: true, signal,
    });
    console.log(analysis.report.issues, analysis.report.unsupported, analysis.coverage);
    const source = rgb.getSourceInfo();
    if (!source.ok) { showError(source.error); return; }
    const made = createTumReport({ input, metadata: metadata.value, analysis, source: source.value });
    if (!made.ok) { console.error(made.error.message, made.error.recovery); return; }
    const json = serializeTumReport(made.value);
    if (!json.ok) { console.error(json.error.message, json.error.recovery); return; }
    return { metadata: metadata.value, analysis, report: made.value, json: json.value };
  } finally {
    await Promise.all([rgb.close(), depth.close()]);
  }
}

export function prepareReportLink(report: TumExportReport) {
  // Başarıda value.url/value.filename kullanılır; kullanım bitince value.dispose().
  return prepareTumJsonDownload(report, 'tum-quality.json');
}
```

## M. Kaçınılacak yorumlar ve performans sınırı

RGB/depth aynı indeksini eşleştirmeyin; unknown FPS'ten kayıp kare sayısı veya
kaynak zamanı üretmeyin; ham zamanı fiziksel pozlama saati saymayın; accel birimi
uydurmayın; sıcaklık/radyometri eklemeyin; sıfır depth'i geçerli0m saymayın.
Örnek başarısını tam arşiv veya saha performansı diye sunmayın. Header/CRC/zlib
doğrulaması fiziksel görüntü kalitesi değildir. TXT32MiB sınırında tüm liste
belleğe alınır; ilk açılışta bütün PNG'ler decode edilmez. Büyük kayıt hızı/heap
benchmark ve UI/File seçici matrisi ölçülmüş değildir.

## N. Derviş entegrasyon kabul kontrol listesi

- [ ] Gerçek on dosya hash/boyut karşılaştırması, lisans/kaynak paneli.
- [ ] Seçici anahtarları manifest yollarıyla aynı; yanlış kök/yinelenen basename reddediliyor.
- [ ] RGB ve depth ayrı reader; üçer kare; kaynak indeksleri panelde doğru.
- [ ] İlk/son/önceki/sonraki sınırları; boş kayıt; geçersiz indeks; unknown zaman gösterimi.
- [ ] Hızlı arama ve kayıt değiştirmede eski sonuç/URL gösterilmiyor.
- [ ] Eksik PNG, bozuk TXT/PNG, yanlış manifest/biçim için recovery mesajı; sentetik fallback yok.
- [ ] Metadata özgün/türetilmiş, birim ve inceleme kapsamıyla ayrı gösteriliyor.
- [ ] Kalite paneli severity/rule/details/unsupported ve iptal durumunu koruyor.
- [ ] Alt kümede1202 dış referans kayıp kare değil; JSON scope metadata-only.
- [ ] JSON bağlantısı kullanıcı eylemiyle çalışıyor; değişim/unmount sonrası dispose ediliyor.
- [ ] close/reopen/StrictMode cleanup ve sayısal depth iptali; raw0→null ayrımı.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, sentetik örnek ve gerçek CLI çalışıyor.
- [ ] Bu listeyi UI üzerinde tamamlayınca Murathan'la gerçek uçtan uca test kaydı paylaşılmış.

Mevcut modül testlerinin sonucu [docs/readers.md](../../../docs/readers.md) içinde
tarihli kayıt olarak bulunur. Bu checklist'in UI maddeleri burada yapılmış sayılmaz.
