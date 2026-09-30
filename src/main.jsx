/**
 * ═══════════════════════════════════════════════════════════════════════════
 * main.jsx — Browser entry point
 * ═══════════════════════════════════════════════════════════════════════════
 * Vite loads this file from index.html (<script type="module" src="/src/main.jsx">).
 * Its only job is to mount the React tree into the <div id="root"> element.
 *
 * Everything else — login, data loading from Supabase, desktop vs. mobile
 * layout, navigation — lives in App.jsx (the "composition root").
 *
 * NOTE ON StrictMode:
 *   In development (`npm run dev`) React.StrictMode deliberately mounts every
 *   component twice and runs effects twice to expose side-effect bugs. So you
 *   may see duplicate console logs / duplicate network requests in dev.
 *   This does NOT happen in the production build (`npm run build`).
 *   Do not remove StrictMode to "fix" double requests — fix the effect instead.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// ⚠ PWA NOTE: src/mobile/registerSW.js exports registerServiceWorker(), and its
// comments say to call it from here — but it is NOT currently called anywhere.
// Until it is, public/sw.js never registers, so the offline shell, media cache,
// background-sync wake-ups and the "Install app" prompt won't work. To enable:
//     import { registerServiceWorker } from "./mobile/registerSW";
//     registerServiceWorker();
// (It only runs in production builds.) Remember to bump CACHE_VERSION in sw.js on deploys.
// React 18 root API. `document.getElementById("root")` must match the id in index.html.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
