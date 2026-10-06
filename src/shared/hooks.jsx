/**
 * shared/hooks.jsx — Responsive layout helpers for the desktop portal.
 *
 * The portal uses a 1024px breakpoint: at or below it, layouts collapse to a
 * single column / card-style rows. (The separate phone app in src/mobile/ is a
 * different UI altogether — see MobileApp.jsx.)
 */

import React from "react";

/**
 * React hook: current window width in px, re-rendering the component on resize.
 * Use this (not window.innerWidth directly) when layout must react to resizing.
 */
function useWindowWidth() {
  const [w, setW] = React.useState(window.innerWidth);
  React.useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return w;
}
// Convenience: returns responsive grid style
// cols: number of columns on desktop, collapses to 1 on mobile
// ⚠ rGrid is NOT a hook — it reads window.innerWidth once, at render time. It
// only updates when the calling component re-renders for some other reason
// (e.g. because it also calls useWindowWidth()). Usage: <div style={rGrid(3)}>
function rGrid(cols, gap = 14, mobileGap = 10) {
  const w = window.innerWidth;
  const isMobile = w <= 1024;
  const colMap = {
    2: "1fr 1fr",
    3: "1fr 1fr 1fr",
    4: "1fr 1fr 1fr 1fr",
  };
  return {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : (colMap[cols] || `repeat(${cols},1fr)`),
    gap: isMobile ? mobileGap : gap,
  };
}

// ─── Mobile card helper ─────────────────────────────────────────────────────────
// Renders a key-value card for mobile table rows
// Neutral see-through colours and the page's own text colour, so it reads in every theme.
function MobileCard({ children, style }) {
  const s = Object.assign({
    background:"rgba(128,128,128,0.08)",
    border:"1px solid rgba(128,128,128,0.22)",
    borderRadius:12,
    padding:"14px 16px",
    marginBottom:10,
    display:"flex",
    flexDirection:"column",
    gap:8,
  }, style||{});
  return <div style={s}>{children}</div>;
}
// One label/value line inside a MobileCard. Long values wrap rather than overflow.
function MobileCardRow({ label, value }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
      <span style={{fontSize:11,fontWeight:700,letterSpacing:.5,color:"inherit",opacity:.6,textTransform:"uppercase",flexShrink:0}}>{label}</span>
      <span style={{fontSize:13,color:"inherit",textAlign:"right",minWidth:0,wordBreak:"break-word"}}>{value}</span>
    </div>
  );
}

export { useWindowWidth, rGrid, MobileCard, MobileCardRow };
