/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/contractorApproval.js — is a contractor company approved, who is on site, and
 * what should reception and H&S know about a sign-in. Pure: no React, no database.
 * Shared by the portal, the sign-in function (netlify/functions/zp-signin.mjs) and the
 * email job (netlify/shared/emailJob.mjs), so they always agree.
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPANY DOCUMENTS  contractors.data.documents
 *   [{ id, type: COMPANY_DOC_TYPES id, title?, fileName, fileUrl, date (expiry or review
 *      date, "YYYY-MM-DD" or ""), uploadedAt, uploadedBy, note }]
 *   Several of one type may be kept (old insurance certificates stay as a record); the
 *   CURRENT one of a type is the one with the latest date (or uploaded last, if undated).
 *
 * APPROVAL  approvalOf(company, { required, today })
 *   Banned / Inactive (set by hand on the company) always win. Otherwise the company is
 *   approved when every required document (Site Settings → Contractor sign-in; insurance
 *   and RAMS to start with) is on file and in date. Nothing blocks a sign-in: an
 *   unapproved company is flagged to reception and H&S.
 *     key: approved | expiring (approved, something due within 30 days) | missing |
 *          expired | banned | inactive
 *
 * A SIGN-IN'S ISSUES  signinIssues({ signin, company, worker, certs, permits, required, today })
 *   What reception and H&S should know, worked out from the register NOW (so uploading the
 *   insurance or issuing the permit clears the warning straight away):
 *     [{ text, level: "red" | "amber", kind: "approval" | "permit" | "cert" | "new" }]
 *   seeReception(issues): the contractor's phone says "please see reception first" only for
 *   a banned / inactive company or a permit that's needed and not issued. Missing
 *   paperwork is for H&S to chase, not something to stop a contractor at the door for.
 *
 * ON SITE  onSiteList({ signins, contractors, visits, today, now })
 *   Everyone signed in and not out: QR sign-ins and visits logged by hand.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { COMPANY_DOC_TYPES, DEFAULT_REQUIRED_DOCS, CONTRACTOR_CERT_TYPES } from "../data/seedContractors.js";
import { normCompany } from "./contractorSignin.js";

export const DOC_SOON_DAYS = 30;
export { hasReceptionAccess } from "./contractorSignin.js";
const okDate = d => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : "");
const ukd = d => (okDate(d) ? okDate(d).split("-").reverse().join("/") : "");
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const docType = id => COMPANY_DOC_TYPES.find(t => t.id === id) || { id, label: "Document", short: "Document", date: "expiry" };
/** Which documents are needed for approval (valid ids only; the default list if none given). */
export function requiredDocs(list) {
  const ids = (Array.isArray(list) ? list : DEFAULT_REQUIRED_DOCS).filter(id => COMPANY_DOC_TYPES.some(t => t.id === id && id !== "other"));
  return Array.isArray(list) ? [...new Set(ids)] : [...DEFAULT_REQUIRED_DOCS];
}

/** The current document of each type: { pl: doc, … }. */
export function currentDocs(company) {
  const out = {};
  ((company && company.documents) || []).forEach(d => {
    if (!d || !d.type) return;
    const cur = out[d.type];
    const later = !cur || (okDate(d.date) || "") > (okDate(cur.date) || "") || ((okDate(d.date) || "") === (okDate(cur.date) || "") && String(d.uploadedAt || "") > String(cur.uploadedAt || ""));
    if (later) out[d.type] = d;
  });
  return out;
}

/** One document's state: { key: "ok" | "soon" | "expired" | "undated" | "missing", days, text } */
export function docState(doc, typeId, today) {
  const t = docType(typeId);
  if (!doc) return { key: "missing", days: null, text: `No ${/^[A-Z]{2}/.test(t.short) ? t.short : t.short.toLowerCase()} on file` };
  const d = okDate(doc.date);
  if (!d) return { key: "undated", days: null, text: t.date === "review" ? "On file (no review date)" : "On file (no expiry date)" };
  const n = daysBetween(today, d);
  if (n < 0) return { key: "expired", days: n, text: `${t.date === "review" ? "Review was due" : "Expired"} ${ukd(d)}` };
  if (n <= DOC_SOON_DAYS) return { key: "soon", days: n, text: `${t.date === "review" ? "Review due" : "Expires"} ${ukd(d)} (${n} day${n === 1 ? "" : "s"})` };
  return { key: "ok", days: n, text: `${t.date === "review" ? "Review due" : "Valid until"} ${ukd(d)}` };
}

