import { todayISO } from "../../lib/dates";
/**
 * quickReportStatus.js — "finish your quick hazard report" reminder rules.
 *
 * A quick hazard report (QuickReportModal / mobile ReportHazard) only captures
 * what / where / urgency. It counts as INCOMPLETE until the full incident form
 * has been saved for it. The full form makes Accident Code and Number Code
 * mandatory and quick reports never set them, so their absence is the
 * completion signal — no extra database column needed.
 *
 * Depends on quick_report being persisted (quick_report_columns.sql); without it
 * the quickReport flag is lost on reload and no reminders would show.
 *
 * Deadline: end of the day after the report date (only the date is stored).
 * Dates are compared as YYYY-MM-DD strings in UTC, like the rest of the app.
 */

/** true if this is an open quick report still missing its full details. */
function isIncompleteQuickReport(inc) {
  return !!inc && !!inc.quickReport && !inc.closed && (!inc.accidentCode || !inc.numberCode);
}

/** The logged-in user's incomplete quick reports, oldest first. */
function myIncompleteQuickReports(incidents, userId) {
  return (incidents || [])
    .filter(i => isIncompleteQuickReport(i) && String(i.reportedBy) === String(userId))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** YYYY-MM-DD the full report is due (report date + 1 day). */
function quickReportDueDate(inc) {
  const [y, m, d] = String(inc.date || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** true once the due date has passed. */
function isQuickReportOverdue(inc, today = todayISO()) {
  const due = quickReportDueDate(inc);
  return !!due && today > due;
}

/** Short label, e.g. "Due by 2026-09-29" / "Overdue since 2026-09-29". */
function quickReportDueLabel(inc) {
  const due = quickReportDueDate(inc);
  if (!due) return "";
  return isQuickReportOverdue(inc) ? `Overdue since ${due}` : `Due by ${due}`;
}

export { isIncompleteQuickReport, myIncompleteQuickReports, quickReportDueDate, isQuickReportOverdue, quickReportDueLabel };
