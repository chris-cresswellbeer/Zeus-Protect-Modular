import React, { useState, useMemo, useEffect } from "react";
import { E } from "../../lib/emoji";
import { brandLightLogo } from "../../shared/Logo";
import { brandCompany } from "../../lib/brandCore";
import { todayISO } from "../../lib/dates";
import { notify } from "../../shared/Feedback";
import { buildTrainingMatrix } from "../training/trainingMatrix";
import { loadHoursWorked, saveHoursWorked, loadTrainingSnapshots } from "../../lib/hsPerformance";
import { loadRacking } from "../../lib/rackClient";
import { auditEvent } from "../../lib/audit";
import { buildBoardReport, renderBoardReportHtml, fyOf, fyLabel, fyMonths, prevQuarter } from "./boardReport";
import { openMonthlyReport, MONTHS } from "./monthlyReport";

/**
 * BoardReportView — Reports → "H&S Performance".
 * The quarterly / annual report for the board (boardReport.js): accident and lost-time
 * injury figures with frequency rates, leading indicators and year-on-year by quarter.
 * Pick the quarter or year and press one button for the PDF.
 *
 * Hours worked (from payroll) are typed in here once a month: the frequency rates need them.
 * They're stored in app_settings row "hours_worked" with the month the reporting year
 * starts (lib/hsPerformance.js). Racking checks are read fresh for the inspection figures.
 */
