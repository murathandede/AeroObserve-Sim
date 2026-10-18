# Yerel arayüz örneği

Üç SVG bu repo için hazırlanmış özgün geometrik çizimlerdir ve CC0-1.0 altında sunulur (yalnızca `frames/*.svg`). Harici görsel, model, kayıt veya ağ isteği gerektirmez. Renkler sıcaklık değildir; çizimlerin özgün veya türetilmiş kayıt zamanı yoktur.

Bu adaptör bir gerçek dosya okuyucusu değildir. Yalnızca `exampleInput` ile açılır; başka biçimleri reddeder. `files` haritası bu gömülü örnek için boştur. Metadata kopyalanır, hatalar yapılandırılmış sonuç olarak döner. Yerel varlık URL'lerini close sırasında iptal etmek gerekmez; gerçek okuyucunun ürettiği blob URL'leri ise close sırasında iptal edilmelidir.

Sahibi: Murathan (ortak başlangıç fikstürü). Derviş `src/ui/` içinde bu adaptörün arayüzüyle çalışır; Efe aynı `RecordingReader` arayüzünü uygulayarak bağımsız okuyucu geliştirir.
