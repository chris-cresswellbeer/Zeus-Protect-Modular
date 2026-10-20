/**
 * domains/training/QuizEditor.jsx — the question parts of Create / Edit Module.
 *
 *   <QuestionEditor>   one question of any type (quizEngine.js QTYPES), with its "why" line
 *   <QuizSettings>     question bank (ask N of the questions each time) and shuffling
 *   <CsvImport>        add questions from a spreadsheet (CSV, or rows pasted from Excel)
 *   <SignoffEditor>    the sign-off declaration staff sign with their name
 *
 * Admin screens: English only. Pictures for "pick the right picture" questions upload
 * straight away to the documents bucket (quizimg_<time>_<name>), like slide pictures.
 */
import React from "react";
import { sb, SUPABASE_URL } from "../../lib/supabase";
import { ACCEPT_IMAGES } from "../../lib/constants";
import { notify } from "../../shared/Feedback";
import { QTYPES, qType, MIN_OPTIONS, MAX_OPTIONS, LETTERS, DEFAULT_SIGNOFF } from "./quizEngine";
import { changeType, questionsFromCsv, CSV_EXAMPLE } from "./quizBuilder";

const small = (Z, font, tone) => ({
  background: tone === "red" ? "rgba(239,68,68,0.1)" : Z.overlay, color: tone === "red" ? "#f87171" : Z.muted,
  border: `1px solid ${tone === "red" ? "rgba(239,68,68,0.25)" : Z.borderMd}`, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: font,
});

async function uploadPicture(file) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `quizimg_${Date.now()}_${safe}`;
  const { error } = await sb.storage.upload("documents", path, file);
  if (error) return { error };
  const url = `${SUPABASE_URL}/storage/v1/object/public/documents/${path}`;
  return { img: { name: file.name, type: file.type, url, data: url } };
}

/**
 * One question.
 *   q, onChange(newQ | cur => newQ), onRemove?, onMove?(dir), index (0-based), total, title (default "Question n")
 */
