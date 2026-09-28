/**
 * data/seedFirstAid.js — first aid shifts, site zones, certificate and kit types.
 * REFERENCE DATA — used by the live app on every load. Editing it changes the app for
 * everyone on the next deploy (it is code, not database data).
 * Aiders/certs store the exact shift and zone STRINGS — renaming one here disconnects
 * existing records from it. Admins can add extra zones in the app (customZones).
 */
const FA_SHIFTS = ["Day Shift (08:30–16:00)", "Late Shift (16:00–02:00)", "Office Hours (08:30–17:30)", "All Shifts"];
const FA_ZONES  = [
  // Warehouse / Operations
  "Warehouse Floor",
  "Loading Dock",
  "Yard / External",
  // Ground Floor — Office Block
  "Ground Floor — Transport Office",
  "Ground Floor — Zeus Food Office",
  "Ground Floor — Accounts",
  // 1st Floor — Office Block
  "1st Floor — Industrial & Transit Office",
  "1st Floor — HR & Marketing",
  // Welfare
  "Canteen & Welfare Areas",
];
const FA_CERT_TYPES = ["First Aid at Work (FAW)", "Emergency First Aid at Work (EFAW)", "Paediatric First Aid", "Other"];
const FA_KIT_TYPES  = ["Standard BSI Kit", "Travel Kit", "Eye Wash Station", "Burns Kit", "AED (Defibrillator)"];

export { FA_SHIFTS, FA_ZONES, FA_CERT_TYPES, FA_KIT_TYPES };
