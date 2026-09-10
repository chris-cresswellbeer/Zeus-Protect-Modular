// src/mobile/screens/Inspection.jsx
//
// Site inspections on the phone: the list of what is due, and the walkround
// runner itself — one section per screen, three-way answer per question.
//
// Scoring follows the desktop convention in src/domains/inspections: each
// question scores 2 (compliant) or 0 (non-conformance); N/A questions are
// excluded from both overallScore and maxScore so a skipped item cannot drag
// the score down. Anything answered "Issue" becomes a nonConformance on the
// submitted record, which is what the desktop tab renders and what drives the
// corrective action.
//
// The whole flow works with no signal. The submitted record goes out through
// onSubmit, which MobileApp wraps in the offline queue.

import React from "react";
import { INSP_TYPES, INSP_SECTIONS } from "../../data/seedInspections";
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
  return INSP_TYPES.find((t) => t.id === id) || INSP_TYPES[0];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── List ────────────────────────────────────────────────────────────────────
//
// `due` — [{ typeId, location, dueDate, overdue }]
// `recent` — submitted records in the seedInspections shape.

function Inspections({ due, recent, onStart, onOpenDesktop, Z, font }) {
  return (
    <Screen Z={Z}>
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
              sub={`${d.location} · ${d.overdue ? "overdue" : "due"} ${d.dueDate}`}
              right={<StatusChip label={d.overdue ? "Overdue" : "Start"} color={d.overdue ? "#ef4444" : "#f59e0b"} />}
              onClick={() => onStart(d)}
            />
          );
        })}
      </div>

      <SectionLabel Z={Z}>Recent walkrounds</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {recent.slice(0, 6).map((r) => {
          const t = typeFor(r.type);
          const ncs = (r.nonConformances || []).length;
          return (
            <Row
              key={r.id}
              Z={Z} font={font}
              icon={t.icon}
              title={t.label}
              sub={`${r.date} · ${r.inspector} · ${r.overallScore}/${r.maxScore}`}
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

function InspectionRun({ typeId, location, user, onSubmit, onExit, Z, font }) {
  const type = typeFor(typeId);
  const sections = INSP_SECTIONS[typeId] || [];
  const [secIdx, setSecIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({});   // { [questionId]: PASS|ISSUE|NA }
  const [findings, setFindings] = React.useState({}); // { [questionId]: { finding, severity } }
  const [submitted, setSubmitted] = React.useState(null);

  const section = sections[secIdx];
  const allQuestions = sections.flatMap((s) => s.questions);
  const answered = allQuestions.filter((q) => answers[q.id]).length;
  const issues = allQuestions.filter((q) => answers[q.id] === ISSUE);
  const last = secIdx === sections.length - 1;

  function setAnswer(qid, key) {
    setAnswers((a) => ({ ...a, [qid]: key }));
    if (key !== ISSUE) {
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

  function buildRecord() {
    const sectionScores = {};
    let overallScore = 0;
    let maxScore = 0;
    sections.forEach((s) => {
      sectionScores[s.id] = {};
      s.questions.forEach((q) => {
        const a = answers[q.id];
        if (!a || a === NA) return;
        const score = a === PASS ? 2 : 0;
        sectionScores[s.id][q.id] = score;
        overallScore += score;
        maxScore += 2;
      });
    });

    const nonConformances = issues.map((q, i) => {
      const s = sections.find((sec) => sec.questions.some((x) => x.id === q.id));
      const f = findings[q.id] || {};
      return {
        id: `nc_local_${Date.now()}_${i}`,
        section: s ? s.label : "",
        finding: f.finding || q.text,
        severity: f.severity || "minor",
        photos: f.photos || [],
        actionOwner: f.owner || "",
        actionDue: addDays(f.severity === "major" ? 2 : 7),
        actionStatus: "open",
        actionNote: "",
      };
    });

    return {
      id: `si_local_${Date.now()}`,
      type: typeId,
      date: today(),
      inspector: user.name,
      location,
      status: nonConformances.length ? "open" : "closed",
      overallScore,
      maxScore,
      sections: sectionScores,
      nonConformances,
      summary: nonConformances.length
        ? `${nonConformances.length} finding${nonConformances.length === 1 ? "" : "s"} raised on the mobile walkround.`
        : "No non-conformances identified.",
      nextDue: addDays(7),
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
            Walkround logged
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
          <Fact label="Next due" value={submitted.nextDue} Z={Z} last />
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

  return (
    <Screen Z={Z}>
      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
        {sections.map((s, i) => (
          <div key={s.id} style={{
            flex: 1, height: 4, borderRadius: 99,
            background: i <= secIdx ? Z.green : "rgba(255,255,255,0.12)",
          }} />
        ))}
      </div>

      <SectionLabel Z={Z} color={Z.green}>
        Section {secIdx + 1} of {sections.length} · {section.label}
      </SectionLabel>
      <h2 style={{
        fontSize: 20, fontWeight: 900, margin: "0 0 5px",
        letterSpacing: -0.4, lineHeight: 1.25, color: Z.white,
      }}>
        {type.label}
      </h2>
      <p style={{ color: Z.muted, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 18px" }}>
        {location} · {answered} of {allQuestions.length} answered · flag anything and it becomes a corrective action.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 20 }}>
        {section.questions.map((q) => {
          const val = answers[q.id];
          const flagged = val === ISSUE;
          const f = findings[q.id] || {};
          return (
            <div key={q.id} style={{
              background: Z.overlay, borderRadius: 16, padding: 14,
              border: `1px solid ${flagged ? "rgba(245,158,11,0.35)" : Z.border}`,
            }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: Z.white,
                lineHeight: 1.4, marginBottom: 12,
              }}>
                {q.text}
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                {ANSWERS.map((a) => {
                  const on = val === a.key;
                  const st = ANSWER_STYLE[a.key];
                  return (
                    <button
                      key={a.key}
                      onClick={() => setAnswer(q.id, a.key)}
                      aria-pressed={on}
                      style={{
                        flex: a.flex, minHeight: 46, borderRadius: 11, padding: "11px 6px",
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
                    onChange={(e) => setFinding(q.id, { finding: e.target.value })}
                    placeholder="A sentence is plenty — what you saw and where."
                    rows={2}
                    style={{
                      width: "100%", boxSizing: "border-box", resize: "none",
                      background: "rgba(0,0,0,0.25)", border: `1px solid ${Z.border}`,
                      borderRadius: 10, padding: 10, color: Z.white,
                      fontSize: 13, lineHeight: 1.5, fontFamily: font, marginBottom: 10,
                    }}
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
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          e.target.value = "";
                          Promise.all(files.map((file) => compressToDataUrl(file)))
                            .then((urls) => setFinding(q.id, { photos: [...(f.photos || []), ...urls.filter(Boolean)] }));
                        }}
                      />
                    </label>
                    <button
                      onClick={() => setFinding(q.id, { severity: f.severity === "major" ? "minor" : "major" })}
                      style={{
                        flex: 1, minHeight: 44, borderRadius: 10, cursor: "pointer",
                        fontFamily: font, fontSize: 12, fontWeight: 800,
                        background: f.severity === "major" ? "rgba(239,68,68,0.14)" : "rgba(255,255,255,0.07)",
                        border: `1px solid ${f.severity === "major" ? "rgba(239,68,68,0.32)" : Z.borderMd}`,
                        color: f.severity === "major" ? "#f87171" : Z.slate,
                      }}
                    >
                      {f.severity === "major" ? "Major" : "Minor"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {secIdx > 0 && (
          <GhostButton Z={Z} font={font} onClick={() => setSecIdx(secIdx - 1)}>←</GhostButton>
        )}
        <PrimaryButton
          Z={Z} font={font} tone="green"
          onClick={() => (last ? submit() : setSecIdx(secIdx + 1))}
          style={{ flex: 1 }}
        >
          {last ? "Submit walkround" : "Next section →"}
        </PrimaryButton>
      </div>
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
