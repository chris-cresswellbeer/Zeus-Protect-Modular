import React, { useState } from "react";
import { changeOwnPassword } from "../lib/auth";

/**
 * ForcePasswordChange — full-screen step shown straight after sign-in when the
 * account has a temporary password (set by an admin). The person can't use the
 * portal until they choose their own. Works on desktop and phone.
 */
function ForcePasswordChange({ user, onDone, onSignOut, Z, font }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    if (e) e.preventDefault();
    if (pw.length < 8) { setErr("Your new password must be at least 8 characters."); return; }
    if (pw !== pw2) { setErr("The two passwords don't match."); return; }
    setBusy(true); setErr("");
    const r = await changeOwnPassword(pw);
    setBusy(false);
    if (!r.ok) { setErr(r.error || "Couldn't save your password. Please try again."); return; }
    onDone();
  }
  const input = { width: "100%", background: Z.headerBg, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "12px 14px", color: Z.white, fontSize: 15, outline: "none", fontFamily: font, boxSizing: "border-box", marginBottom: 12 };
  return (
    <div style={{ minHeight: "100vh", background: Z.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: font }}>
      <form onSubmit={save} style={{ width: "100%", maxWidth: 420, background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.borderMd}`, borderRadius: 18, padding: 28 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: Z.white }}>Choose your password</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: Z.muted, lineHeight: 1.5 }}>
          Hello {String(user?.name || "").split(" ")[0] || "there"}. You signed in with a temporary password. Choose your own password to carry on. It must be at least 8 characters.
        </p>
        <label style={{ fontSize: 11, fontWeight: 700, color: Z.muted, letterSpacing: .5 }}>NEW PASSWORD</label>
        <input type={show ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" aria-label="New password" style={input} autoFocus />
        <label style={{ fontSize: 11, fontWeight: 700, color: Z.muted, letterSpacing: .5 }}>CONFIRM NEW PASSWORD</label>
        <input type={show ? "text" : "password"} value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" aria-label="Confirm new password" style={input} />
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: Z.muted, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show passwords
        </label>
        {err && <div role="alert" style={{ color: Z.red, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: font, opacity: busy ? .6 : 1 }}>
          {busy ? "Saving…" : "Save and continue"}
        </button>
        <button type="button" onClick={onSignOut} style={{ width: "100%", marginTop: 10, background: "transparent", color: Z.muted, border: "none", padding: 8, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Sign out</button>
      </form>
    </div>
  );
}

export { ForcePasswordChange };
