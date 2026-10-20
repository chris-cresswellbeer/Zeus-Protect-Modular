/**
 * MyTrainingTab.jsx — My Training: assigned modules, resume, certificates
 * Part of app/screens/StaffPortal.jsx. Reads the app's shared state with useApp() (app/AppContext.js).
 */
import { isPassed, scoreText } from "../../../domains/training/completion";
import { getExpiryStatus, ukDate } from "../../../lib/dates";
import { dueText, formatDue } from "../../../lib/dueDates";
import { getProgress, resumeLabel } from "../../../lib/moduleProgress";
import { HelpTip } from "../../../shared/HelpTip";
import { Bar, Pill } from "../../../shared/primitives";
import { useApp } from "../../AppContext";
import { myOverview } from "./myOverview";

export function MyTrainingTab() {
  const app = useApp();
  const {
    adminResponses, dseDraft, dseReports, font, openDse, setCert, startMod, T, user
  } = app;
  const {
    byDue, myC, myDue, myMods
  } = myOverview(app);
  return (
      <div>
        <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:24}}>My Assigned Training <HelpTip dark={true} text="Modules assigned to you by your manager. Work through each one at your own pace — you'll need to pass the quiz at the end to receive your certificate. Modules with an expiry date will need to be repeated periodically."/></h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
          {/* not done first, soonest due date first; then completed */}
          {[...myMods].sort((a,b)=>(!!myC[a.id])-(!!myC[b.id]) || byDue(a,b)).map(m=>{
            const isDone = !!myC[m.id];
            const due = myDue(m), prog = !isDone ? getProgress(user.id, m) : null;
            return (
              <div key={m.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:18,padding:24,border:`1px solid ${isDone?"rgba(16,185,129,0.25)":T.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                  <span style={{fontSize:36}}>{m.icon}</span>
                  <Pill label={isDone?"Completed":due&&due.overdue?"Overdue":"Pending"} col={isDone?"green":due&&due.overdue?"red":"amber"}/>
                </div>
                {due && <div data-testid="due-label" style={{display:"inline-block",fontSize:11,fontWeight:800,color:due.overdue?"#f87171":due.soon?"#fbbf24":T.muted,background:due.overdue?"rgba(239,68,68,0.1)":due.soon?"rgba(245,158,11,0.1)":T.overlay,border:`1px solid ${due.overdue?"rgba(239,68,68,0.35)":due.soon?"rgba(245,158,11,0.3)":T.borderMd}`,borderRadius:99,padding:"2px 10px",marginBottom:8}}>{dueText(due)}{due.overdue||due.days>14?"":` · ${formatDue(due.due)}`}</div>}
                <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:800}}>{m.title}</h3>
                <p style={{color:T.muted,fontSize:12,margin:"0 0 14px"}}>{m.category} · {m.duration} · <span style={{color:m.level==="Mandatory"?"#f87171":T.accentLt}}>{m.level}</span>{m.renewalLabel&&<span style={{color:T.muted}}> · 🔄 {m.renewalLabel} renewal</span>}</p>
                {isDone && (
                  <div style={{marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <Bar pct={myC[m.id].recorded?100:myC[m.id].score} color={isPassed(myC[m.id])?T.green:T.amber}/>
                      <span style={{color:isPassed(myC[m.id])?T.green:T.amber,fontWeight:700,fontSize:13}}>{scoreText(myC[m.id])}</span>
                    </div>
                    <p style={{color:T.muted,fontSize:11,margin:"0 0 6px"}}>Completed {ukDate(myC[m.id].date)}{myC[m.id].recorded?(myC[m.id].recorded.session?" · in a group session":" · from your earlier training records"):""}</p>
                    {m.renewalMonths && (() => {
                      const ex = getExpiryStatus(myC[m.id].date, m.renewalMonths);
                      if (!ex) return null;
                      return (
                        <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:99,background:ex.bg,border:`1px solid ${ex.color}44`,fontSize:11,fontWeight:700,color:ex.color}}>
                          {ex.status==="expired"?"⚠":ex.status==="expiring"?"⏳":"✓"} {ex.label}
                          <span style={{fontWeight:400,color:T.muted,fontSize:10}}>· Renews every {m.renewalLabel}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>startMod(m)}
                    style={{flex:1,
                      background: isDone
                        ? (()=>{ const ex=m.renewalMonths?getExpiryStatus(myC[m.id].date,m.renewalMonths):null;
                            return ex&&ex.status!=="valid" ? `linear-gradient(135deg,${T.accent},${T.blue})` : T.overlay; })()
                        : `linear-gradient(135deg,${T.accent},${T.blue})`,
                      color: isDone
                        ? (()=>{ const ex=m.renewalMonths?getExpiryStatus(myC[m.id].date,m.renewalMonths):null;
                            return ex&&ex.status!=="valid" ? "#fff" : T.white; })()
                        : "#fff",
                      border: isDone
                        ? (()=>{ const ex=m.renewalMonths?getExpiryStatus(myC[m.id].date,m.renewalMonths):null;
                            return ex&&ex.status!=="valid" ? "none" : `1px solid ${T.borderMd}`; })()
                        : "none",
                      borderRadius:10,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:font}}>
                    {isDone?(()=>{const ex=m.renewalMonths?getExpiryStatus(myC[m.id].date,m.renewalMonths):null; return ex&&ex.status==="expired"?"Renew Now →":ex&&ex.status==="expiring"?"Renew Soon →":"Review Module"})():prog?`${resumeLabel(prog)} →`:"Start →"}
                  </button>
                  {isDone && !myC[m.id].recorded && (
                    <button onClick={()=>setCert({module:m,score:myC[m.id].score,date:myC[m.id].date,certId:myC[m.id].certId||null,moduleVersion:myC[m.id].moduleVersion||null})}
                      aria-label={`Certificate: ${m.title}`} title="Certificate"
                      style={{background:"rgba(245,158,11,0.12)",color:T.gold,border:`1px solid rgba(245,158,11,0.3)`,borderRadius:10,padding:"10px 14px",fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:font}}>
                      🏅
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* DSE Assessment Card */}
          {(()=>{
            const myDseReports = dseReports[user.id]||[];
            const lastReport = myDseReports[myDseReports.length-1];
            const lastRi = myDseReports.length - 1;
            const myAdminResps = adminResponses[user.id] || {};
            const resolvedCount = lastReport ? lastReport.issues.filter((_,ii) => myAdminResps[`${lastRi}_${ii}`]?.resolved).length : 0;
            const allResolved = lastReport && lastReport.issueCount > 0 && resolvedCount === lastReport.issueCount;
            return (
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:18,padding:24,border:`1px solid ${allResolved?"rgba(16,185,129,0.4)":lastReport?"rgba(16,185,129,0.25)":"rgba(139,92,246,0.3)"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                  <span style={{fontSize:36}}>🖥️</span>
                  <Pill label={allResolved?"✓ All Resolved":lastReport?"Completed":"Required"} col={allResolved?"green":lastReport?"green":"amber"}/>
                </div>
                <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:800,color:T.white}}>DSE Workstation Self-Assessment</h3>
                <p style={{color:T.muted,fontSize:12,margin:"0 0 14px"}}>Display Screen Equipment · DSE Regulations 1992 · Mandatory</p>
                {lastReport && (
                  <div style={{marginBottom:14}}>
                    {lastReport.issueCount > 0 ? (
                      <p style={{color:allResolved?T.green:resolvedCount>0?T.amber:"#f87171",fontSize:12,fontWeight:700,margin:"0 0 2px"}}>
                        {allResolved ? "All issues resolved ✓" : `${resolvedCount}/${lastReport.issueCount} issues resolved`}
                      </p>
                    ) : (
                      <p style={{color:T.green,fontSize:12,fontWeight:700,margin:"0 0 2px"}}>No issues found ✓</p>
                    )}
                    <p style={{color:T.muted,fontSize:11,margin:0}}>Last completed: {ukDate(lastReport.date)}</p>
                  </div>
                )}
                <button onClick={openDse}
                  style={{width:"100%",background:lastReport?T.overlay:`linear-gradient(135deg,#8b5cf6,#7c3aed)`,color:lastReport?"#8b5cf6":"#fff",border:lastReport?`1px solid ${T.borderMd}`:"none",borderRadius:10,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:font}}>
                  {dseDraft?"Continue Assessment →":lastReport?"Retake Assessment →":"Start Assessment →"}
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    );
}
