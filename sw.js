// 🔖 버전 관리는 여기 한 곳만 — 코드/자산 바꾼 뒤 이 숫자만 올리면 캐시 갱신됨.
// (HTML의 ?v= 쿼리는 제거함: 코드 자산은 SW network-first로 항상 최신 반영)
const CACHE_NAME = 'noa-manbogi-v46';
const APP_ASSETS = [
  './',
  './index.html',
  './modes.html',
  './momotalk.html',
  './life.html',
  './fanmail.html',
  './fanmail-privacy.html',
  './privacy.html',
  './css/style.css',
  './css/modes.css',
  './css/fanmail.css',
  './js/core.js',
  './js/mode-router.js',
  './characters/noa.js',
  './js/app.js',
  './js/fanmail.js',
  './css/lite.css',
  './css/life.css',
  './js/lite.js',
  './js/life.js',
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
  if (!sameOrigin) return;

  const networkFirst = event.request.mode === 'navigate' || (sameOrigin && isCodeAsset(url));

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
    );
    return;
  }

  // cache-first (images 등)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
