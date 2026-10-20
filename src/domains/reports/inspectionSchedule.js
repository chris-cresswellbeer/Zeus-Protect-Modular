/**
 * ═══════════════════════════════════════════════════════════════════════════
 * inspectionSchedule.js — were inspections done when they were due?
 * ═══════════════════════════════════════════════════════════════════════════
 * Pure (no React, no database). Used by Reports → "Inspection Schedule" and by the
 * board report's leading indicators.
 *
 * WHAT COUNTS AS "PLANNED"
 * The portal has no separate calendar: every inspection saved with a "next due" date
 * is a plan for the next one. So each due date is one planned inspection, and it was
 *   on time  – the next inspection of the same type at the same place (inspectionDue.js
 *              inspKey) is dated on or before the due date
 *   late     – the next one is dated after it (daysLate says by how much)
 *   missed   – there's no later one and the due date has passed (still overdue today)
 *   upcoming – no later one yet, and it isn't due yet (left out of the percentages)
 * The first ever inspection of a kind isn't "planned" by anything, so it only shows in
 * the "done" counts.
 *
 * Racking uses the same idea: each racking check is due again `checkEveryDays` after
 * the last one (Racking settings), and each expert inspection carries its own next-due
 * date (lib/racking.js).
 *
 * buildScheduleReport(data, { year, month, months })  → figures for the months ending
 *   with that month (default 12): per type per month, overall %, what is overdue now,
 *   how old the open findings are, and open racking damage.
 * renderScheduleReportHtml(report, { logoSrc })  → printable A4 page
 * scheduleWorkbook(report)                        → sheets for lib/xlsxWriter.js
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { inspKey } from "../inspections/inspectionDue";
import { inspTypeLabel } from "../../lib/inspTemplates";
import { collectOpenActions } from "../../lib/openActions";
import { DEFAULT_RACKING_SETTINGS, damageState, bayName } from "../../lib/racking";
import { todayISO } from "../../lib/dates";
import { getBrand, brandCompany } from "../../lib/brandCore";
import { REPORT_CSS } from "./monthlyReport";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = n => String(n).padStart(2, "0");
const okDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : "";
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const days = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);   // b − a, whole days
const plusDays = (d, n) => new Date(utc(d) + n * 86400000).toISOString().slice(0, 10);
const shift = (y, m, k) => { const d = new Date(y, m + k, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
const pctOf = (a, b) => b ? Math.round(a / b * 100) : null;

/** State of one planned (due) inspection, given the date of the next one done (or ""). */
function stateOf(due, doneDate, today) {
  if (doneDate) return doneDate <= due ? { state: "onTime", daysLate: 0 } : { state: "late", daysLate: days(due, doneDate) };
  return due < today ? { state: "missed", daysLate: days(due, today) } : { state: "upcoming", daysLate: 0 };
}

/**
 * Every planned (due) date, from site inspections and racking.
 * → [{ source: "inspection"|"racking"|"expert", type, typeLabel, location, from (the record
 *      that set the due date), due, doneDate, state, daysLate }]
 * and done: [{ source, type, typeLabel, date }]  (every inspection actually carried out)
 */
