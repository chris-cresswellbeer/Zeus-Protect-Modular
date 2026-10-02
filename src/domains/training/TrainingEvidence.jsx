import React, { useState, useRef } from "react";
import { E } from "../../lib/emoji";
import { EVIDENCE_ACCEPT, EVIDENCE_MAX_MB, checkEvidenceFiles } from "./evidence";

/**
 * TrainingEvidence — attaching and opening evidence for recorded training
 * (signed sign-in sheets for group sessions, certificates for prior training).
 * See evidence.js for where the files go and who can open them.
 *
 *   EvidencePicker      choose files (PDF scans or photos), shown as a removable list
 *   EvidenceLinks       📎 links that open the attached files
 *   AttachEvidenceModal attach files to one record or a whole session later
 *   SessionsModal       the group-session register: every session, its attendees and
 *                       whether a signed sheet is on file, with Attach for each
 */
const fmt = d => { const [y, m, day] = String(d || "").split("-"); return y && m && day ? `${day}/${m}/${y}` : String(d || ""); };
const btn = (Z, primary) => ({ border: primary ? "none" : `1px solid ${Z.borderMd}`, background: primary ? `linear-gradient(135deg,${Z.green},#059669)` : Z.overlay, color: primary ? "#fff" : Z.muted, borderRadius: 10, padding: "9px 18px", fontWeight: 800, cursor: "pointer", fontSize: 13 });

