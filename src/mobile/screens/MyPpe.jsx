// src/mobile/screens/MyPpe.jsx
//
// My PPE on the phone (More → My PPE): what you've been issued and when it's due for
// replacement, "Sign for your new PPE" (sign with your finger), and "Report damaged, lost or
// doesn't fit" (your line manager and the H&S team see it). The rules are in src/lib/ppe.js;
// the database lets you change nothing else about the record. Wording goes through t().

import React from "react";
import { Screen, SectionLabel, Card, StatusChip, PrimaryButton } from "../ui";
import { t } from "../../lib/i18n";
import { ppeState, openProblems, signPpe, reportPpeProblem, PPE_PROBLEMS } from "../../lib/ppe";
import { savePpeIssue, freshPpeIssue } from "../../lib/ppeClient";
import { auditEvent } from "../../lib/audit";
import { SignaturePad } from "../../shared/SignaturePad";

const ukd = iso => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const COLOR = { red: "#f87171", amber: "#f59e0b", blue: "#60a5fa", green: "#10b981", grey: "#94a3b8" };
const STATE_T = { problem: "Problem reported", overdue: "Overdue", unsigned: "Needs signature", soon: "Due soon", ok: "In date" };

function MyPpe({ user, rows, settings, online = true, Z, font }) {
  const mine = rows.filter(r => String(r.user_id) === String(user.id) && r.status === "issued")
    .sort((a, b) => String(b.data.issuedAt).localeCompare(String(a.data.issuedAt)));
  const unsigned = mine.filter(r => !r.data.signature);
  const [mode, setMode] = React.useState(null);       // null | "sign" | { report: row }
  const [sig, setSig] = React.useState(null);
  const [kind, setKind] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [done, setDone] = React.useState("");
  const fail = e => setErr(online ? `${t("That didn't save. Check your signal and try again.")}${e ? ` (${e})` : ""}` : t("No signal: this can't be sent yet. Move somewhere with signal and try again."));
  const inp = { width: "100%", boxSizing: "border-box", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "13px 14px", color: Z.white, fontSize: 15, fontFamily: font };

  async function sign() {
    if (!sig) { setErr(t("Sign in the box first.")); return; }
    setBusy(true); setErr("");
    try {
      for (const r of unsigned) {
        const cur = (await freshPpeIssue(r.id)) || r;
        if (cur.data.signature) continue;
        const e = await savePpeIssue(signPpe(cur, sig, "phone"));
        if (e) { fail(e); return; }
        auditEvent("ppe", r.id, "update", `PPE signed for: ${r.data.item} (phone)`, {}, user.name);
      }
      setMode(null); setSig(null); setDone(t("Signed. Thank you."));
    } catch { fail(); } finally { setBusy(false); }
  }
  async function report(row) {
    if (!kind) { setErr(t("Choose what's wrong.")); return; }
    setBusy(true); setErr("");
    try {
      const cur = (await freshPpeIssue(row.id)) || row;
      const e = await savePpeIssue(reportPpeProblem(cur, { kind, note, by: user.name }));
      if (e) { fail(e); return; }
      auditEvent("ppe", row.id, "update", `PPE problem reported: ${row.data.item} (${(PPE_PROBLEMS.find(p => p.id === kind) || {}).label}, phone)`, {}, user.name);
      setMode(null); setKind(""); setNote(""); setDone(t("Reported. Your line manager and the H&S team can see it."));
    } catch { fail(); } finally { setBusy(false); }
  }

  if (!settings.staffCanSee) return <Screen Z={Z}><Card Z={Z}><div style={{ color: Z.white, fontSize: 14, lineHeight: 1.5 }}>{t("My PPE isn't switched on for this site. Ask your H&S team.")}</div></Card></Screen>;

  // ── Sign ──
  if (mode === "sign") return (
    <Screen Z={Z}>
      <div data-testid="m-ppe-signing" style={{ fontSize: 15, color: Z.white, fontWeight: 800, marginBottom: 8 }}>{t("Sign for your new PPE")}</div>
      <ul style={{ margin: "0 0 12px", paddingLeft: 18, color: Z.white, fontSize: 14.5, lineHeight: 1.6 }}>
        {unsigned.map(r => <li key={r.id}>{r.data.item} · {r.data.size}{r.data.qty > 1 ? ` × ${r.data.qty}` : ""}</li>)}
      </ul>
      <Card Z={Z} style={{ marginBottom: 14 }}><div style={{ fontSize: 14, color: Z.white, lineHeight: 1.55 }}>{(unsigned[0] && unsigned[0].data.statement) || settings.statement}</div></Card>
      <SignaturePad Z={Z} onChange={setSig} height={190} typedName={user.name} font={font} testid="m-ppe-sig" label={t("Signature")} hint={t("Sign with your finger")} clearLabel={t("Clear")} typeLabel={t("Type my name instead")}/>
      {err && <div role="alert" style={{ color: Z.red, fontWeight: 700, fontSize: 13, marginTop: 12 }}>{err}</div>}
      <PrimaryButton Z={Z} font={font} tone="green" style={{ marginTop: 16 }} disabled={busy} onClick={sign}><span data-testid="m-ppe-sign-save">{busy ? t("Saving…") : t("Sign")}</span></PrimaryButton>
      <button type="button" onClick={() => { setMode(null); setErr(""); }} style={{ width: "100%", marginTop: 8, minHeight: 44, background: "none", border: "none", color: Z.muted, fontFamily: font, fontSize: 14, fontWeight: 700 }}>{t("Cancel")}</button>
    </Screen>
  );

  // ── Report a problem ──
  if (mode && mode.report) { const row = mode.report; return (
    <Screen Z={Z}>
      <div style={{ fontSize: 15, color: Z.white, fontWeight: 800, marginBottom: 4 }}>{row.data.item}</div>
      <div style={{ fontSize: 13, color: Z.muted, marginBottom: 14 }}>{row.data.size} · {t("issued {date}", { date: ukd(row.data.issuedOn) })}</div>
      <SectionLabel Z={Z}>{t("What's wrong?")}</SectionLabel>
      <div role="radiogroup" aria-label={t("What's wrong?")} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {PPE_PROBLEMS.map(p => (
          <button key={p.id} type="button" role="radio" aria-checked={kind === p.id} onClick={() => setKind(p.id)} data-testid={`m-ppe-kind-${p.id}`}
            style={{ minHeight: 50, textAlign: "left", padding: "0 16px", borderRadius: 12, border: `2px solid ${kind === p.id ? Z.accent : Z.borderMd}`, background: kind === p.id ? `${Z.accent}22` : Z.overlay, color: Z.white, fontWeight: 700, fontSize: 15, fontFamily: font }}>{t(p.label)}</button>
        ))}
      </div>
      <label htmlFor="m-ppe-note" style={{ display: "block", fontSize: 12, fontWeight: 700, color: Z.muted, margin: "0 0 6px" }}>{t("Anything else? (optional)")}</label>
      <input id="m-ppe-note" value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder={t("e.g. sole coming away")} style={inp}/>
      {err && <div role="alert" style={{ color: Z.red, fontWeight: 700, fontSize: 13, marginTop: 12 }}>{err}</div>}
      <PrimaryButton Z={Z} font={font} style={{ marginTop: 16 }} disabled={busy} onClick={() => report(row)}><span data-testid="m-ppe-report-send">{busy ? t("Sending…") : t("Report it")}</span></PrimaryButton>
      <button type="button" onClick={() => { setMode(null); setErr(""); setKind(""); setNote(""); }} style={{ width: "100%", marginTop: 8, minHeight: 44, background: "none", border: "none", color: Z.muted, fontFamily: font, fontSize: 14, fontWeight: 700 }}>{t("Cancel")}</button>
    </Screen>
  ); }

  // ── List ──
  return (
    <Screen Z={Z}>
      {done && <div role="status" data-testid="m-ppe-done" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 14, padding: "12px 14px", color: Z.white, fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{done}</div>}
      {unsigned.length > 0 && (
        <Card Z={Z} tone="accent" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: Z.white }}>{t("Sign for your new PPE")}</div>
          <div style={{ fontSize: 13.5, color: Z.muted, margin: "4px 0 10px", lineHeight: 1.45 }}>{unsigned.map(r => `${r.data.item} (${r.data.size})`).join(", ")}{unsigned[0].data.issuedBy ? ` · ${t("issued by {name}", { name: unsigned[0].data.issuedBy })}` : ""}</div>
          <PrimaryButton Z={Z} font={font} onClick={() => { setDone(""); setErr(""); setMode("sign"); }}><span data-testid="m-ppe-sign">{t("Read and sign")}</span></PrimaryButton>
        </Card>
      )}
      <SectionLabel Z={Z}>{t("What I've been issued")}</SectionLabel>
      {!mine.length && <Card Z={Z}><div style={{ color: Z.muted, fontSize: 14 }}>{t("Nothing is recorded as issued to you.")}</div></Card>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mine.map(r => { const s = ppeState(r, undefined, settings.dueSoonDays); const op = openProblems(r); return (
          <div key={r.id} data-testid="m-ppe-item" style={{ background: Z.navyMd, border: `1px solid ${Z.border}`, borderRadius: 14, padding: "13px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15.5, color: Z.white }}>{r.data.item}</span>
              <StatusChip label={t(STATE_T[s.key])} color={COLOR[s.tone]}/>
            </div>
            <div style={{ fontSize: 13, color: Z.muted, marginTop: 3 }}>{r.data.size}{r.data.qty > 1 ? ` × ${r.data.qty}` : ""} · {r.data.replaceBy ? t("replace by {date}", { date: ukd(r.data.replaceBy) }) : t("replace when worn")}</div>
            {op.length > 0 ? <div style={{ fontSize: 12.5, color: "#fca5a5", marginTop: 6 }}>{t("You reported this on {date}.", { date: ukd(op[op.length - 1].at) })}</div>
              : <button type="button" onClick={() => { setDone(""); setErr(""); setMode({ report: r }); }} data-testid="m-ppe-report"
                style={{ marginTop: 8, minHeight: 40, padding: "0 12px", borderRadius: 10, border: `1px solid ${Z.borderMd}`, background: Z.overlay, color: Z.white, fontWeight: 700, fontSize: 13, fontFamily: font }}>{t("Report damaged, lost or doesn't fit")}</button>}
          </div>
        ); })}
      </div>
      <div style={{ fontSize: 12, color: Z.muted, lineHeight: 1.45, textAlign: "center", marginTop: 16 }}>{t("Wear your PPE wherever it's required. If it's damaged, lost or doesn't fit, report it so it can be replaced.")}</div>
    </Screen>
  );
}

/** Today screen banner when there's PPE to sign for. */
function PpeBanner({ count, onOpen, Z, font }) {
  return (
    <button type="button" data-testid="m-ppe-banner" onClick={onOpen}
      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, borderRadius: 14, padding: "12px 14px", marginBottom: 14, fontFamily: font, cursor: "pointer", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.4)" }}>
      <span style={{ fontSize: 22 }} aria-hidden="true">🦺</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: Z.white }}>{t("Sign for your new PPE")}</span>
        <span style={{ display: "block", fontSize: 12, color: Z.muted }}>{count === 1 ? t("1 item to sign for") : t("{n} items to sign for", { n: count })}</span>
      </span>
      <span style={{ color: Z.muted, fontSize: 18 }}>›</span>
    </button>
  );
}

export { MyPpe, PpeBanner };
