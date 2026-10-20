/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/player.js — createPlayerActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * The module player: the module being played (in the person's language) and marking the quiz.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { passMarkOf } from "../../domains/training/completion";
import { certNumber } from "../../lib/brandCore";
import { todayISO } from "../../lib/dates";
import { clearProgress } from "../../lib/moduleProgress";
import { localiseModule, translationKey } from "../../lib/moduleTranslate";
import { attemptRecord, drawQuiz, markAttempt } from "../../domains/training/quizEngine";

export function createPlayerActions(app) {
  const {
    dbSaveCompletion, dbSaveQuizFailure, mod, moduleTrans, playEnglish, qans, qdraw, qextra, setComps, setQsub,
    setQuizFailures, setShowCelebration, user, userLang
  } = app;

  // Scores the quiz against the module's own pass mark (passMarkOf: default 70%,
  // set per module in Create/Edit Module). The phone player does the same.
  // A pass creates a certificate id "<prefix>-XXXXXXXX" (prefix: branding) and becomes their result. A fail
  // is logged to quiz_failures only — it never replaces an earlier pass, and it
  // doesn't count as completed.
  // Marks THIS attempt's questions (qdraw — a question bank asks only some of them) with
  // quizEngine.js, so every question type is marked the same way on the computer and the phone.
  // What is saved with the result: which questions were asked, what was answered, slide
  // knowledge-check tries and the signed declaration (attemptRecord). A module with only a
  // declaration and no questions scores 100% once it is signed.
  // `extra` lets the sign-off panel pass the signature straight in (state updates aren't
  // visible to this function until the next render).
  function submitQuiz(extra) {
    const att = { ...(qextra || {}), ...(extra || {}) };
    const draw = qdraw || drawQuiz(mod);
    const mark = markAttempt(mod, draw, qans);
    const pct = mark.pct;
    const answers = attemptRecord(mod, mark, att);
    const mark_ = passMarkOf(mod);
    setQsub(true);
    const certId = pct>=mark_ ? certNumber((user.id.toString(36) + mod.id + Date.now().toString(36)).toUpperCase().slice(-8)) : null;   // prefix from the branding
    if (pct>=mark_) {
      clearProgress(user.id, mod);   // passed: no place to carry on from (lib/moduleProgress.js)
      setShowCelebration(true);
      const rec = {score:pct, date:todayISO(), answers, certId, moduleVersion: mod.version||1,
        ...(pmod && pmod._trans ? { lang: pmod._trans.lang, translation: { hash: pmod._trans.hash, status: pmod._trans.status } } : {})};
      setComps(p=>({...p,[user.id]:{...p[user.id],[mod.id]:rec}}));
      dbSaveCompletion(user.id, mod.id, rec);
    }
    // Record failure for admin visibility (with the answers, for the question report)
    if (pct < mark_) {
      const failure = {
        id: "qf_" + Date.now(),
        userId: user.id,
        userName: user.name,
        moduleId: mod.id,
        moduleTitle: mod.title,
        moduleVersion: mod.version || 1,
        score: pct,
        date: todayISO(),
        acknowledged: false,
        passMark: mark_,
        answers,
      };
      setQuizFailures(p=>[...p, failure]);
      dbSaveQuizFailure(failure);
    }
  }

  const totalSlides = mod ? mod.content.length : 0;
  // The module as shown in the player: in the person's language unless they chose "Show in English".
  // Marking always uses the English module's answers (same order in every language).
  const pmod = mod && !playEnglish ? localiseModule(mod, userLang, moduleTrans[translationKey(mod.id, userLang)]) : mod;
  const quizStep = totalSlides+1;   // the quiz (and the sign-off declaration, if the module has one)

  return {
    submitQuiz, totalSlides, pmod, quizStep
  };
}
