// Hasta Takip — ekranlar.
//
// Her ekran bir HTML metni üretir; dokunuşlar #ekran üzerinde tek yerden
// yakalanır: data-e="eylem" taşıyan öğeye dokununca eylemler[eylem] çağrılır.
// Ekranlar arası geçiş tarayıcı geçmişiyle (iPhone'da kenardan kaydırarak
// geri gelmek çalışsın).
import * as db from "./db.js";
import {
  VARSAYILAN_LISTELER, SEANS_SECENEKLERI, bugun, tarihYaz, tamAd, acilisSaati,
  saatListesi, sonOlcumZamani, vasOzet, romOzet, guncelProgram, programMetni,
  excelBirlestir,
} from "./model.js";
import { benimHastalarim, trKatla, SAYFA } from "./devam.js";
import { yedekSifrele, yedekCoz } from "./kilit.js";
import { ozetCiz } from "./rapor.js";
import { denemeEkle, denemeSayisi, denemeSil } from "./deneme.js";
import { dokunmaDinle, surukle, tiklamaYutulsunMu } from "./dokunma.js";
import morphdom from "../vendor/morphdom.js";

const $ekran = document.getElementById("ekran");
const $dosya = document.getElementById("dosya");

// Ekranlar arası geçici durum (kalıcı veri IndexedDB'de).
const d = {
  sayfa: { ad: "ana" },
  anaSaat: null,
  arama: null,
  listeler: null,
  gorunum: "kutu",      // ana ekran: "kutu" | "ozet" (ayarda saklanır)
  saatSecici: false,
  saatler: [],          // ana ekrandaki saatler (kaydırma hedefi için)
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (h) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[h]);

