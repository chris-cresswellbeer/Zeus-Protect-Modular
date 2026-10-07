/**
 * ═══════════════════════════════════════════════════════════════════════════
 * netlify/shared/emailJob.mjs — the email reminder job (server side)
 * ═══════════════════════════════════════════════════════════════════════════
 * Used by two Netlify functions:
 *   zp-email-run  every 15 minutes on the live site (netlify.toml schedule)
 *   zp-email      the admin buttons in Site Settings → Email reminders
 *                 (check set-up, preview, send a test, send now)
 *
 * It reads the database with the Supabase SERVICE ROLE key, works out what to send
 * with src/lib/reminders.js (the same rules as the portal's screens), sends through
 * Resend (resend.com) and records what went in email_log / email_keys
 * (email_reminders.sql). Nothing is sent while Site Settings → Email reminders is off.
 *
 * NETLIFY ENVIRONMENT VARIABLES (Site configuration → Environment variables;
 * scope "Functions"; never put these in the code or in a VITE_ variable):
 *   RESEND_API_KEY            from resend.com → API Keys ("Sending access" is enough)
 *   EMAIL_FROM                e.g.  Zeus Protect <hs-portal@yourdomain.co.uk>  (a domain verified in Resend)
 *   EMAIL_SEND_TO_STAFF       "yes" on the LIVE site only. Anything else (or unset) and
 *                             every email goes to EMAIL_TEST_TO instead. As a second guard,
 *                             the admin buttons only email staff when used on the live
 *                             site's own address (zp-email.mjs), so staging can't.
 *   EMAIL_TEST_TO             your own address; where emails go when not sending to staff
 *   EMAIL_REPLY_TO            optional; where replies go (e.g. the H&S team mailbox)
 *   PORTAL_URL                optional; the portal's address for links (default: Netlify's URL)
 *   SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL   (already set for the sign-in service)
 */
import { prepareData, planEmails, ukClock, emailSettings, EMAIL_SETTINGS_ROW } from "../../src/lib/reminders.js";
import { renderEmail } from "../../src/lib/emailTemplates.js";
import crypto from "crypto";

// Day maths in the shared rules use the computer's clock: make that UK time (Netlify runs in UTC).
process.env.TZ = "Europe/London";

/**
 * forceTest: true when the request didn't come from the live site's address (see zp-email.mjs),
 * so a staging deploy never emails staff even if EMAIL_SEND_TO_STAFF was set for every context.
 */
export const cfg = ({ forceTest = false } = {}) => ({
  base: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, ""),
  key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  resendKey: process.env.RESEND_API_KEY || "",
  resendUrl: String(process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, ""),   // RESEND_API_URL: tests only
  from: String(process.env.EMAIL_FROM || "").trim(),
  replyTo: String(process.env.EMAIL_REPLY_TO || "").trim(),
  live: !forceTest && String(process.env.EMAIL_SEND_TO_STAFF || "").trim().toLowerCase() === "yes",
  forcedTest: forceTest && String(process.env.EMAIL_SEND_TO_STAFF || "").trim().toLowerCase() === "yes",
  testTo: String(process.env.EMAIL_TEST_TO || "").trim(),
  portalUrl: String(process.env.PORTAL_URL || process.env.URL || "").replace(/\/+$/, ""),
});

const TABLES = {   // table → order for stable paging
  users: "id", training_assigns: "user_id,module_id", training_completions: "user_id,module_id", custom_modules: "id",
  documents: "id", doc_assignments: "doc_id,user_id", doc_acknowledgements: "user_id,doc_id", ext_certs: "user_id,cert_type",
  machine_completions: "user_id,machine_id", custom_machine_types: "id", incidents: "id", investigations: "incident_id",
  site_inspections: "id", risk_assessments: "id",
};
const PAGE = 1000;
const TIME_BUDGET_MS = 18000;   // scheduled functions get 30 seconds; leave room to record what was sent
const FETCH_MS = 8000;          // no single request may hang the run
/**
 * Keys made in TEST MODE are kept apart ("t|" in front), so trying reminders out in test
 * mode doesn't count as staff having been told once EMAIL_SEND_TO_STAFF is switched on.
 */
const NS_TEST = "t|";
const keyNs = c => (c.live ? "" : NS_TEST);

