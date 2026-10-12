/**
 * ═══════════════════════════════════════════════════════════════════════════
 * domains/inspections/inspectionScore.js — how a site inspection is scored
 * ═══════════════════════════════════════════════════════════════════════════
 * One set of rules for the computer (Site Inspections tab), the phone, Fire Safety,
 * the monthly management report and the dashboards:
 *
 *   each question: Compliant 2 points · Partial 1 · Non-compliant 0
 *   a question not answered, or answered N/A, is left out of BOTH the score and
 *   the maximum, so skipping an item that doesn't apply can't drag the score down
 *   (the phone always worked this way; the computer used to count it as 0)
 *   score % = points ÷ maximum
 *   bands:  90%+ Excellent · 75%+ Good · 60%+ Satisfactory · below 60% Requires Improvement
 * Pure JS (no React).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Points for one answer (2 / 1 / 0), or null when it doesn't count (not answered / N/A). */
export function answerPoints(a) {
  if (a === 2 || a === "pass") return 2;
  if (a === 1 || a === "partial") return 1;
  if (a === 0 || a === "issue" || a === "fail") return 0;
  return null;
}

/**
 * @param sectionDefs  [{ id, questions:[{ id }] }]
 * @param answers      { [sectionId]: { [questionId]: answer } }
 * @returns { earned, possible }
 */
export function scoreAnswers(sectionDefs, answers) {
  let earned = 0, possible = 0;
  (sectionDefs || []).forEach(sec => (sec.questions || []).forEach(q => {
    const p = answerPoints(((answers || {})[sec.id] || {})[q.id]);
    if (p === null) return;
    earned += p; possible += 2;
  }));
  return { earned, possible };
}

/** A saved inspection's score as a whole %, or null if it has no maximum. */
export const inspectionPct = ins => ins && Number(ins.maxScore) > 0 ? Math.round((Number(ins.overallScore) || 0) / Number(ins.maxScore) * 100) : null;

/** Band for a score %: { key, label, color } (screen colours; see PRINT_SCORE_COLOR for print). */
export function scoreBand(pct) {
  if (pct === null || pct === undefined) return { key: "none", label: "Not scored", color: "#64748b" };
  if (pct >= 90) return { key: "excellent", label: "Excellent", color: "#10b981" };
  if (pct >= 75) return { key: "good", label: "Good", color: "#f59e0b" };
  if (pct >= 60) return { key: "satisfactory", label: "Satisfactory", color: "#fb923c" };
  return { key: "improve", label: "Requires Improvement", color: "#ef4444" };
}

/** Darker band colours for printed / downloaded reports. */
export const PRINT_SCORE_COLOR = { excellent: "#047857", good: "#b45309", satisfactory: "#c2410c", improve: "#b91c1c", none: "#64748b" };
