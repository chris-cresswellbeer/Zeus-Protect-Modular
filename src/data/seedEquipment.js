/**
 * data/seedEquipment.js — equipment categories + demo asset register.
 * EQ_CATEGORIES is REFERENCE DATA (category id, label, icon, colour, and
 *   scheduleMonths = normal inspection/service interval). Assets store the category id.
 * (The demo equipment moved to demo/seedEquipment.js — test scripts only.)
 * (e.g. a brand-new install). Once real rows exist, edits here have NO effect.
 */
const EQ_CATEGORIES = [
  { id:"flt",       label:"Forklift Trucks",     icon:"🚜", color:"#f59e0b", scheduleMonths:3  },
  { id:"racking",   label:"Racking Inspection",  icon:"🏗",  color:"#8b5cf6", scheduleMonths:12 },
  { id:"pallet",    label:"Pallet Trucks",        icon:"🔧", color:"#3b82f6", scheduleMonths:6  },
  { id:"wrapping",  label:"Wrapping Machines",   icon:"🌀", color:"#10b981", scheduleMonths:12 },
  { id:"fire",      label:"Fire Equipment",       icon:"🔥", color:"#ef4444", scheduleMonths:12 },
  { id:"charging",  label:"Charging Stations",   icon:"⚡", color:"#a78bfa", scheduleMonths:6  },
];

export { EQ_CATEGORIES };
