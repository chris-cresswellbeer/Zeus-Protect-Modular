/**
 * ═══════════════════════════════════════════════════════════════════════════
 * fileAccess.js — private files (new sign-in only, VITE_AUTH_MODE=supabase)
 * ═══════════════════════════════════════════════════════════════════════════
 * With the new sign-in, the "documents", "fire-safety" and "incident-photos"
 * buckets are PRIVATE: their old ".../object/public/..." links no longer open
 * for anyone. A signed-in person gets a short-lived SIGNED link instead, and
 * only for files the database rules let them read (db_rules.sql, section 4).
 *
 * The database still stores the ordinary ".../object/public/..." links, so
 * nothing about saving changes. This file swaps them for signed links at the
 * moment they are shown:
 *
 *   startPrivateFiles()  Any <img>, <video>, <source>, <iframe>, <embed>,
 *                        <audio> or <a> given a private file link (by React, or
 *                        as raw HTML) gets a signed link instead. Requests are
 *                        batched, one per bucket, and cached. Clicking a link
 *                        whose signature is old signs it again first.
 *   useFileUrl(url)      Hook for components that must not show a broken file
 *                        first (e.g. ones with onError fallbacks): returns the
 *                        signed link, or null while it is being fetched.
 *   signedUrl(url)       Promise of a signed link (or the url unchanged).
 *   embedFiles(html)     For reports downloaded as .html files: private images
 *                        are copied INTO the file (so they still show later,
 *                        offline); other private links become signed links.
 *
 * With the old sign-in (legacy) all of these do nothing — buckets are public.
 * Only links to THIS project's storage are touched, so the staging copy's links
 * to live files are left alone.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { SUPABASE_URL, SUPABASE_ANON, bearer } from "./supabase";
import { AUTH_MODE } from "./auth";

export const PRIVATE_BUCKETS = ["documents", "fire-safety", "incident-photos"];
const ON = AUTH_MODE === "supabase";
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`;
const LIFETIME = 3600;                 // seconds a signed link works for
const REUSE_MS = (LIFETIME - 600) * 1000;   // re-sign when less than 10 minutes left

/** {bucket, path} for a link to one of our private files, otherwise null. */
export function parsePrivateUrl(u) {
  if (!ON || typeof u !== "string" || !u.startsWith(PUBLIC_PREFIX)) return null;
  const rest = u.slice(PUBLIC_PREFIX.length).split(/[?#]/)[0];
  const slash = rest.indexOf("/");
  if (slash < 1) return null;
  const bucket = rest.slice(0, slash);
  if (!PRIVATE_BUCKETS.includes(bucket)) return null;
  let path;
  try { path = rest.slice(slash + 1).split("/").map(decodeURIComponent).join("/"); } catch { return null; }
  return path ? { bucket, path } : null;
}
export const isPrivateUrl = u => !!parsePrivateUrl(u);

// ── signing, batched per bucket, cached per link ──────────────────────────
const cache = new Map();     // original link → { url, at }
const queue = new Map();     // bucket → Map(path → [{ orig, resolve }])
let flushTimer = null;

async function flush() {
  flushTimer = null;
  const jobs = [...queue.entries()]; queue.clear();
  await Promise.all(jobs.map(async ([bucket, byPath]) => {
    const paths = [...byPath.keys()];
    let rows = [];
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON, Authorization: bearer(), "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: LIFETIME, paths }),
      });
      if (res.ok) rows = await res.json();
      else console.warn("[files] could not sign links:", res.status, await res.text());
    } catch (e) { console.warn("[files] could not sign links:", e); }
    const byResult = new Map((Array.isArray(rows) ? rows : []).map(r => [r.path, r]));
    for (const [path, waiters] of byPath) {
      const r = byResult.get(path);
      const url = r && !r.error && r.signedURL ? encodeURI(`${SUPABASE_URL}/storage/v1${r.signedURL}`) : null;
      for (const w of waiters) {
        if (url) cache.set(w.orig, { url, at: Date.now() });
        w.resolve(url);        // null = not allowed / missing; caller keeps the original
      }
    }
  }));
}