function Shell({ title, onClose, children, Z, font, wide, z = 3000 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: z, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label={title} style={{ background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: `1px solid ${Z.borderMd}`, borderRadius: 18, padding: 24, width: "100%", maxWidth: wide ? 900 : 540, maxHeight: "90vh", overflowY: "auto", fontFamily: font, color: Z.white }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, flex: 1 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: Z.overlay, color: Z.muted, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: font }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** files: File[]; setFiles(next). */
function EvidencePicker({ files, setFiles, label, hint, Z, font, testId = "evidence-input" }) {
  const ref = useRef(null);
  const [err, setErr] = useState("");
  return (
    <div>
      {label && <div style={{ color: Z.muted, fontSize: 11, fontWeight: 700, letterSpacing: .5, margin: "12px 0 6px", textTransform: "uppercase" }}>{label}</div>}
      <input ref={ref} type="file" multiple accept={EVIDENCE_ACCEPT} data-testid={testId} style={{ display: "none" }}
        onChange={e => {
          const picked = Array.from(e.target.files || []); e.target.value = "";
          const problem = checkEvidenceFiles(picked);
          setErr(problem);
          if (!problem) setFiles([...files, ...picked]);
        }} />
      <div onClick={() => ref.current && ref.current.click()} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") ref.current && ref.current.click(); }}
        style={{ border: `2px dashed ${Z.borderMd}`, borderRadius: 10, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: font }}>
        <span style={{ fontSize: 20 }}>{E("📎", "+")}</span>
        <div style={{ fontSize: 12.5 }}>
          <div style={{ fontWeight: 700, color: Z.white }}>{files.length ? "Add another file" : "Choose file(s)…"}</div>
          <div style={{ color: Z.muted }}>{hint || `PDF scan or phone photos · up to ${EVIDENCE_MAX_MB} MB each`}</div>
        </div>
      </div>
      {files.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginTop: 6 }}>
          <span>{/pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? "📄" : "🖼️"}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
          <span style={{ color: Z.muted }}>{(f.size / 1048576).toFixed(1)} MB</span>
          <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}
            style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontWeight: 700, fontFamily: font }}>✕</button>
        </div>
      ))}
      {err && <div role="alert" style={{ color: "#f87171", fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

/** 📎 links to the files (open in a new tab; private files get a signed link automatically). */
function EvidenceLinks({ evidence, label = "Sign-in sheet", Z, size = 11 }) {
  if (!evidence || !evidence.length) return null;
  const link = { color: "#60a5fa", fontWeight: 700, fontSize: size, textDecoration: "underline" };
  return (
    <span data-testid="evidence-links" style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: size, color: Z.muted }}>{E("📎 ", "")}{label}:</span>
      {evidence.map((e, i) => (
        <a key={i} href={e.url} target="_blank" rel="noopener noreferrer" title={e.name} style={link}>
          {evidence.length > 1 ? `${i + 1}` : "open"}
        </a>
      ))}
    </span>
  );
}

/** onSave(files) → Promise<string|void> (error text, or nothing on success) */
function AttachEvidenceModal({ title, intro, onSave, onClose, Z, font }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    if (!files.length) { setErr("Choose at least one file."); return; }
    setBusy(true); setErr("");
    const r = await onSave(files);
    setBusy(false);
    if (r) setErr(r); else onClose();
  }
  return (
    <Shell title={title} onClose={onClose} Z={Z} font={font} z={3100}>
      {intro && <p style={{ margin: "0 0 4px", fontSize: 13, color: Z.muted, lineHeight: 1.6 }}>{intro}</p>}
      <EvidencePicker files={files} setFiles={setFiles} Z={Z} font={font} testId="attach-input" />
      {err && <div role="alert" style={{ color: "#f87171", fontWeight: 700, fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={save} disabled={busy} style={btn(Z, true)}>{busy ? "Uploading…" : `${E("📎 ", "")}Attach`}</button>
        <button onClick={onClose} style={{ ...btn(Z, false), marginLeft: "auto" }}>Cancel</button>
      </div>
    </Shell>
  );
}

/**
 * The group-session register. sessions from listSessions(); people/modules for names.
 * onAttach(session, files) → Promise<string|void>
 */
function SessionsModal({ sessions, people, modules, onAttach, onClose, Z, font }) {
  const [attachTo, setAttachTo] = useState(null);
  const [q, setQ] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const nameOf = id => (people.find(u => String(u.id) === String(id)) || {}).name || `User ${id}`;
  const titleOf = mid => (modules.find(m => String(m.id) === String(mid)) || {}).title || mid;
  const shown = sessions.filter(s => (!missingOnly || !s.evidence.length) &&
    (!q || `${titleOf(s.moduleId)} ${s.leader} ${s.where} ${s.attendees.map(nameOf).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const cell = { padding: "8px 8px", borderBottom: `1px solid ${Z.border}`, fontSize: 12.5, verticalAlign: "top" };
  const missing = sessions.filter(s => !s.evidence.length).length;
  return (
    <Shell title="Group session records" onClose={onClose} Z={Z} font={font} wide>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: Z.muted, lineHeight: 1.6 }}>
        Every group session and toolbox talk recorded, with its attendees. Attach the signed sign-in sheet so each attendance can be shown at an audit. A sheet attached here is linked to every attendee's record.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <input aria-label="Search sessions" value={q} onChange={e => setQ(e.target.value)} placeholder="Search module, leader, place or name"
          style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "8px 12px", color: Z.white, fontSize: 13, outline: "none", flex: 1, minWidth: 220 }} />
        <label style={{ fontSize: 12.5, cursor: "pointer", color: Z.white }}>
          <input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} /> No sign-in sheet yet ({missing})
        </label>
      </div>
      <div style={{ border: `1px solid ${Z.border}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Date", "Module", "Led by / where", "Attendees", "Sign-in sheet"].map(h => <th key={h} style={{ ...cell, textAlign: "left", color: Z.muted, fontSize: 11, background: Z.navyMd }}>{h}</th>)}</tr></thead>
          <tbody>
            {shown.map(s => (
              <tr key={s.key} data-session={s.key}>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>{fmt(s.date)}</td>
                <td style={{ ...cell, fontWeight: 700 }}>{titleOf(s.moduleId)}</td>
                <td style={{ ...cell, color: Z.muted }}>{s.leader}{s.where ? <><br />{s.where}</> : null}</td>
                <td style={{ ...cell, color: Z.muted }}><b style={{ color: Z.white }}>{s.attendees.length}</b> · {s.attendees.map(nameOf).sort().join(", ")}</td>
                <td style={cell}>
                  {s.evidence.length
                    ? <div style={{ display: "grid", gap: 4 }}><EvidenceLinks evidence={s.evidence} label="On file" Z={Z} size={12} />
                        <button onClick={() => setAttachTo(s)} style={{ ...btn(Z, false), padding: "4px 10px", fontSize: 11 }}>Add pages</button></div>
                    : <button onClick={() => setAttachTo(s)} style={{ ...btn(Z, true), padding: "6px 12px", fontSize: 12 }}>{E("📎 ", "")}Attach</button>}
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={5} style={{ ...cell, color: Z.muted }}>{sessions.length ? "Nothing matches." : "No group sessions recorded yet."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", marginTop: 14 }}><button onClick={onClose} style={{ ...btn(Z, false), marginLeft: "auto" }}>Close</button></div>
      {attachTo && (
        <AttachEvidenceModal
          title={`Sign-in sheet: ${titleOf(attachTo.moduleId)}, ${fmt(attachTo.date)}`}
          intro={`Attach the signed sign-in sheet (a PDF scan or photos). It will be linked to all ${attachTo.attendees.length} attendees' records.`}
          onSave={files => onAttach(attachTo, files)} onClose={() => setAttachTo(null)} Z={Z} font={font} />
      )}
    </Shell>
  );
}

export { EvidencePicker, EvidenceLinks, AttachEvidenceModal, SessionsModal };
