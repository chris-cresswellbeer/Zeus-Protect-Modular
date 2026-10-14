/**
 * PhoneCertificate — a certificate full screen on the phone (More → My certificates →
 * Show), to show an auditor. The same wording and look as the printed certificate
 * (lib/certificate.js), laid out upright for a phone, with a large QR code they can scan
 * to check it. Certificates stay in English.
 */
import React from "react";
import { certFacts, qrSvg, CERT_FONTS } from "../../lib/certificate";
import { loadCertSettings, ensureCertFonts } from "../../lib/certSettingsDb";

export default function PhoneCertificate({ cert, holder, jobTitle, onClose, font }) {
  const [settings, setSettings] = React.useState(null);
  React.useEffect(() => { ensureCertFonts(CERT_FONTS); let on = true; loadCertSettings().then(s => { if (on) setSettings(s); }); return () => { on = false; }; }, []);
  const f = certFacts({ cert: { module: cert.module || { title: cert.title }, score: cert.score, date: cert.completed, certId: cert.certId, moduleVersion: cert.moduleVersion },
    user: { name: holder, jobTitle }, settings: settings || {}, origin: window.location.origin });
  const navy = f.navy, accent = f.accent, grey = "#5b6478";
  const lab = { fontSize: 10.5, fontWeight: 700, letterSpacing: 1.3, color: grey };
  const val = { fontSize: 15.5, fontWeight: 700, color: navy, marginTop: 2 };
  const cell = (k, v, extra = {}) => <div style={{ padding: "10px 8px", textAlign: "center", ...extra }}><div style={lab}>{k}</div><div style={val}>{v}</div></div>;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Certificate: ${f.title}`} data-testid="phone-cert"
      onKeyDown={e => { if (e.key === "Escape") onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 9000, overflowY: "auto", background: "#ffffff", fontFamily: "'Barlow', sans-serif", color: "#1f2937", padding: 10, boxSizing: "border-box" }}>
      <div style={{ minHeight: "100%", boxSizing: "border-box", border: `3px solid ${navy}`, padding: 5, display: "flex" }}>
        <div style={{ flex: 1, border: `1.5px solid ${accent}`, padding: "18px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", opacity: settings ? 1 : 0, transition: "opacity .15s" }}>
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            {f.logo ? <img src={f.logo} alt={f.company} style={{ height: 34, maxWidth: "55%", objectFit: "contain" }}/> : <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, color: navy, textAlign: "left" }}>{f.company}</span>}
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: 2, color: navy }}>{String(f.product).toUpperCase()}</span>
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 18, height: 1.5, background: accent, flexShrink: 0 }}/>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2.5, color: navy, whiteSpace: "nowrap" }}>CERTIFICATE OF TRAINING</span>
            <span style={{ width: 18, height: 1.5, background: accent, flexShrink: 0 }}/>
          </div>
          <div style={{ marginTop: 18, fontSize: 12, letterSpacing: 1.3, color: grey }}>THIS CERTIFIES THAT</div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: f.holder.length > 22 ? 30 : 36, lineHeight: 1.08, color: navy, marginTop: 2 }}>{f.holder}</div>
          {f.jobTitle && <div style={{ fontSize: 13.5, color: grey }}>{f.jobTitle}</div>}
          <div style={{ marginTop: 12, fontSize: 12, letterSpacing: 1.3, color: grey }}>HAS SUCCESSFULLY COMPLETED</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: f.title.length > 40 ? 22 : 27, lineHeight: 1.12, color: navy, marginTop: 3 }}>{f.title}</div>
          {f.covered.length > 0 && <div style={{ marginTop: 5, fontSize: 13, color: "#374151", lineHeight: 1.45 }}>Covering: {f.covered.join(" · ")}</div>}

          <div style={{ marginTop: 16, width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #d6dbe6", borderBottom: "1px solid #d6dbe6" }}>
            {cell("COMPLETED", f.completed)}
            {cell("VALID UNTIL", f.validUntil || "No renewal required", { borderLeft: "1px solid #d6dbe6" })}
            {cell("SCORE", f.score != null ? <>{f.score}% <span style={{ fontSize: 12, fontWeight: 500, color: grey }}>(pass {f.passMark}%)</span></> : "Recorded", { borderTop: "1px solid #d6dbe6" })}
            {cell(f.version ? "MODULE VERSION" : "CERTIFICATE ID", f.version ? `v${f.version}` : (f.certId || "—"), { borderTop: "1px solid #d6dbe6", borderLeft: "1px solid #d6dbe6" })}
          </div>

          {f.verifyUrl && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: qrSvg(f.verifyUrl, { size: 150, colour: navy }) }}/>
              <div style={{ fontSize: 12.5, color: grey }}>Scan to check this certificate</div>
            </div>
          )}
          <div style={{ marginTop: 8, ...lab }}>CERTIFICATE ID</div>
          <div data-testid="phone-cert-id" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: 1.5, color: navy }}>{f.certId || "—"}</div>

          <div style={{ marginTop: "auto", paddingTop: 18, width: "100%", maxWidth: 280, textAlign: "left" }}>
            {f.signName && f.signImage && <img src={f.signImage} alt="Signature" style={{ height: 46, maxWidth: 220, objectFit: "contain", display: "block" }}/>}
            <div style={{ height: 1.5, background: navy, marginTop: 4 }}/>
            <div style={{ marginTop: 5, fontSize: 13.5, fontWeight: 700, color: navy }}>{f.signName || f.company}</div>
            <div style={{ fontSize: 12, color: grey }}>{f.signName ? f.signTitle : `Issued through ${f.product}`}</div>
          </div>
        </div>
      </div>
      <button type="button" onClick={onClose} ref={el => { if (el && !el.dataset.f) { el.dataset.f = "1"; el.focus({ preventScroll: true }); } }}
        style={{ display: "block", width: "100%", marginTop: 10, minHeight: 50, borderRadius: 12, border: "none", background: navy, color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: font }}>
        Close
      </button>
    </div>
  );
}
