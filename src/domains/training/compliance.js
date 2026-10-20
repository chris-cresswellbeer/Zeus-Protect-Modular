/**
 * ═══════════════════════════════════════════════════════════════════════════
 * domains/training/compliance.js — ONE set of compliance rules for the portal
 * ═══════════════════════════════════════════════════════════════════════════
 * Before, each screen worked out "compliant" its own way, so the same person
 * could be 80% on their dashboard, 100% in the Training Matrix, 67% on the phone
 * and different again in the manager report. Every screen now uses these:
 *
 *   moduleState(mod, comp)   "valid" | "expiring" | "expired" | "failed" | "missing"
 *   IN DATE                  "valid" or "expiring" (still in date — counts as compliant)
 *   trainingCompliance()     in-date assigned modules ÷ assigned modules
 *                            (retired/hidden modules are never counted)
 *   personalCompliance()     the staff dashboard figure: training, plus each
 *                            uploaded external certificate (counts while in date),
 *                            plus the DSE assessment (counts while in date)
 *   complianceBand(pct)      100% green "Fully Compliant", 70% or more amber
 *                            "Mostly Compliant", below 70% red "Needs Attention"
 *
 * Pure JS (no React), so it can be unit tested and used by the email reminders.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { isPassed } from "./completion";
import { getExpiryStatus, todayISO } from "../../lib/dates";

export const AMBER_FROM = 70;   // % at or above which a figure is amber rather than red

/** Where one person stands on one module. */
export function moduleState(mod, comp) {
  if (!comp) return "missing";
  if (!isPassed(comp, mod)) return "failed";
  const ex = mod && mod.renewalMonths ? getExpiryStatus(comp.date, mod.renewalMonths) : null;
  return !ex ? "valid" : ex.status;   // valid | expiring | expired
}

/** Still in date (valid or expiring) — counts as compliant. */
export const isInDateState = s => s === "valid" || s === "expiring";

/**
 * Training compliance for one person.
 * @param mods  the modules assigned to them (module objects)
 * @param comps their completions, keyed by module id
 * @returns { pct, good, total, byState: { valid:[mod], expiring:[], expired:[], failed:[], missing:[] } }
 *          pct is 100 when nothing is assigned.
 */
export function trainingCompliance(mods, comps) {
  const byState = { valid: [], expiring: [], expired: [], failed: [], missing: [] };
  (mods || []).filter(m => m && !m._hidden).forEach(m => byState[moduleState(m, (comps || {})[m.id])].push(m));
  const total = Object.values(byState).reduce((n, l) => n + l.length, 0);
  const good = byState.valid.length + byState.expiring.length;
  return { pct: total ? Math.round(good / total * 100) : 100, good, total, byState };
}

/** An uploaded external certificate counts while it isn't past its expiry date. */
export const certInDate = (c, today = todayISO()) => !!c && !(c.expiryDate && String(c.expiryDate).slice(0, 10) < today);   // still in date on its expiry day

/**
 * The staff dashboard figure for one person.
 * @param p.mods, p.comps   as trainingCompliance
 * @param p.certs           their uploaded external certificates ({ [type]: { expiryDate } }), only uploaded ones count
 * @param p.lastDse         their latest DSE report (or null) and p.dseRenewalMonths
 */
export function personalCompliance({ mods, comps, certs = {}, lastDse = null, dseRenewalMonths = 12 }) {
  const t = trainingCompliance(mods, comps);
  const certList = Object.values(certs || {}).filter(Boolean);
  const certsGood = certList.filter(c => certInDate(c)).length;
  const dseEx = lastDse ? getExpiryStatus(lastDse.date, dseRenewalMonths) : null;
  const dseGood = !!lastDse && (!dseEx || dseEx.status !== "expired") ? 1 : 0;
  const total = t.total + certList.length + 1;   // +1 = the DSE assessment
  const good = t.good + certsGood + dseGood;
  return { pct: Math.round(good / total * 100), good, total, training: t };
}

/** Colour band and wording for a compliance %. */
export function complianceBand(pct) {
  if (pct === null || pct === undefined) return { key: "none", color: "#64748b", label: "No training assigned" };
  if (pct >= 100) return { key: "green", color: "#10b981", label: "Fully Compliant" };
  if (pct >= AMBER_FROM) return { key: "amber", color: "#f59e0b", label: "Mostly Compliant" };
  return { key: "red", color: "#ef4444", label: "Needs Attention" };
}

/** Status wording used on reports and exports, by band. */
export const STATUS_TEXT = { green: "Compliant", amber: "In Progress", red: "Overdue", none: "No training assigned" };

/**
 * One person's training figure for staff lists, reports and exports.
 * @param modules  all modules (objects); assigns/comps as held in the app's shared state (app/useAppState.js)
 * @returns { pct, good, total, band, status }  pct is 0 (band "none") when nothing is assigned
 */
export function staffTraining(userId, assigns, comps, modules) {
  const ids = ((assigns || {})[userId] || (assigns || {})[String(userId)] || []).map(String);
  const mods = (modules || []).filter(m => ids.includes(String(m.id)));
  const t = trainingCompliance(mods, (comps || {})[userId] || (comps || {})[String(userId)] || {});
  const band = t.total ? complianceBand(t.pct) : complianceBand(null);
  return { pct: t.total ? t.pct : 0, good: t.good, total: t.total, band, status: STATUS_TEXT[band.key] };
}

/** Darker band colours for printed / downloaded reports. */
export const PRINT_COLOR = { green: "#15803d", amber: "#b45309", red: "#dc2626", none: "#64748b" };
