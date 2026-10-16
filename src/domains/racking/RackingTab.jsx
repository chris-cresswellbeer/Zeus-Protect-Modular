/**
 * RackingTab — Equipment → Racking (admins; and the Machinery & Equipment page for people
 * with that access, who are the racking inspectors).
 *   Map & damage        totals, the aisle-by-bay map coloured by the worst open damage,
 *                       and the damage register; a bay or a report opens RackBay
 *   Inspections         the regular (weekly) visual check and the annual expert inspection,
 *                       plus how often they're due and the amber repair time
 *   Locations & labels  add bays in bulk (aisles × bays, levels), change an aisle's
 *                       levels, remove unused bays, print the QR labels
 * Rules: lib/racking.js. Saving: lib/rackClient.js. Bay screen: shared/RackBay.jsx.
 */
import React from "react";
import { RATINGS, makeBays, cleanLevels, bayName, bayLink, damageState, worstByBay, rackingSummary, aisleCode } from "../../lib/racking";
import { useRacking, saveLocations, deleteLocation, saveCheck, saveRackingSettings } from "../../lib/rackClient";
import { RackBay, RateChip } from "../../shared/RackBay";
import { qrSvg } from "../../lib/certificate";
import { auditEvent } from "../../lib/audit";
import { ask, notify } from "../../shared/Feedback";
import { Modal, btn, small, field, lbl } from "../ppe/ppeUi";

const ukd = iso => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const addMonths = (d, n) => { const [y, m, dd] = d.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(dd, last)); return t.toISOString().slice(0, 10); };
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SORT = { red: 0, amberLate: 1, amber: 2, green: 3, repaired: 4, dismissed: 5 };
const MAPC = { red: "#ef4444", amber: "#f59e0b", green: "#10b981" };

