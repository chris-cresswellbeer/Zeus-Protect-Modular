// src/mobile/screens/More.jsx
//
// The More tab and the four screens hanging off it: certificates, corrective
// actions, training history, and appearance.

import React from "react";
import { ALL_THEMES } from "../../theme/tokens";
import { Screen, SectionLabel, Row, StatusChip, PrimaryButton } from "../ui";
import { promptInstall, isStandalone } from "../registerSW";

// ─── More ────────────────────────────────────────────────────────────────────

function More({
  user, counts, dseState, queue, canInstall,
  onOpenDocs, onOpenDse, onOpenCerts, onOpenActions, onOpenHistory, onOpenAppearance,
  onOpenInspections, onOpenPermits,
  onSignOut, onSwitchToDesktop, Z, font,
}) {
  return (
    <Screen Z={Z}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14, marginBottom: 18,
        background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`,
        border: `1px solid ${Z.border}`, borderRadius: 18, padding: 17,
      }}>
        <Avatar name={user.name} size={52} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: Z.white }}>{user.name}</div>
          <div style={{ fontSize: 12, color: Z.muted }}>
            {user.jobTitle}{user.manager ? ` · reports to ${user.manager}` : ""}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        <Row Z={Z} font={font} icon="📄" title="H&S documents" onClick={onOpenDocs}
          right={<Chevron Z={Z} badge={counts.unreadDocs} badgeColor={Z.gold} />} />
        <Row Z={Z} font={font} icon="🖥️" title="DSE assessment" onClick={onOpenDse}
          right={<Chevron Z={Z} chip={<StatusChip
            label={dseState.needsAction ? "Due" : "Valid"}
            color={dseState.needsAction ? "#f59e0b" : "#10b981"} />} />} />
        <Row Z={Z} font={font} icon="🎓" title="My certificates" onClick={onOpenCerts}
          right={<Chevron Z={Z} badge={counts.certificates} badgeColor={Z.green} />} />
        <Row Z={Z} font={font} icon="✅" title="My corrective actions" onClick={onOpenActions}
          right={<Chevron Z={Z} badge={counts.openActions} badgeColor={Z.gold} />} />
        {onOpenInspections && (
          <Row Z={Z} font={font} icon="🚶" title="Site inspections" onClick={onOpenInspections}
            right={<Chevron Z={Z} badge={counts.inspectionsDue} badgeColor={Z.gold} />} />
        )}
        {onOpenPermits && (
          <Row Z={Z} font={font} icon="🔥" title="Permits to work" onClick={onOpenPermits}
            right={<Chevron Z={Z} badge={counts.permitsToSign} badgeColor="#ef4444" />} />
        )}
        <Row Z={Z} font={font} icon="📋" title="Training history" onClick={onOpenHistory}
          right={<Chevron Z={Z} />} />
        <Row Z={Z} font={font} icon="⚙️" title="Appearance & theme" onClick={onOpenAppearance}
          right={<Chevron Z={Z} />} />
      </div>

      {canInstall && !isStandalone() && (
        <div style={{ marginBottom: 18 }}>
          <PrimaryButton onClick={promptInstall} Z={Z} font={font}>
            Add Zeus Protect to your home screen
          </PrimaryButton>
        </div>
      )}

      <div style={{
        background: Z.overlaySm, border: `1px solid ${Z.border}`,
        borderRadius: 14, padding: 14, marginBottom: 18,
      }}>
        <SectionLabel Z={Z}>Offline queue</SectionLabel>
        {queue.length === 0 && (
          <div style={{ fontSize: 12.5, color: Z.muted }}>Everything is synced.</div>
        )}
        {queue.map((item) => (
          <div key={item.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
            fontSize: 12.5, color: Z.slate,
          }}>
            <span>⏳</span>
            <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
            <span style={{ color: Z.gold, fontWeight: 700 }}>Waiting</span>
          </div>
        ))}
      </div>

      {onSwitchToDesktop && (
        <button
          onClick={onSwitchToDesktop}
          style={{
            width: "100%", minHeight: 48, marginBottom: 8, background: Z.overlay,
            border: `1px solid ${Z.borderMd}`, borderRadius: 14, color: Z.slate,
            fontSize: 13.5, fontWeight: 700, fontFamily: font, cursor: "pointer",
          }}
        >
          Use the full portal instead
        </button>
      )}

      <button
        onClick={onSignOut}
        style={{
          width: "100%", minHeight: 48, background: "none", border: "none",
          color: Z.muted, fontSize: 13, fontFamily: font, cursor: "pointer",
        }}
      >
        Sign out
      </button>
    </Screen>
  );
}

// ─── Certificates ────────────────────────────────────────────────────────────

function Certificates({ certificates, Z, font }) {
  const valid = certificates.filter((c) => !c.lapsed);
  const lapsed = certificates.filter((c) => c.lapsed);

  return (
    <Screen Z={Z}>
      <div style={{
        background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`,
        border: "1px solid rgba(245,158,11,0.3)", borderRadius: 18,
        padding: 17, marginBottom: 18, display: "flex", alignItems: "center", gap: 15,
      }}>
        <div style={{
          width: 54, height: 54, borderRadius: 14, flexShrink: 0,
          background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
        }}>
          🎓
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: Z.white }}>
            {valid.length} certificate{valid.length !== 1 ? "s" : ""}, all yours
          </div>
          <div style={{ fontSize: 12, color: Z.muted, marginTop: 2, lineHeight: 1.4 }}>
            Tap any one to show a code an auditor can scan — works offline.
          </div>
        </div>
      </div>

      {valid.length > 0 && <SectionLabel Z={Z}>In date</SectionLabel>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {valid.map((c) => (
          <div key={c.certId || c.moduleId} style={{
            background: "linear-gradient(160deg,#0d1f5c,#091548)",
            border: "1px solid rgba(245,158,11,0.35)", borderRadius: 16,
            padding: 15, display: "flex", alignItems: "center", gap: 13, minHeight: 64,
          }}>
            <span style={{ fontSize: 26 }}>{c.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: Z.white }}>{c.title}</div>
              <div style={{ fontSize: 11, color: Z.muted, marginTop: 2 }}>
                {c.certId} · {c.score}%{c.validUntil ? ` · valid to ${c.validUntil}` : ""}
              </div>
            </div>
            <span style={{ fontSize: 22, color: Z.gold }} title="Show scannable code">⌗</span>
          </div>
        ))}
      </div>

      {lapsed.length > 0 && (
        <>
          <SectionLabel Z={Z}>Lapsed</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lapsed.map((c) => (
              <div key={c.certId || c.moduleId} style={{
                background: Z.overlaySm, border: "1px solid rgba(239,68,68,0.22)",
                borderRadius: 16, padding: 15, display: "flex", alignItems: "center",
                gap: 13, minHeight: 64, opacity: 0.75,
              }}>
                <span style={{ fontSize: 26 }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: Z.white }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: "#f87171", marginTop: 2 }}>
                    Expired {c.expiredOn} · retake to reissue
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {certificates.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: Z.muted, fontSize: 14 }}>
          No certificates yet — finish a module and one appears here.
        </div>
      )}
    </Screen>
  );
}

