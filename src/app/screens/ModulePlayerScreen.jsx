/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/screens/ModulePlayerScreen.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * The training module player: intro, slides, quiz, result.
 *
 * Reads the app's shared state and actions with useApp() (app/AppContext.js). Moved out of
 * App.jsx in October 2026 without changing what it shows.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useEffect } from "react";
import { passMarkOf } from "../../domains/training/completion";
import { allAnswered, drawQuiz, initialAnswers, markAttempt, quizSettings, speakText } from "../../domains/training/quizEngine";
import { QuestionView, ReviewCard, SignoffPanel, SlideCheck } from "../../domains/training/QuizBits";
import { isHtmlContent } from "../../domains/training/slideTextUtils";
import { todayISO } from "../../lib/dates";
import { t, tNodes } from "../../lib/i18n";
import { clearProgress, getProgress, resumeLabel } from "../../lib/moduleProgress";
import { localiseModule, translationKey } from "../../lib/moduleTranslate";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { ReadAloud, TranslationNote } from "../../shared/LanguageBits";
import { BrandLogo } from "../../shared/Logo";
import { SlideVideo } from "../../shared/SlideVideo";
import { useApp } from "../AppContext";
import { CertificateModal, HotspotActivity } from "../lazyParts";

// Full-screen module player. Step numbering:
//   0 = intro card, 1..totalSlides = content slides, quizStep (= totalSlides+1) = quiz.
// Slides may contain: heading, images[] (or legacy single `image`), video, text
// (plain text or sanitised HTML), and hotspots (click-the-hazard activity).
// Hotspot slides block "Next" until HotspotActivity reports completion, and a slide with a
// knowledge check (slide.check) until it has been answered right (QuizBits.jsx SlideCheck).
// The quiz step shows the sign-off declaration first when the module has one (module.signoff);
// a module with a declaration and no questions is complete once it is signed. The questions
// asked are drawn for each attempt (qdraw — quizEngine.js drawQuiz: a question bank and/or shuffled).
export function ModulePlayerScreen() {
  const {
    cert, comps, darkMode, font, hotspotComplete, lightboxSrc, lightboxZoomed, mod, moduleTrans, playEnglish,
    pmod, qans, qdraw, qextra, qsub, quizStep, setQdraw, setQextra, setCert, setHotspotComplete, setLightboxSrc, setLightboxZoomed, setMod,
    setPlayEnglish, setQans, setQsub, setShowCelebration, setStep, showCelebration, step, submitQuiz, T,
    totalSlides, user, userLang
  } = useApp();
  const isIntro = step===0;
  const isQuiz  = step===quizStep;
  const slide   = (!isIntro && !isQuiz) ? pmod.content[step-1] : null;
  const translated = !!(pmod && pmod._trans);                       // shown in French / Polish / Romanian
  const hasTranslation = translated || (playEnglish && !!localiseModule(mod, userLang, moduleTrans[translationKey(mod.id, userLang)])._trans);
  // A slide imported from PowerPoint (images[0].deck, see slideImport.js) is shown large:
  // wider column, less padding, a small heading (the title is in the picture) and the
  // picture sized to fit the screen height. Hotspot slides keep the normal layout.
  const isDeck  = !!(slide && (slide.images||[])[0] && slide.images[0].deck && !(slide.hotspots&&slide.hotspots.length>0));

  const hasQuiz  = (mod.quiz||[]).length>0;
  const needSign = !!(mod.signoff && mod.signoff.text);
  const signed   = !!(qextra && qextra.signoff);
  const checks   = (qextra && qextra.checks) || {};
  const draw     = qdraw || [];
  const signOnly = !hasQuiz && needSign;
  // A new set of questions each attempt (and "put in order" questions start as shown).
  useEffect(() => {
    if (isQuiz && !qsub && !qdraw && hasQuiz) { const d = drawQuiz(mod); setQdraw(d); setQans(initialAnswers(mod, d)); }
  }, [isQuiz, qsub, qdraw, hasQuiz, mod]); // eslint-disable-line react-hooks/exhaustive-deps
  const slideCheckDone = slide && slide.check ? checks[step-1] != null : true;
  const retake = () => { setStep(1); setQans({}); setQsub(false); setQdraw(null); setQextra({ checks: {}, signoff: null }); window.scrollTo({top:0,behavior:"smooth"}); };

  let qScore=0, qPct=0, passed=false, qTotal=0, qItems=[];
  if (qsub) {
    const m = markAttempt(mod, draw, qans);
    qScore = m.correct; qPct = m.pct; qTotal = m.total; qItems = m.items;
    passed = qPct>=passMarkOf(mod);
  }

  return (
    <>
    {/* Certificate from "View Certificate" after a pass — this screen must render it
        itself, because the staff views (which also show it) aren't on screen here. */}
    {cert && <CertificateModal cert={cert} user={user} onClose={() => setCert(null)} T={T} font={font}/>}
    <div className="zp-shell" style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.white,overflowX:"hidden"}}>

      {/* Celebration Overlay */}
      {showCelebration && (
        <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)"}}>
          {/* Confetti */}
          <style>{`
              @keyframes confettiFall {
                0%   { transform: translateY(-20px) rotate(0deg);   opacity:1; }
                100% { transform: translateY(110vh) rotate(720deg); opacity:0; }
              }
              @keyframes certBounce {
                0%   { transform: scale(0.5) translateY(40px); opacity:0; }
                60%  { transform: scale(1.05) translateY(-8px); opacity:1; }
                100% { transform: scale(1) translateY(0);       opacity:1; }
              }
              @keyframes sealPulse {
                0%,100% { transform: scale(1);    opacity:1; }
                50%      { transform: scale(1.12); opacity:.85; }
              }
              @keyframes shimmer {
                0%   { background-position: -200% center; }
                100% { background-position:  200% center; }
              }
            `}</style>
          {/* NB: Math.random() runs on every render, so confetti re-shuffles if the component re-renders. Purely cosmetic. */}
          {/* Confetti pieces */}
          {Array.from({length:60}).map((_,i)=>{
            const colors=["#f59e0b","#ffffff","#0d1f5c","#2563eb","#10b981","#f97316","#a78bfa"];
            const size=Math.random()*10+4;
            const left=Math.random()*100;
            const delay=Math.random()*2;
            const dur=Math.random()*2+2;
            const color=colors[Math.floor(Math.random()*colors.length)];
            const isRect=Math.random()>0.5;
            return (
              <div key={i} style={{
                position:"fixed",
                left:`${left}%`,
                top:"-20px",
                width:isRect?size:size/2,
                height:size,
                background:color,
                borderRadius:isRect?2:"50%",
                animation:`confettiFall ${dur}s ${delay}s ease-in forwards`,
                zIndex:501,
                pointerEvents:"none",
              }}/>
            );
          })}

          {/* Certificate card */}
          <div style={{animation:"certBounce .6s .3s cubic-bezier(.34,1.56,.64,1) both",zIndex:502,width:"100%",maxWidth:440,margin:"0 16px"}}>
            <div style={{
              background:"linear-gradient(160deg,#0d1f5c,#091548)",
              borderRadius:20,
              padding:"32px 36px",
              border:"2px solid rgba(245,158,11,0.5)",
              boxShadow:"0 0 0 4px rgba(245,158,11,0.08), 0 40px 80px rgba(0,0,0,0.8)",
              textAlign:"center",
              position:"relative",
              overflow:"hidden",
            }}>
              {/* Shimmer bar */}
              <div style={{
                position:"absolute",top:0,left:0,right:0,height:4,
                background:"linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b,#fbbf24)",
                backgroundSize:"200% auto",
                animation:"shimmer 2s linear infinite",
              }}/>
              {/* Corner ornaments */}
              {[["top:10px","left:10px"],["top:10px","right:10px"],["bottom:10px","left:10px"],["bottom:10px","right:10px"]].map((pos,ci)=>{
                const transforms=["none","rotate(90deg)","rotate(-90deg)","rotate(180deg)"];
                const s={position:"absolute",width:16,height:16,zIndex:1,opacity:.6};
                pos.forEach(p=>{const[k,v]=p.split(":");s[k]=v;});
                return (<svg key={ci} style={{...s,transform:transforms[ci]}} viewBox="0 0 16 16"><path d="M0,0 L12,0 L12,2 L2,2 L2,12 L0,12 Z" fill="#f59e0b"/></svg>);
              })}

              <div style={{fontSize:56,marginBottom:8,animation:"sealPulse 1.5s ease-in-out infinite"}}>{mod?.icon||"🏅"}</div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:"rgba(245,158,11,0.8)",textTransform:"uppercase",marginBottom:4}}>{t("Certificate of Completion")}</div>
              <div style={{fontSize:26,fontWeight:900,color:"#fff",marginBottom:4,letterSpacing:-.5}}>{user?.name}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:16}}>{t("has successfully completed")}</div>
              <div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:"12px 20px",marginBottom:20}}>
                <div style={{fontSize:18,fontWeight:800,color:"#f59e0b"}}>{pmod?.title}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginTop:4}}>{signOnly ? <span style={{color:"#10b981",fontWeight:700}}>✍ {t("Signed")}</span> : tNodes("Score: {pct}", { pct: <span style={{color:"#10b981",fontWeight:700}}>{qPct}%</span> })}</div>
              </div>

              <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                <button onClick={()=>{
                  setShowCelebration(false);
                  setCert({module:mod,score:qPct,date:(comps[user.id]||{})[mod.id]?.date||todayISO(),certId:(comps[user.id]||{})[mod.id]?.certId||null,moduleVersion:(comps[user.id]||{})[mod.id]?.moduleVersion||mod.version||1});
                }} style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#0d1f5c",border:"none",borderRadius:10,padding:"10px 22px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:13}}>
                  🎓 {t("View Certificate")}
                </button>
                <button onClick={()=>setShowCelebration(false)}
                  style={{background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"10px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
                  {t("Continue")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:`linear-gradient(90deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",alignItems:"center",gap:16}}>
        <BrandLogo darkMode={darkMode}/>
        <div style={{width:1,height:28,background:T.headerBgMd,margin:"0 8px"}}/>
        <button onClick={()=>setMod(null)} style={{background:T.headerBgMd,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"6px 14px",color:T.muted,cursor:"pointer",fontWeight:700,fontFamily:font,fontSize:12}}>← {t("Back")}</button>
        <span style={{fontSize:18}}>{mod.icon}</span>
        <h2 style={{margin:0,fontSize:15,fontWeight:700}}>{pmod.title}</h2>
        {hasTranslation && (
          <button onClick={()=>setPlayEnglish(v=>!v)} data-testid="show-english"
            style={{marginLeft:"auto",background:T.headerBgMd,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"6px 12px",color:T.muted,cursor:"pointer",fontWeight:700,fontFamily:font,fontSize:12}}>
            {playEnglish ? t("Show in my language") : "Show in English"}
          </button>
        )}
        <div style={{marginLeft:hasTranslation?12:"auto",color:T.muted,fontSize:12,letterSpacing:.5}}>{t("STEP {n} / {of}", { n: step, of: quizStep })}</div>
      </div>
      {/* Progress strip */}
      <div style={{height:3,background:T.headerBgMd}}>
        <div style={{height:"100%",background:`linear-gradient(90deg,${T.accent},${T.accentLt})`,width:`${(step/quizStep)*100}%`,transition:"width .4s"}}/>
      </div>

      <div style={{maxWidth:isDeck?1280:720,margin:"0 auto",padding:isDeck?"20px 24px":"44px 24px"}}>

        {isIntro && (
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:72,marginBottom:16}}>{mod.icon}</div>
            <h1 style={{fontSize:32,fontWeight:900,letterSpacing:-1,marginBottom:6}}>{pmod.title}</h1>
            <p style={{color:T.muted,fontSize:15,marginBottom:28}}>{t(mod.category)} · {t(mod.duration)} · <span style={{color:mod.level==="Mandatory"?"#f87171":T.accentLt}}>{t(mod.level)}</span> · {t("{n} slides", { n: totalSlides })}{hasQuiz && <> · {t("{n} quiz questions", { n: quizSettings(mod).draw })}</>}{needSign && <> · ✍ {t("Signed declaration")}</>}</p>
            {translated && <TranslationNote status={pmod._trans.status} Z={T} font={font} style={{marginBottom:16,textAlign:"left"}}/>}
            <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:28,textAlign:"left",border:`1px solid ${T.border}`}}>
              <p style={{margin:0,color:T.slate,lineHeight:1.8,fontSize:15}}>{signOnly ? t("Read through each slide carefully, then sign the declaration at the end to complete the module.") : tNodes("Read through each slide carefully, then complete the knowledge check. A score of {pct} is required to pass and receive your certificate.", { pct: <strong style={{color:T.green}}>{t("{n}% or above", { n: passMarkOf(mod) })}</strong> })}</p>
            </div>
            {(()=>{ const p = getProgress(user.id, mod); if (!p) return null; return (
              <div style={{marginTop:28,display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",alignItems:"center"}} data-testid="resume">
                <button onClick={()=>{setStep(p.step);window.scrollTo({top:0,behavior:"smooth"});}} data-testid="resume-btn"
                  style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:12,padding:"14px 36px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:font,boxShadow:`0 6px 24px ${T.accent}55`}}>
                  {t(resumeLabel(p))} →
                </button>
                <button onClick={()=>{clearProgress(user.id, mod);setStep(1);window.scrollTo({top:0,behavior:"smooth"});}} data-testid="restart-btn"
                  style={{background:"transparent",color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:12,padding:"13px 24px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:font}}>
                  {t("Start from the beginning")}
                </button>
                <div style={{width:"100%",fontSize:12,color:T.muted}}>{p.quiz ? t("You got to the quiz last time ({date}).", { date: new Date(p.at).toLocaleDateString("en-GB",{day:"numeric",month:"short"}) }) : t("You got to slide {n} of {of} last time ({date}).", { n: p.step, of: p.of, date: new Date(p.at).toLocaleDateString("en-GB",{day:"numeric",month:"short"}) })}</div>
              </div>); })()}
            {!getProgress(user.id, mod) && <button onClick={()=>{setStep(1);window.scrollTo({top:0,behavior:"smooth"});}} style={{marginTop:32,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:12,padding:"14px 44px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:font,boxShadow:`0 6px 24px ${T.accent}55`,letterSpacing:.5}}>
              {t("Begin Module →")}
            </button>}
          </div>
        )}

        {slide && (
          <div>
            <div data-testid="slide-card" data-deck={isDeck?"1":undefined} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:20,padding:isDeck?"16px 20px 20px":40,border:`1px solid ${T.border}`,boxShadow:"0 8px 40px rgba(0,0,0,.4)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isDeck?10:20}}>
                <div style={{color:T.muted,fontSize:11,fontWeight:800,letterSpacing:2,display:"flex",alignItems:"center",gap:10}}>{t("SLIDE {n} OF {of}", { n: step, of: totalSlides })}
                  <ReadAloud text={[slide.heading, slide.text].filter(Boolean).join(". \n")} lang={translated ? userLang : "en"} Z={T} font={font} compact/></div>
                <div style={{display:"flex",gap:4}}>
                  {Array.from({length:totalSlides}).map((_,i)=>(
                    <div key={i} style={{width:i===step-1?20:6,height:6,borderRadius:99,background:i===step-1?T.accentLt:T.borderMd,transition:"width .3s"}}/>
                  ))}
                </div>
              </div>
              {slide.heading && (
                <h2 style={isDeck
                  ? {fontSize:15,fontWeight:800,color:T.muted,margin:"0 0 10px",letterSpacing:-.2}
                  : {fontSize:22,fontWeight:900,color:T.white,margin:"0 0 18px",letterSpacing:-.5,paddingBottom:14,borderBottom:`1px solid ${T.borderMd}`}}>
                  {slide.heading}
                </h2>
              )}
              {((slide.images||[]).length>0 || slide.image?.data || slide.image?.url) && !(slide.hotspots&&slide.hotspots.length>0) && (
                <div style={{marginBottom:20,display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center"}}>
                  {/* new images[] array */}
                  {/* deck: a whole PowerPoint slide imported from a PDF — shown full width */}
                  {(slide.images||[]).map((img,ii)=>(
                    <img key={ii} src={img.url||img.data} alt={img.deck ? (slide.heading||"Slide") : (img.name||"")} onClick={()=>{setLightboxSrc(img.url||img.data);setLightboxZoomed(false);}}
                      style={img.deck
                        ? {maxWidth:"100%",maxHeight:"max(260px, calc(100vh - 250px))",width:"auto",height:"auto",borderRadius:10,border:`1px solid ${T.borderMd}`,cursor:"zoom-in",background:"#fff",display:"block"}
                        : {maxWidth:"100%",flex:"1 1 220px",maxHeight:360,borderRadius:12,border:`1px solid ${T.borderMd}`,objectFit:"contain",cursor:"zoom-in"}}/>
                  ))}
                  {/* backwards compat: old single image field */}
                  {(slide.images||[]).length===0 && (slide.image?.data||slide.image?.url) && (
                    <img src={slide.image.data||slide.image.url} alt={slide.image.name||""} onClick={()=>{setLightboxSrc(slide.image.data||slide.image.url);setLightboxZoomed(false);}}
                      style={{maxWidth:"100%",maxHeight:360,borderRadius:12,border:`1px solid ${T.borderMd}`,objectFit:"contain",cursor:"zoom-in"}}/>
                  )}
                </div>
              )}
              {/* uploaded file, or a YouTube / Vimeo / Stream link (shared/SlideVideo.jsx) */}
              {slide.video && <SlideVideo video={slide.video} Z={T} style={{marginBottom:20}}/>}
              {/* Rich (HTML) text is ALWAYS passed through sanitizeHtml before rendering. Plain text is split on ". " and lines like "Step 2: ..." become numbered badges. */}
              {slide.text && (
                isHtmlContent(slide.text) ? (
                  <div className="rte-content" style={{fontSize:15,lineHeight:1.9,color:T.slate}} dangerouslySetInnerHTML={{__html: sanitizeHtml(slide.text)}}/>
                ) : (
                  <div style={{fontSize:15,lineHeight:1.9,color:T.slate}}>
                    {slide.text.split(". ").map((sentence,i,arr)=>{
                      const trimmed = sentence.trim();
                      const stepMatch = trimmed.match(/^(Step\s)?(\d+)[.:\)]\s*(.*)/);
                      if (stepMatch) return (
                        <div key={i} style={{display:"flex",gap:12,marginBottom:10,alignItems:"flex-start"}}>
                          <span style={{background:T.accent,color:"#fff",borderRadius:6,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,flexShrink:0,marginTop:1}}>{stepMatch[2]}</span>
                          <span>{stepMatch[3]}</span>
                        </div>
                      );
                      const full = sentence + (i<arr.length-1?". ":"");
                      return <p key={i} style={{margin:"0 0 10px"}}>{full}</p>;
                    })}
                  </div>
                )
              )}
              {slide.hotspots && slide.hotspots.length>0 && (
                <HotspotActivity
                  imageUrl={(slide.images&&slide.images[0]&&(slide.images[0].url||slide.images[0].data))||slide.image?.url||slide.image?.data}
                  instructions={slide.hotspotInstructions||t("Click every hazard you can find in the image above.")}
                  hotspots={slide.hotspots}
                  passThreshold={1}
                  onStatusChange={complete=>setHotspotComplete(prev=>prev[step]===complete?prev:{...prev,[step]:complete})}
                  Z={T} font={font}
                />
              )}
              {slide.check && (
                <SlideCheck key={`${step}-${playEnglish?"en":"x"}`} q={slide.check} passed={checks[step-1]!=null}
                  onPassed={n=>setQextra(e=>({...e,checks:{...(e.checks||{}),[step-1]:n}}))} Z={T} font={font}/>
              )}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:24,gap:12}}>
              <button onClick={()=>{setStep(s=>s-1);window.scrollTo({top:0,behavior:"smooth"});}} disabled={step===1}
                style={{background:T.headerBgMd,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 28px",color:T.muted,cursor:"pointer",fontWeight:700,fontFamily:font,opacity:step===1?.4:1}}>← {t("Previous")}</button>
              <button onClick={()=>{setStep(s=>s+1);window.scrollTo({top:0,behavior:"smooth"});}}
                disabled={(slide.hotspots&&slide.hotspots.length>0&&!hotspotComplete[step]) || !slideCheckDone} data-testid="next-slide"
                style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,border:"none",borderRadius:10,padding:"10px 28px",color:T.white,cursor:"pointer",fontWeight:800,fontFamily:font,boxShadow:`0 4px 16px ${T.accent}44`,opacity:((slide.hotspots&&slide.hotspots.length>0&&!hotspotComplete[step]) || !slideCheckDone)?.4:1}}>
                {step===totalSlides?(needSign&&!signed?t("Next: the declaration →"):t("Take Quiz →")):t("Next Slide →")}
              </button>
            </div>
          </div>
        )}

        {isQuiz && !qsub && needSign && !signed && (
          <div>
            <h2 style={{fontSize:24,fontWeight:900,marginBottom:4,letterSpacing:-.5}}>{t("Sign the declaration")}</h2>
            <p style={{color:T.muted,marginBottom:20,fontSize:14}}>{hasQuiz ? t("Sign to confirm, then take the quiz.") : t("Sign to confirm and complete the module.")}</p>
            <SignoffPanel text={(pmod.signoff||mod.signoff).text} english={mod.signoff.text} userName={user.name}
              buttonLabel={hasQuiz ? t("Sign and go to the quiz →") : t("Sign and finish")}
              onSign={s=>{ setQextra(e=>({...e,signoff:s})); if(!hasQuiz) submitQuiz({ signoff: s }); window.scrollTo({top:0,behavior:"smooth"}); }}
              Z={T} font={font}/>
          </div>
        )}

        {isQuiz && !qsub && hasQuiz && (!needSign || signed) && (
          <div>
            <h2 style={{fontSize:24,fontWeight:900,marginBottom:4,letterSpacing:-.5}}>{t("Knowledge Check")}</h2>
            <p style={{color:T.muted,marginBottom:28,fontSize:14}}>{t("{n} questions · {pct}% needed to pass", { n: draw.length, pct: passMarkOf(mod) })}</p>
            {draw.map((d,k)=>{ const q = pmod.quiz[d.qi]; return (
              <div key={d.qi} data-testid="quiz-q" style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:14,border:`1px solid ${T.border}`}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",justifyContent:"space-between"}}>
                  <p style={{fontWeight:700,margin:0,fontSize:15}}><span style={{color:T.accentLt}}>Q{k+1}.</span> {q.q}</p>
                  <ReadAloud text={speakText(q, d.order)} lang={translated ? userLang : "en"} Z={T} font={font} compact/>
                </div>
                <QuestionView q={q} order={d.order} value={qans[d.qi]} onChange={v=>setQans(a=>({...a,[d.qi]:v}))} Z={T} font={font} hideTitle/>
              </div>
            ); })}
            <button onClick={()=>submitQuiz()} disabled={!draw.length || !allAnswered(mod, draw, qans)} data-testid="submit-quiz"
              style={{width:"100%",marginTop:8,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:12,padding:"14px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:font,opacity:!draw.length || !allAnswered(mod, draw, qans)?.45:1,boxShadow:`0 4px 20px ${T.accent}44`}}>
              {t("Submit Quiz")}
            </button>
          </div>
        )}

        {isQuiz && qsub && (
          <div>
            <div style={{textAlign:"center",marginBottom:32}}>
              <div style={{fontSize:72,marginBottom:16}}>{passed?"🏆":"📖"}</div>
              <h2 style={{fontSize:36,fontWeight:900,color:passed?T.green:T.amber,letterSpacing:-1}}>{signOnly?t("Signed — thank you"):passed?t("Passed!"):t("Not Quite")}</h2>
              {!signOnly && <div style={{fontSize:60,fontWeight:900,color:T.white,margin:"8px 0",fontFamily:"'Barlow Condensed',sans-serif"}}>{qPct}%</div>}
              {!signOnly && <p style={{color:T.muted}}>{t("{n} of {of} correct", { n: qScore, of: qTotal })}</p>}
              {!passed && <p style={{color:T.amber,marginTop:6}}>{t("You need {pct}% to pass. Review the slides and try again.", { pct: passMarkOf(mod) })}</p>}
              <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:28,flexWrap:"wrap"}}>
                {passed && (
                  <button onClick={()=>setCert({module:mod,score:qPct,date:(comps[user.id]||{})[mod.id]?.date||todayISO(),certId:(comps[user.id]||{})[mod.id]?.certId||null,moduleVersion:(comps[user.id]||{})[mod.id]?.moduleVersion||mod.version||1})}
                    style={{background:`linear-gradient(135deg,${T.gold},#d97706)`,color:T.navyDk,border:"none",borderRadius:12,padding:"12px 28px",fontWeight:800,cursor:"pointer",fontFamily:font}}>
                    🎓 {t("View Certificate")}
                  </button>
                )}
                {!passed && (
                  <button onClick={retake} data-testid="retake"
                    style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:12,padding:"12px 28px",fontWeight:800,cursor:"pointer",fontFamily:font}}>
                    {t("Retake Module")}
                  </button>
                )}
                <button onClick={()=>setMod(null)} style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:12,padding:"12px 28px",fontWeight:700,cursor:"pointer",fontFamily:font}}>
                  {t("Back to Dashboard")}
                </button>
              </div>
            </div>
            {/* Answer review: this attempt's questions, in the order they were asked (QuizBits.jsx ReviewCard) */}
            {qItems.length>0 && (
            <div>
              <h3 style={{fontSize:14,fontWeight:800,letterSpacing:.5,color:T.muted,textTransform:"uppercase",marginBottom:16}}>{t("Answer Review")}</h3>
              {qItems.map((it,k)=>(
                <ReviewCard key={it.qi} q={pmod.quiz[it.qi]} given={it.given} ok={it.ok} number={k+1} Z={T} font={font}/>
              ))}
            </div>
            )}
          </div>
        )}
      </div>
    </div>
    {/* Click the backdrop to close; click the image to toggle 1:1 zoom (scrollable). */}
    {/* Lightbox overlay */}
    {lightboxSrc && (
      <div
        onClick={()=>{setLightboxSrc(null);setLightboxZoomed(false);}}
        onKeyDown={e=>e.key==="Escape"&&(setLightboxSrc(null),setLightboxZoomed(false))}
        tabIndex={-1}
        style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:lightboxZoomed?0:20,cursor:lightboxZoomed?"zoom-out":"default",overflow:lightboxZoomed?"auto":"hidden"}}
      >
        <button
          onClick={e=>{e.stopPropagation();setLightboxSrc(null);setLightboxZoomed(false);}}
          style={{position:"fixed",top:18,right:22,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:99,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,cursor:"pointer",fontWeight:700,lineHeight:1,zIndex:2001}}
        >✕</button>
        {!lightboxZoomed && (
          <div style={{position:"fixed",bottom:22,left:0,right:0,textAlign:"center",color:"rgba(255,255,255,0.55)",fontSize:12,fontWeight:600,pointerEvents:"none"}}>
            {t("Click image to zoom in")}
          </div>
        )}
        <img
          src={lightboxSrc}
          alt=""
          onClick={e=>{e.stopPropagation();setLightboxZoomed(z=>!z);}}
          style={lightboxZoomed
            ? {width:"auto",height:"auto",maxWidth:"none",maxHeight:"none",borderRadius:0,cursor:"zoom-out",display:"block"}
            : {maxWidth:"100%",maxHeight:"90vh",borderRadius:10,boxShadow:"0 24px 80px rgba(0,0,0,0.8)",objectFit:"contain",cursor:"zoom-in"}}
        />
      </div>
    )}
    </>
  );
}
