import React, { useState } from "react";

/**
 * MachineryEquipmentPage — the "Machinery & Equipment" page in the staff portal, for
 * people an admin has given Machinery & Equipment access in Edit Staff (e.g. warehouse
 * managers). Two tabs over the SAME pages admins use: Machinery Competence
 * (AdminMachineryTab) and Equipment Register (EquipmentTrackerTab), passed in ready-made
 * by App.jsx. No other admin pages are reachable from here.
 */
export function MachineryEquipmentPage({ machinery, equipment, initial = "machinery", Z, font }) {
  const [tab, setTab] = useState(initial === "equipment" ? "equipment" : "machinery");
  const pill = on => ({
    background: on ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay,
    color: on ? "#fff" : Z.muted, border: `1px solid ${on ? Z.accent : Z.borderMd}`,
    borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font,
  });
  return (
    <div data-testid="mequip-page">
      <div role="tablist" aria-label="Machinery and Equipment" style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button role="tab" aria-selected={tab === "machinery"} onClick={() => setTab("machinery")} style={pill(tab === "machinery")}>🏗 Machinery Competence</button>
        <button role="tab" aria-selected={tab === "equipment"} onClick={() => setTab("equipment")} style={pill(tab === "equipment")}>📦 Equipment Register</button>
      </div>
      {tab === "machinery" ? machinery : equipment}
    </div>
  );
}
