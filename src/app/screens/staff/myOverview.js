/**
 * app/screens/staff/myOverview.js — the signed-in person's own figures, worked out from the app's
 * state: their modules and what's done, expired, expiring and due; their DSE assessment; external
 * certificates; documents to read; quick reports to finish; their overall compliance.
 * Used by the staff portal and its tabs:
 *   const app = useApp(); const { myMods, pastDue } = myOverview(app);
 */
import { DSE_RENEWAL_MONTHS } from "../../../data/seedDse";
import { EXT_CERT_TYPES } from "../../../data/seedExtCerts";
import { myIncompleteQuickReports } from "../../../domains/incidents/quickReportStatus";
import { isPassed } from "../../../domains/training/completion";
import { complianceBand, personalCompliance } from "../../../domains/training/compliance";
import { EXPIRY_WARNING_DAYS, getExpiryStatus } from "../../../lib/dates";
import { dueInfo } from "../../../lib/dueDates";

export function myOverview(app) {
  const {
    adminResponses, allModules, assigns, comps, docAcknowledgements, docAssignments, dseReports, dueDates,
    extCerts, incidents, setQuickEditId, setStab, user
  } = app;
  const myIds = assigns[String(user.id)]||[];
  const myMods = allModules.filter(m=>myIds.includes(m.id));
  const myC = comps[user.id]||{};
  const done = myMods.filter(m=>myC[m.id]);
  const pct = myMods.length ? Math.round(done.length/myMods.length*100) : 0;

  // ── Training breakdown ──────────────────────────────────────────────────
  const notStarted  = myMods.filter(m=>!myC[m.id]);
  const completed   = myMods.filter(m=>myC[m.id]);
  const expired     = completed.filter(m=>{ if(!m.renewalMonths) return false; const ex=getExpiryStatus(myC[m.id].date,m.renewalMonths); return ex?.status==="expired"; });
  const expiring    = completed.filter(m=>{ if(!m.renewalMonths) return false; const ex=getExpiryStatus(myC[m.id].date,m.renewalMonths); return ex?.status==="expiring"; });
  const upToDate    = completed.filter(m=>{ if(!m.renewalMonths) return true; const ex=getExpiryStatus(myC[m.id].date,m.renewalMonths); return !ex||ex.status==="valid"; });
  // Due dates (lib/dueDates.js): overdue and due-within-a-week, for modules not passed yet
  const myDue = m => dueInfo(dueDates, user.id, m.id, isPassed(myC[m.id]));
  const pastDue = myMods.filter(m => (myDue(m)||{}).overdue);
  const dueSoon = myMods.filter(m => { const d = myDue(m); return d && !d.overdue && d.soon; });
  // Modules needing attention (not started + expired)
  const actionNeeded = [...notStarted, ...expired];
  // Next up = the not-started module due soonest (then any not started), else the soonest expiring
  const byDue = (a, b) => ((myDue(a)||{}).due || "9999").localeCompare((myDue(b)||{}).due || "9999");
  const nextUp = notStarted.length ? [...notStarted].sort(byDue)[0] : expiring.length ? expiring[0] : null;

  // ── DSE tracking ────────────────────────────────────────────────────────
  const myDseReports   = dseReports[user.id]||[];
  const lastDseReport  = myDseReports[myDseReports.length-1];
  const lastDseRi      = myDseReports.length-1;
  const myAdminResps   = adminResponses[user.id]||{};
  const dseCompleted   = !!lastDseReport;
  // DSE renewal — recommended annually (data/seedDse.js)
  const dseExpiryStatus = dseCompleted ? getExpiryStatus(lastDseReport.date, DSE_RENEWAL_MONTHS) : null;
  const dseExpired  = dseExpiryStatus?.status==="expired";
  const dseExpiring = dseExpiryStatus?.status==="expiring";
  const dseIssueCount   = lastDseReport?.issueCount||0;
  const dseResolvedCount = lastDseReport ? lastDseReport.issues.filter((_,ii)=>myAdminResps[`${lastDseRi}_${ii}`]?.resolved).length : 0;
  const dseNeedsAction  = !dseCompleted || dseExpired;
  // External certs
  const myExtCerts = extCerts[user.id]||{};
  const myCertTypes = EXT_CERT_TYPES.filter(ct=>myExtCerts[ct.id]);
  const expiredCerts  = myCertTypes.filter(ct=>{ const c=myExtCerts[ct.id]; return c.expiryDate && new Date(c.expiryDate)<new Date(); });
  const expiringCerts = myCertTypes.filter(ct=>{ const c=myExtCerts[ct.id]; if(!c.expiryDate) return false; const d=Math.ceil((new Date(c.expiryDate)-new Date())/86400000); return d>=0&&d<=EXPIRY_WARNING_DAYS; });
  // Documents needing acknowledgement
  const myDocAssigns = Object.entries(docAssignments||{}).filter(([,uids])=>uids.includes(String(user.id))).map(([did])=>did);
  const unreadDocs = myDocAssigns.filter(did=>!(docAcknowledgements[String(user.id)]||{})[did]);
  // Quick hazard reports this user still has to complete in the full form
  const myQuickToComplete = myIncompleteQuickReports(incidents, user.id);
  const openQuickReport = (inc) => { setStab("incidents"); setQuickEditId(inc.id); };
  // Compliance % = in-date items / all items (assigned modules + uploaded ext. certs + 1 for DSE).
  // Bands: 100% green, ≥70% amber, otherwise red.
  // (domains/training/compliance.js — the same rules as the phone, My Team, the matrix and reports)
  const myCompliance = personalCompliance({ mods: myMods, comps: myC, certs: Object.fromEntries(myCertTypes.map(ct => [ct.id, myExtCerts[ct.id]])),
    lastDse: lastDseReport || null, dseRenewalMonths: DSE_RENEWAL_MONTHS });
  const healthPct  = myCompliance.pct;
  const { color: healthColor, label: healthLabel } = complianceBand(healthPct);
  const totalActionNeeded = actionNeeded.length + (dseNeedsAction?1:0);

  return {
    myIds, myMods, myC, done, pct, notStarted, completed, expired, expiring, upToDate, myDue, pastDue,
    dueSoon, actionNeeded, byDue, nextUp, myDseReports, lastDseReport, lastDseRi, myAdminResps, dseCompleted,
    dseExpiryStatus, dseExpired, dseExpiring, dseIssueCount, dseResolvedCount, dseNeedsAction, myExtCerts,
    myCertTypes, expiredCerts, expiringCerts, myDocAssigns, unreadDocs, myQuickToComplete, openQuickReport,
    myCompliance, healthPct, healthColor, healthLabel, totalActionNeeded
  };
}
