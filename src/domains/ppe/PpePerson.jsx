/**
 * PpePersonModal — one person's PPE record: the sizes they were last issued, what they hold
 * now (with Replace, Return, Get signature, Mark problem dealt with), and the full history
 * with every signature. "Print record" opens a printable copy (e.g. for an inspector).
 * PpeSignModal — they sign for items issued without a signature (in person on the portal,
 * or "Sign for your PPE" on the desktop My PPE page).
 */
import React from "react";
import { PPE_PROBLEMS, PPE_RETURN_REASONS, PPE_REASONS, ppeState, lastSizes, openProblems, returnPpe, dealWithPpeProblems, signPpe } from "../../lib/ppe";
import { savePpeIssue, deletePpeIssue, freshPpeIssue } from "../../lib/ppeClient";
import { auditEvent } from "../../lib/audit";
import { ask, notify } from "../../shared/Feedback";
import { SignaturePad, SignatureImage } from "../../shared/SignaturePad";
import { Modal, StateChip, btn, small, ukd } from "./ppeUi";

const reasonLabel = id => (PPE_REASONS.find(r => r.id === id) || {}).label || "";
const problemLabel = id => (PPE_PROBLEMS.find(r => r.id === id) || {}).label || "Problem";
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const byIssued = (a, b) => String((b.data || {}).issuedAt).localeCompare(String((a.data || {}).issuedAt));

