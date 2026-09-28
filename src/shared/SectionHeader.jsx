/**
 * shared/SectionHeader.jsx — Small uppercase section divider (icon + label + underline).
 * Used inside long forms to break them into titled sections.
 * Props: icon (emoji/string/node), label (text), Z (theme tokens — required).
 */
function SectionHeader({ icon, label, Z }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,margin:"22px 0 14px",borderBottom:`1px solid ${Z.border}`,paddingBottom:8}}>
      <span style={{fontSize:15}}>{icon}</span>
      <span style={{fontSize:11,fontWeight:800,letterSpacing:.8,color:Z.muted,textTransform:"uppercase"}}>{label}</span>
    </div>
  );
}

export { SectionHeader };
