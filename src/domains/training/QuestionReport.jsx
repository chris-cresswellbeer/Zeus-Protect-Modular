/**
 * QuestionReport — Reports → Question Results.
 *
 * For one module: how often each question is answered wrong, and the wrong answer people
 * most often give, most-missed first — so a confusing question (or a slide that doesn't
 * explain something well) stands out. Also lists the signed declarations, for modules
 * that have one.
 *
 * What it counts (quizEngine.js questionStats): each person's latest passed result plus
 * every failed attempt logged in Quiz Failures. Results saved before October 2026 have no
 * question ids, so they only count for the module's current version (their positions still
 * match). A question bank only counts a question when it was asked.
 *
 * Props: modules, staff, comps, quizFailures, Z, font
 */
import React from "react";
import { savedItems, QTYPES, qType, quizSummary } from "./quizEngine";
import { questionStats } from "./quizBuilder";
import { ukDate } from "../../lib/dates";
import { useRemembered } from "../../lib/remembered";

const csvCell = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function QuestionReport({ modules, staff, comps, quizFailures, Z, font }) {
  // every result that carries answers, per module
  const byModule = React.useMemo(() => {
    const out = {};
    const add = (mid, r) => { (out[mid] = out[mid] || []).push(r); };
    (staff || []).forEach(u => {
      Object.entries((comps || {})[u.id] || {}).forEach(([mid, c]) => {
        if (c && c.answers && typeof c.answers === "object") add(String(mid), { kind: "pass", userId: u.id, name: u.name, date: c.date, answers: c.answers, moduleVersion: c.moduleVersion || 1 });
      });
    });
    (quizFailures || []).forEach(f => { if (f && f.answers) add(String(f.moduleId), { kind: "fail", userId: f.userId, name: f.userName, date: f.date, answers: f.answers, moduleVersion: f.moduleVersion || 1 }); });
    return out;
  }, [staff, comps, quizFailures]);

  const choices = (modules || []).filter(m => (m.quiz || []).length || (m.signoff && m.signoff.text))
    .map(m => ({ m, n: (byModule[String(m.id)] || []).length }))
    .sort((a, b) => (b.n > 0) - (a.n > 0) || String(a.m.title).localeCompare(String(b.m.title)));
  const [pick, setPick] = useRemembered("reports.questions.module", "");
  const chosen = choices.find(c => String(c.m.id) === String(pick)) || choices[0];
  const m = chosen && chosen.m;
  const results = m ? byModule[String(m.id)] || [] : [];
  const stats = m ? questionStats(m, results) : [];
  const counted = m ? results.filter(r => savedItems(m, r.answers).length && (r.answers.v === 2 || r.moduleVersion === (m.version || 1))) : [];
  const passes = counted.filter(r => r.kind === "pass").length, fails = counted.length - passes;
  const signed = results.filter(r => r.kind === "pass" && r.answers && r.answers.signoff).sort((a, b) => String(b.answers.signoff.at).localeCompare(String(a.answers.signoff.at)));

  const card = { background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 16, border: `1px solid ${Z.border}`, overflow: "hidden" };
  const th = { padding: "10px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: Z.muted, textTransform: "uppercase", textAlign: "left", background: Z.headerBg };
  const td = { padding: "11px 12px", fontSize: 13, borderTop: `1px solid ${Z.border}`, verticalAlign: "top" };
  const band = p => (p >= 40 ? "#f87171" : p >= 20 ? Z.amber : Z.green);

  function download() {
    const rows = [["Question", "Type", "Asked", "Wrong", "% wrong", "Most common wrong answer"],
      ...stats.map(r => [r.q.q, (QTYPES.find(x => x.id === qType(r.q)) || {}).label, r.asked, r.wrong, r.asked ? r.pctWrong : "", r.wrongAnswers[0] ? `${r.wrongAnswers[0].text} (${r.wrongAnswers[0].count})` : ""])];
    const blob = new Blob(["﻿" + rows.map(r => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `Question results - ${String(m.title).replace(/[^\w -]/g, "")}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div data-testid="question-report">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>Question Results</h3>
          <p style={{ color: Z.muted, fontSize: 13, margin: 0, maxWidth: 640 }}>Which questions people get wrong, most-missed first. A question most people miss usually means the question or the slide behind it needs a second look.</p>
        </div>
        {choices.length > 0 && (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: Z.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Module
            <select value={m ? String(m.id) : ""} onChange={e => setPick(e.target.value)} data-testid="qr-module"
              style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "9px 12px", color: Z.white, fontSize: 13, fontFamily: font, minWidth: 260, textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>
              {choices.map(c => <option key={c.m.id} value={String(c.m.id)}>{c.m.title}{c.n ? ` (${c.n})` : " — no results yet"}</option>)}
            </select>
          </label>
        )}
      </div>

      {!m ? <div style={{ ...card, padding: "40px 20px", textAlign: "center", color: Z.muted, fontSize: 14 }}>No modules with quiz questions yet.</div> : <>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14, fontSize: 12.5, color: Z.muted }}>
          <span style={{ color: Z.white, fontWeight: 700 }}>{m.icon} {m.title}</span>
          <span>· {quizSummary(m)}</span>
          <span data-testid="qr-counts">· {counted.length} result{counted.length === 1 ? "" : "s"} counted ({passes} passed, {fails} failed)</span>
          {stats.some(r => r.asked) && <button onClick={download} style={{ marginLeft: "auto", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", color: Z.green, borderRadius: 10, padding: "7px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: font }}>↓ Download (CSV)</button>}
        </div>

        {(m.quiz || []).length > 0 && (
          !counted.length ? <div style={{ ...card, padding: "32px 20px", textAlign: "center", color: Z.muted, fontSize: 13.5 }}>Nobody has taken this quiz since question results started being kept. Results appear here as people take it.</div> : (
          <div style={card}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Question</th><th style={{ ...th, width: 70 }}>Asked</th><th style={{ ...th, width: 180 }}>Wrong</th><th style={{ ...th, width: "28%" }}>Most common wrong answer</th></tr></thead>
              <tbody>
                {stats.map(r => (
                  <tr key={r.qid} data-testid="qr-row">
                    <td style={td}>
                      <div style={{ color: Z.white, fontWeight: 600, lineHeight: 1.45 }}><span style={{ color: Z.muted, marginRight: 6 }}>Q{r.qi + 1}.</span>{r.q.q}</div>
                      <div style={{ fontSize: 11, color: Z.muted, marginTop: 3 }}>{(QTYPES.find(x => x.id === qType(r.q)) || {}).label}</div>
                    </td>
                    <td style={{ ...td, color: Z.muted }}>{r.asked}</td>
                    <td style={td}>
                      {r.asked ? <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span data-testid="qr-pct" style={{ fontWeight: 800, color: band(r.pctWrong), minWidth: 40 }}>{r.pctWrong}%</span>
                          <div style={{ flex: 1, height: 6, borderRadius: 99, background: Z.overlay, overflow: "hidden" }}><div style={{ width: `${r.pctWrong}%`, height: "100%", background: band(r.pctWrong) }} /></div>
                        </div>
                        <div style={{ fontSize: 11, color: Z.muted, marginTop: 3 }}>{r.wrong} of {r.asked}</div>
                      </> : <span style={{ color: Z.muted, fontSize: 12 }}>Not asked yet</span>}
                    </td>
                    <td style={{ ...td, color: Z.muted, fontSize: 12.5 }}>{r.wrongAnswers[0] ? <><span style={{ color: "#fca5a5" }}>{r.wrongAnswers[0].text}</span> <span>({r.wrongAnswers[0].count})</span></> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>)
        )}
        <p style={{ fontSize: 11.5, color: Z.muted, margin: "10px 2px 0", lineHeight: 1.5 }}>Counts each person's latest pass and every failed attempt. Results from before question results were kept only count for the module's current version.</p>

        {m.signoff && m.signoff.text && (
          <div style={{ marginTop: 24 }} data-testid="qr-signed">
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 4px" }}>Signed declarations ({signed.length})</h4>
            <p style={{ fontSize: 12.5, color: Z.muted, margin: "0 0 10px" }}>“{m.signoff.text}”</p>
            {signed.length === 0 ? <div style={{ ...card, padding: "20px", color: Z.muted, fontSize: 13 }}>Nobody has signed yet.</div> : (
              <div style={card}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Person</th><th style={th}>Signed as</th><th style={th}>Date</th></tr></thead>
                  <tbody>{signed.map((r, i) => (
                    <tr key={i}><td style={{ ...td, color: Z.white, fontWeight: 600 }}>{r.name}</td><td style={{ ...td, color: Z.slate, fontStyle: "italic" }}>{r.answers.signoff.name}</td><td style={{ ...td, color: Z.muted }}>{ukDate(String(r.answers.signoff.at || r.date).slice(0, 10))}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </>}
    </div>
  );
}
