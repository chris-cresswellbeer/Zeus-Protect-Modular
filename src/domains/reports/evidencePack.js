/**
 * ═══════════════════════════════════════════════════════════════════════════
 * evidencePack.js — H&S audit evidence pack (Reports → Evidence Pack)
 * ═══════════════════════════════════════════════════════════════════════════
 * One document for people outside the company: customer supplier audits, insurers,
 * BRCGS / ISO auditors, CHAS / SafeContractor applications. It covers any date range,
 * is laid out under ISO 45001-style headings, and holds NO personal data: no staff,
 * contractor or injured person's names, no injury details, no incident descriptions.
 *
 *   buildEvidencePack(data, { from, to, ... })  → all the figures (pure, testable)
 *   renderEvidencePackHtml(pack)                → a print-ready A4 HTML document
 *   (opened with openMonthlyReport from monthlyReport.js)
 *
 * PERIOD vs "AS AT": things that happen (incidents, drills, inspections, tests, permits,
 * visits, actions closed, training completed) are counted within the period. Status
 * (training compliance, review dates, certificates in date, open actions) is "as at"
 * the day the pack is produced: the portal keeps current status, not its history.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { inspectionPct } from "../inspections/inspectionScore";
import { isActionDone, actionDoneDate } from "../../lib/actionStatus";
import { buildTrainingMatrix } from "../training/trainingMatrix";
import { collectOpenActions } from "../../lib/openActions";
import { INSP_TYPES } from "../../data/seedInspections";
import { fireSummary } from "../fireSafety/fireLogic";
import { firstAidSummary } from "../firstAid/firstAidLogic";
import { machineState } from "../../data/seedMachinery";
import { INDUCTION_ITEMS } from "../../data/seedContractors";
import { todayISO } from "../../lib/dates";
import { getBrand, brandCompany } from "../../lib/brandCore";

const TYPE_LABELS = { accident: "Accident", near_miss: "Near miss", unsafe_condition: "Unsafe condition", unsafe_act: "Unsafe act" };
const PERMIT_LABELS = { hot_works: "Hot works", confined_space: "Confined space", height: "Work at height", electrical: "Electrical", excavation: "Excavation", general: "General" };
const pct = (a, b) => (b ? Math.round(a / b * 100) : null);
const d10 = v => String(v || "").slice(0, 10);
const addDays = (iso, n) => { const t = new Date(`${iso}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const avg = list => (list.length ? Math.round(list.reduce((s, v) => s + v, 0) / list.length) : null);
const count = (list, f) => list.filter(f).length;
const vals = o => (o && typeof o === "object" ? Object.values(o) : []);

/**
 * @param data { incidents, investigations, inspections, ras, staff, modules, assigns, comps, docs,
 *   docAssignments, docAcknowledgements, dseReports, extCerts, machineComps, machineTypes,
 *   fireSafety, firstAidData, coshhAssessments, customChemicals, equipment, permits,
 *   contractors, contractorInductions, contractorCerts, contractorVisits, siteSignins,
 *   zones, shifts, companyName, today }
 * @param opts { from, to, preparedBy, preparedFor, includeIncidentList }
 */