const ikon = {
  geri: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  ileri: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  ara: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  arti: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  kalem: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  liste: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  kutu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
  not: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  tik: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  carpi: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

// geriAl verilirse bildirimde "Geri al" düğmesi çıkar ve biraz daha uzun
// durur. "Emin misin?" pencereleri yerine bu kullanılıyor.
function bildir(metin, geriAl) {
  const b = document.getElementById("bildirim");
  b.innerHTML = esc(metin) + (geriAl ? ' <button id="geriAlBtn">Geri al</button>' : "");
  if (geriAl) {
    document.getElementById("geriAlBtn").onclick = async () => {
      b.classList.remove("goster");
      await geriAl();
      ciz();
    };
  }
  b.classList.add("goster");
  clearTimeout(bildir.z);
  bildir.z = setTimeout(() => b.classList.remove("goster"), geriAl ? 5000 : 2200);
}

async function listeler() {
  if (!d.listeler) {
    const kayitli = await db.ayarAl("listeler", {});
    d.listeler = { ...VARSAYILAN_LISTELER, ...kayitli };
  }
  return d.listeler;
}

async function listeKaydet() {
  await db.ayarYaz("listeler", d.listeler);
}

// ----------------------------------------------------------- gezinme

function git(ad, param = {}) {
  d.sayfa = { ad, ...param };
  history.pushState(d.sayfa, "");
  ciz();
  window.scrollTo(0, 0);
}

function geri() {
  history.back();
}

window.addEventListener("popstate", (o) => {
  d.sayfa = o.state || { ad: "ana" };
  ciz();
});

// Ekran HTML'i yerine konduktan sonra çalışacak işler (sürükleme bağlamak gibi).
let kurulumlar = [];
const sonra = (f) => kurulumlar.push(f);

// Ekran baştan yazılmaz, yalnızca değişen yerler güncellenir (morphdom):
// VAS değişince sayfa yanıp sönmesin, kaydırma yeri ve basılı düğme korunsun.
async function ciz() {
  const ekran = ekranlar[d.sayfa.ad] || ekranlar.ana;
  kurulumlar = [];
  try {
    const html = await ekran(d.sayfa);
    morphdom($ekran, `<main>${html}</main>`, { childrenOnly: true });
    for (const f of kurulumlar) f();
  } catch (h) {
    console.error(h);
    $ekran.innerHTML = `<div class="bos">Bir sorun çıktı.<br><span class="soluk">${esc(h.message)}</span><br><br><button data-e="anaya">Ana ekrana dön</button></div>`;
  }
}

const ustBar = (baslik, sag = "") => `
  <div class="satir ara">
    <button class="ikon-btn" data-e="geri" aria-label="Geri">${ikon.geri}</button>
    <div class="esnek baslik" style="font-size:17px;text-align:center">${baslik}</div>
    <div style="width:42px">${sag}</div>
  </div>`;

// --------------------------------------------------------- yardımcılar

const kategoriRozeti = (h) => h.kategori === "rom"
  ? `<span class="rozet r-rom">ROM${h.taraf ? " · " + (h.taraf === "sag" ? "SAĞ" : "SOL") : ""}</span>`
  : h.kategori === "agri" ? '<span class="rozet r-agri">AĞRI</span>' : '<span class="rozet r-gri">?</span>';

const renkOf = (h) => (h.kategori === "rom" ? "var(--rom)" : "var(--agri)");

function cubuk(h) {
  const oran = h.toplam ? Math.min(100, Math.round((h.seans / h.toplam) * 100)) : 0;
  return `<div class="cubuk"><i style="width:${oran}%;background:${renkOf(h)}"></i></div>`;
}

const bugunYapildi = (h) => (h.seansGunleri || []).includes(bugun());

// Kutunun sağ üstü: bugün seans yapıldıysa ✓, VAS girildiyse değeri.
function bugunRozeti(h, vas) {
  return `<span class="bugun">${vas != null ? `<span class="vas-mini">VAS ${vas}</span>` : ""}${bugunYapildi(h) ? `<span class="tamam">${ikon.tik}</span>` : ""}</span>`;
}

function hastaKutusu(h, vas) {
  const uyari = sonOlcumZamani(h);
  return `<button class="hasta-kutu kart ${uyari ? "uyari" : ""} ${bugunYapildi(h) ? "yapildi" : ""}" data-e="hasta" data-uzun data-id="${h.id}">
    <div class="satir ara" style="gap:4px;align-items:flex-start">
      <div class="satir" style="gap:4px;flex-wrap:wrap">${kategoriRozeti(h)}${uyari ? '<span class="rozet r-uyari">SON ÖLÇÜM</span>' : ""}</div>
      ${bugunRozeti(h, vas)}
    </div>
    <div class="ad">${esc(tamAd(h))}</div>
    <div class="sayi">${h.seans}<small> / ${h.toplam}</small></div>
    ${cubuk(h)}
  </button>`;
}

// Saat özeti görünümü: program ve son not da görünür.
function ozetKarti(h, vas, program, not) {
  const uyari = sonOlcumZamani(h);
  return `<button class="ozet-kart kart ${uyari ? "uyari" : ""} ${bugunYapildi(h) ? "yapildi" : ""}" data-e="hasta" data-uzun data-id="${h.id}">
    <div class="satir ara">
      <span class="ad">${esc(tamAd(h))}</span>
      <span class="satir" style="gap:8px"><span class="soluk" style="font-size:13px">${h.seans}/${h.toplam}</span>${bugunRozeti(h, vas)}</span>
    </div>
    <div class="satir" style="gap:4px;flex-wrap:wrap">${kategoriRozeti(h)}${uyari ? '<span class="rozet r-uyari">SON ÖLÇÜM</span>' : ""}</div>
    <div class="ozet-program">${program ? esc(programMetni(program)) : '<span class="soluk">Program yok</span>'}</div>
    ${not ? `<div class="ozet-not">${ikon.not} ${esc(not.metin)}</div>` : ""}
    ${cubuk(h)}
  </button>`;
}

// Aynı saatin hastaları hep aynı sırada: eklenme sırası (id zamana dayalı).
const saatSirasi = (a, b) => (a.id < b.id ? -1 : 1);

const adim = (eylem, deger, ek = "") => `
  <span class="adim">
    <button data-e="${eylem}" data-d="-1" data-tekrar ${ek}>−</button>
    <b>${deger}</b>
    <button data-e="${eylem}" data-d="1" data-tekrar ${ek}>+</button>
  </span>`;

async function hastaVerisi(id) {
  const [hasta, olcumler, programlar, notlar] = await Promise.all([
    db.al("hastalar", id), db.hastaninki("olcumler", id),
    db.hastaninki("programlar", id), db.hastaninki("notlar", id),
  ]);
  return { hasta, olcumler, programlar, notlar };
}

// Programı kaydet: bugün zaten bir sürüm varsa onun üzerine, yoksa yeni
// tarihli sürüm (eskisi raporda programın gelişimi için kalır).
async function programKaydet(hastaId, p) {
  const programlar = await db.hastaninki("programlar", hastaId);
  const guncel = guncelProgram(programlar);
  const kayit = {
    id: guncel && guncel.tarih === bugun() ? guncel.id : db.yeniId(),
    hastaId, tarih: bugun(), zaman: Date.now(),
    cihazlar: [...p.cihazlar],
    manuel: p.manuel.map((m) => ({ ...m })),
    egzersizler: p.egzersizler.map((e) => ({ ...e })),
  };
  await db.yaz("programlar", kayit);
}

const bosProgram = () => ({ cihazlar: [], manuel: [], egzersizler: [] });

// ======================================================== EKRANLAR

const ekranlar = {};

// ------------------------------------------------------------ ana ekran

ekranlar.ana = async () => {
  const hastalar = (await db.hepsi("hastalar")).filter((h) => h.durum === "aktif");
  const tarih = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

  const ust = (ortaYazi) => `
    <div class="satir ara" style="align-items:flex-start">
      <div>
        <div class="soluk" style="font-size:13px">${esc(tarih)}</div>
        ${ortaYazi}
      </div>
      <div class="satir" style="gap:6px">
        <button class="ikon-btn" data-e="gorunum" aria-label="Görünümü değiştir">${d.gorunum === "kutu" ? ikon.liste : ikon.kutu}</button>
        <button class="ikon-btn" data-e="arama" aria-label="Ara">${ikon.ara}</button>
        <button class="ikon-btn" data-e="menu" aria-label="Menü">${ikon.menu}</button>
        <button class="ikon-btn secili" data-e="ekle" aria-label="Hasta ekle">${ikon.arti}</button>
      </div>
    </div>`;

  if (d.arama !== null) {
    const q = trKatla(d.arama);
    const bulunan = hastalar
      .filter((h) => !q || trKatla(tamAd(h)).includes(q))
      .sort((a, b) => (a.saat < b.saat ? -1 : a.saat > b.saat ? 1 : 0));
    return `
      <div class="satir">
        <input id="arama" type="search" placeholder="Hasta ara" value="${esc(d.arama)}" autocomplete="off" autocorrect="off" spellcheck="false">
        <button data-e="aramaKapat" style="background:transparent;color:var(--rom)">Vazgeç</button>
      </div>
      ${bulunan.map((h) => `
        <button class="liste-satir" data-e="hasta" data-id="${h.id}">
          <b style="width:52px;font-weight:600">${h.saat}</b>
          <span class="esnek">${esc(tamAd(h))}</span>
          ${kategoriRozeti(h)}
          <span class="soluk">${h.seans}/${h.toplam}</span>
        </button>`).join("") || '<div class="bos">Bulunamadı.</div>'}`;
  }

  const saatler = saatListesi(hastalar);
  if (!saatler.length) {
    return `${ust('<div class="baslik" style="font-size:28px">Hasta Takip</div>')}
      <div class="bos">Henüz hasta yok.<br>Elle ekleyebilir ya da devam dosyasını içe aktarabilirsin.</div>
      <button class="ana-btn" data-e="ekle">Hasta ekle</button>
      <button class="ikinci-btn" data-e="excelSec">Excel'den içe aktar</button>`;
  }

  if (!saatler.includes(d.anaSaat)) d.anaSaat = acilisSaati(saatler);
  d.saatler = saatler;
  const simdi = acilisSaati(saatler);
  const i = saatler.indexOf(d.anaSaat);
  const buSaat = hastalar.filter((h) => h.saat === d.anaSaat).sort(saatSirasi);
  const rom = buSaat.filter((h) => h.kategori === "rom").length;
  const yapildi = buSaat.filter(bugunYapildi).length;
  const onceki = saatler[i - 1], sonraki = saatler[i + 1];

  // bugünün VAS'ı; özet görünümünde güncel program ve son not
  const idler = new Set(buSaat.map((h) => h.id));
  const vasBugun = {};
  const programlar = {}, notlar = {};
  for (const o of await db.hepsi("olcumler")) {
    if (idler.has(o.hastaId) && o.tur === "vas" && o.tarih === bugun()) vasBugun[o.hastaId] = o.deger;
  }
  if (d.gorunum === "ozet") {
    for (const h of buSaat) {
      programlar[h.id] = guncelProgram(await db.hastaninki("programlar", h.id));
      notlar[h.id] = (await db.hastaninki("notlar", h.id)).sort((a, b) => b.zaman - a.zaman)[0];
    }
  }

  const saatBasi = `
    <div class="satir" style="gap:10px;align-items:baseline">
      <button class="saat-buyuk saat-btn" data-e="saatSecici">${d.anaSaat}</button>
      ${d.anaSaat !== simdi ? '<button class="cip simdi-btn" data-e="simdi">Şimdi</button>' : ""}
    </div>
    <div class="soluk" style="margin-top:4px">${buSaat.length} hasta · ${rom} ROM · ${buSaat.length - rom} ağrı${yapildi ? ` · <span style="color:var(--rom)">${yapildi} yapıldı</span>` : ""}</div>`;

  const secici = d.saatSecici ? `
    <div class="kart izgara" style="grid-template-columns:repeat(4,1fr);gap:6px">
      ${saatler.map((s) => {
        const n = hastalar.filter((h) => h.saat === s).length;
        return `<button data-e="saatSec" data-s="${s}" class="${s === d.anaSaat ? "secili" : ""} ${s === simdi ? "su-an" : ""}" style="padding:8px 0">${s}<br><span style="font-size:11px;opacity:.7">${n} hasta</span></button>`;
      }).join("")}
    </div>` : "";

  return `
    ${ust(saatBasi)}
    ${secici}
    ${d.gorunum === "ozet"
      ? `<div class="izgara">${buSaat.map((h) => ozetKarti(h, vasBugun[h.id], programlar[h.id], notlar[h.id])).join("")}</div>`
      : `<div class="izgara iki">${buSaat.map((h) => hastaKutusu(h, vasBugun[h.id])).join("")}</div>`}
    <div class="soluk ipucu">Kaydır: saat değiştir · Basılı tut: seans yapıldı</div>
    <div class="alt-bar">
      <div class="saat-gecis">
        <button data-e="saat" data-s="${onceki || ""}" ${onceki ? "" : 'style="visibility:hidden"'}>‹ ${onceki || ""}</button>
        <div class="noktalar">${saatler.map((s) => `<i class="${s === d.anaSaat ? "su" : ""}"></i>`).join("")}</div>
        <button data-e="saat" data-s="${sonraki || ""}" ${sonraki ? "" : 'style="visibility:hidden"'}>${sonraki || ""} ›</button>
      </div>
    </div>`;
};

// ------------------------------------------------------------ hasta ekranı

ekranlar.hasta = async ({ id }) => {
  const { hasta: h, olcumler, programlar, notlar } = await hastaVerisi(id);
  if (!h) return ekranlar.ana();
  const yapildi = bugunYapildi(h);
  const vasBugun = olcumler.find((o) => o.tur === "vas" && o.tarih === bugun());
  const vasSon = vasOzet(olcumler)?.son;
  const vasVar = olcumler.some((o) => o.tur === "vas");
  const p = guncelProgram(programlar);
  const oran = h.toplam ? Math.min(1, h.seans / h.toplam) : 0;
  const cevre = 2 * Math.PI * 24;
  const bitti = h.durum === "bitti";

  // Aynı saatteki hastalar: sola/sağa kaydırınca aralarında gezilir.
  const kardes = bitti ? [h] : (await db.hepsi("hastalar"))
    .filter((x) => x.durum === "aktif" && x.saat === h.saat).sort(saatSirasi);
  d.kardesler = kardes.map((x) => x.id);
  const sira = d.kardesler.indexOf(h.id);
  sonra(() => vasBagla(vasBugun?.deger ?? null));

  const vOz = vasOzet(olcumler);
  const rOz = h.kategori === "rom" ? romOzet(olcumler, h) : [];
  const sonNotlar = [...notlar].sort((a, b) => b.zaman - a.zaman).slice(0, 2);

  return `
    ${ustBar(kardes.length > 1 ? `<span class="soluk" style="font-size:13px">${h.saat}</span>
        <div class="noktalar" style="justify-content:center;margin-top:4px">${kardes.map((x, i) => `<i class="${i === sira ? "su" : ""}"></i>`).join("")}</div>` : "",
      `<button class="ikon-btn" data-e="duzenle" data-id="${h.id}" aria-label="Düzenle">${ikon.kalem}</button>`)}
    <div class="satir" style="gap:12px">
      <svg width="64" height="64" viewBox="0 0 58 58" aria-hidden="true">
        <circle cx="29" cy="29" r="24" fill="none" stroke="#2C2C2A" stroke-width="6"/>
        <circle cx="29" cy="29" r="24" fill="none" stroke="${h.kategori === "rom" ? "#5DCAA5" : "#EF9F27"}" stroke-width="6" stroke-linecap="round"
          stroke-dasharray="${(cevre * oran).toFixed(1)} ${cevre.toFixed(1)}" transform="rotate(-90 29 29)"/>
        <text x="29" y="35" text-anchor="middle" fill="#F1EFE8" font-size="17" font-weight="600">${h.seans}</text>
      </svg>
      <div class="esnek">
        <div class="baslik">${esc(tamAd(h))}</div>
        <div class="satir" style="gap:6px;margin-top:4px;flex-wrap:wrap">
          ${kategoriRozeti(h)}
          <span class="soluk">${h.saat} · ${h.seans}/${h.toplam} seans</span>
        </div>
      </div>
    </div>
    ${bitti ? `<div class="kart satir ara"><span>Tedavi bitti${h.bitis ? " · " + tarihYaz(h.bitis) : ""}</span><button class="ikinci-btn" data-e="geriAl" data-id="${h.id}">Geri al</button></div>` : ""}
    ${!vasVar ? '<div><span class="rozet r-uyari">İLK ÖLÇÜM ALINMADI</span></div>'
      : !bitti && sonOlcumZamani(h) ? '<div><span class="rozet r-uyari">SON ÖLÇÜM ZAMANI</span></div>' : ""}
    ${h.kategori === "rom" && !h.taraf ? `
      <div class="kart"><div class="soluk" style="margin-bottom:8px">Etkilenen taraf</div>
        <div class="izgara iki"><button class="ikinci-btn" data-e="taraf" data-t="sag">Sağ</button><button class="ikinci-btn" data-e="taraf" data-t="sol">Sol</button></div></div>` : ""}

    <div class="vas-alan" data-kaydirma="yok">
      <div class="satir ara">
        <span class="bolum" style="margin:0">VAS · bugün</span>
        <span class="satir" style="gap:10px">
          ${vasBugun ? '<button class="vas-sil" data-e="vasSil">Sil</button>' : ""}
          <b id="vasDeger" class="vas-deger ${vasBugun ? "" : "bos-deger"}">${vasBugun ? vasBugun.deger : "—"}</b>
        </span>
      </div>
      <div class="vas-iz" id="vasIz">
        <div class="vas-renk"></div>
        <div class="vas-tutamak ${vasBugun ? "" : "hayalet"}" id="vasTutamak" style="left:${((vasBugun?.deger ?? vasSon?.deger ?? 5) * 10)}%"></div>
      </div>
      <div class="vas-olcek">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<span>${n}</span>`).join("")}</div>
      ${!vasBugun && vasSon ? `<div class="soluk" style="margin-top:2px">Son: ${vasSon.deger} (${tarihYaz(vasSon.tarih)}) · çizgide kaydır</div>` : ""}
    </div>

    <div class="izgara ${h.kategori === "rom" ? "uc" : "iki"}">
      ${h.kategori === "rom" ? '<button class="ikinci-btn" data-e="rom">ROM ölç</button>' : ""}
      <button class="ikinci-btn" data-e="notlar">Not</button>
      <button class="ikinci-btn" data-e="ozet">Foto özet</button>
    </div>

    <div class="kart">
      <div class="satir ara" style="margin-bottom:8px">
        <span class="soluk">Program${p ? " · " + tarihYaz(p.tarih) : ""}</span>
        <button class="ikinci-btn" style="padding:6px 12px;font-size:13px" data-e="program">${p ? "Düzenle" : "Program kur"}</button>
      </div>
      ${p ? `
        <div class="cipler" style="margin-bottom:6px">
          ${p.cihazlar.map((c) => `<span class="rozet r-mor">${esc(c)}</span>`).join("")}
          ${p.manuel.map((m) => `<span class="rozet r-mor">${esc(m.ad)}${m.bolge ? " · " + esc(m.bolge) : ""}</span>`).join("")}
        </div>
        ${p.egzersizler.map((e, i) => `
          <div class="ex-satir">
            <span class="esnek">${esc(e.ad)}${e.agirlik ? ` <span class="soluk">${String(e.agirlik).replace(".", ",")} kg</span>` : ""}</span>
            ${adim("exSet", `${e.set}×${e.tekrar}`, `data-i="${i}"`)}
          </div>`).join("")}
      ` : '<div class="soluk">Henüz program yok.</div>'}
    </div>

    ${vOz || rOz.length ? `
      <div class="kart">
        <div class="soluk" style="margin-bottom:6px">Gelişim (ilk → son)</div>
        ${vOz ? `<div class="satir ara" style="padding:4px 0"><span>VAS</span><b>${vOz.sayi > 1 ? `${vOz.ilk.deger} → ` : ""}${vOz.son.deger}</b></div>` : ""}
        ${rOz.map((r) => `
          <div class="satir ara" style="padding:4px 0;border-top:1px solid var(--cizgi)">
            <span>${esc(r.hareket)}</span>
            <span><b>${r.etkilenen ? (r.etkilenen.sayi > 1 ? `${r.etkilenen.ilk.deger}° → ${r.etkilenen.son.deger}°` : `${r.etkilenen.son.deger}°`) : "—"}</b>
            <span class="soluk"> · sağlıklı ${r.saglikli ? r.saglikli.son.deger + "°" : "—"}</span></span>
          </div>`).join("")}
      </div>` : ""}

    ${sonNotlar.length ? `
      <button class="kart" data-e="notlar" style="text-align:left">
        <div class="soluk" style="margin-bottom:6px">Son notlar</div>
        ${sonNotlar.map((n) => `<div style="padding:4px 0"><span class="soluk">${tarihYaz(n.tarih)}</span> <span class="not">${esc(n.metin)}</span></div>`).join("")}
      </button>` : ""}

    ${bitti ? "" : `<button class="tehlike-btn" data-e="bitir" style="color:var(--soluk)">Tedaviyi bitir (arşive al)</button>`}
    ${bitti ? "" : `<div class="alt-bar">${yapildi
      ? `<button class="ana-btn yapildi" data-e="seansGeriAl">${ikon.tik} Bugün yapıldı · geri al</button>`
      : `<button class="ana-btn" data-e="seansYap">${ikon.tik} Seans yapıldı (${h.seans} → ${h.seans + 1})</button>`}</div>`}
  `;
};

// VAS çizgisi: parmak çizgide gezdikçe değer canlı değişir, bırakınca kaydedilir.
function vasBagla(bugunku) {
  const iz = document.getElementById("vasIz");
  if (!iz) return;
  const tutamak = document.getElementById("vasTutamak");
  const yazi = document.getElementById("vasDeger");
  surukle(iz, {
    konumdan: (x) => {
      const k = iz.getBoundingClientRect();
      return Math.max(0, Math.min(10, Math.round(((x - k.left) / k.width) * 10)));
    },
    degisti: (v) => {
      tutamak.style.left = `${v * 10}%`;
      tutamak.classList.remove("hayalet");
      yazi.textContent = v;
      yazi.classList.remove("bos-deger");
    },
    bitti: (v) => { if (v !== bugunku) vasYaz(v); },
  });
}

async function vasYaz(deger) {
  const id = sayfaId();
  const h = await db.al("hastalar", id);
  const varolan = (await db.hastaninki("olcumler", id)).find((o) => o.tur === "vas" && o.tarih === bugun());
  await db.yaz("olcumler", {
    id: varolan?.id || db.yeniId(), hastaId: id, tarih: bugun(), zaman: Date.now(),
    seans: h.seans, tur: "vas", deger,
  });
  bildir(`VAS ${deger} kaydedildi`);
  ciz();
}

// ------------------------------------------------------------ ROM ölçümü

ekranlar.rom = async ({ id }) => {
  const { hasta: h, olcumler } = await hastaVerisi(id);
  const l = await listeler();
  const r = d.rom && d.rom.id === id ? d.rom : (d.rom = {
    id, taraf: h.taraf || "sag", hareket: l.hareketler[0], deger: null,
  });
  const romlar = olcumler.filter((o) => o.tur === "rom");
  const sonDeger = (taraf, hareket) => romlar
    .filter((o) => o.taraf === taraf && o.hareket === hareket)
    .sort((a, b) => b.zaman - a.zaman)[0];
  const bugunku = (hareket) => romlar.some((o) => o.taraf === r.taraf && o.hareket === hareket && o.tarih === bugun());
  const once = sonDeger(r.taraf, r.hareket);
  const karsi = sonDeger(r.taraf === "sag" ? "sol" : "sag", r.hareket);
  if (r.deger === null) r.deger = once ? once.deger : 90;

  const etk = h.taraf || "sag";
  const tarafAdi = (t) => `${t === "sag" ? "Sağ" : "Sol"} · ${t === etk ? "etkilenen" : "sağlıklı"}`;

  // gösterge: 0° solda, 180° sağda, yarım daire
  const aci = Math.PI * (1 - Math.min(180, r.deger) / 180);
  const x = 110 + 90 * Math.cos(aci), y = 110 - 90 * Math.sin(aci);
  sonra(romBagla);

  return `
    ${ustBar(`ROM · ${esc(h.ad)}`)}
    <div class="sekme">
      <button data-e="romTaraf" data-t="sag" class="${r.taraf === "sag" ? "secili" : ""}">${tarafAdi("sag")}</button>
      <button data-e="romTaraf" data-t="sol" class="${r.taraf === "sol" ? "secili" : ""}">${tarafAdi("sol")}</button>
    </div>
    <div class="kaydirma">
      ${l.hareketler.map((m) => `<button class="cip ${m === r.hareket ? "beyaz-secili" : ""}" data-e="romHareket" data-m="${esc(m)}">${esc(m)}${bugunku(m) ? '<span class="kayitli">✓</span>' : ""}</button>`).join("")}
    </div>
    <svg id="romGosterge" data-kaydirma="yok" viewBox="0 0 220 128" width="100%" style="max-height:240px;touch-action:none" aria-hidden="true">
      <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="#2C2C2A" stroke-width="12" stroke-linecap="round"/>
      <path id="romYay" d="${romYayi(r.deger)}" fill="none" stroke="#5DCAA5" stroke-width="12" stroke-linecap="round"/>
      <circle id="romTutamak" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#F1EFE8"/>
      <text id="romYazi" x="110" y="96" text-anchor="middle" fill="#F1EFE8" font-size="36" font-weight="600">${r.deger}°</text>
      <text x="110" y="124" text-anchor="middle" fill="#888780" font-size="10">önceki ${once ? once.deger + "°" : "—"} · karşı taraf ${karsi ? karsi.deger + "°" : "—"}</text>
    </svg>
    <div class="izgara" style="grid-template-columns:repeat(7,1fr);gap:5px">
      ${[0, 30, 60, 90, 120, 150, 180].map((v) => `<button data-e="romDeger" data-v="${v}" style="padding:10px 0;font-size:13px" class="${r.deger === v ? "secili" : ""}">${v}</button>`).join("")}
    </div>
    <div class="izgara dort">
      ${[-10, -5, 5, 10].map((v) => `<button class="ikinci-btn" data-e="romArti" data-v="${v}">${v > 0 ? "+" : "−"}${Math.abs(v)}</button>`).join("")}
    </div>
    <div class="soluk" style="text-align:center">Yayın üzerinde parmağını kaydır</div>
    <div class="alt-bar"><button class="ana-btn" data-e="romKaydet">Kaydet · ${r.taraf === "sag" ? "Sağ" : "Sol"} ${esc(r.hareket)}</button></div>
  `;
};

// 0° solda, 180° sağda; yarıçap 90, merkez (110, 110).
function romNokta(deger) {
  const aci = Math.PI * (1 - Math.min(180, deger) / 180);
  return [110 + 90 * Math.cos(aci), 110 - 90 * Math.sin(aci)];
}

function romYayi(deger) {
  if (deger <= 0) return "M20 110";
  const [x, y] = romNokta(deger);
  return `M20 110 A90 90 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
}