/** Everything that happened, newest first: issued, signed, problems, returned/replaced. */
export function ppeHistory(rows) {
  const ev = [];
  rows.forEach(r => { const d = r.data || {};
    ev.push({ at: d.issuedAt, kind: "issued", row: r, text: `Issued ${d.item} ${d.size}${d.qty > 1 ? ` × ${d.qty}` : ""} (${reasonLabel(d.reason).toLowerCase()})${d.note ? ` · ${d.note}` : ""}`, by: d.issuedBy });
    if (d.signedAt && d.signedVia !== "in person") ev.push({ at: d.signedAt, kind: "signed", row: r, text: `Signed for ${d.item} (${d.signedVia === "phone" ? "on their phone" : "on the portal"})`, by: d.name });
    (d.problems || []).forEach(p => { ev.push({ at: p.at, kind: "problem", row: r, text: `Reported ${d.item}: ${problemLabel(p.kind).toLowerCase()}${p.note ? ` · "${p.note}"` : ""}`, by: p.by });
      if (p.dealtAt && p.dealtNote !== "Replaced") ev.push({ at: p.dealtAt, kind: "dealt", row: r, text: `Problem with ${d.item} dealt with${p.dealtNote ? ` · ${p.dealtNote}` : ""}`, by: p.dealtBy }); });
    if (r.status === "returned") ev.push({ at: `${d.returnedOn}T23:59:59Z`, kind: "returned", row: r, text: `Returned ${d.item} ${d.size}${d.returnReason ? ` (${d.returnReason.toLowerCase()})` : ""}`, by: d.returnedBy });
    if (r.status === "replaced") ev.push({ at: `${d.returnedOn}T00:00:01Z`, kind: "replaced", row: r, text: `Replaced ${d.item} ${d.size} (issued ${ukd(d.issuedOn)}) with a new one`, by: d.returnedBy });
  });
  return ev.filter(e => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function printPpeRecord(person, rows, statement) {
  const w = window.open("", "_blank"); if (!w) { notify("Your browser blocked the printable copy. Allow pop-ups for the portal and try again.", { kind: "error" }); return; }
  const list = [...rows].sort(byIssued);
  const tr = list.map(r => { const d = r.data || {}; const st = ppeState(r);
    return `<tr><td>${esc(ukd(d.issuedOn))}</td><td>${esc(d.item)}<div class="s">${esc(d.standard)}</div></td><td>${esc(d.size)}</td><td>${esc(d.qty)}</td><td>${esc(reasonLabel(d.reason))}</td><td>${esc(d.issuedBy)}</td><td>${esc(ukd(d.replaceBy))}</td>
      <td>${d.signature ? `<img src="${d.signature}" alt="Signature"><div class="s">${esc(ukd(String(d.signedAt).slice(0, 10)))}${d.signedVia ? `, ${esc(d.signedVia)}` : ""}</div>` : "<i>Not signed</i>"}</td>
      <td>${esc(st.label)}${d.returnedOn ? `<div class="s">${esc(ukd(d.returnedOn))}${d.returnReason ? ` · ${esc(d.returnReason)}` : ""}</div>` : ""}</td></tr>`; }).join("");
  w.document.write(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>PPE record – ${esc(person.name)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}h1{font-size:20px;margin:0 0 4px}.m{color:#555;margin:0 0 14px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px;vertical-align:top;text-align:left}th{background:#eef1f6;font-size:11px}
    img{height:38px;display:block}.s{color:#555;font-size:10.5px;margin-top:2px}.st{border:1px solid #bbb;padding:8px;margin:12px 0;background:#fafafa}@media print{button{display:none}}</style></head><body>
    <button onclick="print()" style="float:right;padding:8px 14px">Print</button>
    <h1>PPE issue record: ${esc(person.name)}</h1><p class="m">${esc([person.department, person.jobTitle, person.manager && `Line manager: ${person.manager}`].filter(Boolean).join(" · "))}<br>Printed ${esc(new Date().toLocaleString("en-GB"))}</p>
    <div class="st"><b>Statement signed for each item:</b> ${esc(statement)}</div>
    <table><thead><tr><th>Issued</th><th>Item</th><th>Size</th><th>Qty</th><th>Reason</th><th>Issued by</th><th>Replace by</th><th>Signature</th><th>Status</th></tr></thead><tbody>${tr || '<tr><td colspan="9">No PPE recorded.</td></tr>'}</tbody></table>
    </body></html>`);
  w.document.close();
}

export function PpeSignModal({ person, rows, statement, via = "in person", onClose, onDone, Z, font, title, t = s => s }) {
  const [sig, setSig] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  async function sign() {
    if (!sig) { setErr(t("Sign in the box first.")); return; }
    setBusy(true); setErr("");
    let n = 0;
    for (const r of rows) {
      const cur = (await freshPpeIssue(r.id)) || r;
      if ((cur.data || {}).signature) { n++; continue; }
      const e = await savePpeIssue(signPpe(cur, sig, via));
      if (e) { setErr(`${t("That didn't save.")} ${e}`); setBusy(false); return; }
      auditEvent("ppe", r.id, "update", `PPE signed for: ${(r.data || {}).item} (${via})`, {}, person.name);
      n++;
    }
    setBusy(false); notify(n === 1 ? t("Signed. Thank you.") : t("Signed for {n} items. Thank you.", { n })); onDone && onDone(); onClose();
  }
  return (
    <Modal title={title || `${person.name}: sign for PPE`} onClose={onClose} width={640} testid="ppe-sign" Z={Z} font={font}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, lineHeight: 1.6 }}>
          {rows.map(r => { const d = r.data || {}; return <li key={r.id}><b>{d.item}</b> · {d.size}{d.qty > 1 ? ` × ${d.qty}` : ""} · {t("issued {date}", { date: ukd(d.issuedOn) })}</li>; })}
        </ul>
        <div style={{ background: Z.navyMd, border: `1px solid ${Z.border}`, borderRadius: 14, padding: 14, fontSize: 14.5, lineHeight: 1.55 }}>{(rows[0] && rows[0].data.statement) || statement}</div>
        <SignaturePad Z={Z} onChange={setSig} height={200} typedName={person.name} font={font} testid="ppe-sig2" label={t("Signature")} hint={t("Sign with your finger or mouse")} clearLabel={t("Clear")} typeLabel={t("Type my name instead")}/>
        {err && <div role="alert" style={{ color: "#f87171", fontWeight: 700, fontSize: 13.5 }}>{err}</div>}
        <button type="button" onClick={sign} disabled={busy} data-testid="ppe-sign-save" style={{ ...btn(Z, font, "green"), minHeight: 54, fontSize: 16, opacity: busy ? .6 : 1 }}>{busy ? t("Saving…") : t("Sign")}</button>
      </div>
    </Modal>
  );
}

export function PpePersonModal({ me, person, rows, settings, isAdmin, onIssue, onClose, Z, font }) {
  const mine = rows.filter(r => String(r.user_id) === String(person.id));
  const current = mine.filter(r => r.status === "issued").sort(byIssued);
  const sizes = lastSizes(mine, person.id);
  const sizeList = settings.items.filter(i => sizes[i.id] && !i.sizes.every(s => s === "One size")).map(i => [i.name, sizes[i.id]]);
  const unsigned = current.filter(r => !(r.data || {}).signature);
  const urgent = current.map(r => [r, ppeState(r, undefined, settings.dueSoonDays)]).filter(([, s]) => s.overdue || s.problem);
  const [signing, setSigning] = React.useState(null);
  const [viewSig, setViewSig] = React.useState(null);
  const history = ppeHistory(mine);

  async function doReturn(r) {
    const v = await ask({ title: `Return ${r.data.item}?`, message: `${person.name} has handed back ${r.data.item} (${r.data.size}). It comes off their current PPE and stays in the history.`, ok: "Mark returned",
      fields: [{ id: "reason", label: "Why", options: PPE_RETURN_REASONS.map(x => ({ value: x, label: x })), required: true }, { id: "on", label: "Date returned", type: "date", value: new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }) }] });
    if (!v) return;
    const e = await savePpeIssue(returnPpe(r, { by: me.name, reason: v.reason, on: v.on || undefined }));
    if (e) { notify(`That didn't save. ${e}`, { kind: "error" }); return; }
    auditEvent("ppe", r.id, "update", `PPE returned: ${r.data.item} (${v.reason})`, {}, person.name);
  }
  async function doDealt(r) {
    const v = await ask({ title: "Mark the problem dealt with?", message: "Use this when nothing needs replacing (for example it was found, or it fits after all). To swap it, use Replace instead.", ok: "Mark dealt with",
      fields: [{ id: "note", label: "What was done", placeholder: "e.g. found in the locker", required: true }] });
    if (!v) return;
    const e = await savePpeIssue(dealWithPpeProblems(r, { by: me.name, note: v.note }));
    if (e) { notify(`That didn't save. ${e}`, { kind: "error" }); return; }
    auditEvent("ppe", r.id, "update", `PPE problem dealt with: ${r.data.item} (${v.note})`, {}, person.name);
  }
  async function doDelete(r) {
    if (!(await ask({ title: "Delete this entry?", message: `Only for an entry made by mistake: ${r.data.item} issued ${ukd(r.data.issuedOn)}. It is removed completely, signature included. If it was really issued and handed back, use Return instead.`, ok: "Delete", danger: true }))) return;
    const e = await deletePpeIssue(r.id);
    if (e) { notify(`That didn't delete. ${e}`, { kind: "error" }); return; }
    auditEvent("ppe", r.id, "delete", `PPE entry deleted (made by mistake): ${r.data.item} issued ${ukd(r.data.issuedOn)}`, {}, person.name);
  }

  return (
    <Modal title={`PPE record: ${person.name}`} onClose={onClose} width={1000} testid="ppe-person" Z={Z} font={font}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, fontSize: 14, color: Z.muted }}>{[person.department, person.jobTitle, person.manager && `Line manager: ${person.manager}`].filter(Boolean).join(" · ") || "—"}{(person.status || "active") === "leaver" ? " · Leaver" : ""}</div>
          <button type="button" style={btn(Z, font)} onClick={() => printPpeRecord(person, mine, settings.statement)} data-testid="ppe-print">Print record</button>
          {unsigned.length > 0 && <button type="button" style={btn(Z, font)} onClick={() => setSigning(unsigned)} data-testid="ppe-person-sign">Get signature ({unsigned.length})</button>}
          {(person.status || "active") !== "leaver" && <button type="button" style={btn(Z, font, "primary")} onClick={() => onIssue({ personId: person.id })} data-testid="ppe-person-issue">+ Issue PPE</button>}
        </div>
        {sizeList.length > 0 && (
          <div style={{ background: Z.navyMd, border: `1px solid ${Z.border}`, borderRadius: 14, padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
            {sizeList.map(([n, s]) => <div key={n}><div style={{ fontSize: 11, fontWeight: 700, color: Z.muted, textTransform: "uppercase", letterSpacing: .6 }}>{n}</div><div style={{ fontWeight: 800, marginTop: 2 }}>{s}</div></div>)}
            <div style={{ marginLeft: "auto", fontSize: 12.5, color: Z.muted }}>Last sizes issued: filled in next time</div>
          </div>
        )}
        {urgent.map(([r, s]) => (
          <div key={r.id} role="status" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240, fontSize: 14.5 }}>
              <b>{r.data.item}: {s.problem ? `${problemLabel(openProblems(r)[0].kind).toLowerCase()}` : "overdue for replacement"}</b>
              {s.problem ? ` (reported ${ukd(openProblems(r)[0].at)}${openProblems(r)[0].note ? `: "${openProblems(r)[0].note}"` : ""})` : ` since ${ukd(r.data.replaceBy)}`}
            </div>
            {s.problem && <button type="button" style={small(Z, font)} onClick={() => doDealt(r)} data-testid="ppe-dealt">Mark dealt with</button>}
            <button type="button" style={small(Z, font, "primary")} onClick={() => onIssue({ personId: person.id, replace: r, reason: s.problem ? ({ lost: "lost", fit: "fit" }[openProblems(r)[0].kind] || "damaged") : "worn" })} data-testid="ppe-replace-now">Replace now</button>
          </div>
        ))}

        <div style={{ fontSize: 15, fontWeight: 800 }}>Currently issued ({current.length})</div>
        {!current.length ? <div style={{ color: Z.muted, fontSize: 14 }}>Nothing issued at the moment.</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {current.map(r => { const d = r.data; const s = ppeState(r, undefined, settings.dueSoonDays); return (
              <div key={r.id} data-testid="ppe-current" style={{ background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontSize: 15 }}>{d.item}</b><StateChip state={s}/></div>
                <div style={{ fontSize: 13, color: Z.muted, lineHeight: 1.5 }}>{[d.standard, d.size, d.qty > 1 ? `× ${d.qty}` : null].filter(Boolean).join(" · ")}<br/>Issued {ukd(d.issuedOn)} by {d.issuedBy || "—"}{d.replaceBy ? ` · replace by ${ukd(d.replaceBy)}` : " · no fixed replacement date"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 34 }}>
                  {d.signature ? <><button type="button" onClick={() => setViewSig(r)} aria-label={`View ${person.name}'s signature for ${d.item}`} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><SignatureImage src={d.signature} height={30}/></button><span style={{ fontSize: 12, color: Z.muted }}>Signed {ukd(String(d.signedAt).slice(0, 10))}{d.signedVia && d.signedVia !== "in person" ? ` (${d.signedVia})` : ""}</span></>
                    : <span style={{ fontSize: 12.5, color: "#93c5fd", fontWeight: 700 }}>Not signed yet</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${Z.border}`, paddingTop: 10 }}>
                  <button type="button" style={small(Z, font)} onClick={() => onIssue({ personId: person.id, replace: r })} data-testid="ppe-replace">Replace</button>
                  <button type="button" style={small(Z, font)} onClick={() => doReturn(r)} data-testid="ppe-return">Return</button>
                  <span style={{ flex: 1 }}/>
                  {isAdmin && <button type="button" aria-label={`Delete ${d.item} (entered by mistake)`} title="Delete (entered by mistake)" style={{ ...small(Z, font, "danger"), background: "none", border: "none" }} onClick={() => doDelete(r)}>Delete</button>}
                </div>
              </div>
            ); })}
          </div>
        )}

        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>History</div>
        <div style={{ background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 640 }}>
            <thead><tr style={{ background: Z.navyMd }}>{["Date", "What happened", "By", "Signature"].map(h => <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: Z.muted, textTransform: "uppercase", letterSpacing: .6 }}>{h}</th>)}</tr></thead>
            <tbody>
              {!history.length && <tr><td colSpan={4} style={{ padding: 14, color: Z.muted }}>No PPE recorded yet.</td></tr>}
              {history.map((e, i) => (
                <tr key={i} data-testid="ppe-history-row" style={{ borderTop: `1px solid ${Z.border}` }}>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{ukd(e.at.slice(0, 10))}</td>
                  <td style={{ padding: "10px 14px" }}>{e.text}</td>
                  <td style={{ padding: "10px 14px" }}>{e.by || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>{(e.kind === "issued" || e.kind === "signed") && e.row.data.signature ? <button type="button" onClick={() => setViewSig(e.row)} style={{ background: "none", border: "none", color: Z.accentLt, cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700, padding: 0 }}>View</button> : e.kind === "issued" ? <span style={{ color: Z.muted }}>Not signed</span> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {signing && <PpeSignModal person={person} rows={signing} statement={settings.statement} via="in person" onClose={() => setSigning(null)} Z={Z} font={font}/>}
      {viewSig && (
        <Modal title={`Signature: ${viewSig.data.item}`} onClose={() => setViewSig(null)} width={560} Z={Z} font={font}>
          <SignatureImage src={viewSig.data.signature} height={140}/>
          <div style={{ fontSize: 13.5, color: Z.muted, marginTop: 12, lineHeight: 1.6 }}>Signed by {person.name}, {new Date(viewSig.data.signedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ({viewSig.data.signedVia || "in person"}).<br/>Statement: {viewSig.data.statement}</div>
        </Modal>
      )}
    </Modal>
  );
}
