/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/rackClient.js — racking: reading and saving (portal + phone)
 * ═══════════════════════════════════════════════════════════════════════════
 * The rules are in lib/racking.js; the database rules in racking.sql (everyone signed in
 * reports damage; racking inspectors — admins and Machinery & Equipment access — do the rest).
 *
 *   useRacking(enabled, { checks })  React: { settings, locations, damage, checks, loaded, missing }
 *   loadRacking({ fresh })
 *   saveRackingSettings(s)          inspectors
 *   saveLocations(rows) / deleteLocation(id)
 *   saveDamage(row, { isNew })      → "" or the reason it failed
 *   freshDamage(id)
 *   saveCheck(row)
 *   uploadRackPhoto(file, damageId) → url | null  (shrunk on the phone first)
 *   pingRacking()                   ask the server to send any red alerts now
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { sb, bearer } from "./supabase";
import { RACKING_SETTINGS_ID, normaliseRackingSettings } from "./racking";
import { compressToDataUrl, PHOTO_BUCKET } from "./photos";

let state = { settings: normaliseRackingSettings(null), locations: [], damage: [], checks: [], loaded: false, missing: false };
let pending = null;
const subs = new Set();
const emit = () => { state = { ...state }; subs.forEach(f => f()); };

async function all(table, query) {
  const out = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const r = await sb.from(table).query(`${query}&limit=1000&offset=${offset}`);
    if (!r || r.error || !Array.isArray(r.data)) return { error: (r && r.error) || "no data" };
    out.push(...r.data);
    if (r.data.length < 1000) break;
  }
  return { data: out };
}

export async function loadRacking({ fresh = false, checks = false } = {}) {
  if (state.loaded && !fresh) return state;
  if (pending) return pending;
  pending = (async () => {
    const [s, l, d, c] = await Promise.all([
      sb.from("app_settings").select("*").eq("id", RACKING_SETTINGS_ID),
      all("racking_locations", "select=*&order=aisle.asc,bay.asc"),
      all("racking_damage", "select=*&order=created_at.desc"),
      checks ? all("racking_checks", "select=*&order=created_at.desc") : Promise.resolve({ data: state.checks }),
    ]);
    state.settings = normaliseRackingSettings(s && !s.error && s.data && s.data[0] ? s.data[0].data : null);
    state.missing = !!(l.error || d.error);
    if (!l.error) state.locations = l.data.map(x => ({ ...x, data: x.data || {} }));
    if (!d.error) state.damage = d.data.map(x => ({ ...x, data: x.data || {} }));
    if (!c.error) state.checks = (c.data || []).map(x => ({ ...x, data: x.data || {} }));
    state.loaded = true; pending = null; emit();
    return state;
  })();
  return pending;
}

/** React: everything racking this person may see, refreshed every minute while visible. */
export function useRacking(enabled = true, { checks = false, every = 60000 } = {}) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!enabled) return undefined;
    subs.add(force); loadRacking({ fresh: !state.loaded || checks, checks });
    const iv = setInterval(() => { if (document.visibilityState === "visible") loadRacking({ fresh: true, checks }); }, every);
    return () => { subs.delete(force); clearInterval(iv); };
  }, [enabled, checks, every]);
  return state;
}

export async function saveRackingSettings(s) {
  const clean = normaliseRackingSettings(s);
  const r = await sb.from("app_settings").upsert({ id: RACKING_SETTINGS_ID, data: clean, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (r && r.error) return r.error.message || String(r.error);
  state.settings = clean; emit(); return "";
}

export async function saveLocations(rows) {
  if (!rows.length) return "";
  const now = new Date().toISOString();
  const body = rows.map(x => ({ id: x.id, aisle: x.aisle, bay: x.bay, data: x.data || {}, updated_at: now }));
  for (let i = 0; i < body.length; i += 500) {
    const r = await sb.from("racking_locations").upsert(body.slice(i, i + 500), { onConflict: "id" });
    if (r && r.error) return r.error.message || String(r.error);
  }
  const ids = new Set(body.map(x => x.id));
  state.locations = [...state.locations.filter(x => !ids.has(x.id)), ...body].sort((a, b) => String(a.aisle).localeCompare(String(b.aisle), undefined, { numeric: true }) || a.bay - b.bay);
  emit(); return "";
}
export async function deleteLocation(id) {
  const r = await sb.from("racking_locations").delete().eq("id", id);
  if (r && r.error) return r.error.message || String(r.error);
  state.locations = state.locations.filter(x => x.id !== id); emit(); return "";
}

export async function freshDamage(id) {
  const r = await sb.from("racking_damage").select("*").eq("id", id);
  return r && !r.error && r.data && r.data[0] ? { ...r.data[0], data: r.data[0].data || {} } : null;
}
export async function saveDamage(row, { isNew = false } = {}) {
  const now = new Date().toISOString();
  const body = { id: row.id, location_id: row.location_id, status: row.status, rating: row.rating, data: row.data, updated_at: now };
  const r = isNew ? await sb.from("racking_damage").insert(body)
    : await sb.from("racking_damage").update({ status: body.status, rating: body.rating, data: body.data, updated_at: now }).eq("id", row.id);
  if (r && r.error) return r.error.message || String(r.error);
  const i = state.damage.findIndex(x => x.id === row.id);
  state.damage = i >= 0 ? state.damage.map(x => (x.id === row.id ? { ...x, ...body } : x)) : [{ ...body, created_at: now }, ...state.damage];
  emit(); return "";
}
export async function saveCheck(row) {
  const r = await sb.from("racking_checks").insert({ id: row.id, kind: row.kind, data: row.data });
  if (r && r.error) return r.error.message || String(r.error);
  state.checks = [{ ...row, created_at: new Date().toISOString() }, ...state.checks]; emit(); return "";
}

/** Shrink a photo and put it in storage. Path insp_rack_… (signed-in staff can open it). */
export async function uploadRackPhoto(file, damageId) {
  const data = await compressToDataUrl(file);
  if (!data) return null;
  try {
    const blob = await (await fetch(data)).blob();
    const ext = blob.type === "image/png" ? "png" : "jpg";
    const path = `insp_rack_${damageId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await sb.storage.upload(PHOTO_BUCKET, path, blob);
    return error ? null : sb.storage.getPublicUrl(PHOTO_BUCKET, path);
  } catch { return null; }
}

export async function pingRacking() {
  try { await fetch("/.netlify/functions/zp-racking", { method: "POST", headers: { "Content-Type": "application/json", Authorization: bearer() }, body: "{}", keepalive: true }); }
  catch { /* the 2-minute job catches up */ }
}