/** Printable QR labels (3 across an A4 page). */
export function printRackLabels(locs, origin = window.location.origin) {
  const w = window.open("", "_blank");
  if (!w) { notify("Your browser blocked the labels. Allow pop-ups for the portal and try again.", { kind: "error" }); return; }
  const cells = locs.map(l => `<div class="l"><div class="q">${qrSvg(bayLink(l.id, origin), { size: 112, colour: "#0f172a", label: `QR code for ${esc(l.id)}` })}</div>
    <div><div class="k">Racking</div><div class="c">${esc(l.id)}</div><div class="n">Aisle ${esc(l.aisle)} · Bay ${esc(String(l.bay).padStart(2, "0"))}</div><div class="v">Levels ${esc((l.data.levels || []).join(" "))}</div><div class="s">Damaged? Scan to report it</div></div></div>`).join("");
  w.document.write(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Racking QR labels</title><style>
    @page{size:A4;margin:10mm}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#0f172a}
    .g{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}.l{border:0.6mm solid #0f172a;border-radius:3mm;padding:3mm;display:flex;gap:3mm;align-items:center;break-inside:avoid;height:38mm;box-sizing:border-box}
    .q svg{display:block;width:30mm;height:30mm}.k{font-size:8pt;font-weight:bold;letter-spacing:.8pt;text-transform:uppercase;color:#b45309}.c{font-size:20pt;font-weight:900;line-height:1}
    .n{font-size:9pt;font-weight:bold;margin-top:1mm}.v{font-size:8.5pt;color:#334155}.s{font-size:8.5pt;color:#475569;margin-top:1.5mm}
    .bar{margin:0 0 4mm;font-size:10pt;display:flex;justify-content:space-between}@media print{.bar button{display:none}}</style></head><body>
    <div class="bar"><span>${locs.length} label${locs.length === 1 ? "" : "s"}. Print on weatherproof labels and fix to the upright at eye height.</span><button onclick="print()">Print</button></div>
    <div class="g">${cells}</div></body></html>`);
  w.document.close();
}

export function RackingTab({ me, Z, font, focusCode, onFocusDone }) {
  const R = useRacking(true, { checks: true });
  const { settings, locations, damage, checks } = R;
  const [view, setView] = React.useState("map");
  const [bay, setBay] = React.useState(null);            // code of the bay open in the window
  const [filter, setFilter] = React.useState("open");
  const [picking, setPicking] = React.useState(false);
  React.useEffect(() => { if (focusCode) { setBay(String(focusCode)); onFocusDone && onFocusDone(); } }, [focusCode]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = rackingSummary(damage, checks, settings);
  const worst = worstByBay(damage);
  const locOf = id => locations.find(l => l.id === id) || null;
  const aisles = [...new Set(locations.map(l => l.aisle))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const F = field(Z, font);

  const tile = (label, value, tone, sub) => (
    <div style={{ background: Z.navyMd, border: `1px solid ${tone || Z.border}`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: tone || Z.muted, letterSpacing: .6, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: typeof value === "number" ? 30 : 19, fontWeight: 900, marginTop: typeof value === "number" ? 0 : 6 }}>{value}{sub ? <span style={{ fontSize: 13.5, fontWeight: 700, color: "#fca5a5", marginLeft: 8 }}>{sub}</span> : null}</div>
    </div>
  );
  const rows = damage.map(r => ({ r, s: damageState(r, settings), loc: locOf(r.location_id) }))
    .filter(({ r }) => filter === "all" || (filter === "open" ? r.status === "open" : r.status !== "open"))
    .sort((a, b) => (SORT[a.s.key] - SORT[b.s.key]) || String(b.r.created_at).localeCompare(String(a.r.created_at)));

  async function recordWeekly() {
    const v = await ask({ title: "Record the racking check", message: "The racking inspector's regular visual check. Report any new damage on its bay first, then record the check here.", ok: "Save",
      fields: [{ id: "date", label: "Date", type: "date", value: today(), required: true }, { id: "aisles", label: "Aisles checked", value: "All" }, { id: "notes", label: "Findings", value: "No new damage" }] });
    if (!v) return;
    const e = await saveCheck({ id: `rc_${Date.now().toString(36)}`, kind: "weekly", data: { date: v.date, by: me.name, aisles: v.aisles, notes: v.notes } });
    if (e) notify(`That didn't save. ${e}`, { kind: "error" }); else auditEvent("racking", "check", "create", `Racking check recorded (${v.aisles}): ${v.notes}`, {}, "Racking");
  }
  async function recordExpert() {
    const v = await ask({ title: "Record the expert inspection", message: "The annual inspection by a technically competent person (e.g. a SEMA approved racking inspector). Add each damage item they find on its bay, and keep their report in H&S Documents.", ok: "Save",
      fields: [{ id: "date", label: "Date of inspection", type: "date", value: today(), required: true }, { id: "inspector", label: "Inspector / company", required: true }, { id: "notes", label: "Summary", placeholder: "e.g. 3 amber, 1 green; report in H&S Documents" },
        { id: "nextDue", label: "Next inspection due", type: "date", value: addMonths(today(), settings.expertEveryMonths) }] });
    if (!v) return;
    const e = await saveCheck({ id: `rc_${Date.now().toString(36)}`, kind: "expert", data: { date: v.date, by: me.name, inspector: v.inspector, notes: v.notes, nextDue: v.nextDue || addMonths(v.date, settings.expertEveryMonths) } });
    if (e) notify(`That didn't save. ${e}`, { kind: "error" }); else auditEvent("racking", "expert", "create", `Racking expert inspection recorded: ${v.inspector} (${v.date})`, {}, "Racking");
  }

  return (
    <div data-testid="racking-tab" style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: font, color: Z.white }}>
      {R.missing && <div role="alert" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 14, padding: 16, fontSize: 13.5 }}>The database isn't ready for racking yet: run <b>racking.sql</b> in Supabase.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }} data-testid="rack-tiles">
        {tile("Red: bay out of use", sum.red, sum.red ? "#ef4444" : null, sum.redNotOffloaded ? `${sum.redNotOffloaded} not offloaded` : "")}
        {tile("Amber open", sum.amber, sum.amber ? "#f59e0b" : null, sum.amberLate ? `${sum.amberLate} past ${settings.amberDays} days` : "")}
        {tile("Green: monitoring", sum.green)}
        {tile("Racking check", sum.weeklyDue ? `Due ${ukd(sum.weeklyDue)}` : "None recorded", sum.weeklyLate ? "#f87171" : null)}
        {tile("Expert inspection", sum.expertDue ? `Due ${ukd(sum.expertDue)}` : "None recorded", sum.expertLate || !sum.expertDue ? "#f87171" : null)}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div role="tablist" aria-label="Racking" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["map", "Map & damage"], ["checks", "Inspections"], ["locations", "Locations & labels"]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} data-testid={`rack-view-${k}`}
              style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: Z.white, cursor: "pointer", borderRadius: 20, padding: "8px 15px", background: view === k ? `${Z.accent}44` : Z.overlay, border: `1px solid ${view === k ? Z.accent : Z.borderMd}` }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }}/>
        <button type="button" style={btn(Z, font)} onClick={recordWeekly} data-testid="rack-weekly">Record racking check</button>
        <button type="button" style={btn(Z, font, "primary")} onClick={() => setPicking(true)} disabled={!locations.length} data-testid="rack-report-btn">+ Report damage</button>
      </div>

      {view === "map" && <>
        <div style={{ background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 16, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Racking map: worst open damage per bay</div>
            <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: Z.muted, flexWrap: "wrap" }}>
              {[["Red", MAPC.red], ["Amber", MAPC.amber], ["Green (monitoring)", MAPC.green], ["No damage", Z.overlay]].map(([l, c]) => <span key={l}><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: c, border: `1px solid ${Z.borderMd}`, verticalAlign: -1, marginRight: 5 }}/>{l}</span>)}
            </div>
          </div>
          {!locations.length ? <div style={{ color: Z.muted, fontSize: 14 }}>No bays set up yet. Add them under <b>Locations &amp; labels</b>.</div> : (
            <div style={{ overflowX: "auto" }} data-testid="rack-map">
              {aisles.map(a => { const bays = locations.filter(l => l.aisle === a).sort((x, y) => x.bay - y.bay); return (
                <div key={a} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4, minWidth: "max-content" }}>
                  <span style={{ width: 72, fontSize: 13, fontWeight: 700, color: Z.muted, flexShrink: 0 }}>Aisle {a}</span>
                  {bays.map(l => { const w = worst[l.id]; return (
                    <button key={l.id} type="button" onClick={() => setBay(l.id)} title={`${bayName(l)}${w ? `: ${w}` : ""}`} aria-label={`${bayName(l)}${w ? `, ${w} damage` : ", no damage"}`} data-testid="rack-cell" data-worst={w || "none"}
                      style={{ width: 34, height: 30, borderRadius: 6, border: `1px solid ${w ? "transparent" : Z.borderMd}`, background: w ? MAPC[w] : Z.overlay, color: w ? "#0b1020" : Z.muted, fontSize: 11, fontWeight: 800, fontFamily: font, cursor: "pointer", padding: 0 }}>{l.bay}</button>
                  ); })}
                </div>
              ); })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {[["open", "Open"], ["closed", "Repaired & closed"], ["all", "Everything"]].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} data-testid={`rack-filter-${k}`}
              style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: Z.white, cursor: "pointer", borderRadius: 20, padding: "7px 13px", background: filter === k ? `${Z.accent}44` : Z.overlay, border: `1px solid ${filter === k ? Z.accent : Z.borderMd}` }}>{l}</button>
          ))}
        </div>
        <div style={{ background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 900 }}>
            <thead><tr style={{ background: Z.navyMd }}>{["Photo", "Location", "Damage", "Rating", "Reported", "Repair by"].map(h => <th key={h} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: Z.muted, textTransform: "uppercase", letterSpacing: .6 }}>{h}</th>)}<th style={{ padding: "11px 14px" }}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th></tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={7} style={{ padding: 18, color: Z.muted }}>{filter === "open" ? "No open damage." : "Nothing here yet."}</td></tr>}
              {rows.map(({ r, s, loc }) => { const d = r.data; return (
                <tr key={r.id} data-testid="rack-row" style={{ borderTop: `1px solid ${Z.border}` }}>
                  <td style={{ padding: "10px 14px" }}>{(d.photos || [])[0] ? <img src={d.photos[0]} alt="Damage" style={{ width: 56, height: 42, objectFit: "cover", borderRadius: 8, display: "block" }}/> : <span style={{ color: Z.muted }}>—</span>}</td>
                  <td style={{ padding: "10px 14px" }}><b>{loc ? bayName(loc) : r.location_id}</b><div style={{ fontSize: 12, color: Z.muted }}>Level {(d.levels || []).join("/")}</div></td>
                  <td style={{ padding: "10px 14px" }}>{d.part}<div style={{ fontSize: 12, color: Z.muted }}>{d.note || ""}</div></td>
                  <td style={{ padding: "10px 14px" }}><RateChip state={s}/><div style={{ fontSize: 12, color: s.unconfirmed ? "#fbbf24" : Z.muted, marginTop: 3 }}>{r.status !== "open" ? "" : d.confirmedAt ? `Confirmed: ${d.confirmedBy}` : "Not confirmed yet"}</div></td>
                  <td style={{ padding: "10px 14px" }}>{ukd(d.reportedAt)}<div style={{ fontSize: 12, color: Z.muted }}>{d.reportedBy}{(d.seenAgain || []).length ? ` · seen again ${d.seenAgain.length}×` : ""}</div></td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: s.late ? "#fca5a5" : Z.white }}>{r.status === "repaired" ? `Repaired ${ukd(d.repair && d.repair.at)}` : r.status === "dismissed" ? "Closed" : r.rating === "red" ? (d.offloadedAt ? `Offloaded${d.repairBooked ? ` · repair ${ukd(d.repairBooked)}` : ""}` : "Offload now") : r.rating === "amber" ? `${ukd(s.due)}${s.late ? " · overdue" : ""}` : "—"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}><button type="button" style={small(Z, font)} onClick={() => setBay(r.location_id)} data-testid="rack-row-open">{r.status === "open" && s.unconfirmed ? "Confirm" : "Open"}</button></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </>}

      {view === "checks" && <ChecksView checks={checks} settings={settings} sum={sum} onWeekly={recordWeekly} onExpert={recordExpert} me={me} Z={Z} font={font}/>}
      {view === "locations" && <LocationsView locations={locations} damage={damage} settings={settings} aisles={aisles} Z={Z} font={font} F={F}/>}

      {picking && <PickBay locations={locations} aisles={aisles} onPick={c => { setPicking(false); setBay(c); }} onClose={() => setPicking(false)} Z={Z} font={font}/>}
      {bay && (
        <Modal title={locOf(bay) ? bayName(locOf(bay)) : `Bay ${bay}`} onClose={() => setBay(null)} width={640} testid="rack-bay-window" Z={Z} font={font}>
          <RackBay code={bay} loc={locOf(bay)} damage={damage} user={me} isInspector settings={settings} Z={Z} font={font}/>
        </Modal>
      )}
    </div>
  );
}

