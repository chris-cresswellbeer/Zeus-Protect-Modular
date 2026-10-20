/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/effects/useSessionEffects.js — useSessionEffects(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Effects that follow the signed-in person and the page: their theme and language, the emoji
 * setting, the welcome video, the page address (Back / Forward), the viewport, signing out after
 * 30 minutes without activity, and remembering the slide reached in a module.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useEffect } from "react";
import { ensureRteStyles } from "../../domains/training/slideTextUtils";
import { signOut } from "../../lib/auth";
import { syncEmojiMode } from "../../lib/emoji";
import { languageOf, setLanguage } from "../../lib/i18n";
import { applyLightThemeFix, isLightTheme } from "../../lib/lightThemeFix";
import { saveProgress } from "../../lib/moduleProgress";
import { startPlainSymbols, stopPlainSymbols } from "../../lib/plainSymbols";
import { parseRoute, routeAllowed, routeHash } from "../../lib/router";
import { confirmLeave, unsavedLabels } from "../../lib/unsaved";
import { notifyAfterReload, setFeedbackTheme } from "../../shared/Feedback";
import { setSessionTheme, startSession, stopSession } from "../../shared/SessionTimeout";
import { loadWelcomeVideo, showWelcome } from "../../shared/WelcomeVideo";
import { applyThemeVars, rememberTheme } from "../../theme/tokens";
import { loadBuiltInModules } from "../lazyParts";

export function useSessionEffects(app) {
  const {
    allModules, atab, brand, emojiMode, font, logout, mod, mustChangePw, pendingModuleRef, phoneLayout,
    profilesTick, qsub, routerOn, routeStartedRef, setAtabRaw, setBuiltInModules, setMod, setStabRaw,
    setUserLang, setViewRaw, setWelcomePending, signedIn, stab, startMod, step, T, theme, user, view,
    welcomePending
  } = app;
  useEffect(() => { if (signedIn) rememberTheme(theme); }, [theme, signedIn]);
  // The signed-in person's language (their own choice, else the one an admin set): load its wording.
  // Signed out → English (the sign-in page is always English).
  useEffect(() => {
    const code = user ? languageOf(user) : "en";
    setUserLang(code);
    setLanguage(code);
  }, [user?.id, user?.language, profilesTick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    syncEmojiMode(emojiMode);
    // Professional Mode: swap every emoji on the page for its plain symbol
    // (including ones not wrapped in E()); switching back restores them.
    if (emojiMode) stopPlainSymbols(); else startPlainSymbols();
  }, [emojiMode]);
  useEffect(() => { ensureRteStyles(); }, []);
  useEffect(() => { loadBuiltInModules().then(setBuiltInModules, e => console.error("Built-in modules didn't load:", e)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFeedbackTheme(T, font); }, [theme]); // eslint-disable-line
  useEffect(() => {
    if (!welcomePending || !user || mustChangePw) return;
    setWelcomePending(false);
    loadWelcomeVideo().then(v => { if (v) showWelcome({ video: v, name: user.name, Z: T, font }); });
  }, [welcomePending, user, mustChangePw]); // eslint-disable-line
  useEffect(() => { if (!phoneLayout) { applyLightThemeFix(isLightTheme(theme)); applyThemeVars(theme); } }, [theme, phoneLayout, brand]);   // brand: its colours change the default theme
  useEffect(() => {
    if (!routerOn) return;
    const h = routeHash({ view, atab, stab, moduleId: view === "staff" && mod ? mod.id : null });
    if (!h || window.location.hash === h) { routeStartedRef.current = true; return; }
    if (!routeStartedRef.current) { window.history.replaceState(null, "", h); routeStartedRef.current = true; }
    else window.history.pushState(null, "", h);
  }, [routerOn, view, atab, stab, mod && mod.id]); // eslint-disable-line
  // Back / Forward
  useEffect(() => {
    if (!routerOn) return;
    const onPop = async () => {
      const r = parseRoute(window.location.hash);
      if (!r || !routeAllowed(r, user)) return;
      // unsaved work: ask once; if they stay, the address is put back by the effect above
      if (unsavedLabels().length && !(await confirmLeave())) { window.history.pushState(null, "", routeHash({ view, atab, stab, moduleId: view === "staff" && mod ? mod.id : null })); return; }
      if (r.area === "admin") { setMod(null); setViewRaw("admin"); setAtabRaw(r.tab); return; }
      setViewRaw("staff"); setStabRaw(r.tab);
      const m = r.moduleId && allModules.find(x => String(x.id) === r.moduleId);
      if (m) { if (!mod || mod.id !== m.id) startMod(m); } else setMod(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [routerOn, user, allModules, mod, view, atab, stab]); // eslint-disable-line
  // A module in the address (refresh in the player) reopens once modules have loaded.
  useEffect(() => {
    const id = pendingModuleRef.current;
    if (!id || !user) return;
    const m = allModules.find(x => String(x.id) === id);
    if (m) { pendingModuleRef.current = null; startMod(m); }
  }, [allModules, user]); // eslint-disable-line

  // (maximum-scale=1 stops iOS auto-zooming into inputs, but also disables pinch-zoom — an accessibility trade-off.)
  // ── Ensure correct viewport meta tag for mobile ─────────────────────────────
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
  }, []);

  // ── Inactivity timeout — sign out after 30 minutes of no activity ───────────
  // shared/SessionTimeout.jsx: 2-minute countdown warning with "Stay signed in";
  // a playing video counts as activity. Same on the phone layout.
  useEffect(() => {
    if (!user) { stopSession(); return; }
    startSession({
      Z: T, font,
      onSignOut: () => logout(),
      onExpire: () => {
        notifyAfterReload("You were signed out after 30 minutes without activity. Sign in again to carry on where you were.", { kind: "info", timeout: 0 });
        signOut().finally(() => window.location.reload());
      },
    });
    return () => stopSession();
  }, [user]); // eslint-disable-line
  useEffect(() => { setSessionTheme(T, font); }, [theme]); // eslint-disable-line
  // Remember the slide reached in a module so it can be carried on later (lib/moduleProgress.js)
  useEffect(() => {
    if (!mod || !user || view !== "staff" || qsub || step < 1) return;
    saveProgress(user.id, mod, step);
  }, [mod && mod.id, step]); // eslint-disable-line
}
