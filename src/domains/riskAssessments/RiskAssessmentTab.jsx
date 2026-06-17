import React from "react";
import { useWindowWidth } from "../../shared/hooks";
import { RiskMatrix, riskLevel } from "../../shared/RiskMatrix";
import { HelpTip } from "../../shared/HelpTip";
import { EMPTY_HAZARD } from "../../data/seedRiskAssessments";
import { generateRAHtml } from "./generateRAHtml";

function RiskAssessmentTab({ docs, setDocs, setAtab, ras, setRas, dbSaveRA, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [view, setView]     = useState("list");  // "list" | "new" | "edit"
  const [editId, setEditId] = useState(null);
  const [form, setForm]     = useState(null);
  const [step, setStep]     = useState(0); // 0=details, 1=hazards, 2=review
  const [saved, setSaved]   = useState(false);

  // RA seeding moved to App component on mount

  function newRA() {
    setForm({
      id:"ra"+Date.now(), title:"", location:"", activity:"", department:"",
      assessor:"", reference:"", reviewDate:"", date:new Date().toISOString().slice(0,10),
      hazards:[ EMPTY_HAZARD() ],
    });
    setStep(0); setSaved(false); setView("new");
  }

  function editRA(ra) {
    setForm({...ra, hazards: ra.hazards.map(h=>({...h}))});
    setStep(0); setSaved(false); setEditId(ra.id); setView("edit");
  }

  function setF(k,v){ setForm(p=>({...p,[k]:v})); }

  function addHazard() {
    setForm(p=>({...p, hazards:[...p.hazards, EMPTY_HAZARD()]}));
  }

  function updateHazard(idx, key, val) {
    setForm(p=>{ const h=[...p.hazards]; h[idx]={...h[idx],[key]:val}; return {...p,hazards:h}; });
  }

  function removeHazard(idx) {
    setForm(p=>({ ...p, hazards: p.hazards.filter((_,i)=>i!==idx) }));
  }

  function finalise() {
    const html = generateRAHtml(form);
    const blob = new Blob([html], {type:"text/html"});
    const reader = new FileReader();
    reader.onload = ev => {
      const docEntry = {
        id: "d"+Date.now(),
        title: form.title || "Untitled Risk Assessment",
        date: form.date,
        size: `${Math.round(html.length/1024)} KB`,
        type: "Risk Assessment",
        fileData: ev.target.result,
        fileName: (form.title||"risk-assessment").toLowerCase().replace(/\s+/g,"-")+".html",
        ext: "HTML",
        raId: form.id,
      };
      setDocs(p=>{
        const existing = p.findIndex(d=>d.raId===form.id);
        if (existing>=0) { const n=[...p]; n[existing]=docEntry; return n; }
        return [...p, docEntry];
      });
      setSaved(true);
      setRas(p=>{
        const existing = p.findIndex(r=>r.id===form.id);
        if (existing>=0) { const n=[...p]; n[existing]=form; return n; }
        return [...p, form];
      });
      if (dbSaveRA) dbSaveRA(form);
    };
    reader.readAsDataURL(blob);
  }

  const selStyle = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 14px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer",boxSizing:"border-box"};
  const inputStyle = {...selStyle,cursor:"text"};
  const labelStyle = {color:Z.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6};

  // ── List view ──────────────────────────────────────────────────────────────
  if (view==="list") return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Risk Assessment Builder <HelpTip dark={false} text="Create and manage risk assessments for activities and work areas. Hazards are scored by likelihood and severity to produce initial and residual risk ratings. Completed assessments are added to the Documents tab automatically."/></h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>Create 5×5 risk assessments — completed RAs are published to the Documents tab for staff</p>
        </div>
        <button onClick={newRA}
          style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:`0 4px 16px ${Z.accent}44`}}>
          + New Risk Assessment
        </button>
      </div>

      {ras.length===0 ? (
        <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:56,textAlign:"center",border:`1px solid ${Z.border}`}}>
          <div style={{fontSize:52,marginBottom:12}}>📋</div>
          <p style={{color:Z.white,fontWeight:700,fontSize:16,margin:"0 0 6px"}}>No risk assessments yet</p>
          <p style={{color:Z.muted,fontSize:13,margin:"0 0 24px"}}>Create your first RA — it will be published to the Documents tab when complete</p>
          <button onClick={newRA}
            style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"12px 28px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:14}}>
            + New Risk Assessment
          </button>
        </div>
      ) : (
        <div style={{display:"grid",gap:12}}>
          {ras.map(ra=>{
            const high = ra.hazards.filter(h=>{
              if (!h.residualRisk.likelihood||!h.residualRisk.severity) return false;
              const lbl = riskLevel(h.residualRisk.likelihood,h.residualRisk.severity).label;
              return lbl==="Very High"||lbl==="High";
            }).length;
            const done = ra.hazards.filter(h=>h.actionComplete).length;
            return (
              <div key={ra.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"16px 20px",border:`1px solid ${Z.border}`,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <span style={{fontSize:26,flexShrink:0}}>📋</span>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:800,fontSize:15,color:Z.white}}>{ra.title}</div>
                  <div style={{color:Z.muted,fontSize:12,marginTop:2}}>{ra.location}{ra.activity?` · ${ra.activity}`:""} · Created {ra.date}</div>
                  <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,background:"rgba(37,99,235,0.15)",color:Z.accentLt,padding:"2px 8px",borderRadius:6,fontWeight:600}}>{ra.hazards.length} hazard{ra.hazards.length!==1?"s":""}</span>
                    <span style={{fontSize:11,background:"rgba(16,185,129,0.12)",color:"#10b981",padding:"2px 8px",borderRadius:6,fontWeight:600}}>{done}/{ra.hazards.length} actions complete</span>
                    {high>0&&<span style={{fontSize:11,background:"rgba(239,68,68,0.12)",color:"#f87171",padding:"2px 8px",borderRadius:6,fontWeight:600}}>⚠ {high} high residual risk{high!==1?"s":""}</span>}
                    {(()=>{
                      if (!ra.reviewDate) return <span style={{fontSize:11,background:"rgba(255,255,255,0.06)",color:Z.muted,padding:"2px 8px",borderRadius:6}}>📅 No review date</span>;
                      const days = Math.ceil((new Date(ra.reviewDate)-new Date())/86400000);
                      if (days < 0) return <span style={{fontSize:11,background:"rgba(239,68,68,0.12)",color:"#f87171",padding:"2px 8px",borderRadius:6,fontWeight:700}}>⚠ Review overdue by {Math.abs(days)}d</span>;
                      if (days <= 30) return <span style={{fontSize:11,background:"rgba(245,158,11,0.12)",color:"#f59e0b",padding:"2px 8px",borderRadius:6,fontWeight:700}}>⏳ Review due in {days}d</span>;
                      return <span style={{fontSize:11,background:"rgba(255,255,255,0.06)",color:Z.muted,padding:"2px 8px",borderRadius:6}}>📅 Review: {ra.reviewDate}</span>;
                    })()}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"wrap"}}>
                  <button onClick={()=>editRA(ra)}
                    style={{background:"rgba(37,99,235,0.15)",color:Z.accentLt,border:`1px solid ${Z.accent}44`,borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
                    ✏ Edit
                  </button>
                  <button onClick={()=>{setAtab("documents");}}
                    style={{background:"rgba(16,185,129,0.12)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
                    📄 View in Docs
                  </button>
                  <button onClick={()=>{
                    const d = prompt("Set next review date (YYYY-MM-DD):", ra.reviewDate || new Date(new Date().setFullYear(new Date().getFullYear()+1)).toISOString().slice(0,10));
                    if (d===null) return;
                    const updated = {...ra, reviewDate:d};
                    setRas(p=>p.map(r=>r.id===ra.id?updated:r));
                    dbSaveRA(updated);
                  }} style={{background:"rgba(245,158,11,0.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.25)",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                    📅 Review Date
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!form) return null;

  const STEPS = ["RA Details","Hazards & Controls","Review & Publish"];
  const canGoToHazards = form.title.trim() && form.location.trim();
  const canFinalise = canGoToHazards && form.hazards.length>0 && form.hazards.every(h=>h.hazard.trim()&&h.initialRisk.likelihood&&h.initialRisk.severity&&h.residualRisk.likelihood&&h.residualRisk.severity);

  // ── Step indicator ─────────────────────────────────────────────────────────
  const StepBar = () => (
    <div style={{display:"flex",gap:0,marginBottom:28,background:Z.overlay,borderRadius:12,padding:4,border:`1px solid ${Z.border}`}}>
      {STEPS.map((s,i)=>(
        <button key={i} onClick={()=>{ if(i<=1||canGoToHazards) setStep(i); }}
          style={{flex:1,padding:"10px 8px",borderRadius:9,border:"none",background:step===i?`linear-gradient(135deg,${Z.accent},${Z.blue})`:"transparent",color:step===i?"#fff":step>i?Z.accentLt:Z.muted,fontWeight:step===i?700:400,cursor:"pointer",fontFamily:font,fontSize:12,transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <span style={{width:18,height:18,borderRadius:"50%",background:step>i?"rgba(59,130,246,0.3)":step===i?Z.muted:Z.overlay,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>
            {step>i?"✓":i+1}
          </span>
          {s}
        </button>
      ))}
    </div>
  );

  // ── Step 0: RA Details ─────────────────────────────────────────────────────
  if (step===0) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={()=>{setView("list");setForm(null);}}
          style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12}}>← Back</button>
        <h2 style={{margin:0,fontSize:20,fontWeight:900,letterSpacing:-.5}}>{view==="edit"?"Edit":"New"} Risk Assessment</h2>
      </div>
      <StepBar/>
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:28,border:`1px solid ${Z.border}`}}>
        <h3 style={{margin:"0 0 20px",fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase"}}>Assessment Details</h3>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:16}}>
          <div style={{gridColumn:"1/-1"}}>
            <label style={labelStyle}>TITLE / ACTIVITY BEING ASSESSED *</label>
            <input value={form.title} onChange={e=>setF("title",e.target.value)} placeholder="e.g. Manual Handling of Warehouse Goods" style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>LOCATION *</label>
            <input value={form.location} onChange={e=>setF("location",e.target.value)} placeholder="e.g. Warehouse — Goods-In Area" style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>DEPARTMENT / TEAM</label>
            <input value={form.department} onChange={e=>setF("department",e.target.value)} placeholder="e.g. Warehouse Operations" style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>ASSESSOR NAME</label>
            <input value={form.assessor} onChange={e=>setF("assessor",e.target.value)} placeholder="e.g. Admin User" style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>RA REFERENCE</label>
            <input value={form.reference} onChange={e=>setF("reference",e.target.value)} placeholder="e.g. RA-2026-001" style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>DATE OF ASSESSMENT</label>
            <input type="date" value={form.date} onChange={e=>setF("date",e.target.value)} style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>REVIEW DATE</label>
            <input type="date" value={form.reviewDate} onChange={e=>setF("reviewDate",e.target.value)} style={inputStyle}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={labelStyle}>ACTIVITY DESCRIPTION</label>
            <textarea value={form.activity} onChange={e=>setF("activity",e.target.value)} placeholder="Brief description of the work activity being assessed..." rows={3} style={{...inputStyle,resize:"vertical",lineHeight:1.6}}/>
          </div>
        </div>
      </div>

      {/* Risk matrix key */}
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:24,border:`1px solid ${Z.border}`,marginTop:16}}>
        <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase"}}>5×5 Risk Matrix Key</h3>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[[1,1,"Very Low",1],[2,2,"Low",4],[3,2,"Medium",6],[4,3,"High",12],[5,3,"Very High",15]].map(([l,s,lbl,sc])=>{
            const rl=riskLevel(l,s);
            return (
              <div key={lbl} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 12px",borderRadius:8,background:rl.bg,border:`1px solid ${rl.color}44`}}>
                <div style={{width:9,height:9,borderRadius:2,background:rl.color,flexShrink:0}}/>
                <span style={{fontSize:12,fontWeight:700,color:rl.text}}>{lbl}</span>
                <span style={{fontSize:11,color:Z.muted}}>Score {sc<=2?"1-2":sc<=4?"3-4":sc<=9?"5-9":sc<=14?"10-14":"15-25"}</span>
              </div>
            );
          })}
        </div>
        <p style={{color:Z.muted,fontSize:12,margin:"12px 0 0",lineHeight:1.6}}>
          <strong style={{color:Z.white}}>Likelihood:</strong> 1 Rare · 2 Unlikely · 3 Possible · 4 Likely · 5 Almost Certain &nbsp;|&nbsp;
          <strong style={{color:Z.white}}>Severity:</strong> 1 Negligible · 2 Minor · 3 Moderate · 4 Major · 5 Catastrophic
        </p>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
        <button onClick={()=>setStep(1)} disabled={!canGoToHazards}
          style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"12px 32px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:14,opacity:canGoToHazards?1:.45,boxShadow:`0 4px 16px ${Z.accent}44`}}>
          Next: Add Hazards →
        </button>
      </div>
    </div>
  );

  // ── Step 1: Hazards ────────────────────────────────────────────────────────
  if (step===1) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <button onClick={()=>{setView("list");setForm(null);}}
          style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12}}>← Back</button>
        <h2 style={{margin:0,fontSize:20,fontWeight:900,letterSpacing:-.5,flex:1}}>{form.title||"Risk Assessment"}</h2>
      </div>
      <StepBar/>

      {form.hazards.map((h,idx)=>{
        const iRl = h.initialRisk.likelihood&&h.initialRisk.severity ? riskLevel(h.initialRisk.likelihood,h.initialRisk.severity) : null;
        const rRl = h.residualRisk.likelihood&&h.residualRisk.severity ? riskLevel(h.residualRisk.likelihood,h.residualRisk.severity) : null;
        return (
          <div key={h.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:24,border:`1px solid ${Z.border}`,marginBottom:16,position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{idx+1}</div>
                <span style={{fontSize:14,fontWeight:700,color:Z.white}}>Hazard {idx+1}</span>
                {iRl&&<span style={{fontSize:11,background:iRl.bg,color:iRl.text,padding:"2px 8px",borderRadius:6,fontWeight:600}}>Initial: {iRl.label}</span>}
                {rRl&&<span style={{fontSize:11,background:rRl.bg,color:rRl.text,padding:"2px 8px",borderRadius:6,fontWeight:600}}>Residual: {rRl.label}</span>}
              </div>
              {form.hazards.length>1&&(
                <button onClick={()=>removeHazard(idx)}
                  style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                  ✕ Remove
                </button>
              )}
            </div>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:18}}>
              <div style={{gridColumn:"1/-1"}}>
                <label style={labelStyle}>HAZARD DESCRIPTION *</label>
                <input value={h.hazard} onChange={e=>updateHazard(idx,"hazard",e.target.value)} placeholder="e.g. Manual handling of heavy pallets causing musculoskeletal injury" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>WHO IS AFFECTED</label>
                <input value={h.whoAffected} onChange={e=>updateHazard(idx,"whoAffected",e.target.value)} placeholder="e.g. Warehouse operatives, visiting contractors" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>EXISTING CONTROLS</label>
                <input value={h.existingControls} onChange={e=>updateHazard(idx,"existingControls",e.target.value)} placeholder="e.g. Manual handling training completed, team lifts required >20 kg" style={inputStyle}/>
              </div>
            </div>

            {/* Risk matrices side by side */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:18}}>
              <div>
                <RiskMatrix value={h.initialRisk} onChange={v=>updateHazard(idx,"initialRisk",v)} Z={Z} font={font} label="Initial / Inherent Risk (before controls)"/>
              </div>
              <div>
                <RiskMatrix value={h.residualRisk} onChange={v=>updateHazard(idx,"residualRisk",v)} Z={Z} font={font} label="Residual Risk (after controls)"/>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr 1fr",gap:14,marginBottom:14}}>
              <div>
                <label style={labelStyle}>FURTHER CONTROLS REQUIRED</label>
                <textarea value={h.furtherControls} onChange={e=>updateHazard(idx,"furtherControls",e.target.value)} placeholder="Additional measures needed to reduce residual risk further..." rows={2} style={{...inputStyle,resize:"vertical",lineHeight:1.6}}/>
              </div>
              <div>
                <label style={labelStyle}>RESPONSIBLE PERSON</label>
                <input value={h.responsiblePerson} onChange={e=>updateHazard(idx,"responsiblePerson",e.target.value)} placeholder="e.g. Mark Davies" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>TARGET DATE</label>
                <input type="date" value={h.targetDate} onChange={e=>updateHazard(idx,"targetDate",e.target.value)} style={inputStyle}/>
              </div>
            </div>

            {/* Action complete toggle */}
            <button onClick={()=>updateHazard(idx,"actionComplete",!h.actionComplete)}
              style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",borderRadius:9,border:`2px solid ${h.actionComplete?"rgba(16,185,129,0.5)":Z.borderMd}`,background:h.actionComplete?"rgba(16,185,129,0.1)":Z.overlay,color:h.actionComplete?"#10b981":Z.muted,cursor:"pointer",fontFamily:font,fontWeight:h.actionComplete?700:400,fontSize:12,transition:"all .2s"}}>
              <span>{h.actionComplete?"✓":"○"}</span> Mark further controls as complete
            </button>
          </div>
        );
      })}

      <button onClick={addHazard}
        style={{width:"100%",background:Z.overlay,border:`2px dashed ${Z.borderMd}`,borderRadius:14,padding:"16px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,marginBottom:20}}>
        + Add Another Hazard
      </button>

      <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
        <button onClick={()=>setStep(0)}
          style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 24px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700}}>← Back</button>
        <button onClick={()=>setStep(2)} disabled={!canFinalise}
          style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"12px 32px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:14,opacity:canFinalise?1:.45,boxShadow:`0 4px 16px ${Z.accent}44`}}>
          Review & Publish →
        </button>
      </div>
      {!canFinalise&&<p style={{color:Z.muted,fontSize:12,textAlign:"right",marginTop:6}}>Every hazard needs a description and both risk scores selected</p>}
    </div>
  );

  // ── Step 2: Review & Publish ───────────────────────────────────────────────
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={()=>{setView("list");setForm(null);}}
          style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12}}>← Back</button>
        <h2 style={{margin:0,fontSize:20,fontWeight:900,letterSpacing:-.5}}>{form.title}</h2>
      </div>
      <StepBar/>

      {/* Summary */}
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:24,border:`1px solid ${Z.border}`,marginBottom:16}}>
        <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase"}}>Assessment Summary</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:16}}>
          {[["📍 Location",form.location],["👤 Assessor",form.assessor||"—"],["🔖 Reference",form.reference||"—"],["📅 Review",form.reviewDate||"—"]].map(([k,v])=>(
            <div key={k} style={{padding:"10px 14px",background:Z.overlay,borderRadius:10,border:`1px solid ${Z.border}`}}>
              <div style={{fontSize:11,color:Z.muted,marginBottom:2}}>{k}</div>
              <div style={{fontSize:13,fontWeight:600,color:Z.white}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <div style={{background:"rgba(37,99,235,0.12)",borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900,color:Z.accentLt}}>{form.hazards.length}</div>
            <div style={{fontSize:11,color:Z.muted}}>Hazards</div>
          </div>
          {["Very High","High","Medium","Low","Very Low"].map(lbl=>{
            const cnt = form.hazards.filter(h=>h.residualRisk.likelihood&&h.residualRisk.severity&&riskLevel(h.residualRisk.likelihood,h.residualRisk.severity).label===lbl).length;
            if (!cnt) return null;
            const rl = {
              "Very High":{color:"#dc2626",bg:"rgba(220,38,38,0.12)"},
              "High":{color:"#f97316",bg:"rgba(249,115,22,0.12)"},
              "Medium":{color:"#f59e0b",bg:"rgba(245,158,11,0.12)"},
              "Low":{color:"#22c55e",bg:"rgba(34,197,94,0.12)"},
              "Very Low":{color:"#10b981",bg:"rgba(16,185,129,0.12)"},
            }[lbl];
            return (
              <div key={lbl} style={{background:rl.bg,borderRadius:10,padding:"10px 16px",textAlign:"center",border:`1px solid ${rl.color}33`}}>
                <div style={{fontSize:22,fontWeight:900,color:rl.color}}>{cnt}</div>
                <div style={{fontSize:11,color:Z.muted}}>{lbl}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hazard summary table */}
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,border:`1px solid ${Z.border}`,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"12px 18px",borderBottom:`1px solid ${Z.border}`,fontSize:12,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase"}}>Hazard Summary</div>
        {form.hazards.map((h,i)=>{
          const iRl = h.initialRisk.likelihood&&h.initialRisk.severity?riskLevel(h.initialRisk.likelihood,h.initialRisk.severity):null;
          const rRl = h.residualRisk.likelihood&&h.residualRisk.severity?riskLevel(h.residualRisk.likelihood,h.residualRisk.severity):null;
          return (
            <div key={h.id} style={{display:"grid",gridTemplateColumns:"30px 3fr 1fr 1fr 1fr",padding:"12px 18px",borderTop:i>0?`1px solid ${Z.border}`:"none",alignItems:"center",gap:12}}>
              <span style={{fontWeight:700,color:Z.muted,fontSize:13}}>{i+1}</span>
              <div>
                <div style={{fontWeight:600,fontSize:13,color:Z.white}}>{h.hazard}</div>
                {h.whoAffected&&<div style={{fontSize:11,color:Z.muted,marginTop:2}}>Affects: {h.whoAffected}</div>}
              </div>
              <div style={{textAlign:"center"}}>
                {iRl?<span style={{fontSize:11,background:iRl.bg,color:iRl.text,padding:"2px 8px",borderRadius:6,fontWeight:600}}>{iRl.label}<br/><span style={{opacity:.7}}>({h.initialRisk.likelihood*h.initialRisk.severity})</span></span>:<span style={{color:Z.muted,fontSize:11}}>—</span>}
              </div>
              <div style={{textAlign:"center"}}>
                {rRl?<span style={{fontSize:11,background:rRl.bg,color:rRl.text,padding:"2px 8px",borderRadius:6,fontWeight:600}}>{rRl.label}<br/><span style={{opacity:.7}}>({h.residualRisk.likelihood*h.residualRisk.severity})</span></span>:<span style={{color:Z.muted,fontSize:11}}>—</span>}
              </div>
              <div style={{textAlign:"center"}}>
                {h.actionComplete?<span style={{fontSize:11,color:"#10b981",fontWeight:700}}>✓ Complete</span>:<span style={{fontSize:11,color:Z.amber}}>Pending</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Publish */}
      {saved ? (
        <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:14,padding:"20px 24px",display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:28}}>✅</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:15,color:"#10b981"}}>Risk Assessment published to Documents</div>
            <div style={{color:Z.muted,fontSize:12,marginTop:3}}>Staff can now view, download, and be assigned this RA from the Documents tab</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setAtab("documents");}}
              style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
              → Go to Documents
            </button>
            <button onClick={()=>{setView("list");setForm(null);setSaved(false);}}
              style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:9,padding:"9px 18px",color:Z.muted,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
          <button onClick={()=>setStep(1)}
            style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 24px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700}}>← Edit Hazards</button>
          <button onClick={finalise}
            style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:10,padding:"12px 32px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:14,boxShadow:"0 4px 16px rgba(16,185,129,0.4)"}}>
            ✓ Publish to Documents
          </button>
        </div>
      )}
    </div>
  );
}


export { RiskAssessmentTab };
