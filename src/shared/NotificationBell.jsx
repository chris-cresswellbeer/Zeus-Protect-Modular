import { useState } from "react";
import { E } from "../lib/emoji";

function NotificationBell({ notifications, onNavigate, Z, font }) {
  const [open, setOpen] = useState(false);
  const count = notifications.length;
  const urgent = notifications.filter(n=>n.urgent).length;

  const typeIcons = { module:E("📚","▪"), document:E("📄","▪"), dse:E("🖥️","▪"), training:E("🎓","▪"), report:E("📊","▪"), staff:E("👥","▪") };

  // Use fixed colours so dropdown is readable in both light and dark mode
  const dropBg    = Z.navyMd || "#1e2d5a";
  const dropBorder= Z.borderMd;
  const dropTitle = Z.white;
  const dropMuted = Z.muted;
  const dropHover = Z.overlay;
  const dropHoverUrgent = "rgba(239,68,68,0.15)";

  const handleClick = (n) => {
    setOpen(false);
    if (n.nav && onNavigate) onNavigate(n.nav);
  };

  return (
    <div style={{position:"relative"}}>
      <button
        onClick={()=>setOpen(s=>!s)}
        style={{position:"relative",background:open?Z.borderMd:Z.overlay,border:`1px solid ${open?Z.muted:Z.borderMd}`,borderRadius:10,width:38,height:38,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"all .2s",flexShrink:0}}>
        🔔
        {count>0 && (
          <span style={{position:"absolute",top:-4,right:-4,background:urgent>0?"#ef4444":Z.amber,color:"#fff",borderRadius:99,minWidth:18,height:18,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",border:`2px solid ${Z.bg||Z.navyDk}`,lineHeight:1}}>
            {count>9?"9+":count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:998}}/>
          <div style={{position:"absolute",right:0,top:44,width:340,maxHeight:440,overflowY:"auto",background:dropBg,border:`1px solid ${dropBorder}`,borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.5)",zIndex:999}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${dropBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:dropBg}}>
              <span style={{fontWeight:800,fontSize:14,color:dropTitle}}>Notifications</span>
              {count>0
                ? <span style={{fontSize:11,color:dropMuted}}>{count} action{count!==1?"s":""} pending</span>
                : <span style={{fontSize:11,color:"#34d399"}}>All up to date ✓</span>
              }
            </div>
            {count===0 ? (
              <div style={{padding:28,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <p style={{color:dropMuted,fontSize:13,margin:0}}>No outstanding actions</p>
              </div>
            ) : (
              <div>
                {notifications.map((n,i)=>{
                  const clickable = !!(n.nav && onNavigate);
                  return (
                    <div key={i}
                      onClick={()=>handleClick(n)}
                      style={{padding:"12px 16px",borderBottom:`1px solid ${dropBorder}`,display:"flex",gap:10,alignItems:"flex-start",background:n.urgent?"rgba(239,68,68,0.08)":"transparent",cursor:clickable?"pointer":"default",transition:"background .15s"}}
                      onMouseEnter={e=>{ if(clickable) e.currentTarget.style.background=n.urgent?dropHoverUrgent:dropHover; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background=n.urgent?"rgba(239,68,68,0.08)":"transparent"; }}>
                      <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{typeIcons[n.type]||E("📌","▪")}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:n.urgent?"#fca5a5":dropTitle,lineHeight:1.4}}>{n.title}</div>
                        {n.detail && <div style={{fontSize:11,color:dropMuted,marginTop:2,lineHeight:1.4}}>{n.detail}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                        {n.urgent && <span style={{fontSize:10,color:"#f87171",fontWeight:700}}>URGENT</span>}
                        {clickable && <span style={{fontSize:11,color:"#60a5fa",fontWeight:600}}>Go →</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export { NotificationBell };