function romBagla() {
  const svg = document.getElementById("romGosterge");
  if (!svg) return;
  surukle(svg, {
    konumdan: (cx, cy) => {
      const nokta = svg.createSVGPoint();
      nokta.x = cx;
      nokta.y = cy;
      const p = nokta.matrixTransform(svg.getScreenCTM().inverse());
      // merkezin altına inen parmak: en yakın uca yapış
      const aci = Math.atan2(Math.max(0, 110 - p.y), p.x - 110);
      const deger = Math.round(((Math.PI - aci) / Math.PI) * 180 / 5) * 5;
      return Math.max(0, Math.min(180, deger));
    },
    degisti: (v) => {
      const [x, y] = romNokta(v);
      document.getElementById("romYay").setAttribute("d", romYayi(v));
      const t = document.getElementById("romTutamak");
      t.setAttribute("cx", x.toFixed(1));
      t.setAttribute("cy", y.toFixed(1));
      document.getElementById("romYazi").textContent = `${v}°`;
    },
    bitti: (v) => { d.rom.deger = v; ciz(); },
  });
}

// ------------------------------------------------------------ program

ekranlar.program = async ({ id }) => {
  const l = await listeler();
  if (!d.taslak || d.taslak.id !== id) {
    const p = guncelProgram(await db.hastaninki("programlar", id));
    d.taslak = { id, ...(p ? structuredClone({ cihazlar: p.cihazlar, manuel: p.manuel, egzersizler: p.egzersizler }) : bosProgram()) };
  }
  const t = d.taslak;
  const ekliEx = new Set(t.egzersizler.map((e) => e.ad));
  const yeniAlan = (liste) => d.yeniListe === liste ? `
    <div class="satir" style="margin-top:8px">
      <input id="yeniOge" placeholder="Yeni ekle" autocomplete="off">
      <button class="secili" data-e="yeniOgeKaydet" data-l="${liste}">Ekle</button>
    </div>` : "";
  const yeniCip = (liste) => `<button class="cip" data-e="yeniOgeAc" data-l="${liste}">+ Yeni</button>`;

  return `
    ${ustBar("Program")}
    <div class="bolum">Cihazlar</div>
    <div class="cipler">
      ${l.cihazlar.map((c) => `<button class="cip ${t.cihazlar.includes(c) ? "secili" : ""}" data-e="pCihaz" data-v="${esc(c)}">${esc(c)}</button>`).join("")}
      ${yeniCip("cihazlar")}
    </div>
    ${yeniAlan("cihazlar")}

    <div class="bolum">Manuel terapi</div>
    <div class="cipler">
      ${l.manuel.map((m) => `<button class="cip ${t.manuel.some((x) => x.ad === m) ? "secili" : ""}" data-e="pManuel" data-v="${esc(m)}">${esc(m)}</button>`).join("")}
      ${yeniCip("manuel")}
    </div>
    ${yeniAlan("manuel")}
    ${t.manuel.map((m, i) => {
      const secili = m.bolge ? m.bolge.split(", ") : [];
      return `<div class="kart">
        <div class="soluk" style="margin-bottom:8px">${esc(m.ad)} · bölge</div>
        <div class="cipler">${l.bolgeler.map((b) => `<button class="cip ${secili.includes(b) ? "secili" : ""}" data-e="pBolge" data-i="${i}" data-v="${esc(b)}">${esc(b)}</button>`).join("")}
        ${yeniCip("bolgeler")}</div>
      </div>`;
    }).join("")}
    ${t.manuel.length ? yeniAlan("bolgeler") : ""}

    <div class="bolum">Egzersizler</div>
    ${t.egzersizler.length ? `<div class="kart">${t.egzersizler.map((e, i) => `
      <div style="padding:8px 0;${i ? "border-top:1px solid var(--cizgi)" : ""}">
        <div class="satir ara"><b style="font-weight:600">${esc(e.ad)}</b>
          <button class="ikon-btn" style="width:32px;height:32px;background:transparent;color:var(--soluk)" data-e="pExSil" data-i="${i}" aria-label="Çıkar">${ikon.carpi}</button></div>
        <div class="satir ara" style="margin-top:4px"><span class="soluk">Set</span>${adim("pEx", e.set, `data-i="${i}" data-a="set"`)}</div>
        <div class="satir ara" style="margin-top:4px"><span class="soluk">Tekrar</span>${adim("pEx", e.tekrar, `data-i="${i}" data-a="tekrar"`)}</div>
        <div class="satir ara" style="margin-top:4px"><span class="soluk">Ağırlık (kg)</span>${adim("pEx", String(e.agirlik || 0).replace(".", ","), `data-i="${i}" data-a="agirlik"`)}</div>
      </div>`).join("")}</div>` : ""}
    <div class="cipler">
      ${l.egzersizler.filter((e) => !ekliEx.has(e)).map((e) => `<button class="cip" data-e="pExEkle" data-v="${esc(e)}">+ ${esc(e)}</button>`).join("")}
      ${yeniCip("egzersizler")}
    </div>
    ${yeniAlan("egzersizler")}

    <button class="ana-btn" data-e="programKaydet" style="margin-top:8px">Kaydet</button>
  `;
};

