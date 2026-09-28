/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/emoji.js — Emoji on/off switch
 * ═══════════════════════════════════════════════════════════════════════════
 * The portal lets users turn emoji icons off (some work PCs render them badly
 * or users find them unprofessional). Every place that shows an emoji calls
 *
 *     E("🔥", "Fire")        → returns "🔥" when emoji mode is on, "Fire" when off
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
 * @param {*} fallback       What to show when OFF (usually a short string, may be "" or a JSX node).
 */
function E(emoji, fallback) {
  return _emojiMode ? emoji : fallback;
}

export { EmojiCtx, E, syncEmojiMode };
