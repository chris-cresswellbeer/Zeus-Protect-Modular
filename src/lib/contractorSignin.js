/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/contractorSignin.js — contractors signing themselves in at reception (QR code)
 * ═══════════════════════════════════════════════════════════════════════════
 * Shared by the phone page (shared/SignInPage.jsx), the server function
 * (netlify/functions/zp-signin.mjs) and the admin screens (Contractors, Site Settings).
 *
 * SETTINGS  app_settings row "contractor_signin"
 *   { enabled, code, site, intro, items:[{ id, text }], updatedAt,
 *     onsiteCheckTime "HH:MM" ("" = off): after this, anyone still signed in is listed in the
 *       bell and emailed to reception ("still on site: please check they've gone"),
 *     receptionEmails [address] (up to 10) for that email, besides staff with Reception access,
 *     alertOnArrival: email H&S (admins + extra admin emails) when an unapproved company or
 *       a missing permit signs in;  alertHost: also email the host, if they're a member of staff,
 *     requiredDocs [COMPANY_DOC_TYPES id]: what a company needs on file to be approved }
 *   The phone page is only ever sent site, intro and items.
 *   code = the secret in the reception QR code (<portal>/?signin=CODE); "Change code"
 *   in Site Settings makes a new one, and old posters stop working.
 *
 * A SIGN-IN  site_signins row { id, data, created_at }   (contractor_signin.sql)
 *   data { site, date, timeIn, timeOut, companyName, companyId, workerName, workerId,
 *          phone, host, purpose, areas, permit:"yes"|"no"|"unsure", answers:{ id:true },
 *          items:[text], signature, warnings:[text], newCompany, newWorker,
 *          reviewed, reviewedBy, reviewedAt, signedOutBy }
 *   companyId / workerId: the register entries (a company or worker not in the register is
 *   added by the sign-in: lib/contractorApproval.js recordSignin). issues: [{ text, level, kind }]
 *   from signinIssues at the time; the portal works them out again from the register now.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { DEFAULT_REQUIRED_DOCS, COMPANY_DOC_TYPES } from "../data/seedContractors.js";

export const SIGNIN_SETTINGS_ID = "contractor_signin";
export const CODE_RE = /^[A-Z0-9]{8,20}$/;

/** The starter checklist (Site Settings can change it). */
export const DEFAULT_SIGNIN_ITEMS = [
  { id: "rules",    text: "I have read the site rules and will follow them." },
  { id: "ppe",      text: "I am wearing the PPE my work needs, including hi-vis and safety footwear in the warehouse." },
  { id: "fire",     text: "I know where the fire assembly point is." },
  { id: "alarm",    text: "If the fire alarm sounds I will stop work, leave by the nearest exit, go to the assembly point and not go back in until told." },
  { id: "areas",    text: "I will stay in the areas I need for my work, and keep clear of forklift trucks and loading bays." },
  { id: "report",   text: "I will report any accident, near miss or hazard to my host straight away." },
  { id: "signout",  text: "I will sign out when I leave site." },
];
export const DEFAULT_SIGNIN_INTRO = "Welcome. Please read this and tick each line before you start work. Ask reception if anything isn't clear.";

export function defaultSigninSettings() {
  return { enabled: false, code: "", site: "", intro: DEFAULT_SIGNIN_INTRO, items: DEFAULT_SIGNIN_ITEMS.map(i => ({ ...i })),
    onsiteCheckTime: "17:00", receptionEmails: [], alertOnArrival: true, alertHost: true, requiredDocs: [...DEFAULT_REQUIRED_DOCS] };
}

/** A clean settings object from whatever is stored. */
export function normaliseSigninSettings(d) {
  const s = d && typeof d === "object" ? d : {};
  const items = (Array.isArray(s.items) ? s.items : DEFAULT_SIGNIN_ITEMS)
    .filter(i => i && /^[A-Za-z0-9_-]{1,40}$/.test(String(i.id || "")) && String(i.text || "").trim())
    .slice(0, 30).map(i => ({ id: String(i.id), text: String(i.text).trim().slice(0, 400) }));
  return {
    enabled: !!s.enabled,
    code: CODE_RE.test(String(s.code || "")) ? String(s.code) : "",
    site: String(s.site || "").trim().slice(0, 80),
    intro: String(s.intro == null ? DEFAULT_SIGNIN_INTRO : s.intro).slice(0, 1200),
    items,
    onsiteCheckTime: s.onsiteCheckTime == null ? "17:00" : /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.onsiteCheckTime)) ? String(s.onsiteCheckTime) : "",
    receptionEmails: [...new Set((Array.isArray(s.receptionEmails) ? s.receptionEmails : String(s.receptionEmails || "").split(/[\s,;]+/))
      .map(e => String(e || "").trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120))].slice(0, 10),
    alertOnArrival: s.alertOnArrival !== false,
    alertHost: s.alertHost !== false,
    requiredDocs: Array.isArray(s.requiredDocs) ? [...new Set(s.requiredDocs.filter(id => COMPANY_DOC_TYPES.some(t => t.id === id && id !== "other")))] : [...DEFAULT_REQUIRED_DOCS],
  };
}

/** A new random site code (no look-alike letters). */
export function newSigninCode(len = 10) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);   // browsers and Node 18+
  return Array.from(bytes, b => A[b % A.length]).join("");
}

/** The reception QR code's address. */
export const signinUrl = (origin, code) => `${String(origin || "").replace(/\/+$/, "")}/?signin=${encodeURIComponent(code)}`;

/** Names compared ignoring capitals, punctuation, extra spaces and Ltd / Limited / PLC / LLP. */
export function normCompany(s) {
  return String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(ltd|limited|plc|llp|uk|the|co|company)\b/g, " ").replace(/\s+/g, " ").trim();
}
export const normPerson = s => String(s || "").toLowerCase().replace(/[^a-z0-9 '-]+/g, " ").replace(/\s+/g, " ").trim();

export function findCompany(contractors, name) {
  const n = normCompany(name);
  if (!n) return null;
  return (contractors || []).find(c => normCompany(c && c.name) === n) || null;
}
export function findWorker(company, name) {
  const n = normPerson(name);
  if (!company || !n) return null;
  return (company.workers || []).find(w => normPerson(w && w.name) === n) || null;
}

/** Register entries whose names are close (for "is this the same company?"). */
export function similarCompanies(contractors, name, max = 3) {
  const n = normCompany(name);
  if (!n) return [];
  const words = n.split(" ").filter(w => w.length > 2);
  return (contractors || []).filter(c => {
    const m = normCompany(c.name);
    return m && m !== n && (m.includes(n) || n.includes(m) || words.some(w => m.split(" ").includes(w)));
  }).slice(0, max);
}

/** Reception access (Edit Staff → users.data.reception): the Reception page, sign people out. Admins always. */
export const hasReceptionAccess = user => !!user && (user.role === "admin" || user.reception === true) && user.status !== "leaver";

/** Is this sign-in still on site? (no time out, and today) */
export const signinOnSite = (s, today) => !!(s && s.data && s.data.date === today && !s.data.timeOut);

/** UK date and time now, as the portal uses them. */
export function ukNow(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}
