// src/mobile/screens/ModulePlayer.jsx
//
// The training loop: intro → slides → (sign-off declaration) → one-question-at-a-time quiz → result.
// Every question type, slide knowledge checks and the declaration use the same parts as the
// computer (domains/training/QuizBits.jsx) and the same marking (quizEngine.js).
//
// The single meaningful departure from the desktop player (app/screens/ModulePlayerScreen.jsx) is the
// quiz: the desktop stacks every question on one scroll, which does not survive
// a phone. Scoring uses the module's pass mark (70% unless set otherwise), unlimited retakes, answer review.
//
// Slide progress is reported upward on every step so it can be persisted and
// resumed after the app is killed.

import React from "react";
import { Screen, PrimaryButton, GhostButton } from "../ui";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { isHtmlContent, ensureRteStyles } from "../../domains/training/slideTextUtils";
import { useFileUrl } from "../../lib/fileAccess";
import { videoSource } from "../../lib/videoLink";

// Must match the desktop pass mark in app/actions/player.js submitQuiz (also 70).
import { PASS_MARK, passMarkOf } from "../../domains/training/completion";

import { todayISO } from "../../lib/dates";
import { certNumber } from "../../lib/brandCore";
import { t, tNodes } from "../../lib/i18n";
import { ReadAloud, TranslationNote } from "../../shared/LanguageBits";
import { allAnswered, attemptRecord, drawQuiz, initialAnswers, isAnswered, markAttempt, quizSettings, speakText } from "../../domains/training/quizEngine";
import { QuestionView, ReviewCard, SignoffPanel, SlideCheck } from "../../domains/training/QuizBits";
function ModulePlayer({
  mod: shownMod, user, initialSlide = 0, offline, language = "en",
  onExit, onProgress, onComplete,
  Z, font,
}) {
  // A translated module (lib/moduleTranslate.js) carries the English as _en: "Show in English"
  // swaps to it. Slides, answers and marking are the same in both.
  const [showEnglish, setShowEnglish] = React.useState(false);
  const translated = !!(shownMod._trans && !showEnglish);
  const mod = showEnglish && shownMod._en ? shownMod._en : shownMod;
  const speechLang = translated ? language : "en";
  const slides = mod.content || [];
  const quiz = mod.quiz || [];
  const passMark = passMarkOf(mod);   // this module's pass mark (default 70%)
  const hasQuiz = quiz.length > 0;
  const needSign = !!(mod.signoff && mod.signoff.text);
  const signOnly = !hasQuiz && needSign;

  // stage: "intro" | "slide" | "signoff" | "quiz" | "result"
  const [stage, setStage] = React.useState(initialSlide > 0 ? "slide" : "intro");
  const [slide, setSlide] = React.useState(Math.max(1, initialSlide));
  const [qIdx, setQIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({});   // { [qi]: answer } for this attempt
  const [draw, setDraw] = React.useState(null);       // this attempt's questions (quizEngine drawQuiz)
  const [checks, setChecks] = React.useState({});     // { [slide index]: tries } knowledge checks answered right
  const [signoff, setSignoff] = React.useState(null); // { name, at, text } once signed
  const [result, setResult] = React.useState(null);
  // Hotspot slides gate the Next button until the hazards have been found,
  // same as the desktop player. Keyed by slide number.
  const [hotspotDone, setHotspotDone] = React.useState({});

  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [stage, slide, qIdx]);
  const cur = draw && draw[qIdx];
  const curQ = cur ? quiz[cur.qi] : null;

  React.useEffect(() => {
    if (stage === "slide") onProgress(mod.id, slide);
  }, [stage, slide, mod.id]);

  // After the last slide: the declaration (if there is one and it isn't signed), then the quiz.
  function afterSlides(signed = signoff) {
    if (needSign && !signed) { setStage("signoff"); return; }
    if (!hasQuiz) return;
    const d = drawQuiz(mod);   // a new set of questions each attempt
    setDraw(d); setAnswers(initialAnswers(mod, d)); setQIdx(0); setStage("quiz");
  }

  // Scores the attempt and reports it via onComplete (MobileApp saves a pass as the result and
  // logs a fail for the admins, both with the answers). No questions = a signed declaration (100%).
  function finish(d, ans, signed) {
    const mark = markAttempt(mod, d, ans);
    const pct = mark.pct;
    const passed = pct >= passMark;
    const record = {
      moduleId: mod.id,
      moduleVersion: mod.version || 1,
      score: pct,
      correct: mark.correct,
      total: mark.total,
      items: mark.items,
      passed,
      signOnly: !d.length,
      answers: attemptRecord(mod, mark, { checks, signoff: signed }),
      date: todayISO(),
      certId: passed ? makeCertId(user.id, mod.id) : null,
      // the language it was done in (shown on the person's training record)
      ...(translated ? { lang: shownMod._trans.lang, translation: { hash: shownMod._trans.hash, status: shownMod._trans.status } } : {}),
    };
    setResult(record);
    setStage("result");
    onComplete(record);
  }

  function nextQuestion() {
    if (!curQ || !isAnswered(curQ, answers[cur.qi])) return;
    if (qIdx === draw.length - 1) { if (allAnswered(mod, draw, answers)) finish(draw, answers, signoff); }
    else setQIdx(qIdx + 1);
  }

  function retake() {
    setAnswers({}); setQIdx(0); setResult(null); setDraw(null); setChecks({}); setSignoff(null);
    setSlide(1); setStage("slide");
  }

  return (
    <div ref={scrollRef} style={{ height: "100%", overflow: "auto", background: Z.bg }}>
      {stage === "intro" && (
        <Screen Z={Z} pad={22}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 60, marginBottom: 10 }}>{mod.icon}</div>
            <h1 style={{ fontSize: 25, fontWeight: 900, letterSpacing: -0.7, margin: "0 0 6px", lineHeight: 1.15, color: Z.white }}>
              {mod.title}
            </h1>
            <p style={{ color: Z.muted, fontSize: 13, margin: "0 0 20px" }}>
              {t(mod.category)} · {t(mod.duration)} ·{" "}
              <span style={{ color: mod.level === "Mandatory" ? "#f87171" : Z.accentLt }}>{t(mod.level)}</span>
              {" "}· {t("{n} slides", { n: slides.length })}{hasQuiz && <> · {t("{n} questions", { n: quizSettings(mod).draw })}</>}{needSign && <> · ✍ {t("Signed declaration")}</>}
            </p>
            {shownMod._trans && (
              <div style={{ marginBottom: 14, textAlign: "left" }}>
                {translated && <TranslationNote status={shownMod._trans.status} Z={Z} font={font} style={{ marginBottom: 8 }} />}
                <EnglishToggle showEnglish={showEnglish} onToggle={() => setShowEnglish((v) => !v)} Z={Z} font={font} />
              </div>
            )}
            <div style={{
              background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 16,
              padding: 18, textAlign: "left", border: `1px solid ${Z.border}`, marginBottom: 14,
            }}>
              <p style={{ margin: 0, color: Z.slate, lineHeight: 1.7, fontSize: 13.5 }}>
                {signOnly ? t("Read through each slide carefully, then sign the declaration at the end to complete the module.") : tNodes("Take your time — each slide saves as you go. You need {pct} on the knowledge check to earn your certificate, and you can retake it as many times as you need.", {
                  pct: <strong style={{ color: Z.green }}>{t("{n}% or above", { n: passMark })}</strong> })}
              </p>
            </div>
            {offline && (
              <div style={{
                display: "flex", alignItems: "center", gap: 11, textAlign: "left", marginBottom: 22,
                background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: 14, padding: 13,
              }}>
                <span style={{ fontSize: 21 }}>↓</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: Z.green }}>{t("Downloaded to this phone")}</div>
                  <div style={{ fontSize: 11.5, color: Z.muted, marginTop: 1 }}>
                    {t("All {n} slides and the quiz work with no signal.", { n: slides.length })}
                  </div>
                </div>
              </div>
            )}
            <PrimaryButton onClick={() => setStage("slide")} Z={Z} font={font}>
              {initialSlide > 1 ? t("Continue from slide {n} →", { n: initialSlide }) : t("Begin module →")}
            </PrimaryButton>
          </div>
        </Screen>
      )}

      {stage === "slide" && (
        <div style={{ paddingBottom: 20 }}>
          <div style={{ height: 4, background: Z.overlay }}>
            <div style={{
              height: "100%", width: `${(slide / Math.max(1, slides.length)) * 100}%`,
              background: `linear-gradient(90deg,${Z.accent},${Z.accentLt})`, transition: "width .35s",
            }} />
          </div>
          <div style={{ padding: "18px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: Z.muted, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.8 }}>
              {t("SLIDE {n} OF {of}", { n: slide, of: slides.length })}
            </div>
            <div style={{ fontSize: 11, color: Z.green, fontWeight: 700 }}>↓ {t("saved")}</div>
          </div>
          {slides[slide - 1] && (slides[slide - 1].heading || slides[slide - 1].text) && (
            <div style={{ padding: "10px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <ReadAloud text={[slides[slide - 1].heading, slides[slide - 1].text].filter(Boolean).join(". \n")} lang={speechLang} Z={Z} font={font} />
              {shownMod._trans && <EnglishToggle showEnglish={showEnglish} onToggle={() => setShowEnglish((v) => !v)} Z={Z} font={font} compact />}
            </div>
          )}
          <div style={{ padding: "14px 18px 0" }}>
            <SlideCard
              slide={slides[slide - 1]} Z={Z} font={font}
              onHotspotStatus={(done) => setHotspotDone((p) => (p[slide] === done ? p : { ...p, [slide]: done }))}
            />
            {slides[slide - 1] && slides[slide - 1].check && (
              <SlideCheck key={`${slide}-${showEnglish ? "en" : "x"}`} q={slides[slide - 1].check} passed={checks[slide - 1] != null} phone
                onPassed={(n) => setChecks((p) => ({ ...p, [slide - 1]: n }))} Z={Z} font={font} />
            )}
          </div>
          <div style={{ padding: "18px 18px 0", display: "flex", gap: 11 }}>
            <GhostButton
              Z={Z} font={font}
              onClick={() => (slide === 1 ? setStage("intro") : setSlide(slide - 1))}
              style={{ flex: "0 0 auto" }}
            >
              ←
            </GhostButton>
            <PrimaryButton
              Z={Z} font={font}
              disabled={hotspotGated(slides[slide - 1], hotspotDone[slide]) || !!(slides[slide - 1] && slides[slide - 1].check && checks[slide - 1] == null)}
              onClick={() => (slide === slides.length ? afterSlides() : setSlide(slide + 1))}
              style={{ flex: 1, minHeight: 50, padding: 15, fontSize: 15, borderRadius: 14 }}
            >
              {slide === slides.length ? (needSign && !signoff ? t("Next: the declaration →") : t("Take the quiz →")) : t("Next slide →")}
            </PrimaryButton>
          </div>
        </div>
      )}

      {stage === "signoff" && (
        <Screen Z={Z} pad={18}>
          <SignoffPanel text={(shownMod.signoff && !showEnglish ? shownMod.signoff : mod.signoff).text} english={(shownMod._en || shownMod).signoff.text}
            userName={user.name} phone buttonLabel={hasQuiz ? t("Sign and go to the quiz →") : t("Sign and finish")}
            onSign={(sg) => { setSignoff(sg); if (hasQuiz) afterSlides(sg); else finish([], {}, sg); }} Z={Z} font={font} />
          <div style={{ marginTop: 12 }}>
            <GhostButton Z={Z} font={font} onClick={() => setStage("slide")}>← {t("Back to the slides")}</GhostButton>
          </div>
        </Screen>
      )}

      {stage === "quiz" && curQ && (
        <div style={{ paddingBottom: 20 }}>
          <div style={{ height: 4, background: Z.overlay }}>
            <div style={{
              height: "100%", width: `${((qIdx + 1) / Math.max(1, draw.length)) * 100}%`,
              background: "linear-gradient(90deg,#f59e0b,#fbbf24)", transition: "width .35s",
            }} />
          </div>
          <div style={{ padding: "20px 18px 0" }}>
            <div style={{ color: Z.gold, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.8, marginBottom: 6 }}>
              {t("KNOWLEDGE CHECK · {n} OF {of}", { n: qIdx + 1, of: draw.length })}
            </div>
            <div style={{ marginBottom: 10 }}>
              <ReadAloud text={speakText(curQ, cur.order)} lang={speechLang} Z={Z} font={font} />
            </div>
            <QuestionView key={cur.qi} q={curQ} order={cur.order} value={answers[cur.qi]} phone testId="quiz-q"
              onChange={(v) => setAnswers((p) => ({ ...p, [cur.qi]: v }))} Z={Z} font={font} />
            <div style={{ marginTop: 8, display: "flex", gap: 11 }}>
              {qIdx > 0 && <GhostButton Z={Z} font={font} onClick={() => setQIdx(qIdx - 1)} style={{ flex: "0 0 auto" }}>←</GhostButton>}
              <PrimaryButton onClick={nextQuestion} disabled={!isAnswered(curQ, answers[cur.qi])} Z={Z} font={font} style={{ flex: 1 }}>
                {!isAnswered(curQ, answers[cur.qi])
                  ? t("Pick an answer")
                  : qIdx === draw.length - 1 ? t("Finish quiz") : t("Next question →")}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {stage === "result" && result && (
        <Screen Z={Z} pad={20}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 6 }}>{result.passed ? "🏆" : "📖"}</div>
            <h2 style={{
              fontSize: 28, fontWeight: 900, letterSpacing: -0.8, margin: 0,
              color: result.passed ? Z.green : Z.amber,
            }}>
              {result.signOnly ? t("Signed — thank you") : result.passed ? t("Nicely done, {name}", { name: (user.name || "").split(" ")[0] }) : t("Not quite yet")}
            </h2>
            {!result.signOnly && <div style={{
              fontSize: 56, fontWeight: 900, color: Z.white, margin: "2px 0",
              fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1,
            }}>
              {result.score}%
            </div>}
            {result.signOnly ? <div style={{ height: 16 }} /> : <p style={{ color: Z.muted, margin: "0 0 20px", fontSize: 13.5 }}>
              {t("{n} of {of} correct", { n: result.correct, of: result.total })}
              {result.passed
                ? ` — ${t("comfortably above the {pct}% pass mark.", { pct: passMark })}`
                : ` — ${t("you need {pct}% to pass. Have another go whenever you're ready.", { pct: passMark })}`}
            </p>}

            {result.passed && (
              <Certificate mod={mod} user={user} result={result} Z={Z} />
            )}

            {offline && result.passed && (
              <div style={{
                display: "flex", alignItems: "center", gap: 11, textAlign: "left",
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                borderRadius: 14, padding: 13, marginBottom: 18,
              }}>
                <span style={{ fontSize: 20 }}>⏳</span>
                <div style={{ fontSize: 12, color: Z.slate, lineHeight: 1.45 }}>
                  {t("Saved on your phone. It\u2019ll appear on your manager\u2019s dashboard the moment you\u2019re back in signal.")}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!result.passed && (
                <PrimaryButton onClick={retake} Z={Z} font={font}>{t("Review the slides and retake")}</PrimaryButton>
              )}
              <PrimaryButton
                onClick={onExit} Z={Z} font={font}
                tone={result.passed ? "accent" : "gold"}
                style={result.passed ? undefined : { background: Z.overlay, color: Z.slate, boxShadow: "none" }}
              >
                {t("Back to home")}
              </PrimaryButton>
            </div>

            {result.items.length > 0 && <AnswerReview quiz={quiz} items={result.items} Z={Z} font={font} />}
          </div>
        </Screen>
      )}
    </div>
  );
}

// "Show in English" / back to the person's language, on a translated module.
function EnglishToggle({ showEnglish, onToggle, Z, font, compact }) {
  return (
    <button type="button" onClick={onToggle} data-testid="show-english"
      style={{
        background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, color: Z.slate, cursor: "pointer",
        fontFamily: font, fontWeight: 700, fontSize: compact ? 12 : 13, padding: compact ? "6px 10px" : "9px 14px", minHeight: compact ? 32 : 40,
      }}>
      {showEnglish ? t("Show in my language") : "Show in English"}
    </button>
  );
}

// A hotspot slide cannot be advanced past until the hazards have been found.
// True when the slide has a hotspot activity that hasn't been completed yet (blocks Next).
function hotspotGated(slide, done) {
  return !!(slide && slide.hotspots && slide.hotspots.length > 0 && !done);
}

function slideImages(slide) {
  // Matches the desktop player: a slides[].images array, with the two older
  // single-image shapes still supported for modules authored before it.
  const images = (slide.images || [])
    .map((im) => im && (im.url || im.data))
    .filter(Boolean);
  if (images.length === 0) {
    const legacy = (slide.image && (slide.image.data || slide.image.url)) || slide.imageData;
    if (legacy) images.push(legacy);
  }
  return images;
}

// No loading="lazy": inside the player's fixed, nested scroll container some
// Android WebViews never fire the intersection that triggers the load.
function SlideImage({ src: stored, Z, deck }) {
  // Private files (new sign-in) need a signed link first; null while it's fetched,
  // so the image isn't tried with the old link and wrongly shown as failed.
  const src = useFileUrl(stored);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  if (!src) return null;
  if (failed) return <MediaFallback kind="image" src={src} Z={Z} />;
  return (
    <img
      src={src} alt="" decoding="async" onError={() => setFailed(true)}
      style={deck
        // a whole PowerPoint slide: as large as the screen allows (also in landscape)
        ? { width: "100%", maxHeight: "calc(100vh - 170px)", objectFit: "contain", display: "block", background: "#fff" }
        : { width: "100%", maxHeight: 320, objectFit: "contain", display: "block" }}
    />
  );
}

function SlideVideo({ src: stored, Z }) {
  const src = useFileUrl(stored);   // signed link for private files (see SlideImage)
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  if (!src) return null;
  if (failed) return <div style={{ marginTop: 16 }}><MediaFallback kind="video" src={src} Z={Z} /></div>;
  // .mov/HEVC from an iPhone plays in Safari but not Chrome on Android — the
  // fallback makes that visible instead of an empty black box.
  return (
    <video
      src={src} controls playsInline preload="metadata" onError={() => setFailed(true)}
      style={{
        width: "100%", marginTop: 16, borderRadius: 14, display: "block",
        background: "#000", border: `1px solid ${Z.borderMd}`,
      }}
    />
  );
}

// A YouTube / Vimeo / Stream link (lib/videoLink.js) — embedded player, 16:9.
function SlideVideoEmbed({ src, title, Z }) {
  return (
    <div data-testid="slide-video-embed" style={{ marginTop: 16, borderRadius: 14, overflow: "hidden", background: "#000", border: `1px solid ${Z.borderMd}` }}>
      <div style={{ position: "relative", paddingTop: "56.25%" }}>
        <iframe src={src} title={title || "Training video"} loading="lazy" allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
      </div>
    </div>
  );
}

function MediaFallback({ kind, src, Z }) {
  const canOpen = src && !String(src).startsWith("data:");
  return (
    <div style={{
      padding: 16, borderRadius: 14, lineHeight: 1.45, textAlign: "left",
      background: Z.overlay, border: `1px dashed ${Z.borderMd}`, color: Z.muted, fontSize: 13,
    }}>
      {kind === "video" ? t("This video couldn't be shown on this phone.") : t("This image couldn't be shown on this phone.")}
      {canOpen && (
        <a href={src} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ display: "block", marginTop: 6, color: "#93c5fd", fontWeight: 700 }}>
          {kind === "video" ? t("Open video in browser") : t("Open image in browser")}
        </a>
      )}
    </div>
  );
}

function SlideCard({ slide, Z, font, onHotspotStatus }) {
  const [zoom, setZoom] = React.useState(null);
  if (!slide) return null;

  const images = slideImages(slide);
  const isHotspot = !!(slide.hotspots && slide.hotspots.length > 0);
  const deckFirst = !!((slide.images || [])[0] && slide.images[0].deck) && images.length > 0;
  const vs = videoSource(slide.video);                // uploaded file, direct link, or embed
  const videoSrc = vs && vs.src;

  const deck = deckFirst && !isHotspot;               // imported PowerPoint slide: show it large
  return (
    <div data-testid="slide-card" data-deck={deck ? "1" : undefined} style={{
      background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: deck ? 16 : 20,
      padding: deck ? "12px 8px 14px" : "22px 20px", border: `1px solid ${Z.border}`, boxShadow: "0 8px 40px rgba(0,0,0,.4)",
    }}>
      {slide.heading && (
        <h2 style={deck ? {
          fontSize: 14, fontWeight: 800, color: Z.muted, margin: "0 6px 10px", lineHeight: 1.25,
        } : {
          fontSize: 20, fontWeight: 900, color: Z.white, margin: "0 0 15px",
          letterSpacing: -0.4, paddingBottom: 13,
          borderBottom: `1px solid ${Z.borderMd}`, lineHeight: 1.2,
        }}>
          {slide.heading}
        </h2>
      )}
      {/* A whole PowerPoint slide (imported from PDF) comes first, like the desktop player. */}
      {!isHotspot && deckFirst && (
        <div style={{ display: "grid", gap: 10, marginBottom: slide.text || videoSrc ? 16 : 0 }}>
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setZoom(src)}
              aria-label={t("View full size")}
              style={{
                padding: 0, border: `1px solid ${Z.borderMd}`, borderRadius: 14,
                overflow: "hidden", background: Z.overlay, cursor: "zoom-in", lineHeight: 0,
              }}
            >
              <SlideImage src={src} Z={Z} deck />
            </button>
          ))}
          <div data-testid="deck-hint" style={{ fontSize: 11.5, color: Z.muted, textAlign: "center", marginTop: -2 }}>
            {t("Tap the slide to enlarge it, or turn your phone sideways.")}
          </div>
        </div>
      )}

      {slide.text && (deck ? <div style={{ padding: "0 8px" }}><SlideBody text={slide.text} Z={Z} /></div> : <SlideBody text={slide.text} Z={Z} />)}

      {vs && vs.kind === "embed" && <SlideVideoEmbed src={vs.src} title={slide.video.name} Z={Z} />}
      {vs && vs.kind === "file" && <SlideVideo src={vs.src} Z={Z} />}
      {vs && vs.kind === "unknown" && <div style={{ marginTop: 16 }}><MediaFallback kind="video" src={vs.src} Z={Z} /></div>}

      {/* Plain images are hidden on a hotspot slide — the activity owns the image. */}
      {!isHotspot && images.length > 0 && !deckFirst && (
        <div style={{ display: "grid", gap: 10, marginTop: slide.text || videoSrc ? 16 : 0 }}>
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setZoom(src)}
              aria-label={t("View full size")}
              style={{
                padding: 0, border: `1px solid ${Z.borderMd}`, borderRadius: 14,
                overflow: "hidden", background: Z.overlay, cursor: "zoom-in", lineHeight: 0,
              }}
            >
              <SlideImage src={src} Z={Z} />
            </button>
          ))}
        </div>
      )}


      {isHotspot && images.length > 0 && (
        <MobileHotspot
          imageUrl={images[0]}
          hotspots={slide.hotspots}
          instructions={slide.hotspotInstructions || t("Tap every hazard you can find in the image.")}
          onStatusChange={onHotspotStatus}
          Z={Z} font={font}
        />
      )}

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999, background: "rgba(2,6,23,0.94)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, cursor: "zoom-out",
          }}
        >
          <img src={zoom} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12 }} />
        </div>
      )}
    </div>
  );
}

