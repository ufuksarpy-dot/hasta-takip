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
| Gizlilik | önemli (KVKK, sağlık verisi). **PIN YOK** — ilk sürümde vardı, kullanıcı 2026-10-17'de "pin istemiyorum" dedi; koruma telefonun kendi kilidi. **Şifreli yedek** dışa/içe aktarma (ana ekrandan silinirse veri gider) |
| Ana ekran | **ImzaKontrol düzeni**: saat saat kutu ızgarası, **2 sütun**, "← Önceki saat / Sonraki saat →", üstte **arama**. Açılınca **o anki saat** |
| Kutu | ad soyad, sade kategori yazısı ("Ağrı", "ROM · sağ", turuncu "son ölçüm"), seans (`7/15`) + gidişat oku, bugün ✓/VAS. Kategori rengi **sol şeritte**. Renkli etiketler ve ilerleme çubuğu 2026-10-17'de "çok kalabalık" denince kaldırıldı |
| Ana ekran üstü | tek satır selam · tarih; yalnızca **Ara** ve **Menü**. "Hasta ekle" ve görünüm değiştirme **menüde**. Özet satırı ("4 hasta · 2 ROM") yok. Kaydırma ipucu yalnızca ilk 5 açılışta |
| Hasta ekranı | sade (2026-10-17): kategori/saat/seans tek gri satır, uyarı turuncu yazı (etiket yok); eylem satırı yalnızca **ROM ölç** + **Not yaz**; program mor çipler yerine tek satır yazı + "Düzenle" bağlantısı; gelişim kartında alt çizgili sekmeler, altta "Hastaya göster" · "Foto özet" bağlantıları; notlardan yalnızca son not tek satır |
| Hasta bilgisi | ad soyad, saat, seans sayısı, kategori. **Telefon alanı YOK** |
| Saat | hasta her gün **aynı saatte** gelir |
| Hasta ekleme | (1) **elle**; (2) **devam dosyası (.xls)** içe aktarma |
| Seans sayısı | butonlar `15` `20` `25` `30` + nadir sayılar için `−`/`+` |
| Başlangıç seansı | elle eklerken ayar (varsayılan 1); başka terapistten geçen hasta için ör. 3 |
| Seans ilerleme | "Seans yapıldı" butonu; **son sözü Excel söyler** — yeni dosya seansları günceller |
| Kategori | **AĞRI** → yalnızca VAS. **ROM** → VAS + ROM |
| VAS | 0–10, **kaydırılabilir çizgi** (yeşil→kırmızı); bırakınca kaydedilir. İlk sürümdeki 11 buton kullanıcı isteğiyle değişti |
| ROM | **yay sürüklenir** (5°'lik adım) + hızlı butonlar (0, 30…180) + `±5`/`±10`. Son değer önceden seçili. Genelde **omuz** (fleksiyon, abdüksiyon, ekstansiyon, iç/dış rotasyon). Birden fazla hareket ölçülür |
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

## Kullanım kolaylığı (2026-10-17, kullanıcı onayladı)

- kaydırma **parmağı izler** (içerik `--kay` CSS değişkeniyle kayar), bırakınca eski içerik dışarı, yenisi öbür yandan girer; gidilecek yer yoksa lastik gibi esneyip döner. Soluklaşarak giren animasyon "yenileniyor" gibi göründüğü için kaldırıldı
- ana ekran: **sola/sağa kaydır = saat değiştir**; büyük saate dokun = saat seçici; başka saatteyken **"Şimdi"**
- kutuda bugünün durumu: **✓** (seans yapıldı), **VAS n**
- kutuya **basılı tut = seans yapıldı** (+ "Geri al")
- **saat özeti görünümü** (üstteki düğme, ayarda hatırlanır): her hastanın programı ve son notu kartta — kullanıcı "kilit ekranında görmek" istedi; PWA'da widget/kilit ekranı İMKÂNSIZ, bu onun karşılığı
- hasta ekranı: **sola/sağa kaydır = aynı saatteki diğer hasta**; sol kenardan kaydır = geri (ana ekrana eklenmiş PWA'da iOS'un geri hareketi yok)
- "Seans yapıldı", saat geçişi, ROM "Kaydet" **alt sabit barda** (başparmak)
- "Emin misin?" yerine **Geri al** bildirimi (bitir, not sil, liste öğesi sil, VAS sil). Toplu/kalıcı silmelerde (hasta sil, deneme sil, yedek yükle) onay penceresi KALDI
- iPhone web uygulamasında **titreşim yok** — geri bildirim animasyonla
- sırada: **program şablonları** (kararlarda vardı, yapılmadı)

## Keyif (2026-10-17, kullanıcı seçti: 1, 2, 3'ten yalnızca gidişat oku, 4'ten yalnızca selamlama)

- hasta ekranında **gelişim grafiği**: VAS ya da ROM hareketi (çiplerle seçilir), seanslara göre; ROM'da sağlıklı taraf kesikli çizgi
- **Hastaya göster** (`ekranlar.goster`): büyük yazı, "<ad>, harika gidiyorsun!", seans halkası, ağrı ilk→son ve % azalma, ROM yarım daireleri (+°)
- **Aylık özet** (menü; ayın ilk 7 günü ana ekranda geçen ayın kartı, kapatılınca o ay çıkmaz): biten tedavi, ağrıda ort. % azalma, ROM ort. kazanım, işaretlenen seans, en sık cihazlar. Seans sayısı yalnızca uygulamada "Seans yapıldı" denenleri sayar
- **seans animasyonu**: halka dolarak ilerler, ✓ zıplar (`d.pop`)
- **tedavi bitişi**: son seansta konfeti + "Tedavi tamamlandı" kartı (Foto özet / Tedaviyi bitir)
- **gidişat oku** kutuda: son iki VAS — ↓ yeşil, → gri, ↑ turuncu
- **selamlama**: saate göre "Günaydın / İyi günler / İyi akşamlar / İyi geceler Ufuk" (ayar `kullaniciAdi`, varsayılan Ufuk)
- İstenmeyenler: baş harf rozeti, tema rengi, tık sesi, gün sonu kartı
- Türkçe ek tuzağı: sayıya ek getirme ("12'i" yanlış) — ek gerektirmeyen kalıp kullan ("Seans 12 / 30")

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
| `js/kilit.js` | şifreli yedek (AES-GCM, paroladan PBKDF2) |
| `js/rapor.js` | foto özet (canvas → PNG) |
| `js/dokunma.js` | kaydırma (saat/hasta), kenardan geri, basılı tutma, basılı tutunca tekrar, sürükleme. Tıklama yutma **süreli** (400 ms): ekran araya yeniden çizilirse bir sonraki dokunuş yutulmasın |
| `js/gorsel.js` | gelişim grafiği (SVG çizgi), "hastaya göster" yarım daireleri, konfeti |
| `js/deneme.js` | menüden "Deneme hastaları ekle/sil": uydurma hastalar (`kaynak: "deneme"`), ölçüm geçmişi, program, not. Sil yalnızca bunlara dokunur |
| `sw.js` | çevrimdışı önbellek — **dosya değişince `SURUM`'u artır** |
| `vendor/morphdom.js` | morphdom 2.7.4 (ESM): `ciz()` ekranı baştan yazmaz, yalnızca değişeni günceller — kullanıcı "sayfa yenileniyormuş gibi" yanıp sönmeden şikâyet etti. Bu yüzden `surukle()` aynı öğeye tekrar tekrar bağlanabiliyor (dinleyici bir kez, seçenek her çizimde) |
| `vendor/xlsx.full.min.js` | SheetJS 0.20.3 (cdn.sheetjs.com; npm'deki eski) |
| `ikon/ikon_uret.py` | ana ekran ikonu (Pillow): gonyometre, dolu yay **kırmızı → turuncu → yeşil** (kullanıcı: "pozitif ilerleme"). iOS ikonu ana ekrana eklerken bir kez alır; değişince `?v=N` artır. **Telefondaki ikonu yenilemek = sil + yeniden ekle = VERİ GİDER** → önce yedek |

**SheetJS ile renk:** `XLSX.read(veri, { cellStyles: true, sheetStubs: true })`.
Dolgu `hucre.s.fgColor.rgb` ("000080"). Dolgusuz boş hücrede `s` YOK.
`sheetStubs` olmadan boş ama boyalı hücreler kaybolur.

**Sınamalar:** `npm test` (Node). `sinamalar/sentetik.py` ImzaKontrol'den
kopya; `.venv`'deki xlwt ile her koşuda sentetik .xls üretir. Sentetikte UFUK
sayfası yok — tarayıcı denemesi için kopyada `SELİN`→`UFUK` yapıldı
(scratchpad'de, projeye girmedi).

**Yerel önizleme:** `.claude/launch.json` → `python -m http.server 8765`.
`crypto.subtle` yalnızca güvenli bağlamda (https ya da localhost) çalışır:
telefondan yerel ağ IP'siyle (http) açılırsa yedek çalışmaz.

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
kayıt oluyor).

**Yayında (2026-10-17):** GitHub Pages, https://ufuksarpy-dot.github.io/hasta-takip/
(depo `ufuksarpy-dot/hasta-takip`, public, `main` kökü). Yayın adresinde
denendi: PIN ekranı, service worker kaydı ve önbellek, `crypto.subtle`, SheetJS.
Güncelleme = commit + push; **`sw.js`'deki `SURUM`'u artırmadan telefon eski
sürümü göstermeye devam eder.**
Yeni service worker etkinleşince sayfa kendini **bir kez yeniler**
(`controllerchange`, sürüm 6'dan beri; sürüm 7'den beri uygulama öne gelince de kontrol). Menünün altında "Sürüm N" (önbellek adından).
Sürüm 4'te kalan `kay-sag` sınıfı her yeniden çizimde ekranı soldan kaydırıyordu —
kullanıcı "VAS değişince ekran soldan geliyor" dedi; sürüm 5'te giderildi.

**PIN kaldırıldı (2026-10-17)** — yukarıdaki PIN denemeleri artık geçersiz.

**Bilinen davranış:** "Son söz Excel'in" — bugün "Seans yapıldı"ya basıp
sonra bugünkü yoklamayı içermeyen dosya yüklenirse seans bir geri düşer.
Kullanıcıya söylendi (2026-10-17); "uygulamadaki büyükse koru" seçeneği önerildi, cevap bekliyor.
