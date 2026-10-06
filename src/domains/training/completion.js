/**
 * completion.js — small helpers for training completion records.
 *
 * A completion is either
 *   • a quiz result: { score, date, certId, answers, moduleVersion }, or
 *   • a RECORDED completion, entered by an admin for training done before the
 *     portal (e.g. on the old system): { score: null, date, certId: null,
 *     moduleVersion, recorded: { by, byId, at, note } }.
 * Recorded completions count as complete (and expire from their date like any
 * other), but have no score, no answers and no portal certificate.
 */
import { localISO } from "../../lib/dates";

export const PASS_MARK = 70;   // the default; each module can set its own (passMark, 50–100)

/** A module's pass mark (%): its own setting if valid, otherwise 70. */
export const passMarkOf = m => { const n = Number(m && m.passMark); return n >= 50 && n <= 100 ? Math.round(n) : PASS_MARK; };

/**
 * Completed and passed. A recorded completion always counts, and so does any
 * result with a certificate (a certificate is only issued on a pass, so a result
 * stays passed if the module's pass mark is raised later). Older results without
 * a certificate id are judged against the module's pass mark (default 70%).
 */
export const isPassed = (c, m) => !!c && (!!c.recorded || !!c.certId || Number(c.score) >= passMarkOf(m));

/** "85%" for a quiz result, "Recorded" for a recorded completion. */
export const scoreText = c => !c ? "—" : c.recorded ? "Recorded" : `${c.score}%`;

/** One-line description of who recorded it, for tooltips and detail lines. */
export const recordedText = c => {
  const r = c && c.recorded; if (!r) return "";
  const on = r.at ? (isNaN(new Date(r.at)) ? String(r.at).slice(0, 10) : localISO(new Date(r.at))) : "";   // UK date
  return `Recorded by ${r.by || "an administrator"}${on ? ` on ${on}` : ""}${r.note ? ` — ${r.note}` : ""}`;
};

/**
 * Parse a completion date typed by a person or exported from another system.
 * Accepts 2025-03-14, 14/03/2025, 14/03/25, 14-03-2025 and 14.03.2025 (day first,
 * as used in the UK and Ireland). Returns "YYYY-MM-DD", or null if it isn't a
 * real date or is in the future.
 */
export function parseCompletionDate(s, today = new Date()) {
  const t = String(s || "").trim();
  let y, m, d, mm;
  if ((mm = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +mm[1]; m = +mm[2]; d = +mm[3]; }
  else if ((mm = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) { d = +mm[1]; m = +mm[2]; y = +mm[3]; if (y < 100) y += 2000; }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  const iso = dt.toISOString().slice(0, 10);
  const now = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString().slice(0, 10);
  if (iso > now || y < 1990) return null;
  return iso;
}
