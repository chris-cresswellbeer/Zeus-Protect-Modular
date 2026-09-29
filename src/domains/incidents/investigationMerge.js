/**
 * ═══════════════════════════════════════════════════════════════════════════
 * investigationMerge.js — "this has changed since you opened it"
 * ═══════════════════════════════════════════════════════════════════════════
 * An investigation is saved as ONE JSON record, so if two people edit it at the
 * same time the last save used to silently wipe out the other person's changes
 * (e.g. an admin editing the root cause while a staff member ticks an action off
 * on their phone).
 *
 * mergeInvestigation(base, mine, theirs) does a three-way comparison:
 *   base   = the version I started from (when I opened it)
 *   mine   = what I'm about to save
 *   theirs = what is in the database now
 * For each field: if only one side changed it, that change is kept. If BOTH sides
 * changed the same field to different values it is a conflict.
 * Corrective actions are matched by id and compared field by field, so "they
 * completed action 2" and "I edited action 3" combine cleanly. Photos are
 * combined as a set (added / removed on either side).
 *
 * Returns {
 *   merged,            // combined record (for conflicts, MY value is used)
 *   theirChanges: [],  // human-readable list of what the other person changed
 *   conflicts: [{ label, mine, theirs }]   // fields BOTH changed differently
 * }
 * Pure functions, no React — used by InvestigationTab (with a prompt) and by
 * App.jsx's save (silently, for background saves like "action completed").
 */

function stable(v) {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
}
// "" / null / undefined / [] all count as empty, so a form filling in blank
// defaults is not mistaken for a change.
const norm = v => (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) ? "∅" : stable(v);
const same = (a, b) => norm(a) === norm(b);

const FIELD_LABELS = {
  summary: "Investigation summary", rootCause: "Root cause", contributingFactors: "Contributing factors",
  immediateActions: "Immediate actions", recommendations: "Recommendations", investigator: "Lead investigator",
  investigationDate: "Investigation date", status: "Investigation status", photos: "Photos", actions: "Corrective actions",
};
const ACTION_LABELS = {
  description: "description", owner: "owner", dueDate: "due date", priority: "priority", status: "status",
  notes: "notes", completedDate: "completed date", completedBy: "completed by", managerSignOff: "manager sign-off",
  chasedOn: "chased", attachments: "attachments",
};
const label = k => FIELD_LABELS[k] || k;
const actLabel = a => {
  const d = String((a && a.description) || "").trim();
  return d ? `“${d.length > 50 ? d.slice(0, 50) + "…" : d}”` : "an action";
};

// Three-way merge of two flat objects. Returns { merged, changed:[keys], conflicts:[keys] }.
function mergeFields(base, mine, theirs, skip = []) {
  base = base || {}; mine = mine || {}; theirs = theirs || {};
  const merged = { ...mine };
  const changed = [], conflicts = [];
  new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)]).forEach(k => {
    if (skip.includes(k)) return;
    const theyChanged = !same(base[k], theirs[k]);
    if (!theyChanged) return;                   // keep mine
    changed.push(k);
    const iChanged = !same(base[k], mine[k]);
    if (!iChanged) { if (theirs[k] === undefined) delete merged[k]; else merged[k] = theirs[k]; return; }
    if (!same(mine[k], theirs[k])) conflicts.push(k);   // both changed differently → keep mine, report
  });
  return { merged, changed, conflicts };
}

function mergeActions(baseList, mineList, theirsList, theirChanges, conflicts) {
  const byId = l => new Map((l || []).filter(a => a && a.id != null).map(a => [String(a.id), a]));
  const B = byId(baseList), M = byId(mineList), T = byId(theirsList);
  const out = [];
  (mineList || []).forEach(a => {
    if (!a || a.id == null) { out.push(a); return; }
    const id = String(a.id), b = B.get(id), t = T.get(id);
    if (!b) { out.push(a); return; }                                   // I added it
    if (!t) {                                                         // they deleted it
      if (same(b, a)) { theirChanges.push(`Removed action ${actLabel(b)}`); return; }
      conflicts.push({ label: `Action ${actLabel(a)}`, mine: "edited by you", theirs: "deleted" });
      out.push(a); return;
    }
    const r = mergeFields(b, a, t);
    if (r.changed.length) theirChanges.push(`Action ${actLabel(t)}: ${r.changed.map(k => ACTION_LABELS[k] || k).join(", ")}`);
    r.conflicts.forEach(k => conflicts.push({ label: `Action ${actLabel(a)} — ${ACTION_LABELS[k] || k}`, mine: a[k], theirs: t[k] }));
    out.push(r.merged);
  });
  (theirsList || []).forEach(t => {
    if (!t || t.id == null) return;
    const id = String(t.id);
    if (M.has(id)) return;
    if (!B.has(id)) { theirChanges.push(`Added action ${actLabel(t)}`); out.push(t); return; }   // they added it
    const b = B.get(id);                                             // I deleted it
    if (!same(b, t)) { conflicts.push({ label: `Action ${actLabel(t)}`, mine: "deleted by you", theirs: "edited" }); }
  });
  return out;
}

function photoKey(p) { return p ? `${p.name || ""}|${p.uploaded || ""}|${String(p.data || p.url || "").length}` : ""; }
function mergePhotos(base, mine, theirs, theirChanges) {
  const keys = l => new Set((l || []).map(photoKey));
  const B = keys(base), M = keys(mine);
  const T = keys(theirs);
  const added = (theirs || []).filter(p => !B.has(photoKey(p)) && !M.has(photoKey(p)));
  const removed = new Set([...B].filter(k => !T.has(k)));
  if (added.length) theirChanges.push(`Added ${added.length} photo${added.length !== 1 ? "s" : ""}`);
  if (removed.size) theirChanges.push(`Removed ${removed.size} photo${removed.size !== 1 ? "s" : ""}`);
  return [...(mine || []).filter(p => !removed.has(photoKey(p))), ...added];
}

function mergeInvestigation(base, mine, theirs) {
  base = base || {}; mine = mine || {}; theirs = theirs || {};
  const theirChanges = [], conflicts = [];
  const r = mergeFields(base, mine, theirs, ["actions", "photos"]);
  r.changed.forEach(k => theirChanges.push(`${label(k)} changed`));
  r.conflicts.forEach(k => conflicts.push({ label: label(k), mine: mine[k], theirs: theirs[k] }));
  const merged = { ...r.merged };
  if (!same(base.actions, theirs.actions)) merged.actions = mergeActions(base.actions, mine.actions, theirs.actions, theirChanges, conflicts);
  if (!same(base.photos, theirs.photos)) merged.photos = mergePhotos(base.photos, mine.photos, theirs.photos, theirChanges);
  return { merged, theirChanges, conflicts };
}

/** True when `theirs` (database) differs from the version this person started from. */
function changedSince(base, theirs) { return stable(base || null) !== stable(theirs || null); }

export { mergeInvestigation, changedSince, stable as stableInvestigationJSON };
