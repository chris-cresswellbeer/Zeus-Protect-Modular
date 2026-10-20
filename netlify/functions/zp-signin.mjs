/**
 * ═══════════════════════════════════════════════════════════════════════════
 * netlify/functions/zp-signin.mjs — contractor sign-in from the reception QR code (public)
 * ═══════════════════════════════════════════════════════════════════════════
 * The poster at reception has a QR code for  <portal>/?signin=CODE  (shared/SignInPage.jsx).
 * That page needs NO sign-in; it talks only to this function, which uses the service
 * key (SUPABASE_SERVICE_ROLE_KEY, already set for the account service).
 *
 *   GET  ?code=CODE                    → { ok, site, intro, items:[{id,text}] }
 *   POST { action:"signin",  code, company, name, phone, host, purpose, areas, permit,
 *          answers:{id:true}, signature }
 *                                      → { ok, id, token, date, timeIn, seeReception }
 *   POST { action:"signout", code, id, token }            (same phone)
 *   POST { action:"signout", code, company, name }        (another phone: today's sign-in by name)
 *                                      → { ok, timeOut } | { ok:false, error }
 *
 * WHAT IT WILL AND WON'T DO
 *   • Only with the current site code (Site Settings → Contractor sign-in); a wrong or
 *     old code, or sign-in switched off, gets "this code isn't in use".
 *   • It adds sign-ins and fills in a time out, and keeps the Contractor Register up to
 *     date: a company or worker it doesn't know is added (marked "Added from QR sign-in"
 *     for H&S to check), and each worker's first induction (the QR checklist) and last
 *     day on site are recorded. It never sends back anything from the register: the
 *     contractor is told only whether to see reception first (a banned / inactive company,
 *     or a permit to work that isn't issued). Reception and H&S see the reasons in the
 *     portal (lib/contractorApproval.js signinIssues), and by email (netlify/shared/emailJob.mjs).
 *   • At most 60 sign-ins in 10 minutes for the site, so a code shared online can't
 *     flood the list.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { SIGNIN_SETTINGS_ID, CODE_RE, normaliseSigninSettings, findCompany, findWorker, similarCompanies, normCompany, normPerson, ukNow } from "../../src/lib/contractorSignin.js";
import { signinIssues, seeReception, recordSignin } from "../../src/lib/contractorApproval.js";
import { runEmailJob, siteOf } from "../shared/emailJob.mjs";

process.env.TZ = "Europe/London";

const BASE = () => String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUSY = "Sign-in isn't working just now. Please sign in at reception.";

const reply = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }, body: JSON.stringify(body) });

async function rest(path, { method = "GET", body, prefer } = {}) {
  const headers = { apikey: KEY(), Authorization: `Bearer ${KEY()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${BASE()}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`database ${r.status}`);
  const t = await r.text();
  try { return t ? JSON.parse(t) : []; } catch { return []; }
}

async function settings() {
  const rows = await rest(`app_settings?select=data&id=eq.${SIGNIN_SETTINGS_ID}`);
  return normaliseSigninSettings(rows[0] && rows[0].data);
}
const codeOk = (s, code) => s.enabled && s.code && typeof code === "string" && code.length === s.code.length
  && [...code].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ s.code.charCodeAt(i)), 0) === 0;

const str = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
const rnd = n => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join("");

export async function handler(event) {
  if (!BASE() || !KEY()) return reply(503, { ok: false, error: BUSY });
  const method = event.httpMethod;
  try {
    if (method === "GET") {
      const code = String((event.queryStringParameters || {}).code || "").trim().toUpperCase();
      if (!CODE_RE.test(code)) return reply(200, { ok: false, notInUse: true });
      const s = await settings();
      if (!codeOk(s, code)) return reply(200, { ok: false, notInUse: true });
      return reply(200, { ok: true, site: s.site, intro: s.intro, items: s.items });
    }
    if (method !== "POST") return reply(405, { ok: false, error: "GET or POST only" });

    let b; try { b = JSON.parse(event.body || "{}"); } catch { return reply(400, { ok: false, error: "Bad request" }); }
    if (!b || typeof b !== "object") return reply(400, { ok: false, error: "Bad request" });
    const code = String(b.code || "").trim().toUpperCase();
    const s = CODE_RE.test(code) ? await settings() : null;
    if (!s || !codeOk(s, code)) return reply(200, { ok: false, notInUse: true });
    const now = ukNow();

    if (b.action === "signin") {
      const f = {
        companyName: str(b.company, 100), workerName: str(b.name, 80), phone: str(b.phone, 30),
        host: str(b.host, 80), purpose: str(b.purpose, 200), areas: str(b.areas, 120),
        permit: ["yes", "no", "unsure"].includes(b.permit) ? b.permit : "unsure", signature: str(b.signature, 80),
      };
      const missing = [["companyName", "your company"], ["workerName", "your name"], ["phone", "a phone number"], ["host", "who you're here to see"], ["purpose", "what you're here to do"], ["signature", "your name to sign"]]
        .filter(([k]) => !f[k]).map(([, l]) => l);
      if (missing.length) return reply(200, { ok: false, error: `Please fill in ${missing.join(", ")}.` });
      const answers = b.answers && typeof b.answers === "object" ? b.answers : {};
      if (s.items.some(i => answers[i.id] !== true)) return reply(200, { ok: false, error: "Please tick every line of the checklist." });

      const since = new Date(Date.now() - 10 * 60000).toISOString();
      const recent = await rest(`site_signins?select=id&created_at=gte.${encodeURIComponent(since)}&limit=61`);
      if (recent.length > 60) return reply(429, { ok: false, error: "Too many sign-ins just now. Please sign in at reception." });

      const contractors = (await rest("contractors?select=id,data")).map(r => ({ ...(r.data || {}), id: r.id }));
      const found = findCompany(contractors, f.companyName);
      const foundWorker = findWorker(found, f.workerName);
      // Keep the register up to date: add the company / worker if new, note today's sign-in.
      const rec = recordSignin({ company: found, worker: foundWorker, signin: f, date: now.date, similar: found ? [] : similarCompanies(contractors, f.companyName).map(c => c.id), rnd: rnd(5) });
      let company = rec.company, worker = rec.worker, registered = true;
      try {
        if (found) await rest(`contractors?id=eq.${encodeURIComponent(company.id)}`, { method: "PATCH", body: { data: company }, prefer: "return=minimal" });
        else await rest("contractors", { method: "POST", body: { id: company.id, data: company }, prefer: "return=minimal" });
      } catch (e) {
        // the register couldn't be updated (contractor_approval.sql not run yet): still sign them in
        console.error(`[zp-signin] register not updated: ${e.message}`);
        registered = false; company = found; worker = foundWorker;
      }
      let certs = {}, permits = [];
      const key = encodeURIComponent(`${company && company.id}_${worker && worker.id}`);
      const [cr, pr] = await Promise.all([
        foundWorker && worker ? rest(`contractor_certs?select=contractor_id,data&contractor_id=eq.${key}`) : [],
        f.permit === "no" ? [] : rest("permits?select=id,data&data->>status=in.(active,draft)").catch(() => []),
      ]);
      cr.forEach(r => { certs[r.contractor_id] = r.data; });
      permits = pr.map(r => ({ ...(r.data || {}), id: r.id }));
      const issues = signinIssues({ signin: f, company, worker, certs, permits, required: s.requiredDocs, today: now.date });
      const warnings = issues.map(i => i.text);
      const id = `qr_${Date.now().toString(36)}${rnd(4)}`, token = rnd(24);
      const data = {
        site: s.site, date: now.date, timeIn: now.time, timeOut: "", ...f,
        companyId: company ? company.id : "", workerId: worker ? worker.id : "",
        answers: Object.fromEntries(s.items.map(i => [i.id, true])), items: s.items.map(i => i.text),
        warnings, issues, newCompany: !found, newWorker: !foundWorker, reviewed: !!(found && foundWorker), ...(registered ? {} : { notRegistered: true }), token,
      };
      await rest("site_signins", { method: "POST", body: { id, data }, prefer: "return=minimal" });
      // Something for H&S to check: email them now (the 15-minute job would catch it too; each goes once).
      if (s.alertOnArrival && issues.some(i => i.kind !== "cert")) {
        try {
          const site = siteOf(event);
          await runEmailJob({ mode: "contractor", portalUrl: site.ours ? site.portalUrl : undefined, forceTest: !site.isLive });
        } catch (e) { console.error(`[zp-signin] arrival email: ${e.message}`); }
      }
      return reply(200, { ok: true, id, token, date: now.date, timeIn: now.time, seeReception: seeReception(issues) });
    }

    if (b.action === "signout") {
      let row = null;
      if (b.id && b.token) {
        const id = str(b.id, 40);
        const rows = await rest(`site_signins?select=id,data&id=eq.${encodeURIComponent(id)}`);
        row = rows.find(r => r.data && r.data.token && r.data.token === String(b.token)) || null;
      } else if (b.company && b.name) {
        const rows = await rest(`site_signins?select=id,data&data->>date=eq.${now.date}&order=created_at.desc&limit=500`);
        const c = normCompany(b.company), n = normPerson(b.name);
        row = rows.find(r => r.data && !r.data.timeOut && normCompany(r.data.companyName) === c && normPerson(r.data.workerName) === n) || null;
      }
      if (!row) return reply(200, { ok: false, error: "We couldn't find a sign-in for you today. Please sign out at reception." });
      if (row.data.timeOut) return reply(200, { ok: true, timeOut: row.data.timeOut, already: true });
      const data = { ...row.data, timeOut: now.time, signedOutBy: "QR code" };
      await rest(`site_signins?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", body: { data, updated_at: new Date().toISOString() }, prefer: "return=minimal" });
      return reply(200, { ok: true, timeOut: now.time });
    }
    return reply(400, { ok: false, error: "Bad request" });
  } catch {
    return reply(502, { ok: false, error: BUSY });
  }
}
