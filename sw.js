// Coquille hors ligne, et rien d'autre : la page et les fichiers versionnés de /assets/.
// Jamais les données : les appels au serveur (autre domaine) et les envois ne passent pas ici.
// La page vient toujours du réseau d'abord : une nouvelle version n'est jamais retenue par ce cache.
const CACHE = "yaralma-coquille-v1", MAX = 60;
// Le ménage ne jette jamais la page elle-même : sans elle, plus rien hors ligne.
const ranger = async (c, q, r) => { await c.put(q, r); const k = await c.keys(); if (k.length > MAX) await c.delete(k.find((x) => new URL(x.url).pathname !== racine().pathname)); };
const racine = () => new URL("./", self.registration.scope);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
  // Les fichiers de la page déjà ouverte, pour que le hors-ligne marche dès la prochaine visite.
  try {
    const c = await caches.open(CACHE), r = await fetch(racine());
    if (r.ok) { const t = await r.clone().text(); await c.put(racine(), r); for (const m of t.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)) await c.add(new URL(m[1], racine())); }
  } catch { /* hors ligne : ce sera pour la prochaine fois */ }
})()));

// Les morceaux chargés avant que ce service worker ne prenne la main : la page les donne, ils servent dès la prochaine visite hors ligne.
self.addEventListener("message", (e) => {
  if (e.data?.type !== "morceaux" || !Array.isArray(e.data.urls)) return;
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const u of e.data.urls) {
      const x = new URL(u, location.href);
      if (x.origin !== location.origin || !x.pathname.includes("/assets/") || await c.match(x)) continue;
      try { const r = await fetch(x); if (r.ok) await ranger(c, x, r); } catch { /* hors ligne : tant pis */ }
    }
  })());
});

self.addEventListener("fetch", (e) => {
  const q = e.request, u = new URL(q.url);
  if (q.method !== "GET" || u.origin !== location.origin) return;
  if (q.mode === "navigate") {
    e.respondWith(fetch(q).then(async (r) => { if (r.ok) await ranger(await caches.open(CACHE), racine(), r.clone()); return r; })
      .catch(async () => (await caches.match(racine())) ?? Response.error()));
  } else if (u.pathname.includes("/assets/")) {
    e.respondWith(caches.match(q).then((m) => m ?? fetch(q).then(async (r) => { if (r.ok) await ranger(await caches.open(CACHE), q, r.clone()); return r; })));
  }
});
