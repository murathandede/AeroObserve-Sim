# Ahmet — veri kataloğu ve manifest

- **Değiştirebileceğin dosyalar:** `docs/datasets.md`, `data/manifests/`. Yerel ham örnekleri `data/local/` altında tut; Git'e koyma.
- **Dal:** `feat/dataset-catalog`.
- **Başlama:** ortak başlangıç SHA'sından dal aç; `npm ci`, `npm run dev`. Katalog için uygulamanın çalışması zorunlu değil.
- **Ortak tipler:** `DatasetManifest`, `RecordingInfo`, `Known<T>`; tek kaynak `src/shared/types.ts`.
- **Girdi:** resmî kaynak belgesi, lisans koşulları ve küçük gerçek termal kayıt.
- **Çıktı:** kaynak kataloğu, tamamlanmış JSON manifest, biçim belgesi ve tekrar uygulanabilir edinme talimatı.

## Küçük kullanım örneği

```powershell
Copy-Item data/manifests/template.json data/manifests/secilen-kayit.json
```

Şablon açıklamalarını `data/manifests/README.md` üzerinden izleyerek doldur. Bilinmeyen zaman için `timing.kind: "unknown"`, bilinmeyen lisans için `license: { "status": "unknown" }` bırak. Kaynak doğrulanmadan kayıt hazırmış gibi işaretleme.

## Tamamlanma ölçütleri

Kaynak URL'si, başlık, sürüm/erişim tarihi, atıf, lisans kanıtı ve dosya listesi belgeli; küçük örnek edinilebilir; gerçek biçim açıklanmış; radyometri/zaman bilgisi kanıta dayalı. Bilinmeyenler açık. Ham dosyalar Git dışında. JSON geçerli ve sözleşmeye uygun. `npm run typecheck` ve `npm run build` geçer.

## Doğrudan teslim

**Efe'ye** manifest yolu, biçim belgesi, küçük örneğin edinme talimatı, göreli dosya listesi ve varsa doğrulama özetini doğrudan gönder. Her adımda Murathan'ı aracı yapman gerekmez. Ortak sözleşmeyi değiştirmek gerekirse Efe ve Murathan ile koordine et; başka üyenin dosyasını değiştirme.
