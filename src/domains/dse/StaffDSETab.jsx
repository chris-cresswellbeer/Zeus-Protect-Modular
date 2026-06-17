import { useWindowWidth } from "../../shared/hooks";
import { HelpTip } from "../../shared/HelpTip";

function StaffDSETab({ user, dseReports, adminResponses, setDseAnswers, setDseComments, setDseSection, setDseSubmitted, setDseActive, Z, font }) {
  const myReports   = dseReports[user.id] || [];
  const latestReport = myReports[myReports.length - 1];
  const latestRi    = myReports.length - 1;
  const myAdminResps = adminResponses[user.id] || {};

  const startAssessment = () => {
    setDseAnswers({}); setDseComments({}); setDseSection(0); setDseSubmitted(false); setDseActive(true);
  };

  if (!latestReport) {
    return (
      <div>
        <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:8}}>My DSE Assessment</h2>
        <p style={{color:Z.muted,marginBottom:28,fontSize:13}}>Display Screen Equipment self-assessment — DSE Regulations 1992</p>
        <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:40,textAlign:"center",border:`1px solid ${Z.border}`}}>
          <div style={{fontSize:48,marginBottom:12}}>🖥️</div>
          <p style={{color:Z.muted,fontSize:14,margin:"0 0 20px"}}>You haven't completed a DSE assessment yet.</p>
          <button onClick={startAssessment}
            style={{background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",color:"#fff",border:"none",borderRadius:10,padding:"11px 28px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:14}}>
            Start Assessment →
          </button>
        </div>
      </div>
    );
  }

  const resolvedCount = latestReport.issues.filter((_,ii) => myAdminResps[`${latestRi}_${ii}`]?.resolved).length;
  const allResolved   = latestReport.issueCount > 0 && resolvedCount === latestReport.issueCount;
  const openCount     = latestReport.issueCount - resolvedCount;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>My DSE Assessment <HelpTip dark={true} text="Your Display Screen Equipment assessment. Work through each section honestly — it takes about 5 minutes. If you flag any issues your manager will be notified and can respond with comments or actions directly in the portal."/></h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>
            Submitted: {latestReport.date} · {latestReport.totalQuestions} questions
            {myReports.length > 1 ? ` · ${myReports.length} assessments on record` : ""}
          </p>
        </div>
        <button onClick={startAssessment}
          style={{background:"rgba(139,92,246,0.15)",color:"#a78bfa",border:"1px solid rgba(139,92,246,0.3)",borderRadius:10,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
          Retake Assessment
        </button>
      </div>

      {/* Summary banner */}
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"16px 20px",marginBottom:24,border:`1px solid ${allResolved||latestReport.issueCount===0?"rgba(16,185,129,0.3)":openCount>0?"rgba(239,68,68,0.25)":Z.border}`,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <span style={{fontSize:36}}>{latestReport.issueCount===0||allResolved?"✅":"⚠️"}</span>
        <div style={{flex:1,minWidth:200}}>
          <div style={{fontWeight:800,fontSize:15,color:Z.white}}>
            {latestReport.issueCount===0 ? "No issues found — workstation is compliant" :
             allResolved ? "All issues resolved by your manager" :
             `${latestReport.issueCount} issue${latestReport.issueCount!==1?"s":""} identified — ${resolvedCount} resolved, ${openCount} awaiting action`}
          </div>
          <div style={{color:Z.muted,fontSize:12,marginTop:3}}>
            {latestReport.issueCount>0 && !allResolved ? "Your manager has been notified. Check below for their responses." :
             latestReport.issueCount===0 ? "Keep reviewing your setup annually or if anything changes." : ""}
          </div>
        </div>
        {latestReport.issueCount > 0 && (
          <div style={{display:"flex",gap:20,textAlign:"center",flexShrink:0}}>
            <div>
              <div style={{fontSize:22,fontWeight:900,color:openCount>0?"#f87171":Z.muted}}>{openCount}</div>
              <div style={{fontSize:10,color:Z.muted,letterSpacing:.5,textTransform:"uppercase"}}>Open</div>
            </div>
            <div>
              <div style={{fontSize:22,fontWeight:900,color:resolvedCount>0?Z.green:Z.muted}}>{resolvedCount}</div>
              <div style={{fontSize:10,color:Z.muted,letterSpacing:.5,textTransform:"uppercase"}}>Resolved</div>
            </div>
          </div>
        )}
      </div>

      {/* Issues */}
      {latestReport.issueCount > 0 && (
        <div>
          <h3 style={{fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,margin:"0 0 14px",textTransform:"uppercase"}}>
            Your Issues & Manager Responses
          </h3>
          <div style={{display:"grid",gap:12}}>
            {latestReport.issues.map((issue, ii) => {
              const resp     = myAdminResps[`${latestRi}_${ii}`] || {};
              const resolved = resp.resolved || false;
              return (
                <div key={ii} style={{borderRadius:14,border:`1px solid ${resolved?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.2)"}`,overflow:"hidden",transition:"border-color .3s",background:Z.navyMd}}>

                  {/* Issue */}
                  <div style={{padding:"14px 18px",background:resolved?"rgba(16,185,129,0.07)":"rgba(239,68,68,0.06)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:15}}>{issue.sectionIcon}</span>
                      <span style={{fontSize:10,fontWeight:700,letterSpacing:1,color:resolved?Z.green:"#f87171",textTransform:"uppercase"}}>{issue.section}</span>
                      {resolved
                        ? <span style={{fontSize:11,fontWeight:700,color:Z.green,background:"rgba(16,185,129,0.15)",padding:"2px 8px",borderRadius:6}}>✓ RESOLVED</span>
                        : resp.comment
                          ? <span style={{fontSize:11,color:Z.accentLt,background:"rgba(37,99,235,0.15)",padding:"2px 8px",borderRadius:6,fontWeight:600}}>Manager responded</span>
                          : <span style={{fontSize:10,color:Z.muted,fontStyle:"italic"}}>Awaiting manager response</span>
                      }
                    </div>
                    <p style={{fontWeight:600,fontSize:14,margin:"0 0 4px",color:Z.white,lineHeight:1.5}}>{issue.question}</p>
                    <p style={{fontSize:12,color:Z.muted,margin:0,lineHeight:1.5}}>⚠ {issue.risk}</p>
                  </div>

                  {/* Your comment */}
                  {issue.comment && (
                    <div style={{padding:"10px 18px",background:"rgba(245,158,11,0.05)",borderTop:"1px solid rgba(245,158,11,0.15)",display:"flex",gap:8,alignItems:"flex-start"}}>
                      <span style={{fontSize:14,flexShrink:0}}>💬</span>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.gold,marginBottom:3}}>YOUR COMMENT</div>
                        <div style={{fontSize:13,color:Z.slate,lineHeight:1.6}}>{issue.comment}</div>
                      </div>
                    </div>
                  )}

                  {/* Manager response */}
                  {resp.comment ? (
                    <div style={{padding:"12px 18px",background:"rgba(37,99,235,0.08)",borderTop:"1px solid rgba(37,99,235,0.15)",display:"flex",gap:8,alignItems:"flex-start"}}>
                      <span style={{fontSize:14,flexShrink:0}}>👤</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.accentLt,marginBottom:3}}>MANAGER RESPONSE</div>
                        <div style={{fontSize:13,color:Z.slate,lineHeight:1.6}}>{resp.comment}</div>
                      </div>
                      {resolved && <span style={{fontSize:20,color:Z.green,flexShrink:0,marginTop:2}}>✓</span>}
                    </div>
                  ) : (
                    <div style={{padding:"9px 18px",background:Z.overlay,borderTop:`1px solid ${Z.border}`,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12}}>⏳</span>
                      <span style={{fontSize:12,color:Z.muted,fontStyle:"italic"}}>Your manager has been notified and will respond shortly.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {latestReport.issueCount === 0 && (
        <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:14,padding:28,textAlign:"center"}}>
          <p style={{color:Z.green,fontWeight:700,margin:"0 0 6px",fontSize:15}}>✓ All {latestReport.totalQuestions} workstation questions answered satisfactorily.</p>
          <p style={{color:Z.muted,fontSize:13,margin:0}}>Your workstation meets the Health and Safety (Display Screen Equipment) Regulations 1992.</p>
        </div>
      )}
    </div>
  );
}


export { StaffDSETab };
