/**
 * LoneRespond — dealing with a lone working alert or help call (line managers and admins).
 *   LoneRespond    the details (who, where, since when, their phone number) and "Record what
 *                  you did": an outcome and a note, which closes the alert. Used in the
 *                  desktop alert bar's window and on the phone.
 *   LoneAlertBar   desktop: a red bar at the top of the portal for every alert this person can
 *                  see (their team's, or everyone's for admins), with "Respond". Opening the
 *                  link in an alert email (?lone=ID) opens that one straight away.
 * Rules: lib/loneWorking.js; saving: lib/loneClient.js. The alert emails stop once it's closed.
 */
import React from "react";
import { LONE_ALARM, OUTCOMES, acknowledge, minutesBetween } from "../lib/loneWorking";
import { saveLoneSession, freshLoneSession } from "../lib/loneClient";
import { auditEvent } from "../lib/audit";

const hhmm = iso => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—");
const what = r => (r.status === "help" ? "asked for help" : r.status === "escalated" ? "missed a check-in (admins alerted)" : "missed a check-in");

export function LoneRespond({ row, people = [], byName, onDone, onCancel, Z, font }) {
  const d = row.data || {};
  const person = people.find(u => String(u.id) === String(row.user_id)) || {};
  const phone = person.phone || person.mobile || "";
  const [outcome, setOutcome] = React.useState("ok");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const now = new Date().toISOString();
  async function save() {
    if (outcome === "other" && !note.trim()) { setErr("Say what you did in the note."); return; }
    setBusy(true); setErr("");
    const cur = (await freshLoneSession(row.id)) || row;
    if (!LONE_ALARM.includes(cur.status)) { setBusy(false); onDone && onDone(cur, true); return; }   // someone else dealt with it, or they checked in
    const next = acknowledge(cur, { by: byName || "", outcome, note });
    const ok = await saveLoneSession(next);
    setBusy(false);
    if (!ok) { setErr("That didn't save. Check the connection and try again."); return; }
    auditEvent("lone_working", row.id, "update", `Lone working alert dealt with: ${OUTCOMES.find(o => o.id === outcome).label}`, { outcome: { from: cur.status, to: outcome }, note: { from: "", to: note } }, d.name || "");
    onDone && onDone(next, false);
  }
  const box = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "10px 12px", color: Z.white, fontFamily: font, fontSize: 14, width: "100%", boxSizing: "border-box" };
  return (
    <div data-testid="lone-respond" style={{ fontFamily: font, color: Z.white }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{d.name} {what(row)}</div>
      <div style={{ fontSize: 13, color: Z.muted, marginTop: 4, lineHeight: 1.6 }}>
        <b style={{ color: Z.white }}>{d.place}</b>{d.note ? ` · ${d.note}` : ""}<br/>
        Started {hhmm(d.startedAt)} · last check-in {hhmm(d.lastCheckIn)}{row.status !== "help" && d.nextDue ? ` · was due ${hhmm(d.nextDue)} (${Math.max(0, minutesBetween(d.nextDue, now))} min ago)` : ""}
        {row.status === "help" && d.help ? <><br/>Help asked at {hhmm(d.help.at)}{d.help.message ? `: "${d.help.message}"` : ""}</> : null}
      </div>
      {phone ? <a href={`tel:${phone}`} data-testid="lone-call" style={{ display: "inline-block", marginTop: 10, padding: "10px 16px", borderRadius: 10, background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontWeight: 800, textDecoration: "none" }}>📞 Call {phone}</a>
        : <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 8 }}>No phone number on their staff record.</div>}
      <div style={{ fontSize: 12, fontWeight: 700, color: Z.muted, margin: "16px 0 6px", textTransform: "uppercase", letterSpacing: .5 }}>Record what you did</div>
      <div role="radiogroup" aria-label="What you did" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {OUTCOMES.map(o => (
          <label key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 11px", borderRadius: 10, border: `1px solid ${outcome === o.id ? Z.accent : Z.borderMd}`, background: outcome === o.id ? `${Z.accent}22` : "transparent", cursor: "pointer", fontSize: 14 }}>
            <input type="radio" name="lone-outcome" value={o.id} checked={outcome === o.id} onChange={() => setOutcome(o.id)} data-testid={`lone-outcome-${o.id}`}/>{o.label}
          </label>
        ))}
      </div>
      <textarea aria-label="Note" data-testid="lone-ack-note" value={note} onChange={e => setNote(e.target.value)} maxLength={400} rows={2} placeholder="Note (e.g. phoned at 21:52, battery died, all OK)" style={{ ...box, marginTop: 10, resize: "vertical" }}/>
      {err && <div role="alert" style={{ color: "#f87171", fontWeight: 700, fontSize: 13, marginTop: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" data-testid="lone-ack-save" disabled={busy} onClick={save} style={{ flex: "1 1 180px", minHeight: 46, borderRadius: 12, border: "none", background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: font, cursor: "pointer", opacity: busy ? .6 : 1 }}>
          {busy ? "Saving…" : "Save and close the alert"}
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={{ minHeight: 46, borderRadius: 12, border: `1px solid ${Z.borderMd}`, background: Z.overlay, color: Z.white, fontWeight: 700, fontFamily: font, padding: "0 16px", cursor: "pointer" }}>Not now</button>}
      </div>
    </div>
  );
}

