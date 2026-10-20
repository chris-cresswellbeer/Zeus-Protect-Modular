/**
 * PpeRegisterTab — the PPE Register (Site Safety ▼ → PPE Register, or quick search
 * "ppe"; line managers see their team's under My PPE → My team).
 *   Totals     issued in the last 12 months, due for replacement, overdue, waiting for a
 *              signature, problems reported — each one filters the list
 *   The list   one row per item issued: person, item, size, issued (by), replace by, signed,
 *              status; Replace / Get signature / View
 *   + Issue PPE        PpeIssueModal (signing on the screen: made for a tablet)
 *   a person's name    PpePersonModal (their record, history and signatures; Print record)
 *   Items & sizes      PpeItemsModal (admins)
 *   Export CSV         everything in the current filter, for Excel
 * The record is what the PPE at Work Regulations 1992 (as amended 2022) expect you to be able
 * to show: what was provided, to whom, when, and that it is maintained and replaced.
 */
import React from "react";
import { ppeState, ppeSummary, ppeCsv, PPE_REASONS } from "../../lib/ppe";
import { usePpeIssues, usePpeSettings, ppeTableMissing } from "../../lib/ppeClient";
import { PpeIssueModal } from "./PpeIssue";
import { PpePersonModal, PpeSignModal } from "./PpePerson";
import { PpeItemsModal } from "./PpeItems";
import { StateChip, btn, small, field, ukd } from "./ppeUi";

const FILTERS = [["current", "All current"], ["soon", "Due soon"], ["overdue", "Overdue"], ["unsigned", "Not signed"], ["problem", "Problems"], ["closed", "Returned / replaced"], ["all", "Everything"]];
const RANK = { problem: 0, overdue: 1, unsigned: 2, soon: 3, ok: 4, replaced: 5, returned: 6 };

