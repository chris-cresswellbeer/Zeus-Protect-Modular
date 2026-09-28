/**
 * data/seedContractors.js — contractor site-induction checklist and certificate types.
 * REFERENCE DATA — used by the live app on every load. Editing it changes the app for
 * everyone on the next deploy (it is code, not database data).
 * ⚠ Induction progress and certificates are stored against these `id` values —
 *   renaming or removing an id orphans existing records. Add new items with new ids.
 */
const INDUCTION_ITEMS = [
  {id:"site_rules", label:"Site rules & access procedures"},
  {id:"emergency",  label:"Emergency procedures & muster points"},
  {id:"ppe",        label:"PPE requirements for work area"},
  {id:"hazards",    label:"Specific hazards & COSHH substances"},
  {id:"first_aid",  label:"First aid locations & contacts"},
  {id:"reporting",  label:"Incident & near miss reporting"},
  {id:"welfare",    label:"Welfare facilities & site etiquette"},
  {id:"permits",    label:"Permit to work procedures (if applicable)"},
];
const CONTRACTOR_CERT_TYPES = [
  {id:"cscs",  label:"CSCS Card",      icon:"🪪"},
  {id:"ipaf",  label:"IPAF",           icon:"🏗"},
  {id:"pasma", label:"PASMA",          icon:"🪜"},
  {id:"gas",   label:"Gas Safe",       icon:"🔥"},
  {id:"elect", label:"NICEIC/NAPIT",   icon:"⚡"},
  {id:"asb",   label:"Asbestos Aware", icon:"⚠️"},
  {id:"other", label:"Other",          icon:"📋"},
];


export { INDUCTION_ITEMS, CONTRACTOR_CERT_TYPES };
