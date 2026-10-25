/*
 * Le reste de ta vie — fonctionnement hors connexion.
 * Les fichiers de l'application sont gardés en cache. Quand le réseau répond,
 * on prend sa version (pour avoir toujours la dernière) et on met le cache à
 * jour ; sinon on sert le cache. Les polices, qui ne changent pas, viennent
 * du cache dès qu'elles y sont.
 */
const CACHE = 'le-reste-de-ta-vie-v1';
const FILES = [
  './',
  'index.html',
  'documentation.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/life.js',
  'js/causes.js',
  'js/app.js',
  'js/doc.js',
  'img/logo.svg',
  'img/icon-192.png',
  'img/icon-512.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function remember(request, response) {
  if (response.ok || response.type === 'opaque') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => remember(request, response))
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then((hit) => hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
    );
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((response) => remember(request, response))));
  }
});