// ------------------------------------------------------------ notlar

ekranlar.notlar = async ({ id }) => {
  const { hasta: h, notlar } = await hastaVerisi(id);
  const sirali = [...notlar].sort((a, b) => b.zaman - a.zaman);
  return `
    ${ustBar(`Notlar · ${esc(h.ad)}`)}
    <textarea id="notMetni" placeholder="Not yaz"></textarea>
    <button class="ana-btn" data-e="notKaydet">Kaydet</button>
    ${sirali.map((n) => `
      <div class="kart">
        <div class="satir ara"><span class="soluk">${tarihYaz(n.tarih)}</span>
          <button class="ikon-btn" style="width:30px;height:30px;background:transparent;color:var(--soluk)" data-e="notSil" data-n="${n.id}" aria-label="Sil">${ikon.carpi}</button></div>
        <div class="not">${esc(n.metin)}</div>
      </div>`).join("")}
  `;
};

// ------------------------------------------------------------ hasta ekle / düzenle

ekranlar.form = async ({ id }) => {
  if (!d.form || d.form.id !== (id || null)) {
    const h = id ? await db.al("hastalar", id) : null;
    d.form = h
      ? { id, ad: h.ad, soyad: h.soyad, saat: h.saat, kategori: h.kategori, taraf: h.taraf, toplam: h.toplam, baslangic: h.seans + 1 }
      : { id: null, ad: "", soyad: "", saat: d.anaSaat, kategori: null, taraf: null, toplam: 15, baslangic: 1 };
  }
  const f = d.form;
  const saatler = [];
  for (let s = 7; s <= 20; s++) saatler.push(`${String(s).padStart(2, "0")}:00`);
  return `
    ${ustBar(id ? "Hastayı düzenle" : "Yeni hasta")}
    <input id="fAd" placeholder="Ad" value="${esc(f.ad)}" autocomplete="off" autocapitalize="words">
    <input id="fSoyad" placeholder="Soyad" value="${esc(f.soyad)}" autocomplete="off" autocapitalize="words">

    <div class="bolum">Saat</div>
    <div class="izgara" style="grid-template-columns:repeat(5,1fr);gap:6px">
      ${saatler.map((s) => `<button data-e="fSaat" data-v="${s}" style="padding:10px 0;font-size:14px" class="${f.saat === s ? "secili" : ""}">${s}</button>`).join("")}
    </div>

    <div class="bolum">Kategori</div>
    <div class="izgara iki">
      <button data-e="fKat" data-v="agri" class="${f.kategori === "agri" ? "secili" : ""}">AĞRI</button>
      <button data-e="fKat" data-v="rom" class="${f.kategori === "rom" ? "secili" : ""}">ROM</button>
    </div>
    ${f.kategori === "rom" ? `
      <div class="bolum">Etkilenen taraf</div>
      <div class="izgara iki">
        <button data-e="fTaraf" data-v="sag" class="${f.taraf === "sag" ? "secili" : ""}">Sağ</button>
        <button data-e="fTaraf" data-v="sol" class="${f.taraf === "sol" ? "secili" : ""}">Sol</button>
      </div>` : ""}

    <div class="bolum">Toplam seans</div>
    <div class="izgara dort">
      ${SEANS_SECENEKLERI.map((s) => `<button data-e="fToplam" data-v="${s}" class="${f.toplam === s ? "secili" : ""}">${s}</button>`).join("")}
    </div>
    <div class="kart satir ara"><span class="soluk">Diğer</span>${adim("fToplamAdim", f.toplam)}</div>

    <div class="bolum">Başlangıç seansı</div>
    <div class="kart satir ara"><span class="soluk">Bugün kaçıncı seansta</span>${adim("fBaslangic", f.baslangic)}</div>
    <div class="soluk">Başka terapistten geçen hasta için ör. 3.</div>

    <div id="fHata" style="color:var(--tehlike);font-size:13px"></div>
    <button class="ana-btn" data-e="formKaydet">Kaydet</button>
    ${id ? '<button class="tehlike-btn" data-e="hastaSil">Hastayı ve bütün kayıtlarını sil</button>' : ""}
  `;
};

