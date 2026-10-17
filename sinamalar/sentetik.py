"""Sentetik devam dosyası (.xls) üreteci.

Gerçek devam dosyasının yapısını taklit eder (bkz. CLAUDE.md, "Devam
dosyasının yapısı"), ama içindeki her ad, sayı ve renk UYDURMADIR. Gerçek
dosya projeye girmez; sınamalar bu dosyaya karşı koşar.

Üreteç, dosyayla birlikte BEKLENEN sonucu da üretir: her fizyoterapist için
görünmesi gereken kutular (açık, masaj olmayan hastalar) ve seans sayıları.
Beklenen değer burada, hastayı yaratırken bilinir; dosyadan geri okunmaz.

Taklit edilen tuzaklar:
- iki kapatma tarzı: tüm satırı boya / son seanstan sonrasını boya
- ad-kurum hücrelerine (sütun 2-9) süs dolgusu (kapatma DEĞİL)
- şablonda gün hücreleri beyaz dolgulu, Pazarlar ve 31. gün dolgusuz
- bütün gün hücreleri beyazla boyanmış satır (kapatma DEĞİL, açık)
- tek hücrelik başlangıç işareti (ilk seanstan bir gün önce)
- seans sayısına ulaşmış ama boyanmamış hasta (açık)
- yarıda kapatılmış hasta (kapalı)
- boş ö.Seans, boş planlanan seans, boş Türü
- MASAJ yazım çeşitleri ("MASAJ", "masaj", "MASAJ "), açık ve kapalı
- aynı saatte aynı adlı iki hasta
- adın sonunda boşluk, küçük harfle yazılmış ad
- sayfa adı yazımı tutarsız (yalnızca baş harfi büyük)
- toplam satırları, fizyoterapist sayfasıyla aynı yapıdaki YEDEK sayfası,
  başka yapıdaki sayfalar
- vardiya: ÖMER akşamcı (12–21): 12–19 blokları + 08:00 bloğu = 20:00;
  ötekiler sabahçı (08–17). DENİZ sabahçı ama 18:00'de bir mesai hastası
  var (9/10'dakilerden az) — "18/19'da hasta var = akşamcı" kuralını yakalar

Kullanım:
    python sentetik.py <çıkış klasörü>
"""

import calendar
import json
import os
import random
import sys

import xlwt

YIL, AY = 2031, 6
AY_ADI = "HAZİRAN"
DOSYA_ADI = f"{AY:02d} {AY_ADI}  {YIL}.xls"  # iki boşluk, gerçek ad gibi
AY_GUN = calendar.monthrange(YIL, AY)[1]
PAZARLAR = [g for g in range(1, AY_GUN + 1)
            if calendar.weekday(YIL, AY, g) == calendar.SUNDAY]

SAATLER = list(range(8, 20))  # 08:00 … 19:00
BLOK_HASTA = 12

# sütunlar (0 tabanlı)
S_SIRA, S_AD, S_SOYAD, S_DOKTOR, S_KURUM, S_GRUP, S_TUR = 1, 2, 3, 4, 5, 6, 7
S_SEANS, S_OSEANS = 8, 9
S_GUN1 = 10          # 1. gün; sütun - 9 = gün
S_GUN31 = 40
S_TOPLAM, S_BOLGE, S_NOT = 41, 42, 43
SON_SUTUN = S_NOT

BEYAZ = "white"

AD_HAVUZU = ["Çağrı", "Işıl", "İlkay", "Öykü", "Şule", "Ümit", "Gökay",
             "Ege", "Arda", "Nehir", "Umut", "Deniz", "Irmak", "Özge",
             "Şahin", "Güneş", "Çise", "İpek", "Yağmur", "Tolga"]
SOYAD_HAVUZU = ["Örnekoğlu", "Denemeci", "Sınamaz", "Kurgusal", "Uydurmaca",
                "Yapaytaş", "Taslakçı", "Sanalgil", "Kalıpçı", "Öntanım"]


