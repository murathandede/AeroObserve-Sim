# Kayıt arayüzü — Faz 1–7

`RecordingWorkbench` mevcut uygulamanın props/callback sınırını korur. Bu klasör
sunum bileşenleri ile küçük seçim/analiz yaşam döngüsü adapter'ları içerir.
Reader veya oynatma timer'ı oluşturmaz; hazır kalite motorunu açık kullanıcı
eylemiyle çağırır. Gerçek dosya seçimi reader açılışından ayrıdır.

| Bileşen | Sorumluluk |
| --- | --- |
| `Panel`, `EmptyState`, `ReaderErrorNotice` | Adlandırılmış section, ortak boş durum ve hata/recovery/file gösterimi |
| `WorkbenchHeader`, `RecordingSelection`, `SourcePanel`, `ReportPanel` | Kaynak türü, aç/kapat, manifest kaynak/lisans/atıf ve tamamlanmış aktif analizden JSON indirme |
| `reportDownload.ts` | Efe create/serialize/download API'lerine dar UI bağlantısı; oturum eşleşmesi ve yalnız indirme URL'sinin sahipliği |
| `FrameViewer` | Açık/hazır kareyi gösterme; kapalı/yükleniyor/boş/hata ve görüntü yükleme hatası |
| `PlaybackControls` | Mevcut seek/playing/speed callback'lerinin sunumu; bağımsız saat yok |
| `PlaybackNavigation`, `PositionSearch`, `playbackInput.ts` | İlk/son/ileri/geri, API çizelgesi ve doğrulanan 0 tabanlı sayısal arama; yalnız düzenleme taslağı yerel state'tir |
| `MetadataPanel`, `metadataPresentation.ts` | Kayıt/seçili kare/özgün/türetilmiş/birim bölümleri, güvenli sayı/metin sunumu ve görüntüyle ortak pozisyon/kimlik kontrolü |
| `QualityPanel`, `QualityIntervals`, `qualityPresentation.ts` | Gerçek analiz durumu/kapsamı, filtreli bulgular, sınırlamalar ve kaynak aralıklarının SVG/tablo sunumu |
| `QualityAnalysisController`, `useQualityAnalysis` | Aktif input/akış/oturuma bağlı, AbortSignal ve istek kuşağıyla yönetilen kullanıcı başlatmalı Efe analizi |
| `LocalRecordingSelection`, `SelectionFeedback` | Kullanıcı kontrollü native klasör/çoklu dosya seçimi, manifest kaynak bilgisi ve seçim durumu |
| `selection.ts`, `SelectionController` | Efe'nin mevcut doğrulayıcısını kullanan yol/File adapter'ı ve iptal/yeniden seçim yaşam döngüsü |
| `ActiveRecordingControls` | Hazırlanmış input için RGB/Depth seçimi ve açık gerçek kayıt açma eylemi |

Stiller `../recording.css` içinde; renk/boşluk değişkenleri ve global stil
override'ları `.recording-workbench` kapsamındadır. Eski `styles.css`/`Scene.tsx`
korunur. Geniş ekranda üç sütun, 1200 px altında iki, 760 px altında tek sütun;
uzun kaynak yolları satıra kırılır. Native kontroller, görünür focus, ana alana
atlama bağlantısı ve yükleme/hata durumları için status/alert kullanılır.

## Faz 2 seçimi ve entegrasyon sınırı

- Yerleşik `data/manifests/tum-rgbd-freiburg1-desk.json` doğrudan kullanılır;
  manifest düzenlenmez. Keyfî manifest yükleme bu sürümün özelliği değildir.
- `prepareRecordingSelection(manifest, files, signal?)` ortak `RecordingInput`
  üretir; `inspectSelectionManifest` Efe'nin `snapshotTumInput` doğrulayıcısını
  kullanır. İç modül import'u yalnız UI adapter'ında tutulur; Efe export'ları
  veya sözleşmesi değiştirilmez.