export function QuestionEditor({ q, onChange, onRemove, onMove, index = 0, total = 1, title, Z, font, inp, lbl, testId }) {
  const ty = qType(q);
  const opts = q.options || [];
  const set = (k, v) => onChange({ ...q, [k]: v });
  const setOpt = (i, v) => set("options", opts.map((o, k) => (k === i ? v : o)));
  const fileRefs = React.useRef({});
  function addOption() {
    if (opts.length >= MAX_OPTIONS) return;
    onChange({ ...q, options: [...opts, ""], ...(ty === "image" ? { images: [...(q.images || []), null] } : {}) });
  }
  function removeOption(i) {
    if (opts.length <= MIN_OPTIONS[ty]) return;
    const fix = a => (a > i ? a - 1 : a);
    const next = { ...q, options: opts.filter((_, k) => k !== i) };
    if (ty === "image") next.images = (q.images || []).filter((_, k) => k !== i);
    if (ty === "multi") next.answers = (q.answers || []).filter(a => a !== i).map(fix);
    if (ty === "single" || ty === "image") next.answer = q.answer === i ? 0 : fix(Number(q.answer) || 0);
    onChange(next);
  }
  function moveOption(i, dir) {
    const j = i + dir; if (j < 0 || j >= opts.length) return;
    const a = [...opts]; [a[i], a[j]] = [a[j], a[i]];
    set("options", a);
  }
  // The upload takes a moment: both updates are functions of the question as it is then,
  // so typing in the meantime isn't lost.
  async function pickPicture(i, file) {
    if (!file) return;
    const holder = { name: file.name, type: file.type, uploading: true };
    onChange(cur => { const a = [...(cur.images || cur.options.map(() => null))]; a[i] = holder; return { ...cur, images: a }; });
    const r = await uploadPicture(file);
    if (r.error) notify("Picture upload failed: " + r.error, { kind: "error" });
    onChange(cur => { const a = [...(cur.images || [])]; if (a[i] === holder) a[i] = r.error ? null : r.img; return { ...cur, images: a }; });
  }
  const radio = (on, onClick, square, label) => (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={on}
      style={{ width: 22, height: 22, borderRadius: square ? 6 : "50%", border: `2px solid ${on ? Z.accent : Z.borderMd}`, background: on ? Z.accent : "transparent", color: "#fff",
        cursor: "pointer", flexShrink: 0, fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{square && on ? "✓" : ""}</button>
  );
  const name = title || `Question ${index + 1}`;
  const rightText = ty === "multi" ? ((q.answers || []).length ? (q.answers || []).slice().sort((a, b) => a - b).map(a => LETTERS[a]).join(", ") : "none ticked yet")
    : ty === "order" ? "the order written above" : `${ty === "tf" ? opts[q.answer] : `Option ${LETTERS[q.answer] || "A"}`}`;

  return (
    <div data-testid={testId || "q-editor"} data-qtype={ty}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: Z.muted, letterSpacing: 1, textTransform: "uppercase" }}>{name}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select value={ty} onChange={e => onChange(changeType(q, e.target.value))} aria-label={`${name} type`} data-testid="q-type"
            style={{ ...inp, width: "auto", padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
            {QTYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          {onMove && <>
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${name} up`} style={{ ...small(Z, font), opacity: index === 0 ? 0.3 : 1 }}>↑</button>
            <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={`Move ${name} down`} style={{ ...small(Z, font), opacity: index === total - 1 ? 0.3 : 1 }}>↓</button>
          </>}
          {onRemove && <button type="button" onClick={onRemove} style={small(Z, font, "red")}>Remove</button>}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Question *</label>
        <input value={q.q} onChange={e => set("q", e.target.value)} placeholder={ty === "order" ? "e.g. Put the steps for a fire evacuation in order" : ty === "tf" ? "e.g. You may carry a passenger on a forklift if they hold on." : "e.g. Which legislation governs working at height?"} style={inp} data-testid="q-text"/>
      </div>

      <label style={lbl}>{ty === "tf" ? "The right answer *" : ty === "multi" ? "Answer options * — tick EVERY right answer" : ty === "order" ? "Steps * — write them in the RIGHT order (staff see them shuffled)" : ty === "image" ? "Pictures * — upload one per option and click the circle under the right one" : "Answer options * — click the circle to mark the right answer"}</label>
      {ty === "tf" ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {[0, 1].map(i => (
            <button key={i} type="button" onClick={() => set("answer", i)} data-testid={`tf-${i}`}
              style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${q.answer === i ? Z.accent : Z.borderMd}`, background: q.answer === i ? "rgba(37,99,235,0.2)" : Z.overlay, color: Z.white, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
              {q.answer === i ? "✓ " : ""}{opts[i]}
            </button>
          ))}
        </div>
      ) : ty === "image" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginBottom: 10 }}>
          {opts.map((o, i) => { const im = (q.images || [])[i]; const on = q.answer === i; return (
            <div key={i} style={{ border: `2px solid ${on ? Z.accent : Z.borderMd}`, borderRadius: 12, padding: 8, background: Z.overlaySm }}>
              <input type="file" accept={ACCEPT_IMAGES} style={{ display: "none" }} ref={el => (fileRefs.current[i] = el)} data-testid={`q-pic-${i}`}
                onChange={e => { const f = e.target.files[0]; e.target.value = ""; pickPicture(i, f); }}/>
              <button type="button" onClick={() => fileRefs.current[i] && fileRefs.current[i].click()}
                style={{ width: "100%", height: 96, borderRadius: 8, border: `1px dashed ${Z.borderMd}`, background: im && !im.uploading ? "#fff" : Z.overlay, cursor: "pointer", padding: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: Z.muted, fontSize: 12, fontFamily: font }}>
                {im && im.uploading ? "Uploading…" : im ? <img src={im.url || im.data} alt={o || `Picture ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }}/> : "🖼️ Upload picture"}
              </button>
              <input value={o} onChange={e => setOpt(i, e.target.value)} placeholder="Caption (optional)" aria-label={`Caption for picture ${i + 1}`} style={{ ...inp, marginTop: 6, padding: "6px 9px", fontSize: 12 }}/>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11.5, color: on ? Z.green : Z.muted, fontWeight: 700 }}>{radio(on, () => set("answer", i), false, `Picture ${i + 1} is the right answer`)}{on ? "Right answer" : "Right answer?"}</span>
                {opts.length > MIN_OPTIONS.image && <button type="button" onClick={() => removeOption(i)} aria-label={`Remove picture ${i + 1}`} style={{ ...small(Z, font, "red"), padding: "2px 7px" }}>×</button>}
              </div>
            </div>); })}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          {opts.map((o, i) => {
            const on = ty === "multi" ? (q.answers || []).includes(i) : ty === "single" && q.answer === i;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {ty === "order"
                  ? <span style={{ width: 22, textAlign: "center", fontWeight: 800, color: Z.accentLt, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                  : ty === "multi"
                    ? radio(on, () => set("answers", on ? (q.answers || []).filter(a => a !== i) : [...(q.answers || []), i].sort((a, b) => a - b)), true, `Option ${LETTERS[i]} is right`)
                    : radio(on, () => set("answer", i), false, `Option ${LETTERS[i]} is the right answer`)}
                <input value={o} onChange={e => setOpt(i, e.target.value)} placeholder={ty === "order" ? `Step ${i + 1}` : `Option ${i + 1}`} aria-label={ty === "order" ? `Step ${i + 1}` : `Option ${i + 1}`}
                  style={{ ...inp, borderColor: on ? Z.accent : Z.borderMd }} data-testid={`q-opt-in-${i}`}/>
                {ty === "order" && <>
                  <button type="button" onClick={() => moveOption(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`} style={{ ...small(Z, font), opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                  <button type="button" onClick={() => moveOption(i, 1)} disabled={i === opts.length - 1} aria-label={`Move step ${i + 1} down`} style={{ ...small(Z, font), opacity: i === opts.length - 1 ? 0.3 : 1 }}>↓</button>
                </>}
                {opts.length > MIN_OPTIONS[ty] && <button type="button" onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`} style={{ ...small(Z, font, "red"), padding: "5px 9px" }}>×</button>}
              </div>
            );
          })}
        </div>
      )}
      {ty !== "tf" && opts.length < MAX_OPTIONS && (
        <button type="button" onClick={addOption} data-testid="q-add-opt" style={{ ...small(Z, font), marginBottom: 12, color: Z.accentLt }}>+ Add {ty === "order" ? "a step" : ty === "image" ? "a picture" : "an option"}</button>
      )}
      <div style={{ fontSize: 11, color: Z.green, fontWeight: 600, marginBottom: 12 }}>✓ Right answer: {rightText}</div>
      <div>
        <label style={lbl}>Why (optional) — shown in the answer review</label>
        <input value={q.why || ""} onChange={e => set("why", e.target.value)} maxLength={400} data-testid="q-why"
          placeholder="e.g. Site rules set 5 mph wherever people and trucks share space." style={inp}/>
      </div>
    </div>
  );
}

/** Question bank and shuffle settings. value = { quizDraw, quizShuffle } */
export function QuizSettings({ count, quizDraw, quizShuffle, onChange, Z, font, inp, lbl }) {
  const draw = Number(quizDraw) || 0;
  return (
    <div data-testid="quiz-settings" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
      <div>
        <label style={lbl} htmlFor="cm-draw">Questions asked each attempt</label>
        <select id="cm-draw" value={draw && draw < count ? String(draw) : "0"} onChange={e => onChange({ quizDraw: Number(e.target.value) })} style={{ ...inp, cursor: "pointer" }} data-testid="cm-draw">
          <option value="0">All {count} question{count === 1 ? "" : "s"}</option>
          {Array.from({ length: Math.max(0, count - 1) }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>{n} of {count}, picked at random each time</option>)}
        </select>
        <div style={{ fontSize: 11.5, color: Z.muted, marginTop: 4, lineHeight: 1.45 }}>A question bank: write more questions than you ask, so a retake isn't the same quiz.</div>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 13, color: Z.white, paddingTop: 18 }}>
        <input type="checkbox" checked={!!quizShuffle} onChange={e => onChange({ quizShuffle: e.target.checked })} data-testid="cm-shuffle" style={{ width: 18, height: 18, accentColor: Z.accent, flexShrink: 0 }}/>
        <span><b>Shuffle</b> the questions and answers each time<div style={{ fontSize: 11.5, color: Z.muted, marginTop: 3 }}>True / false answers keep their order. "Put in order" questions are always shuffled.</div></span>
      </label>
    </div>
  );
}

/** Add questions from a spreadsheet. onAdd(questions, mode: "add" | "replace") */
export function CsvImport({ onAdd, onClose, hasQuestions, Z, font, inp }) {
  const [text, setText] = React.useState("");
  const res = text.trim() ? questionsFromCsv(text) : null;
  const fileRef = React.useRef(null);
  function downloadExample() {
    const blob = new Blob(["﻿" + CSV_EXAMPLE], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Quiz questions - example.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const btn = primary => ({ background: primary ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay, color: primary ? "#fff" : Z.muted, border: primary ? "none" : `1px solid ${Z.borderMd}`,
    borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: font });
  return (
    <div data-testid="csv-import" style={{ background: "rgba(37,99,235,0.06)", border: `1px solid ${Z.accent}55`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <b style={{ fontSize: 14 }}>📥 Add questions from a spreadsheet</b>
        <button type="button" onClick={onClose} style={btn(false)}>Close</button>
      </div>
      <p style={{ fontSize: 12.5, color: Z.muted, margin: "0 0 10px", lineHeight: 1.55 }}>
        One question per row, with these column headings in the first row: <b>Type</b>, <b>Question</b>, <b>Option A</b> to <b>Option F</b>, <b>Correct</b> and <b>Why</b>.
        Type is single, true/false, select all or order (blank = single). Correct is a letter (A), several for select all (A, C), or True / False. For "order", list the steps in the right order and leave Correct empty.
        Save the sheet as CSV, or copy the rows in Excel and paste them below.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onClick={downloadExample} style={btn(false)}>↓ Download the example</button>
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" style={{ display: "none" }} data-testid="csv-file"
          onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; const r = new FileReader(); r.onload = () => setText(String(r.result || "")); r.readAsText(f); }}/>
        <button type="button" onClick={() => fileRef.current && fileRef.current.click()} style={btn(false)}>📄 Choose a CSV file</button>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="…or paste the rows here (including the heading row)" data-testid="csv-text"
        style={{ ...inp, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, resize: "vertical" }}/>
      {res && (
        <div style={{ marginTop: 10 }} data-testid="csv-result">
          <div style={{ fontSize: 13, fontWeight: 700, color: res.questions.length ? Z.green : "#f87171" }}>
            {res.questions.length ? `✓ ${res.questions.length} question${res.questions.length === 1 ? "" : "s"} ready to add` : "No questions found yet"}
          </div>
          {res.problems.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: Z.amber, lineHeight: 1.5 }}>
              {res.problems.slice(0, 8).map((p, i) => <li key={i}>{p}</li>)}
              {res.problems.length > 8 && <li>…and {res.problems.length - 8} more</li>}
            </ul>
          )}
          {res.questions.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => onAdd(res.questions, "add")} style={btn(true)} data-testid="csv-add">+ Add {res.questions.length} to the quiz</button>
              {hasQuestions && <button type="button" onClick={() => onAdd(res.questions, "replace")} style={btn(false)} data-testid="csv-replace">Replace the questions already here</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The sign-off declaration. value = { on, text } */
export function SignoffEditor({ value, onChange, Z, inp, lbl }) {
  const v = value || { on: false, text: DEFAULT_SIGNOFF };
  return (
    <div data-testid="signoff-editor">
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 13, color: Z.white, marginBottom: v.on ? 12 : 0 }}>
        <input type="checkbox" checked={!!v.on} onChange={e => onChange({ ...v, on: e.target.checked, text: v.text || DEFAULT_SIGNOFF })} data-testid="cm-signoff" style={{ width: 18, height: 18, accentColor: Z.accent, flexShrink: 0 }}/>
        <span><b>Staff sign a declaration</b> with their typed name before the quiz<div style={{ fontSize: 11.5, color: Z.muted, marginTop: 3 }}>Their name and the time are kept with their result as evidence. With no questions, signing completes the module (e.g. reading a procedure).</div></span>
      </label>
      {v.on && (
        <div>
          <label style={lbl} htmlFor="cm-signoff-text">Declaration</label>
          <textarea id="cm-signoff-text" rows={2} value={v.text} onChange={e => onChange({ ...v, text: e.target.value })} maxLength={400} data-testid="cm-signoff-text" style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}/>
        </div>
      )}
    </div>
  );
}
