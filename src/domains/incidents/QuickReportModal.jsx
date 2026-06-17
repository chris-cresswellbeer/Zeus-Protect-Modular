import React from "react";
import { E } from "../../lib/emoji";
import { QUICK_LOCATIONS } from "../../data/seedQuickReport";

function QuickReportModal({ user, onSubmit, onClose, Z, font }) {
  const [what, setWhat] = React.useState("");
  const [where, setWhere] = React.useState("");
  const [whereOther, setWhereOther] = React.useState("");
  const [urgency, setUrgency] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const URGENCY_OPTIONS = [
    { id:"low",    label:"Safe to leave",         desc:"Not an immediate risk — log for awareness", icon:"🟡", color:"#f59e0b", bg:"rgba(245,158,11,0.1)", border:"rgba(245,158,11,0.3)" },
    { id:"medium", label:"Needs attention",        desc:"Should be fixed today",                     icon:"🟠", color:"#f97316", bg:"rgba(249,115,22,0.1)", border:"rgba(249,115,22,0.3)" },
    { id:"high",   label:"STOP WORK — Urgent",     desc:"Immediate risk — escalate now",             icon:"🔴", color:"#ef4444", bg:"rgba(239,68,68,0.12)", border:"rgba(239,68,68,0.4)" },
  ];

  function submit() {
    if (!what.trim() || !where || !urgency) return;
    const location = where === "Other" ? (whereOther.trim()||"Other") : where;
    const urgencyOpt = URGENCY_OPTIONS.find(o=>o.id===urgency);
    const rec = {
      id: "qr_" + Date.now(),
      date: new Date().toISOString().slice(0,10),
      time: new Date().toTimeString().slice(0,5),
      type: urgency==="high" ? "unsafe_condition" : "near_miss",
      location,
      description: what.trim(),
      reportedBy: user.id,
      injuryType: "None / No injury",
      riddor: false,
      closed: false,
      quickReport: true,
      urgency: urgency,
      photos: [],
    };
    onSubmit(rec);
    setSubmitted(true);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:20,padding:28,maxWidth:480,width:"100%",border:"1px solid rgba(245,158,11,0.3)",boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>
        {submitted ? (
          <div style={{textAlign:"center",padding:"12px 0"}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <h3 style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:8}}>Hazard Reported</h3>
            <p style={{color:Z.muted,fontSize:13,marginBottom:24}}>Your report has been logged and your H&S manager has been notified. Thank you for keeping the site safe.</p>
            <button onClick={onClose} style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"11px 32px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:14}}>Done</button>
          </div>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <h3 style={{margin:0,fontSize:18,fontWeight:900,color:"#fff"}}>{E("⚠ ","")}Report a Hazard</h3>
                <p style={{margin:"3px 0 0",fontSize:12,color:Z.muted}}>Quick report — takes 30 seconds</p>
              </div>
              <button onClick={onClose} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"6px 12px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>✕</button>
            </div>

            {/* What did you see */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:6}}>What did you see? *</label>
              <textarea value={what} onChange={e=>setWhat(e.target.value)} rows={3}
                placeholder="Describe the hazard or unsafe condition briefly..."
                style={{width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none",fontFamily:font,resize:"none",boxSizing:"border-box",lineHeight:1.5}}/>
            </div>

            {/* Where */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:6}}>Where was it? *</label>
              <select value={where} onChange={e=>{setWhere(e.target.value);setWhereOther("");}}
                style={{width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 14px",color:where?"#fff":Z.muted,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer",boxSizing:"border-box"}}>
                <option value="">Select location...</option>
                {QUICK_LOCATIONS.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
              {where==="Other" && (
                <input value={whereOther} onChange={e=>setWhereOther(e.target.value)} placeholder="Describe the location..."
                  style={{width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box",marginTop:8}}/>
              )}
            </div>

            {/* Urgency */}
            <div style={{marginBottom:24}}>
              <label style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:8}}>How urgent is it? *</label>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {URGENCY_OPTIONS.map(opt=>(
                  <button key={opt.id} onClick={()=>setUrgency(opt.id)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,border:`2px solid ${urgency===opt.id?opt.border:"rgba(255,255,255,0.08)"}`,background:urgency===opt.id?opt.bg:Z.overlay,cursor:"pointer",fontFamily:font,textAlign:"left",transition:"all .15s"}}>
                    <span style={{fontSize:20,flexShrink:0}}>{opt.icon}</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:urgency===opt.id?opt.color:"#fff"}}>{opt.label}</div>
                      <div style={{fontSize:11,color:Z.muted,marginTop:1}}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={submit} disabled={!what.trim()||!where||!urgency}
              style={{width:"100%",background:(!what.trim()||!where||!urgency)?"rgba(37,99,235,0.3)":`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"13px",fontWeight:800,cursor:(!what.trim()||!where||!urgency)?"not-allowed":"pointer",fontFamily:font,fontSize:14,opacity:(!what.trim()||!where||!urgency)?.5:1,boxShadow:(!what.trim()||!where||!urgency)?"none":`0 4px 16px ${Z.accent}44`}}>
              Submit Hazard Report →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export { QuickReportModal };