export function buildEvidencePack(data, { from, to, preparedBy = "", preparedFor = "", includeIncidentList = true } = {}) {
  const today = data.today || todayISO();
  const inP = d => { const s = d10(d); return !!s && s >= from && s <= to; };
  const incidents = data.incidents || [], inspections = data.inspections || [], ras = data.ras || [];
  const staff = (data.staff || []).filter(u => u && !u.leaver);

  // ── 5 Leadership: policy and documents ──
  const docs = data.docs || [];
  const docAssign = data.docAssignments || {}, acks = data.docAcknowledgements || {};
  const staffIds = new Set(staff.map(u => String(u.id)));
  let toRead = 0, read = 0;
  const docRows = docs.map(d => {
    const who = (docAssign[d.id] || []).filter(id => staffIds.has(String(id)));
    const r = who.filter(id => (acks[id] || {})[d.id]).length;
    toRead += who.length; read += r;
    const rev = d10(d.reviewDate);
    return { title: d.title || d.name || "Document", version: d.version || "", review: rev, reviewState: !rev ? "none" : rev < today ? "overdue" : "ok", assigned: who.length, readPct: pct(r, who.length) };
  }).sort((a, b) => a.title.localeCompare(b.title));
  const documents = { total: docs.length, reviewOk: count(docRows, r => r.reviewState === "ok"), reviewOverdue: count(docRows, r => r.reviewState === "overdue"),
    reviewNone: count(docRows, r => r.reviewState === "none"), assignedDocs: count(docRows, r => r.assigned), readPct: pct(read, toRead), toRead, read, rows: docRows };

  // ── 6.1 Planning: risk assessments and COSHH ──
  const raRows = ras.map(ra => {
    const hz = ra.hazards || [];
    const resid = h => { const r = h.residualRisk || h.initialRisk || {}; return (Number(r.likelihood) || 0) * (Number(r.severity) || 0); };
    const further = hz.filter(h => String(h.furtherControls || "").trim());
    const rev = d10(ra.reviewDate);
    return { title: ra.title || "Risk assessment", location: ra.location || "", date: d10(ra.date), review: rev, reviewState: !rev ? "none" : rev < today ? "overdue" : "ok",
      hazards: hz.length, high: hz.filter(h => resid(h) >= 10).length, actions: further.length, actionsDone: further.filter(h => h.actionComplete).length };
  }).sort((a, b) => a.title.localeCompare(b.title));
  const riskAssessments = { total: ras.length, reviewOk: count(raRows, r => r.reviewState === "ok"), reviewOverdue: count(raRows, r => r.reviewState === "overdue"),
    reviewNone: count(raRows, r => r.reviewState === "none"), inPeriod: count(raRows, r => inP(r.date)), hazards: raRows.reduce((s, r) => s + r.hazards, 0),
    high: raRows.reduce((s, r) => s + r.high, 0), actions: raRows.reduce((s, r) => s + r.actions, 0), actionsDone: raRows.reduce((s, r) => s + r.actionsDone, 0), rows: raRows };
  const chems = (data.customChemicals || []).filter(Boolean);
  const assess = data.coshhAssessments || {};
  const assessed = Object.entries(assess).filter(([, a]) => a && (a.assessmentDate || a.nextReviewDate || a.riskRating));
  const coshh = { substances: chems.length, assessed: assessed.length,
    notAssessed: count(chems, c => !assess[c.code] || !(assess[c.code].assessmentDate || assess[c.code].nextReviewDate)),
    reviewOk: count(assessed, ([, a]) => d10(a.nextReviewDate) >= today), reviewOverdue: count(assessed, ([, a]) => a.nextReviewDate && d10(a.nextReviewDate) < today),
    high: count(assessed, ([, a]) => a.riskRating === "high"), medium: count(assessed, ([, a]) => a.riskRating === "medium"), low: count(assessed, ([, a]) => a.riskRating === "low") };

  // ── 7.2 Competence ──
  const matrix = buildTrainingMatrix({ staff: data.staff, modules: data.modules, assigns: data.assigns || {}, comps: data.comps || {} });
  const completions = vals(data.comps).reduce((s, uc) => s + vals(uc).filter(c => c && inP(c.date)).length, 0);
  const moduleRows = matrix.cols.map((m, ci) => ({ title: m.title, ...matrix.colStats[ci] })).filter(m => m.assigned).sort((a, b) => a.title.localeCompare(b.title));
  const fa = firstAidSummary({ firstAidData: data.firstAidData, extCerts: data.extCerts || {}, staff, zones: data.zones || [], shifts: data.shifts || [] });
  const fire = fireSummary({ fireSafety: data.fireSafety || {}, extCerts: data.extCerts || {}, staff, inspections, today });
  const types = data.machineTypes || [];
  const mRecs = Object.entries(data.machineComps || {}).filter(([uid]) => staffIds.has(String(uid))).flatMap(([, m]) => vals(m)).filter(Boolean);
  const mKey = c => (machineState(c, types) || {}).key;
  const machinery = { operators: Object.keys(data.machineComps || {}).filter(uid => staffIds.has(String(uid)) && vals(data.machineComps[uid]).length).length,
    records: mRecs.length, competent: count(mRecs, c => mKey(c) === "competent"), expiring: count(mRecs, c => mKey(c) === "expiring"),
    expired: count(mRecs, c => mKey(c) === "expired"), provisional: count(mRecs, c => mKey(c) === "provisional"), assessedInPeriod: count(mRecs, c => inP(c.assessmentDate)) };
  const dse = data.dseReports || {};
  const dseStaff = staff.filter(u => (dse[u.id] || []).length);
  const competence = { training: { ...matrix.totals, completions, moduleRows },
    firstAid: { inDate: fa.inDate.length, expired: fa.expired.length, gaps: fa.gaps, minPerShift: fa.minPerShift, zones: fa.allZones.length, shifts: fa.shiftList.length },
    wardens: { total: fire.wardens.length, inDate: count(fire.wardens, w => w.state.key === "valid" || w.state.key === "expiring"), expired: fire.expiredWardens.length },
    machinery,
    dse: { staff: staff.length, assessed: dseStaff.length, inPeriod: vals(dse).reduce((s, list) => s + (list || []).filter(r => r && inP(r.date)).length, 0),
      openIssues: dseStaff.reduce((s, u) => { const l = dse[u.id]; return s + ((l[l.length - 1] || {}).issueCount || 0); }, 0) } };

  // ── 8.1 Operational control: permits, equipment, contractors ──
  const permitsP = (data.permits || []).filter(p => inP(p.startDateTime) || inP(p.createdAt));
  const permitTypes = {};
  permitsP.forEach(p => { const t = PERMIT_LABELS[p.type] || p.type || "Other"; permitTypes[t] = (permitTypes[t] || 0) + 1; });
  const eq = (data.equipment || []).filter(e => e && e.status !== "retired");
  const due30 = addDays(today, 30);
  const allChecks = eq.flatMap(e => e.inspections || []).filter(i => inP(i.date));
  const allDefects = (data.equipment || []).flatMap(e => e.defects || []);
  const equipment = { assets: eq.length, outOfService: count(eq, e => e.status === "inactive"),
    serviceOverdue: count(eq, e => e.nextService && d10(e.nextService) < today), serviceDue30: count(eq, e => e.nextService && d10(e.nextService) >= today && d10(e.nextService) <= due30),
    serviceNoDate: count(eq, e => !e.nextService), servicedInPeriod: eq.reduce((s, e) => s + (e.serviceHistory || []).filter(h => inP(h.date)).length, 0),
    checks: allChecks.length, checksFailed: count(allChecks, i => i.result === "fail" || i.result === "flag"),
    defectsRaised: count(allDefects, d => inP(d.date)), defectsResolved: count(allDefects, d => inP(d.date) && d.status === "resolved"), defectsOpen: count(allDefects, d => d.status !== "resolved") };
  const cons = (data.contractors || []).filter(Boolean);
  const visitsHand = cons.reduce((s, c) => s + ((data.contractorVisits || {})[c.id] || []).filter(v => inP(v.date) && d10(v.date) <= today).length, 0);
  const visitsQr = (data.siteSignins || []).filter(s => s && s.data && inP(s.data.date)).length;
  const workers = cons.flatMap(c => (c.workers || []).map(w => ({ c, w })));
  const inducted = count(workers, ({ c, w }) => { const ind = (data.contractorInductions || {})[`${c.id}_${w.id}`] || {}; return INDUCTION_ITEMS.every(i => ind[i.id] && ind[i.id].done); });
  const certExpired = count(workers, ({ c, w }) => vals((data.contractorCerts || {})[`${c.id}_${w.id}`]).some(x => x && x.expiryDate && x.expiryDate < today));
  const contractors = { companies: count(cons, c => c.status === "active"), banned: count(cons, c => c.status === "banned"), workers: workers.length, inducted, inductedPct: pct(inducted, workers.length),
    certExpired, visits: visitsHand + visitsQr, visitsQr };
  const operations = { permits: { total: permitsP.length, closed: count(permitsP, p => p.status === "closed"), active: count(permitsP, p => p.status === "active"),
    byType: Object.entries(permitTypes).sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ type, n })) }, equipment, contractors };

  // ── 8.2 Emergency preparedness ──
  const fs = data.fireSafety || {};
  const drills = fire.drills.filter(d => inP(d.date)).map(r => ({ date: r.date, evac: (r.drill && r.drill.evacuTime) || "", headcount: r.drill ? (r.drill.headcountOk === false ? "Issues" : r.drill.headcountOk ? "OK" : "") : "",
    source: r.drill ? "Drill log" : "Inspection", issues: !!(r.drill && String(r.drill.issues || "").trim()) }));
  const alarm = (fs.alarmTests || []).filter(t => inP(t.date));
  const light = (fs.emergLighting || []).filter(t => inP(t.date));
  const kits = ((data.firstAidData || {}).kits || []);
  const emergency = { drills, lastDrill: fire.lastDrill ? fire.lastDrill.date : "", drillOverdue: fire.drillOverdue,
    alarmTests: alarm.length, alarmFaults: count(alarm, t => t.result === "fault"), weeks: Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / (7 * 86400000)) + 1),
    lightingMonthly: count(light, t => t.testType !== "annual"), lightingAnnual: count(light, t => t.testType === "annual"), lightingFaults: count(light, t => t.result && t.result !== "pass"),
    extinguishers: fire.extinguishers.length, extOverdue: fire.overdueExtinguishers.length,
    fraLast: fire.fras[0] ? fire.fras[0].date : "", fraNext: fire.fraNext, fraOverdue: fire.fraOverdue,
    kits: kits.length, kitsChecked: count(kits, k => k.lastCheckDate && d10(k.lastCheckDate) >= addDays(today, -31)) };

  // ── 10.2 Incidents ──
  const inc = incidents.filter(i => inP(i.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const byType = Object.keys(TYPE_LABELS).map(t => ({ type: TYPE_LABELS[t], n: count(inc, i => i.type === t) }));
  const months = [];
  for (let y = +from.slice(0, 4), m = +from.slice(5, 7); `${y}-${String(m).padStart(2, "0")}` <= to.slice(0, 7); m === 12 ? (y++, m = 1) : m++) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    months.push({ key: k, label: `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${String(y).slice(2)}`, n: count(inc, i => d10(i.date).slice(0, 7) === k), riddor: count(inc, i => i.riddor && d10(i.date).slice(0, 7) === k) });
    if (months.length > 60) break;
  }
  const riddorList = inc.filter(i => i.riddor);
  const daysTo = i => (i.riddorReported && i.riddorReportedDate && i.date ? Math.round((Date.parse(d10(i.riddorReportedDate)) - Date.parse(d10(i.date))) / 86400000) : null);
  const investigated = count(inc, i => (data.investigations || {})[i.id]);
  const incidentsOut = { total: inc.length, byType, months, accidents: count(inc, i => i.type === "accident"), nearMisses: count(inc, i => i.type === "near_miss"),
    riddor: riddorList.length, riddorReported: count(riddorList, i => i.riddorReported), riddorLate: count(riddorList, i => { const d = daysTo(i); return d !== null && d > 15; }),
    investigated, investigatedPct: pct(investigated, inc.length), closed: count(inc, i => i.closed),
    list: includeIncidentList ? inc.map(i => ({ date: d10(i.date), type: TYPE_LABELS[i.type] || i.type || "", location: i.location || "", riddor: !!i.riddor, investigated: !!(data.investigations || {})[i.id], closed: !!i.closed })) : null };

  // ── 9.1 Monitoring: inspections ──
  const insP = inspections.filter(i => inP(i.date));
  const tLabel = i => (INSP_TYPES.find(x => x.id === i.type) || {}).label || i.typeLabel || i.type || "Inspection";
  const byInsp = {};
  insP.forEach(i => { const k = tLabel(i); const r = (byInsp[k] = byInsp[k] || { type: k, n: 0, scores: [], last: "" }); r.n++; const p = inspectionPct(i); if (p !== null) r.scores.push(p); if (d10(i.date) > r.last) r.last = d10(i.date); });
  const ncs = insP.flatMap(i => i.nonConformances || []);
  const monitoring = { inspections: insP.length, avg: avg(insP.map(inspectionPct).filter(v => v !== null)),
    byType: Object.values(byInsp).map(r => ({ type: r.type, n: r.n, avg: avg(r.scores), last: r.last })).sort((a, b) => b.n - a.n),
    ncMajor: count(ncs, n => n.severity === "major"), ncMinor: count(ncs, n => n.severity === "minor"), ncObs: count(ncs, n => n.severity === "observation"),
    ncClosed: count(ncs, n => ["complete", "completed", "closed", "done"].includes(String(n.actionStatus || "").toLowerCase())) };

  // ── 10.3 Improvement: corrective actions ──
  const open = collectOpenActions({ incidents, investigations: data.investigations || {}, inspections, ras, today });
  let closedInP = 0;
  vals(data.investigations).forEach(inv => (inv.actions || []).forEach(a => { if (isActionDone(a) && inP(actionDoneDate(a))) closedInP++; }));
  inspections.forEach(ins => (ins.nonConformances || []).forEach(nc => { if (inP(nc.completedDate || nc.actionCompletedDate)) closedInP++; }));
  const bySource = {};
  open.forEach(a => { const s = (bySource[a.source] = bySource[a.source] || { open: 0, overdue: 0 }); s.open++; if (a.daysOverdue > 0) s.overdue++; });
  const improvement = { closed: closedInP, open: open.length, overdue: count(open, a => a.daysOverdue > 0), bySource: Object.entries(bySource).map(([source, v]) => ({ source, ...v })) };

  const pack = {
    period: { from, to }, generated: today, preparedBy, preparedFor, companyName: data.companyName || brandCompany(),
    staffCount: staff.length, documents, riskAssessments, coshh, competence, operations, emergency, incidents: incidentsOut, monitoring, improvement,
  };
  pack.highlights = highlights(pack);
  return pack;
}

