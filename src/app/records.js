/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/records.js — records
 * ═══════════════════════════════════════════════════════════════════════════
 * Record helpers shared by loading and the refresh: database rows → the shapes the screens use,
 * comparing records, merging fresh reads with changes still being saved, and the list of tables
 * the 30-second refresh checks (lib/changes.js).
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { PASS_MARK } from "../domains/training/completion";
import { createChangeTracker } from "../lib/changes";

// "Has anything changed?" for the tables the 30-second refresh re-reads (lib/changes.js).
const sharedTracker = createChangeTracker();
const TRACKED = ["incidents", "investigations", "training_completions", "doc_acknowledgements", "training_assigns", "training_completion_history",
  "doc_assignments", "doc_bundles", "equipment", "custom_machine_types", "site_inspections", "custom_modules", "first_aid_register",
  "fire_wardens", "fire_drills", "fire_alarm_tests", "fire_extinguishers", "fire_emerg_lighting", "fire_fra_reviews", "contractors"];


// One `incidents` table row → the incident record the app uses. Shared by loadAll()
// and refreshSharedRecords(). Everything without its own column comes back from the
// jsonb `details` column; the core columns below always win.
const mapIncidentRow = (r) => ({
            // Everything the core columns don't hold (injured person, witnesses,
            // first aid, post-incident, measures, corrective actions, equipment,
            // time, triaged…) comes back from the jsonb `details` column.
            // Spread first so the core columns below always win.
            ...((r.details && typeof r.details === "object") ? r.details : {}),
            id: r.id, date: r.date, type: r.type, accidentCode: r.accident_code,
            numberCode: r.number_code, location: r.location, reportedBy: r.reported_by,
            description: r.description, injuryType: r.injury_type, riddor: r.riddor, closed: r.closed,
            riddorReported: r.riddor_reported||false,
            riddorReportedDate: r.riddor_reported_date||null,
            hseReference: r.hse_reference||null,
            riddorReportedBy: r.riddor_reported_by||null,
            quickReport: !!r.quick_report,
            urgency: r.urgency||null,
            photos: Array.isArray(r.photos) ? r.photos : [],
});

// Key-order-independent JSON, used to tell whether a record really changed.
/** Fire safety lists (state key → table). */
const FIRE_TABLES = { wardens: "fire_wardens", drills: "fire_drills", alarmTests: "fire_alarm_tests",
  extinguishers: "fire_extinguishers", emergLighting: "fire_emerg_lighting", fraReviews: "fire_fra_reviews" };

/** A short fingerprint of a history table: its row ids, plus `recorded` (attached evidence),
 *  which can change on an existing row. null if any row has no id (then always re-read). */
function idsKey(rows) {
  if (!Array.isArray(rows) || rows.some(r => r == null || r.id == null)) return null;
  return rows.map(r => `${r.id}:${r.recorded == null ? "" : stableJSON(r.recorded)}`).sort().join(",");
}

function stableJSON(v) {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableJSON).join(",") + "]";
  return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + stableJSON(v[k])).join(",") + "}";
}

// Short human-readable labels for audit-trail entries.
const INCIDENT_TYPE_LABELS = { accident:"Accident", near_miss:"Near miss", unsafe_condition:"Unsafe condition", unsafe_act:"Unsafe act" };
const incidentAuditLabel = (inc) => inc ? [inc.date, INCIDENT_TYPE_LABELS[inc.type] || inc.type, inc.location].filter(Boolean).join(" · ") : "";

// Incident fields that have their own column in the `incidents` table.
// Everything else on an incident record is stored in the jsonb `details` column.
// ── Row → state mappers for training and reading records (used by loadAll and
// by the 30-second refresh, so both build exactly the same shapes) ──
function mapAssignRows(rows) {
  const map = {};
  (rows || []).forEach(r => { const uid = String(r.user_id); (map[uid] = map[uid] || []).push(String(r.module_id)); });
  return map;
}
function mapDocAssignRows(rows) {
  const map = {};
  (rows || []).forEach(r => { const did = String(r.doc_id), uid = String(r.user_id); const l = (map[did] = map[did] || []); if (!l.includes(uid)) l.push(uid); });   // a doubled row counts once
  return map;
}
function mapCompRows(rows) {
  const map = {};
  (rows || []).forEach(r => {
    // Older versions also saved FAILED attempts here (no certificate, under 70%). A
    // failed attempt isn't a completion — those are listed under Quiz Failures.
    if (!r.recorded && !r.cert_id && r.score !== null && r.score !== undefined && Number(r.score) < PASS_MARK) return;
    const uid = String(r.user_id); map[uid] = map[uid] || {};
    map[uid][String(r.module_id)] = { score: r.score, date: r.date, certId: r.cert_id, answers: r.answers, moduleVersion: r.module_version || 1, ...(r.recorded ? { recorded: r.recorded } : {}),
      ...(r.lang ? { lang: r.lang, translation: r.translation || null } : {}) };   // done in French / Polish / Romanian
  });
  return map;
}
function mapAckRows(rows) {
  const map = {};
  (rows || []).forEach(r => { const uid = String(r.user_id), did = String(r.doc_id); map[uid] = map[uid] || {}; map[uid][did] = { date: r.date, version: r.version || 1 }; });
  return map;
}
// Merge freshly-read {person: {item: record}} into what's on screen. Records this
// browser changed in the last minute keep the on-screen version (its save may still
// be on its way); everything else takes the database's version.
const RECENT_MS = 60000;
function mergeNested(cur, fresh, recent, prefix) {
  const next = {}; Object.entries(fresh).forEach(([u, m]) => { next[u] = { ...m }; });
  const now = Date.now();
  recent.forEach((t, key) => {
    if (now - t > RECENT_MS || !key.startsWith(prefix + ":")) return;
    const [, u, k] = key.split(":");
    const local = cur[u] && cur[u][k];
    if (local) { next[u] = next[u] || {}; next[u][k] = local; } else if (next[u]) delete next[u][k];
  });
  return stableJSON(next) === stableJSON(cur) ? cur : next;
}
// Also used for document assignments ({docId: [userId]}, prefix "d").
function mergeAssigns(cur, fresh, recent, prefix = "a") {
  const next = { ...fresh }; const now = Date.now();
  recent.forEach((t, key) => { if (now - t <= RECENT_MS && key.startsWith(prefix + ":")) { const u = key.slice(prefix.length + 1); if (cur[u]) next[u] = cur[u]; else delete next[u]; } });
  Object.keys(next).forEach(u => { if (!next[u] || !next[u].length) delete next[u]; });
  const norm = o => stableJSON(Object.fromEntries(Object.entries(o).filter(([, v]) => v && v.length).map(([k, v]) => [k, [...v].sort()])));
  return norm(next) === norm(cur) ? cur : next;
}

const INCIDENT_CORE_KEYS = new Set([
  "id","date","type","accidentCode","numberCode","location","reportedBy",
  "description","injuryType","riddor","closed","photos",
  "riddorReported","riddorReportedDate","hseReference","riddorReportedBy",
  "quickReport","urgency",
]);

export {
  sharedTracker, TRACKED, mapIncidentRow, FIRE_TABLES, idsKey, stableJSON, INCIDENT_TYPE_LABELS, incidentAuditLabel, mapAssignRows, mapDocAssignRows, mapCompRows, mapAckRows, RECENT_MS, mergeNested, mergeAssigns, INCIDENT_CORE_KEYS,
};
