// Excel okuyucuyu sentetik devam dosyasına karşı sınar.
// Dosya ve beklenen sonuç sentetik.py ile her koşuda yeniden üretilir;
// gerçek dosya projeye girmez.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { devamOku, benimHastalarim, trKatla } from "../js/devam.js";

const kok = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")));
const python = path.join(kok, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "hasta-takip-"));
execFileSync(python, [path.join(kok, "sinamalar", "sentetik.py"), klasor], { stdio: "ignore" });
const beklenen = JSON.parse(fs.readFileSync(path.join(klasor, "beklenen.json"), "utf8"));
const wb = XLSX.read(fs.readFileSync(path.join(klasor, beklenen.dosya)),
  { cellStyles: true, sheetStubs: true });
const okunan = devamOku(wb);

test("fizyoterapist sayfaları (YEDEK ve başka yapıdakiler hariç)", () => {
  assert.deepEqual(okunan.map((f) => f.ad).sort(),
    Object.keys(beklenen.fizyoterapistler).sort());
});

test("vardiya", () => {
  for (const f of okunan) assert.equal(f.vardiya, beklenen.vardiya[f.ad], f.ad);
});

test("açık, masaj olmayan hastalar: saat, ad, soyad, seans", () => {
  for (const f of okunan) {
    const kutu = f.hastalar.filter((h) => h.acik && !h.masaj)
      .map(({ saat, satir, ad, soyad, seans }) => ({ saat, satir, ad, soyad, seans }));
    const bek = beklenen.fizyoterapistler[f.ad]
      .map(({ saat, satir, ad, soyad, seans }) => ({ saat, satir, ad, soyad, seans }));
    assert.deepEqual(kutu, bek, f.ad);
  }
});

test("her hastanın açık/kapalı ve masaj durumu", () => {
  for (const f of okunan) {
    const bek = new Map(beklenen.tum_hastalar[f.ad].map((h) => [h.satir, h]));
    assert.equal(f.hastalar.length, bek.size, f.ad);
    for (const h of f.hastalar) {
      assert.equal(h.acik, bek.get(h.satir).acik, `${f.ad} satır ${h.satir}`);
      assert.equal(h.masaj, bek.get(h.satir).masaj, `${f.ad} satır ${h.satir}`);
    }
  }
});

test("tek sayfa seçimi büyük/küçük harfe duyarsız", () => {
  const b = benimHastalarim(wb, "ilker");
  assert.equal(b.acik.length, beklenen.ozet["İlker"].kutu);
  assert.equal(benimHastalarim(wb, "YOK"), null);
});

test("arama katlaması", () => {
  assert.equal(trKatla("ÜMİT"), "umit");
  assert.equal(trKatla("ümıt "), "umit");
  assert.equal(trKatla("Işıl"), "isil");
});
