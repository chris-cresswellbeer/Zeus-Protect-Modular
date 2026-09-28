// src/mobile/registerSW.js
//
// Call once from main.jsx. Safe to call in dev — it no-ops unless the build is
// served over https or localhost.

// ⚠ Currently NOT called from main.jsx — see the note there. Without it the service
// worker (public/sw.js) is never installed.
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

// True when running as an installed app (Android/desktop display-mode, or iOS
// home-screen `navigator.standalone`). Used to hide the Install button.
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export { registerServiceWorker, watchInstallPrompt, promptInstall, isStandalone };