// Touch version of the desktop HotspotActivity. Same data shape: hotspots are
// { id, x, y, radius, correct, label, feedback } with x/y/radius as percentages
// of the rendered image, so an activity authored on the portal works unchanged.
// Touch version of domains/training/HotspotActivity.jsx — same % coordinate model and
// nearest-hotspot-within-radius hit test. Keep behaviour in step with the desktop one.
function MobileHotspot({ imageUrl, hotspots, instructions, onStatusChange, Z, font }) {
  const [found, setFound] = React.useState(() => []);
  const [last, setLast] = React.useState(null);
  const [misses, setMisses] = React.useState(0);

  const correctTotal = hotspots.filter((h) => h.correct).length;
  const correctFound = found.filter((id) => hotspots.some((h) => h.id === id && h.correct)).length;
  const complete = correctTotal > 0 && correctFound >= correctTotal;

  React.useEffect(() => { onStatusChange && onStatusChange(complete); }, [complete]);

  function tap(e) {
    if (complete) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    let best = null, bestDist = Infinity;
    for (const h of hotspots) {
      const d = Math.sqrt((h.x - x) ** 2 + (h.y - y) ** 2);
      if (d <= (h.radius || 8) && d < bestDist) { best = h; bestDist = d; }
    }
    if (best) {
      if (!found.includes(best.id)) setFound((p) => [...p, best.id]);
      setLast({ hotspot: best, wasCorrect: true });
    } else {
      setMisses((m) => m + 1);
      setLast(null);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        fontSize: 12.5, fontWeight: 700, color: Z.gold, lineHeight: 1.5, marginBottom: 10,
      }}>
        🎯 {instructions}
      </div>

      <div
        onClick={tap}
        style={{
          position: "relative", borderRadius: 14, overflow: "hidden",
          border: `1px solid ${Z.borderMd}`, cursor: complete ? "default" : "crosshair",
          touchAction: "manipulation",
        }}
      >
        <img
          src={imageUrl} alt="" draggable={false}
          style={{ width: "100%", display: "block", pointerEvents: "none" }}
        />
        {hotspots.map((h) => found.includes(h.id) && (
          <div
            key={h.id}
            style={{
              position: "absolute", left: `${h.x}%`, top: `${h.y}%`,
              width: `${(h.radius || 8) * 2}%`, aspectRatio: "1 / 1",
              transform: "translate(-50%,-50%)", borderRadius: "50%",
              border: `3px solid ${h.correct ? Z.green : "#f87171"}`,
              background: h.correct ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.22)",
              pointerEvents: "none",
            }}
          />
        ))}
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, marginTop: 10, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: complete ? Z.green : Z.slate }}>
          {complete ? `✓ ${t("All {n} found", { n: correctTotal })}` : t("{n} of {of} found", { n: correctFound, of: correctTotal })}
        </div>
        {misses > 0 && !complete && (
          <div style={{ fontSize: 11.5, color: Z.muted }}>{misses === 1 ? t("1 miss") : t("{n} misses", { n: misses })}</div>
        )}
      </div>

      {last && last.hotspot.feedback && (
        <div style={{
          marginTop: 10, padding: "10px 12px", borderRadius: 11, fontSize: 12.5, lineHeight: 1.5,
          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7",
        }}>
          <strong>{last.hotspot.label}</strong> — {last.hotspot.feedback}
        </div>
      )}

      {!complete && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: Z.muted, fontStyle: "italic" }}>
          {t("Find them all to continue.")}
        </div>
      )}
    </div>
  );
}

