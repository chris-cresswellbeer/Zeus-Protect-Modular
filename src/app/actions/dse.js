/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/dse.js — createDseActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * DSE self-assessments: saving reports, admin responses and the unfinished draft.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { dbWrite, insertNew, sb } from "../../lib/supabase";
import { notify } from "../../shared/Feedback";
import { stableJSON } from "../records";

export function createDseActions(app) {
  const {
    dseDraft, inTurn, setDseActive, setDseAnswers, setDseComments, setDseDraft, setDseSection,
    setDseSubmitted, user
  } = app;

  // Rewrites ALL of a user's DSE reports; report_idx = position in the array (so order matters —
  // admin responses reference reports by this index).
  // One row per assessment (report_idx = position). Compare with what's stored: add new
  // assessments, update changed ones, remove only rows past the end — never clear first.
  function dbSaveDseReport(userId, reports) { return inTurn(`dse:${userId}`, () => saveDseReportNow(userId, reports)); }
  async function saveDseReportNow(userId, reports) {
    const sid = String(userId);
    const { data, error } = await sb.from("dse_reports").query(`select=report_idx,data&user_id=eq.${encodeURIComponent(sid)}`);
    if (error) { notify("The DSE assessment wasn't saved. Please try again.", { kind: "error" }); return false; }
    const stored = new Map((data || []).map(r => [Number(r.report_idx), r.data]));
    const list = reports || [];
    let ok = true;
    const add = list.map((r, i) => [r, i]).filter(([, i]) => !stored.has(i));
    if (add.length) ok = (await insertNew("dse_reports", add.map(([r, i]) => ({ user_id: sid, report_idx: i, data: r })), "DSE reports",
      row => dbWrite(sb.from("dse_reports").update({ data: row.data }).match({ user_id: sid, report_idx: row.report_idx }), "DSE report"))) && ok;
    for (const [r, i] of list.map((r, i) => [r, i]).filter(([, i]) => stored.has(i))) {
      if (stableJSON(stored.get(i)) === stableJSON(r)) continue;
      ok = (await dbWrite(sb.from("dse_reports").update({ data: r }).match({ user_id: sid, report_idx: i }), "DSE report")) !== false && ok;
    }
    const extra = [...stored.keys()].filter(i => i >= list.length);
    for (const i of extra) ok = (await dbWrite(sb.from("dse_reports").delete().match({ user_id: sid, report_idx: i }), "DSE reports remove")) !== false && ok;
    return ok;
  }

  async function dbSaveDseAdminResponse(userId, reportIdx, issueIdx, rec) {
    await dbWrite(sb.from("dse_admin_responses").upsert({
      user_id: userId, report_idx: reportIdx, issue_idx: issueIdx,
      comment: rec.comment, resolved: rec.resolved,
      signed_off_by: rec.signedOffBy || null, signed_off_at: rec.signedOffAt || null,
    }, { onConflict: "user_id,report_idx,issue_idx" }), "DSE admin response");
  }

  // Same merge pattern, for an unfinished DSE assessment (null = none / finished).
  async function dbSaveDseDraft(userId, draft) {
    const sid = String(userId);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}) };
    if (draft) merged.dseDraft = draft; else delete merged.dseDraft;
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    await dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "DSE progress");
  }
  function saveDseProgress(draft) {
    if (!user) return;
    setDseDraft(draft);
    dbSaveDseDraft(user.id, draft);
  }
  // Opens the DSE wizard: carries on from saved progress if there is some, otherwise starts fresh.
  function openDse() {
    const d = dseDraft;
    setDseAnswers(d?.answers || {}); setDseComments(d?.comments || {}); setDseSection(d?.section || 0);
    setDseSubmitted(false); setDseActive(true);
  }

  return {
    dbSaveDseReport, saveDseReportNow, dbSaveDseAdminResponse, dbSaveDseDraft, saveDseProgress, openDse
  };
}
