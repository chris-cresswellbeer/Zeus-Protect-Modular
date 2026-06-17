import React from "react";

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
function MobileCard({ children, style }) {
  const s = Object.assign({
    background:"rgba(255,255,255,0.04)",
    border:"1px solid rgba(255,255,255,0.08)",
    borderRadius:12,
    padding:"14px 16px",
    marginBottom:10,
    display:"flex",
    flexDirection:"column",
    gap:8,
  }, style||{});
  return <div style={s}>{children}</div>;
}
function MobileCardRow({ label, value }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
      <span style={{fontSize:11,fontWeight:700,letterSpacing:.5,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",flexShrink:0}}>{label}</span>
      <span style={{fontSize:13,color:"rgba(255,255,255,0.9)",textAlign:"right",minWidth:0,wordBreak:"break-word"}}>{value}</span>
    </div>
  );
}

export { useWindowWidth, rGrid, MobileCard, MobileCardRow };
