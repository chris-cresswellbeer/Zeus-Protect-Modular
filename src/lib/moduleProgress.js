/**
 * moduleProgress.js — where someone got to in a training module, so they can carry on
 * later instead of starting again from slide 1 (computer and phone).
 *
 * Kept on this device (localStorage "zp.progress.<staff id>"), per person and module:
 *   { [moduleId]: { step, of, version, at } }
 *     step     the slide reached (1…of), or of+1 = got as far as the quiz
 *     of       how many slides the module had (if that changes, the place is forgotten)
 *     version  the module version (a new version starts afresh)
 * Places older than KEEP_DAYS are forgotten. Passing the module clears its place.
 * It's only a bookmark: nothing about the result depends on it.
 */

const KEEP_DAYS = 30;
const key = uid => `zp.progress.${uid}`;
const read = uid => { try { return JSON.parse(localStorage.getItem(key(uid)) || "{}") || {}; } catch { return {}; } };
const write = (uid, v) => { try { localStorage.setItem(key(uid), JSON.stringify(v)); } catch { /* storage full or blocked */ } };
const slidesOf = mod => ((mod && mod.content) || []).length;

/** The saved place for this module, or null (nothing saved, out of date, or at the start). */
export function getProgress(uid, mod) {
  if (!uid || !mod) return null;
  const p = read(uid)[String(mod.id)];
  if (!p) return null;
  const of = slidesOf(mod);
  const stale = !p.at || Date.now() - new Date(p.at).getTime() > KEEP_DAYS * 86400000;
  if (stale || p.of !== of || (p.version || 1) !== (mod.version || 1) || !(p.step > 1) || p.step > of + 1) return null;
  return { step: p.step, of, quiz: p.step === of + 1, at: p.at };
}

/** Remember the slide reached (1…slides) or slides+1 for the quiz. */
export function saveProgress(uid, mod, step) {
  if (!uid || !mod) return;
  const all = read(uid);
  if (step > 1) all[String(mod.id)] = { step, of: slidesOf(mod), version: mod.version || 1, at: new Date().toISOString() };
  else delete all[String(mod.id)];
  write(uid, all);
}

export function clearProgress(uid, mod) {
  if (!uid || !mod) return;
  const all = read(uid);
  if (all[String(mod.id)]) { delete all[String(mod.id)]; write(uid, all); }
}

/** { [moduleId]: step } for a list of modules (the phone's Today / Training screens). */
export function progressMap(uid, mods) {
  const out = {};
  (mods || []).forEach(m => { const p = getProgress(uid, m); if (p) out[m.id] = p.step; });
  return out;
}

/** "Carry on from slide 7" / "Carry on to the quiz" */
export const resumeLabel = p => (p ? (p.quiz ? "Carry on to the quiz" : `Carry on from slide ${p.step}`) : "");
