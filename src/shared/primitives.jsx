import { Z } from "../theme/tokens";

function Pill({ label, col }) {
  const map = {
    green:  {bg:"#d1fae5",c:"#065f46"},
    amber:  {bg:"#fef3c7",c:"#92400e"},
    red:    {bg:"#fee2e2",c:"#991b1b"},
    blue:   {bg:"#dbeafe",c:"#1e40af"},
    navy:   {bg:Z.borderMd,c:"#fff"},
    gray:   {bg:Z.overlay,c:"#94a3b8"},
  };
  const s = map[col] || map.gray;
  return <span style={{background:s.bg,color:s.c,borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap"}}>{label}</span>;
}

function Avatar({ name, size=36 }) {
  const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2);
  const hue = name.charCodeAt(0)*17 % 360;
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:`hsl(${hue},50%,45%)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:size*.36,flexShrink:0,border:`2px solid rgba(255,255,255,0.15)`}}>
      {initials}
    </div>
  );
}

function Bar({ pct, color=Z.green }) {
  return (
    <div style={{background:Z.overlay,borderRadius:99,height:6,overflow:"hidden",flex:1}}>
      <div style={{width:`${pct}%`,background:color,height:"100%",borderRadius:99,transition:"width .6s ease"}}/>
    </div>
  );
}

function StatCard({ icon, val, label, accent, Z: Zt }) {
  const theme = Zt || Z;
  return (
    <div style={{background:`linear-gradient(135deg,${theme.navyMd},${theme.navy})`,borderRadius:16,padding:"20px 22px",borderLeft:`4px solid ${accent}`,boxShadow:"0 4px 20px rgba(0,0,0,.15)"}}>
      <div style={{fontSize:28}}>{icon}</div>
      <div style={{fontSize:26,fontWeight:900,color:theme.white,marginTop:6,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:-1}}>{val}</div>
      <div style={{color:theme.muted,fontSize:12,marginTop:2,letterSpacing:.5}}>{label}</div>
    </div>
  );
}

// ─── DSE Assessment Data ──────────────────────────────────────────────────────

export { Pill, Avatar, Bar, StatCard };
