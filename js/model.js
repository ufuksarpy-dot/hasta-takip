// Ekrandan bağımsız kurallar. Saf fonksiyonlar: Node'da sınanır.
import { trKatla } from "./devam.js";

// Uygulama içinden genişletilebilen listelerin ilk hâli.
export const VARSAYILAN_LISTELER = {
  // Föy Yapıcı telefon sürümünden; ESWT istenmedi, PARAFİN eklendi.
  cihazlar: ["US", "HOTPACK", "COLDPACK", "VAKUM IF", "EGZ", "TENS", "ES", "PARAFİN"],
  manuel: ["MOB"],
  bolgeler: ["SKAPULA", "OMUZ KAPSÜLÜ", "BOYUN", "BEL", "OMUZ", "DİZ", "EL", "AYAK"],
  // Kullanıcı kendi listesini sonra verecek; şimdilik konuşmada geçenler.
  egzersizler: ["Dambıl omuz fleksiyon", "Oklava egzersizi"],
  hareketler: ["Fleksiyon", "Abdüksiyon", "Ekstansiyon", "İç rotasyon", "Dış rotasyon"],
};

export const SEANS_SECENEKLERI = [15, 20, 25, 30];

export function bugun(t = new Date()) {
  const y = t.getFullYear(), a = String(t.getMonth() + 1).padStart(2, "0"),
    g = String(t.getDate()).padStart(2, "0");
  return `${y}-${a}-${g}`;
}

export function tarihYaz(iso) {
  const [y, a, g] = iso.split("-");
  return `${g}.${a}.${y}`;
}

export const tamAd = (h) => `${h.ad} ${h.soyad}`.trim();

// Açılışta gösterilecek saat: şu anki saat bloğu; o saatte hasta yoksa
// sonraki ilk dolu saat; gün bittiyse son saat.
export function acilisSaati(saatler, simdi = new Date()) {
  if (!saatler.length) return null;
  const su = `${String(simdi.getHours()).padStart(2, "0")}:00`;
  return saatler.find((s) => s >= su) ?? saatler[saatler.length - 1];
}

export function saatListesi(hastalar) {
  return [...new Set(hastalar.map((h) => h.saat))].sort();
}

// Son ölçüm hatırlatması: son iki seansa girildiyse.
export const sonOlcumZamani = (h) => h.toplam - h.seans <= 1;

// Ölçümlerden ilk/son değer (tarih, sonra kayıt sırasına göre).
function sirala(liste) {
  return [...liste].sort((a, b) =>
    a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : a.zaman - b.zaman);
}

export function ilkSon(olcumler, suzgec) {
  const l = sirala(olcumler.filter(suzgec));
  if (!l.length) return null;
  return { ilk: l[0], son: l[l.length - 1], sayi: l.length };
}

export function vasOzet(olcumler) {
  return ilkSon(olcumler, (o) => o.tur === "vas");
}

// Hastanın ROM özeti: etkilenen tarafın her hareketi için ilk → son,
// yanında sağlıklı tarafın son değeri.
export function romOzet(olcumler, hasta) {
  const etkilenen = hasta.taraf || "sag";
  const saglikli = etkilenen === "sag" ? "sol" : "sag";
  const hareketler = [...new Set(olcumler.filter((o) => o.tur === "rom").map((o) => o.hareket))];
  return hareketler.map((hareket) => ({
    hareket,
    etkilenen: ilkSon(olcumler, (o) => o.tur === "rom" && o.hareket === hareket && o.taraf === etkilenen),
    saglikli: ilkSon(olcumler, (o) => o.tur === "rom" && o.hareket === hareket && o.taraf === saglikli),
  })).filter((x) => x.etkilenen || x.saglikli);
}

// Güncel program = en son tarihli sürüm.
export function guncelProgram(programlar) {
  return sirala(programlar).pop() || null;
}

export function programMetni(p) {
  if (!p) return "";
  const parca = [...p.cihazlar];
  for (const m of p.manuel) parca.push(m.bolge ? `${m.ad} (${m.bolge})` : m.ad);
  for (const e of p.egzersizler) parca.push(egzersizMetni(e));
  return parca.join(" + ");
}

export function egzersizMetni(e) {
  let s = `${e.ad} ${e.set}×${e.tekrar}`;
  if (e.agirlik) s += `, ${String(e.agirlik).replace(".", ",")} kg`;
  return s;
}

// ---------------------------------------------------------------- Excel

export const eslesmeAnahtari = (ad, soyad, saat) =>
  `${trKatla(ad)}|${trKatla(soyad)}|${saat}`;

// Excel'den gelen UFUK hastalarını uygulamadaki hastalarla karşılaştırır.
// Son söz Excel'in:
//   - eşleşen aktif hasta → seansı dosyadan güncellenir
//   - dosyada yeni olan açık hasta → eklenir (AĞRI dışındakiler için
//     kategori kullanıcıya sorulur)
//   - dosyada kapatılmış ve uygulamada aktif hasta → "Biten hastalar"
// Aynı saatte aynı adlı iki hasta olabilir: her uygulama hastası en fazla
// bir satırla eşleşir.
export function excelBirlestir(uygulama, excel) {
  const aktif = uygulama.filter((h) => h.durum === "aktif");
  const havuz = new Map();
  for (const h of aktif) {
    const k = eslesmeAnahtari(h.ad, h.soyad, h.saat);
    if (!havuz.has(k)) havuz.set(k, []);
    havuz.get(k).push(h);
  }
  const al = (x) => havuz.get(eslesmeAnahtari(x.ad, x.soyad, x.saat))?.shift();

  const guncellenen = [], yeni = [], biten = [];
  for (const x of excel.acik) {
    const h = al(x);
    if (h) {
      if (h.seans !== x.seans) guncellenen.push({ hasta: h, seans: x.seans });
    } else {
      yeni.push({
        ad: x.ad, soyad: x.soyad, saat: x.saat, seans: x.seans,
        toplam: x.plan > 0 ? x.plan : 15,
        kategori: trKatlaTur(x.tur) === "agri" ? "agri" : null,
        tur: x.tur,
      });
    }
  }
  for (const x of excel.kapali) {
    const h = al(x);
    if (h) biten.push({ hasta: h, seans: x.seans });
  }
  return { guncellenen, yeni, biten };
}

const trKatlaTur = (t) => trKatla(t || "");
