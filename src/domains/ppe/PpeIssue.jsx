/**
 * PpeIssueModal — issue PPE to one person (admins: anyone; line managers: their team).
 * Made for a tablet at the stores or the office: choose the person, add the items (the size
 * they had last time is filled in), then they read the statement and sign on the screen.
 * "Save without signature" records the issue and they sign later in the phone app (More →
 * My PPE) or on the portal. Replacing an item they still hold closes the old one (replaced).
 */
import React from "react";
import { PPE_REASONS, newPpeIssue, replacePpe, lastSizes } from "../../lib/ppe";
import { savePpeIssue } from "../../lib/ppeClient";
import { auditEvent } from "../../lib/audit";
import { notify } from "../../shared/Feedback";
import { SignaturePad } from "../../shared/SignaturePad";
import { Modal, btn, small, field, lbl, ukd } from "./ppeUi";

let lineSeq = 0;
const blankLine = (patch = {}) => ({ key: ++lineSeq, itemId: "", size: "", qty: 1, reason: "new", ...patch });

export function PpeIssueModal({ me, people, rows, settings, preset = {}, onClose, onSaved, Z, font }) {
  const items = settings.items;
  const [personId, setPersonId] = React.useState(preset.personId ? String(preset.personId) : "");
  const [search, setSearch] = React.useState("");
  const person = people.find(p => String(p.id) === personId) || null;
  const sizes = React.useMemo(() => (person ? lastSizes(rows, person.id) : {}), [person, rows]);
  const held = React.useMemo(() => rows.filter(r => person && String(r.user_id) === String(person.id) && r.status === "issued"), [person, rows]);
  const [lines, setLines] = React.useState(() => {
    if (preset.replace) { const d = preset.replace.data || {}; return [blankLine({ itemId: d.itemId, size: d.size, qty: d.qty || 1, reason: preset.reason || "worn", replaces: preset.replace.id })]; }
    if (preset.itemIds) return preset.itemIds.map(id => blankLine({ itemId: id }));
    return [blankLine()];
  });
  const [note, setNote] = React.useState("");
  const [sig, setSig] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  // when the person changes, fill in their last sizes for lines with none chosen
  React.useEffect(() => { setLines(ls => ls.map(l => (l.itemId && !l.size && sizes[l.itemId] ? { ...l, size: sizes[l.itemId] } : l))); }, [sizes]);

  const setLine = (key, patch) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l;
    const n = { ...l, ...patch };
    if (patch.itemId !== undefined) { const it = items.find(x => x.id === patch.itemId); n.size = sizes[patch.itemId] || (it && it.sizes.length === 1 ? it.sizes[0] : ""); n.replaces = undefined; }
    return n;
  }));
  // the issue a line replaces: chosen when replacing from the record, else the newest one they hold of that item
  const replaces = l => {
    if (l.reason === "new") return null;
    if (l.replaces) return held.find(r => r.id === l.replaces) || null;
    return held.filter(r => (r.data || {}).itemId === l.itemId).sort((a, b) => String(b.data.issuedAt).localeCompare(String(a.data.issuedAt)))[0] || null;
  };
  const ready = person && lines.length && lines.every(l => l.itemId && l.size);
  const filtered = people.filter(p => !search.trim() || `${p.name} ${p.department || ""} ${p.jobTitle || ""}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function save(withSignature) {
    if (!ready) { setErr(!person ? "Choose who you're issuing it to." : "Choose an item and size on every line."); return; }
    if (withSignature && !sig) { setErr(`${person.name.split(" ")[0]} needs to sign in the box first.`); return; }
    setBusy(true); setErr("");
    const now = new Date().toISOString();
    let done = 0;
    for (const l of lines) {
      const it = items.find(x => x.id === l.itemId);
      let row = newPpeIssue({ person, item: it, size: l.size, qty: l.qty, reason: l.reason, note, by: me.name, signature: withSignature ? sig : null, signedVia: "in person", statement: settings.statement, now });
      const old = replaces(l);
      if (old) {
        const [o2, n2] = replacePpe(old, row, { by: me.name });
        const e1 = await savePpeIssue(n2, { isNew: true });
        if (e1) { setErr(`${it.name} didn't save: ${e1}`); break; }
        const e2 = await savePpeIssue(o2);
        if (e2) { setErr(`${it.name} was issued, but the old one couldn't be marked as replaced: ${e2}`); }
        row = n2;
      } else {
        const e = await savePpeIssue(row, { isNew: true });
        if (e) { setErr(`${it.name} didn't save: ${e}`); break; }
      }
      done++;
      auditEvent("ppe", row.id, "create", `PPE issued: ${it.name} (${l.size}${l.qty > 1 ? ` × ${l.qty}` : ""})${old ? ", replacing one issued " + ukd(old.data.issuedOn) : ""}${withSignature ? ", signed for" : ", not signed yet"}`, {}, person.name);
    }
    setBusy(false);
    if (done === lines.length) {
      notify(withSignature ? `Saved. ${person.name} has signed for ${done} item${done === 1 ? "" : "s"}.` : `Saved. ${person.name} can sign for it in the phone app (More → My PPE) or on the portal.`);
      onSaved && onSaved(person); onClose();
    }
  }

  const F = field(Z, font);
  return (
    <Modal title="Issue PPE" onClose={onClose} width={1080} testid="ppe-issue" Z={Z} font={font}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 440px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl(Z)} htmlFor="ppe-person">Person</label>
            {!preset.personId && <input aria-label="Search staff" placeholder="Type to search staff" value={search} onChange={e => setSearch(e.target.value)} data-testid="ppe-person-search" style={{ ...F, width: "100%", marginBottom: 8 }}/>}
            <select id="ppe-person" value={personId} onChange={e => { setPersonId(e.target.value); setSig(null); }} disabled={!!preset.personId} data-testid="ppe-person" style={{ ...F, width: "100%", fontSize: 16, minHeight: 48 }}>
              <option value="">Choose…</option>
              {filtered.map(p => <option key={p.id} value={String(p.id)}>{p.name}{p.department ? ` · ${p.department}` : ""}</option>)}
            </select>
          </div>
          <span style={{ ...lbl(Z), margin: 0 }}>Items</span>
          {lines.map((l, i) => {
            const it = items.find(x => x.id === l.itemId); const old = person && l.itemId ? replaces(l) : null;
            const holding = person && l.itemId && l.reason === "new" ? held.find(r => (r.data || {}).itemId === l.itemId) : null;
            return (
              <div key={l.key} data-testid="ppe-line" style={{ background: Z.navyMd, border: `1px solid ${Z.border}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select aria-label={`Item ${i + 1}`} value={l.itemId} onChange={e => setLine(l.key, { itemId: e.target.value })} data-testid="ppe-line-item" style={{ ...F, flex: "1 1 220px", minHeight: 46, fontSize: 15 }}>
                    <option value="">Choose an item…</option>
                    {items.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <select aria-label={`Size, item ${i + 1}`} value={l.size} onChange={e => setLine(l.key, { size: e.target.value })} disabled={!it} data-testid="ppe-line-size" style={{ ...F, flex: "0 1 130px", minHeight: 46, fontSize: 15 }}>
                    <option value="">Size…</option>
                    {(it ? it.sizes : []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select aria-label={`Quantity, item ${i + 1}`} value={l.qty} onChange={e => setLine(l.key, { qty: Number(e.target.value) })} data-testid="ppe-line-qty" style={{ ...F, flex: "0 0 86px", minHeight: 46, fontSize: 15 }}>
                    {Array.from({ length: 12 }, (_, n) => n + 1).map(n => <option key={n} value={n}>× {n}</option>)}
                  </select>
                </div>
                {(it || lines.length > 1) && <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <div style={{ flex: 1, fontSize: 12.5, color: Z.muted }}>{it ? `${[it.standard, it.life ? `replace every ${it.life} month${it.life === 1 ? "" : "s"}` : "no fixed replacement date"].filter(Boolean).join(" · ")}${sizes[l.itemId] ? ` · last issued in ${sizes[l.itemId]}` : ""}` : ""}</div>
                  {lines.length > 1 && <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} style={{ background: "none", border: "none", color: Z.muted, fontFamily: font, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "4px 2px", minHeight: 32 }}>Remove</button>}
                </div>}
                <div role="radiogroup" aria-label={`Reason, item ${i + 1}`} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PPE_REASONS.map(r => (
                    <button key={r.id} type="button" role="radio" aria-checked={l.reason === r.id} onClick={() => setLine(l.key, { reason: r.id })} data-testid={`ppe-reason-${r.id}`}
                      style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: Z.white, cursor: "pointer", minHeight: 38, borderRadius: 20, padding: "7px 13px", background: l.reason === r.id ? `${Z.accent}40` : Z.overlay, border: `1px solid ${l.reason === r.id ? Z.accent : Z.borderMd}` }}>{r.label}</button>
                  ))}
                </div>
                {old && <div style={{ fontSize: 12.5, color: "#fbbf24" }}>Replaces the one issued {ukd(old.data.issuedOn)} ({old.data.size}). That one will be marked as replaced.</div>}
                {holding && <div style={{ fontSize: 12.5, color: Z.muted }}>{person.name.split(" ")[0]} already has one, issued {ukd(holding.data.issuedOn)}. To swap it, choose a "Replacing…" reason.</div>}
              </div>
            );
          })}
          <button type="button" onClick={() => setLines(ls => [...ls, blankLine()])} data-testid="ppe-add-line"
            style={{ minHeight: 46, fontFamily: font, fontSize: 14, fontWeight: 700, color: Z.accentLt, background: "transparent", border: `1px dashed ${Z.accentLt}88`, borderRadius: 12, cursor: "pointer" }}>+ Add another item</button>
          <div>
            <label style={lbl(Z)} htmlFor="ppe-note">Note (optional)</label>
            <input id="ppe-note" value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="e.g. trial of a new glove" style={{ ...F, width: "100%" }}/>
          </div>
        </div>

        <div style={{ flex: "1 1 400px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: Z.navyMd, border: `1px solid ${Z.border}`, borderRadius: 14, padding: 16, fontSize: 14.5, lineHeight: 1.55 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{person ? `${person.name.split(" ")[0]}, please read and sign` : "Please read and sign"}</div>
            {settings.statement}
          </div>
          {person ? <SignaturePad Z={Z} key={personId} onChange={setSig} height={220} typedName={person.name} font={font} testid="ppe-sig"/>
            : <div style={{ height: 250, borderRadius: 14, border: `1px dashed ${Z.borderMd}`, display: "flex", alignItems: "center", justifyContent: "center", color: Z.muted, fontSize: 14 }}>Choose the person first</div>}
          {err && <div role="alert" style={{ color: "#f87171", fontWeight: 700, fontSize: 13.5 }}>{err}</div>}
          <button type="button" onClick={() => save(true)} disabled={busy} data-testid="ppe-issue-sign" style={{ ...btn(Z, font, "green"), minHeight: 58, fontSize: 17, opacity: busy ? .6 : 1 }}>{busy ? "Saving…" : "Confirm issue and signature"}</button>
          <button type="button" onClick={() => save(false)} disabled={busy} data-testid="ppe-issue-nosign" style={{ background: "none", border: "none", color: Z.muted, fontFamily: font, fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>Save without a signature (they sign later on their phone)</button>
        </div>
      </div>
    </Modal>
  );
}
