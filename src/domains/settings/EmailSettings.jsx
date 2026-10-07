import React, { useState, useEffect } from "react";
import { sb } from "../../lib/supabase";
import { AUTH_MODE, emailCall } from "../../lib/auth";
import { notify, ask } from "../../shared/Feedback";
import { auditEvent } from "../../lib/audit";
import { useFormGuard, DraftBanner } from "../../lib/unsaved";
import { EMAIL_DEFAULTS, EMAIL_SETTINGS_ROW, WEEKDAYS, emailSettings } from "../../lib/reminders";

/**
 * EmailSettings — Site Settings → 📧 Email reminders (admins).
 *   • the switches, stored in app_settings row "email" (lib/reminders.js reads them)
 *   • set-up check, preview, test email and "Send due emails now", which call the
 *     server (netlify/functions/zp-email.mjs) — these need the individual sign-ins
 *   • the last 50 emails sent (email_log, email_reminders.sql)
 * The emails themselves are sent by the scheduled job on Netlify every 15 minutes.
 */
const KIND_LABEL = { new: "New training or reading", expiry: "Renewal warning", alerts: "Admin alert", weekly: "Weekly reminder",
  manager: "Manager summary", digest: "Weekly summary (admins)", test: "Test" };
const STATUS = { sent: ["Sent", "#10b981"], redirected: ["Sent to test address", "#f59e0b"], failed: ["Failed", "#ef4444"] };
const toForm = s => ({ ...s, warnDays: s.warnDays.join(", "), extraAdminEmails: s.extraAdminEmails.join(", ") });
const when = t => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };

