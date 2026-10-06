import { useState, useEffect } from "react";
import { HelpTip } from "../../shared/HelpTip";
import { loadAuditLog, AUDIT_ENTITY_LABELS } from "../../lib/audit";

import { localISO, todayISO } from "../../lib/dates";
/**
 * AuditTrailTab — admin view of the audit_log table (lib/audit.js).
 * Filters: record type, person, free text (label / summary / record id), date range.
 * Click an entry to see each changed field's before → after. "Export CSV" downloads
 * the filtered entries for auditors/insurers.
 *
 * Also used as a pop-up for ONE record (AuditHistoryModal below), e.g. the
 * "History" button on an incident.
 */

const ACTION_STYLE = {
  create:   { label: "Created",   key: "green" },
  update:   { label: "Changed",   key: "accentLt" },
  delete:   { label: "Deleted",   key: "red" },
  sign_off: { label: "Signed off", key: "gold" },
  assign:   { label: "Assigned",  key: "accentLt" },
  unassign: { label: "Unassigned", key: "amber" },
  new_version: { label: "New version", key: "gold" },
};

function fmtWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtVal(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") { const s = JSON.stringify(v); return s.length > 400 ? s.slice(0, 400) + "…" : s; }
  return String(v);
}

function csvCell(v) {
  const s = v === null || v === undefined ? "" : (typeof v === "object" ? JSON.stringify(v) : String(v));
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function AuditEntry({ r, open, onToggle, Z, font }) {
  const st = ACTION_STYLE[r.action] || { label: r.action, key: "muted" };
  const col = Z[st.key] || Z.muted;
  const changes = r.changes && typeof r.changes === "object" ? Object.entries(r.changes) : [];
  return (
    <div style={{ background: Z.overlay, border: `1px solid ${Z.border}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "11px 14px", display: "grid", gridTemplateColumns: "150px 1fr auto", gap: 12, alignItems: "center", fontFamily: font, color: Z.white }}>
        <div style={{ fontSize: 12, color: Z.muted }}>{fmtWhen(r.at)}<div style={{ fontSize: 12, color: Z.white, fontWeight: 700, marginTop: 2 }}>{r.user_name || "—"}</div></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ color: Z.muted, fontWeight: 600 }}>{AUDIT_ENTITY_LABELS[r.entity] || r.entity} · </span>{r.entity_label || r.entity_id}
          </div>
          <div style={{ fontSize: 12, color: Z.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.summary}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: col, background: `${col}1F`, border: `1px solid ${col}55`, borderRadius: 99, padding: "3px 10px", whiteSpace: "nowrap" }}>{st.label}</span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${Z.border}`, padding: "10px 14px 14px" }}>
          <div style={{ fontSize: 11, color: Z.muted, marginBottom: 8 }}>Record ID: {r.entity_id}</div>
          {changes.length === 0 ? <div style={{ fontSize: 12, color: Z.muted }}>No field details recorded.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["Field", "Before", "After"].map(h => <th key={h} style={{ textAlign: "left", color: Z.muted, fontWeight: 700, padding: "6px 8px", borderBottom: `1px solid ${Z.border}`, width: h === "Field" ? "22%" : "39%" }}>{h}</th>)}</tr></thead>
              <tbody>{changes.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: "6px 8px", color: Z.white, fontWeight: 700, verticalAlign: "top", borderBottom: `1px solid ${Z.border}` }}>{k}</td>
                  <td style={{ padding: "6px 8px", color: Z.muted, verticalAlign: "top", wordBreak: "break-word", borderBottom: `1px solid ${Z.border}` }}>{fmtVal(v && v.from)}</td>
                  <td style={{ padding: "6px 8px", color: Z.white, verticalAlign: "top", wordBreak: "break-word", borderBottom: `1px solid ${Z.border}` }}>{fmtVal(v && v.to)}</td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function AuditTrailTab({ Z, font, entityIds = null, compact = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entity, setEntity] = useState("all");
  const [person, setPerson] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadAuditLog({ entityId: entityIds && entityIds.length === 1 ? entityIds[0] : undefined }).then(({ rows, error }) => {
      if (!live) return;
      setRows(entityIds ? rows.filter(r => entityIds.includes(String(r.entity_id))) : rows);
      setError(error ? "Couldn't load the audit trail. Check the audit_log table exists (see the SQL file)." : "");
      setLoading(false);
    });
    return () => { live = false; };
  }, [reloadKey, entityIds ? entityIds.join("|") : ""]); // eslint-disable-line

  const people = Array.from(new Set(rows.map(r => r.user_name).filter(Boolean))).sort();
  const entities = Array.from(new Set(rows.map(r => r.entity))).sort();
  const q = search.trim().toLowerCase();
  const filtered = rows.filter(r =>
    (entity === "all" || r.entity === entity) &&
    (person === "all" || r.user_name === person) &&
    (!from || localISO(new Date(r.at)) >= from) &&     // the UK date of the entry, like the date boxes
    (!to || localISO(new Date(r.at)) <= to) &&
    (!q || [r.entity_label, r.summary, r.entity_id, r.user_name].some(x => String(x || "").toLowerCase().includes(q)))
  );

  function exportCsv() {
    const head = ["When", "User", "User ID", "Record type", "Record ID", "Record", "Action", "Summary", "Changes"];
    const lines = [head.join(",")].concat(filtered.map(r => [
      r.at, r.user_name, r.user_id, AUDIT_ENTITY_LABELS[r.entity] || r.entity, r.entity_id, r.entity_label, r.action, r.summary, r.changes,
    ].map(csvCell).join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `zeus-protect-audit-trail-${todayISO()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const inp = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "8px 12px", color: Z.white, fontSize: 13, outline: "none", fontFamily: font, boxSizing: "border-box" };
  const btn = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "8px 14px", color: Z.white, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: font };

  return (
    <div>
      {!compact && (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -.5, margin: "0 0 4px", color: Z.white }}>Audit Trail <HelpTip dark={true} text="Every change to incidents, investigations, risk assessments, COSHH assessments, DSE assessments and responses, site inspections, manager sign-offs, training assignments and new document or module versions — who made it, when, and what changed. Entries can't be edited or deleted from the portal." /></h2>
            <p style={{ color: Z.muted, margin: 0, fontSize: 13 }}>Who changed what, and when. Click an entry to see the before and after.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setReloadKey(k => k + 1)} style={btn}>↻ Refresh</button>
            <button onClick={exportCsv} disabled={!filtered.length} style={{ ...btn, background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, border: "none", opacity: filtered.length ? 1 : .5 }}>⬇ Export CSV</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {!compact && <select value={entity} onChange={e => setEntity(e.target.value)} style={inp}>
          <option value="all">All record types</option>
          {entities.map(e => <option key={e} value={e}>{AUDIT_ENTITY_LABELS[e] || e}</option>)}
        </select>}
        <select value={person} onChange={e => setPerson(e.target.value)} style={inp}>
          <option value="all">Everyone</option>
          {people.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {!compact && <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search record, change or ID…" style={{ ...inp, minWidth: 220, flex: 1 }} />}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: Z.muted }}>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: Z.muted }}>To <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} /></label>
      </div>
      <div style={{ fontSize: 12, color: Z.muted, marginBottom: 10 }}>{loading ? "Loading…" : `${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}${filtered.length !== rows.length ? ` (of ${rows.length})` : ""}`}</div>
      {error && <div style={{ fontSize: 12, color: Z.red, marginBottom: 10 }}>{error}</div>}
      {!loading && filtered.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: 30, color: Z.muted, fontSize: 13, background: Z.overlay, borderRadius: 12, border: `1px solid ${Z.border}` }}>No changes recorded{rows.length ? " for these filters" : " yet"}.</div>
      )}
      {filtered.map((r, i) => {
        const id = r.id != null ? r.id : `${r.at}_${i}`;
        return <AuditEntry key={id} r={r} open={openId === id} onToggle={() => setOpenId(o => o === id ? null : id)} Z={Z} font={font} />;
      })}
    </div>
  );
}

/** Pop-up history for one or more record ids (e.g. an incident and its investigation). */
function AuditHistoryModal({ title, entityIds, onClose, Z, font }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 18, padding: 24, width: "100%", maxWidth: 860, maxHeight: "85vh", overflowY: "auto", border: `1px solid ${Z.borderMd}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: Z.white }}>🕘 History — {title}</h3>
          <button onClick={onClose} style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "6px 12px", color: Z.muted, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700 }}>✕ Close</button>
        </div>
        <AuditTrailTab Z={Z} font={font} entityIds={entityIds} compact />
      </div>
    </div>
  );
}

export { AuditTrailTab, AuditHistoryModal };
