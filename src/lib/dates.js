/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/dates.js — Date helpers for training/certificate expiry
 * ═══════════════════════════════════════════════════════════════════════════
 * Used wherever something "expires N months after completion" — training
 * records, machinery competence, external certificates, etc.
 *
 * TIMEZONE NOTE:
 *   `new Date("2026-03-01")` (date-only ISO string) is parsed as UTC midnight,
 *   while `new Date()` is local time. For UK usage the difference is at most
 *   one hour, so day counts can occasionally be off by one around midnight.
 *   This is acceptable for "expires in N days" badges; do not rely on it for
 *   anything legally time-critical.
 *
 * COLOUR NOTE:
 *   getExpiryStatus() returns hard-coded hex colours (red/amber/green). These
 *   pre-date the theme token system (theme/tokens.js). If you restyle status
 *   badges, consider switching callers to theme tokens instead.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Adds a number of calendar months to a date.
 * @param {string|Date} dateStr  Any value accepted by `new Date(...)`, usually "YYYY-MM-DD".
 * @param {number} months       Months to add (can be negative).
 * @returns {Date} A NEW Date object (input is not mutated).
 *
 * Edge case: JS rolls over month-ends, e.g. 31 Jan + 1 month = 3 Mar (not 28 Feb).
 */
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Works out whether something with a renewal period is valid, expiring soon or expired.
 *
 * @param {string} completionDate  Date the training/cert was completed ("YYYY-MM-DD").
 * @param {number} renewalMonths   How many months it stays valid for (e.g. 12, 36).
 * @returns {null | {
 *   expiryDate: string,   // "YYYY-MM-DD"
 *   daysLeft: number,     // negative once expired
 *   status: "valid"|"expiring"|"expired",
 *   label: string,        // ready-to-display text for a badge
 *   color: string,        // text colour for the badge
 *   bg: string            // background colour for the badge
 * }}
 * Returns null when either input is missing (i.e. "no renewal required").
 *
 * The "expiring" warning window is EXPIRY_WARNING_DAYS (below).
 */
/**
 * How many days before expiry something counts as "expiring" (amber) — used by
 * EVERY expiry warning in the portal: training modules, external certificates,
 * machinery licences, fire wardens, first aiders, the staff dashboard tile and
 * the notification bell. Change this one number to change them all.
 */
const EXPIRY_WARNING_DAYS = 60;

function getExpiryStatus(completionDate, renewalMonths) {
  // returns: { expiryDate, daysLeft, status: "valid"|"expiring"|"expired", label }
  if (!completionDate || !renewalMonths) return null;
  const expiry = addMonths(completionDate, renewalMonths);
  const today  = new Date();
  // Milliseconds → whole days, rounded UP so "expires later today" still counts as 1 day left.
  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  const expiryStr = localISO(expiry);
  if (daysLeft < 0)  return { expiryDate:expiryStr, daysLeft, status:"expired",  label:"Expired",          color:"#ef4444", bg:"rgba(239,68,68,0.15)"  };
  if (daysLeft <= EXPIRY_WARNING_DAYS) return { expiryDate:expiryStr, daysLeft, status:"expiring", label:`Expires in ${daysLeft}d`, color:"#f59e0b", bg:"rgba(245,158,11,0.15)" };
  return               { expiryDate:expiryStr, daysLeft, status:"valid",    label:`Valid until ${expiryStr}`,  color:"#10b981", bg:"rgba(16,185,129,0.12)" };
}

// (Leftover section marker from the original single-file build — the logo now lives in shared/Logo.jsx.)
// ─── Zeus Logo SVG (text-based approximation) ────────────────────────────────

/**
 * Dates as "YYYY-MM-DD" in the computer's own (UK) time. Use these, not
 * new Date().toISOString().slice(0,10), which gives the UTC date: during British
 * Summer Time anything between midnight and 1am would get yesterday's date.
 */
function localISO(d = new Date()) {
  const t = d instanceof Date ? d : new Date(d);
  if (isNaN(t)) return "";
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
const todayISO = () => localISO(new Date());
/** "YYYY-MM-DDTHH:mm" in local time — the format of <input type="datetime-local">. */
const localDateTime = (d = new Date()) => { const t = d instanceof Date ? d : new Date(d); return isNaN(t) ? "" : `${localISO(t)}T${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`; };

/**
 * A stored date for showing to people, the UK way: "2026-10-14" → "14/10/2026",
 * "2026-10-14T09:30" → "14/10/2026 09:30". Anything that isn't a stored date (already
 * formatted, empty, "TBD") comes back as it is, so it's safe to use on any value.
 */
function ukDate(v) {
  if (v === null || v === undefined) return v;
  const str = String(v);
  // a moment in time (ends in Z or +01:00): shown in UK local time
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d)) return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(str);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ""}`;
}

export { addMonths, getExpiryStatus, EXPIRY_WARNING_DAYS, localISO, todayISO, localDateTime, ukDate };
