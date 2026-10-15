/**
 * ContractorSigninSettings — Site Settings → Contractor sign-in.
 * Switches the reception QR code on or off, sets the site name, the welcome text and the
 * checklist contractors tick, changes the code (old posters stop working) and prints the
 * A4 poster. Stored in app_settings row "contractor_signin" (lib/contractorSignin.js);
 * the phone page reads it through netlify/functions/zp-signin.mjs.
 */
import React, { useState, useEffect } from "react";
import { sb } from "../../lib/supabase";
import { notify, ask } from "../../shared/Feedback";
import { useFormGuard } from "../../lib/unsaved";
import { auditEvent } from "../../lib/audit";
import { qrSvg } from "../../lib/certificate";
import { SIGNIN_SETTINGS_ID, normaliseSigninSettings, defaultSigninSettings, newSigninCode, signinUrl, DEFAULT_SIGNIN_ITEMS } from "../../lib/contractorSignin";
import { signinPosterHtml } from "../../lib/signinPoster";

const uid = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function ContractorSigninSettings({ Z, font, embedded = false, onStatus }) {
  const [f, setF] = useState(defaultSigninSettings);
  const [saved, setSaved] = useState(f);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let on = true;
    (async () => {
      const r = await sb.from("app_settings").select("*").eq("id", SIGNIN_SETTINGS_ID);
      const t = await sb.from("site_signins").query("select=id&limit=1");
      if (!on) return;
      const s = r && !r.error && r.data && r.data[0] ? normaliseSigninSettings(r.data[0].data) : defaultSigninSettings();
      setMissing(!!(t && t.error));
      setF(s); setSaved(s); setLoaded(true);
    })();
    return () => { on = false; };
  }, []);
  const changed = loaded && JSON.stringify(f) !== JSON.stringify(saved);
  const guard = useFormGuard({ key: "signin-settings", label: "the contractor sign-in settings", active: loaded, value: f, onRestore: v => setF(normaliseSigninSettings(v)), changed });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const statusLine = !loaded ? "" : saved.enabled ? `On · ${saved.items.length} checklist line${saved.items.length === 1 ? "" : "s"}${saved.site ? ` · ${saved.site}` : ""}` : "Off";
  useEffect(() => { if (onStatus) onStatus({ dirty: changed, summary: statusLine }); }, [changed, statusLine]); // eslint-disable-line react-hooks/exhaustive-deps

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const setItem = (i, text) => set("items", f.items.map((x, j) => (j === i ? { ...x, text } : x)));
  const move = (i, d) => { const a = [...f.items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set("items", a); };

  async function save() {
    const items = f.items.map(i => ({ ...i, text: i.text.trim() })).filter(i => i.text);
    if (f.enabled && !items.length) { notify("Add at least one checklist line.", { kind: "error" }); return; }
    const next = normaliseSigninSettings({ ...f, items, code: f.code || (f.enabled ? newSigninCode() : "") });
    setBusy(true);
    const r = await sb.from("app_settings").upsert({ id: SIGNIN_SETTINGS_ID, data: { ...next, updatedAt: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "id" });
    setBusy(false);
    if (r && r.error) { notify(`The sign-in settings couldn't be saved. ${r.error.message || r.error}`, { kind: "error" }); return; }
    const diff = {};
    ["enabled", "site", "intro"].forEach(k => { if (saved[k] !== next[k]) diff[k] = { from: saved[k], to: next[k] }; });
    if (JSON.stringify(saved.items) !== JSON.stringify(next.items)) diff.checklist = { from: `${saved.items.length} lines`, to: `${next.items.length} lines` };
    if (saved.code !== next.code) diff.code = { from: saved.code ? "old code" : "none", to: "new code" };
    auditEvent("settings", SIGNIN_SETTINGS_ID, "update", "Contractor sign-in settings saved", diff, "Contractor sign-in");
    setF(next); setSaved(next); guard.saved();
    notify(next.enabled ? "Saved. Contractors can sign in with the reception QR code." : "Saved. The reception QR code is switched off.");
  }
  async function changeCode() {
    if (saved.code && !(await ask({ title: "Change the sign-in code?", message: "The QR code on the posters you've printed will stop working as soon as you save. Print the new poster and replace the old ones.", ok: "Change code", danger: true }))) return;
    set("code", newSigninCode());
  }
  function printPoster() {
    if (changed) { notify("Save your changes first, so the poster has the code that works.", { kind: "warn" }); return; }
    const win = window.open("", "_blank", "width=860,height=1100");
    if (!win) { notify("The poster window was blocked. Allow pop-ups for the portal and try again.", { kind: "error" }); return; }
    win.document.write(signinPosterHtml({ code: saved.code, site: saved.site, origin }));
    win.document.close();
  }

  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: Z.muted, letterSpacing: 1, textTransform: "uppercase", margin: "14px 0 4px" };
  const inp = { width: "100%", boxSizing: "border-box", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "9px 13px", color: Z.white, fontSize: 13, outline: "none", fontFamily: font };
  const hint = { fontSize: 11.5, color: Z.muted, marginTop: 3, lineHeight: 1.45 };
  const btn = { background: Z.overlay, color: Z.white, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, minHeight: 34 };
  const small = { ...btn, padding: "4px 9px", minHeight: 30, fontSize: 12 };
  const url = saved.code ? signinUrl(origin, saved.code) : "";

  return (
    <section data-testid="signin-settings">
      {missing && <div role="alert" style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", fontSize: 13, color: Z.white, marginBottom: 12 }}>
        The database isn't ready for contractor sign-in yet: run <b>contractor_signin.sql</b> in Supabase first.
      </div>}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <p style={{ margin: 0, fontSize: 12.5, color: Z.muted, lineHeight: 1.5, maxWidth: 640 }}>Contractors scan a QR code at reception with their phone, fill in their details and tick this checklist. They appear straight away in <b>On Site Right Now</b> (Contractors), with anything reception should check.</p>
        <button type="button" onClick={save} disabled={busy || !changed} data-testid="signin-save"
          style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontWeight: 800, fontFamily: font, fontSize: 13, cursor: busy || !changed ? "default" : "pointer", opacity: busy || !changed ? .6 : 1 }}>
          {busy ? "Saving…" : changed ? "Save sign-in settings" : "Saved"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 22, marginTop: 6 }}>
        <div>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={f.enabled} onChange={e => setF(p => ({ ...p, enabled: e.target.checked, code: p.code || (e.target.checked ? newSigninCode() : "") }))} data-testid="signin-enabled" style={{ width: 18, height: 18, marginTop: 1, accentColor: Z.accent }}/>
            <span><span style={{ fontSize: 13, fontWeight: 700, color: Z.white }}>Contractors can sign in with the reception QR code</span><span style={{ ...hint, display: "block" }}>Untick to switch it off: the code then says "not in use" and contractors sign in at reception as before.</span></span>
          </label>
          <label style={lbl} htmlFor="signin-site">Site name (on the poster and the phone)</label>
          <input id="signin-site" data-testid="signin-site-name" value={f.site} maxLength={80} onChange={e => set("site", e.target.value)} placeholder="e.g. Biggleswade" style={inp}/>
          <label style={lbl} htmlFor="signin-intro">Welcome text above the checklist</label>
          <textarea id="signin-intro" data-testid="signin-intro" value={f.intro} maxLength={1200} rows={3} onChange={e => set("intro", e.target.value)} style={{ ...inp, resize: "vertical", lineHeight: 1.45 }}/>

          <span style={lbl}>Checklist (contractors must tick every line)</span>
          <ol data-testid="signin-items-editor" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {f.items.map((it, i) => (
              <li key={it.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ fontSize: 12, color: Z.muted, width: 18, paddingTop: 10, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
                <textarea aria-label={`Checklist line ${i + 1}`} data-testid="signin-item" value={it.text} maxLength={400} rows={2} onChange={e => setItem(i, e.target.value)} style={{ ...inp, flex: 1, resize: "vertical", lineHeight: 1.4 }}/>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <button type="button" style={small} aria-label={`Move line ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                  <button type="button" style={small} aria-label={`Move line ${i + 1} down`} disabled={i === f.items.length - 1} onClick={() => move(i, 1)}>▼</button>
                </div>
                <button type="button" style={{ ...small, color: "#f87171" }} aria-label={`Remove line ${i + 1}`} onClick={() => set("items", f.items.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ol>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" style={btn} data-testid="signin-add-item" onClick={() => set("items", [...f.items, { id: uid(), text: "" }])}>+ Add a line</button>
            <button type="button" style={btn} onClick={async () => { if (await ask({ title: "Go back to the starter checklist?", message: "Your lines are replaced by the starter checklist. Nothing changes until you save.", ok: "Use the starter checklist" })) set("items", DEFAULT_SIGNIN_ITEMS.map(i => ({ ...i }))); }}>Starter checklist</button>
          </div>
        </div>

        <div>
          <span style={lbl}>Reception QR code</span>
          {f.enabled && saved.enabled && saved.code && f.code === saved.code ? (
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div data-testid="signin-qr" style={{ background: "#fff", borderRadius: 10, padding: 6, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: qrSvg(url, { size: 150, label: "Contractor sign-in QR code" }) }}/>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: Z.muted, wordBreak: "break-all" }} data-testid="signin-url">{url}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={{ ...btn, background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, border: "none" }} data-testid="signin-poster" onClick={printPoster}>🖨 Print poster</button>
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Open the sign-in page</a>
                </div>
                <button type="button" style={{ ...btn, marginTop: 10 }} data-testid="signin-change-code" onClick={changeCode}>Change code…</button>
                <div style={hint}>Change the code if the poster's address gets passed around. Old posters stop working.</div>
              </div>
            </div>
          ) : (
            <div style={{ ...hint, fontSize: 12.5 }} data-testid="signin-qr-pending">{f.enabled ? (f.code !== saved.code && saved.code ? "Save to switch to the new code, then print the new poster." : "Save to make the QR code, then print the poster for reception.") : "Switched off. Tick the box and save to make the QR code."}</div>
          )}
        </div>
      </div>
    </section>
  );
}
