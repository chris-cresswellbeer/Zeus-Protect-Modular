// src/mobile/screens/Today.jsx
//
// The staff home. Answers "what needs me today" above the fold.
// All the derived compliance figures come from the same expressions the desktop
// staff dashboard uses in App.jsx — this screen does not invent its own maths.

import React from "react";
import { getExpiryStatus } from "../../lib/dates";
import { Screen, SectionLabel, Row, StatusChip, PrimaryButton } from "../ui";

function Today({
  user, myMods, myComps, unreadDocs, dseState,
  onResume, onOpenModule, onOpenDocs, onOpenDse, onReport,
  Z, font,
}) {
  const notStarted = myMods.filter((m) => !myComps[m.id]);
  const completed = myMods.filter((m) => myComps[m.id]);

  const statusOf = (m) => {
    if (!myComps[m.id]) return { key: "notStarted", color: "#f59e0b", label: "Not started" };
    const ex = m.renewalMonths ? getExpiryStatus(myComps[m.id].date, m.renewalMonths) : null;
    if (ex && ex.status === "expired") return { key: "expired", color: "#ef4444", label: "Expired" };
    if (ex && ex.status === "expiring") return { key: "expiring", color: "#f59e0b", label: ex.label };
    return { key: "valid", color: "#10b981", label: "Completed" };
  };

  const expired = completed.filter((m) => statusOf(m).key === "expired");
  const upToDate = completed.filter((m) => statusOf(m).key === "valid");

  // Same shape as App.jsx: modules + external certs + DSE as one item each.
  const totalItems = myMods.length + 1;
  const goodItems = upToDate.length + (dseState.completed && !dseState.expired ? 1 : 0);
  const healthPct = totalItems ? Math.round((goodItems / totalItems) * 100) : 100;
  const healthColor = healthPct === 100 ? "#10b981" : healthPct >= 70 ? "#f59e0b" : "#ef4444";

  const actionCount =
    notStarted.length + expired.length + (unreadDocs.length ? 1 : 0) + (dseState.needsAction ? 1 : 0);

  const inProgress = myMods.find((m) => m.progressSlide > 0 && !myComps[m.id]);
  const nextUp = inProgress || notStarted[0] || null;

  const firstName = (user.name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  const headline =
    actionCount === 0
      ? "You're all clear"
      : actionCount === 1
        ? "One thing needs you"
        : `${actionCount} things need you`;

  const subline =
    actionCount === 0
      ? "Nothing outstanding. We'll let you know when something comes up."
      : "Clear them and you're fully compliant again.";

  return (
    <Screen Z={Z}>
      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}>
        <Avatar name={user.name} size={46} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.15, color: Z.white }}>
            {greeting}, {firstName}
          </div>
          <div style={{ fontSize: 12, color: Z.muted, marginTop: 1 }}>
            {user.jobTitle || user.email}
          </div>
        </div>
      </div>

      {/* Compliance ring */}
      <div style={{
        background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`,
        border: `1px solid ${healthColor}44`, borderRadius: 18,
        padding: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 66, height: 66, borderRadius: "50%", flexShrink: 0,
          background: `conic-gradient(${healthColor} 0% ${healthPct}%, rgba(255,255,255,0.09) ${healthPct}% 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", background: Z.navy,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 19, fontWeight: 900, color: healthColor,
          }}>
            {healthPct}%
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: healthColor }}>{headline}</div>
          <div style={{ fontSize: 12.5, color: Z.muted, lineHeight: 1.45, marginTop: 2 }}>{subline}</div>
        </div>
      </div>

      {/* Resume / up next */}
      {nextUp && (
        <>
          <SectionLabel Z={Z}>
            {inProgress ? "Pick up where you left off" : "Up next"}
          </SectionLabel>
          <button
            onClick={() => (inProgress ? onResume(nextUp) : onOpenModule(nextUp))}
            style={{
              width: "100%", textAlign: "left", display: "block", marginBottom: 16,
              background: `linear-gradient(135deg,#1d3a8f,${Z.navyMd})`,
              border: `1px solid ${Z.accent}80`, borderRadius: 18, padding: 18,
              cursor: "pointer", fontFamily: font,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: inProgress ? 13 : 0 }}>
              <span style={{ fontSize: 32, lineHeight: 1 }}>{nextUp.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: Z.white, lineHeight: 1.2 }}>
                  {nextUp.title}
                </div>
                <div style={{ fontSize: 12, color: "#a5b4fc", marginTop: 3 }}>
                  {nextUp.duration} · {nextUp.level} · {(nextUp.content || []).length} slides
                </div>
              </div>
            </div>
            {inProgress && (
              <>
                <div style={{
                  height: 7, background: "rgba(0,0,0,0.3)", borderRadius: 99,
                  overflow: "hidden", marginBottom: 11,
                }}>
                  <div style={{
                    width: `${Math.round((nextUp.progressSlide / Math.max(1, (nextUp.content || []).length)) * 100)}%`,
                    height: "100%", background: `linear-gradient(90deg,${Z.accent},${Z.accentLt})`,
                    borderRadius: 99, transition: "width .35s",
                  }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#cbd5e1" }}>
                    Slide {nextUp.progressSlide} of {(nextUp.content || []).length}
                    {nextUp.offline ? " · saved on this phone ↓" : ""}
                  </span>
                  <span style={{
                    background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, borderRadius: 11,
                    padding: "10px 18px", color: "#fff", fontSize: 13.5, fontWeight: 800,
                  }}>
                    Resume
                  </span>
                </div>
              </>
            )}
          </button>
        </>
      )}

      {/* Action required */}
      {actionCount > 0 && (
        <>
          <SectionLabel Z={Z}>Action required</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 20 }}>
            {dseState.needsAction && (
              <Row
                Z={Z} font={font} tone="warn" icon="🖥️"
                title="DSE workstation self-assessment"
                sub={dseState.expired ? "Annual re-assessment due" : "Not yet completed"}
                onClick={onOpenDse}
                right={<Cta label="Start" color="#f59e0b" />}
              />
            )}
            {expired.map((m) => (
              <Row
                key={m.id} Z={Z} font={font} tone="danger" icon={m.icon}
                title={m.title} sub="Certificate expired — renewal required"
                onClick={() => onOpenModule(m)}
                right={<Cta label="Retake" color="#ef4444" solid />}
              />
            ))}
            {unreadDocs.length > 0 && (
              <Row
                Z={Z} font={font} tone="warn" icon="📄"
                title={`${unreadDocs.length} document${unreadDocs.length !== 1 ? "s" : ""} to read & confirm`}
                sub={unreadDocs.slice(0, 2).map((d) => d.title).join(" · ")}
                onClick={onOpenDocs}
                right={<Cta label="Review" color="#f59e0b" />}
              />
            )}
            {notStarted.filter((m) => m !== nextUp).map((m) => (
              <Row
                key={m.id} Z={Z} font={font} icon={m.icon}
                title={m.title} sub={`${m.category} · ${m.duration}`}
                onClick={() => onOpenModule(m)}
                right={<StatusChip label="Not started" color="#f59e0b" />}
              />
            ))}
          </div>
        </>
      )}

      {/* All clear */}
      {(upToDate.length > 0 || (dseState.completed && !dseState.expired)) && (
        <>
          <SectionLabel Z={Z}>All clear</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {dseState.completed && !dseState.expired && (
              <Row Z={Z} font={font} icon="🖥️" title="DSE workstation assessment"
                right={<StatusChip label="Valid" color="#10b981" />} />
            )}
            {upToDate.map((m) => (
              <Row
                key={m.id} Z={Z} font={font} icon={m.icon} title={m.title}
                right={<StatusChip label={`${myComps[m.id].score}%`} color="#10b981" />}
              />
            ))}
          </div>
        </>
      )}

      {myMods.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: Z.muted, fontSize: 14 }}>
          No training assigned yet. We&rsquo;ll let you know when there is.
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <PrimaryButton tone="gold" onClick={onReport} Z={Z} font={font}>
          ⚠ Report a hazard
        </PrimaryButton>
      </div>
    </Screen>
  );
}

// Local copies so this screen has no hard dependency on desktop-only props.
function Avatar({ name, size }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2);
  const hue = ((name || "?").charCodeAt(0) * 17) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue},50%,45%)`, display: "flex",
      alignItems: "center", justifyContent: "center", color: "#fff",
      fontWeight: 800, fontSize: size * 0.36, flexShrink: 0,
      border: "2px solid rgba(255,255,255,0.15)",
    }}>
      {initials}
    </div>
  );
}

function Cta({ label, color, solid }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, flexShrink: 0, borderRadius: 9, padding: "8px 12px",
      color: solid ? "#fff" : color,
      background: solid ? `linear-gradient(135deg,${color},#dc2626)` : `${color}26`,
      border: solid ? "none" : `1px solid ${color}4d`,
    }}>
      {label}
    </span>
  );
}

export { Today };
