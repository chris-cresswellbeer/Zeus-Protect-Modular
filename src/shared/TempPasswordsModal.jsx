import React from "react";
import { E } from "../lib/emoji";

/**
 * TempPasswordsModal — shows temporary passwords ONCE, after an admin creates
 * sign-in accounts or resets passwords (Supabase sign-in mode, see lib/auth.js).
 * The passwords are not stored anywhere in the portal, so the admin must print
 * or note them now. Each person has to choose their own password at first sign-in.
 *
 * props: items [{ name, login, password }], failures [{ name, error }], title, onClose, Z, font
 */
function TempPasswordsModal({ items = [], failures = [], title, onClose, Z, font }) {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function print() {
    const w = window.open("", "_blank");
    if (!w) { alert("Allow pop-ups for this site to print the list."); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zeus Protect – temporary passwords</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}h1{font-size:18px}p{font-size:12px;color:#475569}
      table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}
      th{background:#0d1f5c;color:#fff}td.pw{font-family:Consolas,monospace;font-size:15px;letter-spacing:1px}
      .slip{page-break-inside:avoid}</style></head><body>
      <h1>Zeus Protect – temporary passwords</h1>
      <p>Printed ${new Date().toLocaleString("en-GB")}. Give each person their own line only. They must choose a new password the first time they sign in. Shred this sheet afterwards.</p>
      <table><tr><th>Name</th><th>Sign-in</th><th>Temporary password</th></tr>
      ${items.map(i => `<tr class="slip"><td>${esc(i.name)}</td><td>${esc(i.login)}</td><td class="pw">${esc(i.password)}</td></tr>`).join("")}
      </table><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }
  function copy() {
    const text = items.map(i => `${i.name}\t${i.login}\t${i.password}`).join("\n");
    if (navigator.clipboard) navigator.clipboard.writeText(text);
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label={title || "Temporary passwords"} style={{ background: Z.bgCard || Z.navy, border: `1px solid ${Z.borderMd}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto", fontFamily: font }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: Z.white }}>{title || "Temporary passwords"}</h3>
        {items.length > 0 && (
          <p style={{ margin: "0 0 14px", fontSize: 13, color: Z.amber, fontWeight: 700, lineHeight: 1.5 }}>
            These are shown once and aren't stored. Print or note them now. Each person must choose their own password when they first sign in.
          </p>
        )}
        {items.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 14 }}>
            <thead><tr>{["Name", "Sign-in", "Temporary password"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: Z.muted, fontSize: 11, borderBottom: `1px solid ${Z.borderMd}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {items.map((i, k) => (
                <tr key={k}>
                  <td style={{ padding: "6px 8px", color: Z.white, borderBottom: `1px solid ${Z.border}` }}>{i.name}</td>
                  <td style={{ padding: "6px 8px", color: Z.muted, borderBottom: `1px solid ${Z.border}` }}>{i.login}</td>
                  <td data-testid="temp-password" style={{ padding: "6px 8px", color: Z.white, fontFamily: "Consolas,monospace", fontSize: 14, letterSpacing: 1, borderBottom: `1px solid ${Z.border}` }}>{i.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {failures.length > 0 && (
          <div role="alert" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: Z.red, marginBottom: 4 }}>Not done:</div>
            {failures.map((f, k) => <div key={k} style={{ fontSize: 12, color: Z.white }}>{f.name ? `${f.name}: ` : ""}{f.error}</div>)}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && <button onClick={print} style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: font }}>{E("🖨 ","")}Print</button>}
          {items.length > 0 && <button onClick={copy} style={{ background: Z.overlay, color: Z.white, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontFamily: font }}>Copy</button>}
          <button onClick={() => { if (!items.length || window.confirm("Close? The temporary passwords won't be shown again.")) onClose(); }}
            style={{ marginLeft: "auto", background: "transparent", color: Z.muted, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontFamily: font }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export { TempPasswordsModal };
