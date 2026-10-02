import React, { useState, useMemo } from "react";
import { E } from "../../lib/emoji";
import { buildTrainingMatrix, exportTrainingMatrixXlsx, MATRIX_STATUS, matrixCellText } from "./trainingMatrix";
import { useRemembered } from "../../lib/remembered";
import { useSort, sortRows, SortButton } from "../../shared/Sortable";

/**
 * TrainingMatrixView — Reports → "Training Matrix".
 * One grid of staff (rows) × training modules (columns), each cell coloured by
 * status (see trainingMatrix.js), with row and column compliance %, filters, and
 * "Export to Excel" (coloured matrix + detail list + per-module summary).
 * Click a cell for actions (when App passes the handlers): assign the module, record it
 * as completed, set a due date, or open the person in Assign Training. Click the
 * "Staff member" or "%" heading to sort.
 */
function TrainingMatrixView({ staff, modules, assigns, comps, dueDates, onAssign, onRecord, onDueDate, onOpen, Z, font }) {
  const [menu, setMenu] = useState(null);   // { r, c, m, x, y } — the cell whose actions are open
  const [mSort, setMSortBy] = useSort("matrix", { by: "name", dir: "asc" });
  const actions = !!(onAssign || onRecord || onOpen);
  const [manager, setManager] = useRemembered("matrix.manager", "all");
  const [department, setDepartment] = useRemembered("matrix.department", "all");
  const [search, setSearch] = useState("");
  const [includeLeavers, setIncludeLeavers] = useRemembered("matrix.leavers", false);
  const [onlyNonCompliant, setOnlyNonCompliant] = useRemembered("matrix.nonCompliant", false);
  const [allModules, setAllModules] = useRemembered("matrix.allModules", false);
  const [showDates, setShowDates] = useRemembered("matrix.dates", false);

  const filter = { manager, department, search, includeLeavers, onlyNonCompliant, allModules };
  const matrix = useMemo(() => buildTrainingMatrix({ staff, modules, assigns, comps, dueDates, filter }),
    [staff, modules, assigns, comps, dueDates, manager, department, search, includeLeavers, onlyNonCompliant, allModules]); // eslint-disable-line
  const { cols, colStats, totals } = matrix;
  const rows = sortRows(matrix.rows, mSort, { name: r => r.user.name, pct: r => r.pct });
  // close the cell menu on Escape or a click elsewhere
  React.useEffect(() => {
    if (!menu) return;
    const onKey = e => { if (e.key === "Escape") setMenu(null); };
    const onDown = e => { if (!e.target.closest || !e.target.closest('[data-testid="matrix-menu"]')) setMenu(null); };
    const onScroll = e => { if (!e.target.closest || !e.target.closest('[data-testid="matrix-menu"]')) setMenu(null); };   // the menu is pinned to the screen, so close it rather than leave it behind
    window.addEventListener("keydown", onKey); document.addEventListener("mousedown", onDown); window.addEventListener("scroll", onScroll, true);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); window.removeEventListener("scroll", onScroll, true); };
  }, [menu]);

  const managers = [...new Set((staff || []).map(u => u.manager).filter(Boolean))].sort();
  const departments = [...new Set((staff || []).map(u => u.department).filter(Boolean))].sort();

  // Screen colours come from the theme so they read in dark AND light themes.
  const COL = { valid: Z.green, expiring: Z.amber, expired: Z.red, overdue: Z.red, missing: Z.red, na: Z.muted };
  const cellStyle = st => st === "na"
    ? { background: "transparent", color: Z.muted }
    : st === "expired" || st === "overdue" ? { background: COL[st], color: "#fff", fontWeight: 800 }
    : { background: `${COL[st]}2e`, color: COL[st], fontWeight: 700, border: st === "missing" ? `1px dashed ${COL.missing}88` : "none" };
  const pctColor = p => p === null ? Z.muted : p >= 100 ? Z.green : p >= 80 ? Z.amber : Z.red;

  function exportXlsx() {
    const parts = [];
    if (manager !== "all") parts.push(`Manager: ${manager}`);
    if (department !== "all") parts.push(`Department: ${department}`);
    if (search.trim()) parts.push(`Search: "${search.trim()}"`);
    if (onlyNonCompliant) parts.push("Non-compliant staff only");
    if (includeLeavers) parts.push("Including leavers");
    exportTrainingMatrixXlsx({ ...matrix, rows }, { filterText: parts.length ? "Filters: " + parts.join(", ") : "All current staff" });
  }

  const sel = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 10px", color: Z.white, fontFamily: font, fontSize: 12 };
  const chk = (val, set, label) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: Z.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
      <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} /> {label}
    </label>
  );
  const CELL_W = showDates ? 74 : 38;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
        {[
          ["Overall compliance", totals.pct === null ? "—" : `${totals.pct}%`, pctColor(totals.pct)],
          ["Staff shown", totals.staff, Z.white],
          ["Fully compliant", totals.fullyCompliant, Z.green],
          ["Not completed", totals.missing, totals.missing ? Z.red : Z.green],
          ["Past due date", totals.overdue, totals.overdue ? Z.red : Z.green],
          ["Expired", totals.expired, totals.expired ? Z.red : Z.green],
          ["Expiring soon", totals.expiring, totals.expiring ? Z.amber : Z.green],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: Z.muted, marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filters + export */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, job title…" style={{ ...sel, minWidth: 180 }} />
        <select value={manager} onChange={e => setManager(e.target.value)} style={sel} aria-label="Line manager">
          <option value="all">All line managers</option>
          {managers.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {departments.length > 0 && (
          <select value={department} onChange={e => setDepartment(e.target.value)} style={sel} aria-label="Department">
            <option value="all">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {chk(onlyNonCompliant, setOnlyNonCompliant, "Non-compliant only")}
        {chk(showDates, setShowDates, "Show dates")}
        {chk(allModules, setAllModules, "All modules")}
        {chk(includeLeavers, setIncludeLeavers, "Include leavers")}
        <button onClick={exportXlsx} disabled={!rows.length}
          style={{ marginLeft: "auto", background: "linear-gradient(135deg,#107c41,#0b5e30)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 800, cursor: rows.length ? "pointer" : "not-allowed", fontFamily: font, fontSize: 13, opacity: rows.length ? 1 : 0.5 }}>
          {E("📗 ", "")}Export to Excel
        </button>
      </div>

      {/* Key */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12, fontSize: 11, color: Z.muted }}>
        {Object.values(MATRIX_STATUS).map(s => (
          <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 18, borderRadius: 4, fontSize: 11, ...cellStyle(s.key), border: s.key === "na" ? `1px solid ${Z.borderMd}` : cellStyle(s.key).border }}>{s.symbol}</span>
            {s.label}
          </span>
        ))}
      </div>

      {!rows.length ? (
        <div style={{ padding: 40, textAlign: "center", color: Z.muted, background: Z.overlay, borderRadius: 12 }}>No staff match these filters.</div>
      ) : (
        <div style={{ overflow: "auto", maxHeight: "70vh", border: `1px solid ${Z.borderMd}`, borderRadius: 12, background: Z.navy }} data-testid="training-matrix">
          <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 12, fontFamily: font }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", top: 0, left: 0, zIndex: 3, background: Z.navyMd, minWidth: 190, textAlign: "left", padding: "8px 10px", color: Z.white, borderBottom: `1px solid ${Z.borderMd}`, verticalAlign: "bottom" }}><SortButton label="Staff member" by="name" sort={mSort} onSort={setMSortBy} Z={Z} font={font}/></th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: Z.navyMd, padding: "8px 6px", color: Z.white, borderBottom: `1px solid ${Z.borderMd}`, verticalAlign: "bottom", fontSize: 11 }}><SortButton label="%" by="pct" sort={mSort} onSort={setMSortBy} Z={Z} font={font}/></th>
                {cols.map((m, ci) => (
                  <th key={m.id} title={`${m.title}${m.category ? " — " + m.category : ""}${m.renewalLabel ? " · renew " + m.renewalLabel : ""}`}
                    style={{ position: "sticky", top: 0, zIndex: 2, background: Z.navyMd, width: CELL_W, minWidth: CELL_W, height: 190, padding: "6px 2px", borderBottom: `1px solid ${Z.borderMd}`, verticalAlign: "bottom" }}>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "normal", overflow: "hidden", maxHeight: 180, maxWidth: CELL_W - 4, lineHeight: 1.15, margin: "0 auto", fontSize: 11, fontWeight: 700, color: Z.white, textAlign: "left" }}>
                      {m.title}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.user.id}>
                  <td style={{ position: "sticky", left: 0, zIndex: 1, background: Z.navyMd, padding: "6px 10px", borderBottom: `1px solid ${Z.border}`, whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700, color: Z.white }}>{r.user.name}{(r.user.status || "active") === "leaver" ? <span style={{ color: Z.muted, fontWeight: 400 }}> (leaver)</span> : null}</div>
                    <div style={{ fontSize: 10, color: Z.muted }}>{[r.user.jobTitle, r.user.manager && `Mgr: ${r.user.manager}`].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 800, color: pctColor(r.pct), borderBottom: `1px solid ${Z.border}`, padding: "0 6px" }}>{r.pct === null ? "—" : `${r.pct}%`}</td>
                  {r.cells.map((c, ci) => {
                    const m = cols[ci];
                    const tip = `${r.user.name} — ${m.title}\n${MATRIX_STATUS[c.status].label}${c.due ? `\nDue ${c.due.split("-").reverse().join("/")}` : ""}${c.completed ? `\nCompleted ${c.completed}${c.recorded ? " (recorded — done before the portal)" : c.score != null ? ` (${c.score}%)` : ""}` : ""}${c.expires ? `\nExpires ${c.expires}` : ""}${c.status !== "na" && !c.assigned ? "\n(completed but not assigned)" : ""}`;
                    return (
                      <td key={m.id} title={tip} data-status={c.status} style={{ padding: 2, borderBottom: `1px solid ${Z.border}` }}>
                        {actions ? (
                          <button type="button" aria-label={tip.replace(/\n/g, ". ")} data-testid="matrix-cell"
                            onClick={e => { const b = e.currentTarget.getBoundingClientRect(); setMenu({ r, c, m, x: b.left, y: b.bottom, top: b.top }); }}
                            style={{ width: "100%", height: 26, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: showDates ? 10 : 13, whiteSpace: "nowrap", opacity: c.status !== "na" && !c.assigned ? 0.6 : 1, cursor: "pointer", fontFamily: font, padding: 0, border: "none", ...cellStyle(c.status),
                              outline: menu && menu.r.user.id === r.user.id && menu.m.id === m.id ? `2px solid ${Z.accentLt || "#60a5fa"}` : undefined }}>
                            {showDates ? matrixCellText(c) : MATRIX_STATUS[c.status].symbol}
                          </button>
                        ) : (
                        <div style={{ height: 26, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: showDates ? 10 : 13, whiteSpace: "nowrap", opacity: c.status !== "na" && !c.assigned ? 0.6 : 1, ...cellStyle(c.status) }}>
                          {showDates ? matrixCellText(c) : MATRIX_STATUS[c.status].symbol}
                        </div>)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td style={{ position: "sticky", left: 0, zIndex: 1, background: Z.navyMd, padding: "8px 10px", fontWeight: 800, color: Z.white }}>Module compliance</td>
                <td style={{ textAlign: "center", fontWeight: 900, color: pctColor(totals.pct) }}>{totals.pct === null ? "—" : `${totals.pct}%`}</td>
                {colStats.map((s, ci) => (
                  <td key={cols[ci].id} style={{ textAlign: "center", fontWeight: 800, fontSize: 11, color: pctColor(s.pct), padding: "8px 2px" }}>{s.pct === null ? "—" : `${s.pct}%`}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {menu && (() => {
        const { r, c, m } = menu, done = c.status === "valid" || c.status === "expiring";
        const item = (label, fn, testid) => (
          <button type="button" data-testid={testid} onClick={() => { setMenu(null); fn(); }}
            style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: Z.white, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}
            onMouseEnter={e => { e.currentTarget.style.background = Z.overlay; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>{label}</button>);
        // below the cell if it fits, otherwise above it — never on top of the cell itself
        const left = Math.max(8, Math.min(menu.x, window.innerWidth - 300));
        const below = menu.y + 4 + 240 <= window.innerHeight;
        const place = below ? { top: menu.y + 4 } : { bottom: Math.max(8, window.innerHeight - menu.top + 4) };
        return (
          <div role="menu" aria-label={`${r.user.name} — ${m.title}`} data-testid="matrix-menu"
            style={{ position: "fixed", left, ...place, zIndex: 400, width: 290, background: `linear-gradient(135deg,${Z.navyDk || Z.navy},${Z.navyMd})`, border: `1px solid ${Z.borderMd}`, borderRadius: 12, boxShadow: "0 12px 36px rgba(0,0,0,.45)", overflow: "hidden", fontFamily: font }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${Z.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: Z.white }}>{r.user.name}</div>
              <div style={{ fontSize: 12, color: Z.muted }}>{m.title}</div>
              <div style={{ fontSize: 11, color: COL[c.status] || Z.muted, fontWeight: 700, marginTop: 3 }}>{MATRIX_STATUS[c.status].label}{c.due ? ` · due ${c.due.split("-").reverse().join("/")}` : ""}</div>
            </div>
            <div style={{ padding: "4px 0" }}>
              {!c.assigned && onAssign && item("Assign this module", () => onAssign(r.user.id, m.id), "mx-assign")}
              {c.assigned && !done && onDueDate && item(c.due ? "Change the due date…" : "Set a due date…", () => onDueDate(r.user.id, m.id), "mx-due")}
              {!done && onRecord && item("Record as completed…", () => onRecord(r.user.id, m.id), "mx-record")}
              {onOpen && item(`Open ${r.user.name.split(" ")[0]} in Assign Training`, () => onOpen(r.user.id), "mx-open")}
            </div>
          </div>
        );
      })()}
      <p style={{ fontSize: 11, color: Z.muted, marginTop: 10 }}>
        {actions ? "Click a cell to assign the module, record it as completed, set a due date or open the person. " : ""}Compliance = assigned modules that are complete and in date ÷ assigned modules. Faded cells were completed without being assigned and don't count. Hidden modules aren't shown or counted. Hover a cell for dates and scores.
      </p>
    </div>
  );
}

export { TrainingMatrixView };
