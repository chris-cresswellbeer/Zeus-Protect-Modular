/**
 * AssignTrainingTab.jsx — Assign Training: individual, team, warehouse or everyone, due dates, recorded training
 * Part of app/screens/AdminPortal.jsx. Reads the app's shared state with useApp() (app/AppContext.js).
 */
import { isPassed, recordedText, scoreText } from "../../../domains/training/completion";
import { evidenceLabel, listSessions, sessionKey } from "../../../domains/training/evidence";
import { todayISO } from "../../../lib/dates";
import { DUE_CHOICES, dueInfo, dueText, formatDue } from "../../../lib/dueDates";
import { E } from "../../../lib/emoji";
import { ask } from "../../../shared/Feedback";
import { HelpTip } from "../../../shared/HelpTip";
import { Avatar } from "../../../shared/primitives";
import { useApp } from "../../AppContext";
import { AttachEvidenceModal, EvidenceLinks, ExternalCertsSection, GroupSessionModal, ImportPriorTrainingModal, RecordCompletionModal, SessionsModal } from "../../lazyParts";

export function AssignTrainingTab({ staff, toggleAssign }) {
  const {
    allModules, allUsers, askDueDate, assignDueChoice, assignDueDate, assigns, attachEvidence,
    attachToSession, bulkManager, bulkTarget, comps, dbDeleteExtCert, dbSaveAssigns, dbSaveExtCert, dueDates,
    evidenceFor, extCerts, firstAidData, font, groupSessionFor, newAssignDue, noteDue, recordCompletions,
    recordFor, removeRecordedCompletion, setAssignDueChoice, setAssignDueDate, setAssigns, setBulkManager,
    setBulkTarget, setEvidenceFor, setExtCerts, setGroupSessionFor, setRecordFor, setShowImportPrior,
    setShowSessions, setTarget, showImportPrior, showSessions, T, target, user
  } = useApp();
  return (
      <div>
        <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:6}}>Assign Training <HelpTip dark={false} text="Tick modules to assign them to staff. Assigned modules appear on the staff member's dashboard as required training. Use bulk assignment to push modules to an entire team at once."/></h2>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:20}}>
          <p style={{color:T.muted,fontSize:13,margin:0,flex:1,minWidth:240}}>Assign modules to individuals, teams, or all staff at once.</p>
          <button onClick={()=>setGroupSessionFor("all")}
            style={{background:"rgba(37,99,235,0.12)",color:T.accentLt,border:`1px solid ${T.accent}55`,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
            {E("👥 ","")}Record a group session
          </button>
          <button onClick={()=>setShowImportPrior(true)}
            style={{background:"rgba(16,185,129,0.1)",color:T.green,border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
            {E("📥 ","")}Import training done before the portal
          </button>
          {(()=>{ const ss=listSessions(comps); const miss=ss.filter(x=>!x.evidence.length).length; return (
            <button onClick={()=>setShowSessions("all")}
              style={{background:T.overlay,color:T.white,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
              {E("📋 ","")}Group session records{ss.length?` (${ss.length})`:""}{miss?<span style={{color:"#fbbf24"}}> · {miss} without sign-in sheet</span>:null}
            </button>); })()}
        </div>
        {showSessions==="all" && <SessionsModal sessions={listSessions(comps)} people={allUsers} modules={allModules}
          onAttach={attachToSession} onClose={()=>setShowSessions(null)} Z={T} font={font}/>}
        {evidenceFor && (()=>{ const c=(comps[evidenceFor.uid]||{})[evidenceFor.mid]; if(!c||!c.recorded) return null;
          const pm=allModules.find(m=>String(m.id)===String(evidenceFor.mid)); const pu=allUsers.find(u=>String(u.id)===evidenceFor.uid);
          const key=sessionKey(evidenceFor.mid,c); const sess=key && listSessions(comps).find(x=>x.key===key);
          return <AttachEvidenceModal
            title={sess?`Sign-in sheet: ${pm?pm.title:""}`:`Evidence: ${pu?pu.name:""} — ${pm?pm.title:""}`}
            intro={sess?`The signed sign-in sheet for the session on ${String(c.date).split("-").reverse().join("/")}. It will be linked to all ${sess.attendees.length} attendees' records.`:"A certificate or old-system record showing this training was done."}
            onSave={files=>sess?attachToSession(sess,files):attachEvidence([{uid:evidenceFor.uid,mid:evidenceFor.mid}],files,`rec_${evidenceFor.uid}_${evidenceFor.mid}`)}
            onClose={()=>setEvidenceFor(null)} Z={T} font={font}/>; })()}
        {groupSessionFor==="all" && <GroupSessionModal people={allUsers.filter(u=>(u.status||"active")!=="leaver")} modules={allModules.filter(m=>!m._hidden)} comps={comps}
          leaderName={user.name} onSave={recordCompletions} onClose={()=>setGroupSessionFor(null)} Z={T} font={font}/>}
        {showImportPrior && <ImportPriorTrainingModal users={allUsers.filter(u=>(u.status||"active")!=="leaver")} modules={allModules} comps={comps}
          onImport={recordCompletions} onClose={()=>setShowImportPrior(false)} Z={T} font={font}/>}
        {recordFor && (()=>{ const pu=allUsers.find(u=>String(u.id)===String(recordFor.uid)); const pm=allModules.find(m=>m.id===recordFor.mid);
          return pu && pm ? <RecordCompletionModal person={pu} module={pm}
            byName={user.name} onSave={(date,note,evidence)=>recordCompletions([{userId:pu.id,moduleId:pm.id,date,note,evidence}])}
            onClose={()=>setRecordFor(null)} Z={T} font={font}/> : null; })()}

        {(()=>{
          const uniqueManagers = [...new Set(staff.map(u=>u.manager).filter(Boolean))].sort();
          const effectiveBulkManager = bulkManager || uniqueManagers[0] || "";

          const targetStaff = bulkTarget === "all" ? staff
            : bulkTarget === "warehouse" ? staff.filter(u=>u.isWarehouseWorker)
            : bulkTarget === "team" ? staff.filter(u=>u.manager===effectiveBulkManager)
            : null; // individual

          const targetLabel = bulkTarget==="all"?`all ${staff.length} staff`:bulkTarget==="warehouse"?`${staff.filter(u=>u.isWarehouseWorker).length} warehouse staff`:bulkTarget==="team"?`${(targetStaff||[]).length} staff in ${effectiveBulkManager}'s team`:"selected staff";

          // Hidden modules are excluded from new assignments — staff who already have them keep their records.
          const assignableModules = allModules.filter(m=>!m._hidden);

          const bulkAssignMod = async (mid) => {
            if (!targetStaff) return;
            const m = allModules.find(x=>x.id===mid);
            const d = newAssignDue();
            if (!(await ask({ title: "Assign module", message: `Assign "${m?.title||mid}" to ${targetLabel}?${d?`\n\nDue by ${formatDue(d)}.`:""}`, ok: "Assign" }))) return;
            const affected = {}, due = {};
            targetStaff.forEach(u => { const k=String(u.id); const cur=assigns[k]||[]; if (!cur.includes(mid)) { affected[k]=[...cur,mid]; if (d) due[k]={[mid]:d}; } });
            if (!Object.keys(affected).length) return;
            setAssigns(p => ({...p, ...affected}));
            if (d) noteDue(due);
            dbSaveAssigns(affected, d ? due : null);
          };
          const bulkUnassignMod = async (mid) => {
            if (!targetStaff) return;
            const m = allModules.find(x=>x.id===mid);
            if (!(await ask({ title: "Remove module", message: `Remove "${m?.title||mid}" from ${targetLabel}?\n\nStaff who have already completed it keep their completion record.`, ok: "Remove", danger: true }))) return;
            setAssigns(p => {
              const next = {...p};
              const affected = {};
              targetStaff.forEach(u => {
                next[u.id] = (next[u.id]||[]).filter(x=>x!==mid);
                affected[u.id] = next[u.id];
              });
              if (Object.keys(affected).length) dbSaveAssigns(affected);
              return next;
            });
          };
          const bulkAssignAll = async () => {
            if (!targetStaff) return;
            const d = newAssignDue();
            if (!(await ask({ title: "Assign every module", message: `Assign ALL ${assignableModules.length} modules to ${targetLabel}?\n\nThis adds every module to their training plan.${d?` Newly added modules are due by ${formatDue(d)}.`:""}`, ok: "Assign all" }))) return;
            const affected = {}, due = {};
            targetStaff.forEach(u => { const k=String(u.id); const cur=assigns[k]||[]; affected[k] = assignableModules.map(m=>m.id);
              if (d) { const add = affected[k].filter(x=>!cur.includes(x)); if (add.length) due[k] = Object.fromEntries(add.map(x=>[x,d])); } });
            setAssigns(p => ({...p, ...affected}));
            if (d) noteDue(due);
            dbSaveAssigns(affected, d ? due : null);
          };

          const selStyle2 = {background:T.navyMd,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"9px 14px",color:T.white,fontSize:13,cursor:"pointer",fontFamily:font,outline:"none"};

          return (
            <>
              {/* Target selector */}
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:20,marginBottom:20,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,marginBottom:14,textTransform:"uppercase"}}>Who to assign to</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  {[["individual",E("👤 ","")+"Individual"],["all",E("👥 ","")+"All Staff"],["warehouse",E("🏗 ","")+"Warehouse Staff"],["team",E("🗂 ","")+"By Manager"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setBulkTarget(v)}
                      style={{padding:"8px 16px",borderRadius:10,border:`1px solid ${bulkTarget===v?T.accent:T.borderMd}`,background:bulkTarget===v?`rgba(37,99,235,0.2)`:T.overlay,color:bulkTarget===v?T.accentLt:T.muted,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,transition:"all .15s"}}>
                      {l}
                    </button>
                  ))}
                  {bulkTarget==="team" && (
                    <select value={effectiveBulkManager} onChange={e=>setBulkManager(e.target.value)} style={selStyle2}>
                      {uniqueManagers.map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                  {bulkTarget==="individual" && (
                    <select value={target} onChange={e=>setTarget(e.target.value)} style={selStyle2}>
                      {staff.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  )}
                  {targetStaff && (
                    <span style={{color:T.muted,fontSize:12,marginLeft:4}}>
                      {targetStaff.length} staff member{targetStaff.length!==1?"s":""}
                    </span>
                  )}
                </div>

                {/* Individual card */}
                {bulkTarget==="individual" && (() => {
                  const tUser = allUsers.find(u=>String(u.id)===String(target));
                  return (
                    <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
                      <Avatar name={tUser?.name||""}/>
                      <div>
                        <div style={{fontWeight:800}}>{tUser?.name}</div>
                        <div style={{color:T.muted,fontSize:12,marginTop:2}}>{tUser?.jobTitle||""}{tUser?.manager?` · Manager: ${tUser.manager}`:""}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Bulk quick actions */}
                {targetStaff && (
                  <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <button onClick={bulkAssignAll}
                      style={{padding:"7px 16px",borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12}}>
                      ✓ Assign All Modules to {targetStaff.length} Staff
                    </button>
                    <button onClick={()=>setAssigns(p=>{const n={...p};const affected={};targetStaff.forEach(u=>{n[u.id]=[];affected[u.id]=[];});dbSaveAssigns(affected);return n;})}
                      style={{padding:"7px 16px",borderRadius:10,background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12}}>
                      ✕ Clear All Assignments
                    </button>
                  </div>
                )}

                {/* Due date for assignments made on this page (lib/dueDates.js) */}
                <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                  <label htmlFor="assign-due" style={{fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase"}}>Due by</label>
                  <select id="assign-due" value={assignDueChoice} onChange={e=>setAssignDueChoice(e.target.value)} style={selStyle2} data-testid="assign-due">
                    {DUE_CHOICES.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {assignDueChoice==="date" && <input type="date" value={assignDueDate} min={todayISO()} onChange={e=>setAssignDueDate(e.target.value)} aria-label="Due date" data-testid="assign-due-date" style={{...selStyle2,colorScheme:"dark"}}/>}
                  <span style={{fontSize:12,color:T.muted}}>{newAssignDue() ? `Modules you assign now must be completed by ${formatDue(newAssignDue())}.` : "Applies to modules you assign on this page. Optional."}</span>
                </div>
              </div>

              {/* Module list */}
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}>
                <div style={{display:"grid",gap:10}}>
                  {assignableModules.map(m=>{
                    let on, partialCount=0;
                    if (bulkTarget==="individual") {
                      on = (assigns[String(target)]||[]).includes(m.id);
                    } else {
                      partialCount = targetStaff.filter(u=>(assigns[u.id]||[]).includes(m.id)).length;
                      on = partialCount === targetStaff.length;
                    }
                    const partial = !on && partialCount > 0;
                    return (
                      <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",background:on?"rgba(37,99,235,0.12)":partial?"rgba(245,158,11,0.07)":T.overlay,border:`1px solid ${on?T.accent+"44":partial?"rgba(245,158,11,0.25)":T.border}`,borderRadius:12,transition:"all .2s",flexWrap:"wrap",gap:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0}}>
                          <span style={{fontSize:24,flexShrink:0}}>{m.icon||"📋"}</span>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:14}}>{m.title}</div>
                            <div style={{color:T.muted,fontSize:12}}>{m.category} · {m.duration} · <span style={{color:m.level==="Mandatory"?"#f87171":T.accentLt}}>{m.level}</span>
                              {targetStaff && <span style={{color:T.muted}}> · {partialCount}/{targetStaff.length} assigned</span>}
                            </div>
                          </div>
                        </div>
                        {bulkTarget==="individual" && on && !isPassed((comps[String(target)]||{})[m.id]) && (()=>{
                          // Due date for this assignment: click to set or change
                          const di = dueInfo(dueDates, target, m.id, false);
                          return (
                            <button onClick={()=>askDueDate(target,m.id)} data-testid="due-chip" title="Set or change the due date"
                              style={{background:di&&di.overdue?"rgba(239,68,68,0.14)":di&&di.soon?"rgba(245,158,11,0.12)":"transparent",color:di&&di.overdue?"#f87171":di&&di.soon?"#fbbf24":di?T.slate||T.white:T.muted,border:`1px ${di?"solid":"dashed"} ${di&&di.overdue?"rgba(239,68,68,0.45)":T.borderMd}`,borderRadius:8,padding:"5px 10px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:11,marginRight:8,flexShrink:0,whiteSpace:"nowrap"}}>
                              {di ? dueText(di) : "+ Due date"}
                            </button>);
                        })()}
                        {bulkTarget==="individual" && (()=>{
                          // Completion status + "Record as completed" (training done before the portal)
                          const c=(comps[String(target)]||{})[m.id];
                          const dd=c&&c.date?String(c.date).split("-").reverse().join("/"):"";
                          if (!c) return (
                            <button onClick={()=>setRecordFor({uid:target,mid:m.id})} title="Record training they've already done, e.g. on the old system"
                              style={{background:"transparent",color:T.green,border:"1px solid rgba(16,185,129,0.35)",borderRadius:10,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,marginRight:8,flexShrink:0}}>
                              {E("✓ ","")}Record as completed
                            </button>);
                          if (c.recorded) return (
                            <span style={{display:"inline-flex",alignItems:"center",gap:6,marginRight:8,flexShrink:0}}>
                              <span title={recordedText(c)} style={{fontSize:11,fontWeight:700,color:T.green,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:"4px 10px"}}>{c.recorded.session?"Group session":"Recorded"} · completed {dd}</span>
                              {(c.recorded.evidence||[]).length>0
                                ? <EvidenceLinks evidence={c.recorded.evidence} label={evidenceLabel(c,0)} Z={T}/>
                                : <button onClick={()=>setEvidenceFor({uid:String(target),mid:m.id})} title={c.recorded.session?"Attach the signed sign-in sheet (linked to everyone at that session)":"Attach a certificate or old-system record"}
                                    style={{background:"transparent",color:T.accentLt,border:`1px solid ${T.accent}55`,borderRadius:8,padding:"3px 9px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>{E("📎 ","")}{c.recorded.session?"Attach sign-in sheet":"Attach evidence"}</button>}
                              <button onClick={()=>removeRecordedCompletion(target,m.id)} title="Remove this recorded completion (you can undo it straight after)"
                                style={{background:"transparent",color:T.muted,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,textDecoration:"underline"}}>Undo</button>
                            </span>);
                          return <span style={{fontSize:11,fontWeight:700,color:isPassed(c)?T.green:T.amber,marginRight:10,flexShrink:0}}>{isPassed(c)?"Completed":"Attempted"} {dd} · {scoreText(c)}</span>;
                        })()}
                        {bulkTarget==="individual"
                          ? <button onClick={()=>toggleAssign(target,m.id)}
                              style={{background:on?`rgba(37,99,235,0.25)`:T.border,color:on?T.accentLt:T.muted,border:`1px solid ${on?T.accent+"55":T.borderMd}`,borderRadius:10,padding:"8px 20px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:font,transition:"all .2s",flexShrink:0}}>
                              {on?"✓ Assigned":"+ Assign"}
                            </button>
                          : <div style={{display:"flex",gap:8,flexShrink:0}}>
                              <button onClick={()=>bulkAssignMod(m.id)} disabled={on}
                                style={{background:on?T.overlay:`linear-gradient(135deg,${T.accent},${T.blue})`,color:on?T.muted:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontWeight:700,cursor:on?"default":"pointer",fontSize:12,fontFamily:font,opacity:on?.5:1}}>
                                {on?"✓ All Assigned":"+ Assign All"}
                              </button>
                              <button onClick={()=>bulkUnassignMod(m.id)} disabled={partialCount===0}
                                style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 16px",fontWeight:700,cursor:partialCount===0?"default":"pointer",fontSize:12,fontFamily:font,opacity:partialCount===0?.4:1}}>
                                Remove All
                              </button>
                            </div>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}

        {/* External Certificates */}
        <ExternalCertsSection
          staff={staff}
          extCerts={extCerts}
          setExtCerts={setExtCerts}
          dbSaveExtCert={dbSaveExtCert}
          dbDeleteExtCert={dbDeleteExtCert}
          customZones={firstAidData?.customZones||[]}
          T={T} font={font}/>

      </div>
    );
}