- Anahtarlar `File.webkitRelativePath` ile birebir eşlenir. Belgelenen
  `tum-rgbd-freiburg1-desk/` dış kökü kontrollü kaldırılabilir. Başka kök,
  traversal, basename tahmini ve yinelenen yol kabul edilmez. Doğrudan
  `rgbd_dataset_freiburg1_desk/` veya onu içeren belgelenen örnek klasörünü seçin.
- Manifestin 10 dosyası zorunlu; ek dosyalar reddedilir. Tam arşivi açılmış,
  manifest dışı PNG'ler içeren klasörü doğrudan vermek bu küçük örnek modunda
  desteklenmez. Uzantı/MIME, File ve boş dosya kontrolünden sonra her beklenen
  dosyanın yalnız ilk 1 baytı okunur. PNG/TXT yapısı ve hash kontrol edilmez.
- `webkitdirectory` desteği çalışma anında sorgulanır. Klasör input'u native ve
  görünürdür. Çoklu seçim göreli yol sağlamıyorsa açıklamalı olarak reddedilir;
  eski tarayıcılara dosya adı tahminiyle fallback yoktur. `cancel` desteklemeyen
  eski tarayıcıda görünür temizle/iptal düğmesi seçimi sıfırlar.
- `SelectionController` istek kuşağı ve AbortController ile eski sonuçları
  eler; aynı klasör yeniden seçilebilir. Yeni seçim/iptal sırasında önceki input
  temizlenir. Object URL veya kayıt okuyucusu oluşturulmaz.
- `RecordingWorkbenchProps` eski alanları korur; `preparedInput` ve
  `onPrepareInput(input | null)` ile input uygulama state'ine aktarılır.
- Faz 3'te `RecordingWorkspace` hazırlanmış seçim ve aktif binding'i ayrı tutar.
  Gerçek kaydı aç eylemi `createTumRecordingBinding(input, stream)` ile Efe'nin
  `TumRecordingReader` factory'sini kurar; mode daima manifest-subset'tir.
  Reader ve görüntü istekleri mevcut `useRecording` üzerinden çalışır.
- Yeni dosya seçimi, akış değişimi ve kapatma aktif oturumu kapatır; yeni kaynak
  otomatik açılmaz. Sentetik örnek ayrı ve açık bir kullanıcı eylemidir.
- `src/playback/readerSession.ts` küçük bir async adapter'dır: ReaderResult ve
  opsiyonel Efe kare metadata'sını taşır, geç sonuçları eler ve close'u çağırır.
  Decoder, URL sahibi veya oynatma motoru değildir. Mevcut tek gösterim timer'ı
  `useRecording` içinde kalır. Hook, binding/açık durumu/oturum sahibi değiştiği
  ilk render'da eski metadata ve kareyi gizler; cleanup'ı bekleyip yanlış kaynak
  etiketi altında eski görüntü göstermez.
- `FrameViewer`, aynı reader'ın getFrame/getFrameMetadata çıktısını gösterir:
  API indeksi, özgün kaynak indeksi, dosya ve ham zaman tokeni ayrıdır.
  RGB/depth zamanı unknown kalır. Depth yalnız özgün 16-bit PNG önizlemesidir;
  renk/parlaklıktan ölçüm veya sıcaklık hesaplanmaz, ham veri dönüştürülmez.
- Ayrıntılı TUM provenance Faz 5 paneline, asenkron analiz Faz 6'da bağlandı.
  Mevcut senkron metadata raporu tam görüntü taraması değildir ve JSON'a kaynak olmaz.
  Faz 7 JSON düğmesi yalnız tamamlanmış, aktif gerçek TUM analizinde çalışır.
- `FrameViewer` reader URL'sini revoke etmez; sahibi reader'dır. Kayıt kapalı,
  yükleniyor veya hatalıysa eski görüntüyü render etmez. `FrameImage` kare/URL
  anahtarı değişince veya boş duruma geçince yeniden oluşturulur.

## Faz 4 gezinme ve gösterim temposu

- API pozisyonu sıfır tabanlıdır. Görsel sıra `index + 1 / frameCount` olarak
  ayrıca gösterilir. Slider'ın değeri, ilk/son/önceki/sonraki ve sayısal arama
  doğrudan API pozisyonuyla mevcut `onSeek` callback'ini çağırır. Özgün kaynak
  indeksine veya zamana göre arama yoktur; zaman ekseni üretilmez.
