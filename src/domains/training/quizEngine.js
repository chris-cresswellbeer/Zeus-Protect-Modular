/**
 * ═══════════════════════════════════════════════════════════════════════════
 * domains/training/quizEngine.js — questions, marking and quiz results
 * ═══════════════════════════════════════════════════════════════════════════
 * Pure functions (no React, no database) shared by the module builder, the computer
 * and phone players, the admin preview and the reports.
 *
 * QUESTION (an item of module.quiz, or a slide's knowledge check, slide.check)
 *   { id, type, q, options:[text], answer, answers, images, why }
 *   id       stable id. Questions saved before ids existed are "i<index>" (their
 *            position when first opened in the builder), so older results still match.
 *   type     "single"  one right answer (the original kind; also when type is missing)
 *            "tf"      true / false: options ["True","False"], answer 0 or 1
 *            "multi"   select all that apply: answers = [indexes], all and only those
 *            "image"   pick the right picture: images[i] = {name,type,url,data} per option,
 *                      options[i] = an optional caption; answer = index
 *            "order"   put in order: options are written IN THE RIGHT ORDER and are
 *                      always shown shuffled
 *   why      optional one-line explanation, shown in the answer review
 *
 * MODULE QUIZ SETTINGS (custom_modules.data)
 *   quizDraw     number of questions asked each attempt, drawn at random from the
 *                quiz (a question bank). Missing / 0 = every question.
 *   quizShuffle  true = questions and answers are shown in a different order each time
 *   signoff      { text } — a declaration the person signs with their typed name
 *                before the quiz (or instead of one). Missing = no declaration.
 *
 * AN ATTEMPT
 *   draw = [{ qi, order }]  qi = index in module.quiz, order = the option indexes in the
 *                           order they're shown. Answers are always ORIGINAL option
 *                           indexes, so marking never depends on the shuffle.
 *   answers (the player's)  { [qi]: index | [indexes] }
 *
 * Building questions (new/changed questions, checks, the spreadsheet import, templates and the
 * per-question report) is in quizBuilder.js, so the players don't need to load it.
 *
 * WHAT IS SAVED (training_completions.answers, and quiz_failures data.answers)
 *   { v:2, items:[{ qid, qi, ok, given }], drawn, of, checks?, signoff? }
 *   Older results are { [qi]: index } and are still read (savedItems below).
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const QTYPES = [
  { id: "single", label: "Multiple choice (one answer)" },
  { id: "tf",     label: "True or false" },
  { id: "multi",  label: "Select all that apply" },
  { id: "image",  label: "Pick the right picture" },
  { id: "order",  label: "Put in order" },
];
const TYPE_IDS = QTYPES.map(t => t.id);
export const qType = q => (q && TYPE_IDS.includes(q.type) ? q.type : "single");
export const MIN_OPTIONS = { single: 2, tf: 2, multi: 2, image: 2, order: 3 };
export const MAX_OPTIONS = 6;
export const LETTERS = "ABCDEF";
export const DEFAULT_SIGNOFF = "I confirm that I have read and understood this training and I will follow it in my work.";

/** A question's stable id ("i<index>" for questions saved before ids existed). */
export const qid = (q, i) => (q && q.id) || `i${i}`;

/** The right answer, as option indexes (in order, for "order"). */
export function correctOf(q) {
  const t = qType(q);
  if (t === "multi") return [...new Set((q.answers || []).map(Number))].sort((a, b) => a - b);
  if (t === "order") return (q.options || []).map((_, i) => i);
  return [Number(q.answer) || 0];
}

/** Has the person given an answer? */
export function isAnswered(q, given) {
  const t = qType(q);
  if (t === "multi") return Array.isArray(given) && given.length > 0;
  if (t === "order") return Array.isArray(given) && given.length === (q.options || []).length;
  return Number.isInteger(given);
}

/** Is the answer right? */
export function isCorrect(q, given) {
  if (!q || !isAnswered(q, given)) return false;
  const t = qType(q);
  if (t === "multi") {
    const want = correctOf(q), got = [...new Set(given.map(Number))].sort((a, b) => a - b);
    return want.length === got.length && want.every((v, i) => v === got[i]);
  }
  if (t === "order") return given.every((v, i) => Number(v) === i);
  return given === (Number(q.answer) || 0);
}

// ── Drawing an attempt ─────────────────────────────────────────────────────

/** A repeatable random number source (tests, previews). */
export function seededRandom(seed) {
  let s = (Number(seed) >>> 0) || 1;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6D2B79F5) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}