// ------------------------------------------------------------ foto özet

ekranlar.ozet = async ({ id }) => {
  const { hasta, olcumler, programlar } = await hastaVerisi(id);
  const blob = await ozetCiz(hasta, olcumler, programlar);
  if (d.ozetUrl) URL.revokeObjectURL(d.ozetUrl);
  d.ozetUrl = URL.createObjectURL(blob);
  d.ozetBlob = blob;
  d.ozetAd = `${tamAd(hasta)} - ozet.png`;
  return `
    ${ustBar("Foto özet")}
    <img src="${d.ozetUrl}" alt="Tedavi özeti" style="width:100%;border-radius:18px;border:1px solid var(--cizgi)">
    <button class="ana-btn" data-e="ozetPaylas">Paylaş</button>
  `;
};

// ------------------------------------------------------------ menü

ekranlar.menu = async () => {
  const sonExcel = await db.ayarAl("sonExcel", null);
  const deneme = await denemeSayisi();
  return `
    ${ustBar("Menü")}
    <button class="liste-satir" data-e="excelSec"><span class="esnek">Excel'den içe aktar<br><span class="soluk">${sonExcel ? `Son: ${esc(sonExcel.ad)} · ${tarihYaz(sonExcel.tarih)}` : `Devam dosyası, ${SAYFA} sayfası`}</span></span>${ikon.ileri}</button>
    <button class="liste-satir" data-e="biten"><span class="esnek">Biten hastalar</span>${ikon.ileri}</button>
    <button class="liste-satir" data-e="listelerAc"><span class="esnek">Listeler<br><span class="soluk">Cihaz, egzersiz, hareket, bölge</span></span>${ikon.ileri}</button>
    <div class="bolum">Veri</div>
    <button class="liste-satir" data-e="yedekAc"><span class="esnek">Yedek al / geri yükle<br><span class="soluk">Şifreli dosya</span></span>${ikon.ileri}</button>
    <div class="bolum">Deneme</div>
    <button class="liste-satir" data-e="denemeEkle"><span class="esnek">Deneme hastaları ekle<br><span class="soluk">Uydurma adlar, ölçümler ve programlarla</span></span>${ikon.ileri}</button>
    ${deneme ? `<button class="liste-satir" data-e="denemeSil"><span class="esnek" style="color:var(--tehlike)">Deneme hastalarını sil<br><span class="soluk">${deneme} deneme hastası · gerçek hastalara dokunmaz</span></span></button>` : ""}
  `;
};

ekranlar.biten = async () => {
  const biten = (await db.hepsi("hastalar")).filter((h) => h.durum === "bitti")
    .sort((a, b) => (b.bitis || "").localeCompare(a.bitis || ""));
  return `
    ${ustBar("Biten hastalar")}
    ${biten.map((h) => `
      <button class="liste-satir" data-e="hasta" data-id="${h.id}">
        <span class="esnek">${esc(tamAd(h))}<br><span class="soluk">${h.bitis ? tarihYaz(h.bitis) : ""} · ${h.seans} seans</span></span>
        ${kategoriRozeti(h)}
      </button>`).join("") || '<div class="bos">Biten hasta yok.</div>'}
  `;
};

const LISTE_ADLARI = { cihazlar: "Cihazlar", manuel: "Manuel terapi", bolgeler: "Bölgeler", egzersizler: "Egzersizler", hareketler: "ROM hareketleri" };

