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

export function createPlayerActions(app) {
  const {
    dbSaveCompletion, dbSaveQuizFailure, mod, moduleTrans, playEnglish, qans, setComps, setQsub,
    setQuizFailures, setShowCelebration, user, userLang
  } = app;

  // Scores the quiz against the module's own pass mark (passMarkOf: default 70%,
  // set per module in Create/Edit Module). The phone player does the same.
  // A pass creates a certificate id "<prefix>-XXXXXXXX" (prefix: branding) and becomes their result. A fail
  // is logged to quiz_failures only — it never replaces an earlier pass, and it
  // doesn't count as completed.
  function submitQuiz() {
    let score=0;
    mod.quiz.forEach((q,i)=>{ if(qans[i]===q.answer) score++; });
    const pct=Math.round(score/mod.quiz.length*100);
    const mark = passMarkOf(mod);
    setQsub(true);
    const certId = pct>=mark ? certNumber((user.id.toString(36) + mod.id + Date.now().toString(36)).toUpperCase().slice(-8)) : null;   // prefix from the branding
    if (pct>=mark) {
      clearProgress(user.id, mod);   // passed: no place to carry on from (lib/moduleProgress.js)
      setShowCelebration(true);
      const rec = {score:pct, date:todayISO(), answers:{...qans}, certId, moduleVersion: mod.version||1,
        ...(pmod && pmod._trans ? { lang: pmod._trans.lang, translation: { hash: pmod._trans.hash, status: pmod._trans.status } } : {})};
      setComps(p=>({...p,[user.id]:{...p[user.id],[mod.id]:rec}}));
      dbSaveCompletion(user.id, mod.id, rec);
    }
    // Record failure for admin visibility
    if (pct < mark) {
      const failure = {
        id: "qf_" + Date.now(),
        userId: user.id,
        userName: user.name,
        moduleId: mod.id,
        moduleTitle: mod.title,
        score: pct,
        date: todayISO(),
        acknowledged: false,
        passMark: mark,
      };
      setQuizFailures(p=>[...p, failure]);
      dbSaveQuizFailure(failure);
    }
  }

  const totalSlides = mod ? mod.content.length : 0;
  // The module as shown in the player: in the person's language unless they chose "Show in English".
  // Marking always uses the English module's answers (same order in every language).
  const pmod = mod && !playEnglish ? localiseModule(mod, userLang, moduleTrans[translationKey(mod.id, userLang)]) : mod;
  const quizStep = totalSlides+1;

  return {
    submitQuiz, totalSlides, pmod, quizStep
  };
}
