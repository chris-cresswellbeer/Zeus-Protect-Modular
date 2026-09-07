// src/mobile/screens/DSEMobile.jsx
//
// The DSE self-assessment, one question per screen. Questions, sections and the
// `risk` explanations all come from src/data/seedDse.js — nothing is re-authored
// here. Flagged answers (flagOnYes) raise issues exactly as the desktop
// assessment does.

import React from "react";
import { DSE_SECTIONS } from "../../data/seedDse";
import { Screen, PrimaryButton } from "../ui";

const PURPLE = "#8b5cf6";
const PURPLE_DK = "#7c3aed";

function DSEMobile({ user, onSubmit, onExit, Z, font }) {
  const sections = DSE_SECTIONS || [];
  const flat = React.useMemo(
    () => sections.flatMap((s, si) => (s.questions || s.items || []).map((q, qi) => ({ ...q, si, qi, section: s }))),
    [sections]
  );

  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const [done, setDone] = React.useState(false);

  if (!flat.length) {
    return (
      <Screen Z={Z}>
        <p style={{ color: Z.muted, fontSize: 14 }}>No DSE questions are configured.</p>
      </Screen>
    );
  }

  const q = flat[idx];
  const answer = answers[q.id];
  const sectionCount = sections.length;

  function pick(value) {
    setAnswers((a) => ({ ...a, [q.id]: value }));
  }

  function next() {
    if (idx === flat.length - 1) {
      const issues = flat
        .filter((item) => {
          const a = answers[item.id];
          return item.flagOnYes ? a === "yes" : a === "no";
        })
        .map((item) => ({ id: item.id, text: item.text, risk: item.risk }));
      const report = {
        date: new Date().toISOString().slice(0, 10),
        userId: user.id,
        answers,
        issues,
        issueCount: issues.length,
      };
      onSubmit(report);
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  }

  if (done) {
    return (
      <Screen Z={Z}>
        <div style={{ textAlign: "center", padding: "28px 6px" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🖥️</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: Z.white, margin: "0 0 8px", letterSpacing: -0.5 }}>
            That&rsquo;s your DSE done
          </h2>
          <p style={{ color: Z.muted, fontSize: 13.5, lineHeight: 1.6, margin: "0 0 22px" }}>
            Thanks for working through it. Anything you flagged goes to your manager,
            and you&rsquo;ll see their response here.
          </p>
          <PrimaryButton onClick={onExit} Z={Z} font={font}>Back to home</PrimaryButton>
        </div>
      </Screen>
    );
  }

  return (
    <Screen Z={Z}>
      <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
        {Array.from({ length: sectionCount }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 99,
            background: i <= q.si ? PURPLE : Z.borderMd,
          }} />
        ))}
      </div>

      <div style={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase",
        color: "#a78bfa", marginBottom: 6,
      }}>
        Section {q.si + 1} · {q.section.title || q.section.name}
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 6px", lineHeight: 1.35, letterSpacing: -0.2, color: Z.white }}>
        {q.text}
      </h2>
      <p style={{ color: Z.muted, fontSize: 12.5, lineHeight: 1.55, margin: "0 0 18px" }}>
        Question {idx + 1} of {flat.length} · no wrong answers, we just want it right for you.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {[
          { v: "yes", icon: "👍", label: "Yes, that's fine" },
          { v: "no", icon: "👎", label: "No — it's uncomfortable" },
          { v: "unsure", icon: "🤔", label: "Not sure" },
        ].map((opt) => {
          const on = answer === opt.v;
          return (
            <button
              key={opt.v}
              onClick={() => pick(opt.v)}
              style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 13,
                minHeight: 60, padding: 17, borderRadius: 15, cursor: "pointer", fontFamily: font,
                border: `2px solid ${on ? "rgba(16,185,129,0.45)" : Z.border}`,
                background: on ? "rgba(16,185,129,0.12)" : Z.overlay,
              }}
            >
              <span style={{ fontSize: 22 }}>{opt.icon}</span>
              <span style={{ fontSize: 15.5, fontWeight: on ? 800 : 600, color: on ? Z.green : Z.slate }}>
                {opt.label}
              </span>
              {on && <span style={{ marginLeft: "auto", color: Z.green, fontSize: 17 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {q.risk && (
        <div style={{
          background: "rgba(139,92,246,0.09)", border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: 14, padding: 13, marginBottom: 18, display: "flex", gap: 11,
        }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div style={{ fontSize: 12, color: "#c4b5fd", lineHeight: 1.55 }}>{q.risk}</div>
        </div>
      )}

      <PrimaryButton
        onClick={next}
        disabled={!answer}
        Z={Z}
        font={font}
        style={answer ? { background: `linear-gradient(135deg,${PURPLE},${PURPLE_DK})`, boxShadow: "none" } : undefined}
      >
        {idx === flat.length - 1 ? "Finish assessment" : "Next question →"}
      </PrimaryButton>
    </Screen>
  );
}

export { DSEMobile };
