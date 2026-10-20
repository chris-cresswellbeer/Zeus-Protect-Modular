/**
 * ═══════════════════════════════════════════════════════════════════════════
 * riddorRegister.js — the RIDDOR register: every reportable incident in one list
 * ═══════════════════════════════════════════════════════════════════════════
 * RIDDOR 2013 reg. 12: keep a record of every reportable incident for at least 3 years
 * (date and method of reporting, date/time/place, the person's details, a brief
 * description). The portal holds the incident itself; this is the register view of it,
 * printable and as Excel, for a chosen period (all records by default).
 *
 * The injured person's name is left OUT unless "include names" is ticked: the register
 * often goes to auditors and insurers. Their details stay on the incident.
 *
 *   riddorRows(incidents, { from, to, names })  → rows (pure)
 *   riddorSummary(rows)                          → counts
 *   renderRiddorHtml(rows, meta)                 → printable A4 page (landscape)
 *   riddorWorkbook(rows, meta)                   → sheets for lib/xlsxWriter.js
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { RIDDOR_CATEGORIES, riddorDue } from "../incidents/riddor";
import { isLostTime } from "./boardReport";
import { todayISO } from "../../lib/dates";
import { getBrand } from "../../lib/brandCore";
import { REPORT_CSS } from "./monthlyReport";

const TYPE_LABELS = { accident: "Accident", near_miss: "Near miss", unsafe_condition: "Unsafe condition", unsafe_act: "Unsafe act" };
const okDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : "";
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

export function riddorRows(incidents, { from = "", to = "", names = false, today = todayISO() } = {}) {
  return (incidents || []).filter(i => i && i.riddor)
    .filter(i => { const d = okDate(i.date); return (!from || (d && d >= from)) && (!to || (d && d <= to)); })
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .map(i => {
      const cat = RIDDOR_CATEGORIES.find(c => c.id === i.riddorCategory);
      const reported = !!i.riddorReported, rDate = okDate(i.riddorReportedDate), d = okDate(i.date);
      const limit = cat ? cat.days : 10;
      const daysToReport = reported && rDate && d ? Math.round((utc(rDate) - utc(d)) / 86400000) : null;
      const due = riddorDue(i, today);
      return {
        id: String(i.id), date: d, time: i.time || "", type: TYPE_LABELS[i.type] || i.type || "", category: cat ? cat.label : "Not chosen",
        location: i.location || "", injury: i.injuryType || "", description: i.description || "",
        person: names ? (i.personName || "") : "",
        daysLost: isLostTime(i) && Number(i.daysLost) > 0 ? Math.round(Number(i.daysLost)) : null,
        reported, reportedDate: rDate, reportedBy: i.riddorReportedBy || "", ref: i.hseReference || "",
        notice: !!(i.hseNotice && i.hseNotice.name),
        daysToReport, late: daysToReport !== null && limit !== null && daysToReport > limit,
        dueDate: due ? due.dueDate : "", overdue: !!due && due.state === "overdue",
        closed: !!i.closed,
      };
    });
}

export function riddorSummary(rows) {
  return { total: rows.length, reported: rows.filter(r => r.reported).length, notReported: rows.filter(r => !r.reported).length,
    overdue: rows.filter(r => r.overdue).length, late: rows.filter(r => r.late).length, noRef: rows.filter(r => r.reported && !r.ref).length };
}

const h = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = d => { if (!d) return "—"; const [y, m, dd] = String(d).slice(0, 10).split("-"); return dd ? `${dd}/${m}/${y}` : h(d); };

/** meta: { periodLabel, companyName, generated, generatedBy, logoSrc, names } */
export function renderRiddorHtml(rows, meta = {}) {
  const s = riddorSummary(rows);
  const names = !!meta.names;
  const cols = 10 + (names ? 1 : 0);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${h(String(meta.companyName || "").replace(/\s+/g, "_"))}_RIDDOR_Register</title>
<style>
${REPORT_CSS}
@page{size:A4 landscape;margin:12mm}
.wrap{max-width:1060px}
</style></head><body>
<div class="toolbar">Your browser's print window opens automatically — choose <b>&nbsp;Save as PDF&nbsp;</b> as the printer. <button onclick="window.print()">Print / Save as PDF</button></div>
<div class="wrap">
<header class="cover">
  <div><h1>RIDDOR Register</h1><div class="sub"><b>${h(meta.periodLabel || "All records")}</b> · ${h(meta.companyName || "")}</div>
  <div class="sub">Produced ${fmt(meta.generated || todayISO())}${meta.generatedBy ? ` by ${h(meta.generatedBy)}` : ""} · ${h(getBrand().product)}</div></div>
  ${meta.logoSrc ? `<img src="${h(meta.logoSrc)}" alt="">` : ""}
</header>
<p class="sub" style="margin:0 0 10px"><b>${s.total}</b> reportable incident${s.total !== 1 ? "s" : ""} · <b>${s.reported}</b> reported to the HSE${s.notReported ? ` · <b style="color:#b91c1c">${s.notReported} not yet reported${s.overdue ? ` (${s.overdue} past the deadline)` : ""}</b>` : ""}${s.late ? ` · ${s.late} reported after the deadline` : ""}</p>
<table><tr><th style="width:62px">Date</th><th>Type</th><th>RIDDOR category</th><th>Location</th>${names ? "<th>Person</th>" : ""}<th>Injury</th><th class="n">Days lost</th><th style="width:66px">Reported</th><th class="n">Days to report</th><th>HSE reference</th><th>Reported by</th></tr>
${rows.length ? rows.map(r => `<tr><td>${fmt(r.date)}${r.time ? `<br><span style="color:#64748b">${h(r.time)}</span>` : ""}</td><td>${h(r.type)}</td><td>${h(r.category)}</td><td>${h(r.location)}</td>${names ? `<td>${h(r.person)}</td>` : ""}<td>${h(r.injury)}</td><td class="n">${r.daysLost ?? "—"}</td>
<td>${r.reported ? fmt(r.reportedDate) : `<span class="pill p-red">${r.overdue ? "Overdue" : "Not yet"}</span>${r.dueDate ? `<br><span style="color:#64748b;font-size:9px">due ${fmt(r.dueDate)}</span>` : ""}`}</td>
<td class="n" style="${r.late ? "color:#b91c1c;font-weight:700" : ""}">${r.daysToReport ?? "—"}</td><td>${h(r.ref) || (r.reported ? '<span style="color:#b91c1c">not recorded</span>' : "")}${r.notice ? '<br><span style="color:#64748b;font-size:9px">HSE notice on file</span>' : ""}</td><td>${h(r.reportedBy)}</td></tr>`).join("") : `<tr><td colspan="${cols}" class="empty">No RIDDOR-reportable incidents in this period</td></tr>`}
</table>
<p class="note">Deadlines (RIDDOR 2013): deaths, specified injuries and dangerous occurrences within 10 days (notify without delay); over-7-day injuries within 15 days; members of the public taken to hospital within 10 days; occupational diseases when diagnosed. Keep these records for at least 3 years. Full details of each incident are in the portal (Incidents).</p>
<footer><span>RIDDOR Register · ${h(meta.companyName || "")}</span><span>Generated by ${h(getBrand().product)} on ${fmt(meta.generated || todayISO())}</span></footer>
</div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});</script>
</body></html>`;
}

export function riddorWorkbook(rows, meta = {}) {
  const H = { bold: true, fill: "0D1F5C", color: "FFFFFF", border: true, wrap: true, v: "center" };
  const names = !!meta.names;
  const head = ["Date", "Time", "Type", "RIDDOR category", "Location", ...(names ? ["Person"] : []), "Injury", "Description", "Days lost", "Reported to HSE", "Date reported", "Days to report", "Reported late", "HSE reference", "Reported by", "HSE notice on file", "Report due by", "Incident status"];
  const data = rows.map(r => [r.date, r.time, r.type, r.category, r.location, ...(names ? [r.person] : []), r.injury, r.description, r.daysLost ?? "",
    r.reported ? "Yes" : "No", r.reportedDate, r.daysToReport ?? "", r.late ? "Yes" : "", r.ref, r.reportedBy, r.notice ? "Yes" : "No", r.reported ? "" : r.dueDate, r.closed ? "Closed" : "Open"]);
  const last = String.fromCharCode(64 + head.length);
  return [{ name: "RIDDOR register", cols: [11, 7, 14, 30, 22, ...(names ? [20] : []), 20, 50, 9, 10, 12, 9, 9, 16, 18, 10, 12, 10],
    rows: [[{ v: `RIDDOR register: ${meta.periodLabel || "all records"}`, s: { bold: true, size: 14 } }], [`Produced ${meta.generated || todayISO()}`], [],
      head.map(v => ({ v, s: H })), ...data],
    freeze: { row: 4, col: 1 }, autoFilter: `A4:${last}${data.length + 4}` }];
}
