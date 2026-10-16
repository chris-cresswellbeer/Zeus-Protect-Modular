/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/ppeClient.js — PPE register: reading and saving (portal + phone)
 * ═══════════════════════════════════════════════════════════════════════════
 * The rules are in lib/ppe.js. The database rules (ppe.sql) let staff see their own PPE
 * (and only sign for it / report a problem), line managers their team's, admins everything.
 *
 *   usePpeSettings(enabled)        React: items, sizes, signing statement (app_settings "ppe")
 *   loadPpeSettings() / savePpeSettings(s)   (admins)
 *   usePpeIssues(enabled)          React: every issue this person may see
 *   loadPpeIssues({ fresh })
 *   freshPpeIssue(id)              the latest copy of one issue
 *   savePpeIssue(row, { isNew })   insert a new issue / update an existing one
 *   ppeTableMissing()              true until ppe.sql has been run
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { sb } from "./supabase";
import { PPE_SETTINGS_ID, normalisePpeSettings } from "./ppe";

let settings = normalisePpeSettings(null), settingsLoaded = false;
const setSubs = new Set();
export async function loadPpeSettings() {
  const r = await sb.from("app_settings").select("*").eq("id", PPE_SETTINGS_ID);
  settings = normalisePpeSettings(r && !r.error && r.data && r.data[0] ? r.data[0].data : null);
  settingsLoaded = true;
  setSubs.forEach(f => f());
  return settings;
}
export async function savePpeSettings(s) {
  const clean = normalisePpeSettings(s);
  const r = await sb.from("app_settings").upsert({ id: PPE_SETTINGS_ID, data: clean, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (r && r.error) throw new Error(r.error.message || String(r.error));
  settings = clean; setSubs.forEach(f => f());
  return clean;
}
export const ppeSettingsLoaded = () => settingsLoaded;
export function usePpeSettings(enabled = true) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { if (!enabled) return undefined; setSubs.add(force); loadPpeSettings(); return () => setSubs.delete(force); }, [enabled]);
  return settings;
}

let rows = [], loaded = false, pending = null, missing = false;
const subs = new Set();
const emit = () => subs.forEach(f => f());
export const ppeTableMissing = () => missing;
export const ppeLoaded = () => loaded;

export async function loadPpeIssues({ fresh = false } = {}) {
  if (loaded && !fresh) return rows;
  if (pending) return pending;
  pending = (async () => {
    const out = []; let ok = true;
    for (let offset = 0; offset < 50000; offset += 1000) {
      const r = await sb.from("ppe_issues").query(`select=*&order=created_at.desc&limit=1000&offset=${offset}`);
      if (!r || r.error || !Array.isArray(r.data)) { ok = false; break; }
      out.push(...r.data);
      if (r.data.length < 1000) break;
    }
    if (ok) { rows = out.map(x => ({ ...x, data: x.data || {} })); missing = false; } else missing = true;
    loaded = true; pending = null; emit();
    return rows;
  })();
  return pending;
}
/** React: the issues this person may see; refreshed every minute while visible. */
export function usePpeIssues(enabled = true, { every = 60000 } = {}) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!enabled) return undefined;
    subs.add(force); loadPpeIssues();
    const iv = setInterval(() => { if (document.visibilityState === "visible") loadPpeIssues({ fresh: true }); }, every);
    return () => { subs.delete(force); clearInterval(iv); };
  }, [enabled, every]);
  return enabled ? rows : [];
}

export async function freshPpeIssue(id) {
  const r = await sb.from("ppe_issues").select("*").eq("id", id);
  return r && !r.error && r.data && r.data[0] ? { ...r.data[0], data: r.data[0].data || {} } : null;
}

/** Save one issue: a new one is inserted, an existing one updated. Returns "" or the reason it failed. */
export async function savePpeIssue(row, { isNew = false } = {}) {
  const now = new Date().toISOString();
  const body = { id: row.id, user_id: String(row.user_id), status: row.status, replace_by: row.replace_by || null, data: row.data, updated_at: now };
  const r = isNew ? await sb.from("ppe_issues").insert(body)
    : await sb.from("ppe_issues").update({ status: body.status, replace_by: body.replace_by, data: body.data, updated_at: now }).eq("id", row.id);
  if (r && r.error) return (r.error && (r.error.message || String(r.error))) || "That didn't save.";
  const i = rows.findIndex(x => x.id === row.id);
  rows = i >= 0 ? rows.map(x => (x.id === row.id ? { ...x, ...body } : x)) : [{ ...body, created_at: now }, ...rows];
  emit();
  return "";
}
/** Admins only: remove an issue entered by mistake. */
export async function deletePpeIssue(id) {
  const r = await sb.from("ppe_issues").delete().eq("id", id);
  if (r && r.error) return r.error.message || String(r.error);
  rows = rows.filter(x => x.id !== id); emit();
  return "";
}
