/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/data/sync.js — createSync(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Live refresh (re-reading what other people changed) and the small helpers the save code shares:
 *   refreshSharedRecords()  the 30-second refresh: incidents, investigations, training, reading,
 *                           bundles, and the registers for the people who edit them (refreshRegisters)
 *   changedRead(tr)         read a table only if lib/changes.js says it may have changed
 *   markWrite(key)          "this browser just changed this record" (the refresh keeps it for a minute)
 *   inTurn(key, job)        one save at a time per record
 *   auditNameOf(uid)        a person's name for the audit trail
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { hasMachineryAccess } from "../../data/seedMachinery";
import { mapBundleRows } from "../../domains/documents/bundles";
import { primeAudit, primeAuditList } from "../../lib/audit";
import { mapDueRows } from "../../lib/dueDates";
import { mergeKeyed } from "../../lib/keyedSync";
import { hasReceptionAccess } from "../../lib/contractorSignin";
import { sb } from "../../lib/supabase";
import { FIRE_TABLES, RECENT_MS, TRACKED, idsKey, mapAckRows, mapAssignRows, mapCompRows, mapDocAssignRows, mapIncidentRow, mergeAssigns, mergeNested, sharedTracker, stableJSON } from "../records";

export function createSync(app) {
  const {
    _ready, allUsers, firstAidSavedRef, firstAidWroteRef, historyIdsRef, historyReadyRef, incidentSavedRef,
    incidentWritingRef, investigationBaseRef, investigationSavedRef, investigationWritingRef, recentWriteRef,
    refreshBusyRef, regRef, saveQueueRef, setAssigns, setCompHistory, setComps, setContractors, setCustomMachineTypes,
    setCustomModules, setDocAcknowledgements, setDocAssignments, setDocBundles, setDueDates, setEquipment,
    setFireSafety, setFirstAidData, setIncidents, setInvestigations, setSiteInspections, user
  } = app;
  const markWrite = key => recentWriteRef.current.set(key, Date.now());
  const auditNameOf = (uid) => (allUsers.find(u => String(u.id) === String(uid)) || {}).name || `User ${uid}`;

  // ── Live refresh ────────────────────────────────────────────────────────────
  // Everything else is loaded once per page load, so an admin who stays signed in
  // wouldn't see incidents reported by others (or their investigation updates, e.g.
  // actions completed on the phone). Re-read both tables every 30 s while the tab is
  // visible, when the window regains focus, and when an incidents screen is opened.
  // Records with a save still in flight from THIS browser are kept as they are.
  // Registers people edit on their own pages (equipment, inspections, fire safety, first aid,
  // custom modules, machine types): take in other people's changes. Only for those who can
  // edit them; records with an unsaved or in-flight change here are left alone (lib/keyedSync.js).
  // tr: the "has it changed?" check made by refreshSharedRecords (lib/changes.js); tables that
  // haven't changed since the last read aren't read again.
  async function refreshRegisters(tr) {
    // only the people who edit registers take in other people's changes
    const admin = !!user && user.role === "admin", machinery = !!user && hasMachineryAccess(user);
    const R = regRef.current;
    const ok = r => r && !r.error && Array.isArray(r.data);
    const data = r => r.data.map(x => x.data).filter(Boolean);
    const rd = changedRead(tr);
    // The Contractor Register: admins and Reception access (QR sign-ins add companies and workers).
    if (hasReceptionAccess(user)) {
      const readAt = Date.now();
      const r = await rd("contractors", () => sb.from("contractors").select("*"));
      if (ok(r)) { const fresh = data(r); setContractors(cur => mergeKeyed(R.contractors, cur, fresh, readAt)); }
    }
    if (!machinery) return;
    const reads = { equipment: ["equipment", () => sb.from("equipment").select("*")], machineTypes: ["custom_machine_types", () => sb.from("custom_machine_types").select("*")] };
    if (admin) {
      Object.assign(reads, { inspections: ["site_inspections", () => sb.from("site_inspections").select("*")], modules: ["custom_modules", () => sb.from("custom_modules").select("*")],
        firstAid: ["first_aid_register", () => sb.from("first_aid_register").select("*").eq("id", "singleton")] });
      Object.entries(FIRE_TABLES).forEach(([k, table]) => { reads[`fire.${k}`] = [table, () => sb.from(table).select("*")]; });
    }
    const keys = Object.keys(reads);
    const readAt = Date.now();   // anything this browser saves after this moment is newer than what comes back
    const res = Object.fromEntries((await Promise.all(keys.map(k => rd(...reads[k])))).map((r, i) => [keys[i], r]));
    if (ok(res.equipment)) { const fresh = data(res.equipment); setEquipment(cur => mergeKeyed(R.equipment, cur, fresh, readAt)); }
    if (ok(res.machineTypes)) { const fresh = data(res.machineTypes); setCustomMachineTypes(cur => mergeKeyed(R.machineTypes, cur, fresh, readAt)); }
    if (!admin) return;
    const freshInsp = ok(res.inspections) ? data(res.inspections) : null;
    if (freshInsp) setSiteInspections(cur => {
      const next = mergeKeyed(R.inspections, cur, freshInsp, readAt);
      if (next !== cur) primeAuditList("inspection", next);   // changes made elsewhere aren't logged as ours
      return next;
    });
    if (ok(res.modules)) { const fresh = data(res.modules); setCustomModules(cur => mergeKeyed(R.modules, cur, fresh, readAt)); }
    const fireFresh = {};
    Object.keys(FIRE_TABLES).forEach(k => { if (ok(res[`fire.${k}`])) fireFresh[k] = data(res[`fire.${k}`]); });
    const NONE = [];
    if (Object.keys(fireFresh).length) setFireSafety(cur => {
      let changed = false; const next = { ...(cur || {}) };
      Object.entries(fireFresh).forEach(([k, fresh]) => { const was = (cur || {})[k] || NONE; const m = mergeKeyed(R.fire[k], was, fresh, readAt); if (m !== was) { next[k] = m; changed = true; } });
      return changed ? next : cur;
    });
    // first aid is one document: take theirs only if nothing is unsaved here and we haven't saved since the read
    if (ok(res.firstAid) && res.firstAid.data[0] && firstAidWroteRef.current < readAt) {
      const fresh = res.firstAid.data[0].data, fj = stableJSON(fresh), prev = firstAidSavedRef.current;
      if (prev !== null && fj !== prev) setFirstAidData(cur => {
        if (stableJSON(cur) !== prev) return cur;   // unsaved change here: keep it (same answer if React runs this twice)
        firstAidSavedRef.current = fj;
        return fresh;
      });
    }
  }

  // Read a table only if it may have changed (or we can't tell); otherwise answer "unchanged",
  // which every reader below treats like a failed read: keep what's on screen.
  const changedRead = tr => (table, query) => (tr && !tr.has(table))
    ? Promise.resolve({ data: null, error: "unchanged" })
    : Promise.resolve(query()).then(r => { if (tr && r && !r.error && Array.isArray(r.data)) tr.mark(table); return r; });

  async function refreshSharedRecords() {
    if (!_ready.current || refreshBusyRef.current) return;
    refreshBusyRef.current = true;
    try {
      // One small request first: which of these tables changed since we last read them?
      const tr = await sharedTracker.check(TRACKED);
      const rd = changedRead(tr);
      const registers = refreshRegisters(tr).catch(e => console.error("Register refresh failed:", e));   // awaited below
      // Training history only grows, and can be the biggest table: read just its row ids,
      // and the full rows only when they changed (or the table has no ids to compare).
      const historyRead = async () => {
        if (!historyReadyRef.current) return { data: null, error: "not loaded yet" };
        if (!tr.has("training_completion_history")) return { data: null, error: "unchanged" };
        const ids = await sb.from("training_completion_history").select("id,recorded");   // every page; recorded = evidence, which can change
        if (!ids.error && Array.isArray(ids.data)) {
          const k = idsKey(ids.data);
          if (k !== null && k === historyIdsRef.current) { tr.mark("training_completion_history"); return { data: null, error: "unchanged" }; }
        }
        const full = await sb.from("training_completion_history").select("*");
        if (!full.error && Array.isArray(full.data)) { historyIdsRef.current = idsKey(full.data); tr.mark("training_completion_history"); }
        return full;
      };
      const [iRes, invRes, cRes, ackRes, aRes, hRes, daRes, bdRes] = await Promise.all([rd("incidents", () => sb.from("incidents").select("*")),
        rd("investigations", () => sb.from("investigations").select("*")), rd("training_completions", () => sb.from("training_completions").select("*")),
        rd("doc_acknowledgements", () => sb.from("doc_acknowledgements").select("*")), rd("training_assigns", () => sb.from("training_assigns").select("*")),
        historyRead(), rd("doc_assignments", () => sb.from("doc_assignments").select("*")), rd("doc_bundles", () => sb.from("doc_bundles").select("*"))]);
      // Training completions, assignments and document confirmations made elsewhere
      // (a member of staff finishing a module, a manager assigning one) appear here
      // without a reload.
      const okRows = r => !r.error && Array.isArray(r.data);
      const recent = recentWriteRef.current;
      if (okRows(cRes)) setComps(cur => mergeNested(cur, mapCompRows(cRes.data), recent, "c"));
      if (okRows(ackRes)) setDocAcknowledgements(cur => mergeNested(cur, mapAckRows(ackRes.data), recent, "k"));
      if (okRows(aRes)) setAssigns(cur => mergeAssigns(cur, mapAssignRows(aRes.data), recent));
      if (okRows(aRes)) setDueDates(cur => {
        // due dates for people with a save in flight keep their on-screen value
        const fresh = mapDueRows(aRes.data), now = Date.now();
        recent.forEach((t, key) => { if (now - t <= RECENT_MS && key.startsWith("a:")) { const u = key.slice(2); if (cur[u]) fresh[u] = cur[u]; else delete fresh[u]; } });
        return stableJSON(fresh) === stableJSON(cur) ? cur : fresh;
      });
      // Required reading given elsewhere (e.g. an admin assigning a bundle) appears without a reload.
      if (okRows(daRes)) setDocAssignments(cur => mergeAssigns(cur, mapDocAssignRows(daRes.data), recent, "d"));
      if (!bdRes.error && Array.isArray(bdRes.data)) setDocBundles(cur => {
        const fresh = mapBundleRows(bdRes.data), now = Date.now();
        const isRecent = id => { const t = recent.get(`b:${id}`); return t && now - t < RECENT_MS; };
        const next = [...fresh.filter(b => !isRecent(b.id)), ...cur.filter(b => isRecent(b.id))].sort((a, b) => a.name.localeCompare(b.name));
        return stableJSON(next) === stableJSON(cur) ? cur : next;
      });
      if (okRows(hRes)) setCompHistory(cur => {
        const now = Date.now();
        const pending = cur.filter(h => h.at && now - new Date(h.at).getTime() < RECENT_MS && !hRes.data.some(r => String(r.user_id) === String(h.user_id) && String(r.module_id) === String(h.module_id) && r.date === h.date));
        const next = [...hRes.data, ...pending];
        return stableJSON(next) === stableJSON(cur) ? cur : next;
      });
      if (!iRes.error && Array.isArray(iRes.data)) {
        const fresh = iRes.data.map(mapIncidentRow);
        setIncidents(cur => {
          const writing = incidentWritingRef.current;
          const freshIds = new Set(fresh.map(i => String(i.id)));
          const curById = new Map(cur.map(i => [String(i.id), i]));
          const merged = [
            ...fresh.map(f => (writing.has(String(f.id)) && curById.get(String(f.id))) || f),
            ...cur.filter(i => !freshIds.has(String(i.id)) && writing.has(String(i.id))),   // new, save in flight
          ];
          const same = merged.length === cur.length && merged.every(m => { const c = curById.get(String(m.id)); return c && stableJSON(c) === stableJSON(m); });
          if (same) return cur;
          // Treat what we just read as "already saved" and "already audited", so it
          // is neither written back nor logged as a change made in this browser.
          merged.forEach(m => { if (!writing.has(String(m.id))) { incidentSavedRef.current.set(String(m.id), stableJSON(m)); primeAudit("incident", m.id, m); } });
          // Keep the current on-screen order; new arrivals go to the top.
          const order = new Map(cur.map((c, i) => [String(c.id), i]));
          return merged.sort((a, b) => (order.has(String(a.id)) ? order.get(String(a.id)) : -1) - (order.has(String(b.id)) ? order.get(String(b.id)) : -1));
        });
      }
      if (!invRes.error && Array.isArray(invRes.data)) {
        const fresh = {}; invRes.data.forEach(r => { fresh[r.incident_id] = r.data; });
        setInvestigations(cur => {
          const writing = investigationWritingRef.current;
          const next = { ...fresh };
          Object.keys(cur).forEach(id => { if (writing.has(String(id))) next[id] = cur[id]; });
          const keys = new Set([...Object.keys(cur), ...Object.keys(next)]);
          if ([...keys].every(k => stableJSON(cur[k]) === stableJSON(next[k]))) return cur;
          Object.entries(next).forEach(([id, d]) => { if (!writing.has(String(id))) { investigationSavedRef.current.set(String(id), stableJSON(d)); investigationBaseRef.current.set(String(id), d); primeAudit("investigation", id, d); } });
          return next;
        });
      }
      await registers;
    } finally {
      refreshBusyRef.current = false;
    }
  }
  const inTurn = (key, fn) => {
    const q = saveQueueRef.current;
    const next = (q.get(key) || Promise.resolve()).catch(() => {}).then(fn);
    q.set(key, next);
    next.finally(() => { if (q.get(key) === next) q.delete(key); });
    return next;
  };

  return {
    markWrite, auditNameOf, refreshRegisters, changedRead, refreshSharedRecords, inTurn
  };
}
