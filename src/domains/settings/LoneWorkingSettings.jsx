/**
 * LoneWorkingSettings — Site Settings → Lone working: on/off, the check-in intervals staff
 * choose from (and the default), how long after a missed check-in the line manager is
 * emailed, and how long after that all admins are. app_settings row "lone_working"
 * (lib/loneWorking.js). The alerts need the email set-up (Site Settings → Email reminders).
 */
import React, { useState, useEffect } from "react";
import { notify } from "../../shared/Feedback";
import { useFormGuard } from "../../lib/unsaved";
import { auditEvent } from "../../lib/audit";
import { DEFAULT_LONE_SETTINGS, normaliseLoneSettings } from "../../lib/loneWorking";
import { loadLoneSettings, saveLoneSettings } from "../../lib/loneClient";

const CHOICES = [15, 30, 45, 60, 90, 120, 180, 240];
const dur = m => (m >= 60 ? `${m / 60} h` : `${m} min`);

export function LoneWorkingSettings({ Z, font, onStatus, onSaved }) {
  const [f, setF] = useState(() => normaliseLoneSettings(DEFAULT_LONE_SETTINGS));
  const [saved, setSaved] = useState(f);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadLoneSettings().then(s => { setF(s); setSaved(s); setLoaded(true); }); }, []);
  const changed = loaded && JSON.stringify(f) !== JSON.stringify(saved);
  const guard = useFormGuard({ key: "lone-settings", label: "the lone working settings", active: loaded, value: f, onRestore: v => setF(normaliseLoneSettings(v)), changed });
  const summary = !loaded ? "" : saved.enabled ? `On · check-ins every ${saved.intervals.map(dur).join(" / ")} · manager after ${saved.grace} min, admins ${saved.escalate} min later` : "Off";
  useEffect(() => { if (onStatus) onStatus({ dirty: changed, summary }); }, [changed, summary]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setF(p => normaliseLoneSettings({ ...p, [k]: v }));
  const toggle = m => { const has = f.intervals.includes(m); const next = has ? f.intervals.filter(x => x !== m) : [...f.intervals, m]; if (next.length) set("intervals", next); };

  async function save() {
    setBusy(true);
    try {
      const clean = await saveLoneSettings(f);
      const diff = {}; Object.keys(clean).forEach(k => { if (JSON.stringify(saved[k]) !== JSON.stringify(clean[k])) diff[k] = { from: saved[k], to: clean[k] }; });
      auditEvent("settings", "lone_working", "update", "Lone working settings saved", diff, "Lone working");
      setF(clean); setSaved(clean); guard.saved(); onSaved && onSaved(clean);
      notify(clean.enabled ? "Saved. Lone working is on: staff find it in the phone app under More." : "Saved. Lone working is switched off.");
    } catch (e) { notify(`The lone working settings couldn't be saved. ${e.message || e}`, { kind: "error" }); }
    setBusy(false);
  }
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: Z.muted, letterSpacing: 1, textTransform: "uppercase", margin: "14px 0 6px" };
  const hint = { fontSize: 11.5, color: Z.muted, marginTop: 4, lineHeight: 1.45 };
  const chip = on => ({ background: on ? `${Z.accent}33` : Z.overlay, color: Z.white, border: `1px solid ${on ? Z.accent : Z.borderMd}`, borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontFamily: font, fontSize: 12.5, fontWeight: 700 });
  const num = (k, lo, hi) => <input type="number" min={lo} max={hi} value={f[k]} onChange={e => set(k, e.target.value)} data-testid={`lone-set-${k}`} style={{ width: 80, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 10px", color: Z.white, fontFamily: font, fontSize: 13 }}/>;
  return (
    <section data-testid="lone-settings">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <p style={{ margin: 0, fontSize: 12.5, color: Z.muted, lineHeight: 1.5, maxWidth: 640 }}>Staff working alone check in on their phone. If they miss a check-in, their line manager is emailed, then all admins. Alerts go even when email reminders are switched off, but need the email set-up (Email reminders → Check set-up).</p>
        <button type="button" onClick={save} disabled={busy || !changed} data-testid="lone-set-save"
          style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontWeight: 800, fontFamily: font, fontSize: 13, cursor: busy || !changed ? "default" : "pointer", opacity: busy || !changed ? .6 : 1 }}>
          {busy ? "Saving…" : changed ? "Save lone working settings" : "Saved"}
        </button>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={f.enabled} onChange={e => set("enabled", e.target.checked)} data-testid="lone-set-enabled" style={{ width: 18, height: 18, marginTop: 1, accentColor: Z.accent }}/>
        <span><span style={{ fontSize: 13, fontWeight: 700, color: Z.white }}>Lone working check-ins are on</span><span style={{ ...hint, display: "block", marginTop: 1 }}>Everyone gets <b>Lone working</b> in the phone app (More). Admins see who's working alone under Contractors ▼ → Lone Working.</span></span>
      </label>
      <span style={lbl}>Check-in intervals staff can choose</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{CHOICES.map(m => <button key={m} type="button" style={chip(f.intervals.includes(m))} aria-pressed={f.intervals.includes(m)} onClick={() => toggle(m)} data-testid={`lone-set-int-${m}`}>{dur(m)}</button>)}</div>
      <span style={lbl}>Chosen at the start unless they change it</span>
      <select value={f.defaultInterval} onChange={e => set("defaultInterval", e.target.value)} data-testid="lone-set-default" style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 10px", color: Z.white, fontFamily: font, fontSize: 13 }}>
        {f.intervals.map(m => <option key={m} value={m}>{dur(m)}</option>)}
      </select>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div><span style={lbl}>Email the line manager</span>{num("grace", 1, 60)} <span style={{ fontSize: 12.5, color: Z.muted }}>minutes after a missed check-in</span></div>
        <div><span style={lbl}>Then email all admins</span>{num("escalate", 1, 120)} <span style={{ fontSize: 12.5, color: Z.muted }}>minutes later, if nobody has responded</span></div>
      </div>
      <div style={hint}>Staff without a line manager (or whose manager has no email address) go straight to the admins. The check runs every 2 minutes on the live site.</div>
    </section>
  );
}
