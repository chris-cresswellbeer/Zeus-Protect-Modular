/**
 * unsaved.js — protection for half-finished forms (incident reports, investigations,
 * risk assessments, COSHH assessments, inspections, new modules, DSE).
 *
 *   useFormGuard({ key, label, active, value, onRestore })
 *     active    the form is open
 *     value     the form's current data; "unsaved" = different from when it was opened
 *     onRestore(draftValue)  put a saved draft back into the form
 *   → { dirty, draft, restore(), discard(), done() }
 *     draft     an earlier unsaved version found on this device ({ value, at }) or null
 *     done()    call after saving or cancelling: forgets the draft and the warning
 *
 * While a form has unsaved changes:
 *   • moving to another page asks first (confirmLeave(), used by App.jsx navigation);
 *   • closing or reloading the tab asks first (the browser's own warning);
 *   • a draft is kept on this device (localStorage, per person and form), so the work
 *     can be restored after a sign-out for inactivity, a closed tab or a crash.
 * Drafts never leave the device and are removed once saved, cancelled or discarded.
 */
import React from "react";
import { ask } from "../shared/Feedback";

const open = new Map();          // key → { label, discard }
let userId = "anon";
export const setDraftUser = id => { userId = id ? String(id) : "anon"; };
const storeKey = key => `zp.draft.${userId}.${key}`;
const MAX_DRAFT = 1500000;       // characters; bigger drafts (e.g. many photos) aren't kept

export const unsavedLabels = () => [...open.values()].map(v => v.label);

/** Ask before leaving when anything is unsaved. Resolves true to go ahead. */
export async function confirmLeave() {
  if (!open.size) return true;
  const labels = [...new Set(unsavedLabels())];
  const ok = await ask({
    title: "Leave without saving?", danger: true, ok: "Leave without saving", cancel: "Stay on this page",
    message: `You have unsaved changes in ${labels.join(", ")}.\n\nIf you leave now, they'll be lost.`,
  });
  if (ok) { [...open.values()].forEach(v => v.discard && v.discard()); open.clear(); }
  return ok;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", e => {
    if (!open.size) return;
    e.preventDefault(); e.returnValue = "";            // browser shows its own "Leave site?" question
  });
}

const stable = v => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x);
function readDraft(key) { try { const s = localStorage.getItem(storeKey(key)); return s ? JSON.parse(s) : null; } catch { return null; } }
function writeDraft(key, value) {
  try { const s = JSON.stringify({ value, at: new Date().toISOString() }); if (s.length <= MAX_DRAFT) localStorage.setItem(storeKey(key), s); } catch { /* full or blocked */ }
}
function dropDraft(key) { try { localStorage.removeItem(storeKey(key)); } catch { /* */ } }

export function useFormGuard({ key, label, active, value, onRestore, changed }) {
  // `changed` (optional): the form's own answer to "is anything unsaved?", for forms that
  // already track it (e.g. investigations, which also refresh from other people's saves)
  const baseRef = React.useRef(null);
  const [finished, setFinished] = React.useState(false);   // saved/cancelled: quiet until the form is opened again
  const [draft, setDraft] = React.useState(null);
  const json = active ? stable(value) : null;
  // when the form opens: remember how it started, and look for an earlier draft
  React.useEffect(() => {
    if (!active) { baseRef.current = null; setDraft(null); setFinished(false); return; }
    baseRef.current = json; setFinished(false);
    const d = readDraft(key);
    setDraft(d && stable(d.value) !== json ? d : null);
  }, [active, key]); // eslint-disable-line
  const [, bump] = React.useReducer(x => x + 1, 0);
  const dirty = !!active && !finished && (changed !== undefined ? !!changed : (baseRef.current !== null && json !== baseRef.current));
  // register / unregister the warning
  React.useEffect(() => {
    if (dirty) open.set(key, { label, discard: () => dropDraft(key) });
    else open.delete(key);
    return () => open.delete(key);
  }, [dirty, key, label]);
  // keep the draft (a moment after typing stops)
  React.useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => writeDraft(key, value), 700);
    return () => clearTimeout(t);
  }, [json, dirty]); // eslint-disable-line
  return {
    dirty, draft,
    restore: () => { if (draft) { onRestore(draft.value); setDraft(null); } },
    discard: () => { dropDraft(key); setDraft(null); },
    done: () => { dropDraft(key); open.delete(key); setFinished(true); setDraft(null); },
    saved: () => { dropDraft(key); open.delete(key); baseRef.current = json; setDraft(null); bump(); },   // saved, form stays open
    reopen: () => setFinished(false),     // e.g. "Report another" without closing the form
  };
}

/** "You have an unsaved draft from 10:42 — Restore / Discard" */
export function DraftBanner({ guard, Z, font, what = "this form" }) {
  if (!guard || !guard.draft) return null;
  const at = new Date(guard.draft.at);
  const when = isNaN(at) ? "earlier" : at.toDateString() === new Date().toDateString()
    ? `today at ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : at.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const b = primary => ({ background: primary ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : "transparent", color: primary ? "#fff" : Z.muted, border: primary ? "none" : `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 14px", fontWeight: 800, cursor: "pointer", fontSize: 12.5, fontFamily: font });
  return (
    <div role="status" data-testid="draft-banner" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", marginBottom: 14, borderRadius: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", fontFamily: font }}>
      <span style={{ fontSize: 13, color: Z.white, flex: 1, minWidth: 220 }}>📝 You have unsaved changes to {what} from {when} on this device.</span>
      <button onClick={guard.restore} style={b(true)}>Restore them</button>
      <button onClick={guard.discard} style={b(false)}>Discard</button>
    </div>
  );
}
