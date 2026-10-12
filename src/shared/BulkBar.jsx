/**
 * shared/BulkBar.jsx — tick boxes + the blue "N ticked" action bar, as on the Staff page.
 *
 *   const ticks = useTicks(shownIds);          // ids currently listed (after filters)
 *   <TickAll ticks={ticks} label="Tick all shown incidents" />
 *   <Tick ticks={ticks} id={inc.id} label={`Tick ${inc.description}`} />
 *   <BulkBar ticks={ticks} actions={[{ label:"✓ Mark as closed", run: ids => …, danger }]} T={Z} font={font}/>
 *
 * Ticks survive filtering (the bar says how many aren't shown). An action's run(ids)
 * may be async; return false to keep the ticks (e.g. the person cancelled).
 */
import React, { useState } from "react";

export function useTicks(shownIds, allIds) {
  const [sel, setSel] = useState([]);
  return ticksFrom(sel, setSel, shownIds, allIds);
}

/** The same, for a list whose ticked ids live in someone else's state (e.g. App.jsx). */
export function ticksFrom(sel, setSel, shownIds, allIds) {
  const known = new Set((allIds || shownIds).map(String));
  const ids = (sel || []).filter(id => known.has(id));    // forget ticks on things that no longer exist
  const shown = shownIds.map(String);
  return {
    ids,
    has: id => ids.includes(String(id)),
    toggle: id => { const s = String(id); setSel(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]); },
    setMany: (list, on) => { const l = list.map(String); setSel(p => on ? [...new Set([...p, ...l])] : p.filter(x => !l.includes(x))); },
    clear: () => setSel([]),
    shown,
    allShown: shown.length > 0 && shown.every(id => ids.includes(id)),
    someShown: shown.some(id => ids.includes(id)),
    hidden: ids.filter(id => !shown.includes(id)).length,
  };
}

const box = { width: 16, height: 16, cursor: "pointer", flexShrink: 0, margin: 0 };

export function Tick({ ticks, id, label }) {
  return <input type="checkbox" checked={ticks.has(id)} aria-label={label}
    onClick={e => e.stopPropagation()} onChange={() => ticks.toggle(id)} style={box} data-testid="tick"/>;
}

export function TickAll({ ticks, label = "Tick all shown", T, font }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: T ? T.muted : undefined, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap" }}>
      <input type="checkbox" checked={ticks.allShown} ref={el => { if (el) el.indeterminate = !ticks.allShown && ticks.someShown; }}
        onChange={() => ticks.setMany(ticks.shown, !ticks.allShown)} aria-label={label} style={box} data-testid="tick-all"/>
      {label}
    </label>
  );
}

export function BulkBar({ ticks, actions, T, font, what = "ticked" }) {
  const [busy, setBusy] = useState(false);     // one action at a time (a double-click is ignored)
  if (!ticks.ids.length) return null;
  const run = async a => {
    if (busy) return;
    setBusy(true);
    try { const r = await a.run(ticks.ids); if (r !== false) ticks.clear(); }
    finally { setBusy(false); }
  };
  return (
    <div role="region" aria-label="Bulk actions" data-testid="bulk-bar"
      style={{ position: "sticky", top: 8, zIndex: 20, background: `linear-gradient(135deg,${T.accent},${T.blue})`, borderRadius: 14, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", boxShadow: "0 6px 20px rgba(0,0,0,.25)", fontFamily: font }}>
      <span style={{ fontWeight: 800, fontSize: 13, color: "#fff", marginRight: 6 }}>
        {ticks.ids.length} {what}{ticks.hidden ? ` (${ticks.hidden} not shown)` : ""}
      </span>
      {actions.map(a => (
        <button key={a.label} onClick={() => run(a)} disabled={busy}
          style={{ background: a.danger ? "rgba(239,68,68,0.9)" : "rgba(255,255,255,0.14)", color: "#fff", border: `1px solid ${a.danger ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.3)"}`, borderRadius: 9, padding: "8px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: font, whiteSpace: "nowrap" }}>
          {a.label}
        </button>
      ))}
      <button onClick={ticks.clear} style={{ marginLeft: "auto", background: "transparent", border: "1px solid rgba(255,255,255,.45)", color: "#fff", borderRadius: 9, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: font }}>✕ Untick all</button>
    </div>
  );
}
