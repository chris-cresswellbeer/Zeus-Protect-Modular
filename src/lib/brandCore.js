/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/brandCore.js — the portal's branding (names, logos, colours), no React
 * ═══════════════════════════════════════════════════════════════════════════
 * Kept in the database (app_settings row "brand"), so one copy of the code can
 * serve any company. Only a SUPER ADMIN can change it (Site Settings → Branding;
 * db_rules.sql / branding.sql enforce that in the database). It is readable before
 * anyone signs in (public.zp_brand()), for the sign-in screen.
 *
 * getBrand()   the current branding, every field filled in (neutral defaults if unset)
 * setBrand(d)  used by lib/brand.js after loading, and by the email job on Netlify
 *
 * Fields:
 *   product     portal name            "H&S Portal"   sign-in, headers, emails, reports
 *   company     company name in full   ""             certificates, reports, accident book
 *   short       short name             ""             tight spaces (certificate seal)
 *   certPrefix  certificate prefix     "HSP"          new certificate numbers only
 *   emailFrom   email sender name      ""             (address stays as set on Netlify)
 *   footer      printed-report footer  ""             falls back to the company name
 *   primary / accent  colours          ""             the default Navy theme (theme/tokens.js)
 *   logos.signin / logos.dark / logos.light   image links ("" = the portal name as text)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const NEUTRAL_BRAND = Object.freeze({
  product: "H&S Portal", company: "", short: "", certPrefix: "HSP", emailFrom: "", footer: "",
  primary: "", accent: "", logos: Object.freeze({ signin: "", dark: "", light: "" }),
});

const str = (v, max = 120) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const colour = v => (/^#[0-9a-f]{6}$/i.test(String(v || "").trim()) ? String(v).trim().toLowerCase() : "");
const link = v => { const s = str(v, 1000); return /^https:\/\//i.test(s) ? s : ""; };
export const cleanPrefix = v => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

/** A complete, safe branding object from whatever is stored (missing/odd values → defaults). */
export function normaliseBrand(d) {
  const x = d && typeof d === "object" ? d : {};
  const l = x.logos && typeof x.logos === "object" ? x.logos : {};
  return {
    product: str(x.product) || NEUTRAL_BRAND.product,
    company: str(x.company, 160),
    short: str(x.short, 30),
    certPrefix: cleanPrefix(x.certPrefix) || NEUTRAL_BRAND.certPrefix,
    emailFrom: str(x.emailFrom).replace(/[<>"]/g, ""),
    footer: str(x.footer, 200),
    primary: colour(x.primary),
    accent: colour(x.accent),
    logos: { signin: link(l.signin), dark: link(l.dark), light: link(l.light) },
    saved: !!d,
  };
}

let current = normaliseBrand(null);
const subs = new Set();

export const getBrand = () => current;
export function setBrand(d) { current = normaliseBrand(d); subs.forEach(f => f(current)); return current; }
export function onBrand(f) { subs.add(f); return () => subs.delete(f); }

/** Company name for reports and certificates (the portal name if no company is set). */
export const brandCompany = (b = current) => b.company || b.product;
/** Short name for tight spaces. */
export const brandShort = (b = current) => b.short || b.company || b.product;
/** Line used at the foot of printed / downloaded reports. */
export const brandFooter = (b = current) => b.footer || brandCompany(b);
/** "Acme Safety <alerts@acme.co.uk>": the brand's sender name with the address from EMAIL_FROM. */
export function brandSender(envFrom, b = current) {
  const env = String(envFrom || "").trim();
  if (!b.emailFrom) return env;
  const m = env.match(/<([^>]+)>/);
  const addr = m ? m[1] : env;
  return addr && /@/.test(addr) ? `"${b.emailFrom.replace(/["\\]/g, "")}" <${addr}>` : env;
}
/** A new certificate number: PREFIX-XXXXXXXX. */
export const certNumber = (tail, b = current) => `${b.certPrefix}-${String(tail).toUpperCase()}`;

/** A super admin: an active admin whose staff record has superAdmin: true (set only with super_admin.sql). */
export const isSuperAdmin = u => !!u && u.role === "admin" && u.superAdmin === true && (u.status || "active") !== "leaver";

/** For text placed inside HTML strings (printed reports, emails). */
export const escHtml = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Foot of printed reports: "<footer> · <portal name>", or just the portal name when no footer is set. */
export const brandFootLine = (b = current) => b.footer ? `${b.footer} · ${b.product}` : b.product;
/** Branding values ready for HTML strings. */
export const brandHtml = (b = current) => ({ product: escHtml(b.product), company: escHtml(brandCompany(b)), footer: escHtml(brandFooter(b)), short: escHtml(brandShort(b)), foot: escHtml(brandFootLine(b)) });

// Built-in training text says "{company}" where the company's name belongs; it is filled
// in from the branding when the module is shown. Cached, so each module object stays the
// same object while the name doesn't change (screens that watch the module list don't redraw).
const filled = new WeakMap();
export function withCompany(m) {
  if (!m || !Array.isArray(m.content)) return m;
  const name = current.short || current.company || "the company";   // no company set: "the company"
  const c = filled.get(m);
  if (c && c.name === name) return c.out;
  const has = m.content.some(s => s && typeof s.text === "string" && s.text.includes("{company}"));
  const out = has ? { ...m, content: m.content.map(s => s && typeof s.text === "string" && s.text.includes("{company}") ? { ...s, text: s.text.replace(/(^|[.!?:]\s+)\{company\}|\{company\}/g, (all, start) => start !== undefined ? start + name.charAt(0).toUpperCase() + name.slice(1) : name) } : s) } : m;
  filled.set(m, { name, out });
  return out;
}

/** Start of downloaded file names: "zeus-…" (short name) / "zeus-protect-…" (portal name). */
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
export const fileShort = (b = current) => slug(brandShort(b)) || "portal";
export const fileProduct = (b = current) => slug(b.product) || "portal";
