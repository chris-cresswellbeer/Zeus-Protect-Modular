/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/loneWorking.js — lone working check-ins: the rules, shared by the phone app,
 * the portal and the server job (netlify/shared/loneJob.mjs). Pure, no React.
 * ═══════════════════════════════════════════════════════════════════════════
 * SETTINGS  app_settings row "lone_working"
 *   { enabled, intervals:[minutes], defaultInterval, grace, escalate }
 *     grace     minutes after a missed check-in before the line manager is emailed
 *     escalate  minutes after that, with nobody dealing with it, before all admins are
 *
 * A SESSION  lone_working row { id, user_id, status, next_due, data }   (lone_working.sql)
 *   status   active     working alone, checking in
 *            alert      missed a check-in: line manager (or admins) emailed
 *            escalated  alert not dealt with in time: all admins emailed
 *            help       pressed "I need help": line manager and admins emailed at once
 *            finished   finished normally
 *            resolved   someone dealt with an alert or help call and closed it
 *   data { userId, name, place, note, interval, startedAt, lastCheckIn, nextDue,
 *          checkIns:[iso], help:{ at, message, emailedAt }, alertedAt, escalatedAt,
 *          okAfterAlert:{ at, emailedAt }, ack:{ by, at, outcome, note }, finishedAt,
 *          emails:[{ at, kind, to }] }
 * Times are ISO strings (UTC). The server decides when alerts go, so a phone that's
 * switched off or out of signal still raises the alarm.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const LONE_SETTINGS_ID = "lone_working";
export const LONE_OPEN = ["active", "alert", "escalated", "help"];   // sessions still running
export const LONE_ALARM = ["alert", "escalated", "help"];            // someone needs to act

export const DEFAULT_LONE_SETTINGS = { enabled: false, intervals: [30, 60, 90, 120], defaultInterval: 60, grace: 10, escalate: 15 };

export function normaliseLoneSettings(d) {
  const s = d && typeof d === "object" ? d : {};
  const num = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt; };
  const intervals = [...new Set((Array.isArray(s.intervals) ? s.intervals : DEFAULT_LONE_SETTINGS.intervals).map(v => num(v, 5, 480, 0)).filter(Boolean))].sort((a, b) => a - b).slice(0, 8);
  const list = intervals.length ? intervals : DEFAULT_LONE_SETTINGS.intervals;
  const def = num(s.defaultInterval, 5, 480, DEFAULT_LONE_SETTINGS.defaultInterval);
  return { enabled: !!s.enabled, intervals: list, defaultInterval: list.includes(def) ? def : list[0],
    grace: num(s.grace, 1, 60, DEFAULT_LONE_SETTINGS.grace), escalate: num(s.escalate, 1, 120, DEFAULT_LONE_SETTINGS.escalate) };
}

const addMin = (iso, m) => new Date(Date.parse(iso) + m * 60000).toISOString();
export const minutesBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 60000);

