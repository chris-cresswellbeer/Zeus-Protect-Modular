/**
 * app/screens/admin/dashCards.js — the figures behind three admin dashboard cards.
 * Pure (data in, figures out), tested in tests/portal/conlib.mjs.
 *
 *   onSiteCard      On Site Now: the same list as On Site Right Now and the roll call
 *                   (lib/contractorApproval.js onSiteList), how many have something to check,
 *                   and whether it's past the end-of-day check time
 *   approvalCard    Contractor Approval: approved companies out of those in use (not banned /
 *                   inactive), and how many have documents expired / missing / due for renewal
 *   loneCard        Lone Working: people working alone now, anyone needing a response
 *                   (missed check-in, escalated, help), and the next check-in due
 * Each returns { value, sub, amber, red }.
 */
import { onSiteList, liveIssues, approvalOf, pastCheckTime } from "../../../lib/contractorApproval";
import { LONE_OPEN, LONE_ALARM, minutesToDue } from "../../../lib/loneWorking";

const names = (l, n = 2) => l.slice(0, n).join(", ") + (l.length > n ? ` +${l.length - n} more` : "");

export function onSiteCard({ signins = [], contractors = [], visits = {}, contractorCerts = {}, permits = [], settings = {}, today, now }) {
  const list = onSiteList({ signins, contractors, visits, today, now });
  if (!list.length) return { value: 0, sub: "No contractors on site", amber: false, red: false };
  const ctx = { contractors, contractorCerts, permits, settings, today };
  const flagged = list.map(p => liveIssues(p, ctx).filter(i => i.kind !== "cert")).filter(l => l.length);
  const red = flagged.some(l => l.some(i => i.level === "red"));
  const late = pastCheckTime(settings.onsiteCheckTime, now);
  const people = [...new Set(list.map(p => p.name))];
  const sub = late ? `Still signed in after ${settings.onsiteCheckTime}: ${names(people)}`
    : flagged.length ? `${flagged.length} to check · ${names(people)}` : names(people);
  return { value: list.length, sub, amber: !red && (flagged.length > 0 || late), red: red || late };
}

export function approvalCard({ contractors = [], required, today }) {
  const live = contractors.filter(c => c.status !== "banned" && c.status !== "inactive");
  if (!live.length) return { value: 0, sub: "No contractor companies yet", amber: false, red: false, total: 0 };
  const a = live.map(c => approvalOf(c, { required, today }));
  const ok = a.filter(x => x.approved).length, expired = a.filter(x => x.key === "expired").length,
    missing = a.filter(x => x.key === "missing").length, soon = a.filter(x => x.key === "expiring").length;
  const parts = [expired && `${expired} expired`, missing && `${missing} missing documents`, soon && `${soon} renewal due`].filter(Boolean);
  return { value: ok, total: live.length, sub: `of ${live.length} approved${parts.length ? ` · ${parts.join(" · ")}` : ""}`, amber: !expired && (missing > 0 || soon > 0), red: expired > 0 };
}

const REASON = { alert: "missed check-in", escalated: "missed check-in, escalated", help: "asked for help" };
export function loneCard({ sessions = [], now = new Date().toISOString() }) {
  const open = sessions.filter(r => r && LONE_OPEN.includes(r.status));
  const alarm = open.filter(r => LONE_ALARM.includes(r.status));
  const who = r => (r.data && r.data.name) || "Someone";
  if (alarm.length) return { value: open.length, red: true, amber: false,
    sub: `${alarm.length} need${alarm.length === 1 ? "s" : ""} a response: ${alarm.slice(0, 2).map(r => `${who(r)} (${REASON[r.status]})`).join(", ")}${alarm.length > 2 ? ` +${alarm.length - 2} more` : ""}` };
  if (!open.length) return { value: 0, sub: "Nobody working alone", red: false, amber: false };
  const next = open.map(r => ({ r, m: minutesToDue(r, now) })).filter(x => x.m != null).sort((a, b) => a.m - b.m)[0];
  const sub = next ? (next.m < 0 ? `${who(next.r)}: check-in ${-next.m} min late` : `Next check-in: ${who(next.r)} in ${next.m} min`) : names(open.map(who));
  return { value: open.length, sub, red: false, amber: !!(next && next.m < 0) };
}
