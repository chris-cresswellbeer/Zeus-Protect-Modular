/**
 * SigninPanel — contractor sign-ins from the reception QR code, on the Contractors page.
 *   QrSigninCard     one person on site now (in the On Site Right Now board): what they
 *                    told us, what reception should check, Sign out / Remove
 *   QrSignedOutChip  one person who has signed out today
 *   SigninReview     "New contractors to review": link a sign-in to the register, add the
 *                    company or worker, or dismiss it
 *   CompanySignins   a company's QR sign-ins (company page → Visits)
 * Data: lib/siteSignins.js (site_signins, admins only). A sign-in never changes the
 * Contractor Register by itself; only the buttons here do.
 */
import React from "react";
import { ask, notify } from "../../shared/Feedback";
import { ukDate } from "../../lib/dates";
import { saveSignin, removeSignin } from "../../lib/siteSignins";
import { similarCompanies, findWorker, ukNow } from "../../lib/contractorSignin";

const PERMIT = { yes: "Needs a permit to work", unsure: "Not sure if a permit is needed" };
const amber = { background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" };

function Warnings({ list }) {
  if (!list || !list.length) return null;
  return (
    <ul data-testid="qr-warnings" style={{ ...amber, listStyle: "none", margin: "8px 0 0", padding: "6px 9px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, lineHeight: 1.45 }}>
      {list.map((w, i) => <li key={i}>⚠ {w}</li>)}
    </ul>
  );
}

export function QrSigninCard({ s, T, font }) {
  const d = s.data;
  const [busy, setBusy] = React.useState(false);
  const small = { background: T.overlay, color: T.white, border: `1px solid ${T.borderMd}`, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontFamily: font, fontWeight: 700 };
  async function out() {
    setBusy(true);
    const ok = await saveSignin(s, { timeOut: ukNow().time, signedOutBy: "reception" }, "Signed out at reception");
    setBusy(false);
    if (!ok) notify("The sign-out couldn't be saved. Check the connection and try again.", { kind: "error" });
  }
  async function remove() {
    if (!(await ask({ title: "Remove this sign-in?", message: `${d.workerName} (${d.companyName}), ${ukDate(d.date)} ${d.timeIn}. Use this only for a mistake or a test: it's taken off the visit record.`, ok: "Remove", danger: true }))) return;
    if (!(await removeSignin(s))) notify("The sign-in couldn't be removed.", { kind: "error" });
  }
  return (
    <div data-testid="qr-onsite" style={{ background: "rgba(16,185,129,0.08)", borderRadius: 12, padding: "12px 14px", border: `1px solid ${d.warnings && d.warnings.length ? "rgba(245,158,11,0.45)" : "rgba(16,185,129,0.25)"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.workerName}</div>
          <div style={{ fontSize: 10.5, color: "#34d399", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.companyName}</div>
        </div>
        <span title="Signed in with the reception QR code" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .5, padding: "2px 6px", borderRadius: 6, background: T.overlay, color: T.muted, border: `1px solid ${T.border}` }}>QR</span>
      </div>
      <div style={{ fontSize: 11, color: T.muted }}>In: {d.timeIn}{d.areas ? ` · ${d.areas}` : ""}</div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Seeing {d.host} · {d.purpose}</div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>📞 <a href={`tel:${d.phone}`} style={{ color: T.muted }}>{d.phone}</a></div>
      {PERMIT[d.permit] && <div style={{ marginTop: 5, fontSize: 10.5, fontWeight: 700, color: "#f59e0b" }}>⚠ {PERMIT[d.permit]}</div>}
      <Warnings list={d.warnings}/>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="button" data-testid="qr-signout" style={{ ...small, opacity: busy ? .6 : 1 }} disabled={busy} onClick={out}>Sign out</button>
        <button type="button" aria-label={`Remove the sign-in of ${d.workerName}`} style={{ ...small, color: "#f87171" }} onClick={remove}>🗑</button>
      </div>
    </div>
  );
}

export function QrSignedOutChip({ s, T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 20, background: T.overlay, border: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: T.muted }}>QR</span>
      <span style={{ fontSize: 12, color: T.muted }}>{s.data.workerName} · {s.data.companyName}</span>
      <span style={{ fontSize: 11, color: T.muted }}>Out {s.data.timeOut}</span>
    </div>
  );
}

/** New companies and workers from QR sign-ins, for an admin to deal with. */
export function SigninReview({ list, contractors, setContractors, dbSaveContractor, onOpenCompany, T, font }) {
  if (!list.length) return null;
  return (
    <div data-testid="qr-review" style={{ ...amber, color: T.white, borderRadius: 16, padding: 18, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: T.white }}>🪪 New contractors to review ({list.length})</h3>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>Signed in with the reception QR code but not in the Contractor Register. Link each one to the right company and worker, or add them, then check their induction and certificates.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map(s => <ReviewRow key={s.id} s={s} contractors={contractors} setContractors={setContractors} dbSaveContractor={dbSaveContractor} onOpenCompany={onOpenCompany} T={T} font={font}/>)}
      </div>
    </div>
  );
}

function ReviewRow({ s, contractors, setContractors, dbSaveContractor, onOpenCompany, T, font }) {
  const d = s.data;
  const company = d.companyId ? contractors.find(c => c.id === d.companyId) : null;
  const sims = company ? [] : similarCompanies(contractors, d.companyName);
  const [pickCo, setPickCo] = React.useState(sims[0] ? sims[0].id : "");
  const [pickW, setPickW] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const btn = (primary) => ({ background: primary ? `linear-gradient(135deg,${T.accent},${T.blue})` : T.overlay, color: "#fff", border: primary ? "none" : `1px solid ${T.borderMd}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, minHeight: 34 });
  const sel = { background: T.overlay, border: `1px solid ${T.borderMd}`, borderRadius: 8, padding: "7px 10px", color: T.white, fontFamily: font, fontSize: 12, minHeight: 34, maxWidth: 260 };
  const reviewed = { reviewed: true, reviewedAt: new Date().toISOString() };
  // the "new company / new worker" warning has been dealt with; say what reception still has to do
  const ADDED = "Added to the register from this sign-in: site induction and certificates to record";
  const warn = (added) => [...(d.warnings || []).filter(w => !/^New (company|worker)/.test(w)), ...(added ? [ADDED] : [])];
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const saveCo = async (c) => { setContractors(p => (p.some(x => x.id === c.id) ? p.map(x => (x.id === c.id ? c : x)) : [c, ...p])); await dbSaveContractor(c); };
  const newWorker = () => ({ id: `w_${Date.now()}`, name: d.workerName, role: "", email: "", phone: d.phone || "" });

  const addCompany = () => run(async () => {
    const w = newWorker();
    const c = { id: `con_${Date.now()}`, name: d.companyName, type: "Contractor", status: "active", email: "", phone: d.phone || "", notes: `Added from a QR sign-in on ${ukDate(d.date)}.`, workers: [w] };
    await saveCo(c);
    await saveSignin(s, { companyId: c.id, workerId: w.id, newCompany: false, newWorker: false, warnings: warn(true), ...reviewed }, "New company added from a QR sign-in");
    notify(`${c.name} added to the Contractor Register, with ${w.name}. Open it to add their induction and certificates.`, { undo: () => onOpenCompany(c.id), undoLabel: "Open" });
  });
  const linkCompany = () => run(async () => {
    const c = contractors.find(x => x.id === pickCo); if (!c) return;
    const w = findWorker(c, d.workerName);
    await saveSignin(s, w ? { companyId: c.id, workerId: w.id, newCompany: false, newWorker: false, warnings: warn(false), ...reviewed }
      : { companyId: c.id, newCompany: false, newWorker: true, warnings: ["New worker: no site induction or certificates on record", ...warn(false)] }, `Linked to ${c.name}`);
  });
  const addWorker = () => run(async () => {
    const w = newWorker();
    await saveCo({ ...company, workers: [...(company.workers || []), w] });
    await saveSignin(s, { workerId: w.id, newWorker: false, warnings: warn(true), ...reviewed }, `Worker added to ${company.name} from a QR sign-in`);
  });
  const linkWorker = () => run(async () => {
    const w = (company.workers || []).find(x => x.id === pickW); if (!w) return;
    await saveSignin(s, { workerId: w.id, newWorker: false, warnings: warn(false), ...reviewed }, `Linked to ${w.name}, ${company.name}`);
  });
  const dismiss = () => run(async () => { await saveSignin(s, { ...reviewed }, "Reviewed without linking"); });

  return (
    <div data-testid="qr-review-row" style={{ background: T.overlay, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <b style={{ fontSize: 14 }}>{d.workerName}</b>
        <span style={{ fontSize: 13, color: T.muted }}>{d.companyName}{company ? "" : " · new company"}</span>
        <span style={{ fontSize: 12, color: T.muted }}>{ukDate(d.date)} {d.timeIn}{d.timeOut ? `–${d.timeOut}` : " · on site"}</span>
        <span style={{ fontSize: 12, color: T.muted }}>📞 {d.phone} · seeing {d.host}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
        {!company ? <>
          <button type="button" data-testid="qr-add-company" style={btn(true)} disabled={busy} onClick={addCompany}>+ Add {d.companyName} to the register</button>
          <span style={{ fontSize: 12, color: T.muted }}>or it's</span>
          <select aria-label="Existing company" data-testid="qr-pick-company" value={pickCo} onChange={e => setPickCo(e.target.value)} style={sel}>
            <option value="">Choose a company…</option>
            {sims.length > 0 && <optgroup label="Similar names">{sims.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            <optgroup label="All companies">{[...contractors].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          </select>
          <button type="button" data-testid="qr-link-company" style={btn(false)} disabled={busy || !pickCo} onClick={linkCompany}>Link</button>
        </> : <>
          <button type="button" data-testid="qr-add-worker" style={btn(true)} disabled={busy} onClick={addWorker}>+ Add {d.workerName} to {company.name}</button>
          {(company.workers || []).length > 0 && <>
            <span style={{ fontSize: 12, color: T.muted }}>or it's</span>
            <select aria-label="Existing worker" data-testid="qr-pick-worker" value={pickW} onChange={e => setPickW(e.target.value)} style={sel}>
              <option value="">Choose a worker…</option>
              {company.workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button type="button" data-testid="qr-link-worker" style={btn(false)} disabled={busy || !pickW} onClick={linkWorker}>Link</button>
          </>}
        </>}
        <button type="button" data-testid="qr-dismiss" style={{ ...btn(false), marginLeft: "auto" }} disabled={busy} onClick={dismiss}>Dismiss</button>
      </div>
    </div>
  );
}

/** A company's sign-ins by QR code (company page → Visits). */
export function CompanySignins({ list, T }) {
  if (!list.length) return null;
  return (
    <div data-testid="qr-company-signins" style={{ marginBottom: 18 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: T.white }}>Signed in with the reception QR code ({list.length}, last 90 days)</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map(s => { const d = s.data; return (
          <div key={s.id} style={{ background: T.overlay, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: T.white }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <b>{ukDate(d.date)}</b><span>{d.timeIn}{d.timeOut ? `–${d.timeOut}` : " · on site"}</span><span>{d.workerName}</span>
              <span style={{ color: T.muted }}>{d.purpose} · seeing {d.host}{d.areas ? ` · ${d.areas}` : ""}</span>
            </div>
            <Warnings list={d.warnings}/>
          </div>
        ); })}
      </div>
    </div>
  );
}