/** A new session for a person. */
export function newLoneSession({ user, place, note = "", interval, now = new Date().toISOString() }) {
  const id = `lw_${Date.parse(now).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const data = { userId: String(user.id), name: user.name || "", place: String(place || "").slice(0, 120), note: String(note || "").slice(0, 300),
    interval, startedAt: now, lastCheckIn: now, nextDue: addMin(now, interval), checkIns: [], emails: [] };
  return { id, user_id: String(user.id), status: "active", next_due: data.nextDue, data };
}
/** "I'm OK": the next check-in moves on. After an alert, reception of this is emailed to whoever was alerted. */
export function checkIn(row, now = new Date().toISOString()) {
  const d = row.data || {};
  const wasAlarm = row.status === "alert" || row.status === "escalated";
  const data = { ...d, lastCheckIn: now, nextDue: addMin(now, d.interval || 60), checkIns: [...(d.checkIns || []), now].slice(-200),
    ...(wasAlarm ? { okAfterAlert: { at: now } } : {}) };
  return { ...row, status: "active", next_due: data.nextDue, data };
}
export function askHelp(row, message = "", now = new Date().toISOString()) {
  return { ...row, status: "help", data: { ...(row.data || {}), help: { at: now, message: String(message || "").slice(0, 300) } } };
}
export function finishSession(row, now = new Date().toISOString()) {
  return { ...row, status: "finished", next_due: null, data: { ...(row.data || {}), finishedAt: now } };
}
/** A manager / admin dealing with an alert or help call. outcome: "ok" | "attended" | "other". */
export function acknowledge(row, { by, outcome = "ok", note = "" }, now = new Date().toISOString()) {
  return { ...row, status: "resolved", next_due: null, data: { ...(row.data || {}), ack: { by, at: now, outcome, note: String(note || "").slice(0, 400) }, finishedAt: now } };
}

/** Minutes until the next check-in (negative = overdue). */
export const minutesToDue = (row, now = new Date().toISOString()) => (row && row.data && row.data.nextDue ? minutesBetween(now, row.data.nextDue) : null);

/**
 * What the server should do with one open session now.
 * → { status, data, emails:[{ kind:"missed"|"escalated"|"help"|"ok", to:"manager"|"admins"|"both" }] } or null (nothing to do)
 */
export function loneStep(row, settings, now = new Date().toISOString()) {
  if (!row || !LONE_OPEN.includes(row.status)) return null;
  const d = row.data || {};
  const s = normaliseLoneSettings(settings);
  const log = (kind, to) => [...(d.emails || []), { at: now, kind, to }].slice(-50);
  if (row.status === "help" && d.help && !d.help.emailedAt) {
    return { status: "help", data: { ...d, help: { ...d.help, emailedAt: now }, emails: log("help", "both") }, emails: [{ kind: "help", to: "both" }] };
  }
  if (row.status === "active" && d.okAfterAlert && !d.okAfterAlert.emailedAt) {
    const to = d.escalatedAt ? "both" : "manager";
    return { status: "active", data: { ...d, okAfterAlert: { ...d.okAfterAlert, emailedAt: now }, alertedAt: null, escalatedAt: null, emails: log("ok", to) }, emails: [{ kind: "ok", to }] };
  }
  if (row.status === "active" && d.nextDue && minutesBetween(d.nextDue, now) >= s.grace) {
    return { status: "alert", data: { ...d, alertedAt: now, okAfterAlert: null, emails: log("missed", "manager") }, emails: [{ kind: "missed", to: "manager" }] };
  }
  if (row.status === "alert" && d.alertedAt && minutesBetween(d.alertedAt, now) >= s.escalate) {
    return { status: "escalated", data: { ...d, escalatedAt: now, emails: log("escalated", "admins") }, emails: [{ kind: "escalated", to: "admins" }] };
  }
  return null;
}

/** Text for an alert email. */
export function loneEmailText(kind, d, { overdueMin = 0 } = {}) {
  const who = d.name || "Someone";
  const where = [d.place, d.note].filter(Boolean).join(" — ");
  const T = {
    missed: { subject: `Lone worker missed a check-in: ${who}`, lead: `${who} is working alone and hasn't checked in. Their check-in was due ${overdueMin} minutes ago.` },
    escalated: { subject: `URGENT: nobody has responded — ${who} missed a lone working check-in`, lead: `${who} missed a lone working check-in and nobody has marked it as dealt with yet. Please check on them now.` },
    help: { subject: `URGENT: ${who} has asked for help (lone working)`, lead: `${who} pressed "I need help" while working alone.${d.help && d.help.message ? ` Their message: "${d.help.message}"` : ""}` },
    ok: { subject: `All clear: ${who} has now checked in`, lead: `${who} has now checked in after missing a check-in. No further action is needed unless you've been told otherwise.` },
  };
  return { ...(T[kind] || { subject: "Lone working", lead: "" }), where };
}

export const OUTCOMES = [
  { id: "ok", label: "Spoke to them — all OK" },
  { id: "attended", label: "Went to them / sent someone" },
  { id: "emergency", label: "Called the emergency services" },
  { id: "other", label: "Other (see note)" },
];
