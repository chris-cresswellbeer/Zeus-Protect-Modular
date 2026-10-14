// src/mobile/screens/Inspection.jsx
//
// Site inspections on the phone: the list of what is due, and the walkround
// runner itself — one section per screen, three-way answer per question.
//
// ⚠ MAINTAINER NOTE: scoring is NOT identical to the desktop tab. Desktop stores
// 2 / 1 (partial) / 0 per question and counts unanswered questions in the maximum;
// mobile has no "partial", stores only answered questions, and excludes N/A. Mobile
// records also carry `nextDue` (not set by desktop) and ids prefixed
// si_local_/nc_local_ (desktop uses si<ts>/nc_<ts>). Keep this in mind when reporting across both.
//
// Scoring follows the shared rules in src/domains/inspections/inspectionScore.js: each
// question scores 2 (compliant) or 0 (non-conformance); N/A questions are
// excluded from both overallScore and maxScore so a skipped item cannot drag
// the score down. Anything answered "Issue" becomes a nonConformance on the
// submitted record, which is what the desktop tab renders and what drives the
// corrective action.
//
// Site checklists (lib/inspTemplates.js, e.g. the BRCGS audits) run here too: clause numbers,
// the section's introduction, four answers (Yes / Partial / No / N/A — Partial and No each
// become a non-conformance), comments and evidence photos on any question, a section list
// for long checklists, and "Save part-done" (carried on later on the portal).
// Every checklist can have comments and photos per question; N/A is stored as "na".
//
// The whole flow works with no signal. The submitted record goes out through
// onSubmit, which MobileApp wraps in the offline queue.

import { answerPoints } from "../../domains/inspections/inspectionScore";
import React from "react";
import { inspType, inspSections, inspTypes } from "../../lib/inspTemplates";
import { ukDate } from "../../lib/dates";
import { Screen, SectionLabel, Card, Row, StatusChip, PrimaryButton, GhostButton } from "../ui";
import { compressToDataUrl } from "../../lib/photos";

const PASS = "pass";
const ISSUE = "issue";
const NA = "na";

const ANSWER_STYLE = {
  [PASS]:  { bg: "rgba(16,185,129,0.16)", border: "rgba(16,185,129,0.5)", color: "#10b981" },
  [ISSUE]: { bg: "rgba(245,158,11,0.16)", border: "rgba(245,158,11,0.5)", color: "#fbbf24" },
  [NA]:    { bg: "rgba(255,255,255,0.1)", border: "rgba(255,255,255,0.2)", color: "#cbd5e1" },
};

const ANSWERS = [
  { key: PASS, label: "✓ Pass", flex: 1.2 },
  { key: ISSUE, label: "! Issue", flex: 1.2 },
  { key: NA, label: "N/A", flex: 0.9 },
];

function typeFor(id) {
  return inspType(id);
}
const PARTIAL = "partial";
// a site checklist: four answers, like the portal
const ANSWERS4 = [
  { key: PASS, label: "✓ Yes", flex: 1 },
  { key: PARTIAL, label: "⚠ Part", flex: 1 },
  { key: ISSUE, label: "✗ No", flex: 1 },
  { key: NA, label: "N/A", flex: 0.8 },
];
ANSWER_STYLE[PARTIAL] = { bg: "rgba(245,158,11,0.16)", border: "rgba(245,158,11,0.5)", color: "#fbbf24" };

// local dates (a check done just after midnight in summer time belongs to that day)
const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function today() {
  return localIso(new Date());
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localIso(d);
}
// next due from the type's frequency ("7 days", "6 months", "12 months")
function nextDueFor(typeId) {
  const t = typeFor(typeId);
  if (t.freqMonths) { const d = new Date(); d.setMonth(d.getMonth() + t.freqMonths); return localIso(d); }
  const m = String(t.freq || "").match(/(\d+)\s*(day|month)/i);
  if (!m) return addDays(7);
  if (/day/i.test(m[2])) return addDays(Number(m[1]));
  const d = new Date(); d.setMonth(d.getMonth() + Number(m[1])); return localIso(d);
}

// ─── List ────────────────────────────────────────────────────────────────────
//
// `due` — [{ typeId, location, dueDate, overdue }]
// `recent` — submitted records in the seedInspections shape.

