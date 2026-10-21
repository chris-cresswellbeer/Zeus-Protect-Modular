/**
 * ═══════════════════════════════════════════════════════════════════════════
 * domains/training/QuizBits.jsx — the parts of a quiz people see
 * ═══════════════════════════════════════════════════════════════════════════
 * Used by the computer player (app/screens/ModulePlayerScreen.jsx), the phone player
 * (mobile/screens/ModulePlayer.jsx) and the admin preview (ModulePreviewModal.jsx), so
 * every question type looks and works the same everywhere. Marking is in quizEngine.js.
 *
 *   <QuestionView>  one question, any type, for answering
 *   <ReviewCard>    one answered question in the answer review, with its "why" line
 *   <SlideCheck>    a knowledge check on a slide: answer it right to carry on
 *   <SignoffPanel>  the sign-off declaration, signed with a typed name
 *
 * `phone` = the larger touch sizes used on the phone. Staff-facing wording goes through
 * t() (lib/i18n.js) — add new lines to every file in src/lib/lang/.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { t, tNodes } from "../../lib/i18n";
import { LETTERS, qType, isAnswered, isCorrect, correctOf, optionOrder, nameMatches } from "./quizEngine";
import { ukDate } from "../../lib/dates";

const GREEN_BG = "rgba(16,185,129,0.15)", GREEN_BD = "rgba(16,185,129,0.5)";
const RED_BG = "rgba(239,68,68,0.12)", RED_BD = "rgba(239,68,68,0.4)";

/** An option's words in the person's language ("Picture 2" for a picture with no caption). */
export function optLabel(q, i) {
  const o = (q.options || [])[i];
  if (o && String(o).trim()) return String(o);
  return qType(q) === "image" ? t("Picture {n}", { n: i + 1 }) : `${LETTERS[i] || i + 1}`;
}
const imgSrc = im => (im && (im.url || im.data)) || "";

/** The line under a question saying how to answer it. */
export function answerHint(q) {
  const ty = qType(q);
  if (ty === "multi") return t("Select all that apply.");
  if (ty === "order") return t("Put these in the right order. Use the arrows to move them.");
  if (ty === "image") return t("Pick the right picture.");
  return "";
}

/**
 * One question to answer.
 *   q        the question (in the person's language)
 *   order    option indexes in the order shown (quizEngine drawQuiz); default as written
 *   value    the answer so far: index, [indexes] (select all) or [indexes in order] (put in order)
 *   onChange(newValue)
 *   number   shown as "Q3." (optional)
 */