function PickBay({ locations, aisles, onPick, onClose, Z, font }) {
  const [a, setA] = React.useState(aisles[0] || "");
  const [b, setB] = React.useState("");
  const F = field(Z, font);
  const bays = locations.filter(l => l.aisle === a).sort((x, y) => x.bay - y.bay);
  return (
    <Modal title="Report damage: which bay?" onClose={onClose} width={480} testid="rack-pick" Z={Z} font={font}
      footer={<><button type="button" style={btn(Z, font)} onClick={onClose}>Cancel</button><button type="button" style={btn(Z, font, "primary")} disabled={!b} onClick={() => onPick(b)} data-testid="rack-pick-go">Next</button></>}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><label style={lbl(Z)} htmlFor="rk-aisle">Aisle</label><select id="rk-aisle" value={a} onChange={e => { setA(e.target.value); setB(""); }} data-testid="rack-pick-aisle" style={{ ...F, width: "100%" }}>{aisles.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
        <div style={{ flex: 1 }}><label style={lbl(Z)} htmlFor="rk-bay">Bay</label><select id="rk-bay" value={b} onChange={e => setB(e.target.value)} data-testid="rack-pick-bay" style={{ ...F, width: "100%" }}><option value="">Choose…</option>{bays.map(l => <option key={l.id} value={l.id}>{String(l.bay).padStart(2, "0")}</option>)}</select></div>
      </div>
    </Modal>
  );
}

function ChecksView({ checks, settings, sum, onWeekly, onExpert, Z, font }) {
  const weekly = checks.filter(c => c.kind === "weekly").sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
  const expert = checks.filter(c => c.kind === "expert").sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
  const [s, setS] = React.useState(settings);
  React.useEffect(() => setS(settings), [settings]);
  const F = field(Z, font);
  const card = { background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 16, padding: "16px 18px" };
  const list = (rows, expertRows) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
      <tbody>{!rows.length && <tr><td style={{ color: Z.muted, padding: "8px 0" }}>None recorded yet.</td></tr>}
        {rows.slice(0, 20).map(c => <tr key={c.id} data-testid={expertRows ? "rack-expert-row" : "rack-check-row"} style={{ borderTop: `1px solid ${Z.border}` }}>
          <td style={{ padding: "9px 0", width: 100, fontWeight: 700 }}>{ukd(c.data.date)}</td>
          <td style={{ padding: "9px 8px" }}>{expertRows ? <><b>{c.data.inspector}</b>{c.data.notes ? ` · ${c.data.notes}` : ""}<div style={{ fontSize: 12, color: Z.muted }}>Next due {ukd(c.data.nextDue)}</div></> : <>{c.data.aisles ? `${c.data.aisles}: ` : ""}{c.data.notes}</>}</td>
          <td style={{ padding: "9px 0", color: Z.muted, textAlign: "right" }}>{c.data.by}</td></tr>)}
      </tbody>
    </table>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>Regular racking checks</div><div style={{ fontSize: 13, color: Z.muted }}>A visual check by the racking inspector every {settings.checkEveryDays} days. {sum.lastWeekly ? `Last: ${ukd(sum.lastWeekly)}.` : ""}</div></div>
          <button type="button" style={btn(Z, font, "primary")} onClick={onWeekly}>Record racking check</button>
        </div>
        {list(weekly, false)}
      </div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>Expert inspections</div><div style={{ fontSize: 13, color: Z.muted }}>By a technically competent person (e.g. a SEMA approved racking inspector), at least every {settings.expertEveryMonths} months.</div></div>
          <button type="button" style={btn(Z, font)} onClick={onExpert} data-testid="rack-expert">Record expert inspection</button>
        </div>
        {list(expert, true)}
      </div>
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Settings</div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div><label style={lbl(Z)} htmlFor="rk-every">Racking check every</label><input id="rk-every" type="number" min={1} max={90} value={s.checkEveryDays} onChange={e => setS({ ...s, checkEveryDays: e.target.value })} style={{ ...F, width: 80 }}/> <span style={{ color: Z.muted, fontSize: 13 }}>days</span></div>
          <div><label style={lbl(Z)} htmlFor="rk-amber">Amber repairs within</label><input id="rk-amber" type="number" min={1} max={90} value={s.amberDays} onChange={e => setS({ ...s, amberDays: e.target.value })} style={{ ...F, width: 80 }}/> <span style={{ color: Z.muted, fontSize: 13 }}>days</span></div>
          <div><label style={lbl(Z)} htmlFor="rk-expert">Expert inspection every</label><input id="rk-expert" type="number" min={1} max={36} value={s.expertEveryMonths} onChange={e => setS({ ...s, expertEveryMonths: e.target.value })} style={{ ...F, width: 80 }}/> <span style={{ color: Z.muted, fontSize: 13 }}>months</span></div>
          <button type="button" style={btn(Z, font, "primary")} data-testid="rack-settings-save" onClick={async () => { const e = await saveRackingSettings(s); if (e) notify(`That didn't save. ${e}`, { kind: "error" }); else { auditEvent("settings", "racking", "update", "Racking settings saved", {}, "Racking"); notify("Saved."); } }}>Save settings</button>
        </div>
        <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 10, lineHeight: 1.5 }}>Racking inspectors are the admins and anyone with <b>Machinery &amp; Equipment access</b> (Edit Staff). They confirm ratings, record repairs and checks, and get the red-damage emails.</div>
      </div>
    </div>
  );
}

