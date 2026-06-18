function coshhHazardLevel(classification) {
  if (!classification || classification === "Not classified (CLP)" || classification === "") return "low";
  const c = classification.toUpperCase();
  if (c.includes("CORR. 1A") || c.includes("CORR. 1;") || c.includes("CORROSION, CATEGORY 1A") || c.includes("FLAM. LIQ. 2") || c.includes("H225") || c.includes("ACUTE TOX")) return "high";
  if (c.includes("CORR. 1B") || c.includes("FLAM. LIQ. 3") || c.includes("H226") || c.includes("DAM. 1") || c.includes("SERIOUS EYE DAMAGE")) return "medium";
  return "low";
}


export { coshhHazardLevel };
