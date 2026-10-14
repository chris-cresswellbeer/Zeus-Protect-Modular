import { scoreAnswers, inspectionPct, scoreBand } from "./inspectionScore";
import { useState, useEffect } from "react";
import { ask } from "../../shared/Feedback";
import { useFormGuard, DraftBanner, confirmLeave } from "../../lib/unsaved";
import { useWindowWidth } from "../../shared/hooks";
import { HelpTip } from "../../shared/HelpTip";
import { E } from "../../lib/emoji";
import { ACCEPT_IMAGES } from "../../lib/constants";
import { compressToDataUrl, uploadPhotos, PHOTO_BUCKET } from "../../lib/photos";
import { useInspTemplates, inspTypes, inspType, inspSections } from "../../lib/inspTemplates";
import { ChecklistManager } from "./ChecklistManager";
import { embedFiles } from "../../lib/fileAccess";
import { useRemembered } from "../../lib/remembered";
import { latestByKey, supersededBy, overdueInspections } from "./inspectionDue";

import { todayISO, addMonths, localISO, ukDate } from "../../lib/dates";
import { brandHtml } from "../../lib/brandCore";
/**
 * SiteInspectionsTab — admin workplace inspections (checklists + non-conformances).
 *
 * Views: "list" (filter by type/status), "new" (multi-section checklist wizard, last
 * section = Non-Conformances), "detail" (read/edit, manage NC actions), "report" (printable).
 * Checklists: the built-in ones (data/seedInspections.js) and this site's own, e.g. the
 * BRCGS internal audits (inspection_templates table) — both through lib/inspTemplates.js.
 * A site's own checklist can have clause numbers (ref), an introduction per section
 * (e.g. Statement of Intent), and can be saved part-done (allowSkip).
 *
 * RECORD SHAPE (site_inspections table, one JSON `data` per inspection):
 *   { id, type, date, inspector, location, summary,
 *     sections: { [sectionId]: { [questionId]: 2|1|0|"na" } },   // 2 Compliant, 1 Partial, 0 Non-compliant, "na" not applicable
 *     comments: { [sectionId]: { [questionId]: "evidence / comment" } },
 *     typeLabel: the checklist's name when saved (so it can be named without the templates),
 *     nonConformances: [ { id:"nc_<ts>", section, sectionId, questionId?, finding,
 *                          severity: major|minor|observation, photos:[dataURL|url],
 *                          actionOwner, actionDue, actionStatus: open|closed, actionNote } ],
 *     status: open|closed (open while any NC action is open), overallScore, maxScore }
 * Inspections created on the mobile app arrive through App.jsx mobileDb.saveInspection.
 *
 * SAVING: setInspections → App.jsx [siteInspections] auto-sync → dbSaveSiteInspections
 * (upsert-and-prune — so removing an inspection from this array deletes it in the DB).
 *
 * INLINE NC FLAGGING: answering Partial/Non-compliant on a checklist question offers
 * "Flag as NC", which jumps to the NC section with the finding pre-filled and then
 * returns to the originating section on save/cancel (ncReturnSection).
 */
