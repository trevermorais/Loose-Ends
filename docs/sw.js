// Cache-first service worker so the game runs fully offline as a PWA / Microsoft Store app.
const CACHE = "loose-ends-v1";
const FILES = [
  "index.html", "game.html", "privacy.html", "manifest.webmanifest",
  "main.css", "menu.css", "game.css",
  "menu.js", "game.js", "physics.js", "register-sw.js",
  "icon-192.png", "icon-512.png",
  "bebas-neue-latin-400-normal.woff2",
  "barlow-latin-400-normal.woff2", "barlow-latin-500-normal.woff2",
  "barlow-latin-600-normal.woff2", "barlow-latin-700-normal.woff2",
  "jetbrains-mono-latin-400-normal.woff2", "jetbrains-mono-latin-500-normal.woff2",
  "jetbrains-mono-latin-700-normal.woff2"
];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
