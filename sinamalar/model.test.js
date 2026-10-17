import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acilisSaati, excelBirlestir, romOzet, vasOzet, programMetni, sonOlcumZamani,
  gidisat, selamlama, ayKaydir, ayAdi, ayOzeti,
} from "../js/model.js";

const saat = (s) => new Date(`2031-06-10T${s}:00`);

test("açılış saati", () => {
  const l = ["08:00", "10:00", "14:00"];
  assert.equal(acilisSaati(l, saat("10:25")), "10:00");
  assert.equal(acilisSaati(l, saat("09:10")), "10:00"); // boş saatte sonraki
  assert.equal(acilisSaati(l, saat("07:00")), "08:00");
  assert.equal(acilisSaati(l, saat("18:00")), "14:00"); // gün bitti
  assert.equal(acilisSaati([], saat("10:00")), null);
});

const hasta = (ad, saat, ek = {}) =>
  ({ id: ad + saat, ad, soyad: "Örnek", saat, seans: 3, durum: "aktif", ...ek });
const satir = (ad, saat, ek = {}) =>
  ({ ad, soyad: "Örnek", saat, seans: 5, plan: 0, tur: "ORTOPEDİ", ...ek });

test("Excel birleştirme: güncelle, ekle, bitir", () => {
  const app = [hasta("Ayşe", "10:00"), hasta("Ali", "11:00"), hasta("Can", "12:00"),
    hasta("Eski", "09:00", { durum: "bitti" })];
  const r = excelBirlestir(app, {
    acik: [satir("AYŞE ", "10:00"), satir("Yeni", "14:00", { tur: "AĞRI", plan: 20 }),
      satir("Diğer", "15:00"), satir("Can", "12:00", { seans: 3 })],
    kapali: [satir("ali", "11:00", { seans: 15 }), satir("Eski", "09:00")],
  });
  assert.deepEqual(r.guncellenen.map((x) => [x.hasta.ad, x.seans]), [["Ayşe", 5]]);
  assert.deepEqual(r.biten.map((x) => x.hasta.ad), ["Ali"]);
  assert.deepEqual(r.yeni.map((x) => [x.ad, x.kategori, x.toplam]),
    [["Yeni", "agri", 20], ["Diğer", null, 15]]);
});

test("Excel birleştirme: aynı saatte aynı adlı iki hasta", () => {
  const app = [hasta("A.K.", "19:00")];
  const r = excelBirlestir(app, { acik: [satir("A.K.", "19:00"), satir("A.K.", "19:00")], kapali: [] });
  assert.equal(r.guncellenen.length, 1);
  assert.equal(r.yeni.length, 1);
});

test("VAS ve ROM özeti", () => {
  const o = [
    { tur: "vas", deger: 8, tarih: "2031-06-01", zaman: 1 },
    { tur: "vas", deger: 5, tarih: "2031-06-05", zaman: 2 },
    { tur: "vas", deger: 3, tarih: "2031-06-10", zaman: 3 },
    { tur: "rom", hareket: "Fleksiyon", taraf: "sag", deger: 150, tarih: "2031-06-10", zaman: 5 },
    { tur: "rom", hareket: "Fleksiyon", taraf: "sag", deger: 90, tarih: "2031-06-01", zaman: 4 },
    { tur: "rom", hareket: "Fleksiyon", taraf: "sol", deger: 175, tarih: "2031-06-01", zaman: 6 },
    { tur: "rom", hareket: "Abdüksiyon", taraf: "sol", deger: 170, tarih: "2031-06-01", zaman: 7 },
  ];
  const v = vasOzet(o);
  assert.equal(v.ilk.deger, 8);
  assert.equal(v.son.deger, 3);
  const r = romOzet(o, { taraf: "sag" });
  assert.equal(r[0].hareket, "Fleksiyon");
  assert.equal(r[0].etkilenen.ilk.deger, 90);
  assert.equal(r[0].etkilenen.son.deger, 150);
  assert.equal(r[0].saglikli.son.deger, 175);
  assert.equal(r[1].etkilenen, null);
});

