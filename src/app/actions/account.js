/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/account.js — createAccountActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * People and their accounts: staff records, profiles (theme, language, emoji setting), last sign-in,
 * temporary passwords (through the zp-admin function) and removing someone's records.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { adminCall } from "../../lib/auth";
import { normLang } from "../../lib/i18n";
import { dbWrite, sb } from "../../lib/supabase";
import { notify } from "../../shared/Feedback";

export function createAccountActions(app) {
  const {
    setProfilesTick, user
  } = app;

  async function dbRecordLogin(userId, ts) {
    await dbWrite(sb.from("last_logins").upsert({ user_id: String(userId), last_login: ts }, { onConflict: "user_id" }), "last login");
  }

  // user_profiles.data holds per-user UI preferences ({theme, emojiMode}). Merge, don't overwrite.
  async function dbSaveTheme(userId, themeKey) {
    const sid = String(userId);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}), theme: themeKey };
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    return dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "theme preference");
  }

  // Same merge pattern, for the person's language ("en" | "fr" | "pl" | "ro").
  async function dbSaveLanguage(userId, code) {
    const sid = String(userId);
    const lang = normLang(code);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}), language: lang };
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    setProfilesTick(n => n + 1);
    return dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "language preference");
  }
  // The signed-in person's own choice of language.
  function chooseLanguage(code) { if (!user) return; dbSaveLanguage(user.id, code); }

  // Same merge pattern as dbSaveTheme, for the emoji on/off preference.
  async function dbSaveEmojiMode(userId, enabled) {    const sid = String(userId);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}), emojiMode: enabled };
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    await dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "emoji mode preference");
  }

  // users table: { id: TEXT, data: JSON user object }. `user` here shadows the logged-in user — it's the record being saved.
  async function dbSaveUser(user) {
    const ok = await dbWrite(sb.from("users").upsert({ id: String(user.id), data: user }, { onConflict: "id" }), "user", { alertOnError: true });
    // Copy login, role and leaver status onto their sign-in account (netlify/functions/zp-admin).
    if (ok) {
      const r = await adminCall("sync", { userId: String(user.id) });
      if (!r.ok) notify(`The staff record was saved, but their sign-in account wasn't updated:\n${r.error}`, { kind: "error" });
    }
    return ok;
  }

  // Set a temporary password (they choose their own at next sign-in).
  // Creates the sign-in account if they don't have one yet.
  async function setTempPasswordFor(u, password) {
    const r = await adminCall("setPassword", { userId: String(u.id), password, temporary: true });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async function dbDeleteUser(userId) {
    const ok = await dbWrite(sb.from("users").delete().eq("id", String(userId)), "user delete", { alertOnError: true });
    if (!ok) return false;   // refused (e.g. a super admin's record): leave their sign-in alone too
    const r = await adminCall("remove", { userId: String(userId) });
    if (!r.ok) notify(`The staff record was removed, but their sign-in account wasn't:\n${r.error}`, { kind: "error" });
  }

  // ⚠ Writes the WHOLE user object into user_profiles.data — this overwrites any saved
  // theme/emojiMode for that user. Only called on create/edit of staff records.
  // Merge into what's there: the profile also holds the person's own preferences
  // (theme, emojiMode, an unfinished DSE), which an admin edit must not wipe.
  async function dbSaveUserProfile(user) {
    const sid = String(user.id);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}), ...user };
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    setProfilesTick(n => n + 1);   // an admin may have changed the language
    await dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "user profile");
  }

  // Remove (not Leaver): delete everything the portal holds about one person, so
  // nothing is left behind. Incidents they reported, investigations, inspections and
  // the Audit Trail are company records and are kept. Returns the rows deleted per table.
  const PERSON_TABLES = ["training_assigns", "training_completions", "training_completion_history", "doc_assignments",
    "doc_acknowledgements", "doc_ack_history", "dse_reports", "dse_admin_responses", "ext_certs", "machine_completions",
    "last_logins", "user_profiles", "dashboard_layout"];
  async function dbDeletePersonRecords(userId) {
    const uid = String(userId);
    const results = await Promise.all([
      ...PERSON_TABLES.map(t => dbWrite(sb.from(t).delete().eq("user_id", uid), `${t} delete`)),
      dbWrite(sb.from("quiz_failures").delete().eq("data->>userId", uid), "quiz failures delete"),
    ]);
    return results.every(Boolean);
  }

  async function dbDeleteUserProfile(userId) {
    await dbWrite(sb.from("user_profiles").delete().eq("user_id", String(userId)), "user profile delete");
  }

  return {
    dbRecordLogin, dbSaveTheme, dbSaveLanguage, chooseLanguage, dbSaveEmojiMode, dbSaveUser,
    setTempPasswordFor, dbDeleteUser, dbSaveUserProfile, PERSON_TABLES, dbDeletePersonRecords,
    dbDeleteUserProfile
  };
}
