// src/mobile/screens/LoneWorking.jsx
//
// Lone working on the phone: start a session (where, what, how often to check in),
// "I'm OK" before each check-in, "I need help", and "Finish". The rules are in
// src/lib/loneWorking.js; the server (netlify/shared/loneJob.mjs) emails the line manager,
// then the admins, if a check-in is missed — so a phone that's switched off or out of
// signal still raises the alarm. Staff wording goes through t() so it can be translated.

import React from "react";
import { Screen, SectionLabel, Card, StatusChip, PrimaryButton } from "../ui";
import { t } from "../../lib/i18n";
import { LONE_OPEN, newLoneSession, checkIn, askHelp, finishSession, minutesToDue } from "../../lib/loneWorking";
import { saveLoneSession, freshLoneSession, pingLone } from "../../lib/loneClient";

const hhmm = iso => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
const dur = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

function LoneWorking({ user, settings, sessions, places = [], online = true, Z, font }) {
  const mine = sessions.find(r => String(r.user_id) === String(user.id) && LONE_OPEN.includes(r.status)) || null;
  const [place, setPlace] = React.useState("");
  const [other, setOther] = React.useState("");
  const [note, setNote] = React.useState("");
  const [interval, setIntervalMin] = React.useState(settings.defaultInterval);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [helpMsg, setHelpMsg] = React.useState("");
  const [, tick] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { const iv = setInterval(tick, 15000); return () => clearInterval(iv); }, []);

  const where = place === "__other" ? other.trim() : place;
  const inp = { width: "100%", boxSizing: "border-box", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "13px 14px", color: Z.white, fontSize: 15, fontFamily: font };
  const lbl = { display: "block", fontSize: 12, fontWeight: 700, color: Z.muted, margin: "14px 0 6px" };
  const fail = () => setErr(online ? t("That didn't save. Check your signal and try again.") : t("No signal: this can't be sent yet. Move somewhere with signal and try again."));

  async function act(make, { isNew = false, ping = false } = {}) {
    setErr(""); setBusy(true);
    try {
      const base = isNew ? null : (await freshLoneSession(mine.id)) || mine;   // the server may have just raised an alert
      const next = make(base);
      if (!(await saveLoneSession(next, { isNew }))) { fail(); return false; }
      if (ping) pingLone();
      return true;
    } catch { fail(); return false; } finally { setBusy(false); }
  }

  if (!settings.enabled) {
    return <Screen Z={Z}><Card Z={Z}><div style={{ color: Z.white, fontSize: 14, lineHeight: 1.5 }}>{t("Lone working check-ins aren't switched on for this site. Ask your H&S team.")}</div></Card></Screen>;
  }

  // ── No session: start one ──
  if (!mine) {
    return (
      <Screen Z={Z}>
        <Card Z={Z} tone="accent" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: Z.white, lineHeight: 1.5 }} data-testid="lone-intro">
            {t("Working alone? Start a check-in. Tap I'm OK before each check-in is due. If you don't, your line manager is emailed, then the H&S admins.")}
          </div>
        </Card>
        <label style={lbl} htmlFor="lone-place">{t("Where are you working?")}</label>
        <select id="lone-place" data-testid="lone-place" value={place} onChange={e => setPlace(e.target.value)} style={inp}>
          <option value="">{t("Choose…")}</option>
          {places.map(p => <option key={p} value={p}>{p}</option>)}
          <option value="__other">{t("Somewhere else…")}</option>
        </select>
        {place === "__other" && <input aria-label={t("Where are you working?")} data-testid="lone-place-other" value={other} onChange={e => setOther(e.target.value)} maxLength={120} placeholder={t("e.g. satellite warehouse, mezzanine")} style={{ ...inp, marginTop: 8 }}/>}
        <label style={lbl} htmlFor="lone-note">{t("What are you doing? (optional)")}</label>
        <input id="lone-note" data-testid="lone-note" value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder={t("e.g. stock count")} style={inp}/>
        <span style={lbl}>{t("Check in every")}</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label={t("Check in every")}>
          {settings.intervals.map(m => (
            <button key={m} type="button" role="radio" aria-checked={interval === m} data-testid={`lone-int-${m}`} onClick={() => setIntervalMin(m)}
              style={{ flex: "1 1 70px", minHeight: 48, borderRadius: 12, border: `2px solid ${interval === m ? Z.accent : Z.borderMd}`, background: interval === m ? `${Z.accent}22` : Z.overlay, color: Z.white, fontWeight: 800, fontSize: 15, fontFamily: font }}>
              {dur(m)}
            </button>
          ))}
        </div>
        {err && <div role="alert" style={{ color: Z.red, fontWeight: 700, fontSize: 13, marginTop: 12 }}>{err}</div>}
        <PrimaryButton Z={Z} font={font} tone="green" style={{ marginTop: 18 }} disabled={busy || !where} onClick={() => act(() => newLoneSession({ user, place: where, note, interval }), { isNew: true })}>
          <span data-testid="lone-start">{busy ? t("Starting…") : t("Start lone working")}</span>
        </PrimaryButton>
        <div style={{ fontSize: 11.5, color: Z.muted, marginTop: 12, lineHeight: 1.5 }}>{t("Keep your phone charged and with you. This doesn't call the emergency services: in an emergency, call 999.")}</div>
      </Screen>
    );
  }

  // ── Session running ──
  const d = mine.data || {};
  const left = minutesToDue(mine);
  const alarm = mine.status === "alert" || mine.status === "escalated";
  const help = mine.status === "help";
  const tone = help || alarm || left < 0 ? "danger" : left <= 5 ? "warn" : "good";
  const color = tone === "danger" ? Z.red : tone === "warn" ? "#f59e0b" : Z.green;
  return (
    <Screen Z={Z}>
      <Card Z={Z} tone={tone} style={{ marginBottom: 14, textAlign: "center" }}>
        <div data-testid="lone-status" style={{ fontSize: 13, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: 1 }}>
          {help ? t("Help requested") : alarm ? t("Check-in missed") : left < 0 ? t("Check-in due now") : t("Working alone")}
        </div>
        <div data-testid="lone-countdown" style={{ fontSize: 40, fontWeight: 900, color: Z.white, margin: "8px 0 4px", lineHeight: 1.05 }}>
          {help ? hhmm(d.help && d.help.at) : left < 0 ? t("{n} min late", { n: -left }) : dur(left)}
        </div>
        <div style={{ fontSize: 13, color: Z.muted }}>
          {help ? t("Your line manager and the H&S admins are being emailed. Stay where you are if it's safe. In an emergency, call 999.")
            : alarm ? t("Your line manager has been emailed. Tap I'm OK if you're safe.")
            : t("until your next check-in at {time}", { time: hhmm(d.nextDue) })}
        </div>
      </Card>
      <div style={{ fontSize: 13, color: Z.muted, marginBottom: 14, lineHeight: 1.5 }}>
        <b style={{ color: Z.white }}>{d.place}</b>{d.note ? ` · ${d.note}` : ""}<br/>
        {t("Started {time}, check in every {every}", { time: hhmm(d.startedAt), every: dur(d.interval || 60) })}
      </div>
      {err && <div role="alert" style={{ color: Z.red, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{err}</div>}
      {!help && (
        <PrimaryButton Z={Z} font={font} tone="green" disabled={busy} style={{ minHeight: 76, fontSize: 22, marginBottom: 12 }} onClick={() => act(r => checkIn(r))}>
          <span data-testid="lone-ok">✓ {t("I'm OK")}</span>
        </PrimaryButton>
      )}
      {!helpOpen ? (
        <PrimaryButton Z={Z} font={font} tone="danger" disabled={busy || help} style={{ marginBottom: 12 }} onClick={() => setHelpOpen(true)}>
          <span data-testid="lone-help">{help ? t("Help requested at {time}", { time: hhmm(d.help && d.help.at) }) : `⚠ ${t("I need help")}`}</span>
        </PrimaryButton>
      ) : (
        <Card Z={Z} tone="danger" style={{ marginBottom: 12 }}>
          <label style={{ ...lbl, marginTop: 0, color: Z.white }} htmlFor="lone-help-msg">{t("What's happened? (optional)")}</label>
          <input id="lone-help-msg" data-testid="lone-help-msg" value={helpMsg} onChange={e => setHelpMsg(e.target.value)} maxLength={300} style={inp}/>
          <PrimaryButton Z={Z} font={font} tone="danger" disabled={busy} style={{ marginTop: 10 }} onClick={async () => { if (await act(r => askHelp(r, helpMsg), { ping: true })) setHelpOpen(false); }}>
            <span data-testid="lone-help-send">{t("Send for help now")}</span>
          </PrimaryButton>
          <button type="button" onClick={() => setHelpOpen(false)} style={{ width: "100%", marginTop: 8, minHeight: 44, background: "none", border: "none", color: Z.muted, fontFamily: font, fontSize: 14, fontWeight: 700 }}>{t("Cancel")}</button>
        </Card>
      )}
      {help && <div style={{ fontSize: 12.5, color: Z.muted, marginBottom: 12, lineHeight: 1.5 }}>{t("When someone has dealt with it, they close this check-in. If you're safe now, you can also tap Finish.")}</div>}
      <button type="button" data-testid="lone-finish" disabled={busy} onClick={() => act(r => finishSession(r))}
        style={{ width: "100%", minHeight: 50, borderRadius: 14, border: `1px solid ${Z.borderMd}`, background: Z.overlay, color: Z.white, fontWeight: 800, fontSize: 15, fontFamily: font }}>
        {t("Finish lone working")}
      </button>
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatusChip label={(d.checkIns || []).length === 1 ? t("1 check-in") : t("{n} check-ins", { n: (d.checkIns || []).length })} color="#94a3b8"/>
        {!online && <StatusChip label={t("No signal")} color="#f59e0b"/>}
      </div>
    </Screen>
  );
}

/** Today screen banner while a session is running. */
function LoneBanner({ row, onOpen, Z, font }) {
  const left = minutesToDue(row);
  const alarm = row.status !== "active" || left < 0;
  return (
    <button type="button" data-testid="lone-banner" onClick={onOpen}
      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, borderRadius: 14, padding: "12px 14px", marginBottom: 14, fontFamily: font, cursor: "pointer",
        background: alarm ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.10)", border: `1px solid ${alarm ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.35)"}` }}>
      <span style={{ fontSize: 22 }}>🧍</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: Z.white }}>{row.status === "help" ? t("Help requested") : alarm ? t("Check-in missed: tap to check in") : t("Lone working: next check-in {time}", { time: hhmm(row.data && row.data.nextDue) })}</span>
        <span style={{ display: "block", fontSize: 12, color: Z.muted }}>{(row.data && row.data.place) || ""}</span>
      </span>
      <span style={{ color: Z.muted, fontSize: 18 }}>›</span>
    </button>
  );
}

export { LoneWorking, LoneBanner };
