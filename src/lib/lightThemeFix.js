/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/lightThemeFix.js — keep text readable in the light themes
 * ═══════════════════════════════════════════════════════════════════════════
 * Many admin screens colour text with fixed "pale" accents that were chosen for
 * dark backgrounds (e.g. #f87171 red, #6ee7b7 green, #93c5fd blue). On the light
 * themes (Light, Warm Sand, Rose) those are too faint to read.
 *
 * Rather than edit several hundred inline colours, applyLightThemeFix(true)
 * adds ONE stylesheet that — only while a light theme is active — swaps each
 * pale TEXT colour for a darker shade of the same hue. Backgrounds and borders
 * are untouched, and the dark themes are not affected at all.
 *
 * How it matches: React writes inline styles like  style="color: rgb(248, 113, 113);"
 * so we match that exact text at the start of the style attribute or after "; ".
 * (Matching "; color:" never hits "background-color:" or "border-color:".)
 *
 * It also sets a few CSS variables that shared components read, e.g. Pill and
 * the drag handle:  var(--zp-pill-navy-fg, #fff).
 */

// pale text colour (as the browser writes it) → readable colour on light backgrounds
const MAP = [
  ["rgb(252, 165, 165)", "#991b1b"],  // #fca5a5
  ["rgb(254, 202, 202)", "#991b1b"],  // #fecaca
  ["rgb(248, 113, 113)", "#b91c1c"],  // #f87171
  ["rgb(239, 68, 68)",   "#b91c1c"],  // #ef4444
  ["rgb(245, 158, 11)",  "#b45309"],  // #f59e0b
  ["rgb(251, 191, 36)",  "#92400e"],  // #fbbf24
  ["rgb(252, 211, 77)",  "#92400e"],  // #fcd34d
  ["rgb(253, 230, 138)", "#92400e"],  // #fde68a
  ["rgb(16, 185, 129)",  "#047857"],  // #10b981
  ["rgb(52, 211, 153)",  "#047857"],  // #34d399
  ["rgb(110, 231, 183)", "#065f46"],  // #6ee7b7
  ["rgb(167, 243, 208)", "#065f46"],  // #a7f3d0
  ["rgb(74, 222, 128)",  "#15803d"],  // #4ade80
  ["rgb(134, 239, 172)", "#166534"],  // #86efac
  ["rgb(147, 197, 253)", "#1d4ed8"],  // #93c5fd
  ["rgb(96, 165, 250)",  "#1d4ed8"],  // #60a5fa
  ["rgb(59, 130, 246)",  "#1d4ed8"],  // #3b82f6
  ["rgb(191, 219, 254)", "#1e40af"],  // #bfdbfe
  ["rgb(125, 211, 252)", "#0369a1"],  // #7dd3fc
  ["rgb(56, 189, 248)",  "#0369a1"],  // #38bdf8
  ["rgb(196, 181, 253)", "#6d28d9"],  // #c4b5fd
  ["rgb(167, 139, 250)", "#6d28d9"],  // #a78bfa
  ["rgb(249, 168, 212)", "#9d174d"],  // #f9a8d4
  ["rgb(253, 186, 116)", "#9a3412"],  // #fdba74
  ["rgb(251, 146, 60)",  "#c2410c"],  // #fb923c
  ["rgb(148, 163, 184)", "#475569"],  // #94a3b8 (slate "muted")
  ["rgb(203, 213, 225)", "#475569"],  // #cbd5e1
  ["rgb(226, 232, 240)", "#334155"],  // #e2e8f0
];
// semi-transparent white text (hints, placeholders) → muted slate
const WHITE_ALPHA = ["0.25", "0.3", "0.35", "0.4", "0.45", "0.5", "0.55", "0.6", "0.65", "0.7", "0.75", "0.8"];

const R = ":root[data-zp-light]";
// Areas that stay dark in light themes (coloured banners, dark buttons) opt out
// with data-zp-keep, so their pale text stays pale.
const NOT_KEEP = ":not([data-zp-keep] *)";

function rule(from, to) {
  return `${R} [style^="color: ${from}"]${NOT_KEEP},${R} [style*="; color: ${from}"]${NOT_KEEP}{color:${to}!important}`;
}

function buildCss() {
  const out = MAP.map(([f, t]) => rule(f, t));
  WHITE_ALPHA.forEach(a => out.push(rule(`rgba(255, 255, 255, ${a})`, "#64748b")));
  out.push(`${R}{--zp-pill-navy-bg:#e2e8f0;--zp-pill-navy-fg:#1e293b;--zp-pill-gray-bg:#f1f5f9;--zp-pill-gray-fg:#475569;--zp-drag-handle:rgba(15,23,42,0.5)}`);
  return out.join("\n");
}

const LIGHT_THEMES = new Set(["light", "sand", "rose"]);
const isLightTheme = key => LIGHT_THEMES.has(key);

/** Turn the light-theme text fixes on/off. Safe to call on every theme change. */
function applyLightThemeFix(isLight) {
  if (typeof document === "undefined") return;
  if (!document.getElementById("zp-light-fix")) {
    const el = document.createElement("style");
    el.id = "zp-light-fix";
    el.textContent = buildCss();
    document.head.appendChild(el);
  }
  if (isLight) document.documentElement.setAttribute("data-zp-light", "");
  else document.documentElement.removeAttribute("data-zp-light");
}

export { applyLightThemeFix, isLightTheme };