function highlights(p) {
  const out = [];
  const t = p.competence.training;
  if (t.pct !== null) out.push(`Training compliance ${t.pct}% (${t.fullyCompliant} of ${t.withTraining} staff with assigned training fully compliant).`);
  out.push(`${p.incidents.total} incident${p.incidents.total !== 1 ? "s" : ""} recorded in the period, including ${p.incidents.nearMisses} near miss${p.incidents.nearMisses !== 1 ? "es" : ""}; ${p.incidents.riddor} RIDDOR-reportable.`);
  out.push(`${p.monitoring.inspections} site inspection${p.monitoring.inspections !== 1 ? "s" : ""}${p.monitoring.avg !== null ? `, average score ${p.monitoring.avg}%` : ""}.`);
  out.push(`${p.emergency.drills.length} fire drill${p.emergency.drills.length !== 1 ? "s" : ""} and ${p.emergency.alarmTests} fire alarm test${p.emergency.alarmTests !== 1 ? "s" : ""} recorded.`);
  out.push(`${p.riskAssessments.total} risk assessment${p.riskAssessments.total !== 1 ? "s" : ""} (${p.riskAssessments.reviewOk} in date for review) and ${p.coshh.assessed} COSHH assessment${p.coshh.assessed !== 1 ? "s" : ""}.`);
  out.push(`${p.improvement.closed} corrective action${p.improvement.closed !== 1 ? "s" : ""} closed in the period; ${p.improvement.open} open, ${p.improvement.overdue} overdue.`);
  return out;
}

