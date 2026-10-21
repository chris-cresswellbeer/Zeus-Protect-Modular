import React, { useState, useRef } from "react";
import { notify, ask } from "../../shared/Feedback";
import { useWindowWidth } from "../../shared/hooks";
import { HelpTip } from "../../shared/HelpTip";
import { sb, SUPABASE_URL } from "../../lib/supabase";
import { ACCEPT_IMAGES, ACCEPT_VIDEO } from "../../lib/constants";
import { RichTextEditor } from "./RichTextEditor";
import { HotspotEditor } from "./HotspotEditor";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { htmlToPlainText } from "./slideTextUtils";
import { SlideImportPanel } from "./SlideImportPanel";
import { MAX_UPLOAD_MB } from "./slideImport";
import { parseVideoLink } from "../../lib/videoLink";
import { useFormGuard, DraftBanner } from "../../lib/unsaved";
import { DEFAULT_SIGNOFF, quizSummary } from "./quizEngine";
import { blankQuestion, cleanQuestion, questionProblem, quizProblem, withIds, MODULE_TEMPLATES, hasPlaceholders } from "./quizBuilder";
import { QuestionEditor, QuizSettings, CsvImport, SignoffEditor } from "./QuizEditor";
import { AnswerKey } from "./ModulePreviewModal";
import { serverDraft, saveServerDraft, dropServerDraft } from "../../lib/moduleDrafts";

/**
 * CreateModuleTab — admin 4-step wizard to create or edit a training module.
 *   1. Details  (title, category, level, duration, icon, renewal period)
 *   2. Slides   (heading, rich text, images, optional video, optional hotspot activity)
 *   3. Quiz     (questions of any type — quizEngine.js QTYPES — each with an optional "why";
 *                a question bank / shuffle; questions from a spreadsheet; the sign-off declaration)
 *   4. Preview & Save
 * A new module can start from a template (quizEngine.js MODULE_TEMPLATES). A slide can carry a
 * knowledge check (slide.check — a question staff answer right before moving on).
 * DRAFTS: the browser keeps a draft as you go (lib/unsaved.jsx); "Save draft" also saves it to
 * your account (lib/moduleDrafts.js) so it can be finished on another computer.
 *
 * Props:
 *   editingModule – module to edit, or null to create a new one
 *   userId        – the signed-in admin (for "Save draft")
 *   onSave(module)– NEW module: called after a successful save to Supabase (version 1).
 *                   EDITED module: called WITHOUT saving — the Create Module page shows NewVersionModal
 *                   (minor/major) and saveModuleVersion() writes it as the next version.
 *   Z, font       – theme + font
 *
 * SAVED MODULE SHAPE (custom_modules.data):
 *   { id, title, category, level, duration, icon, renewalMonths, passMark?, description?, certSummary? ("line\nline", the certificate's "Covering:"),
 *     content: [ { heading, text(HTML), images:[{name,type,url,data}], video:{name,type,url,data}|null,
 *                  hotspots:[{id,x,y,radius,correct,label,feedback}]|null, hotspotInstructions, check?:<question> } ],
 *     quiz: [ { id, type, q, options, answer | answers, images?, why? } ]   (quizEngine.js; older: { q, options, answer })
 *     quizDraw?, quizShuffle?, signoff?:{ text },
 *     _custom:true }
 *   `url` and `data` hold the SAME storage URL (older code read `data`, newer reads `url`).
 *
 * IMPORT: "Import slides from PowerPoint" (SlideImportPanel) turns a PDF export of a
 * deck into slides (one picture per slide, images[0].deck = true), with optional
 * speaker notes / titles / embedded videos from the .pptx.
 * VIDEO LINKS: instead of uploading, a slide's video can be a YouTube / Vimeo /
 * Microsoft Stream link: video = { name, link:true, provider, url, data } (lib/videoLink.js).
 * Uploads over MAX_UPLOAD_MB (the Supabase free-plan limit) are refused up front.
 * MEDIA: images/videos upload immediately on selection to the "documents" bucket
 * (slideimg_<ts>_<name> / video_<ts>_<name>) and are held as {uploading:true}
 * placeholders until done. Saving is blocked while any upload is in progress.
 */
