/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/brand.js — loading, saving and using the branding (see lib/brandCore.js)
 * ═══════════════════════════════════════════════════════════════════════════
 *   startBrand()        main.jsx: the copy saved on this device straight away (no flash
 *                       of the wrong name), then the database copy
 *   loadBrand()         read from the database (works before sign-in: public.zp_brand())
 *   saveBrand(d)        super admins only (the database refuses anyone else);
 *                       resolves to an error message or null
 *   useBrand()          hook → the current branding; re-renders when it changes
 *   uploadBrandLogo(kind, file)   → public link in the "assets" bucket (brand/…)
 * The page title and the default theme's colours follow the branding too.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON } from "./supabase";
import { getBrand, setBrand, onBrand, normaliseBrand } from "./brandCore";
import { applyBrandColours } from "../theme/tokens";
import { AUTH_MODE } from "./auth";

const KEY = "zp_brand_v1";
const ROW = "brand";

function remember(d) { try { localStorage.setItem(KEY, JSON.stringify(d || null)); } catch { /* private mode */ } }
function apply(b) {
  applyBrandColours(b.primary, b.accent);
  if (typeof document !== "undefined") document.title = b.product;
}
onBrand(apply);

/** The stored copy on this device first, then the database. */
export function startBrand() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) setBrand(s); else apply(getBrand()); } catch { apply(getBrand()); }
  loadBrand();
}

/** Read the branding row. Before sign-in this goes through the public zp_brand() function. */
export async function loadBrand() {
  let data, found = false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/zp_brand`, { method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" }, body: "{}" });
    if (res.ok) { const j = await res.json(); if (j && typeof j === "object" && !Array.isArray(j)) { data = j; found = true; } else if (j === null) found = true; }
  } catch { /* offline: keep what we have */ }
  // the function isn't there (the old sign-in, or a project without db_rules.sql/branding.sql):
  // read the table — only with the old sign-in, where the table is open (with the new sign-in
  // the database rules would refuse it anyway)
  if (!found && AUTH_MODE !== "supabase") {
    try {
      const r = await sb.from("app_settings").select("*").eq("id", ROW);
      if (!r.error && Array.isArray(r.data)) { data = r.data[0] ? r.data[0].data : null; found = true; }
    } catch { /* keep */ }
  }
  if (found) { setBrand(data || null); remember(data || null); }
  return getBrand();
}

/** Save the branding (super admins). Resolves to an error message, or null when saved. */
export async function saveBrand(d) {
  const b = normaliseBrand(d);
  const { saved, ...data } = b;   // eslint-disable-line no-unused-vars
  try {
    const r = await sb.from("app_settings").upsert({ id: ROW, data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (r && r.error) {
      const msg = String(r.error.message || r.error);
      return /super admin/i.test(msg) ? "Only a super admin can change the branding." : msg;
    }
  } catch (e) { return String(e && e.message || e); }
  setBrand(data); remember(data);
  return null;
}

/** Upload a logo image to the public "assets" bucket and return its link (or throw). */
export async function uploadBrandLogo(kind, file) {
  const ext = (String(file.name || "").split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
  const path = `brand/${kind}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.upload("assets", path, file);
  if (error) throw new Error(/row-level|policy|403|Unauthorized/i.test(String(error)) ? "Only a super admin can upload logos." : String(error));
  return sb.storage.getPublicUrl("assets", path);
}

/** Current branding; the component re-renders when it changes. */
export function useBrand() {
  const [b, set] = React.useState(getBrand);
  React.useEffect(() => { const off = onBrand(set); set(getBrand()); return off; }, []);   // catch a change made before subscribing
  return b;
}
