/**
 * ═══════════════════════════════════════════════════════════════════════════
 * boardReport.js — quarterly / annual H&S performance report for the board
 * ═══════════════════════════════════════════════════════════════════════════
 * buildBoardReport(data, { kind: "quarter"|"year", fy, q })  → all the figures (pure)
 * renderBoardReportHtml(report, { logoSrc })                 → print-ready A4 page
 *
 * Summary figures only, no names (it goes to the board).
 *
 * LAGGING INDICATORS
 *   Accidents           incidents of type "accident"
 *   Lost-time injury    an incident marked "time off work: yes" (Incidents → the incident →
 *                       Time off work), or a RIDDOR over-7-day injury
 *   Days lost           the working days lost recorded on those incidents
 *   RIDDOR              incidents marked RIDDOR-reportable
 *   Rates per 100,000 hours worked (hours from lib/hsPerformance.js, entered monthly):
 *     AFR    RIDDOR-reportable × 100,000 ÷ hours  (the HSE's accident frequency rate)
 *     LTIFR  lost-time injuries × 100,000 ÷ hours
 *     All-accident rate  accidents × 100,000 ÷ hours
 *   A rate is only given when every month of the period (so far) has hours entered:
 *   otherwise it would compare a part-period's hours with the whole period's accidents.
 *
 * LEADING INDICATORS
 *   Near misses and hazard reports (unsafe condition / unsafe act); near misses per accident
 *   Inspections done on time ÷ due (inspectionSchedule.js, includes racking)
 *   Corrective actions closed on time: actions finished in the period by their due date
 *     (investigation actions and inspection findings; findings closed before October 2026
 *     have no completion date and can't be counted)
 *   Training compliance: today's figure, and the history kept by lib/hsPerformance.js
 *
 * PERIODS: the reporting year starts in the month set with the hours (yearStart, January
 * by default). Q1 is its first three months. `fy` is the calendar year the reporting year
 * starts in. A period that hasn't finished is counted up to today ("so far").
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { isActionDone, actionDoneDate } from "../../lib/actionStatus";
import { todayISO } from "../../lib/dates";
import { getBrand, brandCompany } from "../../lib/brandCore";
import { scheduleEvents, tally } from "./inspectionSchedule";
import { REPORT_CSS } from "./monthlyReport";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = n => String(n).padStart(2, "0");
const okDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : "";
const pctOf = (a, b) => b ? Math.round(a / b * 100) : null;
const rate = (n, hours) => hours ? Math.round(n * 100000 / hours * 100) / 100 : null;

export const fyLabel = (fy, ys) => ys ? `${fy}/${String(fy + 1).slice(2)}` : String(fy);
/** The reporting year a date (y, m) falls in. */
export const fyOf = (y, m, ys) => (m >= ys ? y : y - 1);
/** The 12 months of a reporting year: [{ y, m, key }] */
export function fyMonths(fy, ys) {
  return Array.from({ length: 12 }, (_, k) => { const d = new Date(fy, ys + k, 1); return { y: d.getFullYear(), m: d.getMonth(), key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }; });
}
/** A period: { kind, fy, q, months, label, range, from, to } */
export function periodOf(kind, fy, q, ys) {
  const all = fyMonths(fy, ys);
  const months = kind === "quarter" ? all.slice((q - 1) * 3, q * 3) : all;
  const a = months[0], b = months[months.length - 1];
  const range = `${MONTHS[a.m].slice(0, 3)}${a.y !== b.y ? ` ${a.y}` : ""} – ${MONTHS[b.m].slice(0, 3)} ${b.y}`;
  return { kind, fy, q: kind === "quarter" ? q : null, months, range,
    label: kind === "quarter" ? `Q${q} ${fyLabel(fy, ys)}` : `${ys ? "Year " : ""}${fyLabel(fy, ys)}`,
    from: `${a.key}-01`, to: `${b.key}-31` };
}
export const prevQuarter = (fy, q) => (q > 1 ? { fy, q: q - 1 } : { fy: fy - 1, q: 4 });

/** Is this incident a lost-time injury? */
export const isLostTime = i => !!i && (i.lostTime === true || (!!i.riddor && i.riddorCategory === "over7"));
export const daysLostOf = i => (isLostTime(i) && Number(i.daysLost) > 0 ? Math.round(Number(i.daysLost)) : 0);

