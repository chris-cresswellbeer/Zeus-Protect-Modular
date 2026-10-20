import React, { useState, useMemo } from "react";
import { E } from "../../lib/emoji";
import { brandLightLogo } from "../../shared/Logo";
import { brandCompany, fileShort } from "../../lib/brandCore";
import { todayISO, ukDate } from "../../lib/dates";
import { buildXlsx, downloadBlob } from "../../lib/xlsxWriter";
import { riddorRows, riddorSummary, renderRiddorHtml, riddorWorkbook } from "./riddorRegister";
import { openMonthlyReport } from "./monthlyReport";

/**
 * RiddorRegisterView — Reports → "RIDDOR Register".
 * Every RIDDOR-reportable incident with when and how it was reported (riddorRegister.js),
 * for all records, the last 3 years or one calendar year. On screen, PDF (landscape) or
 * Excel. Names of injured people are left out unless the box is ticked.
 */
export function RiddorRegisterView({ incidents, userName, Z, font }) {
  const today = todayISO();
  const y = +today.slice(0, 4);
  const back3 = `${y - 3}${today.slice(4)}`;
  const years = [...new Set((incidents || []).filter(i => i.riddor && /^\d{4}/.test(String(i.date || ""))).map(i => +String(i.date).slice(0, 4)))].sort((a, b) => b - a);
  const options = [{ id: "all", label: "All records", from: "", to: "" }, { id: "3y", label: "Last 3 years", from: back3, to: today },
    ...years.map(v => ({ id: String(v), label: String(v), from: `${v}-01-01`, to: `${v}-12-31` }))];
  const [sel, setSel] = useState("all");
  const opt = options.find(o => o.id === sel) || options[0];
  const [names, setNames] = useState(false);
  const rows = useMemo(() => riddorRows(incidents || [], { from: opt.from, to: opt.to, names, today }), [incidents, opt.from, opt.to, names, today]);
  const s = riddorSummary(rows);
  const meta = { periodLabel: opt.id === "all" ? "All records" : opt.id === "3y" ? `${ukDate(opt.from)} – ${ukDate(opt.to)}` : opt.label, companyName: brandCompany(), generated: today, generatedBy: userName, names };
  const [blocked, setBlocked] = useState(false);
  const pdf = () => setBlocked(!openMonthlyReport(renderRiddorHtml(rows, { ...meta, logoSrc: brandLightLogo() }), "RIDDOR_Register.html"));
  const xlsx = () => downloadBlob(buildXlsx(riddorWorkbook(rows, meta)), `${fileShort()}-riddor-register-${today}.xlsx`);

  const sel2 = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "8px 12px", color: Z.white, fontFamily: font, fontSize: 13 };
  const btnP = { background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: font, fontSize: 13 };
  const btnX = { background: "rgba(16,185,129,0.12)", color: Z.green, border: "1px solid rgba(16,185,129,0.35)", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: font, fontSize: 13 };
  const th = { textAlign: "left", padding: "9px 10px", fontSize: 11, color: Z.muted, textTransform: "uppercase", letterSpacing: .4, borderBottom: `1px solid ${Z.borderMd}`, whiteSpace: "nowrap" };
  const td = { padding: "9px 10px", fontSize: 12.5, borderBottom: `1px solid ${Z.border}`, color: Z.white, verticalAlign: "top" };

  return (
    <div data-testid="riddor-view">
      <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: Z.white }}>{E("🏛 ", "")}RIDDOR register</div>
            <div style={{ fontSize: 12, color: Z.muted, marginTop: 3 }}>Every reportable incident: when it happened, when and how it was reported to the HSE, and the reference. Keep for at least 3 years.</div>
          </div>
          <select value={sel} onChange={e => setSel(e.target.value)} style={sel2} aria-label="Period" data-testid="riddor-period">
            {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <label style={{ fontSize: 12.5, color: Z.white, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={names} onChange={e => setNames(e.target.checked)} data-testid="riddor-names"/> Include names
          </label>
          <button onClick={pdf} style={btnP} data-testid="riddor-pdf">{E("📄 ", "")}PDF</button>
          <button onClick={xlsx} style={btnX} data-testid="riddor-xlsx">↓ Excel</button>
        </div>
        {blocked && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: Z.amber, fontWeight: 700 }}>Your browser blocked the new tab, so the register was downloaded as a web page instead. Open it and use Print → Save as PDF.</div>}
        <div style={{ fontSize: 12.5, color: Z.white, marginTop: 12 }} data-testid="riddor-summary">
          <b>{s.total}</b> reportable · <b>{s.reported}</b> reported to the HSE
          {s.notReported > 0 && <span style={{ color: Z.red, fontWeight: 700 }}> · {s.notReported} not yet reported{s.overdue ? ` (${s.overdue} past the deadline)` : ""}</span>}
          {s.late > 0 && <span style={{ color: Z.amber }}> · {s.late} reported after the deadline</span>}
          {s.noRef > 0 && <span style={{ color: Z.amber }}> · {s.noRef} with no HSE reference</span>}
        </div>
      </div>
      <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 960 }} data-testid="riddor-table">
          <thead><tr>{["Date", "Type", "RIDDOR category", "Location", ...(names ? ["Person"] : []), "Injury", "Days lost", "Reported", "Days to report", "HSE reference", "Reported by"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map(r => (
              <tr key={r.id} data-testid="riddor-row">
                <td style={{ ...td, whiteSpace: "nowrap" }}>{ukDate(r.date)}</td><td style={td}>{r.type}</td><td style={td}>{r.category}</td><td style={td}>{r.location}</td>
                {names && <td style={td}>{r.person}</td>}
                <td style={td}>{r.injury}</td><td style={{ ...td, textAlign: "right" }}>{r.daysLost ?? "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{r.reported ? ukDate(r.reportedDate) : <span style={{ color: Z.red, fontWeight: 700 }}>{r.overdue ? "Overdue" : "Not yet"}{r.dueDate ? ` · due ${ukDate(r.dueDate)}` : ""}</span>}</td>
                <td style={{ ...td, textAlign: "right", color: r.late ? Z.red : Z.white, fontWeight: r.late ? 800 : 400 }}>{r.daysToReport ?? "—"}</td>
                <td style={td}>{r.ref || (r.reported ? <span style={{ color: Z.amber }}>not recorded</span> : "")}</td><td style={td}>{r.reportedBy}</td>
              </tr>
            )) : <tr><td style={{ ...td, color: Z.muted }} colSpan={10 + (names ? 1 : 0)}>No RIDDOR-reportable incidents in this period.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: Z.muted, marginTop: 10 }}>To record a report to the HSE, open the incident in Incidents and use the RIDDOR box.</div>
    </div>
  );
}
