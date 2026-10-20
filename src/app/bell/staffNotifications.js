/**
 * app/bell/staffNotifications.js — what the staff (and line manager) notification bell lists
 *
 * Pure: give it the app's data, get the list for the notification bell (shared/NotificationBell.jsx).
 * Each item: { type: "module"|"document"|"dse"|"report"|"staff", urgent, title, detail, nav }.
 * nav says where clicking it goes (the portal handles it). Tested in tests/portal/belllib.mjs.
 */
import { DSE_QUESTION_COUNT } from "../../data/seedDse";
import { compsFor, isWarehouseWorker, machineState } from "../../data/seedMachinery";
import { isQuickReportOverdue, myIncompleteQuickReports, quickReportDueLabel } from "../../domains/incidents/quickReportStatus";
import { teamOf } from "../../domains/manager/team";
import { isActionDone } from "../../lib/actionStatus";
import { getExpiryStatus, todayISO } from "../../lib/dates";
import { dueInfo, dueText } from "../../lib/dueDates";
import { t } from "../../lib/i18n";
import { sameName } from "../../lib/openActions";
import { ppeState } from "../../lib/ppe";
import { rackingNotifications } from "./rackingNotifications";

export function staffNotifications({
  adminResponses, allMachineTypes, allModules, allUsers, assigns, comps, docAcknowledgements,
  docAssignments, docs, dseDraft, dseReports, dueDates, incidents, investigations, machineComps,
  ppeRows, ppeSettings, racking, rackInspector, showMyPpe, user
}) {
  const notifications = [];
  // Quick hazard reports awaiting the full form (urgent once overdue)
  myIncompleteQuickReports(incidents, user.id).forEach(inc=>notifications.push({type:"report",urgent:isQuickReportOverdue(inc),title:`Finish your hazard report — ${inc.location}`,detail:`Add the full incident details · ${quickReportDueLabel(inc)}`,nav:{tab:"incidents",editId:inc.id}}));
  const myIds = assigns[user.id]||[];
  const myC   = comps[user.id]||{};
  // Incomplete modules
  const pending = allModules.filter(m=>myIds.includes(m.id)&&!myC[m.id]);
  pending.forEach(m=>{ const d=dueInfo(dueDates,user.id,m.id,false);
    notifications.push({type:"module",urgent:m.level==="Mandatory"||!!(d&&(d.overdue||d.soon)),title:`Complete: ${m.title}`,detail:d?`${dueText(d)}${m.level==="Mandatory"?" · Mandatory":""}`:m.level==="Mandatory"?"Mandatory module — action required":m.duration,nav:{tab:"training"}}); });
  // My machinery competences needing renewal (warehouse roles)
  if (isWarehouseWorker(user)) compsFor(machineComps, user.id).forEach(c=>{
    const st = machineState(c, allMachineTypes); const t = allMachineTypes.find(x=>x.id===c.machineId);
    if (!t || !st || (st.key!=="expired" && st.key!=="expiring")) return;
    notifications.push({type:"module",urgent:st.key==="expired",title:`${st.key==="expired"?"Renewal required":"Renew soon"}: ${t.label}`,detail:st.ex?`${st.key==="expired"?"Expired":"Renew by"} ${st.ex.expiryDate.split("-").reverse().join("/")} (${st.ex.why}). Speak to your manager to book a reassessment.`:"Speak to your manager to book a reassessment.",nav:{tab:"machinery"}});
  });
  // Expired or expiring modules
  allModules.filter(m=>myIds.includes(m.id)&&myC[m.id]&&m.renewalMonths).forEach(m=>{
    const ex = getExpiryStatus(myC[m.id].date, m.renewalMonths);
    if (ex && ex.status==="expired") notifications.push({type:"module",urgent:true,title:`Renewal required: ${m.title}`,detail:`Certificate expired ${Math.abs(ex.daysLeft)} days ago — retake now`,nav:{tab:"training"}});
    else if (ex && ex.status==="expiring") notifications.push({type:"module",urgent:false,title:`Expiring soon: ${m.title}`,detail:ex.label+" · Renews every "+m.renewalLabel,nav:{tab:"training"}});
  });
  // Unread documents
  docs.filter(d=>(docAssignments[String(d.id)]||[]).includes(String(user.id))&&!(docAcknowledgements[user.id]||{})[d.id])
    .forEach(d=>notifications.push({type:"document",urgent:true,title:`Read & confirm: ${d.title}`,detail:"Required reading — confirmation pending",nav:{tab:"documents"}}));
  // DSE not completed
  if(dseDraft) notifications.push({type:"dse",urgent:false,title:"Finish your DSE workstation assessment",detail:`In progress — ${Object.keys(dseDraft.answers||{}).length} of ${DSE_QUESTION_COUNT} questions answered`,nav:{tab:"dse"}});
  else if(!(dseReports[user.id]||[]).length) notifications.push({type:"dse",urgent:false,title:"Complete your DSE workstation assessment",detail:"DSE Regulations 1992 — required for all screen users",nav:{tab:"dse"}});
  // Open DSE issues with no admin response
  const latestDse=(dseReports[user.id]||[])[( dseReports[user.id]||[]).length-1];
  if(latestDse){
    const ri = (dseReports[user.id]||[]).length - 1;
    const openIssues=latestDse.issues.filter((_,ii)=>!(adminResponses[user.id]||{})[`${ri}_${ii}`]?.resolved&&latestDse.issueCount>0);
    if(openIssues.length) notifications.push({type:"dse",urgent:false,title:`${openIssues.length} open DSE issue${openIssues.length!==1?"s":""}`,detail:"Check My DSE for H&S team responses",nav:{tab:"dse"}});
  }
  // NB: action owners are matched by NAME (lib/openActions sameName: ignoring case and extra spaces), not id — renaming a user orphans their actions.
  // Investigation corrective actions assigned to this user
  const myActions = Object.values(investigations).flatMap(inv=>
    (inv.actions||[]).filter(a=>sameName(a.owner,user.name)&&!isActionDone(a))
  );
  const overdueActions = myActions.filter(a=>a.dueDate&&a.dueDate<todayISO());
  // Line managers: team items waiting for their sign-off
  if (user.role==="manager") {
    const team = teamOf(user, allUsers);
    const teamNames = new Set(team.map(u=>String(u.name).trim().toLowerCase()));
    const dseOpen = team.reduce((n,u)=>{ const reps=dseReports[u.id]||dseReports[String(u.id)]||[]; const ri=reps.length-1; if(ri<0) return n;
      const resp=adminResponses[u.id]||adminResponses[String(u.id)]||{}; return n+(reps[ri].issues||[]).filter((_,ii)=>!(resp[`${ri}_${ii}`]||{}).resolved).length; },0);
    const actsToSign = Object.values(investigations).flatMap(inv=>(inv.actions||[]).filter(a=>teamNames.has(String(a.owner||"").trim().toLowerCase())&&isActionDone(a)&&!a.managerSignOff)).length;
    if (dseOpen) notifications.push({type:"dse",urgent:false,title:`${dseOpen} team DSE issue${dseOpen!==1?"s":""} to sign off`,detail:"Open My Team to review and sign off",nav:{tab:"team"}});
    if (actsToSign) notifications.push({type:"report",urgent:false,title:`${actsToSign} completed team action${actsToSign!==1?"s":""} awaiting your sign-off`,detail:"Open My Team to sign them off",nav:{tab:"team"}});
  }
  if (user.role!=="admin") notifications.push(...rackingNotifications(racking, rackInspector, {tab:"mequip",preset:{tab:"racking"}}));
  if (showMyPpe) { const mine=(ppeRows||[]).filter(r=>String(r.user_id)===String(user.id)&&r.status==="issued");
    const uns=mine.filter(r=>!(r.data||{}).signature), od=mine.filter(r=>ppeState(r,undefined,ppeSettings.dueSoonDays).overdue);
    if (ppeSettings.staffCanSee && uns.length) notifications.push({type:"document",urgent:true,title:t("Sign for your PPE"),detail:uns.map(r=>r.data.item).join(", "),nav:{tab:"ppe"}});
    if (od.length) notifications.push({type:"document",urgent:false,title:t("PPE due for replacement"),detail:`${od.map(r=>r.data.item).join(", ")} · ${t("speak to your supervisor")}`,nav:{tab:"ppe"}});
    if (user.role==="manager") { const ids=new Set(teamOf(user, allUsers).map(u=>String(u.id))); const tp=(ppeRows||[]).filter(r=>ids.has(String(r.user_id))&&r.status==="issued"&&ppeState(r,undefined,ppeSettings.dueSoonDays).problem).length;
      if (tp) notifications.push({type:"report",urgent:true,title:`${tp} PPE problem${tp!==1?"s":""} reported by your team`,detail:"Open My PPE → My team's PPE",nav:{tab:"ppe"}}); } }
  if(overdueActions.length) notifications.push({type:"report",urgent:true,title:`${overdueActions.length} overdue corrective action${overdueActions.length!==1?"s":""}`,detail:"Investigation actions past due date — action required",nav:{tab:"actions"}});
  else if(myActions.length) notifications.push({type:"report",urgent:false,title:`${myActions.length} open corrective action${myActions.length!==1?"s":""}`,detail:`You have been assigned action${myActions.length!==1?"s":""} from an investigation`,nav:{tab:"actions"}});
  return notifications;
}
