/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/contractorSignin.js — contractors signing themselves in at reception (QR code)
 * ═══════════════════════════════════════════════════════════════════════════
 * Shared by the phone page (shared/SignInPage.jsx), the server function
 * (netlify/functions/zp-signin.mjs) and the admin screens (Contractors, Site Settings).
 *
 * SETTINGS  app_settings row "contractor_signin"
 *   { enabled, code, site, intro, items:[{ id, text }], updatedAt }
 *   code = the secret in the reception QR code (<portal>/?signin=CODE); "Change code"
 *   in Site Settings makes a new one, and old posters stop working.
 *
 * A SIGN-IN  site_signins row { id, data, created_at }   (contractor_signin.sql)
 *   data { site, date, timeIn, timeOut, companyName, companyId, workerName, workerId,
 *          phone, host, purpose, areas, permit:"yes"|"no"|"unsure", answers:{ id:true },
 *          items:[text], signature, warnings:[text], newCompany, newWorker,
 *          reviewed, reviewedBy, reviewedAt, signedOutBy }
 *   companyId / workerId are filled in when the names match the Contractor Register
 *   (or later, when an admin links them). Nothing in the register is changed by a sign-in.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { INDUCTION_ITEMS, CONTRACTOR_CERT_TYPES } from "../data/seedContractors.js";

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
  return { enabled: false, code: "", site: "", intro: DEFAULT_SIGNIN_INTRO, items: DEFAULT_SIGNIN_ITEMS.map(i => ({ ...i })) };
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

/**
 * What reception should check, from the register. today = "YYYY-MM-DD".
 * inductions / certs = the stored maps keyed "<companyId>_<workerId>".
 */
export function signinWarnings({ company, worker, inductions, certs, today }) {
  const w = [];
  if (!company) { w.push("New company: not in the Contractor Register"); return w; }
  if (company.status === "banned") w.push("Company is marked Banned in the Contractor Register");
  else if (company.status === "inactive") w.push("Company is marked Inactive in the Contractor Register");
  if (!worker) { w.push("New worker: no site induction or certificates on record"); return w; }
  const key = `${company.id}_${worker.id}`;
  const ind = (inductions && inductions[key]) || {};
  const done = INDUCTION_ITEMS.filter(i => ind[i.id] && ind[i.id].done).length;
  if (done < INDUCTION_ITEMS.length) w.push(`Site induction not complete (${done} of ${INDUCTION_ITEMS.length})`);
  const c = (certs && certs[key]) || {};
  Object.keys(c).forEach(k => {
    const e = c[k] && c[k].expiryDate;
    if (e && e < today) {
      const t = CONTRACTOR_CERT_TYPES.find(x => x.id === k);
      w.push(`${t ? t.label : "Certificate"} expired ${e.split("-").reverse().join("/")}`);
    }
  });
  return w;
}

/** Is this sign-in still on site? (no time out, and today) */
export const signinOnSite = (s, today) => !!(s && s.data && s.data.date === today && !s.data.timeOut);

/** UK date and time now, as the portal uses them. */
export function ukNow(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}
