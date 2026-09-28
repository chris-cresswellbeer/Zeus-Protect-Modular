/**
 * Rough hazard banding for a COSHH substance from its CLP classification text
 * (as copied from section 2 of the SDS), used for the red/amber/green badge.
 *
 *   high   – Skin Corr. 1A, Flam. Liq. 2 (H225), any Acute Tox
 *   medium – Skin Corr. 1B, Flam. Liq. 3 (H226), Eye Dam. 1 / serious eye damage
 *   low    – everything else, or "Not classified"
 *
 * This is a simple keyword match (case-insensitive) for display only — it is NOT
 * a substitute for the COSHH assessment itself. Add keywords here if a substance
 * is being banded wrongly (e.g. carcinogens "Carc. 1B"/H350 currently fall to "low").
 */
function coshhHazardLevel(classification) {
  if (!classification || classification === "Not classified (CLP)" || classification === "") return "low";
  const c = classification.toUpperCase();
  if (c.includes("CORR. 1A") || c.includes("CORR. 1;") || c.includes("CORROSION, CATEGORY 1A") || c.includes("FLAM. LIQ. 2") || c.includes("H225") || c.includes("ACUTE TOX")) return "high";
  if (c.includes("CORR. 1B") || c.includes("FLAM. LIQ. 3") || c.includes("H226") || c.includes("DAM. 1") || c.includes("SERIOUS EYE DAMAGE")) return "medium";
  return "low";
}


export { coshhHazardLevel };
