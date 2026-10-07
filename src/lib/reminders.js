/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/reminders.js — who gets which reminder email, and what it says
 * ═══════════════════════════════════════════════════════════════════════════
 * Pure logic, no browser or server code: the email job on Netlify
 * (netlify/shared/emailJob.mjs) reads the database, calls planEmails() and sends
 * what comes back. The Site Settings screen uses the settings helpers.
 *
 * The rules match the portal's own screens (the bell, dashboards, Reports):
 *   • training is outstanding when it's assigned and there's no passing completion
 *   • reading is outstanding when a document is assigned and not confirmed
 *   • expiry: training with a renewal period, First Aid / Fire Warden certificates,
 *     machinery competence (the earlier of renewal and licence expiry)
 *   • open actions: incident investigations, inspections and risk assessments,
 *     matched to people by NAME, as on the Actions page (lib/openActions.js)
 *
 * EMAILS (kind)
 *   new        to a person, soon after training or reading is assigned to them
 *   expiry     to a person, 30 and 7 days before (settings.warnDays) and when expired
 *   alerts     to admins, the same day: expiry warnings for everyone + RIDDOR deadlines
 *   weekly     to a person, on settings.weeklyDay: everything they still have to do
 *   manager    to a line manager, same day: their team's outstanding items
 *   digest     to admins, same day: the site summary
 *   incident   to admins (and the reporter's line manager), at ANY hour, when a high-risk
 *              incident or hazard is reported: STOP WORK hazard reports, someone taken to
 *              hospital, RIDDOR, or a serious injury (settings.inc*). One email per incident,
 *              once. Says what kind, when, where and why it's high-risk (and, for a hazard report,
 *              who reported it and the hazard); never who was hurt or what the injury was. Sent within minutes: the portal
 *              asks the server to check straight after an incident is saved
 *              (netlify/functions/zp-email-alert.mjs), and the 15-minute job catches anything missed.
 *
 * DUPLICATES are prevented with KEYS stored in the email_keys table once an email
 * has gone (e.g. "new:t:4:fire_safety", "exp:4:ext:first_aid:2026-11-02:30",
 * "weekly:4:2026-10-05"). planEmails() leaves out anything whose key is in `sent`.
 *
 * FIRST RUN: when "baseline" isn't in `sent`, everything already assigned or
 * already expiring is recorded as known WITHOUT emailing (baselineKeys), so turning
 * reminders on doesn't send everyone a burst of old news. The weekly reminder then
 * covers what's outstanding. The same happens while one kind of email is switched
 * off (quietKeys), so switching it on later doesn't send what happened meanwhile.
 * Admin alerts have keys per admin, so one admin being told doesn't stop the others.
 *
 * WHO: leavers get nothing and aren't listed. "Inactive" staff (e.g. long-term leave)
 * get no emails of their own but still appear in admin and manager lists.
 */
import { EXT_CERT_TYPES } from "../data/seedExtCerts";
import { TRAINING_MODULES } from "../data/seedTraining";
import { MACHINERY_TYPES, machineState } from "../data/seedMachinery";
import { parseCompletionDate } from "../domains/training/completion";
import { collectOpenActions } from "./openActions";
import { riddorDue, riddorUrgent, riddorDueText } from "../domains/incidents/riddor";
import { INJURY_TYPES } from "../data/seedIncidents";
import { renderEmail, ukDate } from "./emailTemplates";

// ── Settings (app_settings row "email") ─────────────────────────────────────
export const EMAIL_SETTINGS_ROW = "email";
export const EMAIL_DEFAULTS = {
  enabled: false,          // nothing is sent until an admin switches it on
  newItems: true,          // email people when training or reading is assigned
  weekly: true,            // weekly "still to do" reminder to each person
  weeklyDay: 1,            // 1 = Monday … 5 = Friday
  managerCopies: true,     // weekly team summary to line managers
  expiry: true,            // warnings before certificates / licences / training expire
  warnDays: [30, 7],       // days before expiry
  adminAlerts: true,       // same-day alerts to admins (expiries, RIDDOR deadlines)
  digest: true,            // weekly summary to admins
  sendHour: 8,             // daily and weekly emails go from this hour (UK time)
  dailyLimit: 100,         // most emails per day (Resend's free plan allows 100)
  extraAdminEmails: [],    // more addresses for admin alerts and the digest
  // high-risk incident alerts (any hour, to admins + extraAdminEmails + incidentEmails)
  incidentAlerts: true,    // email when a high-risk incident or hazard is reported
  incStopWork: true,       //   a hazard report marked "STOP WORK — Urgent"
  incHospital: true,       //   someone taken to hospital, or an ambulance called
  incRiddor: true,         //   marked RIDDOR-reportable
  incInjury: true,         //   one of the serious injury types below
  incAll: false,           //   every other incident and hazard report too
  seriousInjuries: ["Fracture", "Head injury", "Crush injury", "Burn / Scald", "Eye injury", "Electric shock", "Multiple injuries", "Fatality"],
  incidentManager: true,   // also the line manager of the person who reported it
  incidentEmails: [],      // more addresses for incident alerts only (e.g. operations director)
};
/** Incidents dated more than this many days ago never trigger an alert (e.g. an old one edited). */
export const INCIDENT_ALERT_DAYS = 14;   // a little longer than RIDDOR's 10 days, for accidents reported late
/**
 * Once an incident's alert has gone, someone added to the recipients later (a new admin, an
 * extra address) isn't sent it: only people still waiting within this time (e.g. Resend was
 * down for one of them) are. The time is kept in a key "incat:<incident id>:<minute>".
 */
