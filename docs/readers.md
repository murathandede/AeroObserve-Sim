# Okuyucu sözleşmesi ve Efe → Derviş teslimi

Sahip: Efe. Gerçek dosya biçimi henüz seçilmedi; bu sürümde tahmini gerçek okuyucu yoktur.

`RecordingReader` arayüzü `src/shared/types.ts` içindedir, `src/data/index.ts` üzerinden de dışa aktarılır.

| İşlem | Girdi | Çıktı |
| --- | --- | --- |
| open | RecordingInput (manifest + göreli dosya adları/Blob'lar) | Promise<ReaderResult<RecordingMetadata>> |
| getMetadata | Yok; open sonrası | ReaderResult<RecordingMetadata> |
| getFrame | Sıfır tabanlı indeks | Promise<ReaderResult<FrameRecord>> |
| getState | Yok | ReaderState |
| close | Yok | Promise<void> |

## Yaşam döngüsü

Yeni okuyucu idle başlar; open sırasında opening, başarıda ready, başarısız açılışta error olur. Başarısız açılış eski metadata'yı taşımaz. Tekrar open mevcut kaydı/kaynakları temizler. getFrame indeks hatası kayıt bütününü kapatmak zorunda değildir; yapılandırılmış hata döndürür. Okuyucuya bağlı görüntü URL'leri close'a kadar geçerlidir.

close tekrarlı çağrılabilir ve kaynakları serbest bırakır. **Devam eden open/getFrame çağrıları close sonrasında okuyucuyu yeniden canlandıramaz**; gerçek okuyucuda AbortController veya oturum sayacı kullanın. React StrictMode kurulumu/temizliği tekrar edebilir. Her createReader yeni bağımsız örnek üretir. getFrame çağrıları hızlı aramada örtüşebilir; okuyucu bunu desteklemeli veya içeride sıraya koymalıdır. UI geç gelen eski sonuçları görmezden gelir. close normal durumda hata fırlatmamalıdır.

Beklenen dosya/biçim/decode hataları ReaderResult üzerinden döner. `error.file` sorunlu dosyayı; recovery kullanıcı eylemini belirtir. Hiçbir hata sessizce sentetik örnek açmaz.

## Çalışan kullanım örneği

```ts
import type { RecordingReader } from '../shared/types';
import { SyntheticRecordingReader } from '../demo/recording/reader';
import { exampleInput } from '../demo/recording/example';
import { withFirstFrame } from './readFirstFrame';

const reader: RecordingReader = new SyntheticRecordingReader();
const result = await withFirstFrame(reader, exampleInput, (metadata, frame) => {
  console.log(metadata.recording.name, frame.index, frame.time);
  // Görüntüyü burada kullan; callback bittikten sonra reader kapanır.
});
if (!result.ok) console.error(result.error.message, result.error.recovery);
```

Çalıştır: `npm run example:reader`. Sürekli UI için `src/playback/useRecording.ts` kaydı açık tutar; kapatmada cleanup yapar.

Gerçek dosya seçildiğinde browser File nesneleriyle `new Map([['frames/frame-0001.ext', file]])` kurulur. Format bilinmeden bu örnekteki .ext için okuyucu yazılmamalıdır. HTML dosya seçim akışı mevcut örnekte yoktur; Derviş/Murathan sonraki entegrasyonda ekler.

## Teslim paketi

Efe doğrudan Derviş'e: okuyucu export yolu, `createReader` örneği, desteklenen biçimler, RecordingInput oluşturma örneği, getFrame/close kullanımı, hata örnekleri ve test komutu gönderir. Ahmet'ten manifest + küçük dosya + biçim belgesini doğrudan alır. Murathan sadece `src/app/recordingBinding.ts` bağlantısını değiştirir; `RecordingWorkbench` okuyucu sınıfına bağımlı değildir.

`analyzeMetadata` yalnızca açık metadata eksiklerini bildirir; kareleri taramaz. Tam kayıt kalite analizi Efe'nin sonraki görevidir; asynchronous rapor gerekirse sözleşme ekipçe genişletilir.
