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
 *   { source, title, ref, owner, dueDate, raisedDate, daysOverdue, priority, key }
 * daysOverdue is null when there is no due date, 0 or less when not yet due.
 */
const DONE = new Set(["complete", "completed", "closed", "done"]);
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);

function collectOpenActions({ incidents = [], investigations = {}, inspections = [], ras = [], today = todayISO() } = {}) {
  const out = [];
  const od = due => due ? daysBetween(due, today) : null;

  incidents.forEach(inc => {
    const inv = investigations[inc.id];
    (inv?.actions || []).forEach((a, i) => {
      if (DONE.has(String(a.status || "").toLowerCase())) return;
      out.push({ key: `inc_${inc.id}_${a.id || i}`, source: "Incident investigation", title: a.description || "Corrective action",
        ref: [inc.date, inc.location].filter(Boolean).join(" · "), owner: a.owner || "Unassigned", dueDate: a.dueDate || null,
        raisedDate: inv.investigationDate || inc.date || null, daysOverdue: od(a.dueDate), priority: a.priority || (inc.riddor ? "high" : "medium") });
    });
  });

  inspections.forEach(ins => {
    (ins.nonConformances || []).forEach((nc, i) => {
      if (DONE.has(String(nc.actionStatus || "").toLowerCase())) return;
      const due = nc.actionDue || nc.dueDate || null;
      out.push({ key: `ins_${ins.id}_${nc.id || i}`, source: "Site inspection", title: nc.finding || nc.description || "Non-conformance",
        ref: [ins.date, ins.location].filter(Boolean).join(" · "), owner: nc.actionOwner || nc.responsiblePerson || "Unassigned", dueDate: due,
        raisedDate: ins.date || null, daysOverdue: od(due), priority: nc.severity === "major" || nc.severity === "high" ? "high" : nc.severity === "observation" ? "low" : "medium" });
    });
  });

  ras.forEach(ra => {
    (ra.hazards || []).forEach((h, i) => {
      if (h.actionComplete || !String(h.furtherControls || "").trim()) return;
      out.push({ key: `ra_${ra.id}_${h.id || i}`, source: "Risk assessment", title: h.furtherControls,
        ref: ra.title || ra.location || "Risk assessment", owner: h.responsiblePerson || ra.assessor || "Unassigned", dueDate: h.targetDate || null,
        raisedDate: ra.date || null, daysOverdue: od(h.targetDate), priority: "medium" });
    });
  });
  return out;
}

export { collectOpenActions };
