import React from "react";

/**
 * QuickSearch — the 🔍 button in the header, also opened with Ctrl+K (Windows) or ⌘K (Mac).
 * Type a few letters of a person, module, document, incident, contractor or page and press
 * Enter (or click) to jump straight to it.
 *
 *   <QuickSearch getItems={() => [...]} Z={T} font={font}/>
 *
 * getItems() is only called while the search is open, and returns
 *   { id, group, icon, label, sub, words, run, actions:[{ label, run }] }
 * "group" sorts results into sections (Pages, People, Modules…); "words" are extra text
 * that matches but isn't shown (an email address, a job title, a reference number).
 * "actions" are extra buttons on the row (e.g. a person's "Assign training").
 */

const GROUP_ORDER = ["Pages", "People", "Modules", "My training", "Documents", "Incidents", "Contractors"];
const PER_GROUP = 6;

const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** 0 = no match; higher = better. Every word typed must appear somewhere. */
export function scoreItem(item, query) {
  const q = norm(query).trim();
  if (!q) return 0;
  const label = norm(item.label), all = `${label} ${norm(item.sub)} ${norm(item.words)}`;
  const terms = q.split(/\s+/);
  if (!terms.every(t => all.includes(t))) return 0;
  let s = 1;
  if (label === q) s += 100;
  else if (label.startsWith(q)) s += 60;
  else if (label.split(/[\s\-–—/(&]+/).some(w => w.startsWith(terms[0]))) s += 35;
  else if (label.includes(q)) s += 20;
  else if (terms.every(t => label.includes(t))) s += 10;
  return s;
}

export function searchItems(items, query) {
  const groups = {};
  items.forEach(it => { const s = scoreItem(it, query); if (s) (groups[it.group] = groups[it.group] || []).push([s, it]); });
  const order = Object.keys(groups).sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return order.map(g => ({
    group: g,
    total: groups[g].length,
    items: groups[g].sort((x, y) => y[0] - x[0] || String(x[1].label).localeCompare(String(y[1].label))).slice(0, PER_GROUP).map(x => x[1]),
  }));
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
export const SHORTCUT = isMac ? "⌘K" : "Ctrl+K";

export function QuickSearch({ getItems, Z, font, compact }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);
  const btnRef = React.useRef(null);

  // Ctrl+K / ⌘K anywhere opens it (and closes it again)
  React.useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => {
    if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 20); }
  }, [open]);

  const items = React.useMemo(() => (open ? getItems() : []), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = React.useMemo(() => (q.trim() ? searchItems(items, q) : []), [items, q]);
  const flat = results.flatMap(g => g.items);
  React.useEffect(() => { setSel(0); }, [q]);
  React.useEffect(() => {
    const el = listRef.current && listRef.current.querySelector(`[data-qs-index="${sel}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const close = () => { setOpen(false); setTimeout(() => btnRef.current && btnRef.current.focus(), 0); };
  const go = (fn) => { setOpen(false); setTimeout(fn, 0); };
  const onKeyDown = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = flat[sel]; if (it) go(it.run); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };

  const C = Z || {};
  let idx = -1;
  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(true)} data-testid="qs-open" aria-label={`Search the portal (${SHORTCUT})`} title={`Search people, modules, documents and pages (${SHORTCUT})`}
        style={{ background: C.overlay, border: `1px solid ${C.borderMd}`, borderRadius: 8, padding: compact ? "5px 9px" : "5px 10px", color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: font, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <span aria-hidden="true" style={{ fontSize: 13 }}>🔍</span>
        {!compact && <span>Search</span>}
        {!compact && <kbd style={{ fontFamily: font, fontSize: 10, border: `1px solid ${C.borderMd}`, borderRadius: 5, padding: "1px 5px", opacity: .8 }}>{SHORTCUT}</kbd>}
      </button>
      {open && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) close(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 5900, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "10vh 16px 16px" }}>
          <div role="dialog" aria-modal="true" aria-label="Search the portal" data-testid="qs"
            style={{ width: "100%", maxWidth: 640, background: `linear-gradient(160deg,${C.navyMd},${C.navyDk || C.navy})`, border: `1px solid ${C.borderMd}`, borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,.5)", fontFamily: font, color: C.white, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.borderMd}` }}>
              <span aria-hidden="true">🔍</span>
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Search people, modules, documents, incidents, pages…" aria-label="Search"
                role="combobox" aria-expanded={flat.length > 0} aria-controls="qs-list" aria-activedescendant={flat[sel] ? `qs-${sel}` : undefined}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.white, fontSize: 16, fontFamily: font, padding: "6px 0" }} />
              <button onClick={close} style={{ background: C.overlay, border: `1px solid ${C.borderMd}`, color: C.muted, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: font }}>Esc</button>
            </div>
            <div ref={listRef} id="qs-list" role="listbox" style={{ maxHeight: "60vh", overflowY: "auto", padding: "6px 0" }}>
              {!q.trim() && (
                <div style={{ padding: "14px 18px", color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
                  Start typing a name, module, document title, incident location or page.<br />
                  <span style={{ fontSize: 12 }}>↑ ↓ to move · Enter to open · Esc to close · {SHORTCUT} opens this from anywhere</span>
                </div>
              )}
              {q.trim() && !flat.length && <div style={{ padding: "14px 18px", color: C.muted, fontSize: 13 }}>Nothing matches “{q.trim()}”.</div>}
              {results.map(g => (
                <div key={g.group} role="group" aria-label={g.group}>
                  <div style={{ padding: "8px 18px 4px", fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: C.muted }}>
                    {g.group}{g.total > g.items.length ? ` · showing ${g.items.length} of ${g.total}` : ""}
                  </div>
                  {g.items.map(it => {
                    idx += 1; const i = idx; const on = i === sel;
                    return (
                      <div key={it.id} id={`qs-${i}`} data-qs-index={i} role="option" aria-selected={on} data-testid="qs-item"
                        onMouseMove={() => { if (sel !== i) setSel(i); }} onClick={() => go(it.run)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 18px", cursor: "pointer", background: on ? "rgba(37,99,235,0.22)" : "transparent", borderLeft: `3px solid ${on ? (C.accent || "#2563eb") : "transparent"}` }}>
                        <span aria-hidden="true" style={{ fontSize: 18, width: 24, textAlign: "center", flexShrink: 0 }}>{it.icon || "•"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</div>
                          {it.sub && <div style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.sub}</div>}
                        </div>
                        {(it.actions || []).map(a => (
                          <button key={a.label} onClick={e => { e.stopPropagation(); go(a.run); }}
                            style={{ background: C.overlay, border: `1px solid ${C.borderMd}`, color: C.white, borderRadius: 7, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap" }}>{a.label}</button>
                        ))}
                        {on && <span aria-hidden="true" style={{ fontSize: 11, color: C.muted }}>↵</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