// ── HTML ────────────────────────────────────────────────────────────────────
const h = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = d => { if (!d) return "—"; const [y, m, dd] = String(d).slice(0, 10).split("-"); return dd ? `${dd}/${m}/${y}` : h(d); };
const P = (v, suffix = "%") => (v === null || v === undefined ? "—" : `${v}${suffix}`);
const good = (ok, warn = false) => (ok ? "#047857" : warn ? "#b45309" : "#b91c1c");

function monthBars(months) {
  if (!months.length) return "";
  const W = 680, H = 170, L = 26, B = 30, T = 12;
  const max = Math.max(1, ...months.map(m => m.n)), step = Math.ceil(max / 4) || 1, top = step * 4;
  const bw = (W - L - 8) / months.length, y = v => T + (H - T - B) * (1 - v / top);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Incidents per month">`;
  for (let v = 0; v <= top; v += step) s += `<line x1="${L}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/><text x="${L - 5}" y="${y(v) + 3}" font-size="9" text-anchor="end" fill="#64748b">${v}</text>`;
  const every = Math.ceil(months.length / 18);
  months.forEach((m, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64;
    if (m.n) s += `<rect x="${x}" y="${y(m.n)}" width="${w}" height="${y(0) - y(m.n)}" fill="#1d4ed8" opacity=".85"/><text x="${x + w / 2}" y="${y(m.n) - 3}" font-size="9" font-weight="700" text-anchor="middle" fill="#0f172a">${m.n}</text>`;
    if (m.riddor) s += `<text x="${x + w / 2}" y="${H - 3}" font-size="8" font-weight="700" text-anchor="middle" fill="#b91c1c">R${m.riddor > 1 ? "×" + m.riddor : ""}</text>`;
    if (i % every === 0) s += `<text x="${x + w / 2}" y="${H - B + 13}" font-size="9" text-anchor="middle" fill="#64748b">${h(m.label)}</text>`;
  });
  return s + "</svg>";
}