/** Corrective actions finished between from and to: { closed, onTime } */
function actionsClosed({ incidents, investigations, inspections }, from, to) {
  let closed = 0, onTime = 0;
  const add = (done, due) => { if (!done || done < from || done > to) return; closed++; if (!due || done <= due) onTime++; };
  (incidents || []).forEach(inc => ((investigations || {})[inc.id]?.actions || []).forEach(a => { if (isActionDone(a)) add(okDate(actionDoneDate(a)), okDate(a.dueDate)); }));
  (inspections || []).forEach(ins => (ins.nonConformances || []).forEach(nc => {
    if (String(nc.actionStatus || "").toLowerCase() === "complete") add(okDate(nc.completedDate || nc.actionCompletedDate), okDate(nc.actionDue || nc.dueDate));
  }));
  return { closed, onTime, pct: pctOf(onTime, closed) };
}

/** All the figures for one period (counted up to today if it hasn't finished). */
function measure(p, ctx) {
  const { today, hours, incidents, events } = ctx;
  const thisMonth = today.slice(0, 7);
  const elapsed = p.months.filter(m => m.key <= thisMonth);
  const partial = elapsed.length < p.months.length;
  if (!elapsed.length) return { future: true, partial: true, months: 0 };
  const from = p.from, to = partial ? today : p.to;
  const inc = incidents.filter(i => { const d = okDate(i.date); return d && d >= from && d <= to; });
  const acc = inc.filter(i => i.type === "accident");
  const lti = inc.filter(isLostTime);
  const riddor = inc.filter(i => i.riddor);
  const nearMisses = inc.filter(i => i.type === "near_miss").length;
  const hazards = inc.filter(i => i.type === "unsafe_condition" || i.type === "unsafe_act").length;
  const hoursMissing = elapsed.filter(m => !hours[m.key]).map(m => m.key);
  const hrs = elapsed.reduce((s, m) => s + (hours[m.key] || 0), 0);
  const ok = !hoursMissing.length && hrs > 0;
  const insp = tally(events, from, to);
  return {
    partial, months: elapsed.length, from, to,
    incidents: inc.length, accidents: acc.length, lti: lti.length, daysLost: lti.reduce((s, i) => s + daysLostOf(i), 0),
    ltiNoDays: lti.filter(i => !(Number(i.daysLost) > 0)).length,
    riddor: riddor.length, nearMisses, hazards, nearMissPerAccident: acc.length ? Math.round(nearMisses / acc.length * 10) / 10 : null,
    hours: hrs, hoursMissing, afr: ok ? rate(riddor.length, hrs) : null, ltifr: ok ? rate(lti.length, hrs) : null, allAfr: ok ? rate(acc.length, hrs) : null,
    inspections: insp, actions: actionsClosed(ctx, from, to),
  };
}

/**
 * @param data { incidents, investigations, inspections, rackingChecks, rackingSettings, hours: {yearStart, hours},
 *               trainingNow: { pct, fullyCompliant, withTraining }, snapshots: { months }, today, companyName, generatedBy }
 * @param sel  { kind: "quarter"|"year", fy, q }
 */
