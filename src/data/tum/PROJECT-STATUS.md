# AeroObserve — proje durumu ve kanıt haritası

İnceleme tarihi: **18 Ekim 2026**. Bu belge mevcut kaynak ağacını, erişilebilir Git geçmişini ve Efe teslimini birlikte değerlendirir. API kullanımı için [okuyucu belgesi](../../../docs/readers.md), [mevcut teknik teslim](HANDOFF.md) ve [Murathan bütünleştirme teslimi](MURATHAN-HANDOFF.md) esas alınmalıdır.

## Amaç ve mevcut öncelik

[Ortak proje bağlamı](../../../docs/project-context.md), ilk uzun vadeli fikri radar ve termal gözlemlerin birlikte değerlendirilmesi olarak kaydeder. Güncel öncelik; gerçek kayıtları güvenilir biçimde okuyabilmek, özgün metadata/zaman/birim bilgisini korumak, kalite sorunlarını izlenebilir kurallarla göstermek ve raporlamaktır. Aynı ekranda iki görüntü göstermek fiziksel eşleşme veya füzyon kanıtı sayılmaz.

İlk gerçek kaynak, Ahmet'in kataloğunda belgelenen **TUM RGB-D — freiburg1_desk** oldu. Bu kayıt RGB ve uzaklık kodlanmış depth içerir; termal sıcaklık veya radar ölçümü içermez. Kaynak seçimi projenin ilerideki sensör araştırmasına başlangıç sağlar; saha başarısı veya hedef tespiti sonucu üretmez.

## Git geçmişinin kanıtladığı başlangıç

Denetim başlangıcında `feat/recording-reader` dalının HEAD'i `d3117076b5aa2360d66ff2bac5328ca7a65a6cb9` idi. Efe'nin aşağıda açıklanan uygulaması o anda çalışma ağacındaydı. Bu tarihsel başlangıç SHA'sı yeni teslim commit'inin SHA'sı değildir; teslim alındığında gerçek revizyon `git rev-parse HEAD` ile kaydedilmelidir.

| Commit | Git yazar alanı | Doğrulanan değişiklik |
| --- | --- | --- |
| `94eb35d35dd87958a882ad573228431f483f3304` | Murathan Dede | İlk sentetik React/Canvas simülasyonu, araştırma bağlamı, ilk ekip görevleri ve testler. |
| `8c0c592510db7febed146017181755cac98109f3` | Murathan Dede | Ortak kayıt sözleşmesi v1; sentetik SVG okuyucu; `RecordingWorkspace`, `RecordingWorkbench`, `useRecording`; manifest şablonu ve ekip başlangıcı. |
| `d3117076b5aa2360d66ff2bac5328ca7a65a6cb9` | Ahmet | `docs/datasets.md` kaynak kataloğu ve gerçek TUM manifesti. İki dosya, 153 ekleme / 13 silme. |

Kanıt yöntemi: `git log --all` yazar/tarih/ebeveyn bilgileri ve bu üç commit için `git show --stat`; UI, playback, app ve ortak tip yollarının geçmişi ayrıca incelendi. Git yazar alanı, insan katkılarının bütün ayrıntılarını veya satırların tek başına kim tarafından yazıldığını kanıtlamaz.

Denetimde erişilebilir geçmişte Derviş adına ayrı bir commit görünmedi. Bu, Derviş'in depo dışında hiçbir çalışma yapmadığı anlamına gelmez. Mevcut `RecordingWorkbench` ve oynatma başlangıcı, Murathan yazar alanlı ortak başlangıç commit'inde bulunuyor. Derviş'in UI sahipliği [görev belgesinden](../../../docs/team/dervis.md) gelir; tamamlanmış bağımsız Derviş geliştirmesi olarak sunulmaz.

Başlangıç remote kaydı `origin = https://github.com/murathandede/AeroObserve-Sim.git`; başlangıç `main`/`origin/main` değeri `8c0c592…`, Ahmet'in erişilebilir remote dalı `origin/feat/dataset-catalog = d311707…` idi. Sonraki fetch/push durumunu bu tarihsel tablodan çıkarmayın; `git status`, `git branch -vv` ve `git log --all` ile kontrol edin.

## Ekip sorumluluğu ve gerçek teslim durumu

| Üye | Sözleşmedeki alan | Bu ağaçta doğrulanan durum |
| --- | --- | --- |
| Ahmet | Veri kaynağı, lisans, katalog, manifest | TUM seçimi; resmî edinme talimatı; 10 dosyalık özgün örnek; yerel referans hash envanteri. Git kanıtı `d311707…`. |
| Efe | `src/data/`, `src/quality/`, okuyucu/kalite testleri | Gerçek Blob okuyucusu, dört TXT parser'ı, PNG doğrulaması, metadata/zaman provenance, açık sayısal depth decoder'ı, kalite analizi ve JSON dışa aktarımı. Okuyucu sürümü `1.1.0`; dal `feat/recording-reader`. |
| Derviş | `src/ui/`, UI testleri | Props tabanlı başlangıç ekranı mevcut. Gerçek dosya seçimi, kapsam/provenance/rapor görünümü ve kullanıcı etkileşimi bütünleştirmesi sonraki iş. |
| Murathan | `src/app/`, `src/playback/`, ana giriş, demo, ortak koordinasyon | Çalışan sentetik binding ve tek oynatma denetleyicisi mevcut. Gerçek okuyucu factory/input ve asenkron analiz/rapor bağlantısı bekliyor. |

