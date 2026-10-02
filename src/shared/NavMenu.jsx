import React from "react";

/**
 * NavMenu — a drop-down in the admin top bar (Training ▼, Contractors ▼, Documents ▼,
 * Machinery & Equipment ▼). Works with:
 *   mouse     — opens when you point at it (as before) and on click
 *   touch     — tap to open, tap an item (or anywhere else) to close
 *   keyboard  — Tab to it, Enter / Space / ↓ opens and moves into the list,
 *               ↑ ↓ Home End move, Enter picks, Esc closes and returns to the button
 *
 * (A "disclosure" menu — the pattern recommended for site navigation — so the items stay
 *  ordinary buttons that screen readers announce normally.)
 *
 *   <NavMenu label="Training" active={…} items={[["assign","Assign Training"], …]}
 *            current={atab} onPick={setAtab} btnStyle={navBtn(…)} Z={T} font={font}/>
 */

let closeOthers = null;   // only one menu open at a time

export function NavMenu({ label, active, items, current, onPick, btnStyle, Z, font, testId }) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);
  const btnRef = React.useRef(null);
  const itemRefs = React.useRef([]);
  const hoverTimer = React.useRef(null);
  // How it was opened: pointing ("hover") closes again when the pointer leaves; a click,
  // tap or key "pins" it open until you choose something or click elsewhere.
  const how = React.useRef({ by: null, at: 0 });
  const menuId = `navmenu-${String(React.useId()).replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const show = React.useCallback(focusIndex => {
    if (closeOthers && closeOthers.owner !== wrapRef) closeOthers.close();
    closeOthers = { owner: wrapRef, close: () => setOpen(false) };
    setOpen(true);
    if (focusIndex != null) setTimeout(() => { const el = itemRefs.current[focusIndex]; if (el) el.focus(); }, 0);
  }, []);

  // close on a click / tap outside, or when focus leaves the menu
  React.useEffect(() => {
    if (!open) return;
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onFocus = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("focusin", onFocus);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); document.removeEventListener("focusin", onFocus); };
  }, [open]);
  React.useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const pick = itemId => { setOpen(false); onPick(itemId); };
  const onBtnKey = e => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); how.current = { by: "key", at: Date.now() }; show(Math.max(0, items.findIndex(([i]) => i === current))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); how.current = { by: "key", at: Date.now() }; show(items.length - 1); }
    else if (e.key === "Escape") setOpen(false);
  };
  const onItemKey = (e, i) => {
    const n = items.length;
    const focus = j => { const el = itemRefs.current[(j + n) % n]; if (el) el.focus(); };
    if (e.key === "ArrowDown") { e.preventDefault(); focus(i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focus(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); focus(0); }
    else if (e.key === "End") { e.preventDefault(); focus(n - 1); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); btnRef.current && btnRef.current.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }} data-testid={testId}
      onMouseEnter={() => { clearTimeout(hoverTimer.current); if (!open) { how.current = { by: "hover", at: Date.now() }; show(); } }}
      onMouseLeave={() => { clearTimeout(hoverTimer.current); if (how.current.by === "hover") hoverTimer.current = setTimeout(() => setOpen(false), 180); }}>
      <button ref={btnRef} type="button" aria-expanded={open} aria-controls={menuId}
        onClick={() => {
          // the pointer arriving opened it a moment ago: this click means "keep it open"
          if (open && how.current.by === "hover" && Date.now() - how.current.at < 600) { how.current = { by: "click", at: Date.now() }; return; }
          if (open) { setOpen(false); return; }
          how.current = { by: "click", at: Date.now() }; show();
        }} onKeyDown={onBtnKey}
        style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 5 }}>
        {label}<span style={{ fontSize: 9, opacity: .7, marginTop: 1, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
      </button>
      {open && (
        <div id={menuId} aria-label={typeof label === "string" ? label : undefined}
          style={{ position: "absolute", top: "100%", left: 0, zIndex: 200, minWidth: 190, background: `linear-gradient(135deg,${Z.navyDk},${Z.navyMd})`, border: `1px solid ${Z.borderMd}`, borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", overflow: "hidden", padding: "4px 0" }}>
          {items.map(([itemId, itemLabel], i) => (
            <button key={itemId} ref={el => { itemRefs.current[i] = el; }} type="button"
              aria-current={current === itemId ? "page" : undefined}
              onClick={() => pick(itemId)} onKeyDown={e => onItemKey(e, i)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 18px", background: current === itemId ? "rgba(245,158,11,0.12)" : "transparent", border: "none", color: current === itemId ? Z.gold : Z.white, fontSize: 13, fontWeight: current === itemId ? 700 : 500, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap" }}
              onMouseEnter={e => { if (current !== itemId) e.currentTarget.style.background = Z.overlay; }}
              onMouseLeave={e => { e.currentTarget.style.background = current === itemId ? "rgba(245,158,11,0.12)" : "transparent"; }}>
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
