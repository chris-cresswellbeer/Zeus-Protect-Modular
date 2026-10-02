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
// Entries may be URL strings (photos) or objects {name, type, url|data} — files
// attached on the desktop form. Photos show as thumbnails; other files as links.
function IncidentPhotos({ photos, Z = {}, title = "Photos" }) {
  const all = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const srcOf = p => (typeof p === "string" ? p : (p.url || p.data || ""));
  const isImg = p => typeof p === "string" || String(p.type || "").startsWith("image/") || /^data:image\//.test(String(p.data || ""));
  const list = all.filter(isImg).map(srcOf).filter(Boolean);
  const files = all.filter(p => !isImg(p) && srcOf(p));
  const [lightbox, setLightbox] = React.useState(null);
  if (list.length === 0 && files.length === 0) return null;

  const muted = Z.muted || "#94a3b8";
  const border = Z.border || "rgba(148,163,184,0.2)";

  return (
    <>
      {list.length > 0 && <div style={{ marginBottom: 16 }}>
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
      </div>}

      {files.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {files.map((f, i) => (
            <a key={i} href={srcOf(f)} target="_blank" rel="noreferrer" download={f.name || true}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 12, fontWeight: 700, color: Z.accentLt || "#60a5fa", border: `1px solid ${Z.border || "rgba(148,163,184,0.2)"}`, borderRadius: 8, padding: "6px 10px", textDecoration: "none" }}>
              📄 {f.name || `File ${i + 1}`}
            </a>
          ))}
        </div>
      )}

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
