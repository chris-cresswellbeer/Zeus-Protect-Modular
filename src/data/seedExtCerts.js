/**
 * data/seedExtCerts.js — types of externally-issued certificates tracked per staff member.
 * REFERENCE DATA — used by the live app on every load. Editing it changes the app for
 * everyone on the next deploy (it is code, not database data).
 * `id` is the storage key (ext_certs.cert_type) — "first_aid" is also what the First Aid
 * Register looks for, and "fire_marshall" (old spelling, kept as the id) is the Fire Warden
 * certificate: Fire Safety → Wardens lists everyone who has one (fireSafety/fireLogic.js),
 * and ReportsTab exports read it. Both carry `zones` (areas covered).
 * Add a type here to make it appear in uploads, reports and staff dashboards.
 */
const EXT_CERT_TYPES = [
  { id: "first_aid", label: "First Aid", icon: "🩺", color: "#ef4444", renewalMonths: 36 },
  { id: "fire_marshall", label: "Fire Warden", icon: "🔥", color: "#f97316", renewalMonths: 36 },
];

export { EXT_CERT_TYPES };
