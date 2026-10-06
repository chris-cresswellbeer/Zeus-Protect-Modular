/**
 * router.js — page addresses for the full (desktop) portal, so the browser's Back /
 * Forward buttons move between pages, a refresh returns to the same page after
 * signing in, and a page can be bookmarked or sent as a link.
 *
 *   #/admin/<tab>                 admin pages (atab), e.g. #/admin/reports
 *   #/staff/<tab>                 staff pages (stab), e.g. #/staff/documents
 *   #/staff/training/module/<id>  a module open in the player
 *
 * The phone layout (src/mobile) has its own Back handling and doesn't use these.
 */

export const ADMIN_TABS = ["dashboard", "users", "assign", "modules", "create", "reports", "documents", "coshh", "audit",
  "incidents", "investigation", "inspections", "ra", "firesafety", "firstaid", "contractors", "permits", "machinery",
  "equipment", "settings", "account"];
export const STAFF_TABS = ["dashboard", "training", "history", "documents", "incidents", "dse", "machinery", "actions", "team", "account"];

// Pages that need context which can't be in a link fall back to their list page.
const ADMIN_FALLBACK = { investigation: "incidents", create: "modules" };

/** "#/admin/reports" → { area:"admin", tab:"reports" }; anything unrecognised → null. */
export function parseRoute(hash) {
  const parts = String(hash || "").replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "admin" && ADMIN_TABS.includes(parts[1])) return { area: "admin", tab: ADMIN_FALLBACK[parts[1]] || parts[1] };
  if (parts[0] === "staff" && STAFF_TABS.includes(parts[1])) {
    const r = { area: "staff", tab: parts[1] };
    if (parts[1] === "training" && parts[2] === "module" && parts[3]) r.moduleId = parts[3];
    return r;
  }
  return null;
}

/** Address for the current page. */
export function routeHash({ view, atab, stab, moduleId }) {
  if (view === "admin") return `#/admin/${atab}`;
  if (view === "staff") return moduleId ? `#/staff/training/module/${encodeURIComponent(moduleId)}` : `#/staff/${stab}`;
  return "";
}

/** May this person open that page? (admin pages for admins; My Team for managers) */
export function routeAllowed(r, user) {
  if (!r || !user) return false;
  if (r.area === "admin") return user.role === "admin";
  if (r.tab === "team") return user.role === "manager" || user.role === "admin";
  return true;
}
