import React from "react";

/**
 * LostTimeBox — "Time off work" on an accident (Incidents → open an accident).
 * Admins record whether the injured person needed time off after the day of the accident
 * and, once they're back, how many working days were lost. The board report
 * (reports/boardReport.js) counts these as lost-time injuries and days lost.
 *
 * Stored on the incident (in its `details` column, no SQL needed):
 *   lostTime   true | false | undefined (not known yet)
 *   daysLost   whole working days lost (number) or null
 *   backAtWork "YYYY-MM-DD" or "" (optional)
 * onChange(patch) merges the patch into the incident (app/data/useSyncEffects.js saves it).
 */
export function LostTimeBox({ inc, onChange, Z, font }) {
  const [days, setDays] = React.useState(inc.daysLost == null ? "" : String(inc.daysLost));
  React.useEffect(() => { setDays(inc.daysLost == null ? "" : String(inc.daysLost)); }, [inc.id, inc.daysLost]);
  const commitDays = () => {
    const t = days.trim();
    const n = t === "" ? null : Math.round(Number(t));
    if (t !== "" && !(Number.isFinite(n) && n >= 0 && n <= 3650)) { setDays(inc.daysLost == null ? "" : String(inc.daysLost)); return; }
    if (n !== (inc.daysLost ?? null)) onChange({ daysLost: n });
  };
  const choice = inc.lostTime === true ? "yes" : inc.lostTime === false ? "no" : "unknown";
  const pick = v => onChange(v === "yes" ? { lostTime: true } : v === "no" ? { lostTime: false, daysLost: null, backAtWork: "" } : { lostTime: undefined, daysLost: null, backAtWork: "" });
  const chip = (v, label) => (
    <button key={v} type="button" aria-pressed={choice === v} onClick={() => pick(v)} data-testid={`losttime-${v}`}
      style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, cursor: "pointer", borderRadius: 18, padding: "6px 13px", color: Z.white,
        background: choice === v ? `${Z.accent}44` : Z.overlay, border: `1px solid ${choice === v ? Z.accent : Z.borderMd}` }}>{label}</button>
  );
  const inp = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 10px", color: Z.white, fontFamily: font, fontSize: 13 };
  const over7 = inc.lostTime === true && !inc.riddor && (Number(inc.daysLost) > 5 || inc.daysLost == null);
  return (
    <div data-testid="losttime-box" style={{ marginBottom: 12, padding: "12px 14px", background: "rgba(99,102,241,0.06)", borderRadius: 10, border: "1px solid rgba(99,102,241,0.25)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, color: "#a5b4fc", textTransform: "uppercase", marginBottom: 8 }}>🩹 Time off work</div>
      <div style={{ fontSize: 12.5, color: Z.muted, marginBottom: 8 }}>Did the injured person need time off work after the day of the accident?</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: inc.lostTime === true ? 10 : 0 }}>
        {chip("unknown", "Not known yet")}{chip("no", "No")}{chip("yes", "Yes")}
      </div>
      {inc.lostTime === true && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12, color: Z.muted, display: "flex", flexDirection: "column", gap: 4 }}>Working days lost
            <input inputMode="numeric" value={days} onChange={e => setDays(e.target.value)} onBlur={commitDays} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
              placeholder="when known" style={{ ...inp, width: 120 }} data-testid="losttime-days" aria-label="Working days lost"/>
          </label>
          <label style={{ fontSize: 12, color: Z.muted, display: "flex", flexDirection: "column", gap: 4 }}>Back at work on (optional)
            <input type="date" value={inc.backAtWork || ""} onChange={e => onChange({ backAtWork: e.target.value })} style={inp} aria-label="Back at work on"/>
          </label>
        </div>
      )}
      {over7 && (
        <div style={{ fontSize: 11.5, color: "#fbbf24", marginTop: 8 }}>
          If they're unable to do their normal work for more than 7 days in a row (not counting the day of the accident, but counting weekends and rest days), it's RIDDOR-reportable within 15 days: edit the incident and tick RIDDOR.
        </div>
      )}
    </div>
  );
}
