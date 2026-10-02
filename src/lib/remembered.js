import React from "react";

/**
 * remembered.js — filters and view choices that stay as you left them while you move
 * around the portal, and after a refresh, until the browser tab is closed or you sign out.
 *
 *   const [manager, setManager] = useRemembered("matrix.manager", "all");
 *
 * Works exactly like useState. Values live in sessionStorage (this tab only) under
 * "zp.view.<key>"; signing out clears them (clearRemembered) so the next person on a
 * shared computer starts fresh. Free-text search boxes are deliberately NOT remembered,
 * so a list never opens mysteriously filtered.
 */

const PREFIX = "zp.view.";

function read(key, initial) {
  try {
    const s = sessionStorage.getItem(PREFIX + key);
    return s == null ? initial : JSON.parse(s);
  } catch { return initial; }
}

export function useRemembered(key, initial) {
  const [v, setV] = React.useState(() => read(key, initial));
  React.useEffect(() => {
    try {
      if (JSON.stringify(v) === JSON.stringify(initial)) sessionStorage.removeItem(PREFIX + key);
      else sessionStorage.setItem(PREFIX + key, JSON.stringify(v));
    } catch { /* private browsing / storage full: just not remembered */ }
  }, [key, v]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, setV];
}

/** Sign-out: forget every remembered choice in this tab. */
export function clearRemembered() {
  try {
    Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX)).forEach(k => sessionStorage.removeItem(k));
  } catch { /* */ }
}
