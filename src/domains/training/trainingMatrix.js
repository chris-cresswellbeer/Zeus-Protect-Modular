/**
 * ═══════════════════════════════════════════════════════════════════════════
 * trainingMatrix.js — staff × module training matrix (data + Excel export)
 * ═══════════════════════════════════════════════════════════════════════════
 * buildTrainingMatrix() works out one status per staff member per module:
 *
 *   valid     – completed and in date                      (green)
 *   expiring  – completed, expires within EXPIRY_WARNING_DAYS (amber)
 *   expired   – completed but past its renewal date        (red)
 *   missing   – assigned but never completed               (light red)
 *   na        – not assigned and not completed             (grey — not required)
 *
 * A module completed WITHOUT being assigned still shows its real status (flag
 * `assigned:false`) — it just doesn't count towards that person's compliance.
 * Compliance = assigned modules that are valid or expiring ÷ assigned modules.
 * Hidden modules (_hidden, retired in the Training Library) are never shown or counted.
 * (A major new module version clears completions, so those show as "missing".)
 *
 * exportTrainingMatrixXlsx() writes a 3-sheet workbook: the coloured matrix,
 * a filterable one-row-per-person-per-module detail list, and a per-module summary.
 * Pure JS — no React — so it can be tested on its own.
 */
import { isPassed } from "./completion";
import { getExpiryStatus, EXPIRY_WARNING_DAYS } from "../../lib/dates";
import { buildXlsx, downloadBlob, colName } from "../../lib/xlsxWriter";

const MATRIX_STATUS = {
  valid:    { key: "valid",    label: "Complete — in date",                     symbol: "✓", fill: "C6EFCE", text: "006100" },
  expiring: { key: "expiring", label: `Expiring within ${EXPIRY_WARNING_DAYS} days`, symbol: "!", fill: "FFEB9C", text: "9C5700" },
  expired:  { key: "expired",  label: "Expired — renewal overdue",              symbol: "✗", fill: "F8696B", text: "FFFFFF" },
  missing:  { key: "missing",  label: "Assigned — not completed",               symbol: "○", fill: "FFC7CE", text: "9C0006" },
  na:       { key: "na",       label: "Not required",                           symbol: "",  fill: "F2F2F2", text: "808080" },
};

const fmtDate = d => { if (!d) return ""; const [y, m, day] = String(d).slice(0, 10).split("-"); return y && m && day ? `${day}/${m}/${y.slice(2)}` : String(d); };
const fmtLong = d => { if (!d) return ""; const [y, m, day] = String(d).slice(0, 10).split("-"); return y && m && day ? `${day}/${m}/${y}` : String(d); };

function cellFor(user, mod, assigns, comps) {
  const assigned = (assigns[user.id] || []).map(String).includes(String(mod.id));
  const comp = (comps[user.id] || {})[mod.id];
  if (!comp || !isPassed(comp, mod)) return { status: assigned ? "missing" : "na", assigned };
  const ex = mod.renewalMonths ? getExpiryStatus(comp.date, mod.renewalMonths) : null;
  return {
    status: ex ? (ex.status === "expired" ? "expired" : ex.status === "expiring" ? "expiring" : "valid") : "valid",
    assigned, completed: comp.date || "", expires: ex ? ex.expiryDate : "", daysLeft: ex ? ex.daysLeft : null,
    score: comp.recorded ? "Recorded" : comp.score, recorded: !!comp.recorded, certId: comp.certId || "", version: comp.moduleVersion || null,
    how: comp.recorded ? (comp.recorded.session ? "Group session" : "Recorded by admin") : "Portal quiz",
    evidence: comp.recorded ? ((comp.recorded.evidence || []).length ? "Yes" : "No") : "",
  };
}

/**
 * @param {object} p
 *   staff, modules, assigns, comps  — as held in App.jsx
 *   filter: { manager, department, search, includeLeavers, onlyNonCompliant, allModules }
 */
