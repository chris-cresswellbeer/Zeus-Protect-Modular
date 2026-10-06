/**
 * ═══════════════════════════════════════════════════════════════════════════
 * monthlyReport.js — monthly H&S management report ("board pack")
 * ═══════════════════════════════════════════════════════════════════════════
 * buildMonthlyReport(data, { year, month })  → all the figures (pure, testable)
 * renderMonthlyReportHtml(report)            → a print-ready A4 HTML document
 * openMonthlyReport(html, filename)          → opens it and the print dialog
 *                                              (choose "Save as PDF")
 *
 * Sections: summary + key points, incidents & 12-month trends, RIDDOR, training
 * compliance, overdue actions, inspection scores.
 *
 * PERIOD vs "AS AT": incidents, RIDDOR, inspections and actions closed are for the
 * chosen month (trends run for the 12 months ending with it). Training compliance
 * and open/overdue actions are a snapshot "as at" the day the report is produced —
 * the portal keeps current status, not a month-end history of it.
 */
import { buildTrainingMatrix } from "../training/trainingMatrix";
import { collectOpenActions } from "../../lib/openActions";
import { INSP_TYPES } from "../../data/seedInspections";

import { todayISO } from "../../lib/dates";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TYPE_LABELS = { accident: "Accident", near_miss: "Near miss", unsafe_condition: "Unsafe condition", unsafe_act: "Unsafe act" };
const TYPE_COLORS = { accident: "#dc2626", near_miss: "#f59e0b", unsafe_condition: "#ea580c", unsafe_act: "#7c3aed" };
const TYPES = Object.keys(TYPE_LABELS);

