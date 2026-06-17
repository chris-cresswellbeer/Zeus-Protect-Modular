import { useState } from "react";

function AdminDSETab({ staff, dseReports, adminResponses, setAdminResponses, darkMode, Z, font }) {
  const [expandedUser, setExpandedUser] = useState(null);

  const completedCount = staff.filter(u=>(dseReports[u.id]||[]).length>0).length;
  const totalIssues = staff.reduce((s,u)=>{ const r=dseReports[u.id]; return s+(r?.length?r[r.length-1].issueCount:0); },0);
  const resolvedCount = staff.reduce((s,u)=>{
    const reports=dseReports[u.id]||[]; if(!reports.length) return s;
    const ri=reports.length-1; const resp=adminResponses[u.id]||{};
    return s+reports[ri].issues.filter((_,ii)=>resp[`${ri}_${ii}`]?.resolved).length;
  },0);

  function getResp(uid,ri,ii){ return (adminResponses[uid]||{})[`${ri}_${ii}`]||{comment:"",resolved:false}; }
  function setResp(uid,ri,ii,patch){
    setAdminResponses(prev=>{
      const key=`${ri}_${ii}`;
      const cur=(prev[uid]||{})[key]||{comment:"",resolved:false};
      return {...prev,[uid]:{...(prev[uid]||{}),[key]:{...cur,...patch}}};
    });
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:16}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>DSE Assessment Reports</h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>Click a staff member to expand their assessment — add responses and mark issues resolved</p>
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <StatCard icon="🖥️" val={`${completedCount}/${staff.length}`} label="Assessments Done" accent="#8b5cf6" Z={Z}/>
          <StatCard icon="⚠️" val={totalIssues} label="Total Issues" accent={Z.red} Z={Z}/>
          <StatCard icon="✅" val={resolvedCount} label="Resolved" accent={Z.green} Z={Z}/>
        </div>
      </div>

      {completedCount===0 ? (
        <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:48,textAlign:"center",border:`1px solid ${Z.border}`}}>
          <div style={{fontSize:48,marginBottom:12}}>🖥️</div>
          <p style={{color:Z.muted,fontSize:14,margin:0}}>No DSE assessments submitted yet.<br/>Staff complete their assessment from the Training tab.</p>
        </div>
      ) : (
        <div style={{display:"grid",gap:10}}>
          {staff.map(u=>{
            const reports=dseReports[u.id]||[];
            if(!reports.length) return null;
            const ri=reports.length-1;
            const latest=reports[ri];
            const hasIssues=latest.issueCount>0;
            const allResolved=hasIssues && latest.issues.every((_,ii)=>getResp(u.id,ri,ii).resolved);
            const resolvedHere=latest.issues.filter((_,ii)=>getResp(u.id,ri,ii).resolved).length;
            const isOpen = expandedUser === u.id;

            return (
              <div key={u.id} style={{borderRadius:16,border:`1px solid ${allResolved?"rgba(16,185,129,0.35)":hasIssues?"rgba(239,68,68,0.25)":"rgba(16,185,129,0.2)"}`,overflow:"hidden",transition:"border-color .2s"}}>

                {/* ── Collapsed header row (always visible) ── */}
                <div
                  onClick={()=>setExpandedUser(isOpen?null:u.id)}
                  style={{padding:"14px 20px",background:isOpen?`rgba(37,99,235,0.08)`:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:"background .15s",userSelect:"none"}}
                >
                  <Avatar name={u.name} size={36}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:14,color:Z.white}}>{u.name}</div>
                    <div style={{color:Z.muted,fontSize:11,marginTop:1}}>{u.jobTitle||""}{u.jobTitle?" · ":""}{`Submitted ${latest.date}`}</div>
                  </div>

                  {/* Status summary pills */}
                  <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                    {!hasIssues && <Pill label="All Clear ✓" col="green"/>}
                    {hasIssues && allResolved && <Pill label="✓ All Resolved" col="green"/>}
                    {hasIssues && !allResolved && (
                      <>
                        <Pill label={`${latest.issueCount - resolvedHere} open`} col="red"/>
                        {resolvedHere>0 && <Pill label={`${resolvedHere} resolved`} col="green"/>}
                      </>
                    )}
                    {reports.length>1 && <span style={{color:Z.muted,fontSize:11}}>{reports.length} assessments</span>}
                  </div>

                  {/* Chevron */}
                  <span style={{color:Z.muted,fontSize:18,lineHeight:1,display:"inline-block",transition:"transform .25s",transform:isOpen?"rotate(90deg)":"rotate(0deg)",marginLeft:4,flexShrink:0}}>›</span>
                </div>

                {/* ── Expanded body ── */}
                {isOpen && (
                  <div style={{borderTop:`1px solid ${Z.border}`,background:Z.overlay}}>
                    {!hasIssues ? (
                      <div style={{padding:"16px 24px"}}>
                        <p style={{color:Z.green,fontSize:13,fontWeight:600,margin:0}}>✓ All {latest.totalQuestions} workstation questions answered satisfactorily. No action required.</p>
                      </div>
                    ) : (
                      <div style={{padding:"20px 24px"}}>
                        <p style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,margin:"0 0 14px",textTransform:"uppercase"}}>
                          {latest.issueCount} Issue{latest.issueCount!==1?"s":""} — respond below and mark as resolved when actioned
                        </p>
                        <div style={{display:"grid",gap:12}}>
                          {latest.issues.map((issue,ii)=>{
                            const resp=getResp(u.id,ri,ii);
                            const resolved=resp.resolved;
                            return (
                              <div key={ii} style={{borderRadius:14,border:`1px solid ${resolved?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.22)"}`,overflow:"hidden",transition:"border-color .2s"}}>
                                {/* Issue header */}
                                <div style={{padding:"14px 18px",background:resolved?"rgba(16,185,129,0.07)":"rgba(239,68,68,0.06)",display:"flex",alignItems:"flex-start",gap:12}}>
                                  <div style={{flex:1}}>
                                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                                      <span style={{fontSize:15}}>{issue.sectionIcon}</span>
                                      <span style={{fontSize:10,fontWeight:700,letterSpacing:1,color:resolved?Z.green:"#f87171",textTransform:"uppercase"}}>{issue.section}</span>
                                      {resolved && <span style={{fontSize:11,color:Z.green,fontWeight:700}}>✓ RESOLVED</span>}
                                    </div>
                                    <p style={{fontWeight:600,fontSize:13,margin:"0 0 4px",color:Z.white,lineHeight:1.5}}>{issue.question}</p>
                                    <p style={{fontSize:11,color:Z.muted,margin:0,lineHeight:1.5}}>⚠ {issue.risk}</p>
                                  </div>
                                  <button
                                    onClick={()=>setResp(u.id,ri,ii,{resolved:!resolved})}
                                    style={{flexShrink:0,background:resolved?`linear-gradient(135deg,${Z.green},#059669)`:Z.overlay,border:`1px solid ${resolved?"transparent":Z.borderMd}`,borderRadius:10,padding:"8px 16px",color:resolved?"#fff":Z.muted,fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:font,whiteSpace:"nowrap",transition:"all .2s"}}>
                                    {resolved?"✓ Resolved":"Mark Resolved"}
                                  </button>
                                </div>
                                {/* Staff comment */}
                                {issue.comment && (
                                  <div style={{padding:"10px 18px",background:"rgba(245,158,11,0.06)",borderTop:"1px solid rgba(245,158,11,0.15)",display:"flex",gap:8,alignItems:"flex-start"}}>
                                    <span style={{fontSize:14,flexShrink:0}}>💬</span>
                                    <div>
                                      <div style={{fontSize:10,fontWeight:700,letterSpacing:0.5,color:Z.gold,marginBottom:2}}>STAFF COMMENT</div>
                                      <div style={{fontSize:12,color:Z.slate,lineHeight:1.6}}>{issue.comment}</div>
                                    </div>
                                  </div>
                                )}
                                {/* Admin response */}
                                <div style={{padding:"12px 18px",background:Z.overlay,borderTop:`1px solid ${Z.border}`}}>
                                  <div style={{fontSize:10,fontWeight:700,letterSpacing:0.5,color:Z.muted,marginBottom:6}}>ADMIN RESPONSE</div>
                                  <textarea
                                    value={resp.comment}
                                    onChange={e=>setResp(u.id,ri,ii,{comment:e.target.value})}
                                    placeholder="Add your response, action taken, or follow-up note..."
                                    rows={2}
                                    style={{width:"100%",background:Z.overlay,border:`1px solid ${resp.comment?"rgba(37,99,235,0.4)":Z.borderMd}`,borderRadius:8,padding:"8px 12px",color:Z.white,fontSize:12,fontFamily:font,outline:"none",resize:"vertical",boxSizing:"border-box",lineHeight:1.6,transition:"border-color .2s"}}
                                  />
                                  {resp.comment && (
                                    <p style={{fontSize:11,color:Z.muted,margin:"4px 0 0"}}>Response saved · visible to {u.name.split(" ")[0]}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {!allResolved && (
                          <div style={{marginTop:16,padding:"12px 16px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,fontSize:12,color:Z.gold}}>
                            <strong>Action required:</strong> {latest.issues.filter((_,ii)=>!getResp(u.id,ri,ii).resolved).length} unresolved issue{latest.issues.filter((_,ii)=>!getResp(u.id,ri,ii).resolved).length!==1?"s":""} remaining. Contact {u.name.split(" ")[0]} to arrange a workstation review under DSE Regulations 1992.
                          </div>
                        )}
                        {allResolved && (
                          <div style={{marginTop:16,padding:"12px 16px",background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:10,fontSize:12,color:Z.green}}>
                            ✓ All issues for {u.name.split(" ")[0]} have been marked as resolved.
                          </div>
                        )}
                      </div>
                    )}
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


export { AdminDSETab };
