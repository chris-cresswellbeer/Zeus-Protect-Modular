/**
 * shared/Logo.jsx — the company's logos, from the branding (lib/brandCore.js).
 *
 * The images are links stored in the branding (Site Settings → Branding, super
 * admins only); uploaded logos live in the public "assets" bucket under brand/.
 * With no logo set, the portal name is shown as text instead, so a new site with
 * no branding yet still looks finished.
 *
 *   <BrandLogo darkMode size="sm|lg"/>   header logo (dark- or light-theme artwork)
 *   <BrandSignInLogo/>                   large logo on the sign-in screen
 *   brandLightLogo()                     link for printed reports/certificates ("" if none)
 */
import React from "react";
import { useBrand } from "../lib/brand";
import { getBrand } from "../lib/brandCore";

/** Header logo. mixBlendMode ("screen" on dark, "multiply" on light) hides a solid image background. */
function BrandLogo({ size = "sm", darkMode = true }) {
  const b = useBrand();
  const big = size === "lg";
  const src = darkMode ? (b.logos.dark || b.logos.light) : (b.logos.light || b.logos.dark);
  if (!src) {
    return (
      <span data-testid="brand-text-logo" style={{ fontWeight: 900, fontSize: big ? 26 : 17, letterSpacing: -.3, whiteSpace: "nowrap",
        color: darkMode ? "#ffffff" : "#0f172a", display: "block", lineHeight: 1.1 }}>{b.product}</span>
    );
  }
  return (
    <img src={src} alt={b.company || b.product}
      style={{ height: big ? 64 : 36, width: "auto", display: "block", objectFit: "contain",
        mixBlendMode: darkMode ? "screen" : "multiply", borderRadius: 4 }}/>
  );
}

/** Large, centred logo on the sign-in screen (max 420px wide, scales down on phones). */
function BrandSignInLogo() {
  const b = useBrand();
  const src = b.logos.signin || b.logos.dark;
  if (!src) {
    return <div data-testid="brand-text-logo" style={{ textAlign: "center", fontWeight: 900, fontSize: 34, letterSpacing: -.5, color: "#ffffff", lineHeight: 1.15 }}>{b.product}</div>;
  }
  return <img src={src} alt={b.product} style={{ width: "100%", maxWidth: 420, height: "auto", display: "block", margin: "0 auto" }}/>;
}

/** Logo link for white-background documents (certificates, printed reports). */
const brandLightLogo = () => { const b = getBrand(); return b.logos.light || b.logos.dark || ""; };

export { BrandLogo, BrandSignInLogo, brandLightLogo };
