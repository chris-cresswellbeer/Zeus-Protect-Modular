// src/mobile/screens/Admin.jsx
//
// The admin side is deliberately narrow: deadlines, triage, and what is coming
// in from the floor. Anything that needs real authoring — module builder, RA
// builder, the full investigation workflow — stays on the desktop.

import React from "react";
import { Screen, SectionLabel, Row, StatusChip, PrimaryButton, ImagePlaceholder } from "../ui";

// ─── Overview ────────────────────────────────────────────────────────────────

function AdminOverview({ alerts, stats, inbound, onOpenHazard, onOpenAlert, Z, font }) {
  return (
    <Screen Z={Z}>
      {alerts.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg,#3d1414,#2a0e0e)",
          border: "1px solid rgba(239,68,68,0.4)", borderRadius: 18,
          padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: "#ef4444" }} />
            <span style={{
              fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4,
              color: "#f87171", textTransform: "uppercase",
            }}>
              Needs you today
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => (
              <button
                key={a.id}
                onClick={() => onOpenAlert(a)}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                  minHeight: 56, background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(239,68,68,0.3)", borderRadius: 13,
                  padding: 13, cursor: "pointer", fontFamily: font,
                }}
              >
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: Z.white }}>{a.title}</div>
                  <div style={{ fontSize: 11.5, color: "#f87171", marginTop: 1 }}>{a.detail}</div>
                </div>
                <span style={{ color: "#f87171" }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 18 }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            background: Z.overlay, border: `1px solid ${Z.borderMd}`,
            borderLeft: `3px solid ${s.color}`, borderRadius: 14, padding: 13,
          }}>
            <div style={{
              fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1,
              fontFamily: "'Barlow Condensed',sans-serif",
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: Z.white, marginTop: 3 }}>{s.label}</div>
            <div style={{ fontSize: 10.5, color: Z.muted }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <SectionLabel Z={Z}>Coming in from the floor</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {inbound.map((h) => (
          <Row
            key={h.id} Z={Z} font={font}
            tone={h.status === "new" ? "warn" : "flat"}
            icon={h.icon}
            title={h.title}
            sub={`${h.reporter} · ${h.location} · ${h.when}`}
            onClick={() => onOpenHazard(h)}
            right={<StatusChip
              label={h.status === "new" ? "New" : "Triaged"}
              color={h.status === "new" ? "#f97316" : "#94a3b8"} />}
          />
        ))}
        {inbound.length === 0 && (
          <div style={{ fontSize: 13.5, color: Z.muted, padding: "8px 0" }}>Nothing new today.</div>
        )}
      </div>
    </Screen>
  );
}

// ─── Hazard triage ───────────────────────────────────────────────────────────

function HazardTriage({ hazard, history, onResolve, onAssign, onEscalate, Z, font }) {
  const urgencyColor =
    hazard.urgency === "high" ? "#ef4444" : hazard.urgency === "medium" ? "#f97316" : "#f59e0b";
  const urgencyLabel =
    hazard.urgency === "high" ? "STOP WORK" : hazard.urgency === "medium" ? "NEEDS ATTENTION" : "SAFE TO LEAVE";

  return (
    <Screen Z={Z}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
        <StatusChip label={urgencyLabel} color={urgencyColor} />
        <StatusChip label={hazard.ref} color="#94a3b8" />
      </div>

      <h2 style={{ fontSize: 21, fontWeight: 900, margin: "0 0 4px", letterSpacing: -0.4, lineHeight: 1.25, color: Z.white }}>
        {hazard.title}
      </h2>
      <p style={{ color: Z.muted, fontSize: 12.5, margin: "0 0 16px" }}>
        Reported by {hazard.reporter} · {hazard.location} · {hazard.when}
      </p>

      <div style={{ marginBottom: 14 }}>
        {hazard.photos && hazard.photos.length > 0 ? (
          <img
            src={hazard.photos[0]} alt="Reported hazard"
            style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 16, border: `1px solid ${Z.borderMd}`, display: "block" }}
          />
        ) : (
          <ImagePlaceholder label="no photo attached" height={120} Z={Z} />
        )}
      </div>

      <div style={{
        background: Z.overlay, border: `1px solid ${Z.borderMd}`,
        borderRadius: 15, padding: 15, marginBottom: 14,
      }}>
        <SectionLabel Z={Z}>What they said</SectionLabel>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: Z.slate }}>
          &ldquo;{hazard.description}&rdquo;
        </p>
      </div>

      <SectionLabel Z={Z}>Triage</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
        <PrimaryButton tone="green" onClick={onResolve} Z={Z} font={font}
          style={{ minHeight: 54, padding: 16, fontSize: 15, borderRadius: 14 }}>
          Resolve on the spot
        </PrimaryButton>
        <button
          onClick={onAssign}
          style={{
            width: "100%", minHeight: 54, background: "rgba(37,99,235,0.15)",
            border: `1px solid ${Z.accent}66`, borderRadius: 14, padding: 16,
            color: "#93c5fd", fontWeight: 800, fontSize: 15, fontFamily: font, cursor: "pointer",
          }}
        >
          Assign a corrective action
        </button>
        <button
          onClick={onEscalate}
          style={{
            width: "100%", minHeight: 54, background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14, padding: 16,
            color: "#f87171", fontWeight: 800, fontSize: 15, fontFamily: font, cursor: "pointer",
          }}
        >
          Escalate to investigation
        </button>
      </div>

      {history.length > 0 && (
        <div style={{ background: Z.overlaySm, border: `1px solid ${Z.border}`, borderRadius: 14, padding: 14 }}>
          <SectionLabel Z={Z}>History at this location</SectionLabel>
          {history.map((h, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
              fontSize: 12.5, color: Z.slate,
            }}>
              <span style={{ color: Z.gold }}>•</span>
              <span style={{ flex: 1, minWidth: 0 }}>{h.title}</span>
              <span style={{ color: Z.muted }}>{h.when}</span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}

export { AdminOverview, HazardTriage };
