// Görsel parçalar: gelişim grafiği, hastaya göster ekranı, konfeti.
// Hepsi düz SVG/HTML metni üretir; ekranlar app.js'te.

const R = {
  rom: "#5DCAA5", agri: "#EF9F27", cizgi: "#2C2C2A", soluk: "#888780",
  yazi: "#F1EFE8", iyi: "#97C459", kotu: "#F09595",
};

/**
 * Çizgi grafiği. noktalar: [{ seans, deger }] (sıralı).
 * secenek: { min, max, renk, birim, referans (yatay kesikli çizgi), refAd }
 */
export function grafik(noktalar, { min, max, renk, birim = "", referans = null, refAd = "" }) {
  const G = 320, Y = 132, sol = 30, sag = 14, ust = 14, alt = 24;
  const w = G - sol - sag, h = Y - ust - alt;
  const x = (i) => sol + (noktalar.length === 1 ? w / 2 : (i / (noktalar.length - 1)) * w);
  const y = (v) => ust + h - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * h;

  const cizgi = noktalar.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(n.deger).toFixed(1)}`).join(" ");
  const alan = noktalar.length > 1
    ? `${cizgi} L${x(noktalar.length - 1).toFixed(1)} ${ust + h} L${x(0).toFixed(1)} ${ust + h} Z` : "";
  const ilk = noktalar[0], son = noktalar[noktalar.length - 1];
  const etiket = (i, n, yukari) => `<text x="${x(i).toFixed(1)}" y="${(y(n.deger) + (yukari ? -9 : 16)).toFixed(1)}"
    text-anchor="${i === 0 && noktalar.length > 1 ? "start" : i === noktalar.length - 1 && noktalar.length > 1 ? "end" : "middle"}"
    fill="${R.yazi}" font-size="12" font-weight="600">${n.deger}${birim}</text>`;
  // etiketi çizginin boş tarafına koy
  const yukari = (n) => y(n.deger) > ust + 16;

  return `<svg viewBox="0 0 ${G} ${Y}" width="100%" class="grafik" aria-hidden="true">
    ${[min, (min + max) / 2, max].map((v) => `
      <line x1="${sol}" x2="${G - sag}" y1="${y(v)}" y2="${y(v)}" stroke="${R.cizgi}" stroke-width="1"/>
      <text x="${sol - 6}" y="${y(v) + 4}" text-anchor="end" fill="${R.soluk}" font-size="10">${v}</text>`).join("")}
    ${referans != null ? `
      <line x1="${sol}" x2="${G - sag}" y1="${y(referans)}" y2="${y(referans)}" stroke="${R.soluk}" stroke-width="1.5" stroke-dasharray="4 4"/>
      <text x="${G - sag}" y="${y(referans) - 5}" text-anchor="end" fill="${R.soluk}" font-size="10">${refAd} ${referans}${birim}</text>` : ""}
    ${alan ? `<path d="${alan}" fill="${renk}" opacity=".12"/>` : ""}
    <path d="${cizgi}" fill="none" stroke="${renk}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="grafik-cizgi"/>
    ${noktalar.map((n, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(n.deger).toFixed(1)}" r="${i === 0 || i === noktalar.length - 1 ? 5 : 3.5}" fill="${renk}" stroke="#1B1E25" stroke-width="2"/>`).join("")}
    ${etiket(0, ilk, yukari(ilk))}
    ${noktalar.length > 1 ? etiket(noktalar.length - 1, son, yukari(son)) : ""}
    ${noktalar.map((n, i) => (i === 0 || i === noktalar.length - 1) && n.seans != null
      ? `<text x="${x(i).toFixed(1)}" y="${Y - 6}" text-anchor="${i === 0 && noktalar.length > 1 ? "start" : noktalar.length > 1 ? "end" : "middle"}" fill="${R.soluk}" font-size="10">${n.seans}. seans</text>` : "").join("")}
  </svg>`;
}

// Yarım daire: son değer dolu yay, ilk değer içi boş nokta, sağlıklı taraf çentik.
export function yariDaire(ilk, son, saglikli) {
  const nokta = (d, r = 80) => {
    const a = Math.PI * (1 - Math.min(180, Math.max(0, d)) / 180);
    return [100 + r * Math.cos(a), 100 - r * Math.sin(a)];
  };
  const yay = (d) => {
    if (d <= 0) return "M20 100";
    const [x, y] = nokta(d);
    return `M20 100 A80 80 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
  };
  const centik = saglikli != null ? (() => {
    const [x1, y1] = nokta(saglikli, 66), [x2, y2] = nokta(saglikli, 94);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${R.yazi}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
  })() : "";
  return `<svg viewBox="0 0 200 112" width="100%" aria-hidden="true">
    <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="${R.cizgi}" stroke-width="16" stroke-linecap="round"/>
    <path d="${yay(son)}" fill="none" stroke="${R.rom}" stroke-width="16" stroke-linecap="round" class="buyuyen-yay"/>
    ${ilk != null && ilk !== son ? (() => {
      const [x, y] = nokta(ilk);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#101217" stroke="${R.yazi}" stroke-width="2.5"/>`;
    })() : ""}
    ${centik}
  </svg>`;
}

// Kutlama: ekranın üstünden dökülen renkli kâğıtlar. Dokunmayı engellemez.
export function konfeti() {
  const renkler = ["#5DCAA5", "#EF9F27", "#F1EFE8", "#97C459", "#CECBF6", "#F09595"];
  const kap = document.createElement("div");
  kap.className = "konfeti";
  for (let i = 0; i < 70; i++) {
    const k = document.createElement("i");
    k.style.left = `${Math.random() * 100}%`;
    k.style.background = renkler[i % renkler.length];
    k.style.animationDelay = `${Math.random() * 0.5}s`;
    k.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    k.style.setProperty("--don", `${(Math.random() - 0.5) * 900}deg`);
    k.style.setProperty("--kay", `${(Math.random() - 0.5) * 120}px`);
    if (i % 3 === 0) k.style.borderRadius = "50%";
    kap.appendChild(k);
  }
  document.body.appendChild(kap);
  setTimeout(() => kap.remove(), 3400);
}
