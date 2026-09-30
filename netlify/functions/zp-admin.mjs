/**
 * ═══════════════════════════════════════════════════════════════════════════
 * netlify/functions/zp-admin.mjs — sign-in account management (server side)
 * ═══════════════════════════════════════════════════════════════════════════
 * Runs on Netlify, not in the browser. It holds the Supabase SERVICE ROLE key,
 * which can create and change sign-in accounts, so that key never reaches the
 * browser. The portal calls it at /.netlify/functions/zp-admin with the
 * signed-in person's token (see src/lib/auth.js → adminCall).
 *
 * NETLIFY ENVIRONMENT VARIABLES (Site configuration → Environment variables):
 *   SUPABASE_SERVICE_ROLE_KEY   the project's service_role key (Supabase → Project
 *                               Settings → API). Keep it secret. Scope: Functions.
 *   SUPABASE_URL                optional; defaults to VITE_SUPABASE_URL.
 *
 * WHO MAY DO WHAT
 *   Every request must carry a valid sign-in token. The caller's staff record
 *   (users table) is read with the service key and must have role "admin" and not
 *   be a leaver — except "passwordChanged", which anyone may call for their OWN
 *   account after choosing a new password.
 *
 * ACCOUNT ↔ STAFF RECORD
 *   Each auth user has app_metadata { zp_id, zp_role, must_change_password }.
 *   zp_id / zp_role are always taken from the users table here, never from the
 *   request, so the browser can't grant itself a role.
 *
 * ACTIONS (POST JSON { action, ... }):
 *   status                         → { users: [{ id, hasAccount, banned, mustChange }] }
 *   create        { userId, password }            new account (temporary password)
 *   setPassword   { userId, password, temporary } reset (creates the account if missing)
 *   sync          { userId }       email / role / leaver status from the staff record
 *   remove        { userId }       delete the sign-in account
 *   createMissing { passwords: { userId: password } }  changeover: accounts for everyone
 *   passwordChanged                 clears the caller's own must_change_password
 */

const BASE = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FOREVER = "876000h";   // "banned" for 100 years = leaver

const reply = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const fail = (status, error) => reply(status, { ok: false, error });

async function call(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${token || KEY}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { ok: res.ok, status: res.status, json };
}
const errOf = r => (r.json && (r.json.msg || r.json.message || r.json.error_description || r.json.error)) || `HTTP ${r.status}`;

async function staffRecord(id) {
  const r = await call(`/rest/v1/users?select=id,data&id=eq.${encodeURIComponent(String(id))}`);
  if (!r.ok) throw new Error(`Couldn't read staff record: ${errOf(r)}`);
  const row = (r.json || [])[0];
  return row ? { ...(row.data || {}), id: String(row.id) } : null;
}
async function allStaff() {
  const r = await call(`/rest/v1/users?select=id,data`);
  if (!r.ok) throw new Error(`Couldn't read staff records: ${errOf(r)}`);
  return (r.json || []).map(row => ({ ...(row.data || {}), id: String(row.id) }));
}
async function allAccounts() {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const r = await call(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    if (!r.ok) throw new Error(`Couldn't list sign-in accounts: ${errOf(r)}`);
    const users = (r.json && (r.json.users || r.json)) || [];
    out.push(...users);
    if (users.length < 1000) break;
  }
  return out;
}
const zpId = a => String((a.app_metadata || {}).zp_id || "");
const isBanned = a => !!a.banned_until && new Date(a.banned_until) > new Date();
const roleOf = u => (["admin", "manager"].includes(u.role) ? u.role : "staff");
const isLeaver = u => (u.status || "active") === "leaver";
const loginOf = u => String(u.email || "").trim().toLowerCase();

function metaFor(u, mustChange) {
  return { zp_id: String(u.id), zp_role: roleOf(u), must_change_password: !!mustChange };
}
function checkPassword(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Passwords must be at least 8 characters.";
  return null;
}

