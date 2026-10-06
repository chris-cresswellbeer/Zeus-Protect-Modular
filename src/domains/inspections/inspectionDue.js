/**
 * inspectionDue.js — which re-inspections are really due.
 *
 * Each inspection carries a "next due" date. Once the same kind of inspection has
 * been done again in the same place, the older record's date no longer matters:
 * only the LATEST inspection of each type at each location counts.
 * (Locations are compared ignoring case and extra spaces.)
 */
export const inspKey = i => `${i.type}|${String(i.location || "").trim().replace(/\s+/g, " ").toLowerCase()}`;

/** Map key → the latest inspection (by date, then by id) for that type and place. */
export function latestByKey(inspections) {
  const m = new Map();
  for (const i of inspections || []) {
    const k = inspKey(i); const cur = m.get(k);
    const later = !cur || String(i.date || "") > String(cur.date || "") || (String(i.date || "") === String(cur.date || "") && String(i.id) > String(cur.id));
    if (later) m.set(k, i);
  }
  return m;
}

/** The newer inspection that replaces this one, or null if this is the latest. */
export function supersededBy(ins, latest) {
  const l = latest.get(inspKey(ins));
  return l && l.id !== ins.id ? l : null;
}

/** Latest inspections whose next-due date has passed, soonest-overdue first. */
export function overdueInspections(inspections, today) {
  return [...latestByKey(inspections).values()]
    .filter(i => i.nextDue && i.nextDue < today)
    .sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)));
}
