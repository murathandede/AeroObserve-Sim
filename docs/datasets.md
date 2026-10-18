# Gerçek veri kaynakları kataloğu — Ahmet

**Tarih:** 18 Ekim 2026. **Doğrulandı (kaynak)** bağlantılı birincil yayımlayıcı/depo bilgisini, **Doğrulandı (yerel)** özgün dosya gözlemini, **Doğrulanamadı / bilinmiyor** ise kanıt eksikliğini gösterir. Yerel kanıt ve inceleme sınırı aşağıdaki **Yerel doğrulama kapsamı** bölümündedir. Tüm çevrim içi bağlantılara 18 Ekim 2026'da erişildi.

## Adaylar ve seçim

| Aday | Kanıtlı özellik | İlk kaynak kararı |
| --- | --- | --- |
| TUM RGB-D `freiburg1_desk` | **Doğrulandı (kaynak ve yerel):** [TUM](https://cvg.cit.tum.de/data/datasets/rgbd-dataset), [indirme](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/download), [biçimler](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats): gerçek Kinect RGB/derinlik, CC BY 4.0, zaman damgalı PNG/TXT, yaklaşık 0,32 GB TGZ. | **Kullanıcı seçti.** Gerçek kayıt, açık biçim ve görece küçük arşiv, kayıt incelemesi için uygun. Termal veya radar değildir. |
| Crop canopy termal | **Doğrulandı (kaynak):** [Zenodo](https://zenodo.org/records/10600200), [yayımlayıcı README'si](https://zenodo.org/records/10600200/preview/README.txt?include_deleted=0): gerçek sıcaklık dizileri, CC BY 4.0, yaklaşık 1,3 GB ZIP. | `.fff` iç radyometri ve tekil özgün zamanlar **doğrulanamadı**; yerel indirme yapılmadı. |
| ToF-RGB Fusion | **Doğrulandı (kaynak):** [Zenodo](https://zenodo.org/records/8205692): RGB/ToF, CC BY 4.0, yaklaşık 1,2 GB ZIP; kameralar eşzamanlı değil. | Yaklaşık kare numarası gerçek zaman damgası değil; özgün kare zamanları **doğrulanamadı**. Yerel indirme yapılmadı. |

Diğer iki aday yerel olarak indirilmedi; tablo, ilk kaynak kararı için doğrulanmış temel farkları gösterir. TUM seçimi radar–termal füzyonunu veya hedef tespiti başarısını doğrulamaz.

## Seçilen kaynağın kimliği, lisansı, atfı

- **Doğrulandı (kaynak):** Resmî koleksiyon **RGB-D SLAM Dataset and Benchmark**, yayımlayıcı **Technical University of Munich Computer Vision Group**; `freiburg1_desk` dört masa çevresinde ofis kaydıdır. [TUM ana sayfa](https://cvg.cit.tum.de/data/datasets/rgbd-dataset), [kayıt](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/download), erişim 18 Ekim 2026. Ayrı veri seti sürümü belirtilmedi; manifest erişim tarihini taşır.
- **Doğrulandı (kaynak):** TUM, aksi belirtilmedikçe veriyi **CC BY 4.0** ile lisanslar. [TUM lisans bölümü](https://cvg.cit.tum.de/data/datasets/rgbd-dataset#license), [CC BY 4.0 yasal metin](https://creativecommons.org/licenses/by/4.0/legalcode), [özet](https://creativecommons.org/licenses/by/4.0/), erişim 18 Ekim 2026. Yeniden dağıtım/uyarlama için uygun atıf, lisans bağlantısı ve değişikliklerin belirtilmesi gerekir. Seçilen dosyaların içeriği değiştirilmedi, yalnızca alt küme alındı. Eşlik eden kodun BSD-2-Clause lisansı veri lisansı değildir.
- **Doğrulandı (kaynak):** TUM kullanımda şu yayına atıf ister: **J. Sturm, N. Engelhard, F. Endres, W. Burgard, D. Cremers, “A Benchmark for the Evaluation of RGB-D SLAM Systems,” IROS, 2012.** [TUM atıf kaydı](https://cvg.cit.tum.de/data/datasets/rgbd-dataset), [makale](https://cvg.cit.tum.de/_media/spezial/bib/sturm12iros.pdf), erişim 18 Ekim 2026.

## Dosya listesi, yerleşim ve SHA-256

**Doğrulandı (kaynak ve yerel):** [TUM biçim belgesi](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats) TGZ içinde 640×480, 8 bit RGB PNG; 640×480, 16 bit gri derinlik PNG ve zaman damgalı TXT dosyalarını tanımlar. Yerel arşiv 344.011.403 bayt; `tar -tzf` ile 613 RGB PNG, 595 derinlik PNG, dört TXT ve üç dizin girdisi sayıldı. Bu, bütün PNG'lerin piksel bütünlüğü kanıtı değildir; doğrulama yöntemi aşağıdadır.

- **Doğrulandı (yerel):** Arşiv repository dışında: `C:\Users\Ahmet\Desktop\havelsan suits\AeroObserve-data-local\freiburg1_desk\rgbd_dataset_freiburg1_desk.tgz`.
- **Doğrulandı (yerel):** Faz 3 küçük örneği repository dışında: `C:\Users\Ahmet\Desktop\havelsan suits\AeroObserve-data-local\freiburg1_desk\selected-originals\rgbd_dataset_freiburg1_desk\`.
- **Doğrulandı (yerel):** Ekip örneği `data/local/tum-rgbd-freiburg1-desk/rgbd_dataset_freiburg1_desk/` içine yerleştirildi; 10 dosya, 2.480.192 bayt. Dört TXT **tam kayıt listeleridir**; küçük örnek bu listelerdeki PNG'lerin çoğunu içermez. Metinler değiştirilmedi. `data/local/` [`.gitignore`](../.gitignore) kapsamındadır.
- **Doğrulandı (sözleşme):** [v1 manifest](../data/manifests/tum-rgbd-freiburg1-desk.json) `acquisition.files` içinde bu 10 göreli yolu listeler. Manifest gerçek okuyucunun mevcut olduğunu veya tüm listenin yerelde bulunduğunu iddia etmez. [AGENTS.md](../AGENTS.md) hâlen gerçek okuyucu olmadığını belirtir.

### SHA-256 envanteri

**Doğrulandı (yerel):** Aşağıdaki SHA-256 değerleri 18 Ekim 2026'da arşiv, Faz 3 özgün örneği ve `data/local/` kopyası üzerinde yeniden hesaplandı; 10 dosyanın hash'leri kopyalar arasında aynı çıktı. Yolların kökü `data/local/tum-rgbd-freiburg1-desk/`; TGZ repository dışındadır. **Doğrulanamadı:** Resmî TUM sağlama değeri bulunmadı; bunlar yerel referans değerleridir.

| Dosya | Bayt | SHA-256 |
| --- | ---: | --- |
| `rgbd_dataset_freiburg1_desk.tgz` (repo dışında) | 344.011.403 | `E983D6830916E66DC4A46A71368046B149B283DE87769690E7AA4E0B9483530C` |
| `rgbd_dataset_freiburg1_desk/accelerometer.txt` | 547.726 | `016A4C6C93A172AE85624A24E0C102030372852928C9EBC11BF535AD02478EDD` |
| `rgbd_dataset_freiburg1_desk/depth.txt` | 27.446 | `E56F037046113192151ABEBDED5513709D03A57B46624B8343EB4EFD4419F14C` |
| `rgbd_dataset_freiburg1_desk/depth/1305031453.374112.png` | 118.122 | `A9097EA8F9ADBE8EE0B950AC2C9C8F5AD4FFEC57C5D0665BC672D68F69EE0E4C` |
| `rgbd_dataset_freiburg1_desk/depth/1305031463.278737.png` | 108.371 | `278D72F69A25AF84F5F0F45F311FAC79A4B6AA182DCB2E68AB5BA5DB6AA40836` |
| `rgbd_dataset_freiburg1_desk/depth/1305031473.190828.png` | 114.832 | `4C6910653A7F75D78919D674BF6361497BEEE86CDA52AAD43D7F19D394AF0FC1` |
| `rgbd_dataset_freiburg1_desk/groundtruth.txt` | 158.143 | `48C4FA61F5D78310EA579F404D31D296738C4210C19C2BDAC4A5CDF6BFF50831` |
| `rgbd_dataset_freiburg1_desk/rgb.txt` | 27.050 | `D1BC510ECCA08540E03BE8DF55AF8857753B614D8A5C38526BC669CE6C802284` |
| `rgbd_dataset_freiburg1_desk/rgb/1305031452.791720.png` | 448.723 | `5DBDD530CD1165FC5CDD875613F87666C67DF84645A585DD1745CB18E5982533` |
| `rgbd_dataset_freiburg1_desk/rgb/1305031462.995550.png` | 400.679 | `143D1CDE4B40B937149CE0ED07468367208394204D9AFAFE9852D65A79E7652A` |
| `rgbd_dataset_freiburg1_desk/rgb/1305031473.196069.png` | 529.100 | `E9FAEDB3341FC9DE2BD9EC1AB70CF84DBE493CDE13E603BDC76E03B88671F1CE` |

### Yerel doğrulama kapsamı

**Doğrulandı (yerel, 18 Ekim 2026):** Resmî indirme bağlantısının yönlendirdiği sunucudan alınan arşivin HTTP içerik uzunluğu ile yerel boyutu **344.011.403 bayt** olarak eşleşti. `tar -tzf` arşiv üyelerini hatasız listeledi; tür/sayı envanteri yukarıdadır. Yorum ve boş satırlar çıkarılarak dört özgün TXT dosyasının veri satırları sayıldı; aşağıdaki metadata tablosundaki sayılar ve ilk–son damga farkları bu satırlardan hesaplandı. Seçilen altı PNG'nin imzası ve `IHDR` çözünürlük/bit derinliği/renk tipi alanları okundu; piksel verisi veya tüm arşivdeki PNG'ler çözülmedi. `Get-FileHash -Algorithm SHA256` ile arşiv ve seçilmiş 10 dosya ölçüldü; repository dışındaki özgün örnek ile `data/local/` kopyası **10/10** eşleşti. Resmî yayımlayıcı hash'i bulunmadığından yerel SHA-256 değerleri resmî sağlama doğrulaması değildir.

## Gözlenen metadata ve yorumlama sınırları

| Konu | Kaynak kanıtı | Yerel gözlem / doğrulama durumu |
| --- | --- | --- |
| Görüntü | [TUM biçimleri](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats): RGB 640×480 8 bit, derinlik 640×480 16 bit gri PNG. | **Doğrulandı (yerel):** Seçilen altı PNG'nin IHDR alanı uyumlu; piksel kalitesi incelenmedi. |
| Derinlik birimi | [TUM biçimleri](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats): piksel/5000 metre, `0` ölçüm yok. | **Doğrulandı (kaynak):** Derinlik sıcaklık/radyometri değildir. Gerçek piksel dağılımı **incelenmedi**. |
| Zaman listeleri | [Makale §V](https://cvg.cit.tum.de/_media/spezial/bib/sturm12iros.pdf): `timestamp filename`. | **Doğrulandı (yerel):** `rgb.txt` 613, `depth.txt` 595 veri satırı. İlk–son farkı RGB **20,404349 s**, derinlik **19,816716 s**. |
| Oturum ve nominal hız | [TUM indirme](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/download): 23,40 s; [makale](https://cvg.cit.tum.de/_media/spezial/bib/sturm12iros.pdf): RGB/derinlik 30 Hz, hareket yakalama 100 Hz, ivmeölçer 500 Hz. | **Doğrulandı (yerel):** `groundtruth.txt` 2.335 satır / 23,3995 s; `accelerometer.txt` 11.815 satır / 23,656109 s. Farklı kapsama pencereleri kayıp kare kanıtı değildir. |
| Referans yörünge | [TUM biçimleri](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats): `timestamp tx ty tz qx qy qz qw`; Unix epoch saniyesi. [Makale §VI-D](https://cvg.cit.tum.de/_media/spezial/bib/sturm12iros.pdf): yaklaşık 20 ms referans zaman düzeltmesi uygulanmış. | **Doğrulandı (yerel):** Sütun düzeni gözlendi. Referans damgası düzeltilmiş veridir; ham cihaz zamanı diye sunulmaz. |
| İvmeölçer | [TUM](https://cvg.cit.tum.de/data/datasets/rgbd-dataset): gerçek Kinect ivmeölçeri. | **Doğrulandı (yerel):** `accelerometer.txt`, `timestamp ax ay az`. Birim **bilinmiyor**. Makale `imu.txt` der; arşivdeki ad farklıdır. |

- **Doğrulandı (kaynak):** [TUM biçimleri](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats) RGB ve derinliği OpenNI ile **uzamsal** olarak kaydedilmiş tanımlar. [Makale §VI-D](https://cvg.cit.tum.de/_media/spezial/bib/sturm12iros.pdf) RGB/derinlik mesaj damgalarının değiştirilmediğini, derinliğin ortalama yaklaşık 20 ms sonra geldiğini açıklar. Bu ortalama, tekil kare ofseti değildir; kare eşlemesi oluşturulmadı.
- **Doğrulandı (yerel):** İlk RGB damgası `1305031452.791720`, ilk derinlik damgası `1305031453.374112` (fark **0,582392 s**); ilk satırlar çift sayılamaz. RGB/depth damgalarının kesin fiziksel cihaz/pozlama saati ve ayrı açık Unix epoch garantisi **doğrulanamadı**. Dosya adı, satır zamanı veya nominal 30 Hz tek başına cihaz saati kanıtı değildir.
- **Doğrulanamadı / bilinmiyor:** İvmeölçer birimi, bozuk/eksik kare sayısı, tüm PNG'lerin piksel bütünlüğü, tekil kare eşlemesi ve resmî sağlama değeri. [TUM biçimleri](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats), [makale](https://cvg.cit.tum.de/_media/spezial/bib/sturm12iros.pdf); yerel inceleme kapsamı yukarıdadır.
- **Doğrulandı (sözleşme):** [`src/shared/types.ts`](../src/shared/types.ts) v1'de `DatasetManifest` vardır; ayrı `Recording` ve `StreamDescriptor` yoktur. `recording` tek `RecordingInfo`; `format`/`timing`/`radiometry` manifest düzeyindedir. [Sözleşme](data-contract.md). Karma 10 dosya için tek ortak zaman türü kanıtlanamadığından manifestte `timing.kind: "unknown"`, `timeBase: null`, `nominalFps: unknown` kullanıldı. TXT kaynak damgaları vardır; **türetilmiş kare zamanı üretilmedi**.
- **Bu veriden çıkarılamaz:** Termal sıcaklık, radar ölçümü, radar–termal füzyon başarısı, hedef tespiti başarısı, tüm karelerin eksiksizliği veya RGB–derinliğin sıra numarasıyla eşzamanlılığı. [TUM veri/biçim tanımı](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats), [makale §VI-D](https://cvg.cit.tum.de/_media/spezial/bib/sturm12iros.pdf); yerel inceleme kapsamı yukarıdadır.

## Sıfırdan edinme ve yerleştirme (PowerShell)

**Doğrulandı (kaynak):** [TUM resmî `freiburg1_desk` indirme satırı](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/download), erişim 18 Ekim 2026. Komutları repository kökünde PowerShell ile çalıştırın. Arşiv repo dışında, 10 gerçek örnek dosyası ignore edilen `data/local/` altında tutulur. Paylaşımda yukarıdaki CC BY 4.0 bağlantısını ve IROS 2012 atfını koruyun.

```powershell
$repoRoot = (Get-Location).Path
$archiveDir = Join-Path (Split-Path $repoRoot -Parent) 'AeroObserve-data-local\freiburg1_desk'
New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
$archive = Join-Path $archiveDir 'rgbd_dataset_freiburg1_desk.tgz'
$url = 'https://cvg.cit.tum.de/rgbd/dataset/freiburg1/rgbd_dataset_freiburg1_desk.tgz'
curl.exe -L --fail --output $archive $url
if ($LASTEXITCODE -ne 0) { throw 'İndirme başarısız' }
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne 'E983D6830916E66DC4A46A71368046B149B283DE87769690E7AA4E0B9483530C') { throw 'Arşiv yerel referans hash ile uyuşmuyor; açmayın' }

$target = Join-Path $repoRoot 'data\local\tum-rgbd-freiburg1-desk'
New-Item -ItemType Directory -Path $target -Force | Out-Null
$members = @(
  'rgbd_dataset_freiburg1_desk/accelerometer.txt',
  'rgbd_dataset_freiburg1_desk/depth.txt',
  'rgbd_dataset_freiburg1_desk/depth/1305031453.374112.png',
  'rgbd_dataset_freiburg1_desk/depth/1305031463.278737.png',
  'rgbd_dataset_freiburg1_desk/depth/1305031473.190828.png',
  'rgbd_dataset_freiburg1_desk/groundtruth.txt',
  'rgbd_dataset_freiburg1_desk/rgb.txt',
  'rgbd_dataset_freiburg1_desk/rgb/1305031452.791720.png',
  'rgbd_dataset_freiburg1_desk/rgb/1305031462.995550.png',
  'rgbd_dataset_freiburg1_desk/rgb/1305031473.196069.png'
)
tar -xzf $archive -C $target @members
if ($LASTEXITCODE -ne 0) { throw 'Örnek açma başarısız' }
$manifest = Get-Content -LiteralPath (Join-Path $repoRoot 'data\manifests\tum-rgbd-freiburg1-desk.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($relative in $manifest.acquisition.files) {
  $file = Join-Path $target $relative
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Eksik örnek dosyası: $relative" }
  $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
  Write-Output "$relative $hash"
}
```

**Doğrulandı (yerel):** Çıktıdaki her hash yukarıdaki envanterle karşılaştırılır. TUM resmî hash yayımlamadığından kontrol yalnızca **18 Ekim 2026 yerel referans arşiviyle** tutarlılığı gösterir. Yeni sürüm/farklı arşiv hash'i çıkarsa içerik uydurulmaz, resmî kaynak yeniden incelenir. Faz 3'te yanlışlıkla açılan tam ek kopya da repository dışındaki `...\freiburg1_desk\sample-originals\` yolunda kalmıştır; otomatik onay incelemesi silmeyi **“blocked by policy”** diyerek reddetti. Temizleme tekrar denenmedi.
