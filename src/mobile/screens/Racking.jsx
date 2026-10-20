// src/mobile/screens/Racking.jsx
//
// Racking on the phone. Normally you get here by scanning the QR label on a bay, which opens
// that bay straight away (RackBay, shared/RackBay.jsx). "More → Racking damage" lets you
// find a bay by hand if its label is missing or damaged: choose the aisle, then the bay
// (coloured by the worst open damage on it).

import React from "react";
import { Screen, SectionLabel, Card } from "../ui";
import { t } from "../../lib/i18n";
import { worstByBay } from "../../lib/racking";

const COL = { red: "#ef4444", amber: "#f59e0b", green: "#10b981" };

function RackPick({ locations, damage, onPick, Z, font }) {
  const aisles = [...new Set(locations.map(l => l.aisle))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const [aisle, setAisle] = React.useState(aisles[0] || "");
  const worst = worstByBay(damage);
  if (!locations.length) return <Screen Z={Z}><Card Z={Z}><div style={{ color: Z.white, fontSize: 14, lineHeight: 1.5 }}>{t("No racking bays have been set up yet. Ask the H&S team.")}</div></Card></Screen>;
  const bays = locations.filter(l => l.aisle === aisle).sort((a, b) => a.bay - b.bay);
  return (
    <Screen Z={Z}>
      <div style={{ fontSize: 14, color: Z.muted, lineHeight: 1.5, marginBottom: 14 }}>{t("Quickest way: scan the QR label on the bay with your phone's camera. If the label's missing, choose the bay here.")}</div>
      <SectionLabel Z={Z}>{t("Aisle")}</SectionLabel>
      <div role="group" aria-label={t("Aisle")} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {aisles.map(a => <button key={a} type="button" aria-pressed={a === aisle} onClick={() => setAisle(a)} data-testid={`m-rack-aisle-${a}`}
          style={{ minWidth: 56, minHeight: 48, borderRadius: 12, fontFamily: font, fontSize: 17, fontWeight: 800, color: Z.white, background: a === aisle ? `${Z.accent}44` : Z.overlay, border: `2px solid ${a === aisle ? Z.accent : Z.borderMd}` }}>{a}</button>)}
      </div>
      <SectionLabel Z={Z}>{t("Bay")}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
        {bays.map(l => { const w = worst[l.id]; return (
          <button key={l.id} type="button" onClick={() => onPick(l.id)} data-testid="m-rack-bay" aria-label={`${t("Bay")} ${l.bay}${w ? `, ${w}` : ""}`}
            style={{ minHeight: 52, borderRadius: 12, fontFamily: font, fontSize: 17, fontWeight: 800, color: w ? "#0b1020" : Z.white, background: w ? COL[w] : Z.overlay, border: `2px solid ${w ? "transparent" : Z.borderMd}` }}>{String(l.bay).padStart(2, "0")}</button>
        ); })}
      </div>
      <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 14 }}>{t("Coloured bays already have damage reported: red, amber or green.")}</div>
    </Screen>
  );
}

export { RackPick };
