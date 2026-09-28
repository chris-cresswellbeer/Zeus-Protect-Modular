// src/shared/IncidentPhotos.jsx
//
// Photos attached to an incident. The mobile app uploads them to the
// incident-photos bucket and stores the URLs on incidents.photos, so the
// portal only has to render them.
//
// Used in the expanded detail panel of AdminIncidentTab and IncidentTracker:
//
//   <IncidentPhotos photos={inc.photos} Z={Z}/>
//
// Renders nothing when there are no photos, so it is safe to drop into any
// incident view unconditionally.

import React from "react";

// Props:
//   photos – array of image URLs (falsy entries are ignored)
//   Z      – active theme tokens (optional; sensible fallbacks used)
//   title  – heading text above the thumbnails
// NOTE: useState is called BEFORE the early `return null` on purpose — hooks
// must run on every render in the same order (Rules of Hooks).
function IncidentPhotos({ photos, Z = {}, title = "Photos" }) {
  const list = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const [lightbox, setLightbox] = React.useState(null);
  if (list.length === 0) return null;

  const muted = Z.muted || "#94a3b8";
  const border = Z.border || "rgba(148,163,184,0.2)";

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: muted,
          marginBottom: 6, textTransform: "uppercase",
        }}>
          {title} ({list.length})
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {list.map((src, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setLightbox(src); }}
              title="View full size"
              style={{
                padding: 0, border: `1px solid ${border}`, borderRadius: 10,
                overflow: "hidden", cursor: "zoom-in", background: "transparent",
                lineHeight: 0,
              }}
            >
              <img
                src={src} alt={`Incident photo ${i + 1}`} loading="lazy"
                style={{ width: 104, height: 104, objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Full-screen lightbox. Click anywhere to close. zIndex 9999 keeps it above modals. */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999, background: "rgba(2,6,23,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 28,
            cursor: "zoom-out",
          }}
        >
          <img
            src={lightbox} alt="Incident photo"
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12, display: "block" }}
          />
        </div>
      )}
    </>
  );
}

export { IncidentPhotos };