function buildTrainingMatrix({ staff, modules, assigns, comps, filter = {} }) {
  const q = (filter.search || "").trim().toLowerCase();
  let people = (staff || []).filter(u =>
    (filter.includeLeavers || (u.status || "active") !== "leaver") &&
    (!filter.manager || filter.manager === "all" || (u.manager || "") === filter.manager) &&
    (!filter.department || filter.department === "all" || (u.department || "") === filter.department) &&
    (!q || [u.name, u.jobTitle, u.manager, u.department].some(v => String(v || "").toLowerCase().includes(q))));

  // Columns: modules assigned to / completed by anyone shown (or every module).
  // Hidden (retired) modules are left out entirely — they don't count towards
  // anyone's compliance. Unhide a module in the Training Library to bring it back.
  const used = new Set();
  people.forEach(u => {
    (assigns[u.id] || []).forEach(id => used.add(String(id)));
    Object.keys(comps[u.id] || {}).forEach(id => used.add(String(id)));
  });
  const cols = (modules || [])
    .filter(m => !m._hidden && (filter.allModules || used.has(String(m.id))))
    .sort((a, b) => String(a.category || "").localeCompare(String(b.category || "")) || String(a.title).localeCompare(String(b.title)));

  let rows = people.map(u => {
    const cells = cols.map(m => cellFor(u, m, assigns, comps));
    const assignedCells = cells.filter(c => c.assigned);
    const ok = assignedCells.filter(c => c.status === "valid" || c.status === "expiring").length;
    return {
      user: u, cells,
      assigned: assignedCells.length, ok,
      pct: assignedCells.length ? Math.round(ok / assignedCells.length * 100) : null,
    };
  });
  if (filter.onlyNonCompliant) rows = rows.filter(r => r.pct !== null && r.pct < 100);
  rows.sort((a, b) => String(a.user.name).localeCompare(String(b.user.name)));

  const colStats = cols.map((m, ci) => {
    const s = { assigned: 0, valid: 0, expiring: 0, expired: 0, missing: 0 };
    rows.forEach(r => { const c = r.cells[ci]; if (!c.assigned) return; s.assigned++; s[c.status] = (s[c.status] || 0) + 1; });
    s.pct = s.assigned ? Math.round((s.valid + s.expiring) / s.assigned * 100) : null;
    return s;
  });
  const totAssigned = rows.reduce((s, r) => s + r.assigned, 0);
  const totOk = rows.reduce((s, r) => s + r.ok, 0);
  const totals = {
    staff: rows.length, modules: cols.length, assigned: totAssigned, ok: totOk,
    pct: totAssigned ? Math.round(totOk / totAssigned * 100) : null,
    fullyCompliant: rows.filter(r => r.pct === 100).length,
    withTraining: rows.filter(r => r.pct !== null).length,     // staff who have at least one module assigned
    expired: rows.reduce((s, r) => s + r.cells.filter(c => c.assigned && c.status === "expired").length, 0),
    expiring: rows.reduce((s, r) => s + r.cells.filter(c => c.assigned && c.status === "expiring").length, 0),
    missing: rows.reduce((s, r) => s + r.cells.filter(c => c.status === "missing").length, 0),
  };
  return { cols, rows, colStats, totals };
}

function cellText(c) {
  if (c.status === "na") return "";
  if (c.status === "missing") return "Not done";
  if (c.status === "expired") return `Exp ${fmtDate(c.expires)}`;
  if (c.status === "expiring") return `Due ${fmtDate(c.expires)}`;
  return fmtDate(c.completed);
}