function buildBoardReport(data, sel) {
  const today = data.today || todayISO();
  const ys = (data.hours && data.hours.yearStart) || 0;
  const hours = (data.hours && data.hours.hours) || {};
  const { events } = scheduleEvents({ inspections: data.inspections || [], rackingChecks: data.rackingChecks || [], rackingSettings: data.rackingSettings, today });
  const ctx = { today, hours, events, incidents: data.incidents || [], investigations: data.investigations || {}, inspections: data.inspections || [] };
  const { kind, fy } = sel;
  const q = kind === "quarter" ? sel.q : null;
  const period = periodOf(kind, fy, q, ys);
  const prevP = kind === "quarter" ? (() => { const pq = prevQuarter(fy, q); return periodOf("quarter", pq.fy, pq.q, ys); })() : periodOf("year", fy - 1, null, ys);
  const lastYearP = periodOf(kind, fy - 1, q, ys);
  const current = measure(period, ctx), previous = measure(prevP, ctx), lastYear = measure(lastYearP, ctx);

  // Year on year by quarter: this reporting year vs the one before
  const yoy = [1, 2, 3, 4].map(n => {
    const a = periodOf("quarter", fy, n, ys), b = periodOf("quarter", fy - 1, n, ys);
    return { q: n, range: a.range, rangeLast: b.range, now: measure(a, ctx), last: measure(b, ctx) };
  });

  // Training compliance: today, and the snapshot at the end of each quarter (where one was kept)
  const snaps = (data.snapshots && data.snapshots.months) || {};
  const snapAt = p => { const keys = p.months.map(m => m.key).filter(k => k <= today.slice(0, 7)).reverse(); for (const k of keys) if (snaps[k]) return { pct: snaps[k].pct, month: k }; return null; };
  const tnow = data.trainingNow || {};
  const training = { now: tnow.pct ?? null, fullyCompliant: tnow.fullyCompliant ?? null, withTraining: tnow.withTraining ?? null,
    byQuarter: yoy.map(y => ({ q: y.q, now: snapAt(periodOf("quarter", fy, y.q, ys)), last: snapAt(periodOf("quarter", fy - 1, y.q, ys)) })),
    atEnd: current.partial ? (tnow.pct ?? null) : (snapAt(period) || {}).pct ?? null };

  const inP = i => { const d = okDate(i.date); return d && d >= current.from && d <= current.to; };
  const ltiList = ctx.incidents.filter(i => inP(i) && isLostTime(i)).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(i => ({ date: okDate(i.date), location: i.location || "", injury: i.injuryType || "", daysLost: Number(i.daysLost) > 0 ? Math.round(Number(i.daysLost)) : null, riddor: !!i.riddor, over7: i.riddorCategory === "over7" }));
  const hoursTable = fyMonths(fy, ys).map(m => ({ key: m.key, label: `${MONTHS[m.m].slice(0, 3)} ${m.y}`, hours: hours[m.key] || null, future: m.key > today.slice(0, 7) }));

  const r = {
    period: { ...period, yearStart: ys, fyLabel: fyLabel(fy, ys), prevLabel: prevP.label, lastYearLabel: lastYearP.label, partial: current.partial },
    generated: today, generatedBy: data.generatedBy || "", companyName: data.companyName || brandCompany(),
    current, previous, lastYear, yoy, training, ltiList, hoursTable,
    labels: { now: fyLabel(fy, ys), last: fyLabel(fy - 1, ys) },
  };
  r.keyPoints = keyPoints(r);
  return r;
}

function keyPoints(r) {
  const k = [], c = r.current, l = r.lastYear, P = r.period;
  if (c.future) return ["This period hasn't started yet."];
  const vs = (a, b, what) => b === null || b === undefined || l.future ? "" : a === b ? ` (the same as ${what})` : ` (${b} in ${what})`;
  k.push(`${c.accidents} accident${c.accidents !== 1 ? "s" : ""} in ${P.label}${P.partial ? " so far" : ""}${vs(c.accidents, l.accidents, r.period.lastYearLabel)}, ${c.lti} of them lost-time injur${c.lti !== 1 ? "ies" : "y"} with ${c.daysLost} working day${c.daysLost !== 1 ? "s" : ""} lost.`);
  if (c.ltiNoDays) k.push(`ATTENTION: ${c.ltiNoDays} lost-time injur${c.ltiNoDays !== 1 ? "ies have" : "y has"} no days lost recorded yet.`);
  if (c.riddor) k.push(`${c.riddor} RIDDOR-reportable incident${c.riddor !== 1 ? "s" : ""}.`);
  if (c.afr !== null) k.push(`Accident frequency rate (RIDDOR per 100,000 hours): ${c.afr}${l.afr !== null && !l.future ? ` (${l.afr} in ${r.period.lastYearLabel})` : ""}. Lost-time injury rate: ${c.ltifr}.`);
  else if (c.hoursMissing.length) k.push(`ATTENTION: hours worked are missing for ${c.hoursMissing.length} month${c.hoursMissing.length !== 1 ? "s" : ""}, so the frequency rates can't be worked out. Add them in Reports → H&S Performance.`);
  k.push(`${c.nearMisses} near miss${c.nearMisses !== 1 ? "es" : ""} and ${c.hazards} hazard report${c.hazards !== 1 ? "s" : ""}${c.nearMissPerAccident !== null ? ` (${c.nearMissPerAccident} near misses per accident)` : ""}.`);
  if (c.inspections.dueSoFar) k.push(`${c.inspections.pct}% of inspections due were done on time (${c.inspections.onTime} of ${c.inspections.dueSoFar}).`);
  if (c.actions.closed) k.push(`${c.actions.pct}% of corrective actions closed in the period were closed by their due date (${c.actions.onTime} of ${c.actions.closed}).`);
  if (r.training.now !== null) k.push(`Training compliance today: ${r.training.now}%.`);
  return k;
}