async function rest(c, path, { method = "GET", body, prefer } = {}) {
  const headers = { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${c.base}/rest/v1/${path}`, { method, headers, signal: AbortSignal.timeout(FETCH_MS), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  let json = null; const text = await res.text();
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const msg = (json && (json.message || json.msg || json.error)) || `HTTP ${res.status}`;
    const e = new Error(/does not exist|schema cache/i.test(msg) && /email_(log|keys)/.test(path) ? "The email tables aren't in the database yet: run email_reminders.sql in Supabase → SQL Editor." : `${path.split("?")[0]}: ${msg}`);
    e.status = res.status; throw e;
  }
  return { json };
}
/** Every row, a page at a time (Supabase returns at most 1000 rows per request). */
async function readAll(c, table, select = "*", order = TABLES[table], filter = "") {
  const out = [];
  for (let from = 0; from < 200000; from += PAGE) {
    const { json } = await rest(c, `${table}?select=${select}${filter}${order ? `&order=${order}` : ""}&limit=${PAGE}&offset=${from}`);
    const rows = Array.isArray(json) ? json : [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
/** Tables that may not exist on an older database just count as empty. */
async function readOptional(c, table) {
  try { return await readAll(c, table); } catch (e) { if (e.status === 404 || /does not exist|schema cache/i.test(e.message)) return []; throw e; }
}

export async function loadSettings(c) {
  const { json } = await rest(c, `app_settings?select=data&id=eq.${EMAIL_SETTINGS_ROW}`);
  return emailSettings((json && json[0] && json[0].data) || {});
}

async function sentToday(c, day) {
  return (await readAll(c, "email_log", "id", "id", `&day=eq.${day}&status=in.(sent,redirected)`)).length;
}

const addKeys = (c, keys, source) => keys.length
  ? rest(c, "email_keys?on_conflict=key", { method: "POST", body: [...new Set(keys)].map(key => ({ key: keyNs(c) + key, source })), prefer: "resolution=ignore-duplicates,return=minimal" })
  : null;
/** The keys that count for this mode (live or test), without the test prefix. */
async function readKeys(c) {
  const ns = keyNs(c);
  return new Set((await readAll(c, "email_keys", "key", "key")).map(r => r.key)
    .filter(k => (ns ? k.startsWith(ns) : !k.startsWith(NS_TEST))).map(k => k.slice(ns.length)));
}
/** Weekly keys are only needed for the week they're for: drop them after 8 weeks so the list stays small. */
async function pruneKeys(c) {
  const before = new Date(Date.now() - 56 * 86400000).toISOString();
  await rest(c, `email_keys?at=lt.${before}&or=(key.like.*weekly:*,key.like.*manager:*,key.like.*digest:*,key.like.*round:*)`, { method: "DELETE", prefer: "return=minimal" }).catch(() => {});
}
const addLog = (c, rows) => rows.length ? rest(c, "email_log", { method: "POST", body: rows, prefer: "return=minimal" }) : null;

/** Where an email really goes: staff on the live site, otherwise the test address. */
function route(c, e) {
  if (c.live) return { ...e, actualTo: e.to, status: "sent" };
  const banner = `TEST COPY — this would have gone to ${e.name ? `${e.name} ` : ""}<${e.to}>. Staff aren't emailed until EMAIL_SEND_TO_STAFF is "yes".`;
  const bannerHtml = `<div style="background:#fff3cd;border-bottom:1px solid #f0d58a;padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5c4400;text-align:center">${banner.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
  return { ...e, actualTo: c.testTo, status: "redirected", subject: `[Test → ${e.name || e.to}] ${e.subject}`,
    html: e.html.replace(/<body[^>]*>/, m => m + bannerHtml), text: `*** ${banner} ***\n\n${e.text}` };
}

const hash = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 40);
const payload = (c, e) => ({ from: c.from, to: [e.actualTo], subject: e.subject, html: e.html, text: e.text, ...(c.replyTo ? { reply_to: c.replyTo } : {}),
  tags: [{ name: "kind", value: e.kind }] });

async function resend(c, path, body, idem) {
  const res = await fetch(`${c.resendUrl}${path}`, { method: "POST", signal: AbortSignal.timeout(FETCH_MS),
    headers: { Authorization: `Bearer ${c.resendKey}`, "Content-Type": "application/json", ...(idem ? { "Idempotency-Key": idem } : {}) },
    body: JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch { /* empty */ }
  if (!res.ok) { const e = new Error((json && (json.message || json.error || json.name)) || `Resend HTTP ${res.status}`); e.status = res.status; e.refused = res.status === 400 || res.status === 422; throw e; }
  return json;
}
const pause = ms => new Promise(r => setTimeout(r, ms));

/**
 * Send a list of routed emails, in batches of up to 100 (one request each). After EACH batch,
 * onBatch(results) records what went, so a run cut short can't send those again.
 *   • a batch Resend REFUSES (400/422, e.g. one bad address): its emails are tried one by one,
 *     so the rest still go; an email refused on its own is "rejected" (not tried again)
 *   • anything else (time-out, network, Resend down): "held" — tried again on the next run.
 *     Not retried one by one, because Resend may have accepted the batch after all.
 * result: { e, ok, id, error, held, rejected }
 */
async function deliver(c, list, started, onBatch) {
  const out = [];
  const hold = (e, why) => ({ e, ok: false, held: true, error: why });
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100);
    const res = [];
    if (Date.now() - started > TIME_BUDGET_MS) { list.slice(i).forEach(e => out.push(hold(e, "out of time — on the next run"))); break; }
    try {
      const r = await resend(c, "/emails/batch", batch.map(e => payload(c, e)), `zp-b-${hash(batch.map(e => e.actualTo + e.subject + e.keys.join()).join("|"))}`);
      const ids = (r && (r.data || r)) || [];
      batch.forEach((e, j) => res.push({ e, ok: true, id: (ids[j] && ids[j].id) || null }));
    } catch (err) {
      if (err.status === 401 || err.status === 403) batch.forEach(e => res.push({ e, ok: false, error: `Resend refused the API key (${err.message})` }));
      else if (!err.refused) batch.forEach(e => res.push(hold(e, `Resend didn't answer (${err.message}) — on the next run`)));
      else for (const e of batch) {
        if (Date.now() - started > TIME_BUDGET_MS) { res.push(hold(e, "out of time — on the next run")); continue; }
        try { const r = await resend(c, "/emails", payload(c, e), `zp-e-${hash(e.actualTo + e.subject + e.keys.join())}`); res.push({ e, ok: true, id: r && r.id }); }
        catch (e2) { res.push(e2.refused ? { e, ok: false, rejected: true, error: e2.message } : hold(e, `Resend didn't answer (${e2.message}) — on the next run`)); }
        await pause(150);   // Resend allows 10 requests a second
      }
    }
    out.push(...res);
    if (onBatch) await onBatch(res);
  }
  return out;
}

