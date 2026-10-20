/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/incidents.js — createIncidentActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Incidents and investigations: saving only what changed, one save at a time per record, and
 * merging two people's changes to an investigation (domains/incidents/investigationMerge.js).
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { changedSince, mergeInvestigation } from "../../domains/incidents/investigationMerge";
import { completeAction } from "../../lib/actionStatus";
import { auditDelete, auditRecord, primeAudit } from "../../lib/audit";
import { todayISO } from "../../lib/dates";
import { pingIncidentAlert } from "../../lib/incidentAlert";
import { PHOTO_BUCKET, uploadPhotos } from "../../lib/photos";
import { dbWrite, sb } from "../../lib/supabase";
import { INCIDENT_CORE_KEYS, incidentAuditLabel, stableJSON } from "../records";

export function createIncidentActions(app) {
  const {
    incidents, incidentWritingRef, investigationBaseRef, investigations, investigationSavedRef,
    investigationWritingRef, setIncidents, setInvestigations
  } = app;

  // Upserts one incident (and uploads any new photos first). Called for EVERY incident by the auto-sync effect.
  async function dbSaveIncident(inc) {
    incidentWritingRef.current.add(String(inc.id));
    try { return await dbSaveIncidentNow(inc); } finally { incidentWritingRef.current.delete(String(inc.id)); }
  }
  async function dbSaveIncidentNow(inc) {
    // Photos arrive from the mobile app as data URLs. Push them to Storage and
    // store the resulting URLs — a data URL in the row would bloat every read.
    // Already-uploaded photos pass straight through, so this is a no-op on the
    // repeat saves the [incidents] effect fires.
    const photos = await uploadPhotos(PHOTO_BUCKET, `inc_${inc.id}`, inc.photos);
    const prev = inc.photos || [];
    if (photos.length !== prev.length || photos.some((p, i) => p !== prev[i])) {
      setIncidents(list => list.map(i => i.id === inc.id ? { ...i, photos } : i));
    }
    // Core fields have their own columns (below). EVERY other field on the
    // incident — injured person, witnesses, first aid, post-incident outcome,
    // immediate measures, corrective actions, equipment, time, triaged, and
    // anything added to the form later — is saved in the jsonb `details`
    // column (see incident_details_column.sql) and restored by loadAll().
    const details = {};
    Object.entries(inc).forEach(([k, v]) => {
      if (!INCIDENT_CORE_KEYS.has(k) && v !== undefined && typeof v !== "function") details[k] = v;
    });
    const savedOk = await dbWrite(sb.from("incidents").upsert({
      id: inc.id, date: inc.date, type: inc.type, accident_code: inc.accidentCode,
      number_code: inc.numberCode, location: inc.location, reported_by: inc.reportedBy,
      description: inc.description, injury_type: inc.injuryType, riddor: inc.riddor, closed: inc.closed,
      photos,
      riddor_reported: inc.riddorReported||false,
      riddor_reported_date: inc.riddorReportedDate||null,
      hse_reference: inc.hseReference||null,
      riddor_reported_by: inc.riddorReportedBy||null,
      quick_report: !!inc.quickReport,
      urgency: inc.urgency||null,
      details,
    }, { onConflict: "id" }), "incident", { alertOnError: true });
    if (savedOk) pingIncidentAlert(inc.id);   // high-risk? the server emails admins straight away (Site Settings → Email reminders)
    auditRecord("incident", inc.id, { ...inc, photos }, incidentAuditLabel(inc));
    return savedOk;
  }

  async function dbDeleteIncident(id) {
    auditDelete("incident", id, incidentAuditLabel(incidents.find(i => i.id === id)));
    await dbWrite(sb.from("incidents").delete().eq("id", id), "incident delete");
  }

  // Investigations are keyed by incident id; the whole investigation is one JSON `data` blob.
  async function dbSaveInvestigation(incidentId, data) {
    investigationWritingRef.current.add(String(incidentId));
    try { return await dbSaveInvestigationNow(incidentId, data); } finally { investigationWritingRef.current.delete(String(incidentId)); }
  }
  // Reads ONE investigation straight from the database.
  // Returns { ok:true, data } (data undefined if there is no row yet) or { ok:false }.
  async function fetchInvestigation(incidentId) {
    try {
      const { data, error } = await sb.from("investigations").query(`select=*&incident_id=eq.${encodeURIComponent(incidentId)}`);
      if (error || !Array.isArray(data)) return { ok: false };
      const row = data.find(r => String(r.incident_id) === String(incidentId));
      return { ok: true, data: row ? row.data : undefined };
    } catch { return { ok: false }; }
  }
  // The investigation screen calls this after the person has seen the other
  // person's version and chosen what to do, so the save below doesn't merge again.
  function acceptInvestigationBase(incidentId, data) {
    investigationBaseRef.current.set(String(incidentId), data);
  }
  async function dbSaveInvestigationNow(incidentId, data) {
    // Someone else saved since we last read it? Combine rather than overwrite.
    // (The investigation screen asks the person first; this catches background
    // saves such as an action being ticked off on a phone.)
    const key = String(incidentId);
    const cur = await fetchInvestigation(incidentId);
    const base = investigationBaseRef.current.get(key) || {};   // {} = we've never seen a saved copy
    if (cur.ok && cur.data !== undefined && changedSince(base, cur.data) && changedSince(data, cur.data)) {
      const { merged } = mergeInvestigation(base, data, cur.data);
      primeAudit("investigation", incidentId, cur.data);   // log only what THIS person changed
      data = merged;
      investigationSavedRef.current.set(key, stableJSON(merged));
      setInvestigations(p => ({ ...p, [incidentId]: merged }));
    }
    auditRecord("investigation", incidentId, data, incidentAuditLabel(incidents.find(i => String(i.id) === String(incidentId))) || String(incidentId));
    const ok = await dbWrite(sb.from("investigations").upsert({ incident_id: incidentId, data }, { onConflict: "incident_id" }), "investigation");
    if (ok) investigationBaseRef.current.set(key, data);   // only once it's really in the database
    return ok;
  }

  // Marks a single corrective action complete inside its investigation and
  // persists the whole investigation record. Used by the mobile My Actions
  // screen; safe to call from the desktop investigation tab too.
  async function dbCompleteAction(incidentId, actionId, completedBy) {
    const inv = investigations[incidentId];
    if (!inv) return false;   // not loaded (yet): the phone's queue tries again later
    const next = {
      ...inv,
      actions: (inv.actions || []).map(a =>
        a.id === actionId
          ? completeAction(a, completedBy, todayISO())
          : a
      ),
    };
    setInvestigations(p => ({ ...p, [incidentId]: next }));
    return dbSaveInvestigation(incidentId, next);
  }

  return {
    dbSaveIncident, dbSaveIncidentNow, dbDeleteIncident, dbSaveInvestigation, fetchInvestigation,
    acceptInvestigationBase, dbSaveInvestigationNow, dbCompleteAction
  };
}
