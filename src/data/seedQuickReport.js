/**
 * data/seedQuickReport.js — location list for the quick hazard report (desktop + mobile).
 * REFERENCE DATA — used by the live app on every load. Editing it changes the app for
 * everyone on the next deploy (it is code, not database data).  Keep "Other" last (it reveals a free-text box).
 */
const QUICK_LOCATIONS = [
  "Warehouse","Loading Bay","Production Floor","Goods-In","Dispatch Bay",
  "Staff Canteen","Car Park","Offices","Racking Aisle","Machinery Area",
  "Fire Exit","Toilets","Reception","Electrical Room","Other"
];

export { QUICK_LOCATIONS };
