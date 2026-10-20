/**
 * lib/rackingExport.js — the racking damage register and inspections as an Excel file.
 * Pure: builds the sheets for lib/xlsxWriter.js buildXlsx(). Used by Equipment → Racking
 * ("Export to Excel"). Every damage report, open and closed, newest first, plus the
 * racking checks and expert inspections.
 */
import { damageState, bayName, DEFAULT_RACKING_SETTINGS } from "./racking";

const day = v => (v ? String(v).slice(0, 10) : "");
const RATING = { red: "Red", amber: "Amber", green: "Green" };
const STATUS = { open: "Open", repaired: "Repaired", dismissed: "Closed without repair" };

export function rackingWorkbook({ damage = [], locations = [], checks = [], settings = DEFAULT_RACKING_SETTINGS, now = new Date().toISOString(), company = "" } = {}) {
  const H = { bold: true, fill: "0D1F5C", color: "FFFFFF", border: true, wrap: true, v: "center" };
  const FILL = { red: "FEE2E2", amber: "FEF3C7", green: "DCFCE7" };
  const locOf = id => locations.find(l => l.id === id) || null;
  const head = ["Bay", "Aisle", "Bay no.", "Level(s)", "Part", "Rating", "Status", "Now", "Reported", "Reported by", "Reporter's rating", "Confirmed by", "Confirmed",
    "Offloaded", "Repair booked for", "Repair by (amber)", "Repaired", "Repaired by", "Repair note", "Closed because", "Note", "Seen again", "Photos"];
  const rows = [...damage].sort((a, b) => String(b.created_at || (b.data || {}).reportedAt || "").localeCompare(String(a.created_at || (a.data || {}).reportedAt || "")))
    .map(r => {
      const d = r.data || {}, loc = locOf(r.location_id), st = damageState(r, settings, now);
      const style = { border: true, fill: r.status === "open" ? FILL[r.rating] : undefined };
      return [loc ? bayName(loc) : r.location_id, loc ? loc.aisle : "", loc ? loc.bay : "", (d.levels || []).join(", "), d.part || "",
        { v: RATING[r.rating] || r.rating || "", s: style }, STATUS[r.status] || r.status || "", st.label,
        day(d.reportedAt || r.created_at), d.reportedBy || "", RATING[d.suggested] || "", d.confirmedBy || "", day(d.confirmedAt),
        day(d.offloadedAt), day(d.repairBooked), r.status === "open" && r.rating === "amber" ? st.due || "" : "",
        day(d.repair && (d.repair.on || d.repair.at)), (d.repair && d.repair.by) || "", (d.repair && d.repair.note) || "",
        (d.dismissed && d.dismissed.why) || "", d.note || "", (d.seenAgain || []).length || "", (d.photos || []).length || ""];
    });
  const last = n => { let s = "", x = n; while (x > 0) { const m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = Math.floor((x - 1) / 26); } return s; };
  const register = { name: "Damage register", cols: [20, 7, 7, 9, 22, 9, 18, 22, 11, 18, 10, 18, 11, 11, 12, 12, 11, 18, 30, 26, 36, 9, 8],
    rows: [[{ v: `Racking damage register${company ? `: ${company}` : ""}`, s: { bold: true, size: 14 } }], [`Exported ${day(now)}. Open rows are coloured by rating.`], [],
      head.map(v => ({ v, s: H })), ...rows],
    freeze: { row: 4, col: 1 }, autoFilter: `A4:${last(head.length)}${rows.length + 4}` };
  const ck = [...checks].sort((a, b) => String((b.data || {}).date || "").localeCompare(String((a.data || {}).date || "")));
  const inspections = { name: "Inspections", cols: [12, 18, 20, 24, 40, 14],
    rows: [[{ v: "Date", s: H }, { v: "Kind", s: H }, { v: "Recorded by", s: H }, { v: "Aisles / inspector", s: H }, { v: "Findings / summary", s: H }, { v: "Next due", s: H }],
      ...ck.map(c => { const d = c.data || {}; return [day(d.date), c.kind === "expert" ? "Expert inspection" : "Racking check", d.by || "", c.kind === "expert" ? d.inspector || "" : d.aisles || "", d.notes || "", day(d.nextDue)]; })],
    freeze: { row: 1, col: 0 }, autoFilter: `A1:F${ck.length + 1}` };
  return [register, inspections];
}
