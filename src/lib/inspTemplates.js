/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/inspTemplates.js — inspection checklists: built-in + this site's own
 * ═══════════════════════════════════════════════════════════════════════════
 * Built-in types and checklists live in data/seedInspections.js. A site can add its
 * own (e.g. the BRCGS internal audit checklists) in the inspection_templates table
 * (inspection_templates.sql, brc_audit_templates.sql). They're loaded when Site
 * Inspections opens (they can be large, so not at sign-in).
 *
 *   loadInspTemplates()      fetch this site's templates (once; { fresh:true } to reload)
 *   useInspTemplates()       React: re-renders when they arrive
 *   inspTypes()              every type: built-in first, then this site's (hidden ones left out)
 *   inspType(id, rec)        one type; for an unknown id, a stand-in named from the record
 *   inspSections(id)         its checklist sections [{ id, label, group?, intro?, questions:[{ id, text, ref?, tag? }] }]
 *   inspTypeLabel(rec)       the type's name for any saved inspection (works before loading)
 *   normaliseTemplate(row)   a safe template from a database row
 *
 * A saved inspection keeps typeLabel, so lists, reports and emails can name it even
 * where the templates aren't loaded.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { INSP_TYPES, INSP_SECTIONS } from "../data/seedInspections";

let custom = [];               // normalised templates from the database
let loaded = false, pending = null;
const subs = new Set();
const emit = () => subs.forEach(f => f(custom));

const str = (v, max) => String(v == null ? "" : v).slice(0, max);
const ID = /^[A-Za-z0-9_-]{1,60}$/;

export function normaliseTemplate(row) {
  if (!row || !ID.test(String(row.id || ""))) return null;
  const d = row.data && typeof row.data === "object" ? row.data : {};
  const sections = (Array.isArray(d.sections) ? d.sections : []).filter(s => s && ID.test(String(s.id || ""))).map(s => ({
    id: String(s.id), label: str(s.label, 200) || String(s.id), group: str(s.group, 120), intro: str(s.intro, 6000),
    questions: (Array.isArray(s.questions) ? s.questions : []).filter(q => q && ID.test(String(q.id || "")) && q.text)
      .map(q => ({ id: String(q.id), text: str(q.text, 6000), ref: str(q.ref, 20), tag: str(q.tag, 12) })),
  })).filter(s => s.questions.length);
  if (!sections.length) return null;
  const months = Number(d.freqMonths) > 0 && Number(d.freqMonths) <= 60 ? Math.round(Number(d.freqMonths)) : 0;
  return {
    id: String(row.id), custom: true, hidden: !!row.hidden,
    label: str(d.label, 120) || String(row.id), description: str(d.description, 300), icon: str(d.icon, 8) || "📋",
    color: /^#[0-9a-f]{6}$/i.test(d.color || "") ? d.color : "#8b5cf6", bg: str(d.bg, 40) || "rgba(139,92,246,0.12)",
    freq: months ? `${months} months` : str(d.freq, 30), freqMonths: months, source: str(d.source, 300),
    introLabel: str(d.introLabel, 40) || "Introduction", group: str(d.group, 80), allowSkip: d.allowSkip !== false,
    sections,
  };
}

export function loadInspTemplates({ fresh = false } = {}) {
  if (loaded && !fresh) return Promise.resolve(custom);
  if (pending && !fresh) return pending;
  pending = (async () => {
    try {
      const { sb } = await import("./supabase");
      const r = await sb.from("inspection_templates").select("*");
      // no table yet (inspection_templates.sql not run): just the built-in checklists
      const rows = r && !r.error && Array.isArray(r.data) ? r.data : [];
      custom = rows.map(normaliseTemplate).filter(Boolean).sort((a, b) => a.label.localeCompare(b.label, "en-GB", { numeric: true }));
    } catch { custom = []; }
    loaded = true; pending = null; emit();
    return custom;
  })();
  return pending;
}
/** Tests and the template import: put templates in directly. */
export function _setInspTemplates(rows) { custom = (rows || []).map(normaliseTemplate).filter(Boolean); loaded = true; emit(); }

export function useInspTemplates() {
  const [, set] = React.useState(0);
  React.useEffect(() => { const f = () => set(n => n + 1); subs.add(f); loadInspTemplates(); return () => subs.delete(f); }, []);
  return custom;
}

export const inspTypes = ({ includeHidden = false } = {}) => [...INSP_TYPES, ...custom.filter(t => includeHidden || !t.hidden)];
export function inspType(id, rec) {
  return INSP_TYPES.find(t => t.id === id) || custom.find(t => t.id === id)
    || (rec && rec.typeLabel ? { id, label: rec.typeLabel, icon: "📋", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", custom: true, missing: true } : INSP_TYPES[0]);
}
export function inspSections(id) {
  if (INSP_SECTIONS[id]) return INSP_SECTIONS[id];
  const t = custom.find(x => x.id === id);
  return t ? t.sections : [];
}
export const inspTypeLabel = rec => {
  if (!rec) return "Inspection";
  const b = INSP_TYPES.find(t => t.id === rec.type) || custom.find(t => t.id === rec.type);
  return (b && b.label) || rec.typeLabel || rec.type || "Inspection";
};
