const ZEUS_LOGO_SRC = "https://aoahugfyswgcisfiosyn.supabase.co/storage/v1/object/public/assets/zeus%20dark%20mode.png";

const ZEUS_LOGO_LIGHT_SRC = "https://aoahugfyswgcisfiosyn.supabase.co/storage/v1/object/public/assets/zeus%20lightmode.png";

const ZEUS_PROTECT_LOGO_SRC = "https://aoahugfyswgcisfiosyn.supabase.co/storage/v1/object/public/assets/zeusprotect.png";

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
