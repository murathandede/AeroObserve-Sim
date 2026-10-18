# TUM RGB-D okuyucusu

Tam API, gerçek dosya edinme, kapsam ve kullanım belgeleri:
[docs/readers.md](../../../docs/readers.md).
Derviş ve Murathan için teslim notları: [HANDOFF.md](HANDOFF.md).
Detaylı [Derviş kılavuzu](DERVIS-HANDOFF.md),
[Murathan raporu](MURATHAN-HANDOFF.md) ve [proje durumu](PROJECT-STATUS.md).

`src/data/index.ts`, v1 `RecordingReader` ile uyumlu `TumRecordingReader`,
TXT ayrıştırıcıları, özgün/türetilmiş metadata yardımcıları ve açık sayısal
16-bit derinlik çözümleyicisini dışa aktarır. `src/quality/index.ts` kalite
analizi ve sürümlü, tekrar üretilebilir JSON rapor API'sidir.

Her okuyucu `stream: 'rgb' | 'depth'` ve açık `mode: 'manifest-subset' |
'full-recording'` seçimi ister. Küçük örnekte her akış üç görüntü sunar;
613 RGB ve 595 depth kaynak liste kaydı kapsam dışında kalan PNG'leri
bozuk veya kayıp sensör karesi yapmaz. Kaynak indeksleri, fiziksel satır,
özgün zaman tokeni ve API indeksi ayrı korunur. Akışlar eşleştirilmez.

Görüntüler tembel doğrulanır; `getFrame` özgün Blob için önizleme URL'si
verir. URL, `close` veya yeni `open` çağrısına kadar geçerlidir.
`decodeTumDepth` ayrıca PNG filtrelerini açıp ham Uint16 değerleri üretir;
`tumDepthToMetres` belgelenmiş ham/5000 dönüşümünü uygular, sıfır için null
verir. Önizlemeden sayısal derinlik çıkarılmaz; sıcaklık üretilmez.

Groundtruth zamanının belgeli referansı diğer akışlara taşınmaz. RGB/depth
zaman tokenleri korunur; doğrulanmamış birim nedeniyle v1 FrameTime unknown
kalır. Tam liste zaman istatistiklerinin birimi ayrıca belirtilir.

Gerçek 10 dosya yerelde edinildikten sonra, depo kökünde:

```sh
./node_modules/.bin/tsx src/data/examples/tum-local.ts \
  data/local/tum-rgbd-freiburg1-desk reports/tum-quality.json
```

Örnek gerçek Blob girdisi → open → metadata → frame → kalite → JSON → close
zincirini çalıştırır. Dosyalar yoksa açık hata verir, sentetik kayıt açmaz.
`npm run example:reader` ise mevcut **sentetik sözleşme örneğidir**.

Testlerde kontrollü yapay girdiler açıkça etiketlidir; gerçek dosya testleri
veri yoksa gerekçeyle atlanır. Gerçek örnek doğrulaması ve bu ayrım ayrıntılı
olarak ana okuyucu belgesinde açıklanır.
