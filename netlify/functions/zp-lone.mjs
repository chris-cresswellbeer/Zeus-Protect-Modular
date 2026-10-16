/**
 * netlify/functions/zp-lone.mjs — run the lone working check now.
 * Called by the phone straight after "I need help", and by the portal's Lone working
 * screen while it's open (so staging, which has no schedule, works too). Takes no input:
 * the database decides what's due, and each alert goes once (idempotency keys).
 * Only answers our own site's address, and with the individual sign-ins the caller must
 * be signed in.
 */
import { cfg, siteOf } from "../shared/emailJob.mjs";
import { runLoneJob } from "../shared/loneJob.mjs";

const reply = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });

async function signedIn(event) {
  const h = event.headers || {};
  const token = String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, "");
  const c = cfg();
  if (!token || !c.base || !c.key) return false;
  try {
    const r = await fetch(`${c.base}/auth/v1/user`, { headers: { apikey: c.key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) });
    const user = r.ok ? await r.json().catch(() => null) : null;
    return !!(user && user.id && (user.app_metadata || {}).zp_id);
  } catch { return false; }
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { ok: false });
  const site = siteOf(event);
  if (!site.ours) return reply(403, { ok: false });
  if (String(process.env.VITE_AUTH_MODE || "").trim().toLowerCase() === "supabase" && !(await signedIn(event))) return reply(401, { ok: false });
  try {
    const r = await runLoneJob({ portalUrl: site.portalUrl, forceTest: !site.isLive });
    if (r.changed || !r.ok) console.log(`[zp-lone] ${r.changed || 0} changed, ${r.emailed || 0} emailed ${r.message || ""}`);
    return reply(200, { ok: true, changed: r.changed || 0 });
  } catch (e) {
    console.error(`[zp-lone] failed: ${e.message}`);
    return reply(200, { ok: false });
  }
};
