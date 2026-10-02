/**
 * evidence.js — evidence attached to RECORDED training (completion.js), for audits:
 *   • the signed sign-in sheet of a group session / toolbox talk, or
 *   • a certificate or old-system record for training done before the portal.
 *
 * Stored on the completion's `recorded` object (and its history row):
 *   recorded.evidence = [{ name, type, url, at, by }]      (several pages allowed)
 * Files go in the "documents" bucket under training_evidence/. With the new sign-in
 * (db_rules.sql) only admins and the attendees' line managers can open them — a
 * sign-in sheet shows other people's names and signatures.
 *
 * Group sessions recorded from now on carry recorded.session.id, so evidence added
 * later reaches every attendee. Older sessions are grouped by module + date + leader.
 */
import { sb, SUPABASE_URL } from "../../lib/supabase";

export const EVIDENCE_ACCEPT = "application/pdf,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
export const EVIDENCE_MAX_MB = 20;
const OK_TYPE = f => /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/i.test(f.type || "") || /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(f.name || "");

/** Problems with the chosen files ("" if none). */
export function checkEvidenceFiles(files) {
  for (const f of files) {
    if (!OK_TYPE(f)) return `"${f.name}" can't be used. Choose a PDF scan or a photo (JPG, PNG).`;
    if (f.size > EVIDENCE_MAX_MB * 1048576) return `"${f.name}" is ${Math.round(f.size / 1048576)} MB. Each file can be up to ${EVIDENCE_MAX_MB} MB.`;
  }
  return "";
}

/** Upload files; resolves to evidence entries. `key` groups the files (session id / user_module). */
export async function uploadEvidence(files, key, by) {
  const out = [];
  const at = new Date().toISOString();
  let i = 0;
  for (const f of files) {
    i++;
    const safe = String(f.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `training_evidence/${String(key).replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}_${i}_${safe}`;
    const { error } = await sb.storage.upload("documents", path, f);
    if (error) throw new Error(`"${f.name}" couldn't be uploaded: ${error}`);
    out.push({ name: f.name, type: f.type || "", url: `${SUPABASE_URL}/storage/v1/object/public/documents/${path}`, at, ...(by ? { by } : {}) });
  }
  return out;
}

/** Key that ties the records of one group session together. */
export const sessionKey = (moduleId, c) => {
  const s = c && c.recorded && c.recorded.session;
  if (!s) return null;
  return s.id || `legacy|${moduleId}|${c.date}|${(s.leader || "").trim().toLowerCase()}`;
};

/**
 * Group sessions found in the current records (comps: {uid:{mid:rec}}), newest first:
 * [{ key, moduleId, date, leader, where, attendees:[uid], evidence:[...] }]
 * `onlyUids` limits attendees to those people (e.g. a manager's team).
 */
export function listSessions(comps, onlyUids) {
  const map = new Map();
  const allow = onlyUids ? new Set(onlyUids.map(String)) : null;
  Object.entries(comps || {}).forEach(([uid, mods]) => {
    if (allow && !allow.has(String(uid))) return;
    Object.entries(mods || {}).forEach(([mid, c]) => {
      const key = sessionKey(mid, c);
      if (!key) return;
      const s = c.recorded.session;
      const g = map.get(key) || { key, moduleId: mid, date: c.date, leader: s.leader || "", where: s.where || "", attendees: [], evidence: [] };
      g.attendees.push(String(uid));
      (c.recorded.evidence || []).forEach(e => { if (!g.evidence.some(x => x.url === e.url)) g.evidence.push(e); });
      map.set(key, g);
    });
  });
  return [...map.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/** "Sign-in sheet (2 files)" / "Evidence (1 file)" */
export const evidenceLabel = (c, n) => `${c && c.recorded && c.recorded.session ? "Sign-in sheet" : "Evidence"}${n > 1 ? ` (${n} files)` : ""}`;