export function QuestionView({ q, order, value, onChange, Z, font, phone, number, disabled, testId, hideTitle }) {
  const ty = qType(q);
  const idx = order || (q.options || []).map((_, i) => i);
  const fs = phone ? 14.5 : 14;
  const row = on => ({
    width: "100%", textAlign: "left", padding: phone ? 16 : "11px 16px", borderRadius: phone ? 14 : 10, marginBottom: phone ? 10 : 8,
    cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", gap: 12, minHeight: phone ? 56 : 0,
    border: `2px solid ${on ? Z.accent : phone ? Z.borderMd : Z.border}`, background: on ? "rgba(37,99,235,0.2)" : phone ? Z.overlaySm : "transparent",
    color: Z.white, fontFamily: font, fontSize: fs, fontWeight: on ? 700 : phone ? 500 : 400, lineHeight: 1.4, transition: "all .15s", boxSizing: "border-box",
  });
  const mark = (on, k, square) => (
    <span aria-hidden="true" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: square ? 6 : "50%", border: `2px solid ${on ? Z.accent : Z.borderMd}`,
      background: on ? Z.accent : "transparent", color: on ? "#fff" : Z.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
      {square ? (on ? "✓" : "") : LETTERS[k]}
    </span>
  );
  const hint = answerHint(q);

  let body;
  if (ty === "order") {
    const cur = Array.isArray(value) && value.length === idx.length ? value : idx;
    const move = (k, dir) => { const a = [...cur]; const j = k + dir; if (j < 0 || j >= a.length) return; [a[k], a[j]] = [a[j], a[k]]; onChange && onChange(a); };
    const arrow = (k, dir, label) => (
      <button type="button" onClick={() => move(k, dir)} disabled={disabled || k + dir < 0 || k + dir >= cur.length} aria-label={label}
        data-testid={`q-${dir < 0 ? "up" : "down"}-${k}`}
        style={{ width: phone ? 40 : 32, height: phone ? 40 : 30, borderRadius: 8, border: `1px solid ${Z.borderMd}`, background: Z.overlay, color: Z.white,
          cursor: "pointer", fontSize: 14, fontWeight: 800, opacity: k + dir < 0 || k + dir >= cur.length ? 0.3 : 1, fontFamily: font }}>{dir < 0 ? "↑" : "↓"}</button>
    );
    body = cur.map((oi, k) => (
      <div key={oi} data-testid={`q-opt-${k}`} style={{ ...row(false), cursor: "default" }}>
        <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 6, background: Z.overlay, border: `1px solid ${Z.borderMd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: Z.accentLt }}>{k + 1}</span>
        <span style={{ flex: 1 }}>{optLabel(q, oi)}</span>
        <span style={{ display: "flex", gap: 6 }}>{arrow(k, -1, t("Move up"))}{arrow(k, 1, t("Move down"))}</span>
      </div>
    ));
  } else if (ty === "image") {
    body = (
      <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: `repeat(${phone ? 2 : Math.min(3, idx.length)}, minmax(0,1fr))`, gap: 10, marginBottom: 8 }}>
        {idx.map((oi, k) => {
          const on = value === oi;
          return (
            <button key={oi} type="button" role="radio" aria-checked={on} data-testid={`q-opt-${k}`} disabled={disabled} onClick={() => onChange && onChange(oi)}
              style={{ padding: 6, borderRadius: 12, border: `3px solid ${on ? Z.accent : Z.borderMd}`, background: on ? "rgba(37,99,235,0.2)" : Z.overlaySm, cursor: disabled ? "default" : "pointer",
                display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch", fontFamily: font, color: Z.white }}>
              <img src={imgSrc((q.images || [])[oi])} alt={optLabel(q, oi)} style={{ width: "100%", height: phone ? 120 : 140, objectFit: "contain", background: "#fff", borderRadius: 8, display: "block" }}/>
              <span style={{ fontSize: 12.5, fontWeight: on ? 800 : 600, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                {on && "✓ "}{(q.options[oi] || "").trim() ? q.options[oi] : `${LETTERS[k]}`}
              </span>
            </button>
          );
        })}
      </div>
    );
  } else if (ty === "multi") {
    const cur = Array.isArray(value) ? value : [];
    body = idx.map((oi, k) => {
      const on = cur.includes(oi);
      return (
        <button key={oi} type="button" role="checkbox" aria-checked={on} data-testid={`q-opt-${k}`} disabled={disabled}
          onClick={() => onChange && onChange(on ? cur.filter(x => x !== oi) : [...cur, oi])} style={row(on)}>
          {mark(on, k, true)}<span style={{ flex: 1 }}>{optLabel(q, oi)}</span>
        </button>
      );
    });
  } else {
    body = idx.map((oi, k) => {
      const on = value === oi;
      return (
        <button key={oi} type="button" role="radio" aria-checked={on} data-testid={`q-opt-${k}`} disabled={disabled} onClick={() => onChange && onChange(oi)} style={row(on)}>
          {phone && mark(on, k)}<span style={{ flex: 1 }}>{optLabel(q, oi)}</span>
        </button>
      );
    });
  }
  return (
    <div data-testid={testId} data-qtype={ty}>
      {!hideTitle && (
        <p style={phone ? { fontSize: 20, fontWeight: 800, color: Z.white, margin: "0 0 6px", lineHeight: 1.35 } : { fontWeight: 700, margin: "0 0 6px", fontSize: 15 }}>
          {number != null && <span style={{ color: Z.accentLt }}>Q{number}. </span>}{q.q}
        </p>
      )}
      {hint && <div style={{ fontSize: 12.5, color: Z.muted, margin: "0 0 12px", fontStyle: "italic" }}>{hint}</div>}
      {!hint && <div style={{ height: phone ? 12 : 10 }}/>}
      {body}
    </div>
  );
}

/** The person's answer and the right one, for the answer review. */
export function ReviewCard({ q, given, ok, Z, font, phone, number }) {
  const ty = qType(q);
  const right = correctOf(q);
  const answered = given !== undefined && given !== null && !(Array.isArray(given) && !given.length);
  const pill = (txt, good) => (
    <div style={{ padding: phone ? "9px 12px" : "9px 14px", borderRadius: 10, background: good ? GREEN_BG : RED_BG, border: `1px solid ${good ? GREEN_BD : RED_BD}`,
      fontSize: 13, color: good ? Z.green : "#f87171", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{txt}</div>
  );
  let detail;
  if (ty === "order") {
    detail = (
      <div style={{ display: "grid", gap: 6 }}>
        {!ok && answered && <div style={{ fontSize: 12, color: Z.muted }}>{t("Your order")}: <span style={{ color: "#f87171", fontWeight: 700 }}>{given.map(i => optLabel(q, i)).join(" → ")}</span></div>}
        <div style={{ fontSize: 12, color: Z.muted }}>{t("The right order")}: <span style={{ color: Z.green, fontWeight: 700 }}>{right.map(i => optLabel(q, i)).join(" → ")}</span></div>
      </div>
    );
  } else if (ty === "image") {
    detail = (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(phone ? 2 : 4, (q.options || []).length)}, minmax(0,1fr))`, gap: 8 }}>
        {(q.options || []).map((_, i) => {
          const isRight = right.includes(i), chosen = given === i;
          return (
            <div key={i} style={{ padding: 4, borderRadius: 10, border: `2px solid ${isRight ? Z.green : chosen ? "#ef4444" : Z.border}`, opacity: isRight || chosen ? 1 : 0.55 }}>
              <img src={imgSrc((q.images || [])[i])} alt={optLabel(q, i)} style={{ width: "100%", height: 70, objectFit: "contain", background: "#fff", borderRadius: 6, display: "block" }}/>
              <div style={{ fontSize: 11, textAlign: "center", marginTop: 3, color: isRight ? Z.green : chosen ? "#f87171" : Z.muted, fontWeight: 700 }}>
                {isRight ? `✓ ${t("Correct answer")}` : chosen ? `✗ ${t("Your answer")}` : optLabel(q, i)}
              </div>
            </div>
          );
        })}
      </div>
    );
  } else {
    const chosen = ty === "multi" ? (Array.isArray(given) ? given : []) : [given];
    detail = (
      <div style={{ display: "grid", gap: 6 }}>
        {(q.options || []).map((_, i) => {
          const isRight = right.includes(i), isChosen = chosen.includes(i);
          if (phone && !isRight && !isChosen) return null;
          let bg = "transparent", bd = Z.border, col = Z.muted;
          if (isRight) { bg = GREEN_BG; bd = GREEN_BD; col = Z.green; } else if (isChosen) { bg = RED_BG; bd = RED_BD; col = "#f87171"; }
          return (
            <div key={i} style={{ padding: "9px 14px", borderRadius: 10, background: bg, border: `1px solid ${bd}`, fontSize: 13, color: col, fontWeight: isRight || isChosen ? 700 : 400, display: "flex", alignItems: "center", gap: 8 }}>
              {isRight && <span>✓</span>}{isChosen && !isRight && <span>✗</span>}
              {optLabel(q, i)}
              {isRight && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700 }}>{t("Correct answer")}</span>}
              {isChosen && !isRight && phone && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700 }}>{t("Your answer")}</span>}
            </div>
          );
        })}
      </div>
    );
  }
  const rightText = ty === "order" ? right.map(i => optLabel(q, i)).join(" → ") : right.map(i => optLabel(q, i)).join("; ");
  return (
    <div data-testid="review-card" data-ok={ok ? "1" : "0"} style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 14, padding: phone ? 16 : 20, marginBottom: phone ? 10 : 12,
      border: `1px solid ${ok ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`, textAlign: "left" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 99, background: ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)", border: `1px solid ${ok ? Z.green : "#ef4444"}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 1 }}>{ok ? "✓" : "✗"}</div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: phone ? 13.5 : 14, color: Z.white, lineHeight: 1.5 }}>{number != null && <span style={{ color: Z.muted }}>Q{number}. </span>}{q.q}</p>
      </div>
      {!answered && pill(t("Not answered"), false)}
      {(!phone || !ok || ty === "image" || ty === "order") && detail}
      {(q.why || !ok) && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(37,99,235,0.1)", borderRadius: 10, border: "1px solid rgba(37,99,235,0.25)", fontSize: 12, color: Z.accentLt, lineHeight: 1.6 }}>
          💡 {q.why
            ? <>{!ok && <>{tNodes("The correct answer is {answer}.", { answer: <em>&ldquo;{rightText}&rdquo;</em> })} </>}<strong>{t("Why:")}</strong> {q.why}</>
            : tNodes("{label} The correct answer is {answer}. Review the relevant slide for more detail.", { label: <strong>{t("Explanation:")}</strong>, answer: <em>&ldquo;{rightText}&rdquo;</em> })}
        </div>
      )}
    </div>
  );
}

