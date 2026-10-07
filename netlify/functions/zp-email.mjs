/**
 * ═══════════════════════════════════════════════════════════════════════════
 * netlify/functions/zp-email.mjs — the admin buttons for email reminders
 * ═══════════════════════════════════════════════════════════════════════════
 * Site Settings → Email reminders calls /.netlify/functions/zp-email with the
 * signed-in admin's token (src/lib/auth.js → emailCall). The job itself is in
 * netlify/shared/emailJob.mjs; the 15-minute schedule is zp-email-run.mjs.
 *
 * ACTIONS (POST JSON { action }), administrators only:
 *   status    is everything set up? (keys, sender, test mode, database tables)
 *   preview   the emails "Send now" would send, with their content; sends nothing
 *   test      a test email to the admin who clicked (or EMAIL_TEST_TO in test mode)
 *   sendNow   send what's due now, without waiting for the send hour or weekday
 * Works on staging (branch deploys) too, where scheduled runs don't happen.
 */
import { cfg, runEmailJob, sendTestEmail, emailStatus } from "../shared/emailJob.mjs";

const reply = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const fail = (status, error) => reply(status, { ok: false, error });

async function caller(token) {
  const c = cfg();
  const hdr = { apikey: c.key, "Content-Type": "application/json" };
  const me = await fetch(`${c.base}/auth/v1/user`, { headers: { ...hdr, Authorization: `Bearer ${token}` } });
  const user = me.ok ? await me.json().catch(() => null) : null;
  if (!user || !user.id) return { error: [401, "Your sign-in has expired. Please sign in again."] };
  const zpId = String((user.app_metadata || {}).zp_id || "");
  const r = await fetch(`${c.base}/rest/v1/users?select=id,data&id=eq.${encodeURIComponent(zpId)}`, { headers: { ...hdr, Authorization: `Bearer ${c.key}` } });
  const row = r.ok ? ((await r.json().catch(() => [])) || [])[0] : null;
  const staff = row ? { ...(row.data || {}), id: String(row.id) } : null;
  if (!staff || staff.role !== "admin" || (staff.status || "active") === "leaver") return { error: [403, "Only administrators can do this."] };
  return { staff, email: String(staff.email || user.email || "").trim() };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return fail(405, "Use POST.");
  const c = cfg();
  if (!c.base || !c.key) return fail(500, "The email service isn't set up: add SUPABASE_SERVICE_ROLE_KEY (and VITE_SUPABASE_URL) in Netlify's environment variables, then redeploy.");
  const token = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "Not signed in.");
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return fail(400, "Bad request."); }
  // Which site is this? Staff are only emailed from the LIVE site's own address; anywhere else
  // (staging, a branch or preview deploy) is test mode, whatever EMAIL_SEND_TO_STAFF says.
  // Links in emails sent from here point at the site the admin is using, if it's one of ours.
  const host = String((event.headers && (event.headers["x-forwarded-host"] || event.headers.host)) || "").toLowerCase().split(",")[0].trim();
  const liveHosts = [process.env.PORTAL_URL, process.env.URL].filter(Boolean).map(u => { try { return new URL(u).host.toLowerCase(); } catch { return ""; } }).filter(Boolean);
  const site = String(process.env.SITE_NAME || "").toLowerCase();
  if (site) liveHosts.push(`${site}.netlify.app`);
  const isLive = liveHosts.includes(host);
  const ours = isLive || (site && host.endsWith(`--${site}.netlify.app`)) || /^localhost(:\d+)?$/.test(host);
  const forceTest = !isLive;
  const portalUrl = ours ? `${/^localhost/.test(host) ? "http" : "https"}://${host}` : c.portalUrl;
  try {
    const who = await caller(token);
    if (who.error) return fail(...who.error);
    switch (body.action) {
      case "status": return reply(200, await emailStatus({ forceTest }));
      case "preview": { const r = await runEmailJob({ mode: "preview", portalUrl, forceTest }); return r.ok ? reply(200, r) : fail(400, r.message); }
      case "sendNow": { const r = await runEmailJob({ mode: "now", portalUrl, forceTest }); return reply(200, { ...r, ok: true, problem: !r.ok }); }
      case "test": {
        if (!/@/.test(who.email)) return fail(400, "Your staff record has no email address to send the test to.");
        const r = await sendTestEmail({ to: who.email, name: who.staff.name, portalUrl, forceTest });
        return r.ok ? reply(200, r) : fail(400, r.message);
      }
      default: return fail(400, "Unknown action.");
    }
  } catch (e) {
    return fail(500, e.message || "Email service error.");
  }
};
