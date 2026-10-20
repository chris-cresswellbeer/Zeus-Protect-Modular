/**
 * ═══════════════════════════════════════════════════════════════════════════
 * domains/training/quizBuilder.js — making questions, and how they've gone
 * ═══════════════════════════════════════════════════════════════════════════
 * The admin side of quizEngine.js (which has the question shapes, marking and attempts):
 * new and changed questions, checking them before saving, the per-question results report,
 * questions from a spreadsheet, and module templates. Pure functions, no React.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { qType, qid, correctOf, savedItems, answerText, MIN_OPTIONS, MAX_OPTIONS, LETTERS, DEFAULT_SIGNOFF } from "./quizEngine";

export const newQuestionId = () => "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** A new empty question of a type. */
export function blankQuestion(type = "single") {
  const base = { id: newQuestionId(), type, q: "", why: "" };
  if (type === "tf") return { ...base, options: ["True", "False"], answer: 0 };
  if (type === "multi") return { ...base, options: ["", "", "", ""], answers: [] };
  if (type === "image") return { ...base, options: ["", "", ""], images: [null, null, null], answer: 0 };
  if (type === "order") return { ...base, options: ["", "", "", ""] };
  return { ...base, options: ["", "", "", ""], answer: 0 };
}

/** The same question as another type, keeping the question, the options and the "why". */
export function changeType(q, type) {
  const b = blankQuestion(type);
  const from = qType(q);
  const out = { ...b, id: q.id || b.id, q: q.q || "", why: q.why || "" };
  if (type === "tf") return out;
  if (from !== "tf") {
    const opts = (q.options || []).slice(0, MAX_OPTIONS);
    while (opts.length < MIN_OPTIONS[type]) opts.push("");
    out.options = opts;
  }
  const n = out.options.length;
  if (type === "multi") out.answers = (from === "multi" ? (q.answers || []) : from === "order" || from === "tf" ? [] : [Number(q.answer) || 0]).filter(a => a < n);
  if (type === "single" || type === "image") out.answer = from === "multi" ? Math.min(((q.answers || [])[0]) || 0, n - 1) : Math.min(Number(q.answer) || 0, n - 1);
  if (type === "image") out.images = out.options.map((_, i) => (q.images || [])[i] || null);
  return out;
}

// ── Checking a question in the builder ─────────────────────────────────────

/** The first problem with a question, or "" when it's fine. `name` e.g. "Question 3". */
export function questionProblem(q, name = "This question") {
  const t = qType(q);
  const opts = q.options || [];
  if (!String(q.q || "").trim()) return `${name} needs the question text.`;
  if (opts.length < MIN_OPTIONS[t]) return `${name} needs at least ${MIN_OPTIONS[t]} options.`;
  if (opts.length > MAX_OPTIONS) return `${name} can have up to ${MAX_OPTIONS} options.`;
  if (t === "image") {
    if (opts.some((_, i) => !((q.images || [])[i] && ((q.images[i].url) || q.images[i].data)))) return `${name}: every option needs a picture.`;
    if ((q.images || []).some(im => im && im.uploading)) return `${name}: a picture is still uploading.`;
  } else if (opts.some(o => !String(o || "").trim())) return `${name}: fill in every option (or remove the empty ones).`;
  if (t === "multi" && !(q.answers || []).length) return `${name}: tick at least one right answer.`;
  if ((t === "single" || t === "image" || t === "tf") && !(Number(q.answer) >= 0 && Number(q.answer) < opts.length)) return `${name}: choose the right answer.`;
  if (String(q.why || "").length > 400) return `${name}: keep the explanation under 400 characters.`;
  return "";
}

/** The first problem with the quiz as a whole, or "". */
export function quizProblem(quiz, { quizDraw, signoff } = {}) {
  if (!(quiz || []).length) return signoff ? "" : "Add at least one question, or turn on the sign-off declaration.";
  for (let i = 0; i < quiz.length; i++) { const p = questionProblem(quiz[i], `Question ${i + 1}`); if (p) return p; }
  const n = Number(quizDraw) || 0;
  if (n < 0 || n > quiz.length) return `You can ask up to ${quiz.length} question${quiz.length === 1 ? "" : "s"} per attempt — there are only ${quiz.length} in the bank.`;
  return "";
}

