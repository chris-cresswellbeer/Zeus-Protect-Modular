/**
 * SigninPanel — contractor sign-ins from the reception QR code, on the Contractors page.
 * (Who is on site now, with Sign out: OnSiteBoard.jsx.)
 *   QrAddedReview    "Added from QR sign-in – check": companies and workers a QR sign-in added
 *                    to the register (netlify/functions/zp-signin.mjs). OK keeps them; Merge
 *                    moves them into the entry they really are (a typo, "Ltd" missing…).
 *   SigninReview     sign-ins from before October 2026, when a sign-in didn't add to the
 *                    register: link to the register, add the company or worker, or dismiss
 *   CompanySignins   a company's QR sign-ins (company page → Visits)
 * Data: lib/siteSignins.js (site_signins: admins and Reception access).
 */
import React from "react";
import { ask, notify } from "../../shared/Feedback";
import { ukDate } from "../../lib/dates";
import { saveSignin } from "../../lib/siteSignins";
import { similarCompanies, findWorker, normPerson } from "../../lib/contractorSignin";

const amber = { background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" };

function Warnings({ list }) {
  if (!list || !list.length) return null;
  return (
    <ul data-testid="qr-warnings" style={{ ...amber, listStyle: "none", margin: "8px 0 0", padding: "6px 9px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, lineHeight: 1.45 }}>
      {list.map((w, i) => <li key={i}>⚠ {w}</li>)}
    </ul>
  );
}

/** New companies and workers from QR sign-ins, for an admin to deal with. */
export function SigninReview({ list, contractors, setContractors, dbSaveContractor, onOpenCompany, T, font }) {
  if (!list.length) return null;
  return (
    <div data-testid="qr-review" style={{ ...amber, color: T.white, borderRadius: 16, padding: 18, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: T.white }}>🪪 Older sign-ins not in the register ({list.length})</h3>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>From before sign-ins added contractors to the register themselves. Link each one to the right company and worker, add them, or dismiss.</p>
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
  const ADDED = "Added to the register from this sign-in";
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

/**
 * "Added from QR sign-in – check": what the QR sign-in added to the register.
 *  Company: OK (keep it) · Merge into… (it's really a company already in the register) · Open
 *  Worker at a known company: OK · Same person as… · Open
 */
export function QrAddedReview({ contractors, setContractors, signins, dbSaveContractor, dbDeleteContractor, contractorCerts, onOpenCompany, T, font }) {
  const newCos = contractors.filter(c => c.createdFrom === "qr" && !c.checked);
  const newWorkers = [];
  contractors.forEach(c => { if (c.createdFrom === "qr" && !c.checked) return; (c.workers || []).forEach(w => { if (w.createdFrom === "qr" && !w.checked) newWorkers.push({ c, w }); }); });
  if (!newCos.length && !newWorkers.length) return null;
  const n = newCos.length + newWorkers.length;
  return (
    <div data-testid="qr-added" style={{ ...amber, color: T.white, borderRadius: 16, padding: 18, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: T.white }}>🪪 Added from QR sign-in – check ({n})</h3>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>The reception QR code added these to the register. If one is really a company or person already in the register (a typo, "Ltd" missing), merge it; otherwise tick OK. Then add the company's documents so it can be approved.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {newCos.map(c => <AddedCompanyRow key={c.id} c={c} contractors={contractors} setContractors={setContractors} signins={signins} dbSaveContractor={dbSaveContractor} dbDeleteContractor={dbDeleteContractor} contractorCerts={contractorCerts} onOpenCompany={onOpenCompany} T={T} font={font}/>)}
        {newWorkers.map(({ c, w }) => <AddedWorkerRow key={`${c.id}:${w.id}`} c={c} w={w} setContractors={setContractors} signins={signins} dbSaveContractor={dbSaveContractor} onOpenCompany={onOpenCompany} T={T} font={font}/>)}
      </div>
    </div>
  );
}

const btnStyle = (T, font, primary) => ({ background: primary ? `linear-gradient(135deg,${T.accent},${T.blue})` : T.overlay, color: "#fff", border: primary ? "none" : `1px solid ${T.borderMd}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, minHeight: 34 });
const selStyle = (T, font) => ({ background: T.overlay, border: `1px solid ${T.borderMd}`, borderRadius: 8, padding: "7px 10px", color: T.white, fontFamily: font, fontSize: 12, minHeight: 34, maxWidth: 260 });
const later = (a, b) => [a, b].filter(Boolean).sort().pop();
const earlier = (a, b) => [a, b].filter(Boolean).sort()[0];
/** Two records of one worker → one (the register's details win; dates and counts combine). */
function joinWorker(keep, extra) {
  return { ...keep, phone: keep.phone || extra.phone || "", firstInducted: earlier(keep.firstInducted, extra.firstInducted), lastSignin: later(keep.lastSignin, extra.lastSignin),
    signinCount: (Number(keep.signinCount) || 0) + (Number(extra.signinCount) || 0) };
}
const tidy = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function AddedCompanyRow({ c, contractors, setContractors, signins, dbSaveContractor, dbDeleteContractor, contractorCerts, onOpenCompany, T, font }) {
  const others = contractors.filter(x => x.id !== c.id && !(x.createdFrom === "qr" && !x.checked));
  const sims = [...new Set([...(c.possibleDuplicates || []), ...similarCompanies(others, c.name).map(x => x.id)])].map(id => others.find(x => x.id === id)).filter(Boolean);
  const [pick, setPick] = React.useState(sims[0] ? sims[0].id : "");
  const [busy, setBusy] = React.useState(false);
  const run = async fn => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const ok = () => run(async () => {
    const next = { ...c, checked: true, workers: (c.workers || []).map(w => ({ ...w, checked: true })) };
    setContractors(p => p.map(x => (x.id === c.id ? next : x)));
    await dbSaveContractor(next);
  });
  const merge = () => run(async () => {
    const target = contractors.find(x => x.id === pick); if (!target) return;
    if (Object.keys(contractorCerts || {}).some(k => k.startsWith(`${c.id}_`))) { notify(`${c.name} has worker certificates recorded. Move them by hand first, or tick OK instead.`, { kind: "warn" }); return; }
    if (!(await ask({ title: `Merge into ${target.name}?`, message: `${c.name} is taken out of the register. Its ${(c.workers || []).length} worker(s), documents and sign-ins move to ${target.name}.`, ok: "Merge" }))) return;
    const map = {};
    let workers = [...(target.workers || [])];
    (c.workers || []).forEach(w => {
      const same = workers.find(x => normPerson(x.name) === normPerson(w.name));
      if (same) { map[w.id] = same.id; workers = workers.map(x => (x.id === same.id ? tidy(joinWorker(x, w)) : x)); }
      else { map[w.id] = w.id; workers.push({ ...w, checked: true }); }
    });
    const next = tidy({ ...target, workers, documents: [...(target.documents || []), ...(c.documents || [])], lastOnSite: later(target.lastOnSite, c.lastOnSite),
      signinCount: (Number(target.signinCount) || 0) + (Number(c.signinCount) || 0) || undefined });
    // saved first, then the QR entry removed, then this browser's copy (so nothing reads the
    // register again while the sign-ins still point at a company that's gone)
    const saved = (await dbSaveContractor(next)) || next;
    await dbDeleteContractor(c.id);
    for (const s of (signins || []).filter(s => s.data && s.data.companyId === c.id)) {
      await saveSignin(s, { companyId: target.id, workerId: map[s.data.workerId] || s.data.workerId }, `Moved to ${target.name} (merged)`);   // eslint-disable-line no-await-in-loop
    }
    setContractors(p => p.filter(x => x.id !== c.id).map(x => (x.id === target.id ? saved : x)));
    notify(`${c.name} merged into ${target.name}.`);
  });
  return (
    <div data-testid="qr-added-company" style={{ background: T.overlay, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <b style={{ fontSize: 14 }}>{c.name}</b>
        <span style={{ fontSize: 12, color: T.muted }}>new company{c.createdAt ? `, ${ukDate(c.createdAt)}` : ""} · {(c.workers || []).map(w => w.name).join(", ") || "no workers"}</span>
        {sims.length > 0 && <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>Similar: {sims.map(x => x.name).join(", ")}</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
        <button type="button" data-testid="qr-added-ok" style={btnStyle(T, font, true)} disabled={busy} onClick={ok}>✓ OK, it's a new company</button>
        {others.length > 0 && <>
          <span style={{ fontSize: 12, color: T.muted }}>or it's</span>
          <select aria-label="Company it really is" data-testid="qr-added-pick" value={pick} onChange={e => setPick(e.target.value)} style={selStyle(T, font)}>
            <option value="">Choose a company…</option>
            {sims.length > 0 && <optgroup label="Similar names">{sims.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>}
            <optgroup label="All companies">{[...others].sort((a, b) => a.name.localeCompare(b.name)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
          </select>
          <button type="button" data-testid="qr-added-merge" style={btnStyle(T, font, false)} disabled={busy || !pick} onClick={merge}>Merge</button>
        </>}
        <button type="button" style={{ ...btnStyle(T, font, false), marginLeft: "auto" }} onClick={() => onOpenCompany(c.id)}>Open →</button>
      </div>
    </div>
  );
}

function AddedWorkerRow({ c, w, setContractors, signins, dbSaveContractor, onOpenCompany, T, font }) {
  const others = (c.workers || []).filter(x => x.id !== w.id);
  const [pick, setPick] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const run = async fn => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const save = async next => { setContractors(p => p.map(x => (x.id === c.id ? next : x))); await dbSaveContractor(next, { removedWorkers: next.workers.some(x => x.id === w.id) ? [] : [w.id] }); };
  const ok = () => run(() => save({ ...c, workers: c.workers.map(x => (x.id === w.id ? { ...x, checked: true } : x)) }));
  const same = () => run(async () => {
    const keep = others.find(x => x.id === pick); if (!keep) return;
    await save({ ...c, workers: c.workers.filter(x => x.id !== w.id).map(x => (x.id === keep.id ? tidy(joinWorker(x, w)) : x)) });
    for (const s of (signins || []).filter(s => s.data && s.data.companyId === c.id && s.data.workerId === w.id)) {
      await saveSignin(s, { workerId: keep.id }, `Linked to ${keep.name} (same person)`);   // eslint-disable-line no-await-in-loop
    }
  });
  return (
    <div data-testid="qr-added-worker" style={{ background: T.overlay, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <b style={{ fontSize: 14 }}>{w.name}</b>
        <span style={{ fontSize: 12, color: T.muted }}>new worker at {c.name}{w.createdAt ? `, ${ukDate(w.createdAt)}` : ""}{w.phone ? ` · 📞 ${w.phone}` : ""}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
        <button type="button" data-testid="qr-added-worker-ok" style={btnStyle(T, font, true)} disabled={busy} onClick={ok}>✓ OK</button>
        {others.length > 0 && <>
          <span style={{ fontSize: 12, color: T.muted }}>or the same person as</span>
          <select aria-label="Worker it really is" data-testid="qr-added-worker-pick" value={pick} onChange={e => setPick(e.target.value)} style={selStyle(T, font)}>
            <option value="">Choose…</option>
            {others.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button type="button" data-testid="qr-added-worker-same" style={btnStyle(T, font, false)} disabled={busy || !pick} onClick={same}>Same person</button>
        </>}
        <button type="button" style={{ ...btnStyle(T, font, false), marginLeft: "auto" }} onClick={() => onOpenCompany(c.id)}>Open →</button>
      </div>
    </div>
  );
}
