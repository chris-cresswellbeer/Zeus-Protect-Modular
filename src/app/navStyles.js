/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/navStyles.js — createNavStyles(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Header menu button styles, sized to the window width.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export function createNavStyles(app) {
  const {
    darkMode, font, T, winW
  } = app;

  // Style factory for the top-nav tab buttons (active tab gets a coloured underline).
  // ── Shared nav styles ──
  // Narrower screens get tighter menu items so the whole admin bar (including Sign Out) fits;
  // if it still doesn't, the right-hand group wraps onto a second row instead of being cut off.
  const navTight = winW < 2100;
  const navCompact = winW < 1900;   // laptop screens: icon-only My Training, no first name, tighter items
  const navTiny = winW < 1500;      // small laptops (1366–1440): smaller type; theme button left to My Account
  const navBtn = (active, col=T.accentLt) => ({
    padding:navTiny?"16px 5px":navCompact?"16px 7px":navTight?"16px 9px":"16px 16px", background:"none", border:"none",
    borderBottom:`3px solid ${active?col:"transparent"}`,
    color:active?col:darkMode?"#94a3b8":"#475569",
    fontWeight:active?700:500, cursor:"pointer", fontSize:navTiny?11:navCompact?11.5:12,
    textTransform:"uppercase", letterSpacing:navTiny?0:navCompact?.2:navTight?.4:.8,
    fontFamily:font, transition:"color .2s",
    // long labels ("Risk Assessments") go onto two lines rather than widening the bar; a single
    // long word ("Contractors") is never squeezed narrower than itself (it ran into the next item)
    maxWidth:navCompact?96:navTight?118:"none", minWidth:"min-content", lineHeight:1.25, textAlign:"center",
  });

  return {
    navTight, navCompact, navTiny, navBtn
  };
}