// ── HTML ────────────────────────────────────────────────────────────────────
const h = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = d => { if (!d) return "—"; const [y, m, dd] = String(d).slice(0, 10).split("-"); return dd ? `${dd}/${m}/${y}` : h(d); };
const num = v => (v === null || v === undefined ? "—" : typeof v === "number" ? v.toLocaleString("en-GB") : h(v));
const pc = v => (v === null || v === undefined ? "—" : `${v}%`);
const band = p => p === null || p === undefined ? "#64748b" : p >= 95 ? "#047857" : p >= 80 ? "#b45309" : "#b91c1c";

/** Grouped bars: accidents and lost-time injuries per quarter, this year vs last. */
function yoyBars(yoy, labels) {
  const W = 680, H = 190, L = 30, B = 34, T = 14;
  const vals = yoy.flatMap(y => [y.now.accidents || 0, y.last.accidents || 0]);
  const max = Math.max(1, ...vals), step = Math.ceil(max / 4) || 1, top = step * 4;
  const gw = (W - L - 10) / 4, bw = gw * 0.3;
  const y = v => T + (H - T - B) * (1 - v / top);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Accidents per quarter, this year and last">`;
  for (let v = 0; v <= top; v += step) s += `<line x1="${L}" x2="${W - 5}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/><text x="${L - 6}" y="${y(v) + 3}" font-size="9" text-anchor="end" fill="#64748b">${v}</text>`;
  yoy.forEach((q, i) => {
    const x0 = L + i * gw + gw * 0.18;
    [[q.last, "#94a3b8", 0], [q.now, "#1d4ed8", bw + 4]].forEach(([m, col, dx]) => {
      if (m.future) return;
      const v = m.accidents || 0, x = x0 + dx;
      s += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${y(0) - y(v)}" fill="${col}"/><text x="${x + bw / 2}" y="${y(v) - 3}" font-size="9" font-weight="700" text-anchor="middle" fill="#0f172a">${v}</text>`;
      if (m.lti) s += `<text x="${x + bw / 2}" y="${y(0) - 4}" font-size="8" font-weight="700" text-anchor="middle" fill="#fff">${m.lti} LTI</text>`;
    });
    s += `<text x="${x0 + bw + 2}" y="${H - B + 14}" font-size="10" font-weight="700" text-anchor="middle" fill="#0f172a">Q${q.q}</text><text x="${x0 + bw + 2}" y="${H - B + 26}" font-size="8.5" text-anchor="middle" fill="#64748b">${h(q.range)}</text>`;
  });
  return s + `</svg><div class="legend"><span><i style="background:#1d4ed8"></i>${h(labels.now)}</span><span><i style="background:#94a3b8"></i>${h(labels.last)}</span><span>LTI = lost-time injuries</span></div>`;
}

