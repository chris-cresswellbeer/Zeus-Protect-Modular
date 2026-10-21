/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/training.js — createTrainingActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Training: assigning modules and due dates, completions (quiz, recorded, group sessions, evidence),
 * quiz failures, custom modules (duplicate, hide, versions) and module translations.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { evidenceLabel, uploadEvidence } from "../../domains/training/evidence";
import { auditEvent } from "../../lib/audit";
import { todayISO } from "../../lib/dates";
import { addDays, formatDue } from "../../lib/dueDates";
import { translationKey } from "../../lib/moduleTranslate";
import { dbWrite, sb } from "../../lib/supabase";
import { ask, notify } from "../../shared/Feedback";
import { sharedTracker } from "../records";

export function createTrainingActions(app) {
  const {
    allModules, allUsers, assigns, auditNameOf, comps, customModules, dueDates, markWrite, moduleTrans,
    pendingModuleSave, recentWriteRef, refreshSharedRecords, setAssigns, setAtab, setBulkTarget,
    setCompHistory, setComps, setCustomModules, setDueDates, setEditingModule, setModuleTrans,
    setModuleVersions, setPendingModuleSave, setTarget, user
  } = app;

  // ── Sync helpers — call these wherever state currently changes ───────────────

  // Replaces the assignment list for each user in `newAssigns` ({userId:[moduleIds]}).
  // Delete-then-insert (not atomic) — pass ONLY the users that changed.
  // Saves each person's full list of assigned modules. Only the differences are
  // written: modules newly assigned are added, unassigned ones removed. (It used to
  // clear the person's list and write it again, so a refused write — e.g. a staff id
  // too long for an "integer" column, see user_id_text_columns.sql — silently lost
  // ALL their assignments.) If anything is refused, the admin is told why and the
  // screen goes back to what is really stored.
  // due (optional): { uid: { mid: "YYYY-MM-DD" } } — due dates for modules being ADDED now.
  async function dbSaveAssigns(newAssigns, due) {
    Object.keys(newAssigns).forEach(uid => markWrite(`a:${uid}`));
    const failed = [];
    for (const [uid, mids] of Object.entries(newAssigns)) {
      const suid = String(uid);
      const want = [...new Set((mids || []).map(String))];
      const { data, error: readErr } = await sb.from("training_assigns").query(`select=user_id,module_id&user_id=eq.${encodeURIComponent(suid)}`);
      if (readErr) { failed.push({ uid: suid, error: readErr }); continue; }
      const have = new Set((data || []).filter(r => String(r.user_id) === suid).map(r => String(r.module_id)));
      const add = want.filter(m => !have.has(m));
      const drop = [...have].filter(m => !want.includes(m));
      if (add.length) {
        // due_date is only sent when there is one, so assigning never depends on that column
        const { error } = await sb.from("training_assigns").insert(add.map(m => {
          const d = due && due[suid] && due[suid][m];
          return d ? { user_id: suid, module_id: m, due_date: d } : { user_id: suid, module_id: m };
        }));
        if (error) failed.push({ uid: suid, error });
      }
      for (const m of drop) {
        const { error } = await sb.from("training_assigns").delete().match({ user_id: suid, module_id: m });
        if (error) failed.push({ uid: suid, error });
      }
    }
    if (failed.length) {
      console.error("training_assigns save error:", failed);
      failed.forEach(f => recentWriteRef.current.delete(`a:${f.uid}`));   // let the next refresh show what is really stored
      const names = [...new Set(failed.map(f => auditNameOf(f.uid)))].join(", ");
      notify(`Training assignments for ${names} could not be saved.\n${String(failed[0].error).slice(0, 300)}\nIf this mentions "out of range for type integer", run user_id_text_columns.sql in the Supabase SQL Editor.`, { kind: "error" });
      sharedTracker.forget("training_assigns");   // read it again even though nothing in it changed
      refreshSharedRecords();
    }
    return failed.length === 0;
  }

  // Change (or clear, with null) the due date of existing assignments.
  // entries: [{ uid, mid, due }]. Shows an error if the database refuses.
  async function dbSetDueDates(entries) {
    const failed = [];
    setDueDates(p => {
      const n = { ...p };
      entries.forEach(({ uid, mid, due }) => { const u = String(uid); const m = { ...(n[u] || {}) }; if (due) m[String(mid)] = due; else delete m[String(mid)]; if (Object.keys(m).length) n[u] = m; else delete n[u]; });
      return n;
    });
    for (const { uid, mid, due } of entries) {
      markWrite(`a:${uid}`);
      const { error } = await sb.from("training_assigns").update({ due_date: due || null }).match({ user_id: String(uid), module_id: String(mid) });
      if (error) failed.push(error);
    }
    if (failed.length) notify(`The due date couldn't be saved.\n${String(failed[0]).slice(0, 240)}\nIf this mentions "due_date", run assign_due_dates.sql in the Supabase SQL Editor.`, { kind: "error" });
    return !failed.length;
  }
  // Record due dates locally for modules just assigned (the rows were inserted with them).
  const noteDue = due => { if (!due) return; setDueDates(p => { const n = { ...p }; Object.entries(due).forEach(([u, ms]) => { n[u] = { ...(n[u] || {}), ...ms }; }); return n; }); };
  // Training Matrix cell actions (domains/training/TrainingMatrixView.jsx)
  async function matrixAssign(uid, mid) {
    const k = String(uid), cur = assigns[k] || [];
    if (cur.includes(mid)) return;
    const m = allModules.find(x => String(x.id) === String(mid)), u = allUsers.find(x => String(x.id) === k);
    setAssigns(p => ({ ...p, [k]: [...cur, mid] }));
    const ok = await dbSaveAssigns({ [k]: [...cur, mid] });
    if (ok) notify(`"${m ? m.title : mid}" assigned to ${u ? u.name : "them"}.`, { undo: () => { setAssigns(p => ({ ...p, [k]: (p[k] || []).filter(x => x !== mid) })); dbSaveAssigns({ [k]: (assigns[k] || []).filter(x => x !== mid) }); } });
  }
  const openInAssign = (uid, then) => { setBulkTarget("individual"); setTarget(String(uid)); setAtab("assign"); if (then) then(); };
  // Ask for a due date (or none) for one assignment.
  async function askDueDate(uid, mid) {
    const u = allUsers.find(x => String(x.id) === String(uid)), m = allModules.find(x => String(x.id) === String(mid));
    const cur = ((dueDates[String(uid)] || {})[String(mid)]) || "";
    const v = await ask({ title: "Due date", message: `${u ? u.name : "This person"} — ${m ? m.title : "this module"}`, ok: "Save",
      fields: [{ id: "due", label: "Complete by", type: "date", value: cur || addDays(14), help: "Clear the date for no due date." }] });
    if (!v) return;
    const due = (v.due || "").trim() || null;
    if (due === (cur || null)) return;
    if (await dbSetDueDates([{ uid, mid, due }])) notify(due ? `Due date set: ${formatDue(due)}.` : "Due date removed.", { undo: () => dbSetDueDates([{ uid, mid, due: cur || null }]) });
  }

  // One row per (user, module). Retaking a module overwrites the previous result.
  // Also appends to training_completion_history, so earlier results (and which
  // module version they were for) are kept when a retake or a major new version
  // replaces the current row.
  async function dbSaveCompletion(userId, moduleId, rec) {
    markWrite(`c:${userId}:${moduleId}`);
    const moduleVersion = rec.moduleVersion || (allModules.find(m => String(m.id) === String(moduleId)) || {}).version || 1;
    // `recorded` (admin-recorded prior training, see completion.js) is only sent when
    // present, so ordinary quiz results never depend on that column existing.
    // A quiz result replacing a recorded completion clears the "recorded" mark.
    const wasRecorded = !!((comps[String(userId)] || {})[String(moduleId)] || {}).recorded;
    const rc = rec.recorded ? { recorded: rec.recorded } : wasRecorded ? { recorded: null } : {};
    // The language it was done in (module_translations.sql). Like `recorded`, only sent when
    // there is one — or to clear an earlier one — so English results never need the columns.
    const hadLang = !!((comps[String(userId)] || {})[String(moduleId)] || {}).lang;
    const lc = rec.lang && rec.lang !== "en" ? { lang: rec.lang, translation: rec.translation || null } : hadLang ? { lang: null, translation: null } : {};
    const hist = { user_id: String(userId), module_id: String(moduleId), module_version: moduleVersion, score: rec.score, date: rec.date, cert_id: rec.certId || null, at: new Date().toISOString(), ...(rec.recorded ? rc : {}),
      ...(rec.lang && rec.lang !== "en" ? { lang: rec.lang, translation: rec.translation || null } : {}) };
    setCompHistory(p => [...p, hist]);
    const ok = await dbWrite(sb.from("training_completions").upsert({
      user_id: userId, module_id: moduleId,
      score: rec.score, date: rec.date, cert_id: rec.certId, answers: rec.answers,
      module_version: moduleVersion, ...rc, ...lc,
    }, { onConflict: "user_id,module_id" }), "training completion", rec.recorded ? { alertOnError: true } : undefined);
    if (!ok) return false;   // not saved: the caller (e.g. the phone's offline queue) keeps it and tries again
    await dbWrite(sb.from("training_completion_history").insert(hist), "training completion history");
    return true;
  }

  // ── Admin: record training completed before the portal (e.g. on the old system) ──
  // items: [{ userId, moduleId, date: "YYYY-MM-DD", note }]. Each person is also
  // assigned the module if they weren't already, so it counts towards compliance.
  // Anyone who already has a result for that module is skipped (never overwritten).
  // Returns { saved, skipped:[{userId,moduleId,reason}] }.
  async function recordCompletions(items) {
    const at = new Date().toISOString();
    const by = user ? user.name : "", byId = user ? String(user.id) : "";
    const skipped = [], toSave = [];
    items.forEach(it => {
      const uid = String(it.userId), mid = String(it.moduleId);
      // A group session (it.session) renews an OLDER result; anything else never overwrites one.
      const existing = (comps[uid] || {})[mid];
      if (existing && !(it.session && String(existing.date || "") < it.date)) {
        skipped.push({ ...it, reason: it.session ? "already has a result from that date or later" : "already has a result for this module" }); return;
      }
      if (toSave.some(x => x.uid === uid && x.mid === mid)) { skipped.push({ ...it, reason: "listed twice" }); return; }
      const mod = allModules.find(m => String(m.id) === mid);
      toSave.push({ uid, mid, rec: { score: null, date: it.date, certId: null, answers: null, moduleVersion: (mod && mod.version) || 1,
        recorded: { by, byId, at, ...(it.note ? { note: String(it.note).slice(0, 300) } : {}), ...(it.session ? { session: it.session } : {}),
          ...(it.evidence && it.evidence.length ? { evidence: it.evidence } : {}) } } });
    });
    if (!toSave.length) return { saved: 0, skipped };
    // assignments first (one write per person), then the completions
    const addAssign = {};
    toSave.forEach(({ uid, mid }) => { const cur = addAssign[uid] || assigns[uid] || []; if (!cur.includes(mid)) addAssign[uid] = [...cur, mid]; });
    if (Object.keys(addAssign).length) { setAssigns(p => ({ ...p, ...addAssign })); await dbSaveAssigns(addAssign); }
    let saved = 0;
    for (const { uid, mid, rec } of toSave) {
      const ok = await dbSaveCompletion(uid, mid, rec);
      if (!ok) { skipped.push({ userId: uid, moduleId: mid, date: rec.date, reason: "couldn't be saved" }); continue; }
      saved++;
      setComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [mid]: rec } }));
      const who = (allUsers.find(u => String(u.id) === uid) || {}).name || uid;
      const title = (allModules.find(m => String(m.id) === mid) || {}).title || mid;
      auditEvent("training_completion", uid, "record", `${rec.recorded.session ? "Group session" : "Recorded as completed"} on ${rec.date}: ${title}${rec.recorded.note ? ` — ${rec.recorded.note}` : ""}${rec.recorded.evidence ? ` (${evidenceLabel(rec, 0).toLowerCase()} attached: ${rec.recorded.evidence.map(e => e.name).join(", ")})` : ""}`,
        { module: { from: null, to: title }, completed: { from: null, to: rec.date } }, who);
    }
    return { saved, skipped };
  }
  // Evidence for recorded training (training/evidence.js): the signed sign-in sheet of a
  // group session, or a certificate for prior training. Added to the current record and
  // its history row, for every target. Returns an error message, or "" when all saved.
  async function attachEvidence(targets, files, key) {
    let evidence;
    try { evidence = await uploadEvidence(files, key, user ? user.name : ""); }
    catch (e) { return String(e.message || e); }
    const failed = [];
    for (const t of targets) {
      const uid = String(t.uid), mid = String(t.mid);
      const c = (comps[uid] || {})[mid];
      if (!c || !c.recorded) continue;
      const recorded = { ...c.recorded, evidence: [...(c.recorded.evidence || []), ...evidence] };
      markWrite(`c:${uid}:${mid}`);
      const { error } = await sb.from("training_completions").update({ recorded }).match({ user_id: uid, module_id: mid });
      if (error) { console.error("evidence save failed:", error); failed.push(uid); continue; }
      dbWrite(sb.from("training_completion_history").update({ recorded }).match({ user_id: uid, module_id: mid, date: c.date }), "evidence history");
      setComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [mid]: { ...((p[uid] || {})[mid] || c), recorded } } }));
      setCompHistory(p => p.map(h => String(h.user_id) === uid && String(h.module_id) === mid && h.date === c.date && h.recorded ? { ...h, recorded } : h));
      const who = (allUsers.find(u => String(u.id) === uid) || {}).name || uid;
      const title = (allModules.find(m => String(m.id) === mid) || {}).title || mid;
      auditEvent("training_completion", uid, "evidence", `${evidenceLabel({ recorded }, 0)} attached to ${c.recorded.session ? "group session" : "recorded completion"} (${c.date}): ${title} — ${evidence.map(e => e.name).join(", ")}`,
        { evidence: { from: (c.recorded.evidence || []).map(e => e.name), to: recorded.evidence.map(e => e.name) } }, who);
    }
    if (failed.length) return `The file was uploaded, but it couldn't be linked to ${failed.length} record${failed.length !== 1 ? "s" : ""} (${failed.map(auditNameOf).join(", ")}). Try again.`;
    return "";
  }
  // Attach to a whole group session (every attendee's record), from the session register.
  const attachToSession = (session, files) =>
    attachEvidence(session.attendees.map(uid => ({ uid, mid: session.moduleId })), files, session.key.startsWith("gs_") ? session.key : `gs_legacy_${session.moduleId}_${session.date}`);

  // Undo a recorded completion (only recorded ones — quiz results can't be removed here).
  async function removeRecordedCompletion(userId, moduleId) {
    const uid = String(userId), mid = String(moduleId);
    const c = (comps[uid] || {})[mid];
    if (!c || !c.recorded) return;
    markWrite(`c:${uid}:${mid}`);
    const ok = await dbWrite(sb.from("training_completions").delete().match({ user_id: uid, module_id: mid }), "recorded completion delete", { alertOnError: true });
    if (!ok) return;
    dbWrite(sb.from("training_completion_history").delete().match({ user_id: uid, module_id: mid, date: c.date }), "recorded completion history delete");
    setComps(p => { const n = { ...p, [uid]: { ...(p[uid] || {}) } }; delete n[uid][mid]; return n; });
    setCompHistory(p => p.filter(h => !(String(h.user_id) === uid && String(h.module_id) === mid && h.recorded && h.date === c.date)));
    const who = (allUsers.find(u => String(u.id) === uid) || {}).name || uid;
    const title = (allModules.find(m => String(m.id) === mid) || {}).title || mid;
    auditEvent("training_completion", uid, "remove", `Removed recorded completion (${c.date}): ${title}`, { module: { from: title, to: null } }, who);
    // no "are you sure?" first: it can be put straight back
    notify(`Removed the recorded completion of "${title}" for ${who}.`, { undo: async () => {
      const ok2 = await dbSaveCompletion(uid, mid, c);
      if (!ok2) { notify("Couldn't put it back. Record it again with Record as completed.", { kind: "error" }); return; }
      setComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [mid]: c } }));
      auditEvent("training_completion", uid, "record", `Put back recorded completion (${c.date}): ${title}`, { module: { from: null, to: title } }, who);
      notify(`"${title}" is recorded as completed again.`);
    } });
  }

  // ── Training translations (admins: ModulePreviewModal → Translations) ─────────
  // row = { module_id, lang, data, source_hash, status, translated_at, checked_by, checked_at }
  async function dbSaveTranslation(row) {
    const key = translationKey(row.module_id, row.lang);
    const prev = moduleTrans[key];
    setModuleTrans(p => ({ ...p, [key]: row }));
    const ok = await dbWrite(sb.from("module_translations").upsert(row, { onConflict: "module_id,lang" }), "training translation", { alertOnError: true });
    if (!ok) setModuleTrans(p => { const n = { ...p }; if (prev) n[key] = prev; else delete n[key]; return n; });
    return ok;
  }
  async function dbDeleteTranslation(moduleId, lang) {
    const key = translationKey(moduleId, lang);
    const ok = await dbWrite(sb.from("module_translations").delete().match({ module_id: String(moduleId), lang }), "training translation delete", { alertOnError: true });
    if (ok) setModuleTrans(p => { const n = { ...p }; delete n[key]; return n; });
    return ok;
  }

  // Insert-only log of failed quiz attempts (shown to admins for follow-up).
  // Resolves false when the database didn't take it (the phone's offline queue then keeps it).
  async function dbSaveQuizFailure(record) {
    return dbWrite(sb.from("quiz_failures").insert({ data: record }), "quiz failure record");
  }

  async function dbSaveCustomModule(mod) {
    await dbWrite(sb.from("custom_modules").upsert({ id: mod.id, data: mod }, { onConflict: "id" }), `module "${mod.title || mod.id}"`);
  }

  async function dbDeleteCustomModule(id) {
    await dbWrite(sb.from("custom_modules").delete().eq("id", id), "module delete");
  }

  // Admin "Duplicate" action on the Modules tab.
  function duplicateModule(m) {
    // Deep clone via JSON round-trip — module data (slides, quiz, image/video URLs) is plain serializable data.
    const cloned = JSON.parse(JSON.stringify(m));
    cloned.id = `custom_${Date.now()}`;
    cloned.title = `${m.title} (Copy)`;
    cloned._custom = true;
    delete cloned._override; // a duplicate is always a brand new, independent module — never an override
    cloned.version = 1; delete cloned.versionNote; delete cloned.versionChange; cloned.versionDate = todayISO();
    setCustomModules(prev=>[...prev, cloned]);
    dbSaveCustomModule(cloned);
    // Jump straight into the editor so the admin can rename/adjust the new version
    setEditingModule(cloned);
    setAtab("create");
  }

  // "Deleting" a built-in module can't remove it from the TRAINING_MODULES source — instead it's
  // hidden (soft-delete) via an override flag, and can be unhidden again at any time. Fully custom
  // modules are hidden the same way here; hard deletion of custom modules is handled separately.
  function setModuleHidden(m, hidden) {
    const isFullyCustom = m._custom && !m._override;
    if (isFullyCustom) {
      const updated = { ...m, _hidden: hidden };
      setCustomModules(prev=>prev.map(x=>x.id===m.id?updated:x));
      dbSaveCustomModule(updated);
      return;
    }
    const existingOverride = customModules.find(x=>x.id===m.id && x._override);
    const updated = { ...(existingOverride||m), _custom:true, _override:true, _hidden: hidden };
    setCustomModules(prev=>{
      if (existingOverride) return prev.map(x=>x.id===m.id?updated:x);
      return [...prev, updated];
    });
    dbSaveCustomModule(updated);
  }

  // Saves an edited module as a NEW VERSION (called from NewVersionModal).
  //  • the previous content is kept in module_versions (snapshot)
  //  • change "major" clears everyone's current completion so they must redo it —
  //    their earlier result stays in training_completion_history
  //  • change "minor" keeps completions (each records the version it was for)
  function saveModuleVersion(change, note) {
    const { m, prev } = pendingModuleSave;
    const prevVer = prev.version || 1, newVer = prevVer + 1, today = todayISO();
    const snap = { id: `${prev.id}_v${prevVer}`, module_id: String(prev.id), version: prevVer, data: prev,
      saved_at: new Date().toISOString(), saved_by: user ? user.name : "", change, note: note || null };
    setModuleVersions(p => [...p.filter(x => x.id !== snap.id), snap]);
    dbWrite(sb.from("module_versions").upsert(snap, { onConflict: "id" }), "module version snapshot");
    const saved = { ...m, version: newVer, versionDate: today, versionNote: note || "", versionChange: change };
    if (prev._custom) {
      const upd = { ...saved, _custom: true, ...(prev._override ? { _override: true } : {}) };
      setCustomModules(p => p.map(x => x.id === m.id ? upd : x));
      dbSaveCustomModule(upd);
    } else {
      // Built-in module → saved as an override with the same id
      const upd = { ...saved, _custom: true, _override: true };
      setCustomModules(p => p.find(x => x.id === m.id) ? p.map(x => x.id === m.id ? upd : x) : [...p, upd]);
      dbSaveCustomModule(upd);
    }
    const logVersion = cleared => auditEvent("module", m.id, "new_version",
      `Version ${newVer} (${change === "major" ? `major — ${cleared} ${cleared === 1 ? "person" : "people"} must redo it` : "minor — completions kept"})${note ? `: ${note}` : ""}`,
      { version: { from: prevVer, to: newVer }, change: { from: null, to: change } }, m.title || "");
    if (change === "major") {
      // Clear EVERY current completion of this module, as the database has them —
      // not just the ones on this screen, which may be missing someone who finished
      // it after you signed in. Their earlier results stay in the history.
      (async () => {
        const mid = String(m.id);
        const { data, error } = await sb.from("training_completions").query(`select=user_id&module_id=eq.${encodeURIComponent(mid)}`);
        const affected = [...new Set([...(error ? [] : (data || []).map(r => String(r.user_id))),
          ...Object.keys(comps).filter(uid => comps[uid] && comps[uid][m.id])])];
        affected.forEach(uid => markWrite(`c:${uid}:${mid}`));
        setComps(p => { const n = { ...p }; affected.forEach(uid => { if (n[uid]) { n[uid] = { ...n[uid] }; delete n[uid][m.id]; } }); return n; });
        await dbWrite(sb.from("training_completions").delete().eq("module_id", mid), "completion clear (new module version)", { alertOnError: true });
        logVersion(affected.length);
      })();
    } else logVersion(0);
    setPendingModuleSave(null);
    setEditingModule(null);
    setAtab("modules");
  }

  return {
    dbSaveAssigns, dbSetDueDates, noteDue, matrixAssign, openInAssign, askDueDate, dbSaveCompletion,
    recordCompletions, attachEvidence, attachToSession, removeRecordedCompletion, dbSaveTranslation,
    dbDeleteTranslation, dbSaveQuizFailure, dbSaveCustomModule, dbDeleteCustomModule, duplicateModule,
    setModuleHidden, saveModuleVersion
  };
}
