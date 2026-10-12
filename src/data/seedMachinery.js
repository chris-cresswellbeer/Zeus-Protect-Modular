/**
 * data/seedMachinery.js — machine types, competence statuses, helpers + demo records.
 * isWarehouseWorker(user) — the single rule deciding who gets machinery/"My Machinery".
 * MACHINERY_TYPES / MACHINE_CATEGORIES / COMP_STATUS are REFERENCE DATA (admins can add
 *   more types in-app → custom_machine_types). Competence records store the machine `id`.
 * machineExpiryStatus(comp, types) — expiry = the EARLIER of (assessmentDate + type.renewalMonths)
 *   and the licence expiry date typed on the record. Either may be missing.
 * machineState(comp, types) — the one status everything shows (matrix, lists, reports, PDF):
 *   competent | expiring | expired | provisional | not_assessed  (see MACHINE_STATE).
 *   Admins only choose Competent / Provisional / Not assessed; expiry is worked out.
 *   (Records saved before this change with status "expired" still show as expired.)
 * compsFor(machineComps, userId) — a person's records as an array. Records are kept as
 *   { [userId]: { [recordId]: record } } (older seed data used arrays; both work).
 * (The demo competence records moved to demo/seedMachinery.js — test scripts only.)
 * (e.g. a brand-new install). Once real rows exist, edits here have NO effect.
 */
import { EXPIRY_WARNING_DAYS } from "../lib/dates";

function isWarehouseWorker(user) {
  if (!user) return false;
  return user.isWarehouseWorker === true;
}

/**
 * May this person manage the Machinery Competence and Equipment Register pages?
 * Admins always; anyone else when an admin has switched on "Machinery & Equipment
 * access" in Edit Staff (users.data.machineryAccess). The database checks the same
 * flag in the sign-in version (machinery_access.sql / db_rules.sql zp.machinery_access()).
 */
function hasMachineryAccess(user) {
  if (!user) return false;
  return user.role === "admin" || user.machineryAccess === true;
}

const MACHINERY_TYPES = [
  { id:"flt",      icon:"🏗",  label:"Counterbalance FLT",       category:"Forklift", licenceRequired:true,  renewalMonths:36, notes:"RTITB/ITSSAR licence required. Medical fitness check advised." },
  { id:"reach",    icon:"📦",  label:"Reach Truck",              category:"Forklift", licenceRequired:true,  renewalMonths:36, notes:"Separate licence from counterbalance. Aisle width and height restrictions apply." },
  { id:"hlp",      icon:"🔼",  label:"High Level Order Picker",  category:"Forklift", licenceRequired:true,  renewalMonths:36, notes:"Working at height competence required. Harness use mandatory above 2m." },
  { id:"vna",      icon:"🔀",  label:"VNA Truck",                category:"Forklift", licenceRequired:true,  renewalMonths:36, notes:"Wire-guided or rail-guided. Site-specific training required." },
  { id:"pump",     icon:"🛒",  label:"Pump Truck (Manual)",      category:"Handling", licenceRequired:false, renewalMonths:0,  notes:"Informal competency assessment. Safe working load must not be exceeded." },
  { id:"epump",    icon:"🔋",  label:"Electric Pallet Truck",    category:"Handling", licenceRequired:false, renewalMonths:24, notes:"Pedestrian-controlled or ride-on. Battery safety and charging awareness required." },
  { id:"baler",    icon:"📦",  label:"Baler / Compactor",        category:"Machinery",licenceRequired:false, renewalMonths:24, notes:"Lockout/tagout awareness. No manual insertion of material while running." },
  { id:"wrapper",  icon:"🌀",  label:"Pallet Wrapper",           category:"Machinery",licenceRequired:false, renewalMonths:0,  notes:"Trip hazard from film. Correct wrapping tension to prevent load shift." },
  { id:"conveyor", icon:"➡",   label:"Conveyor Systems",         category:"Machinery",licenceRequired:false, renewalMonths:24, notes:"Entrapment risks. Emergency stop locations must be known before operation." },
  { id:"docklevy", icon:"🚪",  label:"Dock Leveller",            category:"Handling", licenceRequired:false, renewalMonths:24, notes:"Bridging plate load limits. Vehicle restraint use where fitted." },
  { id:"tractor",  icon:"🚜",  label:"Yard Tractor",             category:"Handling", licenceRequired:true,  renewalMonths:36, notes:"Site yard tractor. Not licensed for road use unless otherwise specified." },
  { id:"scissor",  icon:"🪜",  label:"Scissor / Boom Lift (MEWP)",category:"Machinery",licenceRequired:true,  renewalMonths:36, notes:"IPAF PA1/PA3A or equivalent required. Working at height rules apply." },

];

const MACHINE_CATEGORIES = [...new Set(MACHINERY_TYPES.map(m=>m.category))];

