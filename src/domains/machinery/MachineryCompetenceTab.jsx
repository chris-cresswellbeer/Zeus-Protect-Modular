import { useState } from "react";
import { machineState, compsFor, isWarehouseWorker, MACHINE_STATE } from "../../data/seedMachinery";
import { evidenceFiles } from "./machineEvidence";

/**
 * MachineryCompetenceTab — STAFF read-only view ("My Machinery") of the signed-in
 * warehouse worker's machine competences, grouped by category.
 *
 * DATA: machineComps = { [userId]: { [recordId]: record } } (see AdminMachineryTab).
 * Status comes from machineState() in data/seedMachinery.js: expiry is the EARLIER of
 * the renewal date (assessment date + the machine type's renewal period) and the
 * licence expiry date. Evidence files open through private links (lib/fileAccess.js):
 * a person can open their own, and their line manager can too.
 */
function MachineryCompetenceTab({ user, machineComps, allMachineTypes, allMachineCategories, Z, font }) {
  const myComps = compsFor(machineComps, user.id);
  const [expandedId, setExpandedId] = useState(null);

  if (!isWarehouseWorker(user)) return (
    <div>
      <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 8px"}}>Machinery Competence</h2>
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:48,textAlign:"center",border:`1px solid ${Z.border}`}}>
        <p style={{color:Z.white,fontWeight:700,fontSize:15,margin:"0 0 6px"}}>Machinery competence records are for warehouse and operational roles</p>
        <p style={{color:Z.muted,fontSize:13,margin:0}}>Your role ({user.jobTitle}) does not require machinery competence records. Contact your manager if you believe this is incorrect.</p>
      </div>
    </div>
  );

  const machineTypes = allMachineTypes || [];
  const machineCategories = allMachineCategories || [];
  const states = myComps.map(c => machineState(c, machineTypes));
  const count = k => states.filter(s => s && s.key === k).length;
  const tiles = [["competent","Competent"],["expiring","Expiring"],["expired","Renewal required"],["provisional","Provisional"]].filter(([k],i) => i===0 || count(k) > 0);
  const lbl = {fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"};
  const fmt = d => { const [y,m,dd] = String(d||"").slice(0,10).split("-"); return y&&m&&dd ? `${dd}/${m}/${y}` : (d||""); };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Machinery Competence</h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>The machines you're assessed on, and when each needs renewing</p>
        </div>
        <div style={{display:"flex",gap:8}} data-testid="my-machinery-tiles">
          {tiles.map(([k,label]) => (
            <div key={k} style={{background:MACHINE_STATE[k].bg,borderRadius:10,padding:"8px 14px",textAlign:"center",minWidth:60}}>
              <div style={{fontSize:18,fontWeight:900,color:MACHINE_STATE[k].color}}>{count(k)}</div>
              <div style={{fontSize:10,color:Z.muted}}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {machineCategories.map(cat=>{
        const active = machineTypes.filter(m=>m.category===cat).map(type=>({ type, comp: myComps.find(c=>c.machineId===type.id) })).filter(x=>x.comp);
        if (!active.length) return null;
        return (
          <div key={cat} style={{marginBottom:20}}>
            <h3 style={{fontSize:11,fontWeight:800,letterSpacing:1,color:Z.muted,textTransform:"uppercase",margin:"0 0 10px"}}>{cat}</h3>
            <div style={{display:"grid",gap:10}}>
              {active.map(({type,comp})=>{
                const st = machineState(comp, machineTypes);
                const ex = st.ex;
                const isOpen = expandedId===comp.id;
                const files = evidenceFiles(comp);
                return (
                  <div key={comp.id} data-testid="my-machine" style={{borderRadius:14,border:`1px solid ${st.color}44`,overflow:"hidden"}}>
                    <button type="button" onClick={()=>setExpandedId(isOpen?null:comp.id)} aria-expanded={isOpen}
                      style={{width:"100%",textAlign:"left",border:"none",padding:"14px 18px",background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,display:"flex",alignItems:"center",gap:12,cursor:"pointer",fontFamily:font,color:Z.white}}>
                      <span style={{fontSize:24,flexShrink:0}}>{type.icon}</span>
                      <span style={{flex:1}}>
                        <span style={{display:"block",fontWeight:700,fontSize:14}}>{type.label}</span>
                        <span style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{fontSize:11,fontWeight:700,color:st.color,background:st.bg,padding:"2px 9px",borderRadius:99}}>{st.sym} {st.label}</span>
                          {ex && <span style={{fontSize:11,color:ex.status==="valid"?Z.muted:ex.color,fontWeight:ex.status==="valid"?500:700}}>{ex.status==="expired"?`Expired ${fmt(ex.expiryDate)}`:`Renew by ${fmt(ex.expiryDate)}`} ({ex.why})</span>}
                          {comp.licenceRef&&<span style={{fontSize:10,fontFamily:"monospace",background:"rgba(245,158,11,0.1)",color:Z.gold,padding:"2px 8px",borderRadius:6,border:"1px solid rgba(245,158,11,0.25)"}}>{comp.licenceRef}</span>}
                        </span>
                      </span>
                      <span aria-hidden="true" style={{color:Z.muted,fontSize:16,transform:isOpen?"rotate(90deg)":"none",transition:"transform .2s",flexShrink:0}}>›</span>
                    </button>
                    {isOpen && (
                      <div style={{borderTop:`1px solid ${Z.border}`,background:Z.overlay,padding:"16px 18px"}}>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:12,marginBottom:14}}>
                          {comp.trainerName&&<div><div style={lbl}>Trainer</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{comp.trainerName}</div><div style={{fontSize:11,color:Z.muted}}>{comp.trainerQual}</div></div>}
                          {comp.theoryDate&&<div><div style={lbl}>Theory / induction</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{fmt(comp.theoryDate)}</div></div>}
                          {comp.assessmentDate&&<div><div style={lbl}>Practical assessment</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{fmt(comp.assessmentDate)}</div></div>}
                          {comp.licenceExpiry&&<div><div style={lbl}>Licence expiry</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{fmt(comp.licenceExpiry)}</div></div>}
                        </div>
                        {comp.observationDates?.length>0&&(
                          <div style={{marginBottom:12}}>
                            <div style={{...lbl,marginBottom:6}}>Observations ({comp.observationDates.length})</div>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              {comp.observationDates.map((d,i)=><span key={i} style={{fontSize:12,background:"rgba(37,99,235,0.12)",color:Z.accentLt,padding:"3px 10px",borderRadius:6,fontWeight:600}}>{fmt(d)}</span>)}
                            </div>
                          </div>
                        )}
                        {files.length>0 && (
                          <div style={{marginBottom:12}}>
                            <div style={{...lbl,marginBottom:6}}>Licence / certificate</div>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              {files.map((f,i)=> f.href
                                ? <a key={i} href={f.href} target="_blank" rel="noreferrer" download={f.legacy ? f.name : undefined} style={{fontSize:12,fontWeight:700,color:Z.accentLt}}>📎 {f.name}</a>
                                : <span key={i} style={{fontSize:12,color:Z.muted}}>📎 {f.name}</span>)}
                            </div>
                          </div>
                        )}
                        {comp.notes&&<div style={{marginBottom:10}}><div style={lbl}>Notes / restrictions</div><p style={{margin:0,fontSize:13,color:Z.slate||Z.white,lineHeight:1.6}}>{comp.notes}</p></div>}
                        {type.notes && <div style={{fontSize:11.5,color:Z.muted,lineHeight:1.6}}><strong style={{color:Z.white}}>About this equipment:</strong> {type.notes}{type.licenceRequired&&<span style={{color:"#f59e0b",marginLeft:6}}>· Formal licence required</span>}</div>}
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
          <p style={{color:Z.white,fontWeight:700,fontSize:15,margin:"0 0 6px"}}>No machinery competence records yet</p>
          <p style={{color:Z.muted,fontSize:13,margin:0}}>Your H&amp;S manager will add records once training and assessments are completed</p>
        </div>
      )}
    </div>
  );
}

export { MachineryCompetenceTab };
