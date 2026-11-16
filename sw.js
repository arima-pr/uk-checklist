// 電波がなくてもページを開けるようにする仕組み（Service Worker）
// ページ本体は「まず最新を取りに行き、だめなら保存してある分を出す」
// 画像やフォントは「保存してある分を先に出し、なければ取りに行く」
var CACHE = 'mipa-uk-v2';
var CORE = ['./', 'index.html', 'bg.webp', 'apple-touch-icon.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var isPage = req.mode === 'navigate' || (url.origin === location.origin && /(\/|index\.html)$/.test(url.pathname));

  if (isPage) {
    // ブラウザの一時保存を使わず、毎回GitHubに新しい版がないか確かめる
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
