import { useState, useEffect, useRef } from "react";
import { useWindowWidth } from "../../shared/hooks";
import { Avatar } from "../../shared/primitives";
import { HelpTip } from "../../shared/HelpTip";
import { machineExpiryStatus, MACHINERY_TYPES, MACHINE_CATEGORIES, COMP_STATUS, isWarehouseWorker } from "../../data/seedMachinery";

function AdminMachineryTab({ allStaff, machineComps, setMachineComps, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const warehouseStaff = allStaff.filter(u=>u.role!=="admin"&&isWarehouseWorker(u));
  const [selectedUser, setSelectedUser] = useState(warehouseStaff[0]?.id||null);
  const [editingId, setEditingId] = useState(null);  // comp id being edited, or "new"
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [newObs, setNewObs] = useState("");
  const formRef = useRef(null);

  useEffect(()=>{
    if (editingId && formRef.current) {
      formRef.current.scrollIntoView({ behavior:"smooth", block:"nearest" });
    }
  }, [editingId]);

  const user = allStaff.find(u=>u.id===selectedUser);
  const userComps = Object.values(machineComps[selectedUser]||{});

  function blankForm(machineId) {
    return { machineId:machineId||"", status:"provisional", trainerName:"", trainerQual:"", theoryDate:"", assessmentDate:"", observationDates:[], licenceRef:"", licenceExpiry:"", notes:"", fileNames:[] };
  }

  function startEdit(comp) { setForm({...comp, observationDates:[...comp.observationDates]}); setEditingId(comp.id); setSaved(false); }
  function startNew(machineId) { setForm(blankForm(machineId)); setEditingId("new"); setSaved(false); }
  function setF(k,v) { setForm(p=>({...p,[k]:v})); setSaved(false); }

  function saveComp() {
    const id = editingId==="new" ? "mc"+Date.now() : editingId;
    const entry = {...form, id};
    setMachineComps(p=>{
      const cur = p[selectedUser]||{};
      return {...p,[selectedUser]:{...cur,[id]:entry}};
    });
    setSaved(true); setEditingId(null); setForm(null);
  }

  function deleteComp(compId) {
    setMachineComps(p=>{
      const cur = {...(p[selectedUser]||{})};
      delete cur[compId];
      return {...p,[selectedUser]:cur};
    });
  }

  function addObs() {
    if (!newObs) return;
    setF("observationDates",[...form.observationDates, newObs].sort());
    setNewObs("");
  }

  function removeObs(i) { setF("observationDates",form.observationDates.filter((_,idx)=>idx!==i)); }

  function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    files.forEach(file=>{
      const reader = new FileReader();
      reader.onload = ev => setF("fileNames", [...(form.fileNames||[]), { name:file.name, data:ev.target.result }]);
      reader.readAsDataURL(file);
    });
  }

  const selStyle = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 13px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer",boxSizing:"border-box"};
  const inputStyle = {...selStyle,cursor:"text"};
  const labelStyle = {color:Z.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:5};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Machinery Competence Records <HelpTip dark={false} text="Track which staff are authorised to operate specific machinery. Each record shows the type of authorisation, date assessed and licence expiry if applicable. Expired records are flagged with a warning."/></h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>Manage assessed competencies for warehouse and operational staff only</p>
        </div>
      </div>

      {/* Staff selector — dropdown */}
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"14px 18px",marginBottom:16,border:`1px solid ${Z.border}`,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:12,fontWeight:700,color:Z.muted,whiteSpace:"nowrap",flexShrink:0}}>STAFF MEMBER:</span>
        <select
          value={selectedUser||""}
          onChange={e=>{setSelectedUser(Number(e.target.value));setEditingId(null);setForm(null);}}
          style={{flex:1,minWidth:200,background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 13px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"}}>
          {warehouseStaff.map(u=>{
            const uc = Object.values(machineComps[u.id]||{});
            const expiredCnt = uc.filter(c=>{const ex=machineExpiryStatus(c);return c.status==="expired"||(ex&&ex.status==="expired");}).length;
            return (
              <option key={u.id} value={u.id}>
                {u.name}{u.jobTitle?` — ${u.jobTitle}`:""}
                {expiredCnt>0?" ⚠ Expired":""}
              </option>
            );
          })}
        </select>
      </div>

      {user && (
        <div>
          {/* User header */}
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"14px 18px",marginBottom:16,border:`1px solid ${Z.border}`,display:"flex",alignItems:"center",gap:12}}>
            <Avatar name={user.name} size={40}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15,color:Z.white}}>{user.name}</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>{user.jobTitle} · Manager: {user.manager||"—"}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <span style={{fontSize:12,background:"rgba(16,185,129,0.1)",color:"#10b981",padding:"4px 12px",borderRadius:8,fontWeight:600}}>
                {userComps.filter(c=>c.status==="competent"&&!( machineExpiryStatus(c)?.status==="expired")).length} competent
              </span>
              {userComps.filter(c=>c.status==="provisional").length>0&&<span style={{fontSize:12,background:"rgba(245,158,11,0.1)",color:"#f59e0b",padding:"4px 12px",borderRadius:8,fontWeight:600}}>{userComps.filter(c=>c.status==="provisional").length} provisional</span>}
            </div>
          </div>

          {/* Edit/new form */}
          {editingId && form && (
            <div ref={formRef} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:24,marginBottom:16,border:`1px solid rgba(37,99,235,0.35)`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <h3 style={{margin:0,fontSize:14,fontWeight:800,color:Z.accentLt,letterSpacing:.5,textTransform:"uppercase"}}>
                  {editingId==="new"?"Add New":"Edit"} Competence Record
                  {form.machineId&&<span style={{marginLeft:8,fontSize:13,color:Z.white}}>— {MACHINERY_TYPES.find(m=>m.id===form.machineId)?.label}</span>}
                </h3>
                <button onClick={()=>{setEditingId(null);setForm(null);}} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 12px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>✕ Cancel</button>
              </div>

              {editingId==="new"&&(
                <div style={{marginBottom:14}}>
                  <label style={labelStyle}>EQUIPMENT TYPE *</label>
                  <select value={form.machineId} onChange={e=>setF("machineId",e.target.value)} style={selStyle}>
                    <option value="">— Select equipment —</option>
                    {MACHINERY_TYPES.map(m=><option key={m.id} value={m.id}>{m.icon} {m.label} ({m.category})</option>)}
                  </select>
                </div>
              )}

              {/* Status */}
              <div style={{marginBottom:14}}>
                <label style={labelStyle}>STATUS *</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {Object.entries(COMP_STATUS).map(([k,v])=>(
                    <button key={k} onClick={()=>setF("status",k)}
                      style={{padding:"7px 16px",borderRadius:10,border:`2px solid ${form.status===k?v.color:Z.borderMd}`,background:form.status===k?v.bg:Z.overlay,color:form.status===k?v.color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12,transition:"all .2s"}}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trainer */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
                <div><label style={labelStyle}>TRAINER NAME</label><input value={form.trainerName} onChange={e=>setF("trainerName",e.target.value)} placeholder="e.g. Mark Davies" style={inputStyle}/></div>
                <div><label style={labelStyle}>TRAINER QUALIFICATION</label><input value={form.trainerQual} onChange={e=>setF("trainerQual",e.target.value)} placeholder="e.g. RTITB Instructor" style={inputStyle}/></div>
              </div>

              {/* Dates */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:14}}>
                <div><label style={labelStyle}>THEORY / INDUCTION DATE</label><input type="date" value={form.theoryDate} onChange={e=>setF("theoryDate",e.target.value)} style={inputStyle}/></div>
                <div><label style={labelStyle}>PRACTICAL ASSESSMENT DATE</label><input type="date" value={form.assessmentDate} onChange={e=>setF("assessmentDate",e.target.value)} style={inputStyle}/></div>
                <div><label style={labelStyle}>LICENCE EXPIRY DATE</label><input type="date" value={form.licenceExpiry} onChange={e=>setF("licenceExpiry",e.target.value)} style={inputStyle}/></div>
              </div>

              {/* Licence ref */}
              <div style={{marginBottom:14}}>
                <label style={labelStyle}>LICENCE / CERTIFICATE REFERENCE</label>
                <input value={form.licenceRef} onChange={e=>setF("licenceRef",e.target.value)} placeholder="e.g. RTITB-2025-001" style={inputStyle}/>
              </div>

              {/* Observation dates */}
              <div style={{marginBottom:14}}>
                <label style={labelStyle}>OBSERVATION RECORDS</label>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <input type="date" value={newObs} onChange={e=>setNewObs(e.target.value)} style={{...inputStyle,flex:1}}/>
                  <button onClick={addObs} style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,flexShrink:0}}>+ Add</button>
                </div>
                {form.observationDates.length>0&&(
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {form.observationDates.map((d,i)=>(
                      <span key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,background:"rgba(37,99,235,0.12)",color:Z.accentLt,padding:"3px 10px",borderRadius:6,fontWeight:600}}>
                        #{i+1} — {d}
                        <button onClick={()=>removeObs(i)} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",padding:0,fontSize:13,lineHeight:1}}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* File upload */}
              <div style={{marginBottom:14}}>
                <label style={labelStyle}>UPLOAD LICENCE / CERTIFICATE (optional)</label>
                <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderRadius:10,border:`2px dashed ${Z.borderMd}`,cursor:"pointer",color:Z.muted,fontSize:13,background:Z.overlay}}>
                  <span>📎</span> Click to upload licence, certificate, or assessment document
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={handleFileUpload} style={{display:"none"}}/>
                </label>
                {(form.fileNames||[]).length>0&&(
                  <div style={{marginTop:8,display:"flex",gap:8,flexWrap:"wrap"}}>
                    {form.fileNames.map((f,i)=>(
                      <span key={i} style={{fontSize:11,background:"rgba(16,185,129,0.1)",color:"#10b981",padding:"2px 10px",borderRadius:6,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                        📎 {f.name||f}
                        <button onClick={()=>setF("fileNames",form.fileNames.filter((_,idx)=>idx!==i))} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",padding:0,fontSize:12}}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{marginBottom:18}}>
                <label style={labelStyle}>NOTES / RESTRICTIONS</label>
                <textarea value={form.notes} onChange={e=>setF("notes",e.target.value)} placeholder="Any restrictions, conditions, or additional notes..." rows={2} style={{...inputStyle,resize:"vertical",lineHeight:1.6}}/>
              </div>

              {saved&&<div style={{marginBottom:12,padding:"8px 14px",background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,color:"#10b981",fontSize:13,fontWeight:600}}>✓ Record saved</div>}
              <button onClick={saveComp} disabled={!form.machineId||!form.status}
                style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"11px 28px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:13,opacity:(form.machineId&&form.status)?1:.45,boxShadow:`0 4px 16px ${Z.accent}44`}}>
                {editingId==="new"?"Save Record →":"Update Record →"}
              </button>
            </div>
          )}

          {/* Competence list by category */}
          {MACHINE_CATEGORIES.map(cat=>{
            const catMachines = MACHINERY_TYPES.filter(m=>m.category===cat);
            const catComps = userComps.filter(c=>catMachines.some(m=>m.id===c.machineId));
            const unassigned = catMachines.filter(m=>!userComps.find(c=>c.machineId===m.id));
            return (
              <div key={cat} style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <h3 style={{fontSize:11,fontWeight:800,letterSpacing:1,color:Z.muted,textTransform:"uppercase",margin:0}}>{cat}</h3>
                </div>
                {catComps.length>0&&catComps.map(comp=>{
                  const type = MACHINERY_TYPES.find(m=>m.id===comp.machineId);
                  const st = COMP_STATUS[comp.status]||COMP_STATUS.not_assessed;
                  const ex = machineExpiryStatus(comp);
                  const effectiveSt = (ex?.status==="expired"&&comp.status==="competent")?COMP_STATUS.expired:st;
                  return (
                    <div key={comp.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:13,border:`1px solid ${effectiveSt.color}33`,marginBottom:8,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                      <span style={{fontSize:22,flexShrink:0}}>{type?.icon}</span>
                      <div style={{flex:1,minWidth:160}}>
                        <div style={{fontWeight:700,fontSize:13,color:Z.white}}>{type?.label}</div>
                        <div style={{display:"flex",gap:7,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{fontSize:11,fontWeight:700,color:effectiveSt.color,background:effectiveSt.bg,padding:"2px 8px",borderRadius:99}}>{effectiveSt.icon} {effectiveSt.label}</span>
                          {comp.assessmentDate&&<span style={{fontSize:11,color:Z.muted}}>Assessed {comp.assessmentDate}</span>}
                          {comp.licenceRef&&<span style={{fontSize:10,fontFamily:"monospace",background:"rgba(245,158,11,0.1)",color:Z.gold,padding:"2px 8px",borderRadius:6,border:"1px solid rgba(245,158,11,0.25)"}}>{comp.licenceRef}</span>}
                          {ex&&<span style={{fontSize:10,fontWeight:700,color:ex.color,background:ex.bg,padding:"2px 7px",borderRadius:5}}>{ex.status==="expired"?"⚠ Expired":ex.status==="expiring"?`⏳ ${ex.daysLeft}d left`:`✓ ${ex.expiryDate}`}</span>}
                          {comp.observationDates?.length>0&&<span style={{fontSize:10,color:Z.muted}}>{comp.observationDates.length} observation{comp.observationDates.length!==1?"s":""}</span>}
                          {(comp.fileNames||[]).length>0&&<span style={{fontSize:10,color:Z.muted}}>📎 {comp.fileNames.length} file{comp.fileNames.length!==1?"s":""}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:7,flexShrink:0}}>
                        <button onClick={()=>startEdit(comp)}
                          style={{background:"rgba(37,99,235,0.12)",color:Z.accentLt,border:`1px solid ${Z.accent}33`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>✏ Edit</button>
                        <button onClick={()=>deleteComp(comp.id)}
                          style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>✕</button>
                      </div>
                    </div>
                  );
                })}
                {unassigned.length>0&&(
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {unassigned.map(m=>(
                      <button key={m.id} onClick={()=>startNew(m.id)}
                        style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:10,border:`1px dashed ${Z.borderMd}`,background:Z.overlay,color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,transition:"all .2s"}}>
                        <span>{m.icon}</span>+ {m.label}
                      </button>
                    ))}
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

export { AdminMachineryTab };
