/**
 * app/bell/rackingNotifications.js — the racking items for the notification bell.
 *
 * For racking inspectors (admins and Machinery & Equipment access) once racking has loaded:
 * red damage, amber repairs past their time, reports to confirm, the racking check and the
 * expert inspection. `nav` is where clicking an item goes (admin and staff portals differ).
 * Pure; tested in tests/portal/belllib.mjs.
 */
import { rackingSummary } from "../../lib/racking";

export function rackingNotifications(racking, rackInspector, nav) {
  const out = [];
  if (!rackInspector || !racking || !racking.loaded) return out;
  const s = rackingSummary(racking.damage, racking.checks, racking.settings);
  if (s.red) out.push({type:"report",urgent:true,title:`RED racking damage: ${s.red} bay${s.red!==1?"s":""} out of use`,detail:s.redNotOffloaded?`${s.redNotOffloaded} not marked offloaded yet`:"Book and record the repair",nav});
  if (s.amberLate) out.push({type:"report",urgent:true,title:`${s.amberLate} amber racking repair${s.amberLate!==1?"s":""} overdue`,detail:`Past ${racking.settings.amberDays} days`,nav});
  if (s.unconfirmed) out.push({type:"report",urgent:false,title:`${s.unconfirmed} racking damage report${s.unconfirmed!==1?"s":""} to confirm`,detail:"Check the rating the reporter chose",nav});
  if (racking.locations.length && s.weeklyLate) out.push({type:"report",urgent:false,title:"Racking check due",detail:s.lastWeekly?`Last one ${s.lastWeekly.split("-").reverse().join("/")}`:"None recorded yet",nav});
  if (racking.locations.length && (s.expertLate || !s.expertDue)) out.push({type:"report",urgent:false,title:s.expertDue?"Expert racking inspection overdue":"Record the last expert racking inspection",detail:"Equipment → Racking → Inspections",nav});
  return out;
}
