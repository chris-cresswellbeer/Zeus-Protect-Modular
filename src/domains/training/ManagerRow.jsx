import { useState } from "react";
import { Avatar, Bar } from "../../shared/primitives";
import { TRAINING_MODULES } from "../../data/seedTraining";
import { EXT_CERT_TYPES } from "../../data/seedExtCerts";
import { machineExpiryStatus } from "../../data/seedMachinery";

function ManagerRow({ mgr, assigns, comps, Z, font, modules, extCerts, machineComps, allMachineTypes }) {
  const allModules = modules || TRAINING_MODULES;
  const [open, setOpen] = useState(false);
  const [expandedMember, setExpandedMember] = useState(null);
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
          <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 2fr auto",padding:"10px 22px",fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",borderBottom:`1px solid ${Z.border}`}}>
            <span>Staff Member</span><span>Outstanding Modules</span><span>Score</span><span>Progress</span><span></span>
          </div>
          {mgr.members.map((u,ui)=>{
            const assignedIds = assigns[u.id]||[];
            const userComps   = comps[u.id]||{};
            const a = assignedIds.length;
            const d = (assigns[u.id]||[]).filter(mid => userComps[mid]).length;
            const pct = a ? Math.min(100, Math.round(d/a*100)) : 0;
            const pending = allModules.filter(m=>assignedIds.includes(m.id)&&!userComps[m.id]);
            const memberColor = pct===100?Z.green:pct>=50?Z.accentLt:"#f87171";
            const isMemberOpen = expandedMember === u.id;
            return (
              <div key={u.id} style={{borderTop:ui>0?`1px solid ${Z.border}`:"none"}}>
                <div onClick={()=>setExpandedMember(isMemberOpen?null:u.id)}
                  style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 2fr auto",padding:"13px 22px",alignItems:"center",gap:12,cursor:"pointer",background:isMemberOpen?"rgba(37,99,235,0.07)":"transparent",transition:"background .15s"}}>
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
                  <span style={{color:Z.muted,fontSize:16,lineHeight:1,transition:"transform .2s",transform:isMemberOpen?"rotate(90deg)":"rotate(0deg)",display:"inline-block",flexShrink:0}}>›</span>
                </div>

                {isMemberOpen && (
                  <div style={{padding:"16px 22px 20px",background:Z.overlay,borderTop:`1px solid ${Z.border}`}}>
                    {/* External Certificates */}
                    {(() => {
                      const userExtCerts = (extCerts||{})[u.id] || {};
                      const certEntries = EXT_CERT_TYPES.filter(ct => userExtCerts[ct.id]);
                      const missingCerts = EXT_CERT_TYPES.filter(ct => !userExtCerts[ct.id]);
                      if (!certEntries.length && !missingCerts.length) return null;
                      return (
                        <div style={{marginBottom:16}}>
                          <p style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,margin:"0 0 10px",textTransform:"uppercase"}}>External Certificates</p>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                            {EXT_CERT_TYPES.map(ct => {
                              const cert = userExtCerts[ct.id];
                              const isExpired = cert?.expiryDate && new Date(cert.expiryDate) < new Date();
                              const daysLeft = cert?.expiryDate ? Math.ceil((new Date(cert.expiryDate) - new Date()) / 86400000) : null;
                              return (
                                <div key={ct.id} style={{background:cert?(isExpired?"rgba(239,68,68,0.08)":"rgba(16,185,129,0.08)"):"rgba(255,255,255,0.03)",border:`1px solid ${cert?(isExpired?"rgba(239,68,68,0.25)":"rgba(16,185,129,0.25)"):"rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
                                  <span style={{fontSize:20,flexShrink:0}}>{ct.icon}</span>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontWeight:700,fontSize:12,color:Z.white}}>{ct.label}</div>
                                    {cert ? (
                                      <>
                                        <div style={{fontSize:10,color:isExpired?"#f87171":Z.green,marginTop:2}}>{isExpired?"⚠ Expired":daysLeft<=30?`⏳ ${daysLeft}d left`:"✓ Valid"}</div>
                                        <div style={{fontSize:10,color:Z.muted}}>Expires: {cert.expiryDate||"—"}</div>
                                      </>
                                    ) : (
                                      <div style={{fontSize:10,color:"#f87171",marginTop:2}}>⚠ Not uploaded</div>
                                    )}
                                  </div>
                                  {cert && (
                                    <a href={cert.fileUrl} target="_blank" rel="noreferrer"
                                      style={{fontSize:11,color:Z.accentLt,textDecoration:"none",fontWeight:700,flexShrink:0}}>View</a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Machinery Competence */}
                    {(() => {
                      const userMachComps = Object.values((machineComps||{})[u.id]||{});
                      if (!userMachComps.length) return null;
                      const machineTypes = allMachineTypes || [];
                      return (
                        <div>
                          <p style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,margin:"0 0 10px",textTransform:"uppercase"}}>Machinery Competence</p>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
                            {userMachComps.map(comp => {
                              const mType = machineTypes.find(m=>m.id===comp.machineId) || {label:comp.machineId, icon:"🔧"};
                              const ex = machineExpiryStatus(comp, machineTypes);
                              const isExpired = comp.status==="expired" || ex?.status==="expired";
                              const isProvisional = comp.status==="provisional";
                              const bg = isExpired?"rgba(239,68,68,0.08)":isProvisional?"rgba(245,158,11,0.08)":"rgba(16,185,129,0.08)";
                              const border = isExpired?"rgba(239,68,68,0.25)":isProvisional?"rgba(245,158,11,0.25)":"rgba(16,185,129,0.25)";
                              const statusColor = isExpired?"#f87171":isProvisional?Z.amber:Z.green;
                              return (
                                <div key={comp.id} style={{background:bg,border:`1px solid ${border}`,borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
                                  <span style={{fontSize:20,flexShrink:0}}>{mType.icon}</span>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontWeight:700,fontSize:12,color:Z.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{mType.label}</div>
                                    <div style={{fontSize:10,color:statusColor,marginTop:2}}>
                                      {isExpired?"⚠ Renewal required":isProvisional?"⏳ Provisional":"✓ Competent"}
                                    </div>
                                    {comp.licenceExpiry && <div style={{fontSize:10,color:Z.muted}}>Licence expires: {comp.licenceExpiry}</div>}
                                    {comp.licenceRef && <div style={{fontSize:9,fontFamily:"monospace",color:Z.gold,marginTop:1}}>{comp.licenceRef}</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export { ManagerRow };