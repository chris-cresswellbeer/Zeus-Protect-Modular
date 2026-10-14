/**
 * VerifyPage — "Is this certificate genuine?"  <portal>/?verify=ZSL-XXXXXXXX
 * Opened by the QR code on a training certificate (lib/certificate.js). No sign-in:
 * main.jsx shows this page instead of the portal when the address has ?verify=.
 * The answer comes from netlify/functions/zp-verify.mjs, which says only what's printed
 * on the certificate (surname shortened to an initial).
 */
import React from "react";
import { useBrand } from "../lib/brand";
import { brandCompany } from "../lib/brandCore";
import { longDate, CERT_FONTS } from "../lib/certificate";
import { ensureCertFonts } from "../lib/certSettingsDb";

const NAVY = "#0d1f5c";
const STATUS = {
  valid: ["In date", "#15803d", "#dcfce7"],
  expiring: ["In date — due for renewal soon", "#92400e", "#fef3c7"],
  "no-expiry": ["In date — no renewal required", "#15803d", "#dcfce7"],
  expired: ["Expired", "#b91c1c", "#fee2e2"],
};

export function VerifyPage({ initialId = "" }) {
  const b = useBrand();
  const [id, setId] = React.useState(String(initialId || "").trim().toUpperCase());
  const [typed, setTyped] = React.useState(String(initialId || "").trim().toUpperCase());
  const [res, setRes] = React.useState(null);     // null = checking
  React.useEffect(() => { ensureCertFonts(CERT_FONTS); document.title = `Check a certificate · ${b.product}`; }, [b.product]);
  React.useEffect(() => {
    if (!id) { setRes({ ok: true, found: false, empty: true }); return; }
    let on = true; setRes(null);
    fetch(`/.netlify/functions/zp-verify?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(r => r.json()).catch(() => ({ ok: false, error: "The certificate couldn't be checked just now. Please try again in a minute." }))
      .then(j => { if (on) setRes(j || { ok: false }); });
    return () => { on = false; };
  }, [id]);
  const check = e => { e.preventDefault(); const v = typed.trim().toUpperCase(); setId(v); try { window.history.replaceState(null, "", `?verify=${encodeURIComponent(v)}`); } catch { /* ignore */ } };

  const logo = b.logos && (b.logos.light || b.logos.dark);
  const st = res && res.found ? (STATUS[res.status] || STATUS.valid) : null;
  const row = (k, v, tid) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "11px 0", borderTop: "1px solid #e5e7eb" }}>
      <span style={{ color: "#5b6478", fontSize: 14 }}>{k}</span>
      <span data-testid={tid} style={{ color: NAVY, fontWeight: 700, fontSize: 15, textAlign: "right" }}>{v}</span>
    </div>
  );
  return (
    <main style={{ minHeight: "100vh", background: "#f3f5fa", fontFamily: "'Barlow', system-ui, sans-serif", color: "#1f2937", display: "flex", justifyContent: "center", padding: "32px 16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12 }}>
          {logo ? <img src={logo} alt={brandCompany(b)} style={{ height: 40, maxWidth: 200, objectFit: "contain" }}/> : <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, color: NAVY }}>{brandCompany(b)}</span>}
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: 2, fontSize: 14, color: NAVY }}>{String(b.product).toUpperCase()}</span>
        </div>
        <section style={{ background: "#ffffff", borderRadius: 16, border: `3px solid ${NAVY}`, padding: "22px 22px 18px", boxShadow: "0 10px 30px rgba(13,31,92,0.08)" }}>
          <h1 style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, color: NAVY, letterSpacing: .5 }}>Certificate check</h1>
          {res === null && <p role="status" style={{ color: "#5b6478" }}>Checking {id}…</p>}
          {res && res.ok && res.found && (
            <div data-testid="verify-found">
              <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 10px", padding: "12px 14px", borderRadius: 12, background: st[2], color: st[1], fontWeight: 800, fontSize: 16 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {res.status === "expired" ? <><circle cx="12" cy="12" r="9"/><line x1="8" y1="8" x2="16" y2="16"/></> : <><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><polyline points="8.5 12 11 14.5 15.5 10"/></>}
                </svg>
                <span>Genuine certificate · <span data-testid="verify-status">{st[0]}</span></span>
              </div>
              {row("Certificate", id, "verify-id")}
              {row("Issued to", res.holder || "—", "verify-holder")}
              {row("Training", res.module, "verify-module")}
              {row("Completed", longDate(res.completed), "verify-completed")}
              {row("Valid until", res.validUntil ? longDate(res.validUntil) : "No renewal required", "verify-until")}
              <p style={{ fontSize: 12.5, color: "#5b6478", lineHeight: 1.5, margin: "12px 0 0" }}>{brandCompany(b) !== b.product ? `Issued by ${brandCompany(b)} through ${b.product}.` : `Issued through ${b.product}.`} The surname is shortened here: check it matches the certificate you were shown.</p>
            </div>
          )}
          {res && res.ok && !res.found && !res.empty && (
            <div role="status" data-testid="verify-notfound" style={{ margin: "14px 0 6px", padding: "12px 14px", borderRadius: 12, background: "#fee2e2", color: "#b91c1c", fontWeight: 700, fontSize: 15, lineHeight: 1.45 }}>
              No certificate with the number {id} was issued by {b.product}. Check the number and try again.
            </div>
          )}
          {res && !res.ok && <div role="alert" style={{ margin: "14px 0 6px", padding: "12px 14px", borderRadius: 12, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>{res.error || "The certificate couldn't be checked just now."}</div>}
          <form onSubmit={check} style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 700, color: "#5b6478" }}>
              Certificate ID
              <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="e.g. ZSL-AB12CD34" autoCapitalize="characters" spellCheck={false} data-testid="verify-input"
                style={{ height: 44, borderRadius: 10, border: "1.5px solid #c7cede", padding: "0 12px", fontSize: 16, fontFamily: "inherit", color: NAVY, letterSpacing: 1 }}/>
            </label>
            <button type="submit" style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: NAVY, color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: "inherit", cursor: "pointer" }}>Check</button>
          </form>
        </section>
        <p style={{ fontSize: 12, color: "#5b6478", textAlign: "center", marginTop: 14 }}>Checked {new Date().toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </main>
  );
}
