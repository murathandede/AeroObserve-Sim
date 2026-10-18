# AEROOBSERVE — ORTAK PROJE BAĞLAMI VE ARAŞTIRMA ÇERÇEVESİ

Bu belge, dört kişilik ekibin ve geliştirme asistanlarının projeyi ortak biçimde anlaması için hazırlanmıştır. Bir kişiye ait görev listesi değildir. Projenin fikrini, mevcut aşamasını, yazılım yapısını, araştırma sorularını ve başarı ölçütlerini açıklar.

Belgeyi okuduktan sonra proje bağlamını koru. Kişisel görev promptu verilmeden bütün ekibin işlerini üstlenme. Bir özellik önerirken bunun mevcut araştırma aşamasına mı, gelecekteki bir hipoteze mi ait olduğunu açıkça belirt.

## 1. PROJENİN ÇIKIŞ NOKTASI

Projenin ilk fikri, farklı özelliklere sahip sensörlerin aynı ortamı birlikte gözlemlemesinden doğmuştur.

Bir sensör, ortam hakkında her şeyi aynı kalitede anlatmaz. Bir görüntü kaydı görsel ayrıntı sağlayabilir; başka bir sensör farklı türde ölçümler sunabilir. Ancak farklı sensörler kullanmak tek başına daha güvenilir bir sistem oluşturmaz.

Sensörlerin:
- Aynı ortamı gözlemleyip gözlemlemediği,
- Verilerinin hangi zamanlara ait olduğu,
- Hangi birimleri kullandığı,
- Ölçüm sınırları,
- Eksik veya bozuk kayıtları,
- Birbirleriyle ilişkisinin belgelenip belgelenmediği
bilinmeden anlamlı bir ortak değerlendirme yapılamaz.

Başlangıçtaki uzun vadeli fikir radar ve termal gözlemlerin birlikte değerlendirilmesiydi. Mevcut proje, bu fikrin sahada çalıştığını varsaymaz. Önce gerçek kayıtları doğru okuyabilen, inceleyebilen ve sınırlamalarını görünür kılan bir araştırma altyapısı geliştirir.

Bu aşama bir hedefleme sistemi değildir. Hedef kilitleme, önleme, atış koordinatı üretimi veya silah entegrasyonu içermez.

## 2. MEVCUT PROJE NEYİ GELİŞTİRİYOR?

AeroObserve, gerçek sensör kayıtlarını yerel olarak açan, içeriklerini görselleştiren, kayıt boyunca gezinmeyi sağlayan ve veri kalitesini raporlayan bir araştırma uygulamasıdır.

Kullanıcı:
1. Belgelenmiş bir veri kaynağı seçer.
2. İlgili kaydı uygulamaya yükler.
3. Kaydın içeriğini ve metadata bilgisini görür.
4. Kaydı oynatır, durdurur ve kareler arasında ilerler.
5. Zaman damgalarını ve kayıt boşluklarını inceler.
6. Veri kalitesi sorunlarını görür.
7. İncelemenin sonuçlarını dışa aktarır.

Birden fazla akış varsa uygulama bunları yalnızca kaynak belgelerinin desteklediği ilişki düzeyinde sunar.

Aynı anda iki panel göstermek, sensör füzyonu yapmak anlamına gelmez. Eşzamanlı oynatma da tek başına fiziksel eşleşme veya kalibrasyon anlamına gelmez.

## 3. KİMİN İÇİN GELİŞTİRİLİYOR?

İlk kullanıcılar:
- Proje ekibi,
- Akademik danışman,
- Sensör kayıtlarıyla çalışan araştırmacılar,
- Projenin teknik yaklaşımını inceleyen değerlendiricilerdir.

