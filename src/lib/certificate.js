/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/certificate.js — the training certificate (no React)
 * ═══════════════════════════════════════════════════════════════════════════
 * One A4-landscape certificate (1122 × 793 CSS px) built as an HTML string, so the
 * on-screen copy and the printed copy are exactly the same:
 *   CertificateModal (computer) shows it scaled to fit and prints it on one page;
 *   the phone's "My certificates" uses certFacts() for its full-screen version.
 *
 *   certSettings(d)          the "Certificates" settings (app_settings row "certificate")
 *   certFacts({...})         everything the certificate says, worked out once
 *   coveredTopics(module)    up to 4 short "what was covered" lines
 *   verifyLink(id, origin)   the address the QR code opens  (…/?verify=ID)
 *   qrSvg(text)              a QR code as an <svg> string
 *   certificateHtml(facts)   the certificate itself (all text escaped)
 *   CERT_FONTS               the Google Fonts link it uses
 *
 * Certificates stay in English (the module's English title and slides), whatever
 * language the course was taken in.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import qrcode from "qrcode-generator";
import { getBrand, brandCompany, escHtml } from "./brandCore";
import { getExpiryStatus } from "./dates";
import { passMarkOf } from "../domains/training/completion";

export const CERT_SETTINGS_ROW = "certificate";
export const CERT_W = 1122, CERT_H = 793;   // A4 landscape at 96 px per inch (297 × 210 mm), just under so it never spills onto a 2nd page
export const CERT_FONTS = "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&family=Cormorant+Garamond:wght@600;700&display=swap";
export const SIGN_MAX_BYTES = 150000;   // the signature picture, stored as a small PNG in the settings row

const txt = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** The certificate settings, every field filled in. */
export function certSettings(d) {
  const x = d && typeof d === "object" ? d : {};
  const img = String(x.signImage || "");
  return {
    signName: txt(x.signName, 80),
    signTitle: txt(x.signTitle, 100),
    signImage: /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(img) && img.length <= SIGN_MAX_BYTES * 1.4 ? img : "",
    showQR: x.showQR !== false,
    showCovered: x.showCovered !== false,
  };
}

/** "13 October 2026" from "2026-10-13" (or the text as it is if it isn't a date). */
export function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// Slide headings that say nothing about the content.
const FILLER = /^(intro(duction)?|welcome.*|overview|summary|recap|conclusion|key points|questions?|quiz|knowledge check|any questions\??|thank you.*|next steps|contents|agenda|objectives|learning objectives|before you start|getting started|well done.*|end)$/i;
const plain = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

/**
 * Up to 4 lines of "what was covered": the module's own certificate summary if it has
 * one (Create/Edit Module → "On the certificate"), otherwise its slide headings.
 */
export function coveredTopics(mod, max = 4) {
  if (!mod) return [];
  const own = Array.isArray(mod.certSummary) ? mod.certSummary : String(mod.certSummary || "").split(/\r?\n/);
  const pick = own.map(plain).filter(Boolean);
  const src = pick.length ? pick : (Array.isArray(mod.content) ? mod.content : []).map(s => plain(s && s.heading)).filter(h => h && !FILLER.test(h.replace(/[.:!]+$/, "")));
  const seen = new Set(), out = [];
  for (const h of src) {
    const k = h.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h.length > 60 ? h.slice(0, 57).trimEnd() + "…" : h);
    if (out.length >= max) break;
  }
  return out;
}

/** Where the QR code points: the portal's own address with ?verify=ID. */
export const verifyLink = (certId, origin) => `${String(origin || "").replace(/\/+$/, "")}/?verify=${encodeURIComponent(certId)}`;

