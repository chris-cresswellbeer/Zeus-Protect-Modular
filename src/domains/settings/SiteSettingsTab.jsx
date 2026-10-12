import React, { useState, useEffect } from "react";
import { notify } from "../../shared/Feedback";
import { useFormGuard } from "../../lib/unsaved";
import { auditEvent } from "../../lib/audit";
import { useSiteLists, saveSiteLists, loadSiteLists, SITE_LIST_DEFAULTS } from "../../lib/siteLists";
import { EmailSettings } from "./EmailSettings";

/**
 * SiteSettingsTab — Documents ▼ → Site Settings (admins).
 * The lists that differ from site to site, kept in the database (lib/siteLists.js):
 * first aid zones, first aid shifts and the hazard report locations; and the
 * email reminder settings (EmailSettings.jsx).
 */
const LISTS = [
  { key: "reportLocations", title: "Hazard report locations", help: "The \"Where was it?\" choices when someone makes a quick hazard report, on a phone or computer. They can always type somewhere else.", add: "e.g. Racking Aisle 4" },
  { key: "firstAidZones", title: "First aid zones", help: "The areas first aid cover is planned for, in the First Aid register and on first aid certificates. Fire wardens' areas are chosen from this list too.", add: "e.g. Ground Floor — Offices" },
  { key: "firstAidShifts", title: "First aid shifts", help: "The shifts first aid cover is planned for.", add: "e.g. Late Shift (16:00–02:00)" },
];

function ListEditor({ list, items, onChange, Z, font }) {
  const [text, setText] = useState("");
  const inp = { flex: 1, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "9px 13px", color: Z.white, fontSize: 13, outline: "none", fontFamily: font, minWidth: 0 };
  const small = { background: Z.overlay, color: Z.white, border: `1px solid ${Z.borderMd}`, borderRadius: 8, padding: "4px 8px", flexShrink: 0, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700 };
  const add = () => {
    const v = text.trim(); if (!v) return;
    if (items.some(x => x.toLowerCase() === v.toLowerCase())) { notify(`"${v}" is already in the list.`, { kind: "error", timeout: 4000 }); return; }
    onChange([...items, v]); setText("");
  };
  const move = (i, d) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <section data-testid={`list-${list.key}`} style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${Z.border}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div data-part="head">
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: Z.white }}>{list.title}</h3>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: Z.muted, lineHeight: 1.5 }}>{list.help}</p>
      </div>
      {items.length ? (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          {items.map((it, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: Z.overlay, borderRadius: 8, padding: "6px 8px 6px 12px" }}>
              {/* a textarea so long names wrap instead of being cut off; Enter doesn't add a line */}
              <textarea aria-label={`${list.title}: item ${i + 1}`} value={it} rows={it.length > 30 ? 2 : 1}
                onChange={e => { const n = [...items]; n[i] = e.target.value.replace(/[\r\n]+/g, " "); onChange(n); }}
                onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
                style={{ flex: 1, background: "transparent", border: "none", color: Z.white, fontSize: 13, fontFamily: font, outline: "none", minWidth: 0, resize: "none", lineHeight: 1.45, padding: "3px 0", overflow: "hidden" }}/>
              <button type="button" aria-label={`Move ${it} up`} disabled={i === 0} onClick={() => move(i, -1)} style={{ ...small, opacity: i === 0 ? .35 : 1 }}>↑</button>
              <button type="button" aria-label={`Move ${it} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)} style={{ ...small, opacity: i === items.length - 1 ? .35 : 1 }}>↓</button>
              <button type="button" aria-label={`Remove ${it}`} onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ ...small, color: "#f87171" }}>×</button>
            </li>
          ))}
        </ol>
      ) : <div style={{ fontSize: 12.5, color: Z.muted, fontStyle: "italic" }}>None yet.</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <input aria-label={`Add to ${list.title}`} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={list.add} style={inp}/>
        <button type="button" onClick={add} disabled={!text.trim()} style={{ ...small, padding: "8px 14px", opacity: text.trim() ? 1 : .5 }}>+ Add</button>
      </div>
    </section>
  );
}

function SiteSettingsTab({ Z, font }) {
  const site = useSiteLists();
  const pick = s => ({ reportLocations: [...s.reportLocations], firstAidZones: [...s.firstAidZones], firstAidShifts: [...s.firstAidShifts] });
  const [form, setForm] = useState(() => pick(site));
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadSiteLists().then(s => setForm(pick(s))); }, []);     // latest from the database
  const guard = useFormGuard({ key: "site-settings", label: "the site settings", active: true, value: form, onRestore: v => setForm(v) });
  const changed = JSON.stringify(form) !== JSON.stringify(pick(site));

  async function save() {
    setBusy(true);
    const cleaned = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.map(x => x.trim()).filter(Boolean)]));
    const err = await saveSiteLists(cleaned);
    setBusy(false);
    if (err) { notify(`The site settings couldn't be saved. ${err}`, { kind: "error" }); return; }
    auditEvent("settings", "site_lists", "update", "Site settings saved (report locations, first aid zones and shifts)", {}, "Site settings");
    guard.saved(); setForm(pick({ ...SITE_LIST_DEFAULTS, ...cleaned }));
    notify("Site settings saved.");
  }

  return (
    <div data-testid="site-settings">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -.5, margin: "0 0 4px" }}>Site Settings</h2>
          <p style={{ color: Z.muted, margin: 0, fontSize: 13 }}>Lists that are particular to this site. Changes apply for everyone as soon as you save.</p>
        </div>
        <button type="button" onClick={save} disabled={busy || !changed} data-testid="site-save"
          style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 800, cursor: busy || !changed ? "default" : "pointer", fontFamily: font, fontSize: 13, opacity: busy || !changed ? .5 : 1 }}>
          {busy ? "Saving…" : changed ? "Save changes" : "Saved"}
        </button>
      </div>
      {!site.saved && <div role="status" style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", fontSize: 13, color: Z.white, marginBottom: 14 }}>
        These are the starting lists. Change them to suit this site and save.
      </div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        {LISTS.map(l => <ListEditor key={l.key} list={l} items={form[l.key]} onChange={v => setForm(f => ({ ...f, [l.key]: v }))} Z={Z} font={font}/>)}
      </div>
      <p style={{ fontSize: 12, color: Z.muted, marginTop: 14 }}>The COSHH substances are kept in the COSHH Register (Documents ▼ → COSHH Register), and machine types under Machinery Competence → Machine types.</p>
      <EmailSettings Z={Z} font={font}/>
    </div>
  );
}

export { SiteSettingsTab };