/** Tidy a question for saving: drops fields its type doesn't use. */
export function cleanQuestion(q, i) {
  const t = qType(q);
  const out = { id: qid(q, i), type: t, q: String(q.q || "").trim(), options: (q.options || []).map(o => String(o ?? "").trim()) };
  if (t === "multi") out.answers = correctOf(q).filter(a => a < out.options.length);
  else if (t !== "order") out.answer = Number(q.answer) || 0;
  if (t === "image") out.images = out.options.map((_, k) => { const im = (q.images || [])[k]; return im ? { name: im.name, type: im.type, url: im.url || im.data, data: im.url || im.data } : null; });
  const why = String(q.why || "").trim();
  if (why) out.why = why;
  return out;
}

/** Questions as the builder edits them: every question gets an id (its old position if it had none). */
export const withIds = quiz => (quiz || []).map((q, i) => ({ ...q, id: qid(q, i), type: qType(q), options: [...(q.options || [])],
  ...(q.answers ? { answers: [...q.answers] } : {}), ...(q.images ? { images: [...q.images] } : {}), why: q.why || "" }));

// ── Per-question results ───────────────────────────────────────────────────

/**
 * How each question has gone. results = [{ answers, moduleVersion }] (latest passes and
 * every recorded fail). Older results without question ids only count when they were
 * for the module's current version (so positions still match).
 * → [{ qi, qid, q, asked, wrong, pctWrong, wrongAnswers:[{ text, count }] }], most often wrong first.
 */
export function questionStats(mod, results) {
  const quiz = (mod && mod.quiz) || [];
  const rows = quiz.map((q, qi) => ({ qi, qid: qid(q, qi), q, asked: 0, wrong: 0, pctWrong: 0, _w: new Map() }));
  const byId = new Map(rows.map(r => [r.qid, r]));
  const ver = (mod && mod.version) || 1;
  (results || []).forEach(r => {
    const a = r && r.answers;
    if (!a || typeof a !== "object") return;
    if (a.v !== 2 && (r.moduleVersion || 1) !== ver) return;
    savedItems(mod, a).forEach(it => {
      const row = it.qi == null ? null : byId.get(qid(quiz[it.qi], it.qi));
      if (!row || (a.v !== 2 && it.given === undefined)) return;
      row.asked++;
      if (!it.ok) {
        row.wrong++;
        const k = answerText(row.q, it.given);
        row._w.set(k, (row._w.get(k) || 0) + 1);
      }
    });
  });
  return rows.map(({ _w, ...r }) => ({
    ...r,
    pctWrong: r.asked ? Math.round((r.wrong / r.asked) * 100) : 0,
    wrongAnswers: [..._w.entries()].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count),
  })).sort((a, b) => b.pctWrong - a.pctWrong || b.wrong - a.wrong || a.qi - b.qi);
}

// ── Questions from a spreadsheet (CSV, or rows pasted from Excel) ─────────

/** Rows of cells from CSV or tab-separated text (quotes, commas and line breaks in quotes). */
export function parseCsv(text) {
  const s = String(text || "").replace(/^\uFEFF/, "");
  const first = s.split(/\r?\n/)[0] || "";
  const delim = first.includes("\t") ? "\t" : (first.split(";").length > first.split(",").length ? ";" : ",");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === "") q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}

const norm = s => String(s || "").trim().toLowerCase();
function typeFromCell(v) {
  const t = norm(v).replace(/[^a-z]/g, "");
  if (!t || ["single", "multiplechoice", "mc", "choice", "one", "singleanswer"].includes(t)) return "single";
  if (["tf", "truefalse", "trueorfalse", "yesno"].includes(t)) return "tf";
  if (["multi", "multiple", "selectall", "selectallthatapply", "multiselect", "many"].includes(t)) return "multi";
  if (["order", "putinorder", "sequence", "ordering", "sort"].includes(t)) return "order";
  if (["image", "picture", "pictures", "photo"].includes(t)) return "image";
  return null;
}
/** "B", "2", "B, D", "1;3" or the option's own words → option indexes (null = not understood). */
function answerIndexes(v, options) {
  const raw = String(v || "").trim();
  if (!raw) return null;
  const exact = options.findIndex(o => norm(o) === norm(raw));
  if (exact >= 0) return [exact];
  const parts = raw.split(/[,;/&+ ]+|\band\b/i).map(p => p.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    let i = -1;
    if (/^[a-f]$/i.test(p)) i = LETTERS.indexOf(p.toUpperCase());
    else if (/^\d+$/.test(p)) i = Number(p) - 1;
    else i = options.findIndex(o => norm(o) === norm(p));
    if (i < 0 || i >= options.length) return null;
    if (!out.includes(i)) out.push(i);
  }
  return out.length ? out : null;
}

