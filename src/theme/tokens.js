const Z = {
  navy:    "#0d1f5c",
  navyDk:  "#091548",
  navyMd:  "#152370",
  blue:    "#1a3a9e",
  accent:  "#2563eb",
  accentLt:"#3b82f6",
  gold:    "#f59e0b",
  white:   "#ffffff",
  offWhite:"#f0f4ff",
  slate:   "#e2e8f0",
  muted:   "#94a3b8",
  mutedDk: "#64748b",
  bg:      "#060d2e",
  bgCard:  "#0d1f5c",
  bgDeep:  "#091548",
  green:   "#10b981",
  greenDk: "#065f46",
  red:     "#ef4444",
  amber:   "#f59e0b",
  // overlay helpers
  border:  "rgba(255,255,255,0.08)",
  borderMd:"rgba(255,255,255,0.12)",
  overlay: "rgba(255,255,255,0.07)",
  overlaySm:"rgba(255,255,255,0.04)",
  headerBg:"rgba(0,0,0,0.3)",
  headerBgMd:"rgba(255,255,255,0.06)",
};

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
  muted:   "#64748b",
  mutedDk: "#475569",
  bg:      "#e8edf7",
  bgCard:  "#ffffff",
  bgDeep:  "#f1f5f9",
  green:   "#059669",
  greenDk: "#065f46",
  red:     "#dc2626",
  amber:   "#d97706",
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
  blue:"#1a3a9e", accent:"#0d9488", accentLt:"#14b8a6",
  gold:"#f59e0b", white:"#f1f5f9", offWhite:"#e2e8f0",
  slate:"#94a3b8", muted:"#64748b", mutedDk:"#475569",
  bg:"#0d1117", bgCard:"#1a1f2e", bgDeep:"#12151f",
  green:"#10b981", greenDk:"#065f46", red:"#ef4444", amber:"#f59e0b",
  border:"rgba(255,255,255,0.07)", borderMd:"rgba(255,255,255,0.11)",
  overlay:"rgba(255,255,255,0.05)", overlaySm:"rgba(255,255,255,0.03)",
  headerBg:"rgba(0,0,0,0.35)", headerBgMd:"rgba(255,255,255,0.06)",
};

const Z_FOREST = { // Deep Forest — dark green + amber
  navy:"#1a2e1a", navyDk:"#111f11", navyMd:"#1f3620",
  blue:"#1a5c2a", accent:"#16a34a", accentLt:"#4ade80",
  gold:"#d97706", white:"#f0fdf4", offWhite:"#dcfce7",
  slate:"#86efac", muted:"#6b9e7a", mutedDk:"#4a7a5a",
  bg:"#0a150a", bgCard:"#1a2e1a", bgDeep:"#111f11",
  green:"#22c55e", greenDk:"#14532d", red:"#ef4444", amber:"#f59e0b",
  border:"rgba(255,255,255,0.07)", borderMd:"rgba(255,255,255,0.11)",
  overlay:"rgba(255,255,255,0.05)", overlaySm:"rgba(255,255,255,0.03)",
  headerBg:"rgba(0,0,0,0.35)", headerBgMd:"rgba(255,255,255,0.06)",
};

const Z_GRAPHITE = { // Graphite & Gold — near-black + gold
  navy:"#1c1c1e", navyDk:"#111111", navyMd:"#242424",
  blue:"#2c2c2e", accent:"#b8860b", accentLt:"#f59e0b",
  gold:"#f59e0b", white:"#f5f5f0", offWhite:"#e8e8e0",
  slate:"#a8a89a", muted:"#6b6b60", mutedDk:"#4a4a42",
  bg:"#0a0a0a", bgCard:"#1c1c1e", bgDeep:"#111111",
  green:"#10b981", greenDk:"#065f46", red:"#ef4444", amber:"#f59e0b",
  border:"rgba(255,255,255,0.08)", borderMd:"rgba(255,255,255,0.13)",
  overlay:"rgba(255,255,255,0.06)", overlaySm:"rgba(255,255,255,0.03)",
  headerBg:"rgba(0,0,0,0.4)", headerBgMd:"rgba(255,255,255,0.07)",
};

const Z_ARCTIC = { // Aurora — deep purple/indigo + cyan/green accents
  navy:"#1a1033", navyDk:"#110a24", navyMd:"#201444",
  blue:"#2d1b69", accent:"#06b6d4", accentLt:"#22d3ee",
  gold:"#a78bfa", white:"#f0f4ff", offWhite:"#e0e7ff",
  slate:"#a5b4fc", muted:"#7c7fa8", mutedDk:"#5b5e8a",
  bg:"#0a0718", bgCard:"#1a1033", bgDeep:"#110a24",
  green:"#10b981", greenDk:"#065f46", red:"#f43f5e", amber:"#f59e0b",
  border:"rgba(167,139,250,0.12)", borderMd:"rgba(167,139,250,0.2)",
  overlay:"rgba(167,139,250,0.07)", overlaySm:"rgba(167,139,250,0.04)",
  headerBg:"rgba(0,0,0,0.35)", headerBgMd:"rgba(167,139,250,0.08)",
};

const Z_SAND = { // Warm Sand — cream + warm terracotta
  navy:"#fdf8f0", navyDk:"#f5ede0", navyMd:"#faf4ec",
  blue:"#7c3a1e", accent:"#c2522a", accentLt:"#b45309",
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

const ALL_THEMES = {
  dark:     { key:"dark",     label:"🌙 Dark Mode",       desc:"Default navy",         tokens:null },
  light:    { key:"light",    label:"☀️ Light Mode",      desc:"Clean & bright",       tokens:null },
  slate:    { key:"slate",    label:"◼ Midnight Slate",   desc:"Charcoal + teal",      tokens:null },
  forest:   { key:"forest",   label:"🌲 Deep Forest",     desc:"Dark green + amber",   tokens:null },
  graphite: { key:"graphite", label:"⬛ Graphite & Gold",  desc:"Near-black + gold",    tokens:null },
  arctic:   { key:"arctic",   label:"🔷 Arctic",          desc:"Icy white & blue",     tokens:null },
  sand:     { key:"sand",     label:"🏜 Warm Sand",       desc:"Cream & terracotta",   tokens:null },
  rose:     { key:"rose",     label:"🌸 Rose",             desc:"Blush & deep rose",    tokens:null },
};

function getThemeTokens(themeKey) {
  switch(themeKey) {
    case "light":    return Z_LIGHT;
    case "slate":    return Z_SLATE;
    case "forest":   return Z_FOREST;
    case "graphite": return Z_GRAPHITE;
    case "arctic":   return Z_ARCTIC;
    case "sand":     return Z_SAND;
    case "rose":     return Z_ROSE;
    default:         return Z; // dark
  }
}

export { Z, Z_LIGHT, Z_SLATE, Z_FOREST, Z_GRAPHITE, Z_ARCTIC, Z_SAND, Z_ROSE, ALL_THEMES, getThemeTokens };