- Sayısal alan, `inputMode="numeric"` kullanan native text input'tur. Böylece
  geçersiz karakter/ondalık/boş değer özgün biçimiyle denetlenip açıklanabilir.
  Enter veya Kareye git ile gönderilir; tam sayı ve `[0, frameCount - 1]`
  aralığı zorunludur. Geçerli arama taslağı temizler, geçersiz arama seek yapmaz.
  Uygulamanın mevcut oturum anahtarı yeniden açma/değişimde taslağı sıfırlar.
- İlk/son sınırında ilgili yön butonları kapalıdır. Boş, kapalı veya hatalı
  kayıtta gezinme kapalıdır; reader/kare hatasında mevcut yeniden aç eylemi
  kullanılır. Tek karede otomatik oynatma kapalı, API0 incelemesi mümkündür.
- Metadata açıldıktan sonra kare yüklenirken slider ve gezinme kullanılabilir;
  oynatmayı başlatma hazır kareyi bekler. Oynayan kaydı yükleme sırasında
  duraklatmak mümkündür. Her geçerli seek otomatik oynatmayı durdurur.
- Son kareye gelince durur; döngü/otomatik başa sarma yoktur. Son karede Oynat
  kapalıdır; ilk veya önceki kareye gidip yeniden Oynat seçilebilir.
- `.5 / 1 / 2` hızları yalnız gösterim temposudur. Reader kareyi sağladıktan
  sonra `1000 / speed` ms beklenir; decode/gecikme toplam süreyi uzatabilir.
  Bu değerler sensör FPS'i, özgün kayıt zamanı veya gerçek zamanlı oynatma
  değildir. Kaynağın zaman alanları değiştirilmez.
- `playbackPolicy.ts` yalnız ortak kontrol/hız/sınır doğrulamasıdır; state veya
  saat tutmaz. `schedulePresentationStep`, mevcut `useRecording` effect'inin
  tek timeout'unu aynı dosyada kurar ve cleanup döndürür. İkinci döngü yoktur.
  Yeni seek/pause/hız komutu ve oturum sahibi eski kuyruk callback'ini geçersiz
  kılar. Hız değişince effect önce timer'ı temizler, sonra tek timer kurar.
- Farklı pozisyona seek sırasında effect cleanup, mevcut
  `ReaderSession.cancelFrame()` kuşağını geçersiz kılar. Aynı pozisyona seek
  bekleyen kareyi iptal etmez. Render sırasında owner/index kontrolü korunur;
  eski görüntü yeni pozisyon olarak gösterilmez. Reader URL'lerini reader temizler.
- RGB/Depth akış değişimi mevcut Workspace.close → açık kullanıcı eylemiyle
  yeni binding/open yolunu izler. Yeni akış API0'da, duraklatılmış başlar;
  iki akışın pozisyonları veya zamanları eşleştirilmez.

## Faz 5 metadata akışı ve kökeni

- `getMetadata()` tekrar çağrılmaz; mevcut `open()` sonucu korunur. Kaynak
  kapsamı ve ham TXT satırı/reader özeti için `ReaderSession.getSourceInfo()`
  ve `getTableMetadata()` dar, opsiyonel forwarder'lardır. Hook bunları yalnız
  başarılı açılışta birer kez çağırır. Efe'nin getter'ları zaten ayrıştırılmış
  oturum verisinin kopyasını döndürür; TXT/PNG yeniden okunmaz. Seek, render,
  timer veya polling ile tekrarlanmaz. Ortak reader/binding tipleri değişmez.
- Bu veriler mevcut hook'un oturum state'inde tutulur; ayrı async metadata
  sistemi veya ikinci cache yoktur. Owner değişiminde temizlenir ve ilk render
  sırasında gizlenir. Opsiyonel getter hatası `metadataError` olarak yalnız
  metadata panelinde gösterilir; başarılı görüntü açılışını engellemez.