/**
 * Questions from spreadsheet text. The first row names the columns:
 *   Type, Question, Option A … Option F (or Option 1 …), Correct, Why
 * Only Question is required; Type defaults to multiple choice.
 * → { questions, problems:[ "Row 4: …" ] }
 */
export function questionsFromCsv(text) {
  const rows = parseCsv(text);
  const problems = [];
  if (!rows.length) return { questions: [], problems: ["The file is empty."] };
  const head = rows[0].map(norm);
  const col = names => head.findIndex(h => names.some(n => h === n || h.replace(/[^a-z0-9]/g, "") === n.replace(/[^a-z0-9]/g, "")));
  const qCol = col(["question", "question text", "q"]);
  if (qCol < 0) return { questions: [], problems: ['The first row must name the columns, with one called "Question". Download the example to see the layout.'] };
  const tCol = col(["type", "question type"]);
  const aCol = col(["correct", "correct answer", "answer", "answers", "right answer"]);
  const wCol = col(["why", "explanation", "reason", "feedback"]);
  const oCols = [];
  head.forEach((h, i) => { if (/^(option|answer|choice)\s*([a-f]|[1-6])$/.test(h) || /^[a-f]$/.test(h)) oCols.push(i); });
  const questions = [];
  rows.slice(1).forEach((r, k) => {
    const line = `Row ${k + 2}`;
    const qText = String(r[qCol] || "").trim();
    if (!qText) { problems.push(`${line}: no question — skipped.`); return; }
    const type = tCol >= 0 ? typeFromCell(r[tCol]) : "single";
    if (!type) { problems.push(`${line}: type "${r[tCol]}" isn't one we know (use single, true/false, select all or order) — skipped.`); return; }
    if (type === "image") { problems.push(`${line}: picture questions need pictures — add this one in the builder — skipped.`); return; }
    let options = oCols.map(i => String(r[i] || "").trim()).filter(Boolean);
    if (type === "tf" && options.length !== 2) options = ["True", "False"];
    const q = { ...blankQuestion(type), q: qText, options, why: wCol >= 0 ? String(r[wCol] || "").trim().slice(0, 400) : "" };
    if (options.length < MIN_OPTIONS[type]) { problems.push(`${line}: needs at least ${MIN_OPTIONS[type]} options — skipped.`); return; }
    if (options.length > MAX_OPTIONS) { problems.push(`${line}: more than ${MAX_OPTIONS} options — skipped.`); return; }
    if (type !== "order") {
      const cell = aCol >= 0 ? r[aCol] : "";
      let idx = answerIndexes(cell, options);
      if (type === "tf" && !idx) { const c = norm(cell); idx = ["t", "true", "yes", "y"].includes(c) ? [0] : ["f", "false", "no", "n"].includes(c) ? [1] : null; }
      if (!idx) { problems.push(`${line}: the correct answer "${String(cell || "").trim() || "(empty)"}" doesn't match an option — skipped.`); return; }
      if (type === "multi") q.answers = idx.sort((a, b) => a - b);
      else { if (idx.length > 1) { problems.push(`${line}: more than one correct answer — set the type to "select all" — skipped.`); return; } q.answer = idx[0]; }
    }
    questions.push(q);
  });
  return { questions, problems };
}

/** The example spreadsheet offered for download. */
export const CSV_EXAMPLE = [
  ["Type", "Question", "Option A", "Option B", "Option C", "Option D", "Correct", "Why"],
  ["single", "What is the speed limit for forklifts in the warehouse?", "5 mph", "10 mph", "15 mph", "20 mph", "A", "Site rules set 5 mph wherever people and trucks share space."],
  ["true/false", "You may carry a passenger on a forklift if they hold on.", "", "", "", "", "False", "Passengers are never allowed on a forklift."],
  ["select all", "Which of these must you check before using a ladder?", "Feet and rungs", "Stiles for damage", "The colour", "Locking bars", "A, B, D", "Colour has nothing to do with whether a ladder is safe."],
  ["order", "Put the fire procedure in order.", "Raise the alarm", "Leave by the nearest exit", "Go to the assembly point", "Wait for the roll call", "", "Raise the alarm first so everyone else gets out too."],
].map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(",")).join("\r\n") + "\r\n";