const LABEL = { approved: "Approved", expiring: "Approved · renewal due", missing: "Documents missing", expired: "Documents expired", banned: "Banned", inactive: "Inactive" };
const TONE = { approved: "green", expiring: "amber", missing: "amber", expired: "red", banned: "red", inactive: "grey" };

/**
 * → { key, label, tone, issues:[text], docs:[{ type, label, required, doc, state }] }
 */
export function approvalOf(company, { required = DEFAULT_REQUIRED_DOCS, today } = {}) {
  const req = requiredDocs(required);
  const cur = currentDocs(company);
  const docs = COMPANY_DOC_TYPES.filter(t => t.id !== "other").map(t => ({ type: t.id, label: t.label, short: t.short, required: req.includes(t.id), doc: cur[t.id] || null, state: docState(cur[t.id], t.id, today) }));
  const status = company && company.status;
  let key, issues = [];
  if (status === "banned") { key = "banned"; issues = ["Company is marked Banned in the Contractor Register"]; }
  else if (status === "inactive") { key = "inactive"; issues = ["Company is marked Inactive in the Contractor Register"]; }
  else {
    const need = docs.filter(d => d.required);
    const expired = need.filter(d => d.state.key === "expired"), missing = need.filter(d => d.state.key === "missing"), soon = need.filter(d => d.state.key === "soon");
    issues = [...expired.map(d => `${d.short}: ${d.state.text.toLowerCase()}`), ...missing.map(d => d.state.text)];
    key = expired.length ? "expired" : missing.length ? "missing" : soon.length ? "expiring" : "approved";
    if (key === "expiring") issues = soon.map(d => `${d.short}: ${d.state.text.toLowerCase()}`);
  }
  return { key, label: LABEL[key], tone: TONE[key], issues, docs, approved: key === "approved" || key === "expiring" };
}

/** Permits to work for this company covering today: { active: [permit], draft: [permit] }. */
export function permitsFor({ company, companyName, permits, today }) {
  const n = normCompany(companyName || (company && company.name));
  const mine = (permits || []).filter(p => p && ((company && String(p.contractor) === String(company.id)) || (n && normCompany(p.contractor) === n)));
  const covers = p => { const s = okDate(p.startDateTime), e = okDate(p.endDateTime) || s; return !!s && s <= today && today <= e; };
  return { active: mine.filter(p => p.status === "active" && covers(p)), draft: mine.filter(p => p.status === "draft" && covers(p)) };
}

/** What reception and H&S should know about one sign-in (see the header). */
export function signinIssues({ signin, company, worker, certs, permits, required, today }) {
  const out = [];
  const d = signin || {};
  const name = (company && company.name) || d.companyName || "this company";
  if (!company || (company.createdFrom === "qr" && !company.checked)) out.push({ text: "New company: added by the QR sign-in, not checked by H&S yet", level: "amber", kind: "new" });
  if (company) {
    const a = approvalOf(company, { required, today });
    if (a.key === "banned" || a.key === "inactive") out.push({ text: a.issues[0], level: "red", kind: "approval" });
    else if (!a.approved) a.issues.forEach(t => out.push({ text: t, level: a.key === "expired" ? "red" : "amber", kind: "approval" }));
  }
  if (d.permit === "yes" || d.permit === "unsure") {
    const p = permitsFor({ company, companyName: d.companyName, permits, today });
    if (!p.active.length) {
      if (p.draft.length) out.push({ text: `The permit to work for ${name} is still a draft (not active)`, level: "red", kind: "permit" });
      else if (d.permit === "yes") out.push({ text: `Needs a permit to work: none issued for ${name} today`, level: "red", kind: "permit" });
      else out.push({ text: `Not sure if a permit is needed, and none is issued for ${name} today: check before work starts`, level: "amber", kind: "permit" });
    }
  }
  if (company && worker && certs) {
    Object.entries(certs[`${company.id}_${worker.id}`] || {}).forEach(([k, c]) => {
      const e = c && okDate(c.expiryDate);
      if (e && e < today) out.push({ text: `${(CONTRACTOR_CERT_TYPES.find(x => x.id === k) || {}).label || "Certificate"} expired ${ukd(e)}`, level: "amber", kind: "cert" });
    });
  }
  return out;
}
/** What to know NOW about one person in onSiteList(), from the register as it is now. */
export function liveIssues(p, { contractors, contractorCerts, permits, settings, today }) {
  const company = (contractors || []).find(c => String(c.id) === String(p.companyId)) || null;
  const worker = company && (company.workers || []).find(w => String(w.id) === String(p.workerId));
  const signin = p.row ? p.row.data : { companyName: p.companyName, permit: p.permit };
  const list = signinIssues({ signin, company, worker, certs: contractorCerts, permits, required: (settings || {}).requiredDocs, today });
  // a company not in this browser's copy of the register (an old sign-in never linked to it, or one
  // just added by a sign-in and not loaded yet): say nothing about approval
  return company || !p.row ? list : list.filter(i => i.kind !== "approval");
}
export const seeReception = issues => (issues || []).some(i => i.level === "red" && (i.kind === "permit" || /Banned|Inactive/.test(i.text)));

