/**
 * PpeItemsModal — admins: the PPE items you issue (name, standard, how long before it should
 * be replaced, sizes), the statement people sign, how far ahead "due soon" shows, and
 * whether staff see My PPE. app_settings row "ppe" (lib/ppe.js). Removing an item from the
 * list doesn't change PPE already issued.
 */
import React from "react";
import { normalisePpeSettings, DEFAULT_PPE_ITEMS, DEFAULT_PPE_STATEMENT } from "../../lib/ppe";
import { savePpeSettings } from "../../lib/ppeClient";
import { auditEvent } from "../../lib/audit";
import { notify, ask } from "../../shared/Feedback";
import { Modal, btn, small, field, lbl } from "./ppeUi";

let seq = 0;
const toEdit = s => s.items.map(i => ({ ...i, key: ++seq, sizesText: i.sizes.join(", ") }));

export function PpeItemsModal({ settings, onClose, Z, font }) {
  const [items, setItems] = React.useState(() => toEdit(settings));
  const [statement, setStatement] = React.useState(settings.statement);
  const [days, setDays] = React.useState(settings.dueSoonDays);
  const [staffCanSee, setStaffCanSee] = React.useState(settings.staffCanSee);
  const [busy, setBusy] = React.useState(false);
  const set = (key, patch) => setItems(xs => xs.map(x => (x.key === key ? { ...x, ...patch } : x)));
  const F = field(Z, font);

  async function save() {
    const bad = items.find(x => !x.name.trim());
    if (bad) { notify("Every item needs a name (or remove the empty row).", { kind: "error" }); return; }
    setBusy(true);
    try {
      const clean = await savePpeSettings(normalisePpeSettings({ staffCanSee, dueSoonDays: days, statement, items: items.map(x => ({ id: x.id, name: x.name, standard: x.standard, life: x.life, sizes: x.sizesText.split(",") })) }));
      const changes = {};
      if (JSON.stringify(clean.items) !== JSON.stringify(settings.items)) changes.items = { from: settings.items.map(i => i.name).join(", "), to: clean.items.map(i => i.name).join(", ") };
      if (clean.statement !== settings.statement) changes.statement = { from: settings.statement, to: clean.statement };
      if (clean.dueSoonDays !== settings.dueSoonDays) changes.dueSoonDays = { from: settings.dueSoonDays, to: clean.dueSoonDays };
      if (clean.staffCanSee !== settings.staffCanSee) changes.staffCanSee = { from: settings.staffCanSee, to: clean.staffCanSee };
      auditEvent("settings", "ppe", "update", "PPE items and settings saved", changes, "PPE register");
      notify("Saved.");
      onClose();
    } catch (e) { notify(`The PPE settings couldn't be saved. ${e.message || e}`, { kind: "error" }); }
    setBusy(false);
  }
  const th = { textAlign: "left", padding: "8px 8px", fontSize: 11, fontWeight: 700, color: Z.muted, textTransform: "uppercase", letterSpacing: .6 };
  return (
    <Modal title="PPE items, sizes and signing" onClose={onClose} width={1100} testid="ppe-items" Z={Z} font={font}
      footer={<><button type="button" style={btn(Z, font)} onClick={onClose}>Cancel</button><button type="button" style={{ ...btn(Z, font, "primary"), opacity: busy ? .6 : 1 }} disabled={busy} onClick={save} data-testid="ppe-items-save">{busy ? "Saving…" : "Save"}</button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead><tr><th style={th}>Item</th><th style={th}>Standard</th><th style={th}>Replace after (months)</th><th style={th}>Sizes (separate with commas)</th><th style={th}></th></tr></thead>
            <tbody>
              {items.map((x, i) => (
                <tr key={x.key} data-testid="ppe-item-row">
                  <td style={{ padding: 4 }}><input aria-label={`Item ${i + 1} name`} value={x.name} onChange={e => set(x.key, { name: e.target.value })} maxLength={80} style={{ ...F, width: "100%" }}/></td>
                  <td style={{ padding: 4 }}><input aria-label={`Item ${i + 1} standard`} value={x.standard} onChange={e => set(x.key, { standard: e.target.value })} maxLength={80} style={{ ...F, width: "100%" }}/></td>
                  <td style={{ padding: 4, width: 130 }}><input aria-label={`Item ${i + 1} replace after months`} type="number" min={0} max={120} value={x.life} onChange={e => set(x.key, { life: e.target.value })} style={{ ...F, width: 110 }} title="0 = no fixed replacement date"/></td>
                  <td style={{ padding: 4 }}><input aria-label={`Item ${i + 1} sizes`} value={x.sizesText} onChange={e => set(x.key, { sizesText: e.target.value })} style={{ ...F, width: "100%" }}/></td>
                  <td style={{ padding: 4, width: 44 }}><button type="button" aria-label={`Remove ${x.name || "item"}`} onClick={() => setItems(xs => xs.filter(y => y.key !== x.key))} style={{ ...small(Z, font), width: 40 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" style={btn(Z, font)} onClick={() => setItems(xs => [...xs, { key: ++seq, id: "", name: "", standard: "", life: 12, sizesText: "One size" }])} data-testid="ppe-item-add">+ Add an item</button>
            <button type="button" style={btn(Z, font)} onClick={async () => { if (await ask({ title: "Put back the starting list?", message: "Replaces the list above with the starting list of items (you can still Cancel afterwards).", ok: "Put back" })) setItems(toEdit({ items: DEFAULT_PPE_ITEMS })); }}>Starting list</button>
          </div>
          <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 8, lineHeight: 1.5 }}>The replacement periods in the starting list are typical, not rules: check the manufacturer's guidance and your risk assessments. 0 months means no fixed replacement date (replace when worn or damaged). Changing or removing an item doesn't change PPE already issued.</div>
        </div>
        <div>
          <label style={lbl(Z)} htmlFor="ppe-statement">What people agree to when they sign</label>
          <textarea id="ppe-statement" value={statement} onChange={e => setStatement(e.target.value)} rows={3} maxLength={1000} style={{ ...F, width: "100%", resize: "vertical", lineHeight: 1.5 }}/>
          <button type="button" onClick={() => setStatement(DEFAULT_PPE_STATEMENT)} style={{ background: "none", border: "none", color: Z.accentLt, fontFamily: font, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "4px 0" }}>Use the standard wording</button>
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div><label style={lbl(Z)} htmlFor="ppe-days">Show "due soon"</label><input id="ppe-days" type="number" min={1} max={180} value={days} onChange={e => setDays(e.target.value)} style={{ ...F, width: 90 }}/> <span style={{ fontSize: 13, color: Z.muted }}>days before the replacement date</span></div>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", maxWidth: 520 }}>
            <input type="checkbox" checked={staffCanSee} onChange={e => setStaffCanSee(e.target.checked)} data-testid="ppe-staffcansee" style={{ width: 18, height: 18, marginTop: 1, accentColor: Z.accent }}/>
            <span style={{ fontSize: 13.5 }}><b>Staff see My PPE</b><span style={{ display: "block", fontSize: 12.5, color: Z.muted, marginTop: 2 }}>In the phone app (More → My PPE) and on the portal: what they've been issued, signing for it, and reporting it damaged, lost or not fitting.</span></span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