export function renderEvidencePackHtml(p, { logoSrc = "" } = {}) {
  const tile = (label, value, sub, color = "#0f172a") => `<div class="tile"><div class="tv" style="color:${color}">${value}</div><div class="tl">${h(label)}</div><div class="ts">${sub || ""}</div></div>`;
  const kv = rows => `<table class="kv">${rows.map(([k, v, c]) => `<tr><td>${h(k)}</td><td class="n"${c ? ` style="color:${c};font-weight:700"` : ""}>${v}</td></tr>`).join("")}</table>`;
  const empty = (cols, text) => `<tr><td colspan="${cols}" class="empty">${h(text)}</td></tr>`;
  const per = `${fmt(p.period.from)} – ${fmt(p.period.to)}`;
  const c = p.competence, o = p.operations, e = p.emergency, i = p.incidents, m = p.monitoring, im = p.improvement, d = p.documents, r = p.riskAssessments, co = p.coshh;
  const t = c.training;
  const state = s => (s === "ok" ? '<span class="pill p-green">In date</span>' : s === "overdue" ? '<span class="pill p-red">Overdue</span>' : '<span class="pill p-grey">No date</span>');

  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><title>${h(p.companyName.replace(/\s+/g, "_"))}_HS_Evidence_Pack_${p.period.from}_to_${p.period.to}</title>
<style>
@page{size:A4;margin:14mm 13mm 16mm}
*{box-sizing:border-box}
body{font-family:"Segoe UI",Arial,sans-serif;color:#0f172a;font-size:11.5px;line-height:1.45;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{max-width:780px;margin:0 auto;padding:24px 16px}
.toolbar{position:sticky;top:0;background:#0f172a;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;font-size:13px;z-index:5}
.toolbar button{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px}
header.cover{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0d1f5c;padding-bottom:12px;margin-bottom:14px;gap:16px}
header.cover img{height:40px}
h1{font-size:22px;margin:0 0 2px;color:#0d1f5c}
.sub{color:#475569;font-size:12px}
h2{font-size:15px;color:#0d1f5c;border-bottom:2px solid #e2e8f0;padding-bottom:5px;margin:22px 0 8px;break-after:avoid}
h2 small{font-weight:400;font-size:10.5px;color:#64748b}
h3{font-size:11.5px;margin:12px 0 5px;color:#334155;text-transform:uppercase;letter-spacing:.4px;break-after:avoid}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.tile{border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;background:#f8fafc;break-inside:avoid}
.tv{font-size:21px;font-weight:800;line-height:1.1}.tl{font-size:10.5px;font-weight:700;color:#334155;margin-top:3px}.ts{font-size:9.5px;color:#64748b;margin-top:2px}
.hl{background:#eff6ff;border-left:4px solid #1d4ed8;border-radius:6px;padding:9px 14px 9px 28px;margin:0 0 6px}.hl li{margin:2px 0}
table{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:8px}
th{background:#0d1f5c;color:#fff;text-align:left;padding:5px 6px;font-weight:700}
td{border-bottom:1px solid #e2e8f0;padding:4px 6px;vertical-align:top}
tr{break-inside:avoid}
td.n,th.n{text-align:right}td.c,th.c{text-align:center}
td.empty{color:#64748b;font-style:italic;text-align:center;padding:9px}
table.kv td:first-child{color:#334155}table.kv td{padding:4px 6px}
.pill{display:inline-block;padding:1px 7px;border-radius:99px;font-size:9.5px;font-weight:700}
.p-red{background:#fee2e2;color:#991b1b}.p-green{background:#dcfce7;color:#166534}.p-amber{background:#fef3c7;color:#92400e}.p-grey{background:#f1f5f9;color:#475569}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;break-inside:avoid}
.keep{break-inside:avoid}
.note{font-size:9.5px;color:#64748b;font-style:italic;margin:2px 0 8px}
.clause{font-size:9.5px;color:#64748b;font-weight:600;margin:-4px 0 8px;break-after:avoid;page-break-after:avoid}
h2{page-break-after:avoid}.cols,table.kv,.tiles{break-inside:avoid}
.privacy{border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:10px;color:#475569;margin-top:14px}
footer{margin-top:22px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:9.5px;color:#64748b;display:flex;justify-content:space-between;gap:12px}
@media print{.toolbar{display:none}.wrap{padding:0;max-width:none}}
</style></head><body>
<div class="toolbar">Your browser's print window opens automatically — choose <b>&nbsp;Save as PDF&nbsp;</b> as the printer. <button onclick="window.print()">Print / Save as PDF</button></div>
<div class="wrap">
<header class="cover">
  <div><h1>Health &amp; Safety Evidence Pack</h1>
  <div class="sub"><b>${h(p.companyName)}</b> · ${per}</div>
  ${p.preparedFor ? `<div class="sub">Prepared for: <b>${h(p.preparedFor)}</b></div>` : ""}
  <div class="sub">Produced ${fmt(p.generated)}${p.preparedBy ? ` by ${h(p.preparedBy)}` : ""} · ${h(getBrand().product)}</div></div>
  ${logoSrc ? `<img src="${h(logoSrc)}" alt="">` : ""}
</header>

<div class="tiles">
  ${tile("Training compliance", P(t.pct), `${t.fullyCompliant} of ${t.withTraining} staff fully compliant`, t.pct === null ? "#64748b" : good(t.pct >= 95, t.pct >= 80))}
  ${tile("Incidents", i.total, `${i.nearMisses} near misses · ${i.riddor} RIDDOR`)}
  ${tile("Inspections", m.inspections, m.avg !== null ? `average score ${m.avg}%` : "")}
  ${tile("Fire drills", e.drills.length, e.lastDrill ? `last ${fmt(e.lastDrill)}` : "none recorded", e.drills.length ? "#0f172a" : "#b91c1c")}
  ${tile("Risk assessments", r.total, `${r.reviewOk} in date for review`, r.reviewOverdue ? "#b45309" : "#0f172a")}
  ${tile("COSHH assessments", co.assessed, `${co.substances} substances on the register`)}
  ${tile("Actions closed", im.closed, `${im.open} open · ${im.overdue} overdue`, im.overdue ? "#b45309" : "#047857")}
  ${tile("Staff", p.staffCount, "current, excluding leavers")}
</div>
<h3>Summary</h3>
<ul class="hl">${p.highlights.map(x => `<li>${h(x)}</li>`).join("")}</ul>
<p class="note">Activity (incidents, drills, tests, inspections, permits, visits, training completed, actions closed) is for ${per}. Status (compliance, review dates, certificates, open actions) is as at ${fmt(p.generated)}.</p>

<h2>1. Leadership and policy</h2><div class="clause">ISO 45001 clause 5 · documented policies and communication to workers</div>
<div class="cols"><div>${kv([["H&S documents held", d.total], ["In date for review", d.reviewOk, d.reviewOk === d.total ? "#047857" : ""], ["Review overdue", d.reviewOverdue, d.reviewOverdue ? "#b91c1c" : ""], ["No review date set", d.reviewNone]])}</div>
<div>${kv([["Documents issued to staff to read", d.assignedDocs], ["Read and confirmed by staff", P(d.readPct), d.readPct === null ? "" : good(d.readPct >= 95, d.readPct >= 80)], ["Confirmations", `${d.read} of ${d.toRead}`]])}</div></div>
<table><tr><th>Document</th><th style="width:60px">Version</th><th style="width:78px">Next review</th><th class="c" style="width:70px">Review</th><th class="n" style="width:62px">Read</th></tr>
${d.rows.length ? d.rows.slice(0, 40).map(x => `<tr><td>${h(x.title)}</td><td>${h(x.version)}</td><td>${fmt(x.review)}</td><td class="c">${state(x.reviewState)}</td><td class="n">${x.assigned ? P(x.readPct) : "—"}</td></tr>`).join("") : empty(5, "No documents")}
</table>${d.rows.length > 40 ? `<p class="note">First 40 of ${d.rows.length} documents.</p>` : ""}

<h2>2. Hazard identification and risk assessment</h2><div class="clause">ISO 45001 clause 6.1 · risk assessments, COSHH</div>
<div class="cols"><div><h3>Risk assessments</h3>${kv([["Risk assessments", r.total], ["In date for review", r.reviewOk], ["Review overdue", r.reviewOverdue, r.reviewOverdue ? "#b91c1c" : ""], ["Carried out or reviewed in the period", r.inPeriod], ["Hazards assessed", r.hazards], ["Hazards still high after controls", r.high, r.high ? "#b45309" : ""], ["Further controls completed", `${r.actionsDone} of ${r.actions}`]])}</div>
<div><h3>COSHH</h3>${kv([["Substances on the register", co.substances], ["COSHH assessments", co.assessed], ["Substances without an assessment", co.notAssessed, co.notAssessed ? "#b45309" : ""], ["In date for review", co.reviewOk], ["Review overdue", co.reviewOverdue, co.reviewOverdue ? "#b91c1c" : ""], ["Rated high / medium / low", `${co.high} / ${co.medium} / ${co.low}`]])}</div></div>
<table><tr><th>Risk assessment</th><th>Location</th><th style="width:70px">Assessed</th><th style="width:76px">Next review</th><th class="c" style="width:66px">Review</th><th class="n" style="width:56px">Hazards</th></tr>
${r.rows.length ? r.rows.slice(0, 40).map(x => `<tr><td>${h(x.title)}</td><td>${h(x.location)}</td><td>${fmt(x.date)}</td><td>${fmt(x.review)}</td><td class="c">${state(x.reviewState)}</td><td class="n">${x.hazards}</td></tr>`).join("") : empty(6, "No risk assessments")}
</table>

<h2>3. Competence and training</h2><div class="clause">ISO 45001 clause 7.2 · training, first aid, fire wardens, plant operators, DSE</div>
<div class="tiles">
  ${tile("Overall compliance", P(t.pct), "assigned training complete and in date", t.pct === null ? "#64748b" : good(t.pct >= 95, t.pct >= 80))}
  ${tile("Completed in period", t.completions, "training modules passed")}
  ${tile("Expired", t.expired, `${t.expiring} more due soon`, t.expired ? "#b91c1c" : "#047857")}
  ${tile("Not yet completed", t.missing, "assigned, not done")}
</div>
<div class="cols"><div>${kv([["First aiders in date", c.firstAid.inDate], ["First aid certificates expired", c.firstAid.expired, c.firstAid.expired ? "#b91c1c" : ""], [`Zone and shift gaps (min. ${c.firstAid.minPerShift} per shift)`, c.firstAid.gaps, c.firstAid.gaps ? "#b45309" : "#047857"], ["Fire wardens in date", `${c.wardens.inDate} of ${c.wardens.total}`]])}</div>
<div>${kv([["Plant operators (e.g. forklift)", c.machinery.operators], ["Competences in date", c.machinery.competent + c.machinery.expiring], ["Renewal required", c.machinery.expired, c.machinery.expired ? "#b91c1c" : ""], ["Assessed in the period", c.machinery.assessedInPeriod], ["Staff with a DSE assessment", `${c.dse.assessed} of ${c.dse.staff}`], ["DSE assessments in the period", c.dse.inPeriod]])}</div></div>
<h3>Training by module</h3>
<table><tr><th>Module</th><th class="n" style="width:80px">Staff assigned</th><th class="n" style="width:80px">Compliance</th></tr>
${t.moduleRows.length ? t.moduleRows.map(x => `<tr><td>${h(x.title)}</td><td class="n">${x.assigned}</td><td class="n" style="color:${good(x.pct >= 95, x.pct >= 80)};font-weight:700">${x.pct}%</td></tr>`).join("") : empty(3, "No training assigned")}
</table>

<h2>4. Operational control</h2><div class="clause">ISO 45001 clause 8.1 · permits to work, work equipment, contractors</div>
<div class="cols"><div><h3>Permits to work</h3>${kv([["Permits issued in the period", o.permits.total], ["Closed", o.permits.closed], ["Still active", o.permits.active]])}
${o.permits.byType.length ? `<table><tr><th>Type</th><th class="n">Permits</th></tr>${o.permits.byType.map(x => `<tr><td>${h(x.type)}</td><td class="n">${x.n}</td></tr>`).join("")}</table>` : ""}</div>
<div><h3>Work equipment</h3>${kv([["Assets on the register", o.equipment.assets], ["Servicing overdue", o.equipment.serviceOverdue, o.equipment.serviceOverdue ? "#b91c1c" : "#047857"], ["Service due in the next 30 days", o.equipment.serviceDue30], ["Services recorded in the period", o.equipment.servicedInPeriod], ["Pre-use / periodic checks recorded", o.equipment.checks], ["Checks flagged or failed", o.equipment.checksFailed], ["Defects reported / resolved (period)", `${o.equipment.defectsRaised} / ${o.equipment.defectsResolved}`], ["Out of service now", o.equipment.outOfService]])}</div></div>
<h3>Contractors</h3>
${kv([["Approved (active) contractor companies", o.contractors.companies], ["Workers on the register", o.contractors.workers], ["Workers with a complete site induction", `${o.contractors.inducted} (${P(o.contractors.inductedPct)})`], ["Workers with an expired certificate", o.contractors.certExpired, o.contractors.certExpired ? "#b91c1c" : ""], ["Contractor visits in the period", `${o.contractors.visits}${o.contractors.visitsQr ? ` (${o.contractors.visitsQr} signed in at reception by QR code, with a safety checklist)` : ""}`], ["Companies barred", o.contractors.banned]])}

<h2>5. Emergency preparedness</h2><div class="clause">ISO 45001 clause 8.2 · fire safety and first aid</div>
<div class="cols"><div>${kv([["Fire drills in the period", e.drills.length, e.drills.length ? "" : "#b91c1c"], ["Fire alarm tests", `${e.alarmTests} (${e.weeks} weeks in period)`], ["Alarm faults found", e.alarmFaults], ["Emergency lighting tests (monthly / annual)", `${e.lightingMonthly} / ${e.lightingAnnual}`], ["Lighting faults found", e.lightingFaults]])}</div>
<div>${kv([["Fire risk assessment last reviewed", fmt(e.fraLast)], ["Next FRA review due", fmt(e.fraNext), e.fraOverdue ? "#b91c1c" : ""], ["Extinguishers", e.extinguishers], ["Extinguisher service overdue", e.extOverdue, e.extOverdue ? "#b91c1c" : "#047857"], ["First aid kits checked in the last month", `${e.kitsChecked} of ${e.kits}`]])}</div></div>
<h3>Fire drills</h3>
<table><tr><th style="width:80px">Date</th><th>Evacuation time</th><th>Roll call</th><th>Issues noted</th><th>Recorded as</th></tr>
${e.drills.length ? e.drills.map(x => `<tr><td>${fmt(x.date)}</td><td>${h(x.evac || "—")}</td><td>${h(x.headcount || "—")}</td><td>${x.issues ? "Yes" : "None"}</td><td>${h(x.source)}</td></tr>`).join("") : empty(5, "No fire drills recorded in the period")}
</table>

<h2>6. Incidents and investigation</h2><div class="clause">ISO 45001 clause 10.2 · incidents, RIDDOR, investigation</div>
<div class="tiles">
  ${tile("Incidents", i.total, `${i.accidents} accidents`)}
  ${tile("Near misses", i.nearMisses, i.accidents ? `${Math.round(i.nearMisses / Math.max(1, i.accidents) * 10) / 10} per accident` : "")}
  ${tile("RIDDOR", i.riddor, `${i.riddorReported} reported to HSE${i.riddorLate ? ` · ${i.riddorLate} after 15 days` : ""}`, i.riddor && i.riddorReported < i.riddor ? "#b91c1c" : "#0f172a")}
  ${tile("Investigated", P(i.investigatedPct), `${i.investigated} of ${i.total} · ${i.closed} closed`)}
</div>
<div class="keep"><h3>Incidents per month</h3>${monthBars(i.months)}<p class="note">R = RIDDOR-reportable.</p></div>
<table><tr><th>Type</th><th class="n">Incidents in the period</th></tr>${i.byType.map(x => `<tr><td>${h(x.type)}</td><td class="n">${x.n}</td></tr>`).join("")}</table>
${i.list ? `<h3>Incident list</h3><table><tr><th style="width:80px">Date</th><th>Type</th><th>Location</th><th class="c">RIDDOR</th><th class="c">Investigated</th><th class="c">Status</th></tr>
${i.list.length ? i.list.map(x => `<tr><td>${fmt(x.date)}</td><td>${h(x.type)}</td><td>${h(x.location)}</td><td class="c">${x.riddor ? "Yes" : "—"}</td><td class="c">${x.investigated ? "Yes" : "—"}</td><td class="c">${x.closed ? '<span class="pill p-green">Closed</span>' : '<span class="pill p-grey">Open</span>'}</td></tr>`).join("") : empty(6, "No incidents in the period")}</table>` : ""}

<h2>7. Monitoring and inspection</h2><div class="clause">ISO 45001 clause 9.1 · workplace inspections and internal audits</div>
${kv([["Inspections and audits in the period", m.inspections], ["Average score", P(m.avg)], ["Findings raised (major / minor / observation)", `${m.ncMajor} / ${m.ncMinor} / ${m.ncObs}`], ["Findings closed", m.ncClosed]])}
<table><tr><th>Inspection type</th><th class="n">Carried out</th><th class="n">Average score</th><th style="width:80px">Last</th></tr>
${m.byType.length ? m.byType.map(x => `<tr><td>${h(x.type)}</td><td class="n">${x.n}</td><td class="n">${P(x.avg)}</td><td>${fmt(x.last)}</td></tr>`).join("") : empty(4, "No inspections in the period")}
</table>

<h2>8. Improvement: corrective actions</h2><div class="clause">ISO 45001 clause 10 · actions from incidents, inspections and risk assessments</div>
${kv([["Corrective actions closed in the period", im.closed, "#047857"], ["Open now", im.open], ["Overdue now", im.overdue, im.overdue ? "#b91c1c" : "#047857"]])}
${im.bySource.length ? `<table><tr><th>Source</th><th class="n">Open</th><th class="n">Overdue</th></tr>${im.bySource.map(x => `<tr><td>${h(x.source)}</td><td class="n">${x.open}</td><td class="n">${x.overdue}</td></tr>`).join("")}</table>` : ""}

<div class="privacy"><b>Personal data.</b> This pack contains summary figures only. It names no staff, contractors or injured people and gives no injury or medical details. Full records are held in ${h(getBrand().product)} and can be shown on site during an audit.</div>
<footer><span>H&amp;S Evidence Pack · ${h(p.companyName)} · ${per}</span><span>Generated by ${h(getBrand().product)} on ${fmt(p.generated)}</span></footer>
</div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});</script>
</body></html>`;
}
