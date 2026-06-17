import React, { useState, useRef } from "react";
import { getExpiryStatus } from "../../lib/dates";
import { ACCEPT_IMG_DOCS } from "../../lib/constants";

function StaffActionsTab({ user, incidents, investigations, setInvestigations, assigns, comps, allModules, docs, docAssignments, docAcknowledgements, dseReports, adminResponses, setStab, setMod, Z, font }) {
  const today = new Date().toISOString().slice(0,10);

  // ── Outstanding training modules ──────────────────────────────────────────
  const myIds   = assigns[user.id]||[];
  const myComps = comps[user.id]||{};
  const pendingModules = (allModules||[]).filter(m=>myIds.includes(m.id)&&!myComps[m.id]);
  const expiringModules = (allModules||[]).filter(m=>{
    const c=myComps[m.id]; if(!c||!m.renewalMonths) return false;
    const ex=getExpiryStatus(c.date,m.renewalMonths);
    return ex&&(ex.status==="expired"||ex.status==="expiring");
  }).map(m=>({...m, ex:getExpiryStatus(myComps[m.id].date,m.renewalMonths)}));

  // ── Unread documents ──────────────────────────────────────────────────────
  const pendingDocs = (docs||[]).filter(d=>
    (docAssignments[String(d.id)]||[]).includes(String(user.id)) && !(docAcknowledgements[user.id]||{})[d.id]
  );

  // ── Open DSE issues ───────────────────────────────────────────────────────
  const userDseReports = dseReports[user.id]||[];
  const latestDse = userDseReports[userDseReports.length-1];
  const ri = userDseReports.length-1;
  const openDseIssues = latestDse ? latestDse.issues.filter((_,ii)=>
    !(adminResponses[user.id]||{})[`${ri}_${ii}`]?.resolved && latestDse.issueCount>0
  ) : [];

  // ── Investigation corrective actions ─────────────────────────────────────
  const myActions = Object.entries(investigations).flatMap(([incidentId, inv]) => {
    const inc = incidents.find(i=>i.id===incidentId);
    return (inv.actions||[])
      .map((a,ai) => ({...a, incidentId, incidentDate:inc?.date, incidentDesc:inc?.description, incidentLocation:inc?.location, actionIdx:ai}))
      .filter(a => a.owner === user.name);
  });

  const open     = myActions.filter(a=>a.status!=="complete"&&a.status!=="closed");
  const overdue  = open.filter(a=>a.dueDate&&a.dueDate<today);
  const complete = myActions.filter(a=>a.status==="complete"||a.status==="closed");

  const totalOutstanding = pendingModules.length + expiringModules.length + pendingDocs.length + openDseIssues.length + open.length;

  const [expandedId, setExpandedId] = useState(null);
  const [noteInputs, setNoteInputs]  = useState({});
  const [uploading, setUploading]    = useState({});
  const fileRefs = useRef({});

  function getKey(a) { return `${a.incidentId}_${a.actionIdx}`; }

  function markComplete(a) {
    setInvestigations(prev => {
      const inv = {...prev[a.incidentId]};
      const actions = [...(inv.actions||[])];
      actions[a.actionIdx] = {...actions[a.actionIdx], status:"complete", completedBy:user.name, completedAt:today};
      return {...prev, [a.incidentId]: {...inv, actions}};
    });
  }

  function saveNote(a) {
    const k = getKey(a);
    const note = (noteInputs[k]||"").trim();
    if(!note) return;
    setInvestigations(prev => {
      const inv = {...prev[a.incidentId]};
      const actions = [...(inv.actions||[])];
      const existing = actions[a.actionIdx].note||"";
      actions[a.actionIdx] = {...actions[a.actionIdx], note: existing ? existing+"\n\n"+`[${today} — ${user.name}]: `+note : `[${today} — ${user.name}]: `+note};
      return {...prev, [a.incidentId]: {...inv, actions}};
    });
    setNoteInputs(p=>({...p,[k]:""}));
  }

  function handleFileUpload(a, file) {
    const k = getKey(a);
    setUploading(p=>({...p,[k]:true}));
    const reader = new FileReader();
    reader.onload = ev => {
      setInvestigations(prev => {
        const inv = {...prev[a.incidentId]};
        const actions = [...(inv.actions||[])];
        const existing = actions[a.actionIdx].attachments||[];
        actions[a.actionIdx] = {...actions[a.actionIdx], attachments:[...existing, {name:file.name, data:ev.target.result, uploadedBy:user.name, uploadedAt:today}]};
        return {...prev, [a.incidentId]: {...inv, actions}};
      });
      setUploading(p=>({...p,[k]:false}));
    };
    reader.readAsDataURL(file);
  }

  const inp = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 13px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const priColor = p=>p==="high"?"#ef4444":p==="critical"?"#dc2626":p==="low"?"#10b981":"#f59e0b";

  const SectionHeader = ({icon, title, count, color}) => (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,paddingTop:24,borderTop:`1px solid ${Z.border}`}}>
      <span style={{fontSize:20}}>{icon}</span>
      <h3 style={{margin:0,fontSize:15,fontWeight:800,color:Z.white,flex:1}}>{title}</h3>
      <span style={{fontSize:12,fontWeight:700,color,background:`${color}18`,border:`1px solid ${color}33`,borderRadius:8,padding:"2px 10px"}}>{count} item{count!==1?"s":""}</span>
    </div>
  );

  function renderActionCard(a) {
    const k = getKey(a);
    const isExpanded = expandedId===k;
    const isOverdue = a.status!=="complete"&&a.status!=="closed"&&a.dueDate&&a.dueDate<today;
    const isDone = a.status==="complete"||a.status==="closed";
    const attachments = a.attachments||[];

    return (
      <div style={{borderRadius:14,border:`1px solid ${isDone?"rgba(16,185,129,0.25)":isOverdue?"rgba(239,68,68,0.35)":"rgba(37,99,235,0.3)"}`,overflow:"hidden",marginBottom:12}}>
        <div onClick={()=>setExpandedId(isExpanded?null:k)}
          style={{padding:"14px 18px",background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,cursor:"pointer",display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${isDone?"#10b981":priColor(a.priority)}`,background:isDone?"#10b981":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900,flexShrink:0,marginTop:2}}>
            {isDone?"✓":""}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:Z.white,marginBottom:4,lineHeight:1.4}}>{a.description}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:10,fontWeight:700,color:priColor(a.priority),background:`${priColor(a.priority)}18`,border:`1px solid ${priColor(a.priority)}33`,borderRadius:6,padding:"2px 8px"}}>{a.priority} priority</span>
              {a.dueDate && <span style={{fontSize:11,color:isOverdue?"#f87171":Z.muted}}>{isOverdue?"🚨 Overdue: ":"📅 Due: "}{a.dueDate}</span>}
              {isDone && <span style={{fontSize:11,color:"#10b981",fontWeight:700}}>✓ Completed{a.completedAt?" "+a.completedAt:""}</span>}
              {attachments.length>0 && <span style={{fontSize:11,color:Z.muted}}>📎 {attachments.length} file{attachments.length!==1?"s":""}</span>}
            </div>
            <div style={{fontSize:11,color:Z.muted,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              📋 Incident {a.incidentDate} — {a.incidentDesc?.slice(0,60)}{a.incidentDesc?.length>60?"…":""}
            </div>
          </div>
          <span style={{fontSize:11,color:Z.muted,flexShrink:0}}>{isExpanded?"▲":"▼"}</span>
        </div>

        {isExpanded && (
          <div style={{padding:"16px 18px",background:Z.overlaySm,borderTop:`1px solid ${Z.border}`}}>
            <div style={{background:Z.overlay,borderRadius:10,padding:"10px 14px",marginBottom:14,border:`1px solid ${Z.border}`}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:6}}>Incident Context</div>
              <div style={{fontSize:12,color:Z.white,marginBottom:3}}>{a.incidentDesc}</div>
              {a.incidentLocation && <div style={{fontSize:11,color:Z.muted}}>📍 {a.incidentLocation} · {a.incidentDate}</div>}
            </div>
            {a.note && (
              <div style={{background:"rgba(37,99,235,0.08)",borderRadius:10,padding:"10px 14px",marginBottom:14,border:"1px solid rgba(37,99,235,0.2)"}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:6}}>Progress Notes</div>
                <div style={{fontSize:12,color:Z.white,whiteSpace:"pre-wrap",lineHeight:1.6}}>{a.note}</div>
              </div>
            )}
            {attachments.length>0 && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:8}}>Uploaded Evidence</div>
                {attachments.map((att,ai)=>(
                  <div key={ai} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:Z.overlay,borderRadius:8,marginBottom:6,border:`1px solid ${Z.border}`}}>
                    <span style={{fontSize:16}}>📎</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:Z.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</div>
                      <div style={{fontSize:10,color:Z.muted}}>{att.uploadedBy} · {att.uploadedAt}</div>
                    </div>
                    <a href={att.data} download={att.name} style={{fontSize:11,fontWeight:700,color:Z.accentLt,textDecoration:"none",background:Z.overlaySm,borderRadius:6,padding:"4px 10px",border:`1px solid ${Z.border}`}}>↓</a>
                  </div>
                ))}
              </div>
            )}
            {!isDone && (
              <div style={{display:"grid",gap:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",marginBottom:6}}>Add Progress Note</div>
                  <textarea value={noteInputs[k]||""} onChange={e=>setNoteInputs(p=>({...p,[k]:e.target.value}))}
                    placeholder="Describe what you've done so far, any blockers, or updates…"
                    rows={3} style={{...inp,resize:"vertical",lineHeight:1.5,marginBottom:8}}/>
                  <button onClick={()=>saveNote(a)} disabled={!(noteInputs[k]||"").trim()}
                    style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",cursor:(noteInputs[k]||"").trim()?"pointer":"default",fontSize:12,fontWeight:700,fontFamily:font,opacity:(noteInputs[k]||"").trim()?1:.4}}>
                    Save Note
                  </button>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",marginBottom:6}}>Upload Evidence</div>
                  <input ref={el=>fileRefs.current[k]=el} type="file" accept={ACCEPT_IMG_DOCS} style={{display:"none"}}
                    onChange={e=>{ if(e.target.files[0]) handleFileUpload(a, e.target.files[0]); e.target.value=""; }}/>
                  <div onClick={()=>fileRefs.current[k]?.click()}
                    style={{border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"14px",cursor:"pointer",textAlign:"center",transition:"border-color .2s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=Z.accent}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=Z.borderMd}>
                    {uploading[k] ? <div style={{fontSize:13,color:Z.muted}}>Uploading…</div> : <>
                      <div style={{fontSize:20,marginBottom:4}}>📤</div>
                      <div style={{fontSize:12,fontWeight:700,color:Z.white,marginBottom:2}}>Upload Photo or Document</div>
                      <div style={{fontSize:11,color:Z.muted}}>Image, PDF or Word</div>
                    </>}
                  </div>
                </div>
                <div style={{paddingTop:4,borderTop:`1px solid ${Z.border}`}}>
                  <button onClick={()=>markComplete(a)}
                    style={{background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",cursor:"pointer",fontSize:13,fontWeight:800,fontFamily:font,boxShadow:"0 4px 14px rgba(16,185,129,0.35)"}}>
                    ✓ Mark as Complete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>My Actions</h2>
        <p style={{color:Z.muted,fontSize:13,margin:0}}>Your outstanding training, documents, DSE issues and corrective actions</p>
      </div>

      {totalOutstanding===0 && complete.length===0 ? (
        <div style={{textAlign:"center",padding:"60px 20px",color:Z.muted}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <div style={{fontSize:16,fontWeight:700,color:Z.white,marginBottom:6}}>All clear!</div>
          <div style={{fontSize:13}}>You have no outstanding actions at this time.</div>
        </div>
      ) : (
        <div>

          {/* ── Outstanding Training ── */}
          {(pendingModules.length>0||expiringModules.length>0) && (
            <div style={{marginBottom:8}}>
              <SectionHeader icon="📚" title="Outstanding Training" count={pendingModules.length+expiringModules.length} color="#6366f1"/>
              {expiringModules.map(m=>(
                <div key={m.id} style={{padding:"12px 16px",borderRadius:12,background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,border:`1px solid ${m.ex.status==="expired"?"rgba(239,68,68,0.35)":"rgba(245,158,11,0.35)"}`,marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:24,flexShrink:0}}>{m.icon||"📋"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:3}}>{m.title}</div>
                    <div style={{fontSize:11,color:Z.muted}}>{m.category} · {m.duration}</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:m.ex.status==="expired"?"#f87171":"#f59e0b",background:m.ex.status==="expired"?"rgba(239,68,68,0.12)":"rgba(245,158,11,0.12)",border:`1px solid ${m.ex.status==="expired"?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)"}`,borderRadius:8,padding:"4px 10px",whiteSpace:"nowrap"}}>
                    {m.ex.status==="expired"?"⚠ Renewal overdue":`⏳ Renews in ${m.ex.daysLeft}d`}
                  </span>
                  <button onClick={()=>{setMod(m);setStab("training");}} style={{background:`linear-gradient(135deg,#6366f1,#4f46e5)`,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap",flexShrink:0}}>Start →</button>
                </div>
              ))}
              {pendingModules.map(m=>(
                <div key={m.id} style={{padding:"12px 16px",borderRadius:12,background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,border:`1px solid ${m.level==="Mandatory"?"rgba(239,68,68,0.3)":"rgba(37,99,235,0.25)"}`,marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:24,flexShrink:0}}>{m.icon||"📋"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:3}}>{m.title}</div>
                    <div style={{fontSize:11,color:Z.muted}}>{m.category} · {m.duration}</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:m.level==="Mandatory"?"#f87171":"#93c5fd",background:m.level==="Mandatory"?"rgba(239,68,68,0.1)":"rgba(37,99,235,0.12)",border:`1px solid ${m.level==="Mandatory"?"rgba(239,68,68,0.25)":"rgba(37,99,235,0.25)"}`,borderRadius:8,padding:"4px 10px"}}>
                    {m.level==="Mandatory"?"🔴 Mandatory":"📘 Assigned"}
                  </span>
                  <button onClick={()=>{setMod(m);setStab("training");}} style={{background:`linear-gradient(135deg,#6366f1,#4f46e5)`,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap",flexShrink:0}}>Start →</button>
                </div>
              ))}
            </div>
          )}

          {/* ── Documents to Read ── */}
          {pendingDocs.length>0 && (
            <div style={{marginBottom:8}}>
              <SectionHeader icon="📄" title="Documents to Read & Confirm" count={pendingDocs.length} color="#f59e0b"/>
              {pendingDocs.map(d=>(
                <div key={d.id} style={{padding:"12px 16px",borderRadius:12,background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,border:"1px solid rgba(245,158,11,0.3)",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:24,flexShrink:0}}>📄</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:3}}>{d.title}</div>
                    <div style={{fontSize:11,color:Z.muted}}>{d.category||"Policy Document"}{d.version?` · v${d.version}`:""}</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:8,padding:"4px 10px",whiteSpace:"nowrap"}}>⏳ Confirmation pending</span>
                  <button onClick={()=>setStab("documents")} style={{background:`linear-gradient(135deg,#f59e0b,#d97706)`,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap",flexShrink:0}}>Read →</button>
                </div>
              ))}
            </div>
          )}

          {/* ── Open DSE Issues ── */}
          {openDseIssues.length>0 && (
            <div style={{marginBottom:8}}>
              <SectionHeader icon="🖥️" title="Open DSE Issues" count={openDseIssues.length} color="#06b6d4"/>
              {openDseIssues.map((issue,ii)=>(
                <div key={ii} style={{padding:"12px 16px",borderRadius:12,background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,border:"1px solid rgba(6,182,212,0.3)",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:20,flexShrink:0}}>🖥️</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:3}}>{issue.question||issue.section}</div>
                    {issue.comment && <div style={{fontSize:11,color:Z.muted,fontStyle:"italic"}}>Your note: "{issue.comment}"</div>}
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:"#06b6d4",background:"rgba(6,182,212,0.1)",border:"1px solid rgba(6,182,212,0.25)",borderRadius:8,padding:"4px 10px",whiteSpace:"nowrap"}}>⏳ Awaiting response</span>
                  <button onClick={()=>setStab("dse")} style={{background:"linear-gradient(135deg,#06b6d4,#0891b2)",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap",flexShrink:0}}>View →</button>
                </div>
              ))}
            </div>
          )}

          {/* ── Corrective Actions ── */}
          {(open.length>0||complete.length>0) && (
            <div style={{marginBottom:8}}>
              <SectionHeader icon="🔧" title="Corrective Actions" count={open.length} color={overdue.length>0?"#ef4444":"#f59e0b"}/>
              {overdue.length>0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:"#f87171",letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>⚠ Overdue</div>
                  {overdue.map(a=><React.Fragment key={getKey(a)}>{renderActionCard(a)}</React.Fragment>)}
                </div>
              )}
              {open.filter(a=>!overdue.includes(a)).length>0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:"#f59e0b",letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>⏳ Open</div>
                  {open.filter(a=>!overdue.includes(a)).map(a=><React.Fragment key={getKey(a)}>{renderActionCard(a)}</React.Fragment>)}
                </div>
              )}
              {complete.length>0 && (
                <div>
                  <div style={{fontSize:11,fontWeight:800,color:"#10b981",letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>✓ Completed</div>
                  {complete.map(a=><React.Fragment key={getKey(a)}>{renderActionCard(a)}</React.Fragment>)}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export { StaffActionsTab };
