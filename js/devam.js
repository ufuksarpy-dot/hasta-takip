// Devam dosyası (.xls) okuyucu — ImzaKontrol'deki python/devam.py'nin
// JavaScript karşılığı. Kurallar ve ölçümler ImzaKontrol CLAUDE.md'de
// ("Devam dosyasının yapısı", "AÇIK / KAPALI — renk kuralı").
//
// Bu modül dosyayı kendisi açmaz: SheetJS ile okunmuş çalışma kitabını alır
//   XLSX.read(veri, { cellStyles: true, sheetStubs: true })
// Böylece hem tarayıcıda (vendor/xlsx.full.min.js) hem Node'da (sınamalar)
// aynı kod koşar.
//
// Özet:
// - fizyoterapist sayfası = "ADI" başlığı + aynı sütunda "Saat HH:MM"
//   başlıkları; gizli değil; adı YEDEK ile başlamıyor
// - kapalı = ayın son gün sütunu (31) BOYALI
// - boyalı = dolgulu VE beyaz değil VE sütunun şablon renginden farklı;
//   şablon rengi aynı sayfanın boş satırlarından (sütun başına en sık)
// - masaj hiç alınmaz
// - seans = ö.Seans (boş → 0) + bu ay gelinen gün (1'ler)
// - akşamcı fizyoterapistin 08:00 bloğu = 20:00

const S_SIRA = 1, S_AD = 2, S_SOYAD = 3, S_TUR = 7, S_SEANS = 8, S_OSEANS = 9;
const S_GUN1 = 10;

const DISLANAN_SAYFALAR = ["YEDEK"];
const BEYAZ = "FFFFFF";

export function trBuyuk(s) {
  return s.replace(/i/g, "İ").replace(/ı/g, "I").toLocaleUpperCase("tr");
}

// Arama için: "umit", "ÜMİT", "ümıt" hepsi aynı.
export function trKatla(s) {
  return s.trim().toLocaleLowerCase("tr")
    .replace(/[ıöüşğçâîû]/g, (h) => "iousgcaiu"["ıöüşğçâîû".indexOf(h)]);
}

function hucre(ws, r, c) {
  let ad = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    ad = String.fromCharCode(65 + ((n - 1) % 26)) + ad;
  }
  return ws[ad + (r + 1)];
}

function metin(ws, r, c) {
  const h = hucre(ws, r, c);
  if (!h || h.v == null) return "";
  return String(h.v).trim();
}

function sayi(ws, r, c) {
  const n = parseInt(metin(ws, r, c).replace(",", "."), 10);
  return Number.isNaN(n) ? 0 : n;
}

// null = dolgusuz; yoksa renk anahtarı ("RRGGBB" ya da "#dizin").
function renk(ws, r, c) {
  const s = hucre(ws, r, c)?.s;
  if (!s || !s.patternType || s.patternType === "none") return null;
  const f = s.fgColor || {};
  if (f.rgb) return f.rgb.toUpperCase().slice(-6);
  if (f.indexed != null) return "#" + f.indexed;
  return null;
}

const SAAT = /^\s*SAAT\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*$/;