function LocationsView({ locations, damage, settings, aisles, Z, font, F }) {
  const [form, setForm] = React.useState({ aisles: "", from: 1, to: 20, levels: settings.defaultLevels.join(" ") });
  const [busy, setBusy] = React.useState(false);
  const preview = makeBays({ aisles: form.aisles.split(/[\s,]+/).flatMap(x => { const m = x.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: Math.min(200, Math.abs(+m[2] - +m[1]) + 1) }, (_, i) => String(Math.min(+m[1], +m[2]) + i)) : [x]; }), from: form.from, to: form.to, levels: form.levels }, locations);
  async function add() {
    if (!preview.length) { notify("Nothing new to add: check the aisles and bay numbers.", { kind: "error" }); return; }
    setBusy(true); const e = await saveLocations(preview); setBusy(false);
    if (e) { notify(`That didn't save. ${e}`, { kind: "error" }); return; }
    auditEvent("racking", "locations", "create", `${preview.length} racking bays added (aisles ${[...new Set(preview.map(p => p.aisle))].join(", ")})`, {}, "Racking");
    notify(`Added ${preview.length} bay${preview.length === 1 ? "" : "s"}.`); setForm(f => ({ ...f, aisles: "" }));
  }
  async function setLevels(a) {
    const bays = locations.filter(l => l.aisle === a);
    const v = await ask({ title: `Aisle ${a}: levels`, message: "From the ground up, separated by spaces (e.g. A B C D E). Applies to every bay in this aisle.", ok: "Save", fields: [{ id: "levels", label: "Levels", value: ((bays[0] || {}).data || {}).levels ? bays[0].data.levels.join(" ") : "", required: true }] });
    if (!v) return;
    const lv = cleanLevels(v.levels); if (!lv.length) return;
    const e = await saveLocations(bays.map(l => ({ ...l, data: { ...l.data, levels: lv } })));
    if (e) notify(`That didn't save. ${e}`, { kind: "error" }); else auditEvent("racking", `aisle-${a}`, "update", `Aisle ${a} levels set to ${lv.join(" ")}`, {}, "Racking");
  }
  async function removeAisle(a) {
    const bays = locations.filter(l => l.aisle === a);
    const used = new Set(damage.map(d => d.location_id));
    const free = bays.filter(l => !used.has(l.id));
    if (!(await ask({ title: `Remove aisle ${a}?`, message: `${free.length} bay${free.length === 1 ? "" : "s"} with no damage history will be removed.${free.length < bays.length ? ` ${bays.length - free.length} bay${bays.length - free.length === 1 ? "" : "s"} with damage history stay, so the records still make sense.` : ""} Their QR labels will stop working.`, ok: "Remove", danger: true }))) return;
    for (const l of free) { const e = await deleteLocation(l.id); if (e) { notify(`That didn't delete. ${e}`, { kind: "error" }); return; } }
    auditEvent("racking", `aisle-${a}`, "delete", `Aisle ${a}: ${free.length} racking bays removed`, {}, "Racking");
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 16, padding: "16px 18px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Add bays</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div><label style={lbl(Z)} htmlFor="rk-a">Aisles</label><input id="rk-a" value={form.aisles} onChange={e => setForm({ ...form, aisles: e.target.value })} placeholder="e.g. 1-6 or 01, 02, 7A" data-testid="rack-add-aisles" style={{ ...F, width: 210 }}/></div>
          <div><label style={lbl(Z)} htmlFor="rk-f">Bays from</label><input id="rk-f" type="number" min={1} max={999} value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} data-testid="rack-add-from" style={{ ...F, width: 84 }}/></div>
          <div><label style={lbl(Z)} htmlFor="rk-t">to</label><input id="rk-t" type="number" min={1} max={999} value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} data-testid="rack-add-to" style={{ ...F, width: 84 }}/></div>
          <div><label style={lbl(Z)} htmlFor="rk-l">Levels (ground up)</label><input id="rk-l" value={form.levels} onChange={e => setForm({ ...form, levels: e.target.value })} data-testid="rack-add-levels" style={{ ...F, width: 150 }}/></div>
          <button type="button" style={{ ...btn(Z, font, "primary"), opacity: busy ? .6 : 1 }} disabled={busy} onClick={add} data-testid="rack-add">{preview.length ? `Add ${preview.length} bay${preview.length === 1 ? "" : "s"}` : "Add bays"}</button>
        </div>
        <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 8 }}>Each bay is a ground location with its own QR label, e.g. aisle 3 bay 12 is <b>{aisleCode("3")}-12</b>. Bays that already exist are skipped.</div>
      </div>
      <div style={{ background: Z.navy, border: `1px solid ${Z.border}`, borderRadius: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 720 }}>
          <thead><tr style={{ background: Z.navyMd }}>{["Aisle", "Bays", "Levels", "Open damage"].map(h => <th key={h} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: Z.muted, textTransform: "uppercase", letterSpacing: .6 }}>{h}</th>)}<th style={{ padding: "11px 14px" }}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th></tr></thead>
          <tbody>
            {!aisles.length && <tr><td colSpan={5} style={{ padding: 18, color: Z.muted }}>No bays yet.</td></tr>}
            {aisles.map(a => { const bays = locations.filter(l => l.aisle === a).sort((x, y) => x.bay - y.bay); const lv = [...new Set(bays.map(l => (l.data.levels || []).join(" ")))];
              const openN = damage.filter(d => d.status === "open" && bays.some(l => l.id === d.location_id)).length; return (
              <tr key={a} data-testid="rack-aisle-row" style={{ borderTop: `1px solid ${Z.border}` }}>
                <td style={{ padding: "10px 14px", fontWeight: 800 }}>{a}</td>
                <td style={{ padding: "10px 14px" }}>{bays.length} <span style={{ color: Z.muted }}>({bays[0].bay}–{bays[bays.length - 1].bay})</span></td>
                <td style={{ padding: "10px 14px" }}>{lv.join(" / ")}</td>
                <td style={{ padding: "10px 14px" }}>{openN || "—"}</td>
                <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <button type="button" style={small(Z, font, "primary")} onClick={() => printRackLabels(bays)} data-testid="rack-print">Print labels</button>{" "}
                  <button type="button" style={small(Z, font)} onClick={() => setLevels(a)}>Levels</button>{" "}
                  <button type="button" style={{ ...small(Z, font), background: "none", border: "none", color: "#fca5a5" }} onClick={() => removeAisle(a)}>Remove</button>
                </td>
              </tr>); })}
          </tbody>
        </table>
      </div>
      {locations.length > 0 && <button type="button" style={{ ...btn(Z, font), alignSelf: "flex-start" }} onClick={() => printRackLabels([...locations].sort((x, y) => x.aisle.localeCompare(y.aisle, undefined, { numeric: true }) || x.bay - y.bay))}>Print all {locations.length} labels</button>}
    </div>
  );
}

/** Equipment page (admins): Asset Register | Racking. */
export function EquipmentPage({ assets, racking, initial = "assets", Z, font }) {
  const [tab, setTab] = React.useState(initial);
  return (
    <div data-testid="equipment-page">
      <div role="tablist" aria-label="Equipment" style={{ display: "flex", gap: 22, borderBottom: `1px solid ${Z.border}`, marginBottom: 20 }}>
        {[["assets", "Asset Register"], ["racking", "Racking"]].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`equip-tab-${k}`}
            style={{ background: "none", border: "none", borderBottom: `3px solid ${tab === k ? Z.gold : "transparent"}`, color: tab === k ? Z.white : Z.muted, fontFamily: font, fontSize: 15, fontWeight: tab === k ? 800 : 600, padding: "10px 2px", cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {tab === "assets" ? assets : racking}
    </div>
  );
}

