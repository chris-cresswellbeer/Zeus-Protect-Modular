/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/hsPerformance.js — the figures the board report needs that the portal can't
 * work out for itself
 * ═══════════════════════════════════════════════════════════════════════════
 * HOURS WORKED  app_settings row "hours_worked"
 *   { yearStart: 0-11 (the month the reporting year starts; 0 = January, 3 = April),
 *     hours: { "2026-09": 41250, … } }   total hours worked on site that month, from payroll
 *   Entered by an admin in Reports → H&S Performance. Accident frequency rates need it.
 *
 * TRAINING COMPLIANCE HISTORY  app_settings row "training_snapshots"
 *   { months: { "2026-10": { pct, at: "2026-10-19" }, … } }
 *   The portal only knows training status today, so the compliance figure is written down
 *   (at most once a day, by an admin opening Reports) and the last one in each month
 *   becomes that month's figure. The trend builds up from when this was first installed.
 *
 * Both rows are readable by everyone signed in and written by admins (app_settings rules
 * in db_rules.sql). No new tables or SQL.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { sb } from "./supabase";

export const HOURS_ROW = "hours_worked";
export const SNAPSHOT_ROW = "training_snapshots";

const isMonth = k => /^\d{4}-(0[1-9]|1[0-2])$/.test(k);
export function normaliseHours(d) {
  const src = d && typeof d === "object" ? d : {};
  const ys = Number(src.yearStart);
  const hours = {};
  Object.entries(src.hours && typeof src.hours === "object" ? src.hours : {}).forEach(([k, v]) => {
    const n = Math.round(Number(v));
    if (isMonth(k) && Number.isFinite(n) && n > 0 && n < 100000000) hours[k] = n;
  });
  return { yearStart: Number.isInteger(ys) && ys >= 0 && ys <= 11 ? ys : 0, hours };
}
export function normaliseSnapshots(d) {
  const months = {};
  Object.entries(d && d.months && typeof d.months === "object" ? d.months : {}).forEach(([k, v]) => {
    if (isMonth(k) && v && Number.isFinite(Number(v.pct))) months[k] = { pct: Math.max(0, Math.min(100, Math.round(Number(v.pct)))), at: String(v.at || "").slice(0, 10) };
  });
  return { months };
}

async function readRow(id) {
  const r = await sb.from("app_settings").select("*").eq("id", id);
  if (!r || r.error) return { error: (r && r.error) || "no data" };
  return { data: r.data && r.data[0] ? r.data[0].data : null };
}
async function writeRow(id, data) {
  const r = await sb.from("app_settings").upsert({ id, data, updated_at: new Date().toISOString() }, { onConflict: "id" });
  return r && r.error ? (r.error.message || String(r.error)) : "";
}

export async function loadHoursWorked() { const r = await readRow(HOURS_ROW); return r.error ? null : normaliseHours(r.data); }
/** → "" or why it failed */
export const saveHoursWorked = d => writeRow(HOURS_ROW, normaliseHours(d));
export async function loadTrainingSnapshots() { const r = await readRow(SNAPSHOT_ROW); return r.error ? null : normaliseSnapshots(r.data); }

/**
 * Write today's training compliance into this month's slot, unless it was already written
 * today. Returns the snapshots (with today's) or null if they can't be read.
 */
export async function recordTrainingSnapshot(pct, today) {
  if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) return null;
  const cur = await loadTrainingSnapshots();
  if (!cur) return null;
  const key = today.slice(0, 7);
  if (cur.months[key] && cur.months[key].at === today) return cur;   // once a day is plenty
  const next = { months: { ...cur.months, [key]: { pct: Math.round(pct), at: today } } };
  const err = await writeRow(SNAPSHOT_ROW, next);
  return err ? cur : normaliseSnapshots(next);
}