Uygulama, kullanıcının şu sorularına cevap vermelidir:
- Bu kayıt nereden geliyor?
- Dosyada gerçekte hangi bilgiler var?
- Zaman bilgisi özgün mü, sonradan mı türetildi?
- Veri boyunca boşluk veya bozulma var mı?
- Gösterilen değer hangi birime sahip?
- Başka bir akışla ilişkisi belgelenmiş mi?
- Bu kayıttan hangi sonuçlar çıkarılabilir?
- Hangi sonuçlar çıkarılamaz?

## 4. PROJENİN TEMEL PROBLEMİ

Sensör araştırmalarında yalnızca bir modeli çalıştırmak yeterli değildir. Modelden önce verinin anlaşılması gerekir.

Örneğin:
- Dosya adındaki sayı gerçek zaman damgası olmayabilir.
- Video oynatma hızı gerçek kayıt hızını temsil etmeyebilir.
- Renklendirilmiş bir termal görüntü, sıcaklık ölçümü içermeyebilir.
- Eksik kare, kesinti veya düzensiz örnekleme birbirinden farklı durumlardır.
- İki sensörün saatleri farklı başlangıç noktalarına sahip olabilir.
- Bir veri setinin makalesine erişmek, dosyalarını kullanma veya dağıtma izni vermez.

AeroObserve bu belirsizlikleri gizlemek yerine görünür kılar.

## 5. PROJENİN TEMEL İLKELERİ

### 5.1. Gerçek veri ile örnek veri ayrımı

Gerçek kayıt, gerçek dosyadan okunmalıdır.

Sentetik örnekler geliştirme ve kontrol amacıyla kullanılabilir; ancak:
- Açıkça etiketlenir.
- Gerçek kayıtlarla karıştırılmaz.
- Gerçek sensör performansını temsil ettiği söylenmez.

### 5.2. Kaynak izlenebilirliği

Her gerçek veri kaynağının:
- Resmî bağlantısı,
- Başlığı,
- Sürümü veya erişim tarihi,
- Lisansı,
- Atıf bilgisi,
- Dosya listesi,
- Varsa doğrulama özeti
belgelenir.

### 5.3. Bilinmeyeni bilinmeyen olarak gösterme

Metadata bulunmuyorsa alan boş veya “bilinmiyor” gösterilir.

Arayüzü dolu göstermek için:
- Sıcaklık,
- Örnekleme hızı,
- Zaman damgası,
- Algılama doğruluğu,
- Kayıp kare sayısı
uydurulmaz.

### 5.4. Tekrar üretilebilirlik

Başka bir ekip üyesi aynı veri ve yapılandırmayla aynı incelemeyi yapabilmelidir.

### 5.5. Ölçülebilir sonuç

Güzel görünen bir panel tek başına başarı değildir. Gösterilen değerlerin dosyadan nasıl çıkarıldığı veya nasıl hesaplandığı açıklanabilmelidir.

## 6. VERİ KAYNAĞI SEÇİMİ

İlk sürüm, küçük ve belgeli bir gerçek kayıtla başlamalıdır.

Tercihler:
- Sivil veya akademik kullanım.
- Açık kullanım koşulları.
- Erişilebilir dosyalar.
- Açıklanmış veri biçimi.
- Yönetilebilir örnek boyutu.
- Mümkünse özgün zaman damgaları.

İlk veri kaynağının mutlaka radar ve termal içermesi gerekmez. Uygun ortak kayıt bulunamazsa tek bir gerçek akışla sağlam bir başlangıç yapılır.

Birden fazla akış için ayrıca şu bilgiler araştırılır:
- Aynı kayıt oturumuna mı aitler?
- Ortak zaman tabanı var mı?
- Saat farkı belgelenmiş mi?
- Kare eşlemesi verilmiş mi?
- Kalibrasyon dosyası mevcut mu?
- Kaynak bu ilişkiyi hangi ölçüde doğruluyor?

Bu bilgiler yoksa uygulama varsayımsal ilişki üretmez.

## 7. KULLANICI DENEYİMİ

### 7.1. Başlangıç ekranı

