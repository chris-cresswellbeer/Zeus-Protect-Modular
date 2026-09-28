import { useState } from "react";

/**
 * NewVersionModal — asked whenever an admin saves a new version of a training
 * module or uploads a new version of a document.
 *
 *   Minor change → existing completions / read confirmations stay valid.
 *   Major change → everyone must complete it / read and confirm it again.
 *
 * Either way the old version is kept (module_versions / document history) and
 * everyone's earlier results stay in the history tables.
 *
 * Props: kind ("module"|"document"), title, fromVersion, affectedCount,
 *        onConfirm(change: "minor"|"major", note), onCancel, Z, font
 */
function NewVersionModal({ kind, title, fromVersion, affectedCount, onConfirm, onCancel, Z, font }) {
  const [change, setChange] = useState("minor");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const isDoc = kind === "document";
  const who = `${affectedCount} ${affectedCount === 1 ? "person has" : "people have"} ${isDoc ? "confirmed they've read" : "completed"} version ${fromVersion}.`;
  const options = [
    { id: "minor", title: "Minor change", desc: isDoc
        ? "Typos, formatting or clarifications. Existing read confirmations stay valid."
        : "Wording, images or small fixes. Existing completions and certificates stay valid." },
    { id: "major", title: "Major change", desc: isDoc
        ? "The content has changed. Everyone assigned must read and confirm it again."
        : "The content or quiz has changed. Everyone who completed it must do it again." },
  ];
  const inp = { width: "100%", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "9px 13px", color: Z.white, fontSize: 13, outline: "none", fontFamily: font, boxSizing: "border-box", resize: "vertical" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 18, padding: 26, width: "100%", maxWidth: 500, border: `1px solid ${Z.borderMd}` }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: Z.white }}>Save as version {fromVersion + 1}</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: Z.muted }}>{title}. {who} Version {fromVersion} is kept in the version history either way.</p>
        {options.map(o => (
          <button key={o.id} onClick={() => setChange(o.id)} style={{
            display: "block", width: "100%", textAlign: "left", marginBottom: 10, cursor: "pointer", fontFamily: font,
            background: change === o.id ? `${o.id === "major" ? Z.red : Z.accent}1F` : Z.overlay,
            border: `1.5px solid ${change === o.id ? (o.id === "major" ? Z.red : Z.accentLt) : Z.borderMd}`, borderRadius: 12, padding: "12px 14px",
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: Z.white }}>{change === o.id ? "◉" : "○"} {o.title}</div>
            <div style={{ fontSize: 12, color: Z.muted, marginTop: 3, lineHeight: 1.5 }}>{o.desc}</div>
          </button>
        ))}
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: Z.muted, letterSpacing: .5, margin: "6px 0 6px", textTransform: "uppercase" }}>What changed? (recorded in the history)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g. Updated racking load limits in slide 4" style={inp} />
        {change === "major" && affectedCount > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: Z.slate, background: `${Z.red}14`, border: `1px solid ${Z.red}55`, borderRadius: 10, padding: "9px 12px", lineHeight: 1.5 }}>
            {affectedCount} {affectedCount === 1 ? "person" : "people"} will be asked to {isDoc ? "read and confirm it again" : "complete it again"}. Their earlier {isDoc ? "confirmations" : "results"} stay in the history.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onCancel} disabled={busy} style={{ flex: 1, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: 11, color: Z.muted, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Cancel</button>
          <button onClick={() => { setBusy(true); onConfirm(change, note.trim()); }} disabled={busy} style={{ flex: 2, background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, border: "none", borderRadius: 10, padding: 11, color: "#fff", fontWeight: 800, cursor: "pointer", fontFamily: font }}>
            Save version {fromVersion + 1}
          </button>
        </div>
      </div>
    </div>
  );
}

export { NewVersionModal };
