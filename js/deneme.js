// Deneme verisi: uygulamayı gerçek hasta girmeden denemek için uydurma
// hastalar. Hepsi `kaynak: "deneme"` taşır ve menüden tek dokunuşla silinir.
// Adlar ve sayılar UYDURMADIR.
import * as db from "./db.js";
import { bugun, VARSAYILAN_LISTELER } from "./model.js";

const ADLAR = ["Ayşe", "Mehmet", "Fatma", "Ali", "Zeynep", "Mustafa", "Elif", "Hüseyin",
  "Emine", "İbrahim", "Hatice", "Osman", "Merve", "Yusuf", "Selin", "Kemal", "Derya", "Hakan"];
const SOYADLAR = ["Örnek", "Deneme", "Sınama", "Taslak", "Kurgu", "Yapay", "Sanal", "Uydurma"];
const SAATLER = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
// Sağlıklı omuz için yaklaşık normal değerler.
const NORMAL = { Fleksiyon: 175, Abdüksiyon: 170, Ekstansiyon: 55, "İç rotasyon": 70, "Dış rotasyon": 85 };

const rastgele = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const sec = (l) => l[Math.floor(Math.random() * l.length)];

function gunOnce(n) {
  const t = new Date();
  t.setDate(t.getDate() - n);
  return bugun(t);
}

function hastaUret(saat, durum) {
  const kategori = Math.random() < 0.5 ? "rom" : "agri";
  const toplam = sec([15, 15, 15, 20, 20, 25, 30]);
  const seans = durum === "bitti" ? toplam : rastgele(1, toplam);
  return {
    id: db.yeniId(), ad: sec(ADLAR), soyad: sec(SOYADLAR), saat, kategori,
    taraf: kategori === "rom" ? sec(["sag", "sol"]) : null,
    toplam, seans, seansGunleri: [], durum, kaynak: "deneme",
    eklenme: gunOnce(Math.round(seans * 1.4)),
    ...(durum === "bitti" ? { bitis: gunOnce(rastgele(1, 10)) } : {}),
  };
}

// Seans ilerledikçe ağrı düşer, hareket açılır.
function olcumlerUret(h) {
  const olcumler = [];
  const anlar = [1];
  for (let s = 5; s < h.seans; s += 5) anlar.push(s);
  if (h.seans > 1) anlar.push(h.seans);
  const vasIlk = rastgele(6, 9);
  const vasSon = Math.max(0, vasIlk - rastgele(2, 6));
  const romIlk = {}, romSon = {};
  const hareketler = VARSAYILAN_LISTELER.hareketler.slice(0, rastgele(2, 5));
  for (const m of hareketler) {
    romIlk[m] = Math.round((NORMAL[m] * (0.35 + Math.random() * 0.25)) / 5) * 5;
    romSon[m] = Math.min(NORMAL[m], Math.round((romIlk[m] + NORMAL[m] * (0.2 + Math.random() * 0.35)) / 5) * 5);
  }
  anlar.forEach((seans, i) => {
    const oran = anlar.length > 1 ? i / (anlar.length - 1) : 0;
    // en yeni ölçüm dün: bugünkü VAS boş kalsın, dokunarak denenebilsin
    const tarih = gunOnce(Math.round((h.seans - seans) * 1.4) + 1);
    const zaman = Date.now() - (h.seans - seans + 1) * 86400000;
    olcumler.push({ id: db.yeniId(), hastaId: h.id, tarih, zaman, seans, tur: "vas",
      deger: Math.round(vasIlk + (vasSon - vasIlk) * oran) });
    if (h.kategori !== "rom") return;
    const saglikli = h.taraf === "sag" ? "sol" : "sag";
    for (const m of hareketler) {
      olcumler.push({ id: db.yeniId(), hastaId: h.id, tarih, zaman: zaman + 1, seans, tur: "rom",
        hareket: m, taraf: h.taraf, deger: Math.round((romIlk[m] + (romSon[m] - romIlk[m]) * oran) / 5) * 5 });
      if (i === 0) {
        olcumler.push({ id: db.yeniId(), hastaId: h.id, tarih, zaman: zaman + 2, seans, tur: "rom",
          hareket: m, taraf: saglikli, deger: NORMAL[m] - rastgele(0, 2) * 5 });
      }
    }
  });
  return olcumler;
}

function programUret(h) {
  const cihazlar = [...new Set([sec(["TENS", "TENS", "ES", "VAKUM IF"]), sec(["HOTPACK", "COLDPACK", "PARAFİN"]),
    ...(Math.random() < 0.5 ? ["US"] : [])])];
  const manuel = h.kategori === "rom" ? [{ ad: "MOB", bolge: "SKAPULA, OMUZ KAPSÜLÜ" }] : [];
  const egzersizler = VARSAYILAN_LISTELER.egzersizler.map((ad) => ({
    ad, set: 3, tekrar: sec([10, 12, 15]), agirlik: ad.startsWith("Dambıl") ? sec([0.5, 1, 1.5, 2]) : 0,
  }));
  return { id: db.yeniId(), hastaId: h.id, tarih: h.eklenme, zaman: Date.now() - 1e9, cihazlar, manuel, egzersizler };
}

const NOTLAR = ["Gece ağrısı azaldı.", "Egzersizleri evde düzenli yapıyor.", "Bugün ağrılı geldi, yük azaltıldı.",
  "Kola uzanmada zorlanma devam ediyor.", "Doktor kontrolü önümüzdeki hafta."];

export async function denemeEkle() {
  const hastalar = [];
  for (const saat of SAATLER) {
    for (let i = rastgele(1, 4); i > 0; i--) hastalar.push(hastaUret(saat, "aktif"));
  }
  // Son ölçüm hatırlatmasını görmek için en az iki hasta bitime yakın.
  hastalar[0].seans = hastalar[0].toplam - 1;
  hastalar[3].seans = hastalar[3].toplam;
  for (let i = 0; i < 3; i++) hastalar.push(hastaUret(sec(SAATLER), "bitti"));

  for (const h of hastalar) {
    await db.yaz("hastalar", h);
    for (const o of olcumlerUret(h)) await db.yaz("olcumler", o);
    await db.yaz("programlar", programUret(h));
    if (Math.random() < 0.4) {
      await db.yaz("notlar", { id: db.yeniId(), hastaId: h.id, tarih: gunOnce(rastgele(0, 5)),
        zaman: Date.now() - rastgele(0, 5) * 86400000, metin: sec(NOTLAR) });
    }
  }
  return hastalar.length;
}

export async function denemeSayisi() {
  return (await db.hepsi("hastalar")).filter((h) => h.kaynak === "deneme").length;
}

export async function denemeSil() {
  const deneme = (await db.hepsi("hastalar")).filter((h) => h.kaynak === "deneme");
  for (const h of deneme) {
    for (const depo of ["olcumler", "programlar", "notlar"]) {
      for (const k of await db.hastaninki(depo, h.id)) await db.sil(depo, k.id);
    }
    await db.sil("hastalar", h.id);
  }
  return deneme.length;
}
