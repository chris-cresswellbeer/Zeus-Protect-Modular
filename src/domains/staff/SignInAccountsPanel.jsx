import React, { useState } from "react";
import { adminCall, makeTempPassword } from "../../lib/auth";
import { E } from "../../lib/emoji";

/**
 * SignInAccountsPanel — Staff screen, Supabase sign-in mode only.
 * Shows who has a sign-in account and creates accounts (with temporary passwords)
 * for everyone who hasn't — used on changeover day and to catch anyone missed.
 * Leavers never get an account; their existing one is blocked (see zp-admin sync).
 */
function SignInAccountsPanel({ users, onShowPasswords, Z, font }) {
  const [status, setStatus] = useState(null);   // { id: {hasAccount, banned, mustChange} }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function check() {
    setBusy(true); setErr("");
    const r = await adminCall("status");
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setStatus(Object.fromEntries((r.users || []).map(u => [String(u.id), u])));
  }
  const active = (users || []).filter(u => (u.status || "active") !== "leaver");
  const missing = status ? active.filter(u => !(status[String(u.id)] || {}).hasAccount) : [];
  const withAcc = status ? active.filter(u => (status[String(u.id)] || {}).hasAccount) : [];
  const pending = status ? withAcc.filter(u => status[String(u.id)].mustChange) : [];

  async function createAll() {
    if (!missing.length) return;
    if (!window.confirm(`Create sign-in accounts for ${missing.length} ${missing.length === 1 ? "person" : "people"}? Each gets a temporary password, shown once for you to print.`)) return;
    setBusy(true); setErr("");
    const passwords = Object.fromEntries(missing.map(u => [String(u.id), makeTempPassword()]));
    const r = await adminCall("createMissing", { passwords });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    const byId = Object.fromEntries(missing.map(u => [String(u.id), u]));
    const done = (r.results || []).filter(x => x.ok).map(x => ({ name: byId[x.userId].name, login: String(byId[x.userId].email || "").toLowerCase(), password: passwords[x.userId] }));
    const failed = (r.results || []).filter(x => !x.ok).map(x => ({ name: (byId[x.userId] || {}).name, error: x.error }));
    onShowPasswords({ title: `Sign-in accounts created (${done.length})`, items: done, failures: failed });
    check();
  }

  const btn = { border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 800, cursor: "pointer", fontFamily: font, fontSize: 13 };
  return (
    <div data-testid="signin-accounts" style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.borderMd}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: Z.white }}>{E("🔐 ","")}Sign-in accounts</div>
          <div style={{ fontSize: 12, color: Z.muted, marginTop: 2 }}>
            {status ? `${withAcc.length} of ${active.length} current staff have a sign-in account${pending.length ? ` · ${pending.length} still on a temporary password` : ""}.`
                    : "Check who has a sign-in account, and create accounts for anyone who hasn't."}
          </div>
        </div>
        <button onClick={check} disabled={busy} style={{ ...btn, background: Z.overlay, color: Z.white, border: `1px solid ${Z.borderMd}` }}>{busy ? "Working…" : status ? "Refresh" : "Check accounts"}</button>
        {status && missing.length > 0 && (
          <button onClick={createAll} disabled={busy} style={{ ...btn, background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff" }}>
            Create {missing.length} account{missing.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>
      {status && missing.length > 0 && (
        <div style={{ fontSize: 12, color: Z.muted, marginTop: 10 }}>No account yet: {missing.map(u => u.name).join(", ")}</div>
      )}
      {err && <div role="alert" style={{ fontSize: 12, color: Z.red, fontWeight: 700, marginTop: 10 }}>{err}</div>}
    </div>
  );
}

export { SignInAccountsPanel };
