/**
 * app/bell/adminNotifications.js — what the admin's notification bell lists
 *
 * Pure: give it the app's data, get the list for the notification bell (shared/NotificationBell.jsx).
 * Each item: { type: "module"|"document"|"dse"|"report"|"staff", urgent, title, detail, nav }.
 * nav says where clicking it goes (the portal handles it). Tested in tests/portal/belllib.mjs.
 *
 * Admin notification list (same shape as the staff one; nav.tab = admin tab key).
 * Thresholds used: training/certificates expiring ≤EXPIRY_WARNING_DAYS (lib/dates.js), RA/doc review ≤30d, drill >365d,
 * fire warden cert default 36 months.
 */
import { compsFor, isWarehouseWorker, machineState } from "../../data/seedMachinery";
import { BACKUP_DUE_DAYS } from "../../domains/audit/BackupPanel";
import { fireSummary, todayLocal as fireToday } from "../../domains/fireSafety/fireLogic";
import { isIncompleteQuickReport, isQuickReportOverdue } from "../../domains/incidents/quickReportStatus";
import { riddorDue, riddorDueText, riddorUrgent } from "../../domains/incidents/riddor";
import { isPassed } from "../../domains/training/completion";
import { EXPIRY_WARNING_DAYS, getExpiryStatus, localISO, todayISO } from "../../lib/dates";
import { overdueByPerson } from "../../lib/dueDates";
import { LONE_ALARM } from "../../lib/loneWorking";
import { ppeState } from "../../lib/ppe";
import { signinsToReview } from "../../lib/siteSignins";
import { rackingNotifications } from "./rackingNotifications";

