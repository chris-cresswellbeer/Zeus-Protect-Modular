import React, { useState } from "react";
import { useFormGuard, DraftBanner, confirmLeave } from "../../lib/unsaved";
import { useWindowWidth } from "../../shared/hooks";
import { RiskMatrix, riskLevel } from "../../shared/RiskMatrix";
import { HelpTip } from "../../shared/HelpTip";
import { EMPTY_HAZARD } from "../../data/seedRiskAssessments";
import { generateRAHtml } from "./generateRAHtml";
import { ask } from "../../shared/Feedback";
import { useRemembered } from "../../lib/remembered";

import { localISO, todayISO } from "../../lib/dates";
/**
 * RiskAssessmentTab — admin risk assessments (Management of Health and Safety at Work
 * Regulations 1999, reg. 3).
 *
 * Views: "list" (all RAs, inline review-date edit), "new"/"edit" (3-step wizard:
 * details → hazards & controls → review & publish), "tracker" (every hazard's
 * "further control" action across all RAs: overdue / pending / complete, by owner).
 *
 * RA SHAPE: { id:"ra<ts>", title, location, activity, department, assessor, reference,
 *   date, reviewDate, hazards:[{ id, hazard, whoAffected, existingControls,
 *   initialRisk:{likelihood,severity}, furtherControls, responsiblePerson, targetDate,
 *   residualRisk:{likelihood,severity}, actionComplete }] }
 *   (EMPTY_HAZARD in data/seedRiskAssessments.js is the template for a new hazard row)
 * Scores use the 5×5 matrix (shared/RiskMatrix.jsx).
 *
 * Saved via dbSaveRA → risk_assessments (JSON per RA). All RAs come from the database (formerly merged with built-in INIT_RAS)d
 * with DB rows on load in App.jsx.
 */