Bu teslim başka üyenin sahiplik alanına uygulama değişikliği yapmaz. Ortak `src/shared/types.ts`, paket tanımı ve kilit dosyası Efe uygulaması için değiştirilmemiştir.

## Efe Faz 0–7 ilerleme özeti

| Faz | Sonuç / kanıt sınırı |
| --- | --- |
| 0 — depo ve ortam | Ahmet'in commit'i/dalı doğrulandı; çalışma dalı bu başlangıçtan hazırlandı; ilk typecheck, 9 test ve build başarılıydı. Mevcut kullanıcı değişiklikleri korunarak çalışıldı. |
| 1 — gerçek veri ve tasarım | Resmî edinme adımlarıyla özgün küçük örnek sağlandı; 10 dosya ve arşiv yerel referans envanteriyle karşılaştırıldı. Tam TXT listesi ile küçük PNG alt kümesi ayrıldı; tek seçili akış mimarisi hazırlandı. |
| 2 — okuyucu | `RecordingReader` v1 uygulandı; RGB ve depth ayrı oturumlar; lazy PNG doğrulaması; API/kaynak indeks eşlemesi; kontrollü hata ve close/reopen/eşzamanlılık davranışı. |
| 3 — metadata, zaman ve depth | Özgün token/satır bilgileri ve kaynak tablo özetleri ayrıldı. RGB/depth saat/birim belirsizliği korundu. Açık depth çözümlemesi, üç gerçek dosyanın tüm piksellerinde bağımsız Pillow 11.3.0 referansıyla karşılaştırıldı. |
| 4 — kalite | Dört tablo, dosya varlığı, hatalı satır/sayı, yinelenen damga ve sıfır/negatif aralıklar, isteğe bağlı PNG incelemesi; dosya/satır/API kapsamı içeren bulgular. Sensör kaybı sayısı uydurulmaz. |
| 5 — JSON raporu | `schemaVersion: 1` kapsülü, ortak `QualityReport`, kaynak/lisans, özgün/türetilmiş bilgiler ve açık coverage; kararlı JSON ve temizlenebilir indirme kaynağı. |
| 6 — regresyonlar | Hata/iptal, bozuk girdi, kaynak temizliği, snapshot koruması, bağımsız akışlar, hızlı kare istekleri ve rapor kapsam/sayaç denetimleri test edildi. Gerçek testler veri yoksa gerekçeli skip verir. |
| 7 — örnek ve teslim | Gerçek yerel Node örneği, okuyucu belgesi, teknik teslim ve bu durum/bütünleştirme notları hazırlandı. Nihai audit, Git teslimi ve sonraki UI bütünleştirmesi ayrı işlemlerdir. |

## Gerçek veri kapsamı

Yerel örnek kökü `data/local/tum-rgbd-freiburg1-desk/`; bunun altında manifestteki `rgbd_dataset_freiburg1_desk/…` yolları bulunur. **10 dosya / 2.480.192 bayt**: dört tam TXT ve üçer RGB/depth PNG.

| Kaynak | Tam TXT kaydı | Yerel seçili PNG | Örnek dışında kalan görüntü referansı |
| --- | ---: | ---: | ---: |
| RGB | 613 | 3 | 610 |
| Depth | 595 | 3 | 592 |
| Groundtruth | 2.335 | Görüntü değildir | Uygulanmaz |
| Accelerometer | 11.815 | Görüntü değildir | Uygulanmaz |

Toplam 1.208 görüntü referansından altısı seçilidir; **1.202 referans örnek dışıdır**. Bu sayı bozuk görüntü veya sensör kaybı sayısı değildir. Manifestte açıkça beklenen fakat sağlanmayan dosya, örnek dışı referans ve gerçekten okunamayan dosya farklı bulgulardır. Hash'ler Ahmet'in **yerel referanslarıdır**; resmî yayımlayıcı checksum'ı olarak sunulmaz. Altı PNG'nin yapısal doğrulaması ve üç depth dosyasının sayısal çözümü, bütün arşivin tarandığını göstermez.

## Teknoloji ve tekrar üretilebilir kurulum

