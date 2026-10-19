/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/supabase.js — Database + file storage client and write helper
 * ═══════════════════════════════════════════════════════════════════════════
 * This is a small hand-written replacement for the official `@supabase/supabase-js`
 * library. It talks directly to Supabase's REST API (PostgREST) and Storage API
 * using fetch(). It supports only the handful of operations the portal needs:
 *
 *   sb.from("table").select("*")                 → GET all rows
 *   sb.from("table").select("*").eq(col, val)    → GET rows where col = val (one request)
 *   sb.from("table").query("select=*&order=…")   → GET with a raw PostgREST filter string
 *   sb.from("table").insert(rowOrRows)           → POST (plain insert)
 *   sb.from("table").upsert(rows, {onConflict})  → POST insert-or-update
 *   sb.from("table").delete().eq(col, val)       → DELETE matching rows
 *   sb.storage.upload / remove / getPublicUrl    → file storage (photos, PDFs, videos)
 *
 *   sb.from("table").update(values).eq(col, val)  → PATCH matching rows (col may be a
 *                                                   JSON path, e.g. "data->>id")
 * Prefer upsert with onConflict where the table has a unique key; use update()
 * when it doesn't (e.g. quiz_failures, keyed only by a value inside `data`).
 * The API shape deliberately mimics supabase-js so the calling code reads the
 * same, but it is NOT a drop-in: chaining (e.g. .select().eq().order()) is not
 * supported. Add new filters to `from()` below if you need them.
 *
 * RETURN SHAPE: every call resolves to `{ data, error }` and NEVER throws.
 *   - GET failure  → { data: [], error: "message" }  (so the app still boots)
 *   - write failure→ { data: null, error: "message" }
 *   Always check `error`, or wrap writes in dbWrite() (bottom of this file).
 *
 * ── SECURITY NOTES ──────────────────────────────────────────────────────────
 *  1. SUPABASE_ANON is the public "anon" key: anyone can see it in the site's
 *     JavaScript, which is normal for Supabase. The data is protected by the
 *     row-level security rules in database/rules/db_rules.sql, which apply to
 *     every request made with a signed-in person's token (setAccessToken below).
 *  2. Passwords are checked by Supabase Auth (lib/auth.js). Nothing to do with
 *     passwords happens in the browser beyond sending them to Supabase.
 *  3. The service role key is NEVER used here: only the Netlify functions have it.
 *     If you rotate the anon key, update the Netlify variables (and the fallback
 *     below) and redeploy.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Project URL and public anon key — from Supabase dashboard → Project Settings → API.
// A Netlify site can point the portal at a different project (e.g. the staging copy)
// by setting VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Site configuration →
// Environment variables, then redeploying. Without them the live project is used.
import { notify } from "../shared/Feedback";   // dbWrite error messages
const LIVE_SUPABASE_URL  = "https://aoahugfyswgcisfiosyn.supabase.co";
const LIVE_SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvYWh1Z2Z5c3dnY2lzZmlvc3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjY1NzMsImV4cCI6MjA5NTU0MjU3M30.9mlm3pVxqwTgCdrdVF2ek1mBHro28P-MTaVjdAUvCIs";
const ENV = (typeof import.meta !== "undefined" && import.meta.env) || {};
const SUPABASE_URL  = String(ENV.VITE_SUPABASE_URL || LIVE_SUPABASE_URL).replace(/\/+$/, "");
const SUPABASE_ANON = ENV.VITE_SUPABASE_ANON_KEY || LIVE_SUPABASE_ANON;

// Signed-in session token (Supabase Auth). When set, every request is made AS that
// person, so the database's row-level security rules apply to them. Before sign-in
// the public anon key is used (it can read only the branding).
// lib/auth.js calls setAccessToken() after sign-in / token refresh / sign-out.
let accessToken = null;
function setAccessToken(t) { accessToken = t || null; }
const bearer = () => `Bearer ${accessToken || SUPABASE_ANON}`;

// A request that never resolves used to hang the whole app: loadAll() awaits
// Promise.allSettled over 34 reads and only flips dbReady in its finally block,
// so a single stalled fetch on a weak mobile connection left the user staring
// at "CONNECTING TO DATABASE…" indefinitely. Every request now has a ceiling.
const REQUEST_TIMEOUT_MS = 12000;

/**
 * fetch() with an automatic abort after `ms` milliseconds.
 * An aborted request rejects with an error whose name is "AbortError" —
 * the catch block in q() below turns that into a friendly "timed out" message.
 * NOTE: Storage uploads/removes further down use plain fetch() (no timeout)
 * because large video uploads can legitimately take longer than 12s.
 */