const INCIDENT_RETRY_MINUTES = 120;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NEW_FROM_HOUR = 7, NEW_UNTIL_HOUR = 21;   // "new" emails wait until morning when assigned at night

const isEmail = s => /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/.test(String(s || "").trim());
/** "a@x.co.uk, b@y.com" or a list → up to 10 distinct, valid, lower-case addresses */
const emailList = v => [...new Set((Array.isArray(v) ? v : String(v || "").split(/[\s,;]+/))
  .map(s => String(s).trim().toLowerCase()).filter(isEmail))].slice(0, 10);

/** Settings as stored, with defaults filled in and values kept in range. */
export function emailSettings(data) {
  const d = { ...EMAIL_DEFAULTS, ...(data && typeof data === "object" ? data : {}) };
  const int = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : def; };
  const warn = (Array.isArray(d.warnDays) ? d.warnDays : String(d.warnDays || "").split(/[ ,;]+/))
    .map(v => Math.round(Number(v))).filter(n => Number.isFinite(n) && n >= 1 && n <= 365);
  return {
    enabled: !!d.enabled, newItems: !!d.newItems, weekly: !!d.weekly, managerCopies: !!d.managerCopies,
    expiry: !!d.expiry, adminAlerts: !!d.adminAlerts, digest: !!d.digest,
    weeklyDay: int(d.weeklyDay, 1, 5, 1), sendHour: int(d.sendHour, 5, 12, 8), dailyLimit: int(d.dailyLimit, 1, 5000, 100),
    warnDays: [...new Set(warn.length ? warn : EMAIL_DEFAULTS.warnDays)].sort((a, b) => b - a).slice(0, 4),
    extraAdminEmails: emailList(d.extraAdminEmails),
    incidentAlerts: !!d.incidentAlerts, incStopWork: !!d.incStopWork, incHospital: !!d.incHospital, incRiddor: !!d.incRiddor,
    incInjury: !!d.incInjury, incAll: !!d.incAll, incidentManager: !!d.incidentManager,
    seriousInjuries: INJURY_TYPES.filter(t => t !== INJURY_TYPES[0] && (Array.isArray(d.seriousInjuries) ? d.seriousInjuries : EMAIL_DEFAULTS.seriousInjuries).includes(t)),
    incidentEmails: emailList(d.incidentEmails),
  };
}

// ── UK clock ────────────────────────────────────────────────────────────────
/** The date, hour and weekday in the UK, whatever time zone the computer is in. */
export function ukClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(now).map(p => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const iso = weekday === 0 ? 7 : weekday;                        // Monday 1 … Sunday 7
  return { today, hour: Number(parts.hour) % 24, weekday, isoDay: iso, weekStart: plusDays(today, 1 - iso), ms: now.getTime() };
}

// ── date helpers (plain "YYYY-MM-DD", UTC maths so the time zone can't shift a day) ──
const okDate = d => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null);
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const plusDays = (d, n) => new Date(utc(d) + n * 86400000).toISOString().slice(0, 10);
const plusMonths = (d, n) => { const t = new Date(utc(d)); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0, 10); };
const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / 86400000);
const norm = s => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const isoOf = s => okDate(s) || parseCompletionDate(s) || null;

// ── Database rows → the shapes the rules use ────────────────────────────────
/**
 * rows: { users, training_assigns, training_completions, custom_modules, documents, doc_assignments,
 *         doc_acknowledgements, ext_certs, machine_completions, custom_machine_types,
 *         incidents, investigations, site_inspections, risk_assessments }  (arrays of table rows)
 */
