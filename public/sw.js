/* public/sw.js — Zeus Protect service worker
 *
 * Jobs:
 *   1. Keep a copy of the app so it opens with no signal.
 *   2. Keep training module pictures (cache-first) so modules work offline.
 *   3. Wake on Background Sync so queued phone saves go out after signal returns.
 *
 * NEW RELEASES (no manual step needed any more):
 *   The build replaces __ZP_BUILD__ below with a new id on every `npm run build`
 *   (vite.config.js → zpStampServiceWorker). A new id = a new worker, which
 *   takes over at once and deletes the previous app copy. The page itself is
 *   always fetched from the network first, so an online phone always opens the
 *   newest release; the saved copy is only used when there is no signal.
 *
 * NEVER CACHED: database reads/writes (Supabase /rest, /auth), Netlify functions,
 *   signed (private) file links, and the private buckets (documents, fire-safety,
 *   incident-photos) — so no one's private files are left on a shared phone.
 */

const BUILD_ID = "__ZP_BUILD__";
const SHELL_CACHE = `zeus-shell-${BUILD_ID}`;
// Module pictures don't change with a release, so they keep their own cache.
// Bump MEDIA_VERSION only to force every phone to re-download them.
const MEDIA_VERSION = "m1";
const MEDIA_CACHE = `zeus-media-${MEDIA_VERSION}`;
const MEDIA_MAX = 400;   // keep at most this many pictures (oldest dropped first)

// The build writes this release's own files here (vite.config.js), so every part of
// the portal opens with no signal, not just the parts already visited. The large
// slide-import (pdf) files, used only by admins on a computer, are left out.
const BUILD_ASSETS = [] /*__ZP_ASSETS__*/;

const PRIVATE_BUCKETS = ["documents", "fire-safety", "incident-photos"];

// Files needed to open the app offline. Missing files are tolerated (see install).
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll() would reject the whole install if any one file 404s.
      .then((cache) => Promise.allSettled([
        ...SHELL_ASSETS.map((u) => cache.add(new Request(u, { cache: "reload" }))),
        ...BUILD_ASSETS.map((u) => cache.add(u)),
      ]))
      .then(() => self.skipWaiting())
  );
});

// Keeps this release's copy, module pictures, and the PREVIOUS release's copy (so a
// page opened before this release can still open its parts); older copies are removed.
// Build ids start with the date and time, so sorting the names puts them in order.
async function removeOldCopies() {
  const keys = await caches.keys();
  const shells = keys.filter((k) => k.startsWith("zeus-shell-") && k !== SHELL_CACHE).sort();
  const previous = shells.filter((k) => k < SHELL_CACHE).pop();
  await Promise.all(keys
    .filter((k) => k.startsWith("zeus-") && k !== SHELL_CACHE && k !== MEDIA_CACHE && k !== previous)
    .map((k) => caches.delete(k)));
}

self.addEventListener("activate", (event) => {
  event.waitUntil(removeOldCopies().then(() => self.clients.claim()));
});

// A public picture in Supabase storage that isn't in a private bucket.
function isModuleMedia(url) {
  if (!url.hostname.endsWith(".supabase.co")) return false;
  const m = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\//);
  if (!m || PRIVATE_BUCKETS.includes(m[1])) return false;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(url.pathname);
}

async function trimMedia(cache) {
  const keys = await cache.keys();
  if (keys.length <= MEDIA_MAX) return;
  await Promise.all(keys.slice(0, keys.length - MEDIA_MAX).map((k) => cache.delete(k)));
}

async function mediaFirst(req) {
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  let res;
  try { res = await fetch(req.url, { mode: "cors", credentials: "omit" }); }
  catch (e) { return fetch(req); }
  if (res.ok && res.status === 200 && res.type !== "opaque") {
    cache.put(req.url, res.clone()).then(() => trimMedia(cache)).catch(() => {});
  }
  return res;
}

const isHtml = (res) => /text\/html/i.test(res.headers.get("content-type") || "");

// Request routing, first match wins:
//   non-GET → network · other origins (except module pictures) → browser default
//   Range/video/audio → network · /.netlify/* → network
//   module pictures → cache-first · /assets/* (hashed build files) → cache-first
//   other same-origin files and pages → network-first, saved copy when offline
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Video/audio stream with Range requests; a cached full copy breaks playback on Android.
  if (req.headers.has("range") || req.destination === "video" || req.destination === "audio") return;

  if (isModuleMedia(url)) { event.respondWith(mediaFirst(req)); return; }

  if (url.origin !== self.location.origin) return;          // Supabase data, YouTube, fonts…
  if (url.pathname.startsWith("/.netlify/")) return;         // server functions: never cached

  // Hashed build files (/assets/index-a1b2c3.js) never change — serve the saved copy
  // at once. Never save an HTML page under an /assets/ name (a host's "not found" page).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        // this release's copy, or the previous release's (a page opened before this release)
        const hit = (await cache.match(req)) || (await caches.match(req));
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && !isHtml(res)) cache.put(req, res.clone()).catch(() => {});
        return res;
      })
    );
    return;
  }

  if (req.mode === "navigate") event.waitUntil(removeOldCopies().catch(() => {}));

  // Pages and other files: always try the network first (so a new release is
  // picked up straight away), fall back to the saved copy with no signal.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        if (req.mode === "navigate") return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("/index.html")) || (await cache.match("/")) || Response.error();
        return (await cache.match(req)) || Response.error();
      })
  );
});

// Background Sync: nudge every open page to send its queued saves.
self.addEventListener("sync", (event) => {
  if (event.tag !== "zeus-sync") return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
      clients.forEach((c) => c.postMessage({ type: "zeus-drain-queue" }));
    })
  );
});

self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  // "Keep modules offline": the phone sends the pictures of the person's assigned
  // modules so they are saved before they are needed.
  if (d.type === "zeus-keep-media" && Array.isArray(d.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(MEDIA_CACHE);
      for (const u of d.urls.slice(0, MEDIA_MAX)) {
        let url; try { url = new URL(u); } catch { continue; }
        if (!isModuleMedia(url) || await cache.match(u)) continue;
        try {
          const res = await fetch(u, { mode: "cors", credentials: "omit" });
          if (res.ok && res.status === 200) await cache.put(u, res);
        } catch { /* no signal — try again next time */ }
      }
      await trimMedia(cache);
    })());
  }
});
