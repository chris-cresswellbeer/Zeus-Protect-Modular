import React from "react";
import { useWindowWidth } from "../../shared/hooks";
import { InvestigationDashboard } from "./InvestigationDashboard";

function InvestigationTab({ incidents, setIncidents, staff, investigations, setInvestigations, focusedId, setFocusedId, onBack, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [view, setView] = useState(focusedId ? "detail" : "dashboard"); // "dashboard" | "list" | "detail"
  const [activeId, setActiveId] = useState(focusedId || null);
  const [invForm, setInvForm] = useState(null);
  const [actionForm, setActionForm] = useState(null);
  const [editActionIdx, setEditActionIdx] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [saved, setSaved] = useState(false);

  const BLANK_INV = { summary:"", rootCause:"", contributingFactors:"", immediateActions:"", recommendations:"", investigator:"", investigationDate:new Date().toISOString().slice(0,10), status:"open", photos:[], actions:[] };
  const BLANK_ACTION = { description:"", owner:"", dueDate:"", priority:"medium", status:"open" };

  // Sync external focusedId changes
  useEffect(()=>{
    if(!focusedId) return;
    setActiveId(focusedId);
    setView("detail");
    const existing = investigations[focusedId];
    setInvForm(existing ? {...existing} : {...BLANK_INV, photos:[], actions:[]});
    setSaved(false);
    setActionForm(null);
    setEditActionIdx(null);
  },[focusedId]);

  function openDetail(id) {
    setActiveId(id);
    setFocusedId(id);
    const existing = investigations[id];
    setInvForm(existing ? {...existing} : {...BLANK_INV, photos:[], actions:[]});
    setView("detail");
    setSaved(false);
    setActionForm(null);
    setEditActionIdx(null);
    setPhotoError("");
  }

  function saveInvestigation() {
    setInvestigations(p=>({...p,[activeId]:{...invForm}}));
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  }

  function generateInvestigationReport() {
    if(!inc||!invForm) return;
    const today = new Date().toLocaleDateString("en-GB");
    const statusLabel = {open:E("⏳ ","")+"Open",in_progress:E("🔄 ","")+"In Progress",pending_actions:E("📋 ","")+"Pending Actions",closed:E("✅ ","")+"Closed"}[invForm.status]||invForm.status;
    const openActions  = (invForm.actions||[]).filter(a=>a.status!=="closed");
    const closedActions= (invForm.actions||[]).filter(a=>a.status==="closed");

    const html = `<!DOCTYPE html><html><head><title>Investigation Report — ${inc.date}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1e293b;max-width:820px;margin:0 auto;padding:40px 32px;font-size:14px;line-height:1.6}
      h1{font-size:24px;font-weight:900;margin:0 0 4px;color:#0d1f5c}
      .subtitle{color:#64748b;margin:0 0 28px;font-size:14px}
      .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
      .meta-item{background:#f8fafc;border-radius:10px;padding:12px 16px;border:1px solid #e2e8f0}
      .meta-label{font-size:10px;font-weight:700;letter-spacing:.5px;color:#94a3b8;text-transform:uppercase;margin-bottom:3px}
      .meta-value{font-size:13px;font-weight:700;color:#1e293b}
      .banner{background:#0d1f5c;color:#fff;border-radius:14px;padding:18px 22px;margin-bottom:24px}
      .banner-label{font-size:10px;font-weight:700;letter-spacing:1px;opacity:.6;text-transform:uppercase;margin-bottom:6px}
      .banner-text{font-size:15px;font-weight:700;line-height:1.5}
      .banner-meta{font-size:12px;opacity:.7;margin-top:8px}
      h2{font-size:15px;font-weight:800;letter-spacing:.3px;border-bottom:2px solid #e2e8f0;padding-bottom:7px;margin:26px 0 12px;color:#0d1f5c}
      .field{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:12px}
      .field-label{font-size:10px;font-weight:700;letter-spacing:.5px;color:#94a3b8;text-transform:uppercase;margin-bottom:5px}
      .field-value{font-size:13px;color:#1e293b;line-height:1.6;white-space:pre-wrap}
      .action{border-radius:10px;padding:14px 16px;margin-bottom:10px;border-left:4px solid}
      .action.open{background:#fff7ed;border-color:#f59e0b}
      .action.closed{background:#f0fdf4;border-color:#10b981}
      .action.overdue{background:#fef2f2;border-color:#ef4444}
      .action-title{font-weight:700;font-size:13px;margin-bottom:6px}
      .action-meta{font-size:11px;color:#64748b;display:flex;gap:12px;flex-wrap:wrap}
      .badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700}
      .badge.open{background:#fef3c7;color:#d97706}
      .badge.closed{background:#dcfce7;color:#16a34a}
      .badge.overdue{background:#fee2e2;color:#dc2626}
      .photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
      .photo-grid img{width:100%;height:130px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}
      .photo-caption{font-size:10px;color:#94a3b8;margin-top:3px;text-align:center}
      .riddor{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 14px;font-size:12px;color:#dc2626;font-weight:700;display:inline-block;margin-bottom:16px}
      .footer{margin-top:40px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
      @media print{body{padding:20px}}
    </style></head><body>
    <h1>🔍 Investigation Report</h1>
    <p class="subtitle">Ref: ${inc.id} &nbsp;·&nbsp; Incident Date: ${inc.date} &nbsp;·&nbsp; Report Generated: ${today}</p>
    ${inc.riddor?`<div class="riddor">⚠ RIDDOR Reportable Incident</div>`:""}
    <div class="banner">
      <div class="banner-label">Incident Description</div>
      <div class="banner-text">${inc.description}</div>
      <div class="banner-meta">📍 ${inc.location} &nbsp;·&nbsp; Type: ${inc.type||"General"} &nbsp;·&nbsp; Reported by: ${inc.reportedBy||"Unknown"}</div>
    </div>
    <div class="meta">
      <div class="meta-item"><div class="meta-label">Investigation Status</div><div class="meta-value">${statusLabel}</div></div>
      <div class="meta-item"><div class="meta-label">Lead Investigator</div><div class="meta-value">${invForm.investigator||"Not assigned"}</div></div>
      <div class="meta-item"><div class="meta-label">Investigation Date</div><div class="meta-value">${invForm.investigationDate||"—"}</div></div>
      <div class="meta-item"><div class="meta-label">Actions Open</div><div class="meta-value">${openActions.length}</div></div>
      <div class="meta-item"><div class="meta-label">Actions Closed</div><div class="meta-value">${closedActions.length}</div></div>
      <div class="meta-item"><div class="meta-label">Incident Closed</div><div class="meta-value">${inc.closed?"✓ Yes":"⏳ No"}</div></div>
    </div>
    ${[["Investigation Summary",invForm.summary],["Root Cause Analysis",invForm.rootCause],["Contributing Factors",invForm.contributingFactors],["Immediate Actions Taken",invForm.immediateActions],["Recommendations",invForm.recommendations]].filter(([,v])=>v).map(([label,val])=>`
      <h2>${label}</h2>
      <div class="field"><div class="field-value">${val}</div></div>
    `).join("")}
    ${(invForm.actions||[]).length>0?`
      <h2>Corrective Actions (${(invForm.actions||[]).length})</h2>
      ${(invForm.actions||[]).map((a,i)=>{
        const today2=new Date().toISOString().slice(0,10);
        const overdue=a.status!=="closed"&&a.dueDate&&a.dueDate<today2;
        const cls=overdue?"overdue":a.status==="closed"?"closed":"open";
        return `<div class="action ${cls}">
          <div class="action-title">${i+1}. ${a.description}</div>
          <div class="action-meta">
            <span>Owner: ${a.owner||"Unassigned"}</span>
            <span>Due: ${a.dueDate||"TBD"}</span>
            <span>Priority: ${a.priority||"medium"}</span>
            <span class="badge ${cls}">${overdue?"⚠ Overdue":a.status==="closed"?"✓ Closed":"⏳ Open"}</span>
            ${a.completedBy?`<span>Completed by: ${a.completedBy}${a.completedAt?" on "+a.completedAt:""}</span>`:""}
          </div>
          ${a.note?`<div style="margin-top:8px;padding:8px 12px;background:#f0f7ff;border-radius:6px;font-size:12px;color:#1e293b;white-space:pre-wrap;line-height:1.5"><strong>📝 Staff Notes:</strong><br/>${a.note}</div>`:""}
          ${(a.attachments||[]).length>0?`<div style="margin-top:6px;font-size:11px;color:#64748b">📎 Evidence: ${a.attachments.map(att=>att.name).join(", ")}</div>`:""}
        </div>`;
      }).join("")}
    `:""}
    ${(invForm.photos||[]).length>0?`
      <h2>Evidence Photos (${invForm.photos.length})</h2>
      <div class="photo-grid">
        ${invForm.photos.map(p=>`
          <div>
            <img src="${p.data}" alt="${p.name}"/>
            <div class="photo-caption">${p.name} · ${p.uploaded}</div>
          </div>
        `).join("")}
      </div>
    `:""}
    <div class="footer">
      <span>Zeus Protect — Health & Safety Portal · Investigation Report</span>
      <span>Generated: ${today}</span>
    </div>
    </body></html>`;

    const blob = new Blob([html], {type:"text/html"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=`investigation-report-${inc.id}-${inc.date}.html`; a.click();
    URL.revokeObjectURL(url);
  }

  function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);
    setPhotoError("");
    const maxSizeMB = 5;
    const tooBig = files.filter(f=>f.size > maxSizeMB*1024*1024);
    if (tooBig.length) { setPhotoError(`File(s) too large (max ${maxSizeMB}MB each): ${tooBig.map(f=>f.name).join(", ")}`); return; }
    let loaded = 0;
    const newPhotos = [];
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => {
        newPhotos.push({ name:f.name, type:f.type, data:ev.target.result, uploaded:new Date().toISOString().slice(0,10) });
        loaded++;
        if (loaded===files.length) {
          setInvForm(p=>({...p, photos:[...(p.photos||[]), ...newPhotos]}));
        }
      };
      reader.readAsDataURL(f);
    });
  }

  function removePhoto(idx) {
    setInvForm(p=>({...p, photos:p.photos.filter((_,i)=>i!==idx)}));
  }

  function saveAction() {
    if (!actionForm.description.trim()) return;
    setInvForm(p=>{
      const actions = [...(p.actions||[])];
      if (editActionIdx !== null) actions[editActionIdx] = {...actionForm};
      else actions.push({...actionForm, id:"a"+Date.now()});
      return {...p, actions};
    });
    setActionForm(null);
    setEditActionIdx(null);
  }

  function removeAction(idx) {
    setInvForm(p=>({...p, actions:p.actions.filter((_,i)=>i!==idx)}));
  }

  function toggleActionStatus(idx) {
    setInvForm(p=>{
      const actions=[...p.actions];
      actions[idx]={...actions[idx], status:actions[idx].status==="complete"?"open":"complete"};
      return {...p, actions};
    });
  }

  const inc = incidents.find(i=>i.id===activeId);
  const today = new Date().toISOString().slice(0,10);
  const inputStyle = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 12px",color:Z.white,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:font,resize:"vertical"};
  const labelStyle = {fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase",marginBottom:5,display:"block"};
  const PRIORITIES = [{v:"low",label:"Low",col:"#10b981"},{v:"medium",label:"Medium",col:"#f59e0b"},{v:"high",label:"High",col:"#f87171"},{v:"critical",label:"Critical",col:"#ef4444"}];
  const priCol = v => (PRIORITIES.find(p=>p.v===v)||PRIORITIES[1]).col;

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20,flexWrap:"wrap"}}>
        <button onClick={onBack}
          style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
          ← Back to Incidents
        </button>
        <div style={{flex:1}}>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 2px"}}>{E("🔍 ","")}Incident Investigations</h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>Root cause analysis, corrective actions and photo evidence</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setView("dashboard")} style={{background:view==="dashboard"?`linear-gradient(135deg,${Z.accent},${Z.blue})`:"transparent",color:view==="dashboard"?Z.white:Z.muted,border:`1px solid ${view==="dashboard"?Z.accent:Z.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
            📊 Dashboard
          </button>
          <button onClick={()=>setView("list")} style={{background:view==="list"?`linear-gradient(135deg,${Z.accent},${Z.blue})`:"transparent",color:view==="list"?Z.white:Z.muted,border:`1px solid ${view==="list"?Z.accent:Z.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
            📋 All Investigations
          </button>
        </div>
      </div>

      {/* Dashboard view */}
      {view==="dashboard" && (
        <InvestigationDashboard incidents={incidents} investigations={investigations} onOpen={openDetail} Z={Z} font={font}/>
      )}

      {/* List view */}
      {view==="list" && (
        <div>
          <div style={{display:"grid",gap:10}}>
            {incidents.filter(i=>i.riddor||!i.closed||investigations[i.id]).sort((a,b)=>b.date.localeCompare(a.date)).map(inc=>{
              const inv = investigations[inc.id];
              const openActs = (inv?.actions||[]).filter(a=>a.status!=="complete").length;
              const overdueActs = (inv?.actions||[]).filter(a=>a.status!=="complete"&&a.dueDate&&a.dueDate<today).length;
              const INCIDENT_TYPES_MAP = {accident:{icon:"🚑",col:"#f87171"},near_miss:{icon:"⚠️",col:"#fbbf24"},unsafe_condition:{icon:"🏗",col:"#fb923c"},unsafe_act:{icon:"🚫",col:"#a78bfa"}};
              const ti = INCIDENT_TYPES_MAP[inc.type]||{icon:"📋",col:Z.muted};
              return (
                <div key={inc.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:`1px solid ${inv?"rgba(139,92,246,0.3)":inc.closed?"rgba(16,185,129,0.15)":Z.border}`,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                  <span style={{fontSize:22,flexShrink:0}}>{ti.icon}</span>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,fontWeight:800,color:ti.col}}>{inc.type.replace("_"," ").toUpperCase()}</span>
                      <span style={{fontSize:11,color:Z.muted}}>📍 {inc.location}</span>
                      <span style={{fontSize:11,color:Z.muted}}>{inc.date}</span>
                      {inc.quickReport && (
                        <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:6,color:"#f59e0b",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)"}}>⚡ Quick Report</span>
                      )}
                      {inc.riddor && (
                        <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:6,
                          color:inc.riddorReported?"#10b981":"#f87171",
                          background:inc.riddorReported?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",
                          border:`1px solid ${inc.riddorReported?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.25)"}`}}>
                          {inc.riddorReported?"RIDDOR ✓":"RIDDOR ⚠"}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:13,color:Z.slate,marginBottom:6,lineHeight:1.4}}>{inc.description.slice(0,90)}{inc.description.length>90?"…":""}</div>
                    {inv && (
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:"#a78bfa",background:"rgba(139,92,246,0.1)",padding:"2px 9px",borderRadius:6,fontWeight:600}}>🔍 {inv.status==="closed"?"Investigation Closed":"Under Investigation"}</span>
                        {openActs>0 && <span style={{fontSize:11,color:"#60a5fa",background:"rgba(37,99,235,0.1)",padding:"2px 9px",borderRadius:6,fontWeight:600}}>{openActs} open action{openActs!==1?"s":""}</span>}
                        {overdueActs>0 && <span style={{fontSize:11,color:"#f87171",background:"rgba(239,68,68,0.1)",padding:"2px 9px",borderRadius:6,fontWeight:600}}>🚨 {overdueActs} overdue</span>}
                        {inv.photos&&inv.photos.length>0 && <span style={{fontSize:11,color:Z.muted,background:Z.overlay,padding:"2px 9px",borderRadius:6}}>🖼 {inv.photos.length} photo{inv.photos.length!==1?"s":""}</span>}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>openDetail(inc.id)}
                    style={{background:inv?`linear-gradient(135deg,${Z.accent},${Z.blue})`:`linear-gradient(135deg,rgba(139,92,246,0.2),rgba(139,92,246,0.1))`,color:inv?Z.white:"#a78bfa",border:inv?"none":"1px solid rgba(139,92,246,0.3)",borderRadius:10,padding:"8px 18px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                    {inv?"Open Investigation →":"Start Investigation →"}
                  </button>
                </div>
              );
            })}
            {incidents.filter(i=>i.riddor||!i.closed||investigations[i.id]).length===0 && (
              <div style={{textAlign:"center",padding:40,color:Z.muted,fontSize:13}}>No incidents requiring investigation at this time.</div>
            )}
          </div>
        </div>
      )}

      {/* Detail / edit view */}
      {view==="detail" && inc && invForm && (
        <div>
          {/* Incident summary banner */}
          <div style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.25)",borderRadius:14,padding:"14px 18px",marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:.5,color:"#a78bfa",textTransform:"uppercase",marginBottom:6}}>Linked Incident</div>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:160}}>
                <div style={{fontSize:14,fontWeight:700,color:Z.white,marginBottom:4}}>{inc.description.slice(0,120)}{inc.description.length>120?"…":""}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:Z.muted}}>📍 {inc.location}</span>
                  <span style={{fontSize:11,color:Z.muted}}>📅 {inc.date}</span>
                  {inc.riddor && <span style={{fontSize:11,color:"#f87171",fontWeight:700}}>RIDDOR</span>}
                  {inc.closed ? <span style={{fontSize:11,color:"#10b981",fontWeight:700}}>✓ Incident Closed</span> : <span style={{fontSize:11,color:"#f59e0b",fontWeight:700}}>⏳ Incident Open</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <label style={{fontSize:11,fontWeight:700,color:Z.muted}}>Investigation Status:</label>
                <select value={invForm.status} onChange={e=>setInvForm(p=>({...p,status:e.target.value}))}
                  style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 10px",color:Z.white,fontSize:12,fontFamily:font,outline:"none",cursor:"pointer"}}>
                  <option value="open">⏳ Open</option>
                  <option value="in_progress">🔄 In Progress</option>
                  <option value="pending_actions">📋 Pending Actions</option>
                  <option value="closed">✅ Closed</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:16}}>
            <div>
              <label style={labelStyle}>Lead Investigator</label>
              <input value={invForm.investigator} onChange={e=>setInvForm(p=>({...p,investigator:e.target.value}))}
                placeholder="Name of investigator..."
                style={{...inputStyle,resize:"none"}}/>
            </div>
            <div>
              <label style={labelStyle}>Investigation Date</label>
              <input type="date" value={invForm.investigationDate} onChange={e=>setInvForm(p=>({...p,investigationDate:e.target.value}))}
                style={{...inputStyle,resize:"none"}}/>
            </div>
          </div>

          <div style={{display:"grid",gap:14,marginBottom:20}}>
            <div>
              <label style={labelStyle}>Investigation Summary</label>
              <textarea rows={4} value={invForm.summary} onChange={e=>setInvForm(p=>({...p,summary:e.target.value}))}
                placeholder="Describe what happened, the sequence of events and context..." style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Root Cause</label>
              <textarea rows={3} value={invForm.rootCause} onChange={e=>setInvForm(p=>({...p,rootCause:e.target.value}))}
                placeholder="What was the underlying root cause of this incident?" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Contributing Factors</label>
              <textarea rows={3} value={invForm.contributingFactors} onChange={e=>setInvForm(p=>({...p,contributingFactors:e.target.value}))}
                placeholder="Environmental, behavioural, procedural, or equipment factors..." style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Immediate Actions Taken</label>
              <textarea rows={3} value={invForm.immediateActions} onChange={e=>setInvForm(p=>({...p,immediateActions:e.target.value}))}
                placeholder="Steps taken immediately following the incident..." style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Recommendations to Prevent Recurrence</label>
              <textarea rows={3} value={invForm.recommendations} onChange={e=>setInvForm(p=>({...p,recommendations:e.target.value}))}
                placeholder="Systemic changes, controls, training or procedural updates recommended..." style={inputStyle}/>
            </div>
          </div>

          {/* Photo upload */}
          <div style={{marginBottom:24,background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"16px 18px",border:`1px solid ${Z.border}`}}>
            <div style={{fontSize:12,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase",marginBottom:12}}>📸 Investigation Photos</div>
            <label style={{display:"inline-flex",alignItems:"center",gap:8,background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:Z.white,borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700,marginBottom:12,boxShadow:"0 4px 14px rgba(37,99,235,0.3)"}}>
              📎 Upload Photos
              <input type="file" accept={ACCEPT_IMAGES} multiple onChange={handlePhotoUpload} style={{display:"none"}}/>
            </label>
            {photoError && <p style={{color:"#f87171",fontSize:12,margin:"0 0 10px"}}>{photoError}</p>}
            {(invForm.photos||[]).length > 0 ? (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                {invForm.photos.map((p,i)=>(
                  <div key={i} style={{position:"relative",borderRadius:10,overflow:"hidden",border:`1px solid ${Z.border}`,background:Z.overlay}}>
                    <img src={p.data} alt={p.name} style={{width:"100%",height:100,objectFit:"cover",display:"block"}}/>
                    <div style={{padding:"6px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:10,color:Z.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{p.name}</span>
                      <button onClick={()=>removePhoto(i)} style={{background:"rgba(239,68,68,0.2)",color:"#f87171",border:"none",borderRadius:5,padding:"2px 6px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{color:Z.muted,fontSize:12,margin:0}}>No photos uploaded yet. Upload images from the scene, equipment damage, or contributing factors.</p>
            )}
          </div>

          {/* Corrective Actions */}
          <div style={{marginBottom:24,background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"16px 18px",border:`1px solid ${Z.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <div style={{fontSize:12,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase"}}>📋 Corrective Action Plan</div>
              {!actionForm && (
                <button onClick={()=>{ setActionForm({...BLANK_ACTION}); setEditActionIdx(null); }}
                  style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700,boxShadow:"0 3px 10px rgba(16,185,129,0.3)"}}>
                  + Add Action
                </button>
              )}
            </div>

            {/* Action form */}
            {actionForm && (
              <div style={{background:Z.overlay,borderRadius:12,padding:"14px 16px",marginBottom:14,border:`1px solid ${Z.borderMd}`}}>
                <div style={{display:"grid",gap:10}}>
                  <div>
                    <label style={labelStyle}>Action Description *</label>
                    <textarea rows={2} value={actionForm.description} onChange={e=>setActionForm(p=>({...p,description:e.target.value}))}
                      placeholder="Describe the corrective action to be taken..." style={inputStyle}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                    <div>
                      <label style={labelStyle}>Responsible Owner</label>
                      <select value={actionForm.owner} onChange={e=>setActionForm(p=>({...p,owner:e.target.value}))}
                        style={{...inputStyle,resize:"none",cursor:"pointer"}}>
                        <option value="">— Select staff member —</option>
                        {staff.map(u=><option key={u.id} value={u.name}>{u.name} ({u.jobTitle||u.role})</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Due Date</label>
                      <input type="date" value={actionForm.dueDate} onChange={e=>setActionForm(p=>({...p,dueDate:e.target.value}))}
                        style={{...inputStyle,resize:"none"}}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Priority</label>
                      <select value={actionForm.priority} onChange={e=>setActionForm(p=>({...p,priority:e.target.value}))}
                        style={{...inputStyle,resize:"none",cursor:"pointer"}}>
                        {PRIORITIES.map(p=><option key={p.v} value={p.v}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={saveAction}
                      style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
                      {editActionIdx!==null?"Save Changes":"Add Action"}
                    </button>
                    <button onClick={()=>{ setActionForm(null); setEditActionIdx(null); }}
                      style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(invForm.actions||[]).length > 0 ? (
              <div style={{display:"grid",gap:8}}>
                {invForm.actions.map((a,i)=>{
                  const overdue = a.status!=="complete" && a.dueDate && a.dueDate < today;
                  const attachments = a.attachments||[];
                  return (
                    <div key={i} style={{borderRadius:10,background:a.status==="complete"?"rgba(16,185,129,0.06)":overdue?"rgba(239,68,68,0.06)":Z.overlay,border:`1px solid ${a.status==="complete"?"rgba(16,185,129,0.2)":overdue?"rgba(239,68,68,0.25)":Z.border}`,overflow:"hidden"}}>
                      {/* Main row */}
                      <div style={{padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                        <button onClick={()=>toggleActionStatus(i)}
                          style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${a.status==="complete"?"#10b981":priCol(a.priority)}`,background:a.status==="complete"?"#10b981":"transparent",cursor:"pointer",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900}}>
                          {a.status==="complete"?"✓":""}
                        </button>
                        <div style={{flex:1,minWidth:120}}>
                          <div style={{fontSize:13,fontWeight:600,color:a.status==="complete"?Z.muted:Z.white,textDecoration:a.status==="complete"?"line-through":"none",lineHeight:1.4,marginBottom:4}}>{a.description}</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                            <span style={{fontSize:10,background:`${priCol(a.priority)}22`,color:priCol(a.priority),padding:"1px 8px",borderRadius:99,fontWeight:700,border:`1px solid ${priCol(a.priority)}44`}}>{a.priority}</span>
                            {a.owner && <span style={{fontSize:10,color:Z.muted}}>👤 {a.owner}</span>}
                            {a.dueDate && <span style={{fontSize:10,color:overdue?"#f87171":Z.muted}}>{overdue?"🚨 Overdue: ":"📅 "}{a.dueDate}</span>}
                            {a.status==="complete" && <span style={{fontSize:10,color:"#10b981",fontWeight:700}}>✓ Complete{a.completedBy?` — ${a.completedBy}`:""}{a.completedAt?` · ${a.completedAt}`:""}</span>}
                            {attachments.length>0 && <span style={{fontSize:10,color:Z.muted}}>📎 {attachments.length} file{attachments.length!==1?"s":""}</span>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button onClick={()=>{ setActionForm({...a}); setEditActionIdx(i); }}
                            style={{background:"rgba(37,99,235,0.12)",color:Z.accentLt,border:`1px solid ${Z.accent}33`,borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700}}>
                            ✏
                          </button>
                          <button onClick={()=>removeAction(i)}
                            style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700}}>
                            🗑
                          </button>
                        </div>
                      </div>
                      {/* Staff progress notes */}
                      {a.note && (
                        <div style={{margin:"0 14px 10px",background:"rgba(37,99,235,0.08)",borderRadius:8,padding:"9px 12px",border:"1px solid rgba(37,99,235,0.18)"}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.accentLt,textTransform:"uppercase",marginBottom:5}}>📝 Staff Progress Notes</div>
                          <div style={{fontSize:12,color:Z.slate,whiteSpace:"pre-wrap",lineHeight:1.6}}>{a.note}</div>
                        </div>
                      )}
                      {/* Attachments */}
                      {attachments.length>0 && (
                        <div style={{margin:"0 14px 10px"}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase",marginBottom:5}}>📎 Evidence Files</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            {attachments.map((att,ai)=>(
                              <a key={ai} href={att.data} download={att.name}
                                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",background:Z.overlay,borderRadius:7,border:`1px solid ${Z.border}`,textDecoration:"none",fontSize:11,color:Z.white,fontWeight:600}}>
                                📎 {att.name}
                                <span style={{fontSize:10,color:Z.muted,fontWeight:400}}>{att.uploadedBy} · {att.uploadedAt}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{color:Z.muted,fontSize:12,margin:0}}>No corrective actions added yet. Use the button above to add actions with owners and due dates.</p>
            )}
          </div>

          {/* Save button */}
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={saveInvestigation}
              style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:12,padding:"12px 32px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:14,boxShadow:"0 4px 18px rgba(37,99,235,0.35)"}}>
              💾 Save Investigation
            </button>
            <button onClick={generateInvestigationReport}
              style={{background:`linear-gradient(135deg,#6366f1,#4f46e5)`,color:"#fff",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:"0 4px 14px rgba(99,102,241,0.35)"}}>
              📄 Export Report
            </button>
            {saved && <span style={{color:"#10b981",fontSize:13,fontWeight:700}}>✓ Investigation saved</span>}
            <button onClick={()=>setView("list")}
              style={{background:"transparent",color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:12,padding:"12px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
              ← Back to list
            </button>
          </div>
        </div>
      )}

      {view==="detail" && !inc && (
        <div style={{textAlign:"center",padding:48,color:Z.muted}}>
          <div style={{fontSize:40,marginBottom:8}}>🔍</div>
          Incident not found. <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:Z.accentLt,cursor:"pointer",fontFamily:font,fontWeight:700}}>Back to list</button>
        </div>
      )}
    </div>
  );
}


export { InvestigationTab };
