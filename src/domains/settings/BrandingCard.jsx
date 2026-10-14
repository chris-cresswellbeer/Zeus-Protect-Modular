/**
 * BrandingCard — Site Settings → Branding. SUPER ADMINS ONLY (SiteSettingsTab doesn't
 * render it for anyone else, and the database refuses changes from anyone else —
 * db_rules.sql / branding.sql). Sets the names, logos, colours and certificate prefix
 * used everywhere in the portal (lib/brandCore.js, lib/brand.js).
 */
import React, { useState, useEffect } from "react";
import { notify } from "../../shared/Feedback";
import { useFormGuard } from "../../lib/unsaved";
import { auditEvent } from "../../lib/audit";
import { useBrand, loadBrand, saveBrand, uploadBrandLogo } from "../../lib/brand";
import { NEUTRAL_BRAND, normaliseBrand, cleanPrefix } from "../../lib/brandCore";

const DEFAULT_PRIMARY = "#0d1f5c", DEFAULT_ACCENT = "#f59e0b";
const LOGO_TYPES = "image/png,image/jpeg,image/svg+xml,image/webp";
const LOGO_MAX = 2 * 1024 * 1024;
const formOf = b => { const { saved, ...rest } = normaliseBrand(b); return { ...rest, logos: { ...rest.logos } }; }; // eslint-disable-line no-unused-vars