// Slide text is either rich HTML from the portal's RichTextEditor or legacy
// plain text. Same branch as the desktop player — rendering HTML as plain text
// is what put raw <li> tags on screen.
// Slide text: sanitised HTML when it contains tags, otherwise plain-text formatting
// like the desktop player.
function SlideBody({ text, Z }) {
  React.useEffect(() => { ensureRteStyles(); }, []);

  if (isHtmlContent(text)) {
    return (
      <div
        className="rte-content"
        style={{ fontSize: 14.5, lineHeight: 1.75, color: Z.slate }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
      />
    );
  }

  const parts = String(text).split(". ");
  return (
    <div style={{ fontSize: 14.5, lineHeight: 1.75, color: Z.slate }}>
      {parts.map((sentence, i) => {
        const trimmed = sentence.trim();
        const step = trimmed.match(/^(Step\s)?(\d+)[.:)]\s*(.*)/);
        if (step) {
          return (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
              <span style={{
                background: Z.accent, color: "#fff", borderRadius: 6, width: 24, height: 24,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 12, flexShrink: 0, marginTop: 1,
              }}>
                {step[2]}
              </span>
              <span>{step[3]}</span>
            </div>
          );
        }
        return <p key={i} style={{ margin: "0 0 10px" }}>{sentence + (i < parts.length - 1 ? ". " : "")}</p>;
      })}
    </div>
  );
}

