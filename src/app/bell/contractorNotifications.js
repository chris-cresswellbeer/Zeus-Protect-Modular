/**
 * app/bell/contractorNotifications.js — the contractor items in the notification bell
 *
 * Pure: data in, bell items out (same shape as adminNotifications). Tested in tests/portal/belllib.mjs.
 *   reception = true: only what reception needs (still signed in after the end-of-day check);
 *   nav { tab: "reception" } then, on the staff side.
 * Admin items:
 *   • still signed in after the end-of-day check time (Site Settings → Contractor sign-in)
 *   • on site now with something to check (company not approved, permit to work not issued…)
 *   • companies the QR sign-in added (or workers), not checked yet
 *   • company documents expired / expiring within 30 days (only for companies that aren't
 *     banned / inactive); a company with documents MISSING isn't listed here (it shows on the
 *     register and on the On Site board when they come in)
 *   • workers' certificates expired
 */
import { onSiteList, pastCheckTime, approvalOf, liveIssues } from "../../lib/contractorApproval";

export function contractorNotifications({ contractors = [], contractorCerts = {}, contractorVisits = {}, siteSignins = [], permits = [], settings, today, now, reception = false }) {
  const out = [];
  const nav = { tab: reception ? "reception" : "contractors" };
  const s = settings || {};
  const list = onSiteList({ signins: siteSignins, contractors, visits: contractorVisits, today, now });
  const names = l => l.map(p => p.name).slice(0, 4).join(", ") + (l.length > 4 ? ` +${l.length - 4} more` : "");
  if (pastCheckTime(s.onsiteCheckTime, now) && list.length)
    out.push({ type: "staff", urgent: true, title: `${list.length} contractor${list.length !== 1 ? "s" : ""} still signed in after ${s.onsiteCheckTime}`, detail: `${names(list)}: check they've left, then sign them out`, nav });
  if (reception) return out;

  const ctx = { contractors, contractorCerts, permits, settings: s, today };
  const flagged = list.map(p => ({ p, issues: liveIssues(p, ctx).filter(i => i.kind !== "cert") })).filter(x => x.issues.length);
  if (flagged.length) {
    const red = flagged.some(x => x.issues.some(i => i.level === "red"));
    out.push({ type: "staff", urgent: red, title: `${flagged.length} contractor${flagged.length !== 1 ? "s" : ""} on site with something to check`,
      detail: flagged.slice(0, 3).map(x => `${x.p.name} (${x.p.companyName}): ${x.issues[0].text}`).join(" · ") + (flagged.length > 3 ? ` +${flagged.length - 3} more` : ""), nav });
  }
  const newCos = contractors.filter(c => c.createdFrom === "qr" && !c.checked);
  const newWorkers = contractors.filter(c => !(c.createdFrom === "qr" && !c.checked)).reduce((n, c) => n + (c.workers || []).filter(w => w.createdFrom === "qr" && !w.checked).length, 0);
  if (newCos.length || newWorkers) {
    const parts = [newCos.length ? `${newCos.length} compan${newCos.length !== 1 ? "ies" : "y"}` : "", newWorkers ? `${newWorkers} worker${newWorkers !== 1 ? "s" : ""}` : ""].filter(Boolean);
    out.push({ type: "document", urgent: false, title: `${parts.join(" and ")} added by the QR sign-in to check`, detail: newCos.map(c => c.name).slice(0, 4).join(", ") || "Contractors → Added from QR sign-in", nav });
  }
  const live = contractors.filter(c => c.status !== "banned" && c.status !== "inactive");
  const docIssue = key => live.filter(c => approvalOf(c, { required: s.requiredDocs, today }).docs.some(d => d.required && d.state.key === key));
  const expired = docIssue("expired"), soon = docIssue("soon");
  if (expired.length) out.push({ type: "document", urgent: true, title: `${expired.length} contractor${expired.length !== 1 ? "s" : ""} with expired insurance or RAMS`, detail: expired.map(c => c.name).slice(0, 4).join(", "), nav });
  if (soon.length) out.push({ type: "document", urgent: false, title: `${soon.length} contractor${soon.length !== 1 ? "s" : ""} with documents due for renewal`, detail: soon.map(c => c.name).slice(0, 4).join(", "), nav });
  const expiredCerts = contractors.filter(c => (c.workers || []).some(w => Object.values(contractorCerts[`${c.id}_${w.id}`] || {}).some(x => x && x.expiryDate && x.expiryDate < today)));
  if (expiredCerts.length) out.push({ type: "document", urgent: true, title: `${expiredCerts.length} contractor${expiredCerts.length !== 1 ? "s" : ""} with expired worker certificates`, detail: expiredCerts.map(c => c.name).slice(0, 4).join(", "), nav });
  return out;
}