function scheduleEvents({ inspections = [], rackingChecks = [], rackingSettings = DEFAULT_RACKING_SETTINGS, today = todayISO() } = {}) {
  const events = [], done = [];
  const groups = new Map();
  inspections.forEach(i => { if (!okDate(i.date)) return; const k = inspKey(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  groups.forEach(list => {
    list.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
    list.forEach((r, n) => {
      const typeLabel = inspTypeLabel(r);
      done.push({ source: "inspection", type: r.type, typeLabel, date: okDate(r.date) });
      const due = okDate(r.nextDue);
      if (!due) return;
      const next = list.slice(n + 1).find(x => okDate(x.date) > okDate(r.date) || (okDate(x.date) === okDate(r.date) && x !== r));
      const doneDate = next ? okDate(next.date) : "";
      events.push({ source: "inspection", type: r.type, typeLabel, location: String(r.location || "").trim(), from: okDate(r.date), due, doneDate, ...stateOf(due, doneDate, today) });
    });
  });
  const every = Math.max(1, Number((rackingSettings || {}).checkEveryDays) || DEFAULT_RACKING_SETTINGS.checkEveryDays);
  const byKind = kind => rackingChecks.filter(c => c && c.kind === kind && okDate((c.data || {}).date))
    .sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)));
  const weekly = byKind("weekly");
  weekly.forEach((c, n) => {
    const date = okDate(c.data.date);
    done.push({ source: "racking", type: "racking_check", typeLabel: "Racking check", date });
    const due = plusDays(date, every);
    const next = weekly.slice(n + 1).find(x => okDate(x.data.date) > date);
    const doneDate = next ? okDate(next.data.date) : "";
    events.push({ source: "racking", type: "racking_check", typeLabel: "Racking check", location: c.data.aisles || "", from: date, due, doneDate, ...stateOf(due, doneDate, today) });
  });
  const expert = byKind("expert");
  expert.forEach((c, n) => {
    const date = okDate(c.data.date);
    done.push({ source: "expert", type: "racking_expert", typeLabel: "Racking expert inspection", date });
    const due = okDate(c.data.nextDue);
    if (!due) return;
    const next = expert.slice(n + 1).find(x => okDate(x.data.date) > date);
    const doneDate = next ? okDate(next.data.date) : "";
    events.push({ source: "expert", type: "racking_expert", typeLabel: "Racking expert inspection", location: c.data.inspector || "", from: date, due, doneDate, ...stateOf(due, doneDate, today) });
  });
  return { events, done };
}

/** Planned / on time / late / missed for the events due in [from, to]. pct = on time ÷ (due so far). */
function tally(events, from, to) {
  const list = events.filter(e => e.due >= from && e.due <= to);
  const t = { planned: list.length, onTime: 0, late: 0, missed: 0, upcoming: 0 };
  list.forEach(e => { t[e.state]++; });
  t.dueSoFar = t.planned - t.upcoming;
  t.pct = pctOf(t.onTime, t.dueSoFar);
  return t;
}

const AGE_BUCKETS = [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["Over 90 days", 91, Infinity]];
const bucketOf = age => AGE_BUCKETS.findIndex(([, a, b]) => age >= a && age <= b);

/**
 * @param data { inspections, ras?, rackingChecks, rackingSettings, rackingDamage, rackingLocations, today, companyName, generatedBy }
 * @param period { year, month (0-11, the last month), months = 12 }
 */
