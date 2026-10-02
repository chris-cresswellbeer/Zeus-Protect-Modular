import React from "react";

/**
 * SessionTimeout — signs people out after 30 minutes without activity, with a
 * 2-minute warning that counts down and has a "Stay signed in" button.
 *
 *   startSession({ onExpire, onSignOut })   App.jsx, when someone signs in
 *   stopSession()                           when they sign out
 *   <SessionWarningHost/>                   mounted once in main.jsx (desktop and phone)
 *
 * Activity = mouse, keyboard, touch, scrolling, or a video playing on the page
 * (so watching a training video or the welcome video doesn't time you out).
 * Reading without touching anything for 28 minutes brings up the warning; any
 * activity, or the button, starts the 30 minutes again. The timeout itself is a
 * security measure for shared computers and isn't changed.
 * Tests can shorten it with window.__zpTimeoutMs (and __zpWarnMs).
 */

const LIMIT_MS = 30 * 60 * 1000;
const WARN_MS = 2 * 60 * 1000;
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click", "wheel"];

let s = { on: false, last: 0, warn: false, left: 0, onExpire: null, onSignOut: null, Z: null, font: null };
let tick = null;
const subs = new Set();
const emit = () => subs.forEach(f => f());
const limit = () => (typeof window !== "undefined" && window.__zpTimeoutMs) || LIMIT_MS;
const warnFor = () => (typeof window !== "undefined" && window.__zpWarnMs) || Math.min(WARN_MS, limit() / 2);

// While the warning is showing, only a deliberate click, tap or key press counts
// (so the warning doesn't vanish just because the mouse moved towards its button).
function activity(e) {
  if (!s.on) return;
  if (s.warn && e && /^(mousemove|scroll|wheel)$/.test(e.type)) return;
  s.last = Date.now();
  if (s.warn) { s.warn = false; emit(); }
}
function videoPlaying() {
  try { return [...document.querySelectorAll("video")].some(v => !v.paused && !v.ended && v.readyState > 2); } catch { return false; }
}
function check() {
  if (!s.on) return;
  if (videoPlaying()) s.last = Date.now();
  const left = s.last + limit() - Date.now();
  if (left <= 0) { const fn = s.onExpire; stopSession(); if (fn) fn(); return; }
  const warn = left <= warnFor();
  const secs = Math.ceil(left / 1000);
  if (warn !== s.warn || (warn && secs !== s.left)) { s.warn = warn; s.left = secs; emit(); }
}

export function startSession({ onExpire, onSignOut, Z, font } = {}) {
  stopSession();
  s = { ...s, on: true, last: Date.now(), warn: false, left: 0, onExpire, onSignOut, Z: Z || s.Z, font: font || s.font };
  EVENTS.forEach(e => window.addEventListener(e, activity, { passive: true, capture: true }));
  tick = setInterval(check, 1000);
  emit();
}
export function stopSession() {
  if (tick) clearInterval(tick); tick = null;
  EVENTS.forEach(e => window.removeEventListener(e, activity, { capture: true }));
  const was = s.warn; s = { ...s, on: false, warn: false };
  if (was) emit();
}
export function staySignedIn() { if (s.on) { s.last = Date.now(); s.warn = false; emit(); } }
export function setSessionTheme(Z, font) { s.Z = Z; s.font = font; }

const FALLBACK = { navyMd: "#152370", navyDk: "#091548", borderMd: "rgba(255,255,255,0.15)", white: "#f1f5f9", muted: "#94a3b8", accent: "#2563eb", blue: "#1d4ed8" };

export function SessionWarningHost() {
  const [, force] = React.useReducer(x => x + 1, 0);
  const btnRef = React.useRef(null);
  React.useEffect(() => { subs.add(force); return () => subs.delete(force); }, []);
  const show = s.on && s.warn;
  React.useEffect(() => { if (show && btnRef.current) btnRef.current.focus(); }, [show]);
  if (!show) return null;
  const Z = s.Z || FALLBACK, font = s.font || "system-ui,sans-serif";
  const m = Math.floor(s.left / 60), sec = String(s.left % 60).padStart(2, "0");
  return (
    <div role="alertdialog" aria-modal="false" aria-labelledby="zp-timeout-title" aria-describedby="zp-timeout-text" data-testid="timeout-warning"
      style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 6200, width: "min(520px, calc(100vw - 24px))",
        background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: "1px solid rgba(245,158,11,0.55)", borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,.5)", padding: "16px 18px", color: Z.white, fontFamily: font, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div id="zp-timeout-title" style={{ fontWeight: 900, fontSize: 15, color: "#fbbf24" }}>Still there?</div>
        <div id="zp-timeout-text" style={{ fontSize: 13, color: Z.muted, marginTop: 3, lineHeight: 1.45 }}>
          For security you'll be signed out in <b style={{ color: Z.white, fontVariantNumeric: "tabular-nums" }} data-testid="timeout-left">{m}:{sec}</b> unless you carry on.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { const fn = s.onSignOut; if (fn) fn(); }}
          style={{ background: "transparent", border: `1px solid ${Z.borderMd}`, color: Z.muted, borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font, minHeight: 44 }}>Sign out</button>
        <button ref={btnRef} onClick={staySignedIn} data-testid="stay-signed-in"
          style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, border: "none", color: "#fff", borderRadius: 10, padding: "10px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: font, minHeight: 44 }}>Stay signed in</button>
      </div>
    </div>
  );
}
