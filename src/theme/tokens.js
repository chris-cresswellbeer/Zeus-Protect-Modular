/**
 * ═══════════════════════════════════════════════════════════════════════════
 * theme/tokens.js — Colour palettes ("design tokens") for every theme
 * ═══════════════════════════════════════════════════════════════════════════
 * The app has no CSS framework. Components use inline styles that read colours
 * from a token object, conventionally named `Z` (or `T`) in each file, e.g.
 *     style={{ background: Z.bgCard, color: Z.white, border: `1px solid ${Z.border}` }}
 *
 * HOW THE ACTIVE THEME REACHES COMPONENTS:
 *   App.jsx (and mobile/MobileApp.jsx) do `const T = getThemeTokens(theme)` and pass
 *   `T` down as a PROP, usually called `Z` (e.g. <CoshhTab Z={T} .../>).
 *   ⚠ A component that instead does `import { Z } from "../theme/tokens"` ALWAYS
 *   gets the default DARK palette and will not follow the user's theme choice
 *   (shared/primitives.jsx does this for Pill/Bar). Prefer the prop.
 *
 * RULE: never hard-code a hex colour in a component — use a token, otherwise
 * that element won't change when the user switches theme.
 *
 * ⚠ TOKEN NAMES ARE HISTORICAL, NOT LITERAL. They were named when only the dark
 *   navy theme existed. Read them by ROLE, not by colour name:
 *     navy / bgCard   → card & panel background
 *     navyDk / bgDeep → darker/recessed background (inputs, table headers)
 *     navyMd          → slightly raised background (hover states)
 *     bg              → page background
 *     white           → PRIMARY TEXT colour (it's near-black in light themes!)
 *     offWhite        → secondary heading text
 *     slate           → body text
 *     muted / mutedDk → de-emphasised text, labels, placeholders
 *     accent / accentLt / blue → buttons, links, active tabs
 *     gold / amber    → warnings, highlights
 *     green / red     → success / danger status colours
 *     border, borderMd, overlay, overlaySm, headerBg, headerBgMd → translucent layers
 *
 * ADDING A THEME:
 *   1. Copy an existing palette below (it must define EVERY key above).
 *   2. Add one line to THEMES (near the bottom) with its key, mode and label.
 *      Nothing else needs changing. qr/themes.mjs checks the text contrast.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Default theme: dark navy (Zeus brand). Also the fallback for unknown theme keys. */
const Z = {
  navy:    "#0d1f5c",
  navyDk:  "#091548",
  navyMd:  "#152370",
  blue:    "#1a3a9e",
  accent:  "#2563eb",
  accentLt:"#60a5fa",
  gold:    "#f59e0b",
  white:   "#ffffff",
  offWhite:"#f0f4ff",
  slate:   "#e2e8f0",
  muted:   "#94a3b8",
  mutedDk: "#75849b",
  bg:      "#060d2e",
  bgCard:  "#0d1f5c",
  bgDeep:  "#091548",
  green:   "#10b981",
  greenDk: "#065f46",
  red:     "#f87171",
  amber:   "#f59e0b",
  // overlay helpers
  border:  "rgba(255,255,255,0.08)",
  borderMd:"rgba(255,255,255,0.12)",
  overlay: "rgba(255,255,255,0.07)",
  overlaySm:"rgba(255,255,255,0.04)",
  headerBg:"rgba(0,0,0,0.3)",
  headerBgMd:"rgba(255,255,255,0.06)",
};

