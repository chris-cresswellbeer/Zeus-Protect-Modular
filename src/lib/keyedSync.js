/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/keyedSync.js — save only what changed in a list of records, and take in
 * other people's changes, without one browser overwriting another
 * ═══════════════════════════════════════════════════════════════════════════
 * Used for the registers kept as lists of { id, … } records (site inspections,
 * equipment, the fire safety lists, custom modules, machine types).
 *
 * The OLD way saved the browser's whole list and deleted every row that wasn't in
 * it — so an admin page opened before someone else added an inspection on a phone,
 * or before an incident report added a defect, would delete or overwrite it on the
 * next edit. Now, per list:
 *   • `saved` remembers the last saved/loaded copy of each record (by id);
 *   • only records that differ from it are written;
 *   • a record is deleted only if it was in `saved` and THIS browser removed it;
 *   • refresh (mergeKeyed) takes in new, changed and deleted records from the
 *     database, but never touches a record with an unsaved or in-flight change here,
 *     nor one this browser wrote or deleted after the refresh's read began (that read
 *     is older than our save, so it would undo it).
 *   • mergeKeyed is safe to call inside a React state updater (React may run an
 *     updater twice): a repeat call with the same inputs returns the same result.
 */

const stable = v => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x))
  ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x);
const keyOf = x => String(x && x.id);
const BUSY_MS = 15000;   // a save/delete counts as "in flight" for at most this long

/** One tracker per list. `norm` = what is actually stored (e.g. without temporary file objects). */
export function createKeyed(norm = x => x) {
  return { saved: new Map(), busy: new Map(), wrote: new Map(), norm, memo: null };
}

const json = (t, x) => stable(t.norm(x));
const isBusy = (t, k) => { const at = t.busy.get(k); return at && Date.now() - at < BUSY_MS; };

/** Mark one record as saved by this browser just now (for saves made outside saveKeyed). */
export function markSaved(t, x) {
  const k = keyOf(x);
  t.saved.set(k, json(t, x)); t.wrote.set(k, Date.now());
}

/** Remember the records just loaded as "saved". */
export function primeKeyed(t, items) {
  t.saved.clear();
  (items || []).forEach(x => { if (x && x.id != null) t.saved.set(keyOf(x), json(t, x)); });
}

/** What changed since the last save: { changed: [record], removed: [id] }. */
export function diffKeyed(t, items) {
  const list = (items || []).filter(x => x && x.id != null);
  const ids = new Set(list.map(keyOf));
  const changed = list.filter(x => t.saved.get(keyOf(x)) !== json(t, x));
  const removed = [...t.saved.keys()].filter(k => !ids.has(k));
  return { changed, removed };
}

/**
 * Save the differences. write(record) and remove(id) return a promise of true/false.
 * A failed write is forgotten from `saved`, so it is tried again on the next change.
 */
export function saveKeyed(t, items, { write, remove, canDelete = true }) {
  const { changed, removed } = diffKeyed(t, items);
  changed.forEach(x => {
    const k = keyOf(x);
    t.saved.set(k, json(t, x)); t.busy.set(k, Date.now()); t.wrote.set(k, Date.now());
    Promise.resolve(write(t.norm(x), x)).then(ok => { t.busy.delete(k); if (ok === false) t.saved.delete(k); },
                                              () => { t.busy.delete(k); t.saved.delete(k); });
  });
  if (canDelete) removed.forEach(k => {
    t.saved.delete(k); t.busy.set(k, Date.now()); t.wrote.set(k, Date.now());
    Promise.resolve(remove(k)).finally(() => t.busy.delete(k));
  });
  return { changed: changed.length, removed: canDelete ? removed.length : 0 };
}

/**
 * Merge records just read from the database into the current list.
 * readAt: when the read was started (Date.now()); records written/deleted here since then are left alone.
 * Returns the same array if nothing changed (so React doesn't re-render).
 */
export function mergeKeyed(t, cur, fresh, readAt = Infinity) {
  if (t.memo && t.memo.cur === cur && t.memo.fresh === fresh) return t.memo.out;   // React re-ran the updater
  const out = mergeOnce(t, cur, fresh, readAt);
  t.memo = { cur, fresh, out };
  return out;
}
function mergeOnce(t, cur, fresh, readAt) {
  const now = cur || [];
  const mine = k => isBusy(t, k) || (t.wrote.get(k) || 0) >= readAt;   // ours is newer than this read
  const freshList = (fresh || []).filter(x => x && x.id != null);
  const freshById = new Map(freshList.map(x => [keyOf(x), x]));
  const curIds = new Set(now.map(keyOf));
  let changed = false;
  const out = [];
  now.forEach(c => {
    const k = keyOf(c);
    const clean = t.saved.get(k) === json(t, c) && !mine(k);
    if (!clean) { out.push(c); return; }                       // unsaved / saving here: keep ours
    if (freshById.has(k)) {
      const f = freshById.get(k), fj = json(t, f);
      if (fj !== t.saved.get(k)) { changed = true; t.saved.set(k, fj); out.push(f); } else out.push(c);
    } else if (t.saved.has(k)) { changed = true; t.saved.delete(k); }   // deleted elsewhere
    else out.push(c);
  });
  freshList.forEach(f => {
    const k = keyOf(f);
    if (curIds.has(k) || mine(k)) return;                       // we have it, or we deleted it since the read
    changed = true; t.saved.set(k, json(t, f)); out.push(f);    // added elsewhere
  });
  return changed ? out : now;
}

/** The last saved copy of a record (parsed), or null. */
export function savedCopy(t, id) {
  const s = t.saved.get(String(id));
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}