test("program metni", () => {
  assert.equal(programMetni({
    cihazlar: ["TENS", "COLDPACK"], manuel: [{ ad: "MOB", bolge: "SKAPULA" }],
    egzersizler: [{ ad: "Dambıl", set: 3, tekrar: 10, agirlik: 1.5 }],
  }), "TENS + COLDPACK + MOB (SKAPULA) + Dambıl 3×10, 1,5 kg");
});

test("son ölçüm hatırlatması", () => {
  assert.equal(sonOlcumZamani({ seans: 13, toplam: 15 }), false);
  assert.equal(sonOlcumZamani({ seans: 14, toplam: 15 }), true);
});

test("gidişat: son iki VAS", () => {
  const v = (deger, zaman) => ({ tur: "vas", deger, tarih: "2031-06-01", zaman });
  assert.equal(gidisat([v(8, 1)]), null);
  assert.equal(gidisat([v(8, 1), v(5, 2)]), "iyi");
  assert.equal(gidisat([v(5, 2), v(8, 1), v(5, 3)]), "ayni");
  assert.equal(gidisat([v(3, 1), v(6, 2)]), "kotu");
});

test("selamlama", () => {
  assert.equal(selamlama(new Date("2031-06-10T08:00:00")), "Günaydın");
  assert.equal(selamlama(new Date("2031-06-10T13:00:00")), "İyi günler");
  assert.equal(selamlama(new Date("2031-06-10T19:00:00")), "İyi akşamlar");
  assert.equal(selamlama(new Date("2031-06-10T23:30:00")), "İyi geceler");
});

test("ay kaydırma", () => {
  assert.equal(ayKaydir("2031-01", -1), "2030-12");
  assert.equal(ayKaydir("2031-12", 1), "2032-01");
  assert.equal(ayAdi("2031-06"), "Haziran 2031");
});

test("ay özeti", () => {
  const h = (id, ek) => ({ id, kategori: "agri", durum: "aktif", seansGunleri: [], ...ek });
  const hastalar = [
    h("a", { durum: "bitti", bitis: "2031-06-20", seansGunleri: ["2031-06-01", "2031-06-02"] }),
    h("b", { durum: "bitti", bitis: "2031-06-25", kategori: "rom", taraf: "sag" }),
    h("c", { durum: "bitti", bitis: "2031-05-30" }),
    h("d", { seansGunleri: ["2031-06-03", "2031-05-03"] }),
  ];
  const vas = (deger, zaman) => ({ tur: "vas", deger, tarih: "2031-06-01", zaman });
  const rom = (deger, zaman) => ({ tur: "rom", hareket: "Fleksiyon", taraf: "sag", deger, tarih: "2031-06-01", zaman });
  const olcumler = { a: [vas(8, 1), vas(2, 2)], b: [vas(10, 1), vas(5, 2), rom(90, 3), rom(150, 4)], c: [vas(9, 1), vas(0, 2)] };
  const programlar = { a: [{ tarih: "2031-06-01", zaman: 1, cihazlar: ["TENS", "US"] }], d: [{ tarih: "2031-06-01", zaman: 1, cihazlar: ["TENS"] }] };
  const o = ayOzeti(hastalar, olcumler, programlar, "2031-06");
  assert.equal(o.biten, 2);
  assert.equal(o.agriAzalma, 63); // (75% + 50%) / 2 = 62.5 → 63
  assert.deepEqual(o.rom, [{ hareket: "Fleksiyon", kazanim: 60, hasta: 1 }]);
  assert.equal(o.seans, 3);
  assert.deepEqual(o.cihazlar, [{ ad: "TENS", sayi: 2 }, { ad: "US", sayi: 1 }]);
});
