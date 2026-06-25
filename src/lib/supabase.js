const SUPABASE_URL  = "https://aoahugfyswgcisfiosyn.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvYWh1Z2Z5c3dnY2lzZmlvc3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjY1NzMsImV4cCI6MjA5NTU0MjU3M30.9mlm3pVxqwTgCdrdVF2ek1mBHro28P-MTaVjdAUvCIs"; // TODO: paste your Supabase anon/public key here

const sb = (() => {
  const h = { "Content-Type": "application/json", "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` };
  const rest = (table) => `${SUPABASE_URL}/rest/v1/${table}`;
  const q = async (method, table, opts = {}) => {
    const { filter, body, upsertOn } = opts;
    let url = rest(table);
    const filters = [];
    if (filter) filters.push(filter);
    if (method === "POST" && upsertOn) filters.push(`on_conflict=${encodeURIComponent(upsertOn)}`);
    if (filters.length) url += "?" + filters.join("&");
    const headers = { ...h };
    if (method === "POST" && upsertOn) headers["Prefer"] = "resolution=merge-duplicates,return=minimal";
    else if (method === "POST") headers["Prefer"] = "return=minimal";
    const res = await fetch(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (method === "GET") { const d = await res.json(); return { data: d, error: null }; }
    return { data: null, error: res.ok ? null : await res.text() };
  };
  const from = (table) => ({
    select: (cols = "*") => {
      const base = { filter: `select=${cols}` };
      const promise = q("GET", table, base);
      promise.eq  = (col, val) => q("GET", table, { filter: `select=${cols}&${col}=eq.${encodeURIComponent(val)}` });
      promise.neq = (col, val) => q("GET", table, { filter: `select=${cols}&${col}=neq.${encodeURIComponent(val)}` });
      return promise;
    },
    insert: (rows) => q("POST", table, { body: Array.isArray(rows) ? rows : [rows] }),
    upsert: (rows, opts = {}) => q("POST", table, { body: Array.isArray(rows) ? rows : [rows], upsertOn: opts.onConflict }),
    delete: () => ({
      eq:     (col, val) => q("DELETE", table, { filter: `${col}=eq.${encodeURIComponent(val)}` }),
      neq:    (col, val) => q("DELETE", table, { filter: `${col}=neq.${encodeURIComponent(val)}` }),
      gte:    (col, val) => q("DELETE", table, { filter: `${col}=gte.${encodeURIComponent(val)}` }),
      all:    ()         => q("DELETE", table, { filter: `id=gte.0` }),
      match:  (conditions) => q("DELETE", table, { filter: Object.entries(conditions).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join("&") }),
    }),
  });
  const storage = {
    upload: async (bucket, path, file) => {
      // Supabase Storage expects the raw file body with Content-Type set to the file's MIME type
      const contentType = file.type && file.type !== "" ? file.type : "application/octet-stream";
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodedPath}`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON,
          "Authorization": `Bearer ${SUPABASE_ANON}`,
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
    remove: async (bucket, paths) => {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths }),
      });
      return { error: res.ok ? null : await res.text() };
    },
    getPublicUrl: (bucket, path) => `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
  };
  return { from, storage };
})();

// ─── Password hashing ───────────────────────────────────────────────────────────
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
// Default password hash (for "pass123")
let DEFAULT_HASH = "";
hashPassword("pass123").then(h => { DEFAULT_HASH = h; });

// ─── Write helper — surfaces errors instead of silently swallowing them ────────
// Wrap any sb.from(...).upsert/insert/update/delete(...) or sb.storage.upload/remove(...)
// call. Logs on failure (and optionally alerts) so a failed save is never silent.
// Usage: await dbWrite(sb.from("incidents").upsert({...}), "incident");
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

export { SUPABASE_URL, SUPABASE_ANON, sb, hashPassword, DEFAULT_HASH, dbWrite };