/**
 * Save a company without losing what someone else added meanwhile (a worker added by a QR
 * sign-in, a document uploaded in another browser): workers and documents in the stored copy
 * that this copy doesn't have are kept, unless this browser removed them. For a worker in
 * both, this copy's details win but the sign-in dates are the earliest / latest of the two.
 */
export function mergeCompany(local, stored, { removedWorkers = [], removedDocs = [] } = {}) {
  if (!stored) return local;
  const rw = new Set(removedWorkers.map(String)), rd = new Set(removedDocs.map(String));
  const lw = local.workers || [], sw = stored.workers || [];
  const workers = [
    ...lw.map(w => {
      const s = sw.find(x => String(x.id) === String(w.id)); if (!s) return w;
      const first = [w.firstInducted, s.firstInducted].filter(Boolean).sort()[0];
      const last = [w.lastSignin, s.lastSignin].filter(Boolean).sort().pop();
      const n = Math.max(Number(w.signinCount) || 0, Number(s.signinCount) || 0);
      return { ...s, ...w, ...(first ? { firstInducted: first } : {}), ...(last ? { lastSignin: last } : {}), ...(n ? { signinCount: n } : {}) };
    }),
    ...sw.filter(s => !rw.has(String(s.id)) && !lw.some(w => String(w.id) === String(s.id))),
  ];
  const ld = local.documents || [], sd = stored.documents || [];
  const documents = [...ld, ...sd.filter(s => !rd.has(String(s.id)) && !ld.some(d => String(d.id) === String(s.id)))];
  const later = (a, b) => [a, b].filter(Boolean).sort().pop();
  const out = { ...local, workers, ...(documents.length || local.documents ? { documents } : {}) };
  const lastOnSite = later(local.lastOnSite, stored.lastOnSite);
  if (lastOnSite) out.lastOnSite = lastOnSite;
  const n = Math.max(Number(local.signinCount) || 0, Number(stored.signinCount) || 0);
  if (n) out.signinCount = n;
  return out;
}

/**
 * A QR sign-in keeps the register up to date (netlify/functions/zp-signin.mjs):
 *   - a company not in the register is added, marked createdFrom "qr" (Contractors shows it
 *     under "Added from QR sign-in" for H&S to check, merge or delete); possibleDuplicates
 *     lists register companies with a similar name;
 *   - a worker not in the company is added (checked:false, so a new worker at a known company
 *     shows for checking too; workers of a new company are checked along with the company);
 *   - the worker's firstInducted (the QR checklist is the site induction) and lastSignin,
 *     and the company's lastOnSite and signinCount, are updated.
 * → { company, worker } (new objects; nothing passed in is changed)
 */
export function recordSignin({ company, worker, signin, date, similar = [], rnd = "" }) {
  const stamp = `${Date.now().toString(36)}${rnd}`;
  const c = company ? { ...company, workers: [...(company.workers || [])] } : {
    id: `con_qr_${stamp}`, name: signin.companyName, type: "Contractor", status: "active", email: "", phone: "",
    notes: "", workers: [], createdFrom: "qr", createdAt: date, checked: false, ...(similar.length ? { possibleDuplicates: similar } : {}),
  };
  let w = worker ? c.workers.find(x => String(x.id) === String(worker.id)) : null;
  if (!w) {
    w = { id: `w_qr_${stamp}`, name: signin.workerName, role: "", email: "", phone: signin.phone || "", createdFrom: "qr", createdAt: date, checked: !company };
    c.workers.push(w);
  }
  const i = c.workers.indexOf(w);
  const nw = { ...w, firstInducted: w.firstInducted && w.firstInducted <= date ? w.firstInducted : date, lastSignin: date, signinCount: (Number(w.signinCount) || 0) + 1 };
  if (!nw.phone && signin.phone) nw.phone = signin.phone;
  c.workers[i] = nw;
  c.lastOnSite = date; c.signinCount = (Number(c.signinCount) || 0) + 1;
  return { company: c, worker: nw };
}

/** HH:MM now in the UK (for "still on site" and the roll call). */
const hhmm = t => (/^\d{2}:\d{2}/.test(String(t || "")) ? String(t).slice(0, 5) : "");

