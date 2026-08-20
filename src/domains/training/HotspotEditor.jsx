import React from "react";

/**
 * HotspotEditor — admin authoring UI for placing click-to-find hotspots on a
 * slide image. Click empty space on the image to add a marker; click an
 * existing marker to remove it. Each marker is editable below (label,
 * feedback, correct/decoy toggle).
 *
 * Hotspot shape: { id, x, y, radius, correct, label, feedback }
 * x/y/radius are percentages of the image's rendered size.
 */
function HotspotEditor({ imageUrl, hotspots, onChange, Z, font }) {
  const list = hotspots || [];

  function addAt(xPct, yPct) {
    const newHotspot = {
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      x: Math.round(xPct * 10) / 10,
      y: Math.round(yPct * 10) / 10,
      radius: 5,
      correct: true,
      label: "",
      feedback: "",
    };
    onChange([...list, newHotspot]);
  }

  function removeAt(id) { onChange(list.filter(h => h.id !== id)); }
  function update(id, k, v) { onChange(list.map(h => h.id === id ? { ...h, [k]: v } : h)); }

  function handleImageClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    // If the click landed on an existing marker, remove it instead of adding a new one.
    const hit = list.find(h => Math.sqrt((h.x - xPct) ** 2 + (h.y - yPct) ** 2) <= (h.radius || 5));
    if (hit) { removeAt(hit.id); return; }
    addAt(xPct, yPct);
  }

  const inp = { width: "100%", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "7px 10px", color: Z.white, fontSize: 12, outline: "none", fontFamily: font, boxSizing: "border-box" };

  return (
    <div>
      <div style={{ fontSize: 11, color: Z.muted, marginBottom: 8, lineHeight: 1.5 }}>
        Click the image to drop a marker. Click a marker again to remove it. Mark each one as a hazard or a decoy below.
      </div>
      <div
        onClick={handleImageClick}
        style={{ position: "relative", width: "100%", borderRadius: 10, overflow: "hidden", border: `1px solid ${Z.borderMd}`, cursor: "crosshair", userSelect: "none" }}
      >
        <img src={imageUrl} alt="" draggable={false} style={{ width: "100%", display: "block", pointerEvents: "none" }} />
        {list.map((h, i) => (
          <div key={h.id}
            style={{
              position: "absolute", left: `${h.x}%`, top: `${h.y}%`,
              width: `${(h.radius || 5) * 2}%`, height: `${(h.radius || 5) * 2}%`,
              transform: "translate(-50%,-50%)", borderRadius: "50%",
              background: h.correct ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)",
              border: `2px solid ${h.correct ? Z.green : Z.gold}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none", fontSize: 11, fontWeight: 800, color: Z.white,
            }}>
            {i + 1}
          </div>
        ))}
      </div>

      {list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {list.map((h, i) => (
            <div key={h.id} style={{ background: Z.overlaySm, borderRadius: 10, padding: "10px 12px", border: `1px solid ${Z.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: h.correct ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)",
                  border: `1px solid ${h.correct ? Z.green : Z.gold}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800, color: h.correct ? Z.green : Z.gold,
                }}>{i + 1}</span>
                <button onClick={() => update(h.id, "correct", true)} style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: font,
                  background: h.correct ? Z.green : Z.overlay, color: h.correct ? "#fff" : Z.muted,
                  border: `1px solid ${h.correct ? Z.green : Z.borderMd}`,
                }}>Hazard</button>
                <button onClick={() => update(h.id, "correct", false)} style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: font,
                  background: !h.correct ? Z.gold : Z.overlay, color: !h.correct ? "#fff" : Z.muted,
                  border: `1px solid ${!h.correct ? Z.gold : Z.borderMd}`,
                }}>Decoy</button>
                <button onClick={() => removeAt(h.id)} style={{
                  marginLeft: "auto", background: "rgba(239,68,68,0.1)", color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "4px 10px",
                  cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: font,
                }}>Remove</button>
              </div>
              <input value={h.label} onChange={e => update(h.id, "label", e.target.value)}
                placeholder="Short label, e.g. Overloaded socket" style={{ ...inp, marginBottom: 6 }} />
              <input value={h.feedback} onChange={e => update(h.id, "feedback", e.target.value)}
                placeholder="Feedback shown when clicked, e.g. why this is/isn't a hazard" style={inp} />
            </div>
          ))}
        </div>
      )}

      {list.some(h => h.correct) === false && list.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: Z.gold }}>⚠ At least one marker must be set as a hazard.</div>
      )}
    </div>
  );
}

export { HotspotEditor };