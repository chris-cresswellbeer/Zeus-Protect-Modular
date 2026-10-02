import React from "react";

/**
 * Feedback — on-page messages and confirmation windows, instead of the browser's
 * alert() / confirm() pop-ups (which block the page, look like errors, and are
 * sometimes suppressed on phones).
 *
 *   notify("Saved")                                  green message, bottom of the screen
 *   notify("Couldn't save: …", { kind: "error" })    red, stays until closed
 *   notify("Removed", { undo: () => … })             with an Undo button
 *   if (!(await ask({ title, message, ok: "Delete", danger: true }))) return;
 *   const choice = await ask({ …, choices: [{ id:"keep", label:"…" }, { id:"remove", label:"…", danger:true }] })
 *                                                    → the chosen id, or false if cancelled
 *   const v = await ask({ title, fields: [{ id:"date", label:"Date", type:"date", value:"2026-01-01", required:true }] })
 *                                                    → { date: "…" }, or false if cancelled
 *     field extras: options:[{value,label}] (drop-down), suggestions:["…"] (type or pick), help:"…"
 *
 * <FeedbackHost/> is rendered once (App.jsx, desktop and phone) and shows them.
 * A message can survive a page reload with notifyAfterReload() (e.g. "signed out").
 * Tests can answer windows automatically by setting window.__zpTestAutoAnswer.
 */

let toasts = [];
let theme = { Z: null, font: "system-ui,sans-serif" };
/** App.jsx passes its colour theme so messages match it. */
export function setFeedbackTheme(Z, font) { if (theme.Z !== Z || theme.font !== font) { theme = { Z, font }; emit(); } }
let dialog = null;
let nextId = 1;
const subs = new Set();
const emit = () => subs.forEach(f => f());

export function notify(message, opts = {}) {
  const kind = opts.kind || "success";
  const t = { id: nextId++, message: String(message || ""), kind, undo: opts.undo || null, undoLabel: opts.undoLabel || "Undo" };
  toasts = [...toasts.slice(-3), t];
  emit();
  try { if (typeof window !== "undefined") (window.__zpNotes = window.__zpNotes || []).push({ kind, message: t.message }); } catch { /* */ }
  const ms = opts.timeout != null ? opts.timeout : kind === "error" ? 0 : t.undo ? 8000 : 4500;
  if (ms) setTimeout(() => dismiss(t.id), ms);
  return t.id;
}
export function dismiss(id) { toasts = toasts.filter(t => t.id !== id); emit(); }

/** Show a message on the next page load (sessionStorage), e.g. before a reload. */
export function notifyAfterReload(message, opts = {}) {
  try { sessionStorage.setItem("zp.flash", JSON.stringify({ message, ...opts })); } catch { /* */ }
}

const fieldDefaults = o => Object.fromEntries((o.fields || []).map(f => [f.id, f.value == null ? "" : String(f.value)]));
export function ask(opts) {
  const o = typeof opts === "string" ? { message: opts } : opts;
  try {
    if (typeof window !== "undefined" && typeof window.__zpTestAutoAnswer === "function") {
      const v = window.__zpTestAutoAnswer(o);
      return Promise.resolve(o.fields && v === true ? fieldDefaults(o) : v);
    }
  } catch { /* the test wants the real window */ }
  return new Promise(resolve => {
    dialog = { ...o, resolve: v => { dialog = null; emit(); resolve(v); } };
    emit();
  });
}

function useFeedback() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { subs.add(force); return () => subs.delete(force); }, []);
  return { toasts, dialog };
}

const COLORS = { success: ["#065f46", "#10b981"], error: ["#7f1d1d", "#ef4444"], info: ["#1e3a8a", "#3b82f6"], warn: ["#78350f", "#f59e0b"] };

function Paragraphs({ text }) {
  return String(text || "").split(/\n{2,}/).map((p, i) => (
    <p key={i} style={{ margin: i ? "10px 0 0" : 0, whiteSpace: "pre-line", lineHeight: 1.55 }}>{p}</p>
  ));
}

