/**
 * netlify/shared/rackingJob.mjs — red racking damage alerts.
 * Finds open RED damage reports not yet emailed (data.alertedAt empty), marks them (only if
 * nobody changed them in the meantime) and emails the racking inspectors (anyone with
 * Machinery & Equipment access) and the admins (+ Site Settings → Email reminders → extra
 * admin addresses). Run by zp-racking straight after a red report, and by the 2-minute
 * zp-lone-run job as a back-up. Each alert goes once (idempotency keys).
 */
import { cfg, setupProblems, loadSettings, sendUrgent } from "./emailJob.mjs";
import { renderEmail } from "../../src/lib/emailTemplates.js";
import { getBrand } from "../../src/lib/brandCore.js";
import { rackingAlertText, bayName } from "../../src/lib/racking.js";

const FETCH_MS = 8000;
async function rest(c, path, { method = "GET", body, prefer } = {}) {
  const headers = { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${c.base}/rest/v1/${path}`, { method, headers, signal: AbortSignal.timeout(FETCH_MS), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { /* */ }
  if (!r.ok) { const e = new Error(`${path.split("?")[0]}: ${(j && (j.message || j.msg)) || `HTTP ${r.status}`}`); e.status = r.status; throw e; }
  return j;
}
const norm = s => String(s || "").toLowerCase().trim();
const ukTime = iso => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(iso)).replace(",", "");

/** → { ok, alerted, emailed, failed, message } */
export async function runRackingJob({ now = new Date(), portalUrl, forceTest = false } = {}) {
  const c = cfg({ forceTest });
  if (!c.base || !c.key) return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY isn't set." };
  let rows;
  try { rows = await rest(c, "racking_damage?select=*&status=eq.open&rating=eq.red&limit=200"); }
  catch (e) { if (e.status === 404) return { ok: true, alerted: 0, emailed: 0, message: "No racking tables yet." }; throw e; }
  const due = rows.filter(r => !(r.data || {}).alertedAt);
  if (!due.length) return { ok: true, alerted: 0, emailed: 0 };

  const emailSet = await loadSettings(c).catch(() => ({ extraAdminEmails: [] }));   // also loads the branding
  const users = (await rest(c, "users?select=id,data")).map(u => ({ ...(u.data || {}), id: String(u.id) })).filter(u => (u.status || "active") !== "leaver");
  const to = users.filter(u => u.email && (u.role === "admin" || u.machineryAccess === true)).map(u => ({ to: u.email, name: u.name, user_id: u.id }))
    .concat((emailSet.extraAdminEmails || []).map(e => ({ to: e, name: "", user_id: null })))
    .filter((x, i, a) => a.findIndex(y => norm(y.to) === norm(x.to)) === i);
  const base = String(portalUrl || c.portalUrl || "").replace(/\/+$/, "");
  const problems = setupProblems(c);
  const nowIso = now.toISOString();
  let alerted = 0, emailed = 0, failed = 0;
  const notes = [];

  for (const r of due) {
    const data = { ...(r.data || {}), alertedAt: nowIso };
    const upd = await rest(c, `racking_damage?id=eq.${encodeURIComponent(r.id)}&updated_at=eq.${encodeURIComponent(r.updated_at)}`,
      { method: "PATCH", body: { data, updated_at: nowIso }, prefer: "return=representation" });
    if (!Array.isArray(upd) || !upd.length) continue;   // changed at the same moment: the next run picks it up
    alerted++;
    if (!to.length) { notes.push("nobody to email (no admins or racking inspectors with an email address)"); continue; }
    if (problems.length) { notes.push(problems.join(" ")); failed += to.length; continue; }
    const loc = (await rest(c, `racking_locations?select=*&id=eq.${encodeURIComponent(r.location_id)}`).catch(() => []))[0] || null;
    const t = rackingAlertText(r, loc);
    const d = r.data || {};
    const items = [
      { text: loc ? bayName(loc) : r.location_id, sub: t.detail || undefined, flag: true },
      { text: `Reported by ${d.reportedBy || "?"}`, sub: `${ukTime(d.reportedAt || r.created_at)}${(d.photos || []).length ? ` · ${(d.photos || []).length} photo${(d.photos || []).length === 1 ? "" : "s"} in the portal` : ""}` },
    ];
    const list = to.map(x => {
      const { html, text } = renderEmail({ preheader: t.subject, greeting: x.name ? `Hi ${String(x.name).split(/\s+/)[0]},` : "Hello,", intro: t.lead,
        sections: [{ title: "Racking damage", items }],
        note: "Make sure the bay is offloaded and kept clear, then open the portal to confirm the rating, mark it offloaded and book the repair. The bay shows RED – DO NOT USE to anyone who scans it until a repair is recorded.",
        button: base ? { label: "Open this bay", href: `${base}/?rack=${encodeURIComponent(r.location_id)}` } : null,
        banner: `${getBrand().product} racking alert` });
      return { to: x.to, name: x.name, user_id: x.user_id, subject: t.subject, html, text, keys: [`rack:${r.id}:${nowIso.slice(0, 16)}:${x.to}`] };
    });
    const res = await sendUrgent(c, list);
    res.forEach(x => { if (x.ok) emailed++; else { failed++; notes.push(x.error || "not sent"); } });
  }
  return { ok: failed === 0, alerted, emailed, failed, message: notes.join(" ") };
}