function SiteInspectionsTab({ inspections, setInspections, staff, userName = "", preset, clearPreset, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [view, setView] = useState("list"); // "list"|"new"|"detail"|"report"
  const [activeId, setActiveId] = useState(null);
  // opened from elsewhere with one inspection to show (e.g. Fire Safety → Drill Log → Checklist)
  useEffect(() => {
    if (!preset || !preset.openId) return;
    if (inspections.some(i => i.id === preset.openId)) { setActiveId(preset.openId); setView("detail"); window.scrollTo({ top: 0 }); }
    clearPreset && clearPreset();
  }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps
  useInspTemplates();   // this site's own checklists (re-renders when they arrive)
  const [filterType, setFilterType] = useRemembered("inspections.type", "all");
  const [filterStatus, setFilterStatus] = useRemembered("inspections.status", "all");
  const [photoError, setPhotoError] = useState("");

  // New inspection form state
  const BLANK_FORM = { type:"annual_hs", date:todayISO(), inspector:userName, location:"", summary:"", sections:{}, comments:{}, nonConformances:[] };
  const [form, setForm] = useState(BLANK_FORM);
  const [formSection, setFormSection] = useState(0);
  const [ncForm, setNcForm] = useState(null); // { section, finding, severity, photos, actionOwner, actionDue }
  const [editNcIdx, setEditNcIdx] = useState(null);
  const [ncReturnSection, setNcReturnSection] = useState(null); // section index to jump back to after saving/cancelling an NC flagged from a checklist question
  const [editingInspId, setEditingInspId] = useState(null);
  const [continueId, setContinueId] = useState(null);   // a saved inspection reopened to carry on / correct its answers
  const [editInspForm, setEditInspForm] = useState(null);
  // unsaved-changes warning + draft on this device for a new inspection (lib/unsaved.jsx)
  const inspGuard = useFormGuard({ key: continueId ? `inspection.edit.${continueId}` : "inspection.new", label: continueId ? "your changes to this inspection" : "your new inspection", active: view === "new", value: form, onRestore: v => setForm(v) });

  const today = (()=>{ const t=new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`; })();   // local date
  const selInsp = inspections.find(i=>i.id===activeId);
  const typeInfo = (id, rec) => inspType(id, rec);
  // scoring and bands: inspectionScore.js (the same rules as the phone, Fire Safety and reports)
  const scoreColor = pct => scoreBand(pct).color;
  const scoreLabel = pct => scoreBand(pct).label;
  // one answer as words / colour (checklist view and report)
  const ANS = { 2:["Compliant","#10b981","#047857"], 1:["Partial","#f59e0b","#b45309"], 0:["Non-compliant","#f87171","#b91c1c"], na:["N/A","#94a3b8","#64748b"], pass:["Compliant","#10b981","#047857"], partial:["Partial","#f59e0b","#b45309"], fail:["Non-compliant","#f87171","#b91c1c"], issue:["Non-compliant","#f87171","#b91c1c"] };
  const ansOf = (ins, sid, qid) => ((ins.sections||{})[sid]||{})[qid];
  const commentOf = (ins, sid, qid) => (((ins.comments||{})[sid]||{})[qid]||"").trim();
  const esc = v => String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  // Score calculation
  // Score = points earned / points possible (2 per question). Unanswered questions still
  // count toward `possible`, so an incomplete checklist lowers the score.
  // Questions not answered are left out of the score and the maximum (inspectionScore.js).
  function calcScore(type, sections) {
    return scoreAnswers(inspSections(type), sections);
  }

  // Flat answer helper
  function setAnswer(secId, qId, val) {
    setForm(p=>({ ...p, sections:{ ...p.sections, [secId]:{ ...(p.sections[secId]||{}), [qId]:val } } }));
  }
  // Comment / evidence for one question (e.g. what the auditor saw or which record was checked)
  function setComment(secId, qId, text) {
    setForm(p=>({ ...p, comments:{ ...(p.comments||{}), [secId]:{ ...((p.comments||{})[secId]||{}), [qId]:text } } }));
  }
  const [openComments, setOpenComments] = useState({});   // "secId/qId" → comment box shown
  // Evidence photos for one question: made smaller, then uploaded straight away (the record
  // keeps links, not the pictures themselves). If the upload fails the picture stays in the
  // record and is uploaded again on the next try.
  const [qPhotoBusy, setQPhotoBusy] = useState("");
  async function addQuestionPhotos(secId, qId, files) {
    const key = `${secId}/${qId}`; setQPhotoBusy(key); setPhotoError("");
    try {
      const urls = (await Promise.all(Array.from(files||[]).map(f=>compressToDataUrl(f)))).filter(Boolean);
      const up = await uploadPhotos(PHOTO_BUCKET, `inspq_${form.id||form.draftId||Date.now()}_${secId}_${qId}`, urls);
      setForm(p=>({ ...p, photos:{ ...(p.photos||{}), [secId]:{ ...((p.photos||{})[secId]||{}), [qId]:[...(((p.photos||{})[secId]||{})[qId]||[]), ...up] } } }));
    } catch (e) { setPhotoError(`The photo couldn't be added. ${e.message||e}`); }
    setQPhotoBusy("");
  }
  const removeQuestionPhoto = (secId, qId, i) => setForm(p=>({ ...p, photos:{ ...(p.photos||{}), [secId]:{ ...((p.photos||{})[secId]||{}), [qId]:(((p.photos||{})[secId]||{})[qId]||[]).filter((_,x)=>x!==i) } } }));
  const photoSrc = ph => typeof ph==="string" ? ph : (ph && (ph.data||ph.url)) || "";
  // Continue / correct a saved inspection: the checklist opens with its answers
  function continueInspection(ins) {
    const secs = inspSections(ins.type);
    const firstOpen = Math.max(0, secs.findIndex(sc=>sc.questions.some(q=>((ins.sections||{})[sc.id]||{})[q.id]===undefined)));
    setForm({ type:ins.type, date:ins.date, inspector:ins.inspector||"", location:ins.location||"", summary:ins.summary||"", sections:JSON.parse(JSON.stringify(ins.sections||{})),
      comments:JSON.parse(JSON.stringify(ins.comments||{})), photos:JSON.parse(JSON.stringify(ins.photos||{})), nonConformances:(ins.nonConformances||[]).map(n=>({...n})), nextDue:ins.nextDue||"", id:ins.id });
    setContinueId(ins.id); setFormSection(secs.length ? firstOpen : 0); setNcForm(null); setEditNcIdx(null); setNcReturnSection(null); setView("new"); window.scrollTo({top:0});
  }

  // NC photos are read as base64 data URLs (max 5 MB each). ncIdx given → add to an existing
  // NC on the active inspection; otherwise add to the NC currently being drafted.
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

  // Add or update the drafted NC in the new-inspection form, then return to the checklist
  // section it was flagged from (if any).
  function saveNC() {
    if (!ncForm?.finding?.trim()) return;
    const nc = { id:ncForm.id||`nc_${Date.now()}`, ...ncForm, actionStatus:ncForm.actionStatus||"open", actionNote:ncForm.actionNote||"" };
    setForm(p=>({
      ...p,
      nonConformances: editNcIdx!==null ? p.nonConformances.map((n,i)=>i===editNcIdx?nc:n) : [...p.nonConformances, nc]
    }));
    setNcForm(null); setEditNcIdx(null);
    if (ncReturnSection!==null) { setFormSection(ncReturnSection); setNcReturnSection(null); }
  }

  function submitInspection() {
    const { earned, possible } = calcScore(form.type, form.sections);
    const t = typeInfo(form.type);
    // drop empty comments; a site checklist with a frequency gets its next due date
    const comments = Object.fromEntries(Object.entries(form.comments||{}).map(([k,v])=>[k,Object.fromEntries(Object.entries(v||{}).filter(([,x])=>String(x||"").trim()))]).filter(([,v])=>Object.keys(v).length));
    const nextDue = form.nextDue || (t.freqMonths && form.date ? localISO(addMonths(form.date, t.freqMonths)) : undefined);
    const newInsp = {
      id: `si${Date.now()}`,
      ...form,
      comments,
      typeLabel: t.label,
      ...(nextDue ? { nextDue } : {}),
      status: form.nonConformances.some(n=>n.actionStatus==="open") ? "open" : "closed",
      overallScore: earned,
      maxScore: possible,
    };
    if (continueId) {
      // carrying on with / correcting a saved inspection: same record, same id
      const { id: _drop, draftId: _d, ...rest } = newInsp;
      setInspections(p=>p.map(x=>x.id===continueId ? { ...x, ...rest, id:continueId, editedAt:new Date().toISOString(), editedBy:userName||"" } : x));
      inspGuard.done(); setActiveId(continueId); setContinueId(null);
      setForm(BLANK_FORM); setView("detail"); window.scrollTo({top:0});
      return;
    }
    const { draftId: _d2, ...clean } = newInsp;
    setInspections(p=>[clean,...p]);
    inspGuard.done();
    setView("detail"); setActiveId(clean.id);
  }

  // Photos may be {name,data} objects (added here) or URL strings (added on a phone and
  // uploaded to storage) — the <img> tags below accept both.
  // Printable inspection report (score, answers per section, NC table with photos).
  async function generateReport(ins) {
    const ti = typeInfo(ins.type, ins);
    const pct = inspectionPct(ins) ?? 0;
    const openNCs = ins.nonConformances.filter(n=>n.actionStatus!=="complete");
    const closedNCs = ins.nonConformances.filter(n=>n.actionStatus==="complete");
    // Build printable HTML
    const html = `<!DOCTYPE html><html><head><title>Inspection Report — ${ukDate(ins.date)}</title>
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
    <p class="subtitle">${esc(ins.location)} &nbsp;·&nbsp; Inspected: ${ukDate(ins.date)} &nbsp;·&nbsp; Inspector: ${esc(ins.inspector)}</p>
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
        ${nc.actionOwner?`<div class="nc-row">Owner: ${nc.actionOwner} · Due: ${nc.actionDue?ukDate(nc.actionDue):"TBD"}</div>`:""}
        ${nc.actionNote?`<div class="nc-row">Resolution: ${nc.actionNote}</div>`:""}
        ${nc.photos&&nc.photos.length>0?`<div class="photo-grid">${nc.photos.map((p,j)=>typeof p==="string"?`<img src="${p}" alt="Photo ${j+1}"/>`:`<img src="${p.data||p.url}" alt="${p.name||""}"/>`).join("")}</div>`:""}
      </div>`).join("")}
    `:"<p style='color:#94a3b8'>No non-conformances recorded for this inspection.</p>"}
    ${(()=>{ const secs = inspSections(ins.type); if(!secs.length) return "";
      return `<h2>Checklist results</h2>${secs.map(sc=>`<h3 style="font-size:13.5px;margin:18px 0 6px;color:#0d1f5c">${esc(sc.label)}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="text-align:left;padding:5px 8px;width:62px">Ref</th><th style="text-align:left;padding:5px 8px">Requirement</th><th style="text-align:left;padding:5px 8px;width:96px">Result</th><th style="text-align:left;padding:5px 8px;width:30%">Comments</th></tr>
      ${sc.questions.map(q=>{ const a=ansOf(ins,sc.id,q.id); const L=ANS[a]; return `<tr style="border-top:1px solid #e2e8f0;vertical-align:top"><td style="padding:5px 8px;font-weight:700">${esc(q.ref||"")}${q.tag?`<br><span style="font-weight:400;color:#64748b">${esc(q.tag)}</span>`:""}</td><td style="padding:5px 8px;white-space:pre-line">${esc(q.text)}</td><td style="padding:5px 8px;font-weight:700;color:${L?L[2]:"#94a3b8"}">${L?L[0]:"Not answered"}</td><td style="padding:5px 8px;white-space:pre-line">${esc(commentOf(ins,sc.id,q.id))}${((((ins.photos||{})[sc.id]||{})[q.id])||[]).map(ph=>`<br><img src="${esc(photoSrc(ph))}" style="width:110px;height:82px;object-fit:cover;border-radius:4px;margin-top:4px">`).join("")}</td></tr>`; }).join("")}</table>`).join("")}`; })()}
    <div class="footer">
      <span>${brandHtml().foot} — Site Inspection Report</span>
      <span>Generated: ${ukDate(today)}</span>
    </div>
    </body></html>`;
    // Photos are saved as storage links (strings). With the new sign-in those files are
    // private, so they're copied into the report file itself (lib/fileAccess.js).
    const blob = new Blob([await embedFiles(html)], {type:"text/html"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`inspection-report-${ins.date}.html`; a.click();
    URL.revokeObjectURL(url);
  }

  const inp = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 14px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const lbl = {color:Z.muted,fontSize:10,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:5,textTransform:"uppercase"};

  // ── DETAIL view ─────────────────────────────────────────────────────────────
  if (view==="detail" && selInsp) {
    const ti = typeInfo(selInsp.type, selInsp);
    const pct = inspectionPct(selInsp) ?? 0;
    const sc = scoreColor(pct);
    const openNCs = selInsp.nonConformances.filter(n=>n.actionStatus!=="complete");
    return (
      <div>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={()=>{setView("list");window.scrollTo({top:0,behavior:"smooth"});}} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>← All Inspections</button>
          <div style={{flex:1}}>
            <h2 style={{margin:0,fontSize:20,fontWeight:900,color:Z.white}}>{ti.icon} {ti.label}</h2>
            <p style={{margin:0,color:Z.muted,fontSize:13}}>📍 {selInsp.location} · {ukDate(selInsp.date)} · Inspector: {selInsp.inspector}</p>
          </div>
          {inspSections(selInsp.type).length>0 && (()=>{ const secs=inspSections(selInsp.type); const left=secs.reduce((n,sc)=>n+sc.questions.filter(q=>((selInsp.sections||{})[sc.id]||{})[q.id]===undefined).length,0); return (
            <button type="button" data-testid="insp-continue" onClick={()=>continueInspection(selInsp)}
              style={{background:left?`linear-gradient(135deg,${Z.accent},${Z.blue})`:Z.overlay,color:left?"#fff":Z.white,border:left?"none":`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
              {left?`▶ Continue (${left} not answered)`:"✏ Edit answers"}
            </button>); })()}
          <button onClick={()=>generateReport(selInsp)}
            style={{background:`linear-gradient(135deg,#6366f1,#4f46e5)`,color:"#fff",border:"none",borderRadius:10,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:"0 4px 14px rgba(99,102,241,0.35)"}}>
            📄 Download Action Report
          </button>
          <button type="button" onClick={async()=>{ if(await ask({ title: "Delete this inspection?", message: `${ti.label} at ${selInsp.location||"—"} on ${selInsp.date}, with its findings and photos. This can't be undone.`, ok: "Delete inspection", danger: true })){ setInspections(p=>p.filter(x=>x.id!==selInsp.id)); setView("list"); setActiveId(null); } }}
            style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"9px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
            🗑 Delete
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
          {selInsp.nextDue && (() => { const newer = supersededBy(selInsp, latestByKey(inspections)); return (
            <div style={{textAlign:"center",padding:"12px 20px",background:Z.overlay,borderRadius:12,border:`1px solid ${Z.border}`}}>
              <div style={{fontSize:11,color:Z.muted,marginBottom:2}}>{newer?"RE-INSPECTED":"NEXT DUE"}</div>
              <div style={{fontSize:15,fontWeight:800,color:!newer&&selInsp.nextDue<today?"#f87171":Z.white}}>{newer?newer.date:selInsp.nextDue}</div>
            </div>
          ); })()}
        </div>

        {(selInsp.type==="fire_drill"||selInsp.type==="fire_risk") && (
          <div role="note" style={{fontSize:12.5,color:Z.muted,margin:"-6px 0 16px"}}>
            {selInsp.type==="fire_drill"?"This drill also shows in Fire Safety → Drill Log and counts as the last drill.":"This assessment also shows in Fire Safety → FRA Reviews, and its next due date is used for the next FRA review."}
          </div>
        )}
        {/* Summary */}
        {selInsp.summary && (
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"14px 18px",marginBottom:20,border:`1px solid ${Z.border}`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:6,textTransform:"uppercase"}}>Inspector Summary</div>
            <p style={{margin:0,fontSize:13,color:Z.slate,lineHeight:1.7}}>{selInsp.summary}</p>
          </div>
        )}

        {/* Checklist answers, section by section (closed until clicked) */}
        {(()=>{ const secs = inspSections(selInsp.type); if(!secs.length) return null;
          const count = sc => { const c={2:0,1:0,0:0,na:0,none:0}; sc.questions.forEach(q=>{ const a=ansOf(selInsp,sc.id,q.id); const k=a===2||a==="pass"?2:a===1||a==="partial"?1:a===0||a==="fail"||a==="issue"?0:a==="na"?"na":"none"; c[k]++; }); return c; };
          return (
            <div data-testid="insp-checklist" style={{marginBottom:20}}>
              <h3 style={{margin:"0 0 10px",fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase"}}>Checklist ({secs.reduce((n,sc)=>n+sc.questions.length,0)} items)</h3>
              <div style={{display:"grid",gap:8}}>
                {secs.map(sc=>{ const c=count(sc); return (
                  <details key={sc.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:12,border:`1px solid ${c[0]?"rgba(239,68,68,0.35)":Z.border}`}}>
                    <summary style={{cursor:"pointer",padding:"11px 14px",fontSize:13,fontWeight:700,color:Z.white,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{flex:"1 1 260px"}}>{sc.label}</span>
                      <span style={{fontSize:11.5,fontWeight:600,color:Z.muted}}>
                        <span style={{color:"#10b981"}}>✓ {c[2]}</span>{c[1]?<span style={{color:"#f59e0b"}}> · ⚠ {c[1]}</span>:null}{c[0]?<span style={{color:"#f87171"}}> · ✗ {c[0]}</span>:null}{c.na?` · N/A ${c.na}`:""}{c.none?` · ${c.none} not answered`:""}
                      </span>
                    </summary>
                    <div style={{padding:"0 14px 12px",display:"grid",gap:6}}>
                      {sc.questions.map(q=>{ const a=ansOf(selInsp,sc.id,q.id); const L=ANS[a]; const cm=commentOf(selInsp,sc.id,q.id); return (
                        <div key={q.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:10,padding:"8px 10px",background:Z.overlay,borderRadius:8,fontSize:12.5,lineHeight:1.5}}>
                          <div style={{color:Z.white,whiteSpace:"pre-line"}}>{q.ref && <b style={{marginRight:6}}>{q.ref}{q.tag?` · ${q.tag}`:""}</b>}{q.text}
                            {cm && <div style={{marginTop:4,color:Z.muted,fontStyle:"italic"}}>💬 {cm}</div>}
                            {(((selInsp.photos||{})[sc.id]||{})[q.id]||[]).length>0 && <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{((selInsp.photos||{})[sc.id]||{})[q.id].map((ph,pi)=><img key={pi} src={photoSrc(ph)} alt={`Evidence photo ${pi+1} for ${q.ref||"this question"}`} style={{width:72,height:72,objectFit:"cover",borderRadius:6,border:`1px solid ${Z.border}`}}/>)}</div>}</div>
                          <span style={{fontWeight:800,color:L?L[1]:Z.muted,whiteSpace:"nowrap"}}>{L?L[0]:"—"}</span>
                        </div>
                      ); })}
                    </div>
                  </details>
                ); })}
              </div>
            </div>
          ); })()}

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
                            {nc.actionDue && <span style={{color:nc.actionStatus!=="complete"&&nc.actionDue<today?"#f87171":Z.muted}}>📅 Due: {ukDate(nc.actionDue)}{nc.actionStatus!=="complete"&&nc.actionDue<today?" 🚨":""}</span>}
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
                              <img src={typeof ph==="string"?ph:(ph.data||ph.url)} alt={typeof ph==="string"?`Photo ${pi+1}`:ph.name} style={{width:"100%",height:80,objectFit:"cover",display:"block"}}/>
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
    const sections = inspSections(form.type);
    const answeredIn = s2 => s2.questions.filter(q=>(form.sections[s2.id]||{})[q.id]!==undefined).length;
    const totalQ = sections.reduce((n,s2)=>n+s2.questions.length,0);
    const totalA = sections.reduce((n,s2)=>n+answeredIn(s2),0);
    const longList = sections.length > 8;   // e.g. a BRCGS audit: pick the section from a list
    const sec = sections[formSection];
    const isLastSec = formSection===sections.length-1;
    const { earned, possible } = calcScore(form.type, form.sections);
    const allAnswered = sec?.questions.every(q=>(form.sections[sec.id]||{})[q.id]!==undefined);
    const BLANK_NC = { section:"", sectionId:"", questionId:"", finding:"", severity:"major", photos:[], actionOwner:"", actionDue:"" };
    // Jump to the Non-Conformances tab with a finding pre-filled from a specific checklist question
    // Severity defaults: Non-compliant → major, Partial → minor.
    const flagQuestion = (secForQ, q, ans) => {
      setNcForm({ ...BLANK_NC, photos:[...((((form.photos||{})[secForQ.id]||{})[q.id])||[])], section:secForQ.label, sectionId:secForQ.id, questionId:q.id, severity:ans===0?"major":"minor", finding:q.ref?`${q.ref}${q.tag?` (${q.tag})`:""} – ${q.text}`:q.text });
      setEditNcIdx(null);
      setNcReturnSection(formSection);
      setFormSection(sections.length);
    };
    const editLinkedNc = (idx) => {
      setNcForm({...form.nonConformances[idx]});
      setEditNcIdx(idx);
      setNcReturnSection(formSection);
      setFormSection(sections.length);
    };

    return (
      <div>
        <DraftBanner guard={inspGuard} Z={Z} font={font} what="a new inspection"/>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={async()=>{if(inspGuard.dirty && !(await confirmLeave())) return; inspGuard.done(); const back=continueId; setContinueId(null); if(back){ setActiveId(back); setView("detail"); } else setView("list");setForm(BLANK_FORM);setFormSection(0);setNcForm(null);setEditNcIdx(null);setNcReturnSection(null);}} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>← Cancel</button>
          <div style={{flex:1}}>
            <h2 style={{margin:0,fontSize:20,fontWeight:900,color:Z.white}}>{continueId?"":"New "}{ti.label}{continueId?" — continue / edit":""}</h2>
            <p style={{margin:0,color:Z.muted,fontSize:13}}>{continueId?"Carry on where you left off, or correct an answer. Save to update the record.":ti.allowSkip?"Answer what you can; you can save it part-done and carry on later":"Complete all checklist sections then log any non-conformances"}</p>
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
              <select disabled={!!continueId} title={continueId?"The type can't be changed once answers are saved":undefined} value={form.type} onChange={e=>{setForm(p=>({...BLANK_FORM,draftId:p.draftId,type:e.target.value,date:p.date,inspector:p.inspector,location:p.location}));setFormSection(0);setNcForm(null);setEditNcIdx(null);setNcReturnSection(null);}} style={{...inp,cursor:"pointer"}}>
                {(()=>{ const all = inspTypes(); const built = all.filter(t=>!t.custom); const groups = {};
                  all.filter(t=>t.custom).forEach(t=>{ (groups[t.group||"This site's checklists"] = groups[t.group||"This site's checklists"] || []).push(t); });
                  const opt = t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>;
                  return Object.keys(groups).length ? <>
                    <optgroup label="Site inspections">{built.map(opt)}</optgroup>
                    {Object.entries(groups).map(([g,list])=><optgroup key={g} label={g}>{list.map(opt)}</optgroup>)}
                  </> : built.map(opt); })()}
              </select>
            </div>
            <div>
              <label style={lbl}>Inspection Date *</label>
              <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp}/>
            </div>
            {ti.custom && (ti.description || ti.source) && (
              <div data-testid="insp-template-info" style={{gridColumn:"1 / -1",fontSize:12.5,color:Z.muted,lineHeight:1.5,marginTop:-4}}>
                {ti.description && <div style={{color:Z.white,fontWeight:600}}>{ti.description}</div>}
                {ti.source && <div>{ti.source}</div>}
                <div>{sections.length} sections · {totalQ} requirements{ti.freqMonths?` · next due ${ti.freqMonths} months after the date above`:""}. You can save it part-done: anything not answered is left out of the score.</div>
              </div>
            )}
            <div>
              <label style={lbl}>Inspector Name *</label>
              <input value={form.inspector} onChange={e=>setForm(p=>({...p,inspector:e.target.value}))} placeholder="e.g. Linda Osei" list="insp-staff" aria-label="Inspector name" style={inp}/>
              <datalist id="insp-staff">{(staff||[]).filter(u=>u.status!=="leaver").map(u=><option key={u.id} value={u.name}/>)}</datalist>
            </div>
            <div>
              <label style={lbl}>Location / Area *</label>
              <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="e.g. Main site — Full Site" list="insp-places" aria-label="Location / Area" style={inp}/>
              {/* places used before for this type first: the same name each time keeps "overdue re-inspections" right */}
              <datalist id="insp-places">{[...new Set([...inspections.filter(i=>i.type===form.type).map(i=>i.location), ...inspections.map(i=>i.location)].filter(Boolean))].map(l=><option key={l} value={l}/>)}</datalist>
            </div>
          </div>
        </div>

        {/* Section tabs (a long checklist, e.g. a BRCGS audit: a list to pick from instead) */}
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          {longList && (
            <label style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 420px",minWidth:0}}>
              <span style={{...lbl,marginBottom:0,whiteSpace:"nowrap"}}>Section</span>
              <select data-testid="insp-section-pick" value={formSection<sections.length?String(formSection):""} onChange={e=>{ if(e.target.value!=="") setFormSection(Number(e.target.value)); }} style={{...inp,cursor:"pointer",padding:"8px 12px"}}>
                {formSection>=sections.length && <option value="">Choose a section…</option>}
                {[...new Set(sections.map(s2=>s2.group||""))].map(g=>{
                  const opts = sections.map((s2,i)=>[s2,i]).filter(([s2])=>(s2.group||"")===g).map(([s2,i])=>{ const n=answeredIn(s2); return <option key={s2.id} value={i}>{n===s2.questions.length?"✓ ":n?"◐ ":""}{s2.label} ({n}/{s2.questions.length})</option>; });
                  return g ? <optgroup key={g} label={g}>{opts}</optgroup> : opts;
                })}
              </select>
            </label>
          )}
          {longList && <span data-testid="insp-progress" style={{fontSize:12,color:Z.muted,whiteSpace:"nowrap"}}>{totalA} of {totalQ} answered</span>}
          {!longList && sections.map((s,i)=>{
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
            {sec.group && <div style={{fontSize:11,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase",marginBottom:4}}>{sec.group}</div>}
            <h3 style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:Z.white}}>{sec.label}</h3>
            {sec.intro && (
              <div data-testid="insp-intro" style={{margin:"0 0 14px",padding:"10px 14px",borderRadius:10,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.3)",fontSize:12.5,lineHeight:1.55,color:Z.slate||Z.white,whiteSpace:"pre-line"}}>
                <div style={{fontSize:10.5,fontWeight:800,letterSpacing:.6,textTransform:"uppercase",color:"#c4b5fd",marginBottom:4}}>{ti.introLabel||"Introduction"}</div>
                {sec.intro}
              </div>
            )}
            <div style={{display:"grid",gap:10}}>
              {sec.questions.map(q=>{
                const ans = (form.sections[sec.id]||{})[q.id];
                const linkedNcIdx = form.nonConformances.findIndex(n=>n.sectionId===sec.id&&n.questionId===q.id);
                return (
                  <div key={q.id} style={{padding:"14px 16px",background:Z.overlay,borderRadius:12,border:`1px solid ${ans===0?"rgba(239,68,68,0.3)":ans===1?"rgba(245,158,11,0.3)":ans===2?"rgba(16,185,129,0.3)":Z.border}`}}>
                    <p style={{margin:"0 0 10px",fontSize:13,fontWeight:600,color:Z.white,lineHeight:1.5,whiteSpace:"pre-line"}}>
                      {q.ref && <span data-testid="insp-ref" style={{display:"inline-block",fontSize:11.5,fontWeight:800,color:Z.accentLt||"#93c5fd",background:`${Z.accent}22`,border:`1px solid ${Z.accent}55`,borderRadius:6,padding:"1px 7px",marginRight:8,verticalAlign:1,whiteSpace:"nowrap"}}>{q.ref}{q.tag?` · ${q.tag}`:""}</span>}
                      {q.text}
                    </p>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}} role="group" aria-label={`Answer ${q.ref||""}`.trim()}>
                      {[{v:2,label:"✓ Compliant",col:"#10b981",bg:"rgba(16,185,129,0.15)"},{v:1,label:"⚠ Partial",col:"#f59e0b",bg:"rgba(245,158,11,0.15)"},{v:0,label:"✗ Non-Compliant",col:"#f87171",bg:"rgba(239,68,68,0.15)"},{v:"na",label:"N/A",col:"#94a3b8",bg:"rgba(148,163,184,0.15)"}].map(opt=>(
                        <button key={opt.v} type="button" aria-pressed={ans===opt.v} onClick={()=>setAnswer(sec.id,q.id,opt.v)}
                          style={{padding:"7px 16px",borderRadius:9,border:`2px solid ${ans===opt.v?opt.col:Z.borderMd}`,background:ans===opt.v?opt.bg:Z.overlay,color:ans===opt.v?opt.col:Z.muted,fontWeight:ans===opt.v?700:400,cursor:"pointer",fontFamily:font,fontSize:12,transition:"all .2s"}}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {(()=>{ const key=`${sec.id}/${q.id}`; const val=((form.comments||{})[sec.id]||{})[q.id]||""; const show=ti.custom||openComments[key]||val;
                      return show ? (
                        <textarea data-testid="insp-comment" aria-label={`Comments ${q.ref||""}`.trim()} rows={ti.custom?2:2} value={val} onChange={e=>setComment(sec.id,q.id,e.target.value)}
                          placeholder={ti.custom?"Comments / evidence seen (e.g. record checked, who was spoken to)":"Comment"} style={{...inp,marginTop:10,resize:"vertical",lineHeight:1.5,fontSize:12.5}}/>
                      ) : (
                        <button type="button" onClick={()=>setOpenComments(p=>({...p,[key]:true}))} style={{marginTop:8,background:"none",border:"none",padding:0,color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:11.5,textDecoration:"underline"}}>💬 Add a comment</button>
                      ); })()}
                    {(()=>{ const key=`${sec.id}/${q.id}`; const phs=((form.photos||{})[sec.id]||{})[q.id]||[]; return (
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:8}}>
                        {phs.map((ph,pi)=>(
                          <div key={pi} style={{position:"relative",width:64,height:64,borderRadius:8,overflow:"hidden",border:`1px solid ${Z.border}`}}>
                            <img src={photoSrc(ph)} alt={`Evidence photo ${pi+1}`} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                            <button type="button" aria-label={`Remove evidence photo ${pi+1}`} onClick={()=>removeQuestionPhoto(sec.id,q.id,pi)} style={{position:"absolute",top:2,right:2,background:"rgba(239,68,68,0.85)",color:"#fff",border:"none",borderRadius:4,width:18,height:18,cursor:"pointer",fontSize:10,lineHeight:1}}>✕</button>
                          </div>
                        ))}
                        <label data-testid="insp-qphoto" style={{display:"inline-flex",alignItems:"center",gap:6,background:"none",border:`1px dashed ${Z.borderMd}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:font,fontSize:11.5,color:Z.muted,fontWeight:600,minHeight:34}}>
                          {qPhotoBusy===key?"Adding…":`📷 ${phs.length?"Add another photo":"Add photo"}`}
                          <input type="file" accept={ACCEPT_IMAGES} multiple disabled={!!qPhotoBusy} onChange={e=>{ const fl=e.target.files; addQuestionPhotos(sec.id,q.id,fl); e.target.value=""; }} style={{display:"none"}}/>
                        </label>
                      </div>
                    ); })()}
                    {(ans===0||ans===1) && (
                      <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${Z.border}`}}>
                        {linkedNcIdx===-1 ? (
                          <button onClick={()=>flagQuestion(sec,q,ans)}
                            style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:11.5}}>
                            + Add Non-Conformance for this
                          </button>
                        ) : (
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            <span style={{fontSize:11.5,color:"#f87171",fontWeight:700}}>⚠ Non-conformance logged</span>
                            <button onClick={()=>editLinkedNc(linkedNcIdx)}
                              style={{background:"rgba(37,99,235,0.1)",color:Z.accentLt,border:`1px solid ${Z.accent}33`,borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700}}>
                              View / Edit
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              {formSection>0 && <button onClick={()=>setFormSection(s=>s-1)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 18px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>← Prev</button>}
              <button onClick={()=>{ setFormSection(s=>s+1); window.scrollTo({top:0}); }} disabled={!allAnswered && !ti.allowSkip} data-testid="insp-next"
                style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,opacity:allAnswered||ti.allowSkip?1:.45}}>
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
              {!ncForm && <button onClick={()=>{setNcForm({...BLANK_NC,section:sections[0]?.label||""});setEditNcIdx(null);setNcReturnSection(null);}}
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
                      <select value={ncForm.section} onChange={e=>{const newSec=sections.find(s=>s.label===e.target.value);setNcForm(p=>({...p,section:e.target.value,sectionId:newSec?.id||"",questionId:newSec?.id===p.sectionId?p.questionId:""}));}} style={{...inp,cursor:"pointer"}}>
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
                            <img src={typeof p==="string"?p:(p.data||p.url)} alt={typeof p==="string"?`Photo ${pi+1}`:p.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
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
                  <button onClick={()=>{setNcForm(null);setEditNcIdx(null);if(ncReturnSection!==null){setFormSection(ncReturnSection);setNcReturnSection(null);}}} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>Cancel</button>
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
                          {nc.questionId && <span style={{fontSize:10,color:Z.muted}}>🔗 from checklist</span>}
                        </div>
                        <p style={{margin:0,fontSize:13,color:Z.white,lineHeight:1.4}}>{nc.finding}</p>
                        {nc.photos?.length>0 && <span style={{fontSize:11,color:Z.muted,marginTop:2,display:"block"}}>🖼 {nc.photos.length} photo{nc.photos.length!==1?"s":""}</span>}
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button onClick={()=>{setNcForm({...nc});setEditNcIdx(i);setNcReturnSection(null);}} style={{background:"rgba(37,99,235,0.1)",color:Z.accentLt,border:`1px solid ${Z.accent}33`,borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700}}>✏</button>
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
            {(()=>{ const unlogged=[]; sections.forEach(sc=>sc.questions.forEach(q=>{ const a=(form.sections[sc.id]||{})[q.id]; if((a===0||a===1)&&!form.nonConformances.some(n=>n.sectionId===sc.id&&n.questionId===q.id)) unlogged.push({sc,q,a}); }));
              if(!unlogged.length) return null;
              return (
                <div data-testid="insp-unlogged" role="status" style={{marginBottom:16,padding:"12px 14px",borderRadius:12,background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.45)"}}>
                  <div style={{fontWeight:800,fontSize:13,color:"#fbbf24",marginBottom:6}}>⚠ {unlogged.length} {unlogged.length===1?"answer is":"answers are"} Partial or Non-Compliant with no non-conformance logged</div>
                  <div style={{fontSize:12.5,color:Z.muted,marginBottom:8}}>Log a finding so each one gets an owner and a due date, or save anyway if it's already being dealt with.</div>
                  <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:6}}>
                    {unlogged.slice(0,12).map(({sc,q,a})=>(
                      <div key={sc.id+q.id} style={{display:"flex",gap:10,alignItems:"center",background:Z.overlay,borderRadius:8,padding:"7px 10px"}}>
                        <span style={{fontSize:11,fontWeight:800,color:a===0?"#f87171":"#f59e0b",whiteSpace:"nowrap"}}>{a===0?"✗ Non-compliant":"⚠ Partial"}</span>
                        <span style={{flex:1,minWidth:0,fontSize:12.5,color:Z.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.ref?`${q.ref} `:""}{q.text}</span>
                        <button type="button" onClick={()=>{ flagQuestion(sc,q,a); setNcReturnSection(sections.length+1); }} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.3)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:font,fontSize:11.5,fontWeight:700,whiteSpace:"nowrap"}}>+ Log finding</button>
                      </div>
                    ))}
                    {unlogged.length>12 && <div style={{fontSize:12,color:Z.muted}}>…and {unlogged.length-12} more.</div>}
                  </div>
                </div>
              ); })()}
            <button onClick={async()=>{
                const n = sections.reduce((c,sc)=>c+sc.questions.filter(q=>{ const a=(form.sections[sc.id]||{})[q.id]; return (a===0||a===1)&&!form.nonConformances.some(x=>x.sectionId===sc.id&&x.questionId===q.id); }).length,0);
                if (n && !(await ask({ title:`Save with ${n} failed ${n===1?"answer":"answers"} not logged?`, message:`${n===1?"One answer is":`${n} answers are`} Partial or Non-Compliant but has no non-conformance, so nobody is given an action for ${n===1?"it":"them"}. You can log them now (Back), or save and add them later from the inspection.`, ok:"Save anyway", cancel:"Back" }))) return;
                submitInspection();
              }} disabled={!form.inspector.trim()||!form.location.trim()} data-testid="insp-save"
              style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:12,padding:"12px 32px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:14,boxShadow:"0 4px 18px rgba(16,185,129,0.35)",opacity:form.inspector.trim()&&form.location.trim()?1:.45}}>
              💾 {continueId?"Save changes":"Save Inspection"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── CHECKLISTS (manage this site's checklists) ───────────────────────────────
  if (view==="checklists") return <ChecklistManager inspections={inspections} onClose={()=>setView("list")} Z={Z} font={font}/>;

  // ── LIST view ────────────────────────────────────────────────────────────────
  const filtered = inspections.filter(i=>(filterType==="all"||i.type===filterType)&&(filterStatus==="all"||i.status===filterStatus));
  // only the latest inspection of each type at each location counts (inspectionDue.js)
  const latestInsp = latestByKey(inspections);
  const overdue = overdueInspections(inspections, today);
  const openCount = inspections.filter(i=>i.status==="open").length;
  const scored = inspections.map(inspectionPct).filter(p => p !== null);   // an inspection with no maximum isn't averaged in
  const avgScore = scored.length ? Math.round(scored.reduce((s,p)=>s+p,0)/scored.length) : 0;

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px",color:Z.white}}>Site Inspections <HelpTip dark={true} text="Record regular site inspection findings. Each inspection is scored and failing items can have corrective actions assigned with a due date and responsible person. Completed inspections are stored for audit purposes."/></h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>{inspections.length} inspections recorded · H&S Audits, Fire Risk Assessments, Walk Arounds</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button type="button" data-testid="insp-checklists" onClick={()=>{setView("checklists");window.scrollTo({top:0});}}
          style={{background:Z.overlay,color:Z.white,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
          📋 Checklists
        </button>
        <button onClick={()=>{setContinueId(null);setForm({...BLANK_FORM,draftId:`d${Date.now()}`});setFormSection(0);setNcForm(null);setEditNcIdx(null);setNcReturnSection(null);setView("new");}}
          style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:`0 4px 16px ${Z.accent}44`,display:"flex",alignItems:"center",gap:6}}>
          + New Inspection
        </button>
        </div>
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
              const ti=typeInfo(i.type, i);
              return (
                <button key={i.id} onClick={()=>{setActiveId(i.id);setView("detail");window.scrollTo({top:0,behavior:"smooth"});}} style={{background:"rgba(239,68,68,0.1)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:600}}>
                  {ti.icon} {ti.label} · {i.location} — due {ukDate(i.nextDue)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:12,color:Z.muted,fontWeight:600}}>Filter:</span>
        {[["all","All Types"],...inspTypes().map(t=>[t.id,`${t.icon} ${t.label}`])].map(([id,label])=>(
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
          const ti=typeInfo(ins.type, ins);
          const pct=inspectionPct(ins) ?? 0;
          const sc=scoreColor(pct);
          const openNCs=ins.nonConformances.filter(n=>n.actionStatus!=="complete").length;
          const newer=supersededBy(ins,latestInsp);
          const overduNC=!newer&&ins.nextDue&&ins.nextDue<today;
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
                    <span style={{fontSize:11,color:Z.muted}}>📅 {ukDate(ins.date)}</span>
                    {ins.status==="open" && <span style={{fontSize:10,background:"rgba(245,158,11,0.15)",color:"#f59e0b",padding:"2px 8px",borderRadius:99,fontWeight:700}}>⏳ Open</span>}
                    {ins.status==="closed" && <span style={{fontSize:10,background:"rgba(16,185,129,0.12)",color:"#10b981",padding:"2px 8px",borderRadius:99,fontWeight:700}}>✓ Closed</span>}
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {openNCs>0 && <span style={{fontSize:11,color:"#f87171",fontWeight:600}}>{openNCs} open action{openNCs!==1?"s":""}</span>}
                    {ins.nonConformances.length>0 && <span style={{fontSize:11,color:Z.muted}}>{ins.nonConformances.length} finding{ins.nonConformances.length!==1?"s":""}</span>}
                    {ins.inspector && <span style={{fontSize:11,color:Z.muted}}>Inspector: {ins.inspector}</span>}
                    {newer ? <span style={{fontSize:11,color:Z.muted}}>✓ Re-inspected {ukDate(newer.date)}</span>
                      : ins.nextDue && <span style={{fontSize:11,color:overduNC?"#f87171":Z.muted,fontWeight:overduNC?700:400}}>{overduNC?"🚨 Overdue — ":"Next: "}{ukDate(ins.nextDue)}</span>}
                  </div>
                </div>
                <div style={{textAlign:"center",flexShrink:0}}>
                  <div style={{fontSize:26,fontWeight:900,color:sc,lineHeight:1}}>{pct}<span style={{fontSize:13,opacity:.6}}>%</span></div>
                  <div style={{fontSize:10,color:Z.muted,marginTop:1}}>{ins.overallScore}/{ins.maxScore} pts</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>{setEditingInspId(ins.id);setEditInspForm({date:ins.date,location:ins.location,inspector:ins.inspector,summary:ins.summary||"",nextDue:ins.nextDue||"",status:ins.status});}}
                    style={{background:"rgba(37,99,235,0.1)",color:Z.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,whiteSpace:"nowrap"}}>✏ Edit</button>
{/* Delete is on the inspection itself (View →) */}
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