function buildScheduleReport(data, { year, month, months = 12 }) {
  const today = data.today || todayISO();
  const { events, done } = scheduleEvents({ inspections: data.inspections || [], rackingChecks: data.rackingChecks || [], rackingSettings: data.rackingSettings, today });
  const first = shift(year, month, -(months - 1));
  const monthList = Array.from({ length: months }, (_, k) => { const p = shift(first.y, first.m, k); const key = `${p.y}-${pad(p.m + 1)}`;
    return { key, label: MONTHS[p.m].slice(0, 3) + " " + String(p.y).slice(2), from: `${key}-01`, to: `${key}-31` }; });
  const from = monthList[0].from, to = monthList[monthList.length - 1].to;

  // per type (site checklists first, then racking)
  const typeMap = new Map();
  [...events, ...done].forEach(e => { if (!typeMap.has(e.type)) typeMap.set(e.type, { type: e.type, label: e.typeLabel, source: e.source }); });
  const order = { inspection: 0, racking: 1, expert: 2 };
  const types = [...typeMap.values()].sort((a, b) => (order[a.source] - order[b.source]) || a.label.localeCompare(b.label))
    .map(t => {
      const ev = events.filter(e => e.type === t.type);
      const dn = done.filter(d => d.type === t.type);
      const cells = monthList.map(m => ({ ...tally(ev, m.from, m.to), done: dn.filter(d => d.date >= m.from && d.date <= m.to).length }));
      return { ...t, cells, total: { ...tally(ev, from, to), done: dn.filter(d => d.date >= from && d.date <= to).length } };
    })
    .filter(t => t.total.planned || t.total.done);
  const overall = tally(events, from, to);
  const monthTotals = monthList.map(m => tally(events, m.from, m.to));
  const overdueNow = events.filter(e => e.state === "missed").sort((a, b) => b.daysLate - a.daysLate)
    .map(e => ({ type: e.typeLabel, location: e.location, due: e.due, daysOverdue: e.daysLate, source: e.source }));
  const lateInPeriod = events.filter(e => e.state === "late" && e.due >= from && e.due <= to).sort((a, b) => b.daysLate - a.daysLate);

  // open inspection findings (non-conformances), by age and severity
  const open = collectOpenActions({ inspections: data.inspections || [], today }).filter(a => a.source === "Site inspection");
  const sevOf = { high: "major", medium: "minor", low: "observation" };
  const findings = open.map(a => ({ ...a, severity: sevOf[a.priority] || "minor", age: a.raisedDate && okDate(a.raisedDate) ? Math.max(0, days(okDate(a.raisedDate), today)) : null }));
  const ageing = AGE_BUCKETS.map(([label]) => ({ label, major: 0, minor: 0, observation: 0, total: 0 }));
  findings.forEach(f => { const b = bucketOf(f.age == null ? 0 : f.age); ageing[b][f.severity]++; ageing[b].total++; });
  const findingsSummary = { open: findings.length, overdue: findings.filter(f => f.daysOverdue > 0).length, noDueDate: findings.filter(f => !f.dueDate).length,
    over90: ageing[3].total, ageing, list: findings.sort((a, b) => (b.age ?? -1) - (a.age ?? -1)) };

  // open racking damage, by age and rating
  const rs = data.rackingSettings || DEFAULT_RACKING_SETTINGS;
  const locs = data.rackingLocations || [];
  const nowIso = `${today}T12:00:00.000Z`;
  const dmg = (data.rackingDamage || []).filter(r => r.status === "open").map(r => {
    const d = r.data || {}, st = damageState(r, rs, nowIso), rep = okDate(d.reportedAt || r.created_at);
    const loc = locs.find(l => l.id === r.location_id);
    return { where: loc ? bayName(loc) : r.location_id, levels: (d.levels || []).join(", "), part: d.part || "", rating: r.rating, state: st.label, late: !!st.late,
      reported: rep, age: rep ? Math.max(0, days(rep, today)) : null, repairDue: st.due || "" };
  });
  const rackAgeing = AGE_BUCKETS.map(([label]) => ({ label, red: 0, amber: 0, green: 0, total: 0 }));
  dmg.forEach(x => { const b = bucketOf(x.age == null ? 0 : x.age); if (x.rating in rackAgeing[b]) rackAgeing[b][x.rating]++; rackAgeing[b].total++; });
  const racking = data.rackingDamage ? { open: dmg.length, red: dmg.filter(x => x.rating === "red").length, amberLate: dmg.filter(x => x.late).length, ageing: rackAgeing,
    list: dmg.sort((a, b) => (b.age ?? -1) - (a.age ?? -1)), checksRecorded: (data.rackingChecks || []).length } : null;

  const r = {
    period: { year, month, months, from, to, label: `${monthList[0].label} – ${monthList[monthList.length - 1].label}` },
    generated: today, generatedBy: data.generatedBy || "", companyName: data.companyName || brandCompany(),
    months: monthList, types, overall, monthTotals, events: events.filter(e => e.due >= from && e.due <= to), overdueNow, lateInPeriod, findings: findingsSummary, racking,
  };
  r.keyPoints = keyPoints(r);
  return r;
}

function keyPoints(r) {
  const k = [], o = r.overall;
  if (o.dueSoFar) k.push(`${o.onTime} of ${o.dueSoFar} inspections due in the period were done on time (${o.pct}%); ${o.late} late and ${o.missed} not done yet.`);
  else k.push("No inspections fell due in the period.");
  const worst = r.types.filter(t => t.total.dueSoFar && t.total.pct !== null && t.total.pct < 100).sort((a, b) => a.total.pct - b.total.pct)[0];
  if (worst) k.push(`Lowest: ${worst.label}, ${worst.total.pct}% on time (${worst.total.onTime} of ${worst.total.dueSoFar}).`);
  if (r.overdueNow.length) k.push(`ATTENTION: ${r.overdueNow.length} inspection${r.overdueNow.length !== 1 ? "s are" : " is"} overdue today (longest ${r.overdueNow[0].daysOverdue} days).`);
  const f = r.findings;
  k.push(f.open ? `${f.open} inspection finding${f.open !== 1 ? "s" : ""} open; ${f.overdue} past the action date${f.over90 ? `, ${f.over90} open for over 90 days` : ""}.` : "No inspection findings are open.");
  if (r.racking && r.racking.red) k.push(`ATTENTION: ${r.racking.red} red racking damage report${r.racking.red !== 1 ? "s" : ""} open.`);
  if (r.racking && r.racking.amberLate) k.push(`${r.racking.amberLate} amber racking repair${r.racking.amberLate !== 1 ? "s are" : " is"} past the repair date.`);
  return k;
}