async function fetchWithTimeout(url, options = {}, ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The shared database client. Built once (IIFE) and imported everywhere as `sb`.
 */
const sb = (() => {
  // Standard headers Supabase requires on every REST call.
  const h = { "Content-Type": "application/json", "apikey": SUPABASE_ANON };
  // PostgREST exposes each table at /rest/v1/<table_name>.
  const rest = (table) => `${SUPABASE_URL}/rest/v1/${table}`;

  /**
   * Low-level request builder used by every method below.
   * @param {"GET"|"POST"|"PATCH"|"DELETE"} method
   * @param {string} table
   * @param {{filter?: string, body?: any, upsertOn?: string}} opts
   *   filter   – raw PostgREST query string, e.g. "select=*&user_id=eq.42"
   *   body     – JSON body for inserts/upserts (always an array of rows)
   *   upsertOn – column(s) forming the unique key for upserts, e.g. "id" or "user_id,module_id".
   *              The table MUST have a unique constraint / primary key on these columns,
   *              otherwise Postgres rejects the upsert (this caused the old
   *              custom_modules timeout bug).
   */
  const q = async (method, table, opts = {}) => {
    const { filter, body, upsertOn } = opts;
    let url = rest(table);
    const filters = [];
    if (filter) filters.push(filter);
    if (method === "POST" && upsertOn) filters.push(`on_conflict=${encodeURIComponent(upsertOn)}`);
    if (filters.length) url += "?" + filters.join("&");
    const headers = { ...h, "Authorization": bearer() };
    // "Prefer" tells PostgREST how to behave:
    //   resolution=merge-duplicates → turn the INSERT into an UPSERT (update on key clash)
    //   return=minimal              → don't send the saved rows back (faster; we don't use them)
    if (method === "POST" && upsertOn) headers["Prefer"] = "resolution=merge-duplicates,return=minimal";
    else if (method === "POST") headers["Prefer"] = "return=minimal";
    try {
      const res = await fetchWithTimeout(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (method === "GET") {
        if (!res.ok) {
          const text = await res.text();
          console.warn(`[sb] GET ${table} failed ${res.status}:`, text);
          return { data: [], error: text };
        }
        const d = await res.json();
        return { data: d, error: null };
      }
      return { data: null, error: res.ok ? null : await res.text() };
    } catch (err) {
      // Timeout or network failure. GETs resolve with an empty set so the app
      // still boots on seed/cached data instead of hanging; writes surface the
      // error so the caller can queue and retry.
      const reason = err.name === "AbortError" ? `timed out after ${REQUEST_TIMEOUT_MS}ms` : err.message;
      console.warn(`[sb] ${method} ${table} ${reason}`);
      if (method === "GET") return { data: [], error: reason };
      return { data: null, error: reason };
    }
  };
  /**
   * Table accessor, supabase-js style: sb.from("incidents").select("*")
   * Values passed to eq/neq/etc. are URL-encoded here, so callers pass raw values.
   * Remember all user_id columns are TEXT — pass String(id) to be safe.
   */
  const PAGE_ROWS = 1000;   // Supabase's default "Max rows" per request
  const from = (table) => ({
    // select() returns a "lazy" promise: the all-rows read only starts when it is awaited
    // (or .then() is called). Adding .eq()/.neq() instead makes ONE filtered request —
    // the all-rows read never happens (it used to run as well and be thrown away).
    // Supabase answers at most 1000 rows per request (Settings → API → Max rows), so
    // the "all rows" read fetches page after page until a short page comes back.
    // Without this, tables past 1000 rows silently lost their newest records on
    // every load and refresh (e.g. training assignments for recently added staff).
    select: (cols = "*") => {
      let started = null;
      const all = () => started || (started = (async () => {
        const rows = [];
        for (let offset = 0; ; offset += PAGE_ROWS) {
          const r = await q("GET", table, { filter: `select=${cols}&limit=${PAGE_ROWS}&offset=${offset}` });
          if (r.error) return offset === 0 ? r : { data: rows, error: r.error };
          const page = Array.isArray(r.data) ? r.data : [];
          rows.push(...page);
          if (page.length < PAGE_ROWS || offset > 2000000) return { data: rows, error: null };
        }
      })());
      return {
        then:    (ok, bad) => all().then(ok, bad),
        catch:   bad => all().catch(bad),
        finally: fn => all().finally(fn),
        eq:  (col, val) => q("GET", table, { filter: `select=${cols}&${col}=eq.${encodeURIComponent(val)}` }),
        neq: (col, val) => q("GET", table, { filter: `select=${cols}&${col}=neq.${encodeURIComponent(val)}` }),
      };
    },
    // Raw filtered GET, e.g. query("select=*&order=at.desc&limit=500&entity=eq.incident").
    // Use when you need ordering/limits (select() always fetches every row).
    query: (filter) => q("GET", table, { filter: filter || "select=*" }),
    // Single rows are wrapped in an array — PostgREST accepts arrays for bulk writes.
    insert: (rows) => q("POST", table, { body: Array.isArray(rows) ? rows : [rows] }),
    // Preferred write method across the app (upsert-and-prune pattern — see README).
    // Without opts.onConflict this behaves like a plain insert.
    upsert: (rows, opts = {}) => q("POST", table, { body: Array.isArray(rows) ? rows : [rows], upsertOn: opts.onConflict }),
    // PATCH: update only the given columns on rows matching the filter.
    // PostgREST refuses an unfiltered PATCH, so .eq() is required.
    update: (values) => ({
      eq: (col, val) => q("PATCH", table, { filter: `${col}=eq.${encodeURIComponent(val)}`, body: values }),
      // match({user_id:"12", module_id:"m3"}) → update rows matching ALL the given columns.
      match: (conditions) => q("PATCH", table, { filter: Object.entries(conditions).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join("&"), body: values }),
    }),
    // PostgREST refuses DELETE without a filter, so you must pick one of these.
    delete: () => ({
      eq:     (col, val) => q("DELETE", table, { filter: `${col}=eq.${encodeURIComponent(val)}` }),
      neq:    (col, val) => q("DELETE", table, { filter: `${col}=neq.${encodeURIComponent(val)}` }),
      gte:    (col, val) => q("DELETE", table, { filter: `${col}=gte.${encodeURIComponent(val)}` }),
      // ⚠ "Delete everything" trick: id >= 0. Only works on tables with a NUMERIC id
      // column. Text ids (e.g. "mod_abc") won't match and nothing is deleted.
      all:    ()         => q("DELETE", table, { filter: `id=gte.0` }),
      // match({user_id:"12", module_id:"m3"}) → delete rows matching ALL the given columns.
      match:  (conditions) => q("DELETE", table, { filter: Object.entries(conditions).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join("&") }),
    }),
  });
  /**
   * Supabase Storage (file buckets). Buckets must exist in the Supabase dashboard
   * and be PUBLIC for getPublicUrl() links to work in <img>/<video> tags.
   * `path` is the file's key inside the bucket, e.g. "incidents/123/photo1.jpg";
   * each path segment is URL-encoded so spaces/special chars in filenames are safe.
   */
  const storage = {
    // "x-upsert: true" overwrites an existing file at the same path instead of failing.
    upload: async (bucket, path, file) => {
      // Supabase Storage expects the raw file body with Content-Type set to the file's MIME type
      const contentType = file.type && file.type !== "" ? file.type : "application/octet-stream";
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodedPath}`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON,
          "Authorization": bearer(),
          "Content-Type": contentType,
          "x-upsert": "true",
          "Cache-Control": "3600",
        },
        body: file,
      });
      const text = await res.text();
      if (!res.ok) console.error("Storage upload error:", res.status, text);
      return { error: res.ok ? null : text };
    },
    // Deletes one or more files. `paths` is an array of in-bucket paths.
    remove: async (bucket, paths) => {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { "apikey": SUPABASE_ANON, "Authorization": bearer(), "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths }),
      });
      return { error: res.ok ? null : await res.text() };
    },
    // Pure string builder — makes no network call and doesn't check the file exists.
    getPublicUrl: (bucket, path) => `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
  };
  return { from, storage };
})();

// ─── Write helper — surfaces errors instead of silently swallowing them ────────
// Wrap any sb.from(...).upsert/insert/update/delete(...) or sb.storage.upload/remove(...)
// call. Logs on failure (and optionally alerts) so a failed save is never silent.
// Usage: await dbWrite(sb.from("incidents").upsert({...}), "incident");
//
// @param {Promise<{error}>} promise  Any sb write call (not awaited yet).
// @param {string} label             Short name shown in logs/alerts, e.g. "incident".
// @param {{alertOnError?: boolean}} opts  Set alertOnError:true for user-initiated
//                                    saves where the user must know it failed.
// @returns {Promise<boolean>} true if saved OK, false if it failed.
// CONVENTION: all new write call sites should go through this helper.
async function dbWrite(promise, label, opts = {}) {
  const { error } = await promise;
  if (error) {
    console.error(`[dbWrite] Save failed${label ? ` [${label}]` : ""}:`, error);
    if (opts.alertOnError) {
      notify(`Failed to save${label ? ` ${label}` : ""}. Your changes may not have been saved.\n${error}`, { kind: "error" });
    }
  }
  return !error;
}

// ─── Insert rows that may already be there ────────────────────────────────────
// For tables with a "one row per pair" rule (unique_keys.sql: doc_assignments,
// dse_reports). If someone else added the same row at the same moment the database
// refuses the insert as a duplicate (code 23505) — that is not a failure: the row is
// there. The rows are then added one at a time, skipping (or, with onDuplicate,
// updating) the ones that already exist. Works the same before unique_keys.sql is run.
// @returns {Promise<boolean>} true if every row is now saved.
async function insertNew(table, rows, label, onDuplicate = null) {
  if (!rows.length) return true;
  const isDup = e => /23505|duplicate key/i.test(String(e || ""));
  const r = await sb.from(table).insert(rows);
  if (!r.error) return true;
  if (!isDup(r.error)) return dbWrite(Promise.resolve(r), label);
  let ok = true;
  for (const row of rows) {
    const one = await sb.from(table).insert(row);
    if (!one.error) continue;
    if (!isDup(one.error)) { ok = (await dbWrite(Promise.resolve(one), label)) && ok; continue; }
    if (onDuplicate) ok = (await onDuplicate(row)) !== false && ok;
  }
  return ok;
}

export { SUPABASE_URL, SUPABASE_ANON, sb, dbWrite, insertNew, setAccessToken, bearer };