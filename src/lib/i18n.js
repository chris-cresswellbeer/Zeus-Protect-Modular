/**
 * src/lib/i18n.js — the portal's wording in the person's own language.
 *
 * WHO SEES WHAT
 *   Staff-facing screens (the phone app, the training module player on a computer,
 *   choosing a password) are shown in the language picked for the person:
 *   English, French, Polish or Romanian. Admin screens, certificates and reports
 *   stay in English, which is always the official version.
 *
 * HOW IT WORKS
 *   The English text IS the key: t("Begin module →") returns the French/Polish/
 *   Romanian line from src/lib/lang/<code>.js, or the English if there isn't one.
 *     t("Due in {n} days", { n: 4 })   placeholders in braces
 *     t(dueText(d))                     already-built English is matched against the
 *                                       dictionary's "{…}" lines, e.g. "Due in 4 days"
 *                                       → "Due in {n} days" → "Termin za 4 dni"
 *   tNodes() does the same but lets a placeholder be a React element (bold text etc.).
 *
 *   The language files are loaded only when someone needs them (English needs none).
 *   setLanguage() switches; components that call useLang() re-render when it changes.
 *
 * ADDING A LINE: wrap the English in t(…) and add the same English as a key to all
 * three files in src/lib/lang/. qr/i18nkeys.mjs fails if a key is missing.
 */
import React from "react";

export const LANGUAGES = [
  { code: "en", label: "English",  native: "English",  speech: "en-GB" },
  { code: "fr", label: "French",   native: "Français", speech: "fr-FR" },
  { code: "pl", label: "Polish",   native: "Polski",   speech: "pl-PL" },
  { code: "ro", label: "Romanian", native: "Română",   speech: "ro-RO" },
];
export const LANG_CODES = LANGUAGES.map(l => l.code);
export const langInfo = code => LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
export const normLang = code => (LANG_CODES.includes(code) ? code : "en");

const LOADERS = {
  fr: () => import("./lang/fr.js"),
  pl: () => import("./lang/pl.js"),
  ro: () => import("./lang/ro.js"),
};

let state = { lang: "en", dict: null, templates: [] };
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());

// "{name}" lines become patterns, so finished English sentences can be matched too.
function compile(dict) {
  const out = [];
  for (const key of Object.keys(dict || {})) {
    if (!key.includes("{")) continue;
    const names = [];
    const src = key.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, (_, n) => { names.push(n); return "(.+?)"; });
    try { out.push({ re: new RegExp("^" + src + "$", "s"), names, key }); } catch { /* skip a line that can't be a pattern */ }
  }
  // longest (most specific) first
  return out.sort((a, b) => b.key.length - a.key.length);
}

/** Switch language. Resolves once the wording is loaded (English: straight away). */
export async function setLanguage(code) {
  const lang = normLang(code);
  if (lang === state.lang && (lang === "en" || state.dict)) return;
  if (lang === "en") { state = { lang, dict: null, templates: [] }; emit(); return; }
  try {
    const mod = await LOADERS[lang]();
    const dict = mod.default || {};
    state = { lang, dict, templates: compile(dict) };
  } catch (e) {
    console.warn("[i18n] couldn't load", lang, e);
    state = { lang: "en", dict: null, templates: [] };
  }
  emit();
}

/** For tests / server-side use: install a dictionary directly. */
export function _setDictionary(lang, dict) { state = { lang, dict, templates: compile(dict) }; emit(); }

export const currentLang = () => state.lang;

