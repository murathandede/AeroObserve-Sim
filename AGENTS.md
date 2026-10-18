# AeroObserve ekip çalışma sınırları

Güncel amaç: gerçek termal kayıtları yerel açmak, oynatmak ve veri kalitesini incelemek. Mevcut gerçek okuyucu yoktur. Sentetik örnekleri gerçek veri diye sunmayın. Hedef tespiti, kilitleme ve silah entegrasyonu kapsam dışıdır.

Önce `docs/project-context.md`, `docs/data-contract.md`, `docs/team/<üye>.md` ve `docs/git-workflow.md` okuyun. Çalışan eski simülasyonu koruyun.

| Sahip | Düzenleme alanı |
| --- | --- |
| Ahmet | docs/datasets.md, data/manifests/ |
| Efe | src/data/, src/quality/, tests/reader-*.test.ts, tests/quality-*.test.ts, docs/readers.md |
| Derviş | src/ui/, tests/ui-*.test.ts |
| Murathan | src/app/, src/playback/, src/main.tsx, src/demo/, tests/recording.test.ts, README ve bütünleştirme belgeleri |

`src/shared/types.ts` tek ortak sözleşmedir. Tip, package/lockfile, ortak yapılandırma ve başka sahibin alanındaki değişiklikleri ekipçe koordine edin. Herkes sıradan modül içi teknik kararlarını kendi verir; her ayrıntı için Murathan'a sormak gerekmez. Yeni bağımlılık yerine mevcut araçları tercih edin.

Ahmet biçim belgesi ve küçük örneği doğrudan Efe'ye; Efe okuyucu ve kullanım örneğini doğrudan Derviş'e teslim eder. Murathan uygulama bağlantısını yapar. Başka üyenin görevini açık talep olmadan üstlenmeyin.

Ham kayıtlar `data/local/` altında, Git dışında kalır. Kaynak/lisans/zaman belirsizliğini açık gösterin. Değişikliklerden sonra build, typecheck ve ilgili testleri çalıştırın; tarayıcı doğrulaması yapmadıysanız belirtin. Kullanıcı açıkça istemeden commit, push, merge yapmayın.
