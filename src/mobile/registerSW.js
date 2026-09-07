// src/mobile/registerSW.js
//
// Call once from main.jsx. Safe to call in dev — it no-ops unless the build is
// served over https or localhost.

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[pwa] service worker registration failed", err);
    });
  });
}

// Captures the install prompt so we can offer it from More > Install.
// Chrome/Edge/Android only; iOS needs the manual "Add to Home Screen" explainer.
let _deferredPrompt = null;

function watchInstallPrompt(onAvailable) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    if (onAvailable) onAvailable(true);
  });
  window.addEventListener("appinstalled", () => {
    _deferredPrompt = null;
    if (onAvailable) onAvailable(false);
  });
}

async function promptInstall() {
  if (!_deferredPrompt) return "unavailable";
  _deferredPrompt.prompt();
  const { outcome } = await _deferredPrompt.userChoice;
  _deferredPrompt = null;
  return outcome;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export { registerServiceWorker, watchInstallPrompt, promptInstall, isStandalone };
