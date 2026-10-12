import React, { useState, useEffect, useRef } from "react";
import { ask, notify } from "../../shared/Feedback";
import { Avatar } from "../../shared/primitives";
import { HelpTip } from "../../shared/HelpTip";
import { useRemembered } from "../../lib/remembered";
import { useSort, sortRows, SortButton } from "../../shared/Sortable";
import { useFormGuard, DraftBanner } from "../../lib/unsaved";
import { auditEvent } from "../../lib/audit";
import { machineState, machineExpiryStatus, compsFor, MACHINE_STATE, CHOOSABLE_STATUS, MACHINERY_TYPES } from "../../data/seedMachinery";
import { buildMachineMatrix, exportMachineMatrixXlsx, machineOperators, SHOW_OPTIONS } from "./machineMatrix";
import { uploadMachineEvidence, removeMachineEvidence, evidenceFiles, checkMachineFiles, migrateMachineEvidence, hasLegacyFiles, MACHINE_EVIDENCE_ACCEPT } from "./machineEvidence";

import { todayISO } from "../../lib/dates";
/**
 * AdminMachineryTab — Machinery Competence for admins.
 *
 *   Matrix view (default)  warehouse operatives × machine types, one coloured cell per
 *                          record; click a cell to add or edit; filters; Excel export.
 *   By person              one operative's records as cards.
 *   Machine types          add / edit types (built-in ones can be changed too and reset).
 *
 * DATA: machineComps = { [userId]: { [recordId]: { id:"mc<ts>", machineId, status:
 *         competent|provisional|not_assessed (older records may say "expired"),
 *         trainerName, trainerQual, theoryDate, assessmentDate, observationDates:[date],
 *         licenceRef, licenceExpiry, notes, fileNames:[{name,type,url,path,at,by}] } } }
 *       → machine_completions (user_id, machine_id = the record id, data)
 * Status shown = machineState() (data/seedMachinery.js): expiry is the EARLIER of the
 * renewal date and the licence expiry date. Evidence files: machineEvidence.js.
 * Only warehouse workers appear (Staff → Edit → "Is Warehouse Worker?").
 */

// Moving old in-record files into storage happens once per page load (see machineEvidence.js).
let migration = null;           // null = not started; a Promise while running / once done

const fmt = d => { const [y, m, day] = String(d || "").slice(0, 10).split("-"); return y && m && day ? `${day}/${m}/${y}` : ""; };
const todayIso = () => todayISO();
const ICONS = ["🏗", "📦", "🔼", "🔀", "🛒", "🔋", "🌀", "➡", "🚪", "🚜", "🪜", "🔧", "⚙", "🧰", "🚛", "🏭", "✂", "🔥", "💧", "⚡"];
const blank = machineId => ({ machineId: machineId || "", status: "provisional", trainerName: "", trainerQual: "", theoryDate: "", assessmentDate: "", observationDates: [], licenceRef: "", licenceExpiry: "", notes: "", fileNames: [] });

