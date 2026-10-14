/**
 * CertificateSettings — Site Settings → 🏅 Certificates (admins).
 * Who signs the training certificates, their signature, and two switches:
 * "what was covered" and the QR code that checks a certificate (lib/certificate.js).
 * Stored in app_settings row "certificate" (lib/certSettingsDb.js). The signature
 * picture is shrunk to a small PNG in the browser (white paper made see-through) and
 * kept inside that row, so it's only readable by people signed in to the portal.
 */
import React, { useState, useEffect } from "react";
import { notify } from "../../shared/Feedback";
import { useFormGuard } from "../../lib/unsaved";
import { auditEvent } from "../../lib/audit";
import { certSettings, certFacts, certificateHtml, CERT_W, CERT_H, CERT_FONTS, SIGN_MAX_BYTES } from "../../lib/certificate";
import { loadCertSettings, saveCertSettings, ensureCertFonts } from "../../lib/certSettingsDb";

const SIGN_TYPES = "image/png,image/jpeg,image/webp";
const SAMPLE_MODULE = { title: "Manual Handling", category: "Manual handling", renewalMonths: 36, passMark: 70,
  content: [{ heading: "Introduction" }, { heading: "Assessing the load" }, { heading: "Lifting technique" }, { heading: "Team lifts and aids" }, { heading: "Reporting problems" }] };

/** A photo or scan of a signature → a small PNG with the paper made see-through. */
export function signatureToPng(file, { maxW = 600, maxH = 200 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h), p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const light = (p[i] + p[i + 1] + p[i + 2]) / 3;
          if (light > 215) p[i + 3] = 0;                                         // paper → see-through
          else if (light > 160) p[i + 3] = Math.round(p[i + 3] * (215 - light) / 55);   // soft edge
        }
        g.putImageData(d, 0, 0);
        resolve(c.toDataURL("image/png"));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file couldn't be read as a picture.")); };
    img.src = url;
  });
}

