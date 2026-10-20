import React, { useState, useMemo, useEffect } from "react";
import { E } from "../../lib/emoji";
import { brandLightLogo } from "../../shared/Logo";
import { brandCompany, fileShort } from "../../lib/brandCore";
import { todayISO, ukDate } from "../../lib/dates";
import { loadRacking } from "../../lib/rackClient";
import { buildXlsx, downloadBlob } from "../../lib/xlsxWriter";
import { buildScheduleReport, renderScheduleReportHtml, scheduleWorkbook } from "./inspectionSchedule";
import { openMonthlyReport, MONTHS } from "./monthlyReport";

/**
 * InspectionScheduleView — Reports → "Inspection Schedule".
 * Were inspections and audits done when they were due (inspectionSchedule.js explains how
 * "planned" is worked out), what is overdue today, how old the open findings are, and
 * open racking damage. On screen, as a PDF, or as Excel. Racking is read fresh when the
 * view opens.
 */
export function InspectionScheduleView({ inspections, userName, Z, font }) {
  const today = todayISO();
  const now = new Date(`${today}T12:00:00`);
  const options = Array.from({ length: 24 }, (_, k) => { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [sel, setSel] = useState(`${options[0].y}-${options[0].m}`);
  const [span, setSpan] = useState(12);
  const [year, month] = sel.split("-").map(Number);
  const [rk, setRk] = useState(null);
  useEffect(() => {
    let live = true;
    loadRacking({ fresh: true, checks: true }).then(r => { if (live) setRk(r && !r.missing ? r : { missing: true }); }, () => { if (live) setRk({ missing: true }); });
    return () => { live = false; };
  }, []);
  const report = useMemo(() => (rk ? buildScheduleReport({ inspections: inspections || [],
    rackingChecks: rk.missing ? [] : rk.checks, rackingSettings: rk.settings, rackingDamage: rk.missing ? null : rk.damage, rackingLocations: rk.missing ? [] : rk.locations,
    today, companyName: brandCompany(), generatedBy: userName }, { year, month, months: span }) : null), [rk, inspections, today, userName, year, month, span]);

  const [blocked, setBlocked] = useState(false);
  function pdf() { if (report) setBlocked(!openMonthlyReport(renderScheduleReportHtml(report, { logoSrc: brandLightLogo() }), `Inspection_Schedule_${report.period.to.slice(0, 7)}.html`)); }
  function xlsx() { if (report) downloadBlob(buildXlsx(scheduleWorkbook(report)), `${fileShort()}-inspection-schedule-${report.period.to.slice(0, 7)}.xlsx`); }

  const band = p => (p === null || p === undefined ? Z.muted : p >= 95 ? Z.green : p >= 80 ? Z.amber : Z.red);
  const sel2 = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "8px 12px", color: Z.white, fontFamily: font, fontSize: 13 };
  const btnP = { background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: font, fontSize: 13 };
  const btnX = { background: "rgba(16,185,129,0.12)", color: Z.green, border: "1px solid rgba(16,185,129,0.35)", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: font, fontSize: 13 };
  const card = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "14px 18px", marginBottom: 16 };
  const th = { textAlign: "left", padding: "7px 8px", fontSize: 11, color: Z.muted, textTransform: "uppercase", letterSpacing: .4, borderBottom: `1px solid ${Z.borderMd}`, whiteSpace: "nowrap" };
  const td = { padding: "7px 8px", fontSize: 12.5, borderBottom: `1px solid ${Z.border}`, color: Z.white };
  const cellCol = c => (!c.dueSoFar ? "transparent" : c.onTime === c.dueSoFar ? "rgba(16,185,129,0.18)" : c.missed ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)");
  const o = report && report.overall, f = report && report.findings;

  return (
    <div data-testid="schedule-view">
      <div style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: Z.white }}>{E("🗓 ", "")}Inspection &amp; audit schedule</div>
            <div style={{ fontSize: 12, color: Z.muted, marginTop: 3 }}>Inspections due vs done on time, by type and month (racking checks and the expert inspection included), what's overdue now, and how long findings have been open.</div>
          </div>
          <select value={span} onChange={e => setSpan(+e.target.value)} style={sel2} aria-label="Number of months">
            {[3, 6, 12].map(n => <option key={n} value={n}>{n} months to</option>)}
          </select>
          <select value={sel} onChange={e => setSel(e.target.value)} style={sel2} aria-label="Last month" data-testid="schedule-month">
            {options.map((x, k) => <option key={`${x.y}-${x.m}`} value={`${x.y}-${x.m}`}>{MONTHS[x.m]} {x.y}{k === 0 ? " (so far)" : ""}</option>)}
          </select>
          <button onClick={pdf} disabled={!report} style={{ ...btnP, opacity: report ? 1 : .5 }} data-testid="schedule-pdf">{E("📄 ", "")}PDF</button>
          <button onClick={xlsx} disabled={!report} style={{ ...btnX, opacity: report ? 1 : .5 }} data-testid="schedule-xlsx">↓ Excel</button>
        </div>
        {blocked && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: Z.amber, fontWeight: 700 }}>Your browser blocked the new tab, so the report was downloaded as a web page instead. Open it and use Print → Save as PDF.</div>}
        {!report && <div style={{ marginTop: 12, fontSize: 12, color: Z.muted }}>Loading…</div>}
      </div>

      {report && <>
        <div data-testid="schedule-tiles" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
          {[["Done on time", o.pct === null ? "—" : `${o.pct}%`, `${o.onTime} of ${o.dueSoFar} due`, band(o.pct)],
            ["Done late", o.late, "after the due date", o.late ? Z.amber : Z.green],
            ["Overdue now", report.overdueNow.length, "due and not done", report.overdueNow.length ? Z.red : Z.green],
            ["Open findings", f.open, `${f.overdue} past action date · ${f.over90} over 90 days`, f.overdue ? Z.red : Z.white],
            ...(report.racking ? [["Open racking damage", report.racking.open, `${report.racking.red} red · ${report.racking.amberLate} amber overdue`, report.racking.red || report.racking.amberLate ? Z.red : Z.white]] : []),
          ].map(([l, v, s, col]) => (
            <div key={l} data-testid="schedule-tile" style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: col, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: Z.white, marginTop: 4 }}>{l}</div>
              <div style={{ fontSize: 11, color: Z.muted, marginTop: 2 }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: Z.white, marginBottom: 4 }}>Done on time / due, by month</div>
          <div style={{ fontSize: 11.5, color: Z.muted, marginBottom: 10 }}>Green: all on time · amber: some late · red: some not done. Each inspection's "next due" date is one planned inspection.</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 200 + report.months.length * 58 }} data-testid="schedule-grid">
              <thead><tr><th style={th}>Type</th>{report.months.map(m => <th key={m.key} style={{ ...th, textAlign: "center" }}>{m.label}</th>)}<th style={{ ...th, textAlign: "right" }}>On time</th></tr></thead>
              <tbody>
                {report.types.length ? report.types.map(t => (
                  <tr key={t.type}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{t.label}</td>
                    {t.cells.map((c, k) => <td key={k} style={{ ...td, textAlign: "center", background: cellCol(c) }} title={c.done ? `${c.done} done that month` : undefined}>{c.dueSoFar ? `${c.onTime}/${c.dueSoFar}` : c.planned ? <span style={{ color: Z.muted }}>due</span> : <span style={{ color: Z.muted }}>·</span>}</td>)}
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: band(t.total.pct) }}>{t.total.pct === null ? "—" : `${t.total.pct}%`}</td>
                  </tr>
                )) : <tr><td style={{ ...td, color: Z.muted }} colSpan={report.months.length + 2}>No inspections recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: Z.white, marginBottom: 10 }}>Overdue today</div>
            {report.overdueNow.length ? (
              <table style={{ borderCollapse: "collapse", width: "100%" }} data-testid="schedule-overdue">
                <thead><tr><th style={th}>Type</th><th style={th}>Location</th><th style={th}>Was due</th><th style={{ ...th, textAlign: "right" }}>Days</th></tr></thead>
                <tbody>{report.overdueNow.map((x, k) => <tr key={k}><td style={td}>{x.type}</td><td style={td}>{x.location}</td><td style={td}>{ukDate(x.due)}</td><td style={{ ...td, textAlign: "right", color: Z.red, fontWeight: 800 }}>{x.daysOverdue}</td></tr>)}</tbody>
              </table>
            ) : <div style={{ fontSize: 13, color: Z.green }}>Nothing overdue.</div>}
          </div>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: Z.white, marginBottom: 10 }}>Open inspection findings by age</div>
            <table style={{ borderCollapse: "collapse", width: "100%" }} data-testid="schedule-ageing">
              <thead><tr><th style={th}>Open for</th><th style={{ ...th, textAlign: "right" }}>Major</th><th style={{ ...th, textAlign: "right" }}>Minor</th><th style={{ ...th, textAlign: "right" }}>Obs.</th><th style={{ ...th, textAlign: "right" }}>Total</th></tr></thead>
              <tbody>{f.ageing.map(a => <tr key={a.label}><td style={td}>{a.label}</td><td style={{ ...td, textAlign: "right" }}>{a.major || "—"}</td><td style={{ ...td, textAlign: "right" }}>{a.minor || "—"}</td><td style={{ ...td, textAlign: "right" }}>{a.observation || "—"}</td><td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{a.total}</td></tr>)}</tbody>
            </table>
            <div style={{ fontSize: 11.5, color: Z.muted, marginTop: 8 }}>{f.overdue} past the action date{f.noDueDate ? ` · ${f.noDueDate} with no action date` : ""}. The full list is in the PDF and Excel.</div>
          </div>
        </div>
      </>}
    </div>
  );
}