function shuffled(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** { draw: how many are asked (all = quiz length), of, shuffle, bank: true when fewer than all } */
export function quizSettings(mod) {
  const of = ((mod && mod.quiz) || []).length;
  const n = Math.round(Number(mod && mod.quizDraw) || 0);
  const draw = n > 0 && n < of ? n : of;
  return { draw, of, shuffle: !!(mod && mod.quizShuffle), bank: draw < of };
}

/** How the quiz is set up, in a few words (admin screens). */
export function quizSummary(m) {
  const s = quizSettings(m);
  if (!s.of) return m.signoff && m.signoff.text ? "No quiz — signed declaration" : "No questions";
  const kinds = [...new Set((m.quiz || []).map(qType))].map(k => (QTYPES.find(x => x.id === k) || {}).label).filter(Boolean);
  const kindText = kinds.length === 1 && kinds[0] === QTYPES[0].label ? "multiple choice" : kinds.map(k => k.toLowerCase()).join(", ");
  return `${s.bank ? `${s.of} in the bank, ${s.draw} asked each time` : `${s.of} ${kindText}`}${s.shuffle ? " · shuffled" : ""}${s.bank && kinds.length ? ` · ${kindText}` : ""}`;
}

/** The option order shown for one question. "Put in order" is always shuffled (never shown solved). */
export function optionOrder(q, shuffle, rand = Math.random) {
  const idx = (q.options || []).map((_, i) => i);
  const t = qType(q);
  if (t === "order") {
    if (idx.length < 2) return idx;
    for (let k = 0; k < 8; k++) { const s = shuffled(idx, rand); if (s.some((v, i) => v !== i)) return s; }
    return [...idx.slice(1), idx[0]];
  }
  if (!shuffle || t === "tf") return idx;
  return shuffled(idx, rand);
}

/** The questions asked in one attempt: [{ qi, order }]. */
export function drawQuiz(mod, rand = Math.random) {
  const quiz = (mod && mod.quiz) || [];
  const { draw, shuffle, bank } = quizSettings(mod);
  let qis = quiz.map((_, i) => i);
  if (bank) qis = shuffled(qis, rand).slice(0, draw);
  if (shuffle) qis = shuffled(qis, rand); else qis.sort((a, b) => a - b);
  return qis.map(qi => ({ qi, order: optionOrder(quiz[qi], shuffle, rand) }));
}

/** Starting answers: a "put in order" question starts in the order it is shown. */
export function initialAnswers(mod, draw) {
  const out = {};
  (draw || []).forEach(d => { const q = mod.quiz[d.qi]; if (qType(q) === "order") out[d.qi] = [...d.order]; });
  return out;
}

/** Every drawn question answered? */
export const allAnswered = (mod, draw, answers) => (draw || []).every(d => isAnswered(mod.quiz[d.qi], (answers || {})[d.qi]));

// ── Marking ────────────────────────────────────────────────────────────────

/** { correct, total, pct, items:[{ qid, qi, ok, given }] }. No questions (sign-off only) = 100%. */
export function markAttempt(mod, draw, answers) {
  const quiz = (mod && mod.quiz) || [];
  const items = (draw || []).map(d => {
    const q = quiz[d.qi]; const given = (answers || {})[d.qi];
    return { qid: qid(q, d.qi), qi: d.qi, ok: isCorrect(q, given), given: given === undefined ? null : given };
  });
  const correct = items.filter(i => i.ok).length, total = items.length;
  return { correct, total, pct: total ? Math.round((correct / total) * 100) : 100, items };
}

/** What is saved with the result: { v:2, items, drawn, of, checks?, signoff? } */
export function attemptRecord(mod, mark, extra = {}) {
  const out = { v: 2, items: mark.items, drawn: mark.total, of: ((mod && mod.quiz) || []).length };
  if (extra.checks && Object.keys(extra.checks).length) out.checks = extra.checks;
  if (extra.signoff) out.signoff = extra.signoff;
  return out;
}

/** True for a result that was a signed declaration with no quiz (lives in completion.js). */
export { isSignOnly } from "./completion";

/**
 * A saved result's answers, matched to the module's questions as they are now:
 * [{ qi, qid, q, given, ok }] — q is null when that question has since been removed.
 * Older results ({ [qi]: index }) are matched by position.
 */
export function savedItems(mod, answers) {
  const quiz = (mod && mod.quiz) || [];
  if (!answers || typeof answers !== "object") return [];
  if (answers.v === 2) {
    const byId = new Map(quiz.map((q, i) => [qid(q, i), i]));
    return (answers.items || []).map(it => {
      const qi = byId.has(it.qid) ? byId.get(it.qid) : null;
      return { qi, qid: it.qid, q: qi == null ? null : quiz[qi], given: it.given, ok: !!it.ok };
    });
  }
  if (!Object.keys(answers).length) return [];
  return quiz.map((q, qi) => { const given = answers[qi]; return { qi, qid: qid(q, qi), q, given, ok: isCorrect(q, given) }; });
}

/** "Picture 2" style name for an image option with no caption. */
const optText = (q, i) => {
  const o = (q.options || [])[i];
  if (o && String(o).trim()) return String(o);
  return qType(q) === "image" ? `Picture ${i + 1}` : `Option ${LETTERS[i] || i + 1}`;
};
/** The given answer as text (English labels — for admin screens and reports). */
export function answerText(q, given) {
  if (!q || given == null || (Array.isArray(given) && !given.length)) return "Not answered";
  const t = qType(q);
  if (t === "multi") return [...given].sort((a, b) => a - b).map(i => optText(q, i)).join("; ");
  if (t === "order") return given.map(i => optText(q, i)).join(" → ");
  return optText(q, given);
}
/** The right answer as text. */
export function correctText(q) {
  const t = qType(q);
  if (t === "order") return (q.options || []).map((_, i) => optText(q, i)).join(" → ");
  return correctOf(q).map(i => optText(q, i)).join("; ");
}

/** Text read aloud for a question. */
export function speakText(q, order) {
  const t = qType(q);
  const idx = order || (q.options || []).map((_, i) => i);
  const opts = t === "image" ? idx.map((i, k) => `${LETTERS[k]}. ${(q.options[i] || "").trim()}`).filter(s => s.length > 3) : idx.map((i, k) => `${t === "order" ? k + 1 : LETTERS[k]}. ${q.options[i]}`);
  return [q.q, ...opts].join(". \n");
}

// ── Sign-off ───────────────────────────────────────────────────────────────

/** Letters only, lower case, no accents — for comparing a typed name with the name on file. */
export const nameKey = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
/** Does the typed name match the person's name? (case, spaces, accents and punctuation ignored) */
export const nameMatches = (typed, name) => !!nameKey(typed) && nameKey(typed) === nameKey(name);
