/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/registers.js — createRegisterActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * The H&S registers saved by explicit calls: contractors, permits, risk assessments, external
 * certificates, machinery, equipment, inspections, first aid and fire safety.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { auditRecord } from "../../lib/audit";
import { dbWrite, sb } from "../../lib/supabase";
import { markSaved, mergeKeyed } from "../../lib/keyedSync";

export function createRegisterActions(app) {
  const {
    fireLoadOkRef, regRef, setContractors
  } = app;

  // Contractor data is stored as JSON blobs keyed by contractor id (company, inductions, certs, visits).
  // Saving a company first reads the stored copy and keeps anything added there meanwhile (a
  // worker added by a QR sign-in, a document uploaded in another browser): lib/contractorApproval.js
  // mergeCompany. opts.removedWorkers / removedDocs: ids this save deliberately takes out.
  async function dbSaveContractor(c, opts = {}) {
    const T = regRef.current.contractors;
    markSaved(T, c);                       // the 30-second refresh leaves this company alone meanwhile
    let out = c;
    const r = await sb.from("contractors").select("*").eq("id", c.id);
    const stored = r && !r.error && Array.isArray(r.data) && r.data[0] ? r.data[0].data : null;
    if (stored) {
      const { mergeCompany } = await import("../../lib/contractorApproval");   // only admins save companies
      out = mergeCompany(c, stored, opts);
      if (JSON.stringify(out) !== JSON.stringify(c)) setContractors(p => p.map(x => (String(x.id) === String(c.id) ? out : x)));
    }
    markSaved(T, out);
    await dbWrite(sb.from("contractors").upsert({id:out.id,data:out},{onConflict:"id"}), "contractor");
    return out;
  }
  // Read the register again now (a QR sign-in has just added a company or worker this browser
  // hasn't got); the 30-second refresh does the same for changes made elsewhere.
  async function refreshContractors() {
    const readAt = Date.now();
    const r = await sb.from("contractors").select("*");
    if (r && !r.error && Array.isArray(r.data)) { const fresh = r.data.map(x => x.data).filter(Boolean); setContractors(cur => mergeKeyed(regRef.current.contractors, cur, fresh, readAt)); }
  }
  async function dbDeleteContractor(id) {
    const T = regRef.current.contractors;
    T.saved.delete(String(id)); T.wrote.set(String(id), Date.now());   // a refresh read before this mustn't bring it back
    await dbWrite(sb.from("contractors").delete().eq("id",id), "contractor delete");
  }
  async function dbSaveContractorInductions(cid,data) { await dbWrite(sb.from("contractor_inductions").upsert({contractor_id:cid,data},{onConflict:"contractor_id"}), "contractor inductions"); }
  async function dbSaveContractorCerts(cid,data) { await dbWrite(sb.from("contractor_certs").upsert({contractor_id:cid,data},{onConflict:"contractor_id"}), "contractor certs"); }
  async function dbSaveContractorVisits(cid,data) { await dbWrite(sb.from("contractor_visits").upsert({contractor_id:cid,data},{onConflict:"contractor_id"}), "contractor visits"); }

  async function dbSavePermit(p) {
    return dbWrite(sb.from("permits").upsert({ id: p.id, data: p }, { onConflict: "id" }), "permit", { alertOnError: true });
  }
  async function dbDeletePermit(id) {
    await dbWrite(sb.from("permits").delete().eq("id", id), "permit delete");
  }

  async function dbSaveRA(ra) {
    auditRecord("risk_assessment", ra.id, ra, [ra.reference, ra.title].filter(Boolean).join(" · "));
    await dbWrite(sb.from("risk_assessments").upsert({ id: ra.id, data: ra }, { onConflict: "id" }), "risk assessment", { alertOnError: true });
  }

  // both resolve to true when the database accepted the change
  async function dbSaveExtCert(userId, certType, data) {
    return dbWrite(sb.from("ext_certs").upsert({ user_id: String(userId), cert_type: certType, data }, { onConflict: "user_id,cert_type" }), "external certificate", { alertOnError: true });
  }

  async function dbDeleteExtCert(userId, certType) {
    return dbWrite(sb.from("ext_certs").delete().match({ user_id: userId, cert_type: certType }), "external certificate delete");
  }

  async function dbSaveCustomMachineType(type) {
    await dbWrite(sb.from("custom_machine_types").upsert({ id: type.id, data: type }, { onConflict: "id" }), "custom machine type");
  }

  async function dbDeleteCustomMachineType(id) {
    await dbWrite(sb.from("custom_machine_types").delete().eq("id", id), "custom machine type delete");
  }

  async function dbSaveMachineComp(userId, machineId, data) {
    return dbWrite(sb.from("machine_completions").upsert({ user_id: String(userId), machine_id: String(machineId), data }, { onConflict: "user_id,machine_id" }), "machine competence record", { alertOnError: true });
  }

  async function dbDeleteMachineComp(userId, machineId) {
    return dbWrite(sb.from("machine_completions").delete().match({ user_id: String(userId), machine_id: String(machineId) }), "machine competence delete", { alertOnError: true });
  }

  // UPSERT-AND-PRUNE (the preferred pattern): upsert everything in state, then read the ids
  // in the table and delete any that are no longer in state.
  async function dbSaveEquipment(items) {
    // Upsert-and-prune instead of delete-everything-then-reinsert: only
    // the items that actually changed get rewritten, and only items that
    // were genuinely removed get deleted. The old version deleted and
    // reinserted the entire table on every single edit, regardless of how
    // many items actually changed.
    if (items.length) await dbWrite(sb.from("equipment").upsert(items.map(e => ({ id: e.id, data: e })), { onConflict: "id" }), "equipment sync");
    const { data: existing } = await sb.from("equipment").select("id");
    if (existing && existing.length) {
      const currentIds = new Set(items.map(e => e.id));
      const toDelete = existing.filter(r => !currentIds.has(r.id)).map(r => r.id);
      for (const id of toDelete) await dbWrite(sb.from("equipment").delete().eq("id", id), "equipment delete");
    }
  }

  async function dbSaveSiteInspections(items) {
    // Same upsert-and-prune approach as dbSaveEquipment above.
    if (items.length) await dbWrite(sb.from("site_inspections").upsert(items.map(e => ({ id: e.id, data: e })), { onConflict: "id" }), "site inspections sync");
    const { data: existing } = await sb.from("site_inspections").select("id");
    if (existing && existing.length) {
      const currentIds = new Set(items.map(e => e.id));
      const toDelete = existing.filter(r => !currentIds.has(r.id)).map(r => r.id);
      for (const id of toDelete) await dbWrite(sb.from("site_inspections").delete().eq("id", id), "site inspection delete");
    }
  }

  // Whole first aid register saved as one JSON document (row id "singleton").
  async function dbSaveFirstAidData(data) {
    return dbWrite(sb.from("first_aid_register").upsert({ id: "singleton", data }, { onConflict: "id" }), "first aid register");
  }

  // Saves the six fire-safety lists to their six tables using upsert-and-prune.
  // Transient fields are stripped before saving: `_fileObj` (a browser File object,
  // not serialisable) and, for FRA reviews, the base64 `fileData` (the file itself
  // lives in the "fire-safety" storage bucket instead).
  // Removed items are deleted from the DB, including the very last item of a list
  // (only when every fire table loaded OK — see fireLoadOkRef).
  async function dbSaveFireSafety(fs) {
    const upsertTable = async (table, items) => {
      if (!items || !items.length) return;
      const rows = table === "fire_fra_reviews"
        ? items.map(r => { const {fileData, _fileObj, ...rest} = r; return { id: r.id, data: rest }; })
        : items.map(r => { const {_fileObj, ...rest} = r; return { id: r.id, data: rest }; });
      await dbWrite(sb.from(table).upsert(rows, { onConflict: "id" }), `fire safety: ${table}`);
    };
    const deleteRemoved = async (table, items) => {
      // Delete rows in DB that are no longer in state. This must also run when the
      // list is now EMPTY — returning early here is why deleting the last item in a
      // list used to come back after a reload.
      if (!fireLoadOkRef.current) return;   // list may be seed data — never prune on that
      items = items || [];
      const { data: existing } = await sb.from(table).select("id");
      if (!existing || !existing.length) return;
      const currentIds = new Set(items.map(r => r.id));
      const toDelete = existing.filter(r => !currentIds.has(r.id)).map(r => r.id);
      if (toDelete.length) {
        for (const id of toDelete) await dbWrite(sb.from(table).delete().eq("id", id), `fire safety delete: ${table}`);
      }
    };
    const sync = async (table, items) => {
      await upsertTable(table, items);
      await deleteRemoved(table, items);
    };
    await sync("fire_wardens",       fs.wardens       || []);
    await sync("fire_drills",        fs.drills        || []);
    await sync("fire_alarm_tests",   fs.alarmTests    || []);
    await sync("fire_extinguishers", fs.extinguishers || []);
    await sync("fire_emerg_lighting",fs.emergLighting || []);
    await sync("fire_fra_reviews",   fs.fraReviews    || []);
  }

  // Fire Risk Assessment PDF upload → returns the public URL, or null on failure.
  async function dbUploadFraDocument(reviewId, file, fileName) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `fra_${reviewId}_${safeName}`;
    const { error } = await sb.storage.upload("fire-safety", path, file);
    if (error) { console.error("FRA upload error:", error); return null; }
    return sb.storage.getPublicUrl("fire-safety", path);
  }

  async function dbDeleteFraDocument(reviewId, fileName) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    await dbWrite(sb.storage.remove("fire-safety", [`fra_${reviewId}_${safeName}`]), "FRA document delete");
  }

  return {
    dbSaveContractor, dbDeleteContractor, refreshContractors, dbSaveContractorInductions, dbSaveContractorCerts,
    dbSaveContractorVisits, dbSavePermit, dbDeletePermit, dbSaveRA, dbSaveExtCert, dbDeleteExtCert,
    dbSaveCustomMachineType, dbDeleteCustomMachineType, dbSaveMachineComp, dbDeleteMachineComp,
    dbSaveEquipment, dbSaveSiteInspections, dbSaveFirstAidData, dbSaveFireSafety, dbUploadFraDocument,
    dbDeleteFraDocument
  };
}
