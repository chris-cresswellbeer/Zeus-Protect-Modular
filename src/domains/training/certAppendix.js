/**
 * certAppendix.js — copies of a person's certificates, appended to their Compliance
 * Report (generateStaffPDF.js) so the PDF is complete evidence on its own.
 *
 * Included:
 *   • External certificates with a file (First Aid, Fire Warden — data/seedExtCerts.js)
 *   • Machinery competence evidence (licences / certificates on each record,
 *     e.g. forklift training — machinery/machineEvidence.js)
 *
 * Each file is fetched (private files through a short-lived signed link) and turned into
 * page pictures: photos as they are, PDFs page by page (pdf.js, loaded only when needed).
 * Files that can't be shown as pictures (e.g. Word) are listed with a note instead.
 */
import { EXT_CERT_TYPES } from "../../data/seedExtCerts";
import { MACHINERY_TYPES, machineState, compsFor } from "../../data/seedMachinery";
import { evidenceFiles } from "../machinery/machineEvidence";
import { signedUrl } from "../../lib/fileAccess";

export const MAX_PDF_PAGES = 6;          // per file — a certificate is rarely longer
const MAX_WIDTH = 1500;                  // px, enough for a sharp A4 print

const ukDate = v => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? String(v).slice(0, 10).split("-").reverse().join("/") : v || "");

/** The certificate files on a person's record, in report order. */
export function collectCertFiles(u, extCerts = {}, machineComps = {}, machineTypes = MACHINERY_TYPES) {
  const out = [];
  const mine = extCerts[u.id] || extCerts[String(u.id)] || {};
  for (const ct of EXT_CERT_TYPES) {
    const c = mine[ct.id];
    if (!c || !c.fileUrl) continue;
    out.push({ key: `ext_${ct.id}`, title: `${ct.label} certificate`, icon: ct.icon,
      detail: [c.issuedDate && `Issued ${ukDate(c.issuedDate)}`, c.expiryDate && `expires ${ukDate(c.expiryDate)}`].filter(Boolean).join(", "),
      name: c.fileName || "certificate", href: c.fileUrl });
  }
  for (const mc of compsFor(machineComps, u.id)) {
    const t = machineTypes.find(x => x.id === mc.machineId) || { label: mc.machineId, icon: "🔧" };
    const st = machineState(mc, machineTypes);
    evidenceFiles(mc).filter(f => f.href).forEach((f, i) => out.push({
      key: `mc_${mc.id}_${i}`, title: `${t.label} — ${mc.licenceRef ? `licence ${mc.licenceRef}` : "competence evidence"}`, icon: t.icon || "🔧",
      detail: [mc.assessmentDate && `Assessed ${ukDate(mc.assessmentDate)}`, st && st.ex && `renew by ${ukDate(st.ex.expiryDate)}`, mc.trainerName && `assessor ${mc.trainerName}`].filter(Boolean).join(", "),
      name: f.name, href: f.href,
    }));
  }
  return out;
}

const isPdf = (type, name) => /pdf/i.test(type || "") || /\.pdf$/i.test(name || "");
const isImage = (type, name) => /^image\//i.test(type || "") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(name || "");

const blobToDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

/** A photo, scaled down to MAX_WIDTH and turned upright via the browser, as a JPEG data URL. */
async function imageToDataUrl(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("not a picture")); i.src = url; });
    const scale = Math.min(1, MAX_WIDTH / (img.naturalWidth || MAX_WIDTH));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

/**
 * Fetch and render every file. Resolves to the same list with
 *   pages: [dataUrl…]  (pictures to print), and/or
 *   note:  "why it isn't shown" (can't open / not a picture or PDF / more pages)
 * onProgress(done, total) after each file.
 */
export async function renderCertFiles(files, onProgress) {
  const out = [];
  let done = 0;
  for (const f of files) {
    const item = { ...f, pages: [], note: "" };
    try {
      const href = await signedUrl(f.href);
      const resp = await fetch(href);
      if (!resp.ok) throw new Error(`the file couldn't be downloaded (${resp.status})`);
      const blob = await resp.blob();
      const type = blob.type || "";
      if (isImage(type, f.name)) {
        item.pages.push(await imageToDataUrl(blob));
      } else if (isPdf(type, f.name)) {
        const { pdfToSlideImages } = await import("./slideImport");     // pdf.js, only loaded when needed
        const pages = await pdfToSlideImages(blob);
        for (const p of pages.slice(0, MAX_PDF_PAGES)) item.pages.push(await blobToDataUrl(p.blob));
        if (pages.length > MAX_PDF_PAGES) item.note = `The first ${MAX_PDF_PAGES} of ${pages.length} pages are shown. The full file is in the portal.`;
      } else {
        item.note = "This file type can't be shown in the report (only PDFs and photos can). It is kept in the portal.";
      }
    } catch (e) {
      item.note = `Not included: ${e && e.message ? e.message : "the file couldn't be opened"}. It is kept in the portal.`;
    }
    out.push(item);
    done++; if (onProgress) onProgress(done, files.length);
  }
  return out;
}

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The appendix pages as HTML (empty string when there are no files). */
export function appendixHtml(rendered, personName) {
  if (!rendered.length) return "";
  return rendered.map((f, i) => {
    const head = `<div class="apx-head"><div class="apx-label">Appendix ${i + 1}</div><h2 style="margin:4px 0 2px">${f.icon || ""} ${esc(f.title)}</h2>
      <div class="apx-sub">${esc(personName)} · ${esc(f.name)}${f.detail ? ` · ${esc(f.detail)}` : ""}</div></div>`;
    const note = f.note ? `<div class="no-data" style="margin-top:8px">${esc(f.note)}</div>` : "";
    if (!f.pages.length) return `<section class="apx apx-note">${head}${note}</section>`;   // nothing to show: no page of its own
    return f.pages.map((src, p) => `<section class="apx">${p === 0 ? head : `<div class="apx-sub">Appendix ${i + 1} — ${esc(f.title)} (page ${p + 1})</div>`}
      <img class="apx-img" src="${src}" alt="${esc(f.title)}${f.pages.length > 1 ? `, page ${p + 1}` : ""}">${p === f.pages.length - 1 ? note : ""}</section>`).join("");
  }).join("");
}
