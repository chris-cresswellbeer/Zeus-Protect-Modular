/**
 * fireLogic.js — one set of fire safety rules for the Fire Safety screen, the admin
 * dashboard card and the admin bell (they used to each work it out separately).
 * Pure functions, no React.
 *
 * FIRE WARDENS come from two places:
 *   • the Fire Warden certificate on a staff member (ext_certs, cert type "fire_marshall"
 *     — the id keeps its old spelling). Added on Fire Safety → Wardens or on
 *     Assign Training → External Certificates; both write the same record:
 *       { issuedDate, expiryDate, zones:[..], fileName, fileUrl, uploadedAt }
 *   • older typed-in warden records (fire_wardens: { id, name, zone, qualDate,
 *     renewalMonths }) that aren't linked to a staff member yet. They still count, and
 *     the screen offers "Link to staff" to turn each into a certificate record.
 *   If a person has both, the certificate wins. Leavers are left out.
 *
 * DRILLS and FIRE RISK ASSESSMENTS can also be recorded as checklist inspections
 * (Inspections → Fire Drill / Fire Risk Assessment). Those are shown in the Fire Safety
 * logs too, and count towards "last drill" and "next FRA review", so there is one
 * place to look. A log entry and an inspection on the same date are shown as one.
 */
import { EXPIRY_WARNING_DAYS } from "../../lib/dates";

export const WARDEN_CERT = "fire_marshall";
export const DRILL_INSPECTION = "fire_drill";
export const FRA_INSPECTION = "fire_risk";

const okDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) && !isNaN(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))) ? d.slice(0, 10) : null;
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
/** "YYYY-MM-DD" + n months, worked out in UTC so a clock change can't shift the day. */
export const plusMonths = (d, n) => { const s = okDate(d); if (!s) return ""; const t = new Date(utc(s)); t.setUTCMonth(t.getUTCMonth() + Number(n || 0)); return t.toISOString().slice(0, 10); };
export const todayLocal = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
/** Whole days from today to d (negative = in the past); null for no / bad date. */
export const daysFrom = (d, today = todayLocal()) => { const s = okDate(d); return s ? Math.round((utc(s) - utc(today)) / 86400000) : null; };

/** Status of an expiry date: expired / expiring (within the warning window) / valid / unknown. */
export function expiryState(expiry, today = todayLocal()) {
  const d = daysFrom(expiry, today);
  if (d == null) return { key: "unknown", label: "No expiry date", color: "#64748b", bg: "rgba(100,116,139,0.14)", days: null };
  if (d < 0) return { key: "expired", label: "Expired", color: "#ef4444", bg: "rgba(239,68,68,0.15)", days: d };
  if (d <= EXPIRY_WARNING_DAYS) return { key: "expiring", label: `Expires in ${d}d`, color: "#f59e0b", bg: "rgba(245,158,11,0.15)", days: d };
  return { key: "valid", label: "Valid", color: "#10b981", bg: "rgba(16,185,129,0.12)", days: d };
}

const nameKey = s => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Everyone who is a fire warden, newest information first.
 * → [{ key, source:"cert"|"record", staffId, name, jobTitle, zones:[..], issued, expiry,
 *      fileName, fileUrl, cert, record, state }]
 */
export function wardenList({ wardens = [], extCerts = {}, staff = [], today = todayLocal() }) {
  const out = [];
  const certIds = new Set();
  for (const s of staff || []) {
    if (s.status === "leaver") continue;                         // leavers aren't wardens any more
    const c = (extCerts[s.id] || extCerts[String(s.id)] || {})[WARDEN_CERT];
    if (!c) continue;
    certIds.add(String(s.id));
    out.push({ key: `cert_${s.id}`, source: "cert", staffId: String(s.id), name: s.name, jobTitle: s.jobTitle || "",
      zones: Array.isArray(c.zones) ? c.zones : [], issued: okDate(c.issuedDate) || "", expiry: okDate(c.expiryDate) || "",
      fileName: c.fileName || "", fileUrl: c.fileUrl || "", cert: c, record: null, state: expiryState(c.expiryDate, today) });
  }
  const current = (staff || []).filter(s => s.status !== "leaver");
  const byName = new Map(current.map(s => [nameKey(s.name), s]));
  for (const w of wardens || []) {
    const sid = w.staffId != null && w.staffId !== "" ? String(w.staffId) : null;
    if (sid && certIds.has(sid)) continue;                       // the certificate wins
    // trust a stored staff id only if it is the same person by name (old records carried ids
    // from a different staff list); otherwise look the name up
    if (sid && (staff || []).some(s => String(s.id) === sid && s.status === "leaver")) continue;   // a leaver's old entry
    const byId = sid ? current.find(s => String(s.id) === sid) : null;
    const match = byId && (!w.name || nameKey(byId.name) === nameKey(w.name)) ? byId : byName.get(nameKey(w.name)) || null;
    if (match && certIds.has(String(match.id))) continue;
    const expiry = plusMonths(w.qualDate, w.renewalMonths || 36);
    out.push({ key: `rec_${w.id}`, source: "record", staffId: match ? String(match.id) : null, name: w.name || (match && match.name) || "(no name)",
      jobTitle: match ? match.jobTitle || "" : "", zones: w.zone ? [w.zone] : [], issued: okDate(w.qualDate) || "", expiry,
      fileName: "", fileUrl: "", cert: null, record: w, state: expiryState(expiry, today) });
  }
  const rank = { expired: 0, expiring: 1, unknown: 2, valid: 3 };
  return out.sort((a, b) => rank[a.state.key] - rank[b.state.key] || a.name.localeCompare(b.name));
}