/** Light theme. Note the inversions: `navy` is WHITE (card bg) and `white` is near-BLACK (text). */
const Z_LIGHT = {
  navy:    "#ffffff",
  navyDk:  "#f1f5f9",
  navyMd:  "#f8fafc",
  blue:    "#1a3a9e",
  accent:  "#2563eb",
  accentLt:"#1d4ed8",
  gold:    "#b45309",
  white:   "#0f172a",
  offWhite:"#1e293b",
  slate:   "#334155",
  muted:   "#556378",
  mutedDk: "#475569",
  bg:      "#e8edf7",
  bgCard:  "#ffffff",
  bgDeep:  "#f1f5f9",
  green:   "#047857",
  greenDk: "#065f46",
  red:     "#b91c1c",
  amber:   "#92400e",
  // overlay helpers
  border:  "rgba(0,0,0,0.08)",
  borderMd:"rgba(0,0,0,0.12)",
  overlay: "rgba(0,0,0,0.04)",
  overlaySm:"rgba(0,0,0,0.02)",
  headerBg:"rgba(0,0,0,0.05)",
  headerBgMd:"rgba(0,0,0,0.04)",
};

// ─── Additional Themes ───────────────────────────────────────────────────────
const Z_SLATE = { // Midnight Slate — dark charcoal + teal
  navy:"#1a1f2e", navyDk:"#12151f", navyMd:"#1f2639",
  blue:"#1a3a9e", accent:"#0f766e", accentLt:"#14b8a6",
  gold:"#f59e0b", white:"#f1f5f9", offWhite:"#e2e8f0",
  slate:"#94a3b8", muted:"#8b9bb0", mutedDk:"#6f7f95",
  bg:"#0d1117", bgCard:"#1a1f2e", bgDeep:"#12151f",
  green:"#10b981", greenDk:"#065f46", red:"#f87171", amber:"#f59e0b",
  border:"rgba(255,255,255,0.07)", borderMd:"rgba(255,255,255,0.11)",
  overlay:"rgba(255,255,255,0.05)", overlaySm:"rgba(255,255,255,0.03)",
  headerBg:"rgba(0,0,0,0.35)", headerBgMd:"rgba(255,255,255,0.06)",
};

const Z_FOREST = { // Deep Forest — dark green + amber
  navy:"#1a2e1a", navyDk:"#111f11", navyMd:"#1f3620",
  blue:"#1a5c2a", accent:"#15803d", accentLt:"#4ade80",
  gold:"#d97706", white:"#f0fdf4", offWhite:"#dcfce7",
  slate:"#86efac", muted:"#80b28f", mutedDk:"#64947a",
  bg:"#0a150a", bgCard:"#1a2e1a", bgDeep:"#111f11",
  green:"#22c55e", greenDk:"#14532d", red:"#f87171", amber:"#f59e0b",
  border:"rgba(255,255,255,0.07)", borderMd:"rgba(255,255,255,0.11)",
  overlay:"rgba(255,255,255,0.05)", overlaySm:"rgba(255,255,255,0.03)",
  headerBg:"rgba(0,0,0,0.35)", headerBgMd:"rgba(255,255,255,0.06)",
};

const Z_GRAPHITE = { // Graphite & Gold — near-black + gold
  navy:"#1c1c1e", navyDk:"#111111", navyMd:"#242424",
  blue:"#2c2c2e", accent:"#a16207", accentLt:"#f59e0b",
  gold:"#f59e0b", white:"#f5f5f0", offWhite:"#e8e8e0",
  slate:"#a8a89a", muted:"#a3a395", mutedDk:"#828274",
  bg:"#0a0a0a", bgCard:"#1c1c1e", bgDeep:"#111111",
  green:"#10b981", greenDk:"#065f46", red:"#f87171", amber:"#f59e0b",
  border:"rgba(255,255,255,0.08)", borderMd:"rgba(255,255,255,0.13)",
  overlay:"rgba(255,255,255,0.06)", overlaySm:"rgba(255,255,255,0.03)",
  headerBg:"rgba(0,0,0,0.4)", headerBgMd:"rgba(255,255,255,0.07)",
};