/** Signed link for a private file; resolves to the link unchanged if it isn't one (or can't be signed). */
export function signedUrl(u, { fresh = false } = {}) {
  const p = parsePrivateUrl(u);
  if (!p) return Promise.resolve(u);
  const hit = cache.get(u);
  if (hit && !fresh && Date.now() - hit.at < REUSE_MS) return Promise.resolve(hit.url);
  return new Promise(resolve => {
    if (!queue.has(p.bucket)) queue.set(p.bucket, new Map());
    const byPath = queue.get(p.bucket);
    if (!byPath.has(p.path)) byPath.set(p.path, []);
    byPath.get(p.path).push({ orig: u, resolve: url => resolve(url || u) });
    if (!flushTimer) flushTimer = setTimeout(flush, 0);
  });
}

/** Hook: the link to use in src/href. null while a private link is being signed. */
export function useFileUrl(u) {
  const priv = isPrivateUrl(u);
  const hit = priv ? cache.get(u) : null;
  const ready = hit && Date.now() - hit.at < REUSE_MS ? hit.url : null;
  const [signed, setSigned] = React.useState({ for: u, url: ready });
  React.useEffect(() => {
    if (!priv) return;
    let live = true;
    signedUrl(u).then(url => { if (live) setSigned({ for: u, url }); });
    return () => { live = false; };
  }, [u, priv]);
  if (!priv) return u;
  return signed.for === u && signed.url ? signed.url : ready;
}

// ── page watcher ──────────────────────────────────────────────────────────
const ATTR = { IMG: "src", VIDEO: "src", AUDIO: "src", SOURCE: "src", IFRAME: "src", EMBED: "src", A: "href" };

const rawSet = typeof Element !== "undefined" ? Element.prototype.setAttribute : null;
const setRaw = (el, name, value) => rawSet.call(el, name, value);

// Point an element at the signed link once it's ready (unless the page has since
// pointed it somewhere else).
function applySigned(el, attr, orig) {
  signedUrl(orig).then(url => {
    if (el.getAttribute("data-zp-file") !== orig) return;
    if (url !== orig) setRaw(el, "data-zp-signed", String(Date.now()));
    else console.warn("[files] no signed link for", orig);
    if (el.getAttribute(attr) === url) return;
    setRaw(el, attr, url);
    if (el.tagName === "SOURCE" && el.parentElement && typeof el.parentElement.load === "function") el.parentElement.load();
  });
}
// Elements added as raw HTML (e.g. module slide text) — found by the watcher.
function fix(el) {
  const attr = ATTR[el.tagName];
  if (!attr) return;
  const v = el.getAttribute(attr);
  if (!isPrivateUrl(v)) return;
  setRaw(el, "data-zp-file", v);
  applySigned(el, attr, v);
}
function scan(root) {
  if (root.nodeType !== 1) return;
  fix(root);
  root.querySelectorAll && root.querySelectorAll("img,video,audio,source,iframe,embed,a").forEach(fix);
}

