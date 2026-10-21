/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/data/useSyncEffects.js — useSyncEffects(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Saving and refreshing:
 *   • once loaded, every audited record is snapshotted so only real changes are logged
 *   • "auto-sync": incidents, investigations, DSE, equipment, inspections, fire safety, first aid,
 *     custom modules and machine types save the records that changed (lib/keyedSync.js)
 *   • the 30-second refresh (data/sync.js refreshSharedRecords), on focus and on opening a page
 *   • when the last backup was downloaded (admins)
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useEffect } from "react";
import { INSP_TYPES } from "../../data/seedInspections";
import { hasMachineryAccess } from "../../data/seedMachinery";
import { auditList, auditRecord, primeAuditList, primeAuditMap, setAuditUser } from "../../lib/audit";
import { lastBackupAt } from "../../lib/backup";
import { diffKeyed, markSaved, primeKeyed, saveKeyed, savedCopy } from "../../lib/keyedSync";
import { dbWrite, sb } from "../../lib/supabase";
import { setDraftUser } from "../../lib/unsaved";
import { notify } from "../../shared/Feedback";
import { FIRE_TABLES, stableJSON } from "../records";

export function useSyncEffects(app) {
  const {
    _ready, adminResponses, atab, auditNameOf, contractors, coshhAssessments, customMachineTypes, customModules, dbReady,
    dbSaveDseAdminResponse, dbSaveDseReport, dbSaveFirstAidData, dbSaveIncident, dbSaveInvestigation,
    dseReports, dseRespSavedRef, dseSavedRef, equipment, fireSafety, firstAidData, firstAidSavedRef,
    firstAidWroteRef, incidents, incidentSavedRef, inTurn, investigationBaseRef, investigations,
    investigationSavedRef, ras, refreshSharedRecords, regRef, setLastBackup, siteInspections, stab, user,
    view, writesAll, writesMachinery
  } = app;
  // Once data has loaded, snapshot every audited record WITHOUT logging (lib/audit.js),
  // so only real changes from here on create audit-trail entries. Declared before the
  // auto-sync effects below so the snapshots exist before their first re-save.
  useEffect(() => { if (!dbReady) return;
    primeAuditList("incident", incidents);
    primeAuditMap("investigation", investigations);
    primeAuditList("risk_assessment", ras);
    primeAuditMap("coshh_assessment", coshhAssessments);
    primeAuditMap("dse_report", dseReports);
    primeAuditMap("dse_response", adminResponses);
    primeAuditList("inspection", siteInspections);
    incidents.forEach(i => incidentSavedRef.current.set(String(i.id), stableJSON(i)));
    Object.entries(investigations).forEach(([id, d]) => { investigationSavedRef.current.set(String(id), stableJSON(d)); investigationBaseRef.current.set(String(id), d); });
    const R = regRef.current;
    primeKeyed(R.equipment, equipment); primeKeyed(R.inspections, siteInspections);
    primeKeyed(R.modules, customModules); primeKeyed(R.machineTypes, customMachineTypes);
    primeKeyed(R.contractors, contractors);
    Object.keys(R.fire).forEach(k => primeKeyed(R.fire[k], (fireSafety || {})[k] || []));
    firstAidSavedRef.current = stableJSON(firstAidData);
    Object.entries(adminResponses).forEach(([uid, keys]) => Object.entries(keys || {}).forEach(([key, rec]) => dseRespSavedRef.current.set(`${uid}|${key}`, stableJSON(rec))));
    Object.entries(dseReports).forEach(([uid, reps]) => dseSavedRef.current.set(String(uid), stableJSON(reps)));
    _ready.current = true;
  }, [dbReady]); // eslint-disable-line

  // Audit entries are attributed to whoever is signed in.
  useEffect(() => { setAuditUser(user); setDraftUser(user && user.id); }, [user]);

  // Only incidents / investigations that changed since they were last saved or loaded are written.
  useEffect(() => { if (!_ready.current) return;
    incidents.forEach(inc => {
      const id = String(inc.id), j = stableJSON(inc);
      if (incidentSavedRef.current.get(id) === j) return;
      incidentSavedRef.current.set(id, j);
      dbSaveIncident(inc);
    });
  }, [incidents]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    Object.entries(investigations).forEach(([id, data]) => {
      const j = stableJSON(data);
      if (investigationSavedRef.current.get(String(id)) === j) return;
      investigationSavedRef.current.set(String(id), j);
      dbSaveInvestigation(id, data);
    });
  }, [investigations]); // eslint-disable-line
  useEffect(() => {
    if (!dbReady || !user) return;
    const tick = () => { if (document.visibilityState === "visible") refreshSharedRecords(); };
    const iv = setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(iv); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [dbReady, user]); // eslint-disable-line

  // Admins: when was the last full backup downloaded? (drives the bell reminder)
  useEffect(() => {
    if (!dbReady || !user || user.role !== "admin") return;
    let live = true;
    lastBackupAt().then(at => { if (live) setLastBackup(at); });
    return () => { live = false; };
  }, [dbReady, user && user.id, user && user.role]); // eslint-disable-line
  useEffect(() => {
    if ((view === "admin" && atab === "incidents") || (view === "staff" && (stab === "incidents" || stab === "actions" || stab === "team"))) refreshSharedRecords();
  }, [view, atab, stab]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    Object.entries(dseReports).filter(([uid]) => writesAll() || String(uid) === String(user && user.id)).forEach(([uid, reports]) => {
      // only people whose assessments changed since the last save (not everyone, every time)
      const j = stableJSON(reports);
      if (dseSavedRef.current.get(String(uid)) === j) return;
      dseSavedRef.current.set(String(uid), j);
      auditRecord("dse_report", uid, reports, auditNameOf(uid));
      dbSaveDseReport(Number(uid), reports).then(ok => { if (ok === false) dseSavedRef.current.delete(String(uid)); });   // retried on the next change
    });
  }, [dseReports]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    // Admins save any response; line managers only their team's (sign-offs); staff none.
    // Only responses that changed here are written (an old page can't undo someone's sign-off).
    Object.entries(adminResponses).filter(([uid]) => writesAll() || (user && user.role === "manager" && String(uid) !== String(user.id))).forEach(([uid, keys]) => {
      const changed = Object.entries(keys || {}).filter(([key, rec]) => dseRespSavedRef.current.get(`${uid}|${key}`) !== stableJSON(rec));
      if (!changed.length) return;
      auditRecord("dse_response", uid, keys, auditNameOf(uid));
      changed.forEach(([key, rec]) => {
        dseRespSavedRef.current.set(`${uid}|${key}`, stableJSON(rec));
        const [ri, ii] = key.split("_").map(Number);
        dbSaveDseAdminResponse(Number(uid), ri, ii, rec);
      });
    });
  }, [adminResponses]); // eslint-disable-line

  // Equipment: only changed items are written. People who manage equipment (admins, Machinery &
  // Equipment access) save the item and may delete ones they removed. Everyone else (e.g. an
  // incident report adding a defect) adds only their new defects / status change to the LATEST
  // stored copy, so an old copy of the rest of the item is never written back.
  useEffect(() => { if (!_ready.current) return;
    const t = regRef.current.equipment;
    if (user && hasMachineryAccess(user)) {
      saveKeyed(t, equipment, {
        write: e => dbWrite(sb.from("equipment").upsert({ id: e.id, data: e }, { onConflict: "id" }), "equipment"),
        remove: id => dbWrite(sb.from("equipment").delete().eq("id", id), "equipment delete"),
      });
      return;
    }
    const { changed } = diffKeyed(t, equipment);
    changed.forEach(e => {
      const base = savedCopy(t, e.id) || {};
      markSaved(t, e);
      // one save at a time per item (two quick changes must not both read the same copy)
      inTurn(`eq:${e.id}`, async () => {
        const r = await sb.from("equipment").query(`select=data&id=eq.${encodeURIComponent(e.id)}`);
        const cur = !r.error && Array.isArray(r.data) && r.data[0] ? r.data[0].data : null;
        if (!cur) {
          t.saved.delete(String(e.id));   // tried again on the next change
          notify(`The change to ${e.name || "this equipment"} wasn't saved (couldn't reach the register). Please try again.`, { kind: "error" });
          return;
        }
        const seen = new Set([...(cur.defects || []), ...(base.defects || [])].map(d => String(d.id)));
        const added = (e.defects || []).filter(d => !seen.has(String(d.id)));
        const next = { ...cur, defects: [...(cur.defects || []), ...added] };
        if (e.status !== base.status) next.status = e.status;
        const ok = await dbWrite(sb.from("equipment").upsert({ id: e.id, data: next }, { onConflict: "id" }), "equipment", { alertOnError: true });
        if (!ok) t.saved.delete(String(e.id));
      });
    });
  }, [equipment]); // eslint-disable-line

  useEffect(() => { if (!_ready.current || !writesAll()) return;
    auditList("inspection", siteInspections, i => [i.date, (INSP_TYPES.find(t => t.id === i.type) || {}).label || i.typeLabel || i.type, i.location].filter(Boolean).join(" · "));
    saveKeyed(regRef.current.inspections, siteInspections, {
      write: x => dbWrite(sb.from("site_inspections").upsert({ id: x.id, data: x }, { onConflict: "id" }), "site inspection"),
      remove: id => dbWrite(sb.from("site_inspections").delete().eq("id", id), "site inspection delete"),
    });
  }, [siteInspections]); // eslint-disable-line

  // Fire safety: each list saves only the records that changed, and deletes only ones removed here.
  useEffect(() => { if (!_ready.current || !writesAll()) return;
    Object.entries(FIRE_TABLES).forEach(([k, table]) => {
      saveKeyed(regRef.current.fire[k], (fireSafety || {})[k] || [], {
        write: x => dbWrite(sb.from(table).upsert({ id: x.id, data: x }, { onConflict: "id" }), `fire safety: ${table}`),
        remove: id => dbWrite(sb.from(table).delete().eq("id", id), `fire safety delete: ${table}`),
      });
    });
  }, [fireSafety]); // eslint-disable-line

  useEffect(() => { if (!_ready.current || !writesAll()) return;
    const j = stableJSON(firstAidData);
    if (j === firstAidSavedRef.current) return;   // nothing changed here (e.g. just refreshed)
    const before = firstAidSavedRef.current;
    firstAidSavedRef.current = j; firstAidWroteRef.current = Date.now();
    dbSaveFirstAidData(firstAidData).then(ok => {
      if (ok !== false) return;
      // not saved: go back to the last copy known to be in the database, so the next change
      // tries again (and a refresh can still bring in other people's changes)
      if (firstAidSavedRef.current === j) firstAidSavedRef.current = before;
      notify("The first aid register wasn't saved. Your change is still here — it will be tried again on your next change.", { kind: "error" });
    });
  }, [firstAidData]); // eslint-disable-line

  // Custom modules / machine types: only changed ones are saved (deleting has its own explicit call).
  useEffect(() => { if (!_ready.current || !writesAll()) return;
    saveKeyed(regRef.current.modules, customModules, { canDelete: false,
      write: m => dbWrite(sb.from("custom_modules").upsert({ id: m.id, data: m }, { onConflict: "id" }), `module "${m.title || m.id}"`) });
  }, [customModules]); // eslint-disable-line

  useEffect(() => { if (!_ready.current || !writesMachinery()) return;
    saveKeyed(regRef.current.machineTypes, customMachineTypes, { canDelete: false,
      write: m => dbWrite(sb.from("custom_machine_types").upsert({ id: m.id, data: m }, { onConflict: "id" }), "custom machine type") });
  }, [customMachineTypes]); // eslint-disable-line
}