- Mevcut `getFrame` sonrasında alınan `getFrameMetadata` yolu korunur. Bu API
  senkrondur; bağımsız bir metadata isteği başlatılmaz. ReaderSession önce
  frame istek kuşağını denetler; eski frame sonucundan metadata istemez.
- Aktif binding manifesti aynı owner kapısından sunuma geçirilir; hazırlanmış
  fakat açılmamış seçim aktif metadata olarak gösterilmez. Kayıt tanımlayıcısı,
  lisans/atıf ve sürüm manifest kaynaklıdır; PNG/TXT ölçümü diye sunulmaz.
- Kayıt Bilgileri ve Seçili Kare görünürdür. Özgün/Türetilmiş Metadata ve
  tanım/atıf native details ile açılır; bütün alanlar metin/dl ile etiketlidir.
  Dar ekranda uzun yollar, ham satırlar ve yöntem açıklamaları kırılır.
- Görsel sıra `FrameRecord.index + 1`, API pozisyonu `FrameRecord.index`,
  özgün kaynak indeksi `frameMetadata.original.sourceIndex` alanıdır. Kaynak
  satır numarası ayrı ve 1 tabanlıdır. Kaynak indeksi API'den tahmin edilmez.
- `FrameViewer` ve panel aynı `frameAtPosition` / `matchingFrameMetadata`
  sunum kontrolünü kullanır. Pozisyon, akış veya kaynak dosya/satır/token
  eşleşmezse eski görüntü ve seçili kare metadata'sı birlikte gizlenir. Eksik
  metadata ise eşleşme hatası sayılmaz; sağlanmamış olarak gösterilir.
- Ham `timestampRaw` ve kaynak `originalLine` doğrudan güvenli React metnidir.
  Number, Date, yerel saat veya saniye dönüşümü uygulanmaz. FrameTime'ın
  özgün/türetilmiş saniye türü varsa kendi source/method/timeBase alanlarıyla
  ayrıca gösterilir. Null sıfır yapılmaz; gerçek sıfır korunur; NaN/Infinity
  açıkça geçersiz olarak gösterilir. Sayısal yuvarlama uygulanmaz.
- TXT ilk–son farkı Efe'nin `firstToLastDuration` çıktısından, tam ondalık
  sonuç, yöntem, girdiler, birim ve kaynak tablo kapsamıyla gösterilir. Oturum
  süresi veya küçük PNG alt kümesinin süresi diye sunulmaz. Aralık grafiği,
  yeni zaman hesabı veya kalite analizi yapılmaz.
- Depth için measurementUnit ve documentedDepthConversion mevcutsa ham
  kod, belgelenmiş bölen/çıktı birimi, geçersiz ham kod ve evidence gösterilir.
  Dönüşüm görsel önizlemeye uygulanmaz. Sayısal piksel verisi bağlanmadığı için
  fiziksel değer gösterilmez; RGB'de depth dönüşümü gösterilmez. Termal ölçüm
  veya radyometri üretilmez. `decodeTumDepth` çağrılmaz.
- SourceInfo'nun frameCount ve sourceRowCount alanları ayrı gösterilir.
  Manifest alt kümesi tam sensör kaydı değildir; kaynak indeks boşlukları
  veya seçilmeyen kaynak görüntüler kayıp kare olarak sınıflandırılmaz.

## Faz 6 kalite analizi ve aralık grafiği

- `RecordingWorkspace`, yalnız aktif binding/open/session/stream ve mevcut
  hook metadata/sourceInfo alanlarını `useQualityAnalysis` bağlantısına verir.
  Hazırlanmış input tek başına analiz hedefi değildir. Sentetik, kapalı veya
  henüz metadata/kapsam sağlamamış reader'da başlatma kapalıdır. Kare okuma
  hatası olsa da aktif reader'ın kapsamı biliniyorsa analiz hatayı inceleyebilir.
- `activeQualityTarget` input referansını kopyalamadan korur; recording id,
  provenance, stream ve frame count eşleşmesini denetler. Her aç/kapat/akış
  değişiminde Workspace'in mevcut session anahtarı yeni owner oluşturur.
  Kare gezinmesi analiz başlatmaz veya hedefi değiştirmez.
