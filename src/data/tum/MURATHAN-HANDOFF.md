# Efe → Murathan — bütünleştirme teslimi

18 Ekim 2026. Bu belge bütünleştirme kararları ve kabul sırası içindir. Ayrıntılı API örnekleri [HANDOFF.md](HANDOFF.md) ve [docs/readers.md](../../../docs/readers.md) içinde; proje geçmişi ve katkı kanıtı [PROJECT-STATUS.md](PROJECT-STATUS.md) içindedir. Aşağıdaki yollar depo köküne göredir; kişisel bilgisayar yolu veya Git dışı dosyaya zorunlu bağlantı yoktur.

## 1. Teslim edilen iş ve sürüm

Gerçek TUM RGB-D okuyucusu, dört TXT ayrıştırıcısı, metadata/zaman provenance, sayısal depth helper'ı, kalite analizi, JSON raporu ve testler Efe katmanında hazırdır. `TumRecordingReader` sürümü **1.1.0**. Uygulamanın ana binding'i hâlen sentetiktir; bu teslim gerçek UI bağlantısını tamamlanmış göstermez.

## 2. Dal, başlangıç ve kesin revizyon

Depo: `https://github.com/murathandede/AeroObserve-Sim`. Teslim dalı `feat/recording-reader`; doğrulanmış başlangıç Ahmet'in `d3117076b5aa2360d66ff2bac5328ca7a65a6cb9` commit'idir. Bu başlangıç SHA'sı yeni Efe tesliminin SHA'sı değildir. Son yayımlanan revizyonu alırken `git rev-parse HEAD`, `git status --short` ve `git branch -vv` çıktısını kaydedin. Efe'nin belgesi kendi commit SHA'sını içine gömerek döngü oluşturmaz.

## 3. Proje hedefi ve kapsam

Öncelik gerçek kaydı doğru okumak ve belirsizlikleri görünür tutmaktır. TUM RGB-D termal veya radar değildir; depth uzaklık kodlamasıdır. Füzyon, hedef tespiti, fiziksel sensör doğruluğu ve saha performansı bu modüllerden çıkarılamaz. Araştırma çerçevesi [project-context.md](../../../docs/project-context.md) ile birlikte okunmalıdır.

## 4. Sahiplik ve katkı kanıtı

Ahmet veri/manifest; Efe data/quality; Derviş UI; Murathan app/playback/ortak koordinasyon sahibidir. Erişilebilir Git geçmişinde ilk sentetik uygulama `94eb35d…`, ortak başlangıç `8c0c592…` Murathan yazar alanını; katalog `d311707…` Ahmet yazar alanını taşır. Ayrı bir Derviş commit'i gözlenmedi. Mevcut UI başlangıcını Derviş'in tamamlanmış gerçek veri bütünleştirmesi olarak değerlendirmeyin; sahiplik ile kanıtlı commit yazarlığını ayırın.

## 5. Efe fazlarının teslim özeti

| Faz | Bütünleştirme açısından çıktı |
| --- | --- |
| 0 | Depo/dal/ortam ve başlangıç kontrolleri. |
| 1 | Gerçek örnek, dosya bütünlüğü, biçim/kapsam ve mimari tasarım. |
| 2 | Ortak v1 okuyucu, ayrı akışlar, açık mod, hata/yaşam döngüsü. |
| 3 | Özgün metadata/zaman, yöntemli özetler ve doğrulanmış sayısal depth. |
| 4 | Asenkron kalite, kaynak bulguları ve kapsam/iptal bilgisi. |
| 5 | Sürümlü JSON kapsülü, serializer ve indirme kaynağı. |
| 6 | Yapay/gerçek test ayrımı; hata, kaynak, eşzamanlılık ve kapsam regresyonları. |
| 7 | Gerçek yerel örnek, okuyucu/durum/teslim belgeleri. |

## 6. Taşınabilir kurulum ve kilitli araçlar

Node 22.12+ veya uyumlu Node 24 kullanın; yerel denetim Node 24.12.0 / npm 11.6.2 ile yapıldı. Kilit dosyasında React/React DOM 19.3.1, TypeScript 5.9.3, Vite 7.3.7, tsx 4.23.15 bulunur. Depo kökünde `npm ci` çalıştırın; yeni bağımlılık gerekmez. Paket sürüm aralıklarını elle yükseltmek bu teslimin koşulu değildir.

## 7. Gerçek veriyi edinme ve lisans

`docs/datasets.md` içindeki resmî TUM edinme adımlarını ve `data/manifests/tum-rgbd-freiburg1-desk.json` manifestini kullanın. On özgün dosya `data/local/tum-rgbd-freiburg1-desk/` altında tutulur ve Git'e eklenmez. SHA-256 değerleri yerel referanstır; resmî yayımlayıcı checksum'ı değildir. Katalogdaki TUM / CC BY 4.0 ve IROS 2012 atıf bilgisini koruyun. Veri yoksa gerçek test sonucu skip olabilir; sahte dosyayla gerçek veri başarısı üretilmez.

## 8. Modül haritası ve giriş noktaları

