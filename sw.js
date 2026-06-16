const CACHE_NAME = 'noa-manbogi-v29';
const APP_ASSETS = [
  './',
  './index.html',
  './momotalk.html',
  './fanmail.html',
  './css/style.css',
  './css/fanmail.css',
  './js/core.js',
  './js/app.js',
  './js/fanmail.js',
  './css/lite.css',
  './js/lite.js',
  './manifest.webmanifest',
  './noa-mobile.jpg',
  './noa-desktop.jpg',
  './noa1-mobile.jpg',
  './noa1-desktop.jpg',
  './noa2-mobile.jpg',
  './noa2-desktop.jpg',
  './noa3-mobile.jpg',
  './noa3-desktop.jpg',
  './icon-192.png',
  './icon-512.png',
  './js/confetti.browser.min.js',
  './js/chart.js',
  './js/html2canvas.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// 코드(HTML/CSS/JS)는 네트워크 우선 → 항상 최신 반영, 오프라인이면 캐시로 폴백.
// 이미지/그 외 정적자원은 캐시 우선 → 빠르고 데이터 절약.
function isCodeAsset(url) {
  return url.pathname.endsWith('.html')
    || url.pathname.endsWith('.css')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('/');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const networkFirst = event.request.mode === 'navigate' || (sameOrigin && isCodeAsset(url));

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // cache-first (images 등)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
