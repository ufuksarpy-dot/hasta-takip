// Şifreli yedek. Tarayıcının kendi şifreleme API'si (WebCrypto); dışarıdan
// kütüphane yok. Uygulamanın içinde PIN yok (kullanıcı istemedi); telefondaki
// veriyi telefonun kendi kilidi korur. Yedek dosyası ise telefondan ÇIKTIĞI
// için şifrelenir (AES-GCM, paroladan PBKDF2).

const kodla = new TextEncoder();
const coz = new TextDecoder();

const b64 = (tampon) => btoa(String.fromCharCode(...new Uint8Array(tampon)));
const b64den = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function turet(parola, tuz, tekrar, kullanim) {
  const ham = await crypto.subtle.importKey("raw", kodla.encode(parola), "PBKDF2", false,
    kullanim ? ["deriveKey"] : ["deriveBits"]);
  const yol = { name: "PBKDF2", salt: tuz, iterations: tekrar, hash: "SHA-256" };
  if (!kullanim) return crypto.subtle.deriveBits(yol, ham, 256);
  return crypto.subtle.deriveKey(yol, ham, { name: "AES-GCM", length: 256 }, false, kullanim);
}

// ---------------------------------------------------------------- Yedek

const YEDEK_TEKRAR = 310000;
const BICIM = "hasta-takip-yedek";

export async function yedekSifrele(veri, parola) {
  const tuz = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const anahtar = await turet(parola, tuz, YEDEK_TEKRAR, ["encrypt"]);
  const sifreli = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, anahtar,
    kodla.encode(JSON.stringify(veri)));
  return JSON.stringify({ bicim: BICIM, surum: 1, tuz: b64(tuz), iv: b64(iv), veri: b64(sifreli) });
}

// Parola yanlışsa ya da dosya bozuksa hata fırlatır.
export async function yedekCoz(metin, parola) {
  let d;
  try { d = JSON.parse(metin); } catch { throw new Error("Bu bir yedek dosyası değil."); }
  if (d.bicim !== BICIM) throw new Error("Bu bir yedek dosyası değil.");
  const anahtar = await turet(parola, b64den(d.tuz), YEDEK_TEKRAR, ["decrypt"]);
  try {
    const acik = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64den(d.iv) }, anahtar, b64den(d.veri));
    return JSON.parse(coz.decode(acik));
  } catch {
    throw new Error("Parola yanlış.");
  }
}
