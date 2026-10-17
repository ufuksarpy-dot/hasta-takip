// Dokunma hareketleri: yatay kaydırma, kenardan geri kaydırma, basılı tutma,
// basılı tutunca tekrarlama. Pointer olayları — iPhone Safari 13+ destekliyor.
//
// Sürüklenen kontroller (VAS çizgisi, ROM yayı, kaydırmalı çip satırı)
// `data-kaydirma="yok"` taşır: üzerlerinde başlayan hareket sayfa
// kaydırması sayılmaz.

const ESIK = 60;          // yatay kaydırma için en az piksel
const KENAR = 28;         // kenardan geri kaydırma bölgesi
const UZUN = 450;         // basılı tutma süresi (ms)
const TEKRAR_BASLA = 380; // −/+ basılı tutunca tekrar başlama (ms)
const TEKRAR_ARA = 90;

// Tıklamayı bastır: basılı tutma, kaydırma ya da sürükleme zaten iş yaptıysa,
// parmak kalkınca gelen "click" ikinci kez yapmasın. Süreli: ekran araya
// yeniden çizilirse click hiç gelmeyebilir; o zaman bir SONRAKİ dokunuş
// yutulmamalı.
let yutBitis = 0;
let bekleyenYutma = false; // basılı tutma sürüyor: parmak kalkınca yut
const yut = () => { yutBitis = Date.now() + 400; };
export function tiklamaYutulsunMu() {
  return Date.now() < yutBitis;
}

/**
 * kok: dinlenen öğe
 * secenek: {
 *   surukluyor(dx)       — yatay kaydırma sürerken (sayfa parmağı izlesin)
 *   birakti(yon | null)  — yatay kaydırma bitti: "sol" | "sag" ya da
 *                          null (yeterince kaydırılmadı: yerine dön)
 *   kenardanGeri()       — sol kenardan sağa kaydırma
 *   uzunBas(el)          — [data-uzun] taşıyan öğede basılı tutma
 *   tekrar(el)           — [data-tekrar] taşıyan öğede basılı tutma süresince
 * }
 */
export function dokunmaDinle(kok, secenek) {
  let bas = null;         // { x, y, t, kenar, kilitli, yon }
  let uzunZ = null, tekrarZ = null, tekrarA = null;

  const temizle = () => {
    clearTimeout(uzunZ);
    clearTimeout(tekrarZ);
    clearInterval(tekrarA);
    uzunZ = tekrarZ = tekrarA = null;
  };

  kok.addEventListener("pointerdown", (o) => {
    if (o.pointerType === "mouse" && o.button !== 0) return;
    const kilitli = !!o.target.closest('[data-kaydirma="yok"], input, textarea');
    // yon: hareketin ilk 12 pikselinde belirlenir, sonra değişmez
    bas = { x: o.clientX, y: o.clientY, t: Date.now(), kenar: o.clientX < KENAR, kilitli, yon: null };
    temizle();

    const uzun = o.target.closest("[data-uzun]");
    if (uzun && secenek.uzunBas) {
      uzunZ = setTimeout(() => {
        bekleyenYutma = true;
        bas = null;
        uzun.classList.add("basildi");
        setTimeout(() => uzun.classList.remove("basildi"), 250);
        secenek.uzunBas(uzun);
      }, UZUN);
    }

    const tekrar = o.target.closest("[data-tekrar]");
    if (tekrar && secenek.tekrar) {
      tekrarZ = setTimeout(() => {
        bekleyenYutma = true;
        // ekran her adımda yeniden çizildiği için öğenin kopyası değil
        // veri kümesi saklanır
        const veri = { ...tekrar.dataset };
        secenek.tekrar(veri);
        tekrarA = setInterval(() => secenek.tekrar(veri), TEKRAR_ARA);
      }, TEKRAR_BASLA);
    }
  });

  kok.addEventListener("pointermove", (o) => {
    if (!bas) return;
    const dx = o.clientX - bas.x, dy = o.clientY - bas.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearTimeout(uzunZ);
      clearTimeout(tekrarZ);
    }
    if (bas.kilitli) return;
    if (!bas.yon && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      bas.yon = Math.abs(dx) > Math.abs(dy) * 1.2 ? "yatay" : "dikey";
    }
    if (bas.yon === "yatay" && !bas.kenar) secenek.surukluyor?.(dx);
  });

  const bitir = (o) => {
    temizle();
    if (!bas) return;
    const dx = o.clientX - bas.x, dy = o.clientY - bas.y;
    const b = bas;
    bas = null;
    // parmak belirgin oynadıysa bu bir dokunuş değil
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) yut();
    if (b.kilitli || b.yon !== "yatay") return;
    // ya yeterince uzun ya da kısa ama hızlı bir fiske
    const sure = Date.now() - b.t;
    const kabul = o.type !== "pointercancel" && (Math.abs(dx) > ESIK || (Math.abs(dx) > 30 && sure < 250));
    if (b.kenar) {
      if (kabul && dx > 0) secenek.kenardanGeri?.();
      return;
    }
    secenek.birakti?.(kabul ? (dx < 0 ? "sol" : "sag") : null);
  };
  kok.addEventListener("pointerup", bitir);
  kok.addEventListener("pointercancel", bitir);
  const birakti = () => {
    temizle();
    if (bekleyenYutma) { bekleyenYutma = false; yut(); }
  };
  document.addEventListener("pointerup", birakti);
  document.addEventListener("pointercancel", birakti);
}

/**
 * Öğe üzerinde sürükleme: parmak yeri → değer. Sürerken `degisti`, bırakınca
 * `bitti` çağrılır. Değeri hesaplamak çağıranın işi (konum → değer).
 *
 * Ekran yerinde güncellendiği için aynı öğe her çizimde yeniden bağlanır:
 * dinleyiciler bir kez eklenir, seçenekler her seferinde tazelenir.
 */
export function surukle(el, secenek) {
  el._surukle = secenek;
  if (el._surukleBagli) return;
  el._surukleBagli = true;
  let aktif = false, son = null;
  const al = (o) => {
    const v = el._surukle.konumdan(o.clientX, o.clientY);
    if (v !== null && v !== son) { son = v; el._surukle.degisti(v); }
  };
  el.addEventListener("pointerdown", (o) => {
    aktif = true;
    son = null;
    el.setPointerCapture(o.pointerId);
    al(o);
    o.preventDefault();
  });
  el.addEventListener("pointermove", (o) => { if (aktif) al(o); });
  const birak = () => {
    if (!aktif) return;
    aktif = false;
    yut();
    if (son !== null) el._surukle.bitti(son);
  };
  el.addEventListener("pointerup", birak);
  el.addEventListener("pointercancel", birak);
}
