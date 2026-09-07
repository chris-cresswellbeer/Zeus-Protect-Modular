// src/mobile/screens/Documents.jsx
//
// Required reading first, everything else after. Acknowledging writes the same
// { date } record the desktop tab writes, via the queue so it works offline.

import React from "react";
import { Screen, SectionLabel, PrimaryButton } from "../ui";

const EXT_ICONS = {
  PDF: "📕", DOCX: "📘", DOC: "📘", XLSX: "📗", XLS: "📗",
  PPTX: "📙", PPT: "📙", PNG: "🖼️", JPG: "🖼️", JPEG: "🖼️", TXT: "📄", CSV: "📊",
};

function Documents({ docs, required, acknowledgements, onAcknowledge, onPreview, Z, font }) {
  const unread = required.filter((d) => !acknowledgements[d.id]);
  const others = docs.filter((d) => !required.find((r) => r.id === d.id));

  return (
    <Screen Z={Z}>
      {required.length > 0 && (
        <>
          <SectionLabel Z={Z} color={unread.length ? Z.gold : Z.green}>
            Required reading{unread.length ? ` · ${unread.length} unread` : " · all read ✓"}
          </SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 22 }}>
            {required.map((d) => {
              const ack = acknowledgements[d.id];
              const ext = (d.fileName ? d.fileName.split(".").pop() : d.ext || "").toUpperCase();
              return (
                <div key={d.id} style={{
                  background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`,
                  border: `2px solid ${ack ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.4)"}`,
                  borderRadius: 16, padding: 15,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 13 }}>
                    <span style={{ fontSize: 26, flexShrink: 0 }}>{EXT_ICONS[ext] || "📄"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: Z.white }}>{d.title}</div>
                      <div style={{ fontSize: 11.5, color: Z.muted, marginTop: 2 }}>
                        Updated {d.date} · {d.size}{ext ? ` · ${ext}` : ""}
                      </div>
                      {ack && (
                        <div style={{ fontSize: 11.5, color: Z.green, marginTop: 3, fontWeight: 600 }}>
                          ✓ You confirmed reading this on {ack.date}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <button
                      onClick={() => onPreview(d)}
                      style={{
                        flex: 1, minHeight: 48, background: Z.overlay, border: `1px solid ${Z.borderMd}`,
                        borderRadius: 12, padding: 13, color: Z.slate, fontWeight: 700,
                        fontSize: 13, fontFamily: font, cursor: "pointer",
                      }}
                    >
                      Read
                    </button>
                    {!ack && (
                      <PrimaryButton
                        tone="green" onClick={() => onAcknowledge(d)} Z={Z} font={font}
                        style={{ flex: 1.5, minHeight: 48, padding: 13, fontSize: 13, borderRadius: 12 }}
                      >
                        ✓ I&rsquo;ve read this
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {others.length > 0 && (
        <>
          <SectionLabel Z={Z}>Everything else</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {others.map((d) => {
              const ext = (d.fileName ? d.fileName.split(".").pop() : d.ext || "").toUpperCase();
              return (
                <button
                  key={d.id}
                  onClick={() => onPreview(d)}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                    minHeight: 56, background: Z.overlay, border: `1px solid ${Z.borderMd}`,
                    borderRadius: 14, padding: 13, cursor: "pointer", fontFamily: font,
                  }}
                >
                  <span style={{ fontSize: 23 }}>{EXT_ICONS[ext] || "📄"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: Z.white }}>{d.title}</div>
                    <div style={{ fontSize: 11, color: Z.muted, marginTop: 1 }}>{d.date} · {d.size}</div>
                  </div>
                  <span style={{ color: Z.mutedDk }}>›</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {docs.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: Z.muted, fontSize: 14 }}>
          No documents yet. Check back soon.
        </div>
      )}
    </Screen>
  );
}

export { Documents };
