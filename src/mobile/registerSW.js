// src/mobile/registerSW.js — the offline copy of the portal (public/sw.js)
//
// registerServiceWorker() is called once from main.jsx. It only runs in a
// production build served over https (or localhost), and not when the portal is
// being driven by automated tests (they opt in with localStorage "zpTestSW").
//
// New releases: the worker is re-checked when the app opens, every 30 minutes, and
// whenever the phone comes back to the app. When a new release has taken over while
// the portal is open, a "zp-update-ready" event is sent; main.jsx shows a small
// "New version — Reload" bar (it never reloads by itself, so no one loses a form).

let _registration = null;

function testOptIn() {
  try { return localStorage.getItem("zpTestSW") === "1"; } catch { return false; }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  if (navigator.webdriver && !testOptIn()) return;

  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // The very first install also "changes" the controller — that isn't an update.
    if (hadController) window.dispatchEvent(new Event("zp-update-ready"));
    hadController = true;
  });

  const start = () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((reg) => {
      _registration = reg;
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    }).catch((err) => {
      console.warn("[pwa] service worker registration failed", err);
    });
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
}

/** "Keep modules offline": ask the worker to save these module pictures now. */
async function keepMediaOffline(urls) {
  if (!("serviceWorker" in navigator) || !urls || !urls.length) return false;
  try {
    const reg = _registration || await navigator.serviceWorker.getRegistration();
    const w = reg && (reg.active || reg.waiting || reg.installing);
    if (!w) return false;
    w.postMessage({ type: "zeus-keep-media", urls });
    return true;
  } catch { return false; }
}

// Captures the install prompt so we can offer it from More > Install.
// Chrome/Edge/Android only; iOS needs the manual "Add to Home Screen" explainer.
let _deferredPrompt = null;
const _installWatchers = new Set();
let _listening = false;

// Started from main.jsx (the browser can offer the prompt before the phone screens load).
function listenForInstall() {
  if (_listening) return;
  _listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    _installWatchers.forEach((f) => f(true));
  });
  window.addEventListener("appinstalled", () => {
    _deferredPrompt = null;
    _installWatchers.forEach((f) => f(false));
  });
}

function watchInstallPrompt(onAvailable) {
  listenForInstall();
  if (!onAvailable) return () => {};
  _installWatchers.add(onAvailable);
  if (_deferredPrompt) onAvailable(true);
  return () => _installWatchers.delete(onAvailable);
}

async function promptInstall() {
  if (!_deferredPrompt) return "unavailable";
  const p = _deferredPrompt;
  _deferredPrompt = null;
  p.prompt();
  const { outcome } = await p.userChoice;
  _installWatchers.forEach((f) => f(false));
  return outcome;
}

// True when running as an installed app (Android/desktop display-mode, or iOS
// home-screen `navigator.standalone`). Used to hide the Install button.
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export { registerServiceWorker, listenForInstall, keepMediaOffline, watchInstallPrompt, promptInstall, isStandalone };
