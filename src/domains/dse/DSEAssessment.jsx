import { useState } from "react";
import { DSE_SECTIONS } from "../../data/seedDse";

function DSEAssessment({ user, dseAnswers, setDseAnswers, dseComments, setDseComments, dseSection, setDseSection, dseSubmitted, setDseSubmitted, dseReports, setDseReports, adminResponses, darkMode, onClose, Z, font }) {
  const section = DSE_SECTIONS[dseSection];
  const totalSections = DSE_SECTIONS.length;
  const isLast = dseSection === totalSections - 1;
  const allAnswered = section.questions.every(q => dseAnswers[q.id] !== undefined);

  function setAnswer(qid, val) {
    setDseAnswers(prev => ({ ...prev, [qid]: val }));
  }

  function setComment(qid, text) {
    setDseComments(prev => ({ ...prev, [qid]: text }));
  }

  function submit() {
    const issues = [];
    DSE_SECTIONS.forEach(sec => {
      sec.questions.forEach(q => {
        const isIssue = q.flagOnYes ? dseAnswers[q.id] === true : dseAnswers[q.id] === false;
        if (isIssue) {
          issues.push({ section: sec.title, sectionIcon: sec.icon, question: q.text, risk: q.risk, comment: dseComments[q.id] || "" });
        }
      });
    });
    const report = {
      userId: user.id,
      userName: user.name,
      date: new Date().toISOString().slice(0, 10),
      answers: { ...dseAnswers },
      issues,
      totalQuestions: DSE_SECTIONS.reduce((s, sec) => s + sec.questions.length, 0),
      issueCount: issues.length,
    };
    setDseReports(prev => ({ ...prev, [user.id]: [...(prev[user.id] || []), report] }));
    setDseSubmitted(true);
  }

  if (dseSubmitted) {
    const reports = dseReports[user.id] || [];
    const ri = reports.length - 1;
    const report = reports[ri];
    const issueCount = report?.issueCount || 0;
    const userAdminResps = adminResponses?.[user.id] || {};
    const resolvedCount = report?.issues?.filter((_,ii) => userAdminResps[`${ri}_${ii}`]?.resolved).length || 0;

    return (
      <div style={{ minHeight: "100vh", background: Z.bg, fontFamily: font, color: Z.white }}>
        <div style={{ background: `linear-gradient(90deg,${Z.navyDk},${Z.navy})`, borderBottom: `1px solid ${Z.border}`, padding: "14px 28px", display: "flex", alignItems: "center", gap: 14 }}>
          <ZeusLogo darkMode={darkMode}/>
          <div style={{ width: 1, height: 28, background: Z.borderMd }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: Z.white }}>DSE Self-Assessment — Complete</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 16px", color: Z.muted, cursor: "pointer", fontFamily: font, fontWeight: 700 }}>← Back to Dashboard</button>
        </div>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 64 }}>{issueCount === 0 ? "🎉" : resolvedCount === issueCount ? "✅" : issueCount <= 3 ? "⚠️" : "🚨"}</div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, marginBottom: 8, color: Z.white }}>
              {issueCount === 0 ? "Excellent — No Issues Found" : resolvedCount === issueCount ? "All Issues Resolved" : `${issueCount} Issue${issueCount !== 1 ? "s" : ""} Identified`}
            </h1>
            <p style={{ color: Z.muted, fontSize: 14 }}>
              {issueCount > 0 && resolvedCount < issueCount && "Your manager has been notified and will follow up with you."}
              {issueCount > 0 && resolvedCount === issueCount && "Your manager has marked all issues as resolved. Keep your workstation setup up to date."}
              {issueCount === 0 && "Keep reviewing your setup annually or if anything changes."}
            </p>
            {issueCount > 0 && (
              <div style={{ display: "inline-flex", gap: 16, marginTop: 12, padding: "10px 20px", background: Z.overlay, borderRadius: 10, border: `1px solid ${Z.border}` }}>
                <span style={{ fontSize: 13, color: "#f87171" }}>⚠ {issueCount - resolvedCount} open</span>
                <span style={{ color: Z.borderMd }}>|</span>
                <span style={{ fontSize: 13, color: Z.green }}>✓ {resolvedCount} resolved</span>
              </div>
            )}
          </div>

          {issueCount > 0 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: Z.muted, marginBottom: 14 }}>YOUR ISSUES</h3>
              {report.issues.map((issue, ii) => {
                const resp = userAdminResps[`${ri}_${ii}`] || {};
                const resolved = resp.resolved || false;
                return (
                  <div key={ii} style={{ borderRadius: 14, border: `1px solid ${resolved ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.2)"}`, marginBottom: 12, overflow: "hidden", transition: "border-color .3s", background: Z.navyMd }}>
                    {/* Issue row */}
                    <div style={{ padding: "14px 18px", background: resolved ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <span>{issue.sectionIcon}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: resolved ? Z.green : "#f87171", textTransform: "uppercase" }}>{issue.section}</span>
                          {resolved && <span style={{ fontSize: 11, fontWeight: 700, color: Z.green }}>✓ RESOLVED</span>}
                        </div>
                        <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 4px", color: Z.white, lineHeight: 1.5 }}>{issue.question}</p>
                        <p style={{ fontSize: 12, color: Z.muted, margin: 0 }}>⚠ {issue.risk}</p>
                      </div>
                    </div>
                    {/* Staff comment */}
                    {issue.comment && (
                      <div style={{ padding: "10px 18px", background: "rgba(245,158,11,0.05)", borderTop: `1px solid rgba(245,158,11,0.15)` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: Z.gold, marginBottom: 2 }}>YOUR COMMENT</div>
                        <div style={{ fontSize: 12, color: Z.slate, lineHeight: 1.6 }}>{issue.comment}</div>
                      </div>
                    )}
                    {/* Admin response */}
                    {resp.comment && (
                      <div style={{ padding: "10px 18px", background: "rgba(37,99,235,0.07)", borderTop: `1px solid rgba(37,99,235,0.15)`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>👤</span>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: Z.accentLt, marginBottom: 2 }}>MANAGER RESPONSE</div>
                          <div style={{ fontSize: 12, color: Z.slate, lineHeight: 1.6 }}>{resp.comment}</div>
                        </div>
                      </div>
                    )}
                    {!resp.comment && !resolved && (
                      <div style={{ padding: "8px 18px", background: Z.overlay, borderTop: `1px solid ${Z.border}` }}>
                        <span style={{ fontSize: 11, color: Z.muted, fontStyle: "italic" }}>Awaiting manager response...</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {issueCount === 0 && (
            <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: 28, textAlign: "center" }}>
              <p style={{ color: Z.green, fontWeight: 700, margin: 0 }}>All {report.totalQuestions} questions answered satisfactorily. Your workstation meets DSE Regulations 1992 requirements.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: Z.bg, fontFamily: font, color: Z.white }}>
      <div style={{ background: `linear-gradient(90deg,${Z.navyDk},${Z.navy})`, borderBottom: `1px solid ${Z.border}`, padding: "12px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <ZeusLogo darkMode={darkMode}/>
        <div style={{ width: 1, height: 28, background: Z.borderMd }} />
        <button onClick={onClose} style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "6px 14px", color: Z.muted, cursor: "pointer", fontFamily: font, fontWeight: 700, fontSize: 12 }}>← Back</button>
        <span style={{ fontWeight: 700, fontSize: 15, color: Z.white }}>DSE Workstation Self-Assessment</span>
        <span style={{ marginLeft: "auto", color: Z.muted, fontSize: 12 }}>Section {dseSection + 1} of {totalSections}</span>
      </div>
      <div style={{ height: 3, background: Z.overlay }}>
        <div style={{ height: "100%", background: `linear-gradient(90deg,${Z.accent},${Z.accentLt})`, width: `${((dseSection + 1) / totalSections) * 100}%`, transition: "width .4s" }} />
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 24px" }}>
        {/* Section tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          {DSE_SECTIONS.map((s, i) => {
            const answered = s.questions.every(q => dseAnswers[q.id] !== undefined);
            return (
              <button key={s.id} onClick={() => setDseSection(i)}
                style={{ background: i === dseSection ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : answered ? "rgba(16,185,129,0.15)" : Z.overlay, border: `1px solid ${i === dseSection ? Z.accent : answered ? "rgba(16,185,129,0.3)" : Z.borderMd}`, borderRadius: 10, padding: "7px 14px", color: i === dseSection ? "#fff" : answered ? Z.green : Z.muted, cursor: "pointer", fontFamily: font, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                {s.icon} {s.title} {answered && i !== dseSection && <span style={{ color: Z.green }}>✓</span>}
              </button>
            );
          })}
        </div>

        <div style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navyDk})`, borderRadius: 20, padding: 32, border: `1px solid ${Z.borderMd}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid ${Z.border}` }}>
            <span style={{ fontSize: 36 }}>{section.icon}</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: -.5, color: Z.white }}>{section.title}</h2>
              <p style={{ margin: "4px 0 0", color: Z.muted, fontSize: 13 }}>Answer Yes or No for each question based on your current workstation setup</p>
            </div>
          </div>

          {section.questions.map((q, qi) => {
            const ans = dseAnswers[q.id];
            const isIssue = q.flagOnYes ? ans === true : ans === false;
            const isGood  = q.flagOnYes ? ans === false : ans === true;
            return (
              <div key={q.id} style={{ marginBottom: 20, padding: "18px 20px", background: Z.overlay, borderRadius: 14, border: `1px solid ${isIssue ? "rgba(239,68,68,0.35)" : isGood ? "rgba(16,185,129,0.3)" : Z.border}`, transition: "border-color .2s" }}>
                <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 14px", lineHeight: 1.6, color: Z.white }}>
                  <span style={{ color: Z.accentLt, fontWeight: 800, marginRight: 8 }}>{qi + 1}.</span>{q.text}
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setAnswer(q.id, true)}
                    style={{ flex: 1, padding: "10px", borderRadius: 10,
                      border: `2px solid ${ans === true ? (q.flagOnYes ? "#f87171" : Z.green) : Z.borderMd}`,
                      background: ans === true ? (q.flagOnYes ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.2)") : Z.overlay,
                      color: ans === true ? (q.flagOnYes ? "#f87171" : Z.green) : Z.muted,
                      fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: font, transition: "all .2s" }}>
                    ✓ Yes
                  </button>
                  <button onClick={() => setAnswer(q.id, false)}
                    style={{ flex: 1, padding: "10px", borderRadius: 10,
                      border: `2px solid ${ans === false ? (q.flagOnYes ? Z.green : "#f87171") : Z.borderMd}`,
                      background: ans === false ? (q.flagOnYes ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.15)") : Z.overlay,
                      color: ans === false ? (q.flagOnYes ? Z.green : "#f87171") : Z.muted,
                      fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: font, transition: "all .2s" }}>
                    ✗ No
                  </button>
                </div>
                {isIssue && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", borderRadius: 8, fontSize: 12, color: "#fca5a5", display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ flexShrink: 0 }}>⚠</span><span>{q.risk}</span>
                    </div>
                    <div style={{ background: Z.overlay, borderRadius: 8, padding: "10px 12px", border: `1px solid rgba(239,68,68,0.25)` }}>
                      <label style={{ color: Z.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                        ADD A COMMENT <span style={{ color: Z.muted, fontWeight: 400, opacity: .7 }}>(optional — helps your manager understand the issue)</span>
                      </label>
                      <textarea
                        value={dseComments[q.id] || ""}
                        onChange={e => setComment(q.id, e.target.value)}
                        placeholder="e.g. My chair height cannot be adjusted, the mechanism is broken..."
                        rows={3}
                        style={{ width: "100%", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "8px 12px", color: Z.white, fontSize: 13, fontFamily: font, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 12 }}>
          <button onClick={() => setDseSection(s => Math.max(0, s - 1))} disabled={dseSection === 0}
            style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "11px 28px", color: Z.muted, cursor: "pointer", fontWeight: 700, fontFamily: font, opacity: dseSection === 0 ? .4 : 1 }}>← Previous</button>
          {isLast
            ? <button onClick={submit} disabled={!allAnswered}
                style={{ background: `linear-gradient(135deg,${Z.green},#059669)`, border: "none", borderRadius: 10, padding: "11px 32px", color: "#fff", cursor: "pointer", fontWeight: 800, fontFamily: font, opacity: allAnswered ? 1 : .45, boxShadow: "0 4px 16px rgba(16,185,129,0.4)" }}>
                Submit Assessment ✓
              </button>
            : <button onClick={() => setDseSection(s => s + 1)} disabled={!allAnswered}
                style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, border: "none", borderRadius: 10, padding: "11px 28px", color: "#fff", cursor: "pointer", fontWeight: 800, fontFamily: font, opacity: allAnswered ? 1 : .45, boxShadow: `0 4px 16px ${Z.accent}44` }}>
                Next Section →
              </button>
          }
        </div>
        {!allAnswered && <p style={{ color: Z.muted, fontSize: 12, textAlign: "right", marginTop: 8 }}>Please answer all questions to continue</p>}
      </div>
    </div>
  );
}

export { DSEAssessment };
