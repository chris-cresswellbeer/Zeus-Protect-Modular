/**
 * ChecklistManager — Site Inspections → 📋 Checklists (admins).
 * The built-in checklists (read only: copy one to change it) and this site's own
 * (inspection_templates table; e.g. the BRCGS internal audits): add, copy, edit, hide,
 * delete. A checklist that saved inspections use can't be deleted, only hidden, so old
 * records keep their wording.
 *
 * Ids: sections and questions keep their ids when edited (answers are stored by id), and
 * new ones get new ids. Removing a question from a checklist already used asks first:
 * saved inspections keep their answers but the question no longer shows.
 */
import React, { useState } from "react";
import { sb } from "../../lib/supabase";
import { notify, ask } from "../../shared/Feedback";
import { auditEvent } from "../../lib/audit";
import { useFormGuard, DraftBanner } from "../../lib/unsaved";
import { INSP_TYPES, INSP_SECTIONS } from "../../data/seedInspections";
import { useInspTemplates, loadInspTemplates } from "../../lib/inspTemplates";

const ICONS = ["📋", "📑", "🔍", "🏭", "🏢", "🚚", "🧯", "⚠️", "🧹", "🔧", "🦺", "🧪"];
const uid = p => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const count = t => (t.sections || []).reduce((n, s) => n + (s.questions || []).length, 0);

/** A built-in or site checklist as an editable copy. */
function toDraft(t, { copy = false } = {}) {
  const sections = (t.sections || INSP_SECTIONS[t.id] || []).map(s => ({
    id: s.id, label: s.label || "", group: s.group || "", intro: s.intro || "",
    questions: (s.questions || []).map(q => ({ id: q.id, ref: q.ref || "", tag: q.tag || "", text: q.text || "" })),
  }));
  const m = String(t.freq || "").match(/(\d+)\s*month/i);
  return {
    id: copy ? uid("tpl_") : t.id, isNew: copy,
    label: copy ? `Copy of ${t.label}` : t.label, description: t.description || "", icon: t.icon || "📋",
    group: t.custom ? (t.group || "") : "", freqMonths: t.freqMonths || (m ? Number(m[1]) : 12),
    introLabel: t.custom ? (t.introLabel || "") : "", allowSkip: t.custom ? t.allowSkip !== false : true,
    source: t.source || "", hidden: !!t.hidden, sections,
  };
}