const Z_ARCTIC = { // Aurora — deep purple/indigo + cyan/green accents
  navy:"#1a1033", navyDk:"#110a24", navyMd:"#201444",
  blue:"#2d1b69", accent:"#0e7490", accentLt:"#22d3ee",
  gold:"#a78bfa", white:"#f0f4ff", offWhite:"#e0e7ff",
  slate:"#a5b4fc", muted:"#8f92bd", mutedDk:"#7477a6",
  bg:"#0a0718", bgCard:"#1a1033", bgDeep:"#110a24",
  green:"#10b981", greenDk:"#065f46", red:"#f43f5e", amber:"#f59e0b",
  border:"rgba(167,139,250,0.12)", borderMd:"rgba(167,139,250,0.2)",
  overlay:"rgba(167,139,250,0.07)", overlaySm:"rgba(167,139,250,0.04)",
  headerBg:"rgba(0,0,0,0.35)", headerBgMd:"rgba(167,139,250,0.08)",
};

const Z_SAND = { // Warm Sand — cream + warm terracotta
  navy:"#fdf8f0", navyDk:"#f5ede0", navyMd:"#faf4ec",
  blue:"#7c3a1e", accent:"#c2522a", accentLt:"#9a3412",
  gold:"#92400e", white:"#1c0f05", offWhite:"#2d1a0e",
  slate:"#78350f", muted:"#92400e", mutedDk:"#78350f",
  bg:"#f0e6d3", bgCard:"#fdf8f0", bgDeep:"#f5ede0",
  green:"#065f46", greenDk:"#064e3b", red:"#991b1b", amber:"#92400e",
  border:"rgba(120,53,15,0.12)", borderMd:"rgba(120,53,15,0.18)",
  overlay:"rgba(120,53,15,0.05)", overlaySm:"rgba(120,53,15,0.03)",
  headerBg:"rgba(120,53,15,0.07)", headerBgMd:"rgba(120,53,15,0.1)",
};

const Z_ROSE = { // Rose — blush/pink backgrounds + deep rose accents
  navy:"#fff0f3", navyDk:"#ffe4ea", navyMd:"#fff5f7",
  blue:"#881337", accent:"#e11d48", accentLt:"#be123c",
  gold:"#9f1239", white:"#1a0810", offWhite:"#3b0f1e",
  slate:"#4c0519", muted:"#9f5070", mutedDk:"#7f3050",
  bg:"#fce7ed", bgCard:"#fff0f3", bgDeep:"#ffe4ea",
  green:"#065f46", greenDk:"#064e3b", red:"#9f1239", amber:"#92400e",
  border:"rgba(225,29,72,0.1)", borderMd:"rgba(225,29,72,0.16)",
  overlay:"rgba(225,29,72,0.05)", overlaySm:"rgba(225,29,72,0.03)",
  headerBg:"rgba(225,29,72,0.06)", headerBgMd:"rgba(225,29,72,0.09)",
};

// ─── New themes (October 2026) ───────────────────────────────────────────────
const Z_HCDARK = { // High Contrast Dark — black, pure white text, strong borders
  navy:"#111111", navyDk:"#000000", navyMd:"#1f1f1f",
  blue:"#1d4ed8", accent:"#2563eb", accentLt:"#93c5fd",
  gold:"#fbbf24", white:"#ffffff", offWhite:"#ffffff",
  slate:"#f1f5f9", muted:"#d4d4d8", mutedDk:"#a1a1aa",
  bg:"#000000", bgCard:"#111111", bgDeep:"#000000",
  green:"#34d399", greenDk:"#065f46", red:"#f87171", amber:"#fbbf24",
  border:"rgba(255,255,255,0.32)", borderMd:"rgba(255,255,255,0.5)",
  overlay:"rgba(255,255,255,0.08)", overlaySm:"rgba(255,255,255,0.04)",
  headerBg:"rgba(0,0,0,0.6)", headerBgMd:"rgba(255,255,255,0.14)",
};