function RiskAssessmentTab({ docs, setDocs, setAtab, ras, setRas, dbSaveRA, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [view, setView]     = useState("list");  // "list" | "new" | "edit" | "tracker"
  const [trackerStatus, setTrackerStatus] = useState("all"); // "all" | "overdue" | "pending" | "complete"
  const [trackerOwner, setTrackerOwner]   = useState("all");
  const [editId, setEditId] = useState(null);
  const [form, setForm]     = useState(null);
  const [step, setStep]     = useState(0); // 0=details, 1=hazards, 2=review
  const [saved, setSaved]   = useState(false);
  // list search and filter (remembered while signed in, like other lists)
  const [raSearch, setRaSearch] = useRemembered("ra.search", "");
  const [raShow, setRaShow]     = useRemembered("ra.show", "all");   // all | overdue | soon | high | actions

  // RA seeding moved to App component on mount

  // Start a blank RA (id "ra<timestamp>") with one empty hazard row.
  function newRA() {
    setForm({
      id:"ra"+Date.now(), title:"", location:"", activity:"", department:"",
      assessor:"", reference:"", reviewDate:"", date:todayISO(),
      hazards:[ EMPTY_HAZARD() ],
    });
    setStep(0); setSaved(false); setView("new");
  }

  // Copy (including each hazard) so edits don't touch state until finalise().
  function editRA(ra) {
    setForm({...ra, hazards: ra.hazards.map(h=>({...h}))});
    setStep(0); setSaved(false); setEditId(ra.id); setView("edit");
  }

  function setF(k,v){ setForm(p=>({...p,[k]:v})); }
  // unsaved-changes warning + draft on this device (lib/unsaved.jsx)
  const raGuard = useFormGuard({ key: `ra.${editId || "new"}`, label: view === "edit" ? "the risk assessment you're editing" : "your new risk assessment",
    active: (view === "new" || view === "edit") && !!form, value: form, onRestore: v => setForm(v) });
  // the form's own ← Back / Cancel buttons ask first too
  async function leaveForm() {
    if (raGuard.dirty && !(await confirmLeave())) return;
    raGuard.done(); setView("list"); setForm(null); setSaved(false);
  }

  // Toggle a hazard's "further control complete" flag directly from the tracker,
  // without entering the edit flow. Writes back through the same setRas+dbSaveRA
  // path used everywhere else.
  function toggleTrackerAction(raId, hazardId) {
    setRas(prev => {
      const next = prev.map(ra => {
        if (ra.id !== raId) return ra;
        const updatedRa = {
          ...ra,
          hazards: ra.hazards.map(h => h.id===hazardId ? {...h, actionComplete: !h.actionComplete} : h)
        };
        if (dbSaveRA) dbSaveRA(updatedRa);
        return updatedRa;
      });
      return next;
    });
  }

  // Tracker status for one hazard's further-control action.
  function trackerStatusOf(h) {
    if (h.actionComplete) return "complete";
    if (h.targetDate && h.targetDate < todayISO()) return "overdue";
    return "pending";
  }

  function addHazard() {
    setForm(p=>({...p, hazards:[...p.hazards, EMPTY_HAZARD()]}));
  }

  function updateHazard(idx, key, val) {
    setForm(p=>{ const h=[...p.hazards]; h[idx]={...h[idx],[key]:val}; return {...p,hazards:h}; });
  }

  function removeHazard(idx) {
    setForm(p=>({ ...p, hazards: p.hazards.filter((_,i)=>i!==idx) }));
  }

  // "Publish": generate the RA HTML, add/replace its entry in the Documents library
  // (matched by raId), update ras state and save the RA.
  // The generated document lives in `docs` STATE only (not the documents table).
  // App.jsx regenerates a document for every RA in `ras` after each load, using the
  // same stable id "d_<raId>", so the library entry survives a reload.
  function finalise() {
    const html = generateRAHtml(form);
    const blob = new Blob([html], {type:"text/html"});
    const reader = new FileReader();
    reader.onload = ev => {
      const docEntry = {
        id: "d_"+form.id,
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
      raGuard.saved();
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

  // ── List view: search + filter ──
  const highCount = ra => (ra.hazards||[]).filter(h=>{
    if (!h.residualRisk||!h.residualRisk.likelihood||!h.residualRisk.severity) return false;
    const lbl = riskLevel(h.residualRisk.likelihood,h.residualRisk.severity).label;
    return lbl==="Very High"||lbl==="High";
  }).length;
  const reviewDays = ra => ra.reviewDate ? Math.ceil((new Date(ra.reviewDate)-new Date())/86400000) : null;
  const raQ = String(raSearch||"").trim().toLowerCase();
  const shownRas = (ras||[]).filter(ra => {
    if (raQ && ![ra.title, ra.location, ra.activity, ra.reference, ra.assessor].some(v=>String(v||"").toLowerCase().includes(raQ))) return false;
    const d = reviewDays(ra);
    if (raShow==="overdue") return d!==null && d<0;
    if (raShow==="soon") return d!==null && d>=0 && d<=30;
    if (raShow==="high") return highCount(ra)>0;
    if (raShow==="actions") return (ra.hazards||[]).some(h=>!h.actionComplete);
    return true;
  });

  // ── List view ──────────────────────────────────────────────────────────────
  if (view==="list") return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Risk Assessment Builder <HelpTip dark={false} text="Create and manage risk assessments for activities and work areas. Hazards are scored by likelihood and severity to produce initial and residual risk ratings. Completed assessments are added to the Documents tab automatically."/></h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>Create 5×5 risk assessments — completed RAs are published to the Documents tab for staff</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setView("tracker")}
            style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 22px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,color:Z.white}}>
            📋 Further Controls Tracker
          </button>
          <button onClick={newRA}
            style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:`0 4px 16px ${Z.accent}44`}}>
            + New Risk Assessment
          </button>
        </div>
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
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}} data-testid="ra-filters">
            <input aria-label="Search risk assessments" value={raSearch} onChange={e=>setRaSearch(e.target.value)} placeholder="🔍 Search title, location, activity, reference…"
              style={{flex:1,minWidth:220,background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 14px",color:Z.white,fontSize:13,outline:"none",fontFamily:font}}/>
            <select aria-label="Show" value={raShow} onChange={e=>setRaShow(e.target.value)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 12px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"}}>
              <option value="all">All risk assessments</option>
              <option value="overdue">Review overdue</option>
              <option value="soon">Review due in 30 days</option>
              <option value="high">High residual risk</option>
              <option value="actions">Actions still open</option>
            </select>
            <span style={{fontSize:12,color:Z.muted,whiteSpace:"nowrap"}}>{shownRas.length} of {ras.length}</span>
            {(raQ||raShow!=="all") && <button type="button" onClick={()=>{setRaSearch("");setRaShow("all");}} style={{background:"none",border:"none",color:Z.accentLt,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>Clear filters</button>}
          </div>
          {shownRas.length===0 && <div style={{textAlign:"center",padding:30,color:Z.muted,fontSize:13}}>No risk assessments match.</div>}
          {shownRas.map(ra=>{
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
                  <button onClick={async()=>{
                    const v = await ask({ title: "Next review date", message: `When should "${ra.title}" next be reviewed?`, ok: "Save date",
                      fields: [{ id: "date", label: "Review date", type: "date", required: true, value: ra.reviewDate || localISO(new Date(new Date().setFullYear(new Date().getFullYear()+1))) }] });
                    if (!v) return;
                    const updated = {...ra, reviewDate:v.date};
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

  // ── Further Controls Tracker ────────────────────────────────────────────────
  if (view==="tracker") {
    const rows = ras.flatMap(ra =>
      ra.hazards
        .filter(h=>h.furtherControls && h.furtherControls.trim())
        .map(h=>({ ra, h, status: trackerStatusOf(h) }))
    ).sort((a,b)=>(a.h.targetDate||"9999").localeCompare(b.h.targetDate||"9999"));

    const owners = [...new Set(rows.map(r=>r.h.responsiblePerson).filter(Boolean))].sort();
    const counts = { overdue:0, pending:0, complete:0 };
    rows.forEach(r=>counts[r.status]++);

    const filtered = rows.filter(r=>
      (trackerStatus==="all"||r.status===trackerStatus) &&
      (trackerOwner==="all"||r.h.responsiblePerson===trackerOwner)
    );

    const pillStyle = (active,color) => ({
      fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:9,cursor:"pointer",fontFamily:font,
      border:`1px solid ${active?color:Z.borderMd}`,
      background:active?`${color}22`:Z.overlay,
      color:active?color:Z.muted,
    });

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,flexWrap:"wrap"}}>
          <button onClick={()=>setView("list")}
            style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12}}>← Back</button>
          <h2 style={{margin:0,fontSize:20,fontWeight:900,letterSpacing:-.5,flex:1}}>Further Controls Tracker <HelpTip dark={false} text="All 'further controls required' identified across every risk assessment, in one place, so they can be monitored through to completion."/></h2>
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
          <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"10px 16px",textAlign:"center",minWidth:90}}>
            <div style={{fontSize:20,fontWeight:900,color:"#f87171"}}>{counts.overdue}</div>
            <div style={{fontSize:11,color:Z.muted}}>Overdue</div>
          </div>
          <div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:"10px 16px",textAlign:"center",minWidth:90}}>
            <div style={{fontSize:20,fontWeight:900,color:"#f59e0b"}}>{counts.pending}</div>
            <div style={{fontSize:11,color:Z.muted}}>Pending</div>
          </div>
          <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,padding:"10px 16px",textAlign:"center",minWidth:90}}>
            <div style={{fontSize:20,fontWeight:900,color:"#10b981"}}>{counts.complete}</div>
            <div style={{fontSize:11,color:Z.muted}}>Complete</div>
          </div>
        </div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18,alignItems:"center"}}>
          <span style={{...labelStyle,marginBottom:0}}>STATUS</span>
          {[["all","All",Z.accentLt],["overdue","Overdue","#f87171"],["pending","Pending","#f59e0b"],["complete","Complete","#10b981"]].map(([k,lbl,color])=>(
            <button key={k} onClick={()=>setTrackerStatus(k)} style={pillStyle(trackerStatus===k,color)}>{lbl}</button>
          ))}
          {owners.length>0 && (
            <>
              <span style={{...labelStyle,marginBottom:0,marginLeft:12}}>OWNER</span>
              <select value={trackerOwner} onChange={e=>setTrackerOwner(e.target.value)} style={{...selStyle,width:"auto",padding:"7px 12px"}}>
                <option value="all">All</option>
                {owners.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </>
          )}
        </div>

        {filtered.length===0 ? (
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:48,textAlign:"center",border:`1px solid ${Z.border}`}}>
            <div style={{fontSize:40,marginBottom:10}}>✅</div>
            <p style={{color:Z.white,fontWeight:700,margin:0}}>Nothing to show for this filter</p>
            <p style={{color:Z.muted,fontSize:12,margin:"6px 0 0"}}>{rows.length===0?"No further controls have been identified across any risk assessment yet.":"Try a different status or owner filter."}</p>
          </div>
        ) : (
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,border:`1px solid ${Z.border}`,overflow:"hidden"}}>
            {filtered.map(({ra,h,status},i)=>{
              const sc = { overdue:{color:"#f87171",bg:"rgba(239,68,68,0.12)",lbl:"⚠ Overdue"}, pending:{color:"#f59e0b",bg:"rgba(245,158,11,0.12)",lbl:"⏳ Pending"}, complete:{color:"#10b981",bg:"rgba(16,185,129,0.12)",lbl:"✓ Complete"} }[status];
              return (
                <div key={ra.id+h.id} style={{padding:"16px 20px",borderTop:i>0?`1px solid ${Z.border}`:"none",display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
                  <span style={{fontSize:11,background:sc.bg,color:sc.color,padding:"4px 10px",borderRadius:6,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,marginTop:2}}>{sc.lbl}</span>
                  <div style={{flex:1,minWidth:240}}>
                    <div style={{fontSize:11,color:Z.muted,marginBottom:3}}>{ra.title}{ra.reference?` · ${ra.reference}`:""}</div>
                    <div style={{fontSize:13,fontWeight:600,color:Z.white,marginBottom:4}}>{h.hazard}</div>
                    <div style={{fontSize:12,color:Z.muted,lineHeight:1.5}}>{h.furtherControls}</div>
                    <div style={{display:"flex",gap:10,marginTop:8,flexWrap:"wrap",fontSize:11,color:Z.muted}}>
                      {h.responsiblePerson && <span>👤 {h.responsiblePerson}</span>}
                      {h.targetDate && <span>📅 Target: {h.targetDate}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,flexShrink:0}}>
                    <button onClick={()=>editRA(ra)}
                      style={{background:"rgba(37,99,235,0.15)",color:Z.accentLt,border:`1px solid ${Z.accent}44`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                      ✏ Open RA
                    </button>
                    <button onClick={()=>toggleTrackerAction(ra.id,h.id)}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`2px solid ${h.actionComplete?"rgba(16,185,129,0.5)":Z.borderMd}`,background:h.actionComplete?"rgba(16,185,129,0.1)":Z.overlay,color:h.actionComplete?"#10b981":Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>
                      {h.actionComplete?"✓ Complete":"○ Mark Complete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

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
        <button onClick={leaveForm}
          style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12}}>← Back</button>
        <h2 style={{margin:0,fontSize:20,fontWeight:900,letterSpacing:-.5}}>{view==="edit"?"Edit":"New"} Risk Assessment</h2>
      </div>
      <DraftBanner guard={raGuard} Z={Z} font={font} what="this risk assessment"/>
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
        <button onClick={leaveForm}
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
        <button onClick={leaveForm}
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
            <button onClick={leaveForm}
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