/** Drill log + Fire Drill inspections, newest first. Same date → one entry. */
export function drillLog(drills = [], inspections = []) {
  const insp = (inspections || []).filter(i => i.type === DRILL_INSPECTION && okDate(i.date));
  const used = new Set();
  const rows = (drills || []).filter(d => okDate(d.date)).map(d => {
    const i = insp.find(x => x.date === d.date && !used.has(x.id));
    if (i) used.add(i.id);
    return { key: `d_${d.id}`, date: d.date, drill: d, inspection: i || null };
  });
  insp.filter(i => !used.has(i.id)).forEach(i => rows.push({ key: `i_${i.id}`, date: i.date, drill: null, inspection: i }));
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/** FRA review log + Fire Risk Assessment inspections, newest first. Same date → one entry.
 *  Each row's `nextDue` is the review's next-review date, or the inspection's next-due. */
export function fraLog(fraReviews = [], inspections = []) {
  const insp = (inspections || []).filter(i => i.type === FRA_INSPECTION && okDate(i.date));
  const used = new Set();
  const rows = (fraReviews || []).filter(r => okDate(r.date)).map(r => {
    const i = insp.find(x => x.date === r.date && !used.has(x.id));
    if (i) used.add(i.id);
    return { key: `r_${r.id}`, date: r.date, review: r, inspection: i || null, nextDue: okDate(r.nextReviewDue) || (i && okDate(i.nextDue)) || "" };
  });
  insp.filter(i => !used.has(i.id)).forEach(i => rows.push({ key: `i_${i.id}`, date: i.date, review: null, inspection: i, nextDue: okDate(i.nextDue) || "" }));
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/** Everything the summary tiles, dashboard card and bell need. */
export function fireSummary({ fireSafety = {}, extCerts = {}, staff = [], inspections = [], today = todayLocal() }) {
  const wardens = wardenList({ wardens: fireSafety.wardens, extCerts, staff, today });
  const drills = drillLog(fireSafety.drills, inspections);
  const fras = fraLog(fireSafety.fraReviews, inspections);
  const lastDrill = drills[0] || null;
  const daysSinceDrill = lastDrill ? -daysFrom(lastDrill.date, today) : null;
  const extinguishers = fireSafety.extinguishers || [];
  const overdueExtinguishers = extinguishers.filter(e => { const d = daysFrom(e.nextServiceDue, today); return d != null && d < 0; });
  // the newest entry that has a next-review date (a checklist without one doesn't hide it)
  const fraNext = (fras.find(r => r.nextDue) || {}).nextDue || "";
  const fraDays = daysFrom(fraNext, today);
  const expiredWardens = wardens.filter(w => w.state.key === "expired");
  const expiringWardens = wardens.filter(w => w.state.key === "expiring");
  const undatedWardens = wardens.filter(w => w.state.key === "unknown");
  const drillOverdue = daysSinceDrill != null && daysSinceDrill > 365;
  const fraOverdue = fraDays != null && fraDays < 0;
  return {
    wardens, expiredWardens, expiringWardens, undatedWardens, unlinkedWardens: wardens.filter(w => w.source === "record"),
    drills, lastDrill, daysSinceDrill, drillOverdue,
    extinguishers, overdueExtinguishers,
    fras, fraNext, fraDays, fraOverdue,
    issues: expiredWardens.length + undatedWardens.length + overdueExtinguishers.length + (fraOverdue ? 1 : 0) + (drillOverdue ? 1 : 0),
  };
}