export function PpeRegisterTab({ me, people, scope, isAdmin, embedded = false, focus, onFocusDone, Z, font }) {
  const rowsAll = usePpeIssues(true);
  const settings = usePpeSettings(true);
  const scopeIds = React.useMemo(() => new Set(scope.map(p => String(p.id))), [scope]);
  const rows = isAdmin ? rowsAll : rowsAll.filter(r => scopeIds.has(String(r.user_id)));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const sum = ppeSummary(rows, today, settings.dueSoonDays);
  const [filter, setFilter] = React.useState("current");
  const [search, setSearch] = React.useState("");
  const [dept, setDept] = React.useState("");
  const [item, setItem] = React.useState("");
  const [limit, setLimit] = React.useState(200);
  const [issuing, setIssuing] = React.useState(null);     // preset for PpeIssueModal
  const [personId, setPersonId] = React.useState(null);
  const [signing, setSigning] = React.useState(null);     // { person, rows }
  const [itemsOpen, setItemsOpen] = React.useState(false);
  React.useEffect(() => { if (focus) { setPersonId(String(focus)); onFocusDone && onFocusDone(); } }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const personOf = r => people.find(p => String(p.id) === String(r.user_id)) || { id: r.user_id, name: (r.data || {}).name || "?", department: (r.data || {}).dept || "" };
  const issuable = scope.filter(p => (p.status || "active") !== "leaver").sort((a, b) => a.name.localeCompare(b.name));
  const depts = [...new Set(rows.map(r => personOf(r).department || (r.data || {}).dept).filter(Boolean))].sort();
  const itemNames = [...new Set(rows.map(r => (r.data || {}).item).filter(Boolean))].sort();
  const q = search.trim().toLowerCase();
  const list = rows.map(r => ({ r, s: ppeState(r, today, settings.dueSoonDays), p: personOf(r) }))
    .filter(({ r, s, p }) => {
      const d = r.data || {};
      if (filter === "current" && r.status !== "issued") return false;
      if (filter === "soon" && !(r.status === "issued" && s.soon)) return false;
      if (filter === "overdue" && !(r.status === "issued" && s.overdue)) return false;
      if (filter === "unsigned" && !(r.status === "issued" && s.unsigned)) return false;
      if (filter === "problem" && !s.problem) return false;
      if (filter === "closed" && r.status === "issued") return false;
      if (dept && (p.department || d.dept) !== dept) return false;
      if (item && d.item !== item) return false;
      if (q && !`${p.name} ${d.item} ${d.size} ${d.standard}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (RANK[a.s.key] - RANK[b.s.key]) || a.p.name.localeCompare(b.p.name) || String(b.r.data.issuedAt).localeCompare(String(a.r.data.issuedAt)));

  function exportCsv() {
    const blob = new Blob([ppeCsv(list.map(x => x.r), today, settings.dueSoonDays)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `PPE register ${today}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const tile = (key, label, n, tone) => (
    <button type="button" key={key} onClick={() => setFilter(key === "issued12" ? "all" : key)} data-testid={`ppe-tile-${key}`} aria-pressed={filter === key}
      style={{ textAlign: "left", cursor: "pointer", fontFamily: font, color: Z.white, background: Z.navyMd, border: `1px solid ${tone && n ? tone : filter === key ? Z.accent : Z.border}`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: tone && n ? tone : Z.muted, textTransform: "uppercase", letterSpacing: .6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }} data-testid={`ppe-tile-${key}-n`}>{n}</div>
    </button>
  );
  const th = { textAlign: "left", padding: "11px 14px", fontSize: 11, fontWeight: 700, color: Z.muted, textTransform: "uppercase", letterSpacing: .6, whiteSpace: "nowrap" };
  const td = { padding: "11px 14px", verticalAlign: "top", fontSize: 13.5 };
  const F = field(Z, font);
  const person = personId ? people.find(p => String(p.id) === personId) || (rows.find(r => String(r.user_id) === personId) ? personOf(rows.find(r => String(r.user_id) === personId)) : null) : null;

  return (
    <div data-testid="ppe-tab" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div>
          {!embedded && <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -.5, margin: "0 0 4px" }}>PPE Register</h2>}
          <p style={{ color: Z.muted, margin: 0, fontSize: 13, maxWidth: 780, lineHeight: 1.5 }}>Who has been issued what, when it should be replaced, and their signature for it: the record of PPE provided under the PPE at Work Regulations. {isAdmin ? "" : "You can issue, replace and return PPE for your team."}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn(Z, font)} onClick={exportCsv} data-testid="ppe-csv">Export CSV</button>
          {isAdmin && <button type="button" style={btn(Z, font)} onClick={() => setItemsOpen(true)} data-testid="ppe-items-btn">Items &amp; sizes</button>}
          <button type="button" style={btn(Z, font, "primary")} onClick={() => setIssuing({})} disabled={!issuable.length} data-testid="ppe-issue-btn">+ Issue PPE</button>
        </div>
      </div>
      {ppeTableMissing() && <div role="alert" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 14, padding: 16, fontSize: 13.5 }}>The database isn't ready for the PPE register yet: run <b>ppe.sql</b> in Supabase.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {tile("issued12", "Issued in last 12 months", sum.issued12)}
        {tile("soon", `Due for replacement (${settings.dueSoonDays} days)`, sum.soon, "#fbbf24")}
        {tile("overdue", "Overdue replacement", sum.overdue, "#f87171")}
        {tile("unsigned", "Waiting for a signature", sum.unsigned, "#93c5fd")}
        {tile("problem", "Problems reported", sum.problem, "#f87171")}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input aria-label="Search person or item" placeholder="Search person or item" value={search} onChange={e => setSearch(e.target.value)} data-testid="ppe-search" style={{ ...F, width: 260, maxWidth: "100%" }}/>
        <select aria-label="Department" value={dept} onChange={e => setDept(e.target.value)} style={F}><option value="">All departments</option>{depts.map(d => <option key={d} value={d}>{d}</option>)}</select>
        <select aria-label="Item" value={item} onChange={e => setItem(e.target.value)} data-testid="ppe-item-filter" style={F}><option value="">All items</option>{itemNames.map(d => <option key={d} value={d}>{d}</option>)}</select>
        <div role="group" aria-label="Show" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} data-testid={`ppe-filter-${k}`}
            style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: Z.white, cursor: "pointer", borderRadius: 20, padding: "7px 13px", background: filter === k ? `${Z.accent}40` : Z.overlay, border: `1px solid ${filter === k ? Z.accent : Z.borderMd}` }}>{l}</button>)}
        </div>
      </div>

      <div style={{ background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead><tr style={{ background: Z.navyMd }}><th style={th}>Person</th><th style={th}>Item</th><th style={th}>Size</th><th style={th}>Issued</th><th style={th}>Replace by</th><th style={th}>Signed</th><th style={th}>Status</th><th style={th}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>Actions</span></th></tr></thead>
          <tbody>
            {!list.length && <tr><td colSpan={8} style={{ ...td, color: Z.muted, padding: 18 }}>{rows.length ? "Nothing matches these filters." : "No PPE recorded yet. Use + Issue PPE to record the first issue."}</td></tr>}
            {list.slice(0, limit).map(({ r, s, p }) => { const d = r.data || {}; return (
              <tr key={r.id} data-testid="ppe-row" style={{ borderTop: `1px solid ${Z.border}` }}>
                <td style={td}><button type="button" onClick={() => setPersonId(String(r.user_id))} data-testid="ppe-row-person" style={{ background: "none", border: "none", color: Z.white, fontWeight: 800, fontFamily: font, fontSize: 13.5, padding: 0, cursor: "pointer", textAlign: "left" }}>{p.name}</button><div style={{ fontSize: 12, color: Z.muted }}>{p.department || d.dept || ""}</div></td>
                <td style={td}>{d.item}{d.qty > 1 ? ` × ${d.qty}` : ""}<div style={{ fontSize: 12, color: Z.muted }}>{d.standard}</div></td>
                <td style={td}>{d.size}</td>
                <td style={td}>{ukd(d.issuedOn)}<div style={{ fontSize: 12, color: Z.muted }}>{d.issuedBy ? `by ${d.issuedBy}` : ""}{d.reason && d.reason !== "new" ? ` · ${(PPE_REASONS.find(x => x.id === d.reason) || {}).label.toLowerCase()}` : ""}</div></td>
                <td style={{ ...td, fontWeight: 700 }}>{r.status !== "issued" ? <span style={{ color: Z.muted, fontWeight: 400 }}>{r.status === "replaced" ? "Replaced" : "Returned"} {ukd(d.returnedOn)}</span> : d.replaceBy ? ukd(d.replaceBy) : <span style={{ color: Z.muted, fontWeight: 400 }}>When worn</span>}</td>
                <td style={{ ...td, color: d.signature ? Z.muted : "#93c5fd" }}>{d.signature ? `Signed ${ukd(String(d.signedAt).slice(0, 10))}` : "Not signed yet"}</td>
                <td style={td}><StateChip state={s} testid="ppe-row-state"/></td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  {r.status === "issued" && (s.overdue || s.soon || s.problem) && <button type="button" style={small(Z, font, "primary")} onClick={() => setIssuing({ personId: r.user_id, replace: r, reason: s.problem ? "damaged" : "worn" })} data-testid="ppe-row-replace">Replace</button>}{" "}
                  {r.status === "issued" && s.unsigned && <button type="button" style={small(Z, font)} onClick={() => setSigning({ person: p, rows: rows.filter(x => String(x.user_id) === String(r.user_id) && x.status === "issued" && !(x.data || {}).signature) })} data-testid="ppe-row-sign">Get signature</button>}{" "}
                  <button type="button" style={small(Z, font)} onClick={() => setPersonId(String(r.user_id))}>View</button>
                </td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      {list.length > limit && <button type="button" style={{ ...btn(Z, font), alignSelf: "center" }} onClick={() => setLimit(l => l + 200)}>Show more ({list.length - limit} more)</button>}
      <div style={{ fontSize: 12.5, color: Z.muted }}>{list.length} of {rows.length} entr{rows.length === 1 ? "y" : "ies"}. Replacement dates come from each item's replacement period (Items &amp; sizes); an item reported damaged or lost should be replaced straight away.</div>

      {issuing && <PpeIssueModal me={me} people={issuable} rows={rows} settings={settings} preset={issuing} onClose={() => setIssuing(null)} Z={Z} font={font}/>}
      {person && !issuing && <PpePersonModal me={me} person={person} rows={rows} settings={settings} isAdmin={isAdmin} onIssue={preset => setIssuing(preset)} onClose={() => setPersonId(null)} Z={Z} font={font}/>}
      {signing && <PpeSignModal person={signing.person} rows={signing.rows} statement={settings.statement} via="in person" onClose={() => setSigning(null)} Z={Z} font={font}/>}
      {itemsOpen && <PpeItemsModal settings={settings} onClose={() => setItemsOpen(false)} Z={Z} font={font}/>}
    </div>
  );
}
