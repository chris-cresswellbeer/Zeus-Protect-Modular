/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/actionStatus.js — one meaning of "done" for incident corrective actions
 * ═══════════════════════════════════════════════════════════════════════════
 * Investigation actions used to be marked done in different ways:
 *   • the Investigation tab and the phone set status "complete" (no date / completedDate)
 *   • My Actions on a computer set "complete" with completedAt
 *   • the printed investigation report only counted status "closed"
 * so an action ticked off in one place could still show as open in another.
 *
 * From now on every part of the portal uses these helpers:
 *   status "complete" + completedDate (YYYY-MM-DD) + completedBy (name).
 * Older records are still read correctly ("closed", "done", "Completed" all count
 * as done; completedAt is read when completedDate is missing), and
 * action_status_fix.sql tidies the stored records once.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const DONE = new Set(["complete", "completed", "closed", "done"]);

/** Is this action finished? */
export const isActionDone = a => !!a && DONE.has(String(a.status || "").trim().toLowerCase());

/** The date it was finished ("" if not recorded). */
export const actionDoneDate = a => (a && (a.completedDate || a.completedAt)) || "";

/** Mark an action done (keeps an existing completion date/name if it already was). */
export function completeAction(a, by, date) {
  const { completedAt, ...rest } = a || {};   // eslint-disable-line no-unused-vars
  return {
    ...rest,
    status: "complete",
    completedDate: (isActionDone(a) && actionDoneDate(a)) || date || "",
    completedBy: (isActionDone(a) && a.completedBy) || by || "",
  };
}

/** Re-open an action (clears who/when it was finished, and any manager sign-off). */
export function reopenAction(a) {
  const { completedAt, completedDate, completedBy, managerSignOff, ...rest } = a || {};   // eslint-disable-line no-unused-vars
  return { ...rest, status: "open" };
}