/** What's missing before emails can go. [] when ready. */
export function setupProblems(c, { forSending = true } = {}) {
  const p = [];
  if (!c.base || !c.key) p.push("SUPABASE_SERVICE_ROLE_KEY (and VITE_SUPABASE_URL) aren't set in Netlify's environment variables.");
  if (forSending) {
    if (!c.resendKey) p.push("RESEND_API_KEY isn't set in Netlify's environment variables.");
    if (!c.from) p.push("EMAIL_FROM isn't set (e.g. Zeus Protect <hs-portal@yourdomain.co.uk>).");
    if (!c.live && !c.testTo) p.push(c.forcedTest ? "This isn't the live site, so staff aren't emailed from here: set EMAIL_TEST_TO for this deploy to try reminders out."
      : "EMAIL_TEST_TO isn't set, and EMAIL_SEND_TO_STAFF isn't \"yes\" — so there's nowhere safe to send.");
  }
  return p;
}

/**
 * Run the job.
 *   mode "scheduled"  the 15-minute run: waits for the send hour / weekday
 *   mode "now"        admin's "Send due emails now": doesn't wait for the hour or weekday
 *   mode "preview"    works out what "now" would send, sends nothing, records nothing
 * → { ok, mode, message, sent, failed, held, firstRun, baseline, emails?:[...] , noEmail }
 */
