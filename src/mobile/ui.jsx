// src/mobile/ui.jsx
//
// Shared mobile primitives. These follow the same convention as the rest of the
// app: no stylesheet, inline style objects driven by the theme token object
// passed in as `Z`, and the Barlow stack passed in as `font`.
//
// Touch targets are 44pt minimum throughout — this is a gloves-on requirement,
// not a preference. Do not shrink them.

import React from "react";

const TOUCH = 44;

// ─── Layout ──────────────────────────────────────────────────────────────────

function Screen({ children, Z, pad = 18 }) {
  return (
    <div style={{ padding: `${pad}px ${pad}px 28px`, background: Z.bg, minHeight: "100%" }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, Z, color }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4,
      color: color || Z.muted, textTransform: "uppercase", marginBottom: 9,
    }}>
      {children}
    </div>
  );
}

function Card({ children, Z, tone = "flat", style }) {
  const tones = {
    flat:   { background: Z.overlay, border: `1px solid ${Z.borderMd}` },
    raised: { background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.border}` },
    accent: { background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.accent}55` },
    danger: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" },
    warn:   { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" },
    good:   { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" },
  };
  return (
    <div style={{ borderRadius: 16, padding: 15, ...tones[tone], ...(style || {}) }}>
      {children}
    </div>
  );
}

// ─── Rows ────────────────────────────────────────────────────────────────────

function Row({ icon, title, sub, right, onClick, Z, font, tone = "flat" }) {
  const tones = {
    flat:   { background: Z.overlay, border: `1px solid ${Z.borderMd}` },
    danger: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" },
    warn:   { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" },
  };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", display: "flex", alignItems: "center",
        gap: 13, borderRadius: 14, padding: "13px 14px", minHeight: 56,
        cursor: onClick ? "pointer" : "default", fontFamily: font,
        ...tones[tone],
      }}
    >
      {icon != null && <span style={{ fontSize: 23, flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: Z.white }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: Z.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </Tag>
  );
}

// Status chip using the portal's colour convention: text COLOR, fill COLOR+18,
// border COLOR+33.
function StatusChip({ label, color }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, color,
      background: `${color}18`, border: `1px solid ${color}33`,
      borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

function PrimaryButton({ children, onClick, disabled, Z, font, tone = "accent", style }) {
  const tones = {
    accent: { background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", shadow: `0 4px 16px ${Z.accent}44` },
    gold:   { background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#3d2200", shadow: "0 6px 22px rgba(245,158,11,0.35)" },
    green:  { background: `linear-gradient(135deg,${Z.green},#059669)`, color: "#fff", shadow: "0 2px 10px rgba(16,185,129,0.4)" },
    danger: { background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", shadow: "none" },
  };
  const t = tones[tone];
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: "100%", minHeight: 54, border: "none", borderRadius: 15,
        padding: 17, fontWeight: 800, fontSize: 16, fontFamily: font,
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "rgba(255,255,255,0.08)" : t.background,
        color: disabled ? Z.muted : t.color,
        boxShadow: disabled ? "none" : t.shadow,
        opacity: disabled ? 0.55 : 1,
        transition: "opacity .15s",
        ...(style || {}),
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, Z, font, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: TOUCH, border: `1px solid ${Z.borderMd}`, borderRadius: 14,
        padding: "15px 20px", background: Z.overlay, color: Z.slate,
        fontWeight: 700, fontSize: 14, fontFamily: font, cursor: "pointer",
        ...(style || {}),
      }}
    >
      {children}
    </button>
  );
}

// ─── Chrome ──────────────────────────────────────────────────────────────────

function MobileHeader({ kicker, title, onBack, right, Z, font }) {
  return (
    <div style={{
      flexShrink: 0, padding: "calc(env(safe-area-inset-top, 12px) + 12px) 18px 12px",
      background: `linear-gradient(180deg,${Z.navyDk},${Z.navyMd})`,
      borderBottom: `1px solid ${Z.border}`,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 34, height: 34, flexShrink: 0, borderRadius: 11,
            background: Z.overlay, border: `1px solid ${Z.borderMd}`,
            color: Z.slate, fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ‹
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6,
          color: Z.gold, textTransform: "uppercase",
        }}>
          {kicker}
        </div>
        <div style={{
          fontSize: 16, fontWeight: 800, color: Z.white,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}

function OfflineBanner({ queueCount, Z }) {
  return (
    <div style={{
      flexShrink: 0, background: "rgba(245,158,11,0.1)",
      borderBottom: "1px solid rgba(245,158,11,0.22)",
      padding: "7px 18px", display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: Z.gold, flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#fbbf24", flex: 1 }}>
        Offline — you can carry on, we&rsquo;ll sync later
      </span>
      {queueCount > 0 && (
        <span style={{
          fontSize: 10.5, fontWeight: 800, color: Z.gold,
          background: "rgba(245,158,11,0.15)", borderRadius: 6, padding: "2px 7px",
        }}>
          {queueCount} queued
        </span>
      )}
    </div>
  );
}

function TabBar({ tabs, active, onSelect, Z, font }) {
  return (
    <nav style={{
      flexShrink: 0,
      padding: "9px 8px calc(env(safe-area-inset-bottom, 8px) + 12px)",
      background: Z.navyDk, borderTop: `1px solid ${Z.borderMd}`,
      display: "flex", alignItems: "flex-start", gap: 2,
    }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-current={on ? "page" : undefined}
            style={{
              flex: 1, background: "none", border: "none", cursor: "pointer",
              padding: "6px 2px", minHeight: 48, fontFamily: font,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}
          >
            <span style={{ fontSize: 21, lineHeight: 1, opacity: on ? 1 : 0.45 }}>{t.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: on ? 800 : 600,
              color: on ? Z.accentLt : Z.mutedDk, letterSpacing: 0.2,
            }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// Striped placeholder for imagery we do not have yet.
function ImagePlaceholder({ label, height = 150, Z }) {
  return (
    <div style={{
      height, borderRadius: 16, border: `1px solid ${Z.borderMd}`,
      background: `repeating-linear-gradient(135deg,${Z.navyMd},${Z.navyMd} 10px,${Z.navy} 10px,${Z.navy} 20px)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      font: "600 11px ui-monospace,monospace", color: Z.muted, textAlign: "center",
    }}>
      {label}
    </div>
  );
}

export {
  TOUCH, Screen, SectionLabel, Card, Row, StatusChip,
  PrimaryButton, GhostButton, MobileHeader, OfflineBanner, TabBar, ImagePlaceholder,
};
