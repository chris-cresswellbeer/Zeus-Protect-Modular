/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/session.js — createSessionActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Signing in and out (Supabase Auth, lib/auth.js), and opening a training module.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { meta as authMeta, signIn, signOut } from "../../lib/auth";
import { localDateTime } from "../../lib/dates";
import { clearRemembered } from "../../lib/remembered";
import { parseRoute, routeAllowed } from "../../lib/router";
import { sb } from "../../lib/supabase";
import { clearDrafts, confirmLeave } from "../../lib/unsaved";
import { hideWelcome } from "../../shared/WelcomeVideo";
import { loadBuiltInModules } from "../lazyParts";

export function createSessionActions(app) {
  const {
    dbRecordLogin, email, initialRouteRef, loadAllRef, LOCKOUT_MINUTES, loginAttempts, MAX_LOGIN_ATTEMPTS,
    pass, pendingModuleRef, setAtabRaw, setBuiltInModules, setDseDraft, setEmojiMode, setErr,
    setHotspotComplete, setLastLoginMap, setLoginAttempts, setMod, setMustChangePw, setPlayEnglish, setQans,
    setQdraw, setQextra, setQsub, setShowCelebration, setSigningIn, setStabRaw, setStep, setTheme, setUser, setViewRaw,
    setWelcomePending, user
  } = app;

  /**
   * Sign-in through Supabase Auth (lib/auth.js): Supabase checks the password and returns a
   * token; the account's app_metadata.zp_id links it to the staff record. Order: lockout
   * check → Supabase sign-in → staff record exists and isn't a leaver → load everything this
   * person may see → finishLogin (last login, saved theme, first page).
   * The lockout counter is a courtesy (in memory only); Supabase Auth limits attempts itself.
   */
  async function login() {
    const emailKey = email.toLowerCase().trim();
    // Counts a failed attempt for this email; locks it after MAX_LOGIN_ATTEMPTS.
    const registerFailure = () => setLoginAttempts(p => {
      const cur = p[emailKey]||{count:0};
      const count = cur.count + 1;
      const lockedUntil = count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_MINUTES * 60000 : null;
      setErr(count >= MAX_LOGIN_ATTEMPTS
        ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
        : `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - count} attempt${MAX_LOGIN_ATTEMPTS - count!==1?"s":""} remaining.`);
      return {...p, [emailKey]: {count, lockedUntil}};
    });

    // Check lockout
    const attempt = loginAttempts[emailKey];
    if (attempt?.lockedUntil && Date.now() < attempt.lockedUntil) {
      const minsLeft = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      setErr(`Too many failed attempts. Try again in ${minsLeft} minute${minsLeft!==1?"s":""}.`);
      return;
    }

    const r = await signIn(emailKey, pass);
    if (!r.ok) {
      if (r.error === "Invalid email or password.") registerFailure(); else setErr(r.error);
      return;
    }
    const m = authMeta(r.user);
    // The database now answers as this person: find their staff record, then load
    // everything they're allowed to see. Leavers are blocked even with a correct password
    // (their record is kept for training and incident history).
    setSigningIn(true);
    const ures = await sb.from("users").select("*");
    const su = (Array.isArray(ures.data) ? ures.data : []).map(x => x.data).find(x => x && String(x.id) === String(m.zp_id));
    if (!su) { setSigningIn(false); await signOut(); setErr("Your sign-in isn't linked to a staff record. Please contact your administrator."); return; }
    if ((su.status||"active") === "leaver") { setSigningIn(false); await signOut(); setErr("This account is no longer active. Please contact your administrator."); return; }
    if (loadAllRef.current) await loadAllRef.current();
    try { setBuiltInModules(await loadBuiltInModules()); } catch { /* shown as missing; the stale-page check reloads if a release replaced the file */ }
    setSigningIn(false);
    setMustChangePw(!!m.must_change_password);
    finishLogin(su);
  }

  // The end of a successful sign-in.
  function finishLogin(u) {
    const emailKey = String(u.email||"").toLowerCase().trim();
    // Success — clear attempts
    setLoginAttempts(p => { const n={...p}; delete n[emailKey]; delete n[email.toLowerCase().trim()]; return n; });
    const ts = localDateTime().replace("T"," ");   // UK time, as shown under Last Active
    setLastLoginMap(p=>({...p, [u.id]: ts}));
    // First ever sign-in? (no login recorded for them yet) → welcome video. Checked BEFORE
    // this login is recorded; if the check fails, no video (never shown to someone by mistake).
    (async () => {
      let first = false;
      try { const r = await sb.from("last_logins").select("user_id").eq("user_id", String(u.id)); first = !r.error && Array.isArray(r.data) && r.data.length === 0; } catch { /* */ }
      await dbRecordLogin(u.id, ts);
      if (first) setWelcomePending(true);
    })();
    // Restore saved theme for this user
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const profile = profiles.find(r => String(r.user_id) === String(u.id));
    // Their saved theme, or the default, so a shared computer doesn't keep the last person's.
    setTheme(profile?.data?.theme || "dark");
    setDseDraft(profile?.data?.dseDraft || null);
    if (profile?.data?.emojiMode === false) setEmojiMode(false);
    setUser(u); setErr("");
    // Back to the page in the address (refresh / bookmark / link) if this person may see it.
    const r = initialRouteRef.current || parseRoute(window.location.hash); initialRouteRef.current = null;
    if (r && routeAllowed(r, u)) {
      if (r.area === "admin") { setViewRaw("admin"); setAtabRaw(r.tab); }
      else { setViewRaw("staff"); setStabRaw(r.tab); pendingModuleRef.current = r.moduleId || null; }
    } else setViewRaw(u.role==="admin"?"admin":"staff");
  }

  // Ends the session (Supabase too) and reloads the page, so nothing the last person
  // could see stays in memory for the next person on this computer.
  async function logout() {
    if (!(await confirmLeave())) return;      // unsaved form? ask first
    // forget the page address, so the next person to sign in on this computer starts at their dashboard
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch { /* */ }
    // ...and forget their remembered filters (lib/remembered.js)
    clearRemembered();
    // ...and their unsaved-form drafts on this computer (lib/unsaved.jsx)
    clearDrafts(user && user.id);
    hideWelcome(); setWelcomePending(false);
    signOut().finally(() => window.location.reload());
  }

  // Opens a module in the player and resets all per-attempt state.
  function startMod(m) { setPlayEnglish(false); setMod(m); setStep(0); setQans({}); setQsub(false); setQdraw(null); setQextra({ checks: {}, signoff: null }); setShowCelebration(false); setHotspotComplete({}); }

  return {
    login, finishLogin, logout, startMod
  };
}
