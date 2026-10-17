// Veri katmanı: her şey telefondaki IndexedDB'de. Sunucu yok.
//
// Depolar:
//   hastalar   { id, ad, soyad, saat "14:00", kategori "agri"|"rom",
//                taraf "sag"|"sol"|null, toplam, seans, seansGunleri[],
//                durum "aktif"|"bitti", kaynak "elle"|"excel", eklenme, bitis }
//   olcumler   { id, hastaId, tarih "2026-10-14", seans, tur "vas"|"rom",
//                deger, hareket, taraf }
//   programlar { id, hastaId, tarih, cihazlar[], manuel[{ad, bolge}],
//                egzersizler[{ad, set, tekrar, agirlik}] }   — tarihli sürümler
//   notlar     { id, hastaId, tarih, zaman, metin }
//   ayar       { anahtar, deger }

const AD = "hasta-takip";
const SURUM = 1;
export const DEPOLAR = ["hastalar", "olcumler", "programlar", "notlar", "ayar"];

let baglanti;

function ac() {
  if (baglanti) return baglanti;
  baglanti = new Promise((coz, red) => {
    const istek = indexedDB.open(AD, SURUM);
    istek.onupgradeneeded = () => {
      const db = istek.result;
      for (const d of ["olcumler", "programlar", "notlar"]) {
        const depo = db.createObjectStore(d, { keyPath: "id" });
        depo.createIndex("hastaId", "hastaId");
      }
      db.createObjectStore("hastalar", { keyPath: "id" });
      db.createObjectStore("ayar", { keyPath: "anahtar" });
    };
    istek.onsuccess = () => coz(istek.result);
    istek.onerror = () => red(istek.error);
  });
  return baglanti;
}

function iste(istek) {
  return new Promise((coz, red) => {
    istek.onsuccess = () => coz(istek.result);
    istek.onerror = () => red(istek.error);
  });
}

async function depo(ad, kip = "readonly") {
  return (await ac()).transaction(ad, kip).objectStore(ad);
}

export const yeniId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function hepsi(ad) {
  return iste((await depo(ad)).getAll());
}

export async function al(ad, id) {
  return iste((await depo(ad)).get(id));
}

export async function yaz(ad, kayit) {
  await iste((await depo(ad, "readwrite")).put(kayit));
  return kayit;
}

export async function sil(ad, id) {
  return iste((await depo(ad, "readwrite")).delete(id));
}

export async function hastaninki(ad, hastaId) {
  return iste((await depo(ad)).index("hastaId").getAll(hastaId));
}

export async function ayarAl(anahtar, varsayilan) {
  const k = await al("ayar", anahtar);
  return k ? k.deger : varsayilan;
}

export function ayarYaz(anahtar, deger) {
  return yaz("ayar", { anahtar, deger });
}

// Yedek için: bütün depolar tek nesnede.
export async function disaAktar() {
  const veri = {};
  for (const d of DEPOLAR) veri[d] = await hepsi(d);
  return veri;
}

// Yedekten geri yükleme: mevcut veriyi TAMAMEN değiştirir.
export async function iceAktar(veri) {
  const db = await ac();
  const tx = db.transaction(DEPOLAR, "readwrite");
  for (const d of DEPOLAR) {
    const depo = tx.objectStore(d);
    depo.clear();
    for (const k of veri[d] || []) depo.put(k);
  }
  return new Promise((coz, red) => {
    tx.oncomplete = coz;
    tx.onerror = () => red(tx.error);
  });
}

// Tarayıcıdan verinin silinmemesini iste (ana ekrana eklenmiş uygulamada
// iOS zaten silmez; yine de soruyoruz).
export async function kaliciIste() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}
