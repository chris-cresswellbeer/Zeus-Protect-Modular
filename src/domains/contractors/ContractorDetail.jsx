import React from "react";
import { Avatar } from "../../shared/primitives";
import { INDUCTION_ITEMS } from "../../data/seedContractors";
import { WorkerDetailModal } from "./WorkerDetailModal";
import { CompanyForm } from "./CompanyForm";

function ContractorDetail({ selCon, contractorInductions, setContractorInductions, contractorCerts, setContractorCerts, contractorVisits, setContractorVisits, contractors, setContractors, dbSaveContractor, dbDeleteContractor, dbSaveContractorInductions, dbSaveContractorCerts, dbSaveContractorVisits, staff, isMobile, setView, T, font }) {
  const today = new Date().toISOString().slice(0,10);
  const [tab, setTab] = React.useState("visits");
  const [showVisitForm, setShowVisitForm] = React.useState(false);
  const [visitForm, setVisitForm] = React.useState({id:"",date:today,timeIn:"",timeOut:"",purpose:"",areas:"",signedInBy:"",workers:[],permitRequired:false,notes:""});
  const [showWorkerForm, setShowWorkerForm] = React.useState(false);
  const [workerForm, setWorkerForm] = React.useState({id:"",name:"",role:"",email:"",phone:""});
  const [editingCon, setEditingCon] = React.useState(null);
  const [selectedWorker, setSelectedWorker] = React.useState(null);
  const [editingVisitIdx, setEditingVisitIdx] = React.useState(null);
  const [editVisitForm, setEditVisitForm] = React.useState(null);
  const [showScheduleForm, setShowScheduleForm] = React.useState(false);
  const [scheduleForm, setScheduleForm] = React.useState({id:"",date:"",timeIn:"",timeOut:"",purpose:"",areas:"",workers:[],permitRequired:false,notes:""});

  const workers = selCon.workers||[];
  const allVisits = (contractorVisits[selCon.id]||[]).slice();
  const visits = allVisits.filter(v=>v.date<=today).sort((a,b)=>b.date.localeCompare(a.date));
  const upcoming = allVisits.filter(v=>v.date>today).sort((a,b)=>a.date.localeCompare(b.date));
  const inp = {width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"9px 13px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const lbl = {fontSize:11,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5};

  function saveVisit() {
    const v = {...visitForm, id:"v_"+Date.now()};
    const newVisits = [v, ...visits];
    setContractorVisits(p=>({...p,[selCon.id]:newVisits}));
    dbSaveContractorVisits(selCon.id, newVisits);
    setShowVisitForm(false);
    setVisitForm({id:"",date:today,timeIn:"",timeOut:"",purpose:"",areas:"",signedInBy:"",workers:[],permitRequired:false,notes:""});
  }

  function saveWorker() {
    const w = {...workerForm, id:"w_"+Date.now()};
    const updated = {...selCon, workers:[...(selCon.workers||[]), w]};
    setContractors(p=>p.map(c=>c.id===selCon.id?updated:c));
    dbSaveContractor(updated);
    setWorkerForm({id:"",name:"",role:"",email:"",phone:""});
    setShowWorkerForm(false);
  }

  function removeWorker(wid) {
    const updated = {...selCon, workers:(selCon.workers||[]).filter(w=>w.id!==wid)};
    setContractors(p=>p.map(c=>c.id===selCon.id?updated:c));
    dbSaveContractor(updated);
  }

  return (
    <div>
      {selectedWorker && (
        <WorkerDetailModal worker={selectedWorker} companyId={selCon.id} contractorInductions={contractorInductions} setContractorInductions={setContractorInductions} contractorCerts={contractorCerts} setContractorCerts={setContractorCerts} dbSaveContractorInductions={dbSaveContractorInductions} dbSaveContractorCerts={dbSaveContractorCerts} onClose={()=>setSelectedWorker(null)} T={T} font={font}/>
      )}
      <button onClick={()=>setView("list")} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"7px 14px",color:T.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,marginBottom:20}}>← Back to Register</button>

      {/* Company header */}
      <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,border:`1px solid ${T.borderMd}`,marginBottom:4}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:14}}>
          <div>
            <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:900,color:T.white}}>{selCon.name}</h2>
            <p style={{margin:0,fontSize:13,color:T.muted}}>{selCon.type||"Contractor"}{selCon.email?` · ${selCon.email}`:""}{selCon.phone?` · ${selCon.phone}`:""}</p>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20,background:selCon.status==="active"?"rgba(16,185,129,0.12)":T.overlay,color:selCon.status==="active"?"#10b981":T.muted,border:`1px solid ${selCon.status==="active"?"rgba(16,185,129,0.3)":T.borderMd}`,textTransform:"capitalize"}}>{selCon.status||"active"}</span>
            <button onClick={()=>setEditingCon(selCon)} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,padding:"5px 12px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12}}>✏ Edit</button>
            <button onClick={()=>{if(window.confirm(`Remove ${selCon.name}?`)){setContractors(p=>p.filter(c=>c.id!==selCon.id));dbDeleteContractor(selCon.id);setView("list");}}} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:9,padding:"5px 12px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12}}>🗑</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
          {[{l:"Workers",v:workers.length},{l:"Total Visits",v:visits.length},{l:"Last Visit",v:visits[0]?.date||"Never"},{l:"On Site Today",v:visits.filter(v=>v.date===today).length>0?"Yes":"No"}].map((r,i)=>(
            <div key={i} style={{background:T.overlay,borderRadius:8,padding:"8px 12px"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>{r.l}</div>
              <div style={{fontSize:13,color:T.white,fontWeight:700}}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>

      {editingCon && (
        <div style={{marginTop:12}}>
          <CompanyForm existing={editingCon} onSave={c=>{setContractors(p=>p.map(x=>x.id===c.id?c:x));dbSaveContractor(c);setEditingCon(null);}} onCancel={()=>setEditingCon(null)} T={T} font={font}/>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:20}}>
        {[["visits",`🗓 Visits (${visits.length})`],["workers",`👷 Workers (${workers.length})`]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"11px 18px",background:"none",border:"none",borderBottom:`2px solid ${tab===id?T.gold:"transparent"}`,color:tab===id?T.white:T.muted,fontWeight:tab===id?700:400,cursor:"pointer",fontFamily:font,fontSize:13}}>{label}</button>
        ))}
      </div>

      {/* Visits tab */}
      {tab==="visits" && (
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <h3 style={{margin:0,fontSize:15,fontWeight:800,color:T.white}}>Visit Log</h3>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowVisitForm(v=>!v)} style={{background:showVisitForm?"rgba(239,68,68,0.1)":`linear-gradient(135deg,${T.accent},${T.blue})`,color:showVisitForm?"#f87171":"#fff",border:showVisitForm?"1px solid rgba(239,68,68,0.2)":"none",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>
                {showVisitForm?"✕ Cancel":"+ Log Visit"}
              </button>
              <button onClick={()=>setShowScheduleForm(v=>!v)} style={{background:showScheduleForm?"rgba(239,68,68,0.1)":`rgba(245,158,11,0.1)`,color:showScheduleForm?"#f87171":"#f59e0b",border:`1px solid ${showScheduleForm?"rgba(239,68,68,0.2)":"rgba(245,158,11,0.3)"}`,borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,whiteSpace:"nowrap"}}>
                {showScheduleForm?"✕ Cancel":"📅 Schedule Visit"}
              </button>
            </div>
          </div>
          {showVisitForm && (
            <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:20,border:`1px solid ${T.borderMd}`,marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={lbl}>Date *</label><input type="date" style={inp} value={visitForm.date} onChange={e=>setVisitForm(p=>({...p,date:e.target.value}))}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><label style={lbl}>Time In</label><input type="time" style={inp} value={visitForm.timeIn} onChange={e=>setVisitForm(p=>({...p,timeIn:e.target.value}))}/></div>
                  <div><label style={lbl}>Time Out</label><input type="time" style={inp} value={visitForm.timeOut} onChange={e=>setVisitForm(p=>({...p,timeOut:e.target.value}))}/></div>
                </div>
                <div><label style={lbl}>Purpose / Job Description *</label><input style={inp} value={visitForm.purpose} onChange={e=>setVisitForm(p=>({...p,purpose:e.target.value}))} placeholder="e.g. Annual boiler service"/></div>
                <div><label style={lbl}>Areas Accessed</label><input style={inp} value={visitForm.areas} onChange={e=>setVisitForm(p=>({...p,areas:e.target.value}))} placeholder="e.g. Boiler room, Plant room"/></div>
                <div><label style={lbl}>Signed In By (Zeus Staff)</label>
                  <select style={inp} value={visitForm.signedInBy} onChange={e=>setVisitForm(p=>({...p,signedInBy:e.target.value}))}>
                    <option value="">Select staff member...</option>
                    {staff.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:22}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:T.white}}>
                    <input type="checkbox" checked={visitForm.permitRequired} onChange={e=>setVisitForm(p=>({...p,permitRequired:e.target.checked}))} style={{accentColor:T.accent,width:16,height:16}}/>
                    Permit to Work required
                  </label>
                </div>
              </div>
              {/* Workers on this visit */}
              {workers.length>0 && (
                <div style={{marginBottom:12}}>
                  <label style={lbl}>Workers On Site This Visit</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {workers.map(w=>{
                      const selected=visitForm.workers.includes(w.id);
                      return (
                        <button key={w.id} onClick={()=>setVisitForm(p=>({...p,workers:selected?p.workers.filter(x=>x!==w.id):[...p.workers,w.id]}))}
                          style={{display:"flex",alignItems:"center",gap:7,padding:"6px 12px",borderRadius:20,border:`2px solid ${selected?T.accent:T.borderMd}`,background:selected?`rgba(37,99,235,0.15)`:T.overlay,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:selected?700:400,color:selected?T.accentLt:T.muted,transition:"all .15s"}}>
                          <Avatar name={w.name} size={18}/>
                          {w.name}{w.role?` (${w.role})`:""}
                          {selected && <span style={{fontSize:10}}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{marginBottom:12}}><label style={lbl}>Notes</label><textarea style={{...inp,minHeight:50,resize:"vertical"}} value={visitForm.notes} onChange={e=>setVisitForm(p=>({...p,notes:e.target.value}))}/></div>
              <button onClick={saveVisit} disabled={!visitForm.date||!visitForm.purpose.trim()} style={{background:(!visitForm.date||!visitForm.purpose.trim())?"rgba(37,99,235,0.3)":`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",cursor:(!visitForm.date||!visitForm.purpose.trim())?"not-allowed":"pointer",fontFamily:font,fontWeight:700,fontSize:13,opacity:(!visitForm.date||!visitForm.purpose.trim())?.5:1}}>
                ✓ Save Visit
              </button>
            </div>
          )}
          {showScheduleForm && (
            <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:20,border:`1px solid rgba(245,158,11,0.3)`,marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f59e0b",marginBottom:12,textTransform:"uppercase",letterSpacing:.5}}>📅 Schedule Upcoming Visit</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={lbl}>Date *</label><input type="date" style={inp} min={new Date(Date.now()+86400000).toISOString().slice(0,10)} value={scheduleForm.date} onChange={e=>setScheduleForm(p=>({...p,date:e.target.value}))}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><label style={lbl}>Expected Time In</label><input type="time" style={inp} value={scheduleForm.timeIn} onChange={e=>setScheduleForm(p=>({...p,timeIn:e.target.value}))}/></div>
                  <div><label style={lbl}>Expected Time Out</label><input type="time" style={inp} value={scheduleForm.timeOut} onChange={e=>setScheduleForm(p=>({...p,timeOut:e.target.value}))}/></div>
                </div>
                <div><label style={lbl}>Purpose *</label><input style={inp} value={scheduleForm.purpose} onChange={e=>setScheduleForm(p=>({...p,purpose:e.target.value}))} placeholder="e.g. Quarterly HVAC service"/></div>
                <div><label style={lbl}>Areas</label><input style={inp} value={scheduleForm.areas} onChange={e=>setScheduleForm(p=>({...p,areas:e.target.value}))} placeholder="e.g. Plant room"/></div>
                <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:22}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:T.white}}>
                    <input type="checkbox" checked={!!scheduleForm.permitRequired} onChange={e=>setScheduleForm(p=>({...p,permitRequired:e.target.checked}))} style={{accentColor:T.accent,width:16,height:16}}/>
                    Permit to Work required
                  </label>
                </div>
              </div>
              {workers.length>0 && (
                <div style={{marginBottom:10}}>
                  <label style={lbl}>Expected Workers</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {workers.map(w=>{
                      const sel=(scheduleForm.workers||[]).includes(w.id);
                      return (
                        <button key={w.id} onClick={()=>setScheduleForm(p=>({...p,workers:sel?(p.workers||[]).filter(x=>x!==w.id):[...(p.workers||[]),w.id]}))}
                          style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:`2px solid ${sel?"#f59e0b":T.borderMd}`,background:sel?"rgba(245,158,11,0.1)":T.overlay,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:sel?700:400,color:sel?"#f59e0b":T.muted}}>
                          <Avatar name={w.name} size={16}/>{w.name}{sel&&" ✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{marginBottom:12}}><label style={lbl}>Notes</label><textarea style={{...inp,minHeight:50,resize:"vertical"}} value={scheduleForm.notes} onChange={e=>setScheduleForm(p=>({...p,notes:e.target.value}))}/></div>
              <button onClick={()=>{
                const v={...scheduleForm,id:"v_"+Date.now(),scheduled:true};
                const newVisits=[...allVisits,v];
                setContractorVisits(p=>({...p,[selCon.id]:newVisits}));
                dbSaveContractorVisits(selCon.id,newVisits);
                setShowScheduleForm(false);
                setScheduleForm({id:"",date:"",timeIn:"",timeOut:"",purpose:"",areas:"",workers:[],permitRequired:false,notes:""});
              }} disabled={!scheduleForm.date||!scheduleForm.purpose.trim()}
                style={{background:(!scheduleForm.date||!scheduleForm.purpose.trim())?"rgba(245,158,11,0.2)":`linear-gradient(135deg,#f59e0b,#d97706)`,color:(!scheduleForm.date||!scheduleForm.purpose.trim())?"#b45309":"#000",border:"none",borderRadius:10,padding:"10px 24px",cursor:(!scheduleForm.date||!scheduleForm.purpose.trim())?"not-allowed":"pointer",fontFamily:font,fontWeight:700,fontSize:13,opacity:(!scheduleForm.date||!scheduleForm.purpose.trim())?.5:1}}>
                📅 Schedule Visit
              </button>
            </div>
          )}

          {/* Upcoming visits */}
          {upcoming.length>0 && (
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f59e0b",textTransform:"uppercase",letterSpacing:.5,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                <span>📅 Upcoming Visits ({upcoming.length})</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {upcoming.map((v,vi)=>{
                  const daysUntil = Math.ceil((new Date(v.date)-new Date())/86400000);
                  return (
                    <div key={v.id||vi} style={{background:"rgba(245,158,11,0.06)",borderRadius:12,padding:"14px 18px",border:"1px solid rgba(245,158,11,0.2)",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                          <span style={{fontSize:13,fontWeight:800,color:"#f59e0b"}}>{v.date}</span>
                          <span style={{fontSize:11,color:T.muted}}>in {daysUntil} day{daysUntil!==1?"s":""}</span>
                          {v.timeIn && <span style={{fontSize:11,color:T.muted}}>{v.timeIn}{v.timeOut?` – ${v.timeOut}`:""}</span>}
                          {v.permitRequired && <span style={{fontSize:10,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,0.12)",padding:"1px 7px",borderRadius:20,border:"1px solid rgba(245,158,11,0.3)"}}>⚠ Permit</span>}
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:T.white,marginBottom:4}}>{v.purpose}</div>
                        {v.workers&&v.workers.length>0 && (
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
                            <span style={{fontSize:11,color:T.muted}}>👷</span>
                            {v.workers.map(wid=>{const w=workers.find(x=>x.id===wid);return w?<span key={wid} style={{fontSize:11,color:T.white,background:T.overlay,padding:"1px 8px",borderRadius:20,border:`1px solid ${T.border}`}}>{w.name}</span>:null;})}
                          </div>
                        )}
                        {v.areas && <div style={{fontSize:11,color:T.muted}}>📍 {v.areas}</div>}
                        {v.notes && <div style={{fontSize:11,color:T.muted,fontStyle:"italic",marginTop:2}}>{v.notes}</div>}
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button onClick={()=>{
                          // Convert scheduled visit to actual (mark as today)
                          if(window.confirm("Mark this visit as completed today?")) {
                            const nv=allVisits.map(x=>x.id===v.id?{...x,date:today,scheduled:false}:x);
                            setContractorVisits(p=>({...p,[selCon.id]:nv}));
                            dbSaveContractorVisits(selCon.id,nv);
                          }
                        }} style={{background:"rgba(16,185,129,0.1)",color:T.green,border:"1px solid rgba(16,185,129,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:font,fontWeight:700,whiteSpace:"nowrap"}}>✓ Complete</button>
                        <button onClick={()=>{const nv=allVisits.filter(x=>x.id!==v.id);setContractorVisits(p=>({...p,[selCon.id]:nv}));dbSaveContractorVisits(selCon.id,nv);}} style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.15)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:font,fontWeight:700}}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {visits.length===0
            ? <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"32px 20px",textAlign:"center",border:`1px solid ${T.border}`,color:T.muted,fontSize:14}}>No visits logged yet.</div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {visits.map((v,vi)=>(
                <div key={v.id||vi} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"16px 20px",border:`1px solid ${editingVisitIdx===vi?T.accent:T.border}`}}>
                  {editingVisitIdx===vi && editVisitForm ? (
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:T.accentLt,marginBottom:12,textTransform:"uppercase",letterSpacing:.5}}>Editing Visit</div>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                        <div><label style={lbl}>Date</label><input type="date" style={inp} value={editVisitForm.date} onChange={e=>setEditVisitForm(p=>({...p,date:e.target.value}))}/></div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          <div><label style={lbl}>Time In</label><input type="time" style={inp} value={editVisitForm.timeIn||""} onChange={e=>setEditVisitForm(p=>({...p,timeIn:e.target.value}))}/></div>
                          <div><label style={lbl}>Time Out</label><input type="time" style={inp} value={editVisitForm.timeOut||""} onChange={e=>setEditVisitForm(p=>({...p,timeOut:e.target.value}))}/></div>
                        </div>
                        <div><label style={lbl}>Purpose</label><input style={inp} value={editVisitForm.purpose} onChange={e=>setEditVisitForm(p=>({...p,purpose:e.target.value}))}/></div>
                        <div><label style={lbl}>Areas Accessed</label><input style={inp} value={editVisitForm.areas||""} onChange={e=>setEditVisitForm(p=>({...p,areas:e.target.value}))}/></div>
                        <div><label style={lbl}>Signed In By</label>
                          <select style={inp} value={editVisitForm.signedInBy||""} onChange={e=>setEditVisitForm(p=>({...p,signedInBy:e.target.value}))}>
                            <option value="">Select...</option>
                            {staff.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
                          </select>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:22}}>
                          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:T.white}}>
                            <input type="checkbox" checked={!!editVisitForm.permitRequired} onChange={e=>setEditVisitForm(p=>({...p,permitRequired:e.target.checked}))} style={{accentColor:T.accent,width:16,height:16}}/>
                            Permit to Work
                          </label>
                        </div>
                      </div>
                      {workers.length>0 && (
                        <div style={{marginBottom:10}}>
                          <label style={lbl}>Workers On Site</label>
                          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                            {workers.map(w=>{
                              const sel=(editVisitForm.workers||[]).includes(w.id);
                              return (
                                <button key={w.id} onClick={()=>setEditVisitForm(p=>({...p,workers:sel?(p.workers||[]).filter(x=>x!==w.id):[...(p.workers||[]),w.id]}))}
                                  style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:`2px solid ${sel?T.accent:T.borderMd}`,background:sel?`rgba(37,99,235,0.15)`:T.overlay,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:sel?700:400,color:sel?T.accentLt:T.muted}}>
                                  <Avatar name={w.name} size={16}/>{w.name}{sel&&" ✓"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div style={{marginBottom:10}}><label style={lbl}>Notes</label><textarea style={{...inp,minHeight:50,resize:"vertical"}} value={editVisitForm.notes||""} onChange={e=>setEditVisitForm(p=>({...p,notes:e.target.value}))}/></div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>{
                          const nv=visits.map((x,j)=>j===vi?{...editVisitForm}:x);
                          setContractorVisits(p=>({...p,[selCon.id]:nv}));
                          dbSaveContractorVisits(selCon.id,nv);
                          setEditingVisitIdx(null);setEditVisitForm(null);
                        }} style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:9,padding:"8px 20px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>✓ Save</button>
                        <button onClick={()=>{setEditingVisitIdx(null);setEditVisitForm(null);}} style={{background:T.overlay,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"8px 16px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:14,fontWeight:800,color:T.white}}>{v.date}</span>
                        {v.timeIn && <span style={{fontSize:12,color:T.muted}}>{v.timeIn}{v.timeOut?` – ${v.timeOut}`:""}</span>}
                        {v.permitRequired && <span style={{fontSize:10,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,0.12)",padding:"1px 7px",borderRadius:20,border:"1px solid rgba(245,158,11,0.3)"}}>⚠ Permit</span>}
                        {v.date===today && <span style={{fontSize:10,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,0.12)",padding:"1px 7px",borderRadius:20,border:"1px solid rgba(16,185,129,0.3)"}}>TODAY</span>}
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:T.white,marginBottom:6}}>{v.purpose}</div>
                      {v.workers&&v.workers.length>0 && (
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
                          <span style={{fontSize:11,color:T.muted}}>👷</span>
                          {v.workers.map(wid=>{
                            const w=workers.find(x=>x.id===wid);
                            return w ? <span key={wid} style={{fontSize:11,color:T.white,background:T.overlay,padding:"1px 8px",borderRadius:20,border:`1px solid ${T.border}`}}>{w.name}</span> : null;
                          })}
                        </div>
                      )}
                      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                        {v.areas && <span style={{fontSize:11,color:T.muted}}>📍 {v.areas}</span>}
                        {v.signedInBy && <span style={{fontSize:11,color:T.muted}}>✍ {v.signedInBy}</span>}
                      </div>
                      {v.notes && <div style={{marginTop:4,fontSize:11,color:T.muted,fontStyle:"italic"}}>{v.notes}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>{setEditingVisitIdx(vi);setEditVisitForm({...v});}} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:font,fontWeight:700,whiteSpace:"nowrap"}}>Edit</button>
                      <button onClick={()=>{if(window.confirm("Delete this visit?")){{const nv=visits.filter((_,j)=>j!==vi);setContractorVisits(p=>({...p,[selCon.id]:nv}));dbSaveContractorVisits(selCon.id,nv);}}}} style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.15)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:font,fontWeight:700}}>🗑</button>
                    </div>
                  </div>
                  )}
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* Workers tab */}
      {tab==="workers" && (
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <h3 style={{margin:0,fontSize:15,fontWeight:800,color:T.white}}>Workers</h3>
            <button onClick={()=>setShowWorkerForm(v=>!v)} style={{background:showWorkerForm?"rgba(239,68,68,0.1)":`linear-gradient(135deg,${T.accent},${T.blue})`,color:showWorkerForm?"#f87171":"#fff",border:showWorkerForm?"1px solid rgba(239,68,68,0.2)":"none",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>
              {showWorkerForm?"✕ Cancel":"+ Add Worker"}
            </button>
          </div>
          {showWorkerForm && (
            <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:18,border:`1px solid ${T.borderMd}`,marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={lbl}>Full Name *</label><input style={inp} value={workerForm.name} onChange={e=>setWorkerForm(p=>({...p,name:e.target.value}))}/></div>
                <div><label style={lbl}>Role / Trade</label><input style={inp} value={workerForm.role} onChange={e=>setWorkerForm(p=>({...p,role:e.target.value}))} placeholder="e.g. Electrician"/></div>
                <div><label style={lbl}>Email</label><input style={inp} value={workerForm.email} onChange={e=>setWorkerForm(p=>({...p,email:e.target.value}))}/></div>
                <div><label style={lbl}>Phone</label><input style={inp} value={workerForm.phone} onChange={e=>setWorkerForm(p=>({...p,phone:e.target.value}))}/></div>
              </div>
              <button onClick={saveWorker} disabled={!workerForm.name.trim()} style={{background:workerForm.name.trim()?`linear-gradient(135deg,${T.accent},${T.blue})`:"rgba(37,99,235,0.3)",color:"#fff",border:"none",borderRadius:10,padding:"9px 22px",cursor:workerForm.name.trim()?"pointer":"not-allowed",fontFamily:font,fontWeight:700,fontSize:13,opacity:workerForm.name.trim()?1:.5}}>Add Worker</button>
            </div>
          )}
          {workers.length===0
            ? <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"28px 20px",textAlign:"center",border:`1px solid ${T.border}`,color:T.muted,fontSize:14}}>No workers added yet.</div>
            : <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,overflow:"hidden",border:`1px solid ${T.border}`}}>
              {workers.map((w,i)=>{
                const wid=`${selCon.id}_${w.id}`;
                const wInd=contractorInductions[wid]||{};
                const wIndPct=Math.round(INDUCTION_ITEMS.filter(item=>wInd[item.id]?.done).length/INDUCTION_ITEMS.length*100);
                const wCerts=contractorCerts[wid]||{};
                const hasExpiredCert=Object.values(wCerts).some(c=>c.expiryDate&&c.expiryDate<today);
                return (
                  <div key={w.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
                    <Avatar name={w.name} size={32}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,fontWeight:700,color:T.white}}>{w.name}</span>
                        {w.role && <span style={{fontSize:11,color:T.muted}}>{w.role}</span>}
                        {hasExpiredCert && <span style={{fontSize:9,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,0.1)",padding:"1px 6px",borderRadius:20,border:"1px solid rgba(239,68,68,0.2)"}}>CERT EXPIRED</span>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:4}}>
                        <div style={{fontSize:10,color:wIndPct===100?T.green:wIndPct>0?"#f59e0b":"#f87171",fontWeight:700}}>{wIndPct===100?"✓ Inducted":`Induction ${wIndPct}%`}</div>
                        <div style={{height:3,background:T.border,borderRadius:99,overflow:"hidden",width:50}}>
                          <div style={{height:"100%",width:`${wIndPct}%`,background:wIndPct===100?T.green:"#f59e0b",borderRadius:99}}/>
                        </div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setSelectedWorker(w)} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11}}>Manage →</button>
                      <button onClick={()=>{if(window.confirm(`Remove ${w.name}?`)) removeWorker(w.id);}} style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.15)",borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:11}}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      )}
    </div>
  );
}


export { ContractorDetail };
