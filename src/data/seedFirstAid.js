/**
 * data/seedFirstAid.js — first aid shifts, site zones, certificate and kit types.
 * REFERENCE DATA — used by the live app on every load. Editing it changes the app for
 * everyone on the next deploy (it is code, not database data).
 * Aiders/certs store the exact shift and zone STRINGS — renaming one here disconnects
 * existing records from it. Admins can add extra zones in the app (customZones).
 */

const FA_CERT_TYPES = ["First Aid at Work (FAW)", "Emergency First Aid at Work (EFAW)", "Paediatric First Aid", "Other"];
const FA_KIT_TYPES  = ["Standard BSI Kit", "Travel Kit", "Eye Wash Station", "Burns Kit", "AED (Defibrillator)"];

export { FA_CERT_TYPES, FA_KIT_TYPES };
