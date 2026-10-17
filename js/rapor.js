// Foto özet: doktora WhatsApp'la gidecek tek görsel (PNG).
// Tasarım uygulamayla aynı: koyu zemin, ROM turkuaz, VAS kırmızı → yeşil.
import { tamAd, tarihYaz, vasOzet, romOzet, guncelProgram, programMetni } from "./model.js";

const G = 1080;          // genişlik
const K = 64;            // kenar boşluğu
const R = {
  zemin: "#101217", kart: "#1B1E25", cizgi: "#2C2C2A", yazi: "#F1EFE8",
  soluk: "#888780", rom: "#5DCAA5", romZemin: "#085041", romAcik: "#9FE1CB",
  agriZemin: "#633806", agriAcik: "#FAC775", kotu: "#F09595", iyi: "#97C459",
};
const YAZI = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';

function yuvarlak(c, x, y, g, y2, r) {
  c.beginPath();
  c.roundRect(x, y, g, y2, r);
  c.fill();
}

function satirlaraBol(c, metin, genislik) {
  const kelimeler = metin.split(" ");
  const satirlar = [];
  let su = "";
  for (const k of kelimeler) {
    const dene = su ? su + " " + k : k;
    if (c.measureText(dene).width > genislik && su) { satirlar.push(su); su = k; }
    else su = dene;
  }
  if (su) satirlar.push(su);
  return satirlar;
}

function rozet(c, x, y, metin, zemin, renk) {
  c.font = `600 26px ${YAZI}`;
  const g = c.measureText(metin).width + 36;
  c.fillStyle = zemin;
  yuvarlak(c, x, y, g, 48, 24);
  c.fillStyle = renk;
  c.fillText(metin, x + 18, y + 33);
  return x + g + 12;
}

