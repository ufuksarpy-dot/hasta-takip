# Hasta Takip — proje bağlamı

Fizyoterapist Ufuk'un **kendi hastalarının** programını, ölçümlerini ve
gelişimini takip ettiği **iPhone** uygulaması. Saatte 4 hastaya kadar aynı
anda bakıyor; uygulama seans sırasında **klavyesiz, butonla** hızlı kayıt
için tasarlanıyor. Son seanslarda doktora **foto özet** (görsel rapor)
gönderiliyor.

Kardeş projeler (aynı kullanıcı, aynı klinik):
- `C:\Users\ufuks\ImzaKontrol` — devam dosyasını (.xls) okuyan Android
  uygulaması. **Excel yapısı, açık/kapalı renk kuralı ve tuzaklar orada
  ölçüldü** (CLAUDE.md). İçe aktarma buraya oradan taşınacak.
- `C:\Users\ufuks\Föy-Yapıcı` — cihaz/bölge düğme listeleri oradan alındı.

Kararlar 2026-10-14'te kullanıcıyla konuşularak alındı. İlk sürüm aynı gün
yazıldı; durum için en alttaki "Durum" bölümüne bak.

---

## Kararlar

| Konu | Karar |
|---|---|
| Platform | **PWA**, yalnızca **iPhone**'da (Safari → Ana Ekrana Ekle). Mac yok, App Store yok. Diğer uygulamalar Xiaomi'de kalıyor |
| Kullanıcı | yalnızca Ufuk |
| Barındırma | ücretsiz statik barındırma (GitHub Pages / Netlify). Yalnızca **boş uygulama kodu** yüklenir |
| Veri | **yalnızca telefonda** (IndexedDB). Sunucu, bulut, hesap YOK. Offline çalışır (service worker) |
| Gizlilik | önemli (KVKK, sağlık verisi). Açılışta **PIN**. **Şifreli yedek** dışa/içe aktarma (ana ekrandan silinirse veri gider) |
| Ana ekran | **ImzaKontrol düzeni**: saat saat kutu ızgarası, **2 sütun**, "← Önceki saat / Sonraki saat →", üstte **arama**. Açılınca **o anki saat** |
| Kutu | ad soyad, seans (`7/15`), **AĞRI / ROM** etiketi |
| Hasta bilgisi | ad soyad, saat, seans sayısı, kategori. **Telefon alanı YOK** |
| Saat | hasta her gün **aynı saatte** gelir |
| Hasta ekleme | (1) **elle**; (2) **devam dosyası (.xls)** içe aktarma |
| Seans sayısı | butonlar `15` `20` `25` `30` + nadir sayılar için `−`/`+` |
| Başlangıç seansı | elle eklerken ayar (varsayılan 1); başka terapistten geçen hasta için ör. 3 |
| Seans ilerleme | "Seans yapıldı" butonu; **son sözü Excel söyler** — yeni dosya seansları günceller |
| Kategori | **AĞRI** → yalnızca VAS. **ROM** → VAS + ROM |
| VAS | 0–10, **11 buton** |
| ROM | **butonla**: hareket seç → 10°'lik derece ızgarası (0…180) + `−5`/`+5`. Son değer önceden seçili. Genelde **omuz** (fleksiyon, abdüksiyon, ekstansiyon, iç/dış rotasyon). Birden fazla hareket ölçülür |
| ROM sağ/sol | hastanın **etkilenen tarafı** seçilir; **iki taraf da ölçülür**, sağlıklı taraf kıyas için |
| Ölçüm zamanı | istendiği an ("Ölçüm al"); **ilk ve son seans kesin** — son seanslara yaklaşınca hatırlatma |
| Program | **cihazlar** (çip): `US` `HOTPACK` `COLDPACK` `VAKUM IF` `EGZ` `TENS` `ES` `PARAFİN` — **ESWT YOK**. **Manuel terapi** (ör. MOB + bölge: skapula, omuz kapsülü). **Egzersizler**: ad + set × tekrar (+ ağırlık), `−`/`+` ile |
| Program değişimi | eski sürüm **tarihli saklanır** (rapor için). Şablonlar |
| Listeler | cihaz ve egzersiz listesi **uygulama içinden genişletilebilir**. Egzersiz listesini kullanıcı sonra verecek |
| Bölgeler | Föy Yapıcı'daki: BOYUN, BEL, SAĞ/SOL OMUZ, SAĞ/SOL DİZ, SAĞ/SOL EL, SAĞ/SOL AYAK |
| Not | **elle yazılan** kısa not. Sesli not İSTENMEDİ |
| Tasarım | ilk sade taslak "fikir güzel ama daha havalı olsun" dedirtti → koyu tema, canlı vurgu renkleri, büyük rakamlar |
| Rapor | **foto özet** (tek görsel): ad, seans, VAS ilk→son, ROM ilk→son (+ sağlıklı taraf), program. Paylaş menüsü → WhatsApp |
| Kapsam | yalnızca klinik taraf; ödeme/randevu YOK |

## Excel içe aktarma