- `QualityAnalysisController.start(inspectImages)` gerçek
  `analyzeTumRecording(input, {mode, streams:[activeStream], inspectImages,
  signal})` çağırır. Metadata-only/TXT kontrolü varsayılandır; PNG yapısal
  incelemesi native checkbox ile açıkça seçilir. Mod aktif reader'dan gelir;
  UI küçük örneği full-recording'e yükseltmez. API progress callback sağlamaz;
  yüzde veya kalan süre üretilmez.
- Efe motoru seçili PNG akışına ek olarak dört TXT tablosunu bağımsız inceler.
  Bu kapsam işlemden önce ve sonuçtaki sourceTables tablosunda açıklanır.
  Başka TXT akışına ait bulgu kendi stream/file/satır kimliğiyle gösterilir;
  aktif RGB karesine aitmiş gibi yeniden etiketlenmez.
  PNG sayaçları yalnız seçili akış kapsamıdır; başka manifest girdisinin
  eksikliği bulgularda bulunabilir ve bu sayaçlarla karıştırılmaz.
- İkinci start çalışırken reddedilir. İptal AbortController.abort ile motora
  iletilir; native Blob/decompression işinin anında durduğu iddia edilmez.
  UI önce iptal istendi der; motor coverage.cancelled sağlarsa iptal onayı ve
  kısmi kapsam korunur. Geç tamamlanmış başarı elenir. İptal sonrası yeniden
  start yeni kuşaktır; eski başarı/hata bu sonucu değiştiremez.
- Controller effect içinde oluşturulur; StrictMode cleanup/setup yeni örnek
  alır. Owner değişimi sonuçları ilk render'da gizler; cleanup dispose ile
  abort eder, listener/target/sonuç referanslarını bırakır. Tek aktif analiz
  işi vardır; yeni playback saati veya metadata polling eklenmedi.
- Motorun TumQualityAnalysis nesnesi değişmeden saklanır. recording id,
  tek seçili stream, selectionMode ve inspectionRequested istekle eşleşmezse
  sonuç gösterilmez. coverage.completed ve cancelled ayrı korunur; completed
  true veri sağlıklıdır demek değildir. Eksik tamamlanma partial gösterilir.
- Eski analyzeMetadata sonucu ayrı native details içinde **Temel metadata
  kontrolü** olarak kalır. Gerçek analiz sonucu idle/running durumunda yoktur.
  metadata-only, tüm görüntülerin içerik açısından doğrulandığı anlamına
  gelmez; alt kümenin PNG'leri doğrulansa da Efe kapsamı metadata-only kalır.
  Sıfır bulgu yalnız incelenen kapsamı anlatır; genel kusursuzluk iddiası yoktur.
- Bulgular severity error/warning/info sırasıyla ve metin etiketleriyle
  gösterilir. Filtre/seviye sayımları UI işlemidir. Her sayfada en fazla 20
  bulgu vardır; orijinal issueIndex korunup details ile eşlenir. Kaynak indeksi,
  1 tabanlı satır ve varsa seçili kapsamın API pozisyonu ayrıdır. Güvenilir bir
  UI gezinme bağlantısı eklenmedi; **Kareye git** düğmesi yoktur.
- Grafik yalnız `analysis.coverage.sourceTables` içindeki aktif RGB/Depth
  tablosunun `metadata.derived.intervals` dizisini kullanır. İki kaynak girdi,
  tablo/file/stream kapsamı ve birim tutarlılığı denetlenir. Ham timestamp
  tokeninden UI aralık hesaplamaz. Sıfır/negatif sonlu değerler korunur;
  null, NaN/Infinity veya kaynak/birim çelişkisi ölçüm olarak çizilmez.
- RGB/Depth için birim `source-timestamp-unit-unknown` ise eksen **Kaynak
  damga farkı · birim bilinmiyor** der; saniye veya ortak saat iddiası yoktur.
  Kaynak verinin birimi seconds ise buna uygun etiket gerekir. Grafik yalnız
  aynı TXT kapsamındadır; RGB/Depth serileri birleştirilmez. Groundtruth ve
  accelerometer kapsamı tabloda korunur, aktif akış grafiğine taşınmaz.
