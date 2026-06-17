import { TRAINING_MODULES } from "../../data/seedTraining";

function ManagerRow({ mgr, assigns, comps, Z, font, modules }) {
  const allModules = modules || TRAINING_MODULES;
  const [open, setOpen] = useState(false);
  const statusColor  = mgr.status==="green"?Z.green:mgr.status==="amber"?Z.amber:"#ef4444";
  const statusBorder = mgr.status==="green"?"rgba(16,185,129,0.3)":mgr.status==="amber"?"rgba(245,158,11,0.3)":"rgba(239,68,68,0.35)";

  return (
    <div style={{borderRadius:16,border:`1px solid ${statusBorder}`,overflow:"hidden",background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`}}>

      {/* Summary row */}
      <div onClick={()=>setOpen(s=>!s)}
        style={{padding:"16px 22px",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 2fr auto",alignItems:"center",gap:14,cursor:"pointer",background:open?"rgba(37,99,235,0.08)":"transparent",transition:"background .15s"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:`linear-gradient(135deg,${statusColor}33,${statusColor}15)`,border:`2px solid ${statusColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>👔</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:Z.white}}>{mgr.name}</div>
            <div style={{color:Z.muted,fontSize:11,marginTop:1}}>{mgr.members.length} direct report{mgr.members.length!==1?"s":""}</div>
          </div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:900,color:statusColor,fontFamily:"'Barlow Condensed',sans-serif"}}>{mgr.compliancePct}%</div>
          <div style={{fontSize:10,color:Z.muted,letterSpacing:.5}}>COMPLIANCE</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:Z.green}}>{mgr.fullyCompliant}</div>
          <div style={{fontSize:10,color:Z.muted,letterSpacing:.5}}>COMPLIANT</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:mgr.nonCompliant>0?"#f87171":Z.muted}}>{mgr.nonCompliant}</div>
          <div style={{fontSize:10,color:Z.muted,letterSpacing:.5}}>OVERDUE</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          <Bar pct={mgr.compliancePct} color={statusColor}/>
          <div style={{fontSize:10,color:Z.muted}}>{mgr.totalCompleted}/{mgr.totalAssigned} modules completed</div>
        </div>
        <span style={{color:Z.muted,fontSize:18,lineHeight:1,transition:"transform .25s",transform:open?"rotate(90deg)":"rotate(0deg)",display:"inline-block",flexShrink:0}}>›</span>
      </div>

      {/* Expanded: per-staff breakdown */}
      {open && (
        <div style={{borderTop:`1px solid ${Z.border}`,background:Z.overlay}}>
          {mgr.nonCompliant > 0 && (
            <div style={{padding:"10px 22px",background:"rgba(239,68,68,0.07)",borderBottom:"1px solid rgba(239,68,68,0.15)",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}>⚠</span>
              <span style={{fontSize:12,color:"#fca5a5",fontWeight:600}}>
                {mgr.nonCompliant} staff member{mgr.nonCompliant!==1?" have":" has"} outstanding training. Action required.
              </span>
            </div>
          )}
          {mgr.noModules > 0 && (
            <div style={{padding:"10px 22px",background:"rgba(245,158,11,0.06)",borderBottom:"1px solid rgba(245,158,11,0.12)",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}>ℹ</span>
              <span style={{fontSize:12,color:Z.amber,fontWeight:600}}>
                {mgr.noModules} staff member{mgr.noModules!==1?"s have":" has"} no modules assigned yet.
              </span>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 2fr",padding:"10px 22px",fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",borderBottom:`1px solid ${Z.border}`}}>
            <span>Staff Member</span><span>Outstanding Modules</span><span>Score</span><span>Progress</span>
          </div>
          {mgr.members.map((u,ui)=>{
            const assignedIds = assigns[u.id]||[];
            const userComps   = comps[u.id]||{};
            const a = assignedIds.length;
            const d = (assigns[u.id]||[]).filter(mid => userComps[mid]).length;
            const pct = a ? Math.min(100, Math.round(d/a*100)) : 0;
            const pending = allModules.filter(m=>assignedIds.includes(m.id)&&!userComps[m.id]);
            const memberColor = pct===100?Z.green:pct>=50?Z.accentLt:"#f87171";
            return (
              <div key={u.id} style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 2fr",padding:"13px 22px",borderTop:ui>0?`1px solid ${Z.border}`:"none",alignItems:"center",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <Avatar name={u.name} size={28}/>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:Z.white}}>{u.name}</div>
                    <div style={{fontSize:11,color:Z.muted}}>{u.jobTitle||""}</div>
                  </div>
                </div>
                <div>
                  {pending.length === 0 ? (
                    <span style={{fontSize:12,color:Z.green,fontWeight:700}}>✓ All complete</span>
                  ) : (
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {pending.map(m=>(
                        <span key={m.id} style={{fontSize:10,background:m.level==="Mandatory"?"rgba(239,68,68,0.15)":"rgba(37,99,235,0.15)",color:m.level==="Mandatory"?"#f87171":Z.accentLt,border:`1px solid ${m.level==="Mandatory"?"rgba(239,68,68,0.3)":"rgba(37,99,235,0.3)"}`,borderRadius:6,padding:"2px 7px",fontWeight:700}}>
                          {m.icon} {m.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{fontWeight:800,color:memberColor,fontSize:14}}>{a>0?`${d}/${a}`:"-"}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Bar pct={pct} color={memberColor}/>
                  <span style={{fontSize:11,color:memberColor,fontWeight:700,minWidth:32,textAlign:"right"}}>{a>0?`${pct}%`:"—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export { ManagerRow };