export function prepareData(rows = {}) {
  const r = k => (Array.isArray(rows[k]) ? rows[k] : []);
  const staff = r("users").map(x => ({ ...(x.data || {}), id: String(x.id) })).filter(u => u.name);
  const custom = r("custom_modules").map(x => x.data).filter(Boolean);
  const modules = [
    ...TRAINING_MODULES.map(m => custom.find(c => c.id === m.id && c._override) || m),
    ...custom.filter(c => !c._override),
  ].filter(m => m && !m._hidden);
  const customTypes = r("custom_machine_types").map(x => x.data).filter(Boolean);
  const machineTypes = [...MACHINERY_TYPES.map(m => customTypes.find(c => c.id === m.id && c._override) || m), ...customTypes.filter(c => !c._override)];

  const assigns = {}, dueDates = {};
  r("training_assigns").forEach(x => {
    const uid = String(x.user_id), mid = String(x.module_id);
    (assigns[uid] = assigns[uid] || []).includes(mid) || assigns[uid].push(mid);
    if (x.due_date) (dueDates[uid] = dueDates[uid] || {})[mid] = String(x.due_date).slice(0, 10);
  });
  const comps = {};
  r("training_completions").forEach(x => {
    if (!x.recorded && !x.cert_id && x.score != null && Number(x.score) < 70) return;   // a failed attempt (older versions saved these)
    (comps[String(x.user_id)] = comps[String(x.user_id)] || {})[String(x.module_id)] = { date: x.date, score: x.score };
  });
  const docs = r("documents").map(x => ({ id: String(x.id), title: x.title || "Document", type: x.type || "Document" }));
  const docAssign = {};
  r("doc_assignments").forEach(x => { const uid = String(x.user_id); (docAssign[uid] = docAssign[uid] || []).includes(String(x.doc_id)) || docAssign[uid].push(String(x.doc_id)); });
  const acks = {};
  r("doc_acknowledgements").forEach(x => { (acks[String(x.user_id)] = acks[String(x.user_id)] || {})[String(x.doc_id)] = true; });
  const extCerts = {};
  r("ext_certs").forEach(x => { (extCerts[String(x.user_id)] = extCerts[String(x.user_id)] || {})[x.cert_type] = x.data || {}; });
  const machineComps = {};
  r("machine_completions").forEach(x => { (machineComps[String(x.user_id)] = machineComps[String(x.user_id)] || []).push({ ...(x.data || {}), id: (x.data && x.data.id) || x.machine_id }); });
  const incidents = r("incidents").map(x => { const det = (x.details && typeof x.details === "object") ? x.details : {}; return { ...det,
    id: x.id, date: x.date, type: x.type, location: x.location, riddor: x.riddor, riddorReported: !!x.riddor_reported, closed: x.closed, accidentCode: x.accident_code, numberCode: x.number_code,
    injuryType: x.injury_type || det.injuryType || "", reportedBy: x.reported_by != null ? String(x.reported_by) : (det.reportedBy != null ? String(det.reportedBy) : ""),
    quickReport: !!(x.quick_report || det.quickReport), urgency: x.urgency || det.urgency || "", description: x.description || "" }; });
  const investigations = {};
  r("investigations").forEach(x => { investigations[x.incident_id] = x.data || {}; });
  return { staff, modules, machineTypes, assigns, dueDates, comps, docs, docAssign, acks, extCerts, machineComps, incidents, investigations,
    inspections: r("site_inspections").map(x => x.data).filter(Boolean), ras: r("risk_assessments").map(x => x.data).filter(Boolean) };
}

const active = u => (u.status || "active") !== "leaver";

// ── One person's outstanding items ──────────────────────────────────────────
/** Everything that has an expiry date for this person: [{ key, title, expiryDate, daysLeft, why }] */
function expiringItems(d, u, today) {
  const out = [];
  const myC = d.comps[u.id] || {};
  (d.assigns[u.id] || []).forEach(mid => {
    const m = d.modules.find(x => x.id === mid), c = myC[mid];
    const from = c && isoOf(c.date);
    if (!m || !from || !(Number(m.renewalMonths) > 0)) return;
    const exp = plusMonths(from, Number(m.renewalMonths));
    out.push({ key: `t:${mid}`, title: `${m.title} (training)`, expiryDate: exp, daysLeft: daysBetween(today, exp), why: "retake the module" });
  });
  const mine = d.extCerts[u.id] || {};
  EXT_CERT_TYPES.forEach(ct => {
    const c = mine[ct.id]; if (!c) return;
    const exp = okDate(c.expiryDate) || (okDate(c.issuedDate) && ct.renewalMonths ? plusMonths(okDate(c.issuedDate), ct.renewalMonths) : null);
    if (!exp) return;
    out.push({ key: `ext:${ct.id}`, title: `${ct.label} certificate`, expiryDate: exp, daysLeft: daysBetween(today, exp), why: "book the refresher course and send the new certificate to the H&S team" });
  });
  (d.machineComps[u.id] || []).forEach(c => {
    const st = machineState(c, d.machineTypes);
    if (!st || !st.ex || !["competent", "expiring", "expired"].includes(st.key)) return;
    const t = d.machineTypes.find(x => x.id === c.machineId);
    out.push({ key: `mc:${c.id}`, title: `${t ? t.label : c.machineId} competence`, expiryDate: st.ex.expiryDate, daysLeft: daysBetween(today, st.ex.expiryDate),
      why: st.ex.source === "licence" ? "licence expiry — arrange a refresher and new licence" : "reassessment due — arrange a refresher" });
  });
  return out;
}

/** { training, reading, renewals, actions } still to do for this person. */
export function personItems(d, u, today, openActions, warnMax = 30) {
  const myC = d.comps[u.id] || {};
  const training = (d.assigns[u.id] || []).map(mid => {
    const m = d.modules.find(x => x.id === mid);
    if (!m || myC[mid]) return null;
    const due = ((d.dueDates[u.id] || {})[mid]) || null;
    const days = due ? daysBetween(today, due) : null;
    return { mid, title: m.title, mandatory: m.level === "Mandatory", due, days, overdue: days != null && days < 0 };
  }).filter(Boolean).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.title.localeCompare(b.title));
  const reading = (d.docAssign[u.id] || []).map(id => d.docs.find(x => x.id === id)).filter(Boolean)
    .filter(doc => !(d.acks[u.id] || {})[doc.id]).map(doc => ({ docId: doc.id, title: doc.title }));
  const renewals = expiringItems(d, u, today).filter(x => x.daysLeft <= warnMax).sort((a, b) => a.daysLeft - b.daysLeft);
  const me = norm(u.name);
  const actions = (openActions || []).filter(a => norm(a.owner) === me && a.dueDate && a.daysOverdue != null && a.daysOverdue >= -7)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { training, reading, renewals, actions };
}

// ── Text for the items ──────────────────────────────────────────────────────
const dueLine = t => t.due == null ? (t.mandatory ? "Mandatory" : "")
  : t.days < 0 ? `Overdue — was due ${ukDate(t.due)}` : t.days === 0 ? "Due today" : `Complete by ${ukDate(t.due)}`;
