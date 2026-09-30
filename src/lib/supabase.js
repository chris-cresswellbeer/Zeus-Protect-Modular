/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/supabase.js — Database + file storage client, password hashing, write helper
 * ═══════════════════════════════════════════════════════════════════════════
 * This is a small hand-written replacement for the official `@supabase/supabase-js`
 * library. It talks directly to Supabase's REST API (PostgREST) and Storage API
 * using fetch(). It supports only the handful of operations the portal needs:
 *
 *   sb.from("table").select("*")                 → GET all rows
 *   sb.from("table").select("*").eq(col, val)    → GET rows where col = val
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
 * ── SECURITY NOTES (read before going further than an internal tool) ────────
 *  1. SUPABASE_ANON is the public "anon" key. It is visible to anyone who opens
 *     the site's JavaScript. That is normal for Supabase, BUT it means the data
 *     is only as protected as the Row Level Security (RLS) policies configured
 *     in the Supabase dashboard. If RLS is disabled on a table, anyone with
 *     the URL can read/write it.
 *  2. Logins are checked in the browser by comparing SHA-256 hashes (see
 *     hashPassword below). This is not a substitute for server-side auth
 *     (e.g. Supabase Auth). Consider migrating if the portal is exposed to
 *     untrusted users.
 *  3. If you ever rotate the anon key in Supabase, update SUPABASE_ANON here
 *     (and in any Netlify Functions that reuse it) and redeploy.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Project URL and public anon key — from Supabase dashboard → Project Settings → API.
// A Netlify site can point the portal at a different project (e.g. the staging copy)
// by setting VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Site configuration →
// Environment variables, then redeploying. Without them the live project is used.
const LIVE_SUPABASE_URL  = "https://aoahugfyswgcisfiosyn.supabase.co";
const LIVE_SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvYWh1Z2Z5c3dnY2lzZmlvc3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjY1NzMsImV4cCI6MjA5NTU0MjU3M30.9mlm3pVxqwTgCdrdVF2ek1mBHro28P-MTaVjdAUvCIs";
const ENV = (typeof import.meta !== "undefined" && import.meta.env) || {};
const SUPABASE_URL  = String(ENV.VITE_SUPABASE_URL || LIVE_SUPABASE_URL).replace(/\/+$/, "");
const SUPABASE_ANON = ENV.VITE_SUPABASE_ANON_KEY || LIVE_SUPABASE_ANON;

// Signed-in session token (Supabase Auth). When set, every request is made AS that
// person, so the database's row-level security rules apply to them. Until then
// (and always in the old "legacy" sign-in mode) the public anon key is used.
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
  const from = (table) => ({
    // select() fires the "all rows" GET immediately and returns that promise.
    // .eq()/.neq() are bolted onto the same promise object and fire a SECOND,
    // filtered GET — so `select().eq(...)` makes two requests (the unfiltered one
    // is simply ignored). Harmless for small tables; worth fixing (lazy request)
    // if a large table is ever queried this way.
    select: (cols = "*") => {
      const base = { filter: `select=${cols}` };
      const promise = q("GET", table, base);
      promise.eq  = (col, val) => q("GET", table, { filter: `select=${cols}&${col}=eq.${encodeURIComponent(val)}` });
      promise.neq = (col, val) => q("GET", table, { filter: `select=${cols}&${col}=neq.${encodeURIComponent(val)}` });
      return promise;
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

// ─── Password hashing ───────────────────────────────────────────────────────────
/**
 * SHA-256 hex digest of a password, computed in the browser (Web Crypto API).
 * Stored in the users table and compared at login.
 * NOTE: unsalted, fast hash — fine for an internal portal, but see the security
 * notes at the top of this file. crypto.subtle only works on HTTPS or localhost.
 * If you ever change the algorithm, every existing stored hash stops matching,
 * so all users would need a password reset.
 * @returns {Promise<string>} 64-char lowercase hex string
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
// Default password hash (for "pass123")
// Given to newly created staff accounts. Computed asynchronously at module load,
// so it is "" for a split second on startup. Because it's exported as a `let`,
// ES modules give importers a LIVE binding — they see the filled-in value once
// the promise resolves. Do not copy it into a const at import time.
let DEFAULT_HASH = "";
hashPassword("pass123").then(h => { DEFAULT_HASH = h; });

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
      alert(`Failed to save${label ? ` ${label}` : ""}. Your changes may not have been saved.\n\n${error}`);
    }
  }
  return !error;
}

export { SUPABASE_URL, SUPABASE_ANON, sb, hashPassword, DEFAULT_HASH, dbWrite, setAccessToken };