import { useState } from "react";
import { isPassed, scoreText } from "../training/completion";
import { HelpTip } from "../../shared/HelpTip";
import { getExpiryStatus } from "../../lib/dates";
import { teamOf, normName } from "./team";

/**
 * MyTeamTab — the "My Team" tab for users with role "manager".
 *
 * TEAM = active staff whose Line Manager field matches the manager's name
 * (case/spacing-insensitive — see teamOf() below). Managers can:
 *   • see each team member's training, required reading, DSE and corrective actions
 *   • assign training modules to their own team members (add only)
 *   • sign off DSE issues as resolved, and sign off corrective actions
 * They cannot see anyone outside their team or reach any admin screen.
 * Every assignment and sign-off is written to the audit trail by App.jsx.
 */

const norm = normName;

// One member's position, using the same rules as the staff dashboard.
function summarise(u, ctx) {
  const { allModules, assigns, comps, docs, docAssignments, docAcknowledgements, dseReports, adminResponses, investigations } = ctx;
  const ids = assigns[String(u.id)] || [];
  const mods = allModules.filter(m => ids.includes(m.id));
  const c = comps[u.id] || comps[String(u.id)] || {};
  const modules = mods.map(m => {
    const rec = c[m.id];
    let status = "not_started", ex = null;
    if (isPassed(rec)) {
      ex = m.renewalMonths ? getExpiryStatus(rec.date, m.renewalMonths) : null;
      status = !ex || ex.status === "valid" ? "valid" : ex.status;   // valid | expiring | expired
    } else if (rec) status = "failed";
    return { m, rec, status, ex };
  });
  const good = modules.filter(x => x.status === "valid" || x.status === "expiring").length;
  const unreadDocs = docs.filter(d => (docAssignments[String(d.id)] || []).includes(String(u.id)) && !((docAcknowledgements[String(u.id)] || {})[d.id]));
  const reports = dseReports[u.id] || dseReports[String(u.id)] || [];
  const ri = reports.length - 1;
  const last = reports[ri];
  const resp = adminResponses[u.id] || adminResponses[String(u.id)] || {};
  const dseIssues = last ? (last.issues || []).map((iss, ii) => ({ iss, ii, ri, r: resp[`${ri}_${ii}`] || {} })) : [];
  const dseExp = last ? getExpiryStatus(last.date, 12) : null;
  const actions = Object.entries(investigations || {}).flatMap(([incidentId, inv]) =>
    (inv.actions || []).filter(a => norm(a.owner) === norm(u.name)).map(a => ({ a, incidentId })));
  return {
    modules, good, total: modules.length,
    pct: modules.length ? Math.round(good / modules.length * 100) : 100,
    overdue: modules.filter(x => x.status === "not_started" || x.status === "expired" || x.status === "failed").length,
    unreadDocs, last, dseExp, dseIssues,
    openDse: dseIssues.filter(x => !x.r.resolved).length,
    actions,
    openActions: actions.filter(x => x.a.status !== "complete" && x.a.status !== "closed").length,
    awaitingSignOff: actions.filter(x => !x.a.managerSignOff).length,
  };
}

const STATUS = {
  valid:       { label: "Up to date", key: "green" },
  expiring:    { label: "Expiring",   key: "amber" },
  expired:     { label: "Expired",    key: "red" },
  failed:      { label: "Not passed", key: "red" },
  not_started: { label: "Not started", key: "muted" },
};

function Badge({ text, color, Z }) {
  return <span style={{ fontSize: 11, fontWeight: 800, color, background: `${color}1F`, border: `1px solid ${color}55`, borderRadius: 99, padding: "2px 9px", whiteSpace: "nowrap" }}>{text}</span>;
}

function SignOffButton({ label, onConfirm, Z, font }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} style={{ background: `${Z.green}1A`, color: Z.green, border: `1px solid ${Z.green}55`, borderRadius: 8, padding: "5px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap" }}>✓ {label}</button>;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "5px 10px", color: Z.white, fontSize: 12, outline: "none", fontFamily: font, minWidth: 160 }} />
      <button onClick={() => { onConfirm(note.trim()); setOpen(false); setNote(""); }} style={{ background: Z.green, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: font }}>Confirm sign-off</button>
      <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: Z.muted, cursor: "pointer", fontSize: 12, fontFamily: font }}>Cancel</button>
    </div>
  );
}