const expLine = x => x.daysLeft < 0 ? `Expired ${ukDate(x.expiryDate)}` : x.daysLeft === 0 ? "Expires today" : `Expires ${ukDate(x.expiryDate)} (${x.daysLeft} day${x.daysLeft === 1 ? "" : "s"})`;
const actLine = a => a.daysOverdue > 0 ? `Overdue — was due ${ukDate(a.dueDate)}` : a.daysOverdue === 0 ? "Due today" : `Due ${ukDate(a.dueDate)}`;
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const firstName = u => String(u.name || "").trim().split(/\s+/)[0] || "there";

const trainingItems = list => list.map(t => ({ text: t.title, sub: [dueLine(t), t.mandatory && t.due ? "Mandatory" : ""].filter(Boolean).join(" · "), flag: t.overdue }));
const readingItems = list => list.map(r => ({ text: r.title, sub: "Read and confirm" }));
const renewalItems = list => list.map(x => ({ text: x.title, sub: `${expLine(x)} — ${x.why}`, flag: x.daysLeft < 0 }));
/** Investigation actions can describe what happened to someone, so emails name only where they came from. */
const actionTitle = a => (a.source === "Incident investigation" ? `Incident investigation action${a.ref ? ` (${a.ref})` : ""}` : a.title);
const actionItems = list => list.map(a => ({ text: actionTitle(a), sub: `${a.source} · ${actLine(a)}`, flag: a.daysOverdue > 0 }));

/** The stage an expiry has reached: "expired", or the tightest warning it's inside, or null. */
function stageOf(daysLeft, warnDays) {
  if (daysLeft < 0) return "expired";
  const inside = warnDays.filter(w => daysLeft <= w);
  return inside.length ? String(Math.min(...inside)) : null;
}
const stageRank = s => (s === "expired" ? -1 : Number(s));
const INCIDENT_TYPES = { accident: "Accident", near_miss: "Near miss", unsafe_condition: "Unsafe condition", unsafe_act: "Unsafe act" };
/** "Accident 12 — 25/09/2026, Goods In": enough to find it in the portal, no details of what happened or who was hurt. */
const incidentLabel = inc => `${INCIDENT_TYPES[inc.type] || "Incident"}${inc.accidentCode ? ` ${inc.accidentCode}` : ""} — ${ukDate(inc.date)}${inc.location ? `, ${inc.location}` : ""}`;

// ── High-risk incidents ─────────────────────────────────────────────────────
const isHospital = o => /hospital|ambulance/i.test(String(o || ""));
/**
 * Why an incident needs an alert now: [] when it doesn't. Reasons are worded so they
 * can go in an email: they say THAT it's serious, never what the injury was.
 */
export function incidentAlertReasons(inc, settings) {
  const s = emailSettings(settings);
  if (!inc) return [];
  const out = [];
  if (s.incStopWork && inc.quickReport && inc.urgency === "high") out.push("Hazard reported as STOP WORK — Urgent");
  if (s.incHospital && isHospital(inc.postIncidentOutcome)) out.push("Someone was taken to hospital or an ambulance was called");
  if (s.incRiddor && inc.riddor) out.push("Marked as reportable under RIDDOR");
  if (s.incInjury && inc.injuryType && s.seriousInjuries.includes(inc.injuryType)) out.push("A serious injury was recorded");
  return out;
}
const isStopWork = inc => !!inc.quickReport && inc.urgency === "high";
const incidentKind = inc => (inc.quickReport ? "hazard report" : (INCIDENT_TYPES[inc.type] || "incident").toLowerCase());
const clip = (t, n) => { const v = String(t || "").replace(/\s+/g, " ").trim(); return v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v; };

// ── The plan ────────────────────────────────────────────────────────────────
/**
 * What to send now.
 *   data       prepareData(rows)
 *   settings   emailSettings(...)
 *   clock      ukClock(now)
 *   sent       Set of keys already done (email_keys)
 *   portalUrl  link target, e.g. "https://zeus-protect.netlify.app"
 *   ignoreSchedule  true for "Send now" / preview: don't wait for the send hour or weekday
 *   only       "incident": high-risk incident alerts and nothing else (the alert function)
 * → { emails:[{ kind, priority, userId, name, to, subject, html, text, keys:[] }],
 *     quietKeys:[], baselineKeys:[], firstRun, noEmail:[names] }
 */
