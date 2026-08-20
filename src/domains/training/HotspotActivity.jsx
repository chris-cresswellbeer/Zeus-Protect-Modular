import React, { useState, useEffect } from "react";

/**
 * HotspotActivity — staff-facing runtime for click-to-find training slides
 * (e.g. "click every source of ignition in this office").
 *
 * Hotspot shape (stored on slide.hotspots):
 *   { id, x, y, radius, correct, label, feedback }
 *   x/y/radius are PERCENTAGES (0-100) of the image's rendered width/height,
 *   so they stay accurate at any screen size with no resize listeners.
 *
 * onStatusChange(isComplete) fires whenever completion status changes, so the
 * parent (module player) can gate the "Next Slide" button on it.
 */
function HotspotActivity({ imageUrl, instructions, hotspots, passThreshold = 1, onStatusChange, Z, font }) {
  const [foundIds, setFoundIds] = useState(() => new Set());
  const [lastClick, setLastClick] = useState(null); // { hotspot, wasCorrect } | null
  const [wrongCount, setWrongCount] = useState(0);

  const correctTotal = hotspots.filter(h => h.correct).length;
  const correctFound = [...foundIds].filter(id => hotspots.some(h => h.id === id && h.correct)).length;
  const complete = correctTotal > 0 && correctFound >= Math.ceil(correctTotal * passThreshold);

  useEffect(() => { if (onStatusChange) onStatusChange(complete); }, [complete]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClick(e) {
    if (complete) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const clickYPct = ((e.clientY - rect.top) / rect.height) * 100;

    let best = null, bestDist = Infinity;
    for (const h of hotspots) {
      const dx = h.x - clickXPct, dy = h.y - clickYPct;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= (h.radius || 5) && dist < bestDist) { best = h; bestDist = dist; }
    }
    if (!best) { setLastClick(null); return; }
    if (best.correct) setFoundIds(prev => new Set(prev).add(best.id));
    else setWrongCount(c => c + 1);
    setLastClick({ hotspot: best, wasCorrect: best.correct });
  }

  function reset() {
    setFoundIds(new Set());
    setLastClick(null);
    setWrongCount(0);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: Z.slate, fontWeight: 600 }}>🎯 {instructions}</div>
        <div style={{ fontSize: 12, color: Z.muted, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
          {correctFound} / {correctTotal} found
        </div>
      </div>

      <div
        onClick={handleClick}
        style={{
          position: "relative", width: "100%", borderRadius: 12,
          overflow: "hidden", border: `1px solid ${Z.borderMd}`,
          cursor: complete ? "default" : "crosshair", userSelect: "none",
        }}
      >
        <img src={imageUrl} alt="" draggable={false} style={{ width: "100%", display: "block", pointerEvents: "none" }} />
        {hotspots.map(h => {
          if (!foundIds.has(h.id)) return null;
          return (
            <div key={h.id}
              style={{
                position: "absolute", left: `${h.x}%`, top: `${h.y}%`,
                width: `${(h.radius || 5) * 2}%`, height: `${(h.radius || 5) * 2}%`,
                transform: "translate(-50%,-50%)", borderRadius: "50%",
                background: "rgba(16,185,129,0.25)", border: `2px solid ${Z.green}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
              <span style={{ fontSize: 14 }}>✓</span>
            </div>
          );
        })}
      </div>

      {lastClick && (
        <div style={{
          marginTop: 10, fontSize: 13, borderRadius: 10, padding: "10px 14px",
          background: lastClick.wasCorrect ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${lastClick.wasCorrect ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: lastClick.wasCorrect ? Z.green : "#f87171",
        }}>
          <strong>{lastClick.hotspot.label}.</strong> {lastClick.hotspot.feedback}
        </div>
      )}

      {complete ? (
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: Z.green }}>
          ✓ All hazards found — you can move on to the next slide.
        </div>
      ) : (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: Z.muted }}>Incorrect clicks: {wrongCount}</span>
          <button onClick={reset} style={{
            background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8,
            padding: "5px 12px", color: Z.muted, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: font,
          }}>Start Over</button>
        </div>
      )}
    </div>
  );
}

export { HotspotActivity };