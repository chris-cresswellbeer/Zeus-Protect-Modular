// src/mobile/screens/ModulePlayer.jsx
//
// The training loop: intro → slides → one-question-at-a-time quiz → result.
//
// The single meaningful departure from the desktop player in App.jsx is the
// quiz: the desktop stacks every question on one scroll, which does not survive
// a phone. Scoring is unchanged — 70% to pass, unlimited retakes, answer review.
//
// Slide progress is reported upward on every step so it can be persisted and
// resumed after the app is killed.

import React from "react";
import { Screen, PrimaryButton, GhostButton } from "../ui";

const PASS_MARK = 70;

function ModulePlayer({
  mod, user, initialSlide = 0, offline,
  onExit, onProgress, onComplete,
  Z, font,
}) {
  const slides = mod.content || [];
  const quiz = mod.quiz || [];

  // stage: "intro" | "slide" | "quiz" | "result"
  const [stage, setStage] = React.useState(initialSlide > 0 ? "slide" : "intro");
  const [slide, setSlide] = React.useState(Math.max(1, initialSlide));
  const [qIdx, setQIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const [picked, setPicked] = React.useState(null);
  const [result, setResult] = React.useState(null);

  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [stage, slide, qIdx]);

  React.useEffect(() => {
    if (stage === "slide") onProgress(mod.id, slide);
  }, [stage, slide, mod.id]);

  function submitAnswer() {
    if (picked === null) return;
    const next = { ...answers, [qIdx]: picked };
    setAnswers(next);
    if (qIdx === quiz.length - 1) {
      let correct = 0;
      quiz.forEach((q, i) => { if (next[i] === q.answer) correct++; });
      const pct = Math.round((correct / quiz.length) * 100);
      const passed = pct >= PASS_MARK;
      const record = {
        moduleId: mod.id,
        score: pct,
        correct,
        total: quiz.length,
        passed,
        date: new Date().toISOString().slice(0, 10),
        certId: passed ? makeCertId(user.id, mod.id) : null,
      };
      setResult(record);
      setStage("result");
      onComplete(record);
    } else {
      setQIdx(qIdx + 1);
      setPicked(null);
    }
  }

  function retake() {
    setAnswers({}); setPicked(null); setQIdx(0); setResult(null);
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
              {mod.category} · {mod.duration} ·{" "}
              <span style={{ color: mod.level === "Mandatory" ? "#f87171" : Z.accentLt }}>{mod.level}</span>
              {" "}· {slides.length} slides · {quiz.length} questions
            </p>
            <div style={{
              background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 16,
              padding: 18, textAlign: "left", border: `1px solid ${Z.border}`, marginBottom: 14,
            }}>
              <p style={{ margin: 0, color: Z.slate, lineHeight: 1.7, fontSize: 13.5 }}>
                Take your time — each slide saves as you go. You need{" "}
                <strong style={{ color: Z.green }}>{PASS_MARK}% or above</strong> on the knowledge
                check to earn your Zeus certificate, and you can retake it as many times as you need.
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
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: Z.green }}>Downloaded to this phone</div>
                  <div style={{ fontSize: 11.5, color: Z.muted, marginTop: 1 }}>
                    All {slides.length} slides and the quiz work with no signal.
                  </div>
                </div>
              </div>
            )}
            <PrimaryButton onClick={() => setStage("slide")} Z={Z} font={font}>
              {initialSlide > 1 ? `Continue from slide ${initialSlide} →` : "Begin module →"}
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
              SLIDE {slide} OF {slides.length}
            </div>
            <div style={{ fontSize: 11, color: Z.green, fontWeight: 700 }}>↓ saved</div>
          </div>
          <div style={{ padding: "14px 18px 0" }}>
            <SlideCard slide={slides[slide - 1]} Z={Z} />
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
              onClick={() => (slide === slides.length ? setStage("quiz") : setSlide(slide + 1))}
              style={{ flex: 1, minHeight: 50, padding: 15, fontSize: 15, borderRadius: 14 }}
            >
              {slide === slides.length ? "Take the quiz →" : "Next slide →"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {stage === "quiz" && (
        <div style={{ paddingBottom: 20 }}>
          <div style={{ height: 4, background: Z.overlay }}>
            <div style={{
              height: "100%", width: `${((qIdx + 1) / Math.max(1, quiz.length)) * 100}%`,
              background: "linear-gradient(90deg,#f59e0b,#fbbf24)", transition: "width .35s",
            }} />
          </div>
          <div style={{ padding: "20px 18px 0" }}>
            <div style={{ color: Z.gold, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.8, marginBottom: 6 }}>
              KNOWLEDGE CHECK · {qIdx + 1} OF {quiz.length}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: Z.white, margin: "0 0 18px", lineHeight: 1.35, letterSpacing: -0.2 }}>
              {quiz[qIdx].q}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {quiz[qIdx].options.map((opt, i) => {
                const on = picked === i;
                return (
                  <button
                    key={i}
                    onClick={() => setPicked(i)}
                    style={{
                      width: "100%", textAlign: "left", padding: 16, borderRadius: 14,
                      cursor: "pointer", minHeight: 56, display: "flex", alignItems: "center", gap: 12,
                      border: `2px solid ${on ? Z.accent : Z.borderMd}`,
                      background: on ? "rgba(37,99,235,0.2)" : Z.overlaySm,
                      color: Z.white, fontFamily: font, fontSize: 14.5,
                      fontWeight: on ? 700 : 500, lineHeight: 1.4, transition: "all .15s",
                    }}
                  >
                    <span style={{
                      width: 26, height: 26, flexShrink: 0, borderRadius: "50%",
                      border: `2px solid ${on ? Z.accent : "rgba(255,255,255,0.2)"}`,
                      background: on ? Z.accent : "transparent",
                      color: on ? "#fff" : Z.muted,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800,
                    }}>
                      {"ABCDEF"[i]}
                    </span>
                    <span style={{ flex: 1 }}>{opt}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 18 }}>
              <PrimaryButton onClick={submitAnswer} disabled={picked === null} Z={Z} font={font}>
                {picked === null
                  ? "Pick an answer"
                  : qIdx === quiz.length - 1 ? "Finish quiz" : "Next question →"}
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
              {result.passed ? `Nicely done, ${(user.name || "").split(" ")[0]}` : "Not quite yet"}
            </h2>
            <div style={{
              fontSize: 56, fontWeight: 900, color: Z.white, margin: "2px 0",
              fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1,
            }}>
              {result.score}%
            </div>
            <p style={{ color: Z.muted, margin: "0 0 20px", fontSize: 13.5 }}>
              {result.correct} of {result.total} correct
              {result.passed
                ? ` — comfortably above the ${PASS_MARK}% pass mark.`
                : ` — you need ${PASS_MARK}% to pass. Have another go whenever you're ready.`}
            </p>

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
                  Saved on your phone. It&rsquo;ll appear on your manager&rsquo;s dashboard the
                  moment you&rsquo;re back in signal.
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!result.passed && (
                <PrimaryButton onClick={retake} Z={Z} font={font}>Review the slides and retake</PrimaryButton>
              )}
              <PrimaryButton
                onClick={onExit} Z={Z} font={font}
                tone={result.passed ? "accent" : "gold"}
                style={result.passed ? undefined : { background: Z.overlay, color: Z.slate, boxShadow: "none" }}
              >
                Back to home
              </PrimaryButton>
            </div>

            <AnswerReview quiz={quiz} answers={answers} Z={Z} />
          </div>
        </Screen>
      )}
    </div>
  );
}