const Z_FROST = { // Arctic Frost — icy white + glacier blue
  navy:"#f7fbfe", navyDk:"#e9f3fa", navyMd:"#f0f7fc",
  blue:"#0c4a6e", accent:"#0369a1", accentLt:"#075985",
  gold:"#a16207", white:"#0b1d2c", offWhite:"#12324a",
  slate:"#1e3a52", muted:"#4b6478", mutedDk:"#3b5366",
  bg:"#e2eef7", bgCard:"#f7fbfe", bgDeep:"#e9f3fa",
  green:"#047857", greenDk:"#065f46", red:"#b91c1c", amber:"#92400e",
  border:"rgba(3,105,161,0.13)", borderMd:"rgba(3,105,161,0.22)",
  overlay:"rgba(3,105,161,0.05)", overlaySm:"rgba(3,105,161,0.025)",
  headerBg:"rgba(3,105,161,0.06)", headerBgMd:"rgba(3,105,161,0.09)",
};

const Z_MINT = { // Fresh Mint — pale green-white + deep teal
  navy:"#f6fcf9", navyDk:"#e8f5ef", navyMd:"#f0f9f5",
  blue:"#134e4a", accent:"#0f766e", accentLt:"#115e59",
  gold:"#a16207", white:"#0b1f19", offWhite:"#133a30",
  slate:"#1f4a3f", muted:"#4d6b62", mutedDk:"#3c5a51",
  bg:"#dff0e8", bgCard:"#f6fcf9", bgDeep:"#e8f5ef",
  green:"#047857", greenDk:"#065f46", red:"#b91c1c", amber:"#92400e",
  border:"rgba(15,118,110,0.14)", borderMd:"rgba(15,118,110,0.22)",
  overlay:"rgba(15,118,110,0.05)", overlaySm:"rgba(15,118,110,0.025)",
  headerBg:"rgba(15,118,110,0.06)", headerBgMd:"rgba(15,118,110,0.09)",
};

const Z_HCLIGHT = { // High Contrast Light — white, black text, strong borders
  navy:"#ffffff", navyDk:"#f0f0f0", navyMd:"#f7f7f7",
  blue:"#1e3a8a", accent:"#1d4ed8", accentLt:"#1e40af",
  gold:"#854d0e", white:"#000000", offWhite:"#000000",
  slate:"#111111", muted:"#374151", mutedDk:"#1f2937",
  bg:"#ffffff", bgCard:"#ffffff", bgDeep:"#f0f0f0",
  green:"#166534", greenDk:"#14532d", red:"#991b1b", amber:"#92400e",
  border:"rgba(0,0,0,0.42)", borderMd:"rgba(0,0,0,0.6)",
  overlay:"rgba(0,0,0,0.04)", overlaySm:"rgba(0,0,0,0.02)",
  headerBg:"rgba(0,0,0,0.06)", headerBgMd:"rgba(0,0,0,0.1)",
};

/**
 * THE THEME LIST — the one place themes are defined.
 * Everything else (the My Account picker, the phone's Appearance screen, the
 * header ☀/🌙 button, the logo artwork and the light-theme text fix) reads it,
 * so adding a theme here is all that's needed.
 *   key     saved as the person's preference — never rename an existing key
 *           ("arctic" is the purple Aurora palette for historical reasons)
 *   mode    "light" | "dark"
 *   icon    shown on the header button
 *   preview [page, card, accent] swatches for the picker
 */
