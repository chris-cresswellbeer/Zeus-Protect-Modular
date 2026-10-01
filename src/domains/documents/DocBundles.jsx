import React, { useState } from "react";
import { E } from "../../lib/emoji";
import { cleanBundle, bundleProgress } from "./bundles";

/**
 * DocBundles — the "Document bundles" view of the admin Documents tab.
 *
 * A bundle is a named set of documents (e.g. "New starter induction pack") that is
 * assigned in one go as required reading. Assigning it writes the normal
 * per-document assignments, so staff see the documents in Required Reading as
 * usual, plus a progress line for the bundle. See bundles.js.
 *
 * Props
 *   bundles, docs, staff (people who can be given bundles — no leavers),
 *   allPeople (for names), docAcknowledgements
 *   onSave(bundle, { unassignRemoved }) → Promise<boolean>   create or update
 *   onDelete(bundle, { unassign })      → Promise
 *   onAssign(bundle, userIds)           → Promise<number>   people newly given it
 *   onUnassign(bundle, userIds)         → Promise
 */

const S = v => String(v);
const EXT_ICONS = { PDF: "📕", DOCX: "📘", DOC: "📘", XLSX: "📗", XLS: "📗", PPTX: "📙", PPT: "📙", PNG: "🖼️", JPG: "🖼️", JPEG: "🖼️", TXT: "📄", CSV: "📊" };

