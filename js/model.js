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
  // Listedeki sırayla (fleksiyon, abdüksiyon…); listede olmayanlar sona.
  const sira = (m) => {
    const i = VARSAYILAN_LISTELER.hareketler.indexOf(m);
    return i < 0 ? 99 : i;
  };
  const hareketler = [...new Set(olcumler.filter((o) => o.tur === "rom").map((o) => o.hareket))]
    .sort((a, b) => sira(a) - sira(b));
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

// ---------------------------------------------------------- gelişim

// Grafik için sıralı ölçüm dizisi.
export function seri(olcumler, suzgec) {
  return sirala(olcumler.filter(suzgec)).map((o) => ({ seans: o.seans, deger: o.deger, tarih: o.tarih }));
}

// Ağrının gidişatı: son iki VAS ölçümü. Düşüyorsa iyi.
export function gidisat(olcumler) {
  const l = seri(olcumler, (o) => o.tur === "vas");
  if (l.length < 2) return null;
  const fark = l[l.length - 1].deger - l[l.length - 2].deger;
  return fark < 0 ? "iyi" : fark > 0 ? "kotu" : "ayni";
}

export function selamlama(t = new Date()) {
  const s = t.getHours();
  return s >= 5 && s < 12 ? "Günaydın" : s >= 12 && s < 17 ? "İyi günler"
    : s >= 17 && s < 22 ? "İyi akşamlar" : "İyi geceler";
}

export const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
  "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export const ayAdi = (ay) => `${AYLAR[Number(ay.slice(5, 7)) - 1]} ${ay.slice(0, 4)}`;

export function ayKaydir(ay, adim) {
  const t = new Date(Number(ay.slice(0, 4)), Number(ay.slice(5, 7)) - 1 + adim, 1);
  return bugun(t).slice(0, 7);
}

/**
 * Bir ayın özeti ("2026-10"). olcumler/programlar: hastaId → liste.
 * - biten: o ay tedavisi biten hastalar
 * - agriAzalma: bitenlerde VAS ilk → son ortalama yüzde azalma (en az 2 ölçüm)
 * - rom: bitenlerde etkilenen tarafın hareket başına ortalama kazanımı (°)
 * - seans: o ay uygulamada "Seans yapıldı" denen seans sayısı
 * - cihazlar: o ay seansı olan hastaların programlarında en sık cihazlar
 */
export function ayOzeti(hastalar, olcumler, programlar, ay) {
  const biten = hastalar.filter((h) => h.durum === "bitti" && (h.bitis || "").startsWith(ay));

  const azalmalar = [];
  const kazanim = {};
  for (const h of biten) {
    const o = olcumler[h.id] || [];
    const v = vasOzet(o);
    if (v && v.sayi > 1 && v.ilk.deger > 0) azalmalar.push((v.ilk.deger - v.son.deger) / v.ilk.deger);
    if (h.kategori !== "rom") continue;
    for (const r of romOzet(o, h)) {
      const e = r.etkilenen;
      if (!e || e.sayi < 2) continue;
      (kazanim[r.hareket] ||= []).push(e.son.deger - e.ilk.deger);
    }
  }
  const ort = (l) => l.reduce((a, b) => a + b, 0) / l.length;

  let seans = 0;
  const cihazSay = {};
  for (const h of hastalar) {
    const n = (h.seansGunleri || []).filter((g) => g.startsWith(ay)).length;
    seans += n;
    if (!n) continue;
    for (const c of guncelProgram(programlar[h.id] || [])?.cihazlar || []) cihazSay[c] = (cihazSay[c] || 0) + 1;
  }

  return {
    biten: biten.length,
    agriAzalma: azalmalar.length ? Math.round(ort(azalmalar) * 100) : null,
    agriHasta: azalmalar.length,
    rom: Object.entries(kazanim).map(([hareket, l]) => ({ hareket, kazanim: Math.round(ort(l)), hasta: l.length })),
    seans,
    cihazlar: Object.entries(cihazSay).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ad, sayi]) => ({ ad, sayi })),
  };
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
