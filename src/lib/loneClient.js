/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/loneClient.js — lone working: reading and saving sessions (phone + portal)
 * ═══════════════════════════════════════════════════════════════════════════
 * The rules are in lib/loneWorking.js; the server job (netlify/shared/loneJob.mjs)
 * sends the alerts. The database rules (lone_working.sql) let staff see and change only
 * their own sessions, line managers their team's, admins everything.
 *
 *   useLoneSettings(enabled)         React: Site Settings → Lone working
 *   loadLoneSettings()
 *   saveLoneSettings(s)              admins
 *   useLoneSessions(enabled, opts)   React: open sessions + the last 30 days (whatever this
 *                                    person may see), refreshed every 30 seconds
 *   loadLoneSessions({ fresh })
 *   loadLoneSessionsBetween(from, to) every session started between two dates (YYYY-MM-DD),
 *                                    for the evidence pack; doesn't touch the shared copy
 *   freshLoneSession(id)             the latest copy of one session
 *   saveLoneSession(row, {isNew})    insert a new session / update an existing one
 *   pingLone()                       ask the server to check now (after "I need help", and
 *                                    while the admin screen is open, which also covers staging)
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { sb, bearer } from "./supabase";
import { LONE_SETTINGS_ID, normaliseLoneSettings } from "./loneWorking";

let settings = normaliseLoneSettings(null);
const setSubs = new Set();
export async function loadLoneSettings() {
  const r = await sb.from("app_settings").select("*").eq("id", LONE_SETTINGS_ID);
  settings = normaliseLoneSettings(r && !r.error && r.data && r.data[0] ? r.data[0].data : null);
  setSubs.forEach(f => f());
  return settings;
}
export async function saveLoneSettings(s) {
  const clean = normaliseLoneSettings(s);
  const r = await sb.from("app_settings").upsert({ id: LONE_SETTINGS_ID, data: clean, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (r && r.error) throw new Error(r.error.message || String(r.error));
  settings = clean; setSubs.forEach(f => f());
  return clean;
}
/** React: the lone working settings (loaded once signed in; updated when an admin saves them). */
export function useLoneSettings(enabled = true) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { if (!enabled) return undefined; setSubs.add(force); loadLoneSettings(); return () => setSubs.delete(force); }, [enabled]);
  return settings;
}

let rows = [], loaded = false, pending = null, missing = false;
const subs = new Set();
const emit = () => subs.forEach(f => f());
export const loneTableMissing = () => missing;

export async function loadLoneSessions({ fresh = false } = {}) {
  if (loaded && !fresh) return rows;
  if (pending) return pending;
  pending = (async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const r = await sb.from("lone_working").query(`select=*&or=(status.in.(active,alert,escalated,help),created_at.gte.${encodeURIComponent(since)})&order=created_at.desc&limit=1000`);
    if (r && !r.error && Array.isArray(r.data)) { rows = r.data.map(x => ({ ...x, data: x.data || {} })); missing = false; }
    else missing = true;
    loaded = true; pending = null; emit();
    return rows;
  })();
  return pending;
}

/** Sessions started between two dates (inclusive), for reports. null if the table can't be read. */
export async function loadLoneSessionsBetween(from, to) {
  const out = [];
  const start = encodeURIComponent(`${from}T00:00:00Z`), end = encodeURIComponent(`${to}T23:59:59Z`);
  for (let offset = 0; offset < 50000; offset += 1000) {
    const r = await sb.from("lone_working").query(`select=*&created_at=gte.${start}&created_at=lte.${end}&order=created_at.asc&limit=1000&offset=${offset}`);
    if (!r || r.error || !Array.isArray(r.data)) return null;
    out.push(...r.data.map(x => ({ ...x, data: x.data || {} })));
    if (r.data.length < 1000) break;
  }
  return out;
}

/** every: also ask the server to run its check (admin screen open → staging works too). */
export function useLoneSessions(enabled = true, { fresh = false, ping = false, every = 30000 } = {}) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!enabled) return undefined;
    subs.add(force); loadLoneSessions({ fresh });
    const tick = async () => { if (document.visibilityState !== "visible") return; if (ping) await pingLone(); loadLoneSessions({ fresh: true }); };
    const iv = setInterval(tick, every);
    return () => { subs.delete(force); clearInterval(iv); };
  }, [enabled, ping, every]); // eslint-disable-line react-hooks/exhaustive-deps
  return enabled ? rows : [];
}

/** The latest copy of one session from the database (before changing it, so a status the
 *  server set a moment ago, e.g. "alert", isn't overwritten without its follow-up). */
export async function freshLoneSession(id) {
  const r = await sb.from("lone_working").select("*").eq("id", id);
  return r && !r.error && r.data && r.data[0] ? { ...r.data[0], data: r.data[0].data || {} } : null;
}

/**
 * Save one session. A new one is inserted (only your own: the database rules); an existing
 * one is updated (yours, or your team's as a line manager). Not insert-or-update, because
 * the database checks the insert rule even when the row already exists.
 */
export async function saveLoneSession(row, { isNew = false } = {}) {
  const body = { id: row.id, user_id: String(row.user_id), status: row.status, next_due: row.next_due || null, data: row.data, updated_at: new Date().toISOString() };
  const r = isNew ? await sb.from("lone_working").insert(body)
    : await sb.from("lone_working").update({ status: body.status, next_due: body.next_due, data: body.data, updated_at: body.updated_at }).eq("id", row.id);
  if (r && r.error) return false;
  const i = rows.findIndex(x => x.id === row.id);
  rows = i >= 0 ? rows.map(x => (x.id === row.id ? { ...x, ...body } : x)) : [{ ...body, created_at: new Date().toISOString() }, ...rows];
  emit();
  return true;
}

export async function pingLone() {
  try { await fetch("/.netlify/functions/zp-lone", { method: "POST", headers: { "Content-Type": "application/json", Authorization: bearer() }, body: "{}", keepalive: true }); }
  catch { /* the scheduled check catches up */ }
}