export function planEmails({ data, settings, clock, sent = new Set(), portalUrl = "", ignoreSchedule = false, only = "" }) {
  const s = emailSettings(settings);
  const { today, hour, isoDay, weekStart } = clock;
  const firstRun = !sent.has("baseline");
  const people = data.staff.filter(active);                                   // leavers: nothing at all
  // "Inactive" (e.g. long-term leave) still shows in admin and manager lists, but gets no emails of their own
  const reachable = u => isEmail(u.email) && (u.status || "active") === "active";
  const withEmail = people.filter(reachable);
  const noEmail = people.filter(u => !isEmail(u.email)).map(u => u.name);
  const admins = [...withEmail.filter(u => u.role === "admin").map(u => ({ id: u.id, name: u.name, email: u.email.trim() })),
    ...s.extraAdminEmails.map(e => ({ id: `x-${e}`, name: "", email: e }))]
    .filter((a, i, all) => all.findIndex(b => b.email.toLowerCase() === a.email.toLowerCase()) === i);
  const link = (hash = "") => `${String(portalUrl || "").replace(/\/+$/, "")}/${hash}`;
  const openActions = collectOpenActions({ incidents: data.incidents, investigations: data.investigations, inspections: data.inspections, ras: data.ras, today });
  const warnMax = Math.max(...s.warnDays);

  const emails = [], quietKeys = [], baselineKeys = [];
  const send = (e) => emails.push(e);
  const daytime = ignoreSchedule || hour >= s.sendHour;
  const awake = ignoreSchedule || (hour >= NEW_FROM_HOUR && hour < NEW_UNTIL_HOUR);
  const weeklyRound = `round:weekly:${weekStart}`;
  // the weekly day from the send hour; on later weekdays only to finish a round the daily limit held back
  const weeklyOpen = ignoreSchedule || (hour >= s.sendHour && isoDay <= 5 && (isoDay === s.weeklyDay || (isoDay > s.weeklyDay && sent.has(weeklyRound))));
  if (weeklyOpen && (s.weekly || s.managerCopies || s.digest) && !sent.has(weeklyRound)) quietKeys.push(weeklyRound);
  // What happens to an item that's due to be told about:
  //   first run → noted without emailing; that kind of email switched off → noted too (so switching
  //   it on later doesn't send old news); otherwise → emailed (when the time is right)
  const disposition = on => (firstRun ? baselineKeys : !on ? quietKeys : null);

  // 0. INCIDENT — high-risk incidents and hazards, at any hour, one email per recipient per incident.
  //    Its own first-run marker ("baseline:inc"), so adding this to a site that already sends
  //    reminders doesn't email about last week's incidents; anything dated today still goes.
  //    Keys: "inc:<recipient>:<incident>" for the high-risk alert, "incn:…" for a "New incident"
  //    email (incAll) — kept apart so an incident first sent as "new" still gets its high-risk
  //    alert if it becomes serious later. "incat:"/"incatn:" record when each was first sent.
  {
    const incFirst = !sent.has("baseline:inc");
    if (incFirst) baselineKeys.push("baseline:inc");
    const since = plusDays(today, -INCIDENT_ALERT_DAYS), until = plusDays(today, 1);
    const recent = data.incidents.filter(inc => { const d = okDate(inc.date); return d && d >= since && d <= until; });
    const nowMin = Math.floor((clock.ms || Date.now()) / 60000);
    const firstAlerted = pre => { let t = null; sent.forEach(k => { if (k.startsWith(pre)) { const n = Number(k.slice(pre.length)); if (Number.isFinite(n) && (t == null || n < t)) t = n; } }); return t; };
    recent.forEach(inc => {
      const reasons = incidentAlertReasons(inc, s);
      const high = reasons.length > 0;
      if (!high && !s.incAll) return;
      const reporter = data.staff.find(u => String(u.id) === String(inc.reportedBy));
      const to = [...admins.map(a => ({ ...a, admin: true }))];
      s.incidentEmails.forEach(e => to.push({ id: `x-${e}`, name: "", email: e, admin: true }));
      if (s.incidentManager && reporter && reporter.manager) {
        const manager = withEmail.find(m => m.id !== reporter.id && norm(m.name) === norm(reporter.manager));
        if (manager) to.push({ id: manager.id, name: manager.name, email: manager.email.trim(), admin: manager.role === "admin", manager: true });
      }
      const seen = new Set();
      const recipients = to.filter(r => {                     // each address once; not the person who reported it
        const k = r.email.toLowerCase();
        if (seen.has(k) || (reporter && (String(r.id) === String(reporter.id) || k === String(reporter.email || "").trim().toLowerCase()))) return false;
        seen.add(k); return true;
      });
      const what = incidentKind(inc);
      const What = what[0].toUpperCase() + what.slice(1);
      const noun = inc.quickReport ? "hazard" : what;           // "a hazard has been reported", not "a hazard report has been reported"
      const an = /^[aeiou]/.test(noun) ? "an" : "a";
      const stop = s.incStopWork && isStopWork(inc);
      // A hazard report names who reported it. An incident doesn't: the person reporting an
      // accident is often the person hurt, and "taken to hospital" next to their name is health information.
      const named = inc.quickReport && reporter;
      const subject = `${stop ? "STOP WORK" : high ? "High-risk incident" : "New incident"}: ${What}${inc.location ? ` — ${clip(inc.location, 60)}` : ""}${inc.date && okDate(inc.date) !== today ? ` (${ukDate(inc.date)})` : ""}`;
      const facts = [
        { text: `${What}${inc.accidentCode ? ` (code ${inc.accidentCode})` : ""}`, sub: [okDate(inc.date) && ukDate(inc.date), inc.time && `at ${String(inc.time).slice(0, 5)}`, inc.location].filter(Boolean).join(" · ") },
        named ? { text: `Reported by ${reporter.name}`, sub: reporter.jobTitle || "" } : { text: "Reported by a member of staff", sub: "Who reported it and who was involved are in Zeus Protect" },
        inc.quickReport && inc.description && { text: "The hazard, as reported", sub: clip(inc.description, 240) },
      ].filter(Boolean);
      const [kp, mp] = high ? ["inc", "incat"] : ["incn", "incatn"];
      const was = firstAlerted(`${mp}:${inc.id}:`);
      const marker = `${mp}:${inc.id}:${was != null ? was : nowMin}`;
      const late = was != null && nowMin - was > INCIDENT_RETRY_MINUTES;   // told about long ago: a new recipient isn't sent old news
      recipients.forEach(r => {
        const key = `${kp}:${r.id}:${inc.id}`;
        if (sent.has(key) || (!high && sent.has(`inc:${r.id}:${inc.id}`))) return;
        if (!s.incidentAlerts || late) { quietKeys.push(key, marker); return; }
        if (incFirst && okDate(inc.date) < today) { baselineKeys.push(key, marker); return; }   // older than today on the first run: note only
        const intro = r.manager && !r.admin
          ? `${named ? `${reporter.name}, in your team,` : "Someone in your team"} has reported ${an} ${noun} in Zeus Protect${high ? " that needs attention now" : ""}.`
          : `${high ? "A high-risk" : an[0].toUpperCase() + an.slice(1)} ${noun} has been reported in Zeus Protect.`;
        emails.push({ kind: "incident", priority: -1, userId: /^x-/.test(String(r.id)) ? null : r.id, name: r.name, to: r.email, subject, keys: [key, marker],
          ...renderEmail({ preheader: high ? reasons[0] : `A new ${noun} has been reported`, greeting: r.name ? `Hi ${firstName(r)},` : "Hello,", intro,
            sections: [{ title: "What was reported", items: facts }, high && { title: "Why you're getting this", items: reasons.map(x => ({ text: x, flag: true })) }].filter(Boolean),
            note: `${stop ? "If you haven't already, make sure the area is safe and work has stopped. " : ""}Details of what happened and who was involved are in Zeus Protect, not in this email.`,
            button: r.admin ? { label: "Open Incidents", href: link("#/admin/incidents") } : { label: "Open Zeus Protect", href: link("") } }) });
      });
    });
  }
  if (only === "incident") {
    emails.sort((a, b) => a.priority - b.priority);
    return { emails, quietKeys, baselineKeys, firstRun: false, noEmail };
  }

  // 1. NEW — training or reading just assigned
  withEmail.forEach(u => {
    const myC = data.comps[u.id] || {};
    const t = (data.assigns[u.id] || []).filter(mid => !myC[mid]).map(mid => ({ mid, key: `new:t:${u.id}:${mid}`, m: data.modules.find(x => x.id === mid) }))
      .filter(x => x.m && !sent.has(x.key));
    const r = (data.docAssign[u.id] || []).filter(id => !(data.acks[u.id] || {})[id]).map(id => ({ key: `new:d:${u.id}:${id}`, doc: data.docs.find(x => x.id === id) }))
      .filter(x => x.doc && !sent.has(x.key));
    if (!t.length && !r.length) return;
    const keys = [...t.map(x => x.key), ...r.map(x => x.key)];
    const note = disposition(s.newItems); if (note) { note.push(...keys); return; }
    if (!awake) return;                                   // assigned at night: wait for the morning
    const items = personItems(data, u, today, [], warnMax);
    const tr = items.training.filter(x => t.some(y => y.mid === x.mid));
    const rd = items.reading.filter(x => r.some(y => y.doc.id === x.docId));
    const n = tr.length + rd.length;
    const subject = n === 1 ? (tr.length ? `New training for you: ${tr[0].title}` : `Please read and confirm: ${rd[0].title}`)
      : `${plural(n, "new item")} for you in Zeus Protect`;
    send({ kind: "new", priority: 1, userId: u.id, name: u.name, to: u.email.trim(), subject, keys,
      ...renderEmail({ preheader: subject, greeting: `Hi ${firstName(u)},`,
        intro: n === 1 ? "There's something new for you to do in Zeus Protect, the H&S portal." : "There are some new things for you to do in Zeus Protect, the H&S portal.",
        sections: [tr.length && { title: "Training to complete", items: trainingItems(tr) }, rd.length && { title: "Documents to read and confirm", items: readingItems(rd) }].filter(Boolean),
        button: { label: tr.length ? "Start your training" : "Open your documents", href: link(tr.length ? "#/staff/training" : "#/staff/documents") } }) });
  });

  // 2. EXPIRY — warnings to the person
  // A stage counts as done if it, or any tighter stage, was recorded before (30 → 7 → expired).
  const doneStage = (prefix, stage) => ["expired", ...s.warnDays.map(String)].filter(st => stageRank(st) <= stageRank(stage)).some(st => sent.has(`${prefix}:${st}`));
  const alertItems = [];                                  // every person's renewals at a warning stage, for the admins
  people.forEach(u => {
    const due = expiringItems(data, u, today).map(x => ({ ...x, stage: stageOf(x.daysLeft, s.warnDays) })).filter(x => x.stage);
    due.forEach(x => alertItems.push({ base: `${u.id}:${x.key}:${x.expiryDate}`, stage: x.stage,
      text: `${u.name} — ${x.title}`, sub: `${expLine(x)}${reachable(u) ? "" : " · no reminder sent to them, tell them yourself"}`, flag: x.daysLeft < 0 }));
    if (!reachable(u)) return;
    const personDue = due.filter(x => !doneStage(`exp:${u.id}:${x.key}:${x.expiryDate}`, x.stage));
    if (!personDue.length) return;
    const keys = personDue.map(x => `exp:${u.id}:${x.key}:${x.expiryDate}:${x.stage}`);
    const note = disposition(s.expiry); if (note) { note.push(...keys); return; }
    if (!daytime) return;
    const expired = personDue.filter(x => x.daysLeft < 0);
    const subject = personDue.length === 1
      ? (expired.length ? `Your ${personDue[0].title} has expired` : `Your ${personDue[0].title} expires ${personDue[0].daysLeft === 0 ? "today" : `in ${plural(personDue[0].daysLeft, "day")}`}`)
      : `${plural(personDue.length, "certificate or licence", "certificates and licences")} need${personDue.length === 1 ? "s" : ""} renewing`;
    send({ kind: "expiry", priority: 3, userId: u.id, name: u.name, to: u.email.trim(), subject, keys,
      ...renderEmail({ preheader: subject, greeting: `Hi ${firstName(u)},`,
        intro: expired.length ? "Something on your H&S record has expired. Please arrange a renewal as soon as you can." : "Something on your H&S record is due for renewal soon.",
        sections: [{ title: "Renewals", items: renewalItems(personDue) }],
        note: "The H&S team has been told as well. If you've already renewed, send them the new certificate so your record can be updated.",
        button: { label: "Open Zeus Protect", href: link("#/staff/dashboard") } }) });
  });

  // 3. ALERTS — renewals and RIDDOR deadlines to each admin (each admin's own keys, so one
  //    admin's email going doesn't count as the others being told)
  const riddorNow = data.incidents.map(inc => ({ inc, due: riddorDue(inc, today) })).filter(x => x.due && riddorUrgent(x.due))
    .map(({ inc, due }) => ({ base: `${inc.id}:${due.state}${due.notifyNow ? ":now" : ""}`, text: incidentLabel(inc), sub: riddorDueText(due), flag: due.state === "overdue" || due.notifyNow }));
  admins.forEach(a => {
    const renew = alertItems.filter(i => !doneStage(`adm:${a.id}:${i.base}`, i.stage));
    const rid = riddorNow.filter(i => !sent.has(`riddor:${a.id}:${i.base}`));
    const renewKeys = renew.map(i => `adm:${a.id}:${i.base}:${i.stage}`), ridKeys = rid.map(i => `riddor:${a.id}:${i.base}`);
    if (!s.adminAlerts) { quietKeys.push(...renewKeys, ...ridKeys); return; }
    if (firstRun) baselineKeys.push(...renewKeys);         // RIDDOR deadlines still go on the first run: they're time-critical
    const items = firstRun || !daytime ? [] : renew;
    const rids = awake ? rid : [];
    if (!items.length && !rids.length) return;
    const subject = rids.length ? `RIDDOR: ${plural(rids.length, "report")} to make to the HSE${items.length ? `, and ${plural(items.length, "renewal")}` : ""}`
      : `H&S renewals: ${plural(items.length, "certificate or licence", "certificates and licences")} expiring`;
    send({ kind: "alerts", priority: 0, userId: a.id, name: a.name, to: a.email, subject,
      keys: [...(items.length ? renewKeys : []), ...rids.map(i => `riddor:${a.id}:${i.base}`)],
      ...renderEmail({ preheader: subject, greeting: a.name ? `Hi ${firstName(a)},` : "Hello,",
        intro: "Today's H&S alerts from Zeus Protect.",
        sections: [rids.length && { title: "RIDDOR reports to make", items: rids }, items.length && { title: "Certificates, licences and training due for renewal", items }].filter(Boolean),
        note: items.length ? "Staff with an email address have had their own reminder." : "",
        button: { label: "Open Zeus Protect", href: link(rids.length ? "#/admin/incidents" : "#/admin/dashboard") } }) });
  });

  // 4. WEEKLY — each person's outstanding items; 5. MANAGER — team summary; 6. DIGEST — admins
  if (weeklyOpen) {
    const all = people.map(u => ({ u, items: personItems(data, u, today, openActions, warnMax) }));
    const count = it => it.training.length + it.reading.length + it.renewals.length + it.actions.length;
    if (s.weekly) all.forEach(({ u, items }) => {
      const key = `weekly:${u.id}:${weekStart}`;
      if (!reachable(u) || sent.has(key)) return;
      const n = count(items);
      if (!n) { quietKeys.push(key); return; }
      const overdue = items.training.filter(t => t.overdue).length + items.actions.filter(a => a.daysOverdue > 0).length + items.renewals.filter(x => x.daysLeft < 0).length;
      const subject = overdue ? `Reminder: ${plural(n, "H&S item")} to do, ${overdue} overdue` : `Reminder: ${plural(n, "H&S item")} to do`;
      send({ kind: "weekly", priority: 5, userId: u.id, name: u.name, to: u.email.trim(), subject, keys: [key],
        ...renderEmail({ preheader: subject, greeting: `Hi ${firstName(u)},`,
          intro: `Here's what you still have to do in Zeus Protect, the H&S portal.${overdue ? " Overdue items are marked in red." : ""}`,
          sections: [items.training.length && { title: "Training to complete", items: trainingItems(items.training) },
            items.reading.length && { title: "Documents to read and confirm", items: readingItems(items.reading) },
            items.renewals.length && { title: "Renewals", items: renewalItems(items.renewals) },
            items.actions.length && { title: "Actions you're responsible for", items: actionItems(items.actions) }].filter(Boolean),
          button: { label: "Open Zeus Protect", href: link("#/staff/dashboard") } }) });
    });

    if (s.managerCopies) {
      const managers = withEmail.filter(m => all.some(({ u }) => u.id !== m.id && norm(u.manager) === norm(m.name)));
      managers.forEach(m => {
        const key = `manager:${m.id}:${weekStart}`;
        if (sent.has(key)) return;
        const team = all.filter(({ u, items }) => u.id !== m.id && norm(u.manager) === norm(m.name) && count(items) > 0);
        const rows = team.map(({ u, items }) => {
          const od = items.training.filter(t => t.overdue).length, ex = items.renewals.filter(x => x.daysLeft < 0).length;
          const bits = [items.training.length && `${plural(items.training.length, "module")} to complete${od ? ` (${od} overdue)` : ""}`,
            items.reading.length && `${plural(items.reading.length, "document")} to read`,
            items.renewals.length && `${plural(items.renewals.length, "renewal")}${ex ? ` (${ex} expired)` : ""}`,
            items.actions.length && `${plural(items.actions.length, "action")}`].filter(Boolean);
          return { text: u.name, sub: bits.join(" · "), flag: od + ex > 0, od: od + ex };
        }).sort((a, b) => b.od - a.od || a.text.localeCompare(b.text));
        if (!rows.length) { quietKeys.push(key); return; }
        const subject = `Your team's H&S: ${plural(rows.length, "person", "people")} with items to do`;
        send({ kind: "manager", priority: 6, userId: m.id, name: m.name, to: m.email.trim(), subject, keys: [key],
          ...renderEmail({ preheader: subject, greeting: `Hi ${firstName(m)},`,
            intro: "This week's summary of what your team still has to do in Zeus Protect. They've each had their own reminder.",
            sections: [{ title: "Your team", items: rows }],
            button: { label: "Open My Team", href: link("#/staff/team") } }) });
      });
    }

    if (s.digest && admins.length) {
      const cap = (list, n = 25) => list.length > n ? [...list.slice(0, n), { text: `…and ${list.length - n} more`, sub: "See the portal for the full list" }] : list;
      const overdueT = all.map(({ u, items }) => ({ u, od: items.training.filter(t => t.overdue) })).filter(x => x.od.length).sort((a, b) => b.od.length - a.od.length);
      const outstanding = all.reduce((n, x) => n + x.items.training.length, 0);
      const reading = all.map(({ u, items }) => ({ u, n: items.reading.length })).filter(x => x.n).sort((a, b) => b.n - a.n);
      const renewals = all.flatMap(({ u, items }) => items.renewals.map(x => ({ u, x }))).sort((a, b) => a.x.daysLeft - b.x.daysLeft);
      const actions = openActions.filter(a => a.daysOverdue != null && a.daysOverdue > 0).sort((a, b) => b.daysOverdue - a.daysOverdue);
      const riddor = data.incidents.map(inc => ({ inc, due: riddorDue(inc, today) })).filter(x => x.due);
      const stats = [
        { label: "Training overdue", value: overdueT.reduce((n, x) => n + x.od.length, 0) },
        { label: "Training outstanding", value: outstanding, warn: false },
        { label: "Documents unread", value: reading.reduce((n, x) => n + x.n, 0), warn: false },
        { label: "Renewals due or expired", value: renewals.length },
        { label: "Actions overdue", value: actions.length },
        { label: "RIDDOR reports to make", value: riddor.length },
      ];
      const sections = [
        riddor.length && { title: "RIDDOR reports to make", items: riddor.map(({ inc, due }) => ({ text: incidentLabel(inc), sub: riddorDueText(due), flag: riddorUrgent(due) })) },
        overdueT.length && { title: "Overdue training", items: cap(overdueT.map(({ u, od }) => ({ text: u.name, sub: od.map(t => t.title).join(", "), flag: true }))) },
        renewals.length && { title: `Renewals in the next ${warnMax} days, and expired`, items: cap(renewals.map(({ u, x }) => ({ text: `${u.name} — ${x.title}`, sub: expLine(x), flag: x.daysLeft < 0 }))) },
        actions.length && { title: "Overdue actions", items: cap(actions.map(a => ({ text: actionTitle(a), sub: `${a.source} · ${a.owner} · was due ${ukDate(a.dueDate)}`, flag: true }))) },
        outstanding && { title: "Training not yet completed", items: cap(all.filter(({ items }) => items.training.length).sort((a, b) => b.items.training.length - a.items.training.length)
          .map(({ u, items }) => ({ text: u.name, sub: `${plural(items.training.length, "module")}: ${items.training.map(t => t.title).join(", ")}` }))) },
        reading.length && { title: "Documents not yet confirmed", items: cap(reading.map(({ u, n }) => ({ text: u.name, sub: plural(n, "document") }))) },
      ].filter(Boolean);
      admins.forEach(a => {
        const key = `digest:${a.id}:${weekStart}`;
        if (sent.has(key)) return;
        const subject = `H&S weekly summary — week of ${ukDate(weekStart)}`;
        send({ kind: "digest", priority: 4, userId: a.id, name: a.name, to: a.email, subject, keys: [key],
          ...renderEmail({ preheader: stats.filter(x => x.value).map(x => `${x.value} ${x.label.toLowerCase()}`).join(" · ") || "Nothing outstanding",
            greeting: a.name ? `Hi ${firstName(a)},` : "Hello,", intro: "This week's summary from Zeus Protect.", stats,
            sections: sections.length ? sections : [{ title: "All clear", items: [{ text: "Nothing is overdue or due for renewal." }] }],
            button: { label: "Open Zeus Protect", href: link("#/admin/dashboard") } }) });
      });
    }
  }

  emails.sort((a, b) => a.priority - b.priority);
  return { emails, quietKeys, baselineKeys: [...new Set([...baselineKeys, ...(firstRun ? ["baseline"] : [])])], firstRun, noEmail };
}
