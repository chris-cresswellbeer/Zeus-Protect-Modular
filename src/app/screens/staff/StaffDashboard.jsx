/**
 * StaffDashboard.jsx — the staff dashboard: what to do next, compliance, due training
 * Part of app/screens/StaffPortal.jsx. Reads the app's shared state with useApp() (app/AppContext.js).
 */
import { DSE_QUESTION_COUNT } from "../../../data/seedDse";
import { isQuickReportOverdue, quickReportDueLabel } from "../../../domains/incidents/quickReportStatus";
import { scoreText } from "../../../domains/training/completion";
import { EXPIRY_WARNING_DAYS, getExpiryStatus, ukDate } from "../../../lib/dates";
import { dueText, formatDue } from "../../../lib/dueDates";
import { getProgress, resumeLabel } from "../../../lib/moduleProgress";
import { HelpTip } from "../../../shared/HelpTip";
import { useApp } from "../../AppContext";
import { myOverview } from "./myOverview";

export function StaffDashboard() {
  const app = useApp();
  const {
    dseDraft, font, openDse, setShowQuickReport, setStab, startMod, T, user
  } = app;
  const {
    dseCompleted, dseExpired, dseExpiring, dseExpiryStatus, dseIssueCount, dseNeedsAction, dseResolvedCount,
    dueSoon, expired, expiredCerts, expiring, expiringCerts, healthColor, healthLabel, healthPct,
    lastDseReport, myC, myDue, myExtCerts, myMods, myQuickToComplete, nextUp, notStarted, openQuickReport,
    pastDue, totalActionNeeded, unreadDocs, upToDate
  } = myOverview(app);
  return (
      <div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:4}}>
          <h1 style={{fontSize:26,fontWeight:900,letterSpacing:-.5,margin:0}}>Welcome back, {user.name.split(" ")[0]} <HelpTip dark={true} text="Your personal H&S summary. The tiles show outstanding training, documents awaiting your confirmation, and any open actions assigned to you. Overdue items are highlighted — complete them to keep your record up to date."/></h1>
          <button onClick={()=>setShowQuickReport(true)}
            style={{display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",cursor:"pointer",fontFamily:font,fontWeight:800,fontSize:13,boxShadow:"0 4px 16px rgba(245,158,11,0.4)",flexShrink:0,whiteSpace:"nowrap"}}>
            ⚠ Report a Hazard
          </button>
        </div>
        <p style={{color:T.muted,margin:"0 0 24px",fontSize:13}}>{user.jobTitle||""}{user.jobTitle?" · ":""}{user.email}</p>

        {/* Health score banner */}
        <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:"18px 24px",marginBottom:20,border:`1px solid ${healthColor}44`,display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:`${healthColor}18`,border:`3px solid ${healthColor}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:22,fontWeight:900,color:healthColor}}>{healthPct}%</span>
          </div>
          <div style={{flex:1,minWidth:120}}>
            <div style={{fontWeight:800,fontSize:16,color:healthColor,marginBottom:2}}>{healthLabel}</div>
            <div style={{fontSize:12,color:T.muted}}>Your overall H&S training compliance score</div>
            <div style={{marginTop:8,height:6,background:T.overlay,borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${healthPct}%`,background:`linear-gradient(90deg,${healthColor},${healthColor}aa)`,borderRadius:99,transition:"width .6s"}}/>
            </div>
          </div>
          {totalActionNeeded>0 && (
            <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"8px 16px",textAlign:"center",flexShrink:0}}>
              <div style={{fontSize:22,fontWeight:900,color:"#f87171"}}>{totalActionNeeded}</div>
              <div style={{fontSize:11,color:"#f87171",fontWeight:700}}>Need Attention</div>
            </div>
          )}
        </div>

        {/* Stat tiles */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:24}}>
          {[
            { label:"Assigned",   value:myMods.length,          color:T.accentLt,    sub:"modules total", go:"training" },
            { label:"Up to Date", value:upToDate.length,         color:"#10b981",     sub:"completed & valid", go:"history" },
            { label:"Not Started",value:notStarted.length,       color:pastDue.length>0?"#ef4444":notStarted.length>0?"#f59e0b":"#10b981", sub:pastDue.length?`${pastDue.length} past due date`:"awaiting completion", go:"training" },
            { label:"Expired",    value:expired.length,          color:expired.length>0?"#ef4444":"#10b981",    sub:"need renewal", go:"training" },
            { label:"Expiring",   value:expiring.length,         color:expiring.length>0?"#f59e0b":"#10b981",   sub:`within ${EXPIRY_WARNING_DAYS} days`, go:"training" },
            { label:"Documents",  value:unreadDocs.length,       color:unreadDocs.length>0?"#f59e0b":"#10b981", sub:"need acknowledgement", go:"documents" },
          ].map((s,i)=>(
            // each figure opens the page behind it (click, or Tab + Enter)
            <div key={i} role="button" tabIndex={0} data-testid="dash-figure" onClick={()=>setStab(s.go)} onKeyDown={e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); setStab(s.go); } }}
              aria-label={`${s.label}: ${s.value} ${s.sub}. Open ${s.go==="history"?"History":s.go==="documents"?"Documents":"My Training"}.`} title={`Open ${s.go==="history"?"History":s.go==="documents"?"Documents":"My Training"}`}
              style={{background:T.overlay,borderRadius:12,padding:"14px 16px",cursor:"pointer",border:`1px solid ${s.value>0&&s.color!=="#10b981"?s.color+"44":T.borderMd}`}}>
              <div style={{fontSize:22,fontWeight:900,color:s.color,lineHeight:1,marginBottom:3}}>{s.value}</div>
              <div style={{fontSize:12,fontWeight:700,color:T.white}}>{s.label}</div>
              <div style={{fontSize:10,color:T.muted,marginTop:1}}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Alerts — expired / expiring */}
        {(myQuickToComplete.length>0||pastDue.length>0||dueSoon.length>0||expired.length>0||expiring.length>0||expiredCerts.length>0||expiringCerts.length>0||unreadDocs.length>0||dseNeedsAction||dseExpiring) && (
          <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:14,padding:"16px 20px",marginBottom:20}}>
            <div style={{fontWeight:800,fontSize:13,color:"#f87171",marginBottom:10}}>⚠ Action Required</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {myQuickToComplete.map(inc=>{ const late=isQuickReportOverdue(inc); const qc=late?T.red:T.amber; return (
                <div key={inc.id} style={{display:"flex",alignItems:"center",gap:12,background:`${qc}14`,borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>openQuickReport(inc)}>
                  <span style={{fontSize:20}}>⚡</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>Finish your hazard report — {inc.location}</div>
                    <div style={{fontSize:11,color:qc}}>Quick report from {ukDate(inc.date)} needs full details · {quickReportDueLabel(inc)}</div>
                  </div>
                  <button style={{background:qc,border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Complete →</button>
                </div>
              ); })}
              {!dseCompleted && (
                <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(139,92,246,0.1)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={openDse}>
                  <span style={{fontSize:20}}>🖥️</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>DSE Workstation Self-Assessment</div>
                    <div style={{fontSize:11,color:"#c4b5fd"}}>{dseDraft?`In progress — ${Object.keys(dseDraft.answers||{}).length} of ${DSE_QUESTION_COUNT} questions answered`:"Required — DSE Regulations 1992 · not yet completed"}</div>
                  </div>
                  <button style={{background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>{dseDraft?"Continue →":"Start →"}</button>
                </div>
              )}
              {dseExpired && (
                <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={openDse}>
                  <span style={{fontSize:20}}>🖥️</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>DSE Workstation Self-Assessment</div>
                    <div style={{fontSize:11,color:"#f87171"}}>Annual re-assessment due — last completed {ukDate(lastDseReport.date)}{dseDraft?` · in progress, ${Object.keys(dseDraft.answers||{}).length} of ${DSE_QUESTION_COUNT} answered`:""}</div>
                  </div>
                  <button style={{background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>{dseDraft?"Continue →":"Retake →"}</button>
                </div>
              )}
              {dseExpiring && !dseExpired && (
                <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px"}}>
                  <span style={{fontSize:20}}>🖥️</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>DSE Workstation Self-Assessment</div>
                    <div style={{fontSize:11,color:"#f59e0b"}}>{dseExpiryStatus?.label} — annual re-assessment due soon</div>
                  </div>
                </div>
              )}
              {[...pastDue, ...dueSoon].map(m=>{ const d=myDue(m); const col=d.overdue?"#f87171":"#fbbf24"; const p=getProgress(user.id,m); return (
                <div key={"due"+m.id} data-testid="due-item" style={{display:"flex",alignItems:"center",gap:12,background:d.overdue?"rgba(239,68,68,0.1)":"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>startMod(m)}>
                  <span style={{fontSize:20}}>{m.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>{m.title}</div>
                    <div style={{fontSize:11,color:col}}>{dueText(d)}{d.overdue?` — it was due ${formatDue(d.due)}`:""}{p?` · ${resumeLabel(p).toLowerCase()}`:""}</div>
                  </div>
                  <button style={{background:d.overdue?"linear-gradient(135deg,#ef4444,#dc2626)":"rgba(245,158,11,0.15)",border:d.overdue?"none":"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:"5px 14px",color:d.overdue?"#fff":"#f59e0b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>{p?"Carry on →":"Start →"}</button>
                </div>
              ); })}
              {expired.map(m=>(
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>startMod(m)}>
                  <span style={{fontSize:20}}>{m.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>{m.title}</div>
                    <div style={{fontSize:11,color:"#f87171"}}>Certificate expired — renewal required</div>
                  </div>
                  <button style={{background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Retake →</button>
                </div>
              ))}
              {expiring.map(m=>{ const ex=getExpiryStatus(myC[m.id].date,m.renewalMonths); return (
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>startMod(m)}>
                  <span style={{fontSize:20}}>{m.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>{m.title}</div>
                    <div style={{fontSize:11,color:"#f59e0b"}}>{ex?.label} — plan your renewal</div>
                  </div>
                  <button style={{background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:"5px 14px",color:"#f59e0b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Renew →</button>
                </div>
              );})}
              {expiredCerts.map(ct=>(
                <div key={ct.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 12px"}}>
                  <span style={{fontSize:20}}>{ct.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>{ct.label} Certificate</div>
                    <div style={{fontSize:11,color:"#f87171"}}>External certificate expired — speak to your manager</div>
                  </div>
                </div>
              ))}
              {expiringCerts.map(ct=>{ const d=Math.ceil((new Date(myExtCerts[ct.id].expiryDate)-new Date())/86400000); return (
                <div key={ct.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px"}}>
                  <span style={{fontSize:20}}>{ct.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>{ct.label} Certificate</div>
                    <div style={{fontSize:11,color:"#f59e0b"}}>Expires in {d} day{d!==1?"s":""} — arrange renewal with your manager</div>
                  </div>
                </div>
              );})}
              {unreadDocs.length>0 && (
                <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>setStab("documents")}>
                  <span style={{fontSize:20}}>📄</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.white}}>{unreadDocs.length} document{unreadDocs.length!==1?"s":""} need your acknowledgement</div>
                    <div style={{fontSize:11,color:"#f59e0b"}}>Go to Documents to review and confirm</div>
                  </div>
                  <button style={{background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:"5px 14px",color:"#f59e0b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Review →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next up */}
        {nextUp && (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,letterSpacing:.8,textTransform:"uppercase",marginBottom:10}}>Up Next</div>
            <div onClick={()=>startMod(nextUp)} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"16px 20px",border:`1px solid ${T.accent}55`,cursor:"pointer",display:"flex",alignItems:"center",gap:16}}>
              <span style={{fontSize:32}}>{nextUp.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:15,color:T.white,marginBottom:2}}>{nextUp.title}</div>
                <div style={{fontSize:12,color:T.muted}}>{nextUp.category} · {nextUp.duration} · <span style={{color:nextUp.level==="Mandatory"?"#f87171":T.accentLt}}>{nextUp.level}</span></div>
              </div>
              <button style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,border:"none",borderRadius:10,padding:"9px 20px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Start →</button>
            </div>
          </div>
        )}

        {/* All modules — compact list */}
        <div style={{marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:12,fontWeight:700,color:T.muted,letterSpacing:.8,textTransform:"uppercase"}}>All Assigned Modules</div>
          <button onClick={()=>setStab("training")} style={{background:"none",border:"none",color:T.accentLt,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>View all →</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {/* DSE row */}
          {(()=>{
            const dseStatusColor = !dseCompleted?"#8b5cf6":dseExpired?"#ef4444":dseExpiring?"#f59e0b":"#10b981";
            const dseStatusLabel = dseDraft?"In progress":!dseCompleted?"Not completed":dseExpired?"Re-assessment due":dseExpiring?dseExpiryStatus?.label:"Completed";
            return (
              <div onClick={openDse}
                style={{background:T.overlay,border:`1px solid ${dseExpired?"rgba(239,68,68,0.25)":T.borderMd}`,borderRadius:10,padding:"10px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.navyMd}
                onMouseLeave={e=>e.currentTarget.style.background=T.overlay}>
                <span style={{fontSize:22,flexShrink:0}}>🖥️</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:T.white}}>DSE Workstation Self-Assessment</div>
                  <div style={{fontSize:11,color:T.muted}}>Display Screen Equipment · DSE Regulations 1992 · Annual</div>
                </div>
                {dseCompleted && dseIssueCount>0 && <span style={{fontSize:11,color:T.muted}}>{dseResolvedCount}/{dseIssueCount} issues</span>}
                {dseCompleted && <span style={{fontSize:11,color:T.muted}}>{ukDate(lastDseReport.date)}</span>}
                <span style={{fontSize:11,fontWeight:700,color:dseStatusColor,background:`${dseStatusColor}18`,border:`1px solid ${dseStatusColor}33`,borderRadius:6,padding:"2px 8px",whiteSpace:"nowrap",flexShrink:0}}>{dseStatusLabel}</span>
              </div>
            );
          })()}
          {myMods.map(m=>{
            const isDone = !!myC[m.id];
            const ex = isDone&&m.renewalMonths ? getExpiryStatus(myC[m.id].date,m.renewalMonths) : null;
            const isExpired  = ex?.status==="expired";
            const isExpiring = ex?.status==="expiring";
            const statusColor = !isDone?"#f59e0b":isExpired?"#ef4444":isExpiring?"#f59e0b":"#10b981";
            const statusLabel = !isDone?"Not started":isExpired?"Expired":isExpiring?ex.label:"Completed";
            return (
              <div key={m.id} onClick={()=>startMod(m)} style={{background:T.overlay,border:`1px solid ${isExpired?"rgba(239,68,68,0.25)":T.borderMd}`,borderRadius:10,padding:"10px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.navyMd}
                onMouseLeave={e=>e.currentTarget.style.background=T.overlay}>
                <span style={{fontSize:22,flexShrink:0}}>{m.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:T.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title}</div>
                  <div style={{fontSize:11,color:T.muted}}>{m.category} · {m.duration}</div>
                </div>
                {isDone && <span style={{fontSize:11,color:T.muted}}>{scoreText(myC[m.id])}</span>}
                <span style={{fontSize:11,fontWeight:700,color:statusColor,background:`${statusColor}18`,border:`1px solid ${statusColor}33`,borderRadius:6,padding:"2px 8px",whiteSpace:"nowrap",flexShrink:0}}>{statusLabel}</span>
              </div>
            );
          })}
          {myMods.length===0 && <div style={{color:T.muted,fontSize:14,padding:"24px 0",textAlign:"center"}}>No training modules assigned yet. Check back soon.</div>}
        </div>
      </div>
    );
}