/** A QR code as an <svg> string (crisp at any size; quiet zone included). */
export function qrSvg(text, { size = 74, colour = "#0d1f5c", label = "QR code to check this certificate" } = {}) {
  const q = qrcode(0, "M");
  q.addData(String(text));
  q.make();
  const n = q.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="${escHtml(label)}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#ffffff"/><path fill="${colour}" d="${d}"/></svg>`;
}

/**
 * Everything the certificate says.
 *   cert      { module, score, date, certId, moduleVersion }   (as CertificateModal gets it)
 *   user      the person (name, jobTitle)
 *   settings  certSettings(...)
 *   origin    the portal's address, for the QR code ("" = no QR code)
 */
export function certFacts({ cert, user, settings, origin = "", brand = getBrand() }) {
  const s = certSettings(settings);
  const mod = (cert && cert.module && (cert.module._en || cert.module)) || {};
  const months = Number(mod.renewalMonths) > 0 ? Number(mod.renewalMonths) : 0;
  const date = String((cert && cert.date) || "").slice(0, 10);
  const ex = months && date ? getExpiryStatus(date, months) : null;
  const certId = (cert && cert.certId) || "";
  const score = cert && cert.score != null && cert.score !== "" ? Number(cert.score) : null;
  return {
    holder: txt(user && user.name, 80),
    jobTitle: txt(user && user.jobTitle, 80),
    title: txt(mod.title, 120) || "Training module",
    category: txt(mod.category, 60),
    covered: s.showCovered ? coveredTopics(mod) : [],
    completed: longDate(date),
    completedISO: date,
    validUntil: ex ? longDate(ex.expiryDate) : "",
    validUntilISO: ex ? ex.expiryDate : "",
    expired: !!(ex && ex.status === "expired"),
    score,
    passMark: passMarkOf(mod),
    version: cert && Number(cert.moduleVersion) > 0 ? Number(cert.moduleVersion) : null,
    certId,
    verifyUrl: certId && origin && s.showQR ? verifyLink(certId, origin) : "",
    signName: s.signName, signTitle: s.signTitle, signImage: s.signImage,
    product: brand.product, company: brandCompany(brand), logo: (brand.logos && (brand.logos.light || brand.logos.dark)) || "",
    navy: brand.primary || "#0d1f5c", accent: brand.accent || "#f5a524",
  };
}

const seal = (product, navy, accent) => {
  const p = escHtml(String(product || "").toUpperCase());
  const fs = p.length > 16 ? 10 : p.length > 12 ? 11.5 : 13;
  return `<div style="width:112px;height:112px;border-radius:50%;background:${navy};border:4px solid ${accent};box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex-shrink:0">
<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><polyline points="8.5 12 11 14.5 15.5 10"/></svg>
<div style="font-family:'Barlow Condensed',sans-serif;font-size:${fs}px;font-weight:800;letter-spacing:1.2px;color:#ffffff;text-align:center;max-width:92px;line-height:1.1">${p}</div>
<div style="font-size:9px;font-weight:700;letter-spacing:2px;color:${accent}">VERIFIED</div></div>`;
};

/** The certificate (1122 × 793 px). Every piece of text is escaped. */
export function certificateHtml(f) {
  const e = escHtml, navy = f.navy, accent = f.accent, grey = "#5b6478", rule = "#d6dbe6";
  const cell = (label, value, first) => `<div style="padding:12px 8px;text-align:center;display:flex;flex-direction:column;gap:3px;${first ? "" : `border-left:1px solid ${rule};`}">
<div style="font-size:11.5px;font-weight:700;letter-spacing:1.5px;color:${grey}">${label}</div>
<div style="font-size:17px;font-weight:700;color:${navy}">${value}</div></div>`;
  const cells = [
    cell("COMPLETED", e(f.completed), true),
    cell("VALID UNTIL", f.validUntil ? e(f.validUntil) : `<span style="font-size:15px">No renewal required</span>`),
    cell("SCORE", f.score != null ? `${e(f.score)}% <span style="font-size:13px;font-weight:500;color:${grey}">(pass ${e(f.passMark)}%)</span>` : "Recorded"),
    ...(f.version ? [cell("MODULE VERSION", `v${e(f.version)}`)] : []),
  ];
  const logo = f.logo
    ? `<img src="${e(f.logo)}" alt="${e(f.company)}" style="height:52px;max-width:240px;object-fit:contain;display:block">`
    : `<div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:800;letter-spacing:1px;color:${navy}">${e(f.company)}</div>`;
  const sign = f.signName
    ? `${f.signImage ? `<img src="${e(f.signImage)}" alt="Signature" style="height:56px;max-width:240px;object-fit:contain;object-position:left bottom;display:block;margin-left:4px">` : `<div style="height:44px"></div>`}
<div style="margin-top:4px;height:1.5px;background:${navy}"></div>
<div style="margin-top:6px;font-size:14px;font-weight:700;color:${navy}">${e(f.signName)}</div>
${f.signTitle ? `<div style="font-size:12.5px;color:${grey}">${e(f.signTitle)}</div>` : ""}`
    : `<div style="height:44px"></div><div style="margin-top:4px;height:1.5px;background:${navy}"></div>
<div style="margin-top:6px;font-size:14px;font-weight:700;color:${navy}">${e(f.company)}</div>
<div style="font-size:12.5px;color:${grey}">Issued through ${e(f.product)}</div>`;
  const qr = f.verifyUrl ? qrSvg(f.verifyUrl, { size: 74, colour: navy }) : "";
  const nameSize = f.holder.length > 30 ? 48 : f.holder.length > 22 ? 56 : 64;
  const titleSize = f.title.length > 60 ? 30 : f.title.length > 40 ? 34 : 40;
  return `<div class="zp-cert" style="width:${CERT_W}px;height:${CERT_H}px;box-sizing:border-box;padding:26px;background:#ffffff;font-family:'Barlow',sans-serif;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact">
<div style="width:100%;height:100%;box-sizing:border-box;border:4px solid ${navy};padding:8px">
<div style="width:100%;height:100%;box-sizing:border-box;border:1.5px solid ${accent};padding:26px 56px 24px;display:flex;flex-direction:column;align-items:center">
<div style="width:100%;display:flex;justify-content:space-between;align-items:center;min-height:52px">
${logo}
<div style="text-align:right"><div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;letter-spacing:3px;color:${navy}">${e(String(f.product).toUpperCase())}</div>
<div style="font-size:12px;color:${grey};letter-spacing:.5px">Health &amp; Safety Training</div></div>
</div>
<div style="margin-top:14px;display:flex;align-items:center;gap:18px">
<div style="width:90px;height:1.5px;background:${accent}"></div>
<div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;letter-spacing:6px;color:${navy}">CERTIFICATE OF TRAINING</div>
<div style="width:90px;height:1.5px;background:${accent}"></div>
</div>
<div style="flex-grow:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:6px">
<div style="font-size:14px;letter-spacing:1.5px;color:${grey};text-transform:uppercase">This certifies that</div>
<div data-cert="holder" style="margin-top:2px;font-family:'Cormorant Garamond',Georgia,serif;font-size:${nameSize}px;font-weight:700;line-height:1.05;color:${navy};text-align:center">${e(f.holder)}</div>
${f.jobTitle ? `<div style="font-size:15px;color:${grey}">${e(f.jobTitle)}</div>` : ""}
<div style="margin-top:${f.covered.length ? 12 : 18}px;font-size:14px;letter-spacing:1.5px;color:${grey};text-transform:uppercase">has successfully completed</div>
<div data-cert="title" style="margin-top:4px;font-family:'Barlow Condensed',sans-serif;font-size:${titleSize}px;font-weight:800;letter-spacing:.5px;line-height:1.1;color:${navy};text-align:center;max-width:960px">${e(f.title)}</div>
${f.covered.length ? `<div data-cert="covered" style="margin-top:6px;font-size:14.5px;color:#374151;text-align:center;max-width:860px;line-height:1.5">Covering: ${f.covered.map(e).join(" · ")}</div>` : (f.category ? `<div style="margin-top:4px;font-size:14.5px;color:${grey}">${e(f.category)}</div>` : "")}
<div style="margin-top:${f.covered.length ? 22 : 26}px;display:grid;grid-template-columns:repeat(${cells.length},minmax(0,1fr));width:100%;max-width:${cells.length === 4 ? 860 : 700}px;border-top:1px solid ${rule};border-bottom:1px solid ${rule}">${cells.join("")}</div>
</div>
<div style="width:100%;display:flex;justify-content:space-between;align-items:flex-end">
<div style="width:270px;display:flex;flex-direction:column">${sign}</div>
${seal(f.product, navy, accent)}
<div style="width:270px;display:flex;justify-content:flex-end;align-items:flex-end;gap:12px">
<div style="text-align:right;display:flex;flex-direction:column;gap:2px">
<div style="font-size:11.5px;font-weight:700;letter-spacing:1.5px;color:${grey}">CERTIFICATE ID</div>
<div data-cert="id" style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;letter-spacing:1.5px;color:${navy}">${e(f.certId || "—")}</div>
${qr ? `<div style="font-size:12px;color:${grey}">Scan to check it</div>` : ""}
</div>${qr}
</div></div>
</div></div></div>`;
}