// ─── Corrective actions ──────────────────────────────────────────────────────

function CorrectiveActions({ open, closed, onComplete, onAddProof, Z, font }) {
  return (
    <Screen Z={Z}>
      <SectionLabel Z={Z} color={open.length ? Z.gold : Z.green}>
        Open · {open.length}
      </SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 20 }}>
        {open.map((a) => {
          const overdue = a.dueDate && a.dueDate < new Date().toISOString().slice(0, 10);
          const days = a.dueDate ? daysUntil(a.dueDate) : null;
          return (
            <div key={a.id} style={{
              background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`,
              border: `1px solid ${overdue ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.35)"}`,
              borderRadius: 18, padding: 17,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
                <StatusChip
                  label={overdue ? `${Math.abs(days)} days overdue` : days != null ? `Due in ${days} days` : "No due date"}
                  color={overdue ? "#ef4444" : "#f59e0b"}
                />
                {a.ref && <StatusChip label={a.ref} color="#94a3b8" />}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: Z.white, lineHeight: 1.3, marginBottom: 6 }}>
                {a.title}
              </div>
              {a.detail && (
                <p style={{ fontSize: 12.5, color: Z.muted, lineHeight: 1.5, margin: "0 0 14px" }}>{a.detail}</p>
              )}
              <div style={{ display: "flex", gap: 9 }}>
                <PrimaryButton
                  tone="green" onClick={() => onComplete(a)} Z={Z} font={font}
                  style={{ flex: 1, minHeight: 50, padding: 14, fontSize: 13.5, borderRadius: 12 }}
                >
                  ✓ Mark done
                </PrimaryButton>
                <button
                  onClick={() => onAddProof(a)}
                  style={{
                    flex: 1, minHeight: 50, background: Z.overlay, border: `1px solid ${Z.borderMd}`,
                    borderRadius: 12, padding: 14, color: Z.slate, fontWeight: 700,
                    fontSize: 13.5, fontFamily: font, cursor: "pointer",
                  }}
                >
                  📷 Add proof
                </button>
              </div>
            </div>
          );
        })}
        {open.length === 0 && (
          <div style={{ fontSize: 13.5, color: Z.muted, padding: "8px 0" }}>
            Nothing assigned to you right now.
          </div>
        )}
      </div>

      {closed.length > 0 && (
        <>
          <SectionLabel Z={Z}>Closed</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {closed.map((a) => (
              <Row
                key={a.id} Z={Z} font={font} icon={<span style={{ color: Z.green }}>✓</span>}
                title={a.title}
                sub={`Closed ${a.closedOn}${a.verifiedBy ? ` · verified by ${a.verifiedBy}` : ""}`}
              />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

// ─── Training history ────────────────────────────────────────────────────────

function TrainingHistory({ entries, stats, Z, font }) {
  const byYear = entries.reduce((acc, e) => {
    const y = (e.date || "").slice(0, 4) || "—";
    (acc[y] = acc[y] || []).push(e);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <Screen Z={Z}>
      <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
        <HistStat value={stats.passed} label="Modules passed" color="#10b981" Z={Z} />
        <HistStat value={`${stats.average}%`} label="Average score" color={Z.accentLt} Z={Z} />
        <HistStat value={stats.retakes} label="Retakes" color="#f59e0b" Z={Z} />
      </div>

      {years.map((year) => (
        <div key={year} style={{ marginBottom: 20 }}>
          <SectionLabel Z={Z}>{year}</SectionLabel>
          <div style={{ position: "relative", paddingLeft: 18, borderLeft: `2px solid ${Z.borderMd}` }}>
            {byYear[year].map((e, i) => (
              <div key={i} style={{ padding: "0 0 18px 14px", position: "relative" }}>
                <span style={{
                  position: "absolute", left: -25, top: 2, width: 12, height: 12,
                  borderRadius: "50%", border: `2px solid ${Z.bg}`,
                  background: e.lapsed ? "#f59e0b" : "#10b981",
                }} />
                <div style={{ fontSize: 11, color: Z.muted, fontWeight: 700, marginBottom: 2 }}>{e.date}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: Z.white }}>{e.title}</div>
                <div style={{ fontSize: 11.5, color: e.lapsed ? "#f59e0b" : "#10b981", marginTop: 1 }}>
                  {e.outcome}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {entries.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: Z.muted, fontSize: 14 }}>
          Nothing here yet.
        </div>
      )}
    </Screen>
  );
}

// ─── Appearance ──────────────────────────────────────────────────────────────

const THEME_PREVIEWS = {
  dark:     ["#060d2e", "#0d1f5c", "#2563eb"],
  light:    ["#e8edf7", "#ffffff", "#2563eb"],
  slate:    ["#0d1117", "#1a1f2e", "#0d9488"],
  forest:   ["#0a150a", "#1a2e1a", "#16a34a"],
  graphite: ["#0a0a0a", "#1c1c1e", "#f59e0b"],
  arctic:   ["#0a0718", "#1a1033", "#06b6d4"],
  sand:     ["#f0e6d3", "#fdf8f0", "#c2522a"],
  rose:     ["#fce7ed", "#fff0f3", "#e11d48"],
};

function Appearance({
  theme, followSystem, onSelectTheme, onFollowSystem,
  textScale, onTextScale, prefs, onPrefChange, storageUsed,
  Z, font,
}) {
  return (
    <Screen Z={Z}>
      <SectionLabel Z={Z}>Theme</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
        <button
          onClick={onFollowSystem}
          style={{
            width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 13,
            minHeight: 60, padding: 15, borderRadius: 15, cursor: "pointer", fontFamily: font,
            border: followSystem ? `2px solid ${Z.accent}` : `1px solid ${Z.border}`,
            background: followSystem ? "rgba(37,99,235,0.16)" : Z.overlay,
          }}
        >
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            <span style={{ width: 14, height: 28, borderRadius: "4px 0 0 4px", background: "#060d2e", border: "1px solid rgba(255,255,255,0.15)" }} />
            <span style={{ width: 14, height: 28, borderRadius: "0 4px 4px 0", background: "#e8edf7" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: Z.white }}>Follow system</div>
            <div style={{ fontSize: 11.5, color: followSystem ? "#a5b4fc" : Z.muted, marginTop: 1 }}>
              Dark at night, light in the office
            </div>
          </div>
          {followSystem && <span style={{ color: Z.accentLt, fontSize: 17 }}>✓</span>}
        </button>

        {Object.values(ALL_THEMES).map((t) => {
          const on = !followSystem && theme === t.key;
          const swatches = THEME_PREVIEWS[t.key] || [];
          return (
            <button
              key={t.key}
              onClick={() => onSelectTheme(t.key)}
              style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 13,
                minHeight: 60, padding: 15, borderRadius: 15, cursor: "pointer", fontFamily: font,
                border: on ? `2px solid ${Z.accent}` : `1px solid ${Z.border}`,
                background: on ? "rgba(37,99,235,0.16)" : Z.overlay,
              }}
            >
              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                {swatches.map((c) => (
                  <span key={c} style={{
                    width: 9, height: 28, borderRadius: 3, background: c,
                    border: "1px solid rgba(255,255,255,0.12)",
                  }} />
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: on ? 800 : 700, color: Z.white }}>{t.label}</div>
                <div style={{ fontSize: 11.5, color: Z.muted, marginTop: 1 }}>{t.desc}</div>
              </div>
              {on && <span style={{ color: Z.accentLt, fontSize: 17 }}>✓</span>}
            </button>
          );
        })}
      </div>

      <SectionLabel Z={Z}>Reading</SectionLabel>
      <div style={{
        background: Z.overlay, border: `1px solid ${Z.borderMd}`,
        borderRadius: 15, padding: 16, marginBottom: 22,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: Z.white }}>Text size</span>
          <span style={{ fontSize: 12.5, color: Z.muted, fontWeight: 700 }}>
            {textScale <= 0.95 ? "Small" : textScale >= 1.15 ? "Large" : "Default"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: Z.mutedDk }}>A</span>
          <input
            type="range" min="0.9" max="1.3" step="0.05" value={textScale}
            onChange={(e) => onTextScale(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: Z.accent, height: 32 }}
          />
          <span style={{ fontSize: 20, color: Z.slate }}>A</span>
        </div>
      </div>

      <SectionLabel Z={Z}>Sync &amp; storage</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Toggle
          label="Download over mobile data"
          on={prefs.mobileData}
          onChange={() => onPrefChange("mobileData", !prefs.mobileData)}
          Z={Z}
        />
        <Toggle
          label="Keep modules offline"
          on={prefs.keepOffline}
          onChange={() => onPrefChange("keepOffline", !prefs.keepOffline)}
          Z={Z}
        />
        <Row Z={Z} font={font} title="Storage used"
          right={<span style={{ fontSize: 12.5, color: Z.muted, fontWeight: 700 }}>{storageUsed}</span>} />
      </div>
    </Screen>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function Toggle({ label, on, onChange, Z }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={on}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 13, minHeight: 56,
        background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 14,
        padding: 15, cursor: "pointer", textAlign: "left",
      }}
    >
      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: Z.white }}>{label}</span>
      <span style={{
        width: 48, height: 28, borderRadius: 99, flexShrink: 0, position: "relative",
        background: on ? Z.accent : "rgba(255,255,255,0.14)", transition: "background .15s",
      }}>
        <span style={{
          position: "absolute", top: 3, left: on ? 23 : 3, width: 22, height: 22,
          borderRadius: "50%", background: on ? "#fff" : Z.muted, transition: "left .15s",
        }} />
      </span>
    </button>
  );
}

function Chevron({ Z, badge, badgeColor, chip }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      {chip}
      {badge > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 800, color: badgeColor,
          background: `${badgeColor}26`, borderRadius: 6, padding: "3px 8px",
        }}>
          {badge}
        </span>
      )}
      <span style={{ color: Z.mutedDk }}>›</span>
    </span>
  );
}

function Avatar({ name, size }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2);
  const hue = ((name || "?").charCodeAt(0) * 17) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: `hsl(${hue},50%,45%)`,
      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
      fontWeight: 800, fontSize: size * 0.36, flexShrink: 0,
      border: "2px solid rgba(255,255,255,0.15)",
    }}>
      {initials}
    </div>
  );
}

function HistStat({ value, label, color, Z }) {
  return (
    <div style={{ flex: 1, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, fontFamily: "'Barlow Condensed',sans-serif" }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: Z.slate, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

export { More, Certificates, CorrectiveActions, TrainingHistory, Appearance };
