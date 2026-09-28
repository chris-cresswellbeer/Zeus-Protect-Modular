/**
 * shared/Logo.jsx — Zeus brand logos.
 *
 * The logo images are hosted in the public Supabase Storage bucket "assets"
 * (not bundled with the app). To change a logo, upload the new file to that
 * bucket and update the URL here. Spaces in filenames are URL-encoded (%20).
 * If the bucket is ever made private or renamed, logos will show as broken images.
 */

// Logo for dark themes (white text).
const ZEUS_LOGO_SRC = "https://aoahugfyswgcisfiosyn.supabase.co/storage/v1/object/public/assets/zeus%20dark%20modeV2.png";

// Logo for light themes (dark text).
const ZEUS_LOGO_LIGHT_SRC = "https://aoahugfyswgcisfiosyn.supabase.co/storage/v1/object/public/assets/zeus%20lightmodeV2.png";

// Full "Zeus Protect" product wordmark — used large on the login screen.
const ZEUS_PROTECT_LOGO_SRC = "https://aoahugfyswgcisfiosyn.supabase.co/storage/v1/object/public/assets/zeusprotectV2.png";

/**
 * Company logo for headers/sidebars.
 * @param {"sm"|"lg"} size  sm = 36px tall, lg = 64px tall.
 * @param {boolean} darkMode Picks the matching artwork. mixBlendMode ("screen" on dark,
 *   "multiply" on light) hides the image's solid background so it blends into any theme.
 */
function ZeusLogo({ size = "sm", darkMode = true }) {
  const big = size === "lg";
  return (
    <img
      src={darkMode ? ZEUS_LOGO_SRC : ZEUS_LOGO_LIGHT_SRC}
      alt="Zeus"
      style={{
        height: big ? 64 : 36,
        width: "auto",
        display: "block",
        objectFit: "contain",
        mixBlendMode: darkMode ? "screen" : "multiply",
        borderRadius: 4,
      }}
    />
  );
}

/** Large, centred product wordmark (max 420px wide, scales down on phones). */
function ZeusProtectLogo() {
  return (
    <img
      src={ZEUS_PROTECT_LOGO_SRC}
      alt="Zeus Protect"
      style={{
        width: "100%",
        maxWidth: 420,
        height: "auto",
        display: "block",
        margin: "0 auto",
      }}
    />
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

export { ZeusLogo, ZeusProtectLogo, ZEUS_LOGO_SRC, ZEUS_LOGO_LIGHT_SRC, ZEUS_PROTECT_LOGO_SRC };