Kullanıcı:
- Projenin kısa açıklamasını,
- Desteklenen veri biçimlerini,
- Örnek kayıt edinme talimatını,
- Yerel kayıt açma seçeneğini
görür.

### 7.2. Kayıt açma

Uygulama manifesti ve dosyaları kontrol eder.

Eksik dosya veya desteklenmeyen biçim varsa:
- Sorunu açıklar.
- İlgili dosyayı belirtir.
- Kullanıcının yapabileceği düzeltmeyi gösterir.
- Sessizce örnek veriye geçmez.

### 7.3. İnceleme ekranı

Ana bölümler:
- Kayıt görüntüleme alanı.
- Oynatma kontrolleri.
- Zaman çizelgesi veya kare indeksi.
- Metadata paneli.
- Veri kalitesi paneli.
- Kaynak ve lisans paneli.

### 7.4. Rapor

Kullanıcı inceleme sonunda:
- Kayıt kimliğini,
- Kullanılan okuyucu sürümünü,
- Hesaplanan özetleri,
- Veri sorunlarını,
- Kullanılan varsayımları,
- Bilinen sınırlamaları
içeren rapor indirebilir.

## 8. YAZILIM MİMARİSİ

Mevcut React + TypeScript + Vite yapısı mümkün olduğunca korunur.

Uygulama şu sorumluluklara ayrılır:

### 8.1. Veri kataloğu ve manifest

Veri kaynaklarını ve kayıtların yapısını tanımlar.

### 8.2. Okuyucu katmanı

Dosyaların gerçek biçimini çözer ve ortak uygulama biçimine dönüştürür.

Dosya okuma ile arayüz çizimi birbirine karıştırılmaz.

### 8.3. Kalite analizi

Kayıtların yapısal ve zamansal özelliklerini inceler.

Bu katman, dosyanın gerçekten içerdiği bilgilerle sınırlıdır.

### 8.4. Oynatma denetleyicisi

Tek uygulama saati üzerinden:
- Oynatma,
- Duraklatma,
- Kare ilerletme,
- Arama,
- Hız değiştirme
işlemlerini yönetir.

Her panel kendi bağımsız oynatma saatini oluşturmaz.

### 8.5. Görselleştirme

Gerçek içeriği uygun biçimde gösterir:
- Görüntü,
- Video,
- Sayısal seri,
- Metadata,
- Veri kalitesi grafikleri.

### 8.6. Raporlama

Sonuçları açık bir JSON yapısında dışa aktarır.

## 9. ÖNERİLEN KLASÖR YAPISI

Mevcut repo farklıysa gereksiz büyük taşıma yapılmadan uyarlanır.

src/
  app/
  data/
    readers/
    manifests/
  playback/
  quality/
  ui/
  shared/
  demo/

data/
  manifests/

docs/
  team/
  datasets.md
  data-contract.md
  readers.md
  architecture.md
  limitations.md

tests/

README.md

Büyük ham kayıtlar Git deposuna eklenmez. Veri edinme ve yerleştirme süreci belgelenir.

## 10. ORTAK VERİ SÖZLEŞMESİ

### DatasetManifest

Şunları içerir:
- Veri seti kimliği.
- Başlık.
- Kaynak bağlantısı.
- Lisans açıklaması.
- Atıf.
- Sürüm bilgisi.
- Kayıt listesi.

### Recording

Şunları içerir:
- Kayıt kimliği.
- Açıklama.
- Akış listesi.
- Varsa belgelenmiş akış ilişkileri.

### StreamDescriptor

Şunları içerir:
- Akış kimliği.
- Veri türü.
- Dosya biçimi.
- Birimler.
- Zaman tabanı.
- Zaman bilgisinin kaynağı.
- Varsa belgelenmiş örnekleme bilgisi.

### FrameRecord

Şunları içerir:
- Akış kimliği.
- Kare indeksi.
- Varsa özgün zaman damgası.
- Varsa türetilmiş zaman ve türetme yöntemi.
- İçerik referansı.