// ─── shared bits ────────────────────────────────────────────────────────────
const inputStyle = Z => ({ width: "100%", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "9px 13px", color: Z.white, fontSize: 13, outline: "none", boxSizing: "border-box" });
const labelStyle = Z => ({ color: Z.muted, fontSize: 11, fontWeight: 700, letterSpacing: .5, display: "block", marginBottom: 5, textTransform: "uppercase" });
const btn = (Z, font, kind = "plain") => ({
  ...(kind === "primary" ? { background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none" }
    : kind === "danger" ? { background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }
    : { background: Z.overlay, color: Z.white, border: `1px solid ${Z.borderMd}` }),
  borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontFamily: font, fontSize: 13 });
const chipFor = st => ({ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: "2px 9px", borderRadius: 99, whiteSpace: "nowrap" });

function Section({ title, children, Z }) {
  return (
    <fieldset style={{ border: `1px solid ${Z.border}`, borderRadius: 12, padding: "12px 14px 14px", margin: "0 0 12px" }}>
      <legend style={{ padding: "0 6px", fontSize: 12, fontWeight: 800, color: Z.accentLt, letterSpacing: .5, textTransform: "uppercase" }}>{title}</legend>
      {children}
    </fieldset>
  );
}

function Modal({ title, onClose, children, Z, font, testid, wide }) {
  const box = useRef(null);
  useEffect(() => {        // move focus into the window when it opens, and back afterwards
    const before = document.activeElement;
    if (box.current) box.current.focus();
    return () => { if (before && before.focus) try { before.focus(); } catch { /* gone */ } };
  }, []);
  useEffect(() => {
    const k = e => {
      if (document.querySelector('[data-testid="ask"]')) return;
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key === "Tab" && box.current) {          // keep Tab inside the window
        const f = [...box.current.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === box.current)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} data-testid={testid} style={{ outline: "none",  background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: `1px solid ${Z.borderMd}`, borderRadius: 18, padding: 22, width: "100%", maxWidth: wide ? 900 : 720, maxHeight: "92vh", overflowY: "auto", fontFamily: font, color: Z.white }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, flex: 1 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: Z.overlay, color: Z.muted, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: font }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── the record form ──────────────────────────────────────────────────────────
function RecordEditor({ person, comp, machineId, types, takenIds, onSave, onDelete, onClose, Z, font }) {
  const isNew = !comp;
  const [form, setForm] = useState(() => {
    if (!comp) return blank(machineId);
    const f = { ...blank(), ...comp, observationDates: [...(comp.observationDates || [])], fileNames: [...(comp.fileNames || [])] };
    if (f.status === "expired") f.status = "competent";    // expiry is worked out now
    return f;
  });
  const [pending, setPending] = useState([]);       // File objects to upload on save
  const [removed, setRemoved] = useState([]);       // stored paths to delete on save
  const [newObs, setNewObs] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const guard = useFormGuard({ key: `machinery.${person.id}.${comp ? comp.id : `new.${machineId || "any"}`}`, label: "the machinery record you're editing", active: true,
    value: { ...form, fileNames: form.fileNames.map(f => (f && f.name) || f), pending: pending.map(f => f.name) },
    onRestore: v => { const { pending: _p, ...rest } = v; setForm(f => ({ ...f, ...rest, machineId: f.machineId || (takenIds.includes(rest.machineId) ? "" : rest.machineId), fileNames: f.fileNames })); } });
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErr(""); };
  const type = types.find(t => t.id === form.machineId);
  const preview = machineExpiryStatus({ ...form, status: "competent" }, types);
  const st = machineState(form, types);
  const inp = inputStyle(Z), lab = labelStyle(Z);
  const legacyExpired = comp && comp.status === "expired";

  async function close() {
    if (guard.dirty && !(await ask({ title: "Discard your changes?", message: "You've changed this record but not saved it.", ok: "Discard changes", cancel: "Keep editing", danger: true }))) return;
    guard.done(); onClose();
  }
  function addFiles(list) {
    const files = Array.from(list || []);
    const problem = checkMachineFiles(files);
    if (problem) { setErr(problem); return; }
    setPending(p => [...p, ...files]); setErr("");      // several files at once all kept
  }
  function addObs() {
    if (!newObs) return;
    if (form.observationDates.includes(newObs)) { setNewObs(""); return; }
    set("observationDates", [...form.observationDates, newObs].sort()); setNewObs("");
  }
  async function save() {
    if (!form.machineId) { setErr("Choose the machine first."); return; }
    if (form.licenceExpiry && form.assessmentDate && form.licenceExpiry < form.assessmentDate) { setErr("The licence expiry date is before the assessment date. Check the dates."); return; }
    setBusy(true);
    try {
      const id = comp ? comp.id : (form.newId || "mc" + Date.now());
      const uploaded = pending.length ? await uploadMachineEvidence(pending, person.id, id) : [];
      const fileNames = [...form.fileNames, ...uploaded];
      if (uploaded.length) { setForm(f => ({ ...f, newId: id, fileNames })); setPending([]); }   // a retry won't upload them again
      const { newId: _n, ...clean } = form;
      const rec = { ...clean, id, fileNames };
      await onSave(rec, isNew);                // throws if the database refused it
      if (removed.length) removeMachineEvidence(removed);
      guard.done(); onClose();
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  }

  return (
    <Modal title={`${isNew ? "Add" : "Edit"} competence — ${person.name}`} onClose={close} Z={Z} font={font} testid="machine-editor">
      <DraftBanner guard={guard} Z={Z} font={font} what="this record"/>

      <Section title="Machine and status" Z={Z}>
        {isNew ? (
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="mc-machine" style={lab}>Machine *</label>
            <select id="mc-machine" value={form.machineId} onChange={e => set("machineId", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">— Choose a machine —</option>
              {types.map(m => <option key={m.id} value={m.id} disabled={takenIds.includes(m.id)}>{m.icon} {m.label} ({m.category}){takenIds.includes(m.id) ? " — already has a record" : ""}</option>)}
            </select>
          </div>
        ) : <div style={{ marginBottom: 12, fontSize: 15, fontWeight: 800 }}>{type ? `${type.icon} ${type.label}` : form.machineId}</div>}
        <div style={lab} id="mc-status-l">Status *</div>
        <div role="radiogroup" aria-labelledby="mc-status-l" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CHOOSABLE_STATUS.map(k => {
            const s = MACHINE_STATE[k]; const on = form.status === k;
            return <button key={k} type="button" role="radio" aria-checked={on} data-status={k} onClick={() => set("status", k)}
              style={{ padding: "8px 16px", borderRadius: 10, border: `2px solid ${on ? s.color : Z.borderMd}`, background: on ? s.bg : Z.overlay, color: on ? s.color : Z.muted, cursor: "pointer", fontFamily: font, fontWeight: 700, fontSize: 13 }}>{s.sym} {s.label}</button>;
          })}
        </div>
        <div style={{ fontSize: 12, color: Z.muted, marginTop: 8, lineHeight: 1.5 }}>
          <b>Provisional</b>: training started, not yet signed off. <b>Competent</b>: assessed and signed off. Whether it has expired is worked out from the dates below.
          {legacyExpired && <span style={{ display: "block", color: "#fbbf24", marginTop: 4 }}>This record was marked "Renewal required" by hand. Check the dates: they now decide whether it has expired.</span>}
        </div>
        {form.machineId && <div style={{ marginTop: 10, fontSize: 13 }}>Shows as: <span style={chipFor(st)} data-testid="mc-shows-as">{st.sym} {st.label}</span></div>}
      </Section>

      <Section title="Training and assessment" Z={Z}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <div><label htmlFor="mc-tn" style={lab}>Trainer name</label><input id="mc-tn" value={form.trainerName} onChange={e => set("trainerName", e.target.value)} placeholder="e.g. Mark Davies" style={inp}/></div>
          <div><label htmlFor="mc-tq" style={lab}>Trainer qualification</label><input id="mc-tq" value={form.trainerQual} onChange={e => set("trainerQual", e.target.value)} placeholder="e.g. RTITB Instructor" style={inp}/></div>
          <div><label htmlFor="mc-td" style={lab}>Theory / induction date</label><input id="mc-td" type="date" value={form.theoryDate} onChange={e => set("theoryDate", e.target.value)} max={todayIso()} style={{ ...inp, colorScheme: "dark" }}/></div>
          <div><label htmlFor="mc-ad" style={lab}>Practical assessment date</label><input id="mc-ad" type="date" value={form.assessmentDate} onChange={e => set("assessmentDate", e.target.value)} max={todayIso()} style={{ ...inp, colorScheme: "dark" }}/></div>
        </div>
        {form.status === "competent" && !form.assessmentDate && <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 8 }}>Add the practical assessment date so the renewal date can be worked out.</div>}
      </Section>

      <Section title="Licence" Z={Z}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <div><label htmlFor="mc-lr" style={lab}>Licence / certificate reference</label><input id="mc-lr" value={form.licenceRef} onChange={e => set("licenceRef", e.target.value)} placeholder="e.g. RTITB-2025-001" style={inp}/></div>
          <div><label htmlFor="mc-le" style={lab}>Licence expiry date</label><input id="mc-le" type="date" value={form.licenceExpiry} onChange={e => set("licenceExpiry", e.target.value)} style={{ ...inp, colorScheme: "dark" }}/></div>
        </div>
        <div style={{ fontSize: 12.5, marginTop: 10, color: Z.muted }} data-testid="mc-renew-by">
          {preview
            ? <>Renew by <b style={{ color: preview.color }}>{fmt(preview.expiryDate)}</b>, the {preview.source === "licence" ? "licence expiry date" : `renewal date (assessment + ${type ? type.renewalMonths : "?"} months)`}{preview.source === "licence" && type && type.renewalMonths && form.assessmentDate ? ", which comes before the renewal date" : ""}.</>
            : type && !type.renewalMonths ? "This machine type has no renewal period. Add a licence expiry date if the licence runs out." : "Add the assessment date or licence expiry date to work out when this needs renewing."}
          {type && type.licenceRequired && !form.licenceRef && <span style={{ display: "block", color: "#fbbf24", marginTop: 4 }}>This machine needs a formal licence. Add its reference.</span>}
        </div>
      </Section>

      <Section title="Observations" Z={Z}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <label htmlFor="mc-obs" style={{ position: "absolute", left: -9999 }}>Observation date</label>
          <input id="mc-obs" type="date" value={newObs} onChange={e => setNewObs(e.target.value)} max={todayIso()} style={{ ...inp, flex: 1, colorScheme: "dark" }}/>
          <button type="button" onClick={addObs} disabled={!newObs} style={{ ...btn(Z, font, "primary"), opacity: newObs ? 1 : .5, flexShrink: 0 }}>+ Add observation</button>
        </div>
        {form.observationDates.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {form.observationDates.map((d, i) => (
              <span key={d + i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "rgba(37,99,235,0.12)", color: Z.accentLt, padding: "4px 6px 4px 10px", borderRadius: 8, fontWeight: 600 }}>
                {fmt(d)}
                <button type="button" aria-label={`Remove observation ${fmt(d)}`} onClick={() => set("observationDates", form.observationDates.filter((_, x) => x !== i))} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>
              </span>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: Z.muted }}>Supervised observations of the person operating the machine, by date.</div>}
      </Section>

      <Section title="Licence, certificate or assessment form" Z={Z}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }} data-testid="mc-files">
          {evidenceFiles(form).map((f, i) => (
            <span key={"s" + i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "rgba(16,185,129,0.1)", color: "#10b981", padding: "4px 6px 4px 10px", borderRadius: 8, fontWeight: 600 }}>
              {f.href ? <a href={f.href} target="_blank" rel="noreferrer" download={f.legacy ? f.name : undefined} style={{ color: "#10b981" }}>📎 {f.name}</a> : <>📎 {f.name}</>}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => { const x = form.fileNames[i]; if (x && x.path) setRemoved(r => [...r, x.path]); set("fileNames", form.fileNames.filter((_, j) => j !== i)); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>
            </span>
          ))}
          {pending.map((f, i) => (
            <span key={"p" + i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "rgba(59,130,246,0.12)", color: Z.accentLt, padding: "4px 6px 4px 10px", borderRadius: 8, fontWeight: 600 }}>
              ⬆ {f.name} <span style={{ fontWeight: 400, color: Z.muted }}>(uploads when you save)</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setPending(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>
            </span>
          ))}
        </div>
        <button type="button" onClick={() => fileRef.current && fileRef.current.click()} style={btn(Z, font)}>📎 Add files…</button>
        <input ref={fileRef} type="file" multiple accept={MACHINE_EVIDENCE_ACCEPT} data-testid="mc-file-input" onChange={e => { addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }}/>
        <span style={{ fontSize: 12, color: Z.muted, marginLeft: 10 }}>PDF, photo or Word document, up to 20 MB each. You can choose several at once.</span>
      </Section>

      <Section title="Notes / restrictions" Z={Z}>
        <label htmlFor="mc-notes" style={{ position: "absolute", left: -9999 }}>Notes or restrictions</label>
        <textarea id="mc-notes" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any restrictions or conditions, e.g. ground floor only, no double-stacking" rows={2} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}/>
      </Section>

      {err && <div role="alert" style={{ marginBottom: 12, padding: "9px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#f87171", fontSize: 13, fontWeight: 600 }}>{err}</div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={save} disabled={busy || !form.machineId} data-testid="mc-save" style={{ ...btn(Z, font, "primary"), padding: "11px 26px", opacity: busy || !form.machineId ? .5 : 1 }}>{busy ? "Saving…" : isNew ? "Save record" : "Save changes"}</button>
        <button type="button" onClick={close} style={btn(Z, font)}>Cancel</button>
        {!isNew && <button type="button" onClick={async () => { if (await onDelete()) { guard.done(); onClose(); } }} data-testid="mc-delete" style={{ ...btn(Z, font, "danger"), marginLeft: "auto" }}>Delete record…</button>}
      </div>
    </Modal>
  );
}

// ─── machine types ────────────────────────────────────────────────────────────
function TypeForm({ initial, categories, onSave, onCancel, Z, font }) {
  const [f, setF] = useState(() => ({ icon: "🔧", label: "", category: "", newCategory: "", licenceRequired: false, renewalMonths: 0, notes: "", ...(initial || {}) }));
  const inp = inputStyle(Z), lab = labelStyle(Z);
  const cat = (f.newCategory || "").trim() || f.category;
  const ok = f.label.trim() && cat;
  return (
    <div data-testid="type-form" style={{ border: `1px solid ${Z.accent}55`, borderRadius: 12, padding: 14, marginBottom: 14, background: Z.overlay }}>
      <div style={lab}>Icon</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }} role="radiogroup" aria-label="Icon">
        {[...new Set([f.icon, ...ICONS])].map(ic => (
          <button key={ic} type="button" role="radio" aria-checked={f.icon === ic} aria-label={`Icon ${ic}`} onClick={() => setF(p => ({ ...p, icon: ic }))}
            style={{ width: 38, height: 38, fontSize: 18, borderRadius: 9, cursor: "pointer", border: `2px solid ${f.icon === ic ? Z.accentLt : Z.borderMd}`, background: f.icon === ic ? "rgba(37,99,235,0.2)" : "transparent" }}>{ic}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 12 }}>
        <div><label htmlFor="mt-label" style={lab}>Machine name *</label><input id="mt-label" value={f.label} onChange={e => setF(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Mobile Crane" style={inp}/></div>
        <div><label htmlFor="mt-cat" style={lab}>Category *</label>
          <select id="mt-cat" value={f.newCategory ? "__new" : f.category} onChange={e => setF(p => ({ ...p, category: e.target.value === "__new" ? "" : e.target.value, newCategory: e.target.value === "__new" ? (p.newCategory || " ") : "" }))} style={{ ...inp, cursor: "pointer" }}>
            <option value="">— Choose —</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__new">+ New category…</option>
          </select>
        </div>
        {f.newCategory !== "" && <div><label htmlFor="mt-newcat" style={lab}>New category name</label><input id="mt-newcat" value={f.newCategory.trimStart()} onChange={e => setF(p => ({ ...p, newCategory: e.target.value || " " }))} style={inp}/></div>}
        <div><label htmlFor="mt-renew" style={lab}>Renew every (months, 0 = never)</label><input id="mt-renew" type="number" min="0" max="120" value={f.renewalMonths} onChange={e => setF(p => ({ ...p, renewalMonths: e.target.value }))} style={inp}/></div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 12, fontSize: 13 }}>
        <input type="checkbox" checked={!!f.licenceRequired} onChange={e => setF(p => ({ ...p, licenceRequired: e.target.checked }))}/> A formal licence is required (e.g. RTITB, IPAF)
      </label>
      <label htmlFor="mt-notes" style={lab}>Notes shown to operators</label>
      <textarea id="mt-notes" value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="e.g. Site-specific induction required before use." style={{ ...inp, resize: "vertical", marginBottom: 12 }}/>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={!ok} data-testid="type-save" onClick={() => onSave({ icon: f.icon, label: f.label.trim(), category: cat, licenceRequired: !!f.licenceRequired, renewalMonths: Math.max(0, Number(f.renewalMonths) || 0), notes: f.notes })} style={{ ...btn(Z, font, "primary"), opacity: ok ? 1 : .5 }}>Save machine type</button>
        <button type="button" onClick={onCancel} style={btn(Z, font)}>Cancel</button>
      </div>
    </div>
  );
}

function TypesPanel({ types, categories, customTypes, setCustomTypes, dbDelete, recordsUsing, onClose, Z, font }) {
  const [editing, setEditing] = useState(null);        // type id, or "new"
  const builtIn = id => MACHINERY_TYPES.some(t => t.id === id);
  const overridden = id => customTypes.some(t => t.id === id && t._override);
  function save(data) {
    if (editing === "new") {
      setCustomTypes(prev => [...prev, { id: "cm" + Date.now(), ...data, _custom: true }]);
      notify(`Added ${data.label}.`);
    } else if (builtIn(editing)) {
      setCustomTypes(prev => [...prev.filter(t => t.id !== editing), { ...MACHINERY_TYPES.find(t => t.id === editing), ...data, id: editing, _override: true }]);
      notify(`Saved ${data.label}.`);
    } else {
      setCustomTypes(prev => prev.map(t => t.id === editing ? { ...t, ...data } : t));
      notify(`Saved ${data.label}.`);
    }
    setEditing(null);
  }
  async function reset(t) {
    const std = MACHINERY_TYPES.find(x => x.id === t.id);
    if (!(await ask({ title: `Reset ${t.label}?`, message: `Put it back to the standard settings: "${std.label}", renew every ${std.renewalMonths || "—"} months.`, ok: "Reset" }))) return;
    setCustomTypes(prev => prev.filter(x => x.id !== t.id)); dbDelete(t.id);
  }
  async function remove(t) {
    const n = recordsUsing(t.id);
    if (n) { notify(`${t.label} can't be deleted: ${n} competence record${n !== 1 ? "s use" : " uses"} it. Delete those records first, or keep the machine type.`, { kind: "error", timeout: 9000 }); return; }
    if (!(await ask({ title: `Delete ${t.label}?`, danger: true, ok: "Delete machine type", message: "Nobody has a record for it." }))) return;
    setCustomTypes(prev => prev.filter(x => x.id !== t.id)); dbDelete(t.id);
    notify(`Deleted ${t.label}.`);
  }
  return (
    <Modal title="Machine types" onClose={onClose} Z={Z} font={font} testid="types-panel" wide>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: Z.muted }}>The machines you record competence for. Change a renewal period here and every record's renewal date updates.</p>
      {editing === "new" ? <TypeForm categories={categories} onSave={save} onCancel={() => setEditing(null)} Z={Z} font={font}/>
        : <button type="button" onClick={() => setEditing("new")} data-testid="type-add" style={{ ...btn(Z, font, "primary"), marginBottom: 14 }}>+ Add machine type</button>}
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: Z.muted, textTransform: "uppercase", marginBottom: 6 }}>{cat}</div>
          {types.filter(t => t.category === cat).map(t => editing === t.id
            ? <TypeForm key={t.id} initial={t} categories={categories} onSave={save} onCancel={() => setEditing(null)} Z={Z} font={font}/>
            : (
              <div key={t.id} data-testid="type-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: Z.overlay, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span style={{ flex: 1, minWidth: 180 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t.label}</span>
                  <span style={{ fontSize: 12, color: Z.muted, marginLeft: 8 }}>{t.renewalMonths ? `renew every ${t.renewalMonths} months` : "no renewal"}{t.licenceRequired ? " · licence required" : ""}</span>
                  {!builtIn(t.id) && <span style={{ fontSize: 10, fontWeight: 800, color: Z.gold, marginLeft: 8 }}>ADDED</span>}
                  {overridden(t.id) && <span style={{ fontSize: 10, fontWeight: 800, color: Z.gold, marginLeft: 8 }}>CHANGED</span>}
                </span>
                <span style={{ fontSize: 12, color: Z.muted }}>{recordsUsing(t.id)} record{recordsUsing(t.id) !== 1 ? "s" : ""}</span>
                <button type="button" onClick={() => setEditing(t.id)} aria-label={`Edit ${t.label}`} style={{ ...btn(Z, font), padding: "6px 12px", fontSize: 12 }}>Edit</button>
                {overridden(t.id) && <button type="button" onClick={() => reset(t)} style={{ ...btn(Z, font), padding: "6px 12px", fontSize: 12 }}>Reset</button>}
                {!builtIn(t.id) && <button type="button" onClick={() => remove(t)} aria-label={`Delete ${t.label}`} style={{ ...btn(Z, font, "danger"), padding: "6px 12px", fontSize: 12 }}>Delete</button>}
              </div>
            ))}
        </div>
      ))}
    </Modal>
  );
}

