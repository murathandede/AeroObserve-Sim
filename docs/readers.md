# Gerçek TUM RGB-D okuyucusu ve Efe teslimi

Sahip: Efe. `TumRecordingReader`, gerçek TUM RGB-D `freiburg1_desk` PNG/TXT
dosyalarını `RecordingReader` v1 arayüzüyle açar. Ortak sözleşme
[`src/shared/types.ts`](../src/shared/types.ts) içinde korunur. Kamuya açık veri
API'si [`src/data/index.ts`](../src/data/index.ts) üzerinden dışa aktarılır.
Sentetik demo, simülasyon ve uygulama bağlantısı ayrıca korunmuştur.

## 1. Kaynak, edinme ve yerel yerleşim

Kaynak, [TUM RGB-D Dataset and Benchmark](https://cvg.cit.tum.de/data/datasets/rgbd-dataset),
[resmî indirme](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/download) ve
[resmî biçim belgesidir](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats).
Edinme komutları, on dosyanın boyutu/SHA-256 değeri ve doğrulama kapsamı
[`docs/datasets.md`](datasets.md) içindedir. Hash'ler Ahmet'in yerel referans
değerleridir; yayımlayıcının resmî checksum'ı oldukları iddia edilmez.

Ham veriler Git tarafından dışlanan `data/local/` altında kalır. Manifest
[`data/manifests/tum-rgbd-freiburg1-desk.json`](../data/manifests/tum-rgbd-freiburg1-desk.json)
değiştirilmez. Küçük örneğin kökü şöyledir:

```text
data/local/tum-rgbd-freiburg1-desk/
  rgbd_dataset_freiburg1_desk/
    rgb.txt
    depth.txt
    groundtruth.txt
    accelerometer.txt
    rgb/    (manifestte seçilen 3 özgün PNG)
    depth/  (manifestte seçilen 3 özgün PNG)
```

Dosya yoksa resmî edinme adımları uygulanır; sentetik dosyalar gerçek örneğin
yerine geçirilmez. Okuyucu kendi kendine indirme veya TGZ çıkarma yapmaz.

## 2. Desteklenen biçimler ve sınırlar

| İçerik | Destek |
| --- | --- |
| RGB PNG | 640×480, 8 bit, renk tipi 2, geçişsiz |
| Depth PNG | 640×480, 16 bit, tek gri kanal/renk tipi 0, geçişsiz |
| `rgb.txt`, `depth.txt` | `timestamp filename`, kaynak sırası korunur |
| `groundtruth.txt` | `timestamp tx ty tz qx qy qz qw`; ayrı tablo/metadata |
| `accelerometer.txt` | `timestamp ax ay az`; ayrı tablo/metadata |

Başka çözünürlük, renk/bit biçimi veya geçişli PNG desteklenmez. PNG imzası,
IHDR, chunk sırası/uzunluğu, CRC, IEND, IDAT zlib yapısı ve tarama satırı boyutu/
filtreleri doğrulanır. PNG başlığı, tam dosya yapısı ve sayısal depth çözümlemesi
ayrı işlemlerdir. RGB görüntü kalitesinin fiziksel/sensör doğruluğu ölçülmez.
`DecompressionStream('deflate')` desteği olmayan ortam yapılandırılmış
`UNSUPPORTED_FORMAT` sonucu alır.

## 3. RecordingInput ve tarayıcı File girdisi

`RecordingInput`, manifest ve **manifestle aynı göreli yolları** taşıyan
`ReadonlyMap<string, Blob>` içerir. `File`, `Blob` alt türü olduğu için kabul edilir.
Okuyucu API'sine mutlak makine yolları verilmez; Node dosya okuması yalnız örnek
yükleyicide/testlerde yapılır.

```ts
// src/ui/ altında bir tüketicinin import yolları:
import { TumRecordingReader } from '../data';
import type { RecordingInput } from '../shared/types';

// selectedFiles, kullanıcının seçtiği gerçek File nesnelerinin göreli yol haritasıdır.
const input: RecordingInput = { manifest, files: selectedFiles };
const reader = new TumRecordingReader({
  stream: 'rgb',
  mode: 'manifest-subset',
});
```

Örnek anahtar:
`rgbd_dataset_freiburg1_desk/rgb/1305031452.791720.png`.
Dosya seçicinin üst klasör adını bu anahtara fazladan eklemeyin. Dış JSON'u
TypeScript'e cast etmek doğrulama değildir; `open` zorunlu v1 alanlarını, güvenli
yolları, yinelenen manifest girdilerini ve Blob/File değerlerini çalışma anında
denetler. Güvensiz mutlak/URL/traversal/encoded yollar reddedilir.

## 4. Seçili akış ve açık alt küme/tam kayıt modu

Her okuyucu **tek** seçili görüntü akışı açar. RGB ve depth için iki bağımsız
örnek kullanılır; aynı sıra indeksi eşzamanlılık sayılmaz.

| Mod | Seçilen kareler | Eksik dosya davranışı |
| --- | --- | --- |
| `manifest-subset` | Manifestin seçili akış için açıkça listelediği PNG'ler | Manifestte beklenen dosya yoksa hata |
| `full-recording` | Seçili TXT listesindeki tüm PNG'ler | Kaynak listedeki herhangi bir PNG yoksa hata |

Her iki modda manifestteki bütün `acquisition.files` girdileri zorunludur. Tam mod
için ek PNG Blob'ları aynı haritaya eklenebilir; alt küme modunda ek Blob vermek
kapsamı sessizce büyütmez. Tam mod, yalnız seçili görüntü akışının tam listesidir;
bütün sensörlerin eşzamanlı/eksiksiz olduğu anlamına gelmez.

| Kavram | Gerçek küçük örnekte anlamı |
| --- | --- |
| Tam kaynak liste satırı | RGB 613, depth 595 kaynak referansı |
| Yerel seçili dosya | Akış başına 3 özgün PNG |
| Manifestte beklenen ama eksik dosya | Açık eksik girdi hatası |
| Okunamayan/bozuk dosya | Gerçekte denenen okumada doğrulama hatası |
| Alt kümeye seçilmeyen kaynak PNG | RGB 610, depth 592; **kayıp sensör karesi değildir** |

## 5. Ortak okuyucu API'si ve ilk kare

| İşlem | Çıktı |
| --- | --- |
| `open(input)` | `Promise<ReaderResult<RecordingMetadata>>` |
| `getMetadata()` | `ReaderResult<RecordingMetadata>` |
| `getFrame(index)` | `Promise<ReaderResult<FrameRecord>>` |
| `getState()` | `ReaderState` |
| `close()` | `Promise<void>` |

```ts
try {
  const opened = await reader.open(input);
  if (!opened.ok) {
    console.error(opened.error.message, opened.error.recovery, opened.error.file);
  } else {
    const first = await reader.getFrame(0);
    if (first.ok) {
      // URL yalnız açık okuyucu oturumunda kullanılmalı.
      console.log(opened.value.frameCount, first.value.image.url, first.value.time);
      // Görüntüyü kullanan tüm asenkron işi burada tamamlayın.
    }
  }
} finally {
  await reader.close();
}
```

`withFirstFrame` yardımcısı [`src/data/readFirstFrame.ts`](../src/data/readFirstFrame.ts)
içindedir ve hem gerçek hem sentetik okuyucuyla çalışır. `consume` callback'i
bittikten sonra, callback hata verse bile okuyucu `finally` ile kapatılır.
Callback dışına taşınan `image.url` kapanıştan sonra kullanılamaz. Yardımcının
dönüşü görüntü değil `ReaderResult<void>` değeridir. `npm run example:reader`
mevcut **sentetik** örneği çalıştırır; gerçek veri doğrulaması olarak sunulmaz.

## 6. API indeksi ve kaynak indeksi

`FrameRecord.index`, seçili akışta sıfır tabanlı ve kesintisiz API indeksidir.
`getSourceInfo()` dosya/satır/zaman eşlemesini Efe modülünde ayrıca sunar:

| Akış | API indeksleri | Tam TXT kaynak indeksleri |
| --- | --- | --- |
| RGB küçük örnek | `[0, 1, 2]` | `[0, 306, 612]` |
| Depth küçük örnek | `[0, 1, 2]` | `[0, 297, 594]` |

Kaynak indeksi, yorum ve boş satır dışındaki özgün veri satırlarının sıfır tabanlı
sırasıdır. Fiziksel `lineNumber` bir tabanlıdır. Listeler zaman damgasına göre
yeniden sıralanmaz. `getSourceInfo` ayrıca akış/modu, liste dosyasını, kaynak
satır sayısını ve seçilmeyen kayıt sayısını verir.

## 7. Özgün metadata ve türetilen özetler

`describeTumTable(text, kind, file)`, `rgb`, `depth`, `groundtruth` veya
`accelerometer` tablosunu bağımsız değerlendirir. Başarı `{ ok: true, value }`,
başarısızlık `{ ok: false, issues }` döner.

- `original`: dosya/akış, sütun adları/birim kanıtları, özgün fiziksel satırlar,
  tüm özgün sütun tokenleri, kaynak indeksi ve `timestampRaw`.
- `derived`: gözlenen satır sayısı, ardışık zaman farkları, son−ilk farkı ve
  minimum/maksimum/ortalama/medyan fark. Her sonuç `inputs`, `unit`, `method` ve
  `scope` taşır; kaynak tablonun tamamına aittir.

Türetmeler ham ondalık tokenlerden hesaplanır; büyük epoch sayılarının Number
çıkarma hatası farklara taşınmaz. `exactDecimal`, mümkün olduğunda tam ondalık
sonucu korur. `value`, Number gösterimidir. Boş/tek satırda tanımsız değerler,
taşma/underflow veya belgelenmiş işlem sınırında `null` ve açıklama kullanılır.
Tam ondalık işlemler token/üs için 4096 basamakla sınırlıdır. Sonlanmayan ortalama
ondalıklarında tam dize üretilmez. Sıfır/negatif aralıklar korunur; orijinal satır
dizisi veya zamanlar düzeltilmez. Bu özetler kendi başlarına kayıp kare kanıtı
değildir.

`getTableMetadata()` açık okuyucunun seçili **tam TXT tablosunun** bu bilgisini
kopya döndürür. Alt kümenin üç karesinin aralığıyla tam kaynağın ardışık aralığını
karıştırmayın. `getFrameMetadata(index)` PNG okumaz; PNG bilgisi önce `not-read`,
ilgili `getFrame` başarılı doğrulamadan sonra `verified` olur.

Özgün yerel TXT doğrulamasındaki satır sayıları RGB **613**, depth **595**,
groundtruth **2.335**, accelerometer **11.815** değerleridir. Son−ilk token
farkları sırasıyla `20.404349`, `19.816716`, `23.3995`, `23.656109` bulunur.
Yalnız groundtruth farkının saniye birimi burada bağımsız kanıtlıdır; diğer
sayılara doğrulanmamış birim veya ortak saat anlamı yüklenmez.

## 8. Zaman ve birimler

| Tablo | Zaman birimi/kökeni | Diğer birimler |
| --- | --- | --- |
| RGB / depth | Sayısal token var; bağımsız sütun birimi ve kesin cihaz/pozlama saat kökeni doğrulanmadı | RGB kanal kodu / uint16 derinlik kodu |
| Groundtruth | Belgeli Unix epoch saniyesi; kaynakta yaklaşık 20 ms referans düzeltmesi uygulanmış | Konum metre bağlamında; quaternion boyutsuz |
| Accelerometer | Sayısal token var; bağımsız zaman birimi/kökeni doğrulanmadı | İvme birimi bilinmiyor |

RGB/depth `FrameTime` ve ortak görüntü metadata zamanı `unknown` kalır; bu,
dosyada özgün sayısal token olmadığı anlamına gelmez. Token ve belirsizlik
Efe metadata'sında korunur. `toTumFrameTime` yalnız saniye birimi doğrulanmış
tabloda özgün saniyeyi v1'e taşır; dosyaya özgü saat açıklamasını korur. Şu an
bu özellik groundtruth için kanıtlıdır; groundtruth bir görüntü karesi değildir.

Groundtruth düzeltmesi tekrar uygulanmaz veya geri alınmaz. Nominal FPS, dosya
adı, sıra indeksi veya iki akış arasındaki ortalama fark kullanılarak zaman
üretilmez. Akış birleştirme/eşleme yapılmaz.

## 9. Sayısal derinlik ve görsel önizleme

`getFrame`, özgün PNG Blob'u için URL sunar. Tarayıcı önizlemesinin uint16
örnekleri koruduğu varsayılmaz. Görüntü/canvas renklerinden metre hesaplanmaz;
hiçbir çıktı sıcaklık alanı üretmez.

`decodeTumDepth(blob, file, signal?)`, ayrı ve açık sayısal çözümlemedir:
tam PNG doğrulamasından sonra zlib akışını ikinci kez sınırlı açar, PNG filtreleri
0–4'ü yeniden kurar ve big-endian örnekleri satır öncelikli `Uint16Array` içine
yazar. Başarıda `TumDepthData` döner. Ham örnekler ile önizleme ayrı kalır.

```ts
import { decodeTumDepth, tumDepthToMetres } from '../data';

const decoded = await decodeTumDepth(depthBlob, relativeDepthPath, abortSignal);
if (decoded.ok) {
  const raw = decoded.value.raw[0];
  const metres = tumDepthToMetres(raw); // raw / 5000; raw=0 ise null
  console.log(raw, metres);
}
```

Dönüşüm [TUM biçim belgesindeki](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats)
`metres = raw / 5000` kuralıdır. `0`, geçerli ölçüm yok demektir; sıfır metreye
çevrilmez. Çözümlenen sayılar sensörün fiziksel doğruluğunu ayrıca kanıtlamaz.
İstek tamamlanınca gereksiz `raw`/Blob referanslarını tüketici bırakmalıdır.

## 10. Yaşam döngüsü ve hata kurtarma

Durumlar `idle → opening → ready`, başarısız açılışta `error`, kapatmada `closed`
olur. Yeniden `open`, eski metadata/kare/URL kaynaklarını önce temizler.
Başarısız yeni kayıt önceki kaydı taşımaya devam etmez. `close` tekrar çağrılabilir.
Oturum sayacı ve AbortSignal, geç kalan asenkron işlerin eski kaydı yeniden
etkinleştirmesini engeller. Tek bir indeks/kare hatası diğer kareleri kapatmaz.

| Hata kodu | Kullanıcıya gösterilecek eylem |
| --- | --- |
| `INVALID_MANIFEST` | Geçerli v1 manifesti ve doğru göreli yol haritasını yeniden seç |
| `MISSING_FILE` | `error.file` içindeki beklenen özgün dosyayı ekle; kapsamı sessizce daraltma |
| `UNSUPPORTED_FORMAT` | Belgelenmiş PNG biçimi ve deflate destekli ortam kullan |
| `DECODE_FAILED` | TXT/PNG'nin özgün kopyasını yeniden edin; hata satırı/dosyası kanıtını göster |
| `INVALID_INDEX` | `0 ≤ index < frameCount` koşulundaki tam sayıyı iste |
| `NOT_OPEN` | Başarılı açılışı bekle veya kaydı yeniden aç |
| `CLOSED` | Eski sonucu kullanma; yeni oturumda tekrar iste |

Beklenen veri hataları `ReaderResult` ile gelir; `message`, `recovery` ve varsa
`file` birlikte gösterilir. Gerçek kayıt hatasında sentetik fallback açılmaz.

## 11. Bellek, hızlı geçiş ve eşzamanlılık

Açılışta PNG okunmaz; metadata seçili TXT'den alınır. PNG'ler `getFrame` ile
ihtiyaç halinde doğrulanır; aynı kareye örtüşen istekler işi/URL'yi paylaşır.
En fazla iki doğrulama aynı anda çalışır; diğer istekler sıraya alınır. UI kendi
istek kuşağını tutarak geç gelen önceki arama sonuçlarını göstermemelidir.

URL'ler açık oturum sonuna kadar geçerlidir; `close`/yeniden `open` hepsini
revoke eder. URL'ler erken LRU ile silinmez, bu yüzden ziyaret edilen kare
sayısıyla URL önbelleği büyür. Blob baytları başlangıçta kopyalanmaz; base64
üretilmez. Seçili TXT 32 MiB ile sınırlıdır ve bütün liste belleğe alınır;
sabit bellekli metin parser'ı veya sınırsız kayıt desteği iddia edilmez.
Sayısal depth çözümlemesi istenen bir kare için sonuç dizisi ve iki tarama
satırını tutar. Başlamış yerel Blob okuması iptal edilemeyebilir; geç sonuç
yok sayılır ve yeni oturuma taşınmaz.

## 12. Kalite analizi, rapor ve kapsam

Metadata-only `analyzeMetadata` ortak metadata eksiklerini bildirir; PNG taraması
yapmaz. `analyzeTumRecording(input, options)`, `src/quality` girişinden alınan
asenkron gerçek kayıt inceleyicisidir. Seçenekler `mode`, isteğe bağlı `streams`,
`inspectImages` ve `signal` alanlarıdır. Akış seçimi varsayılan olarak RGB/depth
ikilisidir. Dört TXT tablo ayrı değerlendirilir; görüntü taraması seçili akış ve
modla sınırlanır.

İnceleme şu yöntemleri kullanır:

- Manifest/map ve beklenen dosya varlığı; bozuk UTF-8, hatalı sütun ve sayılar;
  her bulguda özgün dosya/satır/kaynak indeksine dönülebilen `details`.
- Ham zaman tokenlerinin tam ondalık eşitliğiyle yinelenen damgalar; özgün dosya
  sırasındaki sıfır ve negatif farklar. Sıralama veya sessiz düzeltme yapılmaz.
- İstenirse seçili PNG dosyalarında biçim, chunk CRC ve sınırlı zlib/tarama satırı
  doğrulaması. Salt dosya varlığı, görüntü bütünlüğü diye raporlanmaz.

`TumQualityAnalysis.report`, değişmemiş ortak `QualityReport` biçimindedir;
`details`, `coverage` ve `limitations` Efe modülüne özgüdür. `coverage`, seçim
modunu, incelenen akışları, her tablonun geçerlilik/satır sayısını; kaynak referans,
beklenen/mevcut/incelenen/doğrulanan/eksik görüntü sayılarını; seçilmeyen referansları
ve tamamlanma/iptal durumunu ayrı taşır. Hatalı veriler sentetik veriyle tamamlanmaz.

`manifest-subset` analizi altı PNG'yi doğrulasa da ortak `scope` değeri
`metadata-only` kalır; bütün kayda yükseltilmez. `full-recording`, yalnız açık tam
modda, istenen akışların bütün kaynak görüntüleri doğrulandığında, dört tablo geçerli
olduğunda ve hata bulunmadığında kullanılır. Kapsam verinin temizliğinden ayrı
bir kavramdır. Gerçek küçük örnekte 1.208 kaynak görüntü referansının altısı seçilir;
diğer 1.202 referans sensör kaybı değildir.

### JSON kalite raporu

`createTumReport`, `serializeTumReport` ve `prepareTumJsonDownload`, `src/quality`
girişinden alınır. Üçü de Efe'ye özgü `{ ok: true, value }` veya
`{ ok: false, error: { code, message, recovery } }` döndürür. Hata kodları
`INVALID_REPORT`, `SERIALIZATION_FAILED`, `DOWNLOAD_UNAVAILABLE` değerleridir.

```ts
// src/ui/ altında tüketici örneği; selectedMetadata açık okuyucudan alınan kopyadır.
import {
  analyzeTumRecording, createTumReport, serializeTumReport,
  prepareTumJsonDownload,
} from '../quality';

const analysis = await analyzeTumRecording(input, {
  mode: 'manifest-subset',
  streams: ['rgb', 'depth'],
  inspectImages: true,
});
const made = createTumReport({ input, metadata: selectedMetadata, analysis });
if (!made.ok) {
  console.error(made.error.message, made.error.recovery);
} else {
  const json = serializeTumReport(made.value);
  if (json.ok) console.log(json.value);
  const prepared = prepareTumJsonDownload(made.value);
  if (prepared.ok) {
    // UI, url/filename ile kullanıcıya indirme sunar.
    // İndirme kaynağı kullanımı bittiğinde veya bileşen kaldırıldığında:
    prepared.value.dispose();
  }
}
```

`metadata`, okuyucu açılamadıysa `null` olabilir; bozuk verinin kalite bulguları
yine raporlanabilir. İsteğe bağlı `source` ve `frameMetadata` alanları seçili
okuyucudan alınan kaynak/kare provenance kopyalarını ekler. Farklı kayıt kimliğine
ait girdiler reddedilir. Rapor, `schema: aeroobserve.efe-recording-report` ve
`schemaVersion: 1` kapsülü içinde ortak kalite raporunu `analysis.report` alanında
korur; kaynak/lisans, reader kimliği/sürümü, özgün/türetilen metadata ve açık kapsam
ayrı bulunur.

JSON'a yalnız tabloların ilk/son özgün satırları ve aralık örnekleri eklenir;
özet istatistikler belirtilen tam tablo kapsamındadır. Ham PNG/TXT, bütün piksel
dizileri ve geçici Blob URL'leri rapora gömülmez. Aynı girdilerde anahtar sırası
ve çıktı kararlıdır; güncel saat eklenmez. `undefined`, sonlu olmayan sayılar ve
desteklenmeyen JSON değerleri `null` olur; BigInt dizeye çevrilir. Döngüsel veya
okunamayan nesneler kontrollü hata verir. `prepareTumJsonDownload` kendiliğinden
tıklama/indirme yapmaz; oluşturduğu URL için `dispose()` tekrarlanabilir cleanup'tır.

## 13. Çalıştırma ve testler

Bağımlılıklar yoksa kilit dosyasını koruyarak `npm ci` kullanın. Yeni bağımlılık
gerekmiyor. Repository kökünde:

```sh
npm run typecheck
npm test
npm run build
```

Yerel gerçek örnek yükleyicisi Node ile çalışır; bu dosya sistemi adaptörü okuyucu
API'sinden ayrıdır. Sıfır argüman belgelenmiş on dosyalık yerel kökü kullanır:

```sh
./node_modules/.bin/tsx src/data/examples/tum-local.ts
./node_modules/.bin/tsx src/data/examples/tum-local.ts data/local/tum-rgbd-freiburg1-desk reports/local/tum-quality.json
```

İlk argüman, içinde `rgbd_dataset_freiburg1_desk/` bulunan örnek köküdür. İkinci
argüman isteğe bağlı JSON çıktı dosyasıdır; ham veriler veya yerel raporlar Git'e
eklenmez. Eksik gerçek girdide yükleyici açık hata verir; gerçek başarı yazmaz.

`reader-tum-text`, `reader-tum-png`, `reader-tum-depth`, `reader-tum-metadata`,
`reader-tum-provenance`, `reader-tum-real` ve `reader-tum` testleri ayrıştırma,
ölçüm/önizleme ayrımı, API, kapsam ve kaynak yaşam döngüsünü kapsar. Yapay PNG/TXT
girdileri test adlarında açıkça etiketlidir. Gerçek veri yoksa test gerekçeyle
atlanır; bu geçiş gerçek veri doğrulaması değildir. Node testleri tarayıcıdaki
gerçek File seçimi/React görüntüleme doğrulamasının yerine geçmez.

18 Ekim 2026 teslim doğrulaması: typecheck/build başarılı; `npm test` **104/104**
başarılı, başarısız/atlanan/iptal edilen test **0**. Bunların 10'u özgün yerel
dosyaları gerçekten okuyan testlerdir; eski ortak okuyucu/simülasyonun 9 testi
de korunmuştur. `npm run example:reader` sentetik örneği başarıyla çalıştırır;
ayrı gerçek CLI örneği 64.416 bayt geçerli JSON üretmiştir. Tarayıcı API
kontrolünde gerçek dosyalardan oluşturulan 10 File girdisi, 3 RGB + 3 depth
native görüntü çözümü, üç depth ham dizisinin bağımsız Pillow referansıyla
eşleşmesi, JSON indirme kaynağı ve altı görüntü URL'sinin kapanışta bırakılması
doğrulanmıştır. Dosya seçici ve React ekran bağlantısı bu testin kapsamı değildir.

Nihai kod denetiminde başlangıçtaki 104 test bağımsız olarak yeniden geçti;
close/reopen sırasında tamamlanmış kare sonucunun geç teslimi için iki ve
opsiyonel source olmadan kare provenance eşlemesi için bir regresyon eklendi.
Güncel sonuç **107/107 başarılı, 0 başarısız, 0 atlanan**; typecheck/build,
sentetik örnek ve gerçek TUM CLI başarılıdır. Derviş kılavuzundaki tam TypeScript
örneği derlendi ve gerçek dosyalarda ayrıca çalıştırıldı. Bu ek kontroller de
UI/File seçici bütünleştirmesinin yapıldığı anlamına gelmez.

## 14. Derviş ve Murathan'a teknik teslim

[`src/data/tum/HANDOFF.md`](../src/data/tum/HANDOFF.md), Derviş için görüntü/
metadata/hata/cleanup akışını, Murathan için factory/input/binding ve bağımsız
asenkron analiz bağlantısını ayrı açıklar. Bu teslim belgesi uygulama veya UI
dosyalarının değiştirilmiş olduğu anlamına gelmez.

Genişletilmiş devir: [Derviş kılavuzu](../src/data/tum/DERVIS-HANDOFF.md),
[Murathan bütünleştirme raporu](../src/data/tum/MURATHAN-HANDOFF.md) ve
[kanıtlı proje durumu](../src/data/tum/PROJECT-STATUS.md). Mevcut sentetik UI,
hazır gerçek veri API'si ve bekleyen sistem bağlantısı bu belgelerde ayrıdır.

## 15. Lisans ve atıf

Veri [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) kapsamındadır;
paylaşımda TUM kaynak/lisans bağlantıları ve özgün örnek dosyaların yalnız alt
kümesinin seçildiği bilgisi korunmalıdır. Manifestteki atıf:
J. Sturm, N. Engelhard, F. Endres, W. Burgard, D. Cremers,
“A Benchmark for the Evaluation of RGB-D SLAM Systems,” IROS, 2012.
Kod lisansı veri lisansı yerine kullanılamaz.

## 16. Bilinen sınırlar ve kapsam dışı yorumlar

V1 ayrı akış kimliği, ham depth, özgün kaynak indeksi, ayrıntılı analiz kapsamı
ve asenkron tam tarama için ortak alanlar sunmaz. Efe bu bilgileri kendi modül
API'sinde tutar; ortak tipleri tek taraflı değiştirmez. RGB/depth otomatik
eşleme, saat hizalama, FPS uydurma, sıcaklık/radyometri veya sensör kaybı sonucu
üretilmez. TUM RGB-D termal/radar verisi değildir. Bütün arşivdeki görüntüler
yalnız küçük örnek doğrulamasından hareketle sağlam ilan edilmez.

Desteklenmeyen analizler açıkça raporlanır: belgelenmemiş FPS'ten kayıp sensör
karesi tahmini; farklı saatlerin hizalanması; RGB-depth eşleme/füzyon; fiziksel
pozlama zamanı, sensör doğruluğu ve kalibrasyon doğrulaması; piksel kalitesi/
sayısal depth dağılımı ve sıcaklık analizi. Sayısal depth çözümleyicisinin bulunması,
bu analizlerin yapılmış olduğu anlamına gelmez.
