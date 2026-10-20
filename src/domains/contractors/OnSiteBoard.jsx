/**
 * OnSiteBoard — who is on site now, for H&S (Contractors page) and reception (staff →
 * Reception, for people with Reception access).
 *   • everyone signed in and not out: the reception QR code and visits logged by hand
 *   • for each, what to know NOW (lib/contractorApproval.js signinIssues): company not
 *     approved (documents missing / expired), banned, a permit to work needed and not
 *     issued, a new company H&S hasn't checked
 *   • Sign out (one tap), and after the end-of-day check time (Site Settings) a banner
 *     "still signed in after 17:00: check they've gone"
 *   • 🔥 Roll call: a printable list of everyone on site, by company, for the assembly point
 *   • who signed out today
 * Visits logged by hand can only be signed out by an admin (onSignOutVisit).
 */
import React from "react";
import { ask, notify } from "../../shared/Feedback";
import { ukDate, todayISO } from "../../lib/dates";
import { ukNow } from "../../lib/contractorSignin";
import { saveSignin, removeSignin, signinsOutToday } from "../../lib/siteSignins";
import { onSiteList, liveIssues as issuesFor, approvalOf, pastCheckTime, rollCallHtml } from "../../lib/contractorApproval";
import { getBrand, brandCompany } from "../../lib/brandCore";

const PERMIT = { yes: "Said they need a permit to work", unsure: "Not sure if a permit is needed" };
const TONE = {
  green: { color: "#34d399", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)" },
  amber: { color: "#fbbf24", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)" },
  red:   { color: "#f87171", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)" },
  grey:  { color: "#94a3b8", background: "rgba(148,163,184,0.12)", border: "1px solid rgba(148,163,184,0.35)" },
};

export function ApprovalChip({ company, required, today, small = false }) {
  if (!company) return null;
  const a = approvalOf(company, { required, today });
  return <span data-testid="approval-chip" data-approval={a.key} title={a.issues.join("\n") || "All required documents on file and in date"}
    style={{ ...TONE[a.tone], fontSize: small ? 9.5 : 10.5, fontWeight: 800, padding: small ? "1px 6px" : "2px 8px", borderRadius: 20, whiteSpace: "nowrap", display: "inline-block" }}>{a.label}</span>;
}

/**
 * A sign-in names a company or worker this browser's copy of the register hasn't got (the sign-in
 * just added it): read the register again. Once per new name.
 */
export function useRegisterCatchUp(signins, contractors, refreshContractors) {
  const missing = [...new Set((signins || []).filter(s => s.data && s.data.companyId).filter(s => {
    const c = (contractors || []).find(x => String(x.id) === String(s.data.companyId));
    return !c || (s.data.workerId && !(c.workers || []).some(w => String(w.id) === String(s.data.workerId)));
  }).map(s => `${s.data.companyId}/${s.data.workerId || ""}`))].sort().join(",");
  const asked = React.useRef(new Set());
  React.useEffect(() => {
    if (!missing || !refreshContractors || asked.current.has(missing)) return;
    asked.current.add(missing);
    refreshContractors();
  }, [missing, refreshContractors]);
}

