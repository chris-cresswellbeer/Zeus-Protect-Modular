/**
 * siteLists.js — the lists that differ from site to site, kept in the database
 * (app_settings row id "site_lists") instead of in the website code:
 *
 *   firstAidZones     where first aiders cover (First Aid register, certificates)
 *   firstAidShifts    the shifts first aid cover is planned for
 *   reportLocations   the "Where was it?" choices on quick hazard reports
 *
 * Admins edit them on Documents ▼ → Site Settings (domains/settings/SiteSettingsTab.jsx).
 * Everyone signed in can read them (app_settings is readable by all; db_rules.sql).
 * Until a site has saved its own, the generic DEFAULTS below are used.
 * The Biggleswade lists were put in the database by site_content.sql.
 *
 *   loadSiteLists()        read once after sign-in (App.jsx)
 *   useSiteLists()         hook → { firstAidZones, firstAidShifts, reportLocations, saved }
 *                          (re-reads the row when a screen opens, if 30 s have passed)
 *   saveSiteLists(lists)   admins; resolves to an error message or null
 */
import React from "react";
import { sb } from "./supabase";

const ROW = "site_lists";
export const SITE_LIST_DEFAULTS = {
  firstAidZones: [],
  firstAidShifts: ["Day shift", "Night shift", "Office hours", "All shifts"],
  reportLocations: ["Warehouse", "Loading bay", "Production area", "Offices", "Car park", "Other"],
};
const clean = list => [...new Set((Array.isArray(list) ? list : []).map(x => String(x || "").trim()).filter(Boolean))];
const normalise = d => ({
  firstAidZones: d && Array.isArray(d.firstAidZones) ? clean(d.firstAidZones) : SITE_LIST_DEFAULTS.firstAidZones,
  firstAidShifts: d && Array.isArray(d.firstAidShifts) && d.firstAidShifts.length ? clean(d.firstAidShifts) : SITE_LIST_DEFAULTS.firstAidShifts,
  reportLocations: d && Array.isArray(d.reportLocations) && d.reportLocations.length ? clean(d.reportLocations) : SITE_LIST_DEFAULTS.reportLocations,
  saved: !!d,
});

let current = normalise(null);
let loadedAt = 0;
const subs = new Set();
const emit = () => subs.forEach(f => f());

export async function loadSiteLists() {
  loadedAt = Date.now();
  try {
    const r = await sb.from("app_settings").select("*").eq("id", ROW);
    const d = !r.error && Array.isArray(r.data) && r.data[0] ? r.data[0].data : null;
    current = normalise(d); emit();
  } catch { /* keep what we have */ }
  return current;
}

export async function saveSiteLists(lists) {
  const data = { firstAidZones: clean(lists.firstAidZones), firstAidShifts: clean(lists.firstAidShifts), reportLocations: clean(lists.reportLocations) };
  try {
    const r = await sb.from("app_settings").upsert({ id: ROW, data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (r && r.error) return String(r.error.message || r.error);
  } catch (e) { return String(e && e.message || e); }
  current = normalise(data); emit();
  return null;
}

export const getSiteLists = () => current;

/** An "all shifts" choice (counts in every column of the coverage matrix). */
export const isAllShift = s => /^all\b/i.test(String(s || "").trim());
/** The shifts that get a column in the first aid coverage matrix. */
export const coverShifts = shifts => (shifts || []).filter(s => !isAllShift(s));

export function useSiteLists() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    subs.add(force);
    // pick up an admin's changes when a screen that uses the lists is opened (at most every 30 s)
    if (loadedAt && Date.now() - loadedAt > 30000) loadSiteLists();
    return () => subs.delete(force);
  }, []);
  return current;
}