- Aralıklar 40'lık pencerelerle SVG ve erişilebilir tablo olarak gösterilir.
  SVG geometri için motorun sonlu value alanını kullanır, yeni ölçüm üretmez.
  Eksik değerler × ile işaretlenir, boşluk üzerinden çizgi çizilmez. Eksen
  etiketleri gerekirse kısalır; exactDecimal ve özgün kaynak çiftleri tablo ve
  tooltip'te korunur. Grafik veri yokluğunda açıkça yetersiz/desteklenmiyor der.
- Faz 5 metadata/sourceInfo aktif kapsamı belirlemek için yeniden kullanılır.
  Analiz API'si hazır metadata enjeksiyonu kabul etmez; analiz kendi dosya
  okumasını yapar. UI ikinci ayrıştırıcı/analiz motoru kurmaz ve PNG'leri sırf
  sunum için decode etmez. JSON bağlantısı aşağıdaki Faz 7 sınırını kullanır.

## Faz 7 rapor ve kaynak bağlantısı

- `useQualityAnalysis` aynı owner/snapshot kontrolünden geçen `qualityTarget`
  referansını UI'ya verir. Bu referans aktif binding'in input'unu taşır; hazırlanmış
  seçimden veya eski senkron `report` alanından dışa aktarım yapılmaz. Ortak veri
  tipleri ve uygulama/playback dosyaları bu fazda değiştirilmedi.
- `completedReportContext` açık/gerçek kayıt, reader/akış/mod ve tamamlanmış,
  iptal edilmemiş analiz eşleşmesini kontrol eder. Idle/running/partial/cancelled/
  error durumlarında ve owner değişiminde düğme kapalıdır. Kısmi rapor dışa aktarımı
  Efe API'sinde mümkün olsa da bu UI yalnız tamamlanmış analizi dışa aktarır.
- Kullanıcı `JSON raporu indir` düğmesine basınca `createTumReport` ve
  `prepareTumJsonDownload` çağrılır; ikincisi kendi içinde `serializeTumReport`
  kullanır. Analiz yeniden çalışmaz, yeni reader/metadata çağrısı yapılmaz.
  `sourceInfo` rapora verilir; anlık seçili kare metadata'sı ayrıca toplanmaz.
  Böylece seek sırasında rapor tekrar üretilmez veya kare metadata cache'i kurulmaz.
- `ReportDownloadLease` tek indirme URL'sini sahiplenir. Sonraki indirmede,
  analiz/oturum değişiminde ve effect cleanup/unmount'ta `dispose()` çağrılır.
  Reader URL'lerine dokunulmaz. URL tıklamanın hemen ardından revoke edilmez.
  Render owner koruması eski hata/başarı mesajını yeni kayda göstermez; StrictMode
  effect cleanup/setup kaynak oluşturmadan güvenle tekrar çalışabilir.
- UI native geçici `<a download>` oluşturup tıklar ve düğümü kaldırır. Tarayıcının
  dosyayı gerçekten diske kaydettiği uygulama tarafından ölçülemez; durum metni
  yalnız indirme isteğinin iletildiğini belirtir. Hatalar kod/mesaj/recovery ile
  role=alert olarak gösterilir. Dosya adı sınırlı ASCII kayıt kimliği + akış içerir.
- `SourcePanel`, manifest kaynak URL'sini, lisans kanıtındaki bağlantıları,
  citation ve versionOrAccessDate alanlarını kullanır. Yalnız HTTP(S) bağlantısı
  açılır; target=_blank, rel=noopener noreferrer ve yeni sekme açıklaması vardır.
  Yayımlayıcı ortak manifestte ayrı alan değildir; ad uydurulmaz. Eksik lisans
  kullanım izni sayılmaz. Kaynak tanımı ile ölçüm ve alt küme/tam kayıt ayrımı korunur.
- Dar ekranda uzun buton/hata/kaynak metinleri kırılır; select max-width ve min-width
  sınırları, checkbox etiketinde 44 px dokunma alanı vardır. 360/768/1024/1440 px
  düzeni CSS üzerinden incelendi; canlı tarayıcı doğrulaması yerine geçmez.

