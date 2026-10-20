/**
 * src/lib/moduleDrafts.js — a module being built, saved to the person's account.
 *
 * The Create Module page already keeps a draft in this browser (lib/unsaved.jsx). This is
 * the "Save draft" button on top of that: the work so far is saved to the database, so it
 * can be picked up on another computer, or after the browser's storage is cleared, and
 * nothing is lost before the module is ready to publish. Nobody else sees it as a module —
 * it isn't in the library or assignable until "Save Module to Library".
 *
 * WHERE: user_profiles.data.moduleDrafts (the person's own row, which the database rules
 * already let them write; their line manager can read it like the rest of the row).
 *   { "<builder key>": { at, title, value: { details, slides, quiz } } }
 * The builder key is "module.new" or "module.<module id>" (the same key as the browser
 * draft). At most MAX_DRAFTS are kept (newest first). Pictures and videos are already
 * uploaded when added, so a draft only holds their links.
 */
import { sb, dbWrite } from "./supabase";

export const MAX_DRAFTS = 5;
const MAX_CHARS = 900000;

const cached = uid => {
  const profiles = typeof window !== "undefined" && Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
  return profiles.find(r => String(r.user_id) === String(uid)) || null;
};
function putCache(uid, data) {
  if (typeof window === "undefined") return;
  const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
  const has = profiles.some(r => String(r.user_id) === String(uid));
  window.__userProfiles = has ? profiles.map(r => (String(r.user_id) === String(uid) ? { ...r, data } : r)) : [...profiles, { user_id: String(uid), data }];
}
// The row as the database has it now (another computer may have saved a draft since sign-in).
async function freshData(uid) {
  try {
    const r = await sb.from("user_profiles").select("*").eq("user_id", String(uid));
    if (!r.error && Array.isArray(r.data)) return (r.data[0] && r.data[0].data) || {};
  } catch { /* offline: use what was loaded */ }
  return (cached(uid) || {}).data || {};
}

/** Drop what a draft doesn't need: uploads still in progress, and the copy of each link in `data`. */
export function slimDraft(value) {
  const media = m => (m && !m.uploading && (m.url || m.data) ? { ...m, data: undefined, url: m.url || m.data } : null);
  const slimQ = q => (q && q.images ? { ...q, images: q.images.map(media) } : q);
  return {
    ...value,
    slides: (value.slides || []).map(s => ({ ...s, video: media(s.video), images: (s.images || []).map(media).filter(Boolean), ...(s.check ? { check: slimQ(s.check) } : {}) })),
    quiz: (value.quiz || []).map(slimQ),
  };
}
/** Put back the `data` copy of each link (older code reads `data`). */
function fattenDraft(value) {
  const media = m => (m ? { ...m, data: m.url } : m);
  const fatQ = q => (q && q.images ? { ...q, images: q.images.map(media) } : q);
  return { ...value, slides: (value.slides || []).map(s => ({ ...s, video: s.video ? media(s.video) : null, images: (s.images || []).map(media), ...(s.check ? { check: fatQ(s.check) } : {}) })), quiz: (value.quiz || []).map(fatQ) };
}

/** This person's saved draft for a builder key: { at, title, value } or null (from what was loaded). */
export function serverDraft(uid, key) {
  const d = (((cached(uid) || {}).data || {}).moduleDrafts || {})[key];
  return d && d.value ? { ...d, value: fattenDraft(d.value) } : null;
}

/** All of this person's drafts, newest first: [{ key, at, title }] */
export function serverDrafts(uid) {
  const all = ((cached(uid) || {}).data || {}).moduleDrafts || {};
  return Object.entries(all).map(([key, d]) => ({ key, at: d.at, title: d.title })).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** Save (or replace) a draft. → { ok, at?, error? } */
export async function saveServerDraft(uid, key, title, value) {
  if (!uid) return { ok: false, error: "Not signed in." };
  const slim = slimDraft(value);
  if (JSON.stringify(slim).length > MAX_CHARS) return { ok: false, error: "This module is too big to save as a draft. Save it to the library instead." };
  const data = await freshData(uid);
  const at = new Date().toISOString();
  const drafts = { ...(data.moduleDrafts || {}), [key]: { at, title: String(title || "").slice(0, 120), value: slim } };
  const keep = Object.entries(drafts).sort((a, b) => String(b[1].at).localeCompare(String(a[1].at))).slice(0, MAX_DRAFTS);
  const merged = { ...data, moduleDrafts: Object.fromEntries(keep) };
  const ok = await dbWrite(sb.from("user_profiles").upsert({ user_id: String(uid), data: merged }, { onConflict: "user_id" }), "module draft");
  if (ok) putCache(uid, merged);
  return ok ? { ok, at } : { ok, error: "The draft couldn't be saved. Check your connection and try again." };
}

/** Forget a draft (after the module is saved, or when it's discarded). */
export async function dropServerDraft(uid, key) {
  if (!uid) return true;
  const had = ((cached(uid) || {}).data || {}).moduleDrafts || {};
  if (!had[key]) return true;
  const data = await freshData(uid);
  const drafts = { ...(data.moduleDrafts || {}) };
  delete drafts[key];
  const merged = { ...data, moduleDrafts: drafts };
  if (!Object.keys(drafts).length) delete merged.moduleDrafts;
  const ok = await dbWrite(sb.from("user_profiles").upsert({ user_id: String(uid), data: merged }, { onConflict: "user_id" }), "module draft");
  if (ok) putCache(uid, merged);
  return ok;
}