export function ChecklistManager({ inspections, onClose, Z, font }) {
  const site = useInspTemplates();
  const [draft, setDraft] = useState(null);
  const [orig, setOrig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openSec, setOpenSec] = useState({});
  const guard = useFormGuard({ key: "insp-template", label: "your checklist changes", active: !!draft, value: draft, onRestore: v => setDraft(v) });
  const usedBy = id => (inspections || []).filter(i => i.type === id).length;

  const card = { background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.border}`, borderRadius: 14, padding: "14px 16px" };
  const btn = (primary, extra = {}) => ({ background: primary ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay, color: primary ? "#fff" : Z.white, border: primary ? "none" : `1px solid ${Z.borderMd}`, borderRadius: 9, padding: "7px 13px", fontWeight: 700, cursor: "pointer", fontFamily: font, fontSize: 12.5, minHeight: 36, ...extra });
  const inp = { width: "100%", boxSizing: "border-box", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 9, padding: "8px 11px", color: Z.white, fontSize: 13, fontFamily: font, outline: "none" };
  const lbl = { display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: .5, color: Z.muted, textTransform: "uppercase", margin: "10px 0 4px" };

  async function persist(id, data, hidden, what) {
    const r = await sb.from("inspection_templates").upsert({ id, data, hidden: !!hidden, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (r && r.error) throw new Error(r.error.message || String(r.error));
    await loadInspTemplates({ fresh: true });
    auditEvent("inspection_template", id, what, `Checklist ${what === "create" ? "added" : "saved"}: ${data.label}`, {}, data.label);
  }
  async function setHidden(t, hidden) {
    try { await persist(t.id, toData(toDraft(t)), hidden, "update"); notify(hidden ? `"${t.label}" is hidden: it's no longer offered for new inspections.` : `"${t.label}" is offered again.`); }
    catch (e) { notify(`The checklist couldn't be changed. ${e.message}`, { kind: "error" }); }
  }
  async function remove(t) {
    if (usedBy(t.id)) { notify(`${usedBy(t.id)} saved inspection(s) use "${t.label}", so it can't be deleted. Hide it instead.`, { kind: "error" }); return; }
    if (!(await ask({ title: `Delete "${t.label}"?`, message: "It hasn't been used for any inspection. This can't be undone.", ok: "Delete checklist", danger: true }))) return;
    const r = await sb.from("inspection_templates").delete().eq("id", t.id);
    if (r && r.error) { notify(`The checklist couldn't be deleted. ${r.error.message || ""}`, { kind: "error" }); return; }
    await loadInspTemplates({ fresh: true });
    auditEvent("inspection_template", t.id, "delete", `Checklist deleted: ${t.label}`, {}, t.label);
    notify(`"${t.label}" deleted.`);
  }
  const open = (t, copy, blank) => { const d = toDraft(t, { copy }); if (blank) d.label = ""; setDraft(d); setOrig(copy ? null : d); setOpenSec({}); window.scrollTo({ top: 0 }); };

  function toData(d) {
    return {
      label: d.label.trim(), description: d.description.trim(), icon: d.icon, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",
      freqMonths: Number(d.freqMonths) > 0 ? Math.min(60, Math.round(Number(d.freqMonths))) : 0, freq: Number(d.freqMonths) > 0 ? `${Math.round(Number(d.freqMonths))} months` : "",
      introLabel: d.introLabel.trim(), allowSkip: !!d.allowSkip, group: d.group.trim(), ...(d.source ? { source: d.source } : {}),
      sections: d.sections.map(s => ({ id: s.id, label: s.label.trim(), ...(s.group.trim() ? { group: s.group.trim() } : {}), ...(s.intro.trim() ? { intro: s.intro.trim() } : {}),
        questions: s.questions.filter(q => q.text.trim()).map(q => ({ id: q.id, ...(q.ref.trim() ? { ref: q.ref.trim() } : {}), ...(q.tag ? { tag: q.tag } : {}), text: q.text.trim() })) })),
    };
  }
  async function save() {
    const d = draft;
    if (!d.label.trim()) { notify("Give the checklist a name.", { kind: "error" }); return; }
    const data = toData(d);
    if (data.sections.some(s => !s.label)) { notify("Every section needs a heading.", { kind: "error" }); return; }
    if (!data.sections.length || data.sections.some(s => !s.questions.length)) { notify("Every section needs at least one question.", { kind: "error" }); return; }
    if (orig && usedBy(d.id)) {
      const kept = new Set(data.sections.flatMap(s => s.questions.map(q => `${s.id}/${q.id}`)));
      const gone = orig.sections.flatMap(s => s.questions.map(q => `${s.id}/${q.id}`)).filter(k => !kept.has(k)).length;
      if (gone && !(await ask({ title: `Remove ${gone} question${gone === 1 ? "" : "s"}?`, message: `${usedBy(d.id)} saved inspection(s) use this checklist. They keep their answers, but removed questions no longer show in their checklist or report.`, ok: "Save anyway" }))) return;
    }
    setBusy(true);
    try { await persist(d.id, data, d.hidden, d.isNew ? "create" : "update"); guard.done(); setDraft(null); notify(`"${data.label}" saved. It's offered in New Inspection${data.group ? ` under "${data.group}"` : ""}.`); }
    catch (e) { notify(`The checklist couldn't be saved. ${e.message}`, { kind: "error" }); }
    setBusy(false);
  }

  const setD = patch => setDraft(p => ({ ...p, ...patch }));
  const setSec = (si, patch) => setDraft(p => ({ ...p, sections: p.sections.map((s, i) => i === si ? { ...s, ...patch } : s) }));
  const setQ = (si, qi, patch) => setSec(si, { questions: draft.sections[si].questions.map((q, i) => i === qi ? { ...q, ...patch } : q) });
  const move = (arr, i, d) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };

  // ── editor ──
  if (draft) {
    const d = draft;
    return (
      <div data-testid="checklist-editor">
        <DraftBanner guard={guard} Z={Z} font={font} what="this checklist"/>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <button type="button" style={btn(false)} onClick={async () => { if (guard.dirty && !(await ask({ title: "Leave without saving?", message: "Your changes to this checklist will be lost.", ok: "Leave", danger: true }))) return; guard.done(); setDraft(null); }}>← Checklists</button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: Z.white, flex: 1 }}>{d.isNew ? "New checklist" : "Edit checklist"}</h2>
          <button type="button" data-testid="tpl-save" style={btn(true, { padding: "9px 20px", fontSize: 13, opacity: busy ? .6 : 1 })} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save checklist"}</button>
        </div>
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "0 16px" }}>
            <div><label style={lbl} htmlFor="tpl-label">Name *</label><input id="tpl-label" data-testid="tpl-label" value={d.label} maxLength={120} onChange={e => setD({ label: e.target.value })} style={inp}/></div>
            <div><label style={lbl} htmlFor="tpl-group">Shown under (group in the type list)</label><input id="tpl-group" value={d.group} maxLength={80} placeholder="This site's checklists" onChange={e => setD({ group: e.target.value })} style={inp}/></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={lbl} htmlFor="tpl-desc">Description</label><input id="tpl-desc" value={d.description} maxLength={300} placeholder="What it covers, in a line" onChange={e => setD({ description: e.target.value })} style={inp}/></div>
            <div><label style={lbl} htmlFor="tpl-freq">Next due after (months; 0 = not set)</label><input id="tpl-freq" type="number" min="0" max="60" value={d.freqMonths} onChange={e => setD({ freqMonths: e.target.value })} style={inp}/></div>
            <div><label style={lbl} htmlFor="tpl-intro">Section introduction heading</label><input id="tpl-intro" value={d.introLabel} maxLength={40} placeholder="e.g. Statement of Intent" onChange={e => setD({ introLabel: e.target.value })} style={inp}/></div>
          </div>
          <span style={lbl}>Icon</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ICONS.map(ic => <button key={ic} type="button" aria-pressed={d.icon === ic} aria-label={`Icon ${ic}`} onClick={() => setD({ icon: ic })} style={{ width: 38, height: 38, fontSize: 18, borderRadius: 9, cursor: "pointer", background: d.icon === ic ? `${Z.accent}33` : Z.overlay, border: `2px solid ${d.icon === ic ? Z.accent : Z.border}` }}>{ic}</button>)}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 13, color: Z.white, cursor: "pointer" }}>
            <input type="checkbox" checked={d.allowSkip} onChange={e => setD({ allowSkip: e.target.checked })} style={{ width: 17, height: 17, accentColor: Z.accent }}/>
            Can be saved part-done (move on without answering everything)
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 8px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: Z.muted, letterSpacing: .5, textTransform: "uppercase" }}>{d.sections.length} sections · {count(d)} questions</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" style={btn(false)} onClick={() => setOpenSec(Object.fromEntries(d.sections.map(s => [s.id, true])))}>Open all</button>
            <button type="button" style={btn(false)} onClick={() => setOpenSec({})}>Close all</button>
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {d.sections.map((s, si) => (
            <div key={s.id} data-testid="tpl-section" style={{ ...card, padding: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px" }}>
                <button type="button" aria-expanded={!!openSec[s.id]} aria-label={`${openSec[s.id] ? "Close" : "Open"} section ${s.label || si + 1}`} onClick={() => setOpenSec(o => ({ ...o, [s.id]: !o[s.id] }))} style={{ ...btn(false), padding: "4px 10px" }}>{openSec[s.id] ? "▾" : "▸"}</button>
                <input aria-label={`Section ${si + 1} heading`} data-testid="tpl-sec-label" value={s.label} maxLength={200} placeholder="Section heading" onChange={e => setSec(si, { label: e.target.value })} style={{ ...inp, fontWeight: 700 }}/>
                <span style={{ fontSize: 12, color: Z.muted, whiteSpace: "nowrap" }}>{s.questions.length} q</span>
                <button type="button" aria-label={`Move section ${si + 1} up`} disabled={si === 0} onClick={() => setD({ sections: move(d.sections, si, -1) })} style={{ ...btn(false), padding: "4px 9px", opacity: si === 0 ? .4 : 1 }}>↑</button>
                <button type="button" aria-label={`Move section ${si + 1} down`} disabled={si === d.sections.length - 1} onClick={() => setD({ sections: move(d.sections, si, 1) })} style={{ ...btn(false), padding: "4px 9px", opacity: si === d.sections.length - 1 ? .4 : 1 }}>↓</button>
                <button type="button" aria-label={`Remove section ${si + 1}`} onClick={async () => { if (s.questions.some(q => q.text.trim()) && !(await ask({ title: `Remove section "${s.label || si + 1}"?`, message: `With its ${s.questions.length} question(s).`, ok: "Remove", danger: true }))) return; setD({ sections: d.sections.filter((_, i) => i !== si) }); }} style={{ ...btn(false), padding: "4px 9px", color: "#f87171" }}>✕</button>
              </div>
              {openSec[s.id] && (
                <div style={{ padding: "0 12px 12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "0 12px" }}>
                    <div><label style={lbl}>Group (e.g. the clause)</label><input value={s.group} maxLength={120} onChange={e => setSec(si, { group: e.target.value })} style={inp} aria-label={`Section ${si + 1} group`}/></div>
                  </div>
                  <label style={lbl}>{d.introLabel || "Introduction"} (optional)</label>
                  <textarea rows={2} value={s.intro} maxLength={6000} onChange={e => setSec(si, { intro: e.target.value })} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} aria-label={`Section ${si + 1} introduction`}/>
                  <span style={lbl}>Questions</span>
                  <div style={{ display: "grid", gap: 6 }}>
                    {s.questions.map((q, qi) => (
                      <div key={q.id} data-testid="tpl-question" style={{ display: "grid", gridTemplateColumns: "84px minmax(0,1fr) auto", gap: 6, alignItems: "start", background: Z.overlay, borderRadius: 9, padding: 6 }}>
                        <input aria-label={`Question ${qi + 1} reference`} placeholder="Ref" value={q.ref} maxLength={20} onChange={e => setQ(si, qi, { ref: e.target.value })} style={{ ...inp, padding: "7px 8px" }}/>
                        <textarea aria-label={`Question ${qi + 1}`} data-testid="tpl-q-text" rows={q.text.length > 120 ? 3 : 1} value={q.text} maxLength={6000} placeholder="Question or requirement" onChange={e => setQ(si, qi, { text: e.target.value })} style={{ ...inp, padding: "7px 9px", resize: "vertical", lineHeight: 1.45 }}/>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button type="button" aria-label={`Move question ${qi + 1} up`} disabled={qi === 0} onClick={() => setSec(si, { questions: move(s.questions, qi, -1) })} style={{ ...btn(false), padding: "4px 8px", opacity: qi === 0 ? .4 : 1 }}>↑</button>
                          <button type="button" aria-label={`Move question ${qi + 1} down`} disabled={qi === s.questions.length - 1} onClick={() => setSec(si, { questions: move(s.questions, qi, 1) })} style={{ ...btn(false), padding: "4px 8px", opacity: qi === s.questions.length - 1 ? .4 : 1 }}>↓</button>
                          <button type="button" aria-label={`Remove question ${qi + 1}`} onClick={() => setSec(si, { questions: s.questions.filter((_, i) => i !== qi) })} style={{ ...btn(false), padding: "4px 8px", color: "#f87171" }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" data-testid="tpl-add-q" style={{ ...btn(false), marginTop: 8 }} onClick={() => setSec(si, { questions: [...s.questions, { id: uid("q"), ref: "", tag: "", text: "" }] })}>+ Add question</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" data-testid="tpl-add-sec" style={{ ...btn(false), marginTop: 10 }} onClick={() => { const id = uid("s"); setD({ sections: [...d.sections, { id, label: "", group: "", intro: "", questions: [{ id: uid("q"), ref: "", tag: "", text: "" }] }] }); setOpenSec(o => ({ ...o, [id]: true })); }}>+ Add section</button>
      </div>
    );
  }

  // ── list ──
  const row = (t, builtIn) => (
    <div key={t.id} data-testid={`tpl-row-${t.id}`} style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", opacity: t.hidden ? .65 : 1 }}>
      <span style={{ fontSize: 22 }} aria-hidden="true">{t.icon}</span>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: Z.white }}>{t.label} {t.hidden && <span style={{ fontSize: 11, fontWeight: 700, color: Z.muted, border: `1px solid ${Z.borderMd}`, borderRadius: 99, padding: "1px 8px", marginLeft: 6 }}>Hidden</span>}</div>
        <div style={{ fontSize: 12, color: Z.muted }}>{(t.sections || INSP_SECTIONS[t.id] || []).length} sections · {count({ sections: t.sections || INSP_SECTIONS[t.id] || [] })} questions{t.freq ? ` · every ${t.freq}` : ""}{usedBy(t.id) ? ` · used ${usedBy(t.id)}×` : ""}{builtIn ? " · built in" : ""}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {!builtIn && <button type="button" style={btn(true)} onClick={() => open(t, false)} aria-label={`Edit ${t.label}`}>✏ Edit</button>}
        <button type="button" style={btn(false)} onClick={() => open(t, true)} aria-label={`Copy ${t.label}`}>⧉ Copy</button>
        {!builtIn && <button type="button" style={btn(false)} onClick={() => setHidden(t, !t.hidden)} aria-label={`${t.hidden ? "Show" : "Hide"} ${t.label}`}>{t.hidden ? "Show" : "Hide"}</button>}
        {!builtIn && <button type="button" style={btn(false, { color: "#f87171" })} onClick={() => remove(t)} aria-label={`Delete ${t.label}`}>🗑</button>}
      </div>
    </div>
  );
  return (
    <div data-testid="checklist-manager">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <button type="button" style={btn(false)} onClick={onClose}>← All Inspections</button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: Z.white, flex: 1 }}>Checklists</h2>
        <button type="button" data-testid="tpl-new" style={btn(true, { padding: "9px 18px", fontSize: 13 })} onClick={() => open({ id: "", label: "", icon: "📋", custom: true, sections: [{ id: "s1", label: "", questions: [{ id: "q1", text: "" }] }] }, true, true)}>+ New checklist</button>
      </div>
      <p style={{ color: Z.muted, fontSize: 13, margin: "0 0 14px", maxWidth: 820 }}>The checklists offered in New Inspection (and on the phone). The built-in ones can't be changed, but you can copy one and edit the copy. A checklist that has been used can be hidden but not deleted, so saved inspections keep their wording.</p>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: .6, color: Z.muted, textTransform: "uppercase", margin: "10px 0 6px" }}>This site's checklists</div>
      <div style={{ display: "grid", gap: 8 }}>
        {site.length ? site.map(t => row(t, false)) : <div style={{ ...card, color: Z.muted, fontSize: 13 }}>None yet. Click <b>+ New checklist</b>, or copy a built-in one below.</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: .6, color: Z.muted, textTransform: "uppercase", margin: "18px 0 6px" }}>Built in</div>
      <div style={{ display: "grid", gap: 8 }}>{INSP_TYPES.map(t => row({ ...t, sections: INSP_SECTIONS[t.id] }, true))}</div>
    </div>
  );
}
