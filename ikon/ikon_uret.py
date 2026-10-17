"""Ana ekran ikonu: koyu zemin üstünde gonyometre yayı. Dolu kısım kırmızıdan
yeşile geçer (ağrıdan iyileşmeye, pozitif ilerleme); ibre yeşilin ucunda.

    python ikon/ikon_uret.py
"""
import math
import os

from PIL import Image, ImageDraw

ZEMIN = (16, 18, 23)
GRI = (44, 44, 42)
# yayın başından ibreye: kırmızı → turuncu → yeşil (uygulamanın renkleri)
DURAKLAR = [(0.0, (226, 75, 74)), (0.5, (239, 159, 39)), (1.0, (93, 202, 165))]


def renk(t):
    for (t1, r1), (t2, r2) in zip(DURAKLAR, DURAKLAR[1:]):
        if t <= t2:
            k = (t - t1) / (t2 - t1)
            return tuple(round(a + (b - a) * k) for a, b in zip(r1, r2))
    return DURAKLAR[-1][1]
KLASOR = os.path.dirname(os.path.abspath(__file__))


def ciz(boyut):
    o = 4  # yumuşak kenar için büyük çiz, sonra küçült
    b = boyut * o
    im = Image.new("RGB", (b, b), ZEMIN)
    c = ImageDraw.Draw(im)
    r = b * 0.32
    kal = int(b * 0.09)
    mx, my = b / 2, b * 0.62
    kutu = [mx - r, my - r, mx + r, my + r]
    c.arc(kutu, 180, 360, fill=GRI, width=kal)
    x = mx + (r - kal / 2) * math.cos(math.radians(360))
    y = my
    c.ellipse([x - kal / 2, y - kal / 2, x + kal / 2, y + kal / 2], fill=GRI)
    # renk geçişi: yarım derecelik dilimler, araları boşluk kalmasın diye üst üste
    BAS, SON = 180, 300
    adim = 0.5
    a = BAS
    while a < SON:
        c.arc(kutu, a, min(SON, a + adim * 2), fill=renk((a - BAS) / (SON - BAS)), width=kal)
        a += adim
    for aci, t in ((BAS, 0.0), (SON, 1.0)):  # yuvarlak uçlar
        x = mx + (r - kal / 2) * math.cos(math.radians(aci))
        y = my + (r - kal / 2) * math.sin(math.radians(aci))
        c.ellipse([x - kal / 2, y - kal / 2, x + kal / 2, y + kal / 2], fill=renk(t))
    # merkez nokta ve ibre
    ux = mx + r * 0.62 * math.cos(math.radians(300))
    uy = my + r * 0.62 * math.sin(math.radians(300))
    c.line([mx, my, ux, uy], fill=(241, 239, 232), width=int(b * 0.03))
    n = b * 0.045
    c.ellipse([mx - n, my - n, mx + n, my + n], fill=(241, 239, 232))
    return im.resize((boyut, boyut), Image.LANCZOS)


for boyut in (180, 192, 512):
    ciz(boyut).save(os.path.join(KLASOR, f"ikon-{boyut}.png"))
print("tamam")
