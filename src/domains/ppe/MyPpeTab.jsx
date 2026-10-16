/**
 * MyPpeTab — staff (desktop portal): "My PPE". What they've been issued and when it is due for
 * replacement, "Sign for your PPE" for anything issued without a signature, and "Report a
 * problem" (damaged, lost, doesn't fit), which their line manager and the admins see.
 * Line managers also get their team's register below (PpeRegisterTab, team only).
 * The phone app has the same under More → My PPE (mobile/screens/MyPpe.jsx).
 */
import React from "react";
import { ppeState, PPE_PROBLEMS, reportPpeProblem, openProblems } from "../../lib/ppe";
import { usePpeIssues, usePpeSettings, savePpeIssue, freshPpeIssue } from "../../lib/ppeClient";
import { auditEvent } from "../../lib/audit";
import { ask, notify } from "../../shared/Feedback";
import { t } from "../../lib/i18n";
import { PpeSignModal } from "./PpePerson";
import { PpeRegisterTab } from "./PpeRegisterTab";
import { StateChip, btn, small, ukd } from "./ppeUi";

const STATE_T = { problem: "Problem reported", overdue: "Overdue", unsigned: "Needs signature", soon: "Due soon", ok: "In date", returned: "Returned", replaced: "Replaced" };

export async function reportProblemFlow(row, user) {
  const v = await ask({ title: t("Report a problem: {item}", { item: row.data.item }), message: t("Your line manager and the H&S team will see it and arrange a replacement."), ok: t("Report it"),
    fields: [{ id: "kind", label: t("What's wrong?"), options: PPE_PROBLEMS.map(p => ({ value: p.id, label: t(p.label) })), required: true }, { id: "note", label: t("Anything else? (optional)") }] });
  if (!v) return false;
  const cur = (await freshPpeIssue(row.id)) || row;
  const e = await savePpeIssue(reportPpeProblem(cur, { kind: v.kind, note: v.note, by: user.name }));
  if (e) { notify(`${t("That didn't save.")} ${e}`, { kind: "error" }); return false; }
  auditEvent("ppe", row.id, "update", `PPE problem reported: ${row.data.item} (${(PPE_PROBLEMS.find(p => p.id === v.kind) || {}).label})`, {}, user.name);
  notify(t("Reported. Thank you."));
  return true;
}

export function MyPpeTab({ user, people, team = [], Z, font }) {
  const rows = usePpeIssues(true);
  const settings = usePpeSettings(true);
  const mine = rows.filter(r => String(r.user_id) === String(user.id));
  const current = mine.filter(r => r.status === "issued").sort((a, b) => String(b.data.issuedAt).localeCompare(String(a.data.issuedAt)));
  const past = mine.filter(r => r.status !== "issued");
  const unsigned = current.filter(r => !r.data.signature);
  const [signing, setSigning] = React.useState(false);
  const [showPast, setShowPast] = React.useState(false);
  const card = { background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.border}`, borderRadius: 16, padding: 18 };
  return (
    <div data-testid="my-ppe" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -.5, margin: "0 0 4px" }}>{t("My PPE")}</h2>
        <p style={{ color: Z.muted, margin: 0, fontSize: 13.5, lineHeight: 1.5, maxWidth: 720 }}>{t("The protective equipment you've been issued, and when it's due to be replaced. If something is damaged, lost or doesn't fit, report it here.")}</p>
      </div>
      {settings.staffCanSee && unsigned.length > 0 && (
        <div style={{ ...card, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.4)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}><b style={{ fontSize: 15 }}>{t("Sign for your new PPE")}</b><div style={{ fontSize: 13.5, color: Z.muted, marginTop: 3 }}>{unsigned.map(r => `${r.data.item} (${r.data.size})`).join(", ")}</div></div>
          <button type="button" style={btn(Z, font, "primary")} onClick={() => setSigning(true)} data-testid="my-ppe-sign">{t("Read and sign")}</button>
        </div>
      )}
      <div style={card}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800 }}>{t("What I've been issued")} ({current.length})</h3>
        {!current.length ? <div style={{ color: Z.muted, fontSize: 13.5 }}>{t("Nothing is recorded as issued to you.")}</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {current.map(r => { const d = r.data; const s = ppeState(r, undefined, settings.dueSoonDays); const op = openProblems(r); return (
              <div key={r.id} data-testid="my-ppe-item" style={{ background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 14, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{d.item}</b><StateChip state={s} label={t(STATE_T[s.key])}/></div>
                <div style={{ fontSize: 13, color: Z.muted }}>{d.size}{d.qty > 1 ? ` × ${d.qty}` : ""} · {d.replaceBy ? t("replace by {date}", { date: ukd(d.replaceBy) }) : t("replace when worn")}</div>
                {op.length > 0 && <div style={{ fontSize: 12.5, color: "#fca5a5" }}>{t("You reported this on {date}.", { date: ukd(op[op.length - 1].at) })}</div>}
                {settings.staffCanSee && !op.length && <button type="button" style={{ ...small(Z, font), alignSelf: "flex-start", marginTop: 4 }} onClick={() => reportProblemFlow(r, user)} data-testid="my-ppe-report">{t("Report a problem")}</button>}
              </div>
            ); })}
          </div>
        )}
        {past.length > 0 && <button type="button" onClick={() => setShowPast(v => !v)} style={{ background: "none", border: "none", color: Z.accentLt, fontFamily: font, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "12px 0 0" }}>{showPast ? t("Hide returned and replaced") : t("Show returned and replaced ({n})", { n: past.length })}</button>}
        {showPast && <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: Z.muted, fontSize: 13, lineHeight: 1.7 }}>{past.map(r => <li key={r.id}>{r.data.item} {r.data.size} · {t("issued {date}", { date: ukd(r.data.issuedOn) })} · {r.status === "replaced" ? t("replaced {date}", { date: ukd(r.data.returnedOn) }) : t("returned {date}", { date: ukd(r.data.returnedOn) })}</li>)}</ul>}
      </div>
      {user.role === "manager" && team.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 900 }}>My team's PPE</h3>
          <PpeRegisterTab me={user} people={people} scope={team} isAdmin={false} embedded Z={Z} font={font}/>
        </div>
      )}
      {signing && <PpeSignModal person={user} rows={unsigned} statement={settings.statement} via="portal" title={t("Sign for your PPE")} t={t} onClose={() => setSigning(false)} Z={Z} font={font}/>}
    </div>
  );
}
