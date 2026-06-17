import React from "react";
import { useWindowWidth } from "../../shared/hooks";
import { HelpTip } from "../../shared/HelpTip";

function CreateModuleTab({ onSave, editingModule, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const ICONS = ["📋","🔥","💪","🧠","⚡","🏥","🦺","🧯","☢️","🌿","🔧","📊","🚧","👁","🩺","🎓","⚠️","🔐","🚨","📡"];
  const CATEGORIES = ["Fire Safety","Physical Safety","Mental Health","Hazardous Substances","Electrical Safety","First Aid","Environmental","Equipment Safety","Manual Handling","General H&S","Food Safety","Compliance","Custom"];
  const LEVELS = ["Mandatory","Recommended","Optional"];
  const BLANK_SLIDE = { heading:"", text:"", video:null, image:null }; // video/image: { name, data/url, type }
  const BLANK_Q = { q:"", options:["","","",""], answer:0 };

  const [step, setStep] = useState("details");
  const [details, setDetails] = useState(editingModule ? {
    title: editingModule.title||"",
    category: editingModule.category||"General H&S",
    level: editingModule.level||"Mandatory",
    duration: editingModule.duration||"30 min",
    icon: editingModule.icon||"📋",
    renewalMonths: editingModule.renewalMonths||12,
    passMark: editingModule.passMark||70,
    description: editingModule.description||"",
  } : { title:"", category:"General H&S", level:"Mandatory", duration:"30 min", icon:"📋", renewalMonths:12 });
  const [slides, setSlides] = useState(editingModule ? (editingModule.slides||editingModule.content||[]).map(s=>({
    heading: s.heading||"",
    text: s.text||s.body||"",
    video: s.video||null,
    image: s.image||null,
  })) : [{ heading:"", text:"", video:null, image:null }]);
  const [quiz, setQuiz] = useState(editingModule ? (editingModule.quiz||[]).map(q=>({...q, options:[...q.options]})) : [{ q:"", options:["","","",""], answer:0 }]);
  const [err, setErr] = useState("");
  const videoInputRefs = useRef({});
  const imageInputRefs = useRef({});

  const inp = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 13px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const lbl = {fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5};
  const steps = [["details","1. Details"],["slides","2. Slides"],["quiz","3. Quiz"],["preview","4. Preview"]];

  function addSlide() { setSlides(p=>[...p, {...BLANK_SLIDE}]); }
  function removeSlide(i) { if(slides.length>1) setSlides(p=>p.filter((_,idx)=>idx!==i)); }
  function updateSlide(i,k,v) { setSlides(p=>p.map((s,idx)=>idx===i?{...s,[k]:v}:s)); }
  function moveSlide(i, dir) {
    setSlides(p=>{
      const a=[...p]; const j=i+dir;
      if(j<0||j>=a.length) return a;
      [a[i],a[j]]=[a[j],a[i]]; return a;
    });
  }

  function addQuestion() { setQuiz(p=>[...p, {...BLANK_Q, options:["","","",""]}]); }
  function removeQuestion(i) { if(quiz.length>1) setQuiz(p=>p.filter((_,idx)=>idx!==i)); }
  function updateQ(i,k,v) { setQuiz(p=>p.map((q,idx)=>idx===i?{...q,[k]:v}:q)); }
  function updateOption(qi,oi,v) { setQuiz(p=>p.map((q,idx)=>idx===qi?{...q,options:q.options.map((o,oidx)=>oidx===oi?v:o)}:q)); }

  function validateAndNext(to) {
    setErr("");
    if(step==="details") {
      if(!details.title.trim()) { setErr("Module title is required."); return; }
    }
    if(step==="slides") {
      if(slides.some(s=>!s.heading.trim())) { setErr("All slides must have a heading."); return; }
      if(slides.some(s=>!s.text.trim()&&!s.video)) { setErr("Each slide must have either content text or a video."); return; }
    }
    if(step==="quiz") {
      for(const q of quiz) {
        if(!q.q.trim()) { setErr("All questions must have question text."); return; }
        if(q.options.some(o=>!o.trim())) { setErr("All answer options must be filled in."); return; }
      }
    }
    setStep(to);
  }

  async function saveModule() {
    // Wait for any in-progress video uploads before saving
    const anyUploading = slides.some(s => s.video && s.video.uploading);
    if (anyUploading) {
      setErr("Please wait — video is still uploading.");
      return;
    }
    // Strip out any video entries that failed (no url and no data)
    const cleanSlides = slides.map(s => ({
      ...s,
      video: s.video && (s.video.url || s.video.data)
        ? { name: s.video.name, type: s.video.type, url: s.video.url || s.video.data, data: s.video.url || s.video.data }
        : null,
    }));
    const newModule = {
      id: editingModule ? editingModule.id : `custom_${Date.now()}`,
      ...details,
      renewalMonths: Number(details.renewalMonths)||12,
      content: cleanSlides,
      quiz: quiz.map(q=>({...q, answer:Number(q.answer)})),
      _custom: true,
    };
    // Save directly to Supabase before updating state
    await sb.from("custom_modules").upsert({ id: newModule.id, data: newModule }, { onConflict: "id" });
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

      {err && <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"10px 16px",color:"#f87171",fontSize:13,marginBottom:16}}>{err}</div>}

      {/* ── STEP 1: Details ── */}
      {step==="details" && (
        <div>
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
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:18}}>
              <div>
                <label style={lbl}>Est. Duration</label>
                <input value={details.duration} onChange={e=>setDetails(p=>({...p,duration:e.target.value}))} placeholder="e.g. 30 min" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Renewal (months)</label>
                <input type="number" min="1" max="120" value={details.renewalMonths} onChange={e=>setDetails(p=>({...p,renewalMonths:e.target.value}))} style={inp}/>
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
                <label style={lbl}>Image (optional)</label>
                {s.image ? (
                  <div style={{background:Z.overlaySm,borderRadius:10,padding:"12px 14px",border:`1px solid ${Z.borderMd}`,display:"flex",alignItems:"center",gap:12}}>
                    <img src={s.image.data||s.image.url} alt={s.image.name} style={{width:64,height:48,objectFit:"cover",borderRadius:6,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:Z.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.image.name}</div>
                      <div style={{fontSize:10,color:Z.muted,marginTop:2}}>✓ Uploaded</div>
                    </div>
                    <button onClick={()=>updateSlide(i,"image",null)} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>Remove</button>
                  </div>
                ) : (
                  <>
                    <input ref={el=>imageInputRefs.current[i]=el} type="file" accept={ACCEPT_IMAGES}
                      style={{display:"none"}}
                      onChange={e=>{
                        const file=e.target.files[0]; if(!file) return;
                        const reader=new FileReader();
                        reader.onload=ev=>updateSlide(i,"image",{name:file.name,type:file.type,data:ev.target.result,url:ev.target.result});
                        reader.readAsDataURL(file);
                        e.target.value="";
                      }}/>
                    <div onClick={()=>imageInputRefs.current[i]&&imageInputRefs.current[i].click()}
                      style={{border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"16px",cursor:"pointer",textAlign:"center",transition:"border-color .2s"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=Z.accent}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=Z.borderMd}>
                      <div style={{fontSize:24,marginBottom:4}}>🖼️</div>
                      <div style={{fontSize:12,fontWeight:700,color:Z.white,marginBottom:2}}>Upload Image</div>
                      <div style={{fontSize:11,color:Z.muted}}>Click to browse · JPG, PNG, GIF, WebP</div>
                    </div>
                  </>
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
                      <div style={{fontSize:10,color:Z.muted,marginTop:2}}>{s.video.uploading ? "Uploading…" : (s.video.url || s.video.data) ? "✓ Uploaded" : ""}</div>
                    </div>
                    <button onClick={()=>updateSlide(i,"video",null)} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>Remove</button>
                  </div>
                ) : (
                  <>
                    <input ref={el=>videoInputRefs.current[i]=el} type="file" accept={ACCEPT_VIDEO}
                      style={{display:"none"}}
                      onChange={async e=>{
                        const file=e.target.files[0]; if(!file) return;
                        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                        const path = `video_${Date.now()}_${safeName}`;
                        updateSlide(i,"video",{name:file.name,type:file.type,data:null,uploading:true});
                        const { error } = await sb.storage.upload("documents", path, file);
                        if (error) { alert("Video upload failed: " + error); updateSlide(i,"video",null); return; }
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
                      <div style={{fontSize:11,color:Z.muted}}>Click to browse · MP4, MOV, WebM</div>
                    </div>
                  </>
                )}
              </div>
              <div>
                <label style={lbl}>Slide Content {s.video?"(optional — shown below video)":"*"}</label>
                <textarea value={s.text} onChange={e=>updateSlide(i,"text",e.target.value)} placeholder={s.video?"Optional supporting text for this slide…":"Write the full content for this slide…"} rows={s.video?3:5} style={{...inp,resize:"vertical",lineHeight:1.6}}/>
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

      {/* ── STEP 3: Quiz ── */}
      {step==="quiz" && (
        <div>
          {quiz.map((q,qi)=>(
            <div key={qi} style={{...cardStyle,border:`1px solid ${Z.borderMd}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <span style={{fontSize:12,fontWeight:700,color:Z.muted,letterSpacing:1,textTransform:"uppercase"}}>Question {qi+1}</span>
                {quiz.length>1 && <button onClick={()=>removeQuestion(qi)} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:font}}>Remove</button>}
              </div>
              <div style={{marginBottom:14}}>
                <label style={lbl}>Question *</label>
                <input value={q.q} onChange={e=>updateQ(qi,"q",e.target.value)} placeholder="e.g. Which legislation governs working at height?" style={inp}/>
              </div>
              <div style={{display:"grid",gap:8,marginBottom:12}}>
                <label style={lbl}>Answer Options * — click the radio to mark the correct answer</label>
                {q.options.map((opt,oi)=>(
                  <div key={oi} style={{display:"flex",alignItems:"center",gap:10}}>
                    <button onClick={()=>updateQ(qi,"answer",oi)}
                      style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${q.answer===oi?Z.accent:Z.borderMd}`,background:q.answer===oi?Z.accent:"transparent",cursor:"pointer",flexShrink:0,transition:"all .15s"}}/>
                    <input value={opt} onChange={e=>updateOption(qi,oi,e.target.value)}
                      placeholder={`Option ${oi+1}`}
                      style={{...inp,borderColor:q.answer===oi?Z.accent:Z.borderMd}}/>
                  </div>
                ))}
              </div>
              <div style={{fontSize:11,color:Z.green,fontWeight:600}}>✓ Correct answer: Option {q.answer+1}{q.options[q.answer]?` — "${q.options[q.answer]}"`:""}</div>
            </div>
          ))}
          <button onClick={addQuestion}
            style={{width:"100%",background:Z.overlay,border:`2px dashed ${Z.borderMd}`,borderRadius:12,padding:"14px",cursor:"pointer",color:Z.muted,fontSize:13,fontWeight:700,fontFamily:font,marginBottom:16,transition:"border-color .2s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=Z.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=Z.borderMd}>
            + Add Question
          </button>
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
                <div style={{color:Z.muted,fontSize:13}}>{details.category} · {details.level} · {details.duration} · Renewal: {details.renewalMonths} months</div>
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:10}}>Slides ({slides.length})</div>
              {slides.map((s,i)=>(
                <div key={i} style={{background:Z.overlaySm,borderRadius:10,padding:"12px 14px",marginBottom:8,border:`1px solid ${Z.border}`}}>
                  <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                    Slide {i+1}: {s.heading}
                    {s.video && <span style={{fontSize:10,fontWeight:700,color:"#a78bfa",background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.3)",borderRadius:6,padding:"2px 7px"}}>🎬 VIDEO</span>}
                  </div>
                  {s.video && <div style={{fontSize:11,color:Z.muted,marginBottom:4}}>📎 {s.video.name}</div>}
                  {s.text && <div style={{fontSize:12,color:Z.muted,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{s.text}</div>}
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:10}}>Quiz ({quiz.length} questions)</div>
              {quiz.map((q,qi)=>(
                <div key={qi} style={{background:Z.overlaySm,borderRadius:10,padding:"12px 14px",marginBottom:8,border:`1px solid ${Z.border}`}}>
                  <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:6}}>Q{qi+1}: {q.q}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                    {q.options.map((o,oi)=>(
                      <div key={oi} style={{fontSize:12,color:oi===q.answer?Z.green:Z.muted,fontWeight:oi===q.answer?700:400}}>
                        {oi===q.answer?"✓ ":""}{o}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
