/**
 * ═══════════════════════════════════════════════════════════════════════════
 * domains/firstAid/firstAidLogic.js — the first aid rules, in one place
 * ═══════════════════════════════════════════════════════════════════════════
 * Used by the First Aid register tab AND the admin dashboard card, which used to
 * work these out separately (and disagreed: the dashboard ignored first aiders with
 * no expiry date, the register counted them).
 *
 *   mergeAiders()    first aiders entered on the register, plus anyone with a
 *                    "first_aid" external certificate; a register entry for the same
 *                    person replaces the certificate one.
 *   aiderState()     "valid" | "expiring" (within EXPIRY_WARNING_DAYS) | "expired" | "undated"
 *                    — the same date rule as fire wardens (fireSafety/fireLogic.js expiryState)
 *   counts for cover a first aider whose certificate is in date (valid or expiring).
 *                    One with NO expiry date is not counted — add the date to count them.
 *   coverageCount()  in-date first aiders covering a zone on a shift (no zones/shifts
 *                    listed, or an "All shifts" choice, = covers everywhere/always)
 *   firstAidSummary() everything the dashboard card and the register's header need.
 * Pure JS (no React).
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { expiryState } from "../fireSafety/fireLogic";
import { isAllShift, coverShifts } from "../../lib/siteLists";

/** valid | expiring | expired | undated — the same date rule as fire wardens (fireLogic expiryState). */
export function aiderState(expiryDate) {
  const k = expiryState(expiryDate || null).key;
  return k === "unknown" ? "undated" : k;
}

/** Counts towards first aid cover. */
export const aiderInDate = a => { const s = aiderState(a && a.expiryDate); return s === "valid" || s === "expiring"; };

/** Register entries + certificate holders (register entry wins for the same person). */
export function mergeAiders(firstAidData, extCerts, staff) {
  const aiders = (firstAidData && firstAidData.aiders) || [];
  const certAiders = [];
  Object.entries(extCerts || {}).forEach(([uid, certs]) => {
    const c = certs && certs.first_aid;
    if (!c) return;
    const u = (staff || []).find(s => String(s.id) === String(uid));
    if (!u) return;
    certAiders.push({
      _fromCert: true, id: `cert_${uid}`, staffId: uid, name: u.name, jobTitle: u.jobTitle || "",
      certType: "First Aid at Work (FAW)", issuedDate: c.issuedDate || "", expiryDate: c.expiryDate || "",
      shifts: c.shifts || [], zones: c.zones || [], phone: "", isLead: false,
    });
  });
  const manual = new Set(aiders.filter(a => a.staffId).map(a => String(a.staffId)));
  return [...aiders, ...certAiders.filter(c => !manual.has(String(c.staffId)))];
}

/** Does this first aider cover this zone on this shift? (ignores dates) */
export function covers(a, zone, shift) {
  const shiftsOk = !(a.shifts && a.shifts.length) || a.shifts.some(isAllShift) || a.shifts.includes(shift);
  const zonesOk = !(a.zones && a.zones.length) || a.zones.includes(zone);
  return shiftsOk && zonesOk;
}

/** In-date first aiders covering a zone on a shift. */
export const coverageCount = (aiders, zone, shift) => (aiders || []).filter(a => aiderInDate(a) && covers(a, zone, shift)).length;

/**
 * @param p.firstAidData  the register ({ aiders, kits, assessment, customZones })
 * @param p.extCerts, p.staff
 * @param p.zones, p.shifts  this site's lists (Site Settings); custom zones are added
 */
export function firstAidSummary({ firstAidData, extCerts, staff, zones = [], shifts = [] }) {
  const fa = firstAidData || {};
  const aiders = mergeAiders(fa, extCerts, staff);
  const by = s => aiders.filter(a => aiderState(a.expiryDate) === s);
  const allZones = [...new Set([...(zones || []), ...(fa.customZones || [])])];
  const minPerShift = (fa.assessment && fa.assessment.minPerShift) || 1;
  const shiftList = coverShifts(shifts);
  let gaps = 0;
  allZones.forEach(z => shiftList.forEach(s => { if (coverageCount(aiders, z, s) < minPerShift) gaps++; }));
  const valid = by("valid"), expiring = by("expiring"), expired = by("expired"), undated = by("undated");
  return { aiders, allZones, shiftList, minPerShift, valid, expiring, expired, undated,
    inDate: [...valid, ...expiring], gaps };
}
