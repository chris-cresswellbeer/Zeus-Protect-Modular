/**
 * machineMatrix.js — the Machinery Competence matrix (people × machine types) and its
 * Excel export. Pure functions; the screen is AdminMachineryTab.jsx.
 *
 * buildMachineMatrix({ staff, types, comps, filter }) →
 *   { cols:[type], rows:[{ user, cells:[{ comp|null, st|null }], counts }], totals }
 *   filter: { search, manager, show, allTypes, category }
 *     show: "all" | "attention" (expired + expiring) | "expired" | "expiring" | "provisional"
 *     allTypes: include machine types nobody here has a record for
 * Only warehouse workers (isWarehouseWorker) who aren't leavers are included.
 */
import { isWarehouseWorker, machineState, compsFor, MACHINE_STATE } from "../../data/seedMachinery";
import { buildXlsx, downloadBlob, colName } from "../../lib/xlsxWriter";

export const SHOW_OPTIONS = [
  ["all", "Everyone"],
  ["attention", "Needs attention (expired or expiring)"],
  ["expired", "Renewal required"],
  ["expiring", "Expiring within 60 days"],
  ["provisional", "Provisional"],
  ["competent", "Competent"],
];

const fmt = d => { const [y, m, day] = String(d || "").slice(0, 10).split("-"); return y && m && day ? `${day}/${m}/${y}` : ""; };

export function machineOperators(staff) {
  return (staff || []).filter(u => u.role !== "admin" && (u.status || "active") !== "leaver" && isWarehouseWorker(u));
}

export function buildMachineMatrix({ staff, types, comps, filter = {} }) {
  const q = String(filter.search || "").trim().toLowerCase();
  const show = filter.show || "all";
  const want = show === "attention" ? ["expired", "expiring"] : show === "all" ? null : [show];
  let people = machineOperators(staff)
    .filter(u => !filter.manager || (u.manager || "") === filter.manager)
    .filter(u => !q || [u.name, u.jobTitle, u.manager].some(v => String(v || "").toLowerCase().includes(q)));
  let typeList = (types || []).filter(t => !filter.category || t.category === filter.category);

  const rowsAll = people.map(user => {
    const mine = compsFor(comps, user.id);
    const cells = typeList.map(t => {
      const comp = mine.find(c => c.machineId === t.id) || null;
      return { comp, st: comp ? machineState(comp, types) : null };
    });
    return { user, cells };
  });
  let rows = want ? rowsAll.filter(r => r.cells.some(c => c.st && want.includes(c.st.key))) : rowsAll;

  // columns: types that somebody shown has a record for (or all, if asked)
  const keep = typeList.map((t, i) => filter.allTypes || rows.some(r => r.cells[i].comp));
  const cols = typeList.filter((_, i) => keep[i]);
  rows = rows.map(r => {
    const cells = r.cells.filter((_, i) => keep[i]);
    const counts = Object.fromEntries(Object.keys(MACHINE_STATE).map(k => [k, cells.filter(c => c.st && c.st.key === k).length]));
    return { ...r, cells, counts, records: cells.filter(c => c.comp).length };
  });
  // totals ignore the Show filter (so clicking a total doesn't change the others)
  const count = k => rowsAll.reduce((n, r) => n + r.cells.filter(c => c.st && c.st.key === k).length, 0);
  const totals = { people: rows.length, operators: rowsAll.length, types: cols.length,
    competent: count("competent"), expiring: count("expiring"), expired: count("expired"), provisional: count("provisional"), not_assessed: count("not_assessed") };
  return { cols, rows, totals };
}

/** Text for a cell in Excel. */
function cellText(c) {
  if (!c.st) return "";
  const ex = c.st.ex;
  if (c.st.key === "provisional" || c.st.key === "not_assessed") return c.st.label;
  return ex ? `${c.st.sym} ${fmt(ex.expiryDate)}` : c.st.sym;
}

