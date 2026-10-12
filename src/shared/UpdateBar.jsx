/**
 * UpdateBar — "A new version of Zeus Protect is ready · Reload"
 * Shown when a new release takes over while the portal is open (mobile/registerSW.js
 * sends "zp-update-ready"; lib/staleBuild.jsx sends it with {stale:true} when a part of an
 * old page can't be downloaded, and {reconnect:true} when signal returns after a part
 * couldn't be downloaded). Reloading means signing in again. It never reloads by itself, so no one loses a half-filled
 * form; "Later" hides it until the next release.
 */
import React from "react";

export function UpdateBar() {
  const [show, setShow] = React.useState(false);   // false | "new" | "stale" | "reconnect"
  React.useEffect(() => {
    const on = (e) => { const d = (e && e.detail) || {}; setShow(d.stale ? "stale" : d.reconnect ? "reconnect" : "new"); };
    window.addEventListener("zp-update-ready", on);
    return () => window.removeEventListener("zp-update-ready", on);
  }, []);
  if (!show) return null;
  const btn = { border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
  return (
    <div role="status" data-testid="update-bar" style={{
      position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: "50%", transform: "translateX(-50%)",
      zIndex: 5900, width: "min(520px, calc(100vw - 32px))", boxSizing: "border-box",
      background: "#0b1a4a", color: "#f8fafc", border: "1px solid rgba(245,158,11,.5)", borderRadius: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,.35)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
      fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", fontSize: 13.5,
    }}>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{show === "stale"
        ? "Zeus Protect has been updated since this page was opened. Save anything you're working on, then Reload."
        : show === "reconnect"
        ? "You're back online. Save anything you're working on, then Reload to open the rest of the portal."
        : "A new version of Zeus Protect is ready. Reload when you've finished what you're doing."}</span>
      <button style={{ ...btn, background: "transparent", color: "#cbd5e1" }} onClick={() => setShow(false)}>Later</button>
      <button style={{ ...btn, background: "#f59e0b", color: "#111827" }} onClick={() => window.location.reload()}>Reload</button>
    </div>
  );
}
