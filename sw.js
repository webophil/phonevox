/* Vox - service worker : coque de l'application en cache, traductions hors cache. */
'use strict';

var CACHE = 'vox-shell-v2';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  /* La traduction passe par le reseau : jamais de reponse en cache. */
  if (url.origin !== self.location.origin) return;

  /* La page elle-meme : reseau d'abord, cache en secours, pour que chaque
     mise a jour soit visible sans attendre l'expiration du cache. */
  var isDocument = request.mode === 'navigate' ||
    (request.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isDocument) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.status === 200) {
          var fresh = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put('./index.html', fresh);
          }).catch(function () {});
        }
        return response;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: false }).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(request, copy);
          }).catch(function () {});
        }
        return response;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
