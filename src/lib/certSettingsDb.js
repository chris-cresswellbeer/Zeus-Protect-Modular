/**
 * lib/certSettingsDb.js — load / save the certificate settings
 * (app_settings row "certificate"; Site Settings → Certificates).
 * Everyone signed in can read app_settings (db_rules.sql), so every certificate shows
 * the signature; only admins can save. The signature is kept as a small PNG inside the
 * row (not a public file link), so it can't be fetched by anyone who isn't signed in.
 */
import { sb } from "./supabase";
import { certSettings, CERT_SETTINGS_ROW } from "./certificate";

let cache = null;        // settled settings
let pending = null;      // the load in progress

/** The settings (loaded once per page; saveCertSettings refreshes the copy). */
export function loadCertSettings({ fresh = false } = {}) {
  if (cache && !fresh) return Promise.resolve(cache);
  if (pending && !fresh) return pending;
  pending = (async () => {
    try {
      const r = await sb.from("app_settings").select("*").eq("id", CERT_SETTINGS_ROW);
      cache = certSettings(r && r.data && r.data[0] ? r.data[0].data : null);
    } catch { cache = certSettings(null); }
    pending = null;
    return cache;
  })();
  return pending;
}

export async function saveCertSettings(d) {
  const data = certSettings(d);
  const r = await sb.from("app_settings").upsert({ id: CERT_SETTINGS_ROW, data, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (r && r.error) throw new Error(r.error.message || String(r.error));
  cache = data;
  return data;
}

/** The Google Fonts the certificate uses, added to the page once. */
export function ensureCertFonts(href) {
  if (typeof document === "undefined" || document.getElementById("zp-cert-fonts")) return;
  const l = document.createElement("link");
  l.id = "zp-cert-fonts"; l.rel = "stylesheet"; l.href = href;
  document.head.appendChild(l);
}
