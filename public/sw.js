/* public/sw.js — Zeus Protect service worker
 *
 * Three jobs:
 *   1. Precache the app shell so the app opens with no signal.
 *   2. Runtime-cache module media and document files (cache-first, they are
 *      immutable once published).
 *   3. Wake on Background Sync so queued writes go out even if the tab was
 *      closed before connectivity returned.
 *
 * Bump CACHE_VERSION on every deploy — Vite's hashed filenames make the old
 * entries dead weight otherwise.
 */

const CACHE_VERSION = "v2";
const SHELL_CACHE = `zeus-shell-${CACHE_VERSION}`;
const MEDIA_CACHE = `zeus-media-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll() rejects the entire install if any single entry 404s, which
      // silently leaves the app with no worker at all. Add them individually
      // and tolerate misses.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== MEDIA_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isMedia(url) {
  return /\.(png|jpe?g|gif|webp|svg|mp4|webm|ogg|pdf|docx?|xlsx?)$/i.test(url.pathname);
}

function isSupabase(url) {
  return url.hostname.endsWith(".supabase.co");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache API reads — stale H&S data is worse than no data. The app's own
  // state layer handles offline reads from what it already has in memory.
  if (isSupabase(url) && url.pathname.startsWith("/rest/")) return;

  // Supabase storage objects (module images, document files) are immutable.
  if (isMedia(url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // Hashed build output (/assets/index-a1b2c3.js) is immutable — serve it from
  // cache immediately and never wait on the network. This is the difference
  // between the app opening instantly and re-downloading the bundle on every
  // launch over a weak connection.
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // App shell and build assets: network-first with a cache fallback, so a
  // deployed update is picked up but a dead connection still opens the app.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(req);
          if (hit) return hit;
          if (req.mode === "navigate") return caches.match("/index.html");
          return Response.error();
        })
    );
  }
});

// Nudge every open client to drain its queue. The queue itself lives in
// IndexedDB on the page side; the worker only provides the wake-up.
self.addEventListener("sync", (event) => {
  if (event.tag !== "zeus-sync") return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
      clients.forEach((c) => c.postMessage({ type: "zeus-drain-queue" }));
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
