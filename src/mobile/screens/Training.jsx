// src/mobile/screens/Training.jsx
import React from "react";
import { getExpiryStatus } from "../../lib/dates";
import { Screen, SectionLabel, Row, StatusChip } from "../ui";

function statusOf(m, comp) {
  if (!comp) return { key: "notStarted", color: "#f59e0b", label: "Not started" };
  const ex = m.renewalMonths ? getExpiryStatus(comp.date, m.renewalMonths) : null;
  if (ex && ex.status === "expired") return { key: "expired", color: "#ef4444", label: "Expired" };
  if (ex && ex.status === "expiring") return { key: "expiring", color: "#f59e0b", label: ex.label };
  return { key: "valid", color: "#10b981", label: "Completed", expiry: ex };
}

function Training({ myMods, myComps, onOpenModule, Z, font }) {
  const withStatus = myMods.map((m) => ({ m, s: statusOf(m, myComps[m.id]) }));
  const todo = withStatus.filter((x) => x.s.key === "notStarted" || x.s.key === "expired" || x.s.key === "expiring");
  const valid = withStatus.filter((x) => x.s.key === "valid");

  return (
    <Screen Z={Z}>
      <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
        <Tile value={todo.length} label="To do" color={todo.length ? "#f59e0b" : "#10b981"} Z={Z} />
        <Tile value={valid.length} label="Valid" color="#10b981" Z={Z} />
        <Tile value={myMods.length} label="Assigned" color={Z.accentLt} Z={Z} />
      </div>

      {todo.length > 0 && (
        <>
          <SectionLabel Z={Z}>Needs doing</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {todo.map(({ m, s }) => (
              <Row
                key={m.id} Z={Z} font={font}
                tone={s.key === "expired" ? "danger" : "flat"}
                icon={m.icon}
                title={m.title}
                sub={`${m.category} · ${m.duration}${s.key === "expired" ? " · renewal required" : ""}`}
                onClick={() => onOpenModule(m)}
                right={<StatusChip label={s.label} color={s.color} />}
              />
            ))}
          </div>
        </>
      )}

      {valid.length > 0 && (
        <>
          <SectionLabel Z={Z}>Certificates in date</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {valid.map(({ m, s }) => (
              <Row
                key={m.id} Z={Z} font={font} icon={m.icon} title={m.title}
                sub={`${s.expiry ? s.expiry.label : "No renewal required"} · scored ${myComps[m.id].score}%`}
                onClick={() => onOpenModule(m)}
                right={<span style={{ fontSize: 17 }}>🎓</span>}
              />
            ))}
          </div>
        </>
      )}

      {myMods.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: Z.muted, fontSize: 14 }}>
          No training modules assigned yet.
        </div>
      )}
    </Screen>
  );
}

function Tile({ value, label, color, Z }) {
  return (
    <div style={{
      flex: 1, background: Z.overlay, border: `1px solid ${Z.borderMd}`,
      borderRadius: 12, padding: "11px 12px",
    }}>
      <div style={{ fontSize: 19, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: Z.slate, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export { Training, statusOf };
