// src/mobile/screens/Permits.jsx
//
// Permits to work, from the point of view of the person about to do the job:
// what is live on site, and the sign-on for the permit they are standing in
// front of. Issuing a permit stays on the desktop — this is sign-on/sign-off.
//
// Hazards, precautions and PPE come from src/data/seedPermits.js so the mobile
// wording is identical to the permit the supervisor issued.

import React from "react";
import { PERMIT_TYPES } from "../../data/seedPermits";
import { Screen, SectionLabel, Card, Row, StatusChip, PrimaryButton } from "../ui";

function typeFor(id) {
  return PERMIT_TYPES.find((t) => t.id === id) || PERMIT_TYPES[PERMIT_TYPES.length - 1];
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

// ─── List ────────────────────────────────────────────────────────────────────
//
// `permits` — [{ id, ref, typeId, task, location, issuedBy, issuedAt, validUntil,
//                signedOnAt, signedOffAt, closed }]

function Permits({ permits, user, onOpenPermit, Z, font }) {
  const live = permits.filter((p) => !p.closed);
  const closed = permits.filter((p) => p.closed);

  return (
    <Screen Z={Z}>
      <SectionLabel Z={Z} color={Z.gold}>Live on site now · {live.length}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 20 }}>
        {live.length === 0 && (
          <Card Z={Z} tone="flat">
            <div style={{ fontSize: 13, color: Z.muted }}>No permits open on your site today.</div>
          </Card>
        )}
        {live.map((p) => {
          const t = typeFor(p.typeId);
          const signedOn = !!p.signedOnAt;
          return (
            <button
              key={p.id}
              onClick={() => onOpenPermit(p)}
              style={{
                width: "100%", textAlign: "left", display: "block", cursor: "pointer",
                fontFamily: font, borderRadius: 16, padding: 15,
                background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`,
                border: `2px solid ${signedOn ? "rgba(16,185,129,0.35)" : `${t.color}66`}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
                <span style={{ fontSize: 26 }}>{t.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: Z.white }}>
                    {t.label} — {p.task}
                  </div>
                  <div style={{ fontSize: 11.5, color: Z.muted, marginTop: 2 }}>
                    {p.ref} · {p.location} · issued {p.issuedAt} by {p.issuedBy}
                  </div>
                </div>
                <span style={{ color: Z.mutedDk }}>›</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusChip
                  label={signedOn ? "SIGNED ON" : "SIGN ON REQUIRED"}
                  color={signedOn ? "#10b981" : "#ef4444"}
                />
                <span style={{ fontSize: 11.5, color: Z.muted, fontWeight: 700 }}>
                  {signedOn ? `You signed on ${p.signedOnAt}` : `Valid until ${p.validUntil}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {closed.length > 0 && (
        <>
          <SectionLabel Z={Z}>Closed today</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {closed.map((p) => {
              const t = typeFor(p.typeId);
              return (
                <div key={p.id} style={{ opacity: 0.75 }}>
                  <Row
                    Z={Z} font={font} icon={t.icon}
                    title={`${t.label} — ${p.task}`}
                    sub={`${p.ref} · signed off ${p.signedOffAt} · area handed back`}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </Screen>
  );
}

// ─── Sign-on ─────────────────────────────────────────────────────────────────

function PermitDetail({ permit, user, onSignOn, onSignOff, Z, font }) {
  const t = typeFor(permit.typeId);
  const precautions = permit.precautions || t.precautions;
  const hazards = permit.hazards || t.hazards;
  const ppe = permit.ppe || [];

  const [checked, setChecked] = React.useState({});
  const [signedAt, setSignedAt] = React.useState(permit.signedOnAt || null);

  const count = precautions.filter((_, i) => checked[i]).length;
  const ready = count === precautions.length;

  function signOn() {
    if (!ready) return;
    const at = nowTime();
    setSignedAt(at);
    onSignOn({
      permitId: permit.id,
      ref: permit.ref,
      userId: user.id,
      signedOnAt: at,
      date: new Date().toISOString().slice(0, 10),
      precautionsConfirmed: precautions,
    });
  }

  return (
    <Screen Z={Z}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
        <StatusChip label={t.label.toUpperCase()} color={t.color} />
        <StatusChip label={permit.ref} color="#94a3b8" />
      </div>
      <h2 style={{
        fontSize: 21, fontWeight: 900, margin: "0 0 4px",
        letterSpacing: -0.4, lineHeight: 1.25, color: Z.white,
      }}>
        {permit.task}
      </h2>
      <p style={{ color: Z.muted, fontSize: 12.5, margin: "0 0 16px" }}>
        {permit.location} · issued {permit.issuedAt} by {permit.issuedBy} · valid until {permit.validUntil}
      </p>

      <Card Z={Z} tone="danger" style={{ marginBottom: 14 }}>
        <SectionLabel Z={Z} color="#f87171">Hazards on this job</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {hazards.map((h) => (
            <div key={h} style={{ fontSize: 13, color: Z.slate, lineHeight: 1.45 }}>• {h}</div>
          ))}
        </div>
      </Card>

      <SectionLabel Z={Z}>
        Confirm each precaution · {count} of {precautions.length}
      </SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {precautions.map((label, i) => {
          const on = !!checked[i];
          const locked = !!signedAt;
          return (
            <button
              key={label}
              onClick={locked ? undefined : () => setChecked((c) => ({ ...c, [i]: !c[i] }))}
              aria-pressed={on}
              style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center",
                gap: 12, minHeight: 56, borderRadius: 14, padding: 14,
                cursor: locked ? "default" : "pointer", fontFamily: font,
                background: on || locked ? "rgba(16,185,129,0.1)" : Z.overlay,
                border: `1.5px solid ${on || locked ? "rgba(16,185,129,0.35)" : Z.border}`,
              }}
            >
              <span style={{
                width: 24, height: 24, flexShrink: 0, borderRadius: 7,
                border: `2px solid ${on || locked ? "#10b981" : "rgba(255,255,255,0.25)"}`,
                background: on || locked ? "#10b981" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 900, color: "#fff",
              }}>
                {on || locked ? "✓" : ""}
              </span>
              <span style={{
                flex: 1, fontSize: 13.5, lineHeight: 1.4,
                fontWeight: on || locked ? 800 : 600,
                color: on || locked ? Z.white : Z.slate,
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {ppe.length > 0 && (
        <Card Z={Z} tone="flat" style={{ marginBottom: 16 }}>
          <SectionLabel Z={Z}>PPE for this permit</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {ppe.map((p) => (
              <span key={p} style={{
                fontSize: 12, fontWeight: 700, color: Z.slate,
                background: Z.overlay, border: `1px solid ${Z.borderMd}`,
                borderRadius: 99, padding: "7px 12px",
              }}>
                {p}
              </span>
            ))}
          </div>
        </Card>
      )}

      {signedAt ? (
        <>
          <Card Z={Z} tone="good" style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 12 }}>
            <span style={{ fontSize: 26 }}>✓</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: Z.green }}>
                Signed on at {signedAt}
              </div>
              <div style={{ fontSize: 12, color: Z.muted, marginTop: 2, lineHeight: 1.45 }}>
                {permit.typeId === "hot_works"
                  ? "Fire watch runs 60 minutes past sign-off. We'll remind you."
                  : "Sign off when the job is done and the area is handed back."}
              </div>
            </div>
          </Card>
          <PrimaryButton
            Z={Z} font={font} tone="green"
            onClick={() => onSignOff({ permitId: permit.id, ref: permit.ref, userId: user.id, signedOffAt: nowTime() })}
          >
            Sign off — job complete
          </PrimaryButton>
        </>
      ) : (
        <PrimaryButton Z={Z} font={font} tone="green" disabled={!ready} onClick={signOn}>
          {ready ? "Sign on to this permit" : `Confirm all ${precautions.length} precautions first`}
        </PrimaryButton>
      )}
    </Screen>
  );
}

export { Permits, PermitDetail };
