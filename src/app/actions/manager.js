/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/manager.js — createManagerActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Line managers (My Team): assigning training, signing off DSE and corrective actions. Each is audited.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { completeAction, isActionDone } from "../../lib/actionStatus";
import { auditEvent, primeAudit } from "../../lib/audit";
import { todayISO } from "../../lib/dates";
import { incidentAuditLabel } from "../records";

export function createManagerActions(app) {
  const {
    adminResponses, allModules, assigns, dbSaveAssigns, incidents, investigations, noteDue,
    setAdminResponses, setAssigns, setInvestigations, user
  } = app;

  // ── Manager actions (My Team tab, role "manager") — each one is audited ──────────
  // Add modules to a team member's assignments (managers can add, not remove).
  function managerAssign(member, moduleIds, dueDate) {
    const uid = String(member.id);
    const current = assigns[uid] || [];
    const added = moduleIds.filter(id => !current.includes(id));
    if (!added.length) return;
    const next = [...current, ...added];
    const due = dueDate ? { [uid]: Object.fromEntries(added.map(id => [id, dueDate])) } : null;
    setAssigns(p => ({ ...p, [uid]: next }));
    if (due) noteDue(due);
    dbSaveAssigns({ [uid]: next }, due);
    const titles = added.map(id => (allModules.find(m => m.id === id) || {}).title || id);
    auditEvent("training_assign", uid, "assign", `Assigned by line manager: ${titles.join(", ")}`, { modules: { from: null, to: titles } }, member.name);
  }
  // Manager signs off one DSE issue as resolved (stored on the admin response record).
  function managerSignOffDse(member, ri, ii, issue, note) {
    const uid = String(member.id), key = `${ri}_${ii}`, today = todayISO();
    const cur = (adminResponses[uid] || adminResponses[member.id] || {})[key] || { comment: "", resolved: false };
    const rec = { ...cur, resolved: true, signedOffBy: user.name, signedOffAt: today,
      comment: note ? (cur.comment ? `${cur.comment}\n${note}` : note) : cur.comment };
    const nextUser = { ...(adminResponses[uid] || adminResponses[member.id] || {}), [key]: rec };
    primeAudit("dse_response", uid, nextUser);   // the explicit sign-off entry below replaces the automatic diff
    setAdminResponses(p => ({ ...p, [uid]: nextUser }));
    auditEvent("dse_response", uid, "sign_off", `Line manager signed off DSE issue: ${issue.question}${note ? ` — ${note}` : ""}`,
      { resolved: { from: !!cur.resolved, to: true }, signedOffBy: { from: null, to: user.name } }, member.name);
  }
  // Manager signs off a corrective action (marks it complete first if it isn't already).
  function managerSignOffAction(incidentId, action, member, note) {
    const inv = investigations[incidentId]; if (!inv) return;
    const today = todayISO();
    const done = isActionDone(action);
    const next = { ...inv, actions: (inv.actions || []).map(a => a.id !== action.id ? a : {
      ...completeAction(a, user.name, today),
      managerSignOff: { by: user.name, date: today, note: note || "" },
    }) };
    primeAudit("investigation", incidentId, next);
    setInvestigations(p => ({ ...p, [incidentId]: next }));
    auditEvent("corrective_action", incidentId, "sign_off",
      `Line manager signed off action for ${member.name}: ${action.description}${done ? "" : " (marked complete)"}${note ? ` — ${note}` : ""}`,
      { status: { from: action.status || "open", to: "complete" }, managerSignOff: { from: null, to: `${user.name} ${today}` } },
      incidentAuditLabel(incidents.find(i => String(i.id) === String(incidentId))));
  }

  return {
    managerAssign, managerSignOffDse, managerSignOffAction
  };
}