## Doğrulama — Faz 1–7

`tests/ui-recording.test.ts`, `tests/ui-selection.test.ts` ve
`tests/ui-reader-integration.test.ts`, `tests/ui-playback.test.ts` ve
`tests/ui-metadata.test.ts` ve `tests/ui-quality.test.ts`, mevcut node:test
ve React server renderer ile durum/kapsam/veri doğruluğu, seçim adapter'ı,
istek yarışları ve hazır olmayan indirmeyi denetler. Bu testler DOM
etkileşimi veya tarayıcı erişilebilirlik testi değildir. Kontroller:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Tarayıcı erişildiğinde ayrıca aç/yeniden aç/kapat, önceki/sonraki/slider,
oynat/duraklat/hız, Tab/Shift+Tab ve skip link, görüntü onError sonrası başka
kareye geçiş, 360/768/1440 px ve `?view=simulation` doğrulanmalıdır.
Gerçek klasör seçimi, iptal, yeniden seçim ve eksik/ek dosya mesajları da
tarayıcıda ayrıca kontrol edilmelidir. Node'daki yapay File testleri gerçek
TUM doğrulaması değildir; özgün örnek bulunmazsa gerçek seçim testi skip verir.
Entegrasyon testleri gerçek Efe reader'ı + açıkça yapay PNG/TXT fixture'larını,
gecikmeli/hatalı mock reader'ları ve production async adapter'ını kullanır.
Object URL baytları/kapanışı, ilk/orta/son kare, akış/demo geçişleri ve stale
yanıtlar denetlenir. React effect/mount, img onLoad/onError, dosya diyaloğu ve
gerçek klavye davranışı tarayıcıda ayrıca doğrulanmalıdır. Faz 4 testleri
stateless kontrol elemanlarının gerçek handler props'larını çağırır; sayısal
arama adapter'ını ve production tek-adım timer fonksiyonunu fake clock ile
denetler. Cleanup/unmount ve StrictMode senaryoları cleanup sözleşmesi düzeyinde
test edilir; gerçek React mount/effect veya DOM olay testi yapılmış sayılmaz.
Faz 5 testleri ayrıca metadata eşleşmesi, ham token/satır hassasiyeti, birimler,
Depth dönüşüm açıklaması, null/sıfır/geçersiz sayılar ve getter/istek kuşağı
korumalarını denetler. Efe'nin reader'ı + yapay PNG/TXT ile ilk/orta/son metadata
paneli de SSR'da doğrulanır; özgün TUM testi dosyalar yoksa skip verir.
Faz 6 testleri Efe'nin gerçek fonksiyonunu açıkça yapay PNG/TXT ile çalıştırır;
iptal, geç Blob hatası, kaynağa bağlı bulgular ve aralıklar doğrulanır. Mock
testler eski sonuç/hata, tekrar start, iptal/yeniden başlatma, sınırlı sayfalama
ve geçersiz grafik verisini denetler. Bunlar gerçek React effect/mount, dosya
diyaloğu veya tarayıcı filtre/klavye testi değildir. Özgün TUM kalite UI testi
dosyalar bulunmazsa skip verir. Yeni paket eklenmedi.

`tests/ui-report.test.ts`, Efe'nin gerçek API'siyle yapay TXT/okunmayan PNG
placeholder girdilerinden JSON/MIME/UTF-8/kapsam ve hata denetimleri yapar.
Özgün TUM dosyalarıyla RGB/depth analiz+JSON ve reader/indirme URL sahipliği
testleri ayrıca çalışır; dosyalar yoksa skip edilir. Mock document testi native
anchor adapter'ının çağrılarını denetler; gerçek tarayıcı indirmesi değildir.
SSR testleri disabled/açıklama/bağlantı güvenliğini denetler. Gerçek React
effect/unmount, disk kaydetme diyaloğu, responsive görünüm ve klavye olayları
tarayıcıda ayrıca doğrulanmalıdır.

Tarayıcı API başvuruları: [webkitdirectory](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory),
[webkitRelativePath](https://developer.mozilla.org/en-US/docs/Web/API/File/webkitRelativePath).