/**
 * A knowledge check on a slide. The person answers; a wrong answer says try again (the
 * slide is right there to look at), a right one shows the "why" and calls onPassed(tries).
 * `passed` = already answered right in this attempt (e.g. after going back a slide).
 */
export function SlideCheck({ q, passed, onPassed, Z, font, phone }) {
  const ty = qType(q);
  const [order] = React.useState(() => optionOrder(q, false));
  const [value, setValue] = React.useState(() => (ty === "order" ? [...order] : ty === "multi" ? [] : null));
  const [tries, setTries] = React.useState(0);
  const [wrong, setWrong] = React.useState(false);
  const done = !!passed;
  function check() {
    const n = tries + 1; setTries(n);
    if (isCorrect(q, value)) { setWrong(false); onPassed && onPassed(n); } else setWrong(true);
  }
  return (
    <div data-testid="slide-check" data-done={done ? "1" : "0"} style={{ marginTop: phone ? 16 : 24, padding: phone ? 14 : 20, borderRadius: 14, border: `2px solid ${done ? GREEN_BD : "rgba(245,158,11,0.45)"}`, background: done ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, color: done ? Z.green : Z.gold, marginBottom: 8 }}>{done ? `✓ ${t("QUICK CHECK · DONE")}` : t("QUICK CHECK")}</div>
      <QuestionView q={q} order={order} value={value} onChange={v => { setValue(v); setWrong(false); }} Z={Z} font={font} phone={phone} disabled={done}/>
      {!done && (
        <button type="button" onClick={check} disabled={!isAnswered(q, value)} data-testid="check-answer"
          style={{ marginTop: 4, background: `linear-gradient(135deg,${Z.accent},${Z.blue || Z.accent})`, color: "#fff", border: "none", borderRadius: 10, padding: phone ? "13px 20px" : "10px 22px",
            fontWeight: 800, fontFamily: font, fontSize: 14, cursor: "pointer", opacity: isAnswered(q, value) ? 1 : 0.45, width: phone ? "100%" : "auto" }}>
          {t("Check my answer")}
        </button>
      )}
      {wrong && !done && <div role="alert" data-testid="check-wrong" style={{ marginTop: 10, fontSize: 13, color: "#f87171", fontWeight: 700 }}>{t("Not quite. Have another look at the slide and try again.")}</div>}
      {done && <div data-testid="check-right" style={{ marginTop: 6, fontSize: 13, color: Z.green, fontWeight: 700 }}>✓ {t("Correct")}{q.why ? <span style={{ color: Z.slate, fontWeight: 500 }}> — {q.why}</span> : null}</div>}
    </div>
  );
}