function AssignPanel({ member, allModules, assigned, onAssign, Z, font }) {
  const [sel, setSel] = useState([]);
  const available = allModules.filter(m => !m._hidden && !assigned.includes(m.id));
  if (!available.length) return <div style={{ fontSize: 12, color: Z.muted }}>Every module is already assigned.</div>;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 6, marginBottom: 10 }}>
        {available.map(m => (
          <label key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: Z.white, background: Z.overlay, border: `1px solid ${sel.includes(m.id) ? Z.accentLt : Z.border}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer" }}>
            <input type="checkbox" checked={sel.includes(m.id)} onChange={e => setSel(p => e.target.checked ? [...p, m.id] : p.filter(x => x !== m.id))} />
            <span>{m.icon} {m.title}{m.level === "Mandatory" ? <span style={{ color: Z.red, fontWeight: 700 }}> · Mandatory</span> : null}</span>
          </label>
        ))}
      </div>
      <button disabled={!sel.length} onClick={() => { onAssign(member, sel); setSel([]); }} style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 800, fontSize: 12, cursor: sel.length ? "pointer" : "not-allowed", opacity: sel.length ? 1 : .5, fontFamily: font }}>
        Assign {sel.length || ""} module{sel.length === 1 ? "" : "s"} to {member.name.split(" ")[0]}
      </button>
    </div>
  );
}

function MemberDetail({ u, s, allModules, assigned, onAssign, onSignOffDse, onSignOffAction, Z, font }) {
  const [showAssign, setShowAssign] = useState(false);
  const h = { fontSize: 11, fontWeight: 800, color: Z.muted, letterSpacing: .6, textTransform: "uppercase", margin: "16px 0 8px" };
  const row = { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${Z.border}`, flexWrap: "wrap" };
  return (
    <div style={{ padding: "4px 18px 18px", borderTop: `1px solid ${Z.border}` }}>
      <div style={{ ...h, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Training</span>
        <button onClick={() => setShowAssign(v => !v)} style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "5px 12px", color: Z.accentLt, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: font, textTransform: "none", letterSpacing: 0 }}>{showAssign ? "✕ Close" : "+ Assign training"}</button>
      </div>
      {showAssign && <div style={{ marginBottom: 12 }}><AssignPanel member={u} allModules={allModules} assigned={assigned} onAssign={onAssign} Z={Z} font={font} /></div>}
      {s.modules.length === 0 ? <div style={{ fontSize: 12, color: Z.muted }}>No training assigned.</div> : s.modules.map(({ m, rec, status, ex }) => {
        const st = STATUS[status]; const col = Z[st.key] || Z.muted;
        return (
          <div key={m.id} style={row}>
            <span style={{ fontSize: 13, color: Z.white, fontWeight: 600, flex: 1, minWidth: 180 }}>{m.icon} {m.title}</span>
            <span style={{ fontSize: 12, color: Z.muted }}>{rec ? `${scoreText(rec)} · ${rec.date}${rec.moduleVersion ? ` · v${rec.moduleVersion}` : ""}` : ""}{ex && ex.expiryDate ? ` · expires ${ex.expiryDate}` : ""}</span>
            <Badge text={st.label} color={col} Z={Z} />
          </div>
        );
      })}

      <div style={h}>Required reading</div>
      {s.unreadDocs.length === 0 ? <div style={{ fontSize: 12, color: Z.green }}>✓ All read</div> : s.unreadDocs.map(d => (
        <div key={d.id} style={row}><span style={{ fontSize: 13, color: Z.white, flex: 1 }}>📄 {d.title} <span style={{ color: Z.muted }}>· v{d.version || 1}</span></span><Badge text="Not read" color={Z.red} Z={Z} /></div>
      ))}

      <div style={h}>DSE assessment</div>
      {!s.last ? <div style={{ fontSize: 12, color: Z.red }}>Not completed yet</div> : (
        <>
          <div style={{ fontSize: 12, color: Z.muted, marginBottom: 6 }}>Last completed {s.last.date}{s.dseExp ? ` · ${s.dseExp.status === "expired" ? "overdue for annual review" : `next due ${s.dseExp.expiryDate}`}` : ""}</div>
          {s.dseIssues.length === 0 && <div style={{ fontSize: 12, color: Z.green }}>✓ No issues raised</div>}
          {s.dseIssues.map(({ iss, ii, ri, r }) => (
            <div key={ii} style={row}>
              <span style={{ fontSize: 13, color: Z.white, flex: 1, minWidth: 200 }}>{iss.sectionIcon} {iss.question}{iss.comment ? <span style={{ display: "block", fontSize: 12, color: Z.muted }}>“{iss.comment}”</span> : null}</span>
              {r.resolved
                ? <Badge text={r.signedOffBy ? `Signed off by ${r.signedOffBy} ${r.signedOffAt || ""}` : "Resolved"} color={Z.green} Z={Z} />
                : <SignOffButton label="Sign off as resolved" onConfirm={note => onSignOffDse(u, ri, ii, iss, note)} Z={Z} font={font} />}
            </div>
          ))}
        </>
      )}

      <div style={h}>Corrective actions</div>
      {s.actions.length === 0 ? <div style={{ fontSize: 12, color: Z.muted }}>None assigned.</div> : s.actions.map(({ a, incidentId }) => {
        const done = a.status === "complete" || a.status === "closed";
        const late = !done && a.dueDate && a.dueDate < new Date().toISOString().slice(0, 10);
        return (
          <div key={incidentId + a.id} style={row}>
            <span style={{ fontSize: 13, color: Z.white, flex: 1, minWidth: 200 }}>{a.description}<span style={{ display: "block", fontSize: 12, color: late ? Z.red : Z.muted }}>Due {a.dueDate || "—"}{done ? ` · completed ${a.completedDate || ""}` : late ? " · overdue" : ""}</span></span>
            {a.managerSignOff
              ? <Badge text={`Signed off by ${a.managerSignOff.by} ${a.managerSignOff.date}`} color={Z.green} Z={Z} />
              : <SignOffButton label={done ? "Sign off" : "Mark complete & sign off"} onConfirm={note => onSignOffAction(incidentId, a, u, note)} Z={Z} font={font} />}
          </div>
        );
      })}
    </div>
  );
}

function MyTeamTab({ manager, users, allModules, assigns, comps, docs, docAssignments, docAcknowledgements, dseReports, adminResponses, investigations, onAssign, onSignOffDse, onSignOffAction, Z, font }) {
  const [openId, setOpenId] = useState(null);
  const team = teamOf(manager, users);
  const ctx = { allModules, assigns, comps, docs, docAssignments, docAcknowledgements, dseReports, adminResponses, investigations };
  const rows = team.map(u => ({ u, s: summarise(u, ctx) })).sort((a, b) => a.s.pct - b.s.pct);
  const totalMods = rows.reduce((n, r) => n + r.s.total, 0), goodMods = rows.reduce((n, r) => n + r.s.good, 0);
  const teamPct = totalMods ? Math.round(goodMods / totalMods * 100) : 100;
  const tiles = [
    { label: "Team members", value: team.length, color: Z.accentLt },
    { label: "Training up to date", value: `${teamPct}%`, color: teamPct === 100 ? Z.green : teamPct >= 70 ? Z.amber : Z.red },
    { label: "Training to do", value: rows.reduce((n, r) => n + r.s.overdue, 0), color: Z.red },
    { label: "Unread documents", value: rows.reduce((n, r) => n + r.s.unreadDocs.length, 0), color: Z.amber },
    { label: "Open DSE issues", value: rows.reduce((n, r) => n + r.s.openDse, 0), color: Z.amber },
    { label: "Open actions", value: rows.reduce((n, r) => n + r.s.openActions, 0), color: Z.gold },
  ];
  const cardBg = `linear-gradient(135deg,${Z.navyMd},${Z.navy})`;
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -.5, margin: "0 0 4px" }}>My Team <HelpTip dark={true} text="Everyone whose Line Manager is set to your name. You can see their training, required reading, DSE and corrective actions, assign them training, and sign off DSE issues and corrective actions. Every assignment and sign-off is recorded in the audit trail." /></h2>
      <p style={{ color: Z.muted, fontSize: 13, margin: "0 0 20px" }}>Your team's H&S compliance. Click a person to see details, assign training or sign things off.</p>
      {team.length === 0 ? (
        <div style={{ background: cardBg, border: `1px solid ${Z.border}`, borderRadius: 16, padding: 24, color: Z.muted, fontSize: 13 }}>
          Nobody has <b style={{ color: Z.white }}>{manager.name}</b> as their Line Manager yet. Ask an administrator to set it on your team members' staff records.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 20 }}>
            {tiles.map(t => (
              <div key={t.label} style={{ background: cardBg, border: `1px solid ${Z.border}`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: t.color }}>{t.value}</div>
                <div style={{ fontSize: 11, color: Z.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginTop: 2 }}>{t.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: cardBg, border: `1px solid ${Z.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.1fr 1fr 1fr 1fr 24px", gap: 10, padding: "11px 18px", background: Z.headerBg, fontSize: 11, fontWeight: 700, letterSpacing: .8, color: Z.muted, textTransform: "uppercase" }}>
              <span>Person</span><span>Training</span><span>Reading</span><span>DSE</span><span>Actions</span><span />
            </div>
            {rows.map(({ u, s }) => {
              const open = openId === u.id;
              const pctCol = s.pct === 100 ? Z.green : s.pct >= 70 ? Z.amber : Z.red;
              return (
                <div key={u.id} style={{ borderTop: `1px solid ${Z.border}` }}>
                  <button onClick={() => setOpenId(open ? null : u.id)} style={{ width: "100%", display: "grid", gridTemplateColumns: "2fr 1.1fr 1fr 1fr 1fr 24px", gap: 10, alignItems: "center", padding: "13px 18px", background: open ? Z.overlay : "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: font, color: Z.white }}>
                    <span><b style={{ fontSize: 14 }}>{u.name}</b><span style={{ display: "block", fontSize: 12, color: Z.muted }}>{u.jobTitle || ""}</span></span>
                    {s.total === 0
                      ? <span style={{ fontSize: 13, color: Z.muted }}>None assigned</span>
                      : <span style={{ fontSize: 13 }}><b style={{ color: pctCol }}>{s.pct}%</b> <span style={{ color: Z.muted }}>({s.good}/{s.total})</span>{s.overdue ? <span style={{ display: "block", fontSize: 11, color: Z.red }}>{s.overdue} to do</span> : null}</span>}
                    <span style={{ fontSize: 13, color: s.unreadDocs.length ? Z.amber : Z.green }}>{s.unreadDocs.length ? `${s.unreadDocs.length} unread` : "✓ Read"}</span>
                    <span style={{ fontSize: 13, color: !s.last ? Z.red : s.openDse ? Z.amber : Z.green }}>{!s.last ? "Not done" : s.openDse ? `${s.openDse} open issue${s.openDse === 1 ? "" : "s"}` : "✓ OK"}</span>
                    <span style={{ fontSize: 13, color: s.openActions ? Z.gold : Z.muted }}>{s.openActions ? `${s.openActions} open` : s.actions.length ? "✓ Done" : "—"}</span>
                    <span style={{ color: Z.muted }}>{open ? "▲" : "▼"}</span>
                  </button>
                  {open && <MemberDetail u={u} s={s} allModules={allModules} assigned={assigns[String(u.id)] || []} onAssign={onAssign} onSignOffDse={onSignOffDse} onSignOffAction={onSignOffAction} Z={Z} font={font} />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export { MyTeamTab };
