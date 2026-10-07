/**
 * lib/incidentAlert.js — ask the server to email about a high-risk incident straight away.
 *
 * Called after an incident or hazard report is saved (App.jsx dbSaveIncidentNow). The
 * server (netlify/functions/zp-email-alert.mjs) decides whether anything needs sending,
 * using the rules in Site Settings → Email reminders; this just says "check now".
 *   • the first save of an incident in this browser asks at once (keepalive, so it still goes
 *     if the page is closed straight after)
 *   • later saves of the same incident within a few seconds (the form saves more than once,
 *     or the full report is written) make one more call, after they've settled
 * With the individual sign-ins the call carries the person's sign-in, which the server checks.
 * Failures are ignored: the 15-minute job on the live site catches up.
 */
import { bearer } from "./supabase";

const ALERT_FN = "/.netlify/functions/zp-email-alert";
const WAIT_MS = 2500;
const timers = new Map();
const asked = new Set();

function call() {
  try {
    fetch(ALERT_FN, { method: "POST", headers: { "Content-Type": "application/json", Authorization: bearer() }, body: "{}", keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
}

export function pingIncidentAlert(id) {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  const k = String(id);
  if (!asked.has(k)) { asked.add(k); call(); return; }
  clearTimeout(timers.get(k));
  timers.set(k, setTimeout(() => { timers.delete(k); call(); }, WAIT_MS));
}
