# Murathan — bütünleştirme ve oynatma

- **Değiştirebileceğin dosyalar:** `src/app/`, `src/playback/`, `src/main.tsx`, `src/demo/`, `tests/recording.test.ts`, README ve bütünleştirme belgeleri.
- **Ortak sahiplik:** `src/shared/types.ts`, package/lockfile ve yapılandırmalar ekip koordinasyonuyla değiştirilir.
- **Başlama:** `npm ci`, `npm run dev`, `npm run example:reader`.
- **Ortak tipler:** `RecordingBinding`, `RecordingReader` ve tüm kayıt sözleşmesi.
- **Girdi:** Ahmet'in manifesti, Efe'nin okuyucu/kalite çıktısı, Derviş'in props tabanlı ekranı.
- **Çıktı:** tek oynatma denetleyicisi ve doğrulanmış uygulama bağlantısı.

## Küçük kullanım örneği

```ts
// src/app/recordingBinding.ts — mevcut çalışan bağlantı
import type { RecordingBinding } from '../shared/types';
import { exampleBinding } from '../demo/recording/example';
export const recordingBinding: RecordingBinding = exampleBinding;
```

Gerçek okuyucu geldiğinde createReader, input ve analyze değerlerini burada bağla. UI gerçek okuyucu import etmez. Yerel dosya seçiminden Blob haritası oluşturma sonraki bütünleştirme işidir. Metadata kalite örneği tüm kayıt analizini temsil etmez.

## Tamamlanma ölçütleri

Tek oynatma saati, geç dönen karelerin elenmesi, close/unmount cleanup, eski simülasyonun korunması; build/typecheck/test; gerçek veri varsa dosya → okuyucu → UI akışının ayrıca doğrulanması; ortak başlangıç SHA'sının ekibe verilmesi.

## Teslim

Ahmet, Efe ve Derviş'e aynı başlangıç SHA'sını ve kendi görev dosyasını ilet. Rutin modül içi kararları onların vermesine izin ver. Sözleşme değişikliğinde etkilenmiş üyelerle birlikte karar ver. Kullanıcı açıkça istemedikçe commit/push/merge yapma.
