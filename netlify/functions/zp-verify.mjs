/**
 * ═══════════════════════════════════════════════════════════════════════════
 * netlify/functions/zp-verify.mjs — check a training certificate (public)
 * ═══════════════════════════════════════════════════════════════════════════
 * The QR code on a certificate opens  <portal>/?verify=ZSL-XXXXXXXX  (lib/certificate.js).
 * That page (src/shared/VerifyPage.jsx) asks this function, which needs NO sign-in:
 * anyone holding the certificate can check it.
 *
 *   GET /.netlify/functions/zp-verify?id=ZSL-XXXXXXXX
 *     → { ok:true, found:false }
 *     → { ok:true, found:true, holder:"Marta N.", module:"Chemical Hazards & COSHH",
 *         completed:"2026-10-13", validUntil:"2027-10-13" | "", status:"valid"|"expiring"|"expired"|"no-expiry" }
 *
 * It says only what is printed on the certificate already, with the surname shortened to
 * an initial: nothing else about the person, and nothing at all for an unknown number.
 * It reads the database with the service key (SUPABASE_SERVICE_ROLE_KEY, already set for
 * the account service), so it works with either sign-in.
 */
import { TRAINING_MODULES } from "../../src/data/seedTraining.js";
import { getExpiryStatus } from "../../src/lib/dates.js";

process.env.TZ = "Europe/London";   // dates the same as the portal's

const BASE = () => String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ID_RE = /^[A-Z0-9]{1,6}-[A-Z0-9]{4,20}$/;

const reply = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }, body: JSON.stringify(body) });

async function rows(path) {
  const r = await fetch(`${BASE()}/rest/v1/${path}`, { headers: { apikey: KEY(), Authorization: `Bearer ${KEY()}` } });
  if (!r.ok) throw new Error(`database ${r.status}`);
  const j = await r.json().catch(() => []);
  return Array.isArray(j) ? j : [];
}

/** "Marta Nowak" → "Marta N."; one word stays as it is. */
export function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export async function handler(event) {
  if (event.httpMethod !== "GET") return reply(405, { ok: false, error: "GET only" });
  if (!BASE() || !KEY()) return reply(503, { ok: false, error: "Certificate checking isn't set up on this site yet." });
  const id = String((event.queryStringParameters || {}).id || "").trim().toUpperCase();
  if (!ID_RE.test(id)) return reply(200, { ok: true, found: false });
  try {
    const sel = "select=user_id,module_id,score,date,cert_id&limit=1";
    let rec = (await rows(`training_completion_history?${sel}&cert_id=eq.${encodeURIComponent(id)}`))[0];
    if (!rec) rec = (await rows(`training_completions?${sel}&cert_id=eq.${encodeURIComponent(id)}`))[0];
    if (!rec) return reply(200, { ok: true, found: false });

    const [user] = await rows(`users?select=data&id=eq.${encodeURIComponent(rec.user_id)}`);
    const [custom] = await rows(`custom_modules?select=data&id=eq.${encodeURIComponent(rec.module_id)}`);
    const mod = (custom && custom.data) || TRAINING_MODULES.find(m => String(m.id) === String(rec.module_id)) || {};
    const date = String(rec.date || "").slice(0, 10);
    const months = Number(mod.renewalMonths) > 0 ? Number(mod.renewalMonths) : 0;
    const ex = months && date ? getExpiryStatus(date, months) : null;
    return reply(200, {
      ok: true, found: true,
      holder: shortName(user && user.data && user.data.name),
      module: String(mod.title || "Training module").slice(0, 160),
      completed: date,
      validUntil: ex ? ex.expiryDate : "",
      status: ex ? ex.status : "no-expiry",
    });
  } catch {
    return reply(502, { ok: false, error: "The certificate couldn't be checked just now. Please try again in a minute." });
  }
}