function Certificate({ mod, user, result, Z }) {
  return (
    <div style={{
      background: "linear-gradient(160deg,#0d1f5c,#091548)", borderRadius: 18,
      padding: "22px 20px", border: "2px solid rgba(245,158,11,0.5)",
      boxShadow: "0 0 0 4px rgba(245,158,11,0.07)", marginBottom: 16,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 4,
        background: "linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b)",
      }} />
      <div style={{ fontSize: 42, marginBottom: 6 }}>{mod.icon}</div>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 2.6, textTransform: "uppercase",
        color: "rgba(245,158,11,0.85)", marginBottom: 4,
      }}>
        {t("Certificate of Completion")}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.4 }}>{user.name}</div>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginBottom: 13 }}>
        {t("has successfully completed")}
      </div>
      <div style={{
        background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: 11, padding: "12px 16px",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#f59e0b" }}>{mod.title}</div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
          {result.certId} · {result.signOnly ? `✍ ${t("Signed")}` : t("scored {n}%", { n: result.score })}
        </div>
      </div>
    </div>
  );
}

// This attempt's questions in the order asked, with the right answer and the "why" line.
function AnswerReview({ quiz, items, Z, font }) {
  return (
    <div style={{ textAlign: "left", marginTop: 28 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase",
        color: Z.muted, marginBottom: 12,
      }}>
        {t("Answer review")}
      </div>
      {items.map((it, k) => (
        <ReviewCard key={it.qi} q={quiz[it.qi]} given={it.given} ok={it.ok} number={k + 1} phone Z={Z} font={font} />
      ))}
    </div>
  );
}

// Matches the ZSL-<user><module><random> shape already in the seed data.
// Generated client-side so the certificate can be shown before it syncs; the
// server should still enforce uniqueness.
// NB: differs from the desktop format (app/actions/player.js builds ZSL- + last 8 chars of a base-36
// string). Both start with the branding prefix (e.g. "ZSL-"); nothing parses them, they're reference numbers only.
function makeCertId(userId, moduleId) {
  const rand = Math.random().toString(36).toUpperCase().slice(2, 8);
  return certNumber(`${userId}${String(moduleId).toUpperCase()}${rand}`);   // prefix from the branding
}

export { ModulePlayer, PASS_MARK };
