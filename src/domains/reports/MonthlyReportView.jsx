import React, { useState, useMemo } from "react";
import { E } from "../../lib/emoji";
import { ZEUS_LOGO_LIGHT_SRC } from "../../shared/Logo";
import { buildMonthlyReport, renderMonthlyReportHtml, openMonthlyReport, MONTHS } from "./monthlyReport";

/**
 * MonthlyReportView — Reports → "Monthly Report".
 * Pick a month and click one button to produce the H&S management report
 * (board pack) as a print-ready page; the browser's print window opens so it can
 * be saved as a PDF. The figures shown here are the same ones that go in the pack.
 */
function MonthlyReportView({ incidents, investigations, inspections, ras, staff, modules, assigns, comps, userName, Z, font }) {
  const now = new Date();
  // Default: last complete month.
  const options = Array.from({ length: 24 }, (_, k) => { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [sel, setSel] = useState(`${options[1].y}-${options[1].m}`);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [year, month] = sel.split("-").map(Number);

  const report = useMemo(() => buildMonthlyReport(
    { incidents, investigations, inspections, ras, staff, modules, assigns, comps, generatedBy: userName, companyName: "Zeus Packaging UK" },
    { year, month }), [incidents, investigations, inspections, ras, staff, modules, assigns, comps, userName, year, month]);

  function generate() {
    const html = renderMonthlyReportHtml(report, { logoSrc: ZEUS_LOGO_LIGHT_SRC });
    const ok = openMonthlyReport(html, `HS_Management_Report_${year}-${String(month + 1).padStart(2, "0")}.html`);
    setPopupBlocked(!ok);
  }

  const i = report.incidents, t = report.training, a = report.actions, ins = report.inspections;
  const tiles = [
    ["Incidents", i.month, `${i.prev} in ${report.period.prevLabel}`, Z.white],
    ["RIDDOR", report.riddor.month, `${report.riddor.ytd} in ${year}${report.riddor.notReported ? ` · ${report.riddor.notReported} not reported` : ""}`, report.riddor.notReported ? Z.red : Z.white],
    ["Training compliance", t.pct === null ? "—" : `${t.pct}%`, `${t.fullyCompliant} of ${t.withTraining} staff fully compliant`, t.pct === null ? Z.muted : t.pct >= 95 ? Z.green : t.pct >= 80 ? Z.amber : Z.red],
    ["Overdue actions", a.overdue, `${a.open} open`, a.overdue ? Z.red : Z.green],
    ["Avg inspection score", ins.avg === null ? "—" : `${ins.avg}%`, `${ins.count} inspection${ins.count !== 1 ? "s" : ""}`, ins.avg === null ? Z.muted : ins.avg >= 75 ? Z.green : ins.avg >= 60 ? Z.amber : Z.red],
  ];
  const sel2 = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "8px 12px", color: Z.white, fontFamily: font, fontSize: 13 };

  return (
    <div>
      <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: Z.white }}>{E("📑 ", "")}Monthly H&amp;S management report</div>
            <div style={{ fontSize: 12, color: Z.muted, marginTop: 3 }}>A board pack covering incidents and trends, RIDDOR, training compliance, overdue actions and inspection scores.</div>
          </div>
          <select value={sel} onChange={e => setSel(e.target.value)} style={sel2} aria-label="Report month">
            {options.map(o => <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{MONTHS[o.m]} {o.y}{o.y === now.getFullYear() && o.m === now.getMonth() ? " (so far)" : ""}</option>)}
          </select>
          <button onClick={generate}
            style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontFamily: font, fontSize: 13 }}>
            {E("📄 ", "")}Generate PDF report
          </button>
        </div>
        {popupBlocked && (
          <div role="alert" style={{ marginTop: 12, fontSize: 12, color: Z.amber, fontWeight: 700 }}>
            Your browser blocked the new tab, so the report was downloaded as a web page instead. Open it and use Print → Save as PDF, or allow pop-ups for this site and try again.
          </div>
        )}
        <div style={{ fontSize: 11, color: Z.muted, marginTop: 10 }}>
          The report opens in a new tab and the print window appears — choose <b>Save as PDF</b>. Training compliance and open actions are shown as at today.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
        {tiles.map(([l, v, s, c]) => (
          <div key={l} style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: Z.white, marginTop: 4 }}>{l}</div>
            <div style={{ fontSize: 11, color: Z.muted, marginTop: 2 }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, color: Z.muted, textTransform: "uppercase", marginBottom: 8 }}>Key points — {report.period.label}</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: Z.white, lineHeight: 1.7 }}>
          {report.keyPoints.map((p, k) => <li key={k} style={/^ATTENTION/.test(p) ? { color: Z.red, fontWeight: 700 } : undefined}>{p}</li>)}
        </ul>
      </div>
    </div>
  );
}

export { MonthlyReportView };