export function OnSiteBoard({ signins, contractors, contractorVisits, setContractorVisits, dbSaveContractorVisits, contractorCerts, permits, settings, admin = false, me, onOpenCompany, T, font, children }) {
  const today = todayISO();
  const [, tick] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { const iv = setInterval(tick, 60000); return () => clearInterval(iv); }, []);   // the check time passes
  const now = ukNow().time;
  const list = onSiteList({ signins, contractors, visits: contractorVisits, today, now });
  const late = pastCheckTime(settings.onsiteCheckTime, now) && list.length > 0;
  const qrOut = signinsOutToday(signins, today);
  const visitOut = [];
  (contractors || []).forEach(c => ((contractorVisits || {})[c.id] || []).forEach(v => { if (v && v.date === today && v.timeOut && v.timeOut.slice(0, 5) <= now) visitOut.push({ c, v }); }));
  const ctx = { contractors, contractorCerts, permits, settings, today };
  const btn = (primary) => ({ background: primary ? `linear-gradient(135deg,${T.accent},${T.blue})` : T.overlay, color: "#fff", border: primary ? "none" : `1px solid ${T.borderMd}`, borderRadius: 8, padding: "7px 13px", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, minHeight: 34 });

  function rollCall() {
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) { notify("The roll call window was blocked. Allow pop-ups for the portal and try again.", { kind: "error" }); return; }
    win.document.write(rollCallHtml({ list, site: settings.site, date: today, time: ukNow().time, company: brandCompany(getBrand()) }));
    win.document.close();
  }
  async function signOut(p) {
    const t = ukNow().time;
    if (p.source === "qr") {
      const ok = await saveSignin(p.row, { timeOut: t, signedOutBy: (me && me.name) || "reception", signedOutAt: new Date().toISOString() }, "Signed out in the portal");
      if (!ok) notify("The sign-out couldn't be saved. Check the connection and try again.", { kind: "error" });
      return;
    }
    const c = contractors.find(x => x.id === p.companyId); if (!c || !dbSaveContractorVisits) return;
    const visits = ((contractorVisits || {})[c.id] || []).map(v => (v.id === p.visit.id ? { ...v, timeOut: t } : v));
    setContractorVisits(prev => ({ ...prev, [c.id]: visits }));
    await dbSaveContractorVisits(c.id, visits);
  }
  async function signOutAll() {
    if (!(await ask({ title: `Sign out all ${list.length}?`, message: "Only once you've checked they have all left site.", ok: "Sign them all out" }))) return;
    for (const p of list) if (p.source === "qr" || admin) await signOut(p);   // eslint-disable-line no-await-in-loop
  }
  async function remove(p) {
    const d = p.row.data;
    if (!(await ask({ title: "Remove this sign-in?", message: `${d.workerName} (${d.companyName}), ${ukDate(d.date)} ${d.timeIn}. Use this only for a mistake or a test: it's taken off the visit record.`, ok: "Remove", danger: true }))) return;
    if (!(await removeSignin(p.row))) notify("The sign-in couldn't be removed.", { kind: "error" });
  }

  const n = list.length, nOut = qrOut.length + visitOut.length;
  return (
    <div data-testid="onsite-board" style={{ background: n > 0 ? "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05))" : `linear-gradient(135deg,${T.navyMd},${T.navy})`, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${n > 0 ? "rgba(16,185,129,0.3)" : T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: n > 0 ? "#10b981" : "#64748b", flexShrink: 0 }}/>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.white }}>On Site Right Now</h3>
        <span data-testid="onsite-count" style={{ fontSize: 12, color: n > 0 ? "#10b981" : T.muted, fontWeight: 600 }}>{n} on site · {nOut} signed out today</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" data-testid="rollcall" style={{ ...btn(false), borderColor: "rgba(239,68,68,0.5)" }} onClick={rollCall}>🔥 Roll call ({n})</button>
        </div>
      </div>
      {late && (
        <div role="alert" data-testid="onsite-late" style={{ ...TONE.amber, color: T.white, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 220 }}>⏰ It's after <b>{settings.onsiteCheckTime}</b> and <b>{n}</b> {n === 1 ? "person is" : "people are"} still signed in. Check they've left, then sign them out.</span>
          <button type="button" data-testid="signout-all" style={btn(false)} onClick={signOutAll}>Sign them all out…</button>
        </div>
      )}
      {n === 0 && <div style={{ fontSize: 13, color: T.muted }}>Nobody is signed in.</div>}
      {n > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
          {list.map(p => {
            const issues = issuesFor(p, ctx);
            const red = issues.some(i => i.level === "red");
            const company = contractors.find(c => String(c.id) === String(p.companyId));
            return (
              <div key={p.key} data-testid={p.source === "qr" ? "qr-onsite" : "visit-onsite"} style={{ background: "rgba(16,185,129,0.06)", borderRadius: 12, padding: "12px 14px", border: `1px solid ${red ? "rgba(239,68,68,0.5)" : issues.length ? "rgba(245,158,11,0.45)" : "rgba(16,185,129,0.25)"}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.white, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    {onOpenCompany && company
                      ? <button type="button" onClick={() => onOpenCompany(company.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: font, fontSize: 11, color: "#34d399", textAlign: "left" }}>{p.companyName}</button>
                      : <div style={{ fontSize: 11, color: "#34d399" }}>{p.companyName}</div>}
                    {company && <div style={{ marginTop: 3 }}><ApprovalChip company={company} required={settings.requiredDocs} today={today} small/></div>}
                  </div>
                  <span title={p.source === "qr" ? "Signed in with the reception QR code" : "Visit logged in the portal"} style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: T.overlay, color: T.muted, border: `1px solid ${T.border}` }}>{p.source === "qr" ? "QR" : "LOG"}</span>
                </div>
                <div style={{ fontSize: 11.5, color: T.muted }}>In: {p.timeIn || "–"}{p.areas ? ` · ${p.areas}` : ""}</div>
                {(p.host || p.purpose) && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{p.host ? `Seeing ${p.host}` : ""}{p.host && p.purpose ? " · " : ""}{p.purpose}</div>}
                {p.phone && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>📞 <a href={`tel:${p.phone}`} style={{ color: T.muted }}>{p.phone}</a></div>}
                {PERMIT[p.permit] && !issues.some(i => i.kind === "permit") && <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: "#34d399" }}>✓ {PERMIT[p.permit]}: permit issued today</div>}
                {issues.length > 0 && (
                  <ul data-testid="qr-warnings" style={{ listStyle: "none", margin: "8px 0 0", padding: "6px 9px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, lineHeight: 1.45, ...(red ? TONE.red : TONE.amber) }}>
                    {issues.map((w, i) => <li key={i} style={{ color: w.level === "red" ? "#f87171" : "#fbbf24" }}>⚠ {w.text}</li>)}
                  </ul>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                  {(p.source === "qr" || admin) && <button type="button" data-testid="qr-signout" style={btn(false)} onClick={() => signOut(p)}>Sign out</button>}
                  {p.source === "qr" && admin && <button type="button" aria-label={`Remove the sign-in of ${p.name}`} style={{ ...btn(false), color: "#f87171" }} onClick={() => remove(p)}>🗑</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {nOut > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Signed Out Today</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {qrOut.map(s => (
              <div key={s.id} data-testid="qr-out" style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 20, background: T.overlay, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.muted }}>{s.data.workerName} · {s.data.companyName}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{s.data.timeIn}–{s.data.timeOut}</span>
              </div>
            ))}
            {visitOut.map(({ c, v }) => (
              <div key={`${c.id}:${v.id}`} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 20, background: T.overlay, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.muted }}>{c.name}</span><span style={{ fontSize: 11, color: T.muted }}>Out {v.timeOut}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