/** Download the matrix as an .xlsx file. `filterText` describes the filters used. */
function exportTrainingMatrixXlsx(matrix, { filterText = "", companyName = "Zeus Protect", filename } = {}) {
  const { cols, rows, colStats, totals } = matrix;
  const today = new Date().toISOString().slice(0, 10);
  const FIXED = 4;                                     // Name, Job title, Manager, Compliance
  const lastCol = colName(FIXED + cols.length - 1);
  const st = k => ({ fill: MATRIX_STATUS[k].fill, color: MATRIX_STATUS[k].text, h: "center", v: "center", border: true, size: 9, bold: k === "expired" });
  const head = { bold: true, fill: "1F3864", color: "FFFFFF", border: true, v: "center", wrap: true };
  const pctStyle = p => ({ numFmt: "0%", h: "center", border: true, bold: true,
    fill: p === null ? "F2F2F2" : p >= 1 ? "C6EFCE" : p >= 0.8 ? "FFEB9C" : "FFC7CE", color: p === null ? "808080" : p >= 1 ? "006100" : p >= 0.8 ? "9C5700" : "9C0006" });

  // ── Sheet 1: matrix ──
  const s1 = [];
  s1.push([{ v: `Training Matrix — ${companyName}`, s: { bold: true, size: 16, color: "1F3864" } }]);
  s1.push([{ v: `Generated ${fmtLong(today)}${filterText ? " · " + filterText : ""} · ${totals.staff} staff · ${totals.modules} modules · Overall compliance ${totals.pct === null ? "n/a" : totals.pct + "%"} · ${totals.fullyCompliant} of ${totals.withTraining} staff with assigned training fully compliant`, s: { italic: true, color: "595959" } }]);
  s1.push([{ v: "Key:", s: { bold: true } }, ...Object.values(MATRIX_STATUS).map(x => ({ v: x.label, s: { ...st(x.key), wrap: true } }))]);
  s1.push([]);
  // category band
  const catRow = [null, null, null, null];
  const merges = [`A1:${lastCol}1`, `A2:${lastCol}2`];
  let i = 0;
  while (i < cols.length) {
    let j = i; const cat = cols[i].category || "Other";
    while (j + 1 < cols.length && (cols[j + 1].category || "Other") === cat) j++;
    catRow[FIXED + i] = { v: cat, s: { bold: true, fill: "D9E1F2", color: "1F3864", h: "center", border: true, wrap: true, size: 9 } };
    for (let k = i + 1; k <= j; k++) catRow[FIXED + k] = { v: "", s: { fill: "D9E1F2", border: true } };
    if (j > i) merges.push(`${colName(FIXED + i)}5:${colName(FIXED + j)}5`);
    i = j + 1;
  }
  s1.push(catRow);
  s1.push([{ v: "Name", s: head }, { v: "Job title", s: head }, { v: "Line manager", s: head }, { v: "Compliance", s: { ...head, h: "center" } },
    ...cols.map(m => ({ v: m.title + (m.renewalLabel ? ` (${m.renewalLabel})` : ""), s: { ...head, rotate: 90, h: "center", size: 9 } }))]);
  rows.forEach(r => {
    s1.push([
      { v: r.user.name, s: { bold: true, border: true } },
      { v: r.user.jobTitle || "", s: { border: true, size: 9 } },
      { v: r.user.manager || "", s: { border: true, size: 9 } },
      r.pct === null ? { v: "No training assigned", s: { ...pctStyle(null), size: 8, numFmt: undefined } } : { v: r.pct / 100, s: pctStyle(r.pct / 100) },
      ...r.cells.map(c => ({ v: cellText(c) + (c.status !== "na" && !c.assigned ? " *" : ""), s: st(c.status) })),
    ]);
  });
  s1.push([{ v: "Module compliance", s: { ...head, fill: "D9E1F2", color: "1F3864" } }, { v: "", s: { fill: "D9E1F2", border: true } }, { v: "", s: { fill: "D9E1F2", border: true } },
    totals.pct === null ? { v: "", s: pctStyle(null) } : { v: totals.pct / 100, s: pctStyle(totals.pct / 100) },
    ...colStats.map(s => s.pct === null ? { v: "—", s: { ...pctStyle(null), numFmt: undefined } } : { v: s.pct / 100, s: pctStyle(s.pct / 100) })]);
  s1.push([]);
  s1.push([{ v: "* completed although not assigned — shown for information, not counted in compliance. Compliance = assigned modules complete and in date ÷ assigned modules.", s: { italic: true, color: "595959", size: 9 } }]);

  // ── Sheet 2: detail list ──
  const dHead = ["Name", "Job title", "Line manager", "Department", "Module", "Category", "Renewal", "Assigned", "Status", "Completed", "Score %", "Expires", "Days left", "Certificate ID", "Module version", "How completed", "Evidence on file"];
  const s2 = [dHead.map(h => ({ v: h, s: head }))];
  rows.forEach(r => r.cells.forEach((c, ci) => {
    if (c.status === "na") return;
    const m = cols[ci];
    s2.push([r.user.name, r.user.jobTitle || "", r.user.manager || "", r.user.department || "", m.title, m.category || "", m.renewalLabel || (m.renewalMonths ? `${m.renewalMonths} months` : "No renewal"),
      c.assigned ? "Yes" : "No", { v: MATRIX_STATUS[c.status].label, s: { fill: MATRIX_STATUS[c.status].fill, color: MATRIX_STATUS[c.status].text } },
      fmtLong(c.completed), typeof c.score === "number" ? c.score : (c.score ? Number(c.score) || c.score : ""), fmtLong(c.expires),
      c.daysLeft === null || c.daysLeft === undefined ? "" : c.daysLeft, c.certId || "", c.version || "", c.how || "",
      c.evidence === "No" ? { v: "No", s: { fill: "FFEB9C", color: "9C5700" } } : (c.evidence || "")]);
  }));

  // ── Sheet 3: per-module summary ──
  const s3 = [["Module", "Category", "Renewal", "Staff assigned", "Complete (in date)", "Expiring", "Expired", "Not completed", "Compliance"].map(h => ({ v: h, s: head }))];
  cols.forEach((m, ci) => { const s = colStats[ci];
    s3.push([m.title, m.category || "", m.renewalLabel || "", s.assigned, s.valid, s.expiring, s.expired, s.missing, s.pct === null ? "—" : { v: s.pct / 100, s: pctStyle(s.pct / 100) }]); });

  const blob = buildXlsx([
    { name: "Training Matrix", rows: s1, merges, freeze: { row: 6, col: 1 }, landscape: true,
      cols: [26, 24, 20, 12, ...cols.map(() => 11.5)], rowHeights: { 0: 24, 2: 42, 4: 30, 5: 190 } },
    { name: "Detail", rows: s2, freeze: { row: 1, col: 1 }, autoFilter: `A1:${colName(dHead.length - 1)}${s2.length}`,
      cols: [24, 24, 20, 16, 34, 20, 12, 10, 30, 12, 9, 12, 10, 18, 10, 18, 12] },
    { name: "By Module", rows: s3, freeze: { row: 1, col: 1 }, cols: [36, 22, 12, 14, 16, 10, 10, 14, 12] },
  ]);
  downloadBlob(blob, filename || `Training_Matrix_${today}.xlsx`);
  return blob;
}

export { buildTrainingMatrix, exportTrainingMatrixXlsx, MATRIX_STATUS, cellText as matrixCellText };
