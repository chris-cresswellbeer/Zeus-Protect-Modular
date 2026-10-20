/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/documents.js — createDocumentActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Documents: read confirmations, who must read what, uploading / removing documents, and
 * document bundles (domains/documents/bundles.js).
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { addAssignments, bundleRow, removeAssignments, withoutDoc } from "../../domains/documents/bundles";
import { auditEvent } from "../../lib/audit";
import { dbWrite, insertNew, sb } from "../../lib/supabase";
import { notify } from "../../shared/Feedback";

export function createDocumentActions(app) {
  const {
    auditNameOf, docAssignments, docBundles, docs, inTurn, markWrite, setDocAckHistory, setDocAssignments,
    setDocBundles, user
  } = app;

  // Records which VERSION was read, and appends to doc_ack_history so earlier reads
  // are kept when a major new version clears the current acknowledgements.
  async function dbAcknowledgeDoc(userId, docId, date) {
    markWrite(`k:${userId}:${docId}`);
    const version = (docs.find(d => String(d.id) === String(docId)) || {}).version || 1;
    const hist = { user_id: String(userId), doc_id: String(docId), version, date, at: new Date().toISOString() };
    setDocAckHistory(p => [...p, hist]);
    const ok = await dbWrite(sb.from("doc_acknowledgements").upsert({ user_id: String(userId), doc_id: String(docId), date, version }, { onConflict: "user_id,doc_id" }), "document acknowledgement");
    if (!ok) return false;   // not saved: the phone's queue keeps it and tries again
    await dbWrite(sb.from("doc_ack_history").insert(hist), "document read history");
    return true;
  }
  // Compare with what's stored and change only the differences (never clear and rewrite,
  // which could lose everyone's assignment if the connection dropped in between).
  function dbSaveDocAssignments(docId, userIds) { return inTurn(`d:${docId}`, () => saveDocAssignmentsNow(docId, userIds)); }
  async function saveDocAssignmentsNow(docId, userIds) {
    markWrite(`d:${docId}`);
    const sid = String(docId);
    const want = [...new Set((userIds || []).map(String))];
    const { data, error } = await sb.from("doc_assignments").query(`select=user_id&doc_id=eq.${encodeURIComponent(sid)}`);
    if (error) { notify("Document assignments weren't saved. Please try again.", { kind: "error" }); return false; }
    const have = new Set((data || []).map(r => String(r.user_id)));
    const add = want.filter(u => !have.has(u));
    const drop = [...have].filter(u => !want.includes(u));
    let ok = true;
    if (add.length) ok = (await insertNew("doc_assignments", add.map(u => ({ doc_id: sid, user_id: u })), "doc assignments")) && ok;
    for (const u of drop) ok = (await dbWrite(sb.from("doc_assignments").delete().match({ doc_id: sid, user_id: u }), "doc assignments remove")) !== false && ok;
    return ok;
  }

  // Saves document metadata, uploading the file first if one is supplied.
  // Storage path is doc_<id>_<sanitisedFileName> in the "documents" bucket —
  // dbDeleteDoc rebuilds the same path to delete it, so keep the two in step.
  // NOTE: mutates `doc.fileUrl` on the object passed in.
  async function dbSaveDoc(doc, file) {
    // Upload raw file to Storage bucket — flat path, no subfolders
    if (file) {
      const safeName = doc.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `doc_${doc.id}_${safeName}`;
      const { error } = await sb.storage.upload("documents", path, file);
      if (error) { console.error("Doc upload failed:", error); notify("Upload failed: " + error, { kind: "error" }); return; }
      doc.fileUrl = sb.storage.getPublicUrl("documents", path);
    }
    await dbWrite(sb.from("documents").upsert({
      id: doc.id, title: doc.title, date: doc.date, size: doc.size,
      type: doc.type, ext: doc.ext, file_name: doc.fileName, file_url: doc.fileUrl || null,
      version: doc.version || 1,
      review_date: doc.reviewDate || null,
      description: doc.description || null,
      history: doc.history || [],
    }, { onConflict: "id" }), "document", { alertOnError: true });
  }

  // Removes the file, the document row, and its assignment + acknowledgement rows.
  async function dbDeleteDoc(id, fileName) {
    if (fileName) {
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      await dbWrite(sb.storage.remove("documents", [`doc_${id}_${safeName}`]), "document file delete");
    }
    await dbWrite(sb.from("documents").delete().eq("id", id), "document delete");
    await dbWrite(sb.from("doc_assignments").delete().eq("doc_id", id), "doc assignments delete");
    await dbWrite(sb.from("doc_acknowledgements").delete().eq("doc_id", id), "doc acknowledgements delete");
    // ...and take it out of any document bundle
    const inBundles = withoutDoc(docBundles, id);
    if (inBundles.length) {
      setDocBundles(p => p.map(b => inBundles.find(c => c.id === b.id) || b));
      await Promise.all(inBundles.map(dbSaveBundle));
    }
  }

  // ── Document bundles ─────────────────────────────────────────────────────────
  // A named set of documents assigned together as required reading. Assigning a
  // bundle writes the normal doc_assignments rows, so everything else (Required
  // Reading, confirmations, reminders, reports) works unchanged. See bundles.js.
  const sortBundles = list => [...list].sort((a, b) => a.name.localeCompare(b.name));
  async function dbSaveBundle(b) {
    markWrite(`b:${b.id}`);
    return dbWrite(sb.from("doc_bundles").upsert(bundleRow(b), { onConflict: "id" }), "document bundle", { alertOnError: true });
  }
  // Saves the per-document assignment lists that changed.
  async function writeDocAssignments(next, changed) {
    const ids = [...new Set(changed)];
    if (!ids.length) return;
    setDocAssignments(next);
    await Promise.all(ids.map(did => dbSaveDocAssignments(did, next[did] || [])));
  }
  const existingDocIds = ids => ids.filter(id => docs.some(d => String(d.id) === id));
  const bundleNames = ids => ids.map(id => auditNameOf(id));
  // Create or edit. Documents added to a bundle go straight to everyone who has it;
  // removed ones come off their reading only if the admin ticked that option.
  async function saveBundle(b, { unassignRemoved } = {}) {
    const old = docBundles.find(x => x.id === b.id);
    const now = new Date().toISOString();
    const rec = old ? { ...b, memberIds: old.memberIds, updatedAt: now }
      : { ...b, id: "bd" + Date.now(), memberIds: [], createdBy: user?.name || "", createdAt: now, updatedAt: now };
    if (!(await dbSaveBundle(rec))) return false;
    setDocBundles(p => sortBundles([...p.filter(x => x.id !== rec.id), rec]));
    let da = docAssignments; const changed = [];
    const added = old ? rec.docIds.filter(d => !old.docIds.includes(d)) : [];
    const removed = old ? old.docIds.filter(d => !rec.docIds.includes(d)) : [];
    if (rec.memberIds.length) {
      const r1 = addAssignments(da, existingDocIds(added), rec.memberIds); da = r1.next; changed.push(...r1.changed);
      if (unassignRemoved) { const r2 = removeAssignments(da, removed, rec.memberIds, docBundles.filter(x => x.id !== rec.id)); da = r2.next; changed.push(...r2.changed); }
    }
    await writeDocAssignments(da, changed);
    const title = id => (docs.find(d => String(d.id) === id) || {}).title || id;
    auditEvent("doc_bundle", rec.id, old ? "update" : "create",
      old ? `Edited document bundle "${rec.name}"${added.length ? ` — added ${added.map(title).join(", ")}` : ""}${removed.length ? ` — removed ${removed.map(title).join(", ")}${unassignRemoved && rec.memberIds.length ? " (taken off members' reading)" : ""}` : ""}`
          : `Created document bundle "${rec.name}" with ${rec.docIds.length} document${rec.docIds.length !== 1 ? "s" : ""}`,
      old ? { name: old.name !== rec.name ? { from: old.name, to: rec.name } : undefined, documents: added.length || removed.length ? { from: old.docIds.map(title), to: rec.docIds.map(title) } : undefined, autoNew: old.autoNew !== rec.autoNew ? { from: old.autoNew, to: rec.autoNew } : undefined }
          : { documents: { from: null, to: rec.docIds.map(title) } }, rec.name);
    return true;
  }
  async function deleteBundle(b, { unassign } = {}) {
    markWrite(`b:${b.id}`);
    if (!(await dbWrite(sb.from("doc_bundles").delete().eq("id", b.id), "document bundle delete", { alertOnError: true }))) return;
    setDocBundles(p => p.filter(x => x.id !== b.id));
    if (unassign) { const r = removeAssignments(docAssignments, b.docIds, b.memberIds, docBundles.filter(x => x.id !== b.id)); await writeDocAssignments(r.next, r.changed); }
    auditEvent("doc_bundle", b.id, "delete", `Deleted document bundle "${b.name}"${unassign && b.memberIds.length ? " and took its documents off members' reading" : ""}`, {}, b.name);
  }
  // Give a bundle to people → number newly given it.
  async function assignBundle(b, userIds) {
    const cur = docBundles.find(x => x.id === b.id) || b;
    const add = [...new Set(userIds.map(String))].filter(u => !cur.memberIds.includes(u));
    if (!add.length) return 0;
    const rec = { ...cur, memberIds: [...cur.memberIds, ...add], updatedAt: new Date().toISOString() };
    if (!(await dbSaveBundle(rec))) return 0;
    setDocBundles(p => p.map(x => x.id === rec.id ? rec : x));
    const r = addAssignments(docAssignments, existingDocIds(rec.docIds), add);
    await writeDocAssignments(r.next, r.changed);
    auditEvent("doc_bundle", rec.id, "assign", `Assigned document bundle "${rec.name}" to ${add.length} ${add.length !== 1 ? "people" : "person"}: ${bundleNames(add).join(", ")}`, { people: { from: null, to: bundleNames(add) } }, rec.name);
    return add.length;
  }
  // Take a bundle away: its documents come off their reading unless another bundle of theirs has them.
  async function unassignBundle(b, userIds) {
    const cur = docBundles.find(x => x.id === b.id) || b;
    const drop = userIds.map(String);
    const rec = { ...cur, memberIds: cur.memberIds.filter(u => !drop.includes(u)), updatedAt: new Date().toISOString() };
    if (!(await dbSaveBundle(rec))) return;
    setDocBundles(p => p.map(x => x.id === rec.id ? rec : x));
    const r = removeAssignments(docAssignments, rec.docIds, drop, docBundles.filter(x => x.id !== rec.id));
    await writeDocAssignments(r.next, r.changed);
    auditEvent("doc_bundle", rec.id, "unassign", `Took document bundle "${rec.name}" away from ${bundleNames(drop).join(", ")}`, { people: { from: bundleNames(drop), to: null } }, rec.name);
  }
  // New staff get every bundle marked "give to new staff automatically".
  async function giveNewStarterBundles(userIds) {
    const ids = userIds.map(String);
    const autos = docBundles.filter(b => b.autoNew);
    if (!autos.length || !ids.length) return;
    let da = docAssignments; const changed = [], recs = [];
    autos.forEach(b => {
      const add = ids.filter(u => !b.memberIds.includes(u));
      if (!add.length) return;
      recs.push({ ...b, memberIds: [...b.memberIds, ...add] });
      const r = addAssignments(da, existingDocIds(b.docIds), add); da = r.next; changed.push(...r.changed);
    });
    if (!recs.length) return;
    setDocBundles(p => p.map(b => recs.find(r => r.id === b.id) || b));
    await Promise.all(recs.map(dbSaveBundle));
    await writeDocAssignments(da, changed);
    recs.forEach(b => auditEvent("doc_bundle", b.id, "assign", `New staff given document bundle "${b.name}" automatically: ${bundleNames(ids).join(", ")}`, {}, b.name));
  }

  return {
    dbAcknowledgeDoc, dbSaveDocAssignments, saveDocAssignmentsNow, dbSaveDoc, dbDeleteDoc, sortBundles,
    dbSaveBundle, writeDocAssignments, existingDocIds, bundleNames, saveBundle, deleteBundle, assignBundle,
    unassignBundle, giveNewStarterBundles
  };
}
