/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/emoji.js — Emoji on/off switch
 * ═══════════════════════════════════════════════════════════════════════════
 * The portal lets users turn emoji icons off (some work PCs render them badly
 * or users find them unprofessional). Every place that shows an emoji calls
 *
 *     E("🔥", "Fire")        → returns "🔥" when emoji mode is on. In Professional
 *                              Mode it returns the plain symbol for "🔥" (♨︎, see
 *                              lib/plainSymbols.js), or the fallback if there isn't one.
 *
 * Emoji written WITHOUT E() are converted too in Professional Mode, by the page
 * watcher in lib/plainSymbols.js (started/stopped by App.jsx).
 *
 * HOW IT STAYS IN SYNC:
 *   App.jsx holds the real `emojiMode` React state and calls syncEmojiMode()
 *   inside a useEffect whenever it changes. Because App re-renders its whole
 *   tree after that state change, every E() call picks up the new value.
 *
 * WHY NOT useContext?
 *   An earlier version called React.useContext inside E(). Since E() is called
 *   inside loops and conditionals, that broke the Rules of Hooks and crashed
 *   with "change in the order of Hooks" after admin login. Do NOT turn E()
 *   back into a hook.
 *
 * `EmojiCtx` is still exported for any component that prefers to read the
 * context directly, but E() does not depend on it.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { toPlain } from "./plainSymbols";

/** React context carrying the emoji flag (default: on). Kept for compatibility; E() does not use it. */
const EmojiCtx = React.createContext(true);

// `_emojiMode` is a plain module-level variable, not React state. E() reads
// it directly instead of calling useContext, so E() is safe to call from
// anywhere (including conditionally, inside loops, before hooks, etc.)
// without violating the Rules of Hooks. It's kept in sync with the real
// emojiMode state via syncEmojiMode(), which App.jsx calls in a useEffect.
let _emojiMode = true;

/** Called by App.jsx only. Updates the flag that E() reads. */
function syncEmojiMode(value) {
  _emojiMode = value;
}

/**
 * Pick an emoji or its plain-text fallback depending on the user's setting.
 * @param {string} emoji     What to show when emoji mode is ON.
 * @param {*} fallback       Used in Professional Mode only if the emoji has no plain substitute.
 */
function E(emoji, fallback) {
  if (_emojiMode) return emoji;
  if (typeof emoji === "string") {
    const plain = toPlain(emoji);
    if (plain !== emoji) return plain;      // the plain black symbol
  }
  return fallback;
}

export { EmojiCtx, E, syncEmojiMode };
