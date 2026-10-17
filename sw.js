// Çevrimdışı çalışma: uygulama dosyaları önbellekte, önce önbellekten.
// Dosyalardan biri değişince SURUM'u artır — telefon yeni sürümü ancak
// böyle alır.
const SURUM = "hasta-takip-2";
const DOSYALAR = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/db.js",
  "js/devam.js",
  "js/kilit.js",
  "js/model.js",
  "js/rapor.js",
  "vendor/xlsx.full.min.js",
  "ikon/ikon-180.png",
  "ikon/ikon-192.png",
  "ikon/ikon-512.png",
];

self.addEventListener("install", (o) => {
  o.waitUntil(caches.open(SURUM).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (o) => {
  o.waitUntil(caches.keys()
    .then((adlar) => Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (o) => {
  if (o.request.method !== "GET") return;
  o.respondWith(caches.match(o.request, { ignoreSearch: true })
    .then((k) => k || fetch(o.request)));
});