class Hasta:
    """Tek hasta satırının tanımı. Beklenen değerler buradan hesaplanır."""

    def __init__(self, ad, soyad, tur="AĞRI", seans=15, oseans=None,
                 kapanis=None, renk=None, beyaz=False, isaret=None,
                 saat=None, gelis=None, bitir=False, ay_sonu=False):
        self.ad, self.soyad, self.tur = ad, soyad, tur
        self.seans, self.oseans = seans, oseans
        self.kapanis = kapanis      # None | "tum" | "sonra"
        self.renk = renk            # kapatma rengi
        self.beyaz = beyaz          # bütün gün hücreleri beyaz
        self.isaret = isaret        # başlangıç işareti rengi
        self.saat = saat            # None: rastgele saat
        self.gelis = gelis          # bu ay kaç kez geldi (None: rastgele)
        self.bitir = bitir          # planlanan seansa ulaşsın
        self.ay_sonu = ay_sonu      # ayın son günü gelsin (yalnızca 31 boyanır)
        self.gunler = {}            # gün -> 1/0
        self.boya_bas = None        # "sonra" tarzında boyanın başladığı gün
        self.satir = self.sira = None

    @property
    def acik(self):
        return self.kapanis is None

    @property
    def masaj(self):
        return self.tur.strip().upper() == "MASAJ"

    @property
    def toplam_seans(self):
        return (self.oseans or 0) + sum(1 for v in self.gunler.values() if v == 1)


