# Ortak başlangıç ve dal düzeni

Önce Murathan bu başlangıcı inceler, kontrolleri çalıştırır, commit eder ve main'e gönderir. **Bu çalışma hazırlanırken commit/push/merge yapılmadı.** Yeni ortak başlangıç mevcut eski demo commit'i değil, bu dosyaları içeren yeni commit olacaktır.

Murathan yeni commit'in tam SHA'sını `git rev-parse HEAD` ile ekibe yollar. Herkes aynı SHA'yı kullanır. Aşağıdaki `ORTAK_SHA` yer tutucusunu bu gerçek SHA ile değiştirin:

```sh
git fetch origin
git switch -c feat/dataset-catalog ORTAK_SHA
# Efe bunun yerine: git switch -c feat/recording-reader ORTAK_SHA
# Derviş bunun yerine: git switch -c feat/recording-ui ORTAK_SHA
npm ci
npm run dev
```

Tek komutu kendi dalınız için çalıştırın; başkasının dalında çalışmayın. Commit öncesi `git status --short` ve `git diff` ile kendi dosyalarınızı kontrol edin. `git add` ile yalnızca kendi alanınızı ekleyin. Başka üyenin alanına ve ortak tiplere değişiklik gerekiyorsa önce ilgili üyeyle konuşun. Ortak dosya değişikliklerini küçük ayrı PR'larla inceleyin.

## Main'deki güncellemeleri alma

Önce mevcut işi commit edin veya `git stash push -u` ile geçici saklayın. Untracked ham veriyi Git'e/stash'e koymayın; data/local altında tutun.

```sh
git fetch origin
git merge origin/main
# Çakışma varsa ilgili dosyanın sahibiyle birlikte çözün.
npm run typecheck
npm test
npm run build
git push -u origin DAL_ADINIZ
```

Paylaşılan dallarda force push yapmayın. PR'ı main'e açın; giriş/çıkış örneği, test sonucu ve sınırlamaları yazın. En az bir başka üye incelesin. Ortak tip ve bütünleştirme değişikliklerini Murathan ile ilgili modül sahibi incelesin. İnceleme ve kontrollerden sonra birleştirin. Her güncellemeden sonra diğer üyeler main'i kendi dallarına alır.

## Repo dışındaki veriler

`data/local/`, `data/raw/`, `data/downloads/`, `reports/local/`, `.env*` ve yaygın büyük kayıt/arşiv uzantıları ignore edilir. Tüm uzantılar yakalanamaz: yerel verileri mutlaka belirtilen dizinlerde tutun; public/ içine koymayın. `.gitignore` daha önce izlenen dosyaları kaldırmaz; commit öncesi listeleri inceleyin. Git'te yalnızca kaynak kodu, küçük özgün sentetik SVG'ler, manifest, lisans/kaynak belgeleri ve testler bulunmalıdır.
