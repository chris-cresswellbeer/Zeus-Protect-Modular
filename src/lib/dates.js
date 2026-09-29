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
  const expiryStr = expiry.toISOString().slice(0,10);
  if (daysLeft < 0)  return { expiryDate:expiryStr, daysLeft, status:"expired",  label:"Expired",          color:"#ef4444", bg:"rgba(239,68,68,0.15)"  };
  if (daysLeft <= EXPIRY_WARNING_DAYS) return { expiryDate:expiryStr, daysLeft, status:"expiring", label:`Expires in ${daysLeft}d`, color:"#f59e0b", bg:"rgba(245,158,11,0.15)" };
  return               { expiryDate:expiryStr, daysLeft, status:"valid",    label:`Valid until ${expiryStr}`,  color:"#10b981", bg:"rgba(16,185,129,0.12)" };
}

// (Leftover section marker from the original single-file build — the logo now lives in shared/Logo.jsx.)
// ─── Zeus Logo SVG (text-based approximation) ────────────────────────────────

export { addMonths, getExpiryStatus, EXPIRY_WARNING_DAYS };
