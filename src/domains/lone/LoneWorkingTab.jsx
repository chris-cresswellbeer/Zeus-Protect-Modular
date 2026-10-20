/**
 * LoneWorkingTab — admin "Lone Working" page (Site Safety ▼ → Lone Working, or quick search).
 *   Working alone now   everyone with a session running: where, since when, next check-in,
 *                       and any alert or help call, with Respond (shared/LoneRespond.jsx) and
 *                       End (for a session someone forgot to finish)
 *   Last 30 days        finished sessions: how long, check-ins, alerts and what was done
 * While this page is open it also asks the server to run its check every 30 seconds
 * (lib/loneClient.js → pingLone), so alerts work on staging, where schedules don't run.
 * Settings: Site Settings → Lone working.
 */
import React from "react";
import { useLoneSessions, saveLoneSession, freshLoneSession, loneTableMissing } from "../../lib/loneClient";
import { LONE_OPEN, LONE_ALARM, OUTCOMES, finishSession, minutesToDue, minutesBetween } from "../../lib/loneWorking";
import { LoneRespond } from "../../shared/LoneRespond";
import { ask, notify } from "../../shared/Feedback";
import { auditEvent } from "../../lib/audit";
import { ukDate } from "../../lib/dates";

const hhmm = iso => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—");
const dayOf = iso => (iso ? ukDate(new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/London" })) : "");
const dur = m => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
const STATUS = { active: ["Working", "#10b981"], alert: ["Missed check-in", "#ef4444"], escalated: ["Missed · admins alerted", "#ef4444"], help: ["Help requested", "#ef4444"], finished: ["Finished", "#64748b"], resolved: ["Alert dealt with", "#f59e0b"] };

export function LoneWorkingTab({ me, people, settings, onOpenSettings, Z, font }) {
  const rows = useLoneSessions(true, { fresh: true, ping: true });
  const [, tick] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { const iv = setInterval(tick, 15000); return () => clearInterval(iv); }, []);
  const [respond, setRespond] = React.useState(null);
  const open = rows.filter(r => LONE_OPEN.includes(r.status)).sort((a, b) => (LONE_ALARM.includes(b.status) - LONE_ALARM.includes(a.status)) || String(a.next_due).localeCompare(String(b.next_due)));
  const past = rows.filter(r => !LONE_OPEN.includes(r.status));
  const card = { background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.border}`, borderRadius: 16, padding: 18, marginBottom: 18 };
  const th = { textAlign: "left", fontSize: 11, color: Z.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, padding: "8px 10px", borderBottom: `1px solid ${Z.border}` };
  const td = { padding: "10px", borderBottom: `1px solid ${Z.border}`, fontSize: 13, color: Z.white, verticalAlign: "top" };
  const chip = s => { const [l, c] = STATUS[s] || [s, "#64748b"]; return <span style={{ fontSize: 11, fontWeight: 800, color: c, background: `${c}18`, border: `1px solid ${c}33`, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>{l}</span>; };
  const btn = primary => ({ background: primary ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay, color: "#fff", border: primary ? "none" : `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700 });

  async function end(r) {
    if (!(await ask({ title: `End ${(r.data || {}).name}'s session?`, message: "Use this when someone has finished but forgot to tap Finish. It stops their check-ins and any alerts.", ok: "End session" }))) return;
    const cur = (await freshLoneSession(r.id)) || r;
    const next = finishSession(cur); next.data = { ...next.data, endedBy: me.name };
    if (await saveLoneSession(next)) auditEvent("lone_working", r.id, "update", "Lone working session ended by an admin", {}, (r.data || {}).name || "");
    else notify("That didn't save.", { kind: "error" });
  }

  return (
    <div data-testid="lone-tab">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -.5, margin: "0 0 4px" }}>Lone Working</h2>
          <p style={{ color: Z.muted, margin: 0, fontSize: 13, maxWidth: 760, lineHeight: 1.5 }}>Staff working alone start a session on their phone and tap <b>I'm OK</b> before each check-in. A missed check-in emails their line manager after {settings.grace} minutes, then all admins {settings.escalate} minutes later if nobody has dealt with it. <b>I need help</b> emails both at once.</p>
        </div>
        <button type="button" style={btn(false)} onClick={onOpenSettings}>⚙ Settings</button>
      </div>
      {!settings.enabled && <div role="status" style={{ ...card, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", fontSize: 13.5 }}>Lone working is switched off. Switch it on in <b>Site Settings → Lone working</b>; it then appears in everyone's phone app under More.</div>}
      {loneTableMissing() && <div role="alert" style={{ ...card, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", fontSize: 13.5 }}>The database isn't ready for lone working yet: run <b>lone_working.sql</b> in Supabase.</div>}

      <div style={card} data-testid="lone-now">
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: Z.white }}>Working alone now ({open.length})</h3>
        {!open.length ? <div style={{ color: Z.muted, fontSize: 13 }}>Nobody is working alone right now.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead><tr><th style={th}>Person</th><th style={th}>Where</th><th style={th}>Started</th><th style={th}>Next check-in</th><th style={th}>Status</th><th style={th}></th></tr></thead>
              <tbody>
                {open.map(r => { const d = r.data || {}; const left = minutesToDue(r); const alarm = LONE_ALARM.includes(r.status); return (
                  <tr key={r.id} data-testid="lone-now-row" style={alarm ? { background: "rgba(239,68,68,0.08)" } : undefined}>
                    <td style={td}><b>{d.name}</b></td>
                    <td style={td}>{d.place}{d.note ? <div style={{ fontSize: 12, color: Z.muted }}>{d.note}</div> : null}</td>
                    <td style={td}>{hhmm(d.startedAt)}<div style={{ fontSize: 12, color: Z.muted }}>every {d.interval} min · {(d.checkIns || []).length} check-in{(d.checkIns || []).length === 1 ? "" : "s"}</div></td>
                    <td style={{ ...td, color: r.status === "help" ? Z.white : left < 0 ? "#f87171" : left <= 5 ? "#fbbf24" : Z.white, fontWeight: 700 }}>
                      {r.status === "help" ? `Help asked ${hhmm(d.help && d.help.at)}` : `${hhmm(d.nextDue)} · ${left < 0 ? `${-left} min late` : `in ${left} min`}`}
                    </td>
                    <td style={td}>{chip(r.status)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {alarm && <button type="button" style={btn(true)} data-testid="lone-tab-respond" onClick={() => setRespond(r.id)}>Respond</button>}{" "}
                      <button type="button" style={btn(false)} onClick={() => end(r)}>End</button>
                    </td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card} data-testid="lone-history">
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: Z.white }}>Last 30 days ({past.length})</h3>
        {!past.length ? <div style={{ color: Z.muted, fontSize: 13 }}>No finished sessions in the last 30 days.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr><th style={th}>Date</th><th style={th}>Person</th><th style={th}>Where</th><th style={th}>Time</th><th style={th}>Check-ins</th><th style={th}>Alerts</th><th style={th}>Outcome</th></tr></thead>
              <tbody>
                {past.map(r => { const d = r.data || {}; const end2 = d.finishedAt || r.updated_at; const alerts = (d.emails || []).filter(e => e.kind !== "ok");
                  return (
                    <tr key={r.id} data-testid="lone-history-row">
                      <td style={td}>{dayOf(d.startedAt)}</td>
                      <td style={td}>{d.name}</td>
                      <td style={td}>{d.place}</td>
                      <td style={td}>{hhmm(d.startedAt)}–{hhmm(end2)}<div style={{ fontSize: 12, color: Z.muted }}>{d.startedAt && end2 ? dur(Math.max(0, minutesBetween(d.startedAt, end2))) : ""}</div></td>
                      <td style={td}>{(d.checkIns || []).length}</td>
                      <td style={td}>{alerts.length ? alerts.map((e, i) => <div key={i} style={{ fontSize: 12 }}>{hhmm(e.at)} {e.kind === "help" ? "help" : e.kind === "escalated" ? "to admins" : "missed"}</div>) : "—"}</td>
                      <td style={td}>{d.ack ? <>{(OUTCOMES.find(o => o.id === d.ack.outcome) || {}).label} <div style={{ fontSize: 12, color: Z.muted }}>{d.ack.by}, {hhmm(d.ack.at)}{d.ack.note ? ` · ${d.ack.note}` : ""}</div></> : chip(r.status)}</td>
                    </tr>
                  ); })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {respond && (() => { const r = rows.find(x => x.id === respond); if (!r) return null; return (
        <div role="dialog" aria-modal="true" aria-label="Respond to a lone working alert" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: "1px solid rgba(239,68,68,.5)", borderRadius: 18, padding: 22, width: "100%", maxWidth: 520, maxHeight: "92vh", overflow: "auto" }}>
            <LoneRespond row={r} people={people} byName={me.name} Z={Z} font={font} onCancel={() => setRespond(null)} onDone={() => setRespond(null)}/>
          </div>
        </div>
      ); })()}
    </div>
  );
}