`src/data/index.ts` tarayıcıya uygun reader/parser/metadata/depth girişidir; `src/quality/index.ts` analiz/rapor girişidir. `src/data/tum/` biçime özel katman; `src/data/examples/tum-local.ts` yalnız Node adaptörüdür. Bu Node dosyasını tarayıcı bundle'ına import etmeyin. Her modülün tam API tablosu [mevcut teslimde](HANDOFF.md#murathan-factory-input-ve-uygulama-bağlantısı) bulunur.

## 9. Ortak sözleşme korunumu

`src/shared/types.ts` değişmedi. `open`, `getMetadata`, `getFrame`, `getState`, `close` ortak arayüzü korunur. `getSourceInfo`, `getTableMetadata`, `getFrameMetadata` Efe modülüne özgü ek API'lerdir. Ortak `FrameRecord` üzerine akış veya ham depth alanı zorla eklenmez. Tip genişletme gerekiyorsa örnek JSON ve bütün tüketicilerle birlikte koordine edilmelidir.

## 10. RecordingInput kurulumu ve snapshot

Girdi manifest + güvenli göreli yol → Blob/File haritasıdır. Manifest yollarındaki kayıt kökü korunmalıdır; mutlak dosya sistemi yolu okuyucu API'sine verilmez. Browser `File`, Blob olarak kabul edilir. `open` manifesti ve harita girdilerini oturum için kopyalar; görüntü baytlarını başlangıçta kopyalamaz veya decode etmez. Dosya seçme UI'sini Derviş, input/binding bağlantısını Murathan kendi alanlarında kurmalıdır.

## 11. Akış ve örnek/tam kayıt modu

Her factory yeni `TumRecordingReader({ stream: 'rgb' | 'depth', mode: 'manifest-subset' | 'full-recording' })` üretmelidir. Aynı input iki bağımsız okuyucuya verilebilir; sıra indeksleri eşzamanlı kareler sayılmaz. Küçük örnek her akışta 3 kare içerir; TXT listeleri RGB 613, depth 595 satırdır. Örnek dışındaki 1.202 referans kayıp dosya bulgusu değildir. Tam mod gerçekten gereken tüm seçili kaynak dosyalarını ister; eksikleri sessizce atlamaz.

## 12. Özgün zaman, kaynak indeksi ve metadata

`FrameRecord.index` sıfır tabanlı API indeksidir. Kaynak indeksleri RGB `[0,306,612]`, depth `[0,297,594]`; fiziksel satır ve özgün `timestampRaw` ayrıca korunur. RGB/depth `FrameTime` unknown kalır; dosya adı veya oynatma temposu zaman üretmez. Groundtruth'un belgelenmiş epoch bilgisi diğer akışlara taşınmaz. Kaynak tablo özetlerinde yöntem, girdiler, birim ve kapsam vardır; bunları UI'da özgün alanlardan ayırın.

## 13. PNG önizlemesi ve sayısal depth

Görüntüler 640×480; RGB 8-bit renk tipi 2, depth 16-bit gri renk tipi 0. `getFrame`, ihtiyaç anında yapı/CRC/zlib doğrulayıp özgün Blob için önizleme URL'si döndürür. Browser önizleme pikselleri sayısal depth değildir. Açık `decodeTumDepth` çağrısı PNG filtreleri 0–4 ve big-endian uint16 düzenini çözer; `tumDepthToMetres` raw/5000 uygular, sıfır/geçersiz girişte null verir. Üç gerçek depth dosyasının bütün piksel sonuçları bağımsız Pillow 11.3.0 referansıyla karşılaştırıldı. Bu, sensörün fiziksel doğruluğunu doğrulamaz.

## 14. Kalite analizi bağlantısı

`analyzeMetadata` hızlı ve senkron metadata-only kontrolüdür. `analyzeTumRecording(input, options)` dört TXT ve istenirse görüntüler için asenkron çalışır. Ortak `report` yanında `details`, `coverage`, `limitations` verir. Dosya/satır/kaynak/API eşlemesini koruyun; ayrıntılar `issueIndex` ile ortak bulguya bağlanır. `RecordingBinding.analyze` yalnız metadata alır ve senkrondur: gerçek taramayı içine gizlemeyin; ayrı analiz eylemi ve iptal kontrolü kurun.

## 15. JSON kapsülü ve kullanıcı indirmesi

`createTumReport` → `serializeTumReport` veya `prepareTumJsonDownload` zincirinde her `ok` denetlenir. Ortak QualityReport, `analysis.report` içinde kalır; kapsül `schemaVersion: 1` taşır. Kimlik, seçili akış/kapsam, kaynak eşlemesi ve çekirdek sayaçlar denetlenir; metadata-only raporu etiket değiştirerek full yapmayın. JSON'a ham PNG/TXT/piksel dizileri, geçici görüntü URL'si veya duvar saati eklenmez. İndirme yardımcısı otomatik tıklamaz; oluşturulan URL'nin işi bitince `dispose()` çağrısı UI sahibinindir.

## 16. Yaşam döngüsü, eşzamanlılık ve bellek

