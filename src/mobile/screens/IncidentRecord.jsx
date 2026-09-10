// src/mobile/screens/IncidentRecord.jsx
//
// The full incident record for an H&S manager away from their desk: the RIDDOR
// clock, the facts of the injury, what happened, and where the investigation
// has got to. Read-mostly by design — the only writes are the ones that are
// genuinely time-critical in the field (mark RIDDOR reported, chase an action).
// Editing the record and running the 5-why stay on the desktop.
//
// `incident` is the view model built in MobileApp from the App.jsx incident
// record; `investigation` is the matching entry from the investigations map.

import React from "react";
import { Screen, SectionLabel, Card, Row, StatusChip, PrimaryButton, GhostButton } from "../ui";

const TYPE_LABEL = {
  accident: "Accident",
  near_miss: "Near miss",
  unsafe_act: "Unsafe act",
  unsafe_condition: "Unsafe condition",
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function IncidentRecord({
  incident, investigation, onReportRiddor, onChaseAction, onOpenAction, onOpenDesktop, Z, font,
}) {
  const riddorDue = incident.riddorDueDate;
  const days = daysUntil(riddorDue);
  const riddorOpen = incident.riddor && !incident.riddorReported;
  const actions = (investigation && investigation.actions) || [];
  const openActions = actions.filter((a) => a.status !== "complete" && a.status !== "closed");
  const overdue = openActions.filter((a) => a.overdue);

  return (
    <Screen Z={Z}>
      {riddorOpen && (
        <div style={{
          background: "linear-gradient(135deg,#3d1414,#2a0e0e)",
          border: "1.5px solid rgba(239,68,68,0.45)",
          borderRadius: 18, padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>🚨</span>
            <span style={{
              fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4,
              color: "#f87171", textTransform: "uppercase",
            }}>
              RIDDOR reportable
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: Z.white, lineHeight: 1.3 }}>
            {days == null
              ? "Report to HSE"
              : days < 0
                ? `Deadline passed ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
                : `Report to HSE within ${days} day${days === 1 ? "" : "s"}`}
          </div>
          {incident.riddorReason && (
            <p style={{ fontSize: 12.5, color: "#fca5a5", lineHeight: 1.5, margin: "6px 0 12px" }}>
              {incident.riddorReason}{riddorDue ? ` Deadline ${riddorDue}.` : ""}
            </p>
          )}
          <PrimaryButton Z={Z} font={font} tone="danger" onClick={onReportRiddor} style={{ minHeight: 52, padding: 15, fontSize: 14.5 }}>
            Start F2508 submission
          </PrimaryButton>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
        <StatusChip label={(TYPE_LABEL[incident.type] || "Incident").toUpperCase()} color={incident.closed ? "#94a3b8" : "#ef4444"} />
        <StatusChip label={incident.ref} color="#94a3b8" />
        <StatusChip
          label={incident.closed ? "CLOSED" : investigation ? "INVESTIGATING" : "OPEN"}
          color={incident.closed ? "#10b981" : investigation ? "#f59e0b" : "#3b82f6"}
        />
      </div>

      <h2 style={{
        fontSize: 21, fontWeight: 900, margin: "0 0 4px",
        letterSpacing: -0.4, lineHeight: 1.25, color: Z.white,
      }}>
        {incident.title}
      </h2>
      <p style={{ color: Z.muted, fontSize: 12.5, margin: "0 0 16px" }}>
        {incident.person ? `${incident.person} · ` : ""}{incident.date}
        {incident.time ? `, ${incident.time}` : ""}
        {incident.reporter ? ` · reported by ${incident.reporter}` : ""}
      </p>

      {incident.photos && incident.photos.length > 0 ? (
        <div style={{
          display: "grid", gap: 8, marginBottom: 14,
          gridTemplateColumns: incident.photos.length > 1 ? "1fr 1fr" : "1fr",
        }}>
          {incident.photos.map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noreferrer" style={{ display: "block" }}>
              <img
                src={src} alt={`Photo ${i + 1} from reporter`}
                style={{
                  width: "100%", height: incident.photos.length > 1 ? 132 : 186,
                  objectFit: "cover", borderRadius: 14,
                  border: `1px solid ${Z.borderMd}`, display: "block",
                }}
              />
            </a>
          ))}
        </div>
      ) : null}

      <Card Z={Z} tone="flat" style={{ marginBottom: 14 }}>
        <Fact label="Injury" value={incident.injuryType || "None / No injury"} Z={Z} />
        <Fact label="Location" value={incident.location} Z={Z} />
        {incident.accidentCode && <Fact label="Accident code" value={incident.accidentCode} Z={Z} />}
        {incident.daysLost != null && (
          <Fact label="Days lost" value={String(incident.daysLost)} valueColor="#f87171" Z={Z} />
        )}
        {incident.riskScore != null && (
          <Fact label="Risk score" value={`${incident.riskScore} · ${incident.riskBand}`} valueColor={Z.gold} Z={Z} />
        )}
        <Fact label="RIDDOR" value={incident.riddor ? (incident.riddorReported ? "Reported" : "Outstanding") : "Not reportable"}
          valueColor={riddorOpen ? "#f87171" : Z.white} Z={Z} last />
      </Card>

      <Card Z={Z} tone="flat" style={{ marginBottom: 14 }}>
        <SectionLabel Z={Z}>What happened</SectionLabel>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: Z.slate }}>
          {incident.description}
        </p>
      </Card>

      {investigation && (
        <>
          <SectionLabel Z={Z}>
            Investigation{investigation.rootCause ? " · root cause agreed" : " · in progress"}
          </SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {investigation.rootCause && (
              <Row
                Z={Z} font={font} icon="✓"
                title="Root cause agreed"
                sub={investigation.rootCause}
              />
            )}
            {actions.map((a) => (
              <Row
                key={a.id}
                Z={Z} font={font}
                tone={a.overdue ? "danger" : a.status === "complete" || a.status === "closed" ? "flat" : "warn"}
                icon={a.status === "complete" || a.status === "closed" ? "✓" : a.overdue ? "⚠" : "⏱"}
                title={a.title}
                sub={
                  a.status === "complete" || a.status === "closed"
                    ? `${a.owner} · complete`
                    : a.overdue
                      ? `${a.owner} · ${a.overdueDays} day${a.overdueDays === 1 ? "" : "s"} overdue`
                      : `${a.owner} · due ${a.dueDate}`
                }
                right={<span style={{ color: Z.mutedDk }}>›</span>}
                onClick={onOpenAction ? () => onOpenAction(a) : undefined}
              />
            ))}
            {actions.length === 0 && (
              <Card Z={Z} tone="flat">
                <div style={{ fontSize: 13, color: Z.muted }}>
                  No corrective actions raised yet — add them on the portal.
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {overdue.length > 0 && (
          <button
            onClick={() => onChaseAction(overdue[0])}
            style={{
              width: "100%", minHeight: 54, borderRadius: 14, padding: 16,
              background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.4)",
              color: "#93c5fd", fontWeight: 800, fontSize: 15, fontFamily: font, cursor: "pointer",
            }}
          >
            Chase the overdue action
          </button>
        )}
        {onOpenDesktop && (
          <GhostButton Z={Z} font={font} onClick={onOpenDesktop} style={{ width: "100%" }}>
            Open full record on the portal
          </GhostButton>
        )}
      </div>
    </Screen>
  );
}

function Fact({ label, value, valueColor, Z, last }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0",
      fontSize: 13, borderBottom: last ? "none" : `1px solid ${Z.border}`,
    }}>
      <span style={{ color: Z.muted }}>{label}</span>
      <span style={{ color: valueColor || Z.white, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export { IncidentRecord };