/**
 * The sign-off declaration. The person ticks to agree and types their name as it is on the
 * portal; onSign({ name, at, text }) records it with the result.
 *   text      the declaration in the person's language
 *   english   the English declaration (what is saved — the official version)
 */
export function SignoffPanel({ text, english, userName, signed, onSign, Z, font, phone, buttonLabel }) {
  const [agree, setAgree] = React.useState(false);
  const [name, setName] = React.useState("");
  const [tried, setTried] = React.useState(false);
  const okName = nameMatches(name, userName);
  if (signed) {
    return (
      <div data-testid="signoff-done" style={{ padding: 16, borderRadius: 14, border: `1px solid ${GREEN_BD}`, background: "rgba(16,185,129,0.08)", color: Z.green, fontWeight: 700, fontSize: 13.5 }}>
        ✓ {t("Signed by {name} on {date}", { name: signed.name, date: ukDate(String(signed.at).slice(0, 10)) })}
      </div>
    );
  }
  function sign() {
    setTried(true);
    if (!agree || !okName) return;
    onSign && onSign({ name: name.trim(), at: new Date().toISOString(), text: english || text });
  }
  return (
    <div data-testid="signoff" style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: phone ? 16 : 20, padding: phone ? 18 : 32, border: `1px solid ${Z.border}`, textAlign: "left" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.8, color: Z.gold, marginBottom: 10 }}>✍ {t("DECLARATION")}</div>
      <p style={{ fontSize: phone ? 16 : 17, lineHeight: 1.6, color: Z.white, fontWeight: 600, margin: "0 0 18px" }}>{text}</p>
      <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", marginBottom: 16, fontSize: 14, color: Z.slate, lineHeight: 1.45 }}>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} data-testid="signoff-agree" style={{ width: 22, height: 22, flexShrink: 0, marginTop: 0, accentColor: Z.accent }}/>
        {t("I agree with the declaration above.")}
      </label>
      <label htmlFor="signoff-name" style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: Z.muted, textTransform: "uppercase", marginBottom: 6 }}>{t("Type your full name to sign")}</label>
      <input id="signoff-name" data-testid="signoff-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" onKeyDown={e => { if (e.key === "Enter") sign(); }}
        style={{ width: "100%", boxSizing: "border-box", background: Z.overlay, border: `1px solid ${tried && !okName ? "#ef4444" : Z.borderMd}`, borderRadius: 10, padding: phone ? "14px" : "11px 14px",
          color: Z.white, fontSize: 16, fontFamily: font, outline: "none", fontStyle: "italic" }}/>
      {tried && !okName && <div role="alert" style={{ fontSize: 12.5, color: "#f87171", marginTop: 6 }}>{t("Type your name as it is on the portal: {name}", { name: userName })}</div>}
      {tried && okName && !agree && <div role="alert" style={{ fontSize: 12.5, color: "#f87171", marginTop: 6 }}>{t("Tick the box to agree first.")}</div>}
      <button type="button" onClick={sign} data-testid="signoff-sign"
        style={{ marginTop: 16, width: phone ? "100%" : "auto", background: `linear-gradient(135deg,${Z.accent},${Z.blue || Z.accent})`, color: "#fff", border: "none", borderRadius: 12,
          padding: phone ? "15px 24px" : "12px 32px", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: font, opacity: agree && name.trim() ? 1 : 0.6 }}>
        {buttonLabel || t("Sign")}
      </button>
    </div>
  );
}