async function createAccount(u, password, accounts) {
  if (!u) return { ok: false, error: "Staff record not found." };
  if (isLeaver(u)) return { ok: false, error: `${u.name || "This person"} is a leaver, so no sign-in account was created.` };
  const login = loginOf(u);
  if (!login.includes("@")) return { ok: false, error: `${u.name || "This person"} has no email-style login.` };
  const bad = checkPassword(password); if (bad) return { ok: false, error: bad };
  if (accounts.some(a => zpId(a) === u.id)) return { ok: false, error: `${u.name} already has a sign-in account.` };
  const clash = accounts.find(a => String(a.email || "").toLowerCase() === login);
  if (clash) return { ok: false, error: `Another sign-in account already uses ${login}.` };
  const r = await call(`/auth/v1/admin/users`, { method: "POST", body: { email: login, password, email_confirm: true, app_metadata: metaFor(u, true) } });
  if (!r.ok) return { ok: false, error: `${u.name}: ${errOf(r)}` };
  accounts.push(r.json);
  return { ok: true };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return fail(405, "Use POST.");
  if (!BASE || !KEY) return fail(500, "The account service isn't set up: add SUPABASE_SERVICE_ROLE_KEY (and VITE_SUPABASE_URL) in Netlify's environment variables, then redeploy.");
  const token = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "Not signed in.");
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return fail(400, "Bad request."); }

  try {
    // Who is calling? (Supabase checks the token's signature and expiry.)
    const me = await call(`/auth/v1/user`, { token });
    if (!me.ok || !me.json || !me.json.id) return fail(401, "Your sign-in has expired. Please sign in again.");
    const caller = me.json;

    if (body.action === "passwordChanged") {
      const m = { ...(caller.app_metadata || {}), must_change_password: false };
      const r = await call(`/auth/v1/admin/users/${caller.id}`, { method: "PUT", body: { app_metadata: m } });
      return r.ok ? reply(200, { ok: true }) : fail(500, errOf(r));
    }

    const callerStaff = await staffRecord(zpId(caller));
    if (!callerStaff || callerStaff.role !== "admin" || isLeaver(callerStaff)) return fail(403, "Only administrators can manage sign-in accounts.");

    const accounts = await allAccounts();
    const accountOf = id => accounts.find(a => zpId(a) === String(id));

    switch (body.action) {
      case "status": {
        const staff = await allStaff();
        return reply(200, { ok: true, users: staff.map(u => { const a = accountOf(u.id);
          return { id: u.id, hasAccount: !!a, banned: a ? isBanned(a) : false, mustChange: a ? !!(a.app_metadata || {}).must_change_password : false }; }) });
      }
      case "create": {
        const r = await createAccount(await staffRecord(body.userId), body.password, accounts);
        return r.ok ? reply(200, { ok: true }) : fail(400, r.error);
      }
      case "setPassword": {
        const u = await staffRecord(body.userId);
        if (!u) return fail(404, "Staff record not found.");
        const bad = checkPassword(body.password); if (bad) return fail(400, bad);
        const a = accountOf(u.id);
        if (!a) { const r = await createAccount(u, body.password, accounts); return r.ok ? reply(200, { ok: true, created: true }) : fail(400, r.error); }
        const r = await call(`/auth/v1/admin/users/${a.id}`, { method: "PUT",
          body: { password: body.password, app_metadata: metaFor(u, body.temporary !== false) } });
        return r.ok ? reply(200, { ok: true }) : fail(400, `${u.name}: ${errOf(r)}`);
      }
      case "sync": {
        const u = await staffRecord(body.userId);
        const a = accountOf(body.userId);
        if (!a) return reply(200, { ok: true, noAccount: true });
        if (!u) {   // staff record deleted → remove the sign-in too
          const d = await call(`/auth/v1/admin/users/${a.id}`, { method: "DELETE" });
          return d.ok ? reply(200, { ok: true, removed: true }) : fail(500, errOf(d));
        }
        const upd = { app_metadata: metaFor(u, !!(a.app_metadata || {}).must_change_password), ban_duration: isLeaver(u) ? FOREVER : "none" };
        const login = loginOf(u);
        if (login.includes("@") && login !== String(a.email || "").toLowerCase()) { upd.email = login; upd.email_confirm = true; }
        const r = await call(`/auth/v1/admin/users/${a.id}`, { method: "PUT", body: upd });
        return r.ok ? reply(200, { ok: true }) : fail(400, `${u.name}: ${errOf(r)}`);
      }
      case "remove": {
        const a = accountOf(body.userId);
        if (!a) return reply(200, { ok: true, noAccount: true });
        if (a.id === caller.id) return fail(400, "You can't remove your own sign-in account.");
        const r = await call(`/auth/v1/admin/users/${a.id}`, { method: "DELETE" });
        return r.ok ? reply(200, { ok: true }) : fail(500, errOf(r));
      }
      case "createMissing": {
        const staff = await allStaff();
        const results = [];
        for (const [userId, password] of Object.entries(body.passwords || {})) {
          const u = staff.find(s => s.id === String(userId));
          const r = await createAccount(u, password, accounts);
          results.push({ userId: String(userId), ok: r.ok, error: r.error || null });
        }
        return reply(200, { ok: true, results });
      }
      default:
        return fail(400, "Unknown action.");
    }
  } catch (e) {
    return fail(500, e.message || "Account service error.");
  }
};