/** Desktop: red bar for open alerts, and the respond window. focusId: from an alert email's link. */
export function LoneAlertBar({ sessions, people, me, focusId, onFocusDone, Z, font }) {
  const norm = x => String(x || "").toLowerCase().replace(/\s+/g, " ").trim();
  // admins: everyone; line managers: their team (the database rules do this too; this covers the old sign-in)
  const mine = r => me.role === "admin" || (people || []).some(u => String(u.id) === String(r.user_id) && norm(u.manager) === norm(me.name));
  const alarms = (sessions || []).filter(r => LONE_ALARM.includes(r.status) && String(r.user_id) !== String(me.id) && mine(r));
  const [openId, setOpenId] = React.useState(null);
  const [done, setDone] = React.useState("");
  React.useEffect(() => {
    if (!focusId) return;
    const r = (sessions || []).find(x => x.id === focusId);
    if (r) { if (LONE_ALARM.includes(r.status)) setOpenId(focusId); else setDone(`${(r.data || {}).name || "That"} alert has already been dealt with${r.data && r.data.ack ? ` by ${r.data.ack.by}` : ""}.`); onFocusDone && onFocusDone(); }
  }, [focusId, sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const row = openId ? (sessions || []).find(x => x.id === openId) : null;
  if (!alarms.length && !row && !done) return null;
  return (
    <>
      {alarms.length > 0 && (
        <div role="alert" data-testid="lone-alert-bar" style={{ background: "linear-gradient(90deg,#b91c1c,#dc2626)", color: "#fff", padding: "10px 18px", display: "flex", flexDirection: "column", gap: 6, fontFamily: font, position: "relative", zIndex: 60 }}>
          {alarms.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18 }}>🧍</span>
              <span style={{ flex: 1, minWidth: 220, fontWeight: 700, fontSize: 14 }}>Lone working: {(r.data || {}).name} {what(r)} · {(r.data || {}).place}</span>
              <button type="button" data-testid="lone-respond-btn" onClick={() => setOpenId(r.id)} style={{ background: "#fff", color: "#b91c1c", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 900, cursor: "pointer", fontFamily: font }}>Respond</button>
            </div>
          ))}
        </div>
      )}
      {done && <div role="status" style={{ background: "#065f46", color: "#fff", padding: "8px 18px", fontFamily: font, fontSize: 13.5, display: "flex", gap: 12 }}><span style={{ flex: 1 }}>{done}</span><button type="button" onClick={() => setDone("")} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: 800 }}>✕</button></div>}
      {row && (
        <div role="dialog" aria-modal="true" aria-label="Respond to a lone working alert" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: "1px solid rgba(239,68,68,.5)", borderRadius: 18, padding: 22, width: "100%", maxWidth: 520, maxHeight: "92vh", overflow: "auto" }}>
            <LoneRespond row={row} people={people} byName={me.name} Z={Z} font={font} onCancel={() => setOpenId(null)}
              onDone={(r, already) => { setOpenId(null); setDone(already ? `${(r.data || {}).name}: already dealt with, or they've checked in.` : `Saved. The alert for ${(r.data || {}).name} is closed.`); }}/>
          </div>
        </div>
      )}
    </>
  );
}