ekranlar.listeler = async () => {
  const l = await listeler();
  return `
    ${ustBar("Listeler")}
    ${Object.entries(LISTE_ADLARI).map(([k, ad]) => `
      <div class="bolum">${ad}</div>
      <div class="cipler">
        ${l[k].map((o, i) => `<span class="cip satir" style="gap:6px">${esc(o)}<button style="padding:0;background:transparent;color:var(--soluk)" data-e="listeSil" data-l="${k}" data-i="${i}" aria-label="Sil">${ikon.carpi}</button></span>`).join("")}
        <button class="cip" data-e="yeniOgeAc" data-l="${k}">+ Yeni</button>
      </div>
      ${d.yeniListe === k ? `<div class="satir"><input id="yeniOge" placeholder="Yeni ekle" autocomplete="off"><button class="secili" data-e="yeniOgeKaydet" data-l="${k}">Ekle</button></div>` : ""}
    `).join("")}
  `;
};

// ------------------------------------------------------------ Excel

ekranlar.excel = async () => {
  const x = d.excel;
  if (!x) return ekranlar.ana();
  if (x.hata) {
    return `${ustBar("İçe aktar")}<div class="bos">${esc(x.hata)}</div>`;
  }
  const { guncellenen, yeni, biten } = x.birlesim;
  const eksik = yeni.filter((y) => !y.kategori).length;
  return `
    ${ustBar("İçe aktar")}
    <div class="soluk">${esc(x.ad)} · ${SAYFA} sayfası</div>
    <div class="izgara uc">
      <div class="kart"><div class="saat-buyuk" style="font-size:28px">${yeni.length}</div><div class="soluk">yeni hasta</div></div>
      <div class="kart"><div class="saat-buyuk" style="font-size:28px">${guncellenen.length}</div><div class="soluk">seansı değişen</div></div>
      <div class="kart"><div class="saat-buyuk" style="font-size:28px">${biten.length}</div><div class="soluk">tedavisi biten</div></div>
    </div>
    ${yeni.length ? `<div class="bolum">Yeni hastalar${eksik ? ` · ${eksik} hastanın kategorisini seç` : ""}</div>` : ""}
    ${yeni.map((y, i) => `
      <div class="kart">
        <div class="satir ara"><b style="font-weight:600">${esc(y.ad)} ${esc(y.soyad)}</b><span class="soluk">${y.saat} · ${y.seans}/${y.toplam}</span></div>
        <div class="soluk" style="margin:2px 0 8px">Dosyada: ${esc(y.tur || "boş")}</div>
        <div class="izgara iki">
          <button data-e="xKat" data-i="${i}" data-v="agri" class="${y.kategori === "agri" ? "secili" : ""}">AĞRI</button>
          <button data-e="xKat" data-i="${i}" data-v="rom" class="${y.kategori === "rom" ? "secili" : ""}">ROM</button>
        </div>
      </div>`).join("")}
    ${biten.length ? `<div class="bolum">Biten hastalara taşınacak</div>
      ${biten.map((b) => `<div class="liste-satir"><span class="esnek">${esc(tamAd(b.hasta))}</span><span class="soluk">${b.hasta.saat}</span></div>`).join("")}` : ""}
    ${guncellenen.length ? `<div class="bolum">Seansı güncellenecek</div>
      ${guncellenen.map((g) => `<div class="liste-satir"><span class="esnek">${esc(tamAd(g.hasta))}</span><span class="soluk">${g.hasta.seans} → ${g.seans}</span></div>`).join("")}` : ""}
    ${yeni.length + guncellenen.length + biten.length === 0
      ? '<div class="bos">Değişiklik yok, uygulama dosyayla aynı.</div>'
      : `<button class="ana-btn" data-e="excelUygula" ${eksik ? 'style="opacity:.4"' : ""}>İçe aktar</button>`}
  `;
};

// ------------------------------------------------------------ yedek

ekranlar.yedek = async () => `
  ${ustBar("Yedek")}
  <div class="kart" style="line-height:1.5">Veriler yalnızca bu telefonda. Uygulamayı ana ekrandan silersen veriler de silinir. Ara ara yedek al ve dosyayı güvenli bir yere (ör. iCloud Drive) kaydet.</div>
  <div class="bolum">Yedek al</div>
  <input id="yParola" type="password" placeholder="Yedek parolası (en az 6 karakter)" autocomplete="new-password">
  <input id="yParola2" type="password" placeholder="Parola tekrar" autocomplete="new-password">
  <div class="soluk">Parolayı unutursan yedek açılamaz.</div>
  <button class="ana-btn" data-e="yedekAl">Yedek al</button>
  <div class="bolum">Geri yükle</div>
  <input id="gParola" type="password" placeholder="Yedeğin parolası" autocomplete="off">
  <button class="ikinci-btn" data-e="yedekSec">Yedek dosyası seç ve yükle</button>
  <div id="yHata" style="color:var(--tehlike);font-size:13px"></div>
`;

// ======================================================== EYLEMLER

const sayfaId = () => d.sayfa.id;