Yeni kayıt/unmount sırasında reader `close`, analiz `AbortController.abort`, indirme kaynağı `dispose` ile temizlenir. Reader close tekrarlanabilir; eski async sonuç yeni oturumu ready yapamaz. İki etkin PNG doğrulaması sınırı ve aynı kare için ortak bekleyen iş vardır; hızlı aramadaki eski sonuçları tüketici de elemelidir. Ziyaret edilmiş kare URL'leri oturum sonuna kadar geçerlidir. TXT tablo başına 32 MiB sınırı ve tam metin belleği vardır; büyük kayıt performansı ölçülmüş değildir.

## 17. Mevcut UI ve bekleyen bütünleştirme

`src/app/recordingBinding.ts` şu anda `exampleBinding` kullanır; ana ekran sentetik SVG kaydıdır. `src/main.tsx` içindeki `?view=simulation` eski sentetik uygulamayı korur. `RecordingWorkspace` / `useRecording` tek gösterim saati ve cleanup başlangıcını sağlar. 1× hızdaki kare başına bir saniye sunum tercihidir. Gerçek dosya seçimi, gerçek binding, akış/kapsam seçimi, asenkron kalite durumu ve JSON indirme eylemi henüz bu UI'ya bağlanmadı. TUM gösterilirken “termal” veya sıcaklık çağrışımlı başlık/ölçek kullanılmamalıdır.

## 18. Kontroller ve kanıt sınırı

Önceki Faz 7 baseline: **104 test başarılı, 0 hata, 0 skip**, typecheck/build ve sentetik `example:reader` başarılı. Bu sayı nihai audit sonrasında değişebilir; teslim aldığınız revizyonda aşağıdaki komutları yeniden çalıştırın ve güncel çıktıyı kaydedin. Gerçek testlerde skip, gerçek dosyaların doğrulandığı anlamına gelmez. Önceki native browser API kontrolü, React dosya seçimi/erişilebilirlik uçtan uca testi değildir.

Tamamlanan nihai denetimde güncel sonuç **107 başarılı, 0 başarısız, 0 atlanan**;
typecheck/build, sentetik örnek ve gerçek TUM CLI başarılıdır. Başlangıç 104 testi
ayrıca yeniden doğrulandı. Yeni testler close/reopen sırasında kare sonucu
teslimini ve source verilmeden rapor provenance doğrulamasını kapsar. Derviş
tam kılavuzundaki TypeScript örneği derlenip gerçek dosyalarda çalıştırıldı;
bu, React/File seçicinin bütünleştirildiği anlamına gelmez.

```sh
npm run typecheck
npm test
npm run build
npm run example:reader
```

## 19. Teknik borç ve ortak karar gereken noktalar

V1'in ayrı akış descriptor'ı, sayısal depth payload'ı ve asenkron analiz yaşam döngüsü yoktur; Efe ek API'leri bu eksikleri yerel katmanda karşılar. Ortak genişletme koordinasyon gerektirir. `DecompressionStream('deflate')` bulunmayan ortam desteklenmeyen biçim/ortam hatası alır. Sayısal depth ikinci zlib geçişi yapar; ziyaret edilmiş karelerin URL önbelleği büyür. Tam arşiv taraması, uzun kayıt bellek ölçümü, erişilebilirlik ve UI bütünleştirmesi açık işlerdir. Ortak README/AGENTS/mimari belgelerindeki eski “gerçek okuyucu yok” ifadelerini Murathan koordine ederek güncellemelidir.

## 20. İlk bütünleştirme sırası ve kabul ölçütleri

Önce resmî 10 dosyalık örneği kurun ve API/CLI doğrulamasını çalıştırın. Sonra tek RGB binding'i ile ilk/orta/son kare, geçersiz indeks, eksik dosya ve kapatma/yeniden açmayı UI'da doğrulayın. Ardından bağımsız depth seçimi, önizleme/ölçüm ayrımı, analiz iptali ve aynı kayıt/akış kapsamına ait JSON indirmesini bağlayın. En son hızlı arama, StrictMode/unmount, iki akışın kaynak izolasyonu, dar ekran ve klavye davranışını test edin. Sentetik rota/etiketleri koruyun; gerçek veride hata olursa sentetik fallback açmayın.

Gerçek CLI örneği depo kökünden, kişisel yol gerektirmeden:

```sh
mkdir -p reports/local
./node_modules/.bin/tsx src/data/examples/tum-local.ts \
  data/local/tum-rgbd-freiburg1-desk reports/local/tum-quality.json
```

Windows PowerShell için aynı `tsx` yolu yerine `node_modules/.bin/tsx.cmd` kullanılabilir; hedef rapor dizinini önce oluşturun. Komut gerçek dosyalar eksikse açık hata verir. Beklenen küçük örnek sonucu: TXT sayıları 613/595/2.335/11.815; altı doğrulanmış PNG; 1.208 kaynak görüntü referansı / 1.202 örnek dışı referans; **metadata-only** kapsam. Bu zincirin başarılı çalışması, React UI bağlantısının tamamlandığı iddiası değildir.
