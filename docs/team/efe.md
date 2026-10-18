# Efe — okuyucu ve kalite analizi

- **Değiştirebileceğin dosyalar:** `src/data/`, `src/quality/`, `docs/readers.md`, `tests/reader-*.test.ts`, `tests/quality-*.test.ts`.
- **Dal:** `feat/recording-reader`.
- **Başlama:** `npm ci`, `npm run example:reader`, `npm test`.
- **Ortak tipler:** `RecordingReader`, `RecordingInput`, `RecordingMetadata`, `FrameRecord`, `FrameTime`, `ReaderResult`, `ReaderError`, `QualityReport`.
- **Girdi:** Ahmet'in biçim belgesi, manifesti ve küçük gerçek örneği.
- **Çıktı:** ortak arayüzü uygulayan okuyucu, gerçek metadata, indeksli kareler, yapılandırılmış hatalar ve kanıta dayalı kalite bulguları.

## Küçük kullanım örneği

```ts
import type { RecordingReader } from '../shared/types';
import { SyntheticRecordingReader } from '../demo/recording/reader';
import { exampleInput } from '../demo/recording/example';
import { withFirstFrame } from './readFirstFrame';

const reader: RecordingReader = new SyntheticRecordingReader();
await withFirstFrame(reader, exampleInput, (metadata, frame) => {
  console.log(metadata.frameCount, frame.index, frame.time);
});
```

Bu örneğin çalışan hali `npm run example:reader` komutudur. Gerçek biçim seçilmeden tahmini okuyucu yazma. Yeni okuyucunu kendi dizininde ekle; sentetik fikstürü değiştirme.

## Tamamlanma ölçütleri

open/getMetadata/getFrame/close sözleşmesine uyum; eksik/bozuk/desteklenmeyen dosyada anlaşılır hata; bilinmeyen zamanı koruma; belgelenmemiş sıcaklık üretmeme; indeks sınırları; close ile blob URL ve bekleyen iş temizliği; tekrar açma/kapama testleri. Kalite bulgularında kural ve kapsam açık. `npm run typecheck`, `npm test`, `npm run build` geçer.

## Doğrudan teslim

Ahmet'ten biçim ve küçük örneği doğrudan al. **Derviş'e** okuyucu export yolu, RecordingInput kurulum örneği, kare erişimi, hata/cleanup davranışı ve test komutunu doğrudan gönder. Murathan'a factory ve manifest bağlantısını ilet; UI dosyalarını değiştirmen gerekmez. Ortak tip değişikliğini tüm tüketicilerle koordine et.
