/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/changes.js — "has anything changed?" before re-reading a table
 * ═══════════════════════════════════════════════════════════════════════════
 * The portal re-reads shared tables every 30 seconds (app/data/sync.js refreshSharedRecords,
 * and the racking / PPE screens every minute) so people see each other's changes.
 * Re-reading a whole table that hasn't changed wastes time and data, so first one small
 * request asks the database for a "signature" of each table (how many rows this person
 * can see, and when the newest change was made: database/updates/change_tracking.sql →
 * public.zp_changes). Only tables whose signature differs from the last read are read.
 *
 *   const tr = await changeTracker.check(["incidents", "training_completions"]);
 *   tr.has("incidents")   → true if it may have changed (or we can't tell): read it
 *   tr.mark("incidents")  → call after a SUCCESSFUL read, so the next check compares with it
 *
 * Take the signature BEFORE reading: a change made in between is then seen next time.
 * If change_tracking.sql hasn't been run (or the check fails) every table counts as
 * changed, so the portal behaves exactly as it did before: nothing is ever missed.
 * Each tracker remembers its own reads (app/data/sync.js and each client have their own). Everything is
 * read again anyway every 10 minutes, and after any save the database refused.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { SUPABASE_URL, SUPABASE_ANON, bearer } from "./supabase";

let unavailable = false;   // zp_changes isn't in this database (until the page is reloaded)

async function signatures(tables) {
  if (unavailable || !tables.length) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/zp_changes`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: bearer(), "Content-Type": "application/json" },
      body: JSON.stringify({ tables }),
    });
    if (res.status === 404) { unavailable = true; return null; }
    if (!res.ok) return null;
    const j = await res.json();
    return j && typeof j === "object" && !Array.isArray(j) ? j : null;
  } catch { return null; }
}

export function createChangeTracker() {
  const seen = new Map();   // table → signature at the last successful read
  // A save the database refused (lib/supabase.js dbWrite) may leave the screen showing what
  // isn't stored: forget everything, so the next refresh reads it all and puts that right.
  try { window.addEventListener("zp-write-failed", () => seen.clear()); } catch { /* not in a browser */ }
  let fullAt = Date.now();
  return {
    async check(tables) {
      // belt and braces: a full read every 10 minutes whatever the signatures say
      if (Date.now() - fullAt > 10 * 60000) { seen.clear(); fullAt = Date.now(); }
      const sig = await signatures(tables);
      return {
        has: t => !sig || !(t in sig) || seen.get(t) !== sig[t],
        mark: t => { if (sig && t in sig) seen.set(t, sig[t]); },
      };
    },
    forget(t) { if (t) seen.delete(t); else seen.clear(); },
  };
}

/** For tests: is the database check in use? */
export const changeTrackingAvailable = () => !unavailable;