export function adminNotifications({
  adminResponses, allMachineTypes, allModules, assigns, comps, contractorCerts, contractors,
  docAcknowledgements, docAssignments, docs, dseReports, dueDates, extCerts, fireSafety, incidents,
  lastBackup, loneSessions, machineComps, ppeRows, ppeSettings, quizFailures, racking, rackInspector,
  ras, siteInspections, siteSignins, staff
}) {
  const notifications = [];
  // Full backup reminder (Audit Trail → Download full backup)
  if (lastBackup !== undefined && (lastBackup === null || (Date.now() - new Date(lastBackup).getTime()) / 86400000 >= BACKUP_DUE_DAYS))
    notifications.push({type:"report",urgent:false,title:lastBackup?"A full backup is due":"Download a first full backup",detail:lastBackup?`Last one ${Math.floor((Date.now()-new Date(lastBackup).getTime())/86400000)} days ago — ⚙ → Audit Trail & backup`:"Keeps a copy of every record — ⚙ → Audit Trail & backup",nav:{tab:"audit"}});
  // Staff with overdue mandatory modules
  const overdueStaff = staff.filter(u=>{
    const mandatory = allModules.filter(m=>m.level==="Mandatory"&&(assigns[u.id]||[]).includes(m.id));
    return mandatory.some(m=>!(comps[u.id]||{})[m.id]);
  });
  if(overdueStaff.length) notifications.push({type:"module",urgent:true,title:`${overdueStaff.length} staff with overdue mandatory training`,detail:overdueStaff.map(u=>u.name.split(" ")[0]).slice(0,4).join(", ")+(overdueStaff.length>4?` +${overdueStaff.length-4} more`:"...tap to view"),nav:{tab:"reports"}});
  // Training past its due date (lib/dueDates.js)
  const pastDueBy = overdueByPerson(assigns, dueDates, (uid, mid) => isPassed((comps[uid]||{})[mid]));
  const pastDuePeople = staff.filter(u=>(u.status||"active")!=="leaver" && pastDueBy[String(u.id)]);
  if(pastDuePeople.length) { const n = pastDuePeople.reduce((t,u)=>t+pastDueBy[String(u.id)],0);
    notifications.push({type:"module",urgent:true,title:`${n} training assignment${n!==1?"s":""} past the due date`,detail:`${pastDuePeople.length} ${pastDuePeople.length!==1?"people":"person"}: ${pastDuePeople.map(u=>u.name.split(" ")[0]).slice(0,4).join(", ")}${pastDuePeople.length>4?` +${pastDuePeople.length-4} more`:""}`,nav:{tab:"users",staffProgress:"pastdue"}}); }
  // Machinery competences expired / expiring (data/seedMachinery.js machineState)
  { let ex = 0, soon = 0; const who = new Set();
    staff.filter(u=>(u.status||"active")!=="leaver"&&u.role!=="admin"&&isWarehouseWorker(u)).forEach(u=>compsFor(machineComps,u.id).forEach(c=>{
      if (!allMachineTypes.some(t=>t.id===c.machineId)) return;
      const k = machineState(c, allMachineTypes).key; if (k==="expired") { ex++; who.add(u.name.split(" ")[0]); } else if (k==="expiring") { soon++; who.add(u.name.split(" ")[0]); } }));
    if (ex || soon) notifications.push({type:"report",urgent:ex>0,title:ex?`${ex} machinery competence${ex!==1?"s":""} need${ex===1?"s":""} renewing${soon?` (+${soon} due within 60 days)`:""}`:`${soon} machinery competence${soon!==1?"s":""} due for renewal within 60 days`,
      detail:[...who].slice(0,4).join(", ")+(who.size>4?` +${who.size-4} more`:""),nav:{tab:"machinery",preset:{tab:"machinery",show:"attention"}}}); }
  // Unread required documents
  const unreadDoc = staff.filter(u=>docs.some(d=>(docAssignments[String(d.id)]||[]).includes(String(u.id))&&!(docAcknowledgements[u.id]||{})[d.id]));
  if(unreadDoc.length) notifications.push({type:"document",urgent:false,title:`${unreadDoc.length} staff with unread required documents`,detail:"Check Documents tab for details",nav:{tab:"reports"}});
  // DSE assessments not submitted
  const noDse = staff.filter(u=>!(dseReports[u.id]||[]).length);
  if(noDse.length) notifications.push({type:"dse",urgent:false,title:`${noDse.length} staff yet to complete DSE assessment`,detail:noDse.map(u=>u.name.split(" ")[0]).slice(0,4).join(", ")+(noDse.length>4?` +${noDse.length-4} more`:""),nav:{tab:"reports"}});
  // DSE issues awaiting admin response
  const awaitingResp = staff.filter(u=>{
    const reports=dseReports[u.id]||[]; if(!reports.length) return false;
    const ri=reports.length-1; const latest=reports[ri];
    if(!latest.issues||!latest.issueCount) return false;
    return latest.issues.some((_,ii)=>!(adminResponses[u.id]||{})[`${ri}_${ii}`]?.resolved);
  });
  if(awaitingResp.length) notifications.push({type:"report",urgent:false,title:`${awaitingResp.length} DSE report${awaitingResp.length!==1?"s":""} awaiting your response`,detail:"Check Reports → DSE Reports tab",nav:{tab:"reports"}});
  // Staff with no modules assigned
  const noModules = staff.filter(u=>!(assigns[u.id]||[]).length);
  if(noModules.length) notifications.push({type:"staff",urgent:false,title:`${noModules.length} staff member${noModules.length!==1?"s":""} with no modules assigned`,detail:"Visit Assign tab to assign training",nav:{tab:"assign"}});
  // Expired training across all staff
  let expiredCount = 0, expiringCount = 0;
  staff.forEach(u=>{
    const uc = comps[u.id]||{};
    (assigns[u.id]||[]).forEach(mid=>{
      const m = allModules.find(x=>x.id===mid);
      if(m&&uc[mid]&&m.renewalMonths){
        const ex = getExpiryStatus(uc[mid].date, m.renewalMonths);
        if(ex&&ex.status==="expired") expiredCount++;
        else if(ex&&ex.status==="expiring") expiringCount++;
      }
    });
  });
  if(expiredCount>0) notifications.push({type:"module",urgent:true,title:`${expiredCount} expired training certificate${expiredCount!==1?"s":""}`,detail:"Staff need to renew — check Reports tab",nav:{tab:"reports"}});
  else if(expiringCount>0) notifications.push({type:"module",urgent:false,title:`${expiringCount} training certificate${expiringCount!==1?"s":""} expiring within ${EXPIRY_WARNING_DAYS} days`,detail:"Review Reports tab to see who needs to renew",nav:{tab:"reports"}});
  // Open incidents
  const openIncidents = incidents.filter(i=>!i.closed);
  const riddorIncidents = incidents.filter(i=>i.riddor&&!i.closed);
  // Quick hazard reports whose reporter hasn't completed the full form yet
  const pendingQuick = incidents.filter(isIncompleteQuickReport);
  if(pendingQuick.length){ const lateQuick = pendingQuick.filter(i=>isQuickReportOverdue(i)).length;
    notifications.push({type:"report",urgent:lateQuick>0,title:`${pendingQuick.length} quick hazard report${pendingQuick.length!==1?"s":""} awaiting full details`,detail:lateQuick?`${lateQuick} overdue — reporters are reminded until complete`:"Reporters are reminded until they complete the full form",nav:{tab:"incidents"}}); }
  // RIDDOR reports still to be made, with their deadlines (domains/incidents/riddor.js)
  const riddorToReport = riddorIncidents.concat(incidents.filter(i=>i.riddor&&i.closed)).map(i=>({i,d:riddorDue(i)})).filter(x=>x.d)
    .sort((a,b)=>(a.d.dueDate||"0").localeCompare(b.d.dueDate||"0"));
  if(riddorToReport.length){ const late=riddorToReport.filter(x=>x.d.state==="overdue").length, now=riddorToReport.filter(x=>riddorUrgent(x.d)).length;
    notifications.push({type:"report",urgent:now>0,title:`${riddorToReport.length} RIDDOR report${riddorToReport.length!==1?"s":""} to make to HSE${late?` (${late} overdue)`:""}`,
      detail:riddorToReport.slice(0,3).map(x=>`${x.i.location||"Incident"}: ${riddorDueText(x.d)}`).join(" · "),nav:{tab:"incidents",preset:{tab:"incidents",riddor:true}}}); }
  if(riddorIncidents.length && !riddorToReport.length) notifications.push({type:"report",urgent:false,title:`${riddorIncidents.length} open RIDDOR incident${riddorIncidents.length!==1?"s":""} (reported to HSE)`,detail:"Close them once the investigation is done",nav:{tab:"incidents"}});
  else if(!riddorIncidents.length && openIncidents.length) notifications.push({type:"report",urgent:false,title:`${openIncidents.length} open incident${openIncidents.length!==1?"s":""}`,detail:"Check Incidents tab to review and close",nav:{tab:"incidents"}});
  // Quiz failures in last 7 days
  const recentFailures = quizFailures.filter(f=>!f.acknowledged && f.date >= localISO(new Date(Date.now()-7*86400000)));
  if(recentFailures.length) notifications.push({type:"module",urgent:false,title:`${recentFailures.length} quiz failure${recentFailures.length!==1?"s":""} in last 7 days`,detail:"Check Reports → Quiz Failures",nav:{tab:"reports"}});
  // RA review dates
  const today2 = todayISO();
  const overdueRAs = ras.filter(ra2=>ra2.reviewDate&&ra2.reviewDate<today2);
  const soonRAs = ras.filter(ra2=>ra2.reviewDate&&ra2.reviewDate>=today2&&Math.ceil((new Date(ra2.reviewDate)-new Date())/86400000)<=30);
  if(overdueRAs.length) notifications.push({type:"report",urgent:true,title:`${overdueRAs.length} risk assessment${overdueRAs.length!==1?"s":""} overdue for review`,detail:overdueRAs.map(r=>r.title).join(", "),nav:{tab:"ra"}});
  else if(soonRAs.length) notifications.push({type:"report",urgent:false,title:`${soonRAs.length} risk assessment${soonRAs.length!==1?"s":""} due for review soon`,detail:soonRAs.map(r=>r.title).join(", "),nav:{tab:"ra"}});

  // Contractor alerts
  const today3=todayISO();
  const expiredConCerts=(contractors||[]).filter(c=>Object.values(contractorCerts[c.id]||{}).some(cert=>cert.expiryDate&&cert.expiryDate<today3));
  if(expiredConCerts.length) notifications.push({type:"document",urgent:true,title:`${expiredConCerts.length} contractor${expiredConCerts.length!==1?"s":""} with expired certificates`,detail:"Check Contractors tab",nav:{tab:"contractors"}});
  const qrReview=signinsToReview(siteSignins);
  const loneAlarms=(loneSessions||[]).filter(r=>LONE_ALARM.includes(r.status));
  { const cur=(ppeRows||[]).filter(r=>r.status==="issued").map(r=>ppeState(r,undefined,ppeSettings.dueSoonDays));
    const pp=cur.filter(s=>s.problem).length, od=cur.filter(s=>s.overdue).length, un=cur.filter(s=>s.unsigned).length;
    if(pp) notifications.push({type:"report",urgent:true,title:`${pp} PPE problem${pp!==1?"s":""} reported`,detail:"Damaged, lost or not fitting — Site Safety ▼ → PPE Register",nav:{tab:"ppe"}});
    if(od) notifications.push({type:"report",urgent:true,title:`${od} PPE item${od!==1?"s":""} overdue for replacement`,detail:"Site Safety ▼ → PPE Register",nav:{tab:"ppe"}});
    if(un) notifications.push({type:"report",urgent:false,title:`${un} PPE issue${un!==1?"s":""} waiting for a signature`,detail:"They can sign in the phone app (More → My PPE), or use Get signature",nav:{tab:"ppe"}}); }
  if(loneAlarms.length) notifications.push({type:"document",urgent:true,title:`Lone working: ${loneAlarms.length} alert${loneAlarms.length!==1?"s":""} need a response`,detail:loneAlarms.map(r=>(r.data||{}).name).join(", "),nav:{tab:"lone"}});
  notifications.push(...rackingNotifications(racking, rackInspector, {tab:"equipment",preset:{tab:"racking"}}));
  if(qrReview.length) notifications.push({type:"document",urgent:true,title:`${qrReview.length} new contractor${qrReview.length!==1?"s":""} to review`,detail:"Signed in with the reception QR code but not in the Contractor Register",nav:{tab:"contractors"}});

  // Fire safety alerts — same rules as the Fire Safety screen (domains/fireSafety/fireLogic.js)
  const fsum = fireSummary({ fireSafety: fireSafety||{}, extCerts: extCerts||{}, staff, inspections: siteInspections||[], today: fireToday() });
  if(fsum.expiredWardens.length) notifications.push({type:"report",urgent:true,title:`${fsum.expiredWardens.length} fire warden cert${fsum.expiredWardens.length!==1?"s":""} expired`,detail:fsum.expiredWardens.map(w=>w.name).join(", "),nav:{tab:"firesafety"}});
  else if(fsum.expiringWardens.length) notifications.push({type:"report",urgent:false,title:`${fsum.expiringWardens.length} fire warden cert${fsum.expiringWardens.length!==1?"s":""} expiring`,detail:fsum.expiringWardens.map(w=>`${w.name} (${w.expiry})`).join(", "),nav:{tab:"firesafety"}});
  if(fsum.undatedWardens.length) notifications.push({type:"report",urgent:false,title:`${fsum.undatedWardens.length} fire warden certificate${fsum.undatedWardens.length!==1?"s have":" has"} no expiry date`,detail:fsum.undatedWardens.map(w=>w.name).join(", "),nav:{tab:"firesafety"}});
  if(fsum.overdueExtinguishers.length) notifications.push({type:"report",urgent:true,title:`${fsum.overdueExtinguishers.length} fire extinguisher${fsum.overdueExtinguishers.length!==1?"s":""} overdue for service`,detail:"Check Fire Safety → Extinguishers",nav:{tab:"firesafety"}});
  if(fsum.drillOverdue) notifications.push({type:"report",urgent:true,title:"Fire drill overdue — last drill was "+fsum.daysSinceDrill+" days ago",detail:"Schedule a full evacuation drill",nav:{tab:"firesafety"}});
  if(fsum.fraOverdue) notifications.push({type:"report",urgent:true,title:"Fire Risk Assessment review overdue",detail:`Review was due ${fsum.fraNext}`,nav:{tab:"firesafety"}});

  // Document review dates
  const overdueReviews = docs.filter(d=>d.reviewDate&&d.reviewDate<today2);
  const soonReviews = docs.filter(d=>d.reviewDate&&d.reviewDate>=today2&&Math.ceil((new Date(d.reviewDate)-new Date())/86400000)<=30);
  if(overdueReviews.length) notifications.push({type:"document",urgent:true,title:`${overdueReviews.length} document${overdueReviews.length!==1?"s":""} overdue for review`,detail:overdueReviews.map(d=>d.title).join(", "),nav:{tab:"documents"}});
  else if(soonReviews.length) notifications.push({type:"document",urgent:false,title:`${soonReviews.length} document${soonReviews.length!==1?"s":""} due for review soon`,detail:soonReviews.map(d=>d.title).join(", "),nav:{tab:"documents"}});
  return notifications;
}
