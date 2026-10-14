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
import { startPrivateFiles } from "./lib/fileAccess";
import { FeedbackHost } from "./shared/Feedback";
import { WelcomeHost } from "./shared/WelcomeVideo";
import { SessionWarningHost } from "./shared/SessionTimeout";
import { registerServiceWorker, listenForInstall } from "./mobile/registerSW";
import { startBrand } from "./lib/brand";
import { watchStaleBuild } from "./lib/staleBuild";
import { UpdateBar } from "./shared/UpdateBar";

// New sign-in only: swap links to private files (documents, fire safety,
// incident photos) for short-lived signed links as they appear on screen.
// Does nothing with the old sign-in. See lib/fileAccess.js.
startPrivateFiles();

// Offline copy of the portal for phones (public/sw.js): opens with no signal, keeps
// module pictures, wakes queued saves, and offers "Install app". Production builds only.
// A page left open across a new release reloads itself if a part fails to download
// (lib/staleBuild.jsx), and gets a "New version — Reload" bar (UpdateBar below).
// Company branding (names, logos, colours): this device's saved copy at once, then the
// database copy (lib/brand.js). Works before sign-in, for the sign-in screen.
startBrand();
registerServiceWorker();
listenForInstall();
watchStaleBuild();

// Keyboard focus outlines: many buttons and boxes set outline:none in their inline styles,
// which hid where you were when using Tab. :focus-visible only shows the outline for
// keyboard use (not mouse clicks), so the look for mouse users doesn't change.
const focusCss = document.createElement("style");
focusCss.textContent = `
  :focus-visible { outline: 3px solid #f59e0b !important; outline-offset: 2px !important; border-radius: 4px; }
  input:focus-visible, select:focus-visible, textarea:focus-visible, [contenteditable]:focus-visible { outline: 2px solid #60a5fa !important; outline-offset: 0 !important; }
  @media (forced-colors: active) { :focus-visible { outline-color: Highlight !important; } }
`;
document.head.appendChild(focusCss);

// Certificate check (the QR code on a certificate): <portal>/?verify=ID shows only the
// check page (shared/VerifyPage.jsx), with no sign-in and none of the portal.
const VERIFY_ID = (() => { try { return new URLSearchParams(window.location.search).get("verify"); } catch { return null; } })();
const VerifyPage = React.lazy(() => import("./shared/VerifyPage").then(m => ({ default: m.VerifyPage })));

// React 18 root API. `document.getElementById("root")` must match the id in index.html.
if (VERIFY_ID !== null) {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.Suspense fallback={null}><VerifyPage initialId={VERIFY_ID}/></React.Suspense>
  );
} else ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    {/* on-page messages and confirmation windows (shared/Feedback.jsx) */}
    <FeedbackHost />
    {/* the welcome video on someone's very first sign-in (shared/WelcomeVideo.jsx) */}
    <WelcomeHost />
    {/* "Still there?" countdown before the 30-minute sign-out (shared/SessionTimeout.jsx) */}
    <SessionWarningHost />
    {/* "A new version is ready — Reload" after a release (shared/UpdateBar.jsx) */}
    <UpdateBar />
  </React.StrictMode>
);
