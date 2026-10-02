/**
 * bundles.js — document bundles (named sets of documents assigned together as
 * required reading, e.g. "New starter induction pack").
 *
 * A bundle is stored in the doc_bundles table as { id, data } where data is
 *   { name, description, docIds: [docId], memberIds: [userId], autoNew: bool,
 *     createdBy, createdAt, updatedAt }
 *
 * Assigning a bundle doesn't create a new kind of requirement: it simply writes
 * the normal per-document assignments (doc_assignments) for every document in it,
 * so required reading, read confirmations, reminders and reports all work exactly
 * as before. memberIds remembers who the bundle was given to, so documents added
 * to the bundle later reach the same people, and progress can be shown per bundle.
 *
 * All functions here are pure (no React, no database) so they can be tested alone.
 */

const S = v => String(v);
const uniq = a => [...new Set(a.map(S))];

/** Normalise a bundle read from the database (or a draft) into a complete object. */
export function cleanBundle(b) {
  const d = b || {};
  return {
    id: S(d.id || ""),
    name: String(d.name || "").trim(),
    description: String(d.description || "").trim(),
    docIds: uniq(Array.isArray(d.docIds) ? d.docIds : []),
    memberIds: uniq(Array.isArray(d.memberIds) ? d.memberIds : []),
    autoNew: !!d.autoNew,
    createdBy: d.createdBy || "", createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
  };
}

/** doc_bundles rows → bundles sorted by name. */
export const mapBundleRows = rows => (rows || [])
  .map(r => cleanBundle({ ...(r.data || {}), id: r.id }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Bundle → doc_bundles row. */
export const bundleRow = b => { const c = cleanBundle(b); const { id, ...data } = c; return { id, data }; };

/**
 * Give documents to people. Returns { next, changed } where next is the new
 * docAssignments map ({docId: [userId]}) and changed lists the docIds whose list
 * grew (only those need saving). Never removes anyone.
 */
export function addAssignments(docAssignments, docIds, userIds) {
  const next = { ...(docAssignments || {}) };
  const changed = [];
  const add = uniq(userIds);
  uniq(docIds).forEach(did => {
    const cur = (next[did] || []).map(S);
    const extra = add.filter(u => !cur.includes(u));
    if (extra.length) { next[did] = [...cur, ...extra]; changed.push(did); }
  });
  return { next, changed };
}

/**
 * Take documents off people's required reading — but NOT a document they still
 * need through another bundle they belong to (keepVia = the other bundles).
 * Read confirmations are never touched. Returns { next, changed }.
 */
export function removeAssignments(docAssignments, docIds, userIds, keepVia = []) {
  const next = { ...(docAssignments || {}) };
  const changed = [];
  const drop = uniq(userIds);
  uniq(docIds).forEach(did => {
    const cur = (next[did] || []).map(S);
    const keep = new Set(keepVia.filter(b => b.docIds.includes(did)).flatMap(b => b.memberIds));
    const after = cur.filter(u => !drop.includes(u) || keep.has(u));
    if (after.length !== cur.length) { next[did] = after; changed.push(did); }
  });
  return { next, changed };
}

/** Bundles a person has been given (in name order). */
export const bundlesFor = (bundles, userId) => (bundles || []).filter(b => b.memberIds.includes(S(userId)));

/** Names of the bundles a document is part of, optionally only those given to userId. */
export const bundleNamesOf = (bundles, docId, userId) => (bundles || [])
  .filter(b => b.docIds.includes(S(docId)) && (userId == null || b.memberIds.includes(S(userId))))
  .map(b => b.name);

/**
 * Reading progress of one person through one bundle (documents that no longer
 * exist are ignored): { total, read, done }.
 */
export function bundleProgress(bundle, userId, acks, docs) {
  const exists = new Set((docs || []).map(d => S(d.id)));
  const ids = bundle.docIds.filter(d => exists.has(d));
  const mine = (acks || {})[userId] || (acks || {})[S(userId)] || {};
  const read = ids.filter(d => mine[d]).length;
  return { total: ids.length, read, done: ids.length > 0 && read === ids.length };
}

/** Remove a deleted document from every bundle. Returns the bundles that changed. */
export const withoutDoc = (bundles, docId) => (bundles || [])
  .filter(b => b.docIds.includes(S(docId)))
  .map(b => ({ ...b, docIds: b.docIds.filter(d => d !== S(docId)) }));

/** Remove a removed member of staff from every bundle. Returns the bundles that changed. */
export const withoutMember = (bundles, userId) => (bundles || [])
  .filter(b => b.memberIds.includes(S(userId)))
  .map(b => ({ ...b, memberIds: b.memberIds.filter(u => u !== S(userId)) }));
