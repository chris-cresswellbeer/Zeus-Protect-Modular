import React from "react";

function HelpTip({ text, dark = false }) {
  const [open, setOpen] = React.useState(false);
  const bg = dark ? "rgba(255,255,255,0.12)" : "rgba(37,99,235,0.12)";
  const col = dark ? "rgba(255,255,255,0.6)" : "#3b82f6";
  const bgOpen = dark ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.15)";
  const colOpen = dark ? "#f59e0b" : "#b45309";
  const tipBg = dark ? "rgba(13,31,92,0.95)" : "rgba(37,99,235,0.07)";
  const tipBorder = dark ? "rgba(245,158,11,0.4)" : "rgba(37,99,235,0.2)";
  const tipCol = dark ? "#ffffff" : "#1e3a5f";
  return (
    <span style={{display:"inline-flex",flexDirection:"column",verticalAlign:"middle"}}>
      <button onClick={()=>setOpen(v=>!v)} aria-label="Help"
        style={{width:18,height:18,borderRadius:"50%",background:open?bgOpen:bg,color:open?colOpen:col,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",lineHeight:"18px",padding:0,flexShrink:0,transition:"all .15s"}}>
        ?
      </button>
      {open && (
        <span onClick={e=>e.stopPropagation()} className="helptip-text" style={{"--tip-col":tipCol,background:tipBg,border:`1px solid ${tipBorder}`,borderRadius:10,padding:"11px 14px",fontSize:13,lineHeight:1.6,marginTop:8,maxWidth:340,zIndex:10,boxShadow:"0 4px 20px rgba(0,0,0,0.35)",fontWeight:400,display:"block"}}>
          {text}
        </span>
      )}
    </span>
  );
}


export { HelpTip };