| Katman | Depodaki seçim / kilitli sürüm |
| --- | --- |
| Dil | TypeScript `5.9.3`; strict, ES2022, ESM. |
| Arayüz | React / React DOM `19.3.1`; CSS; eski sahne için Canvas. |
| Geliştirme ve build | Vite `7.3.7`; tsc ile typecheck. |
| Test / örnek | tsx `4.23.15`, Node yerleşik `node:test` ve assert. |
| Tip paketleri | `@types/node 24.19.2`; `@types/react` / `@types/react-dom 19.3.0`. |
| Tarayıcı veri API'leri | Blob/File, ReadonlyMap, Object URL, AbortSignal, TextDecoder; PNG için `DecompressionStream('deflate')`. |
| Node örneği | Dosya sistemi yalnız `src/data/examples/tum-local.ts` adaptöründe; tarayıcı girişinden dışa aktarılmaz. |

Sürümler `package-lock.json` içinden okunmuştur; `package.json` aralıkları aynı şey değildir. Denetim terminalinde Node `24.12.0`, npm `11.6.2` görüldü. Başka bilgisayarda Node 22.12+ veya uyumlu Node 24 ortamında depo kökünden `npm ci` kullanın. Yeni bağımlılık, backend, GPU veya API anahtarı gerekmez. PNG çözümlemesinde ortamın yerel deflate desteği gerekir.

## Çalışan uygulama ile hazır API ayrımı

`src/app/recordingBinding.ts` hâlen `exampleBinding` kullanıyor. Ana ekran üç **sentetik SVG** sunuyor; `?view=simulation` eski sentetik motoru açıyor. `npm run example:reader` da sentetik sözleşme örneğidir.

Gerçek TUM okuyucu, kalite/rapor API'leri ve yerel dosya → okuyucu → kare → analiz → JSON → close Node örneği hazırdır. Gerçek API'nin hazır olması, React uygulamasında gerçek dosya seçiminin veya gerçek kayıt oynatımının bağlandığı anlamına gelmez. `RecordingBinding.analyze` senkron metadata alır; asenkron gerçek dosya taraması bu alana gizlenmemelidir.

README, `AGENTS.md`, eski mimari/sınırlama belgelerindeki “gerçek okuyucu yok” veya “tüm veriler sentetik” cümleleri ortak başlangıç durumunu anlatır. Bu teslimde başka sahiplerin belgeleri değiştirilmemiştir. Güncel Efe katmanı için [docs/readers.md](../../../docs/readers.md) okunmalı; ortak metinlerin güncellenmesini Murathan koordine etmelidir.

## Doğrulama ve açık sınırlar

Önceki Faz 7 teslim kaydı **104 test / 0 hata / 0 skip**, başarılı typecheck/build ve sentetik örnek çalıştırmasıdır. Bu sayı önceki baselinedır; sonraki nihai audit yeni test ekleyebilir. Teslim alınan revizyon için güncel `npm test` çıktısı esas alınmalıdır. Gerçek CLI örneği dört TXT sayısını ve altı PNG'yi doğruladı; JSON kapsamı `metadata-only` kaldı.

Nihai denetimde 104 başlangıç testi yeniden çalıştı; iki close/reopen sonuç
teslimi yarışı ve bir opsiyonel-source provenance regresyonuyla güncel toplam
**107 başarılı / 0 başarısız / 0 atlanan** oldu. Typecheck/build, sentetik
örnek, gerçek TUM CLI ve Derviş kılavuzunun derlenen/çalıştırılan API örneği
başarılıdır. On dosyanın hash/boyutu, dört TXT sayısı ve üç depth dizisinin
307.200'er uint16 örneği yeniden bağımsız doğrulandı. Ham veri Git'e eklenmez.

Önceki yerel tarayıcı API kontrolü altı görüntü, üç sayısal depth dizisi ve URL temizliğini kapsadı. Kullanıcı dosya seçici → React UI → analiz/indirme bütünleştirmesi, erişilebilirlik ve büyük kayıt bellek ölçümü tamamlanmış değildir. Tam kayıt veya fiziksel sensör doğruluğu iddiası yoktur.

TXT'nin tümü belleğe alınır; her tablo için 32 MiB sınırı vardır. Ziyaret edilen görüntü URL'leri oturum sonuna kadar tutulur. Sayısal depth, doğrulama ardından ikinci zlib geçişini kullanır. RGB/depth zamanları ortak saate taşınmaz; ivmeölçer fiziksel birimi bilinmiyor. V1 ortak sözleşmesinde ayrı akış descriptor'ı, ham depth payload'ı ve asenkron analiz yaşam döngüsü yoktur.

## Sonraki somut adım

Murathan gerçek input/factory ve ayrı analiz eylemini bağlamalı; Derviş gerçek dosya seçimi, seçili akış/kapsam, kaynak/API indeksleri ve rapor görünümünü tüketmelidir. Küçük örnekte önce RGB, sonra bağımsız depth oturumu ile aç/kapat/hızlı arama/hata/iptal/indirme akışı doğrulanmalıdır. Ayrıntılı kabul sırası [MURATHAN-HANDOFF.md](MURATHAN-HANDOFF.md) içindedir.