function fill(s, vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

/** Translate one line of portal wording. */
export function t(key, vars) {
  if (key === null || key === undefined) return key;
  const s = String(key);
  const dict = state.dict;
  if (!dict) return fill(s, vars);
  if (Object.prototype.hasOwnProperty.call(dict, s)) return fill(dict[s], vars);
  if (!vars) {
    for (const tp of state.templates) {
      const m = s.match(tp.re);
      if (!m) continue;
      const found = {};
      tp.names.forEach((n, i) => { found[n] = m[i + 1]; });
      return fill(dict[tp.key], found);
    }
  }
  return fill(s, vars);
}

/** Like t(), but placeholders may be React elements: tNodes("Score {pct} needed", { pct: <b>70%</b> }). */
export function tNodes(key, vars) {
  const s = t(key);
  const parts = s.split(/(\{\w+\})/g);
  return parts.map((p, i) => {
    const m = p.match(/^\{(\w+)\}$/);
    if (m && vars && vars[m[1]] !== undefined) return React.isValidElement(vars[m[1]]) ? React.cloneElement(vars[m[1]], { key: i }) : String(vars[m[1]]);
    return p;
  });
}

/** Re-render when the language changes. Returns the current language code. */
export function useLang() {
  return React.useSyncExternalStore(
    fn => { listeners.add(fn); return () => listeners.delete(fn); },
    () => state.lang,
    () => state.lang,
  );
}

/** The person's language: their own choice (profile), else what an admin set, else English. */
export function languageOf(user, profiles) {
  if (!user) return "en";
  const list = Array.isArray(profiles) ? profiles : (typeof window !== "undefined" && Array.isArray(window.__userProfiles) ? window.__userProfiles : []);
  const p = list.find(r => String(r.user_id) === String(user.id));
  return normLang((p && p.data && p.data.language) || user.language || "en");
}

// ── Read aloud (the device's own voices; nothing is sent anywhere) ─────────────
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

/** The best voice on this device for a language, or null. */
export function voiceFor(code) {
  if (!canSpeak()) return null;
  const want = langInfo(code).speech.toLowerCase();
  const short = want.slice(0, 2);
  const voices = window.speechSynthesis.getVoices() || [];
  return voices.find(v => String(v.lang).toLowerCase().replace("_", "-") === want)
      || voices.find(v => String(v.lang).toLowerCase().startsWith(short))
      || null;
}

/** HTML → plain text for reading aloud. */
export function speakable(html) {
  const s = String(html || "");
  if (!/<[a-z!/]/i.test(s)) return s;
  if (typeof document === "undefined") return s.replace(/<[^>]+>/g, " ");
  const d = document.createElement("div");
  d.innerHTML = s.replace(/<(br|\/p|\/li|\/h\d|\/div)\b[^>]*>/gi, "$&\n");
  return (d.textContent || "").replace(/\n{2,}/g, "\n").trim();
}

/** Split text into short pieces at sentence ends: phones (Chrome on Android especially)
 *  stop or refuse to start on one long piece of speech. */
export function speechChunks(text, max = 180) {
  const out = [];
  String(text || "").replace(/\n+/g, " \u0000 ").replace(/\s+/g, " ").replace(/([.!?:;…]) /g, "$1\u0000").split(/\u0000/).forEach(sentence => {
    let rest = sentence.trim();
    while (rest.length > max) {   // a very long sentence: break at the last comma or space
      let cut = Math.max(rest.lastIndexOf(", ", max), rest.lastIndexOf(" ", max));
      if (cut < max / 3) cut = max;
      out.push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  });
  return out;
}

let speaking = [];   // the pieces being read (kept here so the browser doesn't drop them mid-way)
let run = 0;
/**
 * Speak text in a language. onEnd(result) is called once, when it finishes or is stopped:
 * result = { ok: true } | { ok: false, error } ("interrupted" when stopped on purpose).
 * onStart() is called when sound actually starts.
 */
export function speak(text, code, onEnd, onStart) {
  if (!canSpeak()) { if (onEnd) onEnd({ ok: false, error: "unsupported" }); return false; }
  const synth = window.speechSynthesis;
  const me = ++run;
  // Only stop what's playing if something is: on iPhones, stopping and then starting
  // straight away silently drops the new speech.
  if (synth.speaking || synth.pending) synth.cancel();
  try { synth.resume(); } catch { /* */ }   // Chrome sometimes leaves speech paused
  const pieces = speechChunks(speakable(text));
  if (!pieces.length) { if (onEnd) onEnd({ ok: true }); return false; }
  const v = voiceFor(code);
  let done = false, started = false;
  const finish = r => { if (done) return; done = true; if (me === run) speaking = []; if (onEnd) onEnd(r); };
  speaking = pieces.map((piece, i) => {
    const u = new window.SpeechSynthesisUtterance(piece);
    u.lang = v ? v.lang : langInfo(code).speech;
    if (v) u.voice = v;
    u.rate = 0.95;
    u.onstart = () => { if (!started) { started = true; if (onStart) onStart(); } };
    u.onend = () => { if (i === pieces.length - 1) finish({ ok: true }); };
    u.onerror = e => finish({ ok: false, error: (e && e.error) || "error" });
    return u;
  });
  speaking.forEach(u => synth.speak(u));
  return true;
}
export function stopSpeaking() { if (canSpeak() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) { run++; window.speechSynthesis.cancel(); } }

/** Voices arrive late on some browsers: re-render when they do. Returns true when a voice exists. */
export function useVoice(code) {
  const [, bump] = React.useState(0);
  React.useEffect(() => {
    if (!canSpeak()) return;
    const s = window.speechSynthesis;
    const on = () => bump(n => n + 1);
    if (s.addEventListener) s.addEventListener("voiceschanged", on); else s.onvoiceschanged = on;
    return () => { if (s.removeEventListener) s.removeEventListener("voiceschanged", on); };
  }, []);
  return !!voiceFor(code);
}