const FALLBACK = { navyMd: "#152370", navy: "#0d1f5c", navyDk: "#091548", borderMd: "rgba(255,255,255,0.15)", overlay: "rgba(255,255,255,0.06)", white: "#f1f5f9", muted: "#94a3b8", slate: "#cbd5e1", accent: "#2563eb", blue: "#1d4ed8" };
function FeedbackHost() {
  const { toasts: list, dialog: d } = useFeedback();
  const Z = theme.Z || FALLBACK, font = theme.font;
  const okRef = React.useRef(null);
  const [vals, setVals] = React.useState({});
  React.useEffect(() => { setVals(d && d.fields ? fieldDefaults(d) : {}); }, [d]);
  const missing = d && d.fields ? d.fields.filter(f => f.required && !String(vals[f.id] || "").trim()) : [];
  const okValue = () => (d.fields ? vals : true);
  // show a message saved before a reload
  React.useEffect(() => {
    try { const f = sessionStorage.getItem("zp.flash"); if (f) { sessionStorage.removeItem("zp.flash"); const o = JSON.parse(f); notify(o.message, o); } } catch { /* */ }
  }, []);
  // dialog keyboard: Enter = main action, Escape = cancel; focus the main button
  React.useEffect(() => {
    if (!d) return;
    const t = setTimeout(() => {
      const first = d.fields && document.querySelector('[data-testid="ask"] input, [data-testid="ask"] select');
      if (first) first.focus(); else if (okRef.current) okRef.current.focus();
    }, 30);
    const onKey = e => { if (e.key === "Escape") { e.preventDefault(); d.resolve(false); } };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [d]);
  const btn = (kind) => ({
    border: kind === "plain" ? `1px solid ${Z.borderMd}` : "none",
    background: kind === "danger" ? "linear-gradient(135deg,#ef4444,#b91c1c)" : kind === "primary" ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay,
    color: kind === "plain" ? Z.muted : "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontSize: 13, fontFamily: font,
  });
  return (
    <>
      {list.length > 0 && (
        <div role="status" aria-live="polite" data-testid="toasts"
          style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 6000, display: "grid", gap: 8, width: "min(560px, calc(100vw - 32px))", fontFamily: font }}>
          {list.map(t => { const [bg, edge] = COLORS[t.kind] || COLORS.info; return (
            <div key={t.id} data-testid={`toast-${t.kind}`} style={{ background: bg, borderLeft: `5px solid ${edge}`, color: "#fff", borderRadius: 12, padding: "11px 12px 11px 16px", boxShadow: "0 10px 30px rgba(0,0,0,.35)", display: "flex", alignItems: "center", gap: 12, fontSize: 13.5 }}>
              <div style={{ flex: 1, lineHeight: 1.45, whiteSpace: "pre-line" }}>{t.message}</div>
              {t.undo && <button onClick={() => { dismiss(t.id); t.undo(); }} style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.35)", color: "#fff", borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer", fontFamily: font }}>{t.undoLabel}</button>}
              <button onClick={() => dismiss(t.id)} aria-label="Close message" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.8)", cursor: "pointer", fontSize: 16, fontFamily: font }}>✕</button>
            </div>); })}
        </div>
      )}
      {d && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 6100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onMouseDown={e => { if (e.target === e.currentTarget) d.resolve(false); }}>
          <div role="alertdialog" aria-modal="true" aria-label={d.title || "Please confirm"} data-testid="ask"
            style={{ background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: `1px solid ${d.danger ? "rgba(239,68,68,.45)" : Z.borderMd}`, borderRadius: 18, padding: 24, width: "100%", maxWidth: 520, color: Z.white, fontFamily: font, boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 900, color: d.danger ? "#fca5a5" : Z.white }}>{d.danger ? "⚠ " : ""}{d.title || "Please confirm"}</h3>
            <div style={{ fontSize: 13.5, color: Z.slate || Z.white }}><Paragraphs text={d.message} /></div>
            {d.fields && (
              <form onSubmit={e => { e.preventDefault(); if (!missing.length) d.resolve(okValue()); }} style={{ display: "grid", gap: 12, marginTop: d.message ? 14 : 0 }}>
                {d.fields.map(f => (
                  <label key={f.id} style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: Z.muted }}>
                    <span>{f.label}{f.required ? " *" : ""}</span>
                    {f.options ? (
                      <select value={vals[f.id] || ""} name={f.id} onChange={e => { const v = e.target.value; setVals(p => ({ ...p, [f.id]: v })); }}
                        style={{ background: Z.navyMd || Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 9, padding: "9px 12px", color: Z.white, fontSize: 14, fontFamily: font }}>
                        <option value="">{f.placeholder || "Choose…"}</option>
                        {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input type={f.type || "text"} value={vals[f.id] || ""} placeholder={f.placeholder || ""} name={f.id} list={f.suggestions ? `ask-list-${f.id}` : undefined}
                        onChange={e => { const v = e.target.value; setVals(p => ({ ...p, [f.id]: v })); }}
                        style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 9, padding: "9px 12px", color: Z.white, fontSize: 14, fontFamily: font, colorScheme: "dark" }} />
                    )}
                    {f.suggestions && <datalist id={`ask-list-${f.id}`}>{f.suggestions.map(x => <option key={x} value={x} />)}</datalist>}
                    {f.help && <span style={{ fontWeight: 400, fontSize: 11.5, lineHeight: 1.45 }}>{f.help}</span>}
                  </label>
                ))}
                <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
              </form>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={() => d.resolve(false)} style={btn("plain")}>{d.cancel || "Cancel"}</button>
              {d.choices
                ? d.choices.map((c, i) => <button key={c.id} ref={i === d.choices.length - 1 ? okRef : null} onClick={() => d.resolve(c.id)} style={btn(c.danger ? "danger" : "primary")}>{c.label}</button>)
                : <button ref={okRef} disabled={missing.length > 0} onClick={() => d.resolve(okValue())} style={{ ...btn(d.danger ? "danger" : "primary"), opacity: missing.length ? .5 : 1, cursor: missing.length ? "not-allowed" : "pointer" }}>{d.ok || "OK"}</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { FeedbackHost };
