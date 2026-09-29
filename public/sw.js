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

// Changing this string makes the activate handler delete every older cache.
const CACHE_VERSION = "v4"; // v4: new favicon & app icons
const SHELL_CACHE = `zeus-shell-${CACHE_VERSION}`;
const MEDIA_CACHE = `zeus-media-${CACHE_VERSION}`;

// Files needed to open the app offline. Missing files are tolerated (see install).
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

// File types treated as immutable media (cache-first). NB: this matches ANY origin,
// not just Supabase — a replaced file at the same URL will keep serving the cached copy
// until CACHE_VERSION changes, so upload new versions under a new file name.
function isMedia(url) {
  return /\.(png|jpe?g|gif|webp|svg|mp4|webm|ogg|pdf|docx?|xlsx?)$/i.test(url.pathname);
}

function isSupabase(url) {
  return url.hostname.endsWith(".supabase.co");
}

// Request routing, first match wins:
//   non-GET → network · Supabase REST → network (never cached) · Range/video/audio → network
//   media files → cache-first · /assets/* (hashed build) → cache-first · same-origin → network-first
//   anything else (other origins) → browser default
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache API reads — stale H&S data is worse than no data. The app's own
  // state layer handles offline reads from what it already has in memory.
  if (isSupabase(url) && url.pathname.startsWith("/rest/")) return;

  // Video/audio: Chrome on Android streams these with Range requests. Serving a
  // cached full 200 (or an opaque cross-origin response) to a media element
  // makes Chrome refuse to play it, while iOS Safari mostly bypasses the worker
  // for media — which is why modules worked on iPhone and not Android.
  // Let the browser talk to storage directly.
  if (req.headers.has("range") || req.destination === "video" || req.destination === "audio") return;

  // Supabase storage objects (module images, document files) are immutable.
  if (isMedia(url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          // Fetch in CORS mode so we get a readable response we can safely
          // cache (Supabase storage sends CORS headers). Fall back to the
          // original request if the server doesn't allow it.
          let res;
          try { res = await fetch(req.url, { mode: "cors", credentials: "omit" }); }
          catch (e) { res = await fetch(req); }
          if (res.ok && res.status === 200 && res.type !== "opaque") {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch (err) {
          return Response.error();
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

// Lets the page activate a waiting worker immediately (postMessage {type:"SKIP_WAITING"}).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
