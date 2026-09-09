/* sw.js — offline support.

   The point of this on an emergency preparedness site: after an earthquake, or
   during a smoke event, the network is exactly what stops working. Someone who
   has opened this site once should still be able to reach their checklist, the
   immediate-steps panels and the library list with no connection at all.

   The caching strategy is chosen around one risk: serving stale emergency
   information is worse than serving none.

     HTML          network first, cache as fallback. Online always gets the
                   current page; offline gets the last one seen.
     CSS/JS/JSON   network first, cache as fallback. These change on every
                   deploy, and stale-while-revalidate served the OLD copy on
                   the first load after one - so a change appeared to have
                   not shipped until the page was loaded twice. Offline they
                   still come from the cache, which is the point.
     fonts/images  stale-while-revalidate. Their content never changes for a
                   given URL, so serving instantly is free.
     /api/aqi      NEVER cached. A stale air quality reading could tell someone
                   the air is fine when it is not. Offline it fails, and the
                   page already has a designed state for that.
     other /api/   network only. Writes must not be replayed from a cache.
*/
const VERSION = 'v5';
const SHELL = 'shell-' + VERSION;
const ASSETS = 'assets-' + VERSION;

// Everything needed to render the site with no network at all.
const PRECACHE = [
  '/', '/index.html', '/kit.html', '/clean-air.html', '/earthquake.html',
  '/smoke.html', '/privacy.html', '/impact.html', '/wound.html', '/404.html',
  '/css/styles.css',
  '/js/i18n.js', '/js/track.js', '/js/app.js', '/js/prep.js',
  '/js/calculator.js', '/js/cleanair.js', '/js/savecode.js', '/js/aqi.js', '/js/auth.js',
  '/js/wound.js',
  '/i18n/en.json', '/i18n/es.json',
  '/data/kit-rules.json', '/data/clean-air-sites.json', '/data/zips.json',
  '/assets/fonts/atkinson-400.woff2', '/assets/fonts/atkinson-700.woff2',
  '/assets/fonts/nunito-var.woff2',
  '/assets/logo-96.png', '/assets/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // addAll fails the whole install if one file 404s; add individually so a
    // single missing asset cannot leave the site with no offline support.
    await Promise.all(PRECACHE.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, ASSETS]);
    for (const key of await caches.keys()) {
      if (!keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function isHtml(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Air quality must never come from a cache. Everything else under /api is
  // live data or a write path; let it go straight to the network.
  if (url.pathname.startsWith('/api/')) return;

  // The coordinator page edits live data. It must never be precached, never be
  // written to a cache by the handler below, and never be served from one - a
  // stale list of activated sites is exactly the wrong thing to show someone
  // deciding where to send people during a smoke event.
  if (url.pathname.indexOf('/admin') === 0) return;

  if (isHtml(request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(request) || await caches.match('/index.html');
        return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  /* Code and data change on every deploy, so they must come from the network
     when there is one. Fonts and images do not, so they can be served straight
     from the cache. */
  const versioned = /\.(css|js|json|webmanifest)$/i.test(url.pathname);

  event.respondWith((async () => {
    if (versioned) {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200) {
          const c = await caches.open(ASSETS);
          c.put(request, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match(request);
        return cached || new Response('', { status: 504 });
      }
    }

    const cached = await caches.match(request);
    const network = fetch(request).then((res) => {
      if (res && res.status === 200) {
        caches.open(ASSETS).then((c) => c.put(request, res.clone()));
      }
      return res;
    }).catch(() => null);
    return cached || network || new Response('', { status: 504 });
  })());
});