const pad = n => String(n).padStart(2, "0");
const ym = (y, m) => `${y}-${pad(m + 1)}`;
const inMonth = (d, y, m) => !!d && String(d).slice(0, 7) === ym(y, m);
const shift = (y, m, k) => { const d = new Date(y, m + k, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
const pctOf = (a, b) => b ? Math.round(a / b * 100) : null;
const inspPct = ins => ins && ins.maxScore ? Math.round((Number(ins.overallScore) || 0) / Number(ins.maxScore) * 100) : null;
const avg = list => list.length ? Math.round(list.reduce((s, v) => s + v, 0) / list.length) : null;

/**
 * @param data { incidents, investigations, inspections, ras, staff, modules, assigns, comps, companyName, generatedBy }
 * @param period { year, month }  month is 0-11
 */
function buildMonthlyReport(data, { year, month }) {
  const today = data.today || todayISO();
  const incidents = data.incidents || [];
  const inspections = data.inspections || [];
  const prev = shift(year, month, -1);
  const lastYear = { y: year - 1, m: month };

  // ── Incidents ──
  const monthInc = incidents.filter(i => inMonth(i.date, year, month)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const prevInc = incidents.filter(i => inMonth(i.date, prev.y, prev.m));
  const lyInc = incidents.filter(i => inMonth(i.date, lastYear.y, lastYear.m));
  const trend = Array.from({ length: 12 }, (_, k) => {
    const p = shift(year, month, k - 11);
    const hits = incidents.filter(i => inMonth(i.date, p.y, p.m));
    const row = { label: MONTHS[p.m].slice(0, 3) + " " + String(p.y).slice(2), total: hits.length, riddor: hits.filter(i => i.riddor).length };
    TYPES.forEach(t => { row[t] = hits.filter(i => i.type === t).length; });
    return row;
  });
  const start12 = shift(year, month, -11);
  const from12 = `${ym(start12.y, start12.m)}-01`, to = `${ym(year, month)}-31`;
  const last12 = incidents.filter(i => i.date && i.date >= from12 && i.date <= to);
  const byType = TYPES.map(t => ({ type: t, label: TYPE_LABELS[t], month: monthInc.filter(i => i.type === t).length, prev: prevInc.filter(i => i.type === t).length,
    lastYear: lyInc.filter(i => i.type === t).length, last12: last12.filter(i => i.type === t).length }));
  const locMap = {};
  last12.forEach(i => { const l = String(i.location || "Unknown").trim(); locMap[l] = (locMap[l] || 0) + 1; });
  const topLocations = Object.entries(locMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([location, count]) => ({ location, count }));
  const openIncidents = incidents.filter(i => !i.closed).length;
  const investigated = monthInc.filter(i => data.investigations && data.investigations[i.id]).length;

  // ── RIDDOR (calendar year to date) ──
  const ytd = incidents.filter(i => i.riddor && String(i.date || "").slice(0, 4) === String(year) && String(i.date).slice(0, 7) <= ym(year, month))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const riddor = {
    month: monthInc.filter(i => i.riddor).length,
    ytd: ytd.length,
    notReported: incidents.filter(i => i.riddor && !i.riddorReported && String(i.date).slice(0, 7) <= ym(year, month)).length,
    list: ytd.map(i => ({ date: i.date, type: TYPE_LABELS[i.type] || i.type, location: i.location, injury: i.injuryType || "",
      reported: !!i.riddorReported, reportedDate: i.riddorReportedDate || "", ref: i.hseReference || "",
      daysToReport: i.riddorReported && i.riddorReportedDate && i.date ? Math.round((new Date(i.riddorReportedDate) - new Date(i.date)) / 86400000) : null })),
  };

  // ── Training (as at today) ──
  const matrix = buildTrainingMatrix({ staff: data.staff, modules: data.modules, assigns: data.assigns || {}, comps: data.comps || {} });
  const byManager = {};
  matrix.rows.forEach(r => { const k = r.user.manager || "No line manager"; (byManager[k] = byManager[k] || { staff: 0, assigned: 0, ok: 0, full: 0 });
    byManager[k].staff++; byManager[k].assigned += r.assigned; byManager[k].ok += r.ok; if (r.pct === 100) byManager[k].full++; });
  const managerRows = Object.entries(byManager).map(([manager, v]) => ({ manager, ...v, pct: pctOf(v.ok, v.assigned) }))
    .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
  const moduleRows = matrix.cols.map((m, ci) => ({ title: m.title, ...matrix.colStats[ci] })).filter(m => m.assigned)
    .sort((a, b) => a.pct - b.pct);
  const completedInMonth = Object.values(data.comps || {}).reduce((s, uc) => s + Object.values(uc || {}).filter(c => inMonth(c && c.date, year, month)).length, 0);
  const staffAtRisk = matrix.rows.filter(r => r.pct !== null && r.pct < 100)
    .map(r => ({ name: r.user.name, manager: r.user.manager || "", pct: r.pct,
      expired: r.cells.filter(c => c.assigned && c.status === "expired").length, missing: r.cells.filter(c => c.status === "missing").length }))
    .sort((a, b) => a.pct - b.pct);
  const training = { ...matrix.totals, managerRows, moduleRows, completedInMonth, staffAtRisk };

  // ── Actions (open = as at today; closed = in the month) ──
  const open = collectOpenActions({ incidents, investigations: data.investigations || {}, inspections, ras: data.ras || [], today });
  const overdue = open.filter(a => a.daysOverdue !== null && a.daysOverdue > 0).sort((a, b) => b.daysOverdue - a.daysOverdue);
  const bySource = {};
  open.forEach(a => { const s = (bySource[a.source] = bySource[a.source] || { open: 0, overdue: 0 }); s.open++; if (a.daysOverdue > 0) s.overdue++; });
  const byOwner = {};
  overdue.forEach(a => { byOwner[a.owner] = (byOwner[a.owner] || 0) + 1; });
  let closedInMonth = 0;
  Object.values(data.investigations || {}).forEach(inv => (inv.actions || []).forEach(a => { if (inMonth(a.completedDate || a.completedAt, year, month)) closedInMonth++; }));
  inspections.forEach(ins => (ins.nonConformances || []).forEach(nc => { if (inMonth(nc.completedDate || nc.actionCompletedDate, year, month)) closedInMonth++; }));
  const actions = { open: open.length, overdue: overdue.length, noDueDate: open.filter(a => !a.dueDate).length,
    oldestOverdue: overdue[0] ? overdue[0].daysOverdue : 0, list: overdue,
    bySource: Object.entries(bySource).map(([source, v]) => ({ source, ...v })),
    byOwner: Object.entries(byOwner).sort((a, b) => b[1] - a[1]).map(([owner, count]) => ({ owner, count })), closedInMonth };

  // ── Inspections ──
  const typeLabel = t => (INSP_TYPES.find(x => x.id === t) || {}).label || t || "Inspection";
  const monthIns = inspections.filter(i => inMonth(i.date, year, month)).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(i => ({ date: i.date, type: typeLabel(i.type), location: i.location || "", inspector: i.inspector || "", pct: inspPct(i),
      major: (i.nonConformances || []).filter(n => n.severity === "major").length, minor: (i.nonConformances || []).filter(n => n.severity === "minor").length,
      observations: (i.nonConformances || []).filter(n => n.severity === "observation").length }));
  const insTrend = Array.from({ length: 12 }, (_, k) => {
    const p = shift(year, month, k - 11);
    const list = inspections.filter(i => inMonth(i.date, p.y, p.m)).map(inspPct).filter(v => v !== null);
    return { label: MONTHS[p.m].slice(0, 3) + " " + String(p.y).slice(2), avg: avg(list), count: list.length };
  });
  const prev3 = insTrend.slice(8, 11).filter(t => t.avg !== null);
  const inspectionsSummary = { list: monthIns, count: monthIns.length, avg: avg(monthIns.map(i => i.pct).filter(v => v !== null)),
    prev3Avg: prev3.length ? Math.round(prev3.reduce((s, t) => s + t.avg * t.count, 0) / prev3.reduce((s, t) => s + t.count, 0)) : null,
    trend: insTrend, openNCs: open.filter(a => a.source === "Site inspection").length };

  const report = {
    period: { year, month, label: `${MONTHS[month]} ${year}`, prevLabel: `${MONTHS[prev.m]} ${prev.y}`, lastYearLabel: `${MONTHS[month]} ${year - 1}` },
    generated: today, generatedBy: data.generatedBy || "", companyName: data.companyName || "Zeus Packaging UK",
    incidents: { month: monthInc.length, prev: prevInc.length, lastYear: lyInc.length, avg12: Math.round(last12.length / 12 * 10) / 10,
      accidents: monthInc.filter(i => i.type === "accident").length, nearMisses: monthInc.filter(i => i.type === "near_miss").length,
      open: openIncidents, investigated, byType, trend, topLocations,
      list: monthInc.map(i => ({ date: i.date, type: TYPE_LABELS[i.type] || i.type, location: i.location || "", description: i.description || "",
        injury: i.injuryType || "", riddor: !!i.riddor, closed: !!i.closed, investigated: !!(data.investigations && data.investigations[i.id]) })) },
    riddor, training, actions, inspections: inspectionsSummary,
  };
  report.keyPoints = keyPoints(report);
  return report;
}

function keyPoints(r) {
  const k = [];
  const i = r.incidents;
  const cmp = i.month > i.prev ? `up from ${i.prev} in ${r.period.prevLabel}` : i.month < i.prev ? `down from ${i.prev} in ${r.period.prevLabel}` : `the same as ${r.period.prevLabel}`;
  k.push(`${i.month} incident${i.month !== 1 ? "s" : ""} reported in ${r.period.label} — ${cmp}. 12-month average: ${i.avg12} a month.`);
  if (i.nearMisses) k.push(`${i.nearMisses} near miss${i.nearMisses !== 1 ? "es" : ""} reported — near-miss reporting helps prevent accidents.`);
  if (r.riddor.month) k.push(`${r.riddor.month} RIDDOR-reportable incident${r.riddor.month !== 1 ? "s" : ""} this month (${r.riddor.ytd} so far in ${r.period.year}).`);
  if (r.riddor.notReported) k.push(`ATTENTION: ${r.riddor.notReported} RIDDOR incident${r.riddor.notReported !== 1 ? "s have" : " has"} not been recorded as reported to the HSE.`);
  if (r.training.pct !== null) k.push(`Training compliance is ${r.training.pct}% (${r.training.fullyCompliant} of ${r.training.withTraining} staff with assigned training fully compliant; ${r.training.expired} expired and ${r.training.missing} not completed).`);
  k.push(r.actions.overdue ? `${r.actions.overdue} corrective action${r.actions.overdue !== 1 ? "s are" : " is"} overdue (oldest ${r.actions.oldestOverdue} days); ${r.actions.open} open in total.` : `No corrective actions are overdue (${r.actions.open} open).`);
  if (r.inspections.count) k.push(`${r.inspections.count} inspection${r.inspections.count !== 1 ? "s" : ""} carried out, average score ${r.inspections.avg}%${r.inspections.prev3Avg !== null ? ` (previous 3 months: ${r.inspections.prev3Avg}%)` : ""}.`);
  else k.push(`No site inspections were recorded in ${r.period.label}.`);
  return k;
}

// ── HTML ────────────────────────────────────────────────────────────────────
const h = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = d => { if (!d) return "—"; const [y, m, dd] = String(d).slice(0, 10).split("-"); return dd ? `${dd}/${m}/${y}` : h(d); };
const band = p => p === null || p === undefined ? "#64748b" : p >= 95 ? "#047857" : p >= 80 ? "#b45309" : "#b91c1c";
const scoreBand = p => p === null || p === undefined ? "#64748b" : p >= 90 ? "#047857" : p >= 75 ? "#b45309" : p >= 60 ? "#c2410c" : "#b91c1c";

function stackedBars(trend) {
  const W = 680, H = 220, L = 30, B = 34, T = 14;
  const max = Math.max(1, ...trend.map(t => t.total));
  const step = Math.ceil(max / 4) || 1, top = step * 4;
  const bw = (W - L - 10) / trend.length;
  const y = v => T + (H - T - B) * (1 - v / top);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Incidents per month">`;
  for (let v = 0; v <= top; v += step) s += `<line x1="${L}" x2="${W - 5}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/><text x="${L - 6}" y="${y(v) + 3}" font-size="9" text-anchor="end" fill="#64748b">${v}</text>`;
  trend.forEach((t, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64;
    let acc = 0;
    TYPES.forEach(k => { if (!t[k]) return; const y0 = y(acc), y1 = y(acc + t[k]); s += `<rect x="${x}" y="${y1}" width="${w}" height="${y0 - y1}" fill="${TYPE_COLORS[k]}"/>`; acc += t[k]; });
    if (t.total) s += `<text x="${x + w / 2}" y="${y(t.total) - 3}" font-size="9" font-weight="700" text-anchor="middle" fill="#0f172a">${t.total}</text>`;
    if (t.riddor) s += `<text x="${x + w / 2}" y="${H - B + 24}" font-size="8" font-weight="700" text-anchor="middle" fill="#b91c1c">R${t.riddor > 1 ? "×" + t.riddor : ""}</text>`;
    s += `<text x="${x + w / 2}" y="${H - B + 13}" font-size="9" text-anchor="middle" fill="${i === trend.length - 1 ? "#0f172a" : "#64748b"}" font-weight="${i === trend.length - 1 ? 700 : 400}">${h(t.label)}</text>`;
  });
  return s + "</svg>";
}
function scoreBars(trend) {
  const W = 680, H = 170, L = 30, B = 22, T = 14;
  const bw = (W - L - 10) / trend.length;
  const y = v => T + (H - T - B) * (1 - v / 100);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Average inspection score per month">`;
  [0, 25, 50, 75, 100].forEach(v => { s += `<line x1="${L}" x2="${W - 5}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/><text x="${L - 6}" y="${y(v) + 3}" font-size="9" text-anchor="end" fill="#64748b">${v}%</text>`; });
  trend.forEach((t, i) => {
    const x = L + i * bw + bw * 0.2, w = bw * 0.6;
    if (t.avg !== null) s += `<rect x="${x}" y="${y(t.avg)}" width="${w}" height="${y(0) - y(t.avg)}" fill="${scoreBand(t.avg)}" opacity="0.85"/><text x="${x + w / 2}" y="${y(t.avg) - 3}" font-size="9" font-weight="700" text-anchor="middle" fill="#0f172a">${t.avg}%</text>`;
    else s += `<text x="${x + w / 2}" y="${y(0) - 4}" font-size="8" text-anchor="middle" fill="#94a3b8">—</text>`;
    s += `<text x="${x + w / 2}" y="${H - 6}" font-size="9" text-anchor="middle" fill="${i === trend.length - 1 ? "#0f172a" : "#64748b"}" font-weight="${i === trend.length - 1 ? 700 : 400}">${h(t.label)}</text>`;
  });
  return s + "</svg>";
}
const hbar = (p, color) => `<div class="hbar"><div style="width:${Math.max(0, Math.min(100, p || 0))}%;background:${color}"></div></div>`;
const arrow = (a, b, goodWhenDown = true) => {
  if (a === b || b === null || b === undefined) return `<span class="delta flat">no change</span>`;
  const up = a > b, good = goodWhenDown ? !up : up;
  return `<span class="delta ${good ? "good" : "bad"}">${up ? "▲" : "▼"} ${Math.abs(a - b)} vs last month</span>`;
};

function renderMonthlyReportHtml(r, { logoSrc = "" } = {}) {
  const i = r.incidents, t = r.training, a = r.actions, ins = r.inspections;
  const tile = (label, value, sub, color = "#0f172a") => `<div class="tile"><div class="tv" style="color:${color}">${value}</div><div class="tl">${h(label)}</div><div class="ts">${sub || ""}</div></div>`;
  const legend = TYPES.map(k => `<span><i style="background:${TYPE_COLORS[k]}"></i>${TYPE_LABELS[k]}</span>`).join("") + `<span><b style="color:#b91c1c">R</b> = RIDDOR</span>`;
  const empty = (cols, text) => `<tr><td colspan="${cols}" class="empty">${h(text)}</td></tr>`;
  const title = `H&S Management Report — ${r.period.label}`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${h(r.companyName.replace(/\s+/g, "_"))}_HS_Report_${r.period.year}-${pad(r.period.month + 1)}</title>
<style>
@page{size:A4;margin:14mm 13mm 16mm}
*{box-sizing:border-box}
body{font-family:"Segoe UI",Arial,sans-serif;color:#0f172a;font-size:11.5px;line-height:1.45;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{max-width:780px;margin:0 auto;padding:24px 16px}
.toolbar{position:sticky;top:0;background:#0f172a;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;font-size:13px;z-index:5}
.toolbar button{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
header.cover{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0d1f5c;padding-bottom:12px;margin-bottom:16px}
header.cover img{height:38px}
h1{font-size:22px;margin:0 0 2px;color:#0d1f5c}
.sub{color:#475569;font-size:12px}
h2{font-size:15px;color:#0d1f5c;border-bottom:2px solid #e2e8f0;padding-bottom:5px;margin:22px 0 10px;break-after:avoid}
h3{font-size:12px;margin:14px 0 6px;color:#334155;text-transform:uppercase;letter-spacing:.4px;break-after:avoid}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
.tile{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#f8fafc;break-inside:avoid}
.tv{font-size:22px;font-weight:800;line-height:1.1}.tl{font-size:10.5px;font-weight:700;color:#334155;margin-top:3px}.ts{font-size:9.5px;color:#64748b;margin-top:2px}
.delta{font-size:9.5px;font-weight:700}.delta.good{color:#047857}.delta.bad{color:#b91c1c}.delta.flat{color:#64748b}
.keypoints{background:#eff6ff;border-left:4px solid #1d4ed8;border-radius:6px;padding:10px 14px 10px 30px;margin:0 0 6px}
.keypoints li{margin:3px 0}.keypoints li.attn{color:#b91c1c;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:8px}
th{background:#0d1f5c;color:#fff;text-align:left;padding:5px 6px;font-weight:700}
td{border-bottom:1px solid #e2e8f0;padding:4px 6px;vertical-align:top}
tr{break-inside:avoid}
td.n,th.n{text-align:right}td.c,th.c{text-align:center}
td.empty{color:#64748b;font-style:italic;text-align:center;padding:10px}
.pill{display:inline-block;padding:1px 7px;border-radius:99px;font-size:9.5px;font-weight:700}
.p-red{background:#fee2e2;color:#991b1b}.p-green{background:#dcfce7;color:#166534}.p-amber{background:#fef3c7;color:#92400e}.p-grey{background:#f1f5f9;color:#475569}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:#475569;margin:2px 0 6px}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;break-inside:avoid}
.keep{break-inside:avoid}
.hbar{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;min-width:60px}.hbar div{height:100%}
.note{font-size:9.5px;color:#64748b;font-style:italic;margin:2px 0 8px}
footer{margin-top:26px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:9.5px;color:#64748b;display:flex;justify-content:space-between}
@media print{.toolbar{display:none}.wrap{padding:0;max-width:none}}
</style></head><body>
<div class="toolbar">Your browser's print window opens automatically — choose <b>&nbsp;Save as PDF&nbsp;</b> as the printer. <button onclick="window.print()">Print / Save as PDF</button></div>
<div class="wrap">
<header class="cover">
  <div><h1>Health &amp; Safety Management Report</h1><div class="sub"><b>${h(r.period.label)}</b> · ${h(r.companyName)}</div>
  <div class="sub">Produced ${fmt(r.generated)}${r.generatedBy ? ` by ${h(r.generatedBy)}` : ""} · Zeus Protect</div></div>
  ${logoSrc ? `<img src="${h(logoSrc)}" alt="">` : ""}
</header>

<div class="tiles">
  ${tile("Incidents this month", i.month, arrow(i.month, i.prev))}
  ${tile("Accidents", i.accidents, `${i.nearMisses} near miss${i.nearMisses !== 1 ? "es" : ""}`)}
  ${tile("RIDDOR", r.riddor.month, `${r.riddor.ytd} in ${r.period.year}${r.riddor.notReported ? ` · <b style="color:#b91c1c">${r.riddor.notReported} not reported</b>` : ""}`, r.riddor.month ? "#b91c1c" : "#0f172a")}
  ${tile("Open incidents", i.open, "all dates, not yet closed")}
  ${tile("Training compliance", t.pct === null ? "—" : t.pct + "%", `${t.fullyCompliant} of ${t.withTraining} staff fully compliant`, band(t.pct))}
  ${tile("Overdue actions", a.overdue, `${a.open} open · ${a.closedInMonth} closed in month`, a.overdue ? "#b91c1c" : "#047857")}
  ${tile("Inspections", ins.count, `in ${h(r.period.label.split(" ")[0])}`)}
  ${tile("Avg inspection score", ins.avg === null ? "—" : ins.avg + "%", ins.prev3Avg !== null ? `prev. 3 months ${ins.prev3Avg}%` : "", scoreBand(ins.avg))}
</div>

<h3>Key points</h3>
<ul class="keypoints">${r.keyPoints.map(p => `<li${/^ATTENTION/.test(p) ? ' class="attn"' : ""}>${h(p)}</li>`).join("")}</ul>
<p class="note">Incidents, RIDDOR and inspections cover ${h(r.period.label)}. Training compliance and open / overdue actions are as at ${fmt(r.generated)}.</p>

<h2>1. Incidents &amp; trends</h2>
<div class="keep"><h3>Incidents per month — last 12 months</h3>
<div class="legend">${legend}</div>
${stackedBars(i.trend)}</div>
<div class="cols">
<div><h3>By type</h3>
<table><tr><th>Type</th><th class="n">${h(r.period.label.split(" ")[0].slice(0, 3))}</th><th class="n">Prev. month</th><th class="n">Same month ${r.period.year - 1}</th><th class="n">12 months</th></tr>
${i.byType.map(b => `<tr><td>${h(b.label)}</td><td class="n"><b>${b.month}</b></td><td class="n">${b.prev}</td><td class="n">${b.lastYear}</td><td class="n">${b.last12}</td></tr>`).join("")}
<tr><td><b>Total</b></td><td class="n"><b>${i.month}</b></td><td class="n"><b>${i.prev}</b></td><td class="n"><b>${i.lastYear}</b></td><td class="n"><b>${i.byType.reduce((s, b) => s + b.last12, 0)}</b></td></tr></table></div>
<div><h3>Top locations — last 12 months</h3>
<table><tr><th>Location</th><th class="n">Incidents</th><th style="width:40%"></th></tr>
${i.topLocations.length ? i.topLocations.map(l => `<tr><td>${h(l.location)}</td><td class="n">${l.count}</td><td>${hbar(l.count / i.topLocations[0].count * 100, "#1d4ed8")}</td></tr>`).join("") : empty(3, "No incidents in the last 12 months")}
</table></div></div>
<h3>Incidents reported in ${h(r.period.label)}</h3>
<table><tr><th style="width:62px">Date</th><th style="width:88px">Type</th><th style="width:110px">Location</th><th>Description</th><th class="c" style="width:52px">RIDDOR</th><th class="c" style="width:74px">Status</th></tr>
${i.list.length ? i.list.map(x => `<tr><td>${fmt(x.date)}</td><td>${h(x.type)}</td><td>${h(x.location)}</td><td>${h(x.description.length > 160 ? x.description.slice(0, 160) + "…" : x.description)}${x.injury ? `<br><span style="color:#64748b">Injury: ${h(x.injury)}</span>` : ""}</td><td class="c">${x.riddor ? '<span class="pill p-red">Yes</span>' : "—"}</td><td class="c">${x.closed ? '<span class="pill p-green">Closed</span>' : x.investigated ? '<span class="pill p-amber">Investigating</span>' : '<span class="pill p-grey">Open</span>'}</td></tr>`).join("") : empty(6, "No incidents reported this month")}
</table>

<h2>2. RIDDOR — ${r.period.year} to date</h2>
<table><tr><th style="width:62px">Date</th><th>Type</th><th>Location</th><th>Injury</th><th class="c">Reported to HSE</th><th>HSE ref.</th><th class="n">Days to report</th></tr>
${r.riddor.list.length ? r.riddor.list.map(x => `<tr><td>${fmt(x.date)}</td><td>${h(x.type)}</td><td>${h(x.location)}</td><td>${h(x.injury)}</td><td class="c">${x.reported ? `<span class="pill p-green">${fmt(x.reportedDate)}</span>` : '<span class="pill p-red">Not recorded</span>'}</td><td>${h(x.ref)}</td><td class="n">${x.daysToReport === null ? "—" : x.daysToReport > 15 ? `<b style="color:#b91c1c">${x.daysToReport}</b>` : x.daysToReport}</td></tr>`).join("") : empty(7, `No RIDDOR-reportable incidents in ${r.period.year}`)}
</table>
<p class="note">Most RIDDOR reports are due within 10 days; over-7-day injuries within 15 days. Figures above 15 days are highlighted.</p>

<h2>3. Training compliance <span style="font-weight:400;font-size:11px;color:#64748b">(as at ${fmt(r.generated)})</span></h2>
<div class="tiles">
  ${tile("Overall compliance", t.pct === null ? "—" : t.pct + "%", "assigned training complete & in date", band(t.pct))}
  ${tile("Fully compliant staff", `${t.fullyCompliant}/${t.withTraining}`, `staff with training assigned${t.staff > t.withTraining ? ` (${t.staff - t.withTraining} have none)` : ""}`)}
  ${tile("Expired", t.expired, `${t.expiring} more expiring soon`, t.expired ? "#b91c1c" : "#047857")}
  ${tile("Not completed", t.missing, `${t.completedInMonth} completed in ${h(r.period.label.split(" ")[0])}`, t.missing ? "#b91c1c" : "#047857")}
</div>
<div class="cols">
<div><h3>By line manager</h3>
<table><tr><th>Line manager</th><th class="n">Staff</th><th class="n">Compliance</th><th style="width:30%"></th></tr>
${t.managerRows.length ? t.managerRows.map(m => `<tr><td>${h(m.manager)}</td><td class="n">${m.staff}</td><td class="n" style="color:${band(m.pct)};font-weight:700">${m.pct === null ? "—" : m.pct + "%"}</td><td>${hbar(m.pct, band(m.pct))}</td></tr>`).join("") : empty(4, "No staff")}
</table></div>
<div><h3>Lowest-compliance modules</h3>
<table><tr><th>Module</th><th class="n">Assigned</th><th class="n">Compliance</th></tr>
${t.moduleRows.length ? t.moduleRows.slice(0, 8).map(m => `<tr><td>${h(m.title)}</td><td class="n">${m.assigned}</td><td class="n" style="color:${band(m.pct)};font-weight:700">${m.pct}%</td></tr>`).join("") : empty(3, "No training assigned")}
</table></div></div>
<h3>Staff not fully compliant${t.staffAtRisk.length > 20 ? " — lowest 20" : ""}</h3>
<table><tr><th>Name</th><th>Line manager</th><th class="n">Compliance</th><th class="n">Expired</th><th class="n">Not completed</th></tr>
${t.staffAtRisk.length ? t.staffAtRisk.slice(0, 20).map(s => `<tr><td>${h(s.name)}</td><td>${h(s.manager)}</td><td class="n" style="color:${band(s.pct)};font-weight:700">${s.pct}%</td><td class="n">${s.expired || "—"}</td><td class="n">${s.missing || "—"}</td></tr>`).join("") : empty(5, "Everyone is fully compliant")}
</table>
<p class="note">The full staff × module grid is in Reports → Training Matrix (Export to Excel).</p>

<h2>4. Corrective actions <span style="font-weight:400;font-size:11px;color:#64748b">(as at ${fmt(r.generated)})</span></h2>
<div class="cols">
<div><h3>Open actions by source</h3>
<table><tr><th>Source</th><th class="n">Open</th><th class="n">Overdue</th></tr>
${a.bySource.length ? a.bySource.map(s => `<tr><td>${h(s.source)}</td><td class="n">${s.open}</td><td class="n" style="${s.overdue ? "color:#b91c1c;font-weight:700" : ""}">${s.overdue}</td></tr>`).join("") : empty(3, "No open actions")}
<tr><td><b>Total</b></td><td class="n"><b>${a.open}</b></td><td class="n"><b>${a.overdue}</b></td></tr></table>
<p class="note">${a.closedInMonth} action${a.closedInMonth !== 1 ? "s" : ""} closed in ${h(r.period.label)}${a.noDueDate ? ` · ${a.noDueDate} open action${a.noDueDate !== 1 ? "s have" : " has"} no due date` : ""}.</p></div>
<div><h3>Overdue by owner</h3>
<table><tr><th>Owner</th><th class="n">Overdue</th></tr>
${a.byOwner.length ? a.byOwner.slice(0, 8).map(o => `<tr><td>${h(o.owner)}</td><td class="n">${o.count}</td></tr>`).join("") : empty(2, "Nothing overdue")}
</table></div></div>
<h3>Overdue actions${a.list.length > 20 ? " — 20 most overdue" : ""}</h3>
<table><tr><th>Action</th><th style="width:110px">Source</th><th style="width:100px">Owner</th><th style="width:62px">Due</th><th class="n" style="width:56px">Days over</th></tr>
${a.list.length ? a.list.slice(0, 20).map(x => `<tr><td>${h(x.title.length > 140 ? x.title.slice(0, 140) + "…" : x.title)}<br><span style="color:#64748b">${h(x.ref)}</span></td><td>${h(x.source)}</td><td>${h(x.owner)}</td><td>${fmt(x.dueDate)}</td><td class="n" style="color:#b91c1c;font-weight:700">${x.daysOverdue}</td></tr>`).join("") : empty(5, "No overdue actions")}
</table>

<h2>5. Site inspections</h2>
<div class="keep"><h3>Average inspection score — last 12 months</h3>
${scoreBars(ins.trend)}</div>
<h3>Inspections in ${h(r.period.label)}</h3>
<table><tr><th style="width:62px">Date</th><th>Type</th><th>Location</th><th>Inspector</th><th class="n">Score</th><th class="n">Major</th><th class="n">Minor</th><th class="n">Obs.</th></tr>
${ins.list.length ? ins.list.map(x => `<tr><td>${fmt(x.date)}</td><td>${h(x.type)}</td><td>${h(x.location)}</td><td>${h(x.inspector)}</td><td class="n" style="color:${scoreBand(x.pct)};font-weight:700">${x.pct === null ? "—" : x.pct + "%"}</td><td class="n">${x.major || "—"}</td><td class="n">${x.minor || "—"}</td><td class="n">${x.observations || "—"}</td></tr>`).join("") : empty(8, "No inspections recorded this month")}
</table>
<p class="note">${ins.openNCs} inspection non-conformance${ins.openNCs !== 1 ? "s" : ""} still open (all dates). Score bands: 90%+ excellent, 75%+ good, 60%+ satisfactory, below 60% requires improvement.</p>

<footer><span>${h(title)} · ${h(r.companyName)}</span><span>Generated by Zeus Protect on ${fmt(r.generated)}</span></footer>
</div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});</script>
</body></html>`;
}

/** Open the report in a new tab and start printing. Falls back to downloading the HTML if pop-ups are blocked. */
function openMonthlyReport(html, filename) {
  const w = window.open("", "_blank");
  if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); return true; }
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename || "HS_Management_Report.html";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return false;
}

export { buildMonthlyReport, renderMonthlyReportHtml, openMonthlyReport, MONTHS };
