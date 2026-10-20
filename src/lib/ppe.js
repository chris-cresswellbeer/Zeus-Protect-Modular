/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/ppe.js — the PPE issue register: the rules, shared by the portal and the phone
 * app. Pure, no React.
 * ═══════════════════════════════════════════════════════════════════════════
 * SETTINGS  app_settings row "ppe"
 *   { staffCanSee, dueSoonDays, statement, items:[{ id, name, standard, life, sizes:[] }] }
 *     staffCanSee  staff see "My PPE" (phone: More; desktop: a My PPE tab) and can sign there
 *     dueSoonDays  how far ahead "due for replacement" shows
 *     statement    what the person agrees to when they sign
 *     life         months until it should be replaced (0 = no fixed life, e.g. ear plugs)
 *
 * AN ISSUE  ppe_issues row { id, user_id, status, replace_by, data }   (ppe.sql)
 *   status   issued    they have it
 *            returned  handed back (leaver, no longer needed, damaged and disposed of)
 *            replaced  swapped for a new one (data.replacedBy is the new issue's id)
 *   data { userId, name, dept, itemId, item, standard, size, qty, reason, note,
 *          issuedOn (YYYY-MM-DD), issuedAt (ISO), issuedBy, life, replaceBy (YYYY-MM-DD|null),
 *          statement, signature (PNG data URL) | null, signedAt, signedVia ("in person"|"phone"|"portal"),
 *          problems:[{ kind, note, at, by, dealtBy?, dealtAt?, dealtNote? }],
 *          returnedOn, returnedBy, returnReason, replaces, replacedBy }
 * The person signing can only add their signature (once) and report problems: the database
 * trigger zp.guard_ppe enforces that (ppe.sql / db_rules.sql).
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const PPE_SETTINGS_ID = "ppe";

export const PPE_REASONS = [
  { id: "new", label: "New issue" },
  { id: "worn", label: "Replacing worn" },
  { id: "damaged", label: "Replacing damaged" },
  { id: "lost", label: "Replacing lost" },
  { id: "fit", label: "Different size" },
];
export const PPE_PROBLEMS = [
  { id: "damaged", label: "Damaged or worn out" },
  { id: "lost", label: "Lost" },
  { id: "fit", label: "Doesn't fit" },
  { id: "other", label: "Something else" },
];
export const PPE_RETURN_REASONS = ["Leaver", "No longer needed for the job", "Damaged, disposed of", "Issued by mistake"];

const range = (a, b, f = n => String(n)) => Array.from({ length: b - a + 1 }, (_, i) => f(a + i));
const CLOTHING = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
export const DEFAULT_PPE_ITEMS = [
  { id: "boots", name: "Safety boots", standard: "EN ISO 20345 S3 SRC", life: 12, sizes: range(3, 13, n => `UK ${n}`) },
  { id: "hivis-vest", name: "Hi-vis vest", standard: "EN ISO 20471 Class 2", life: 12, sizes: CLOTHING },
  { id: "hivis-jacket", name: "Hi-vis jacket", standard: "EN ISO 20471 Class 3", life: 12, sizes: CLOTHING },
  { id: "gloves", name: "Safety gloves (general handling)", standard: "EN 388", life: 3, sizes: ["6 (XS)", "7 (S)", "8 (M)", "9 (L)", "10 (XL)", "11 (2XL)"] },
  { id: "cut-gloves", name: "Cut-resistant gloves", standard: "EN 388 cut level C", life: 3, sizes: ["6 (XS)", "7 (S)", "8 (M)", "9 (L)", "10 (XL)", "11 (2XL)"] },
  { id: "glasses", name: "Safety glasses", standard: "EN ISO 16321 / EN 166", life: 6, sizes: ["One size"] },
  { id: "ear-defenders", name: "Ear defenders", standard: "EN 352-1", life: 12, sizes: ["One size"] },
  { id: "ear-plugs", name: "Ear plugs (reusable)", standard: "EN 352-2", life: 0, sizes: ["One size"] },
  { id: "bump-cap", name: "Bump cap", standard: "EN 812", life: 36, sizes: ["S", "M", "L"] },
];
export const DEFAULT_PPE_STATEMENT = "I have received the PPE listed, it fits me, and I have been shown how to wear, check and store it. I will wear it where it is required, and tell my supervisor if it is damaged, lost or no longer fits.";
export const DEFAULT_PPE_SETTINGS = { staffCanSee: true, dueSoonDays: 30, statement: DEFAULT_PPE_STATEMENT, items: DEFAULT_PPE_ITEMS };

const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const slug = s => str(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";

export function normalisePpeItem(it, i = 0) {
  const o = it && typeof it === "object" ? it : {};
  const life = Math.round(Number(o.life));
  const sizes = [...new Set((Array.isArray(o.sizes) ? o.sizes : String(o.sizes || "").split(",")).map(s => str(s, 30)).filter(Boolean))].slice(0, 40);
  return { id: str(o.id, 60) || `${slug(o.name)}-${i}`, name: str(o.name, 80), standard: str(o.standard, 80),
    life: Number.isFinite(life) && life >= 0 && life <= 120 ? life : 12, sizes: sizes.length ? sizes : ["One size"] };
}
export function normalisePpeSettings(d) {
  const s = d && typeof d === "object" ? d : {};
  const items = (Array.isArray(s.items) ? s.items : DEFAULT_PPE_ITEMS).map(normalisePpeItem).filter(x => x.name).slice(0, 100);
  const seen = new Set(); items.forEach((x, i) => { if (seen.has(x.id)) x.id = `${x.id}-${i}`; seen.add(x.id); });
  const days = Math.round(Number(s.dueSoonDays));
  return { staffCanSee: s.staffCanSee !== false, dueSoonDays: Number.isFinite(days) && days >= 1 && days <= 180 ? days : 30,
    statement: str(s.statement, 1000) || DEFAULT_PPE_STATEMENT, items };
}

/** "YYYY-MM-DD" + n months (31 Jan + 1 month → 28/29 Feb). */
export function addMonthsISO(iso, n) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
export const daysBetween = (a, b) => Math.round((Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`) - Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`)) / 86400000);
const londonToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const newId = now => `ppe_${Date.parse(now).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * A new issue of one item to one person.
 *   person   { id, name, department }
 *   item     an item from the settings (name, standard, life)
 *   by       who is issuing it (name)
 *   signature  PNG data URL when they sign there and then (else null: they sign later)
 */
export function newPpeIssue({ person, item, size = "", qty = 1, reason = "new", note = "", by = "", on, signature = null, signedVia = "in person", statement = DEFAULT_PPE_STATEMENT, replaces = null, now = new Date().toISOString() }) {
  const issuedOn = on || londonToday();
  const life = Number(item.life) || 0;
  const replaceBy = life > 0 ? addMonthsISO(issuedOn, life) : null;
  const q = Math.max(1, Math.min(99, Math.round(Number(qty)) || 1));
  const data = { userId: String(person.id), name: person.name || "", dept: person.department || "", itemId: item.id || slug(item.name), item: item.name, standard: item.standard || "",
    size: str(size, 30), qty: q, reason: PPE_REASONS.some(r => r.id === reason) ? reason : "new", note: str(note, 300),
    issuedOn, issuedAt: now, issuedBy: by, life, replaceBy, statement,
    signature: signature || null, signedAt: signature ? now : null, signedVia: signature ? signedVia : null, problems: [], ...(replaces ? { replaces } : {}) };
  return { id: newId(now), user_id: String(person.id), status: "issued", replace_by: replaceBy, data };
}

/** The person signs for it (once). */
export function signPpe(row, signature, via = "phone", now = new Date().toISOString()) {
  const d = row.data || {};
  if (d.signature) return row;
  return { ...row, data: { ...d, signature, signedAt: now, signedVia: via } };
}
/** The person reports a problem (damaged, lost, doesn't fit). */
export function reportPpeProblem(row, { kind = "other", note = "", by = "" }, now = new Date().toISOString()) {
  const d = row.data || {};
  const p = { kind: PPE_PROBLEMS.some(x => x.id === kind) ? kind : "other", note: str(note, 300), at: now, by };
  return { ...row, data: { ...d, problems: [...(d.problems || []), p].slice(-50) } };
}
/** An admin or line manager marks the open problems as dealt with (without replacing it). */
export function dealWithPpeProblems(row, { by = "", note = "" }, now = new Date().toISOString()) {
  const d = row.data || {};
  return { ...row, data: { ...d, problems: (d.problems || []).map(p => (p.dealtAt ? p : { ...p, dealtBy: by, dealtAt: now, dealtNote: str(note, 300) })) } };
}
/** Handed back. */
export function returnPpe(row, { by = "", reason = "", on }) {
  const d = row.data || {};
  return { ...row, status: "returned", data: { ...d, returnedOn: on || londonToday(), returnedBy: by, returnReason: str(reason, 120) } };
}
/** Swapped for a new one: the old issue is closed and points to the new one (and back). */
export function replacePpe(oldRow, newRow, { by = "", on } = {}) {
  const d = oldRow.data || {};
  const problems = (d.problems || []).map(p => (p.dealtAt ? p : { ...p, dealtBy: by, dealtAt: newRow.data.issuedAt, dealtNote: "Replaced" }));
  return [
    { ...oldRow, status: "replaced", data: { ...d, problems, returnedOn: on || newRow.data.issuedOn, returnedBy: by, returnReason: "Replaced", replacedBy: newRow.id } },
    { ...newRow, data: { ...newRow.data, replaces: oldRow.id } },
  ];
}

export const openProblems = row => ((row.data || {}).problems || []).filter(p => !p.dealtAt);

/**
 * Where an issue stands today. key: returned | replaced | problem | unsigned | overdue | soon | ok
 * (the first that applies, most urgent first). due: days until replacement (negative = overdue).
 */
export function ppeState(row, today = londonToday(), dueSoonDays = 30) {
  const d = row.data || {};
  if (row.status === "returned") return { key: "returned", label: "Returned", tone: "grey" };
  if (row.status === "replaced") return { key: "replaced", label: "Replaced", tone: "grey" };
  const rb = d.replaceBy || row.replace_by || null;
  const due = rb ? daysBetween(today, rb) : null;
  const flags = { problem: openProblems(row).length > 0, unsigned: !d.signature, overdue: due != null && due < 0, soon: due != null && due >= 0 && due <= dueSoonDays };
  const base = { due, ...flags };
  if (flags.problem) return { ...base, key: "problem", label: "Problem reported", tone: "red" };
  if (flags.overdue) return { ...base, key: "overdue", label: "Overdue", tone: "red" };
  if (flags.unsigned) return { ...base, key: "unsigned", label: "Needs signature", tone: "blue" };
  if (flags.soon) return { ...base, key: "soon", label: "Due soon", tone: "amber" };
  return { ...base, key: "ok", label: "In date", tone: "green" };
}

/** Totals for the register's tiles. */
export function ppeSummary(rows, today = londonToday(), dueSoonDays = 30) {
  const yearAgo = addMonthsISO(today, -12);
  const s = { issued12: 0, current: 0, soon: 0, overdue: 0, unsigned: 0, problem: 0 };
  rows.forEach(r => {
    const d = r.data || {};
    if (d.issuedOn && d.issuedOn >= yearAgo) s.issued12++;
    if (r.status !== "issued") return;
    s.current++;
    const st = ppeState(r, today, dueSoonDays);
    if (st.overdue) s.overdue++; else if (st.soon) s.soon++;
    if (st.unsigned) s.unsigned++;
    if (st.problem) s.problem++;
  });
  return s;
}

/** The size each item was last issued in to this person (to fill in next time). */
export function lastSizes(rows, userId) {
  const out = {};
  rows.filter(r => String(r.user_id) === String(userId)).sort((a, b) => String((a.data || {}).issuedAt).localeCompare(String((b.data || {}).issuedAt)))
    .forEach(r => { const d = r.data || {}; if (d.itemId && d.size) out[d.itemId] = d.size; });
  return out;
}

const ukd = iso => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const cell = v => { const s = String(v == null ? "" : v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; };
/** The register as CSV (opens in Excel). */
export function ppeCsv(rows, today = londonToday(), dueSoonDays = 30) {
  const head = ["Person", "Department", "Item", "Standard", "Size", "Quantity", "Reason", "Issued", "Issued by", "Replace by", "Signed", "Signed how", "Status", "Returned / replaced", "Return reason", "Problems reported"];
  const lines = rows.map(r => { const d = r.data || {}; const st = ppeState(r, today, dueSoonDays);
    return [d.name, d.dept, d.item, d.standard, d.size, d.qty, (PPE_REASONS.find(x => x.id === d.reason) || {}).label || "", ukd(d.issuedOn), d.issuedBy, ukd(d.replaceBy), d.signedAt ? ukd(d.signedAt.slice(0, 10)) : "Not signed", d.signedVia || "",
      st.label, ukd(d.returnedOn), d.returnReason || "", (d.problems || []).map(p => `${ukd(p.at.slice(0, 10))} ${(PPE_PROBLEMS.find(x => x.id === p.kind) || {}).label}${p.note ? `: ${p.note}` : ""}${p.dealtAt ? " (dealt with)" : ""}`).join("; ")].map(cell).join(","); });
  return "﻿" + [head.join(","), ...lines].join("\r\n");
}
