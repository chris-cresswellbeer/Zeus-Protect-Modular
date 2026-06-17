import React from "react";
import { Pill } from "../../shared/primitives";

function ModulePreviewModal({ m, staff, assigns, comps, isMobile, setAtab, onClose, T, font }) {
  const [previewSlide, setPreviewSlide] = React.useState(0);
  const [previewTab, setPreviewTab] = React.useState("overview");
  const slides = m.slides||m.content||[];
  const quiz = m.quiz||[];
  const assignedCount = staff.filter(u=>(assigns[u.id]||[]).includes(m.id)).length;
  const completedCount = staff.filter(u=>comps[u.id]?.[m.id]).length;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflow:"auto"}}>
      <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:20,width:"100%",maxWidth:680,maxHeight:"90vh",overflow:"auto",border:`1px solid ${T.borderMd}`,boxShadow:"0 32px 80px rgba(0,0,0,0.7)"}}>
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,zIndex:1}}>
          <span style={{fontSize:32,flexShrink:0}}>{m.icon||"📋"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <h3 style={{margin:0,fontSize:18,fontWeight:900,color:T.white}}>{m.title}</h3>
              <Pill label={m.level} col={m.level==="Mandatory"?"red":"navy"}/>
              {m._custom && <Pill label="Custom" col="amber"/>}
            </div>
            <p style={{margin:"3px 0 0",fontSize:12,color:T.muted}}>{m.category} · {m.duration} · {quiz.length} questions · {m.renewalMonths?`Renews every ${m.renewalMonths} months`:"No renewal"}</p>
          </div>
          <button onClick={onClose} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"8px 14px",color:T.muted,cursor:"pointer",fontFamily:font,fontSize:13,fontWeight:700,flexShrink:0}}>✕ Close</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border}}>
          {[{label:"Assigned",value:assignedCount,color:T.accentLt},{label:"Completed",value:completedCount,color:T.green},{label:"Slides",value:slides.length,color:"#a78bfa"},{label:"Pass Mark",value:`${m.passMark||70}%`,color:T.gold}].map((s,i)=>(
            <div key={i} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,padding:"12px 16px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:900,color:s.color}}>{s.value}</div>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,padding:"0 24px"}}>
          {[["overview",E("📋 ","")+"Overview"],["slides",E("🖼 ","")+`Slides (${slides.length})`],["quiz",E("❓ ","")+`Quiz (${quiz.length})`]].map(([id,label])=>(
            <button key={id} onClick={()=>{setPreviewTab(id);setPreviewSlide(0);}} style={{padding:"12px 16px",background:"none",border:"none",borderBottom:`2px solid ${previewTab===id?T.gold:"transparent"}`,color:previewTab===id?T.white:T.muted,fontWeight:previewTab===id?700:400,cursor:"pointer",fontFamily:font,fontSize:13}}>{label}</button>
          ))}
        </div>
        <div style={{padding:24}}>
          {previewTab==="overview" && (
            <div>
              {m.description && <p style={{color:T.muted,fontSize:14,marginBottom:20,lineHeight:1.6}}>{m.description}</p>}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:20}}>
                {[{label:"Category",value:m.category||"—"},{label:"Duration",value:m.duration||"—"},{label:"Level",value:m.level||"—"},{label:"Pass Mark",value:`${m.passMark||70}%`},{label:"Renewal",value:m.renewalMonths?`Every ${m.renewalMonths} months`:"Not required"},{label:"Questions",value:`${quiz.length} multiple choice`}].map((row,i)=>(
                  <div key={i} style={{background:T.overlay,borderRadius:10,padding:"10px 14px",border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{row.label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:T.white}}>{row.value}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button onClick={()=>{onClose();setAtab("assign");}} style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>→ Go to Assign Training</button>
                <button onClick={()=>setPreviewTab("slides")} disabled={slides.length===0} style={{background:T.overlay,color:slides.length===0?T.muted:T.accentLt,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 18px",cursor:slides.length===0?"not-allowed":"pointer",fontFamily:font,fontWeight:700,fontSize:13,opacity:slides.length===0?.5:1}}>🖼 Preview Slides</button>
              </div>
            </div>
          )}
          {previewTab==="slides" && (
            <div>
              {slides.length===0 ? <div style={{textAlign:"center",padding:"32px 0",color:T.muted,fontSize:14}}>No slides in this module.</div> : <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <button onClick={()=>setPreviewSlide(p=>Math.max(0,p-1))} disabled={previewSlide===0} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",color:previewSlide===0?T.muted:T.white,cursor:previewSlide===0?"not-allowed":"pointer",fontFamily:font,fontWeight:700,fontSize:13,opacity:previewSlide===0?.4:1}}>← Prev</button>
                  <span style={{fontSize:13,color:T.muted,fontWeight:600}}>Slide {previewSlide+1} of {slides.length}</span>
                  <button onClick={()=>setPreviewSlide(p=>Math.min(slides.length-1,p+1))} disabled={previewSlide===slides.length-1} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",color:previewSlide===slides.length-1?T.muted:T.white,cursor:previewSlide===slides.length-1?"not-allowed":"pointer",fontFamily:font,fontWeight:700,fontSize:13,opacity:previewSlide===slides.length-1?.4:1}}>Next →</button>
                </div>
                <div style={{background:T.overlay,borderRadius:14,padding:24,border:`1px solid ${T.borderMd}`,minHeight:200}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>{slides[previewSlide].type?.toUpperCase()||"CONTENT"} SLIDE</div>
                  {slides[previewSlide].heading && <h4 style={{margin:"0 0 12px",fontSize:18,fontWeight:800,color:T.white}}>{slides[previewSlide].heading}</h4>}
                  {(slides[previewSlide].body||slides[previewSlide].text) && <p style={{color:T.muted,fontSize:14,lineHeight:1.7,margin:0,whiteSpace:"pre-wrap"}}>{slides[previewSlide].body||slides[previewSlide].text}</p>}
                  {(slides[previewSlide].image?.data||slides[previewSlide].image?.url||slides[previewSlide].imageData) && <img src={slides[previewSlide].image?.data||slides[previewSlide].image?.url||slides[previewSlide].imageData} alt="" style={{maxWidth:"100%",borderRadius:10,marginTop:12}}/>}
                  {slides[previewSlide].videoUrl && <video controls style={{width:"100%",borderRadius:10,marginTop:12}}><source src={slides[previewSlide].videoUrl}/></video>}
                </div>
                <div style={{display:"flex",gap:6,marginTop:12,overflowX:"auto",paddingBottom:4}}>
                  {slides.map((_,i)=>(<button key={i} onClick={()=>setPreviewSlide(i)} style={{flexShrink:0,width:44,height:32,borderRadius:6,border:`2px solid ${previewSlide===i?T.accent:T.border}`,background:previewSlide===i?"rgba(37,99,235,0.15)":T.overlay,cursor:"pointer",fontSize:10,color:previewSlide===i?T.accentLt:T.muted,fontWeight:previewSlide===i?700:400}}>{i+1}</button>))}
                </div>
              </>}
            </div>
          )}
          {previewTab==="quiz" && (
            <div>
              {quiz.length===0 ? <div style={{textAlign:"center",padding:"32px 0",color:T.muted,fontSize:14}}>No quiz questions.</div> :
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div style={{padding:"10px 14px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,fontSize:12,color:T.gold}}>⚠ Admin preview — correct answers highlighted in green</div>
                  {quiz.map((q,qi)=>(
                    <div key={qi} style={{background:T.overlay,borderRadius:12,padding:"16px 18px",border:`1px solid ${T.border}`}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.white,marginBottom:12}}>Q{qi+1}. {q.q}</div>
                      <div style={{display:"flex",flexDirection:"column",gap:7}}>
                        {q.options.map((opt,oi)=>(<div key={oi} style={{padding:"8px 12px",borderRadius:8,fontSize:12,background:oi===q.answer?"rgba(16,185,129,0.12)":T.overlaySm,border:`1px solid ${oi===q.answer?"rgba(16,185,129,0.35)":T.border}`,color:oi===q.answer?T.green:T.muted,fontWeight:oi===q.answer?700:400}}>{oi===q.answer?"✓ ":""}{opt}</div>))}
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ModulePreviewModal };
