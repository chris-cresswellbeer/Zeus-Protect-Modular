import React, { useState, useMemo, useEffect } from "react";
import { E } from "../../lib/emoji";
import { brandLightLogo } from "../../shared/Logo";
import { brandCompany } from "../../lib/brandCore";
import { todayISO } from "../../lib/dates";
import { getSiteLists } from "../../lib/siteLists";
import { buildEvidencePack, renderEvidencePackHtml } from "./evidencePack";
import { openMonthlyReport } from "./monthlyReport";
import { loadPpeIssues, loadPpeSettings } from "../../lib/ppeClient";
import { loadLoneSessionsBetween, loadLoneSettings } from "../../lib/loneClient";
import { loadRacking } from "../../lib/rackClient";

/**
 * EvidencePackView — Reports → "Evidence Pack".
 * Choose a period (last 12 months by default), who it's for, and whether to include the
 * incident list; one button produces the print-ready pack (evidencePack.js), which the
 * browser saves as a PDF. Summary figures only: no names, no injury details, so it can
 * go to customers, insurers and auditors.
 *
 * data = everything the pack reads (app/screens/AdminPortal.jsx passes it through ReportsTab). PPE, lone
 * working and racking keep their own stores (lib/*Client.js), so they're read here, fresh,
 * when the view opens (lone working again when the period changes). A part that can't be
 * read (table not there yet) is simply left out of the pack.
 */
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function presets(today) {
  const t = new Date(`${today}T12:00:00`), y = t.getFullYear();
  const back = new Date(t); back.setFullYear(y - 1); back.setDate(back.getDate() + 1);
  return [
    { id: "12m", label: "Last 12 months", from: iso(back), to: today },
    { id: "ytd", label: `${y} so far`, from: `${y}-01-01`, to: today },
    { id: "last", label: String(y - 1), from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ];
}

export function EvidencePackView({ data, userName, Z, font }) {
  const today = todayISO();
  const pre = useMemo(() => presets(today), [today]);
  const [from, setFrom] = useState(pre[0].from);
  const [to, setTo] = useState(pre[0].to);
  const [preparedFor, setPreparedFor] = useState("");
  const [preparedBy, setPreparedBy] = useState(userName || "");
  const [incList, setIncList] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  // PPE, lone working and racking: read once when the view opens
  const [extra, setExtra] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const safe = p => p.then(v => v, () => null);
      const [ppeIssues, ppeSettings, loneSettings, rk] = await Promise.all([
        safe(loadPpeIssues({ fresh: true })), safe(loadPpeSettings()), safe(loadLoneSettings()), safe(loadRacking({ fresh: true, checks: true })),
      ]);
      if (!live) return;
      setExtra({ ppeIssues: Array.isArray(ppeIssues) ? ppeIssues : null, ppeSettings, loneSettings,
        racking: rk && !rk.missing ? { settings: rk.settings, locations: rk.locations, damage: rk.damage, checks: rk.checks } : null });
    })();
    return () => { live = false; };
  }, []);
  // lone working sessions for the chosen period (only sessions in the period are read)
  const [lone, setLone] = useState(null);
  useEffect(() => {
    if (!ok) return undefined;
    let live = true;
    const t = setTimeout(() => { loadLoneSessionsBetween(from, to).then(r => { if (live) setLone({ from, to, rows: r }); }, () => { if (live) setLone({ from, to, rows: null }); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [from, to, ok]);
  const loneReady = !!lone && lone.from === from && lone.to === to;
  const ready = !!extra && loneReady;

  const pack = useMemo(() => {
    if (!ok) return null;
    const lists = getSiteLists() || {};
    return buildEvidencePack({ ...data, ...(extra || {}), loneSessions: loneReady ? lone.rows : null,
        zones: lists.firstAidZones || [], shifts: lists.firstAidShifts || [], companyName: brandCompany(), today },
      { from, to, preparedBy: preparedBy.trim(), preparedFor: preparedFor.trim(), includeIncidentList: incList });
  }, [data, extra, lone, loneReady, from, to, preparedBy, preparedFor, incList, ok, today]);

  function generate() {
    if (!pack || !ready) return;
    const html = renderEvidencePackHtml(pack, { logoSrc: brandLightLogo() });
    setBlocked(!openMonthlyReport(html, `HS_Evidence_Pack_${from}_to_${to}.html`));
  }

  const inp = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "8px 10px", color: Z.white, fontFamily: font, fontSize: 13 };
  const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: Z.muted, letterSpacing: .5, textTransform: "uppercase" };
  const chip = on => ({ background: on ? "rgba(37,99,235,0.18)" : Z.overlay, color: on ? Z.white : Z.muted, border: `1px solid ${on ? Z.accent : Z.borderMd}`, borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700 });
  const tiles = pack ? [
    ["Training compliance", pack.competence.training.pct === null ? "—" : `${pack.competence.training.pct}%`],
    ["Incidents", pack.incidents.total], ["RIDDOR", pack.incidents.riddor], ["Inspections", pack.monitoring.inspections],
    ["Fire drills", pack.emergency.drills.length], ["Risk assessments", pack.riskAssessments.total], ["Actions closed", pack.improvement.closed],
  ] : [];

  return (
    <div data-testid="evidence-pack">
      <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: Z.white }}>{E("📦 ", "")}H&amp;S audit evidence pack</div>
        <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 3, lineHeight: 1.5, maxWidth: 760 }}>
          One document for customer supplier audits, insurers, BRCGS or ISO auditors and contractor schemes such as CHAS. Any period, set out under ISO 45001 headings: policy and documents, risk assessment and COSHH, training and competence, permits, equipment, contractors, PPE and lone working, fire and first aid, incidents, inspections and racking, and corrective actions. <b>Summary figures only:</b> it names no staff, contractors or injured people.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {pre.map(p => <button key={p.id} type="button" style={chip(from === p.from && to === p.to)} onClick={() => { setFrom(p.from); setTo(p.to); }} data-testid={`ep-preset-${p.id}`}>{p.label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
          <label style={lbl}>From<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inp} data-testid="ep-from"/></label>
          <label style={lbl}>To<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={inp} data-testid="ep-to"/></label>
          <label style={{ ...lbl, flex: "1 1 220px" }}>Prepared for (optional)<input value={preparedFor} maxLength={120} onChange={e => setPreparedFor(e.target.value)} placeholder="e.g. Customer supplier audit, insurer renewal" style={inp} data-testid="ep-for"/></label>
          <label style={{ ...lbl, flex: "1 1 200px" }}>Prepared by<input value={preparedBy} maxLength={120} onChange={e => setPreparedBy(e.target.value)} placeholder="Name and job title" style={inp} data-testid="ep-by"/></label>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 13, color: Z.white, cursor: "pointer" }}>
          <input type="checkbox" checked={incList} onChange={e => setIncList(e.target.checked)} style={{ width: 17, height: 17, accentColor: Z.accent }} data-testid="ep-inclist"/>
          Include a list of incidents (date, type, location, RIDDOR and status only: no descriptions or names)
        </label>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" onClick={generate} disabled={!ok || !ready} data-testid="ep-generate"
            style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 800, cursor: ok && ready ? "pointer" : "default", fontFamily: font, fontSize: 13, opacity: ok && ready ? 1 : .5 }}>
            {E("📄 ", "")}{ok && !ready ? "Reading PPE, lone working and racking…" : "Generate evidence pack (PDF)"}
          </button>
          {!ok && <span role="alert" style={{ fontSize: 12, color: Z.amber, fontWeight: 700 }}>Choose a start date on or before the end date.</span>}
        </div>
        {blocked && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: Z.amber, fontWeight: 700 }}>Your browser blocked the new tab, so the pack was downloaded as a web page instead. Open it and use Print → Save as PDF, or allow pop-ups for this site and try again.</div>}
        <div style={{ fontSize: 11, color: Z.muted, marginTop: 10 }}>The pack opens in a new tab and the print window appears: choose <b>Save as PDF</b>. Activity is for the period; status (compliance, review dates, open actions) is as at today.</div>
      </div>
      {pack && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }} data-testid="ep-tiles">
          {tiles.map(([l, v]) => (
            <div key={l} style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: Z.white, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: Z.muted, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