// Hastanın verisinden PNG Blob üretir.
export async function ozetCiz(hasta, olcumler, programlar) {
  const vas = vasOzet(olcumler);
  const rom = hasta.kategori === "rom" ? romOzet(olcumler, hasta) : [];
  const program = programMetni(guncelProgram(programlar));
  const tarihler = [...olcumler.map((o) => o.tarih), ...(hasta.seansGunleri || [])].sort();
  const bas = hasta.eklenme?.slice(0, 10) || tarihler[0];
  const son = tarihler[tarihler.length - 1] || bas;

  const olcu = document.createElement("canvas").getContext("2d");
  olcu.font = `400 28px ${YAZI}`;
  const programSatir = program ? satirlaraBol(olcu, program, G - 2 * K - 56) : [];
  const romY = rom.length ? 90 + rom.length * 104 + 40 : 0;
  const Y = 120 + 70 + 80 + 40 + (vas ? 150 : 0) + romY + (programSatir.length ? 90 + programSatir.length * 40 : 0) + 110;

  const tuval = document.createElement("canvas");
  tuval.width = G;
  tuval.height = Y;
  const c = tuval.getContext("2d");
  c.fillStyle = R.zemin;
  c.fillRect(0, 0, G, Y);

  let y = K + 30;
  c.fillStyle = R.soluk;
  c.font = `600 26px ${YAZI}`;
  c.fillText(`TEDAVİ ÖZETİ${bas ? " · " + tarihYaz(bas) + " – " + tarihYaz(son) : ""}`, K, y);
  y += 76;
  c.fillStyle = R.yazi;
  c.font = `700 60px ${YAZI}`;
  c.fillText(tamAd(hasta), K, y);
  y += 36;

  let x = K;
  if (hasta.kategori === "rom") {
    x = rozet(c, x, y, hasta.taraf === "sol" ? "Sol taraf" : hasta.taraf === "sag" ? "Sağ taraf" : "ROM", R.romZemin, R.romAcik);
  } else {
    x = rozet(c, x, y, "Ağrı", R.agriZemin, R.agriAcik);
  }
  rozet(c, x, y, `${hasta.seans} seans`, R.cizgi, "#D3D1C7");
  y += 48 + 40;

  if (vas) {
    c.fillStyle = R.kart;
    yuvarlak(c, K, y, G - 2 * K, 120, 28);
    c.fillStyle = R.soluk;
    c.font = `400 30px ${YAZI}`;
    c.fillText("Ağrı (VAS)", K + 32, y + 72);
    c.font = `700 64px ${YAZI}`;
    const sag = G - K - 32;
    const sonM = String(vas.son.deger), ilkM = String(vas.ilk.deger);
    let xx = sag - c.measureText(sonM).width;
    if (vas.sayi === 1) {
      c.fillStyle = R.yazi;
      c.fillText(sonM, xx, y + 84);
    } else {
      c.fillStyle = vas.son.deger < vas.ilk.deger ? R.iyi : R.kotu;
      c.fillText(sonM, xx, y + 84);
      c.font = `400 44px ${YAZI}`;
      xx -= 80;
      c.fillStyle = R.soluk;
      c.fillText("→", xx + 14, y + 78);
      c.font = `700 64px ${YAZI}`;
      xx -= c.measureText(ilkM).width + 6;
      c.fillStyle = R.kotu;
      c.fillText(ilkM, xx, y + 84);
    }
    y += 150;
  }

  if (rom.length) {
    const yuk = 60 + rom.length * 104;
    c.fillStyle = R.kart;
    yuvarlak(c, K, y, G - 2 * K, yuk, 28);
    let yy = y + 56;
    c.font = `600 24px ${YAZI}`;
    c.fillStyle = R.soluk;
    c.fillText("HAREKET", K + 32, yy - 4);
    c.textAlign = "right";
    c.fillText("İLK → SON", G - K - 220, yy - 4);
    c.fillText("SAĞLIKLI", G - K - 32, yy - 4);
    c.textAlign = "left";
    yy += 20;
    for (const r of rom) {
      yy += 44;
      c.fillStyle = R.yazi;
      c.font = `400 32px ${YAZI}`;
      c.fillText(r.hareket, K + 32, yy);
      c.textAlign = "right";
      c.font = `700 34px ${YAZI}`;
      const e = r.etkilenen;
      c.fillText(e ? (e.sayi > 1 ? `${e.ilk.deger}° → ${e.son.deger}°` : `${e.son.deger}°`) : "—", G - K - 220, yy);
      c.font = `400 32px ${YAZI}`;
      c.fillStyle = R.soluk;
      c.fillText(r.saglikli ? `${r.saglikli.son.deger}°` : "—", G - K - 32, yy);
      c.textAlign = "left";
      // ilerleme çubuğu: sağlıklı tarafa göre
      const hedef = r.saglikli?.son.deger || 180;
      const oran = e ? Math.min(1, e.son.deger / hedef) : 0;
      c.fillStyle = R.cizgi;
      yuvarlak(c, K + 32, yy + 22, G - 2 * K - 64, 10, 5);
      if (oran > 0) {
        c.fillStyle = R.rom;
        yuvarlak(c, K + 32, yy + 22, (G - 2 * K - 64) * oran, 10, 5);
      }
      yy += 60;
    }
    y += yuk + 20;
    c.fillStyle = R.soluk;
    c.font = `400 24px ${YAZI}`;
    c.fillText("Çubuk: sağlıklı tarafa göre", K, y + 4);
    y += 40;
  }

  if (programSatir.length) {
    y += 20;
    c.fillStyle = R.soluk;
    c.font = `600 24px ${YAZI}`;
    c.fillText("PROGRAM", K, y);
    y += 46;
    c.fillStyle = "#D3D1C7";
    c.font = `400 28px ${YAZI}`;
    for (const s of programSatir) { c.fillText(s, K, y); y += 40; }
  }

  // Yükseklik baştan cömert tahmin edildi; çizilen yere göre kırp.
  const kirp = document.createElement("canvas");
  kirp.width = G;
  kirp.height = Math.min(Y, Math.ceil(y + K - 10));
  kirp.getContext("2d").drawImage(tuval, 0, 0);
  return new Promise((coz) => kirp.toBlob(coz, "image/png"));
}