export async function runEmailJob({ mode = "scheduled", now = new Date(), portalUrl, forceTest = false } = {}) {
  const started = Date.now();
  const c = cfg({ forceTest });
  const problems = setupProblems(c, { forSending: mode !== "preview" });
  if (problems.length) return { ok: false, mode, message: problems.join(" ") };

  const settings = await loadSettings(c);
  if (mode !== "preview" && !settings.enabled) return { ok: true, mode, message: "Email reminders are switched off (Site Settings → Email reminders).", sent: 0 };

  const names = Object.keys(TABLES);
  if (mode === "scheduled") await pruneKeys(c);
  const [sent, ...tableRows] = await Promise.all([readKeys(c), ...names.map(t => readOptional(c, t))]);
  const rows = Object.fromEntries(names.map((t, i) => [t, tableRows[i]]));
  const clock = ukClock(now);
  const plan = planEmails({ data: prepareData(rows), settings, clock, sent, portalUrl: portalUrl || c.portalUrl, ignoreSchedule: mode !== "scheduled" });

  const limitLeft = mode === "preview" ? settings.dailyLimit : Math.max(0, settings.dailyLimit - await sentToday(c, clock.today));
  const toSend = plan.emails.slice(0, limitLeft);
  const overLimit = plan.emails.length - toSend.length;

  if (mode === "preview") {
    return { ok: true, mode, live: c.live, testTo: c.testTo, firstRun: plan.firstRun, baseline: plan.baselineKeys.filter(k => k !== "baseline").length,
      noEmail: plan.noEmail, dailyLimit: settings.dailyLimit, overLimit, enabled: settings.enabled,
      emails: plan.emails.slice(0, 300).map((e, i) => ({ kind: e.kind, to: e.to, name: e.name, subject: e.subject, html: i < 60 ? e.html : "" })), total: plan.emails.length };
  }

  // First run and "nothing to say" keys are recorded before sending, so a slow send can't repeat them.
  await addKeys(c, plan.baselineKeys, "baseline");
  await addKeys(c, plan.quietKeys, "quiet");

  const results = await deliver(c, toSend.map(e => route(c, e)), started, async batch => {
    // what went (and what Resend refused outright — retrying a bad address every 15 minutes helps no one)
    await addKeys(c, batch.filter(r => r.ok).flatMap(r => r.e.keys), mode);
    await addKeys(c, batch.filter(r => r.rejected).flatMap(r => r.e.keys), "rejected");
    await addLog(c, batch.filter(r => !r.held).map(r => ({ day: clock.today, kind: r.e.kind, user_id: r.e.userId || null, to_addr: r.e.actualTo, intended_to: r.e.to,
      subject: r.e.subject.slice(0, 300), status: r.ok ? r.e.status : "failed", error: r.ok ? null : String(r.error || "").slice(0, 500), resend_id: r.id || null, mode })));
  });

  const sentN = results.filter(r => r.ok).length, failed = results.filter(r => !r.ok && !r.held), held = results.filter(r => r.held).length + overLimit;
  const msg = [sentN ? `${sentN} email${sentN === 1 ? "" : "s"} sent${c.live ? "" : ` (to ${c.testTo} — test mode)`}.` : "Nothing was due to send.",
    plan.firstRun ? `First run: ${plan.baselineKeys.length - 1} things already assigned or expiring were noted without emailing.` : "",
    failed.length ? `${failed.length} couldn't be sent: ${failed[0].error}` : "",
    overLimit ? `${overLimit} held back by the daily limit of ${settings.dailyLimit}; they'll go tomorrow.` : "",
    held - overLimit > 0 ? `${held - overLimit} will be tried again on the next run (${(results.find(r => r.held) || {}).error || ""}).` : ""].filter(Boolean).join(" ");
  return { ok: !failed.length, mode, message: msg, sent: sentN, failed: failed.length, held, firstRun: plan.firstRun, noEmail: plan.noEmail };
}

/** A sample email to one address, to check the set-up. */
export async function sendTestEmail({ to, name, portalUrl, forceTest = false } = {}) {
  const c = cfg({ forceTest });
  const problems = setupProblems(c);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const settings = await loadSettings(c);
  const { html, text } = renderEmail({ preheader: "Test email from Zeus Protect", greeting: name ? `Hi ${String(name).split(/\s+/)[0]},` : "Hello,",
    intro: "This is a test email from Zeus Protect. If you can read it, email reminders are set up correctly.",
    sections: [{ title: "Set-up", items: [
      { text: `Sending from ${c.from}`, sub: c.replyTo ? `Replies go to ${c.replyTo}` : "Replies: not set (EMAIL_REPLY_TO)" },
      { text: c.live ? "Sending to staff: yes" : "Sending to staff: no — test mode", sub: c.live ? "Reminders go to each person's own address." : `Every email goes to ${c.testTo}.` },
      { text: `Reminders are ${settings.enabled ? "switched on" : "switched off"}`, sub: "Site Settings → Email reminders" },
    ] }],
    button: { label: "Open Zeus Protect", href: `${String(portalUrl || c.portalUrl).replace(/\/+$/, "")}/#/admin/settings` } });
  const e = route(c, { kind: "test", to, name, subject: "Zeus Protect test email", html, text, keys: [`test:${Date.now()}`] });   // unique, so a second test isn't treated as a repeat
  const [r] = await deliver(c, [e], Date.now());
  await addLog(c, [{ day: ukClock().today, kind: "test", user_id: null, to_addr: e.actualTo, intended_to: to, subject: e.subject, status: r.ok ? e.status : "failed",
    error: r.ok ? null : r.error, resend_id: r.id || null, mode: "test" }]).catch(() => {});
  return r.ok ? { ok: true, message: `Test email sent to ${e.actualTo}.` } : { ok: false, message: `The test email couldn't be sent: ${r.error}` };
}

/** Set-up check for the settings screen. */
export async function emailStatus({ forceTest = false } = {}) {
  const c = cfg({ forceTest });
  const out = { ok: true, resendKey: !!c.resendKey, from: c.from, replyTo: c.replyTo, live: c.live, forcedTest: c.forcedTest, testTo: c.testTo, portalUrl: c.portalUrl,
    problems: setupProblems(c), tables: false, sentToday: 0 };
  if (!c.base || !c.key) return out;
  try { out.sentToday = await sentToday(c, ukClock().today); await rest(c, "email_keys?select=key&limit=1"); out.tables = true; }
  catch (e) { out.problems.push(e.message); }
  return out;
}
