// ===== NOVACORE SERVICE WORKER =====
const CACHE_NAME = 'novacore-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './js/storage.js',
  './js/apis/davidcyril.js',
  './js/apis/prexzy.js',
  './js/media/audio-engine.js',
  './js/media/video-player.js',
  './js/media/audio-player.js',
  './js/systems/subtitles.js',
  './js/systems/lyrics.js',
  './js/systems/downloader.js',
  './js/systems/library.js',
  './js/systems/status-saver.js',
  './js/systems/vault.js',
  './js/tools/archive.js',
  './js/tools/file-manager.js',
  './js/tools/code-editor.js',
  './js/tools/ai-assistant.js',
  './js/ui/navigation.js',
  './js/ui/search.js',
  './js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Don't intercept API calls — let them go to network
  if (url.hostname.includes('apis.davidcyril') || url.hostname.includes('apis.prexzy') ||
      url.hostname.includes('cdnjs.cloudflare')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for app assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
