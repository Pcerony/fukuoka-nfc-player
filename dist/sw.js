const VERSION = '20261123-9';
const PREFIX = 'fukuoka-nfc-shell-';
const CACHE = PREFIX + VERSION;
const scope = self.registration.scope;
const index = new URL('index.html', scope).href;
const assets = ['style.css', 'dome-map.svg', 'record-artwork.png', 'main.mjs', 'offline.mjs', 'player.mjs', 'cloud.mjs', 'title-serif.woff2']
  .map(file => new URL(file + '?v=' + VERSION, scope).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([index, ...assets].map(url => new Request(url, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && (url.origin + url.pathname === scope || url.origin + url.pathname === index)) {
    event.respondWith(fetch(request, {cache: 'no-cache'}).catch(async () => (await caches.open(CACHE)).match(index)));
  } else if (assets.includes(request.url)) {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(request)) ?? fetch(request))());
  }
});