function CreateModuleTab({ onSave, editingModule, userId, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const ICONS = ["📋","🔥","💪","🧠","⚡","🏥","🦺","🧯","☢️","🌿","🔧","📊","🚧","👁","🩺","🎓","⚠️","🔐","🚨","📡"];
  const CATEGORIES = ["Fire Safety","Physical Safety","Mental Health","Hazardous Substances","Electrical Safety","First Aid","Environmental","Equipment Safety","Manual Handling","General H&S","Food Safety","Compliance","Custom"];
  const LEVELS = ["Mandatory","Recommended","Optional"];
  // Templates for new slides/questions. Always spread-copy them — never push the same object twice.
  const BLANK_SLIDE = { heading:"", text:"", video:null, images:[], hotspots:null, hotspotInstructions:"" }; // video: { name, data/url, type }; images: array of same; hotspots: array of { id,x,y,radius,correct,label,feedback } or null if no activity

  const [step, setStep] = useState("details");
  // Wizard state. When editing, the module is copied into local state so changes are
  // discarded unless the admin reaches step 4 and saves.
  const [details, setDetails] = useState(editingModule ? {
    title: editingModule.title||"",
    category: editingModule.category||"General H&S",
    level: editingModule.level||"Mandatory",
    duration: editingModule.duration||"30 min",
    icon: editingModule.icon||"📋",
    renewalMonths: editingModule.renewalMonths||12,
    passMark: editingModule.passMark||70,
    description: editingModule.description||"",
    certSummary: Array.isArray(editingModule.certSummary) ? editingModule.certSummary.join("\n") : (editingModule.certSummary||""),
    quizDraw: Number(editingModule.quizDraw)||0,
    quizShuffle: !!editingModule.quizShuffle,
    signoff: { on: !!(editingModule.signoff && editingModule.signoff.text), text: (editingModule.signoff && editingModule.signoff.text) || DEFAULT_SIGNOFF },
  } : { title:"", category:"General H&S", level:"Mandatory", duration:"30 min", icon:"📋", renewalMonths:12, passMark:70, certSummary:"", quizDraw:0, quizShuffle:false, signoff:{ on:false, text:DEFAULT_SIGNOFF } });
  const [slides, setSlides] = useState(editingModule ? (editingModule.slides||editingModule.content||[]).map(s=>({
    heading: s.heading||"",
    text: s.text||s.body||"",
    video: s.video||null,
    // backwards compat: old modules have single `image`, new ones have `images[]`
    images: s.images ? [...s.images] : (s.image ? [s.image] : []),
    hotspots: s.hotspots ? s.hotspots.map(h=>({...h})) : null,
    hotspotInstructions: s.hotspotInstructions||"",
    ...(s.check ? { check: withIds([s.check])[0] } : {}),
  })) : [{ heading:"", text:"", video:null, images:[], hotspots:null, hotspotInstructions:"" }]);
  // every question gets an id: older ones keep their original position as their id ("i2"), so
  // results saved before still match (quizEngine.js qid)
  const [quiz, setQuiz] = useState(editingModule ? withIds(editingModule.quiz) : [blankQuestion()]);
  const [err, setErr] = useState("");
  // unsaved-changes warning + draft on this device (lib/unsaved.jsx)
  const draftKey = `module.${editingModule ? editingModule.id : "new"}`;
  const restoreValue = v => { if (v.details) setDetails(d=>({...d, ...v.details})); if (v.slides) setSlides(v.slides); if (v.quiz) setQuiz(withIds(v.quiz)); };
  const guard = useFormGuard({ key: draftKey, label: editingModule ? `the module "${editingModule.title}"` : "your new module",
    active: true, value: { details, slides, quiz },
    onRestore: restoreValue });
  // "Save draft" to your account (lib/moduleDrafts.js): offered back when you open the builder again
  const [acctDraft, setAcctDraft] = useState(() => serverDraft(userId, draftKey));
  const [draftNote, setDraftNote] = useState("");      // "Draft saved at 10:42"
  const [savingDraft, setSavingDraft] = useState(false);
  async function saveDraft() {
    if (slides.some(s => (s.video && s.video.uploading) || (s.images||[]).some(img=>img.uploading))) { setDraftNote("Wait for the upload to finish, then save the draft."); return; }
    setSavingDraft(true);
    const r = await saveServerDraft(userId, draftKey, details.title || (editingModule ? editingModule.title : "New module"), { details, slides, quiz });
    setSavingDraft(false);
    setDraftNote(r.ok ? `✓ Draft saved to your account at ${new Date(r.at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})} — open Create Module on any computer to carry on.` : `⚠ ${r.error}`);
    if (r.ok) setAcctDraft(null);
  }
  const [showCsv, setShowCsv] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [linkDraft, setLinkDraft] = useState({});     // slide index → pasted video link
  const [linkErr, setLinkErr] = useState({});         // slide index → message
  const videoInputRefs = useRef({});
  const imageInputRefs = useRef({});

  const inp = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 13px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const lbl = {fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5};
  const steps = [["details","1. Details"],["slides","2. Slides"],["quiz","3. Quiz & sign-off"],["preview","4. Preview"]];

  function addSlide() { setSlides(p=>[...p, {...BLANK_SLIDE}]); }
  function removeSlide(i) { if(slides.length>1) setSlides(p=>p.filter((_,idx)=>idx!==i)); }
  function updateSlide(i,k,v) { setSlides(p=>p.map((s,idx)=>idx===i?{...s,[k]:v}:s)); }
  // Swap slide i with its neighbour (dir = -1 up, +1 down).
  function moveSlide(i, dir) {
    setSlides(p=>{
      const a=[...p]; const j=i+dir;
      if(j<0||j>=a.length) return a;
      [a[i],a[j]]=[a[j],a[i]]; return a;
    });
  }

  // Slides from "Import slides from PowerPoint". Replacing drops the current slides;
  // adding puts them after (an untouched blank first slide is replaced either way).
  const slideHasContent = s => !!(s.heading.trim() || htmlToPlainText(s.text).trim() || (s.images||[]).length || s.video);
  function importSlides(newSlides, mode) {
    setSlides(p => mode === "replace" || !p.some(slideHasContent) ? newSlides : [...p, ...newSlides]);
    setErr("");
  }
  function addVideoLink(i) {
    const r = parseVideoLink(linkDraft[i]);
    if (r.error) { setLinkErr(p => ({ ...p, [i]: r.error })); return; }
    updateSlide(i, "video", { name: `${r.provider} video`, type: "", link: true, provider: r.provider, url: r.src, data: r.src });
    setLinkDraft(p => ({ ...p, [i]: "" })); setLinkErr(p => ({ ...p, [i]: "" }));
  }

  function addQuestion(type) { setQuiz(p=>[...p, blankQuestion(type)]); }
  function removeQuestion(i) { setQuiz(p=>p.filter((_,idx)=>idx!==i)); }
  // v = the new question, or a function of the current one (picture uploads finish later)
  function setQuestion(i, v) { setQuiz(p=>p.map((q,idx)=>idx===i?(typeof v==="function"?v(q):v):q)); }
  function moveQuestion(i, dir) { setQuiz(p=>{ const a=[...p]; const j=i+dir; if(j<0||j>=a.length) return a; [a[i],a[j]]=[a[j],a[i]]; return a; }); }
  function setCheck(i, v) { setSlides(p=>p.map((s,idx)=>{ if(idx!==i) return s; const next = typeof v==="function" ? v(s.check) : v; if(!next){ const { check:_c, ...rest } = s; return rest; } return {...s, check:next}; })); }
  function importQuestions(qs, mode) {
    // an untouched blank first question is replaced either way
    setQuiz(p => mode === "replace" || (p.length === 1 && !p[0].q.trim() && p[0].options.every(o=>!String(o).trim() || o==="True" || o==="False")) ? qs : [...p, ...qs]);
    setShowCsv(false); setErr(""); notify(`${qs.length} question${qs.length===1?"":"s"} added.`, { kind: "success" });
  }
  // Start from a template (new modules only). Replaces the slides and questions.
  async function applyTemplate(tpl) {
    const hasWork = slides.some(slideHasContent) || quiz.some(q=>q.q.trim());
    if (hasWork && !(await ask({ title: `Start from "${tpl.name}"?`, message: "This replaces the slides and questions you've added so far.", ok: "Use the template", cancel: "Keep my work", danger: true }))) return;
    const b = tpl.build();
    setDetails(d=>({ ...d, ...b.details, title: d.title }));
    setSlides(b.slides); setQuiz(b.quiz); setErr("");
    notify(`Template added. Replace the wording in [square brackets] with your own.`, { kind: "success" });
  }

  // Validates the CURRENT step before moving to `to`. Errors are shown in the red banner.
  function validateAndNext(to) {
    setErr("");
    if(step==="details") {
      if(!details.title.trim()) { setErr("Module title is required."); return; }
    }
    if(step==="slides") {
      if(slides.some(s=>!s.heading.trim())) { setErr("All slides must have a heading."); return; }
      if(slides.some(s=>!htmlToPlainText(s.text).trim()&&!s.video&&!(s.images||[]).length)) { setErr("Each slide needs content text, an image or a video."); return; }
      if(slides.some(s=>s.hotspots && s.hotspots.length>0 && !s.hotspots.some(h=>h.correct))) { setErr("Each hotspot activity needs at least one marker set as a hazard."); return; }
      if(slides.some(s=>s.hotspots && s.hotspots.some(h=>!h.label.trim()))) { setErr("Every hotspot marker needs a short label."); return; }
      for (let i = 0; i < slides.length; i++) {
        const p = slides[i].check ? questionProblem(slides[i].check, `Slide ${i+1}'s quick check`) : "";
        if (p) { setErr(p); return; }
      }
    }
    if(step==="quiz") {
      const so = details.signoff || {};
      if (so.on && !String(so.text||"").trim()) { setErr("Write the declaration staff will sign, or turn the sign-off off."); return; }
      const p = quizProblem(quiz, { quizDraw: details.quizDraw, signoff: so.on ? so : null });
      if (p) { setErr(p); return; }
    }
    setStep(to);
  }

  // Cleans the slides (sanitises HTML, drops failed uploads), writes to custom_modules,
  // then calls onSave. NOTE: the portal's onSave writes the same record again (adding
  // _override for built-in modules) and the customModules auto-sync effect writes it a
  // third time — redundant but harmless. New modules get id "custom_<timestamp>".
  async function saveModule() {
    // Wait for any in-progress video or image uploads before saving
    const anyUploading = slides.some(s => (s.video && s.video.uploading) || (s.images||[]).some(img=>img.uploading));
    if (anyUploading) {
      setErr("Please wait — a file is still uploading.");
      return;
    }
    // Strip out any video/image entries that failed (no url and no data)
    if (quiz.some(q => (q.images||[]).some(im => im && im.uploading)) || slides.some(s => s.check && (s.check.images||[]).some(im => im && im.uploading))) {
      setErr("Please wait — a picture is still uploading.");
      return;
    }
    const cleanSlides = slides.map(({ check, ...s }) => ({
      ...s,
      ...(check ? { check: cleanQuestion(check, 0) } : {}),
      text: sanitizeHtml(s.text||""),
      video: s.video && (s.video.url || s.video.data)
        ? { name: s.video.name, type: s.video.type, url: s.video.url || s.video.data, data: s.video.url || s.video.data,
            ...(s.video.link ? { link: true, provider: s.video.provider || "" } : {}) }
        : null,
      images: (s.images||[]).filter(img=>img.url||img.data).map(img=>({
        name: img.name, type: img.type, url: img.url||img.data, data: img.url||img.data, ...(img.deck ? { deck: true } : {}),
      })),
    }));
    const { signoff: so, quizDraw, quizShuffle, ...plainDetails } = details;
    const draw = Math.round(Number(quizDraw)) || 0;
    const newModule = {
      id: editingModule ? editingModule.id : `custom_${Date.now()}`,
      ...plainDetails,
      renewalMonths: Number(details.renewalMonths)||12,
      passMark: Math.min(100, Math.max(50, Math.round(Number(details.passMark)) || 70)),
      certSummary: String(details.certSummary||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,4).join("\n"),
      content: cleanSlides,
      quiz: quiz.map(cleanQuestion),
      // only saved when used, so modules that don't use them look exactly as before
      ...(draw > 0 && draw < quiz.length ? { quizDraw: draw } : {}),
      ...(quizShuffle ? { quizShuffle: true } : {}),
      ...(so && so.on && String(so.text||"").trim() ? { signoff: { text: String(so.text).trim() } } : {}),
      _custom: true,
    };
    // Editing an existing module: the portal asks "minor or major change?" and saves it as a
    // new version (saveModuleVersion) — nothing is written until the admin confirms.
    if (editingModule) { guard.done(); dropServerDraft(userId, draftKey); onSave(newModule); return; }
    // New module: save directly to Supabase before updating state
    const { error } = await sb.from("custom_modules").upsert({ id: newModule.id, data: { ...newModule, version: 1 } }, { onConflict: "id" });
    if (error) {
      console.error("Failed to save module:", error);
      setErr(`Failed to save module — your changes were not saved. ${error}`);
      return;
    }
    guard.done();
    dropServerDraft(userId, draftKey);
    onSave(newModule);
  }

  const cardStyle = {background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:22,marginBottom:16,border:`1px solid ${Z.border}`};

  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 6px"}}>{editingModule?"Edit Training Module":"Create Training Module"} <HelpTip dark={false} text="Build your own training module with slides, images and video. Set a pass mark for the quiz — 70% is the default. Set a renewal period in months if the training needs to be repeated periodically."/></h2>
      <p style={{color:Z.muted,fontSize:13,margin:"0 0 24px"}}>Build a custom module with slides and a quiz that can be assigned to staff.</p>

      {/* Step progress */}
      <div style={{display:"flex",gap:0,marginBottom:28,borderRadius:12,overflow:"hidden",border:`1px solid ${Z.borderMd}`}}>
        {steps.map(([id,label],i)=>{
          const active = step===id;
          const done = steps.findIndex(s=>s[0]===step) > i;
          return (
            <button key={id}
              onClick={()=>{ if(done) setStep(id); }}
              style={{flex:1,padding:"11px 8px",background:active?`linear-gradient(135deg,${Z.accent},${Z.blue})`:done?"rgba(37,99,235,0.15)":Z.overlay,color:active?Z.white:done?Z.accentLt:Z.muted,fontWeight:active||done?700:400,fontSize:13,border:"none",borderRight:i<3?`1px solid ${Z.borderMd}`:"none",cursor:done?"pointer":"default",fontFamily:font,letterSpacing:.3,transition:"all .2s"}}>
              {done && !active ? "✓ " : ""}{label}
            </button>
          );
        })}
      </div>

      <DraftBanner guard={guard} Z={Z} font={font} what={editingModule ? "this module" : "a new module"}/>
      {acctDraft && !guard.draft && (
        <div role="status" data-testid="acct-draft" style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"10px 14px",marginBottom:14,borderRadius:12,background:"rgba(37,99,235,0.1)",border:`1px solid ${Z.accent}55`}}>
          <span style={{fontSize:13,color:Z.white,flex:1,minWidth:220}}>💾 You saved a draft of {acctDraft.title ? `"${acctDraft.title}"` : "this module"} to your account on {new Date(acctDraft.at).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}.</span>
          <button onClick={()=>{ restoreValue(acctDraft.value); setAcctDraft(null); setDraftNote("Draft opened. Save it to the library when it's ready."); }} data-testid="acct-draft-open" style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:800,cursor:"pointer",fontSize:12.5,fontFamily:font}}>Carry on with it</button>
          <button onClick={async()=>{ if(await ask({ title:"Delete the saved draft?", message:"The draft saved to your account will be deleted.", ok:"Delete draft", danger:true })) { dropServerDraft(userId, draftKey); setAcctDraft(null); } }} style={{background:"transparent",color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",fontWeight:800,cursor:"pointer",fontSize:12.5,fontFamily:font}}>Delete it</button>
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:10,marginTop:-14,marginBottom:14,flexWrap:"wrap"}}>
        {draftNote && <span data-testid="draft-note" style={{fontSize:12,color:draftNote.startsWith("⚠")?Z.amber:Z.muted,flex:1,minWidth:200}}>{draftNote}</span>}
        <button onClick={saveDraft} disabled={savingDraft} data-testid="save-draft" title="Save what you've done so far to your account, to finish later on any computer"
          style={{background:Z.overlay,color:Z.accentLt,border:`1px solid ${Z.borderMd}`,borderRadius:9,padding:"7px 14px",cursor:"pointer",fontSize:12.5,fontWeight:700,fontFamily:font,opacity:savingDraft?.6:1}}>
          {savingDraft ? "Saving…" : "💾 Save draft"}
        </button>
      </div>
      {err && <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"10px 16px",color:"#f87171",fontSize:13,marginBottom:16}}>{err}</div>}

      {/* ── STEP 1: Details ── */}
      {step==="details" && (
        <div>
          {!editingModule && (
            <div style={{...cardStyle,padding:"16px 18px"}} data-testid="templates">
              <h4 style={{margin:"0 0 10px",fontSize:12,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}>Start from a template (optional)</h4>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10}}>
                {MODULE_TEMPLATES.map(tp=>(
                  <button key={tp.id} onClick={()=>applyTemplate(tp)} data-testid={`tpl-${tp.id}`}
                    style={{textAlign:"left",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",fontFamily:font,color:Z.white}}>
                    <div style={{fontWeight:800,fontSize:13.5,marginBottom:4}}>{tp.icon} {tp.name}</div>
                    <div style={{fontSize:11.5,color:Z.muted,lineHeight:1.45}}>{tp.blurb}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={cardStyle}>
            <h4 style={{margin:"0 0 18px",fontSize:12,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}>Module Details</h4>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Module Title *</label>
              <input value={details.title} onChange={e=>setDetails(p=>({...p,title:e.target.value}))} placeholder="e.g. Working at Height Safety" style={inp}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
              <div>
                <label style={lbl}>Category</label>
                <select value={details.category} onChange={e=>setDetails(p=>({...p,category:e.target.value}))} style={{...inp,cursor:"pointer"}}>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Level</label>
                <select value={details.level} onChange={e=>setDetails(p=>({...p,level:e.target.value}))} style={{...inp,cursor:"pointer"}}>
                  {LEVELS.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:18}}>
              <div>
                <label style={lbl}>Est. Duration</label>
                <input value={details.duration} onChange={e=>setDetails(p=>({...p,duration:e.target.value}))} placeholder="e.g. 30 min" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Renewal (months)</label>
                <input type="number" min="1" max="120" value={details.renewalMonths} onChange={e=>setDetails(p=>({...p,renewalMonths:e.target.value}))} style={inp}/>
              </div>
              <div>
                <label style={lbl} htmlFor="cm-pass">Pass mark (%)</label>
                {/* 50–100. Results already passed keep their pass if this is raised later (completion.js isPassed). */}
                <input id="cm-pass" type="number" min="50" max="100" step="5" value={details.passMark??70} onChange={e=>setDetails(p=>({...p,passMark:e.target.value}))} style={inp}/>
              </div>
            </div>
            <div>
              <label style={lbl}>Module Icon</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {ICONS.map(ic=>(
                  <button key={ic} onClick={()=>setDetails(p=>({...p,icon:ic}))}
                    style={{width:40,height:40,fontSize:20,background:details.icon===ic?`rgba(37,99,235,0.25)`:Z.overlay,border:`2px solid ${details.icon===ic?Z.accent:Z.border}`,borderRadius:10,cursor:"pointer",transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginTop:18}}>
              <label style={lbl} htmlFor="cm-certsum">On the certificate: what was covered (optional)</label>
              <textarea id="cm-certsum" data-testid="cm-certsum" rows={4} value={details.certSummary||""} onChange={e=>setDetails(p=>({...p,certSummary:e.target.value}))}
                placeholder={"Up to 4 short lines, one per line, e.g.\nAssessing the load\nLifting technique"} style={{...inp,resize:"vertical",lineHeight:1.5}}/>
              <div style={{fontSize:11.5,color:Z.muted,marginTop:4,lineHeight:1.45}}>Shown on the certificate as "Covering: …". Leave empty to use the slide headings (headings like "Introduction" and "Summary" are skipped).</div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <button onClick={()=>validateAndNext("slides")}
              style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:Z.white,border:"none",borderRadius:10,padding:"11px 28px",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:font}}>
              Next: Slides →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Slides ── */}
      {step==="slides" && (
        <div>
          {!showImport ? (
            <button onClick={()=>setShowImport(true)} data-testid="open-import"
              style={{width:"100%",background:"rgba(37,99,235,0.08)",border:`2px dashed ${Z.accent}66`,borderRadius:12,padding:"13px",cursor:"pointer",color:Z.accentLt,fontSize:13,fontWeight:700,fontFamily:font,marginBottom:16}}>
              📥 Import slides from PowerPoint
            </button>
          ) : (
            <SlideImportPanel hasContent={slides.some(slideHasContent)} onImport={importSlides} onClose={()=>setShowImport(false)} Z={Z} font={font}/>
          )}
          {slides.map((s,i)=>(
            <div key={i} style={{...cardStyle,border:`1px solid ${Z.borderMd}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <span style={{fontSize:12,fontWeight:700,color:Z.muted,letterSpacing:1,textTransform:"uppercase"}}>Slide {i+1} of {slides.length}</span>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>moveSlide(i,-1)} disabled={i===0} style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:7,padding:"5px 10px",cursor:i===0?"default":"pointer",fontSize:12,fontFamily:font,opacity:i===0?.3:1}}>↑</button>
                  <button onClick={()=>moveSlide(i,1)} disabled={i===slides.length-1} style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:7,padding:"5px 10px",cursor:i===slides.length-1?"default":"pointer",fontSize:12,fontFamily:font,opacity:i===slides.length-1?.3:1}}>↓</button>
                  {slides.length>1 && <button onClick={()=>removeSlide(i)} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:font}}>Remove</button>}
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={lbl}>Slide Heading *</label>
                <input value={s.heading} onChange={e=>updateSlide(i,"heading",e.target.value)} placeholder="e.g. UK Legal Framework" style={inp}/>
              </div>
              {/* Image upload */}
              <div style={{marginBottom:12}}>
                <label style={lbl}>Images (optional — add as many as needed)</label>
                {(s.images||[]).length>0 && (
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
                    {(s.images||[]).map((img,imgIdx)=>(
                      <div key={imgIdx} style={{background:Z.overlaySm,borderRadius:10,padding:"10px 14px",border:`1px solid ${Z.borderMd}`,display:"flex",alignItems:"center",gap:12}}>
                        {img.uploading ? (
                          <span style={{fontSize:20}}>🖼️</span>
                        ) : (
                          <img src={img.url||img.data} alt={img.name} style={{width:64,height:48,objectFit:"cover",borderRadius:6,flexShrink:0}}/>
                        )}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:700,color:Z.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{img.name}</div>
                          <div style={{fontSize:10,color:Z.muted,marginTop:2}}>{img.uploading?"Uploading…":(img.url||img.data)?"✓ Uploaded":""}</div>
                        </div>
                        <button
                          onClick={()=>updateSlide(i,"images",(s.images||[]).filter((_,ii)=>ii!==imgIdx))}
                          style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  ref={el=>imageInputRefs.current[i]=el}
                  type="file" accept={ACCEPT_IMAGES}
                  style={{display:"none"}}
                  // Upload flow: add placeholder → upload → replace the placeholder (matched by file name) with the real URL.
                  onChange={async e=>{
                    const file=e.target.files[0]; if(!file) return;
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
                    const path = `slideimg_${Date.now()}_${safeName}`;
                    const placeholder = {name:file.name,type:file.type,data:null,uploading:true};
                    updateSlide(i,"images",[...(s.images||[]),placeholder]);
                    const { error } = await sb.storage.upload("documents",path,file);
                    if (error) {
                      notify("Image upload failed: "+error, { kind: "error" });
                      updateSlide(i,"images",(s.images||[]).filter(img=>img!==placeholder));
                      return;
                    }
                    const url=`${SUPABASE_URL}/storage/v1/object/public/documents/${path}`;
                    setSlides(prev=>prev.map((sl,idx)=>{
                      if(idx!==i) return sl;
                      const imgs=[...(sl.images||[])];
                      const pi=imgs.findIndex(img=>img.uploading&&img.name===file.name);
                      if(pi>-1) imgs[pi]={name:file.name,type:file.type,data:url,url};
                      return {...sl,images:imgs};
                    }));
                    e.target.value="";
                  }}/>
                <div
                  onClick={()=>imageInputRefs.current[i]&&imageInputRefs.current[i].click()}
                  style={{border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"14px",cursor:"pointer",textAlign:"center",transition:"border-color .2s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=Z.accent}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=Z.borderMd}>
                  <div style={{fontSize:22,marginBottom:3}}>🖼️</div>
                  <div style={{fontSize:12,fontWeight:700,color:Z.white,marginBottom:2}}>{(s.images||[]).length>0?"Add Another Image":"Upload Image"}</div>
                  <div style={{fontSize:11,color:Z.muted}}>Click to browse · JPG, PNG, GIF, WebP</div>
                </div>
              </div>
              {/* Interactive hotspot activity */}
              <div style={{marginBottom:12}}>
                <label style={lbl}>Interactive Hotspot Activity (optional)</label>
                {(s.images||[]).length===0 ? (
                  <div style={{fontSize:11,color:Z.muted,fontStyle:"italic"}}>Upload an image above first — the activity is placed on your first image.</div>
                ) : !s.hotspots ? (
                  <button onClick={()=>updateSlide(i,"hotspots",[])}
                    style={{background:Z.overlay,border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"10px",cursor:"pointer",color:Z.muted,fontSize:12,fontWeight:700,fontFamily:font,width:"100%"}}>
                    🎯 + Add Hotspot Activity (e.g. "click every source of ignition")
                  </button>
                ) : (
                  <div style={{background:Z.overlaySm,borderRadius:10,padding:12,border:`1px solid ${Z.border}`}}>
                    <input value={s.hotspotInstructions} onChange={e=>updateSlide(i,"hotspotInstructions",e.target.value)}
                      placeholder='Instructions shown to staff, e.g. "Click every source of ignition in this office."'
                      style={{...inp,marginBottom:10}}/>
                    <HotspotEditor
                      imageUrl={s.images[0].url||s.images[0].data}
                      hotspots={s.hotspots}
                      onChange={hs=>updateSlide(i,"hotspots",hs)}
                      Z={Z} font={font}
                    />
                    <button onClick={()=>updateSlide(i,"hotspots",null)}
                      style={{marginTop:10,background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:7,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                      Remove Hotspot Activity
                    </button>
                  </div>
                )}
              </div>
              {/* Video upload */}
              <div style={{marginBottom:12}}>
                <label style={lbl}>Video (optional)</label>
                {s.video ? (
                  <div style={{background:Z.overlaySm,borderRadius:10,padding:"12px 14px",border:`1px solid ${Z.borderMd}`,display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:20}}>🎬</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:Z.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.video.name}</div>
                      <div style={{fontSize:10,color:Z.muted,marginTop:2}}>{s.video.uploading ? "Uploading…" : s.video.link ? `🔗 Linked (${s.video.provider||"video link"}) — plays inside the slide` : (s.video.url || s.video.data) ? "✓ Uploaded" : ""}</div>
                    </div>
                    <button onClick={()=>updateSlide(i,"video",null)} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>Remove</button>
                  </div>
                ) : (
                  <>
                    <input ref={el=>videoInputRefs.current[i]=el} type="file" accept={ACCEPT_VIDEO}
                      style={{display:"none"}}
                      onChange={async e=>{
                        const file=e.target.files[0]; if(!file) return;
                        e.target.value="";
                        if (file.size > MAX_UPLOAD_MB*1024*1024) {
                          setLinkErr(p=>({...p,[i]:`That video is ${Math.round(file.size/1048576)} MB. Uploads can be up to ${MAX_UPLOAD_MB} MB. Put it on YouTube (unlisted), Vimeo or Microsoft Stream and paste the link below instead.`}));
                          return;
                        }
                        setLinkErr(p=>({...p,[i]:""}));
                        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                        const path = `video_${Date.now()}_${safeName}`;
                        updateSlide(i,"video",{name:file.name,type:file.type,data:null,uploading:true});
                        const { error } = await sb.storage.upload("documents", path, file);
                        if (error) { notify("Video upload failed: " + error, { kind: "error" }); updateSlide(i,"video",null); return; }
                        // Build URL without any encoding — path is already safe
                        const url = `${SUPABASE_URL}/storage/v1/object/public/documents/${path}`;
                        console.log("Video uploaded, URL:", url);
                        updateSlide(i,"video",{name:file.name,type:file.type,data:url,url});
                        e.target.value="";
                      }}/>
                    <div onClick={()=>videoInputRefs.current[i]&&videoInputRefs.current[i].click()}
                      style={{border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"16px",cursor:"pointer",textAlign:"center",transition:"border-color .2s"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=Z.accent}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=Z.borderMd}>
                      <div style={{fontSize:24,marginBottom:4}}>🎬</div>
                      <div style={{fontSize:12,fontWeight:700,color:Z.white,marginBottom:2}}>Upload Video</div>
                      <div style={{fontSize:11,color:Z.muted}}>Click to browse · MP4, MOV, WebM · up to {MAX_UPLOAD_MB} MB</div>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:8}}>
                      <input value={linkDraft[i]||""} onChange={e=>setLinkDraft(p=>({...p,[i]:e.target.value}))} aria-label={`Video link for slide ${i+1}`}
                        onKeyDown={e=>{ if(e.key==="Enter") addVideoLink(i); }}
                        placeholder="…or paste a YouTube, Vimeo or Microsoft Stream link / embed code" style={{...inp,flex:1}}/>
                      <button onClick={()=>addVideoLink(i)} style={{background:Z.overlay,color:Z.accentLt,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"0 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>🔗 Add link</button>
                    </div>
                    {linkErr[i] && <div role="alert" style={{fontSize:11.5,color:"#f87171",marginTop:6,lineHeight:1.5}}>{linkErr[i]}</div>}
                  </>
                )}
              </div>
              {/* Knowledge check: a question on this slide, answered right before moving on */}
              <div style={{marginBottom:12}}>
                <label style={lbl}>Quick check question (optional)</label>
                {!s.check ? (
                  <button onClick={()=>{ setCheck(i, { ...blankQuestion("single"), id: `c${Date.now().toString(36)}` }); }} data-testid={`add-check-${i}`}
                    style={{background:Z.overlay,border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"10px",cursor:"pointer",color:Z.muted,fontSize:12,fontWeight:700,fontFamily:font,width:"100%"}}>
                    ✅ + Add a quick check (staff answer it right before the next slide — not scored)
                  </button>
                ) : (
                  <div style={{background:"rgba(245,158,11,0.06)",borderRadius:10,padding:12,border:"1px solid rgba(245,158,11,0.3)"}}>
                    <QuestionEditor q={s.check} onChange={v=>setCheck(i, v)} onRemove={()=>setCheck(i, null)} title="Quick check" testId="check-editor" Z={Z} font={font} inp={inp} lbl={lbl}/>
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Slide Content {s.video?"(optional — shown below video)":(s.images||[]).length?"(optional)":"*"}</label>
                <RichTextEditor
                  value={s.text}
                  onChange={html=>updateSlide(i,"text",html)}
                  Z={Z} font={font}
                  minHeight={s.video?70:130}
                  placeholder={s.video?"Optional supporting text for this slide…":"Write the full content for this slide… use the toolbar to format text or insert images inline."}
                />
              </div>
            </div>
          ))}
          <button onClick={addSlide}
            style={{width:"100%",background:Z.overlay,border:`2px dashed ${Z.borderMd}`,borderRadius:12,padding:"14px",cursor:"pointer",color:Z.muted,fontSize:13,fontWeight:700,fontFamily:font,marginBottom:16,transition:"border-color .2s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=Z.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=Z.borderMd}>
            + Add Slide
          </button>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <button onClick={()=>setStep("details")} style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 24px",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:font}}>← Back</button>
            <button onClick={()=>validateAndNext("quiz")} style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:Z.white,border:"none",borderRadius:10,padding:"11px 28px",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:font}}>Next: Quiz →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Quiz & sign-off ── */}
      {step==="quiz" && (
        <div>
          <div style={cardStyle}>
            <h4 style={{margin:"0 0 14px",fontSize:12,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}>Sign-off</h4>
            <SignoffEditor value={details.signoff} onChange={v=>setDetails(p=>({...p,signoff:v}))} Z={Z} inp={inp} lbl={lbl}/>
          </div>
          <div style={cardStyle}>
            <h4 style={{margin:"0 0 14px",fontSize:12,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}>How the quiz is asked</h4>
            <QuizSettings count={quiz.length} quizDraw={details.quizDraw} quizShuffle={details.quizShuffle} onChange={v=>setDetails(p=>({...p,...v}))} Z={Z} font={font} inp={inp} lbl={lbl}/>
          </div>
          {showCsv ? <CsvImport onAdd={importQuestions} onClose={()=>setShowCsv(false)} hasQuestions={quiz.some(q=>q.q.trim())} Z={Z} font={font} inp={inp}/> : (
            <button onClick={()=>setShowCsv(true)} data-testid="open-csv"
              style={{width:"100%",background:"rgba(37,99,235,0.08)",border:`2px dashed ${Z.accent}66`,borderRadius:12,padding:"13px",cursor:"pointer",color:Z.accentLt,fontSize:13,fontWeight:700,fontFamily:font,marginBottom:16}}>
              📥 Add questions from a spreadsheet (CSV or pasted from Excel)
            </button>
          )}
          {quiz.length===0 && (
            <div style={{...cardStyle,textAlign:"center",color:Z.muted,fontSize:13}}>
              {details.signoff && details.signoff.on ? "No questions — staff complete this module by signing the declaration." : "No questions yet. Add one below, or turn on the sign-off for a read-and-sign module."}
            </div>
          )}
          {quiz.map((q,qi)=>(
            <div key={q.id||qi} style={{...cardStyle,border:`1px solid ${Z.borderMd}`}}>
              <QuestionEditor q={q} index={qi} total={quiz.length} onChange={v=>setQuestion(qi,v)} onRemove={()=>removeQuestion(qi)} onMove={dir=>moveQuestion(qi,dir)} Z={Z} font={font} inp={inp} lbl={lbl}/>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            <button onClick={()=>addQuestion("single")} data-testid="add-question"
              style={{flex:"1 1 260px",background:Z.overlay,border:`2px dashed ${Z.borderMd}`,borderRadius:12,padding:"14px",cursor:"pointer",color:Z.muted,fontSize:13,fontWeight:700,fontFamily:font,transition:"border-color .2s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=Z.accent}
              onMouseLeave={e=>e.currentTarget.style.borderColor=Z.borderMd}>
              + Add Question
            </button>
            {[["tf","+ True / false"],["multi","+ Select all"],["image","+ Pictures"],["order","+ Put in order"]].map(([ty,l])=>(
              <button key={ty} onClick={()=>addQuestion(ty)} data-testid={`add-${ty}`} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:12,padding:"10px 14px",cursor:"pointer",color:Z.muted,fontSize:12.5,fontWeight:700,fontFamily:font}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <button onClick={()=>setStep("slides")} style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 24px",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:font}}>← Back</button>
            <button onClick={()=>validateAndNext("preview")} style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:Z.white,border:"none",borderRadius:10,padding:"11px 28px",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:font}}>Preview →</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Preview & Save ── */}
      {step==="preview" && (
        <div>
          <div style={cardStyle}>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${Z.border}`}}>
              <span style={{fontSize:48}}>{details.icon}</span>
              <div>
                <h3 style={{margin:"0 0 4px",fontSize:20,fontWeight:900}}>{details.title}</h3>
                <div style={{color:Z.muted,fontSize:13}}>{details.category} · {details.level} · {details.duration} · Renewal: {details.renewalMonths} months{quiz.length ? ` · Pass mark: ${details.passMark??70}%` : ""}</div>
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:10}}>Slides ({slides.length})</div>
              {slides.map((s,i)=>(
                <div key={i} style={{background:Z.overlaySm,borderRadius:10,padding:"12px 14px",marginBottom:8,border:`1px solid ${Z.border}`}}>
                  <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                    Slide {i+1}: {s.heading}
                    {s.video && <span style={{fontSize:10,fontWeight:700,color:"#a78bfa",background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.3)",borderRadius:6,padding:"2px 7px"}}>🎬 VIDEO</span>}
                    {s.hotspots && s.hotspots.length>0 && <span style={{fontSize:10,fontWeight:700,color:Z.green,background:"rgba(16,185,129,0.12)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:6,padding:"2px 7px"}}>🎯 HOTSPOT</span>}
                    {s.check && <span style={{fontSize:10,fontWeight:700,color:Z.gold,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,padding:"2px 7px"}}>✅ QUICK CHECK</span>}
                  </div>
                  {s.video && <div style={{fontSize:11,color:Z.muted,marginBottom:4}}>{s.video.link?"🔗":"📎"} {s.video.name}</div>}
                  {htmlToPlainText(s.text) && <div style={{fontSize:12,color:Z.muted,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{htmlToPlainText(s.text)}</div>}
                </div>
              ))}
            </div>
            {details.signoff && details.signoff.on && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:10}}>Sign-off declaration</div>
                <div style={{background:Z.overlaySm,borderRadius:10,padding:"12px 14px",border:`1px solid ${Z.border}`,fontSize:13,color:Z.white,fontStyle:"italic"}}>“{details.signoff.text}”</div>
              </div>
            )}
            <div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:10}}>Quiz — {quizSummary({ quiz, quizDraw: details.quizDraw, quizShuffle: details.quizShuffle, signoff: details.signoff && details.signoff.on ? details.signoff : null })}</div>
              <div style={{display:"grid",gap:8}}>
                {quiz.map((q,qi)=>(<AnswerKey key={q.id||qi} q={q} n={qi+1} T={Z}/>))}
              </div>
            </div>
            {hasPlaceholders(slides, quiz, details.signoff && details.signoff.on ? details.signoff.text : "") && (
              <div role="alert" data-testid="placeholder-warning" style={{marginTop:14,padding:"10px 14px",borderRadius:10,background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.35)",fontSize:12.5,color:Z.amber}}>
                ⚠ Some template wording in [square brackets] hasn't been replaced yet.
              </div>
            )}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <button onClick={()=>setStep("quiz")} style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 24px",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:font}}>← Edit Quiz</button>
            <button onClick={saveModule}
              style={{background:`linear-gradient(135deg,#10b981,#059669)`,color:"#fff",border:"none",borderRadius:10,padding:"13px 36px",cursor:"pointer",fontSize:15,fontWeight:800,fontFamily:font,letterSpacing:.3}}>
              ✓ Save Module to Library
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { CreateModuleTab };