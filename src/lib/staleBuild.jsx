/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/staleBuild.js — a page left open across a new release
 * ═══════════════════════════════════════════════════════════════════════════
 * Parts of the portal are downloaded the first time they're opened (App.jsx
 * lazyPart). A page opened BEFORE a new release asks for the old file names. The
 * offline copy (public/sw.js) keeps the previous release's files, so this normally
 * just works; if a part still can't be downloaded (no offline copy, very old
 * page), that part shows a short "updated — reload" note instead of an error, and
 * the "New version — Reload" bar appears (shared/UpdateBar.jsx).
 *
 * It deliberately does NOT reload by itself: a reload signs the person out and
 * would lose anything half-filled on the page.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";

function announce() {
  window.dispatchEvent(new CustomEvent("zp-update-ready", { detail: { stale: true } }));
}

function Offline() {
  // Browsers remember a failed download for the life of the page, so it can't simply be
  // tried again: once back online, the bar offers Reload.
  React.useEffect(() => {
    const on = () => window.dispatchEvent(new CustomEvent("zp-update-ready", { detail: { reconnect: true } }));
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
  return (
    <div data-testid="offline-part" style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.6 }}>
      This part of the portal needs signal to open.<br />
      When you're back online, save anything you're working on and use <strong>Reload</strong>.
    </div>
  );
}

function Updated() {
  return (
    <div data-testid="stale-part" style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.6 }}>
      This part of the portal has just been updated.<br />
      Save anything you're working on, then use <strong>Reload</strong> at the top of the screen.
    </div>
  );
}

/**
 * React.lazy, but a part that can't be downloaded shows a note instead of an error:
 * "needs signal" (no signal) or "updated — Reload" (gone from the server after a release).
 * Used exactly like React.lazy (render it inside <React.Suspense>).
 */
export function lazyFresh(loader) {
  return React.lazy(() => loader().catch(err => {
    console.warn("[portal] part failed to download", err);
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { default: Offline };
    announce();
    return { default: Updated };
  }));
}

/** Vite's own signal that a part's supporting files failed to download. */
export function watchStaleBuild() {
  window.addEventListener("vite:preloadError", () => { if (navigator.onLine !== false) announce(); });
}
