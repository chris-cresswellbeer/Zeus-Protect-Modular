import React, { useState, useEffect } from "react";
import { useFormGuard, DraftBanner } from "../../lib/unsaved";
import { useWindowWidth } from "../../shared/hooks";
import { HelpTip } from "../../shared/HelpTip";
import { IncidentForm } from "./IncidentForm";
import { incToForm } from "./incToForm";
import { formToInc } from "./formToInc";
import { INCIDENT_TYPES, ACCIDENT_CODES, NUMBER_CODES } from "../../data/seedIncidents";
import { IncidentPhotos } from "../../shared/IncidentPhotos";
import { isIncompleteQuickReport, myIncompleteQuickReports, isQuickReportOverdue, quickReportDueLabel } from "./quickReportStatus";

/**
 * IncidentTracker — the STAFF "Report Incident" tab.
 * Lists incidents the logged-in user reported (matched on reportedBy === user id),
 * and opens IncidentForm to create or edit one. Saving updates App.jsx state;
 * persistence happens via App.jsx's [incidents] auto-sync effect (dbSaveIncident).
 *
 * Props: user, incidents/setIncidents, equipment/setEquipment (for the
 *        "equipment involved" section), Z, font.
 */
function IncidentTracker({ user, incidents, setIncidents, equipment, setEquipment, autoEditId, onAutoEditDone, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const BLANK_FORM = {
    type:"near_miss", date:new Date().toISOString().slice(0,10), time:"",
    location:"", description:"", accidentCode:"", numberCode:"",
    injuryType:"None / No injury", riddor:false,
    personName:"", personDob:"", personAddress:"", personPostcode:"",
    witness1Name:"", witness1Contact:"", witness2Name:"", witness2Contact:"",
    firstAidProvided:"No", firstAidDetails:"", firstAidBy:"",
    postIncidentOutcome:"", immediateMeasures:"", correctiveActions:"", correctiveActionsBy:"",
    equipmentInvolved:false, equipmentId:"", equipmentDamaged:false,
    equipmentDamageDesc:"", equipmentDamageSeverity:"medium", equipmentOOS:false,
    _equipmentList: equipment||[],
  };
  const [showForm, setShowForm]   = useState(false);   // new report form
  const [editingId, setEditingId] = useState(null);    // id of incident being edited
  const [form, setForm]           = useState(BLANK_FORM);
  const [saved, setSaved]         = useState(false);
  const [err, setErr]             = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const myIncidents = incidents.filter(i=>String(i.reportedBy)===String(user.id)).sort((a,b)=>b.date.localeCompare(a.date));
  // Quick hazard reports this user still needs to complete (see quickReportStatus.js).
  const toComplete = myIncompleteQuickReports(incidents, user.id);
  const editingQuick = editingId ? isIncompleteQuickReport(incidents.find(i=>i.id===editingId)) : false;

  function setF(k,v){ setForm(p=>({...p,[k]:v})); setErr(""); setSaved(false); }
  // unsaved-changes warning + draft on this device (lib/unsaved.jsx); the equipment list isn't part of the report
  const { _equipmentList, ...formData } = form || {};
  const guard = useFormGuard({ key: `incident.${editingId || "new"}`, label: editingId ? "the incident report you're editing" : "your new incident report",
    active: showForm, value: formData, onRestore: v => setForm({ ...v, _equipmentList: equipment || [] }) });

  function openNew() { setForm({...BLANK_FORM,_equipmentList:equipment||[]}); setEditingId(null); setSaved(false); setErr(""); setShowForm(true); }
  function openEdit(inc) { setForm(incToForm(inc, equipment||[])); setEditingId(inc.id); setSaved(false); setErr(""); setShowForm(true); setExpandedId(null); }
  function cancelForm() { guard.done(); setShowForm(false); setEditingId(null); setErr(""); setSaved(false); }

  // Deep link from a reminder (dashboard, bell, My Actions, mobile): open that report's form.
  useEffect(() => {
    if (!autoEditId) return;
    const inc = incidents.find(i=>String(i.id)===String(autoEditId));
    if (inc) openEdit(inc);
    if (onAutoEditDone) onAutoEditDone();
  }, [autoEditId]); // eslint-disable-line

  // If the report says equipment was involved: optionally mark it out of service
  // (status "inactive") and/or add a defect entry tagged incidentLinked:true to that
  // equipment's defect log. Saved via App.jsx's [equipment] auto-sync effect.
  function applyEquipmentSideEffects(f) {
    if (!f.equipmentInvolved || !f.equipmentId) return;
    const today = new Date().toISOString().slice(0,10);
    setEquipment(prev => prev.map(eq => {
      if (eq.id !== f.equipmentId) return eq;
      let updated = {...eq};
      if (f.equipmentOOS) updated.status = "inactive";
      if (f.equipmentDamaged && f.equipmentDamageDesc.trim()) {
        const defect = {
          id: "d"+Date.now(), date: today,
          reportedBy: user.name,
          description: `[Incident report] ${f.equipmentDamageDesc.trim()}`,
          severity: f.equipmentDamageSeverity||"medium",
          status: "open", resolution: "",
          incidentLinked: true,
        };
        updated.defects = [...(eq.defects||[]), defect];
      }
      return updated;
    }));
  }

  // Minimum required fields for a report. Everything else is optional.
  function validate() {
    if (!form.location.trim()) { setErr("Location is required."); return false; }
    if (!form.description.trim()) { setErr("Description is required."); return false; }
    if (!form.accidentCode) { setErr("Please select an Accident Code."); return false; }
    if (!form.numberCode) { setErr("Please select a Number Code."); return false; }
    return true;
  }

  // New incident ids are "i<timestamp>". The success banner shows briefly, then the form closes.
  function submitNew() {
    if (!validate()) return;
    const newInc = { id:"i"+Date.now(), reportedBy:String(user.id), closed:false, ...formToInc(form, {}) };
    setIncidents(p=>[newInc,...p]);
    applyEquipmentSideEffects(form);
    guard.done();
    setSaved(true);
    setForm({...BLANK_FORM,_equipmentList:equipment||[]});
    setTimeout(()=>{ setShowForm(false); setSaved(false); }, 1400);
  }

  function saveEdit() {
    if (!validate()) return;
    setIncidents(p=>p.map(i=>i.id===editingId ? formToInc(form, i) : i));
    applyEquipmentSideEffects(form);
    guard.done();
    setSaved(true);
    setTimeout(()=>{ setShowForm(false); setEditingId(null); setSaved(false); }, 1200);
  }

  const typeInfo = (id) => INCIDENT_TYPES.find(t=>t.id===id)||INCIDENT_TYPES[0];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Report an Incident <HelpTip dark={true} text="Use this to report any accident, near miss, unsafe condition or unsafe act. Fill in as much detail as possible — your manager will review it and may follow up. If someone has been injured, select Accident and complete the injury details section."/></h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>Accidents, near misses, unsafe conditions and acts — all reports are reviewed by the H&S team</p>
        </div>
        {!showForm && (
          <button onClick={openNew}
            style={{background:`linear-gradient(135deg,#ef4444,#b91c1c)`,color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:"0 4px 16px rgba(239,68,68,0.35)"}}>
            + Report Incident
          </button>
        )}
      </div>

      {/* Reminder: quick hazard reports still needing the full form */}
      {!showForm && toComplete.length>0 && (
        <div style={{background:`${Z.amber}14`,border:`1px solid ${Z.amber}55`,borderRadius:14,padding:"16px 20px",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:14,color:Z.amber,marginBottom:4}}>⚡ Finish your hazard report{toComplete.length!==1?"s":""}</div>
          <div style={{fontSize:12,color:Z.muted,marginBottom:12}}>You raised {toComplete.length===1?"this":"these"} with the quick <b>Report a Hazard</b> button. Please add the incident codes and any other details so the H&S team has the full picture.</div>
          <div style={{display:"grid",gap:8}}>
            {toComplete.map(inc=>{ const late=isQuickReportOverdue(inc); return (
              <div key={inc.id} style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",background:Z.overlay,border:`1px solid ${late?Z.red+"66":Z.borderMd}`,borderRadius:10,padding:"10px 14px"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontSize:13,fontWeight:700,color:Z.white,marginBottom:2}}>{inc.description}</div>
                  <div style={{fontSize:11,color:Z.muted}}>📍 {inc.location} · reported {inc.date} · <span style={{color:late?Z.red:Z.amber,fontWeight:700}}>{quickReportDueLabel(inc)}</span></div>
                </div>
                <button onClick={()=>openEdit(inc)} style={{background:late?Z.red:Z.amber,color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>Complete report →</button>
              </div>
            ); })}
          </div>
        </div>
      )}

      {showForm && editingQuick && (
        <div style={{background:`${Z.amber}14`,border:`1px solid ${Z.amber}55`,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:Z.slate}}>
          ⚡ <b>Completing your quick hazard report.</b> Select the <b>Accident Code</b> and <b>Number Code</b>, add any other details you can, then save. The reminder clears once it's saved.
        </div>
      )}

      {showForm && <DraftBanner guard={guard} Z={Z} font={font} what="this incident report"/>}
      {showForm && (
        <IncidentForm form={form} setF={setF} err={err} saved={saved}
          onSubmit={editingId ? saveEdit : submitNew}
          onCancel={cancelForm}
          isEdit={!!editingId}
          Z={Z} font={font}/>
      )}

      <div>
        <h3 style={{fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,margin:"0 0 14px",textTransform:"uppercase"}}>My Incident Reports ({myIncidents.length})</h3>
        {myIncidents.length===0 ? (
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:36,textAlign:"center",border:`1px solid ${Z.border}`}}>
            <div style={{fontSize:40,marginBottom:8}}>📋</div>
            <p style={{color:Z.muted,fontSize:13,margin:0}}>You haven't submitted any incident reports yet.</p>
          </div>
        ) : (
          <div style={{display:"grid",gap:10}}>
            {myIncidents.map(inc=>{
              const ti = typeInfo(inc.type);
              const ac = ACCIDENT_CODES.find(c=>c.code===inc.accidentCode);
              const nc = NUMBER_CODES.find(c=>c.num===inc.numberCode);
              const isOpen = expandedId===inc.id;
              return (
                <div key={inc.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:`1px solid ${Z.border}`,overflow:"hidden"}}>
                  <div onClick={()=>{ if(!showForm) setExpandedId(isOpen?null:inc.id); }} style={{padding:"14px 18px",display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap",cursor:"pointer",userSelect:"none"}}>
                    <span style={{fontSize:22,flexShrink:0,marginTop:2}}>{ti.icon}</span>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:12,fontWeight:800,color:ti.color,background:ti.bg,padding:"2px 10px",borderRadius:99}}>{ti.label}</span>
                        <span style={{fontSize:11,color:Z.muted}}>{inc.date}{inc.time?` at ${inc.time}`:""}</span>
                        <span style={{fontSize:11,color:Z.muted}}>📍 {inc.location}</span>
                        {inc.riddor && <span style={{fontSize:11,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,0.1)",padding:"2px 8px",borderRadius:6,border:"1px solid rgba(239,68,68,0.3)"}}>RIDDOR</span>}
                        {inc.closed ? <span style={{fontSize:11,color:"#10b981",fontWeight:700}}>✓ Closed</span> : <span style={{fontSize:11,color:"#f59e0b",fontWeight:700}}>⏳ Open</span>}
                        {isIncompleteQuickReport(inc) && <span style={{fontSize:11,fontWeight:700,color:Z.amber,background:`${Z.amber}1f`,padding:"2px 8px",borderRadius:6,border:`1px solid ${Z.amber}55`}}>⚡ Needs full details</span>}
                      </div>
                      <p style={{margin:"0 0 8px",fontSize:13,color:Z.slate,lineHeight:1.5}}>{inc.description}</p>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {ac && <span style={{fontSize:11,background:"rgba(37,99,235,0.12)",color:Z.accentLt,padding:"2px 9px",borderRadius:6,fontWeight:600}}>Code {ac.code}: {ac.desc}</span>}
                        {nc && <span style={{fontSize:11,background:"rgba(37,99,235,0.12)",color:Z.accentLt,padding:"2px 9px",borderRadius:6,fontWeight:600}}>#{nc.num}: {nc.desc}</span>}
                        {inc.injuryType!=="None / No injury" && <span style={{fontSize:11,background:"rgba(239,68,68,0.1)",color:"#fca5a5",padding:"2px 9px",borderRadius:6,fontWeight:600}}>🩹 {inc.injuryType}</span>}
                        {inc.postIncidentOutcome && <span style={{fontSize:11,background:"rgba(139,92,246,0.1)",color:"#c4b5fd",padding:"2px 9px",borderRadius:6,fontWeight:600}}>🏥 {inc.postIncidentOutcome}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:7,alignItems:"center",flexShrink:0}}>
                      <button onClick={e=>{ e.stopPropagation(); openEdit(inc); }}
                        style={{background:"rgba(37,99,235,0.12)",color:Z.accentLt,border:`1px solid ${Z.accent}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                        ✏ Edit
                      </button>
                      <span style={{color:Z.muted,fontSize:16,transition:"transform .2s",display:"inline-block",transform:isOpen?"rotate(90deg)":"rotate(0deg)"}}>›</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{borderTop:`1px solid ${Z.border}`,background:Z.overlay,padding:"16px 18px"}}>
                      <IncidentPhotos photos={inc.photos} Z={Z}/>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:12}}>
                        {inc.personName && <div><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"}}>Person Involved</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{inc.personName}</div></div>}
                        {inc.personDob && <div><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"}}>Date of Birth</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{inc.personDob}</div></div>}
                        {(inc.personAddress||inc.personPostcode) && <div><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"}}>Address</div><div style={{fontSize:12,color:Z.white}}>{[inc.personAddress,inc.personPostcode].filter(Boolean).join(", ")}</div></div>}
                        {inc.firstAidProvided && inc.firstAidProvided!=="No" && <div><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"}}>First Aid</div><div style={{fontSize:12,color:"#6ee7b7"}}>{inc.firstAidProvided}{inc.firstAidBy?` · by ${inc.firstAidBy}`:""}</div></div>}
                        {inc.postIncidentOutcome && <div><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:3,textTransform:"uppercase"}}>Post-Incident</div><div style={{fontSize:12,color:"#c4b5fd",fontWeight:600}}>{inc.postIncidentOutcome}</div></div>}
                      </div>
                      {(inc.witness1Name||inc.witness2Name) && <div style={{marginBottom:10,padding:"10px 12px",background:Z.overlay,borderRadius:8,border:`1px solid ${Z.border}`}}><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:6,textTransform:"uppercase"}}>Witnesses</div>{inc.witness1Name&&<div style={{fontSize:12,color:Z.slate}}>{inc.witness1Name}{inc.witness1Contact?` · ${inc.witness1Contact}`:""}</div>}{inc.witness2Name&&<div style={{fontSize:12,color:Z.slate,marginTop:3}}>{inc.witness2Name}{inc.witness2Contact?` · ${inc.witness2Contact}`:""}</div>}</div>}
                      {inc.firstAidDetails && <div style={{marginBottom:10,padding:"10px 12px",background:Z.overlay,borderRadius:8,border:`1px solid ${Z.border}`}}><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>First Aid Treatment</div><p style={{margin:0,fontSize:12,color:Z.slate,lineHeight:1.6}}>{inc.firstAidDetails}</p></div>}
                      {inc.immediateMeasures && <div style={{marginBottom:10,padding:"10px 12px",background:Z.overlay,borderRadius:8,border:`1px solid ${Z.border}`}}><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>Immediate Measures Taken</div><p style={{margin:0,fontSize:12,color:Z.slate,lineHeight:1.6}}>{inc.immediateMeasures}</p></div>}
                      {inc.correctiveActions && <div style={{marginBottom:6,padding:"10px 12px",background:Z.overlay,borderRadius:8,border:`1px solid ${Z.border}`}}><div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>Corrective Actions{inc.correctiveActionsBy?` · Actioned by ${inc.correctiveActionsBy}`:""}</div><p style={{margin:0,fontSize:12,color:Z.slate,lineHeight:1.6}}>{inc.correctiveActions}</p></div>}
                      {inc.equipmentInvolved && inc.equipmentId && (()=>{
                        const eq = (equipment||[]).find(e=>e.id===inc.equipmentId);
                        return (
                          <div style={{marginTop:6,padding:"10px 12px",background:"rgba(245,158,11,0.06)",borderRadius:8,border:`1px solid ${inc.equipmentOOS?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.2)"}`}}>
                            <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:"#f59e0b",marginBottom:4,textTransform:"uppercase"}}>⚙️ Equipment Involved</div>
                            <div style={{fontSize:12,fontWeight:700,color:Z.white,marginBottom:inc.equipmentDamaged?4:0}}>{eq?`${eq.assetNo} — ${eq.name}`:inc.equipmentId}{inc.equipmentOOS&&<span style={{marginLeft:8,fontSize:10,color:"#f87171",fontWeight:700}}>🚫 Out of Service</span>}</div>
                            {inc.equipmentDamaged && inc.equipmentDamageDesc && <div style={{fontSize:12,color:"#fca5a5"}}><strong>Damage:</strong> {inc.equipmentDamageDesc}</div>}
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
    </div>
  );
}


export { IncidentTracker };