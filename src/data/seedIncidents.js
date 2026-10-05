/**
 * data/seedIncidents.js — incident classification lists + demo incidents.
 * INCIDENT_TYPES, ACCIDENT_CODES, NUMBER_CODES, INJURY_TYPES are REFERENCE DATA used by
 *   the incident forms, filters, charts and exports; incidents store the id/code values.
 * (The demo incidents moved to demo/seedIncidents.js — test scripts only.)
 * (e.g. a brand-new install). Once real rows exist, edits here have NO effect.
 */
const INCIDENT_TYPES = [
  { id:"accident",         label:"Accident",          color:"#ef4444", bg:"rgba(239,68,68,0.12)",  icon:"🚨" },
  { id:"near_miss",        label:"Near Miss",          color:"#f59e0b", bg:"rgba(245,158,11,0.12)", icon:"⚠️" },
  { id:"unsafe_condition", label:"Unsafe Condition",   color:"#8b5cf6", bg:"rgba(139,92,246,0.12)", icon:"🔶" },
  { id:"unsafe_act",       label:"Unsafe Act",         color:"#3b82f6", bg:"rgba(59,130,246,0.12)", icon:"🔷" },
];

const ACCIDENT_CODES = [
  { code:"A", desc:"Procedure not followed" },
  { code:"B", desc:"Damage" },
  { code:"C", desc:"Improvement" },
  { code:"D", desc:"Load being moved by workplace transport" },
  { code:"E", desc:"PPE" },
  { code:"F", desc:"Slipping, tripping, falling" },
  { code:"G", desc:"Legal requirement" },
  { code:"H", desc:"Injury" },
  { code:"I", desc:"Manual movement of goods" },
  { code:"J", desc:"Operator awareness" },
  { code:"K", desc:"Workplace transport collision" },
  { code:"L", desc:"Repair required" },
];

const NUMBER_CODES = [
  { num:1,  desc:"Near Miss" },
  { num:2,  desc:"Injury to worker" },
  { num:3,  desc:"Handling, lifting or carrying" },
  { num:4,  desc:"Contact with moving machinery" },
  { num:5,  desc:"Stuck against something fixed or stationary" },
  { num:6,  desc:"Struck by moving object" },
  { num:7,  desc:"Damage to machinery" },
  { num:8,  desc:"Damage to products" },
  { num:9,  desc:"Damage to building / infrastructure" },
  { num:10, desc:"Injured performing task" },
  { num:11, desc:"Damage to workplace transport" },
  { num:12, desc:"Unsafe Act or Condition" },
];

const INJURY_TYPES = [
  "None / No injury",
  "Cut / Laceration",
  "Bruise / Contusion",
  "Sprain / Strain",
  "Fracture",
  "Burn / Scald",
  "Eye injury",
  "Head injury",
  "Back / Spine injury",
  "Crush injury",
  "Chemical exposure",
  "Electric shock",
  "Respiratory / Inhalation",
  "Hearing damage",
  "Multiple injuries",
  "Fatality",
];

// Seed incident data — 3 years (2024, 2025, 2026) for year-selectable chart

// ─── DSE Assessment Component ─────────────────────────────────────────────────

export { INCIDENT_TYPES, ACCIDENT_CODES, NUMBER_CODES, INJURY_TYPES };