### QualityIssue

Şunları içerir:
- Sorun türü.
- Önem seviyesi.
- İlgili kayıt veya kare.
- Açıklama.
- Sorunun hangi kurala göre belirlendiği.

Ortak sözleşme sürümlenir ve değişikliklerin ekip üzerindeki etkisi değerlendirilir.

## 11. VERİ KALİTESİ İNCELEMESİ

Uygulama uygun verilerde şu konuları inceleyebilir:
- Dosya okunabilirliği.
- Beklenen alanların bulunması.
- Geçersiz sayısal değerler.
- Tekrarlanan zaman damgaları.
- Sırası bozuk zaman damgaları.
- Kareler arasındaki zaman aralıkları.
- Belgelenmiş örnekleme düzenine göre olası boşluklar.
- Boyut veya içerik tutarsızlıkları.

Dikkat:
- Büyük zaman aralığı her durumda kayıp kare kanıtı değildir.
- Hatalı veya eksik kayıt ile sensörün normal davranışı ayırt edilmelidir.
- Zaman farkı, farklı zaman tabanları arasında doğrudan hesaplanmamalıdır.
- Verinin izin vermediği bir analiz “desteklenmiyor” olarak gösterilmelidir.

## 12. GÖRSEL TASARIM

Arayüz araştırma ve inceleme amacı taşımalıdır.

Tasarım ilkeleri:
- Görüntü veya veri ana odak olmalı.
- Kaynak bilgileri kolay bulunmalı.
- Ölçüm birimleri görünür olmalı.
- Bilinmeyen bilgiler açıkça belirtilmeli.
- Hata mesajları anlaşılır olmalı.
- Renk tek başına anlam taşımamalı.
- Klavye kullanımı desteklenmeli.

Termal içerik için:
- Radiometrik veri varsa yalnızca kaynak belgelerinin desteklediği ölçümler gösterilir.
- Renklendirilmiş görüntü varsa renkler gerçek sıcaklık gibi yorumlanmaz.
- Yapılan görüntü dönüşümleri açıklanır.

## 13. EKİP YAPISI

### Murathan — Sistem bütünleştirme

Sorumlulukları:
- Ortak mimari.
- Veri sözleşmesi.
- Modüllerin bağlanması.
- Uçtan uca çalıştırma.
- Ana dokümantasyon.
- Sonuçların ve sınırlamaların tutarlı sunulması.

### Ahmet — Veri araştırması

Sorumlulukları:
- Gerçek kaynak bulma.
- Lisans doğrulama.
- Veri yapısını belgeleme.
- Örnek kayıt hazırlama.
- Manifest ve kaynak kataloğu.

### Efe — Okuyucu ve kalite analizi

Sorumlulukları:
- Dosya okuyucuları.
- Metadata çıkarımı.
- Zaman bilgisi işleme.
- Veri kalite raporu.
- Okuyucu kontrolleri.

### Derviş — Arayüz ve oynatıcı

Sorumlulukları:
- Kayıt seçim ekranı.
- Görselleştirme.
- Oynatma kontrolleri.
- Metadata ve kalite panelleri.
- Kullanılabilirlik.

Her kişi kendi modülünü açıklayabilmeli ve küçük bir kullanım örneğiyle gösterebilmelidir.

## 14. GELİŞTİRME AŞAMALARI

### Aşama 1 — Mevcut kodun incelenmesi

Mevcut bileşenler belirlenir. Çalışan parçalar korunur. Sentetik örnekler ayrı konuma alınır.

### Aşama 2 — Gerçek veri seçimi

Bir kaynak, kullanım koşulları ve küçük örnek doğrulanır.

### Aşama 3 — Okuyucu

Gerçek örnek uygulama tarafından okunur. Özgün metadata korunur.

### Aşama 4 — Oynatıcı

Kayıt açılır, oynatılır, durdurulur ve incelenir.

### Aşama 5 — Kalite raporu

