import React from "react";

const EmojiCtx = React.createContext(true);

// `_emojiMode` is a plain module-level variable, not React state. E() reads
// it directly instead of calling useContext, so E() is safe to call from
// anywhere (including conditionally, inside loops, before hooks, etc.)
// without violating the Rules of Hooks. It's kept in sync with the real
// emojiMode state via syncEmojiMode(), which App.jsx calls in a useEffect.
let _emojiMode = true;

function syncEmojiMode(value) {
  _emojiMode = value;
}

function E(emoji, fallback) {
  return _emojiMode ? emoji : fallback;
}

export { EmojiCtx, E, syncEmojiMode };
