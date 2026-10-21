/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/siteSignins.js — contractor sign-ins from the reception QR code (admin side)
 * ═══════════════════════════════════════════════════════════════════════════
 * The last 90 days of site_signins (contractor_signin.sql), for admins and staff with
 * Reception access (the database rules hide them from everyone else; reception may only
 * sign people out: contractor_approval.sql). Loaded when first needed and every
 * 30 seconds while the portal is on screen, so new arrivals show up without a reload.
 *
 *   useSiteSignins(enabled, {fresh}) React: the list, newest first ([] when not enabled);
 *                                  fresh = fetch again as the screen opens
 *   loadSiteSignins({ fresh })     fetch now
 *   saveSignin(row, changes, why)  update one sign-in (sign out, link to the register, review)
 *   removeSignin(row)              delete one (e.g. a test or a mistake)
 *   signinsOnSite(list, today)     today's, not signed out
 *   signinsToReview(list)          sign-ins made before the register kept itself up to date
 *                                  (Oct 2026) whose company / worker was never dealt with
 *   useSigninSettings(enabled)     the contractor_signin settings (end-of-day check time,
 *                                  required documents…), normalised; refreshSigninSettings()
 *                                  after Site Settings saves them
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { sb } from "./supabase";
import { auditEvent } from "./audit";
import { signinOnSite, normaliseSigninSettings, defaultSigninSettings, SIGNIN_SETTINGS_ID } from "./contractorSignin";

let rows = [], loaded = false, pending = null, missing = false;
const subs = new Set();
const emit = () => subs.forEach(f => f(rows));
const DAYS = 90;

export async function loadSiteSignins({ fresh = false } = {}) {
  if (loaded && !fresh) return rows;
  if (pending) return pending;
  pending = (async () => {
    const since = new Date(Date.now() - DAYS * 86400000).toISOString();
    const r = await sb.from("site_signins").query(`select=*&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=2000`);
    if (r && !r.error && Array.isArray(r.data)) { rows = r.data.map(x => ({ ...x, data: x.data || {} })); missing = false; }
    else missing = true;          // contractor_signin.sql not run yet, or offline: keep what we had
    loaded = true; pending = null; emit();
    return rows;
  })();
  return pending;
}
export const siteSigninsMissing = () => missing;

/** fresh = true: fetch again when this screen opens (Contractors), not just every 30 seconds. */
export function useSiteSignins(enabled = true, { fresh = false } = {}) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!enabled) return undefined;
    subs.add(force); loadSiteSignins({ fresh });
    const iv = setInterval(() => { if (document.visibilityState === "visible") loadSiteSignins({ fresh: true }); }, 30000);
    return () => { subs.delete(force); clearInterval(iv); };
  }, [enabled]);
  return enabled ? rows : [];
}

/** Save changes to one sign-in's data. Returns true when saved. */
export async function saveSignin(row, changes, summary) {
  const data = { ...row.data, ...changes };
  const r = await sb.from("site_signins").update({ data, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (r && r.error) return false;
  rows = rows.map(x => (x.id === row.id ? { ...x, data } : x)); emit();
  const diff = {}; Object.keys(changes).forEach(k => { if (k !== "token") diff[k] = { from: row.data[k] === undefined ? "" : row.data[k], to: changes[k] }; });
  auditEvent("contractor_signin", row.id, "update", summary || "Contractor sign-in updated", diff, `${row.data.workerName || ""} (${row.data.companyName || ""})`);
  return true;
}
export async function removeSignin(row) {
  const r = await sb.from("site_signins").delete().eq("id", row.id);
  if (r && r.error) return false;
  rows = rows.filter(x => x.id !== row.id); emit();
  auditEvent("contractor_signin", row.id, "delete", "Contractor sign-in removed", {}, `${row.data.workerName || ""} (${row.data.companyName || ""}) ${row.data.date || ""}`);
  return true;
}

export const signinsOnSite = (list, today) => (list || []).filter(s => signinOnSite(s, today));
export const signinsToReview = list => (list || []).filter(s => s.data && !s.data.reviewed && (s.data.newCompany || s.data.newWorker) && !(s.data.companyId && s.data.workerId));
/** Today's sign-ins already signed out. */
export const signinsOutToday = (list, today) => (list || []).filter(s => s.data && s.data.date === today && s.data.timeOut);

// ── settings ────────────────────────────────────────────────────────────────
let settings = defaultSigninSettings(), settingsLoaded = false, settingsPending = null;
const settingSubs = new Set();
export async function refreshSigninSettings() {
  if (settingsPending) return settingsPending;
  settingsPending = (async () => {
    const r = await sb.from("app_settings").select("*").eq("id", SIGNIN_SETTINGS_ID);
    if (r && !r.error && Array.isArray(r.data)) settings = r.data[0] ? normaliseSigninSettings(r.data[0].data) : defaultSigninSettings();
    settingsLoaded = true; settingsPending = null; settingSubs.forEach(f => f(settings));
    return settings;
  })();
  return settingsPending;
}
export function useSigninSettings(enabled = true) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!enabled) return undefined;
    settingSubs.add(force); if (!settingsLoaded) refreshSigninSettings();
    return () => { settingSubs.delete(force); };
  }, [enabled]);
  return settings;
}
