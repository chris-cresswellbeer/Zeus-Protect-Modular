/**
 * ═══════════════════════════════════════════════════════════════════════════
 * netlify/functions/zp-translate.mjs — machine translation of training modules
 * ═══════════════════════════════════════════════════════════════════════════
 * Training → module → Translations calls /.netlify/functions/zp-translate with the
 * signed-in admin's token (src/lib/auth.js → translateCall). The text is sent to
 * DeepL and the translations come back to the browser, which saves them in the
 * module_translations table (module_translations.sql). Nothing is stored here.
 *
 * NETLIFY ENVIRONMENT VARIABLES (Site configuration → Environment variables):
 *   DEEPL_API_KEY               from your DeepL API account (deepl.com → Account →
 *                               API keys). A free-plan key ends in ":fx".
 *                               Keep it secret — never in the portal's code or in chat,
 *                               and never in SECRETS_SCAN_OMIT_KEYS.
 *   SUPABASE_SERVICE_ROLE_KEY   already set for the account service; used here only to
 *                               check that the caller is an administrator.
 *
 * ACTIONS (POST JSON { action, ... }), administrators only:
 *   status                                → { ok, configured, plan, used, limit }
 *   translate { target, items:[{text, html}] } → { ok, translations:[string] }
 *       target: "fr" | "pl" | "ro". html items keep their formatting (bold, lists…).
 */

const BASE = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DEEPL_KEY = String(process.env.DEEPL_API_KEY || "").trim();
const DEEPL_BASE = DEEPL_KEY.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";

const TARGETS = { fr: "FR", pl: "PL", ro: "RO" };
const MAX_CHARS = 250000;      // one request: far more than the longest module
const BATCH_ITEMS = 40;        // DeepL accepts up to 50 texts per call
const BATCH_CHARS = 60000;     // and up to 128 KB per call

const reply = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const fail = (status, error) => reply(status, { ok: false, error });

async function isAdmin(token) {
  const hdr = { apikey: KEY, "Content-Type": "application/json" };
  const me = await fetch(`${BASE}/auth/v1/user`, { headers: { ...hdr, Authorization: `Bearer ${token}` } });
  const user = me.ok ? await me.json().catch(() => null) : null;
  if (!user || !user.id) return [401, "Your sign-in has expired. Please sign in again."];
  const zpId = String((user.app_metadata || {}).zp_id || "");
  const r = await fetch(`${BASE}/rest/v1/users?select=id,data&id=eq.${encodeURIComponent(zpId)}`, { headers: { ...hdr, Authorization: `Bearer ${KEY}` } });
  const row = r.ok ? ((await r.json().catch(() => [])) || [])[0] : null;
  const staff = row ? (row.data || {}) : null;
  if (!staff || staff.role !== "admin" || (staff.status || "active") === "leaver") return [403, "Only administrators can translate modules."];
  return null;
}

async function deepl(path, body) {
  const res = await fetch(`${DEEPL_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const why = res.status === 403 ? "DeepL refused the API key — check DEEPL_API_KEY in Netlify."
      : res.status === 456 ? "This month's DeepL allowance has been used up. It resets at the start of your next billing month."
      : res.status === 429 ? "DeepL is busy — wait a minute and try again."
      : `DeepL error ${res.status}${json && json.message ? `: ${json.message}` : ""}`;
    throw new Error(why);
  }
  return json;
}

// Split into batches DeepL accepts, keeping order.
function batches(list) {
  const out = []; let cur = []; let size = 0;
  list.forEach(item => {
    const n = item.text.length;
    if (cur.length && (cur.length >= BATCH_ITEMS || size + n > BATCH_CHARS)) { out.push(cur); cur = []; size = 0; }
    cur.push(item); size += n;
  });
  if (cur.length) out.push(cur);
  return out;
}

export async function translateItems(items, target) {
  const lang = TARGETS[target];
  const result = new Array(items.length).fill("");
  // HTML and plain text go separately: HTML handling would misread a "<" in plain text.
  for (const html of [true, false]) {
    const group = items.map((it, i) => ({ ...it, i })).filter(it => !!it.html === html && String(it.text).trim());
    for (const b of batches(group)) {
      const json = await deepl("/v2/translate", {
        text: b.map(it => it.text), source_lang: "EN", target_lang: lang,
        preserve_formatting: true, ...(html ? { tag_handling: "html" } : {}),
      });
      (json.translations || []).forEach((tr, k) => { result[b[k].i] = String(tr.text || ""); });
    }
  }
  return result;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return fail(405, "Use POST.");
  if (!BASE || !KEY) return fail(500, "The translation service isn't set up: SUPABASE_SERVICE_ROLE_KEY (and VITE_SUPABASE_URL) must be in Netlify's environment variables.");
  const token = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "Not signed in.");
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return fail(400, "Bad request."); }
  try {
    const denied = await isAdmin(token);
    if (denied) return fail(...denied);
    if (body.action === "status") {
      if (!DEEPL_KEY) return reply(200, { ok: true, configured: false });
      const u = await deepl("/v2/usage");
      return reply(200, { ok: true, configured: true, plan: DEEPL_KEY.endsWith(":fx") ? "free" : "pro", used: u.character_count || 0, limit: u.character_limit || 0 });
    }
    if (body.action !== "translate") return fail(400, "Unknown action.");
    if (!DEEPL_KEY) return fail(400, "Translation isn't set up yet: add DEEPL_API_KEY in Netlify's environment variables, then redeploy.");
    if (!TARGETS[body.target]) return fail(400, "Choose French, Polish or Romanian.");
    const items = Array.isArray(body.items) ? body.items.map(it => ({ text: String((it && it.text) || ""), html: !!(it && it.html) })) : [];
    if (!items.length) return reply(200, { ok: true, translations: [] });
    const chars = items.reduce((n, it) => n + it.text.length, 0);
    if (chars > MAX_CHARS) return fail(400, "That's too much text to translate in one go.");
    const translations = await translateItems(items, body.target);
    return reply(200, { ok: true, translations, chars });
  } catch (e) {
    return fail(502, String((e && e.message) || e));
  }
};
