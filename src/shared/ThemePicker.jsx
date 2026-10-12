/**
 * shared/ThemePicker.jsx — the "Display Theme" swatch grid in My Account.
 * Reads the theme list from theme/tokens.js (THEMES), grouped Light / Dark.
 * Each card is drawn in its OWN colours so people can see what they'll get.
 */
import React from "react";
import { THEMES } from "../theme/tokens";

const GROUPS = [
  { mode: "light", title: "Light" },
  { mode: "dark",  title: "Dark" },
];

function ThemeCard({ t, active, onPick, font }) {
  const z = t.tokens;
  return (
    <button type="button" onClick={() => onPick(t.key)} aria-pressed={active}
      data-zp-theme={t.key} data-zp-keep=""
      title={`${t.label}: ${t.desc}`}
      style={{
        padding: 0, borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: font,
        overflow: "hidden", background: z.bg, height: "100%",
        border: active ? `3px solid ${z.accent}` : `1px solid ${z.borderMd}`,
        boxShadow: active ? `0 0 0 2px ${z.bg}, 0 0 0 4px ${z.accent}` : "none",
        transition: "box-shadow .15s",
      }}>
      {/* mini preview: page, a card with a heading, body line and a button */}
      <div style={{ padding: 10, height: "100%", boxSizing: "border-box" }}>
        <div style={{ height: "100%", boxSizing: "border-box", background: z.bgCard, border: `1px solid ${z.border}`, borderRadius: 8, padding: "8px 9px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: z.white, lineHeight: 1.2, flex: 1, minWidth: 0 }}>
              {t.icon} {t.label}
            </div>
            {active && <span style={{ fontSize: 10, fontWeight: 800, color: z.accentLt, letterSpacing: .4, whiteSpace: "nowrap" }}>✓ IN USE</span>}
          </div>
          <div style={{ fontSize: 11, color: z.muted, margin: "3px 0 7px", lineHeight: 1.3 }}>{t.desc}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ background: z.accent, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 7px" }}>Button</span>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: z.green }} />
            <span style={{ width: 9, height: 9, borderRadius: 9, background: z.amber }} />
            <span style={{ width: 9, height: 9, borderRadius: 9, background: z.red }} />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ThemePicker({ theme, onPick, Z, font }) {
  return (
    <div>
      {GROUPS.map(g => (
        <div key={g.mode} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: Z.muted, margin: "0 0 8px" }}>{g.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
            {THEMES.filter(t => t.mode === g.mode).map(t => (
              <ThemeCard key={t.key} t={t} active={theme === t.key} onPick={onPick} font={font} />
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: Z.muted, lineHeight: 1.5 }}>
        The ☀️ / 🌙 button at the top switches between the last light and last dark theme you picked.
      </div>
    </div>
  );
}