// List screen: one "due" row per mobile-runnable type + recent inspections.
function Inspections({ due, recent, onStart, onOpenDesktop, startTypes = [], places = [], Z, font }) {
  const [picking, setPicking] = React.useState(false);
  const [typeId, setTypeId] = React.useState("");
  const [place, setPlace] = React.useState("");
  const field = { width: "100%", boxSizing: "border-box", minHeight: 46, background: "rgba(0,0,0,0.25)", border: `1px solid ${Z.border}`, borderRadius: 10, padding: "10px 12px", color: Z.white, fontSize: 14, fontFamily: font };
  return (
    <Screen Z={Z}>
      {startTypes.length > 0 && (picking ? (
        <Card Z={Z} tone="flat" style={{ marginBottom: 18 }}>
          <SectionLabel Z={Z} color={Z.gold}>Start an inspection</SectionLabel>
          <label style={{ display: "block", fontSize: 12, color: Z.muted, marginBottom: 4 }} htmlFor="m-insp-type">Checklist</label>
          <select id="m-insp-type" data-testid="m-insp-type" value={typeId} onChange={(e) => setTypeId(e.target.value)} style={{ ...field, marginBottom: 10 }}>
            <option value="">Choose…</option>
            {startTypes.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </select>
          <label style={{ display: "block", fontSize: 12, color: Z.muted, marginBottom: 4 }} htmlFor="m-insp-place">Where</label>
          <input id="m-insp-place" data-testid="m-insp-place" list="m-insp-places" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Biggleswade — whole site" style={{ ...field, marginBottom: 12 }} />
          <datalist id="m-insp-places">{places.map((p) => <option key={p} value={p} />)}</datalist>
          <div style={{ display: "flex", gap: 8 }}>
            <GhostButton Z={Z} font={font} onClick={() => setPicking(false)}>Cancel</GhostButton>
            <PrimaryButton Z={Z} font={font} tone="green" disabled={!typeId || !place.trim()} style={{ flex: 1 }}
              onClick={() => { onStart({ typeId, location: place.trim() }); setPicking(false); }}>Start →</PrimaryButton>
          </div>
        </Card>
      ) : (
        <PrimaryButton Z={Z} font={font} tone="green" style={{ width: "100%", marginBottom: 18 }} onClick={() => setPicking(true)}>+ Start an inspection</PrimaryButton>
      ))}
      <SectionLabel Z={Z} color={Z.gold}>Due now · {due.length}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {due.length === 0 && (
          <Card Z={Z} tone="flat">
            <div style={{ fontSize: 13, color: Z.muted }}>Nothing due — next walkround is scheduled.</div>
          </Card>
        )}
        {due.map((d) => {
          const t = typeFor(d.typeId);
          return (
            <Row
              key={`${d.typeId}-${d.location}`}
              Z={Z} font={font} tone={d.overdue ? "danger" : "warn"}
              icon={t.icon}
              title={t.label}
              sub={`${d.location} · ${d.overdue ? "overdue" : "due"} ${ukDate(d.dueDate)}`}
              right={<StatusChip label={d.overdue ? "Overdue" : "Start"} color={d.overdue ? "#ef4444" : "#f59e0b"} />}
              onClick={() => onStart(d)}
            />
          );
        })}
      </div>

      <SectionLabel Z={Z}>Recent walkrounds</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {recent.slice(0, 6).map((r) => {
          const t = inspType(r.type, r);
          const ncs = (r.nonConformances || []).length;
          return (
            <Row
              key={r.id}
              Z={Z} font={font}
              icon={t.icon}
              title={t.label}
              sub={`${ukDate(r.date)} · ${r.inspector} · ${r.overallScore}/${r.maxScore}`}
              right={<StatusChip
                label={ncs ? `${ncs} finding${ncs === 1 ? "" : "s"}` : "Clean"}
                color={ncs ? "#f59e0b" : "#10b981"} />}
            />
          );
        })}
      </div>

      {onOpenDesktop && (
        <GhostButton Z={Z} font={font} onClick={onOpenDesktop} style={{ width: "100%" }}>
          Full inspection history on the portal
        </GhostButton>
      )}
    </Screen>
  );
}

// ─── Runner ──────────────────────────────────────────────────────────────────

// The walkround runner: one checklist section per screen; "Issue" answers open a
// finding panel (text, severity, photos, owner). Major findings are due in 2 days,
// others in 7. The next inspection of this type is set as due in 7 days.
function InspectionRun({ typeId, location, user, onSubmit, onExit, Z, font }) {
  const type = typeFor(typeId);
  const sections = inspSections(typeId);
  const site = !!type.custom;                           // a site checklist (e.g. a BRCGS audit)
  const ANS = site ? ANSWERS4 : ANSWERS;
  const [secIdx, setSecIdx] = React.useState(0);
  // answers / findings / comments / photos are kept by "sectionId/questionId" (question ids
  // repeat between sections in some checklists)
  const [answers, setAnswers] = React.useState({});   // { key: PASS|PARTIAL|ISSUE|NA }
  const [findings, setFindings] = React.useState({}); // { key: { finding, severity, photos } }
  const [comments, setComments] = React.useState({}); // { key: text }
  const [photos, setPhotos] = React.useState({});     // { key: [dataUrl] }  (uploaded when sent)
  const [openNote, setOpenNote] = React.useState({});
  const [submitted, setSubmitted] = React.useState(null);
  const K = (sid, qid) => `${sid}/${qid}`;
  // the phone screen scrolls inside its own box, so go to the top of the checklist itself
  const topRef = React.useRef(null);
  const toTop = () => { const el = topRef.current; if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); };

  const section = sections[secIdx];
  const allQuestions = sections.flatMap((s) => s.questions.map((q) => ({ ...q, key: K(s.id, q.id), sec: s })));
  const answered = allQuestions.filter((q) => answers[q.key]).length;
  const issues = allQuestions.filter((q) => answers[q.key] === ISSUE || answers[q.key] === PARTIAL);
  const last = secIdx === sections.length - 1;
  const longList = sections.length > 8;

  function setAnswer(qid, key) {
    setAnswers((a) => ({ ...a, [qid]: key }));
    if (key !== ISSUE && key !== PARTIAL) {
      setFindings((f) => {
        if (!f[qid]) return f;
        const next = { ...f };
        delete next[qid];
        return next;
      });
    }
  }

  function setFinding(qid, patch) {
    setFindings((f) => ({ ...f, [qid]: { finding: "", severity: "minor", ...(f[qid] || {}), ...patch } }));
  }

  // Converts the in-progress answers into the site_inspections record shape.
  function buildRecord() {
    const sectionScores = {};
    let overallScore = 0;
    let maxScore = 0;
    const recComments = {}, recPhotos = {};
    sections.forEach((s) => {
      sectionScores[s.id] = {};
      s.questions.forEach((q) => {
        const k = K(s.id, q.id);
        const a = answers[k];
        if (String(comments[k] || "").trim()) (recComments[s.id] = recComments[s.id] || {})[q.id] = comments[k].trim();
        if ((photos[k] || []).length) (recPhotos[s.id] = recPhotos[s.id] || {})[q.id] = photos[k];
        if (a === NA) { sectionScores[s.id][q.id] = "na"; return; }   // shown as N/A on the portal
        const score = answerPoints(a === PASS ? 2 : a === PARTIAL ? 1 : a === ISSUE ? 0 : null);   // inspectionScore.js — N/A / unanswered left out
        if (score === null) return;
        sectionScores[s.id][q.id] = score;
        overallScore += score;
        maxScore += 2;
      });
    });

    const nonConformances = issues.map((q, i) => {
      const s = q.sec;
      const f = findings[q.key] || {};
      const partial = answers[q.key] === PARTIAL;
      return {
        id: `nc_local_${Date.now()}_${i}`,
        section: s ? s.label : "",
        sectionId: s ? s.id : "", questionId: q.id,
        finding: f.finding || (q.ref ? `${q.ref}${q.tag ? ` (${q.tag})` : ""} – ${q.text}` : q.text),
        severity: f.severity || (site && !partial ? "major" : "minor"),
        photos: f.photos || [],
        actionOwner: f.owner || "",
        actionDue: addDays((f.severity || (site && !partial ? "major" : "minor")) === "major" ? 2 : 7),
        actionStatus: "open",
        actionNote: "",
      };
    });

    return {
      id: `si_local_${Date.now()}`,
      type: typeId,
      typeLabel: type.label,
      date: today(),
      inspector: user.name,
      location,
      status: nonConformances.length ? "open" : "closed",
      overallScore,
      maxScore,
      sections: sectionScores,
      comments: recComments,
      photos: recPhotos,
      nonConformances,
      summary: nonConformances.length
        ? `${nonConformances.length} finding${nonConformances.length === 1 ? "" : "s"} raised on the mobile walkround.`
        : "No non-conformances identified.",
      ...(answered < allQuestions.length ? { summary: `Saved part-done on the phone: ${answered} of ${allQuestions.length} answered.${nonConformances.length ? ` ${nonConformances.length} finding${nonConformances.length === 1 ? "" : "s"} raised.` : ""}` } : {}),
      nextDue: nextDueFor(typeId),
    };
  }

  function submit() {
    const record = buildRecord();
    setSubmitted(record);
    onSubmit(record);
  }

  if (submitted) {
    const ncs = submitted.nonConformances.length;
    return (
      <Screen Z={Z}>
        <div style={{ textAlign: "center", paddingTop: 6 }}>
          <div style={{
            width: 82, height: 82, borderRadius: "50%", margin: "0 auto 14px",
            background: "rgba(16,185,129,0.14)", border: "2px solid rgba(16,185,129,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34,
          }}>
            {type.icon}
          </div>
          <h2 style={{ fontSize: 23, fontWeight: 900, margin: "0 0 6px", letterSpacing: -0.5, color: Z.white }}>
            {site ? "Audit saved" : "Walkround logged"}
          </h2>
          <p style={{ color: Z.muted, fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
            Scored {submitted.overallScore} of {submitted.maxScore}.{" "}
            {ncs === 0
              ? "Nothing raised — clean sheet."
              : ncs === 1
                ? "1 finding raised as a corrective action."
                : `${ncs} findings raised as corrective actions.`}
          </p>
        </div>

        <Card Z={Z} tone="flat" style={{ marginBottom: 14 }}>
          <Fact label="Reference" value={submitted.id.replace("si_local_", "SI-")} Z={Z} />
          <Fact label="Inspector" value={submitted.inspector} Z={Z} />
          <Fact label="Findings raised" value={String(ncs)} valueColor={ncs ? Z.gold : Z.green} Z={Z} />
          <Fact label="Next due" value={ukDate(submitted.nextDue)} Z={Z} last />
        </Card>

        <Card Z={Z} tone="warn" style={{ marginBottom: 18, display: "flex", gap: 11, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>⏳</span>
          <div style={{ fontSize: 12, color: Z.slate, lineHeight: 1.45 }}>
            Stored on your phone. It reaches the portal — with the photos — as soon as you have signal.
          </div>
        </Card>

        <PrimaryButton Z={Z} font={font} onClick={onExit}>Done</PrimaryButton>
      </Screen>
    );
  }

  if (!section) {
    return (
      <Screen Z={Z}>
        <Card Z={Z} tone="flat">
          <div style={{ fontSize: 13, color: Z.muted }}>
            This inspection type has no mobile checklist — complete it on the portal.
          </div>
        </Card>
      </Screen>
    );
  }

  const field = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.25)", border: `1px solid ${Z.border}`, borderRadius: 10, padding: 10, color: Z.white, fontSize: 13, lineHeight: 1.5, fontFamily: font };
  const addPhotos = (k, files, toFinding) => Promise.all(Array.from(files || []).map((file) => compressToDataUrl(file))).then((urls) => {
    const add = urls.filter(Boolean);
    if (toFinding) setFinding(k, { photos: [...((findings[k] || {}).photos || []), ...add] });
    else setPhotos((p) => ({ ...p, [k]: [...(p[k] || []), ...add] }));
  });
  const answeredIn = (s) => s.questions.filter((q) => answers[K(s.id, q.id)]).length;

  return (
    <Screen Z={Z}>
      <div ref={topRef} />
      {longList ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.12)", overflow: "hidden", marginBottom: 10 }}>
            <div style={{ width: `${allQuestions.length ? Math.round(answered / allQuestions.length * 100) : 0}%`, height: "100%", background: Z.green }} />
          </div>
          <label style={{ display: "block", fontSize: 12, color: Z.muted, marginBottom: 4 }} htmlFor="m-insp-sec">Section</label>
          <select id="m-insp-sec" data-testid="m-insp-section" value={secIdx} onChange={(e) => { setSecIdx(Number(e.target.value)); toTop(); }}
            style={{ ...field, minHeight: 46, fontSize: 14 }}>
            {sections.map((s, i) => { const n = answeredIn(s); return <option key={s.id} value={i}>{n === s.questions.length ? "✓ " : n ? "◐ " : ""}{s.label} ({n}/{s.questions.length})</option>; })}
          </select>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
          {sections.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: 4, borderRadius: 99,
              background: i <= secIdx ? Z.green : "rgba(255,255,255,0.12)",
            }} />
          ))}
        </div>
      )}

      <SectionLabel Z={Z} color={Z.green}>
        Section {secIdx + 1} of {sections.length} · {section.label}
      </SectionLabel>
      <h2 style={{
        fontSize: 20, fontWeight: 900, margin: "0 0 5px",
        letterSpacing: -0.4, lineHeight: 1.25, color: Z.white,
      }}>
        {type.label}
      </h2>
      <p style={{ color: Z.muted, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 14px" }}>
        {location} · {answered} of {allQuestions.length} answered · {site ? "Part and No each become a corrective action." : "flag anything and it becomes a corrective action."}
      </p>
      {section.intro && (
        <div data-testid="m-insp-intro" style={{ margin: "0 0 14px", padding: "10px 12px", borderRadius: 12, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", fontSize: 12.5, lineHeight: 1.5, color: Z.slate, whiteSpace: "pre-line" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#c4b5fd", marginBottom: 3 }}>{type.introLabel || "Introduction"}</div>
          {section.intro}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 20 }}>
        {section.questions.map((q) => {
          const k = K(section.id, q.id);
          const val = answers[k];
          const flagged = val === ISSUE || val === PARTIAL;
          const f = findings[k] || {};
          const note = comments[k] || "";
          const phs = photos[k] || [];
          return (
            <div key={q.id} style={{
              background: Z.overlay, borderRadius: 16, padding: 14,
              border: `1px solid ${flagged ? "rgba(245,158,11,0.35)" : Z.border}`,
            }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: Z.white,
                lineHeight: 1.4, marginBottom: 12, whiteSpace: "pre-line",
              }}>
                {q.ref && <span data-testid="m-insp-ref" style={{ fontSize: 11.5, fontWeight: 800, color: "#93c5fd", background: "rgba(37,99,235,0.18)", borderRadius: 6, padding: "1px 6px", marginRight: 7 }}>{q.ref}{q.tag ? ` · ${q.tag}` : ""}</span>}
                {q.text}
              </div>
              <div style={{ display: "flex", gap: 7 }} role="group" aria-label={`Answer ${q.ref || ""}`.trim()}>
                {ANS.map((a) => {
                  const on = val === a.key;
                  const st = ANSWER_STYLE[a.key];
                  return (
                    <button
                      key={a.key}
                      onClick={() => setAnswer(k, a.key)}
                      aria-pressed={on}
                      style={{
                        flex: a.flex, minHeight: 46, borderRadius: 11, padding: "11px 4px",
                        cursor: "pointer", fontFamily: font, fontSize: 12.5,
                        background: on ? st.bg : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${on ? st.border : Z.border}`,
                        color: on ? st.color : Z.muted,
                        fontWeight: on ? 800 : 600,
                      }}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>

              {flagged && (
                <div style={{
                  marginTop: 11, background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.28)", borderRadius: 12, padding: 12,
                }}>
                  <SectionLabel Z={Z} color={Z.gold}>What&rsquo;s wrong?</SectionLabel>
                  <textarea
                    value={f.finding || ""}
                    onChange={(e) => setFinding(k, { finding: e.target.value })}
                    placeholder="A sentence is plenty — what you saw and where."
                    rows={2}
                    style={{ ...field, resize: "none", marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <label style={{
                      flex: 1, minHeight: 44, display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 6, background: Z.overlay,
                      border: `1px solid ${Z.borderMd}`, borderRadius: 10,
                      color: Z.slate, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>
                      📷 {(f.photos || []).length ? `${f.photos.length} photo` : "Photo"}
                      <input
                        type="file" accept="image/*" multiple
                        style={{ display: "none" }}
                        onChange={(e) => { const fl = e.target.files; addPhotos(k, fl, true); e.target.value = ""; }}
                      />
                    </label>
                    <button
                      onClick={() => setFinding(k, { severity: (f.severity || (site && val === ISSUE ? "major" : "minor")) === "major" ? "minor" : "major" })}
                      style={{
                        flex: 1, minHeight: 44, borderRadius: 10, cursor: "pointer",
                        fontFamily: font, fontSize: 12, fontWeight: 800,
                        background: (f.severity || (site && val === ISSUE ? "major" : "minor")) === "major" ? "rgba(239,68,68,0.14)" : "rgba(255,255,255,0.07)",
                        border: `1px solid ${(f.severity || (site && val === ISSUE ? "major" : "minor")) === "major" ? "rgba(239,68,68,0.32)" : Z.borderMd}`,
                        color: (f.severity || (site && val === ISSUE ? "major" : "minor")) === "major" ? "#f87171" : Z.slate,
                      }}
                    >
                      {(f.severity || (site && val === ISSUE ? "major" : "minor")) === "major" ? "Major" : "Minor"}
                    </button>
                  </div>
                </div>
              )}

              {/* comment and evidence photos (any answer) */}
              {(site || openNote[k] || note) ? (
                <textarea data-testid="m-insp-comment" value={note} onChange={(e) => setComments((c) => ({ ...c, [k]: e.target.value }))}
                  aria-label={`Comment ${q.ref || ""}`.trim()} placeholder={site ? "Comments / evidence seen" : "Comment"} rows={2}
                  style={{ ...field, resize: "none", marginTop: 10 }} />
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                {phs.map((ph, pi) => (
                  <div key={pi} style={{ position: "relative", width: 56, height: 56, borderRadius: 8, overflow: "hidden", border: `1px solid ${Z.border}` }}>
                    <img src={ph} alt={`Evidence photo ${pi + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <button type="button" aria-label={`Remove evidence photo ${pi + 1}`} onClick={() => setPhotos((p) => ({ ...p, [k]: (p[k] || []).filter((_, x) => x !== pi) }))}
                      style={{ position: "absolute", top: 2, right: 2, width: 22, height: 22, borderRadius: 5, border: "none", background: "rgba(239,68,68,0.85)", color: "#fff", fontSize: 11 }}>✕</button>
                  </div>
                ))}
                <label data-testid="m-insp-qphoto" style={{ minHeight: 40, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", borderRadius: 10, border: `1px dashed ${Z.borderMd}`, color: Z.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  📷 {phs.length ? "Another photo" : "Evidence photo"}
                  <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { const fl = e.target.files; addPhotos(k, fl, false); e.target.value = ""; }} />
                </label>
                {!site && !openNote[k] && !note && (
                  <button type="button" onClick={() => setOpenNote((o) => ({ ...o, [k]: true }))} style={{ minHeight: 40, background: "none", border: "none", color: Z.muted, fontSize: 12, textDecoration: "underline", fontFamily: font }}>💬 Comment</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {secIdx > 0 && (
          <GhostButton Z={Z} font={font} onClick={() => { setSecIdx(secIdx - 1); toTop(); }}>←</GhostButton>
        )}
        <PrimaryButton
          Z={Z} font={font} tone="green"
          onClick={() => { if (last) submit(); else { setSecIdx(secIdx + 1); toTop(); } }}
          style={{ flex: 1 }}
        >
          {last ? (site ? "Save audit" : "Submit walkround") : "Next section →"}
        </PrimaryButton>
      </div>
      {site && !last && answered > 0 && (
        <GhostButton Z={Z} font={font} onClick={submit} style={{ width: "100%", marginTop: 10 }}>
          Save part-done ({answered} of {allQuestions.length}) — carry on later on the portal
        </GhostButton>
      )}
    </Screen>
  );
}

function Fact({ label, value, valueColor, Z, last }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0",
      fontSize: 13, borderBottom: last ? "none" : `1px solid ${Z.border}`,
    }}>
      <span style={{ color: Z.muted }}>{label}</span>
      <span style={{ color: valueColor || Z.white, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export { Inspections, InspectionRun };
