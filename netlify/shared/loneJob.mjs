/**
 * ═══════════════════════════════════════════════════════════════════════════
 * netlify/shared/loneJob.mjs — lone working alerts (server side)
 * ═══════════════════════════════════════════════════════════════════════════
 * Used by zp-lone-run (every 2 minutes, netlify.toml) and zp-lone (straight after
 * someone presses "I need help", so that email goes within seconds).
 *
 * For each open session (lone_working: active / alert / escalated / help) it asks
 * src/lib/loneWorking.js → loneStep() what's due, saves the new status ONLY if the row
 * hasn't changed since it was read (so a check-in at the same moment wins), then emails:
 *   missed     the line manager (by name on the staff record); admins if there's no
 *              manager with an email address
 *   escalated  all admins (+ Site Settings → Email reminders → extra admin addresses)
 *   help       line manager and admins
 *   ok         whoever was alerted: they've now checked in
 * Alerts go whether or not email reminders are switched on, but need the email set-up
 * (RESEND_API_KEY, EMAIL_FROM) and follow test mode (EMAIL_SEND_TO_STAFF / EMAIL_TEST_TO).
 * Nothing happens while Site Settings → Lone working is off.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { cfg, setupProblems, loadSettings, sendUrgent } from "./emailJob.mjs";
import { renderEmail } from "../../src/lib/emailTemplates.js";
import { getBrand } from "../../src/lib/brandCore.js";
import { LONE_SETTINGS_ID, LONE_OPEN, normaliseLoneSettings, loneStep, loneEmailText, minutesBetween } from "../../src/lib/loneWorking.js";

const FETCH_MS = 8000;
async function rest(c, path, { method = "GET", body, prefer } = {}) {
  const headers = { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${c.base}/rest/v1/${path}`, { method, headers, signal: AbortSignal.timeout(FETCH_MS), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { /* */ }
  if (!r.ok) { const e = new Error(`${path.split("?")[0]}: ${(j && (j.message || j.msg)) || `HTTP ${r.status}`}`); e.status = r.status; throw e; }
  return j;
}
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const ukTime = iso => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(iso)).replace(",", "");

/** → { ok, checked, changed, emailed, failed, message } */
export async function runLoneJob({ now = new Date(), portalUrl, forceTest = false } = {}) {
  const c = cfg({ forceTest });
  if (!c.base || !c.key) return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY isn't set." };
  const sRow = await rest(c, `app_settings?select=data&id=eq.${LONE_SETTINGS_ID}`).catch(() => []);
  const settings = normaliseLoneSettings(sRow && sRow[0] && sRow[0].data);
  if (!settings.enabled) return { ok: true, checked: 0, changed: 0, emailed: 0, message: "Lone working is switched off." };
  let rows;
  try { rows = await rest(c, `lone_working?select=*&status=in.(${LONE_OPEN.join(",")})&limit=500`); }
  catch (e) { if (e.status === 404) return { ok: false, message: "The lone_working table isn't there yet: run lone_working.sql." }; throw e; }
  const nowIso = now.toISOString();
  const steps = rows.map(r => ({ r, s: loneStep(r, settings, nowIso) })).filter(x => x.s);
  if (!steps.length) return { ok: true, checked: rows.length, changed: 0, emailed: 0 };

  const emailSet = await loadSettings(c).catch(() => ({ extraAdminEmails: [] }));   // also loads the branding
  const users = (await rest(c, "users?select=id,data")).map(u => ({ ...(u.data || {}), id: String(u.id) })).filter(u => (u.status || "active") !== "leaver");
  const admins = users.filter(u => u.role === "admin" && u.email).map(u => ({ to: u.email, name: u.name, user_id: u.id }))
    .concat((emailSet.extraAdminEmails || []).map(e => ({ to: e, name: "", user_id: null })));
  const base = String(portalUrl || c.portalUrl || "").replace(/\/+$/, "");
  const problems = setupProblems(c);
  let changed = 0, emailed = 0, failed = 0;
  const notes = [];

  for (const { r, s } of steps) {
    // save first, only if nobody else changed it (status + updated_at as read)
    const upd = await rest(c, `lone_working?id=eq.${encodeURIComponent(r.id)}&status=eq.${r.status}&updated_at=eq.${encodeURIComponent(r.updated_at)}`,
      { method: "PATCH", body: { status: s.status, data: s.data, updated_at: nowIso }, prefer: "return=representation" });
    if (!Array.isArray(upd) || !upd.length) continue;   // the worker checked in (or someone acted) at the same moment
    changed++;
    const person = users.find(u => u.id === String(r.user_id)) || {};
    const mgr = person.manager ? users.find(u => norm(u.name) === norm(person.manager) && u.email) : null;
    for (const em of s.emails) {
      let to = em.to === "admins" ? admins : em.to === "both" ? [...(mgr ? [{ to: mgr.email, name: mgr.name, user_id: mgr.id }] : []), ...admins]
        : (mgr ? [{ to: mgr.email, name: mgr.name, user_id: mgr.id }] : admins);
      to = to.filter((x, i, a) => x.to && a.findIndex(y => norm(y.to) === norm(x.to)) === i);
      if (!to.length) { notes.push(`no one to email for ${r.id}`); continue; }
      if (problems.length) { notes.push(problems.join(" ")); failed += to.length; continue; }
      const d = s.data;
      const t = loneEmailText(em.kind, d, { overdueMin: d.nextDue ? Math.max(0, minutesBetween(d.nextDue, nowIso)) : 0 });
      const urgent = em.kind !== "ok";
      const items = [
        { text: d.name || "Lone worker", sub: [person.jobTitle, person.phone || person.mobile ? `Phone: ${person.phone || person.mobile}` : ""].filter(Boolean).join(" · ") || undefined },
        { text: `Where: ${t.where || "not given"}`, sub: `Started ${ukTime(d.startedAt)} · last check-in ${ukTime(d.lastCheckIn)}${d.nextDue ? ` · was due ${ukTime(d.nextDue)}` : ""}`, flag: urgent },
      ];
      const list = to.map(x => {
        const { html, text } = renderEmail({ preheader: t.subject, greeting: x.name ? `Hi ${String(x.name).split(/\s+/)[0]},` : "Hello,", intro: t.lead,
          sections: [{ title: "Lone working", items }],
          note: urgent ? "Try to contact them now. If you can't reach them, go or send someone to them, or call the emergency services if you think they're in danger. Then open the portal and record what you did, so the others alerted know it's being dealt with." : "",
          button: urgent && base ? { label: "I'm dealing with it", href: `${base}/?lone=${encodeURIComponent(r.id)}` } : null,
          banner: urgent ? `${getBrand().product} lone working alert` : "" });
        return { to: x.to, name: x.name, user_id: x.user_id, subject: t.subject, html, text, keys: [`lone:${r.id}:${em.kind}:${d.alertedAt || d.help && d.help.at || d.okAfterAlert && d.okAfterAlert.at || ""}:${x.to}`] };
      });
      const res = await sendUrgent(c, list);
      res.forEach(x => { if (x.ok) emailed++; else { failed++; notes.push(x.error || "not sent"); } });
    }
  }
  return { ok: failed === 0, checked: rows.length, changed, emailed, failed, message: notes.join(" ") };
}
