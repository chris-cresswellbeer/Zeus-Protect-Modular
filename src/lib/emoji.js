import React from "react";

const EmojiCtx = React.createContext(true);
function E(emoji, fallback) {
  const emojiMode = React.useContext(EmojiCtx);
  return emojiMode ? emoji : fallback;
}

export { EmojiCtx, E };
