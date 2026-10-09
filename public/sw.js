// Hors-ligne : actif seulement en https / localhost (contexte sécurisé).
// dist/sw.js reçoit en tête __PRECACHE__ (liste des fichiers) et __VERSION__ via scripts/inject-precache.mjs.
const CACHE = "pianoflow-" + (self.__VERSION__ || "dev");
const PRECACHE = self.__PRECACHE__ || [];
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // un fichier qui échoue ne doit pas empêcher l'installation des autres
    await Promise.allSettled(PRECACHE.map((u) => cache.add(u)));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  // fichiers à empreinte, samples et icônes : cache d'abord (ils ne changent pas sans changer de version de cache)
  const stable = url.pathname.includes("/assets/") || /piano-samples\.json$|icon-\d+\.png$/.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (stable && hit) return hit;
    try {                                               // reste : réseau d'abord, cache en secours
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      if (hit) return hit;
      if (req.mode === "navigate") return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      return Response.error();
    }
  })());
});