function renderBoardReportHtml(r, { logoSrc = "" } = {}) {
  const c = r.current, p = r.previous, l = r.lastYear;
  const tile = (label, value, sub, color = "#0f172a") => `<div class="tile"><div class="tv" style="color:${color}">${value}</div><div class="tl">${h(label)}</div><div class="ts">${sub || ""}</div></div>`;
  const col = m => (m.future ? `<td class="n" style="color:#94a3b8">—</td>` : null);
  const row = (label, get, show = num, goodDown = true) => {
    const v = m => (m.future ? null : get(m));
    const now = v(c), was = v(l);
    let delta = "";
    if (goodDown !== null && now !== null && was !== null && typeof now === "number" && typeof was === "number" && now !== was) {
      const good = goodDown ? now < was : now > was;
      delta = ` <span class="delta ${good ? "good" : "bad"}">${now > was ? "▲" : "▼"}</span>`;
    }
    return `<tr><td>${h(label)}</td><td class="n"><b>${show(now)}</b>${delta}</td>${col(p) || `<td class="n">${show(v(p))}</td>`}${col(l) || `<td class="n">${show(was)}</td>`}</tr>`;
  };
  const head = `<tr><th>Measure</th><th class="n">${h(r.period.label)}${r.period.partial ? " (so far)" : ""}</th><th class="n">${h(r.period.prevLabel)}</th><th class="n">${h(r.period.lastYearLabel)}</th></tr>`;
  const rateNote = c.hoursMissing.length ? `<p class="note" style="color:#b91c1c;font-style:normal;font-weight:700">Hours worked are missing for ${c.hoursMissing.map(k => { const [y, m] = k.split("-"); return `${MONTHS[+m - 1].slice(0, 3)} ${y}`; }).join(", ")}: the frequency rates are left blank until they're entered.</p>` : "";
  const yv = (m, f, show = num) => (m.future ? "—" : show(f(m)));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${h(r.companyName.replace(/\s+/g, "_"))}_HS_Performance_${h(r.period.label.replace(/[\s/]+/g, "_"))}</title>
<style>
${REPORT_CSS}
</style></head><body>
<div class="toolbar">Your browser's print window opens automatically — choose <b>&nbsp;Save as PDF&nbsp;</b> as the printer. <button onclick="window.print()">Print / Save as PDF</button></div>
<div class="wrap">
<header class="cover">
  <div><h1>Health &amp; Safety Performance</h1><div class="sub"><b>${h(r.period.label)}</b> (${h(r.period.range)}${r.period.partial ? ", so far" : ""}) · ${h(r.companyName)}</div>
  <div class="sub">Produced ${fmt(r.generated)}${r.generatedBy ? ` by ${h(r.generatedBy)}` : ""} · ${h(getBrand().product)}</div></div>
  ${logoSrc ? `<img src="${h(logoSrc)}" alt="">` : ""}
</header>
<div class="tiles">
  ${tile("Accidents", c.accidents, `${l.future ? "" : `${l.accidents} in ${h(r.period.lastYearLabel)}`}`)}
  ${tile("Lost-time injuries", c.lti, `${c.daysLost} working day${c.daysLost !== 1 ? "s" : ""} lost`, c.lti ? "#b91c1c" : "#047857")}
  ${tile("RIDDOR", c.riddor, "reportable to the HSE", c.riddor ? "#b91c1c" : "#047857")}
  ${tile("AFR", c.afr === null ? "—" : c.afr, "RIDDOR per 100,000 hours")}
  ${tile("Near misses", c.nearMisses, `${c.hazards} hazard report${c.hazards !== 1 ? "s" : ""}`)}
  ${tile("Inspections on time", pc(c.inspections.pct), `${c.inspections.onTime} of ${c.inspections.dueSoFar} due`, band(c.inspections.pct))}
  ${tile("Actions closed on time", pc(c.actions.pct), `${c.actions.onTime} of ${c.actions.closed} closed`, band(c.actions.pct))}
  ${tile("Training compliance", pc(r.training.atEnd), r.period.partial ? "today" : r.training.atEnd === null ? "not recorded for then" : "at the end of the period", band(r.training.atEnd))}
</div>
<h3>Key points</h3>
<ul class="keypoints">${r.keyPoints.map(k => `<li${/^ATTENTION/.test(k) ? ' class="attn"' : ""}>${h(k)}</li>`).join("")}</ul>

<h2>1. Lagging indicators (outcomes)</h2>
<table>${head}
${row("Accidents", m => m.accidents)}
${row("Lost-time injuries", m => m.lti)}
${row("Working days lost", m => m.daysLost)}
${row("RIDDOR-reportable incidents", m => m.riddor)}
${row("Hours worked", m => (m.hoursMissing.length ? null : m.hours), num, null)}
${row("AFR: RIDDOR per 100,000 hours", m => m.afr)}
${row("LTIFR: lost-time injuries per 100,000 hours", m => m.ltifr)}
${row("All accidents per 100,000 hours", m => m.allAfr)}
</table>
${rateNote}
<p class="note">▲▼ compare with the same period a year earlier (green = better). Lost-time injury = time off work after the day of the accident, or a RIDDOR over-7-day injury.</p>

<h2>2. Leading indicators (prevention)</h2>
<table>${head}
${row("Near misses reported", m => m.nearMisses, num, false)}
${row("Hazard reports (unsafe conditions and acts)", m => m.hazards, num, false)}
${row("Near misses per accident", m => m.nearMissPerAccident, num, false)}
${row("Inspections due", m => m.inspections.dueSoFar, num, null)}
${row("Inspections done on time", m => m.inspections.pct, pc, false)}
${row("Corrective actions closed", m => m.actions.closed, num, null)}
${row("Closed by their due date", m => m.actions.pct, pc, false)}
</table>
<p class="note">More near-miss and hazard reports is good: people are reporting before someone is hurt. Inspections include racking checks. Training compliance history is kept from the first time the report was used.</p>

<h2>3. Year on year, by quarter</h2>
<div class="keep">${yoyBars(r.yoy, r.labels)}</div>
<table><tr><th rowspan="2">Quarter</th><th class="c" colspan="2">Accidents</th><th class="c" colspan="2">Lost-time inj.</th><th class="c" colspan="2">Days lost</th><th class="c" colspan="2">RIDDOR</th><th class="c" colspan="2">LTIFR</th><th class="c" colspan="2">Near misses</th><th class="c" colspan="2">Training</th></tr>
<tr>${Array(7).fill(`<th class="n">${h(r.labels.now)}</th><th class="n">${h(r.labels.last)}</th>`).join("")}</tr>
${r.yoy.map((q, i) => `<tr><td><b>Q${q.q}</b> <span style="color:#64748b">${h(q.range)}</span></td>
<td class="n"><b>${yv(q.now, m => m.accidents)}</b></td><td class="n">${yv(q.last, m => m.accidents)}</td>
<td class="n"><b>${yv(q.now, m => m.lti)}</b></td><td class="n">${yv(q.last, m => m.lti)}</td>
<td class="n"><b>${yv(q.now, m => m.daysLost)}</b></td><td class="n">${yv(q.last, m => m.daysLost)}</td>
<td class="n"><b>${yv(q.now, m => m.riddor)}</b></td><td class="n">${yv(q.last, m => m.riddor)}</td>
<td class="n"><b>${yv(q.now, m => m.ltifr)}</b></td><td class="n">${yv(q.last, m => m.ltifr)}</td>
<td class="n"><b>${yv(q.now, m => m.nearMisses)}</b></td><td class="n">${yv(q.last, m => m.nearMisses)}</td>
<td class="n"><b>${pc((r.training.byQuarter[i].now || {}).pct)}</b></td><td class="n">${pc((r.training.byQuarter[i].last || {}).pct)}</td></tr>`).join("")}
</table>

<h2>4. Lost-time injuries in ${h(r.period.label)}</h2>
<table><tr><th style="width:62px">Date</th><th>Location</th><th>Injury</th><th class="n">Days lost</th><th class="c">RIDDOR</th></tr>
${r.ltiList.length ? r.ltiList.map(x => `<tr><td>${fmt(x.date)}</td><td>${h(x.location)}</td><td>${h(x.injury)}</td><td class="n">${x.daysLost === null ? '<span class="pill p-amber">not recorded</span>' : x.daysLost}</td><td class="c">${x.riddor ? `<span class="pill p-red">${x.over7 ? "Over 7 days" : "Yes"}</span>` : "—"}</td></tr>`).join("") : `<tr><td colspan="5" class="empty">No lost-time injuries</td></tr>`}
</table>

<h2>5. Hours worked, ${h(r.labels.now)}</h2>
<table><tr>${r.hoursTable.map(m => `<th class="n">${h(m.label.split(" ")[0])}</th>`).join("")}</tr>
<tr>${r.hoursTable.map(m => `<td class="n">${m.future ? "" : m.hours === null ? '<span style="color:#b91c1c">missing</span>' : num(m.hours)}</td>`).join("")}</tr></table>
<p class="note">Hours worked come from payroll and are entered monthly in the portal. AFR (accident frequency rate, as used by the HSE) = RIDDOR-reportable incidents × 100,000 ÷ hours worked. LTIFR = lost-time injuries × 100,000 ÷ hours worked.</p>

<footer><span>Health &amp; Safety Performance · ${h(r.period.label)} · ${h(r.companyName)}</span><span>Generated by ${h(getBrand().product)} on ${fmt(r.generated)}</span></footer>
</div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});</script>
</body></html>`;
}

export { buildBoardReport, renderBoardReportHtml, measure };
