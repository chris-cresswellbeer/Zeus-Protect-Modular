/**
 * netlify/functions/zp-racking.mjs — send red racking alerts now.
 * Called by the portal / phone straight after a red damage report (or a rating changed to
 * red). Takes no input: the database decides what's due, and each alert goes once.
 * Only answers our own site's address, and the caller must be signed in. The 2-minute zp-lone-run job does the same as a back-up.
 */
import { cfg, siteOf } from "../shared/emailJob.mjs";
import { runRackingJob } from "../shared/rackingJob.mjs";

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
  if (!(await signedIn(event))) return reply(401, { ok: false });
  try {
    const r = await runRackingJob({ portalUrl: site.portalUrl, forceTest: !site.isLive });
    if (r.alerted || !r.ok) console.log(`[zp-racking] ${r.alerted || 0} alerted, ${r.emailed || 0} emailed ${r.message || ""}`);
    return reply(200, { ok: true, alerted: r.alerted || 0 });
  } catch (e) {
    console.error(`[zp-racking] failed: ${e.message}`);
    return reply(200, { ok: false });
  }
};
