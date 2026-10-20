/**
 * Small shared pieces for the PPE register screens (domains/ppe/*).
 */
import React from "react";

export const ukd = iso => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
export const TONES = {
  green: ["#34d399", "rgba(16,185,129,0.12)", "rgba(16,185,129,0.32)"],
  amber: ["#fbbf24", "rgba(245,158,11,0.12)", "rgba(245,158,11,0.38)"],
  red: ["#fca5a5", "rgba(248,113,113,0.14)", "rgba(248,113,113,0.42)"],
  blue: ["#93c5fd", "rgba(96,165,250,0.12)", "rgba(96,165,250,0.38)"],
  grey: ["#cbd5e1", "rgba(148,163,184,0.12)", "rgba(148,163,184,0.32)"],
};
export function StateChip({ state, label, testid }) {
  const [c, bg, bd] = TONES[state.tone] || TONES.grey;
  return <span data-testid={testid} data-state={state.key} style={{ fontSize: 12, fontWeight: 800, color: c, background: bg, border: `1px solid ${bd}`, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>{label || state.label}</span>;
}
export const btn = (Z, font, kind = "plain") => ({
  fontFamily: font, fontSize: 13, fontWeight: 800, cursor: "pointer", borderRadius: 10, padding: "9px 15px", minHeight: 38,
  ...(kind === "primary" ? { color: "#fff", background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, border: "none" }
    : kind === "green" ? { color: "#fff", background: "linear-gradient(135deg,#10b981,#059669)", border: "none" }
    : kind === "danger" ? { color: "#fca5a5", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)" }
    : { color: Z.white, background: Z.overlay, border: `1px solid ${Z.borderMd}` }),
});
export const small = (Z, font, kind) => ({ ...btn(Z, font, kind), fontSize: 12, padding: "6px 11px", minHeight: 32, borderRadius: 8 });
export const field = (Z, font) => ({ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "10px 12px", color: Z.white, fontFamily: font, fontSize: 14, boxSizing: "border-box", colorScheme: "dark" });
export const lbl = Z => ({ display: "block", fontSize: 11.5, fontWeight: 700, color: Z.muted, textTransform: "uppercase", letterSpacing: .6, margin: "0 0 6px" });

/** A full-screen window over the page (Esc / the ✕ closes it). */
export function Modal({ title, onClose, children, width = 980, testid, Z, font, footer }) {
  React.useEffect(() => { const k = e => { if (e.key === "Escape") onClose && onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 8000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3vh 12px", overflowY: "auto" }}>
      <div data-testid={testid} style={{ background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: `1px solid ${Z.borderMd}`, borderRadius: 18, width: "100%", maxWidth: width, color: Z.white, fontFamily: font, boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${Z.border}` }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, flex: 1 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, color: Z.white, borderRadius: 10, width: 40, height: 40, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
        {footer && <div style={{ padding: "14px 20px", borderTop: `1px solid ${Z.border}`, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}
