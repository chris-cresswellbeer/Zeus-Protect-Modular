import { todayISO } from "./dates";
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/openActions.js — every open corrective action in one list
 * ═══════════════════════════════════════════════════════════════════════════
 * Gathers open actions from three places:
 *   • incident investigations  – investigations[incidentId].actions[]
 *   • site inspections          – inspection.nonConformances[] (actionOwner / actionDue / actionStatus)
 *   • risk assessments          – ra.hazards[] with furtherControls not yet actionComplete
 * Used by the monthly management report. Each item:
 *   { source, title, ref, owner, dueDate, raisedDate, daysOverdue, priority, key, sid, ownerAssumed? }
 * key: position-based (as before); sid: stable even for older actions without an id (used by emails).
 * ownerAssumed: a risk assessment action with no responsible person (the assessor is shown instead).
 * daysOverdue is null when there is no due date, 0 or less when not yet due.
 */
const DONE = new Set(["complete", "completed", "closed", "done"]);
/** Action owners are names: the same person whatever the case or spacing ("ann  bee" = "Ann Bee"). */
export const sameName = (a, b) => { const n = v => String(v || "").trim().replace(/\s+/g, " ").toLowerCase(); return !!n(a) && n(a) === n(b); };
/** A short, stable id from an action's text, for older actions saved without an id (their position
 *  in the list can change when another is deleted). */
const textId = t => { let h = 0; for (const ch of String(t || "")) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0; return `t${(h >>> 0).toString(36)}`; };
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);

function collectOpenActions({ incidents = [], investigations = {}, inspections = [], ras = [], today = todayISO() } = {}) {
  const out = [];
  const od = due => due ? daysBetween(due, today) : null;

  incidents.forEach(inc => {
    const inv = investigations[inc.id];
    (inv?.actions || []).forEach((a, i) => {
      if (DONE.has(String(a.status || "").toLowerCase())) return;
      out.push({ key: `inc_${inc.id}_${a.id || i}`, sid: `inc_${inc.id}_${a.id || textId(a.description)}`, source: "Incident investigation", title: a.description || "Corrective action",
        ref: [inc.date, inc.location].filter(Boolean).join(" · "), owner: a.owner || "Unassigned", dueDate: a.dueDate || null,
        raisedDate: inv.investigationDate || inc.date || null, daysOverdue: od(a.dueDate), priority: a.priority || (inc.riddor ? "high" : "medium") });
    });
  });

  inspections.forEach(ins => {
    (ins.nonConformances || []).forEach((nc, i) => {
      if (DONE.has(String(nc.actionStatus || "").toLowerCase())) return;
      const due = nc.actionDue || nc.dueDate || null;
      out.push({ key: `ins_${ins.id}_${nc.id || i}`, sid: `ins_${ins.id}_${nc.id || textId(nc.finding || nc.description)}`, source: "Site inspection", title: nc.finding || nc.description || "Non-conformance",
        ref: [ins.date, ins.location].filter(Boolean).join(" · "), owner: nc.actionOwner || nc.responsiblePerson || "Unassigned", dueDate: due,
        raisedDate: ins.date || null, daysOverdue: od(due), priority: nc.severity === "major" || nc.severity === "high" ? "high" : nc.severity === "observation" ? "low" : "medium" });
    });
  });

  ras.forEach(ra => {
    (ra.hazards || []).forEach((h, i) => {
      if (h.actionComplete || !String(h.furtherControls || "").trim()) return;
      out.push({ key: `ra_${ra.id}_${h.id || i}`, sid: `ra_${ra.id}_${h.id || textId(h.furtherControls)}`, source: "Risk assessment", title: h.furtherControls,
        ref: ra.title || ra.location || "Risk assessment", owner: h.responsiblePerson || ra.assessor || "Unassigned", ownerAssumed: !h.responsiblePerson, dueDate: h.targetDate || null,
        raisedDate: ra.date || null, daysOverdue: od(h.targetDate), priority: "medium" });
    });
  });
  return out;
}

export { collectOpenActions };
