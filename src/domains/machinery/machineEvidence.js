/**
 * machineEvidence.js — licence / certificate files on machinery competence records.
 *
 * Stored on the record as  fileNames: [{ name, type, url, path, at, by }]
 * Files go in the PRIVATE "documents" bucket under
 *     ext_certs/<staff id>_mc_<record id>_<time>_<n>_<file name>
 * which the existing file rules (db_rules.sql, can_read_file) already protect like
 * external certificates: admins, the person, and their line manager can open them,
 * through short-lived signed links (lib/fileAccess.js). No rule changes needed.
 *
 * OLDER RECORDS kept the file INSIDE the record as base64 ({ name, data:"data:…" }).
 * migrateMachineEvidence() moves those into storage once, when an admin opens the
 * Machinery screen; until then they still open (as a download).
 */
import { sb, SUPABASE_URL } from "../../lib/supabase";

export const MACHINE_EVIDENCE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,application/pdf,image/*";
export const MACHINE_EVIDENCE_MAX_MB = 20;
const OK = f => /\.(pdf|jpe?g|png|webp|heic|heif|docx?)$/i.test(f.name || "") || /^(application\/pdf|image\/)/i.test(f.type || "");

/** Problems with chosen files ("" if none). */
export function checkMachineFiles(files) {
  for (const f of files) {
    if (!OK(f)) return `"${f.name}" can't be used. Choose a PDF, a photo or a Word document.`;
    if (f.size > MACHINE_EVIDENCE_MAX_MB * 1048576) return `"${f.name}" is ${Math.round(f.size / 1048576)} MB. Each file can be up to ${MACHINE_EVIDENCE_MAX_MB} MB.`;
  }
  return "";
}

const clean = s => String(s).replace(/[^a-zA-Z0-9_-]/g, "_");
const pathFor = (uid, recId, i, name) => `ext_certs/${clean(uid)}_mc_${clean(recId)}_${Date.now()}_${i}_${String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)}`;
const urlFor = path => `${SUPABASE_URL}/storage/v1/object/public/documents/${path.split("/").map(encodeURIComponent).join("/")}`;

/** Upload files (File/Blob objects); resolves to entries for fileNames. */
export async function uploadMachineEvidence(files, uid, recId, by) {
  const out = [];
  const at = new Date().toISOString();
  let i = 0;
  for (const f of files) {
    i++;
    const path = pathFor(uid, recId, i, f.name);
    const { error } = await sb.storage.upload("documents", path, f);
    if (error) throw new Error(`"${f.name}" couldn't be uploaded: ${error}`);
    out.push({ name: f.name, type: f.type || "", url: urlFor(path), path, at, ...(by ? { by } : {}) });
  }
  return out;
}

/** Delete stored files (best effort). */
export async function removeMachineEvidence(paths) {
  const list = (paths || []).filter(Boolean);
  if (!list.length) return;
  try { await sb.storage.remove("documents", list); } catch { /* left behind; harmless */ }
}

/** Files on a record, ready to show: [{ name, href, legacy }] */
export function evidenceFiles(comp) {
  return ((comp && comp.fileNames) || []).map(f => {
    if (typeof f === "string") return { name: f, href: null, legacy: false };
    if (f.url) return { name: f.name || "file", href: f.url, legacy: false };
    if (f.data) return { name: f.name || "file", href: f.data, legacy: true };
    return { name: f.name || "file", href: null, legacy: false };
  });
}

export const hasLegacyFiles = comp => ((comp && comp.fileNames) || []).some(f => f && typeof f === "object" && typeof f.data === "string" && f.data.startsWith("data:"));

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const type = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Move base64 files into storage. save(uid, recId, fileNames) merges the new file list
 * into the LATEST copy of the record and saves it, resolving true/false.
 * Resolves to { moved, records, failed }.
 */
export async function migrateMachineEvidence(machineComps, save) {
  let moved = 0, records = 0, failed = 0;
  for (const [uid, recs] of Object.entries(machineComps || {})) {
    for (const rec of Object.values(recs || {})) {
      if (!hasLegacyFiles(rec)) continue;
      try {
        const next = [];
        let i = 0;
        for (const f of rec.fileNames) {
          if (f && typeof f === "object" && typeof f.data === "string" && f.data.startsWith("data:")) {
            i++;
            const blob = dataUrlToBlob(f.data);
            const path = pathFor(uid, rec.id, i, f.name);
            const { error } = await sb.storage.upload("documents", path, new File([blob], f.name || "file", { type: blob.type }));
            if (error) throw new Error(error);
            next.push({ name: f.name || "file", type: blob.type, url: urlFor(path), path, at: new Date().toISOString(), moved: true });
            moved++;
          } else next.push(f);
        }
        if (!(await save(uid, rec.id, next))) throw new Error("the record couldn't be saved");
        records++;
      } catch (e) { failed++; console.warn("[machinery] couldn't move a file into storage:", e); }
    }
  }
  return { moved, records, failed };
}
