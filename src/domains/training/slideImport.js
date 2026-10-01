/**
 * slideImport.js — turn a PowerPoint deck into module slides (Create Module → Slides).
 *
 *   pdfToSlideImages(pdfFile)   The deck exported from PowerPoint as a PDF (File → Export
 *                               → PDF). Each page is drawn to a JPEG in the browser with
 *                               pdf.js, so the slide looks exactly as designed. The title
 *                               is guessed from the largest text near the top of the page.
 *   readPptx(pptxFile)          Optional: the original .pptx, read for what a PDF can't
 *                               carry — slide titles, SPEAKER NOTES and EMBEDDED VIDEOS.
 *                               A .pptx is a zip of XML files; nothing is sent anywhere.
 *   pairDeck(pages, pptx)       Lines the two up. PowerPoint leaves HIDDEN slides out of
 *                               the PDF, so hidden slides are skipped before pairing.
 *
 * Everything runs in the browser. pdf.js is loaded only when an import starts, so it
 * doesn't slow down the rest of the portal.
 */
import { unzipSync } from "fflate";

export const MAX_UPLOAD_MB = 50;               // Supabase free plan: largest file it accepts
const PAGE_WIDTH = 1600;                        // px — sharp on a laptop, ~200–400 KB per JPEG
const JPEG_QUALITY = 0.85;

// ── PDF → images ─────────────────────────────────────────────────────────────
let pdfjsPromise = null;
async function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = (async () => {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  })();
  return pdfjsPromise;
}

/** Largest text in the top 40% of the page, as a title guess ("" if none). */
function titleFromText(content, viewportHeight) {
  const items = (content.items || []).filter(it => it.str && it.str.trim() && Array.isArray(it.transform));
  if (!items.length) return "";
  const size = it => Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 0;
  const top = items.filter(it => it.transform[5] > viewportHeight * 0.6);   // PDF y runs bottom-up
  const pool = top.length ? top : items;
  const max = Math.max(...pool.map(size));
  if (!max) return "";
  const line = pool.filter(it => size(it) >= max * 0.9)
    .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  return line.map(it => it.str).join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * @returns Promise<[{ blob, width, height, title }]> one per page
 * onProgress(done, total)
 */
export async function pdfToSlideImages(pdfFile, onProgress) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await pdfFile.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const out = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = PAGE_WIDTH / base.width;
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);   // JPEG has no transparency
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("Couldn't create the slide picture.")), "image/jpeg", JPEG_QUALITY));
      let title = "";
      try { title = titleFromText(await page.getTextContent(), base.height); } catch { /* no text layer */ }
      out.push({ blob, width: canvas.width, height: canvas.height, title });
      page.cleanup();
      if (onProgress) onProgress(n, doc.numPages);
    }
  } finally {
    doc.destroy();
  }
  return out;
}

// ── .pptx → titles, speaker notes, videos ────────────────────────────────────
const VIDEO_TYPES = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", ogv: "video/ogg" };
const decode = u8 => new TextDecoder("utf-8").decode(u8);
const xml = s => new DOMParser().parseFromString(s, "application/xml");
const byLocal = (node, name) => Array.from(node.getElementsByTagNameNS("*", name));

// Resolve a relationship target ("../media/media1.mp4") against the folder of the part that refers to it.
function resolvePath(fromPart, target) {
  if (/^[a-z]+:/i.test(target)) return null;                      // external link, not in the file
  const parts = fromPart.split("/").slice(0, -1);
  for (const seg of target.split("/")) { if (seg === "..") parts.pop(); else if (seg && seg !== ".") parts.push(seg); }
  return parts.join("/");
}
function relsOf(files, part) {
  const relsPath = part.replace(/([^/]+)$/, "_rels/$1.rels");
  if (!files[relsPath]) return [];
  return byLocal(xml(decode(files[relsPath])), "Relationship").map(r => ({
    id: r.getAttribute("Id"), type: r.getAttribute("Type") || "", target: r.getAttribute("Target") || "",
    external: r.getAttribute("TargetMode") === "External",
  }));
}
// Paragraphs of text inside a shape (one string per <a:p>).
const paragraphs = sp => byLocal(sp, "p").filter(p => p.namespaceURI && /drawingml/.test(p.namespaceURI))
  .map(p => byLocal(p, "t").map(t => t.textContent).join("")).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
