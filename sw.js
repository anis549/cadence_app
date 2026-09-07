/* Cadence — Service Worker
   Met en cache la coquille de l'application (HTML + bibliothèques CDN)
   pour qu'elle s'ouvre même sans connexion. Les appels à l'API
   Google Sheets ne sont jamais mis en cache ici : ils passent par
   la logique hors-ligne dédiée dans index.html (cache + file d'attente).
*/

const CACHE_NAME = "cadence-shell-v1";

const SHELL_URLS = [
  "./",
  "./index.html",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap",
  "https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js",
  "https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { mode: "no-cors" })).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Ne jamais intercepter les appels vers le backend Google Apps Script :
  // ils doivent toujours tenter le réseau réel (la logique hors-ligne de
  // l'app gère elle-même le repli en cas d'échec).
  if (url.includes("script.google.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => cached);
      // stale-while-revalidate : sert le cache immédiatement si présent,
      // met à jour en arrière-plan
      return cached || networkFetch;
    })
  );
});