// ─── the screen ─────────────────────────────────────────────────────────────
function AdminMachineryTab({ allStaff, machineComps, setMachineComps, allMachineTypes, allMachineCategories, customMachineTypes, setCustomMachineTypes, dbDeleteCustomMachineType, dbSaveMachineComp, dbDeleteMachineComp, preset, clearPreset, onOpenStaff, Z, font }) {
  const types = allMachineTypes || [];
  const categories = allMachineCategories || [];
  const operators = machineOperators(allStaff);
  const [view, setView] = useRemembered("machinery.view", "matrix");
  const [search, setSearch] = useState("");
  const [manager, setManager] = useRemembered("machinery.manager", "");
  const [show, setShow] = useRemembered("machinery.show", "all");
  const [category, setCategory] = useRemembered("machinery.category", "");
  const [allTypes, setAllTypes] = useRemembered("machinery.allTypes", false);
  const [selectedUser, setSelectedUser] = useRemembered("machinery.person", operators[0] ? String(operators[0].id) : "");
  const [editor, setEditor] = useState(null);           // { uid, compId|null, machineId }
  const [typesOpen, setTypesOpen] = useState(false);
  const [sort, setSortBy] = useSort("machinery", { by: "name", dir: "asc" });
  const compsRef = useRef(machineComps);
  compsRef.current = machineComps;
  const [migrating, setMigrating] = useState(false);

  // dashboard figure → open filtered
  useEffect(() => {
    if (!preset) return;
    if (preset.show) { setShow(preset.show); setView("matrix"); setSearch(""); setManager(""); setCategory(""); }
    clearPreset && clearPreset();
  }, [preset]); // eslint-disable-line

  // one-off: move files kept inside records (older version) into private storage — once per page load
  useEffect(() => {
    if (migration) return;
    const any = Object.values(machineComps || {}).some(recs => Object.values(recs || {}).some(hasLegacyFiles));
    if (!any) return;
    setMigrating(true);
    migration = migrateMachineEvidence(machineComps, async (uid, id, fileNames) => {
      const cur = ((compsRef.current || {})[uid] || {})[id];
      if (!cur) return true;                                         // deleted meanwhile: nothing to save
      const merged = { ...cur, fileNames };
      setMachineComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [id]: merged } }));
      return dbSaveMachineComp ? await dbSaveMachineComp(uid, id, merged) : true;
    }).then(r => {
      if (r.moved) notify(`Moved ${r.moved} licence/certificate file${r.moved !== 1 ? "s" : ""} into secure file storage.`);
      if (r.failed) notify(`Files on ${r.failed} record${r.failed !== 1 ? "s" : ""} couldn't be moved into file storage. They still open; moving will be tried again next time the portal is opened.`, { kind: "error", timeout: 12000 });
      return r;
    }).finally(() => setMigrating(false));
  }, [machineComps]); // eslint-disable-line

  const label = (uid, comp) => { const u = allStaff.find(x => String(x.id) === String(uid)); const t = types.find(x => x.id === comp.machineId); return `${u ? u.name : uid} — ${t ? t.label : comp.machineId}`; };

  async function saveRecord(uid, rec, isNew) {
    const prev = ((compsRef.current || {})[uid] || {})[rec.id];
    setMachineComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [rec.id]: rec } }));
    const ok = dbSaveMachineComp ? await dbSaveMachineComp(uid, rec.id, rec) : true;
    if (ok === false) {                       // put the screen back as it was; the editor stays open
      setMachineComps(p => { const cur = { ...(p[uid] || {}) }; if (prev) cur[rec.id] = prev; else delete cur[rec.id]; return { ...p, [uid]: cur }; });
      throw new Error("The record couldn't be saved to the database. Check your connection and try again.");
    }
    const st = machineState(rec, types);
    auditEvent("machine_competence", `${uid}:${rec.id}`, isNew ? "create" : "update", `${isNew ? "Added" : "Updated"} machinery competence: ${st.label}${st.ex ? `, renew by ${fmt(st.ex.expiryDate)}` : ""}`, {}, label(uid, rec));
    notify(`${isNew ? "Added" : "Saved"} ${label(uid, rec)}.`);
  }
  async function deleteRecord(uid, comp) {
    if (!(await ask({ title: "Delete this competence record?", danger: true, ok: "Delete record",
      message: `${label(uid, comp)}\n\nThe record, its dates and observations are removed. You can undo this for a few seconds.` }))) return false;
    setMachineComps(p => { const cur = { ...(p[uid] || {}) }; delete cur[comp.id]; return { ...p, [uid]: cur }; });
    const ok = dbDeleteMachineComp ? await dbDeleteMachineComp(uid, comp.id) : true;
    if (ok === false) { setMachineComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [comp.id]: comp } })); return false; }
    auditEvent("machine_competence", `${uid}:${comp.id}`, "delete", "Deleted machinery competence record", {}, label(uid, comp));
    notify(`Deleted ${label(uid, comp)}.`, { undo: async () => {
      setMachineComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [comp.id]: comp } }));
      if (dbSaveMachineComp) await dbSaveMachineComp(uid, comp.id, comp);
      auditEvent("machine_competence", `${uid}:${comp.id}`, "restore", "Restored machinery competence record (Undo)", {}, label(uid, comp));
    } });
    return true;
  }
  const recordsUsing = typeId => Object.values(machineComps || {}).reduce((n, recs) => n + Object.values(recs || {}).filter(c => c && c.machineId === typeId).length, 0);
  const openEditor = (uid, comp, machineId) => {
    if (comp && migrating && hasLegacyFiles(comp)) { notify("This record's files are being moved into secure storage. Try again in a moment.", { kind: "error", timeout: 5000 }); return; }
    setEditor({ uid: String(uid), comp: comp || null, machineId: machineId || (comp && comp.machineId) || "" });
  };

  const managers = [...new Set(operators.map(u => u.manager).filter(Boolean))].sort();
  const matrix = buildMachineMatrix({ staff: allStaff, types, comps: machineComps, filter: { search, manager, show, allTypes, category } });
  const rows = sortRows(matrix.rows, sort, { name: r => r.user.name, attention: r => -(r.counts.expired * 100 + r.counts.expiring) || null });
  const filterText = [manager && `Line manager: ${manager}`, show !== "all" && SHOW_OPTIONS.find(o => o[0] === show)[1], category && `Category: ${category}`, search && `Search: "${search}"`].filter(Boolean).join(" · ");
  const T = matrix.totals;
  const sel = { ...inputStyle(Z), width: "auto", cursor: "pointer" };
  const editorPerson = editor && allStaff.find(u => String(u.id) === editor.uid);
  const editorComp = editor ? editor.comp : null;      // the record as it was when opened (stays put while deleting)

  const tile = (key, labelTxt, value, showKey) => {
    const on = show === showKey;
    const col = MACHINE_STATE[key] ? MACHINE_STATE[key].color : Z.white;
    return (
      <button key={labelTxt} type="button" data-testid={`mt-tile-${showKey}`} aria-pressed={on} onClick={() => { setShow(on ? "all" : showKey); setView("matrix"); }}
        style={{ textAlign: "left", background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${on ? col : Z.border}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer", fontFamily: font, minWidth: 130, flex: "1 1 130px" }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: value && key !== "people" ? col : Z.white }}>{value}</div>
        <div style={{ fontSize: 12, color: Z.muted, fontWeight: 600 }}>{labelTxt}</div>
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -.5, margin: "0 0 4px" }}>Machinery Competence <HelpTip dark={false} text="Who is assessed to operate each machine, and when each competence must be renewed. Click a cell in the matrix to add or edit a record."/></h2>
          <p style={{ color: Z.muted, margin: 0, fontSize: 13 }}>Who can operate what, and when it needs renewing</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div role="tablist" aria-label="View" style={{ display: "flex", border: `1px solid ${Z.borderMd}`, borderRadius: 10, overflow: "hidden" }}>
            {[["matrix", "Matrix"], ["person", "By person"]].map(([k, t]) => (
              <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} data-testid={`mt-view-${k}`}
                style={{ background: view === k ? "rgba(37,99,235,0.25)" : "transparent", color: view === k ? Z.white : Z.muted, border: "none", padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontFamily: font, fontSize: 13 }}>{t}</button>
            ))}
          </div>
          <button type="button" onClick={() => setTypesOpen(true)} data-testid="mt-types" style={btn(Z, font)}>⚙ Machine types</button>
        </div>
      </div>

      <div data-testid="mt-who" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", marginBottom: 14, fontSize: 13 }}>
        <span style={{ flex: 1, minWidth: 260, color: Z.white }}>
          Showing the <b>{operators.length}</b> {operators.length === 1 ? "person" : "people"} marked as warehouse or operational staff. {onOpenStaff ? <>To add someone, open their staff record and tick <b>Is Warehouse Worker?</b></> : <>To add someone, ask an admin to tick <b>Is Warehouse Worker?</b> on their staff record.</>}
        </span>
        {onOpenStaff && <button type="button" onClick={onOpenStaff} style={{ ...btn(Z, font), padding: "6px 12px", fontSize: 12 }}>Open Staff →</button>}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {tile("people", "Operators", T.operators, "all")}
        {tile("competent", "Competent", T.competent, "competent")}
        {tile("expiring", "Expiring within 60 days", T.expiring, "expiring")}
        {tile("expired", "Renewal required", T.expired, "expired")}
        {tile("provisional", "Provisional", T.provisional, "provisional")}
      </div>

      {view === "matrix" && (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, job title…" aria-label="Search" style={{ ...sel, minWidth: 190, cursor: "text" }}/>
            <select value={manager} onChange={e => setManager(e.target.value)} aria-label="Line manager" style={sel}>
              <option value="">All line managers</option>
              {managers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={show} onChange={e => setShow(e.target.value)} aria-label="Show" data-testid="mt-show" style={sel}>
              {SHOW_OPTIONS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
            <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category" style={sel}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: Z.white, cursor: "pointer" }}>
              <input type="checkbox" checked={!!allTypes} onChange={e => setAllTypes(e.target.checked)}/> All machine types
            </label>
            <button type="button" onClick={() => exportMachineMatrixXlsx({ ...matrix, rows }, { filterText })} disabled={!rows.length} data-testid="mt-export"
              style={{ marginLeft: "auto", background: "linear-gradient(135deg,#107c41,#0b5e30)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 800, cursor: rows.length ? "pointer" : "not-allowed", fontFamily: font, fontSize: 13, opacity: rows.length ? 1 : .5 }}>Export to Excel</button>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10, fontSize: 11.5, color: Z.muted }}>
            {Object.values(MACHINE_STATE).map(s => (
              <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 18, borderRadius: 4, fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.color}66` }}>{s.sym}</span>{s.label}
              </span>
            ))}
            <span>· Click a cell to add or edit. Dates are when it must be renewed.</span>
          </div>
          {!rows.length ? (
            <div style={{ padding: 40, textAlign: "center", color: Z.muted, background: Z.overlay, borderRadius: 12 }}>
              {operators.length ? "Nobody matches these filters." : "Nobody is marked as warehouse or operational staff yet."}
            </div>
          ) : !matrix.cols.length ? (
            <div style={{ padding: 40, textAlign: "center", color: Z.muted, background: Z.overlay, borderRadius: 12 }}>No records yet. Tick <b>All machine types</b> to show every machine, then click a cell to add one.</div>
          ) : (
            <div style={{ overflow: "auto", maxHeight: "70vh", border: `1px solid ${Z.borderMd}`, borderRadius: 12, background: Z.navy }} data-testid="machine-matrix">
              <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 12, fontFamily: font }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", top: 0, left: 0, zIndex: 3, background: Z.navyMd, minWidth: 200, textAlign: "left", padding: "8px 10px", color: Z.white, borderBottom: `1px solid ${Z.borderMd}`, verticalAlign: "bottom" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <SortButton label="Operator" by="name" sort={sort} onSort={setSortBy} Z={Z} font={font}/>
                        <SortButton label="Needs attention" by="attention" sort={sort} onSort={setSortBy} Z={Z} font={font} style={{ fontSize: 11, fontWeight: 600 }}/>
                      </div>
                    </th>
                    {matrix.cols.map(t => (
                      <th key={t.id} title={`${t.label} — ${t.category}${t.renewalMonths ? ` · renew every ${t.renewalMonths} months` : ""}${t.licenceRequired ? " · licence required" : ""}`}
                        style={{ position: "sticky", top: 0, zIndex: 2, background: Z.navyMd, width: 64, minWidth: 64, height: 170, padding: "6px 2px", borderBottom: `1px solid ${Z.borderMd}`, verticalAlign: "bottom" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", maxHeight: 140, lineHeight: 1.15, fontSize: 11, fontWeight: 700, color: Z.white, textAlign: "left" }}>{t.label}</div>
                          <span aria-hidden="true" style={{ fontSize: 15 }}>{t.icon}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.user.id}>
                      <td style={{ position: "sticky", left: 0, zIndex: 1, background: Z.navyMd, padding: "6px 10px", borderBottom: `1px solid ${Z.border}`, whiteSpace: "nowrap" }}>
                        <button type="button" onClick={() => { setSelectedUser(String(r.user.id)); setView("person"); }} title="Open this person's records"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: font, color: Z.white }}>
                          <div style={{ fontWeight: 700 }}>{r.user.name}</div>
                          <div style={{ fontSize: 10, color: Z.muted }}>{[r.user.jobTitle, r.user.manager && `Mgr: ${r.user.manager}`].filter(Boolean).join(" · ")}</div>
                        </button>
                      </td>
                      {r.cells.map((c, ci) => {
                        const t = matrix.cols[ci];
                        const tip = c.st ? `${r.user.name} — ${t.label}: ${c.st.label}${c.st.ex ? `, ${c.st.ex.status === "expired" ? "expired" : "renew by"} ${fmt(c.st.ex.expiryDate)} (${c.st.ex.why})` : ""}. Edit.` : `${r.user.name} — ${t.label}: no record. Add one.`;
                        return (
                          <td key={t.id} style={{ padding: 2, borderBottom: `1px solid ${Z.border}` }} data-state={c.st ? c.st.key : "none"}>
                            <button type="button" aria-label={tip} title={tip} data-testid="mt-cell" onClick={() => openEditor(r.user.id, c.comp, t.id)}
                              style={{ width: "100%", height: 30, borderRadius: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: font, padding: 0, lineHeight: 1.05,
                                border: c.st ? `1px solid ${c.st.color}66` : `1px dashed ${Z.border}`, background: c.st ? c.st.bg : "transparent", color: c.st ? c.st.color : Z.muted }}>
                              {c.st ? <>
                                <span style={{ fontSize: 13, fontWeight: 900 }}>{c.st.sym}</span>
                                {c.st.ex && c.st.key !== "provisional" && c.st.key !== "not_assessed" && <span style={{ fontSize: 9, fontWeight: 700 }}>{fmt(c.st.ex.expiryDate).slice(0, 6) + fmt(c.st.ex.expiryDate).slice(8)}</span>}
                              </> : <span aria-hidden="true" style={{ opacity: .45 }}>+</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "person" && (() => {
        const user = operators.find(u => String(u.id) === String(selectedUser)) || operators[0];
        if (!user) return <div style={{ padding: 40, textAlign: "center", color: Z.muted, background: Z.overlay, borderRadius: 12 }}>Nobody is marked as warehouse or operational staff yet.</div>;
        const mine = compsFor(machineComps, user.id);
        const sts = mine.map(c => machineState(c, types));
        const n = k => sts.filter(s => s.key === k).length;
        return (
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <label htmlFor="mt-person" style={{ fontSize: 12, fontWeight: 700, color: Z.muted }}>OPERATOR</label>
              <select id="mt-person" value={String(user.id)} onChange={e => setSelectedUser(e.target.value)} style={{ ...sel, minWidth: 260 }}>
                {operators.slice().sort((a, b) => a.name.localeCompare(b.name)).map(u => {
                  const bad = compsFor(machineComps, u.id).some(c => machineState(c, types).key === "expired");
                  return <option key={u.id} value={String(u.id)}>{u.name}{u.jobTitle ? ` — ${u.jobTitle}` : ""}{bad ? " (renewal required)" : ""}</option>;
                })}
              </select>
            </div>
            <div style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 14, padding: "14px 18px", marginBottom: 14, border: `1px solid ${Z.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Avatar name={user.name} size={40}/>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: Z.white }}>{user.name}</div>
                <div style={{ fontSize: 12, color: Z.muted, marginTop: 2 }}>{user.jobTitle} · Manager: {user.manager || "—"}</div>
              </div>
              {["competent", "expiring", "expired", "provisional"].filter(k => n(k)).map(k => <span key={k} style={chipFor(MACHINE_STATE[k])}>{n(k)} {MACHINE_STATE[k].label.toLowerCase()}</span>)}
            </div>
            {categories.map(cat => {
              const catTypes = types.filter(m => m.category === cat);
              const held = catTypes.map(t => ({ t, c: mine.find(c => c.machineId === t.id) })).filter(x => x.c);
              const free = catTypes.filter(t => !mine.some(c => c.machineId === t.id));
              return (
                <div key={cat} style={{ marginBottom: 18 }}>
                  <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: Z.muted, textTransform: "uppercase", margin: "0 0 8px" }}>{cat}</h3>
                  {held.map(({ t, c }) => {
                    const st = machineState(c, types);
                    const files = evidenceFiles(c);
                    return (
                      <div key={c.id} data-testid="mt-card" style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 13, border: `1px solid ${st.color}44`, marginBottom: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 22 }}>{t.icon}</span>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: Z.white }}>{t.label}</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, color: Z.muted }}>
                            <span style={chipFor(st)}>{st.sym} {st.label}</span>
                            {st.ex && <span style={{ color: st.ex.status === "valid" ? Z.muted : st.ex.color, fontWeight: 700 }}>{st.ex.status === "expired" ? "Expired" : "Renew by"} {fmt(st.ex.expiryDate)} ({st.ex.why})</span>}
                            {c.assessmentDate && <span>Assessed {fmt(c.assessmentDate)}</span>}
                            {c.licenceRef && <span style={{ fontFamily: "monospace", color: Z.gold }}>{c.licenceRef}</span>}
                            {(c.observationDates || []).length > 0 && <span>{c.observationDates.length} observation{c.observationDates.length !== 1 ? "s" : ""}</span>}
                            {files.map((f, i) => f.href ? <a key={i} href={f.href} target="_blank" rel="noreferrer" download={f.legacy ? f.name : undefined} style={{ color: Z.accentLt, fontWeight: 700 }}>📎 {f.name}</a> : <span key={i}>📎 {f.name}</span>)}
                          </div>
                        </div>
                        <button type="button" onClick={() => openEditor(user.id, c)} aria-label={`Edit ${t.label}`} style={{ ...btn(Z, font), padding: "6px 14px", fontSize: 12 }}>Edit</button>
                        <button type="button" onClick={() => deleteRecord(String(user.id), c)} aria-label={`Delete ${t.label} record`} data-testid="mt-card-delete" style={{ ...btn(Z, font, "danger"), padding: "6px 12px", fontSize: 12 }}>Delete</button>
                      </div>
                    );
                  })}
                  {free.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {free.map(t => (
                        <button key={t.id} type="button" onClick={() => openEditor(user.id, null, t.id)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: `1px dashed ${Z.borderMd}`, borderRadius: 10, background: Z.overlay, color: Z.muted, cursor: "pointer", fontFamily: font, fontSize: 12 }}>
                          <span>{t.icon}</span>+ {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {editor && editorPerson && (
        <RecordEditor key={`${editor.uid}.${editor.comp ? editor.comp.id : "new"}.${editor.machineId}`} person={editorPerson} comp={editorComp} machineId={editor.machineId} types={types}
          takenIds={compsFor(machineComps, editor.uid).map(c => c.machineId)}
          onSave={(rec, isNew) => saveRecord(editor.uid, rec, isNew)}
          onDelete={() => deleteRecord(editor.uid, editorComp)}
          onClose={() => setEditor(null)} Z={Z} font={font}/>
      )}
      {typesOpen && (
        <TypesPanel types={types} categories={categories} customTypes={customMachineTypes || []} setCustomTypes={setCustomMachineTypes}
          dbDelete={dbDeleteCustomMachineType} recordsUsing={recordsUsing} onClose={() => setTypesOpen(false)} Z={Z} font={font}/>
      )}
    </div>
  );
}

export { AdminMachineryTab };
