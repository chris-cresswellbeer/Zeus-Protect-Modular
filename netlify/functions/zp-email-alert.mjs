/**
 * ═══════════════════════════════════════════════════════════════════════════
 * netlify/functions/zp-email-alert.mjs — high-risk incident emails, straight away
 * ═══════════════════════════════════════════════════════════════════════════
 * The portal calls POST /.netlify/functions/zp-email-alert just after any incident or
 * hazard report is saved (src/lib/incidentAlert.js). This checks the incidents of the
 * last week against the rules in Site Settings → Email reminders and emails any
 * high-risk one nobody has been told about yet (lib/reminders.js → section 0).
 *
 * It takes NO input and returns nothing useful: the database decides what's sent, and
 * every alert goes once (email_keys + a fixed Resend Idempotency-Key), so the worst an
 * unwanted call can do is make it check again. Still:
 *   • it only answers requests for our own site's address
 *   • with the individual sign-ins (VITE_AUTH_MODE=supabase in Netlify) the caller must be
 *     signed in; before the changeover there are no sign-ins to check, so it doesn't ask
 *
 * Works on staging too (test mode: everything goes to EMAIL_TEST_TO), and the 15-minute
 * job (zp-email-run) catches anything missed on the live site.
 */
import { cfg, siteOf, runEmailJob } from "../shared/emailJob.mjs";

const reply = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });

/** A valid sign-in token for a portal account (any role). */
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
    const r = await runEmailJob({ mode: "incident", portalUrl: site.portalUrl, forceTest: !site.isLive });
    if (r.sent || !r.ok) console.log(`[zp-email-alert] ${r.message || ""}`);
  } catch (e) {
    console.error(`[zp-email-alert] failed: ${e.message}`);
  }
  return reply(200, { ok: true });
};