export function CertificateSettings({ Z, font, user }) {
  const [f, setF] = useState(() => certSettings(null));
  const [saved, setSaved] = useState(f);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => { ensureCertFonts(CERT_FONTS); loadCertSettings({ fresh: true }).then(s => { setF(s); setSaved(s); setLoaded(true); }); }, []);
  const changed = loaded && JSON.stringify(f) !== JSON.stringify(saved);
  const guard = useFormGuard({ key: "cert-settings", label: "the certificate settings", active: loaded, value: f, onRestore: v => setF(certSettings(v)), changed });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  async function pickSignature(file) {
    if (!file) return;
    if (!SIGN_TYPES.split(",").includes(file.type)) { notify("Please choose a PNG, JPG or WebP picture of the signature.", { kind: "error" }); return; }
    try {
      const png = await signatureToPng(file);
      if (png.length > SIGN_MAX_BYTES * 1.33) { notify("That signature picture is too detailed. Crop it close around the signature and try again.", { kind: "error" }); return; }
      set("signImage", png);
    } catch (e) { notify(`The signature couldn't be used. ${e.message || e}`, { kind: "error" }); }
  }

  async function save() {
    if (f.signImage && !f.signName.trim()) { notify("Add the name of the person who signs, to go under the signature.", { kind: "error" }); return; }
    setBusy(true);
    try {
      const clean = await saveCertSettings(f);
      const diff = {};
      ["signName", "signTitle", "showQR", "showCovered"].forEach(k => { if (saved[k] !== clean[k]) diff[k] = { from: saved[k], to: clean[k] }; });
      if (saved.signImage !== clean.signImage) diff.signature = { from: saved.signImage ? "set" : "none", to: clean.signImage ? "new picture" : "none" };
      auditEvent("settings", "certificate", "update", "Certificate settings saved", diff, "Certificates");
      setF(clean); setSaved(clean); guard.saved();
      notify("Certificate settings saved. Certificates show the change the next time they're opened.");
    } catch (e) { notify(`The certificate settings couldn't be saved. ${e.message || e}`, { kind: "error" }); }
    setBusy(false);
  }

  const card = { background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.border}`, borderRadius: 14, padding: 16, marginTop: 14 };
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: Z.muted, letterSpacing: 1, textTransform: "uppercase", margin: "12px 0 4px" };
  const inp = { width: "100%", boxSizing: "border-box", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "9px 13px", color: Z.white, fontSize: 13, outline: "none", fontFamily: font };
  const hint = { fontSize: 11.5, color: Z.muted, marginTop: 3, lineHeight: 1.45 };
  const btn = { background: Z.overlay, color: Z.white, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, minHeight: 34 };
  const tick = (k, label, help) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12, cursor: "pointer" }}>
      <input type="checkbox" checked={!!f[k]} onChange={e => set(k, e.target.checked)} data-testid={`cert-${k}`} style={{ width: 18, height: 18, marginTop: 1, accentColor: Z.accent }}/>
      <span><span style={{ fontSize: 13, fontWeight: 700, color: Z.white }}>{label}</span><span style={{ ...hint, display: "block" }}>{help}</span></span>
    </label>
  );
  const sample = certFacts({ cert: { module: SAMPLE_MODULE, score: 90, date: new Date().toISOString().slice(0, 10), certId: "SAMPLE-0001", moduleVersion: 2 },
    user: { name: (user && user.name) || "Sample Person", jobTitle: (user && user.jobTitle) || "" }, settings: f, origin: typeof window !== "undefined" ? window.location.origin : "" });
  const S = 0.5;

  return (
    <section data-testid="cert-settings" style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: Z.white }}>🏅 Certificates</h3>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: Z.muted, lineHeight: 1.5, maxWidth: 640 }}>Who signs the training certificates, and what they show. Applies to every certificate, including ones already issued, the next time it's opened or printed.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => setPreview(p => !p)} aria-expanded={preview} data-testid="cert-preview-btn">{preview ? "Hide preview" : "Preview"}</button>
          <button type="button" onClick={save} disabled={busy || !changed} data-testid="cert-save"
            style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontWeight: 800, fontFamily: font, fontSize: 13, cursor: busy || !changed ? "default" : "pointer", opacity: busy || !changed ? .6 : 1 }}>
            {busy ? "Saving…" : changed ? "Save certificate settings" : "Saved"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, marginTop: 4 }}>
        <div>
          <label style={lbl} htmlFor="cert-signName">Signed by</label>
          <input id="cert-signName" data-testid="cert-signName" value={f.signName} maxLength={80} onChange={e => set("signName", e.target.value)} placeholder="e.g. the H&S or Quality manager's full name" style={inp}/>
          <label style={lbl} htmlFor="cert-signTitle">Their job title</label>
          <input id="cert-signTitle" data-testid="cert-signTitle" value={f.signTitle} maxLength={100} onChange={e => set("signTitle", e.target.value)} placeholder="e.g. Quality & Compliance Manager" style={inp}/>
          <div style={hint}>Leave "Signed by" empty and certificates show the company name instead, with a blank line that can be signed by hand.</div>
          {tick("showCovered", "Show what the module covered", "A \"Covering: …\" line under the module name. Taken from the module's \"On the certificate\" lines, or its slide headings.")}
          {tick("showQR", "Show a QR code to check the certificate", "Anyone can scan it to see that the certificate is genuine and whether it's still in date (name shortened, nothing else about the person).")}
        </div>
        <div>
          <span style={lbl}>Signature</span>
          <div style={{ background: "#ffffff", borderRadius: 10, height: 96, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
            {f.signImage
              ? <img src={f.signImage} alt="Signature" data-testid="cert-sign-img" style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }}/>
              : <span style={{ fontSize: 12.5, color: "#5b6478" }}>No signature yet</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <label style={{ ...btn, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {f.signImage ? "Replace…" : "Add signature…"}
              <input type="file" accept={SIGN_TYPES} data-testid="cert-sign-file" style={{ display: "none" }}
                onChange={e => { const file = e.target.files && e.target.files[0]; e.target.value = ""; pickSignature(file); }}/>
            </label>
            <button type="button" style={{ ...btn, color: "#f87171" }} disabled={!f.signImage} onClick={() => set("signImage", "")} aria-label="Remove the signature">✕ Remove</button>
          </div>
          <div style={hint}>Sign a sheet of white paper in dark ink and take a photo, or use a scan. Crop it close around the signature. The white paper is removed automatically.</div>
        </div>
      </div>

      {preview && (
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <div style={{ width: CERT_W * S, height: CERT_H * S, borderRadius: 4, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.35)", background: "#fff" }}>
            <div data-testid="cert-preview" style={{ width: CERT_W, height: CERT_H, transform: `scale(${S})`, transformOrigin: "top left" }} dangerouslySetInnerHTML={{ __html: certificateHtml(sample) }}/>
          </div>
          <div style={hint}>A sample certificate with these settings (not yet saved). The QR code on a real certificate checks that certificate.</div>
        </div>
      )}
    </section>
  );
}
