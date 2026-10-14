/**
 * SettingsSection / SettingsTabs — the layout of Site Settings.
 *
 *   <SettingsTabs sections={[{id, icon, label, dirty}]} active onJump/>
 *       a row of buttons, kept at the top of the screen while scrolling; each one
 *       opens its section and scrolls to it. "Open all" / "Close all" at the end.
 *   <SettingsSection id icon title summary dirty open onToggle>…</SettingsSection>
 *       a card whose header opens and closes it. Closed sections stay in the page
 *       (just hidden), so anything typed in them isn't lost; a section with unsaved
 *       changes shows "Unsaved changes" in its header and a dot on its tab.
 */
import React from "react";

const Chevron = ({ open, colour }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transition: "transform .15s", transform: open ? "rotate(90deg)" : "none", flexShrink: 0 }}>
    <polyline points="9 6 15 12 9 18"/>
  </svg>
);

export function SettingsTabs({ sections, active, onJump, onAll, allOpen, Z, font }) {
  return (
    <nav aria-label="Site Settings sections" data-testid="settings-tabs"
      style={{ position: "sticky", top: 8, zIndex: 15, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: 6, marginBottom: 14,
        background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
      {sections.map(s => {
        const on = s.id === active;
        return (
          <button key={s.id} type="button" onClick={() => onJump(s.id)} data-testid={`settings-tab-${s.id}`} aria-current={on ? "true" : undefined}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 38, padding: "0 14px", borderRadius: 10, cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700,
              border: `1px solid ${on ? Z.accent : "transparent"}`, background: on ? `${Z.accent}26` : "transparent", color: on ? Z.white : Z.muted }}>
            <span aria-hidden="true">{s.icon}</span>{s.label}
            {s.dirty && <span title="Unsaved changes" aria-label="unsaved changes" style={{ width: 8, height: 8, borderRadius: 4, background: "#f59e0b", display: "inline-block" }}/>}
          </button>
        );
      })}
      <button type="button" onClick={() => onAll(!allOpen)} data-testid="settings-all"
        style={{ marginLeft: "auto", minHeight: 38, padding: "0 12px", borderRadius: 10, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, border: `1px solid ${Z.borderMd}`, background: Z.overlay, color: Z.white }}>
        {allOpen ? "Close all" : "Open all"}
      </button>
    </nav>
  );
}

export function SettingsSection({ id, icon, title, summary, dirty, open, onToggle, children, Z, font }) {
  const bodyId = `settings-body-${id}`;
  return (
    <section id={`settings-${id}`} data-testid={`settings-section-${id}`} aria-labelledby={`settings-head-${id}`}
      style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${dirty ? "rgba(245,158,11,0.55)" : Z.border}`, borderRadius: 14, marginBottom: 12, scrollMarginTop: 72 }}>
      <h3 style={{ margin: 0 }} id={`settings-head-${id}`}>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={bodyId} data-testid={`settings-toggle-${id}`}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: font, color: Z.white, minHeight: 56 }}>
          <Chevron open={open} colour={Z.muted}/>
          <span aria-hidden="true" style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</span>
            {summary && <span data-testid={`settings-summary-${id}`} style={{ fontSize: 12.5, fontWeight: 500, color: Z.muted, lineHeight: 1.4 }}>{summary}</span>}
          </span>
          {dirty && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#f59e0b", border: "1px solid rgba(245,158,11,0.5)", borderRadius: 99, padding: "3px 9px", whiteSpace: "nowrap" }}>Unsaved changes</span>}
        </button>
      </h3>
      <div id={bodyId} hidden={!open} style={{ padding: "0 16px 16px" }}>{children}</div>
    </section>
  );
}