function Shell({ title, onClose, children, Z, font, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label={title} style={{ background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: `1px solid ${Z.borderMd}`, borderRadius: 18, padding: 24, width: "100%", maxWidth: wide ? 900 : 560, maxHeight: "90vh", overflowY: "auto", fontFamily: font, color: Z.white }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, flex: 1 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: Z.overlay, color: Z.muted, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: font }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const input = Z => ({ width: "100%", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "10px 14px", color: Z.white, fontSize: 14, outline: "none", boxSizing: "border-box" });
const label = Z => ({ color: Z.muted, fontSize: 11, fontWeight: 700, letterSpacing: .5, display: "block", margin: "12px 0 6px", textTransform: "uppercase" });
const btn = (Z, kind) => ({
  border: kind === "primary" ? "none" : `1px solid ${kind === "danger" ? "rgba(239,68,68,0.3)" : Z.borderMd}`,
  background: kind === "primary" ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : kind === "danger" ? "rgba(239,68,68,0.08)" : Z.overlay,
  color: kind === "primary" ? "#fff" : kind === "danger" ? "#f87171" : Z.muted,
  borderRadius: 10, padding: "9px 16px", fontWeight: 800, cursor: "pointer", fontSize: 12.5, whiteSpace: "nowrap",
});
const chip = (Z, col) => ({ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: col ? `${col}1f` : Z.overlay, color: col || Z.muted, border: `1px solid ${col ? `${col}55` : Z.borderMd}`, whiteSpace: "nowrap" });
const extOf = d => (d.fileName ? d.fileName.split(".").pop() : d.ext || "").toUpperCase();

// ── Create / edit a bundle ───────────────────────────────────────────────────
function BundleEditor({ bundle, bundles, docs, onSave, onClose, Z, font }) {
  const isNew = !bundle.id;
  const [name, setName] = useState(bundle.name || "");
  const [description, setDescription] = useState(bundle.description || "");
  const [picked, setPicked] = useState(() => new Set(bundle.docIds || []));
  const [autoNew, setAutoNew] = useState(!!bundle.autoNew);
  const [unassignRemoved, setUnassignRemoved] = useState(true);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("all");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const folders = ["all", ...Array.from(new Set(docs.map(d => d.type || "Document"))).sort()];
  const shown = docs.filter(d => (folder === "all" || (d.type || "Document") === folder) && (!q || `${d.title} ${d.fileName || ""}`.toLowerCase().includes(q.toLowerCase())));
  const members = (bundle.memberIds || []).length;
  const added = [...picked].filter(id => !(bundle.docIds || []).includes(id));
  const removed = (bundle.docIds || []).filter(id => !picked.has(id) && docs.some(d => S(d.id) === id));
  const toggle = id => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setAll = on => setPicked(p => { const n = new Set(p); shown.forEach(d => on ? n.add(S(d.id)) : n.delete(S(d.id))); return n; });

  async function save() {
    const nm = name.trim();
    if (!nm) { setErr("Give the bundle a name."); return; }
    if (bundles.some(b => b.id !== bundle.id && b.name.toLowerCase() === nm.toLowerCase())) { setErr("There's already a bundle with that name."); return; }
    // keep ids of documents that no longer exist out of the saved bundle
    const ids = [...picked].filter(id => docs.some(d => S(d.id) === id));
    if (!ids.length) { setErr("Tick at least one document."); return; }
    setBusy(true); setErr("");
    const ok = await onSave(cleanBundle({ ...bundle, name: nm, description, docIds: ids, autoNew }), { unassignRemoved: removed.length > 0 && unassignRemoved });
    setBusy(false);
    if (ok !== false) onClose();
  }

  return (
    <Shell title={isNew ? "New document bundle" : `Edit bundle: ${bundle.name}`} onClose={onClose} Z={Z} font={font} wide>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: Z.muted, lineHeight: 1.6 }}>
        A bundle is a set of documents you assign together as required reading, for example an induction pack or the documents for one job role.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
        <div><label style={label(Z)} htmlFor="bd-name">Bundle name *</label>
          <input id="bd-name" value={name} onChange={e => { setName(e.target.value); setErr(""); }} placeholder="e.g. New starter induction pack" style={input(Z)} /></div>
        <div><label style={label(Z)} htmlFor="bd-desc">Description (optional — staff see this)</label>
          <input id="bd-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Read in your first week" style={input(Z)} /></div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "16px 0 8px", flexWrap: "wrap" }}>
        <b style={{ fontSize: 13 }}>Documents in this bundle</b>
        <span style={{ fontSize: 12, color: Z.muted }}>{picked.size} ticked</span>
        <select aria-label="Category" value={folder} onChange={e => setFolder(e.target.value)} style={{ ...input(Z), width: "auto", padding: "7px 10px", fontSize: 12.5, marginLeft: "auto" }}>
          {folders.map(f => <option key={f} value={f}>{f === "all" ? "All categories" : f}</option>)}
        </select>
        <input aria-label="Search documents" value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents" style={{ ...input(Z), width: 200, padding: "7px 12px", fontSize: 12.5 }} />
        <button onClick={() => setAll(true)} style={{ ...btn(Z), padding: "7px 12px" }}>Tick all shown</button>
        <button onClick={() => setAll(false)} style={{ ...btn(Z), padding: "7px 12px" }}>Clear</button>
      </div>
      <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${Z.border}`, borderRadius: 10 }}>
        {shown.map((d, i) => { const on = picked.has(S(d.id)); return (
          <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: i ? `1px solid ${Z.border}` : "none", cursor: "pointer", background: on ? "rgba(37,99,235,0.08)" : "transparent" }}>
            <input type="checkbox" aria-label={d.title} checked={on} onChange={() => toggle(S(d.id))} />
            <span style={{ fontSize: 17 }}>{EXT_ICONS[extOf(d)] || "📄"}</span>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
            <span style={{ fontSize: 11, color: Z.muted }}>{d.type || "Document"}</span>
          </label>); })}
        {!shown.length && <div style={{ padding: 14, fontSize: 13, color: Z.muted }}>{docs.length ? "No documents match." : "Upload some documents first."}</div>}
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, fontSize: 13, cursor: "pointer" }}>
        <input id="bd-auto" type="checkbox" checked={autoNew} onChange={e => setAutoNew(e.target.checked)} style={{ marginTop: 2 }} />
        <span><b>Give this bundle to new staff automatically</b><br /><span style={{ color: Z.muted, fontSize: 12 }}>Everyone added from now on (one at a time or by CSV import) gets it as required reading.</span></span>
      </label>

      {!isNew && members > 0 && (added.length > 0 || removed.length > 0) && (
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(37,99,235,0.08)", border: `1px solid ${Z.accent}44`, fontSize: 12.5, lineHeight: 1.6 }}>
          {added.length > 0 && <div>{E("➕ ", "")}{added.length} document{added.length !== 1 ? "s" : ""} added: assigned straight away to the {members} {members !== 1 ? "people" : "person"} who have this bundle.</div>}
          {removed.length > 0 && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer", marginTop: added.length ? 6 : 0 }}>
              <input id="bd-unassign" type="checkbox" checked={unassignRemoved} onChange={e => setUnassignRemoved(e.target.checked)} style={{ marginTop: 3 }} />
              <span>{removed.length} document{removed.length !== 1 ? "s" : ""} removed: also take {removed.length !== 1 ? "them" : "it"} off these people's required reading (unless another bundle of theirs includes {removed.length !== 1 ? "them" : "it"}). Read confirmations are kept.</span>
            </label>
          )}
        </div>
      )}

      {err && <div role="alert" style={{ color: Z.red || "#f87171", fontWeight: 700, fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={save} disabled={busy} style={btn(Z, "primary")}>{busy ? "Saving…" : isNew ? "✓ Create bundle" : "✓ Save changes"}</button>
        <button onClick={onClose} style={{ ...btn(Z), marginLeft: "auto" }}>Cancel</button>
      </div>
    </Shell>
  );
}

// ── Assign a bundle to people ────────────────────────────────────────────────
function BundleAssign({ bundle, staff, docs, acks, onAssign, onClose, Z, font }) {
  const [mode, setMode] = useState("all");                    // all | team | individual
  const [manager, setManager] = useState("");
  const [picked, setPicked] = useState({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const managers = [...new Set(staff.map(u => u.manager || "").filter(Boolean))].sort();
  const has = u => bundle.memberIds.includes(S(u.id));
  const target = mode === "all" ? staff : mode === "team" ? staff.filter(u => manager && u.manager === manager) : staff.filter(u => picked[u.id]);
  const fresh = target.filter(u => !has(u));
  const list = staff.filter(u => !q || `${u.name} ${u.jobTitle || ""} ${u.manager || ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cell = { padding: "7px 8px", borderBottom: `1px solid ${Z.border}`, fontSize: 12.5 };
  const statusOf = u => { if (!has(u)) return "—"; const p = bundleProgress(bundle, u.id, acks, docs); return p.done ? "Has it · all read ✓" : `Has it · ${p.read} of ${p.total} read`; };

  async function assign() {
    if (!fresh.length) return;
    setBusy(true);
    const n = await onAssign(bundle, fresh.map(u => S(u.id)));
    setBusy(false); setDone(n); setPicked({});
  }
  return (
    <Shell title={`Assign bundle: ${bundle.name}`} onClose={onClose} Z={Z} font={font} wide>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: Z.muted, lineHeight: 1.6 }}>
        Everyone you choose gets all {bundle.docIds.length} document{bundle.docIds.length !== 1 ? "s" : ""} in this bundle as required reading. Documents they've already read stay confirmed.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {[["all", "All staff"], ["team", "A team"], ["individual", "Select staff"]].map(([v, l]) => (
          <button key={v} onClick={() => { setMode(v); setDone(null); }} style={{ ...btn(Z), ...(mode === v ? { background: "rgba(37,99,235,0.15)", color: Z.accentLt, border: `1px solid ${Z.accent}` } : {}) }}>{l}</button>
        ))}
      </div>
      {mode === "team" && (
        <select aria-label="Line manager" value={manager} onChange={e => { setManager(e.target.value); setDone(null); }} style={{ ...input(Z), marginBottom: 10 }}>
          <option value="">Select line manager…</option>
          {managers.map(m => <option key={m} value={m}>{m} ({staff.filter(u => u.manager === m).length} staff)</option>)}
        </select>
      )}
      {mode === "individual" && (
        <>
          <input aria-label="Search staff" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, job or manager" style={{ ...input(Z), padding: "8px 12px", fontSize: 13, marginBottom: 8 }} />
          <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${Z.border}`, borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["", "Name", "Job title", "Line manager", "This bundle"].map(h => <th key={h} style={{ ...cell, textAlign: "left", color: Z.muted, fontSize: 11, position: "sticky", top: 0, zIndex: 1, background: Z.navyMd }}>{h}</th>)}</tr></thead>
              <tbody>
                {list.map(u => (
                  <tr key={u.id} onClick={() => { if (!has(u)) { setPicked(p => ({ ...p, [u.id]: !p[u.id] })); setDone(null); } }} style={{ cursor: has(u) ? "default" : "pointer", opacity: has(u) ? .6 : 1, background: picked[u.id] ? "rgba(37,99,235,0.08)" : "transparent" }}>
                    <td style={{ ...cell, width: 30 }}><input type="checkbox" aria-label={u.name} disabled={has(u)} checked={has(u) || !!picked[u.id]} onChange={() => {}} /></td>
                    <td style={{ ...cell, fontWeight: 700 }}>{u.name}</td>
                    <td style={{ ...cell, color: Z.muted }}>{u.jobTitle || ""}</td>
                    <td style={{ ...cell, color: Z.muted }}>{u.manager || ""}</td>
                    <td style={{ ...cell, color: Z.muted }}>{statusOf(u)}</td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={5} style={{ ...cell, color: Z.muted }}>Nobody matches.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 10 }}>
        {fresh.length} {fresh.length !== 1 ? "people" : "person"} will be given this bundle{target.length > fresh.length ? ` (${target.length - fresh.length} already have it)` : ""}.
      </div>
      {done != null && (
        <div role="status" style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 13 }}>
          <b style={{ color: Z.green }}>✓ Bundle assigned to {done} {done !== 1 ? "people" : "person"}.</b> They'll see the documents under Required Reading.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={assign} disabled={busy || !fresh.length} style={{ ...btn(Z, "primary"), opacity: fresh.length ? 1 : .5, cursor: fresh.length ? "pointer" : "not-allowed" }}>
          {busy ? "Assigning…" : `Assign to ${fresh.length} ${fresh.length !== 1 ? "people" : "person"}`}
        </button>
        <button onClick={onClose} style={{ ...btn(Z), marginLeft: "auto" }}>Close</button>
      </div>
    </Shell>
  );
}

// ── The list of bundles ──────────────────────────────────────────────────────
function DocBundles({ bundles, docs, staff, allPeople, docAcknowledgements, onSave, onDelete, onAssign, onUnassign, Z, font, isMobile }) {
  const [editing, setEditing] = useState(null);     // bundle being edited, or a blank one
  const [assigning, setAssigning] = useState(null); // bundle id
  const [open, setOpen] = useState(null);           // bundle id with details shown
  const nameOf = uid => (allPeople.find(u => S(u.id) === S(uid)) || {}).name || `User ${uid}`;
  const docById = new Map(docs.map(d => [S(d.id), d]));
  const assigningBundle = bundles.find(b => b.id === assigning);

  async function remove(b) {
    if (!window.confirm(`Delete the bundle "${b.name}"?\n\nThe documents themselves are not deleted.`)) return;
    const unassign = b.memberIds.length > 0 && window.confirm(`Also take this bundle's documents off the required reading of the ${b.memberIds.length} ${b.memberIds.length !== 1 ? "people" : "person"} who have it?\n\nOK = take them off (except documents in another bundle they have)\nCancel = leave them as required reading\n\nRead confirmations are kept either way.`);
    await onDelete(b, { unassign });
    if (open === b.id) setOpen(null);
  }

  return (
    <div data-testid="doc-bundles">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <p style={{ margin: 0, color: Z.muted, fontSize: 13, flex: 1, minWidth: 240, lineHeight: 1.6 }}>
          Group documents into bundles, such as an induction pack or the documents for a job role, and assign the whole bundle as required reading in one go. Documents you add to a bundle later go to everyone who has it.
        </p>
        <button onClick={() => setEditing(cleanBundle({}))} style={btn(Z, "primary")}>{E("📚 ", "")}+ New bundle</button>
      </div>

      {!bundles.length && (
        <div style={{ textAlign: "center", padding: 36, color: Z.muted, fontSize: 14, border: `1px dashed ${Z.borderMd}`, borderRadius: 16 }}>
          No bundles yet. Click <b>+ New bundle</b> to create one.
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {bundles.map(b => {
          const bdocs = b.docIds.map(id => docById.get(id)).filter(Boolean);
          const members = b.memberIds.filter(id => allPeople.some(u => S(u.id) === id));
          const progress = members.map(uid => ({ uid, ...bundleProgress(b, uid, docAcknowledgements, docs) }));
          const allRead = progress.filter(p => p.done).length;
          const isOpen = open === b.id;
          return (
            <div key={b.id} data-bundle={b.name} style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 16, border: `1px solid ${Z.border}`, overflow: "hidden" }}>
              <div style={{ padding: "16px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 28 }}>{E("📚", "▤")}</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{b.name}</div>
                  {b.description && <div style={{ color: Z.muted, fontSize: 12.5, marginTop: 2 }}>{b.description}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <span style={chip(Z)}>{bdocs.length} document{bdocs.length !== 1 ? "s" : ""}</span>
                    <span style={chip(Z)}>{members.length} {members.length !== 1 ? "people" : "person"}</span>
                    {members.length > 0 && <span style={chip(Z, allRead === members.length ? "#10b981" : "#f59e0b")}>{allRead} of {members.length} read everything</span>}
                    {b.autoNew && <span style={chip(Z, "#60a5fa")}>Auto for new staff</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setAssigning(b.id)} style={btn(Z, "primary")}>{E("👥 ", "")}Assign</button>
                  <button onClick={() => setEditing(b)} style={btn(Z)}>Edit</button>
                  <button onClick={() => setOpen(isOpen ? null : b.id)} style={btn(Z)} aria-expanded={isOpen}>{isOpen ? "Hide details ▴" : "Details ▾"}</button>
                  <button onClick={() => remove(b)} style={btn(Z, "danger")}>Delete</button>
                </div>
              </div>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${Z.border}`, padding: "14px 18px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18 }}>
                  <div>
                    <div style={label(Z)}>Documents</div>
                    {bdocs.map(d => (
                      <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 13 }}>
                        <span>{EXT_ICONS[extOf(d)] || "📄"}</span><span style={{ flex: 1 }}>{d.title}</span>
                        <span style={{ fontSize: 11, color: Z.muted }}>v{d.version || 1}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ ...label(Z), flex: 1 }}>Who has it</div>
                      {members.length > 1 && (
                        <button onClick={() => { if (window.confirm(`Take "${b.name}" away from all ${members.length} people?\n\nIts documents come off their required reading (except documents in another bundle they have). Read confirmations are kept.`)) onUnassign(b, members); }}
                          style={{ ...btn(Z, "danger"), padding: "4px 10px", fontSize: 11 }}>Remove everyone</button>
                      )}
                    </div>
                    {!members.length && <div style={{ fontSize: 13, color: Z.muted }}>Not assigned to anyone yet.</div>}
                    {progress.sort((x, y) => nameOf(x.uid).localeCompare(nameOf(y.uid))).map(p => (
                      <div key={p.uid} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 13 }}>
                        <span style={{ flex: 1, fontWeight: 600 }}>{nameOf(p.uid)}</span>
                        <span style={chip(Z, p.done ? "#10b981" : "#f59e0b")}>{p.done ? "All read ✓" : `${p.read} of ${p.total} read`}</span>
                        <button aria-label={`Remove ${nameOf(p.uid)}`} title="Take this bundle away from this person"
                          onClick={() => { if (window.confirm(`Take "${b.name}" away from ${nameOf(p.uid)}?\n\nIts documents come off their required reading (except documents in another bundle they have). Read confirmations are kept.`)) onUnassign(b, [p.uid]); }}
                          style={{ ...btn(Z), padding: "3px 9px", fontSize: 11 }}>Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && <BundleEditor bundle={editing} bundles={bundles} docs={docs} onSave={onSave} onClose={() => setEditing(null)} Z={Z} font={font} />}
      {assigningBundle && <BundleAssign bundle={assigningBundle} staff={staff} docs={docs} acks={docAcknowledgements} onAssign={onAssign} onClose={() => setAssigning(null)} Z={Z} font={font} />}
    </div>
  );
}

/**
 * Staff side: a progress card for each bundle the person has been given. Shown
 * above Required Reading (desktop and phone).
 */
function MyBundles({ bundles, userId, docs, acks, Z, font, compact }) {
  if (!bundles.length) return null;
  return (
    <div data-testid="my-bundles" style={{ display: "grid", gap: 8, marginBottom: compact ? 18 : 22 }}>
      {bundles.map(b => {
        const p = bundleProgress(b, userId, acks, docs);
        if (!p.total) return null;
        const pct = Math.round((p.read / p.total) * 100);
        return (
          <div key={b.id} style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${p.done ? "rgba(16,185,129,0.35)" : Z.borderMd}`, borderRadius: 14, padding: compact ? "12px 14px" : "12px 18px", fontFamily: font }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{E("📚", "▤")}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: Z.white }}>{b.name}</div>
                {b.description && <div style={{ fontSize: 12, color: Z.muted, marginTop: 1 }}>{b.description}</div>}
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: p.done ? Z.green : Z.gold || "#f59e0b", whiteSpace: "nowrap" }}>{p.done ? "All read ✓" : `${p.read} of ${p.total} read`}</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: Z.overlay, marginTop: 9, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: p.done ? Z.green : Z.accent || "#2563eb" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { DocBundles, MyBundles };
