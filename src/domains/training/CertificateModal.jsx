import React from "react";
import { certFacts, certificateHtml, CERT_W, CERT_H, CERT_FONTS } from "../../lib/certificate";
import { loadCertSettings, ensureCertFonts } from "../../lib/certSettingsDb";
import { escHtml } from "../../lib/brandCore";

/**
 * CertificateModal — the training certificate on screen, and printing it.
 * Opened by App.jsx whenever `cert` = { module, score, date, certId, moduleVersion } is
 * set: from My Training, History, and straight after passing in the module player.
 *
 * The certificate itself is lib/certificate.js (one HTML string, A4 landscape), shown
 * here scaled to fit the window. Printing writes the same HTML into a new window sized
 * to exactly one A4 landscape page and calls window.print() (the app-wide pattern:
 * the person picks a printer or "Save as PDF").
 * The signature, signatory and QR-code switch come from Site Settings → Certificates.
 *
 * Props: cert, user, onClose, T (theme tokens), font
 */
function CertificateModal({ cert, user, onClose, T, font }) {
  const [settings, setSettings] = React.useState(null);
  const [scale, setScale] = React.useState(0.5);
  const boxRef = React.useRef(null);
  const closeRef = React.useRef(null);

  React.useEffect(() => { ensureCertFonts(CERT_FONTS); let on = true; loadCertSettings().then(s => { if (on) setSettings(s); }); return () => { on = false; }; }, []);
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, (el.clientWidth || CERT_W) / CERT_W));
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(el); else window.addEventListener("resize", fit);
    return () => { if (ro) ro.disconnect(); else window.removeEventListener("resize", fit); };
  }, [cert]);
  const closeFn = React.useRef(onClose);
  closeFn.current = onClose;
  const open = !!cert;
  React.useEffect(() => {
    if (!open) return undefined;
    const k = e => { if (e.key === "Escape") closeFn.current(); };
    window.addEventListener("keydown", k);
    if (closeRef.current) closeRef.current.focus();
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  if (!cert) return null;
  const facts = certFacts({ cert, user, settings: settings || {}, origin: typeof window !== "undefined" ? window.location.origin : "" });
  const html = certificateHtml(facts);

  function printCert() {
    const win = window.open("", "_blank", "width=1180,height=860");
    if (!win) return;
    // The script comes before the fonts' stylesheet so a slow (or blocked) font download
    // can't hold it up: it waits for the fonts and pictures for at most 3 seconds.
    win.document.write(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<title>Certificate — ${escHtml(facts.title)} — ${escHtml(facts.holder)}</title>
<script>
  document.addEventListener("DOMContentLoaded", function () {
    var printed = false;
    function go() { if (printed) return; printed = true; setTimeout(function () { window.print(); }, 150); }
    Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready : 0,
      Promise.all(Array.prototype.map.call(document.images, function (i) { return i.complete ? 0 : new Promise(function (r) { i.onload = i.onerror = r; }); }))
    ]).then(go, go);
    setTimeout(go, 3000);
  });
<\/script>
<link rel="stylesheet" href="${CERT_FONTS}">
<style>
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  @media print { html, body { width: 297mm; height: 210mm; overflow: hidden; } }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
</style></head>
<body>${html}</body></html>`);
    win.document.close();
  }

  const btn = { borderRadius: 10, padding: "11px 24px", cursor: "pointer", fontFamily: font, fontWeight: 700, fontSize: 13, minHeight: 44 };
  return (
    <div role="dialog" aria-modal="true" aria-label={`Certificate: ${facts.title}`} data-testid="cert-modal"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, overflow: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%", maxWidth: 1000 }}>
        <div ref={boxRef} style={{ width: "100%" }}>
          <div style={{ width: CERT_W * scale, height: CERT_H * scale, margin: "0 auto", boxShadow: "0 30px 70px rgba(0,0,0,0.55)", overflow: "hidden", borderRadius: 4, background: "#fff" }}>
            <div data-testid="cert-sheet" style={{ width: CERT_W, height: CERT_H, transform: `scale(${scale})`, transformOrigin: "top left", opacity: settings ? 1 : 0, transition: "opacity .15s" }}
              dangerouslySetInnerHTML={{ __html: html }}/>
          </div>
        </div>

        {facts.expired && (
          <div role="status" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.45)", color: "#fecaca", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontFamily: font, fontWeight: 600 }}>
            This certificate ran out on {facts.validUntil}. Retake the module to get a new one.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" onClick={printCert} data-testid="cert-print"
            style={{ ...btn, background: `linear-gradient(135deg,${T.accent},${T.blue})`, color: "#fff", border: "none", boxShadow: "0 4px 14px rgba(37,99,235,0.4)" }}>
            🖨 Print / Save PDF
          </button>
          <button type="button" ref={closeRef} onClick={onClose}
            style={{ ...btn, background: T.headerBgMd, color: T.muted, border: `1px solid ${T.borderMd}` }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export { CertificateModal };
