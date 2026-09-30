/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/auth.js — sign-in with Supabase Auth, and admin account management
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO MODES, chosen per Netlify site with the environment variable VITE_AUTH_MODE:
 *
 *   "legacy"   (default) – the original sign-in: passwords are SHA-256 hashes in the
 *                          user_passwords table, checked in the browser. The live
 *                          portal stays in this mode until changeover day.
 *   "supabase"           – real sign-in through Supabase Auth. The password is checked
 *                          by Supabase, which returns a signed token; every database
 *                          request then carries that token (lib/supabase.js), so the
 *                          database knows who is asking.
 *
 * HOW A SIGN-IN ACCOUNT IS LINKED TO A STAFF RECORD
 *   Each Supabase Auth user carries app_metadata (only the server can set it):
 *     { zp_id: "<users.id>", zp_role: "admin"|"manager"|"staff", must_change_password: bool }
 *   The admin server function (netlify/functions/zp-admin.mjs) creates and updates
 *   these accounts from the staff record, using a secret key that never reaches
 *   the browser. The sign-in name is the staff member's email-style login, and
 *   no emails are sent: admins set temporary passwords, and people must choose
 *   their own at first sign-in.
 *
 * SESSION: kept in memory only (a page reload signs you out, as before). The token
 * is refreshed automatically a minute before it expires.
 */
import { SUPABASE_URL, SUPABASE_ANON, setAccessToken } from "./supabase";

const ENV = (typeof import.meta !== "undefined" && import.meta.env) || {};
const AUTH_MODE = ENV.VITE_AUTH_MODE === "supabase" ? "supabase" : "legacy";
const ADMIN_FN = "/.netlify/functions/zp-admin";

let session = null;          // { access_token, refresh_token, expires_at (ms), user }
let refreshTimer = null;

function applySession(s) {
  session = s;
  setAccessToken(s ? s.access_token : null);
  clearTimeout(refreshTimer);
  if (s && s.refresh_token) {
    const wait = Math.max(30000, (s.expires_at - Date.now()) - 60000);
    refreshTimer = setTimeout(refresh, wait);
  }
}

function fromTokenResponse(j) {
  return { access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000, user: j.user || null };
}

async function authFetch(path, { method = "GET", body, token } = {}) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method,
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, Authorization: `Bearer ${token || SUPABASE_ANON}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    return { ok: false, status: 0, json: { error_description: "Can't reach the server. Check your connection and try again." } };
  }
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, json };
}

const errText = j => j.error_description || j.msg || j.message || j.error || "Something went wrong.";

/** Sign in. Returns { ok, user (auth user), error }. */
async function signIn(email, password) {
  const r = await authFetch("token?grant_type=password", { method: "POST", body: { email: String(email).trim().toLowerCase(), password } });
  if (!r.ok) {
    const t = errText(r.json);
    if (r.status === 400 && /invalid/i.test(t)) return { ok: false, error: "Invalid email or password." };
    if (/banned/i.test(t)) return { ok: false, error: "This account is no longer active. Please contact your administrator." };
    if (r.status === 429) return { ok: false, error: "Too many sign-in attempts. Please wait a few minutes and try again." };
    return { ok: false, error: t };
  }
  applySession(fromTokenResponse(r.json));
  return { ok: true, user: r.json.user };
}

/** Check a password without changing the current session (used to confirm "current password"). */
async function checkPassword(email, password) {
  const r = await authFetch("token?grant_type=password", { method: "POST", body: { email: String(email).trim().toLowerCase(), password } });
  return r.ok;
}

async function refresh() {
  if (!session || !session.refresh_token) return;
  const r = await authFetch("token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token } });
  if (r.ok) applySession(fromTokenResponse(r.json));
}

async function signOut() {
  const t = session && session.access_token;
  applySession(null);
  if (t) await authFetch("logout", { method: "POST", token: t });
}

/** Change the signed-in person's own password, then clear the "must change" flag. */
async function changeOwnPassword(newPassword) {
  if (!session) return { ok: false, error: "You're not signed in." };
  const r = await authFetch("user", { method: "PUT", token: session.access_token, body: { password: newPassword } });
  if (!r.ok) return { ok: false, error: errText(r.json) };
  const a = await adminCall("passwordChanged", {});          // clears must_change_password (own account only)
  await refresh();                                            // pick up the updated app_metadata
  return a.ok ? { ok: true } : { ok: true, warning: a.error };
}

const currentAuthUser = () => (session && session.user) || null;
const meta = u => (u && u.app_metadata) || {};

/**
 * Call the admin server function. Returns { ok, ...result } or { ok:false, error }.
 * Actions: status, create, setPassword, sync, remove, createMissing, passwordChanged.
 */
async function adminCall(action, payload = {}) {
  if (!session) return { ok: false, error: "You're not signed in." };
  let res;
  try {
    res = await fetch(ADMIN_FN, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, ...payload }) });
  } catch {
    return { ok: false, error: "Can't reach the account service. Check your connection and try again." };
  }
  let json = {};
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || json.ok === false) return { ok: false, error: json.error || `Account service error (${res.status}).` };
  return { ok: true, ...json };
}

// Readable temporary passwords: no look-alike characters (0/O, 1/l/I).
function makeTempPassword() {
  const words = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const pick = n => Array.from(crypto.getRandomValues(new Uint32Array(n)), v => words[v % words.length]).join("");
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}

export { AUTH_MODE, signIn, signOut, checkPassword, changeOwnPassword, currentAuthUser, meta, adminCall, makeTempPassword };