def _devam_uret(h, rng):
    """Hastanın gün hücrelerini (1/0) üretir; kurallarla çelişmez."""
    is_gunleri = [g for g in range(1, AY_GUN + 1) if g not in PAZARLAR]
    en_gec = AY_GUN - 4 if h.kapanis == "sonra" else AY_GUN
    en_erken = 2 if h.isaret else 1
    adaylar = [g for g in is_gunleri if en_erken <= g <= en_gec]
    bas_i = rng.randrange(0, max(1, len(adaylar) // 2))
    kalan = [g for g in adaylar[bas_i:]]
    if h.gelis is None:
        h.gelis = rng.randint(1, min(12, len(kalan)))
    gelis = 0
    for g in kalan:
        if gelis == h.gelis:
            break
        if gelis > 0 and rng.random() < 0.15:
            h.gunler[g] = 0  # gelmedi
            continue
        h.gunler[g] = 1
        gelis += 1
    if h.ay_sonu:
        assert AY_GUN < 31 and AY_GUN not in PAZARLAR
        h.gunler[AY_GUN] = 1
        gelis += 1
    h.gelis = gelis
    if h.bitir:
        h.seans = (h.oseans or 0) + gelis
    if h.kapanis == "sonra":
        son = max(h.gunler)
        # boya bazen son seanstan birkaç gün sonra başlıyor
        h.boya_bas = (31 if h.ay_sonu
                      else min(son + 1 + rng.randint(0, 2), AY_GUN))


def _sayfa_hastalari(ad, rng):
    """Sayfa adına göre hasta listesi. Her sayfa başka tuzakları taşır."""
    def rast(**kw):
        kw.setdefault("oseans", rng.choice([None, None, 0, 3, 5, 10]))
        kw.setdefault("seans", rng.choice([10, 15, 15, 20, None]))
        kw.setdefault("tur", rng.choice(["AĞRI", "AĞRI", "ORTOPEDİ",
                                         "ORTOPEDİ", "ELEKTRO", ""]))
        ad_ = rng.choice(AD_HAVUZU)
        if rng.random() < 0.15:
            ad_ += " "  # sonda boşluk
        return Hasta(ad_, rng.choice(SOYAD_HAVUZU), **kw)

    L = []
    if ad == "İlker":  # tüm satırı boya, koyu mavi
        L += [rast() for _ in range(8)]
        L += [rast(kapanis="tum", renk="dark_blue") for _ in range(6)]
        L += [rast(tur="MASAJ"), rast(tur="MASAJ", kapanis="tum", renk="dark_blue")]
        L += [rast(bitir=True)]                       # seansı dolmuş, boyanmamış
        L += [rast(saat=8)]                           # sabahçının 08:00'i 08:00 kalır
        L += [Hasta("h.B.", "", tur="EL", oseans=None)]  # küçük harf, soyadsız
    elif ad == "ÖMER":  # tüm satırı boya + başlangıç işaretleri
        L += [rast(isaret=rng.choice(["indigo", "gray25"])) for _ in range(4)]
        L += [rast() for _ in range(3)]
        L += [rast(kapanis="tum", renk="indigo") for _ in range(4)]
        L += [rast(kapanis="tum", renk="indigo", isaret="gray25")]
        L += [rast(tur="masaj")]
        L += [Hasta("A.K.", "", saat=19), Hasta("A.K.", "", saat=19, oseans=4)]
        L += [rast(saat=8), rast(saat=8, kapanis="tum", renk="indigo")]  # = 20:00
        L += [rast(saat=18)]
        L += [rast(seans=15, gelis=7, kapanis="tum", renk="indigo")]  # yarıda
    elif ad == "DENİZ":  # son seanstan sonrasını boya + süs dolgusu
        L += [rast() for _ in range(8)]
        L += [rast(kapanis="sonra", renk="light_green") for _ in range(7)]
        L += [rast(tur="MASAJ ")]
        L += [rast(tur="", seans=None, oseans=None)]
        L += [rast(saat=18)]                         # sabahçının mesai hastası
        L += [rast(saat=9), rast(saat=10, kapanis="sonra", renk="light_green")]
    elif ad == "SELİN":  # sonrasını boya, karışık renk + beyaz satırlar
        L += [rast() for _ in range(6)]
        L += [rast(kapanis="sonra", renk=rng.choice(["yellow", "indigo"]))
              for _ in range(6)]
        L += [rast(beyaz=True), rast(beyaz=True, tur="EL ")]
        L += [rast(seans=15, gelis=7, kapanis="sonra", renk="yellow")]
        L += [rast(tur="MASAJ", kapanis="sonra", renk="yellow")]
        L += [rast(kapanis="sonra", renk="indigo", ay_sonu=True)]
    elif ad == "YEDEK":  # fizyoterapist yapısında ama fizyoterapist değil
        L += [rast(), rast(), rast(kapanis="tum", renk="dark_blue")]
    for h in L:
        _devam_uret(h, rng)
    return L


SUS_SAYFALARI = {"DENİZ": "turquoise"}
# Şablonda gün sütunu beyaz/dolgusuz dışında bir renk. Gerçek dosyada
# görülmedi (orada 31 dolgusuz); kuralın "beyaz değil"e değil ŞABLONA
# dayandığını sınamak için: 30 çeken ayda 31'i gölgelemek akla yatkın.
SABLON_OZEL = {"ÖMER": {S_GUN31: "gray25"}}
FZT_SAYFALARI = ["İlker", "ÖMER", "DENİZ", "SELİN"]
AKSAMCILAR = {"ÖMER"}


def calisma_saatleri(ad):
    """Akşamcı 12–21: şablonda 20:00 yok, o saat 08:00 bloğuna yazılır."""
    if ad in AKSAMCILAR:
        return [8] + list(range(12, 20))
    return list(range(8, 18))


def gosterilen_saat(ad, blok):
    return 20 if ad in AKSAMCILAR and blok == 8 else blok


class _Izgara:
    """Hücreleri önce bellekte toplar; xlwt her hücreye bir kez yazılsın."""

    def __init__(self):
        self.h = {}

    def koy(self, r, c, deger=None, renk=None):
        eski = self.h.get((r, c), (None, None))
        self.h[(r, c)] = (deger if deger is not None else eski[0],
                          renk if renk is not None else eski[1])

    def yaz(self, ws, stil):
        for (r, c), (deger, renk) in self.h.items():
            ws.write(r, c, "" if deger is None else deger, stil(renk))


def _sablon_rengi(sayfa, c):
    """Boş şablonda sütunun dolgusu: gün hücreleri beyaz, Pazar ve 31 dolgusuz."""
    if c in SABLON_OZEL.get(sayfa, {}):
        return SABLON_OZEL[sayfa][c]
    if S_GUN1 <= c <= S_GUN31:
        gun = c - 9
        if gun in PAZARLAR or gun == 31:
            return None
        return BEYAZ
    return None


def _fzt_sayfasi(ad, hastalar, rng):
    iz = _Izgara()
    iz.koy(0, S_AD, ad)
    # hastaları saatlere dağıt
    bloklar = {s: [] for s in SAATLER}
    calisma = calisma_saatleri(ad)
    sabit = {h.saat for h in hastalar if h.saat is not None}
    # en az iki çalışma saati tamamen boş (sabit saatler hariç)
    bos_saatler = set(rng.sample([s for s in calisma if s not in sabit], 2))
    dolu = [s for s in calisma if s not in bos_saatler]
    for h in hastalar:
        s = h.saat if h.saat is not None else rng.choice(dolu)
        while len(bloklar[s]) >= BLOK_HASTA:
            s = rng.choice(dolu)
        h.saat = s
        bloklar[s].append(h)

    r = 2
    for i, s in enumerate(SAATLER):
        iz.koy(r, S_AD, f"   Saat  {s:02d}:00   ")
        r += 1
        if i == 0:
            basliklar = {S_AD: "ADI", S_SOYAD: "SOYADI", S_DOKTOR: "DOKTOR",
                         S_KURUM: "KURUMU", S_GRUP: "GRUP", S_TUR: "Türü",
                         S_SEANS: "Seans", S_OSEANS: "ö.Seans",
                         S_TOPLAM: "TOPLAM", S_BOLGE: "BÖLGE", S_NOT: "NOT"}
            for g in range(1, 32):
                basliklar[S_GUN1 + g - 1] = g
            for c, v in basliklar.items():
                iz.koy(r, c, v)
            r += 1
        yerler = rng.sample(range(BLOK_HASTA), len(bloklar[s]))
        satirdaki = dict(zip(yerler, bloklar[s]))
        gunluk = [0] * 32
        for k in range(BLOK_HASTA):
            iz.koy(r, S_SIRA, k + 1)
            for c in range(S_AD, SON_SUTUN + 1):
                iz.koy(r, c, None, _sablon_rengi(ad, c) or "")
            h = satirdaki.get(k)
            if h is not None:
                _hasta_yaz(iz, r, k + 1, h, ad, rng)
                for g, v in h.gunler.items():
                    gunluk[g] += v
            r += 1
        # toplam satırı: sütun 1 boş, gün sütunlarında günlük toplam
        # (gerçekte formül; boş blokta da 0 gösterir)
        for g in range(1, 32):
            iz.koy(r, S_GUN1 + g - 1, gunluk[g])
        r += 1
    return iz


def _hasta_yaz(iz, r, sira, h, sayfa, rng):
    h.satir, h.sira = r, sira
    iz.koy(r, S_AD, h.ad)
    iz.koy(r, S_SOYAD, h.soyad)
    iz.koy(r, S_DOKTOR, rng.choice(["Dr. Örnek", "Dr. Deneme", ""]))
    iz.koy(r, S_KURUM, rng.choice(["SGK", "ÖZEL", ""]))
    iz.koy(r, S_GRUP, rng.choice(["A", "B", ""]))
    iz.koy(r, S_TUR, h.tur)
    if h.seans is not None:
        iz.koy(r, S_SEANS, h.seans)
    if h.oseans is not None:
        iz.koy(r, S_OSEANS, h.oseans)
    for g, v in h.gunler.items():
        iz.koy(r, S_GUN1 + g - 1, v)
    # sütun 41: bu ayın toplamı (gerçekte formül; ölçüldü: 1 sayısına eşit)
    iz.koy(r, S_TOPLAM, sum(1 for v in h.gunler.values() if v == 1))
    iz.koy(r, S_BOLGE, rng.choice(["Bel", "Diz", "Omuz", ""]))

    sus = SUS_SAYFALARI.get(sayfa)
    if sus:
        for c in range(S_AD, S_OSEANS + 1):
            iz.koy(r, c, None, sus)
    if h.beyaz:
        for c in range(S_GUN1, S_GUN31 + 1):
            iz.koy(r, c, None, BEYAZ)
    if h.isaret:
        ilk = min(g for g, v in h.gunler.items() if v == 1)
        iz.koy(r, S_GUN1 + ilk - 2, None, h.isaret)  # ilk seanstan bir gün önce
    if h.kapanis == "tum":
        for c in range(S_SIRA, SON_SUTUN + 1):
            iz.koy(r, c, None, h.renk)
    elif h.kapanis == "sonra":
        for g in range(h.boya_bas, 32):
            iz.koy(r, S_GUN1 + g - 1, None, h.renk)


def _duz_sayfa(basliklar, satirlar):
    iz = _Izgara()
    for c, v in enumerate(basliklar):
        iz.koy(0, c, v)
    for r, satir in enumerate(satirlar, start=1):
        for c, v in enumerate(satir):
            iz.koy(r, c, v)
    return iz


def uret(klasor, tohum=20310601):
    """`klasor`e sentetik .xls yazar; (dosya yolu, beklenen) döndürür."""
    rng = random.Random(tohum)
    stiller = {}

    def stil(renk):
        if renk not in stiller:
            st = xlwt.XFStyle()
            if renk:
                p = xlwt.Pattern()
                p.pattern = xlwt.Pattern.SOLID_PATTERN
                p.pattern_fore_colour = xlwt.Style.colour_map[renk]
                st.pattern = p
            stiller[renk] = st
        return stiller[renk]

    wb = xlwt.Workbook(encoding="utf-8")
    sayfalar = []
    sayfalar.append(("FTR ye Baş. Has.", _duz_sayfa(
        ["TARİH", "ADI SOYADI", "DOKTOR", "FİZYOTERAPİST"],
        [[f"{g:02d}.{AY:02d}.{YIL}", f"{rng.choice(AD_HAVUZU)} "
          f"{rng.choice(SOYAD_HAVUZU)}", "Dr. Örnek",
          rng.choice(FZT_SAYFALARI)] for g in range(2, 12)])))
    sayfalar.append((f"{AY_ADI} {YIL}", _duz_sayfa(
        ["FİZYOTERAPİST", "HASTA", "SEANS"],
        [[f, rng.randint(10, 40), rng.randint(100, 300)]
         for f in FZT_SAYFALARI])))

    beklenen = {"dosya": DOSYA_ADI, "ay_gun": AY_GUN, "pazarlar": PAZARLAR,
                "fizyoterapistler": {}, "ozet": {}}
    for ad in FZT_SAYFALARI + ["YEDEK"]:
        hastalar = _sayfa_hastalari(ad, rng)
        sayfalar.append((ad, _fzt_sayfasi(ad, hastalar, rng)))
        kutular = [h for h in hastalar if h.acik and not h.masaj]
        kutular.sort(key=lambda h: (gosterilen_saat(ad, h.saat), h.satir))
        beklenen["ozet"][ad] = {
            "hasta": len(hastalar),
            "acik": sum(h.acik for h in hastalar),
            "kapali": sum(not h.acik for h in hastalar),
            "acik_masaj": sum(h.acik and h.masaj for h in hastalar),
            "kutu": len(kutular),
        }
        if ad == "YEDEK":
            continue
        beklenen.setdefault("vardiya", {})[ad] = (
            "aksam" if ad in AKSAMCILAR else "sabah")
        beklenen["fizyoterapistler"][ad] = [
            {"saat": f"{gosterilen_saat(ad, h.saat):02d}:00",
             "blok": f"{h.saat:02d}:00", "satir": h.satir, "sira": h.sira,
             "ad": h.ad.strip(), "soyad": h.soyad.strip(),
             "seans": h.toplam_seans}
            for h in kutular]
        # fikstür denetimi için: bütün hasta satırları ve durumları
        beklenen.setdefault("tum_hastalar", {})[ad] = [
            {"satir": h.satir, "acik": h.acik, "masaj": h.masaj,
             "kapanis": h.kapanis, "beyaz": h.beyaz,
             "isaret_gunu": (min(g for g, v in h.gunler.items() if v == 1) - 1
                             if h.isaret else None)}
            for h in hastalar]

    sayfalar.append(("BANTLAMA", _duz_sayfa(
        ["ADI SOYADI", "TARİH", "BÖLGE"],
        [[rng.choice(AD_HAVUZU), f"{g:02d}.{AY:02d}", "Bel"] for g in (3, 5)])))
    sayfalar.append(("ESWT", _duz_sayfa(
        ["ADI SOYADI", "SEANS"], [[rng.choice(AD_HAVUZU), 3]])))
    sayfalar.append(("Sayfa1", _Izgara()))

    for ad, iz in sayfalar:
        iz.yaz(wb.add_sheet(ad), stil)

    os.makedirs(klasor, exist_ok=True)
    yol = os.path.join(klasor, DOSYA_ADI)
    wb.save(yol)
    return yol, beklenen


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    yol, beklenen = uret(sys.argv[1])
    with open(os.path.join(sys.argv[1], "beklenen.json"), "w",
              encoding="utf-8") as f:
        json.dump(beklenen, f, ensure_ascii=False, indent=1)
    print(yol)
    for ad, o in beklenen["ozet"].items():
        print(f"  {ad:6} {o}")