Dosyadan hesaplanan sonuçlar arayüzde gösterilir ve dışa aktarılır.

### Aşama 6 — Sunuma hazırlık

Başka bir bilgisayarda kurulum doğrulanır. Gerçek demo kaydı alınır. README tamamlanır.

## 15. İLK SÜRÜMÜN TAMAMLANMA ÖLÇÜTLERİ

İlk sürüm tamamlandı sayılmak için:
1. En az bir gerçek veri kaynağı belgelenmiş olmalı.
2. Lisans ve kaynak bilgileri görünür olmalı.
3. Küçük gerçek kayıt uygulamada açılmalı.
4. Oynatma ve kayıt inceleme çalışmalı.
5. Özgün ve türetilmiş metadata ayrılmalı.
6. Uygun veri kalite incelemeleri çalışmalı.
7. Rapor indirilebilmeli.
8. Desteklenmeyen dosya anlaşılır hata vermeli.
9. Kurulum başka bir ekip üyesi tarafından uygulanabilmeli.
10. Build, typecheck ve ilgili anlamlı kontroller geçmeli.

## 16. BU SÜRÜM NEYİ KANITLAR?

Doğru tamamlandığında:
- Gerçek kayıtların yazılım tarafından okunabildiğini,
- Veri yapısının ekip tarafından anlaşıldığını,
- Oynatma ve inceleme altyapısının çalıştığını,
- Veri sorunlarının görünür kılındığını,
- Sonuçların tekrar üretilebildiğini
gösterir.

## 17. BU SÜRÜM NEYİ KANITLAMAZ?

Şunları kanıtlamaz:
- Gerçek saha algılama menzili.
- Drone veya kuş ayrımı.
- Radar–termal füzyonunun doğruluğu.
- Karıştırmaya dayanıklılık.
- Donanım gecikmesi.
- Çevresel dayanıklılık.
- Ürün maliyeti.
- Ticari talep.
- Nihai ürünün çalışabilirliği.

Bu konular gelecekte ayrı veri, donanım, deney ve değerlendirme gerektirir.

## 18. BAŞVURUDA NASIL ANLATILACAK?

Proje mevcut aşamasına uygun anlatılmalıdır:

“Ekip olarak gerçek sensör kayıtlarını okuyabilen, kayıtların zaman ve veri kalitesi özelliklerini inceleyen, görselleştiren ve tekrar üretilebilir raporlar oluşturan bir araştırma altyapısı geliştirdik. Bu altyapı, gelecekteki sensör araştırmalarında hangi varsayımların veriyle desteklendiğini değerlendirmek için başlangıç oluşturuyor.”

Henüz yapılmamış bir deney tamamlanmış gibi yazılmaz. Simülasyon, kayıt oynatma ve gerçek donanım deneyi birbirinden ayrılır.

## 19. GELİŞTİRME ASİSTANININ ÇALIŞMA KURALLARI

- Önce mevcut repoyu incele.
- Kullanıcının çalışmasını koru.
- Kişisel görev kapsamına uy.
- Ortak sözleşmeyi tek taraflı değiştirme.
- Uydurma veriyle gerçek başarı iddiası oluşturma.
- Kaynak veya lisans belirsizliğini gizleme.
- Bir özelliği uyguladıysan uygun şekilde doğrula.
- Yapamadığın doğrulamayı açıkça belirt.
- Gereksiz bağımlılık ekleme.
- Büyük veri dosyalarını Git’e koyma.
- Açık talimat olmadan push veya merge yapma.
- Çalışmanın sonunda yapılanları, kontrol sonuçlarını ve kalan işleri açıkça raporla.

TEMEL HEDEF
Etkileyici görünen bir ekranın ötesine geçerek, verisinin kaynağını ve sınırlarını açıklayabildiğimiz, gerçek kayıtlarla çalışan ve başka bir kişinin tekrar çalıştırabildiği bir araştırma uygulaması oluşturmak.