const eylemler = {
  geri,
  anaya: () => { d.sayfa = { ad: "ana" }; history.replaceState(d.sayfa, ""); ciz(); },

  // ana
  arama: () => { d.arama = ""; ciz().then(() => document.getElementById("arama")?.focus()); },
  aramaKapat: () => { d.arama = null; ciz(); },
  saat: (v) => { if (v.s) saataGit(v.s); },
  saatSecici: () => { d.saatSecici = !d.saatSecici; ciz(); },
  saatSec: (v) => { d.saatSecici = false; saataGit(v.s); },
  simdi: async () => {
    const saatler = saatListesi((await db.hepsi("hastalar")).filter((h) => h.durum === "aktif"));
    saataGit(acilisSaati(saatler));
  },
  async gorunum() {
    d.gorunum = d.gorunum === "kutu" ? "ozet" : "kutu";
    await db.ayarYaz("gorunum", d.gorunum);
    ciz();
  },
  hasta: (v) => { d.saatSecici = false; git("hasta", { id: v.id }); },
  ekle: () => { d.form = null; git("form", {}); },
  menu: () => git("menu"),

  // hasta
  duzenle: (v) => { d.form = null; git("form", { id: v.id }); },
  async seansYap() {
    const h = await seansIsle(sayfaId(), 1);
    bildir(`Seans ${h.seans} kaydedildi`, () => seansIsle(h.id, -1));
    ciz();
  },
  async seansGeriAl() {
    await seansIsle(sayfaId(), -1);
    ciz();
  },
  async vasSil() {
    const id = sayfaId();
    const varolan = (await db.hastaninki("olcumler", id)).find((o) => o.tur === "vas" && o.tarih === bugun());
    if (!varolan) return;
    await db.sil("olcumler", varolan.id);
    bildir("Bugünkü VAS silindi", () => db.yaz("olcumler", varolan));
    ciz();
  },
  async taraf(v) {
    const h = await db.al("hastalar", sayfaId());
    h.taraf = v.t;
    await db.yaz("hastalar", h);
    ciz();
  },
  rom: () => { d.rom = null; git("rom", { id: sayfaId() }); },
  notlar: () => git("notlar", { id: sayfaId() }),
  ozet: () => git("ozet", { id: sayfaId() }),
  program: () => { d.taslak = null; d.yeniListe = null; git("program", { id: sayfaId() }); },
  async exSet(v, el) {
    const id = sayfaId();
    const p = structuredClone(guncelProgram(await db.hastaninki("programlar", id)));
    const e = p.egzersizler[Number(el.dataset.i)];
    e.tekrar = Math.max(1, e.tekrar + Number(v.d));
    await programKaydet(id, p);
    ciz();
  },
  async bitir() {
    const h = await db.al("hastalar", sayfaId());
    const eski = { ...h };
    h.durum = "bitti";
    h.bitis = bugun();
    await db.yaz("hastalar", h);
    bildir("Biten hastalara taşındı", () => db.yaz("hastalar", eski));
    ciz();
  },
  async geriAl() {
    const h = await db.al("hastalar", sayfaId());
    h.durum = "aktif";
    delete h.bitis;
    await db.yaz("hastalar", h);
    ciz();
  },

  // ROM
  romTaraf: (v) => { d.rom.taraf = v.t; d.rom.deger = null; ciz(); },
  romHareket: (v) => { d.rom.hareket = v.m; d.rom.deger = null; ciz(); },
  romDeger: (v) => { d.rom.deger = Number(v.v); ciz(); },
  romArti: (v) => { d.rom.deger = Math.max(0, Math.min(180, d.rom.deger + Number(v.v))); ciz(); },
  async romKaydet() {
    const r = d.rom;
    const h = await db.al("hastalar", r.id);
    const varolan = (await db.hastaninki("olcumler", r.id)).find((o) =>
      o.tur === "rom" && o.tarih === bugun() && o.hareket === r.hareket && o.taraf === r.taraf);
    await db.yaz("olcumler", {
      id: varolan?.id || db.yeniId(), hastaId: r.id, tarih: bugun(), zaman: Date.now(),
      seans: h.seans, tur: "rom", hareket: r.hareket, taraf: r.taraf, deger: r.deger,
    });
    bildir(`${r.taraf === "sag" ? "Sağ" : "Sol"} ${r.hareket} ${r.deger}° kaydedildi`);
    // sıradaki harekete geç
    const l = await listeler();
    const i = l.hareketler.indexOf(r.hareket);
    if (i >= 0 && i < l.hareketler.length - 1) r.hareket = l.hareketler[i + 1];
    r.deger = null;
    ciz();
  },

  // program
  pCihaz: (v) => {
    const c = d.taslak.cihazlar;
    const i = c.indexOf(v.v);
    i >= 0 ? c.splice(i, 1) : c.push(v.v);
    ciz();
  },
  pManuel: (v) => {
    const m = d.taslak.manuel;
    const i = m.findIndex((x) => x.ad === v.v);
    i >= 0 ? m.splice(i, 1) : m.push({ ad: v.v, bolge: "" });
    ciz();
  },
  pBolge: (v, el) => {
    const m = d.taslak.manuel[Number(el.dataset.i)];
    const b = m.bolge ? m.bolge.split(", ") : [];
    const i = b.indexOf(v.v);
    i >= 0 ? b.splice(i, 1) : b.push(v.v);
    m.bolge = b.join(", ");
    ciz();
  },
  pExEkle: (v) => { d.taslak.egzersizler.push({ ad: v.v, set: 3, tekrar: 10, agirlik: 0 }); ciz(); },
  pExSil: (v, el) => { d.taslak.egzersizler.splice(Number(el.dataset.i), 1); ciz(); },
  pEx: (v, el) => {
    const e = d.taslak.egzersizler[Number(el.dataset.i)];
    const a = el.dataset.a;
    const adimi = a === "agirlik" ? 0.5 : 1;
    const en = a === "agirlik" ? 0 : 1;
    e[a] = Math.max(en, Math.round(((e[a] || 0) + Number(v.d) * adimi) * 10) / 10);
    ciz();
  },
  async programKaydet() {
    const { id, ...p } = d.taslak;
    await programKaydet(id, p);
    d.taslak = null;
    bildir("Program kaydedildi");
    geri();
  },
  yeniOgeAc: (v) => { d.yeniListe = d.yeniListe === v.l ? null : v.l; ciz().then(() => document.getElementById("yeniOge")?.focus()); },
  async yeniOgeKaydet(v) {
    const deger = document.getElementById("yeniOge").value.trim();
    if (!deger) return;
    const l = await listeler();
    const metin = v.l === "egzersizler" || v.l === "hareketler" ? deger : deger.toLocaleUpperCase("tr");
    if (!l[v.l].includes(metin)) l[v.l] = [...l[v.l], metin];
    await listeKaydet();
    d.yeniListe = null;
    ciz();
  },
  async listeSil(v, el) {
    const l = await listeler();
    const eski = [...l[v.l]];
    const ad = eski[Number(el.dataset.i)];
    l[v.l] = eski.filter((_, i) => i !== Number(el.dataset.i));
    await listeKaydet();
    bildir(`"${ad}" listeden çıkarıldı`, async () => { l[v.l] = eski; await listeKaydet(); });
    ciz();
  },

  // notlar
  async notKaydet() {
    const metin = document.getElementById("notMetni").value.trim();
    if (!metin) return;
    await db.yaz("notlar", { id: db.yeniId(), hastaId: sayfaId(), tarih: bugun(), zaman: Date.now(), metin });
    bildir("Not kaydedildi");
    ciz();
  },
  async notSil(v) {
    const not = await db.al("notlar", v.n);
    await db.sil("notlar", v.n);
    bildir("Not silindi", () => db.yaz("notlar", not));
    ciz();
  },

  // form
  fSaat: (v) => { formOku(); d.form.saat = v.v; ciz(); },
  fKat: (v) => { formOku(); d.form.kategori = v.v; ciz(); },
  fTaraf: (v) => { formOku(); d.form.taraf = v.v; ciz(); },
  fToplam: (v) => { formOku(); d.form.toplam = Number(v.v); ciz(); },
  fToplamAdim: (v) => { formOku(); d.form.toplam = Math.max(1, d.form.toplam + Number(v.d)); ciz(); },
  fBaslangic: (v) => { formOku(); d.form.baslangic = Math.max(1, d.form.baslangic + Number(v.d)); ciz(); },
  async formKaydet() {
    formOku();
    const f = d.form;
    const hata = !f.ad ? "Ad yaz." : !f.saat ? "Saat seç." : !f.kategori ? "Kategori seç." : "";
    if (hata) { document.getElementById("fHata").textContent = hata; return; }
    const h = f.id ? await db.al("hastalar", f.id) : {
      id: db.yeniId(), durum: "aktif", kaynak: "elle", eklenme: bugun(), seansGunleri: [],
    };
    Object.assign(h, {
      ad: f.ad, soyad: f.soyad, saat: f.saat, kategori: f.kategori,
      taraf: f.kategori === "rom" ? f.taraf : null, toplam: f.toplam, seans: f.baslangic - 1,
    });
    await db.yaz("hastalar", h);
    d.form = null;
    d.anaSaat = h.saat;
    bildir("Kaydedildi");
    if (f.id) geri();
    else { history.replaceState({ ad: "hasta", id: h.id }, ""); d.sayfa = { ad: "hasta", id: h.id }; ciz(); }
  },
  async hastaSil() {
    if (!confirm("Hasta ve bütün ölçüm, program ve notları kalıcı olarak silinsin mi?")) return;
    const id = d.form.id;
    for (const depo of ["olcumler", "programlar", "notlar"]) {
      for (const k of await db.hastaninki(depo, id)) await db.sil(depo, k.id);
    }
    await db.sil("hastalar", id);
    d.form = null;
    bildir("Silindi");
    eylemler.anaya();
  },

  // özet
  async ozetPaylas() {
    const dosya = new File([d.ozetBlob], d.ozetAd, { type: "image/png" });
    if (navigator.canShare?.({ files: [dosya] })) {
      try { await navigator.share({ files: [dosya] }); } catch { /* vazgeçildi */ }
    } else {
      const a = document.createElement("a");
      a.href = d.ozetUrl;
      a.download = d.ozetAd;
      a.click();
    }
  },

  // menü
  biten: () => git("biten"),
  listelerAc: () => { d.yeniListe = null; git("listeler"); },
  yedekAc: () => git("yedek"),
  async denemeEkle() {
    const n = await denemeEkle();
    bildir(`${n} deneme hastası eklendi`);
    d.anaSaat = null;
    eylemler.anaya();
  },
  async denemeSil() {
    if (!confirm("Bütün deneme hastaları ve kayıtları silinsin mi? Gerçek hastalar etkilenmez.")) return;
    const n = await denemeSil();
    bildir(`${n} deneme hastası silindi`);
    ciz();
  },

  // Excel
  excelSec: () => dosyaSec(".xls,.xlsx,application/vnd.ms-excel", excelOku),
  xKat: (v, el) => { d.excel.birlesim.yeni[Number(el.dataset.i)].kategori = v.v; ciz(); },
  async excelUygula() {
    const { guncellenen, yeni, biten } = d.excel.birlesim;
    if (yeni.some((y) => !y.kategori)) { bildir("Önce bütün yeni hastaların kategorisini seç"); return; }
    for (const g of guncellenen) { g.hasta.seans = g.seans; await db.yaz("hastalar", g.hasta); }
    for (const b of biten) {
      Object.assign(b.hasta, { durum: "bitti", bitis: bugun(), seans: b.seans });
      await db.yaz("hastalar", b.hasta);
    }
    for (const y of yeni) {
      await db.yaz("hastalar", {
        id: db.yeniId(), ad: y.ad, soyad: y.soyad, saat: y.saat, kategori: y.kategori, taraf: null,
        toplam: y.toplam, seans: y.seans, seansGunleri: [], durum: "aktif", kaynak: "excel", eklenme: bugun(),
      });
    }
    await db.ayarYaz("sonExcel", { ad: d.excel.ad, tarih: bugun() });
    bildir("İçe aktarıldı");
    d.excel = null;
    d.anaSaat = null;
    eylemler.anaya();
  },

  // yedek
  async yedekAl() {
    const p1 = document.getElementById("yParola").value, p2 = document.getElementById("yParola2").value;
    const hata = document.getElementById("yHata");
    if (p1.length < 6) { hata.textContent = "Parola en az 6 karakter olmalı."; return; }
    if (p1 !== p2) { hata.textContent = "Parolalar aynı değil."; return; }
    const metin = await yedekSifrele(await db.disaAktar(), p1);
    const ad = `hasta-takip-yedek-${bugun()}.htyedek`;
    const dosya = new File([metin], ad, { type: "application/octet-stream" });
    if (navigator.canShare?.({ files: [dosya] })) {
      try { await navigator.share({ files: [dosya] }); } catch { return; }
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(dosya);
      a.download = ad;
      a.click();
    }
    await db.ayarYaz("sonYedek", bugun());
    bildir("Yedek hazır");
  },
  yedekSec() {
    const parola = document.getElementById("gParola").value;
    if (!parola) { document.getElementById("yHata").textContent = "Önce yedeğin parolasını yaz."; return; }
    dosyaSec("", async (dosya) => {
      try {
        const veri = await yedekCoz(await dosya.text(), parola);
        const sayi = veri.hastalar?.length || 0;
        if (!confirm(`Yedekte ${sayi} hasta var. Telefondaki bütün veri bu yedekle DEĞİŞTİRİLSİN mi?`)) return;
        await db.iceAktar(veri);
        d.listeler = null;
        bildir("Yedek yüklendi");
        eylemler.anaya();
      } catch (h) {
        document.getElementById("yHata").textContent = h.message;
      }
    });
  },
};