/**
 * Everyone on site now: [{ key, source: "qr"|"visit", name, companyName, companyId, phone, host,
 *   areas, purpose, timeIn, row (sign-in), visit, permit }]  newest arrival first.
 * now = "HH:MM": a visit logged by hand with a time out that has passed counts as gone.
 */
export function onSiteList({ signins = [], contractors = [], visits = {}, today, now = "23:59" }) {
  const out = [];
  (signins || []).forEach(s => {
    const d = (s && s.data) || {};
    if (d.date !== today || d.timeOut) return;
    out.push({ key: `qr:${s.id}`, source: "qr", name: d.workerName || "", companyName: d.companyName || "", companyId: d.companyId || "", workerId: d.workerId || "",
      phone: d.phone || "", host: d.host || "", areas: d.areas || "", purpose: d.purpose || "", timeIn: hhmm(d.timeIn), permit: d.permit || "", row: s });
  });
  (contractors || []).forEach(c => ((visits || {})[c.id] || []).forEach(v => {
    if (!v || v.date !== today || (v.timeOut && hhmm(v.timeOut) <= now)) return;
    const people = (v.workers || []).map(id => (c.workers || []).find(w => w.id === id)).filter(Boolean);
    (people.length ? people : [null]).forEach(w => out.push({ key: `v:${c.id}:${v.id}:${w ? w.id : "-"}`, source: "visit", name: w ? w.name : "(not named)", companyName: c.name, companyId: c.id,
      workerId: w ? w.id : "", phone: (w && w.phone) || c.phone || "", host: v.signedInBy || "", areas: v.areas || "", purpose: v.purpose || "", timeIn: hhmm(v.timeIn), permit: v.permitRequired ? "yes" : "", visit: v }));
  }));
  return out.sort((a, b) => String(b.timeIn).localeCompare(String(a.timeIn)));
}

/** Is it past the end-of-day check time? ("" = the check is off) */
export const pastCheckTime = (checkTime, now) => !!hhmm(checkTime) && hhmm(now) >= hhmm(checkTime);

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** The fire roll call: a printable page of everyone on site, by company, with a tick column. */
export function rollCallHtml({ list = [], site = "", date = "", time = "", product = "", company = "" } = {}) {
  const groups = {};
  list.forEach(p => { const k = p.companyName || "Unknown company"; (groups[k] = groups[k] || []).push(p); });
  const rows = Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(k => `<tr class="co"><td colspan="6">${esc(k)} <span>(${groups[k].length})</span></td></tr>` +
    groups[k].sort((a, b) => a.name.localeCompare(b.name)).map(p => `<tr><td class="box"></td><td><b>${esc(p.name)}</b></td><td>${esc(p.phone)}</td><td>${esc(p.host)}</td><td>${esc(p.areas)}</td><td>${esc(p.timeIn)}</td></tr>`).join("")).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Fire roll call ${esc(date)} ${esc(time)}</title>
<style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:12px;margin:0}.wrap{padding:16px}h1{font-size:22px;margin:0 0 2px}
.sub{color:#444;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#111;color:#fff;text-align:left;padding:6px}td{border-bottom:1px solid #bbb;padding:7px 6px;vertical-align:top}
td.box{width:22px}td.box::before{content:"";display:inline-block;width:14px;height:14px;border:2px solid #111;border-radius:2px}tr.co td{background:#eee;font-weight:700;font-size:13px;border-bottom:1px solid #888}tr.co span{font-weight:400;color:#444}
.note{margin-top:12px;color:#444;font-size:11px}.toolbar{background:#111;color:#fff;padding:8px;text-align:center}.toolbar button{padding:6px 14px;font-weight:700}@media print{.toolbar{display:none}}</style></head><body>
<div class="toolbar">Print this, or read it out at the assembly point. <button onclick="window.print()">Print</button></div>
<div class="wrap"><h1>Fire roll call: contractors on site</h1>
<div class="sub"><b>${list.length}</b> ${list.length === 1 ? "person" : "people"} signed in at ${esc(time)} on ${esc(ukd(date))}${site ? ` · ${esc(site)}` : ""}${company ? ` · ${esc(company)}` : ""}</div>
<table><tr><th></th><th>Name</th><th>Phone</th><th>Here to see</th><th>Working in</th><th>In</th></tr>${rows || `<tr><td colspan="6">Nobody is signed in.</td></tr>`}</table>
<p class="note">From the contractor sign-in (reception QR code and visits logged in ${esc(product || "the portal")}). Staff and visitors not signed in this way aren't on this list.</p></div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)});</script></body></html>`;
}
