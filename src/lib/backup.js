/**
 * ═══════════════════════════════════════════════════════════════════════════
 * backup.js — download a full copy of the portal's records (admins only)
 * ═══════════════════════════════════════════════════════════════════════════
 * Supabase's free plan keeps no backups you can download, so an admin can save
 * one here (Documents ▼ → Audit Trail → Download full backup). The download is a
 * .zip holding:
 *   • zeus-protect-backup.json  every row of every table, exactly as stored —
 *                               the copy to restore from if records are ever lost
 *   • zeus-protect-backup.xlsx  the same, one sheet per table, for reading
 *   • READ ME.txt               what's in it and what isn't
 * Not included: uploaded files (they stay in Supabase Storage) and old-style
 * password hashes. Each download is logged in the Audit Trail ("backup"), which
 * is also how the portal knows when the last one was taken.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { sb } from "./supabase";
import { buildXlsx, zipStore } from "./xlsxWriter";

export const BACKUP_TABLES = [
  "users", "user_profiles", "last_logins", "dashboard_layout",
  "training_assigns", "training_completions", "training_completion_history", "quiz_failures",
  "custom_modules", "module_versions",
  "documents", "doc_bundles", "doc_assignments", "doc_acknowledgements", "doc_ack_history",
  "dse_reports", "dse_admin_responses", "ext_certs",
  "incidents", "investigations", "site_inspections", "equipment", "machine_completions", "custom_machine_types",
  "risk_assessments", "coshh_assessments", "custom_chemicals", "msds_files",
  "fire_wardens", "fire_drills", "fire_alarm_tests", "fire_extinguishers", "fire_emerg_lighting", "fire_fra_reviews",
  "first_aid_register", "contractors", "contractor_inductions", "contractor_certs", "contractor_visits", "permits",
  "audit_log",
];
const PAGE = 1000;               // Supabase returns at most 1000 rows per request
const CELL_MAX = 32000;          // Excel's limit is 32,767 characters per cell

/** Every row of one table, read a page at a time. */
export async function fetchAllRows(table) {
  const rows = [];
  for (let offset = 0; offset < 1e6; offset += PAGE) {
    const { data, error } = await sb.from(table).query(`select=*&limit=${PAGE}&offset=${offset}`);
    if (error) return { rows, error: String(error).slice(0, 200) };
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return { rows, error: null };
}

const cellText = v => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return v;
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > CELL_MAX ? s.slice(0, CELL_MAX) + " …(cut short — full value in the .json file)" : s;
};

/**
 * Read everything and build the .zip. onProgress(done, total, table) is called as
 * each table is read. Returns { blob, counts: {table: rows}, errors: {table: msg}, total }.
 */
export async function buildBackup({ by = "", onProgress } = {}) {
  const tables = {}, counts = {}, errors = {};
  let done = 0;
  for (const t of BACKUP_TABLES) {
    const r = await fetchAllRows(t);
    tables[t] = r.rows; counts[t] = r.rows.length;
    if (r.error) errors[t] = r.error;
    done++; if (onProgress) onProgress(done, BACKUP_TABLES.length, t);
  }
  const created = new Date().toISOString();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const json = JSON.stringify({ app: "Zeus Protect", kind: "full backup", format: 1, created, createdBy: by, counts, errors, tables }, null, 1);

  const head = { bold: true, color: "FFFFFF", fill: "0D1F5C" };
  const sheets = [{
    name: "Contents", cols: [32, 12, 60],
    rows: [[{ v: `Zeus Protect — full backup, ${created.slice(0, 16).replace("T", " ")} UTC${by ? `, by ${by}` : ""}`, s: { bold: true, size: 13 } }], [],
      [{ v: "Table", s: head }, { v: "Rows", s: head }, { v: "Note", s: head }],
      ...BACKUP_TABLES.map(t => [t, counts[t], errors[t] ? `Not read: ${errors[t]}` : ""])],
  }];
  BACKUP_TABLES.forEach(t => {
    const rows = tables[t];
    if (!rows.length) return;
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
    sheets.push({ name: t, freeze: { row: 1, col: 0 }, cols: keys.map(() => 22),
      rows: [keys.map(k => ({ v: k, s: head })), ...rows.map(r => keys.map(k => cellText(r[k])))] });
  });
  const xlsx = new Uint8Array(await buildXlsx(sheets).arrayBuffer());
  const readme = [
    "Zeus Protect — full backup",
    `Taken: ${created}${by ? ` by ${by}` : ""}`,
    `Records: ${total} in ${BACKUP_TABLES.length} tables${Object.keys(errors).length ? ` (${Object.keys(errors).length} could not be read — see the Contents sheet)` : ""}`,
    "",
    "zeus-protect-backup.json  Every row of every table, exactly as stored. Keep this: it's the copy to restore from.",
    "zeus-protect-backup.xlsx  The same records, one sheet per table, for reading. Very long values are cut short here.",
    "",
    "Not included: uploaded files (documents, certificates, photos stay in Supabase Storage),",
    "and passwords (sign-in accounts are managed by Supabase).",
    "",
    "Store this file somewhere safe and private: it contains staff and incident records.",
  ].join("\r\n");
  const enc = new TextEncoder();
  const zip = zipStore([
    { name: "zeus-protect-backup.json", data: enc.encode(json) },
    { name: "zeus-protect-backup.xlsx", data: xlsx },
    { name: "READ ME.txt", data: enc.encode(readme) },
  ]);
  return { blob: new Blob([zip], { type: "application/zip" }), counts, errors, total };
}

/** When the last backup was downloaded (from the Audit Trail), or null. */
export async function lastBackupAt() {
  const { data, error } = await sb.from("audit_log").query("select=at&entity=eq.backup&order=at.desc&limit=1");
  if (error || !Array.isArray(data)) return null;
  const rows = data.filter(r => r && r.at && (r.entity === undefined || r.entity === "backup")).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return rows.length ? rows[0].at : null;
}