export function exportMachineMatrixXlsx(matrix, { filterText = "", companyName = "Zeus Protect", filename } = {}) {
  const { cols, rows, totals } = matrix;
  const today = new Date().toISOString().slice(0, 10);
  const FIXED = 3;
  const lastCol = colName(Math.max(FIXED + cols.length - 1, 5));
  const head = { bold: true, fill: "1F3864", color: "FFFFFF", border: true, v: "center", wrap: true };
  const st = k => ({ fill: MACHINE_STATE[k].fill, color: MACHINE_STATE[k].text, h: "center", v: "center", border: true, size: 9, bold: k === "expired" });

  const s1 = [];
  s1.push([{ v: `Machinery Competence Matrix — ${companyName}`, s: { bold: true, size: 16, color: "1F3864" } }]);
  s1.push([{ v: `Generated ${fmt(today)}${filterText ? " · " + filterText : ""} · ${totals.people} operators · ${totals.competent} competent · ${totals.expiring} expiring within 60 days · ${totals.expired} renewal required · ${totals.provisional} provisional`, s: { italic: true, color: "595959" } }]);
  s1.push([{ v: "Key:", s: { bold: true } }, ...Object.values(MACHINE_STATE).map(x => ({ v: `${x.sym} ${x.label}`, s: { ...st(x.key), wrap: true } }))]);
  s1.push([]);
  s1.push([{ v: "Name", s: head }, { v: "Job title", s: head }, { v: "Line manager", s: head },
    ...cols.map(t => ({ v: `${t.label}${t.renewalMonths ? ` (renew ${t.renewalMonths}m)` : ""}`, s: { ...head, rotate: 90, h: "center", size: 9 } }))]);
  rows.forEach(r => s1.push([
    { v: r.user.name, s: { bold: true, border: true } },
    { v: r.user.jobTitle || "", s: { border: true, size: 9 } },
    { v: r.user.manager || "", s: { border: true, size: 9 } },
    ...r.cells.map(c => c.st ? { v: cellText(c), s: st(c.st.key) } : { v: "", s: { border: true } }),
  ]));
  s1.push([]);
  s1.push([{ v: "Dates shown are when each competence must be renewed: the earlier of the renewal date (assessment date + the machine's renewal period) and the licence expiry date.", s: { italic: true, color: "595959", size: 9 } }]);

  const dHead = ["Name", "Job title", "Line manager", "Machine", "Category", "Status", "Theory / induction", "Practical assessment", "Licence ref", "Licence expiry", "Renew by", "Days left", "Trainer", "Trainer qualification", "Observations", "Files on record", "Notes"];
  const s2 = [dHead.map(h => ({ v: h, s: head }))];
  rows.forEach(r => r.cells.forEach((c, i) => {
    if (!c.comp) return;
    const t = cols[i], ex = c.st.ex, comp = c.comp;
    s2.push([r.user.name, r.user.jobTitle || "", r.user.manager || "", t.label, t.category || "",
      { v: c.st.label, s: { fill: c.st.fill, color: c.st.text } },
      fmt(comp.theoryDate), fmt(comp.assessmentDate), comp.licenceRef || "", fmt(comp.licenceExpiry),
      ex ? fmt(ex.expiryDate) : "", ex ? ex.daysLeft : "", comp.trainerName || "", comp.trainerQual || "",
      (comp.observationDates || []).length || "", (comp.fileNames || []).length || "", comp.notes || ""]);
  }));

  const blob = buildXlsx([
    { name: "Machinery Matrix", rows: s1, merges: [`A1:${lastCol}1`, `A2:${lastCol}2`], freeze: { row: 5, col: 1 }, landscape: true,
      cols: [26, 24, 20, ...cols.map(() => 11.5)], rowHeights: { 0: 24, 2: 30, 4: 170 } },
    { name: "Detail", rows: s2, freeze: { row: 1, col: 1 }, autoFilter: `A1:${colName(dHead.length - 1)}${s2.length}`,
      cols: [24, 22, 20, 28, 14, 18, 14, 14, 18, 14, 12, 10, 20, 20, 12, 12, 40] },
  ]);
  downloadBlob(blob, filename || `Machinery_Competence_${today}.xlsx`);
  return blob;
}