function saatBasligi(ws, r, c) {
  const m = SAAT.exec(trBuyuk(metin(ws, r, c)));
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

function sayfaSiniri(ws) {
  const ref = ws["!ref"];
  if (!ref) return { satir: 0, sutun: 0 };
  const son = ref.split(":").pop().match(/([A-Z]+)(\d+)/);
  let sutun = 0;
  for (const h of son[1]) sutun = sutun * 26 + h.charCodeAt(0) - 64;
  return { satir: Number(son[2]), sutun };
}

// Sayfanın sütun yerleşimi; fizyoterapist yapısında değilse null.
function duzenBul(ws) {
  const sinir = sayfaSiniri(ws);
  for (let r = 0; r < sinir.satir; r++) {
    for (let c = 1; c < Math.min(sinir.sutun, 12); c++) {
      if (trBuyuk(metin(ws, r, c)) !== "ADI") continue;
      const k = c - S_AD;
      const d = {
        baslik: r, sira: S_SIRA + k, ad: c, soyad: S_SOYAD + k,
        tur: S_TUR + k, seans: S_SEANS + k, oseans: S_OSEANS + k,
        gun1: S_GUN1 + k,
      };
      for (let cc = c; cc < sinir.sutun; cc++) {
        const m = trBuyuk(metin(ws, r, cc)).replace(/ /g, "");
        if (m === "TÜRÜ") d.tur = cc;
        else if (m === "SEANS") d.seans = cc;
        else if (["Ö.SEANS", "ÖSEANS", "Ö.SEANSI"].includes(m)) d.oseans = cc;
        else if (m === "1" && metin(ws, r, cc + 1) === "2") { d.gun1 = cc; break; }
      }
      d.gun31 = d.gun1 + 30;
      if (sinir.sutun <= d.gun31) return null;
      for (let rr = 0; rr < sinir.satir; rr++) {
        if (saatBasligi(ws, rr, c)) return d;
      }
    }
  }
  return null;
}

function sayfaOku(ws, d) {
  const sinir = sayfaSiniri(ws);
  const satirlar = []; // { r, saat, hasta }
  let saat = null;
  for (let r = 0; r < sinir.satir; r++) {
    if (r === d.baslik) continue;
    const s = saatBasligi(ws, r, d.ad);
    if (s) { saat = s; continue; }
    if (!saat) continue;
    const sira = metin(ws, r, d.sira);
    const ad = metin(ws, r, d.ad);
    if (sira) {
      satirlar.push({ r, saat, hasta: ad !== "" });
    } else if (ad) {
      // sıra no'su silinmiş ama gelinmiş/gelinmemiş işareti olan satır
      for (let c = d.gun1; c <= d.gun31; c++) {
        const v = metin(ws, r, c);
        if (v === "1" || v === "0") { satirlar.push({ r, saat, hasta: true }); break; }
      }
    }
  }

  const bos = satirlar.filter((x) => !x.hasta).map((x) => x.r);
  const sablon = {};
  for (let c = d.gun1; c <= d.gun31; c++) {
    const say = new Map();
    for (const r of bos) {
      const k = renk(ws, r, c);
      say.set(k, (say.get(k) || 0) + 1);
    }
    let enIyi = null, enCok = 0;
    for (const [k, n] of say) if (n > enCok) { enIyi = k; enCok = n; }
    sablon[c] = enIyi;
  }
  const boyali = (r, c) => {
    const k = renk(ws, r, c);
    return k !== null && k !== BEYAZ && k !== sablon[c];
  };

  const hastalar = [];
  for (const { r, saat: blok, hasta } of satirlar) {
    if (!hasta) continue;
    let gelis = 0;
    for (let c = d.gun1; c <= d.gun31; c++) if (metin(ws, r, c) === "1") gelis++;
    const tur = metin(ws, r, d.tur);
    hastalar.push({
      satir: r, blok, saat: blok,
      ad: metin(ws, r, d.ad), soyad: metin(ws, r, d.soyad),
      tur, plan: sayi(ws, r, d.seans),
      seans: sayi(ws, r, d.oseans) + gelis,
      acik: !boyali(r, d.gun31),
      masaj: trBuyuk(tur) === "MASAJ",
    });
  }
  return hastalar;
}

// "18:00 ve 19:00'da hasta alıyorsa akşamcı, 9 ve 10'da alıyorsa sabahçı".
function vardiyaUygula(hastalar) {
  const aksam = hastalar.filter((h) => h.blok === "18:00" || h.blok === "19:00").length;
  const sabah = hastalar.filter((h) => h.blok === "09:00" || h.blok === "10:00").length;
  const aksamci = aksam > sabah;
  for (const h of hastalar) h.saat = aksamci && h.blok === "08:00" ? "20:00" : h.blok;
  hastalar.sort((a, b) => (a.saat < b.saat ? -1 : a.saat > b.saat ? 1 : a.satir - b.satir));
  return aksamci ? "aksam" : "sabah";
}

// Bütün fizyoterapist sayfaları: [{ ad, vardiya, hastalar }]
export function devamOku(wb) {
  const sonuc = [];
  wb.SheetNames.forEach((ad, i) => {
    const buyuk = trBuyuk(ad.trim());
    if (DISLANAN_SAYFALAR.some((x) => buyuk.startsWith(x))) return;
    if (wb.Workbook?.Sheets?.[i]?.Hidden) return;
    const ws = wb.Sheets[ad];
    const d = duzenBul(ws);
    if (!d) return;
    const hastalar = sayfaOku(ws, d);
    const vardiya = vardiyaUygula(hastalar);
    sonuc.push({ ad: ad.trim(), vardiya, hastalar });
  });
  return sonuc;
}

// Uygulamanın aldığı tek sayfa: UFUK. Açık ve masaj olmayan hastalar.
export const SAYFA = "UFUK";

export function benimHastalarim(wb, sayfa = SAYFA) {
  const f = devamOku(wb).find((x) => trBuyuk(x.ad) === trBuyuk(sayfa));
  if (!f) return null;
  return {
    vardiya: f.vardiya,
    acik: f.hastalar.filter((h) => h.acik && !h.masaj),
    kapali: f.hastalar.filter((h) => !h.acik && !h.masaj),
  };
}