// ── Templates ──────────────────────────────────────────────────────────────

const p = (...lines) => lines.map(l => `<p>${l}</p>`).join("");
const ul = (...items) => `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
const slide = (heading, text) => ({ heading, text, video: null, images: [], hotspots: null, hotspotInstructions: "" });
const tq = (q, options, answer, why = "") => ({ ...blankQuestion("single"), q, options, answer, why });

/**
 * Starting points for a new module. build() returns { details, slides, quiz } with
 * placeholder wording in [square brackets] for the admin to replace.
 */
export const MODULE_TEMPLATES = [
  {
    id: "toolbox", icon: "🧰", name: "Toolbox talk",
    blurb: "A short talk on one topic: 3 slides, 3 questions and a signed declaration. Renews yearly.",
    build: () => ({
      details: { category: "General H&S", level: "Mandatory", duration: "10 min", icon: "🦺", renewalMonths: 12, passMark: 70,
        quizDraw: 0, quizShuffle: true, signoff: { on: true, text: DEFAULT_SIGNOFF } },
      slides: [
        slide("Why this matters", p("[What the talk is about, and what has happened here or elsewhere that makes it important.]")),
        slide("The hazards", ul("[Hazard 1]", "[Hazard 2]", "[Hazard 3]")),
        slide("What we do about it", ul("[Control or safe way of working]", "[Control or safe way of working]", "[Who to tell if something isn't right]")),
      ],
      quiz: [
        tq("[Question about the main hazard]", ["[Right answer]", "[Wrong answer]", "[Wrong answer]", "[Wrong answer]"], 0),
        { ...blankQuestion("tf"), q: "[A statement that is true or false]", answer: 0 },
        tq("[Question about who to tell]", ["[Right answer]", "[Wrong answer]", "[Wrong answer]", "[Wrong answer]"], 0),
      ],
    }),
  },
  {
    id: "sop", icon: "📝", name: "SOP sign-off",
    blurb: "Read a procedure and sign to confirm you understand it. No quiz. Renews yearly.",
    build: () => ({
      details: { category: "Compliance", level: "Mandatory", duration: "15 min", icon: "📋", renewalMonths: 12, passMark: 70,
        quizDraw: 0, quizShuffle: false, signoff: { on: true, text: "I confirm that I have read and understood [procedure name and number] and I will follow it." } },
      slides: [
        slide("About this procedure", p("[Procedure name, number and version.]", "[Who it applies to and when.]")),
        slide("The procedure", p("[Paste the steps of the procedure here, or add a picture of each page.]")),
        slide("If something goes wrong", p("[What to do and who to tell.]")),
      ],
      quiz: [],
    }),
  },
  {
    id: "refresher", icon: "🔁", name: "Annual refresher",
    blurb: "A question bank: 10 questions drawn from 15, shuffled every time. Renews yearly.",
    build: () => ({
      details: { category: "General H&S", level: "Mandatory", duration: "20 min", icon: "🎓", renewalMonths: 12, passMark: 80,
        quizDraw: 10, quizShuffle: true, signoff: { on: false, text: DEFAULT_SIGNOFF } },
      slides: [
        slide("What's changed this year", p("[Any changes to rules, equipment or procedures since last year.]")),
        slide("Reminder: the key rules", ul("[Rule]", "[Rule]", "[Rule]")),
        slide("Lessons from this year", p("[Near misses or incidents and what we learned — no names.]")),
      ],
      quiz: Array.from({ length: 15 }, (_, i) => tq(`[Question ${i + 1}]`, ["[Right answer]", "[Wrong answer]", "[Wrong answer]", "[Wrong answer]"], 0)),
    }),
  },
];

/** True while a template's [placeholder] wording is still in the module. */
export function hasPlaceholders(slides, quiz, signoffText) {
  const re = /\[[^\]]{2,}\]/;
  return (slides || []).some(s => re.test(s.heading || "") || re.test(s.text || ""))
    || (quiz || []).some(q => re.test(q.q || "") || (q.options || []).some(o => re.test(o || "")))
    || re.test(signoffText || "");
}

