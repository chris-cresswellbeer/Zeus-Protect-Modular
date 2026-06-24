import { useState } from "react";
import { machineExpiryStatus, COMP_STATUS, isWarehouseWorker } from "../../data/seedMachinery";

function MachineryCompetenceTab({ user, machineComps, setMachineComps, allMachineTypes, allMachineCategories, Z, font }) {
  const myComps = machineComps[user.id] || [];
  const [expandedId, setExpandedId] = useState(null);
  const isWarehouse = isWarehouseWorker(user);

  if (!isWarehouse) return (
    <div>
      <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 8px"}}>Machinery Competence</h2>
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:48,textAlign:"center",border:`1px solid ${Z.border}`}}>
        <div style={{fontSize:52,marginBottom:12}}>🏗</div>
        <p style={{color:Z.white,fontWeight:700,fontSize:15,margin:"0 0 6px"}}>Machinery competence records are for warehouse and operational roles</p>
        <p style={{color:Z.muted,fontSize:13,margin:0}}>Your role ({user.jobTitle}) does not require machinery competence records. Contact your manager if you believe this is incorrect.</p>
      </div>
    </div>
  );

  const machineTypes = allMachineTypes || [];
  const machineCategories = allMachineCategories || [];

  const grouped = machineCategories.map(cat=>({
    cat,
    machines: machineTypes.filter(m=>m.category===cat).map(m=>({
      type:m,
      comp: myComps.find(c=>c.machineId===m.id)||null,
    }))
  }));

  const validCount    = myComps.filter(c=>{ const ex=machineExpiryStatus(c,machineTypes); return c.status==="competent"&&(!ex||ex.status==="valid"); }).length;
  const expiringCount = myComps.filter(c=>{ const ex=machineExpiryStatus(c,machineTypes); return ex?.status==="expiring"; }).length;
  const expiredCount  = myComps.filter(c=>{
    const ex=machineExpiryStatus(c,machineTypes);
    return c.status==="expired"||(ex&&ex.status==="expired");
  }).length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Machinery Competence</h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>Your assessed competencies for site machinery and handling equipment</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{background:"rgba(16,185,129,0.1)",borderRadius:10,padding:"8px 14px",textAlign:"center",minWidth:60}}>
            <div style={{fontSize:18,fontWeight:900,color:"#10b981"}}>{validCount}</div>
            <div style={{fontSize:10,color:Z.muted}}>Competent</div>
          </div>
          {expiringCount>0&&<div style={{background:"rgba(245,158,11,0.1)",borderRadius:10,padding:"8px 14px",textAlign:"center",minWidth:60}}>
            <div style={{fontSize:18,fontWeight:900,color:"#f59e0b"}}>{expiringCount}</div>
            <div style={{fontSize:10,color:Z.muted}}>Expiring</div>
          </div>}
          {expiredCount>0&&<div style={{background:"rgba(239,68,68,0.1)",borderRadius:10,padding:"8px 14px",textAlign:"center",minWidth:60,border:"1px solid rgba(239,68,68,0.2)"}}>
            <div style={{fontSize:18,fontWeight:900,color:"#ef4444"}}>{expiredCount}</div>
            <div style={{fontSize:10,color:Z.muted}}>Expired</div>
          </div>}
        </div>
      </div>

      {grouped.map(({cat,machines})=>{
        const active = machines.filter(m=>m.comp);
        if (!active.length) return null;
        return (
          <div key={cat} style={{marginBottom:20}}>
            <h3 style={{fontSize:11,fontWeight:800,letterSpacing:1,color:Z.muted,textTransform:"uppercase",margin:"0 0 10px"}}>{cat}</h3>
            <div style={{display:"grid",gap:10}}>
              {active.map(({type,comp})=>{
                const st = COMP_STATUS[comp.status]||COMP_STATUS.not_assessed;
                const ex = machineExpiryStatus(comp,machineTypes);
                const effectiveSt = (ex?.status==="expired"&&comp.status==="competent") ? COMP_STATUS.expired : st;
                const isOpen = expandedId===comp.id;
                return (
                  <div key={comp.id} style={{borderRadius:14,border:`1px solid ${effectiveSt.color}33`,overflow:"hidden"}}>
                    <div onClick={()=>setExpandedId(isOpen?null:comp.id)}
                      style={{padding:"14px 18px",background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,display:"flex",alignItems:"center",gap:12,cursor:"pointer",userSelect:"none"}}>
                      <span style={{fontSize:24,flexShrink:0}}>{type.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{type.label}</div>
                        <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{fontSize:11,fontWeight:700,color:effectiveSt.color,background:effectiveSt.bg,padding:"2px 9px",borderRadius:99}}>{effectiveSt.icon} {effectiveSt.label}</span>
                          {comp.assessmentDate&&<span style={{fontSize:11,color:Z.muted}}>Assessed {comp.assessmentDate}</span>}
                          {comp.licenceRef&&<span style={{fontSize:10,fontFamily:"monospace",background:"rgba(245,158,11,0.1)",color:Z.gold,padding:"2px 8px",borderRadius:6,border:"1px solid rgba(245,158,11,0.25)"}}>{comp.licenceRef}</span>}
                          {ex&&<span style={{fontSize:10,fontWeight:700,color:ex.color,background:ex.bg,padding:"2px 8px",borderRadius:6}}>
                            {ex.status==="expired"?"⚠ Expired":ex.status==="expiring"?`⏳ ${ex.label}`:`✓ ${ex.expiryDate}`}
                          </span>}
                        </div>
                      </div>
                      <span style={{color:Z.muted,fontSize:16,transform:isOpen?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s",display:"inline-block",flexShrink:0}}>›</span>
                    </div>
                    {isOpen && (
                      <div style={{borderTop:`1px solid ${Z.border}`,background:Z.overlay,padding:"16px 18px"}}>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:14}}>
                          {comp.trainerName&&<div><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"}}>Trainer</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{comp.trainerName}</div><div style={{fontSize:11,color:Z.muted}}>{comp.trainerQual}</div></div>}
                          {comp.theoryDate&&<div><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"}}>Theory Date</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{comp.theoryDate}</div></div>}
                          {comp.assessmentDate&&<div><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"}}>Practical Assessment</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{comp.assessmentDate}</div></div>}
                          {comp.licenceExpiry&&<div><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"}}>Licence Expiry</div><div style={{fontSize:13,color:ex?.status==="expired"?"#f87171":Z.white,fontWeight:600}}>{comp.licenceExpiry}</div></div>}
                        </div>
                        {comp.observationDates?.length>0&&(
                          <div style={{marginBottom:12,padding:"10px 14px",background:Z.overlay,borderRadius:10,border:`1px solid ${Z.border}`}}>
                            <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:8,textTransform:"uppercase"}}>Observation Records ({comp.observationDates.length})</div>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              {comp.observationDates.map((d,i)=>(
                                <span key={i} style={{fontSize:12,background:"rgba(37,99,235,0.12)",color:Z.accentLt,padding:"3px 10px",borderRadius:6,fontWeight:600}}>#{i+1} — {d}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {comp.notes&&<div style={{padding:"10px 14px",background:Z.overlay,borderRadius:10,border:`1px solid ${Z.border}`}}><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>Notes</div><p style={{margin:0,fontSize:13,color:Z.slate,lineHeight:1.6}}>{comp.notes}</p></div>}
                        <div style={{marginTop:10,padding:"8px 12px",background:Z.overlay,borderRadius:8}}>
                          <div style={{fontSize:10,color:Z.muted,lineHeight:1.6}}><strong style={{color:Z.white}}>About this equipment:</strong> {type.notes}{type.licenceRequired&&<span style={{color:"#f59e0b",marginLeft:6}}>· Formal licence required</span>}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!myComps.length && (
        <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:40,textAlign:"center",border:`1px solid ${Z.border}`}}>
          <div style={{fontSize:48,marginBottom:12}}>🏗</div>
          <p style={{color:Z.white,fontWeight:700,fontSize:15,margin:"0 0 6px"}}>No machinery competence records yet</p>
          <p style={{color:Z.muted,fontSize:13,margin:0}}>Your H&S manager will add records once training and assessments are completed</p>
        </div>
      )}
    </div>
  );
}


export { MachineryCompetenceTab };