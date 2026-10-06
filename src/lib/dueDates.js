import { localISO, todayISO } from "./dates";
/**
 * dueDates.js — optional "complete by" dates on assigned training.
 *
 * Stored on the assignment itself: training_assigns.due_date (date, may be null)
 * — added by assign_due_dates.sql. In the app: dueDates = { [userId]: { [moduleId]: "YYYY-MM-DD" } }.
 *
 * A module is OVERDUE when it has a due date before today and hasn't been passed.
 * Once passed, its due date no longer matters (renewals are handled by expiry dates).
 */

export const today = () => todayISO();

export function addDays(n, from) {
  const d = from ? new Date(from + "T12:00:00") : new Date();
  d.setDate(d.getDate() + n);
  return localISO(d);
}

/** rows from training_assigns → { uid: { mid: due } } (only rows that have a due date) */
export function mapDueRows(rows) {
  const map = {};
  (rows || []).forEach(r => {
    if (!r || !r.due_date) return;
    const uid = String(r.user_id);
    (map[uid] = map[uid] || {})[String(r.module_id)] = String(r.due_date).slice(0, 10);
  });
  return map;
}

export const dueOf = (dueDates, uid, mid) => ((dueDates || {})[String(uid)] || {})[String(mid)] || null;

/** Days from today to the due date (negative = overdue). */
export function daysUntil(due) {
  if (!due) return null;
  return Math.round((new Date(due + "T12:00:00") - new Date(today() + "T12:00:00")) / 86400000);
}

/** { due, days, overdue, soon } for an assignment that isn't done yet, else null. */
export function dueInfo(dueDates, uid, mid, done) {
  const due = dueOf(dueDates, uid, mid);
  if (!due || done) return null;
  const days = daysUntil(due);
  return { due, days, overdue: days < 0, soon: days >= 0 && days <= 7 };
}

export function formatDue(due) {
  if (!due) return "";
  return new Date(due + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "Overdue by 3 days" / "Due today" / "Due in 5 days" / "Due 14 Oct 2026" */
export function dueText(info) {
  if (!info) return "";
  const { days, due } = info;
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 14) return `Due in ${days} days`;
  return `Due ${formatDue(due)}`;
}

/** Choices for "Due by" pickers. */
export const DUE_CHOICES = [
  { value: "", label: "No due date" },
  { value: "7", label: "In 1 week" },
  { value: "14", label: "In 2 weeks" },
  { value: "30", label: "In 30 days" },
  { value: "date", label: "Pick a date…" },
];

/** Count of overdue assignments per person: { uid: n } (passed = fn(uid, mid) → bool) */
export function overdueByPerson(assigns, dueDates, passed) {
  const out = {};
  Object.entries(assigns || {}).forEach(([uid, mids]) => {
    const n = (mids || []).filter(mid => { const i = dueInfo(dueDates, uid, mid, passed(uid, mid)); return i && i.overdue; }).length;
    if (n) out[uid] = n;
  });
  return out;
}