const COMP_STATUS = {
  competent:   { label:"Competent",         color:"#10b981", bg:"rgba(16,185,129,0.12)", icon:"✅" },
  provisional: { label:"Provisional",        color:"#f59e0b", bg:"rgba(245,158,11,0.12)", icon:"⏳" },
  expired:     { label:"Renewal Required",   color:"#ef4444", bg:"rgba(239,68,68,0.12)",  icon:"⚠" },
  not_assessed:{ label:"Not Assessed",       color:"#64748b", bg:"rgba(100,116,139,0.12)",icon:"—"  },
};

// A date we can trust: "YYYY-MM-DD" that is a real day. Anything else (typed text, "TBC") is ignored.
const okDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) && !isNaN(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))) ? d.slice(0, 10) : null;
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
// months added in UTC, so a clock change can't move the date by a day
const plusMonths = (d, n) => { const t = new Date(utc(d)); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0, 10); };
const todayLocal = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

function machineExpiryStatus(comp, types) {
  if (!comp) return null;
  const list = types || MACHINERY_TYPES;
  const m = list.find(x=>x.id===comp.machineId);
  const dates = [];
  const assessed = okDate(comp.assessmentDate), licence = okDate(comp.licenceExpiry);
  if (m && Number(m.renewalMonths) > 0 && assessed) dates.push({ date: plusMonths(assessed, Number(m.renewalMonths)), source: "renewal" });
  if (licence) dates.push({ date: licence, source: "licence" });
  if (!dates.length) return null;
  dates.sort((a,b)=>a.date.localeCompare(b.date));
  const { date: expiryDate, source } = dates[0];
  const daysLeft = Math.round((utc(expiryDate) - utc(todayLocal())) / 86400000);   // whole days; 0 = renew by today
  const why = source === "licence" ? "licence expiry" : "renewal due";
  if (daysLeft < 0) return { expiryDate, daysLeft, source, status:"expired", label:"Expired", why, color:"#ef4444", bg:"rgba(239,68,68,0.15)" };
  if (daysLeft <= EXPIRY_WARNING_DAYS) return { expiryDate, daysLeft, source, status:"expiring", label:`Expires in ${daysLeft}d`, why, color:"#f59e0b", bg:"rgba(245,158,11,0.15)" };
  return { expiryDate, daysLeft, source, status:"valid", label:`Valid until ${expiryDate}`, why, color:"#10b981", bg:"rgba(16,185,129,0.12)" };
}

/** What a record shows as. `fill`/`text` are the Excel colours; `sym` the matrix symbol. */
const MACHINE_STATE = {
  competent:    { key:"competent",    label:"Competent",          color:"#10b981", bg:"rgba(16,185,129,0.12)", sym:"✓", fill:"C6EFCE", text:"006100" },
  expiring:     { key:"expiring",     label:"Expiring soon",      color:"#f59e0b", bg:"rgba(245,158,11,0.14)", sym:"!", fill:"FFEB9C", text:"9C5700" },
  expired:      { key:"expired",      label:"Renewal required",   color:"#ef4444", bg:"rgba(239,68,68,0.14)",  sym:"✗", fill:"FFC7CE", text:"9C0006" },
  provisional:  { key:"provisional",  label:"Provisional",        color:"#3b82f6", bg:"rgba(59,130,246,0.14)", sym:"◐", fill:"DDEBF7", text:"1F4E79" },
  not_assessed: { key:"not_assessed", label:"Not assessed",       color:"#64748b", bg:"rgba(100,116,139,0.14)",sym:"–", fill:"F2F2F2", text:"595959" },
};
/** The statuses an admin can choose; expiry is worked out from the dates. */
const CHOOSABLE_STATUS = ["competent", "provisional", "not_assessed"];

function machineState(comp, types) {
  if (!comp) return null;
  const ex = machineExpiryStatus(comp, types);
  let key;
  if (comp.status === "provisional") key = "provisional";
  else if (comp.status === "not_assessed") key = "not_assessed";
  else if (comp.status === "expired") key = "expired";                 // marked by hand before expiry was automatic
  else if (comp.status !== "competent") key = "not_assessed";          // missing / unknown status: never assume competent
  else key = ex && ex.status === "expired" ? "expired" : ex && ex.status === "expiring" ? "expiring" : "competent";
  // marked "expired" by hand while the dates say otherwise: no renew-by date to show
  const manual = comp.status === "expired" && !(ex && ex.status === "expired");
  return { ...MACHINE_STATE[key], ex: manual ? null : ex, manual };
}

const compsFor = (machineComps, userId) => Object.values((machineComps || {})[userId] || {}).filter(Boolean);

/** Array-shaped seed data → { userId: { recordId: record } } */
const toCompMap = m => Object.fromEntries(Object.entries(m || {}).map(([uid, v]) => [uid, Array.isArray(v) ? Object.fromEntries(v.map(c => [c.id, c])) : v]));

// Seed data — competence records for warehouse staff

// ─── Machinery Competence Tab (Staff) ─────────────────────────────────────────

export { isWarehouseWorker, hasMachineryAccess, MACHINERY_TYPES, MACHINE_CATEGORIES, COMP_STATUS, machineExpiryStatus, MACHINE_STATE, CHOOSABLE_STATUS, machineState, compsFor, toCompMap };