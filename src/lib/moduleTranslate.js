/**
 * src/lib/moduleTranslate.js — translated copies of training modules.
 *
 * WHAT IS TRANSLATED
 *   The module title, each slide's heading, text and hotspot instructions/labels/
 *   feedback, every quiz question and answer and its "why" line, slide knowledge checks
 *   and the sign-off declaration. Pictures, videos, the order of
 *   the answers and which one is right are never touched, so marking is identical
 *   in every language.
 *
 * WHERE IT IS KEPT
 *   module_translations (module_translations.sql): one row per module and language,
 *     { module_id, lang, data, source_hash, status, translated_at, checked_by, checked_at }
 *   data has the same shape as moduleTexts() below. status is "machine" (translated
 *   automatically, not yet checked) or "checked" (a bilingual person has read it).
 *
 * OUT OF DATE
 *   source_hash is a fingerprint of the English the translation was made from. When
 *   the English changes the fingerprints differ, the translation is "out of date" and
 *   staff see the English until it is translated again — never old instructions.
 */

/** The translatable text of a module, in a fixed shape. */
export function moduleTexts(mod) {
  const m = mod || {};
  return {
    title: m.title || "",
    content: (m.content || []).map(s => ({
      heading: (s && s.heading) || "",
      text: (s && s.text) || "",
      hotspotInstructions: (s && s.hotspotInstructions) || "",
      hotspots: ((s && s.hotspots) || []).map(h => ({ label: (h && h.label) || "", feedback: (h && h.feedback) || "" })),
      // a knowledge check on the slide (quizEngine.js) — only when there is one, so older
      // modules keep exactly the same fingerprint and their translations stay up to date
      ...(s && s.check ? { check: questionTexts(s.check) } : {}),
    })),
    quiz: (m.quiz || []).map(questionTexts),
    ...(m.signoff && m.signoff.text ? { signoff: String(m.signoff.text) } : {}),   // the sign-off declaration
  };
}
// A question's text: the question, the options and (only if it has one) the "why" line.
function questionTexts(q) {
  return { q: (q && q.q) || "", options: ((q && q.options) || []).map(o => String(o ?? "")), ...(q && q.why ? { why: String(q.why) } : {}) };
}