const THEMES = [
  // Light
  { key:"light",    mode:"light", icon:"☀️", label:"Light",              desc:"Clean & bright",            tokens:Z_LIGHT },
  { key:"frost",    mode:"light", icon:"❄️", label:"Arctic Frost",       desc:"Icy white & glacier blue",  tokens:Z_FROST },
  { key:"mint",     mode:"light", icon:"🌿", label:"Fresh Mint",         desc:"Pale green & deep teal",    tokens:Z_MINT },
  { key:"sand",     mode:"light", icon:"🏜", label:"Warm Sand",          desc:"Cream & terracotta",        tokens:Z_SAND },
  { key:"rose",     mode:"light", icon:"🌸", label:"Rose",               desc:"Blush & deep rose",         tokens:Z_ROSE },
  { key:"hclight",  mode:"light", icon:"◐",  label:"High Contrast Light", desc:"Black on white", tokens:Z_HCLIGHT },
  // Dark
  { key:"dark",     mode:"dark",  icon:"🌙", label:"Navy",               desc:"Zeus default",              tokens:Z },
  { key:"slate",    mode:"dark",  icon:"◼",  label:"Midnight Slate",     desc:"Charcoal & teal",           tokens:Z_SLATE },
  { key:"forest",   mode:"dark",  icon:"🌲", label:"Deep Forest",        desc:"Dark green & amber",        tokens:Z_FOREST },
  { key:"graphite", mode:"dark",  icon:"⬛", label:"Graphite & Gold",    desc:"Near-black & gold",         tokens:Z_GRAPHITE },
  { key:"arctic",   mode:"dark",  icon:"🌌", label:"Aurora",             desc:"Deep purple & cyan",        tokens:Z_ARCTIC },
  { key:"hcdark",   mode:"dark",  icon:"◑",  label:"High Contrast Dark", desc:"White on black", tokens:Z_HCDARK },
].map(t => ({ ...t, preview: [t.tokens.bg, t.tokens.bgCard, t.tokens.accent] }));

const THEME_BY_KEY = Object.fromEntries(THEMES.map(t => [t.key, t]));

/** Legacy map shape ({key:{key,label,desc,…}}) for older callers. */
const ALL_THEMES = THEME_BY_KEY;

/** The theme entry for a saved key; unknown/missing keys → the default Navy theme. */
function getTheme(themeKey) {
  return THEME_BY_KEY[themeKey] || THEME_BY_KEY.dark;
}

/**
 * Resolve a saved theme key (e.g. "forest") to its colour palette.
 * Unknown/missing keys fall back to the default dark theme `Z`.
 * @param {string} themeKey
 * @returns {typeof Z}
 */
function getThemeTokens(themeKey) {
  return getTheme(themeKey).tokens;
}

const isDarkTheme  = key => getTheme(key).mode === "dark";
const isLightTheme = key => getTheme(key).mode === "light";

// ─── Remembering the last light and last dark theme (per device) ─────────────
// Used by the header ☀/🌙 button and the phone's "Follow system", so switching
// between light and dark goes back to the light/dark theme the person last chose.
const LAST_KEY = { light: "zp_last_light_theme", dark: "zp_last_dark_theme" };
const DEFAULT_FOR = { light: "light", dark: "dark" };

function rememberTheme(key) {
  const t = THEME_BY_KEY[key];
  if (!t) return;
  try { localStorage.setItem(LAST_KEY[t.mode], t.key); } catch (e) { /* storage blocked */ }
}

/** The light or dark theme to use: the current one if it's already that mode, else the last one remembered. */
function themeForMode(mode, currentKey) {
  if (THEME_BY_KEY[currentKey]?.mode === mode) return currentKey;
  let saved = null;
  try { saved = localStorage.getItem(LAST_KEY[mode]); } catch (e) { /* storage blocked */ }
  return THEME_BY_KEY[saved]?.mode === mode ? saved : DEFAULT_FOR[mode];
}

/** The header button: from a dark theme to the last light one, and back. */
function oppositeTheme(currentKey) {
  return themeForMode(isDarkTheme(currentKey) ? "light" : "dark", currentKey);
}

export {
  Z, Z_LIGHT, Z_SLATE, Z_FOREST, Z_GRAPHITE, Z_ARCTIC, Z_SAND, Z_ROSE,
  Z_HCDARK, Z_FROST, Z_MINT, Z_HCLIGHT,
  THEMES, ALL_THEMES, getTheme, getThemeTokens, isDarkTheme, isLightTheme,
  rememberTheme, themeForMode, oppositeTheme,
};