async function seansIsle(id, yon) {
  const h = await db.al("hastalar", id);
  const g = h.seansGunleri || [];
  if (yon > 0) {
    h.seans += 1;
    g.push(bugun());
  } else {
    const i = g.lastIndexOf(bugun());
    if (i >= 0) { g.splice(i, 1); h.seans = Math.max(0, h.seans - 1); }
  }
  h.seansGunleri = g;
  await db.yaz("hastalar", h);
  return h;
}

// ------------------------------------------------- kayarak geçiş
// İçerik (alt bar hariç) --kay kadar yana kayar. Kaydırırken parmağı izler;
// bırakınca eski içerik dışarı, yenisi öbür yandan içeri kayar.

const bekle = (ms) => new Promise((coz) => setTimeout(coz, ms));

function kayAyarla(px, yumusak) {
  $ekran.classList.toggle("kay-gecis", yumusak);
  $ekran.style.setProperty("--kay", `${Math.round(px)}px`);
}

let geciste = false;
// yon "sol": parmak sola gitti → yeni içerik sağdan gelir
async function gecis(yon, degistir) {
  if (geciste) return;
  geciste = true;
  const w = Math.min(window.innerWidth, 560);
  kayAyarla(yon === "sol" ? -w : w, true);
  await bekle(160);
  await degistir();
  kayAyarla(yon === "sol" ? w * 0.6 : -w * 0.6, false);
  void $ekran.offsetWidth; // yeni başlangıç yerini uygula, sonra kaydır
  kayAyarla(0, true);
  await bekle(200);
  $ekran.classList.remove("kay-gecis");
  geciste = false;
}

// Kaydırma yönünde gidilecek yer: ana ekranda saat, hasta ekranında hasta.
function kaydirmaHedefi(yon) {
  const adim = yon === "sol" ? 1 : -1;
  if (d.sayfa.ad === "ana" && d.arama === null) {
    return d.saatler[d.saatler.indexOf(d.anaSaat) + adim] || null;
  }
  if (d.sayfa.ad === "hasta" && d.kardesler) {
    const i = d.kardesler.indexOf(d.sayfa.id);
    return i < 0 ? null : d.kardesler[i + adim] || null;
  }
  return null;
}

function saataGit(saat) {
  if (!saat || saat === d.anaSaat) return;
  const yon = d.anaSaat && saat < d.anaSaat ? "sag" : "sol";
  gecis(yon, () => { d.anaSaat = saat; return ciz(); });
}

function hastayaGec(id, yon) {
  gecis(yon, () => {
    d.sayfa = { ad: "hasta", id };
    history.replaceState(d.sayfa, "");
    window.scrollTo(0, 0);
    return ciz();
  });
}

function formOku() {
  const ad = document.getElementById("fAd"), soyad = document.getElementById("fSoyad");
  if (ad) d.form.ad = ad.value.trim();
  if (soyad) d.form.soyad = soyad.value.trim();
}

function dosyaSec(kabul, isle) {
  $dosya.value = "";
  $dosya.accept = kabul;
  $dosya.onchange = () => { if ($dosya.files[0]) isle($dosya.files[0]); };
  $dosya.click();
}

async function excelOku(dosya) {
  d.excel = { ad: dosya.name };
  try {
    const wb = XLSX.read(await dosya.arrayBuffer(), { cellStyles: true, sheetStubs: true });
    const benim = benimHastalarim(wb);
    if (!benim) {
      d.excel.hata = `Dosyada ${SAYFA} sayfası bulunamadı.`;
    } else {
      d.excel.birlesim = excelBirlestir(await db.hepsi("hastalar"), benim);
    }
  } catch (h) {
    console.error(h);
    d.excel.hata = "Dosya okunamadı. Devam dosyası (.xls) mı?";
  }
  if (d.sayfa.ad === "excel") ciz(); else git("excel");
}

// --------------------------------------------------------- olaylar

$ekran.addEventListener("click", (o) => {
  if (tiklamaYutulsunMu()) return;
  const el = o.target.closest("[data-e]");
  if (!el || !$ekran.contains(el)) return;
  const f = eylemler[el.dataset.e];
  if (f) f(el.dataset, el);
});

dokunmaDinle($ekran, {
  surukluyor(dx) {
    if (geciste || !["ana", "hasta"].includes(d.sayfa.ad)) return;
    // gidilecek yer yoksa lastik gibi az esnesin
    kayAyarla(kaydirmaHedefi(dx < 0 ? "sol" : "sag") ? dx : dx * 0.25, false);
  },
  birakti(yon) {
    if (geciste) return;
    const hedef = yon && kaydirmaHedefi(yon);
    if (!hedef) { kayAyarla(0, true); return; }
    if (d.sayfa.ad === "ana") saataGit(hedef);
    else hastayaGec(hedef, yon);
  },
  // Ana ekrana eklenen uygulamada iPhone'un kenardan geri hareketi yok.
  kenardanGeri() {
    if (d.sayfa.ad !== "ana") geri();
  },
  // Ana ekranda kutuya basılı tutma: seans yapıldı.
  async uzunBas(el) {
    const id = el.dataset.id;
    const h = await db.al("hastalar", id);
    if (bugunYapildi(h)) { bildir(`${h.ad}: bugün zaten yapıldı`); return; }
    await seansIsle(id, 1);
    bildir(`${tamAd(h)} · seans ${h.seans + 1}`, () => seansIsle(id, -1));
    ciz();
  },
  tekrar(veri) {
    const f = eylemler[veri.e];
    if (f) f(veri, { dataset: veri });
  },
});

$ekran.addEventListener("input", (o) => {
  if (o.target.id === "arama") {
    d.arama = o.target.value;
    const konum = o.target.selectionStart;
    ciz().then(() => {
      const a = document.getElementById("arama");
      a.focus();
      a.setSelectionRange(konum, konum);
    });
  }
});

$ekran.addEventListener("keydown", (o) => {
  if (o.key === "Enter" && o.target.id === "yeniOge") {
    o.preventDefault();
    $ekran.querySelector('[data-e="yeniOgeKaydet"]')?.click();
  }
});

// Uygulamaya geri dönülünce ana ekrandaki saat değişmiş olabilir.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && d.sayfa.ad === "ana") ciz();
});

// --------------------------------------------------------- başlangıç

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js");
}

history.replaceState(d.sayfa, "");
db.kaliciIste();
db.ayarAl("gorunum", "kutu").then((g) => { d.gorunum = g; ciz(); });