const phType = sp => { const ph = byLocal(sp, "ph")[0]; return ph ? (ph.getAttribute("type") || "body") : null; };

/**
 * @returns { slides: [{ title, notes:[paragraph], hidden, videos:[{ name, type, size, blob }] }], warnings:[] }
 * in presentation order (hidden slides included, flagged).
 */
export function readPptx(arrayBuffer) {
  let files;
  try { files = unzipSync(new Uint8Array(arrayBuffer)); }
  catch { throw new Error("That file isn't a PowerPoint (.pptx) file. Older .ppt files: open in PowerPoint and save as .pptx."); }
  if (!files["ppt/presentation.xml"]) throw new Error("That file isn't a PowerPoint (.pptx) file.");
  const pres = xml(decode(files["ppt/presentation.xml"]));
  const presRels = relsOf(files, "ppt/presentation.xml");
  const order = byLocal(pres, "sldId").map(s => {
    const rid = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || s.getAttribute("r:id");
    const rel = presRels.find(r => r.id === rid);
    return rel ? resolvePath("ppt/presentation.xml", rel.target) : null;
  }).filter(Boolean);
  const warnings = [];
  const slides = order.map(part => {
    const doc = xml(decode(files[part] || new Uint8Array()));
    const root = doc.documentElement;
    const hidden = root && root.getAttribute("show") === "0";
    const shapes = byLocal(doc, "sp");
    const titleShape = shapes.find(sp => ["title", "ctrTitle"].includes(phType(sp)));
    const title = titleShape ? paragraphs(titleShape).join(" ") : "";
    const rels = relsOf(files, part);
    // speaker notes: the notes page's body placeholder (not the slide image / number)
    let notes = [];
    const nRel = rels.find(r => /\/notesSlide$/.test(r.type));
    const nPart = nRel && resolvePath(part, nRel.target);
    if (nPart && files[nPart]) {
      const nd = xml(decode(files[nPart]));
      notes = byLocal(nd, "sp").filter(sp => phType(sp) === "body").flatMap(paragraphs);
    }
    // embedded videos (linked ones live elsewhere and can't be brought in)
    const videos = [];
    const seen = new Set();
    rels.filter(r => /\/(video|media)$/.test(r.type)).forEach(r => {
      if (r.external) { warnings.push(`A video on slide "${title || part}" is linked, not embedded, so it can't be brought in.`); return; }
      const p = resolvePath(part, r.target);
      if (!p || seen.has(p) || !files[p]) return;
      const ext = (p.split(".").pop() || "").toLowerCase();
      if (!VIDEO_TYPES[ext]) return;                            // e.g. audio or a format browsers can't play
      seen.add(p);
      const u8 = files[p];
      videos.push({ name: p.split("/").pop(), type: VIDEO_TYPES[ext], size: u8.length, blob: new Blob([u8], { type: VIDEO_TYPES[ext] }) });
    });
    return { title, notes, hidden, videos };
  });
  return { slides, warnings };
}

/**
 * Pair PDF pages with .pptx slides. Hidden slides are dropped from the .pptx list
 * first (PowerPoint doesn't export them). If the counts still differ, pages are
 * matched in order and a warning says so.
 */
export function pairDeck(pages, pptx) {
  const shown = pptx ? pptx.slides.filter(s => !s.hidden) : [];
  const warnings = pptx ? [...pptx.warnings] : [];
  if (pptx && shown.length !== pages.length)
    warnings.push(`The PDF has ${pages.length} page${pages.length !== 1 ? "s" : ""} but the PowerPoint has ${shown.length} visible slide${shown.length !== 1 ? "s" : ""}. Notes and videos were matched in order — check they're on the right slides.`);
  return {
    slides: pages.map((pg, i) => {
      const s = shown[i] || null;
      return { page: pg, title: (s && s.title) || pg.title || `Slide ${i + 1}`, notes: s ? s.notes : [], videos: s ? s.videos : [] };
    }),
    warnings,
  };
}

const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/** Speaker notes → slide text (HTML paragraphs, escaped). */
export const notesToHtml = notes => (notes || []).map(p => `<p>${esc(p)}</p>`).join("");
