/**
 * lib/signinPoster.js — the A4 reception poster with the contractor sign-in QR code
 * (Site Settings → Contractor sign-in → Print poster). One HTML page, printed from a
 * new window like the certificates.
 */
import { qrSvg } from "./certificate";
import { getBrand, brandCompany, escHtml } from "./brandCore";
import { signinUrl } from "./contractorSignin";

export function signinPosterHtml({ code, site, origin, brand = getBrand() }) {
  const url = signinUrl(origin, code);
  const logo = brand.logos && (brand.logos.light || brand.logos.dark);
  const company = brandCompany(brand);
  const qr = qrSvg(url, { size: 430, label: "QR code: contractor sign-in" });
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<title>Contractor sign-in poster${site ? ` — ${escHtml(site)}` : ""}</title>
<script>
  document.addEventListener("DOMContentLoaded", function () {
    var printed = false;
    function go() { if (printed) return; printed = true; setTimeout(function () { window.print(); }, 150); }
    Promise.all(Array.prototype.map.call(document.images, function (i) { return i.complete ? 0 : new Promise(function (r) { i.onload = i.onerror = r; }); })).then(go, go);
    setTimeout(go, 3000);
  });
<\/script>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .page { width: 210mm; height: 297mm; padding: 16mm 16mm 12mm; display: flex; flex-direction: column; align-items: center; font-family: Arial, Helvetica, sans-serif; color: #0d1f5c; border-top: 10mm solid #0d1f5c; }
  .top { width: 100%; display: flex; justify-content: space-between; align-items: center; min-height: 14mm; }
  .top img { max-height: 14mm; max-width: 70mm; object-fit: contain; }
  .co { font-weight: 800; font-size: 18pt; }
  .site { font-size: 13pt; color: #5b6478; font-weight: 700; }
  h1 { font-size: 44pt; margin: 10mm 0 2mm; text-align: center; line-height: 1.05; letter-spacing: -0.5pt; }
  .sub { font-size: 17pt; margin: 0 0 8mm; text-align: center; color: #1f2937; }
  .qr { border: 2.5mm solid #0d1f5c; border-radius: 6mm; padding: 4mm; }
  .qr svg { display: block; width: 112mm; height: 112mm; }
  ol { font-size: 15pt; line-height: 1.45; margin: 9mm 0 0; padding-left: 9mm; width: 150mm; color: #1f2937; }
  ol li { margin-bottom: 2.5mm; }
  .foot { margin-top: auto; font-size: 10pt; color: #5b6478; text-align: center; line-height: 1.5; }
</style></head>
<body><div class="page">
  <div class="top">${logo ? `<img src="${escHtml(logo)}" alt="${escHtml(company)}">` : `<span class="co">${escHtml(company)}</span>`}<span class="site">${escHtml(site || "")}</span></div>
  <h1>Contractors:<br>sign in here</h1>
  <p class="sub">Scan with your phone camera. No app or account needed.</p>
  <div class="qr">${qr}</div>
  <ol>
    <li>Fill in your details and tick the site safety checklist.</li>
    <li>If your phone says so, see reception before you start work.</li>
    <li><b>When you leave, scan again and tap Sign out.</b></li>
  </ol>
  <div class="foot">No smartphone? Please sign in at reception.<br>${escHtml(url)}</div>
</div></body></html>`;
}
