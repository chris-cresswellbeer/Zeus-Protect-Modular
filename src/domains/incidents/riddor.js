/**
 * riddor.js — when a RIDDOR report has to reach the HSE (RIDDOR 2013).
 *
 *   Death, specified injury, dangerous occurrence ... within 10 days of the incident
 *     (deaths and specified injuries must also be notified without delay)
 *   Over-7-day incapacitation of a worker ........... within 15 days of the incident
 *   Member of the public taken to hospital .......... within 10 days
 *   Occupational disease ............................ as soon as it is diagnosed (no fixed date)
 *
 * Deaths and specified injuries (and, until the type is chosen, every RIDDOR incident) are
 * flagged "notify HSE now": the law says without delay, with the full report by the date.
 *
 * The category is chosen on the incident (Incidents → the RIDDOR box) and stored as
 * `riddorCategory` (in the incident's details). Until it is chosen, the 10-day deadline
 * is used, because it is the shortest.
 */
import { todayISO } from "../../lib/dates";

export const RIDDOR_CATEGORIES = [
  { id: "specified", label: "Death, specified injury or dangerous occurrence", days: 10 },
  { id: "over7", label: "Over-7-day injury", days: 15 },
  { id: "public", label: "Member of the public taken to hospital", days: 10 },
  { id: "disease", label: "Occupational disease", days: null },
];
export const RIDDOR_SOON_DAYS = 3;   // "due soon" from this many days before

const okDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const plusDays = (d, n) => new Date(utc(d) + n * 86400000).toISOString().slice(0, 10);   // UTC maths on a plain date

/**
 * The deadline for an unreported RIDDOR incident, or null when nothing is due
 * (not RIDDOR, already reported). Returns
 *   { dueDate, daysLeft, state: "overdue"|"soon"|"ok"|"asap", category, assumed }
 */
export function riddorDue(inc, today = todayISO()) {
  if (!inc || !inc.riddor || inc.riddorReported) return null;
  const known = RIDDOR_CATEGORIES.find(c => c.id === inc.riddorCategory);
  const category = known || RIDDOR_CATEGORIES[0];
  const notifyNow = category.id === "specified";
  if (category.days == null) return { dueDate: "", daysLeft: null, state: "asap", category, assumed: false, notifyNow: false };
  const start = okDate(inc.date);
  if (!start) return { dueDate: "", daysLeft: null, state: "asap", category, assumed: !known, notifyNow };
  const dueDate = plusDays(start, category.days);
  const daysLeft = Math.round((utc(dueDate) - utc(today)) / 86400000);
  const state = daysLeft < 0 ? "overdue" : daysLeft <= RIDDOR_SOON_DAYS ? "soon" : "ok";
  return { dueDate, daysLeft, state, category, assumed: !known, notifyNow };
}

/** Short label for badges. */
export function riddorBadge(due) {
  if (!due) return "";
  if (due.state === "overdue") return `HSE report ${-due.daysLeft}d late`;
  if (due.state === "asap") return "Report to HSE asap";
  if (due.notifyNow) return "Notify HSE now";
  return due.daysLeft === 0 ? "Report to HSE today" : `Report to HSE in ${due.daysLeft}d`;
}
/** Needs doing now: late, no fixed date, or must be notified without delay. */
export const riddorUrgent = due => !!due && (due.state !== "ok" || due.notifyNow);

/** "dd/mm/yyyy" */
export const ukDate = d => (okDate(d) ? d.slice(0, 10).split("-").reverse().join("/") : "");

/** Short text for a deadline: "Report to HSE by 16/10/2026 (3 days left)" etc. */
export function riddorDueText(due) {
  if (!due) return "";
  if (due.state === "asap") return due.category.days == null ? "Report to HSE as soon as the disease is diagnosed" : "Report to HSE now — the incident has no date";
  const d = ukDate(due.dueDate);
  if (due.state === "overdue") return `HSE report overdue — was due by ${d} (${-due.daysLeft} day${due.daysLeft === -1 ? "" : "s"} late)`;
  const left = due.daysLeft === 0 ? "due today" : `${due.daysLeft} day${due.daysLeft === 1 ? "" : "s"} left`;
  if (due.notifyNow) return `Notify HSE without delay — full report by ${d} (${left})`;
  if (due.daysLeft === 0) return `Report to HSE today (due by ${d})`;
  return `Report to HSE by ${d} (${left})`;
}