export function BoardReportView({ incidents, investigations, inspections, staff, modules, assigns, comps, userName, Z, font }) {
  const today = todayISO();
  const ty = +today.slice(0, 4), tm = +today.slice(5, 7) - 1;
  const [hours, setHours] = useState(null);          // { yearStart, hours } once read
  const [snaps, setSnaps] = useState(null);
  const [rk, setRk] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      const safe = p => p.then(v => v, () => null);
      const [h, s, r] = await Promise.all([safe(loadHoursWorked()), safe(loadTrainingSnapshots()), safe(loadRacking({ fresh: true, checks: true }))]);
      if (!live) return;
      setFailed(!h);
      setHours(h || { yearStart: 0, hours: {} });
      setSnaps(s || { months: {} });
      setRk(r && !r.missing ? r : { checks: [], settings: undefined });
    })();
    return () => { live = false; };
  }, []);
  const ys = hours ? hours.yearStart : 0;

  // period choice: "q:2026:3" or "y:2026"
  const curFy = fyOf(ty, tm, ys);
  const curQ = Math.floor(((tm - ys + 12) % 12) / 3) + 1;
  const options = useMemo(() => {
    const qs = [], yrs = [];
    let p = { fy: curFy, q: curQ };
    for (let k = 0; k < 12; k++) { qs.push({ id: `q:${p.fy}:${p.q}`, label: `Q${p.q} ${fyLabel(p.fy, ys)}${k === 0 ? " (so far)" : ""}` }); p = prevQuarter(p.fy, p.q); }
    for (let k = 0; k < 4; k++) yrs.push({ id: `y:${curFy - k}`, label: `${ys ? "Year " : ""}${fyLabel(curFy - k, ys)}${k === 0 ? " (so far)" : ""}` });
    return { qs, yrs };
  }, [curFy, curQ, ys]);
  const [sel, setSel] = useState("");
  const selId = sel && [...options.qs, ...options.yrs].some(o => o.id === sel) ? sel : options.qs[1].id;   // default: the last full quarter
  const [kindS, fyS, qS] = selId.split(":");
  const choice = kindS === "q" ? { kind: "quarter", fy: +fyS, q: +qS } : { kind: "year", fy: +fyS };

  const trainingNow = useMemo(() => {
    const m = buildTrainingMatrix({ staff, modules, assigns: assigns || {}, comps: comps || {} });
    return { pct: m.totals.pct, fullyCompliant: m.totals.fullyCompliant, withTraining: m.totals.withTraining };
  }, [staff, modules, assigns, comps]);

  const ready = !!hours && !!rk && !!snaps;
  const report = useMemo(() => (ready ? buildBoardReport({ incidents, investigations, inspections, rackingChecks: rk.checks, rackingSettings: rk.settings,
    hours, snapshots: snaps, trainingNow, today, companyName: brandCompany(), generatedBy: userName }, choice) : null),
  [ready, incidents, investigations, inspections, rk, hours, snaps, trainingNow, today, userName, selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [blocked, setBlocked] = useState(false);
  function generate() {
    if (!report) return;
    const ok = openMonthlyReport(renderBoardReportHtml(report, { logoSrc: brandLightLogo() }), `HS_Performance_${report.period.label.replace(/[\s/]+/g, "_")}.html`);
    setBlocked(!ok);
  }

  // ── hours worked editor ──
  const [editFy, setEditFy] = useState(null);
  const hoursFy = editFy ?? choice.fy;
  const [draft, setDraft] = useState({});
  const [draftYs, setDraftYs] = useState(null);
  const [saving, setSaving] = useState(false);
  const months = fyMonths(hoursFy, draftYs ?? ys);
  const val = k => (k in draft ? draft[k] : hours && hours.hours[k] ? String(hours.hours[k]) : "");
  const dirty = Object.keys(draft).length > 0 || (draftYs !== null && draftYs !== ys);
  const missing = report && !report.current.future ? report.current.hoursMissing.length : 0;
  const [showHours, setShowHours] = useState(false);
  async function saveHours() {
    const bad = Object.entries(draft).find(([, v]) => String(v).trim() && !(Number(String(v).replace(/[, ]/g, "")) > 0));
    if (bad) { notify("Hours worked must be a number above 0 (or left empty).", { kind: "error" }); return; }
    setSaving(true);
    const latest = (await loadHoursWorked()) || hours;   // merge with anything another admin saved meanwhile
    const next = { yearStart: draftYs ?? ys, hours: { ...latest.hours } };
    Object.entries(draft).forEach(([k, v]) => { const n = Number(String(v).replace(/[, ]/g, "")); if (n > 0) next.hours[k] = Math.round(n); else delete next.hours[k]; });
    const err = await saveHoursWorked(next);
    setSaving(false);
    if (err) { notify(`Couldn't save the hours worked: ${err}`, { kind: "error" }); return; }
    setHours(next); setDraft({}); setDraftYs(null);
    auditEvent("settings", "hours_worked", "update", `Hours worked updated (${Object.keys(draft).join(", ") || "reporting year start"})`, {}, "Reports");
    notify("Hours worked saved.");
  }

  const c = report && report.current;
  const band = p => (p === null || p === undefined ? Z.muted : p >= 95 ? Z.green : p >= 80 ? Z.amber : Z.red);
  const tiles = c && !c.future ? [
    ["Accidents", c.accidents, report.lastYear.future ? "" : `${report.lastYear.accidents} in ${report.period.lastYearLabel}`, Z.white],
    ["Lost-time injuries", c.lti, `${c.daysLost} working day${c.daysLost !== 1 ? "s" : ""} lost`, c.lti ? Z.red : Z.green],
    ["RIDDOR", c.riddor, "reportable to the HSE", c.riddor ? Z.red : Z.green],
    ["AFR", c.afr === null ? "—" : c.afr, c.afr === null ? "needs hours worked" : `LTIFR ${c.ltifr} · per 100,000 hours`, c.afr === null ? Z.muted : Z.white],
    ["Near misses", c.nearMisses, `${c.hazards} hazard report${c.hazards !== 1 ? "s" : ""}`, Z.white],
    ["Inspections on time", c.inspections.pct === null ? "—" : `${c.inspections.pct}%`, `${c.inspections.onTime} of ${c.inspections.dueSoFar} due`, band(c.inspections.pct)],
    ["Actions closed on time", c.actions.pct === null ? "—" : `${c.actions.pct}%`, `${c.actions.onTime} of ${c.actions.closed} closed`, band(c.actions.pct)],
    ["Training compliance", report.training.atEnd === null ? "—" : `${report.training.atEnd}%`, report.period.partial ? "today" : report.training.atEnd === null ? "not recorded for then" : "end of period", band(report.training.atEnd)],
  ] : [];
  const sel2 = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "8px 12px", color: Z.white, fontFamily: font, fontSize: 13 };
  const btnP = { background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontFamily: font, fontSize: 13 };
  const btnS = { background: Z.overlay, color: Z.white, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontFamily: font, fontSize: 13 };

  return (
    <div data-testid="board-view">
      <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: Z.white }}>{E("📈 ", "")}H&amp;S performance report</div>
            <div style={{ fontSize: 12, color: Z.muted, marginTop: 3 }}>For the board, by quarter or year: accidents, lost-time injuries and days lost, frequency rates, near misses, inspections and actions on time, training, and year on year. No names.</div>
          </div>
          <select value={selId} onChange={e => setSel(e.target.value)} style={sel2} aria-label="Report period" data-testid="board-period">
            <optgroup label="Quarter">{options.qs.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>
            <optgroup label="Whole year">{options.yrs.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>
          </select>
          <button onClick={generate} disabled={!report} style={{ ...btnP, opacity: report ? 1 : .5 }} data-testid="board-generate">{E("📄 ", "")}Generate PDF report</button>
        </div>
        {blocked && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: Z.amber, fontWeight: 700 }}>Your browser blocked the new tab, so the report was downloaded as a web page instead. Open it and use Print → Save as PDF.</div>}
        {failed && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: Z.amber, fontWeight: 700 }}>The hours worked couldn't be read, so the frequency rates are blank. Try again later.</div>}
        {!ready && <div style={{ marginTop: 12, fontSize: 12, color: Z.muted }}>Loading…</div>}
      </div>

      {missing > 0 && (
        <div role="alert" data-testid="board-hours-missing" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: Z.white, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>Hours worked are missing for <b>{missing} month{missing !== 1 ? "s" : ""}</b> of {report.period.label}, so the accident frequency rates can't be worked out.</span>
          <button style={btnS} onClick={() => setShowHours(true)}>Enter hours worked</button>
        </div>
      )}

      {tiles.length > 0 && (
        <div data-testid="board-tiles" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
          {tiles.map(([l, v, s, col]) => (
            <div key={l} data-testid="board-tile" style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: col, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: Z.white, marginTop: 4 }}>{l}</div>
              <div style={{ fontSize: 11, color: Z.muted, marginTop: 2 }}>{s}</div>
            </div>
          ))}
        </div>
      )}
      {report && (
        <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, color: Z.muted, textTransform: "uppercase", marginBottom: 8 }}>Key points — {report.period.label} ({report.period.range})</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: Z.white, lineHeight: 1.7 }}>
            {report.keyPoints.map((p, k) => <li key={k} style={/^ATTENTION/.test(p) ? { color: Z.red, fontWeight: 700 } : undefined}>{p}</li>)}
          </ul>
        </div>
      )}

      <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "14px 18px" }} data-testid="board-hours">
        <button type="button" onClick={() => setShowHours(v => !v)} aria-expanded={showHours}
          style={{ background: "none", border: "none", color: Z.white, fontFamily: font, fontSize: 14, fontWeight: 800, cursor: "pointer", padding: 0, display: "flex", gap: 8, alignItems: "center" }}>
          <span>{showHours ? "▾" : "▸"}</span> Hours worked (from payroll)
        </button>
        {showHours && hours && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: Z.muted, marginBottom: 10 }}>Total hours worked on site each month, by everyone (employees and agency), from payroll. Used for the accident frequency rates (per 100,000 hours).</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: Z.muted }}>Year&nbsp;
                <select value={hoursFy} onChange={e => setEditFy(+e.target.value)} style={sel2} aria-label="Hours worked year">
                  {[0, 1, 2, 3].map(k => <option key={k} value={curFy - k}>{fyLabel(curFy - k, draftYs ?? ys)}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, color: Z.muted }}>Reporting year starts in&nbsp;
                <select value={draftYs ?? ys} onChange={e => setDraftYs(+e.target.value)} style={sel2} aria-label="Reporting year starts in" data-testid="hours-year-start">
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8 }}>
              {months.map(m => (
                <label key={m.key} style={{ fontSize: 12, color: Z.muted, display: "flex", flexDirection: "column", gap: 4 }}>
                  {MONTHS[m.m].slice(0, 3)} {m.y}
                  <input inputMode="numeric" value={val(m.key)} disabled={m.key > today.slice(0, 7)} data-testid={`hours-${m.key}`}
                    onChange={e => { const v = e.target.value; setDraft(d => ({ ...d, [m.key]: v })); }}
                    style={{ ...sel2, width: "100%", boxSizing: "border-box", opacity: m.key > today.slice(0, 7) ? .4 : 1 }} aria-label={`Hours worked ${MONTHS[m.m]} ${m.y}`}/>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={saveHours} disabled={!dirty || saving} style={{ ...btnP, opacity: dirty && !saving ? 1 : .5 }} data-testid="hours-save">{saving ? "Saving…" : "Save hours worked"}</button>
              {dirty && <button onClick={() => { setDraft({}); setDraftYs(null); }} style={btnS}>Cancel</button>}
            </div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: Z.muted, marginTop: 10 }}>
        To count a lost-time injury, open the accident in Incidents and fill in <b>Time off work</b> (and the working days lost when they're back).
      </div>
    </div>
  );
}