Yapı ve kurallar: **ImzaKontrol CLAUDE.md** ("Devam dosyasının yapısı",
"AÇIK / KAPALI — renk kuralı"). Buraya özgü kararlar:

- yalnızca **UFUK** sayfası
- MASAJ hastaları atlanır (ImzaKontrol kuralı)
- seans = ö.Seans + bu ayın toplamı (boş ö.Seans = 0)
- `Türü` = **AĞRI** → otomatik Ağrı. **Diğer her şey** (ORTOPEDİ dahil —
  "her ortopedi ROM değil") → içe aktarırken **sorulur**: `AĞRI` / `ROM`
- **yeni ay dosyası**: uygulamada olan hasta (ad + saat eşleşmesi)
  **korunur** (ölçüm, program, not silinmez), seansı dosyadan güncellenir;
  yeni hasta **eklenir**; dosyada boyanıp kapatılan → **"Biten hastalar"
  arşivi** (rapor oradan da alınır)
- aynı saatte aynı adlı iki hasta olabilir (ImzaKontrol tuzağı) —
  eşleştirmede dikkat

**Risk:** tarayıcıda eski `.xls` (BIFF) **hücre dolgu renklerini** okumak.
İşe başlarken **sentetik** renkli .xls ile ölç. Okunamazsa yedek yol bul.

**Gerçek hasta verisi projeye/koda girmez** (ImzaKontrol ve Föy Yapıcı
dersi). Sınamalar sentetik dosyayla.

---

## Açık konular

- egzersiz listesi (kullanıcı verecek)
- manuel terapi seçenekleri (MOB dışında neler, hangi bölgeler)
- PIN mi, Face ID mi (PWA'da Face ID sınırlı)

---

## Teknik yapı

Derleme adımı YOK: düz HTML + CSS + JavaScript modülleri. Statik barındırmaya
klasör olduğu gibi yüklenir.

| dosya | iş |
|---|---|
| `index.html`, `css/app.css` | kabuk ve koyu tema |
| `js/app.js` | bütün ekranlar ve eylemler (`data-e` ile tek yerden dokunma yakalama, geçmiş API'siyle geri) |
| `js/model.js` | saf kurallar: açılış saati, ilk/son ölçüm, Excel birleştirme, varsayılan listeler |
| `js/devam.js` | Excel okuyucu — ImzaKontrol `python/devam.py`'nin birebir karşılığı |
| `js/db.js` | IndexedDB |
| `js/kilit.js` | PIN (PBKDF2 özeti) ve şifreli yedek (AES-GCM) |
| `js/rapor.js` | foto özet (canvas → PNG) |
| `sw.js` | çevrimdışı önbellek — **dosya değişince `SURUM`'u artır** |
| `vendor/xlsx.full.min.js` | SheetJS 0.20.3 (cdn.sheetjs.com; npm'deki eski) |
| `ikon/ikon_uret.py` | ana ekran ikonu (Pillow) |

**SheetJS ile renk:** `XLSX.read(veri, { cellStyles: true, sheetStubs: true })`.
Dolgu `hucre.s.fgColor.rgb` ("000080"). Dolgusuz boş hücrede `s` YOK.
`sheetStubs` olmadan boş ama boyalı hücreler kaybolur.

**Sınamalar:** `npm test` (Node). `sinamalar/sentetik.py` ImzaKontrol'den
kopya; `.venv`'deki xlwt ile her koşuda sentetik .xls üretir. Sentetikte UFUK
sayfası yok — tarayıcı denemesi için kopyada `SELİN`→`UFUK` yapıldı
(scratchpad'de, projeye girmedi).

**Yerel önizleme:** `.claude/launch.json` → `python -m http.server 8765`.
`crypto.subtle` yalnızca güvenli bağlamda (https ya da localhost) çalışır:
telefondan yerel ağ IP'siyle (http) açılırsa PIN çalışmaz.

## Durum (2026-10-14)

**Yazıldı ve tarayıcıda (375×812) uçtan uca denendi:** PIN kur/yanlış/doğru,
Excel içe aktarma (sentetik UFUK: 8 açık hasta = beklenen 8; aynı dosya
tekrar → yalnızca seansı değişen), kategori sorma, hasta ekranı, VAS,
seans yapıldı/geri al, program (cihaz, MOB+bölge, egzersiz set/tekrar/kg),
ROM (iki taraf, sıradaki harekete geçme), not, foto özet, şifreli yedek
gidiş-dönüş (yanlış parola reddediliyor, dosyada ad düz metin değil).
`npm test` 12/12.

**Denenmedi:** gerçek iPhone (Safari, ana ekrana ekleme, paylaş menüsü,
dosya seçici), gerçek devam dosyası, service worker (yalnızca https'te
kayıt oluyor). **Henüz yayında değil** — barındırma kararı bekliyor.

**Bilinen davranış:** "Son söz Excel'in" — bugün "Seans yapıldı"ya basıp
sonra bugünkü yoklamayı içermeyen dosya yüklenirse seans bir geri düşer.
Kullanıcıya söylendi.
