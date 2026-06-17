import { useState } from "react";
import { useWindowWidth } from "../../shared/hooks";
import { HelpTip } from "../../shared/HelpTip";
import { INSP_TYPES, INSP_SECTIONS } from "../../data/seedInspections";

function SiteInspectionsTab({ inspections, setInspections, staff, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [view, setView] = useState("list"); // "list"|"new"|"detail"|"report"
  const [activeId, setActiveId] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [photoError, setPhotoError] = useState("");

  // New inspection form state
  const BLANK_FORM = { type:"annual_hs", date:new Date().toISOString().slice(0,10), inspector:"", location:"", summary:"", sections:{}, nonConformances:[] };
  const [form, setForm] = useState(BLANK_FORM);
  const [formSection, setFormSection] = useState(0);
  const [ncForm, setNcForm] = useState(null); // { section, finding, severity, photos, actionOwner, actionDue }
  const [editNcIdx, setEditNcIdx] = useState(null);
  const [editingInspId, setEditingInspId] = useState(null);
  const [editInspForm, setEditInspForm] = useState(null);

  const today = new Date().toISOString().slice(0,10);
  const selInsp = inspections.find(i=>i.id===activeId);
  const typeInfo = id => INSP_TYPES.find(t=>t.id===id)||INSP_TYPES[0];
  const scoreColor = pct => pct>=90?"#10b981":pct>=75?"#f59e0b":pct>=60?"#fb923c":"#ef4444";
  const scoreLabel = pct => pct>=90?"Excellent":pct>=75?"Good":pct>=60?"Satisfactory":"Requires Improvement";

  // Score calculation
  function calcScore(type, sections) {
    const defs = INSP_SECTIONS[type]||[];
    let earned=0, possible=0;
    defs.forEach(sec => {
      sec.questions.forEach(q => {
        const ans = (sections[sec.id]||{})[q.id];
        possible += 2;
        if (ans===2) earned+=2;
        else if (ans===1) earned+=1;
      });
    });
    return { earned, possible };
  }

  // Flat answer helper
  function setAnswer(secId, qId, val) {
    setForm(p=>({ ...p, sections:{ ...p.sections, [secId]:{ ...(p.sections[secId]||{}), [qId]:val } } }));
  }

  function handlePhotoUpload(e, ncIdx) {
    const files = Array.from(e.target.files);
    setPhotoError("");
    const tooBig = files.filter(f=>f.size>5*1024*1024);
    if (tooBig.length) { setPhotoError(`File(s) too large: ${tooBig.map(f=>f.name).join(", ")}`); return; }
    let loaded=0;
    const newPhotos=[];
    files.forEach(f=>{
      const reader = new FileReader();
      reader.onload = ev=>{
        newPhotos.push({ name:f.name, data:ev.target.result, uploaded:today });
        loaded++;
        if (loaded===files.length) {
          if (ncIdx!==null && ncIdx!==undefined) {
            // Updating existing NC
            setInspections(p=>p.map(ins=>{
              if (ins.id!==activeId) return ins;
              const ncs=[...ins.nonConformances];
              ncs[ncIdx]={...ncs[ncIdx], photos:[...(ncs[ncIdx].photos||[]), ...newPhotos]};
              return {...ins, nonConformances:ncs};
            }));
          } else {
            // Adding to new NC form
            setNcForm(p=>({...p, photos:[...(p.photos||[]),...newPhotos]}));
          }
        }
      };
      reader.readAsDataURL(f);
    });
  }

  function saveNC() {
    if (!ncForm?.finding?.trim()) return;
    const nc = { id:`nc_${Date.now()}`, ...ncForm, actionStatus:"open", actionNote:"" };
    setForm(p=>({
      ...p,
      nonConformances: editNcIdx!==null ? p.nonConformances.map((n,i)=>i===editNcIdx?nc:n) : [...p.nonConformances, nc]
    }));
    setNcForm(null); setEditNcIdx(null);
  }

  function submitInspection() {
    const { earned, possible } = calcScore(form.type, form.sections);
    const newInsp = {
      id: `si${Date.now()}`,
      ...form,
      status: form.nonConformances.some(n=>n.actionStatus==="open") ? "open" : "closed",
      overallScore: earned,
      maxScore: possible,
    };
    setInspections(p=>[newInsp,...p]);
    setView("detail"); setActiveId(newInsp.id);
  }

  function generateReport(ins) {
    const ti = typeInfo(ins.type);
    const pct = ins.maxScore>0 ? Math.round(ins.overallScore/ins.maxScore*100) : 0;
    const openNCs = ins.nonConformances.filter(n=>n.actionStatus!=="complete");
    const closedNCs = ins.nonConformances.filter(n=>n.actionStatus==="complete");
    // Build printable HTML
    const html = `<!DOCTYPE html><html><head><title>Inspection Report — ${ins.date}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1e293b;max-width:800px;margin:0 auto;padding:40px 32px;font-size:14px;line-height:1.6}
      h1{font-size:26px;font-weight:900;margin:0 0 4px;color:#0d1f5c}
      .subtitle{color:#64748b;margin:0 0 28px;font-size:15px}
      .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:28px}
      .meta-item{background:#f8fafc;border-radius:10px;padding:12px 16px;border:1px solid #e2e8f0}
      .meta-label{font-size:10px;font-weight:700;letter-spacing:.5px;color:#94a3b8;text-transform:uppercase;margin-bottom:2px}
      .meta-value{font-size:14px;font-weight:700;color:#1e293b}
      .score-box{background:#0d1f5c;color:#fff;border-radius:14px;padding:20px 24px;margin-bottom:28px;display:flex;align-items:center;gap:24px}
      .score-num{font-size:52px;font-weight:900;line-height:1}
      .score-pct{font-size:28px;font-weight:700;opacity:.6}
      .score-label{font-size:16px;font-weight:700;margin-bottom:4px}
      .score-sub{font-size:13px;opacity:.7}
      h2{font-size:16px;font-weight:800;letter-spacing:.3px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:28px 0 14px;color:#0d1f5c}
      .nc{border-radius:10px;padding:16px;margin-bottom:12px;border-left:4px solid}
      .nc.major{background:#fef2f2;border-color:#ef4444}
      .nc.minor{background:#fffbeb;border-color:#f59e0b}
      .nc.observation{background:#f0fdf4;border-color:#10b981}
      .nc-title{font-weight:700;margin-bottom:6px}
      .nc-row{display:flex;gap:8px;margin-top:4px;font-size:12px;color:#64748b}
      .badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700}
      .badge.major{background:#fee2e2;color:#dc2626}
      .badge.minor{background:#fef3c7;color:#d97706}
      .badge.observation{background:#dcfce7;color:#16a34a}
      .badge.complete{background:#dcfce7;color:#16a34a}
      .badge.open{background:#fee2e2;color:#dc2626}
      .summary{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:20px}
      .photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
      .photo-grid img{width:100%;height:120px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0}
      .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;display:flex;justify-content:space-between}
    </style></head><body>
    <h1>${ti.icon} ${ti.label} — Action Report</h1>
    <p class="subtitle">${ins.location} &nbsp;·&nbsp; Inspected: ${ins.date} &nbsp;·&nbsp; Inspector: ${ins.inspector}</p>
    <div class="meta">
      <div class="meta-item"><div class="meta-label">Inspection Type</div><div class="meta-value">${ti.label}</div></div>
      <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">${ins.status==="open"?"⚠ Open — Actions Required":"✓ Closed"}</div></div>
      <div class="meta-item"><div class="meta-label">Non-Conformances</div><div class="meta-value">${ins.nonConformances.length} (${openNCs.length} open, ${closedNCs.length} closed)</div></div>
    </div>
    <div class="score-box">
      <div>
        <div class="score-num">${ins.overallScore}<span class="score-pct">/${ins.maxScore}</span></div>
      </div>
      <div>
        <div class="score-label">${scoreLabel(pct)} — ${pct}%</div>
        <div class="score-sub">Scored against ${ins.maxScore} maximum points across all inspection criteria</div>
      </div>
    </div>
    ${ins.summary?`<h2>Inspector Summary</h2><div class="summary">${ins.summary}</div>`:""}
    ${ins.nonConformances.length>0?`
    <h2>Non-Conformances & Actions</h2>
    ${ins.nonConformances.map((nc,i)=>`
      <div class="nc ${nc.severity}">
        <div class="nc-title">${i+1}. ${nc.finding}</div>
        <div class="nc-row">
          <span class="badge ${nc.severity}">${nc.severity.toUpperCase()}</span>
          <span>Section: ${nc.section}</span>
          <span class="badge ${nc.actionStatus}">${nc.actionStatus==="complete"?"✓ Complete":"⏳ Open"}</span>
        </div>
        ${nc.actionOwner?`<div class="nc-row">Owner: ${nc.actionOwner} · Due: ${nc.actionDue||"TBD"}</div>`:""}
        ${nc.actionNote?`<div class="nc-row">Resolution: ${nc.actionNote}</div>`:""}
        ${nc.photos&&nc.photos.length>0?`<div class="photo-grid">${nc.photos.map(p=>`<img src="${p.data}" alt="${p.name}"/>`).join("")}</div>`:""}
      </div>`).join("")}
    `:"<p style='color:#94a3b8'>No non-conformances recorded for this inspection.</p>"}
    <div class="footer">
      <span>Zeus Health & Safety Portal — Site Inspection Report</span>
      <span>Generated: ${today}</span>
    </div>
    </body></html>`;
    const blob = new Blob([html], {type:"text/html"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`inspection-report-${ins.date}.html`; a.click();
    URL.revokeObjectURL(url);
  }

  const inp = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 14px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const lbl = {color:Z.muted,fontSize:10,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:5,textTransform:"uppercase"};

  // ── DETAIL view ─────────────────────────────────────────────────────────────
  if (view==="detail" && selInsp) {
    const ti = typeInfo(selInsp.type);
    const pct = selInsp.maxScore>0 ? Math.round(selInsp.overallScore/selInsp.maxScore*100) : 0;
    const sc = scoreColor(pct);
    const openNCs = selInsp.nonConformances.filter(n=>n.actionStatus!=="complete");
    return (
      <div>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={()=>{setView("list");window.scrollTo({top:0,behavior:"smooth"});}} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>← All Inspections</button>
          <div style={{flex:1}}>
            <h2 style={{margin:0,fontSize:20,fontWeight:900,color:Z.white}}>{ti.icon} {ti.label}</h2>
            <p style={{margin:0,color:Z.muted,fontSize:13}}>📍 {selInsp.location} · {selInsp.date} · Inspector: {selInsp.inspector}</p>
          </div>
          <button onClick={()=>generateReport(selInsp)}
            style={{background:`linear-gradient(135deg,#6366f1,#4f46e5)`,color:"#fff",border:"none",borderRadius:10,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:"0 4px 14px rgba(99,102,241,0.35)"}}>
            📄 Download Action Report
          </button>
        </div>

        {/* Score banner */}
        <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navyDk})`,borderRadius:16,padding:"20px 24px",marginBottom:20,display:"flex",alignItems:"center",gap:24,flexWrap:"wrap",border:`1px solid ${sc}44`}}>
          <div style={{textAlign:"center",minWidth:90}}>
            <div style={{fontSize:52,fontWeight:900,color:sc,lineHeight:1}}>{pct}<span style={{fontSize:22,opacity:.6}}>%</span></div>
            <div style={{fontSize:11,color:Z.muted,marginTop:2}}>{selInsp.overallScore}/{selInsp.maxScore} pts</div>
          </div>
          <div style={{flex:1,minWidth:160}}>
            <div style={{fontSize:20,fontWeight:800,color:sc,marginBottom:4}}>{scoreLabel(pct)}</div>
            <div style={{height:10,background:Z.overlay,borderRadius:99,overflow:"hidden",maxWidth:300,marginBottom:8}}>
              <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${sc},${sc}aa)`,borderRadius:99,transition:"width .6s"}}/>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:11,background:selInsp.status==="open"?"rgba(239,68,68,0.12)":"rgba(16,185,129,0.12)",color:selInsp.status==="open"?"#f87171":"#10b981",padding:"2px 10px",borderRadius:99,fontWeight:700}}>
                {selInsp.status==="open"?"⚠ Open":"✓ Closed"}
              </span>
              {openNCs.length>0 && <span style={{fontSize:11,background:"rgba(239,68,68,0.1)",color:"#f87171",padding:"2px 10px",borderRadius:99,fontWeight:700}}>{openNCs.length} open action{openNCs.length!==1?"s":""}</span>}
            </div>
          </div>
          {selInsp.nextDue && (
            <div style={{textAlign:"center",padding:"12px 20px",background:Z.overlay,borderRadius:12,border:`1px solid ${Z.border}`}}>
              <div style={{fontSize:11,color:Z.muted,marginBottom:2}}>NEXT DUE</div>
              <div style={{fontSize:15,fontWeight:800,color:selInsp.nextDue<today?"#f87171":Z.white}}>{selInsp.nextDue}</div>
            </div>
          )}
        </div>

        {/* Summary */}
        {selInsp.summary && (
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"14px 18px",marginBottom:20,border:`1px solid ${Z.border}`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:6,textTransform:"uppercase"}}>Inspector Summary</div>
            <p style={{margin:0,fontSize:13,color:Z.slate,lineHeight:1.7}}>{selInsp.summary}</p>
          </div>
        )}

        {/* Non-Conformances */}
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <h3 style={{margin:0,fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase"}}>
              Non-Conformances & Actions ({selInsp.nonConformances.length})
            </h3>
          </div>
          {selInsp.nonConformances.length===0 ? (
            <div style={{textAlign:"center",padding:24,color:Z.muted,fontSize:13,background:Z.overlay,borderRadius:12,border:`1px solid ${Z.border}`}}>
              ✅ No non-conformances recorded for this inspection.
            </div>
          ) : (
            <div style={{display:"grid",gap:12}}>
              {selInsp.nonConformances.map((nc,i)=>{
                const sevCol = nc.severity==="major"?"#f87171":nc.severity==="minor"?"#fb923c":"#10b981";
                const sevBg = nc.severity==="major"?"rgba(239,68,68,0.07)":nc.severity==="minor"?"rgba(251,146,60,0.07)":"rgba(16,185,129,0.07)";
                return (
                  <div key={nc.id||i} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:`1px solid ${nc.actionStatus==="complete"?"rgba(16,185,129,0.25)":sevCol+"44"}`,overflow:"hidden"}}>
                    {/* Header */}
                    <div style={{padding:"14px 18px",background:sevBg}}>
                      <div style={{display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:160}}>
                          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:10,fontWeight:800,color:sevCol,background:sevCol+"22",padding:"2px 9px",borderRadius:99,textTransform:"uppercase"}}>{nc.severity}</span>
                            <span style={{fontSize:11,color:Z.muted}}>{nc.section}</span>
                            {nc.actionStatus==="complete" && <span style={{fontSize:10,color:"#10b981",fontWeight:700,background:"rgba(16,185,129,0.12)",padding:"2px 9px",borderRadius:99}}>✓ Resolved</span>}
                          </div>
                          <p style={{fontWeight:600,fontSize:13,margin:"0 0 8px",color:Z.white,lineHeight:1.5}}>{nc.finding}</p>
                          <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:11,color:Z.muted}}>
                            {nc.actionOwner && <span>👤 {nc.actionOwner}</span>}
                            {nc.actionDue && <span style={{color:nc.actionStatus!=="complete"&&nc.actionDue<today?"#f87171":Z.muted}}>📅 Due: {nc.actionDue}{nc.actionStatus!=="complete"&&nc.actionDue<today?" 🚨":""}</span>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button
                            onClick={()=>{
                              const newStatus = nc.actionStatus==="complete"?"open":"complete";
                              setInspections(p=>p.map(ins=>{
                                if(ins.id!==activeId) return ins;
                                const ncs=[...ins.nonConformances];
                                ncs[i]={...ncs[i], actionStatus:newStatus};
                                const allClosed = ncs.every(n=>n.actionStatus==="complete");
                                return {...ins, nonConformances:ncs, status:allClosed?"closed":"open"};
                              }));
                            }}
                            style={{background:nc.actionStatus==="complete"?`linear-gradient(135deg,${Z.green},#059669)`:"rgba(16,185,129,0.1)",color:nc.actionStatus==="complete"?"#fff":"#10b981",border:nc.actionStatus==="complete"?"none":"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                            {nc.actionStatus==="complete"?"✓ Resolved":"Mark Resolved"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Resolution note */}
                    <div style={{padding:"12px 18px",background:Z.overlay,borderTop:`1px solid ${Z.border}`}}>
                      <label style={lbl}>Resolution Note</label>
                      <textarea rows={2} value={nc.actionNote||""} onChange={e=>{
                        setInspections(p=>p.map(ins=>{
                          if(ins.id!==activeId) return ins;
                          const ncs=[...ins.nonConformances];
                          ncs[i]={...ncs[i],actionNote:e.target.value};
                          return {...ins,nonConformances:ncs};
                        }));
                      }} placeholder="Describe action taken to resolve this finding..."
                        style={{...inp,resize:"vertical",lineHeight:1.5}}/>
                    </div>

                    {/* Photos */}
                    <div style={{padding:"12px 18px",background:Z.overlay,borderTop:`1px solid ${Z.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <label style={lbl}>Photos ({(nc.photos||[]).length})</label>
                        <label style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",borderRadius:7,padding:"4px 12px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700}}>
                          📎 Add Photos
                          <input type="file" accept={ACCEPT_IMAGES} multiple onChange={e=>handlePhotoUpload(e,i)} style={{display:"none"}}/>
                        </label>
                      </div>
                      {(nc.photos||[]).length>0 ? (
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8}}>
                          {nc.photos.map((ph,pi)=>(
                            <div key={pi} style={{position:"relative",borderRadius:8,overflow:"hidden",border:`1px solid ${Z.border}`}}>
                              <img src={ph.data} alt={ph.name} style={{width:"100%",height:80,objectFit:"cover",display:"block"}}/>
                              <button onClick={()=>{
                                setInspections(p=>p.map(ins=>{
                                  if(ins.id!==activeId) return ins;
                                  const ncs=[...ins.nonConformances];
                                  ncs[i]={...ncs[i],photos:ncs[i].photos.filter((_,x)=>x!==pi)};
                                  return {...ins,nonConformances:ncs};
                                }));
                              }} style={{position:"absolute",top:3,right:3,background:"rgba(239,68,68,0.85)",color:"#fff",border:"none",borderRadius:4,width:18,height:18,cursor:"pointer",fontFamily:font,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>✕</button>
                            </div>
                          ))}
                        </div>
                      ) : <p style={{color:Z.muted,fontSize:12,margin:0}}>No photos uploaded for this finding.</p>}
                      {photoError && <p style={{color:"#f87171",fontSize:12,margin:"6px 0 0"}}>{photoError}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── NEW INSPECTION form ──────────────────────────────────────────────────────
  if (view==="new") {
    const ti = typeInfo(form.type);
    const sections = INSP_SECTIONS[form.type]||[];
    const sec = sections[formSection];
    const isLastSec = formSection===sections.length-1;
    const { earned, possible } = calcScore(form.type, form.sections);
    const allAnswered = sec?.questions.every(q=>(form.sections[sec.id]||{})[q.id]!==undefined);
    const BLANK_NC = { section:"", finding:"", severity:"major", photos:[], actionOwner:"", actionDue:"" };

    return (
      <div>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={()=>{setView("list");setForm(BLANK_FORM);setFormSection(0);setNcForm(null);}} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>← Cancel</button>
          <div style={{flex:1}}>
            <h2 style={{margin:0,fontSize:20,fontWeight:900,color:Z.white}}>New {ti.label}</h2>
            <p style={{margin:0,color:Z.muted,fontSize:13}}>Complete all checklist sections then log any non-conformances</p>
          </div>
          <div style={{background:Z.overlay,borderRadius:10,padding:"8px 16px",fontSize:13,color:Z.muted,border:`1px solid ${Z.border}`}}>
            {earned}/{possible} pts
          </div>
        </div>

        {/* Inspection type, date, inspector, location */}
        <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"18px 20px",marginBottom:18,border:`1px solid ${Z.borderMd}`}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
            <div>
              <label style={lbl}>Inspection Type *</label>
              <select value={form.type} onChange={e=>{setForm(p=>({...BLANK_FORM,type:e.target.value,date:p.date,inspector:p.inspector,location:p.location}));setFormSection(0);}} style={{...inp,cursor:"pointer"}}>
                {INSP_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Inspection Date *</label>
              <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Inspector Name *</label>
              <input value={form.inspector} onChange={e=>setForm(p=>({...p,inspector:e.target.value}))} placeholder="e.g. Linda Osei" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Location / Area *</label>
              <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="e.g. Zeus HQ — Full Site" style={inp}/>
            </div>
          </div>
        </div>

        {/* Section tabs */}
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
          {sections.map((s,i)=>{
            const done = s.questions.every(q=>(form.sections[s.id]||{})[q.id]!==undefined);
            return (
              <button key={s.id} onClick={()=>setFormSection(i)}
                style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${i===formSection?Z.accent:done?"rgba(16,185,129,0.35)":Z.borderMd}`,background:i===formSection?`linear-gradient(135deg,${Z.accent},${Z.blue})`:done?"rgba(16,185,129,0.1)":Z.overlay,color:i===formSection?"#fff":done?"#10b981":Z.muted,fontWeight:i===formSection?700:500,cursor:"pointer",fontFamily:font,fontSize:12,display:"flex",alignItems:"center",gap:5}}>
                {s.label} {done&&i!==formSection&&"✓"}
              </button>
            );
          })}
          <button onClick={()=>setFormSection(sections.length)}
            style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${formSection===sections.length?"#8b5cf6":Z.borderMd}`,background:formSection===sections.length?"rgba(139,92,246,0.2)":Z.overlay,color:formSection===sections.length?"#c4b5fd":Z.muted,fontWeight:formSection===sections.length?700:500,cursor:"pointer",fontFamily:font,fontSize:12}}>
            Non-Conformances {form.nonConformances.length>0&&`(${form.nonConformances.length})`}
          </button>
          <button onClick={()=>setFormSection(sections.length+1)}
            style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${formSection===sections.length+1?"#10b981":Z.borderMd}`,background:formSection===sections.length+1?"rgba(16,185,129,0.2)":Z.overlay,color:formSection===sections.length+1?"#10b981":Z.muted,fontWeight:formSection===sections.length+1?700:500,cursor:"pointer",fontFamily:font,fontSize:12}}>
            Summary & Submit
          </button>
        </div>

        {/* Checklist questions */}
        {formSection<sections.length && sec && (
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"18px 20px",marginBottom:16,border:`1px solid ${Z.borderMd}`}}>
            <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:700,color:Z.white}}>{sec.label}</h3>
            <div style={{display:"grid",gap:10}}>
              {sec.questions.map(q=>{
                const ans = (form.sections[sec.id]||{})[q.id];
                return (
                  <div key={q.id} style={{padding:"14px 16px",background:Z.overlay,borderRadius:12,border:`1px solid ${ans===0?"rgba(239,68,68,0.3)":ans===1?"rgba(245,158,11,0.3)":ans===2?"rgba(16,185,129,0.3)":Z.border}`}}>
                    <p style={{margin:"0 0 10px",fontSize:13,fontWeight:600,color:Z.white,lineHeight:1.5}}>{q.text}</p>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {[{v:2,label:"✓ Compliant",col:"#10b981",bg:"rgba(16,185,129,0.15)"},{v:1,label:"⚠ Partial",col:"#f59e0b",bg:"rgba(245,158,11,0.15)"},{v:0,label:"✗ Non-Compliant",col:"#f87171",bg:"rgba(239,68,68,0.15)"}].map(opt=>(
                        <button key={opt.v} onClick={()=>setAnswer(sec.id,q.id,opt.v)}
                          style={{padding:"7px 16px",borderRadius:9,border:`2px solid ${ans===opt.v?opt.col:Z.borderMd}`,background:ans===opt.v?opt.bg:Z.overlay,color:ans===opt.v?opt.col:Z.muted,fontWeight:ans===opt.v?700:400,cursor:"pointer",fontFamily:font,fontSize:12,transition:"all .2s"}}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              {formSection>0 && <button onClick={()=>setFormSection(s=>s-1)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 18px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>← Prev</button>}
              <button onClick={()=>setFormSection(s=>s+1)} disabled={!allAnswered}
                style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,opacity:allAnswered?1:.45}}>
                {isLastSec?"Non-Conformances →":"Next Section →"}
              </button>
            </div>
          </div>
        )}

        {/* Non-Conformances tab */}
        {formSection===sections.length && (
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"18px 20px",marginBottom:16,border:`1px solid ${Z.borderMd}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 style={{margin:0,fontSize:14,fontWeight:700,color:Z.white}}>Non-Conformances & Actions</h3>
              {!ncForm && <button onClick={()=>{setNcForm({...BLANK_NC,section:sections[0]?.label||""});setEditNcIdx(null);}}
                style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,boxShadow:"0 3px 10px rgba(16,185,129,0.3)"}}>
                + Add Non-Conformance
              </button>}
            </div>
            {ncForm && (
              <div style={{background:Z.overlay,borderRadius:12,padding:"14px 16px",marginBottom:14,border:`1px solid ${Z.borderMd}`}}>
                <div style={{display:"grid",gap:10,marginBottom:10}}>
                  <div>
                    <label style={lbl}>Finding / Non-Conformance *</label>
                    <textarea rows={2} value={ncForm.finding} onChange={e=>setNcForm(p=>({...p,finding:e.target.value}))} placeholder="Describe the finding..." style={{...inp,resize:"vertical",lineHeight:1.5}}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                    <div>
                      <label style={lbl}>Section</label>
                      <select value={ncForm.section} onChange={e=>setNcForm(p=>({...p,section:e.target.value}))} style={{...inp,cursor:"pointer"}}>
                        {sections.map(s=><option key={s.id} value={s.label}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Severity</label>
                      <select value={ncForm.severity} onChange={e=>setNcForm(p=>({...p,severity:e.target.value}))} style={{...inp,cursor:"pointer"}}>
                        <option value="major">Major</option>
                        <option value="minor">Minor</option>
                        <option value="observation">Observation</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Action Due Date</label>
                      <input type="date" value={ncForm.actionDue} onChange={e=>setNcForm(p=>({...p,actionDue:e.target.value}))} style={inp}/>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Action Owner</label>
                    <input value={ncForm.actionOwner} onChange={e=>setNcForm(p=>({...p,actionOwner:e.target.value}))} placeholder="Name or role responsible" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Photos</label>
                    <label style={{display:"inline-flex",alignItems:"center",gap:6,background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:font,fontSize:12,color:Z.muted,fontWeight:600}}>
                      📎 Upload Photos
                      <input type="file" accept={ACCEPT_IMAGES} multiple onChange={e=>handlePhotoUpload(e,null)} style={{display:"none"}}/>
                    </label>
                    {(ncForm.photos||[]).length>0 && (
                      <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                        {ncForm.photos.map((p,pi)=>(
                          <div key={pi} style={{position:"relative",width:70,height:70,borderRadius:8,overflow:"hidden",border:`1px solid ${Z.border}`}}>
                            <img src={p.data} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                            <button onClick={()=>setNcForm(prev=>({...prev,photos:prev.photos.filter((_,x)=>x!==pi)}))} style={{position:"absolute",top:2,right:2,background:"rgba(239,68,68,0.85)",color:"#fff",border:"none",borderRadius:3,width:16,height:16,cursor:"pointer",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveNC} style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:8,padding:"7px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12}}>
                    {editNcIdx!==null?"Save Changes":"Add Finding"}
                  </button>
                  <button onClick={()=>{setNcForm(null);setEditNcIdx(null);}} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>Cancel</button>
                </div>
              </div>
            )}
            {form.nonConformances.length===0 ? (
              <p style={{color:Z.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>No non-conformances added. Click above to log a finding, or proceed to Summary.</p>
            ) : (
              <div style={{display:"grid",gap:8}}>
                {form.nonConformances.map((nc,i)=>{
                  const sevCol = nc.severity==="major"?"#f87171":nc.severity==="minor"?"#fb923c":"#10b981";
                  return (
                    <div key={i} style={{padding:"12px 16px",background:Z.overlay,borderRadius:10,border:`1px solid ${sevCol}44`,display:"flex",gap:12,alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,fontWeight:800,color:sevCol,background:sevCol+"22",padding:"2px 8px",borderRadius:99,textTransform:"uppercase"}}>{nc.severity}</span>
                          <span style={{fontSize:11,color:Z.muted}}>{nc.section}</span>
                        </div>
                        <p style={{margin:0,fontSize:13,color:Z.white,lineHeight:1.4}}>{nc.finding}</p>
                        {nc.photos?.length>0 && <span style={{fontSize:11,color:Z.muted,marginTop:2,display:"block"}}>🖼 {nc.photos.length} photo{nc.photos.length!==1?"s":""}</span>}
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button onClick={()=>{setNcForm({...nc});setEditNcIdx(i);}} style={{background:"rgba(37,99,235,0.1)",color:Z.accentLt,border:`1px solid ${Z.accent}33`,borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700}}>✏</button>
                        <button onClick={()=>setForm(p=>({...p,nonConformances:p.nonConformances.filter((_,x)=>x!==i)}))} style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700}}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Summary & Submit */}
        {formSection===sections.length+1 && (
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"18px 20px",marginBottom:16,border:`1px solid ${Z.borderMd}`}}>
            <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:Z.white}}>Inspector Summary & Submit</h3>
            <div style={{marginBottom:16}}>
              <label style={lbl}>Overall Summary / Inspector Notes</label>
              <textarea rows={4} value={form.summary} onChange={e=>setForm(p=>({...p,summary:e.target.value}))} placeholder="Summarise the inspection findings, overall standard observed, and any key themes..." style={{...inp,resize:"vertical",lineHeight:1.6}}/>
            </div>
            <div style={{marginBottom:20,padding:"14px 18px",background:Z.overlay,borderRadius:12,border:`1px solid ${Z.border}`}}>
              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                <div><span style={{color:Z.muted,fontSize:12}}>Score: </span><span style={{fontWeight:800,fontSize:16,color:scoreColor(possible>0?Math.round(earned/possible*100):0)}}>{earned}/{possible}</span></div>
                <div><span style={{color:Z.muted,fontSize:12}}>Non-conformances: </span><span style={{fontWeight:700,color:Z.white}}>{form.nonConformances.length}</span></div>
                <div><span style={{color:Z.muted,fontSize:12}}>Majors: </span><span style={{fontWeight:700,color:"#f87171"}}>{form.nonConformances.filter(n=>n.severity==="major").length}</span></div>
              </div>
            </div>
            <button onClick={submitInspection} disabled={!form.inspector.trim()||!form.location.trim()}
              style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:12,padding:"12px 32px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:14,boxShadow:"0 4px 18px rgba(16,185,129,0.35)",opacity:form.inspector.trim()&&form.location.trim()?1:.45}}>
              💾 Save Inspection
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── LIST view ────────────────────────────────────────────────────────────────
  const filtered = inspections.filter(i=>(filterType==="all"||i.type===filterType)&&(filterStatus==="all"||i.status===filterStatus));
  const overdue = inspections.filter(i=>i.nextDue&&i.nextDue<today);
  const openCount = inspections.filter(i=>i.status==="open").length;
  const avgScore = inspections.length ? Math.round(inspections.reduce((s,i)=>s+(i.maxScore>0?i.overallScore/i.maxScore*100:0),0)/inspections.length) : 0;

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px",color:Z.white}}>Site Inspections <HelpTip dark={true} text="Record regular site inspection findings. Each inspection is scored and failing items can have corrective actions assigned with a due date and responsible person. Completed inspections are stored for audit purposes."/></h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>{inspections.length} inspections recorded · H&S Audits, Fire Risk Assessments, Walk Arounds</p>
        </div>
        <button onClick={()=>{setForm(BLANK_FORM);setFormSection(0);setNcForm(null);setView("new");}}
          style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:`0 4px 16px ${Z.accent}44`,display:"flex",alignItems:"center",gap:6}}>
          + New Inspection
        </button>
      </div>

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14,marginBottom:24}}>
        {[
          {icon:E("📋",""),val:inspections.length,label:"Total Inspections",col:"#6366f1"},
          {icon:E("⚠️",""),val:openCount,label:"Open Actions",col:"#f87171"},
          {icon:E("🚨",""),val:overdue.length,label:"Overdue Re-inspections",col:"#ef4444"},
          {icon:E("📊",""),val:`${avgScore}%`,label:"Average Score",col:scoreColor(avgScore)},
        ].map((s,i)=>(
          <div key={i} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:"18px 20px",borderLeft:`4px solid ${s.col}`,boxShadow:"0 4px 20px rgba(0,0,0,.1)"}}>
            <div style={{fontSize:26}}>{s.icon}</div>
            <div style={{fontSize:30,fontWeight:900,color:Z.white,marginTop:4,lineHeight:1}}>{s.val}</div>
            <div style={{color:Z.muted,fontSize:11,marginTop:3}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {overdue.length>0 && (
        <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:14,padding:"14px 18px",marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:800,letterSpacing:.5,color:"#f87171",textTransform:"uppercase",marginBottom:10}}>🚨 Overdue Re-inspections</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {overdue.map(i=>{
              const ti=typeInfo(i.type);
              return (
                <button key={i.id} onClick={()=>{setActiveId(i.id);setView("detail");window.scrollTo({top:0,behavior:"smooth"});}} style={{background:"rgba(239,68,68,0.1)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:600}}>
                  {ti.icon} {ti.label} — due {i.nextDue}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:12,color:Z.muted,fontWeight:600}}>Filter:</span>
        {[["all","All Types"],...INSP_TYPES.map(t=>[t.id,`${t.icon} ${t.label}`])].map(([id,label])=>(
          <button key={id} onClick={()=>setFilterType(id)}
            style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${filterType===id?Z.accent:Z.borderMd}`,background:filterType===id?`linear-gradient(135deg,${Z.accent},${Z.blue})`:Z.overlay,color:filterType===id?"#fff":Z.muted,fontWeight:filterType===id?700:400,cursor:"pointer",fontFamily:font,fontSize:11}}>
            {label}
          </button>
        ))}
        <div style={{width:1,height:20,background:Z.border,margin:"0 4px"}}/>
        {[["all","All Statuses"],["open","⚠ Open"],["closed","✓ Closed"]].map(([id,label])=>(
          <button key={id} onClick={()=>setFilterStatus(id)}
            style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${filterStatus===id?Z.accent:Z.borderMd}`,background:filterStatus===id?`linear-gradient(135deg,${Z.accent},${Z.blue})`:Z.overlay,color:filterStatus===id?"#fff":Z.muted,fontWeight:filterStatus===id?700:400,cursor:"pointer",fontFamily:font,fontSize:11}}>
            {label}
          </button>
        ))}
      </div>

      {/* Inspection list */}
      {/* Inspection list */}
      <div style={{display:"grid",gap:10}}>
        {filtered.sort((a,b)=>b.date.localeCompare(a.date)).map(ins=>{
          const ti=typeInfo(ins.type);
          const pct=ins.maxScore>0?Math.round(ins.overallScore/ins.maxScore*100):0;
          const sc=scoreColor(pct);
          const openNCs=ins.nonConformances.filter(n=>n.actionStatus!=="complete").length;
          const overduNC=ins.nextDue&&ins.nextDue<today;
          const isEditing=editingInspId===ins.id;
          return (
            <div key={ins.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:`1px solid ${isEditing?Z.accent:ins.status==="open"?"rgba(245,158,11,0.3)":Z.border}`,overflow:"hidden",transition:"border-color .2s"}}>
              {/* Card header row */}
              <div style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",cursor:isEditing?"default":"pointer"}}
                onClick={()=>{if(!isEditing){setActiveId(ins.id);setView("detail");window.scrollTo({top:0,behavior:"smooth"});}}}>
                <div style={{width:48,height:48,borderRadius:12,background:ti.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{ti.icon}</div>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontWeight:800,fontSize:14,color:Z.white}}>{ti.label}</span>
                    <span style={{fontSize:11,color:Z.muted}}>📍 {ins.location}</span>
                    <span style={{fontSize:11,color:Z.muted}}>📅 {ins.date}</span>
                    {ins.status==="open" && <span style={{fontSize:10,background:"rgba(245,158,11,0.15)",color:"#f59e0b",padding:"2px 8px",borderRadius:99,fontWeight:700}}>⏳ Open</span>}
                    {ins.status==="closed" && <span style={{fontSize:10,background:"rgba(16,185,129,0.12)",color:"#10b981",padding:"2px 8px",borderRadius:99,fontWeight:700}}>✓ Closed</span>}
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {openNCs>0 && <span style={{fontSize:11,color:"#f87171",fontWeight:600}}>{openNCs} open action{openNCs!==1?"s":""}</span>}
                    {ins.nonConformances.length>0 && <span style={{fontSize:11,color:Z.muted}}>{ins.nonConformances.length} finding{ins.nonConformances.length!==1?"s":""}</span>}
                    {ins.inspector && <span style={{fontSize:11,color:Z.muted}}>Inspector: {ins.inspector}</span>}
                    {ins.nextDue && <span style={{fontSize:11,color:overduNC?"#f87171":Z.muted,fontWeight:overduNC?700:400}}>{overduNC?"🚨 Overdue — ":"Next: "}{ins.nextDue}</span>}
                  </div>
                </div>
                <div style={{textAlign:"center",flexShrink:0}}>
                  <div style={{fontSize:26,fontWeight:900,color:sc,lineHeight:1}}>{pct}<span style={{fontSize:13,opacity:.6}}>%</span></div>
                  <div style={{fontSize:10,color:Z.muted,marginTop:1}}>{ins.overallScore}/{ins.maxScore} pts</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>{setEditingInspId(ins.id);setEditInspForm({date:ins.date,location:ins.location,inspector:ins.inspector,summary:ins.summary||"",nextDue:ins.nextDue||"",status:ins.status});}}
                    style={{background:"rgba(37,99,235,0.1)",color:Z.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,whiteSpace:"nowrap"}}>✏ Edit</button>
                  <button onClick={()=>{if(window.confirm("Delete this inspection? This cannot be undone.")){setInspections(p=>p.filter(x=>x.id!==ins.id));}}}
                    style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:9,padding:"8px 12px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12}}>🗑</button>
                  <button onClick={()=>{setActiveId(ins.id);setView("detail");window.scrollTo({top:0,behavior:"smooth"});}}
                    style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:9,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,whiteSpace:"nowrap",boxShadow:`0 4px 12px ${Z.accent}33`}}>View →</button>
                </div>
              </div>
              {/* Inline edit form */}
              {isEditing && editInspForm && (
                <div onClick={e=>e.stopPropagation()} style={{borderTop:`1px solid ${Z.border}`,padding:"16px 20px",background:Z.overlay}}>
                  <div style={{fontSize:12,fontWeight:700,color:Z.accentLt,marginBottom:12,textTransform:"uppercase",letterSpacing:.5}}>✏ Edit Inspection Details</div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                    {[["date","Date","date"],["location","Location","text"],["inspector","Inspector","text"],["nextDue","Next Due","date"]].map(([k,label,type])=>(
                      <div key={k}>
                        <label style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>{label}</label>
                        <input type={type} value={editInspForm[k]||""} onChange={e=>setEditInspForm(p=>({...p,[k]:e.target.value}))}
                          style={{width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 11px",color:Z.white,fontSize:12,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
                      </div>
                    ))}
                    <div>
                      <label style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Status</label>
                      <select value={editInspForm.status} onChange={e=>setEditInspForm(p=>({...p,status:e.target.value}))}
                        style={{width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 11px",color:Z.white,fontSize:12,outline:"none",fontFamily:font,cursor:"pointer",boxSizing:"border-box"}}>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Summary</label>
                    <textarea value={editInspForm.summary||""} onChange={e=>setEditInspForm(p=>({...p,summary:e.target.value}))}
                      style={{width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 11px",color:Z.white,fontSize:12,outline:"none",fontFamily:font,boxSizing:"border-box",resize:"vertical",minHeight:60}}/>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{setInspections(p=>p.map(x=>x.id===ins.id?{...x,...editInspForm}:x));setEditingInspId(null);setEditInspForm(null);}}
                      style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:9,padding:"8px 20px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>✓ Save</button>
                    <button onClick={()=>{setEditingInspId(null);setEditInspForm(null);}}
                      style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:9,padding:"8px 16px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length===0 && (
          <div style={{textAlign:"center",padding:48,color:Z.muted,fontSize:13}}>
            <div style={{fontSize:40,marginBottom:8}}>📋</div>
            No inspections match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

export { SiteInspectionsTab };