export function BrandingCard({ Z, font, embedded = false, onStatus }) {
  const live = useBrand();
  const [f, setF] = useState(() => formOf(live));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  // latest from the database — unless the person has already started typing
  useEffect(() => { const start = JSON.stringify(f); loadBrand().then(b => setF(cur => JSON.stringify(cur) === start ? formOf(b) : cur)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = JSON.stringify(f) !== JSON.stringify(formOf(live));
  const guard = useFormGuard({ key: "branding", label: "the branding", active: true, value: f, onRestore: v => setF(formOf(v)), changed });
  // Site Settings: unsaved-changes dot and the line under the section's title
  const statusLine = `${live.product}${live.company ? ` · ${live.company}` : ""} · certificates ${cleanPrefix(live.certPrefix) || NEUTRAL_BRAND.certPrefix}-…`;
  useEffect(() => { if (onStatus) onStatus({ dirty: changed, summary: statusLine }); }, [changed, statusLine]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const setLogo = (k, v) => setF(p => ({ ...p, logos: { ...p.logos, [k]: v } }));

  async function pickLogo(kind, file) {
    if (!file) return;
    if (!LOGO_TYPES.split(",").includes(file.type)) { notify("Please choose a PNG, JPG, SVG or WebP image.", { kind: "error" }); return; }
    if (file.size > LOGO_MAX) { notify("That image is over 2 MB. Please use a smaller logo file.", { kind: "error" }); return; }
    setUploading(kind);
    try { setLogo(kind, await uploadBrandLogo(kind, file)); }
    catch (e) { notify(`The logo couldn't be uploaded. ${e.message || e}`, { kind: "error" }); }
    finally { setUploading(""); }
  }

  async function save() {
    setBusy(true);
    const before = formOf(live);
    const err = await saveBrand(f);
    setBusy(false);
    if (err) { notify(`The branding couldn't be saved. ${err}`, { kind: "error" }); return; }
    const diff = {};
    ["product", "company", "short", "certPrefix", "emailFrom", "footer", "primary", "accent"].forEach(k => { if (before[k] !== f[k]) diff[k] = { from: before[k], to: f[k] }; });
    ["signin", "dark", "light"].forEach(k => { if (before.logos[k] !== f.logos[k]) diff[`logo_${k}`] = { from: before.logos[k] ? "set" : "none", to: f.logos[k] ? "new image" : "none" }; });
    auditEvent("settings", "brand", "update", "Branding saved (super admin)", diff, "Branding");
    guard.saved(); setF(formOf(f));
    notify("Branding saved. Everyone sees it the next time a page opens.");
  }

  const card = { background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.border}`, borderRadius: 14, padding: 16, marginBottom: 14 };
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: Z.muted, letterSpacing: 1, textTransform: "uppercase", margin: "12px 0 4px" };
  const inp = { width: "100%", boxSizing: "border-box", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "9px 13px", color: Z.white, fontSize: 13, outline: "none", fontFamily: font };
  const hint = { fontSize: 11.5, color: Z.muted, marginTop: 3, lineHeight: 1.45 };
  const btn = { background: Z.overlay, color: Z.white, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700 };
  const field = (k, label, help, extra = {}) => (
    <div>
      <label style={lbl} htmlFor={`brand-${k}`}>{label}</label>
      <input id={`brand-${k}`} data-testid={`brand-${k}`} value={f[k]} onChange={set(k)} style={{ ...inp, ...extra }} placeholder={extra.placeholder}/>
      {help && <div style={hint}>{help}</div>}
    </div>
  );
  const logoBox = (kind, title, note, bg) => (
    <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: Z.white }}>{title}</div>
      <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "center", background: bg, borderRadius: 8, padding: 6 }}>
        {f.logos[kind]
          ? <img src={f.logos[kind]} alt={title} style={{ maxHeight: 58, maxWidth: "100%", objectFit: "contain" }}/>
          : <span style={{ fontSize: 12, fontWeight: 800, color: bg === "#ffffff" ? "#0f172a" : "#ffffff" }}>{f.product || "No logo"}</span>}
      </div>
      <div style={{ fontSize: 11, color: Z.muted }}>{note}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <label style={{ ...btn, flex: 1, textAlign: "center", opacity: uploading ? .6 : 1 }}>
          {uploading === kind ? "Uploading…" : "Replace…"}
          <input type="file" accept={LOGO_TYPES} data-testid={`brand-logo-${kind}`} disabled={!!uploading} style={{ display: "none" }}
            onChange={e => { const file = e.target.files && e.target.files[0]; e.target.value = ""; pickLogo(kind, file); }}/>
        </label>
        <button type="button" style={{ ...btn, color: "#f87171" }} aria-label={`Remove the ${title} logo`} disabled={!f.logos[kind]} onClick={() => setLogo(kind, "")}>✕</button>
      </div>
    </div>
  );
  const swatch = (k, label, fallback) => (
    <div style={{ flex: 1, minWidth: 150 }}>
      <label style={lbl} htmlFor={`brand-${k}`}>{label}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" aria-label={`${label} picker`} value={/^#[0-9a-f]{6}$/i.test(f[k]) ? f[k] : fallback} onChange={set(k)}
          style={{ width: 42, height: 38, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}/>
        <input id={`brand-${k}`} data-testid={`brand-${k}`} value={f[k]} onChange={set(k)} placeholder={`${fallback} (default)`} style={{ ...inp, fontFamily: "monospace" }}/>
      </div>
    </div>
  );
  const primary = /^#[0-9a-f]{6}$/i.test(f.primary) ? f.primary : DEFAULT_PRIMARY;
  const accent = /^#[0-9a-f]{6}$/i.test(f.accent) ? f.accent : DEFAULT_ACCENT;
  const prefix = cleanPrefix(f.certPrefix) || NEUTRAL_BRAND.certPrefix;

  return (
    <section data-testid="branding-card" style={embedded ? {} : card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          {!embedded && <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: Z.white }}>🎨 Branding <span style={{ fontSize: 10.5, fontWeight: 800, color: Z.gold, border: `1px solid ${Z.gold}55`, borderRadius: 99, padding: "2px 8px", marginLeft: 6, verticalAlign: 2 }}>SUPER ADMIN</span></h3>}
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: Z.muted, lineHeight: 1.5, maxWidth: 640 }}>The names, logos and colours used everywhere in the portal: the sign-in screen, headers, certificates, reports, exports and emails. Only super admins see this card; every change is recorded in the Audit Trail.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} data-testid="brand-neutral" onClick={() => setF(formOf(null))} title="Clears every field (still needs saving)">↺ Neutral defaults</button>
          <button type="button" onClick={save} disabled={busy || !changed || !!uploading} data-testid="brand-save"
            style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontWeight: 800, fontFamily: font, fontSize: 13, cursor: busy || !changed ? "default" : "pointer", opacity: busy || !changed ? .6 : 1 }}>
            {busy ? "Saving…" : changed ? "Save branding" : "Saved"}
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18, marginTop: 6 }}>
        <div>
          {field("product", "Portal name", "Sign-in screen, page titles, the \"new version\" bar and emails.", { placeholder: NEUTRAL_BRAND.product })}
          {field("company", "Company name (in full)", "Certificates, compliance reports, the Accident Book and the monthly management report.")}
          {field("short", "Short name", "Where space is tight.")}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>{field("certPrefix", "Certificate number prefix", `New certificates: ${prefix}-…  Existing ones keep their number.`, { fontFamily: "monospace", placeholder: NEUTRAL_BRAND.certPrefix })}</div>
            <div style={{ flex: 1, minWidth: 140 }}>{field("emailFrom", "Emails come from", "The sender's name. The address stays as set on Netlify.")}</div>
          </div>
          {field("footer", "Footer on printed reports", "Leave empty to use the company name.")}
        </div>
        <div>
          <span style={lbl}>Logos</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            {logoBox("signin", "Sign-in screen", "Wide logo, PNG or SVG", "rgba(0,0,0,0.3)")}
            {logoBox("dark", "Header – dark themes", "Light-coloured artwork", "rgba(0,0,0,0.3)")}
            {logoBox("light", "Header – light themes", "Dark artwork; also used on certificates and printed reports", "#ffffff")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{swatch("primary", "Main colour", DEFAULT_PRIMARY)}{swatch("accent", "Accent colour", DEFAULT_ACCENT)}</div>
          <div style={hint}>Sets the default Navy theme's colours. The other 11 themes are unchanged. Leave empty for the original colours.</div>
          <span style={lbl}>Preview</span>
          <div data-testid="brand-preview" style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${Z.borderMd}` }}>
            <div style={{ background: primary, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{f.product || NEUTRAL_BRAND.product}</span>
              <span style={{ background: accent, color: "#111827", fontWeight: 800, fontSize: 11.5, borderRadius: 6, padding: "4px 10px" }}>Start →</span>
            </div>
            <div style={{ background: "#fff", color: "#0f172a", padding: "12px 14px", fontSize: 12.5, borderTop: `4px solid ${accent}` }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#64748b", fontWeight: 700 }}>CERTIFICATE OF COMPLETION</div>
              <div style={{ fontWeight: 800, fontSize: 14, margin: "3px 0" }}>Fire Safety Fundamentals</div>
              <div style={{ color: "#475569" }}>{f.company || f.product || NEUTRAL_BRAND.product} · No. {prefix}-0142FS</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
