/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/audit.js — append-only audit trail (who changed what, and when)
 * ═══════════════════════════════════════════════════════════════════════════
 * Every record type we audit (incidents, investigations, risk assessments, COSHH
 * assessments, DSE reports + responses, site inspections, manager sign-offs,
 * training assignments, new document/module versions) writes a row to the
 * `audit_log` table (see audit_manager_versioning.sql):
 *
 *   { at, entity, entity_id, entity_label, action, user_id, user_name, summary, changes }
 *   changes = { fieldName: { from, to } }   (top-level fields only)
 *
 * HOW DIFFS WORK
 *   The app's auto-sync effects re-save whole collections whenever anything
 *   changes, so "a save happened" is NOT the same as "this record changed".
 *   We keep a snapshot (JSON) of every record as last loaded / last logged.
 *   auditRecord() compares against that snapshot and only writes a log row if at
 *   least one field really differs. primeAudit() sets snapshots after loadAll()
 *   WITHOUT logging, so loading data never creates entries.
 *
 * WHO
 *   setAuditUser(user) is called by App.jsx whenever the signed-in user changes.
 *   ⚠ Logins are checked in the browser (see lib/supabase.js), so "who" is the
 *   account the portal says is signed in. The SQL makes the table insert-only for
 *   the app's key, so entries can't be edited or deleted from the portal.
 *
 * This file is plain module state (not React state) so any component can log
 * without prop-threading: import { auditRecord, auditEvent } from "../../lib/audit".
 */
import { sb, dbWrite } from "./supabase";

const snapshots = new Map();      // `${entity}:${id}` → JSON string of the record
let currentUser = null;           // { id, name }

function setAuditUser(user) {
  currentUser = user ? { id: String(user.id), name: user.name || "" } : null;
}

// Stable JSON (sorted keys) so key order never counts as a change.
function stable(v) {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
}

// Keep log rows small and readable: no embedded files, long text trimmed.
function clean(v, depth = 0) {
  if (typeof v === "string") {
    if (v.startsWith("data:")) return "[file]";
    return v.length > 2000 ? v.slice(0, 2000) + "…" : v;
  }
  if (v === null || typeof v !== "object") return v;
  if (depth > 6) return "[…]";
  if (Array.isArray(v)) return v.map(x => clean(x, depth + 1));
  const o = {};
  Object.keys(v).forEach(k => { if (v[k] !== undefined) o[k] = clean(v[k], depth + 1); });
  return o;
}

// "Nothing" in any form — so a form filling in blank defaults (undefined → "" / false / [])
// doesn't count as a change.
const isEmpty = v => v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0);

// Top-level field diff. Arrays at the top level (e.g. a user's DSE reports) are
// compared per index, labelled "#1", "#2"…
function diff(before, after) {
  const changes = {};
  const asObj = x => Array.isArray(x) ? Object.fromEntries(x.map((v, i) => ["#" + (i + 1), v])) : (x || {});
  const a = asObj(before), b = asObj(after);
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => {
    if (isEmpty(a[k]) && isEmpty(b[k])) return;
    if (stable(a[k]) !== stable(b[k])) changes[k] = { from: clean(a[k] ?? null), to: clean(b[k] ?? null) };
  });
  return changes;
}

function write(row) {
  return dbWrite(sb.from("audit_log").insert({
    at: new Date().toISOString(),
    user_id: currentUser ? currentUser.id : null,
    user_name: currentUser ? currentUser.name : "System",
    ...row,
  }), "audit log");
}

/** Remember the current state of records WITHOUT logging (call after loading). */
function primeAudit(entity, id, record) {
  snapshots.set(`${entity}:${id}`, stable(record));
}
/** Prime a whole list, keyed by idKey. */
function primeAuditList(entity, list, idKey = "id") {
  (list || []).forEach(r => { if (r && r[idKey] != null) primeAudit(entity, r[idKey], r); });
}
/** Prime a map { id: record }. */
function primeAuditMap(entity, map) {
  Object.entries(map || {}).forEach(([id, r]) => primeAudit(entity, id, r));
}

/**
 * Log a create/update of one record if (and only if) it differs from its snapshot.
 * @returns {Promise|undefined}
 */
function auditRecord(entity, id, record, label) {
  const key = `${entity}:${id}`;
  const now = stable(record);
  const prev = snapshots.get(key);
  if (prev === now) return;
  snapshots.set(key, now);
  const changes = diff(prev ? JSON.parse(prev) : {}, record);
  if (!Object.keys(changes).length) return;
  const action = prev ? "update" : "create";
  const fields = Object.keys(changes);
  return write({
    entity, entity_id: String(id), entity_label: label || "", action, changes,
    summary: action === "create" ? "Created" : `Changed ${fields.slice(0, 6).join(", ")}${fields.length > 6 ? ` +${fields.length - 6} more` : ""}`,
  });
}

/** Log every create/update/delete across a whole list (e.g. site inspections). */
function auditList(entity, list, labelFn = () => "", idKey = "id") {
  const ids = new Set();
  (list || []).forEach(r => { if (!r || r[idKey] == null) return; ids.add(String(r[idKey])); auditRecord(entity, r[idKey], r, labelFn(r)); });
  // Anything we had a snapshot for that has gone from the list was deleted.
  [...snapshots.keys()].filter(k => k.startsWith(entity + ":")).forEach(k => {
    const id = k.slice(entity.length + 1);
    if (!ids.has(id)) { const prev = JSON.parse(snapshots.get(k)); auditDelete(entity, id, labelFn(prev)); }
  });
}

/** Log a deletion (keeps the last known content in `changes`). */
function auditDelete(entity, id, label) {
  const key = `${entity}:${id}`;
  const prev = snapshots.get(key);
  snapshots.delete(key);
  return write({
    entity, entity_id: String(id), entity_label: label || "", action: "delete",
    summary: "Deleted", changes: prev ? diff(JSON.parse(prev), {}) : {},
  });
}

/** Log a one-off event (sign-off, assignment, new version…). */
function auditEvent(entity, id, action, summary, changes = {}, label = "") {
  return write({ entity, entity_id: String(id), entity_label: label, action, summary, changes: clean(changes) });
}

/** Read the log (newest first). Filters are applied again in the UI. */
async function loadAuditLog({ entity, entityId, limit = 2000 } = {}) {
  const f = ["select=*", "order=at.desc", `limit=${limit}`];
  if (entity) f.push(`entity=eq.${encodeURIComponent(entity)}`);
  if (entityId) f.push(`entity_id=eq.${encodeURIComponent(entityId)}`);
  const { data, error } = await sb.from("audit_log").query(f.join("&"));
  let rows = Array.isArray(data) ? data : [];
  if (entity) rows = rows.filter(r => r.entity === entity);
  if (entityId) rows = rows.filter(r => String(r.entity_id) === String(entityId));
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { rows, error };
}

const AUDIT_ENTITY_LABELS = {
  incident: "Incident", investigation: "Investigation", risk_assessment: "Risk assessment",
  coshh_assessment: "COSHH assessment", dse_report: "DSE assessment", dse_response: "DSE response",
  inspection: "Site inspection", corrective_action: "Corrective action", training_assign: "Training assignment",
  document: "Document", module: "Training module", training_completion: "Training completion",
};

export {
  setAuditUser, primeAudit, primeAuditList, primeAuditMap,
  auditRecord, auditList, auditDelete, auditEvent, loadAuditLog, AUDIT_ENTITY_LABELS,
};