// FNV-1a, 32-bit, twice with different seeds → 16 hex characters. A fingerprint, not security.
function fnv(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
const hashCache = new WeakMap();
/** Fingerprint of a module's English text. */
export function sourceHash(mod) {
  if (mod && typeof mod === "object" && hashCache.has(mod)) return hashCache.get(mod);
  const s = JSON.stringify(moduleTexts(mod));
  const h = fnv(s, 2166136261) + fnv(s, 0x811c9dc5 ^ 0x5bd1e995);
  if (mod && typeof mod === "object") hashCache.set(mod, h);
  return h;
}

const isHtml = s => /<[a-z][\s\S]*>/i.test(String(s || ""));

/** Every non-empty piece of text, in order: [{ path, text, html }]. */
export function flattenTexts(texts) {
  const out = [];
  const add = (path, text) => { if (String(text || "").trim()) out.push({ path, text: String(text), html: isHtml(text) }); };
  add(["title"], texts.title);
  texts.content.forEach((s, i) => {
    add(["content", i, "heading"], s.heading);
    add(["content", i, "text"], s.text);
    add(["content", i, "hotspotInstructions"], s.hotspotInstructions);
    s.hotspots.forEach((h, j) => { add(["content", i, "hotspots", j, "label"], h.label); add(["content", i, "hotspots", j, "feedback"], h.feedback); });
    if (s.check) {
      add(["content", i, "check", "q"], s.check.q);
      s.check.options.forEach((o, j) => add(["content", i, "check", "options", j], o));
      add(["content", i, "check", "why"], s.check.why);
    }
  });
  texts.quiz.forEach((q, i) => {
    add(["quiz", i, "q"], q.q);
    q.options.forEach((o, j) => add(["quiz", i, "options", j], o));
    add(["quiz", i, "why"], q.why);
  });
  add(["signoff"], texts.signoff);
  return out;
}

/** Put translated pieces back into the moduleTexts() shape (missing pieces stay English). */
export function rebuildTexts(texts, pieces, translated) {
  const out = JSON.parse(JSON.stringify(texts));
  pieces.forEach((p, i) => {
    const v = translated[i];
    if (typeof v !== "string" || !v.trim()) return;
    let o = out;
    for (let k = 0; k < p.path.length - 1; k++) o = o[p.path[k]];
    o[p.path[p.path.length - 1]] = v;
  });
  return out;
}

/** Status of one module's translation into one language. */
export function translationState(mod, row) {
  if (!row || !row.data) return "none";
  if (row.source_hash !== sourceHash(mod)) return "stale";
  return row.status === "checked" ? "checked" : "machine";
}

/**
 * The module as someone working in `lang` should see it. Returns the English module
 * unchanged when there's no up-to-date translation. A translated copy carries:
 *   _lang        the language shown
 *   _trans       { lang, hash, status } — recorded with a completion
 *   _en          the original English module (certificates stay in English)
 */
const locCache = new WeakMap();
export function localiseModule(mod, lang, row) {
  if (!mod || !lang || lang === "en") return mod;
  if (translationState(mod, row) !== "machine" && translationState(mod, row) !== "checked") return mod;
  let byRow = locCache.get(mod);
  if (!byRow) { byRow = new WeakMap(); locCache.set(mod, byRow); }
  if (byRow.has(row)) return byRow.get(row);
  const d = row.data;
  const pick = (v, fallback) => (typeof v === "string" && v.trim() ? v : fallback);
  const out = {
    ...mod,
    title: pick(d.title, mod.title),
    content: (mod.content || []).map((s, i) => {
      const ts = (d.content || [])[i] || {};
      return {
        ...s,
        heading: pick(ts.heading, s.heading),
        text: pick(ts.text, s.text),
        ...(s.hotspotInstructions || ts.hotspotInstructions ? { hotspotInstructions: pick(ts.hotspotInstructions, s.hotspotInstructions) } : {}),
        ...(s.hotspots ? { hotspots: s.hotspots.map((h, j) => { const th = (ts.hotspots || [])[j] || {}; return { ...h, label: pick(th.label, h.label), feedback: pick(th.feedback, h.feedback) }; }) } : {}),
        ...(s.check ? { check: localQuestion(s.check, ts.check || {}, pick) } : {}),
      };
    }),
    quiz: (mod.quiz || []).map((q, i) => localQuestion(q, (d.quiz || [])[i] || {}, pick)),
    ...(mod.signoff ? { signoff: { ...mod.signoff, text: pick(d.signoff, mod.signoff.text) } } : {}),
    _lang: lang,
    _trans: { lang, hash: row.source_hash, status: row.status === "checked" ? "checked" : "machine" },
    _en: mod,
  };
  byRow.set(row, out);
  return out;
}

// A question in the person's language (answers, pictures and marking unchanged).
function localQuestion(q, tq, pick) {
  return { ...q, q: pick(tq.q, q.q), options: (q.options || []).map((o, j) => pick((tq.options || [])[j], o)), ...(q.why ? { why: pick(tq.why, q.why) } : {}) };
}

/** The English module behind a (possibly) translated one. */
export const englishOf = mod => (mod && mod._en) || mod;

/** module_translations rows → { "<moduleId>|<lang>": row } */
export function mapTranslationRows(rows) {
  const map = {};
  (rows || []).forEach(r => { if (r && r.module_id && r.lang) map[`${r.module_id}|${r.lang}`] = r; });
  return map;
}
export const translationKey = (moduleId, lang) => `${moduleId}|${lang}`;
