/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/racking.js — racking inspections and damage: the rules, shared by the portal, the
 * phone app and the red-alert job (netlify/shared/rackingJob.mjs). Pure, no React.
 * ═══════════════════════════════════════════════════════════════════════════
 * SETTINGS  app_settings row "racking"
 *   { checkEveryDays, expertEveryMonths, amberDays, defaultLevels }
 *
 * A BAY (ground location)  racking_locations { id: "03-12", aisle: "03", bay: 12,
 *   data: { levels: ["A","B","C","D","E"], active, note } }
 *   The QR label on the bay opens  <portal>/?rack=03-12
 *
 * A DAMAGE REPORT  racking_damage { id, location_id, status, rating, data }
 *   status  open | repaired | dismissed
 *   rating  red | amber | green   (SEMA: red = offload now and isolate; amber = repair
 *           within 4 weeks, don't reload once empty; green = within limits, monitor)
 *   data { levels:[], part, note, photos:[url], reportedById, reportedBy, reportedAt,
 *          suggested (the reporter's rating), confirmedBy, confirmedAt,
 *          offloadedAt, offloadedBy, repairBooked, seenAgain:[{ by, at, note, photos }],
 *          repair:{ by, at, note, photos }, dismissed:{ by, at, why },
 *          alertedAt (red alert emailed), history:[{ at, by, text }] }
 *
 * A CHECK  racking_checks { id, kind: weekly | expert, data: { date, by, aisles, notes,
 *   inspector, nextDue, file } }
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const RACKING_SETTINGS_ID = "racking";
export const DEFAULT_LEVELS = ["A", "B", "C", "D", "E"];
export const RATINGS = [
  { id: "red", label: "Red: unsafe", short: "Red", help: "Offload now and keep people and trucks clear", colour: "#ef4444" },
  { id: "amber", label: "Amber: needs repair", short: "Amber", help: "Repair within 4 weeks; don't reload once empty", colour: "#f59e0b" },
  { id: "green", label: "Green: minor", short: "Green", help: "Within limits; keep an eye on it", colour: "#10b981" },
];
export const PARTS = ["Upright", "Beam", "Beam lock / safety pin", "Bracing", "Baseplate / floor fixing", "Decking / mesh", "Column guard", "Something else"];
const RANK = { red: 0, amber: 1, green: 2 };

export const DEFAULT_RACKING_SETTINGS = { checkEveryDays: 7, expertEveryMonths: 12, amberDays: 28, defaultLevels: DEFAULT_LEVELS };
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
export function cleanLevels(v) {
  const list = (Array.isArray(v) ? v : String(v || "").split(/[\s,]+/)).map(x => String(x).trim().toUpperCase().slice(0, 4)).filter(Boolean);
  return [...new Set(list)].slice(0, 15);
}
export function normaliseRackingSettings(d) {
  const s = d && typeof d === "object" ? d : {};
  const lv = cleanLevels(s.defaultLevels);
  return { checkEveryDays: int(s.checkEveryDays, 1, 90, 7), expertEveryMonths: int(s.expertEveryMonths, 1, 36, 12), amberDays: int(s.amberDays, 1, 90, 28), defaultLevels: lv.length ? lv : DEFAULT_LEVELS };
}

/** "3" → "03" (aisles sort and read nicely); letters are kept as typed, upper case. */
export const aisleCode = a => { const t = String(a || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); return /^\d$/.test(t) ? `0${t}` : t; };
export const bayCode = (aisle, bay) => `${aisleCode(aisle)}-${String(Math.round(Number(bay)) || 0).padStart(2, "0")}`;
export const bayName = loc => (loc ? `Aisle ${loc.aisle} · Bay ${String(loc.bay).padStart(2, "0")}` : "");
export const bayLink = (code, origin) => `${String(origin || "").replace(/\/+$/, "")}/?rack=${encodeURIComponent(code)}`;

/** New bays: aisles × bays from–to, each with the levels given. Existing codes are skipped. */
export function makeBays({ aisles, from = 1, to = 1, levels = DEFAULT_LEVELS }, existing = []) {
  const have = new Set(existing.map(x => x.id));
  const list = (Array.isArray(aisles) ? aisles : String(aisles || "").split(/[\s,]+/)).map(aisleCode).filter(Boolean);
  const lo = int(from, 1, 999, 1), hi = int(to, 1, 999, lo);
  const lv = cleanLevels(levels).length ? cleanLevels(levels) : DEFAULT_LEVELS;
  const out = [];
  for (const a of [...new Set(list)]) for (let b = Math.min(lo, hi); b <= Math.max(lo, hi); b++) {
    const id = bayCode(a, b);
    if (!have.has(id)) { out.push({ id, aisle: a, bay: b, data: { levels: lv, active: true } }); have.add(id); }
  }
  return out.slice(0, 2000);
}

const newId = now => `rk_${Date.parse(now).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const txt = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const hist = (d, at, by, text) => [...(d.history || []), { at, by, text }].slice(-100);

/** A new damage report from whoever scanned the bay. */
export function newDamage({ loc, levels, part, rating = "amber", note = "", photos = [], user, now = new Date().toISOString() }) {
  const r = RANK[rating] != null ? rating : "amber";
  const order = (loc && (loc.data || {}).levels) || null;
  const lv = cleanLevels(levels).filter(l => !order || order.includes(l)).sort((a, b) => (order ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b)));
  const data = { levels: lv, part: PARTS.includes(part) ? part : "Something else", note: txt(note, 400), photos: photos.slice(0, 6),
    reportedById: String(user.id), reportedBy: user.name || "", reportedAt: now, suggested: r, seenAgain: [], history: [{ at: now, by: user.name || "", text: `Reported (${r})` }] };
  return { id: newId(now), location_id: loc.id, status: "open", rating: r, data };
}
/** Someone else saw it again (anyone signed in). */
export function seenAgain(row, { user, note = "", photos = [] }, now = new Date().toISOString()) {
  const d = row.data || {};
  return { ...row, data: { ...d, seenAgain: [...(d.seenAgain || []), { by: user.name || "", at: now, note: txt(note, 300), photos: photos.slice(0, 4) }].slice(-50) } };
}
/** A racking inspector confirms or changes the rating. */
export function confirmRating(row, { rating, by, note = "" }, now = new Date().toISOString()) {
  const d = row.data || {};
  const r = RANK[rating] != null ? rating : row.rating;
  const changed = r !== row.rating;
  // a report that becomes red needs its alert (again)
  const alert = r === "red" && row.rating !== "red" ? { alertedAt: null } : {};
  return { ...row, rating: r, data: { ...d, ...alert, confirmedBy: by, confirmedAt: now, history: hist(d, now, by, changed ? `Rating changed to ${r}${note ? `: ${note}` : ""}` : `Rating confirmed (${r})${note ? `: ${note}` : ""}`) } };
}
export function markOffloaded(row, { by }, now = new Date().toISOString()) {
  const d = row.data || {};
  return { ...row, data: { ...d, offloadedAt: now, offloadedBy: by, history: hist(d, now, by, "Bay offloaded") } };
}
export function bookRepair(row, { by, date }, now = new Date().toISOString()) {
  const d = row.data || {};
  return { ...row, data: { ...d, repairBooked: txt(date, 10), history: hist(d, now, by, `Repair booked for ${String(date).split("-").reverse().join("/")}`) } };
}
export function recordRepair(row, { by, note = "", photos = [], on }, now = new Date().toISOString()) {
  const d = row.data || {};
  return { ...row, status: "repaired", data: { ...d, repair: { by, at: on ? `${on}T12:00:00.000Z` : now, note: txt(note, 400), photos: photos.slice(0, 6) }, history: hist(d, now, by, `Repaired${note ? `: ${note}` : ""}`) } };
}
export function dismissDamage(row, { by, why = "" }, now = new Date().toISOString()) {
  const d = row.data || {};
  return { ...row, status: "dismissed", data: { ...d, dismissed: { by, at: now, why: txt(why, 300) }, history: hist(d, now, by, `Closed without repair${why ? `: ${why}` : ""}`) } };
}

export const daysBetween = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
/** When an amber must be repaired by (reported + amberDays). */
export const amberDue = (row, s = DEFAULT_RACKING_SETTINGS) => new Date(Date.parse((row.data || {}).reportedAt || row.created_at) + s.amberDays * 86400000).toISOString().slice(0, 10);
export function damageState(row, s = DEFAULT_RACKING_SETTINGS, now = new Date().toISOString()) {
  const d = row.data || {};
  if (row.status === "repaired") return { key: "repaired", label: "Repaired", tone: "grey" };
  if (row.status === "dismissed") return { key: "dismissed", label: "Closed", tone: "grey" };
  const unconfirmed = !d.confirmedAt;
  if (row.rating === "red") return { key: "red", label: d.offloadedAt ? "Red · offloaded" : "Red · offload now", tone: "red", unconfirmed };
  if (row.rating === "amber") { const due = amberDue(row, s); const late = due < now.slice(0, 10);
    return { key: late ? "amberLate" : "amber", label: late ? "Amber · repair overdue" : "Amber", tone: "amber", due, late, unconfirmed }; }
  return { key: "green", label: "Green · monitor", tone: "green", unconfirmed };
}
/** The worst open rating per bay: { "03-12": "amber", … }. */
export function worstByBay(rows) {
  const out = {};
  rows.forEach(r => { if (r.status !== "open") return; const cur = out[r.location_id]; if (cur == null || RANK[r.rating] < RANK[cur]) out[r.location_id] = r.rating; });
  return out;
}
export function rackingSummary(rows, checks = [], s = DEFAULT_RACKING_SETTINGS, now = new Date().toISOString()) {
  const open = rows.filter(r => r.status === "open");
  const st = open.map(r => damageState(r, s, now));
  const last = kind => checks.filter(c => c.kind === kind).map(c => (c.data || {}).date).filter(Boolean).sort().pop() || null;
  const lastWeekly = last("weekly"), lastExpert = last("expert");
  const weeklyDue = lastWeekly ? new Date(Date.parse(`${lastWeekly}T12:00:00Z`) + s.checkEveryDays * 86400000).toISOString().slice(0, 10) : null;
  const expertRow = checks.filter(c => c.kind === "expert").sort((a, b) => String((b.data || {}).date).localeCompare(String((a.data || {}).date)))[0];
  const expertDue = expertRow ? ((expertRow.data || {}).nextDue || null) : null;
  return { red: st.filter(x => x.key === "red").length, redNotOffloaded: open.filter(r => r.rating === "red" && !(r.data || {}).offloadedAt).length,
    amber: st.filter(x => x.tone === "amber").length, amberLate: st.filter(x => x.key === "amberLate").length, green: st.filter(x => x.key === "green").length,
    unconfirmed: st.filter(x => x.unconfirmed).length, lastWeekly, weeklyDue, weeklyLate: !weeklyDue || weeklyDue < now.slice(0, 10), lastExpert, expertDue, expertLate: !!expertDue && expertDue < now.slice(0, 10) };
}

/** The red-alert email wording (rackingJob.mjs). */
export function rackingAlertText(row, loc) {
  const d = row.data || {};
  const where = loc ? bayName(loc) : row.location_id;
  return { subject: `RED racking damage: ${where}${d.levels && d.levels.length ? `, level ${d.levels.join("/")}` : ""}`,
    lead: `${d.reportedBy || "Someone"} has reported red (unsafe) racking damage at ${where}. The bay should be offloaded and kept clear until it's repaired.`,
    detail: [d.part, d.levels && d.levels.length ? `Level ${d.levels.join(", ")}` : "", d.note ? `"${d.note}"` : ""].filter(Boolean).join(" · ") };
}