function EmailSettings({ Z, font }) {
  const [form, setForm] = useState(() => toForm(emailSettings(EMAIL_DEFAULTS)));
  const [savedForm, setSavedForm] = useState(form);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState(null);           // null = loading; { rows } | { error }
  const [preview, setPreview] = useState(null);   // the preview result
  const [view, setView] = useState(null);         // one previewed email
  const server = AUTH_MODE === "supabase";
  const changed = loaded && JSON.stringify(form) !== JSON.stringify(savedForm);
  const guard = useFormGuard({ key: "email-settings", label: "the email reminder settings", active: loaded, value: form, onRestore: v => setForm(v), changed });

  async function loadSettings() {
    const r = await sb.from("app_settings").select("*").eq("id", EMAIL_SETTINGS_ROW);
    const f = toForm(emailSettings(r && r.data && r.data[0] ? r.data[0].data : {}));
    setForm(f); setSavedForm(f); setLoaded(true);
  }
  async function loadLog() {
    let r;
    try { r = await sb.from("email_log").query("select=*&order=sent_at.desc&limit=50"); } catch (e) { r = { error: e }; }
    setLog(!r || r.error ? { error: (r && r.error && r.error.message) || "can't read" } : { rows: Array.isArray(r.data) ? r.data : [] });
  }
  async function checkSetup() { if (!server) return; const r = await emailCall("status"); setStatus(r); }
  useEffect(() => { loadSettings(); loadLog(); checkSetup(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const clean = emailSettings({ ...form });
    if (clean.enabled && !savedForm.enabled && !(await ask({ title: "Switch email reminders on?",
      message: "From the next check (every 15 minutes on the live site), staff will be emailed about new training and reading, renewals and, each week, what they still have to do.\n\nThe first check only notes what's already assigned or expiring, so nobody is sent a pile of old reminders. Use Preview to see what will go.",
      ok: "Switch on" }))) return;
    setBusy("save");
    const r = await sb.from("app_settings").upsert({ id: EMAIL_SETTINGS_ROW, data: clean, updated_at: new Date().toISOString() }, { onConflict: "id" });
    setBusy("");
    if (r && r.error) { notify(`The email settings couldn't be saved. ${r.error.message || ""}`, { kind: "error" }); return; }
    const was = emailSettings({ ...savedForm });
    const what = clean.enabled !== was.enabled ? (clean.enabled ? "Email reminders switched on" : "Email reminders switched off") : "Email reminder settings changed";
    auditEvent("settings", EMAIL_SETTINGS_ROW, "update", what, {}, "Email reminders");
    const f = toForm(clean); setForm(f); setSavedForm(f); guard.saved();
    notify(`${what}.`);
  }

  async function run(action) {
    if (action === "sendNow" && !(await ask({ title: "Send due emails now?",
      message: "This sends everything that's due, without waiting for the usual time or day: new items, renewal warnings, alerts and, if they haven't gone this week, the weekly reminders and summaries.\n\nNothing is sent twice: anything already sent is left out.",
      ok: "Send now" }))) return;
    setBusy(action);
    const r = await emailCall(action);
    setBusy("");
    if (!r.ok) { notify(r.error || "That didn't work.", { kind: "error", timeout: 9000 }); return; }
    if (action === "preview") { setPreview(r); return; }
    notify(r.message || "Done.", { kind: r.problem ? "warn" : "success", timeout: 9000 });
    loadLog(); checkSetup();
  }

  // ── styles ──
  const card = { background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.border}`, borderRadius: 14, padding: 16 };
  const inp = { background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 10px", color: Z.white, fontSize: 13, outline: "none", fontFamily: font };
  const btn = (primary, dis) => ({ background: primary ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay, color: primary ? "#fff" : Z.white,
    border: primary ? "none" : `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: dis ? "default" : "pointer", fontFamily: font, fontSize: 12.5, opacity: dis ? .5 : 1 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  // a plain function (not a component), so typing in its inputs doesn't remount them
  const check = (k, title, help, extra) => (
    <div key={k} style={{ padding: "10px 0", borderTop: `1px solid ${Z.border}` }}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: Z.accent, flexShrink: 0 }}/>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 13.5, color: Z.white }}>{title}</span>
          <span style={{ display: "block", fontSize: 12.5, color: Z.muted, lineHeight: 1.5, marginTop: 2 }}>{help}</span>
        </span>
      </label>
      {extra && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "8px 0 0 26px" }}>{extra}</div>}
    </div>
  );
  const on = form.enabled;

  return (
    <section data-testid="email-settings" style={{ ...card, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: Z.white }}>📧 Email reminders</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: Z.muted, lineHeight: 1.5 }}>
            Emails staff, managers and admins about training, reading and renewals, so nobody has to sign in to find out. Emails say what needs doing and link to the portal;
            they never include incident details, health information or files.
          </p>
        </div>
        <button type="button" data-testid="email-save" onClick={save} disabled={!changed || busy === "save"} style={btn(true, !changed || busy === "save")}>
          {busy === "save" ? "Saving…" : changed ? "Save email settings" : "Saved"}
        </button>
      </div>

      <DraftBanner guard={guard} Z={Z} font={font} what="the email reminder settings"/>
      <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 4px", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
        background: on ? "rgba(16,185,129,0.12)" : Z.overlay, border: `1px solid ${on ? "rgba(16,185,129,0.4)" : Z.borderMd}` }}>
        <input type="checkbox" aria-label="Send email reminders" checked={on} onChange={e => set("enabled", e.target.checked)} style={{ width: 18, height: 18, accentColor: "#10b981" }}/>
        <span style={{ fontWeight: 800, fontSize: 14, color: Z.white }}>{on ? "Email reminders are on" : "Email reminders are off"}</span>
        <span style={{ fontSize: 12, color: Z.muted }}>{on ? "checked every 15 minutes on the live site" : "nothing is sent"}</span>
      </label>

      <div style={{ opacity: on ? 1 : .6 }}>
        {check("newItems", "New training and reading", "Email a person soon after training or a document to read is assigned to them. Several at once come in one email. Assigned in the evening? It waits until 7am.")}
        {check("weekly", "Weekly reminder to each person", "Everything they still have to do: training, documents to confirm, renewals and actions they're responsible for. Only sent if there's something to do.", <>
          <span style={{ fontSize: 12.5, color: Z.muted }}>Weekly emails go on</span>
          <select aria-label="Weekly reminder day" value={form.weeklyDay} onChange={e => set("weeklyDay", Number(e.target.value))} style={inp}>
            {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}
          </select></>)}
        {check("managerCopies", "Weekly team summary to line managers", "On the same day, each line manager gets a list of their team members with something to do, overdue first.")}
        {check("expiry", "Renewal warnings", "Before training, First Aid and Fire Warden certificates, or machinery licences and competences expire, and once when they have.", <>
          <span style={{ fontSize: 12.5, color: Z.muted }}>Days before</span>
          <input aria-label="Days before expiry" value={form.warnDays} onChange={e => set("warnDays", e.target.value)} style={{ ...inp, width: 90 }} placeholder="30, 7"/></>)}
        {check("adminAlerts", "Same-day alerts to admins", "When someone's certificate or licence reaches a warning point (including people with no email address), and RIDDOR reports due to the HSE.")}
        {check("digest", "Weekly summary to admins", "On the weekly reminder day: overdue training, renewals, overdue actions, RIDDOR reports to make and unconfirmed documents.")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "12px 0 2px", borderTop: `1px solid ${Z.border}`, alignItems: "flex-end" }}>
          <label style={{ fontSize: 12.5, color: Z.muted }}>Daily and weekly emails go at<br/>
            <select aria-label="Send time" value={form.sendHour} onChange={e => set("sendHour", Number(e.target.value))} style={{ ...inp, marginTop: 4 }}>
              {[6, 7, 8, 9, 10, 11, 12].map(h => <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12.5, color: Z.muted }}>Most emails a day<br/>
            <input aria-label="Daily limit" type="number" min={1} max={5000} value={form.dailyLimit} onChange={e => set("dailyLimit", e.target.value === "" ? "" : Number(e.target.value))} style={{ ...inp, width: 90, marginTop: 4 }}/>
          </label>
          <label style={{ fontSize: 12.5, color: Z.muted, flex: "1 1 260px" }}>Also send admin alerts and the summary to<br/>
            <input aria-label="Extra admin emails" value={form.extraAdminEmails} onChange={e => set("extraAdminEmails", e.target.value)} placeholder="e.g. hs-team@yourdomain.co.uk" style={{ ...inp, width: "100%", boxSizing: "border-box", marginTop: 4 }}/>
          </label>
        </div>
        <p style={{ fontSize: 11.5, color: Z.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
          UK time. The daily limit stops a mistake from sending hundreds of emails; anything over it goes the next day. Resend's free plan allows 100 a day.
        </p>
      </div>

      {/* ── Server: set-up, preview, test, send now ── */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${Z.borderMd}` }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: Z.muted }}>SET-UP AND TESTING</h4>
        {!server ? (
          <p style={{ fontSize: 12.5, color: Z.muted, margin: 0, lineHeight: 1.5 }}>
            Preview, test emails and "Send now" work once everyone has their own sign-in (the changeover). The scheduled reminders work either way once the Netlify settings are in place.
          </p>
        ) : (
          <>
            {status && (
              <div data-testid="email-status" role="status" style={{ fontSize: 12.5, lineHeight: 1.6, padding: "10px 12px", borderRadius: 10, marginBottom: 10,
                background: status.ok && !(status.problems || []).length ? "rgba(16,185,129,0.10)" : "rgba(245,158,11,0.10)",
                border: `1px solid ${status.ok && !(status.problems || []).length ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.4)"}`, color: Z.white }}>
                {!status.ok ? <>Couldn't check the set-up: {status.error}</> : <>
                  {(status.problems || []).length ? <div><b>Not ready yet:</b> {status.problems.join(" ")}</div> : <div><b>✓ Ready to send.</b></div>}
                  {status.from && <div>From: {status.from}{status.replyTo ? ` · replies to ${status.replyTo}` : ""}</div>}
                  <div>{status.live ? "Sending to staff: yes (live)" : `Test mode: every email goes to ${status.testTo || "— (EMAIL_TEST_TO not set)"}`}</div>
                  {status.forcedTest && <div>This isn't the live site's address, so emails sent from here never go to staff.</div>}
                  <div>Sent today: {status.sentToday} of {emailSettings({ ...form }).dailyLimit}</div>
                </>}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={() => run("preview")} disabled={!!busy} style={btn(false, !!busy)}>{busy === "preview" ? "Working it out…" : "👁 Preview what would be sent"}</button>
              <button type="button" onClick={() => run("test")} disabled={!!busy} style={btn(false, !!busy)}>{busy === "test" ? "Sending…" : "✉ Send me a test email"}</button>
              <button type="button" onClick={() => run("sendNow")} disabled={!!busy || !savedForm.enabled} title={savedForm.enabled ? "" : "Switch email reminders on and save first"} style={btn(false, !!busy || !savedForm.enabled)}>{busy === "sendNow" ? "Sending…" : "➤ Send due emails now"}</button>
              <button type="button" onClick={checkSetup} disabled={!!busy} style={btn(false, !!busy)}>↻ Check set-up</button>
            </div>
          </>
        )}
      </div>

      {/* ── Recent emails ── */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${Z.borderMd}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: Z.muted }}>RECENT EMAILS</h4>
          <button type="button" onClick={loadLog} style={{ ...btn(false, false), padding: "4px 10px", fontSize: 11.5 }}>↻ Refresh</button>
        </div>
        {log == null ? <div style={{ fontSize: 12.5, color: Z.muted }}>Loading…</div>
          : log.error ? <div style={{ fontSize: 12.5, color: Z.muted }}>The email log isn't available yet. Run <code>email_reminders.sql</code> in Supabase → SQL Editor.</div>
          : !log.rows.length ? <div style={{ fontSize: 12.5, color: Z.muted, fontStyle: "italic" }}>No emails sent yet.</div>
          : (
            <div style={{ overflowX: "auto" }}>
              <table data-testid="email-log" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr style={{ color: Z.muted, textAlign: "left" }}>{["When", "To", "Email", "Status"].map(h => <th key={h} style={{ padding: "6px 8px", fontWeight: 700, borderBottom: `1px solid ${Z.border}` }}>{h}</th>)}</tr></thead>
                <tbody>
                  {log.rows.map(r => { const [lbl, col] = STATUS[r.status] || [r.status, Z.muted]; return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${Z.border}` }}>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap", color: Z.muted }}>{when(r.sent_at)}</td>
                      <td style={{ padding: "6px 8px", color: Z.white }}>{r.intended_to || r.to_addr}{r.status === "redirected" && <div style={{ fontSize: 11, color: Z.muted }}>sent to {r.to_addr}</div>}</td>
                      <td style={{ padding: "6px 8px", color: Z.white }}>{r.subject}<div style={{ fontSize: 11, color: Z.muted }}>{KIND_LABEL[r.kind] || r.kind}</div></td>
                      <td style={{ padding: "6px 8px", color: col, fontWeight: 700 }}>{lbl}{r.error && <div style={{ fontSize: 11, color: Z.muted, fontWeight: 400 }}>{r.error}</div>}</td>
                    </tr>); })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Email preview" onClick={() => { setPreview(null); setView(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.72)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: "min(980px,100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 10, background: Z.navy }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: Z.white }}>{preview.total ? `${preview.total} email${preview.total === 1 ? "" : "s"} would be sent now` : "Nothing would be sent now"}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: Z.muted, lineHeight: 1.5 }}>
                  As if you clicked "Send due emails now". Nothing has been sent.
                  {preview.firstRun && ` First run: ${preview.baseline} things already assigned or expiring will be noted, not emailed.`}
                  {!preview.live && ` Test mode: they'd all go to ${preview.testTo || "the test address"}.`}
                  {preview.overLimit > 0 && ` ${preview.overLimit} would wait for tomorrow (daily limit ${preview.dailyLimit}).`}
                  {!preview.enabled && " Reminders are switched off, so the schedule won't send these."}
                </p>
                {(preview.noEmail || []).length > 0 && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#fbbf24" }}>No email address: {preview.noEmail.join(", ")}.</p>}
              </div>
              <button type="button" aria-label="Close preview" onClick={() => { setPreview(null); setView(null); }} style={btn(false, false)}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 10, minHeight: 0, flex: 1, flexWrap: "wrap" }}>
              <ol data-testid="email-preview-list" style={{ listStyle: "none", margin: 0, padding: 0, overflowY: "auto", flex: "1 1 280px", maxHeight: "68vh" }}>
                {(preview.emails || []).map((e, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => setView(e)} disabled={!e.html} style={{ width: "100%", textAlign: "left", background: view === e ? Z.overlay : "transparent", border: "none",
                      borderBottom: `1px solid ${Z.border}`, padding: "8px 6px", cursor: e.html ? "pointer" : "default", fontFamily: font, color: Z.white }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{e.subject}</div>
                      <div style={{ fontSize: 11.5, color: Z.muted }}>{KIND_LABEL[e.kind] || e.kind} · {e.name ? `${e.name} · ` : ""}{e.to}</div>
                    </button>
                  </li>
                ))}
              </ol>
              <div style={{ flex: "2 1 420px", minHeight: 300, background: "#eef1f7", borderRadius: 10, overflow: "hidden" }}>
                {view ? <iframe title="Email content" sandbox="" srcDoc={view.html} style={{ width: "100%", height: "68vh", border: "none", background: "#eef1f7" }}/>
                  : <div style={{ padding: 20, fontSize: 13, color: "#475569" }}>Choose an email on the left to see it.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export { EmailSettings };