function SlideCard({ slide, Z }) {
  if (!slide) return null;
  return (
    <div style={{
      background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 20,
      padding: "22px 20px", border: `1px solid ${Z.border}`, boxShadow: "0 8px 40px rgba(0,0,0,.4)",
    }}>
      {slide.heading && (
        <h2 style={{
          fontSize: 20, fontWeight: 900, color: Z.white, margin: "0 0 15px",
          letterSpacing: -0.4, paddingBottom: 13,
          borderBottom: `1px solid ${Z.borderMd}`, lineHeight: 1.2,
        }}>
          {slide.heading}
        </h2>
      )}
      {slide.text && <SlideBody text={slide.text} Z={Z} />}
    </div>
  );
}

// Mirrors the desktop player's numbered-step formatting.
function SlideBody({ text, Z }) {
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
        Certificate of Completion
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.4 }}>{user.name}</div>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginBottom: 13 }}>
        has successfully completed
      </div>
      <div style={{
        background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: 11, padding: "12px 16px",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#f59e0b" }}>{mod.title}</div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
          {result.certId} · scored {result.score}%
        </div>
      </div>
    </div>
  );
}

function AnswerReview({ quiz, answers, Z }) {
  return (
    <div style={{ textAlign: "left", marginTop: 28 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase",
        color: Z.muted, marginBottom: 12,
      }}>
        Answer review
      </div>
      {quiz.map((q, qi) => {
        const right = answers[qi] === q.answer;
        return (
          <div key={qi} style={{
            background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 14,
            padding: 16, marginBottom: 10,
            border: `1px solid ${right ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 99, flexShrink: 0, marginTop: 1,
                background: right ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                border: `1px solid ${right ? Z.green : "#ef4444"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
              }}>
                {right ? "✓" : "✗"}
              </span>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5, color: Z.white, lineHeight: 1.5 }}>{q.q}</p>
            </div>
            {!right && (
              <div style={{
                padding: "10px 12px", background: "rgba(37,99,235,0.1)", borderRadius: 10,
                border: "1px solid rgba(37,99,235,0.25)", fontSize: 12, color: Z.accentLt, lineHeight: 1.6,
              }}>
                The correct answer is <em>&ldquo;{q.options[q.answer]}&rdquo;</em>.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Matches the ZSL-<user><module><random> shape already in the seed data.
// Generated client-side so the certificate can be shown before it syncs; the
// server should still enforce uniqueness.
function makeCertId(userId, moduleId) {
  const rand = Math.random().toString(36).toUpperCase().slice(2, 8);
  return `ZSL-${userId}${String(moduleId).toUpperCase()}${rand}`;
}

export { ModulePlayer, PASS_MARK };