// ── HTML ────────────────────────────────────────────────────────────────────
const h = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = d => { if (!d) return "—"; const [y, m, dd] = String(d).slice(0, 10).split("-"); return dd ? `${dd}/${m}/${y}` : h(d); };
const band = p => p === null || p === undefined ? "#64748b" : p >= 95 ? "#047857" : p >= 80 ? "#b45309" : "#b91c1c";
const cellBg = c => !c.dueSoFar ? "" : c.onTime === c.dueSoFar ? "#dcfce7" : c.missed ? "#fee2e2" : "#fef3c7";
const SOURCE_LABEL = { inspection: "Inspection", racking: "Racking", expert: "Racking" };

function renderScheduleReportHtml(r, { logoSrc = "" } = {}) {
  const tile = (label, value, sub, color = "#0f172a") => `<div class="tile"><div class="tv" style="color:${color}">${value}</div><div class="tl">${h(label)}</div><div class="ts">${sub || ""}</div></div>`;
  const empty = (cols, text) => `<tr><td colspan="${cols}" class="empty">${h(text)}</td></tr>`;
  const o = r.overall, f = r.findings, rk = r.racking;
  const cell = c => c.planned || c.done
    ? `<td class="c" style="background:${cellBg(c)}">${c.dueSoFar ? `${c.onTime}/${c.dueSoFar}` : c.planned ? "<span style=\"color:#64748b\">due</span>" : ""}${c.done ? `<div style="font-size:8.5px;color:#64748b">${c.done} done</div>` : ""}</td>`
    : `<td class="c" style="color:#cbd5e1">·</td>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${h(r.companyName.replace(/\s+/g, "_"))}_Inspection_Schedule_${h(r.period.to.slice(0, 7))}</title>
<style>
${REPORT_CSS}
table.grid td,table.grid th{padding:3px 4px;font-size:9.5px}
</style></head><body>
<div class="toolbar">Your browser's print window opens automatically — choose <b>&nbsp;Save as PDF&nbsp;</b> as the printer. <button onclick="window.print()">Print / Save as PDF</button></div>
<div class="wrap">
<header class="cover">
  <div><h1>Inspection &amp; Audit Schedule Compliance</h1><div class="sub"><b>${h(r.period.label)}</b> · ${h(r.companyName)}</div>
  <div class="sub">Produced ${fmt(r.generated)}${r.generatedBy ? ` by ${h(r.generatedBy)}` : ""} · ${h(getBrand().product)}</div></div>
  ${logoSrc ? `<img src="${h(logoSrc)}" alt="">` : ""}
</header>
<div class="tiles">
  ${tile("Done on time", o.pct === null ? "—" : o.pct + "%", `${o.onTime} of ${o.dueSoFar} due`, band(o.pct))}
  ${tile("Done late", o.late, "after the due date", o.late ? "#b45309" : "#047857")}
  ${tile("Overdue now", r.overdueNow.length, "due and not done", r.overdueNow.length ? "#b91c1c" : "#047857")}
  ${tile("Open findings", f.open, `${f.overdue} past action date · ${f.over90} over 90 days`, f.overdue ? "#b91c1c" : "#0f172a")}
</div>
<h3>Key points</h3>
<ul class="keypoints">${r.keyPoints.map(p => `<li${/^ATTENTION/.test(p) ? ' class="attn"' : ""}>${h(p)}</li>`).join("")}</ul>
<p class="note">Each inspection's "next due" date counts as one planned inspection. On time = the next one of the same type at the same place was done by that date. Open findings and racking damage are as at ${fmt(r.generated)}.</p>

<h2>1. Planned vs done, by month</h2>
<table class="grid"><tr><th>Type</th>${r.months.map(m => `<th class="c">${h(m.label)}</th>`).join("")}<th class="n">On time</th></tr>
${r.types.length ? r.types.map(t => `<tr><td>${h(t.label)}${t.source !== "inspection" ? ` <span style="color:#64748b">(${SOURCE_LABEL[t.source]})</span>` : ""}</td>${t.cells.map(cell).join("")}<td class="n" style="color:${band(t.total.pct)};font-weight:700">${t.total.pct === null ? "—" : t.total.pct + "%"}</td></tr>`).join("") : empty(r.months.length + 2, "No inspections recorded")}
<tr><td><b>All</b></td>${r.monthTotals.map(c => `<td class="c" style="background:${cellBg(c)}"><b>${c.dueSoFar ? `${c.onTime}/${c.dueSoFar}` : ""}</b></td>`).join("")}<td class="n" style="color:${band(o.pct)};font-weight:700">${o.pct === null ? "—" : o.pct + "%"}</td></tr>
</table>
<p class="note">Each cell: done on time / due that month (green all on time, amber some late, red some not done). "done" = inspections carried out that month.</p>

<h2>2. Overdue today</h2>
<table><tr><th>Type</th><th>Location</th><th style="width:70px">Was due</th><th class="n" style="width:80px">Days overdue</th></tr>
${r.overdueNow.length ? r.overdueNow.map(x => `<tr><td>${h(x.type)}</td><td>${h(x.location)}</td><td>${fmt(x.due)}</td><td class="n" style="color:#b91c1c;font-weight:700">${x.daysOverdue}</td></tr>`).join("") : empty(4, "Nothing overdue")}
</table>
${r.lateInPeriod.length ? `<h3>Done late in the period${r.lateInPeriod.length > 15 ? " — 15 latest" : ""}</h3>
<table><tr><th>Type</th><th>Location</th><th style="width:70px">Due</th><th style="width:70px">Done</th><th class="n" style="width:70px">Days late</th></tr>
${r.lateInPeriod.slice(0, 15).map(x => `<tr><td>${h(x.typeLabel)}</td><td>${h(x.location)}</td><td>${fmt(x.due)}</td><td>${fmt(x.doneDate)}</td><td class="n">${x.daysLate}</td></tr>`).join("")}</table>` : ""}

<h2>3. Open inspection findings — how old they are</h2>
<div class="cols"><div>
<table><tr><th>Open for</th><th class="n">Major</th><th class="n">Minor</th><th class="n">Obs.</th><th class="n">Total</th></tr>
${f.ageing.map(a => `<tr><td>${h(a.label)}</td><td class="n">${a.major || "—"}</td><td class="n">${a.minor || "—"}</td><td class="n">${a.observation || "—"}</td><td class="n"><b>${a.total}</b></td></tr>`).join("")}
</table></div><div>
${tile("Past the action date", f.overdue, `${f.noDueDate} with no action date`, f.overdue ? "#b91c1c" : "#047857")}
</div></div>
<h3>Oldest open findings${f.list.length > 20 ? " — 20 oldest" : ""}</h3>
<table><tr><th>Finding</th><th style="width:150px">Inspection</th><th style="width:90px">Owner</th><th style="width:62px">Action due</th><th class="n" style="width:50px">Age (days)</th></tr>
${f.list.length ? f.list.slice(0, 20).map(x => `<tr><td>${h(x.title.length > 140 ? x.title.slice(0, 140) + "…" : x.title)}</td><td>${h(x.ref).replace(/^(\d{4}-\d{2}-\d{2})/, d => fmt(d))}</td><td>${h(x.owner)}</td><td style="${x.daysOverdue > 0 ? "color:#b91c1c;font-weight:700" : ""}">${fmt(x.dueDate)}</td><td class="n">${x.age ?? "—"}</td></tr>`).join("") : empty(5, "No open findings")}
</table>

${rk ? `<h2>4. Open racking damage</h2>
<div class="cols"><div>
<table><tr><th>Open for</th><th class="n">Red</th><th class="n">Amber</th><th class="n">Green</th><th class="n">Total</th></tr>
${rk.ageing.map(a => `<tr><td>${h(a.label)}</td><td class="n" style="${a.red ? "color:#b91c1c;font-weight:700" : ""}">${a.red || "—"}</td><td class="n">${a.amber || "—"}</td><td class="n">${a.green || "—"}</td><td class="n"><b>${a.total}</b></td></tr>`).join("")}
</table></div><div>
${tile("Amber past repair date", rk.amberLate, "SEMA: repair amber damage within 4 weeks", rk.amberLate ? "#b91c1c" : "#047857")}
</div></div>
${rk.list.length ? `<table><tr><th>Bay</th><th>Level</th><th>Part</th><th>Status</th><th style="width:62px">Reported</th><th class="n" style="width:50px">Age (days)</th></tr>
${rk.list.slice(0, 20).map(x => `<tr><td>${h(x.where)}</td><td>${h(x.levels)}</td><td>${h(x.part)}</td><td style="${x.rating === "red" || x.late ? "color:#b91c1c;font-weight:700" : ""}">${h(x.state)}</td><td>${fmt(x.reported)}</td><td class="n">${x.age ?? "—"}</td></tr>`).join("")}</table>` : `<p class="note">No open racking damage.</p>`}
${rk.checksRecorded ? "" : `<p class="note">No racking checks have been recorded yet (Equipment → Racking → Record racking check), so racking isn't in the schedule above.</p>`}` : ""}

<footer><span>Inspection &amp; Audit Schedule Compliance · ${h(r.companyName)}</span><span>Generated by ${h(getBrand().product)} on ${fmt(r.generated)}</span></footer>
</div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});</script>
</body></html>`;
}

/** Excel sheets (lib/xlsxWriter.js buildXlsx): the month grid, every due date, open findings. */
function scheduleWorkbook(r) {
  const H = { bold: true, fill: "0D1F5C", color: "FFFFFF", border: true, wrap: true, v: "center" };
  const b = { border: true };
  const title = (t, n) => [{ v: t, s: { bold: true, size: 14 } }, ...Array(Math.max(0, n - 1)).fill("")];
  const grid = {
    name: "By month", cols: [34, ...r.months.map(() => 9), 10],
    rows: [title(`Inspection schedule: ${r.period.label}`, 2), [`On time / due that month. Produced ${r.generated}.`], [],
      [{ v: "Type", s: H }, ...r.months.map(m => ({ v: m.label, s: { ...H, h: "center" } })), { v: "On time %", s: { ...H, h: "center" } }],
      ...r.types.map(t => [{ v: t.label, s: b }, ...t.cells.map(c => ({ v: c.dueSoFar ? `${c.onTime}/${c.dueSoFar}` : c.planned ? "due" : "", s: { ...b, h: "center", ...(c.dueSoFar ? { fill: c.onTime === c.dueSoFar ? "DCFCE7" : c.missed ? "FEE2E2" : "FEF3C7" } : {}) } })),
        { v: t.total.pct === null ? "" : t.total.pct / 100, s: { ...b, numFmt: "0%", h: "center" } }]),
      [{ v: "All", s: { ...b, bold: true } }, ...r.monthTotals.map(c => ({ v: c.dueSoFar ? `${c.onTime}/${c.dueSoFar}` : "", s: { ...b, bold: true, h: "center" } })), { v: r.overall.pct === null ? "" : r.overall.pct / 100, s: { ...b, bold: true, numFmt: "0%", h: "center" } }]],
    freeze: { row: 4, col: 1 },
  };
  const STATE = { onTime: "On time", late: "Late", missed: "Overdue (not done)", upcoming: "Not due yet" };
  const evs = [...r.events].sort((a, c) => a.due.localeCompare(c.due));
  const due = { name: "Due dates", cols: [32, 26, 12, 12, 18, 10],
    rows: [[{ v: "Type", s: H }, { v: "Location", s: H }, { v: "Due", s: H }, { v: "Done", s: H }, { v: "Result", s: H }, { v: "Days late", s: H }],
      ...evs.map(e => [e.typeLabel, e.location, e.due, e.doneDate || "", STATE[e.state], e.daysLate || ""])],
    freeze: { row: 1, col: 0 }, autoFilter: `A1:F${evs.length + 1}` };
  const fl = r.findings.list;
  const findings = { name: "Open findings", cols: [50, 30, 20, 12, 12, 10, 10],
    rows: [[{ v: "Finding", s: H }, { v: "Inspection", s: H }, { v: "Owner", s: H }, { v: "Severity", s: H }, { v: "Action due", s: H }, { v: "Age (days)", s: H }, { v: "Days past due", s: H }],
      ...fl.map(x => [x.title, x.ref, x.owner, x.severity, x.dueDate || "", x.age ?? "", x.daysOverdue > 0 ? x.daysOverdue : ""])],
    freeze: { row: 1, col: 0 }, autoFilter: `A1:G${fl.length + 1}` };
  return [grid, due, findings];
}

export { scheduleEvents, tally, buildScheduleReport, renderScheduleReportHtml, scheduleWorkbook, AGE_BUCKETS };
