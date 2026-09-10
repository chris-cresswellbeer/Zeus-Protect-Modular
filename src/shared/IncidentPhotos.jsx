// src/shared/IncidentPhotos.jsx
//
// Renders the photos attached to an incident. The mobile app uploads them to
// the incident-photos bucket and stores the URLs on incidents.photos, so the
// desktop portal only has to show them.
//
// Drop into the incident detail view in src/domains/incidents:
//
//   import { IncidentPhotos } from "../../shared/IncidentPhotos";
//   ...
//   <IncidentPhotos photos={incident.photos} />

import React from "react";

function IncidentPhotos({ photos, title = "Photos from the reporter" }) {
  const list = Array.isArray(photos) ? photos.filter(Boolean) : [];
  if (list.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
        textTransform: "uppercase", opacity: 0.6, marginBottom: 8,
      }}>
        {title} ({list.length})
      </div>
      <div style={{
        display: "grid", gap: 10,
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
      }}>
        {list.map((src, i) => (
          <a
            key={i} href={src} target="_blank" rel="noreferrer"
            title="Open full size"
            style={{ display: "block", borderRadius: 12, overflow: "hidden" }}
          >
            <img
              src={src} alt={`Incident photo ${i + 1}`}
              loading="lazy"
              style={{
                width: "100%", height: 160, objectFit: "cover",
                display: "block", background: "rgba(127,127,127,0.12)",
              }}
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export { IncidentPhotos };