let started = false;
export function startPrivateFiles() {
  if (!ON || started || typeof document === "undefined") return;
  started = true;

  // React sets src/href (as an attribute or a property). Catch private links there, BEFORE the
  // browser tries the old public link (which would fail and flash a broken image):
  // a recently signed link is used straight away; otherwise the element waits
  // without a src (links keep their href) until the signed link arrives.
  Element.prototype.setAttribute = function (name, value) {
    const attr = ATTR[this.tagName];
    if (attr && String(name).toLowerCase() === attr) {
      if (isPrivateUrl(value)) {
        setRaw(this, "data-zp-file", value);
        const hit = cache.get(value);
        if (hit && Date.now() - hit.at < REUSE_MS) { setRaw(this, "data-zp-signed", String(hit.at)); return setRaw(this, name, hit.url); }
        if (this.tagName === "A") setRaw(this, name, value); else this.removeAttribute(name);
        applySigned(this, attr, value);
        return;
      }
      this.removeAttribute("data-zp-file"); this.removeAttribute("data-zp-signed");
    }
    return rawSet.call(this, name, value);
  };
  // React's production build sets src as a property (img.src = …), not an attribute,
  // so the same check goes on those property setters.
  [[window.HTMLImageElement, "src"], [window.HTMLMediaElement, "src"], [window.HTMLSourceElement, "src"],
   [window.HTMLIFrameElement, "src"], [window.HTMLEmbedElement, "src"], [window.HTMLAnchorElement, "href"]].forEach(([C, prop]) => {
    const d = C && Object.getOwnPropertyDescriptor(C.prototype, prop);
    if (!d || !d.set || !d.configurable) return;
    Object.defineProperty(C.prototype, prop, { ...d, set(v) { if (isPrivateUrl(v)) this.setAttribute(prop, v); else d.set.call(this, v); } });
  });

  const mo = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === "attributes") fix(r.target);
      else r.addedNodes.forEach(scan);
    }
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "href"] });
  scan(document.documentElement);

  // A link that hasn't been signed yet, or whose signature is getting old:
  // sign it now and open that. The new tab is opened straight away (inside the
  // click) so pop-up blockers allow it, then pointed at the signed link.
  document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    const orig = isPrivateUrl(a.getAttribute("href")) ? a.getAttribute("href") : a.getAttribute("data-zp-file");
    if (!orig) return;
    const at = Number(a.getAttribute("data-zp-signed") || 0);
    if (at && Date.now() - at < REUSE_MS) return;              // signed recently — let it open normally
    e.preventDefault();
    const newTab = a.target === "_blank" || a.hasAttribute("download");
    const win = newTab ? window.open("", "_blank") : null;
    signedUrl(orig, { fresh: true }).then(url => {
      a.setAttribute("data-zp-signed", String(Date.now()));
      a.setAttribute("href", url);
      if (win) { try { win.opener = null; } catch { /* */ } win.location.href = url; }
      else window.location.assign(url);
    });
  }, true);
}

// ── downloaded reports ────────────────────────────────────────────────────
const blobToDataUrl = b => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(b); });

/** Copy private images into an HTML string (as data URLs); sign other private links. */
export async function embedFiles(html) {
  if (!ON || typeof html !== "string") return html;
  const esc = PUBLIC_PREFIX.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const found = [...new Set(html.match(new RegExp(`${esc}[^"'\\s<>)]+`, "g")) || [])].filter(isPrivateUrl);
  const swaps = await Promise.all(found.map(async u => {
    const { bucket, path } = parsePrivateUrl(u);
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`,
        { headers: { apikey: SUPABASE_ANON, Authorization: bearer() } });
      if (res.ok) {
        const blob = await res.blob();
        if (String(blob.type).startsWith("image/") && blob.size < 8 * 1024 * 1024) return [u, await blobToDataUrl(blob)];
      }
    } catch { /* fall back to a signed link */ }
    return [u, await signedUrl(u)];
  }));
  let out = html;
  for (const [from, to] of swaps) out = out.split(from).join(to);
  return out;
}

// ── opening a file in a new tab (phones) ──────────────────────────────────
/**
 * Open a file in its own browser tab, where the phone's own viewer shows it
 * (PDFs and Office files don't display inside a page on most phones).
 * Call it straight from a tap: the tab is opened at once, so pop-up blockers
 * allow it, then pointed at the file. Works for:
 *   • private files (new sign-in) → a freshly signed link
 *   • data: URLs (documents generated in the portal) → turned into a local file
 *     link, because browsers refuse to open data: URLs in a tab
 *   • ordinary links → opened as they are
 * Returns false if the browser blocked the new tab.
 */
export function openFile(u) {
  if (typeof u !== "string" || !u) return false;
  if (!isPrivateUrl(u) && !/^data:/i.test(u)) {
    window.open(u, "_blank", "noopener");   // with "noopener" browsers return null, so it can't be checked
    return true;
  }
  const w = window.open("", "_blank");
  if (!w) return false;
  try { w.opener = null; } catch { /* */ }
  const go = url => { try { w.location.href = url; } catch { w.close(); } };
  if (/^data:/i.test(u)) {
    fetch(u).then(r => r.blob()).then(b => go(URL.createObjectURL(b))).catch(() => w.close());
  } else {
    signedUrl(u, { fresh: true }).then(go);
  }
  return true;
}
