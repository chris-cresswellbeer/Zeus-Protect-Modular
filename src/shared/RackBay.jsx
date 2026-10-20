/**
 * RackBay — one racking bay (ground location), as opened by scanning its QR label
 * (<portal>/?rack=03-12): what's already reported there, "Report new damage" (levels,
 * part, photos, SEMA rating, note), "Seen it again", and for racking inspectors (admins and
 * Machinery & Equipment access) confirm the rating, mark offloaded, book and record the
 * repair, or close a report made by mistake. Used on the phone (mobile/MobileApp.jsx) and
 * in a window on the portal (domains/racking/RackingTab.jsx, app/siteBars.jsx for ?rack= links).
 * Rules: lib/racking.js. Saving: lib/rackClient.js. A red report emails straight away.
 */
import React from "react";
import { RATINGS, PARTS, newDamage, seenAgain, confirmRating, markOffloaded, bookRepair, recordRepair, dismissDamage, damageState, bayName } from "../lib/racking";
import { saveDamage, freshDamage, uploadRackPhoto, pingRacking } from "../lib/rackClient";
import { auditEvent } from "../lib/audit";
import { ask, notify } from "./Feedback";
import { t } from "../lib/i18n";

const ukdt = iso => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "");
const ukd = iso => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const TONE = { red: ["#fca5a5", "rgba(248,113,113,0.16)", "rgba(248,113,113,0.5)"], amber: ["#fbbf24", "rgba(245,158,11,0.14)", "rgba(245,158,11,0.45)"], green: ["#34d399", "rgba(16,185,129,0.13)", "rgba(16,185,129,0.35)"], grey: ["#cbd5e1", "rgba(148,163,184,0.12)", "rgba(148,163,184,0.3)"] };
export function RateChip({ state, small }) {
  const [c, bg, bd] = TONE[state.tone] || TONE.grey;
  return <span data-state={state.key} style={{ fontSize: small ? 11.5 : 12, fontWeight: 800, color: c, background: bg, border: `1px solid ${bd}`, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{state.label}</span>;
}

function PhotoPicker({ photos, setPhotos, draftId, busy, setBusy, Z, font, testid, label }) {
  const input = React.useRef(null);
  async function pick(e) {
    const files = [...(e.target.files || [])].slice(0, 6 - photos.length); e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    const urls = [];
    for (const f of files) { const u = await uploadRackPhoto(f, draftId); if (u) urls.push(u); }
    setBusy(false);
    if (urls.length < files.length) notify(t("A photo couldn't be uploaded. Check your signal and try again."), { kind: "error" });
    setPhotos(p => [...p, ...urls]);
  }
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {photos.map((u, i) => (
        <span key={u} style={{ position: "relative" }}>
          <img src={u} alt={`${t("Photo")} ${i + 1}`} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12, display: "block" }}/>
          <button type="button" aria-label={`${t("Remove photo")} ${i + 1}`} onClick={() => setPhotos(p => p.filter(x => x !== u))} style={{ position: "absolute", top: 4, right: 4, width: 28, height: 28, borderRadius: 14, border: "none", background: "rgba(0,0,0,.65)", color: "#fff", cursor: "pointer" }}>✕</button>
        </span>
      ))}
      {photos.length < 6 && (
        <button type="button" onClick={() => input.current && input.current.click()} disabled={busy} data-testid={testid}
          style={{ width: 96, height: 96, borderRadius: 12, border: `2px dashed ${Z.accentLt}99`, background: "transparent", color: Z.accentLt, fontFamily: font, fontSize: 13, fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
          {busy ? t("Uploading…") : label || t("Take photo")}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" capture="environment" multiple onChange={pick} data-testid={`${testid}-input`} style={{ display: "none" }}/>
    </div>
  );
}

export function RackBay({ code, loc, damage, user, isInspector, settings, Z, font, onReported }) {
  const open = damage.filter(r => r.location_id === code && r.status === "open").sort((a, b) => ({ red: 0, amber: 1, green: 2 }[a.rating] - { red: 0, amber: 1, green: 2 }[b.rating]) || String(b.created_at).localeCompare(String(a.created_at)));
  const closed = damage.filter(r => r.location_id === code && r.status !== "open").sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 5);
  const red = open.find(r => r.rating === "red");
  const [mode, setMode] = React.useState(null);           // null | "report" | { repair: row } | { seen: row }
  const [levels, setLevels] = React.useState([]);
  const [part, setPart] = React.useState("");
  const [rating, setRating] = React.useState("");
  const [note, setNote] = React.useState("");
  const [photos, setPhotos] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const draftId = React.useMemo(() => `rk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setMode(null); setLevels([]); setPart(""); setRating(""); setNote(""); setPhotos([]); setErr(""); };
  const lv = (loc && loc.data && loc.data.levels) || settings.defaultLevels;
  const lbl = { display: "block", fontSize: 12, fontWeight: 800, letterSpacing: .8, textTransform: "uppercase", color: Z.muted, margin: "0 0 8px" };
  const pill = on => ({ minHeight: 48, borderRadius: 12, fontFamily: font, fontSize: 14.5, fontWeight: 700, color: Z.white, padding: "0 12px", cursor: "pointer", background: on ? `${Z.accent}44` : Z.overlay, border: `2px solid ${on ? Z.accent : Z.borderMd}` });
  const btn = kind => ({ minHeight: 50, borderRadius: 14, border: kind === "plain" ? `1px solid ${Z.borderMd}` : "none", background: kind === "red" ? "#dc2626" : kind === "green" ? "#059669" : kind === "blue" ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay, color: kind === "plain" ? Z.white : "#fff", fontFamily: font, fontSize: 15.5, fontWeight: 800, cursor: "pointer", padding: "0 16px" });
  const small = { fontFamily: font, fontSize: 12.5, fontWeight: 700, color: Z.white, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 9, padding: "7px 11px", minHeight: 36, cursor: "pointer" };
  const inp = { width: "100%", boxSizing: "border-box", background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "12px 14px", color: Z.white, fontFamily: font, fontSize: 15 };

  if (!loc) return <div data-testid="rack-unknown" style={{ fontFamily: font, color: Z.white, fontSize: 15, lineHeight: 1.5 }}>{t("Bay {code} isn't in the racking list. Tell the H&S team, and report the damage to your supervisor.", { code })}</div>;

  async function update(row, make, auditText) {
    setBusy(true); setErr("");
    const cur = (await freshDamage(row.id)) || row;
    const next = make(cur);
    const e = await saveDamage(next);
    setBusy(false);
    if (e) { setErr(`${t("That didn't save.")} ${e}`); return false; }
    auditEvent("racking", row.id, "update", auditText, {}, bayName(loc));
    if (next.rating === "red" && !(next.data || {}).alertedAt) pingRacking();
    return true;
  }
  async function submit() {
    if (!levels.length) { setErr(t("Choose the level (or levels).")); return; }
    if (!part) { setErr(t("Choose what's damaged.")); return; }
    if (!rating) { setErr(t("Choose how bad it looks (amber if you're not sure).")); return; }
    setBusy(true); setErr("");
    const row = { ...newDamage({ loc, levels, part, rating, note, photos, user }), id: draftId };
    const e = await saveDamage(row, { isNew: true });
    setBusy(false);
    if (e) { setErr(`${t("That didn't save. Check your signal and try again.")} (${e})`); return; }
    auditEvent("racking", row.id, "create", `Racking damage reported: ${bayName(loc)}, level ${levels.join("/")}, ${part} (${rating})`, {}, bayName(loc));
    if (rating === "red") pingRacking();
    notify(rating === "red" ? t("Reported. The warehouse manager and H&S team have been alerted: keep everyone clear.") : t("Reported. Thank you."));
    reset(); onReported && onReported(row);
  }

  // ── Report new damage ──
  if (mode === "report") return (
    <div data-testid="rack-report" style={{ fontFamily: font, color: Z.white, display: "flex", flexDirection: "column", gap: 18 }}>
      {open.length > 0 && <div style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 14, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.45 }}>
        <b>{t("Already reported here:")}</b> {open.map(r => `${t("level")} ${r.data.levels.join("/")} ${r.data.part.toLowerCase()} (${r.rating})`).join("; ")}. {t("If it's the same damage, go back and tap Seen it again instead.")}</div>}
      <div>
        <span style={lbl}>1 · {t("Which level?")}</span>
        <div style={{ display: "flex", gap: 14 }}>
          <div role="group" aria-label={t("Which level?")} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {[...lv].reverse().map((l, i, a) => { const on = levels.includes(l); return (
              <button key={l} type="button" aria-pressed={on} onClick={() => setLevels(s => (on ? s.filter(x => x !== l) : [...s, l]))} data-testid={`rack-level-${l}`}
                style={{ ...pill(on), display: "flex", alignItems: "center", gap: 10, textAlign: "left", minHeight: 46 }}>
                <span style={{ fontSize: 20, fontWeight: 900, width: 28 }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: Z.muted }}>{i === a.length - 1 ? t("Ground level") : i === 0 ? t("Top") : ""}</span>
              </button>); })}
          </div>
          <div aria-hidden="true" style={{ width: 84, borderLeft: "4px solid #f59e0b", borderRight: "4px solid #f59e0b", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "6px 0" }}>
            {[...lv].reverse().map(l => <div key={l} style={{ height: 6, margin: "0 -4px", background: levels.includes(l) ? "#ef4444" : "#f97316", opacity: levels.includes(l) ? 1 : .5 }}/>)}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 6 }}>{t("{l} is the ground level. Tick more than one if the damage spans levels.", { l: lv[0] })}</div>
      </div>
      <div>
        <span style={lbl}>2 · {t("What's damaged?")}</span>
        <div role="group" aria-label={t("What's damaged?")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {PARTS.map(p => <button key={p} type="button" aria-pressed={part === p} onClick={() => setPart(p)} data-testid={`rack-part-${PARTS.indexOf(p)}`} style={pill(part === p)}>{t(p)}</button>)}
        </div>
      </div>
      <div>
        <span style={lbl}>3 · {t("Photo")}</span>
        <PhotoPicker photos={photos} setPhotos={setPhotos} draftId={draftId} busy={busy} setBusy={setBusy} Z={Z} font={font} testid="rack-photo"/>
      </div>
      <div>
        <span style={lbl}>4 · {t("How bad does it look?")}</span>
        <div role="radiogroup" aria-label={t("How bad does it look?")} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RATINGS.map(r => (
            <button key={r.id} type="button" role="radio" aria-checked={rating === r.id} onClick={() => setRating(r.id)} data-testid={`rack-rating-${r.id}`}
              style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 58, padding: "8px 14px", borderRadius: 12, fontFamily: font, color: Z.white, textAlign: "left", cursor: "pointer", background: rating === r.id ? `${r.colour}2e` : Z.overlay, border: `2px solid ${rating === r.id ? r.colour : Z.borderMd}` }}>
              <span style={{ width: 18, height: 18, borderRadius: 9, background: r.colour, flexShrink: 0 }}/>
              <span><span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>{t(r.label)}</span><span style={{ display: "block", fontSize: 12.5, color: Z.muted, fontWeight: 500 }}>{t(r.help)}</span></span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 6 }}>{t("Not sure? Choose amber. The racking inspector confirms it.")}</div>
      </div>
      <div>
        <label style={lbl} htmlFor="rack-note">5 · {t("Note (optional)")}</label>
        <input id="rack-note" value={note} onChange={e => setNote(e.target.value)} maxLength={400} placeholder={t("e.g. upright dented at the front, about knee height")} data-testid="rack-note" style={inp}/>
      </div>
      {err && <div role="alert" style={{ color: "#f87171", fontWeight: 700, fontSize: 13.5 }}>{err}</div>}
      <button type="button" onClick={submit} disabled={busy} data-testid="rack-submit" style={{ ...btn(rating === "red" ? "red" : "blue"), minHeight: 56, fontSize: 17, opacity: busy ? .6 : 1 }}>{busy ? t("Saving…") : t("Report damage")}</button>
      <button type="button" onClick={reset} style={{ background: "none", border: "none", color: Z.muted, fontFamily: font, fontSize: 14, fontWeight: 700, minHeight: 44, cursor: "pointer" }}>{t("Cancel")}</button>
      <div style={{ fontSize: 12.5, color: Z.muted, textAlign: "center", lineHeight: 1.45 }}>{t("Red damage: keep everyone clear and tell your supervisor now as well. The warehouse manager and H&S team are emailed straight away.")}</div>
    </div>
  );

  // ── Record a repair (inspectors) ──
  if (mode && mode.repair) { const row = mode.repair; return (
    <div data-testid="rack-repair" style={{ fontFamily: font, color: Z.white, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{t("Record repair")}: {t("level")} {row.data.levels.join("/")} · {t(row.data.part)}</div>
      <div><label style={lbl} htmlFor="rack-rep-note">{t("What was done")}</label>
        <input id="rack-rep-note" value={note} onChange={e => setNote(e.target.value)} maxLength={400} placeholder={t("e.g. upright section replaced by the racking contractor")} data-testid="rack-repair-note" style={inp}/></div>
      <div><span style={lbl}>{t("Photo after the repair")}</span><PhotoPicker photos={photos} setPhotos={setPhotos} draftId={row.id} busy={busy} setBusy={setBusy} Z={Z} font={font} testid="rack-repair-photo"/></div>
      {err && <div role="alert" style={{ color: "#f87171", fontWeight: 700, fontSize: 13.5 }}>{err}</div>}
      <button type="button" disabled={busy} data-testid="rack-repair-save" style={{ ...btn("green"), opacity: busy ? .6 : 1 }}
        onClick={async () => { if (!note.trim()) { setErr(t("Say what was done.")); return; } if (await update(row, cur => recordRepair(cur, { by: user.name, note, photos }), `Racking repair recorded: ${bayName(loc)} level ${row.data.levels.join("/")} (${note})`)) { notify(t("Repair recorded.")); reset(); } }}>
        {busy ? t("Saving…") : t("Save repair")}</button>
      <button type="button" onClick={reset} style={{ background: "none", border: "none", color: Z.muted, fontFamily: font, fontSize: 14, fontWeight: 700, minHeight: 44, cursor: "pointer" }}>{t("Cancel")}</button>
    </div>
  ); }

  // ── The bay ──
  return (
    <div data-testid="rack-bay" style={{ fontFamily: font, color: Z.white, display: "flex", flexDirection: "column", gap: 14 }}>
      {red && (
        <div role="alert" data-testid="rack-red" style={{ background: "#b91c1c", borderRadius: 16, padding: 18, textAlign: "center" }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>
          <div style={{ fontSize: 25, fontWeight: 900, letterSpacing: .5, marginTop: 4, color: "#fff" }}>{t("RED: DO NOT USE")}</div>
          <div style={{ fontSize: 14.5, marginTop: 4, lineHeight: 1.4, color: "#fff" }}>{t("Don't load or pick from this bay. Keep clear until a repair is recorded.")}</div>
        </div>
      )}
      {!open.length && <div data-testid="rack-clear" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 14, padding: "14px 16px", fontSize: 14.5 }}>{t("No damage reported on this bay.")}</div>}
      {open.map(r => { const d = r.data; const st = damageState(r, settings); return (
        <div key={r.id} data-testid="rack-damage" style={{ background: Z.navyMd, border: `1px solid ${Z.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <b style={{ fontSize: 15.5 }}>{t("Level")} {d.levels.join("–")} · {t(d.part)}</b><RateChip state={st}/>
          </div>
          <div style={{ fontSize: 13, color: Z.muted, marginTop: 4, lineHeight: 1.5 }}>
            {d.note ? <>"{d.note}"<br/></> : null}
            {t("Reported by {name}", { name: d.reportedBy })} {ukdt(d.reportedAt)}.
            {d.confirmedAt ? ` ${t("Confirmed by {name}", { name: d.confirmedBy })}.` : ` ${t("Not confirmed by the racking inspector yet.")}`}
            {d.offloadedAt ? ` ${t("Offloaded")} ${ukdt(d.offloadedAt)}.` : ""}
            {(d.seenAgain || []).length ? ` ${t("Seen again {n}×", { n: d.seenAgain.length })}.` : ""}
          </div>
          {(d.photos || []).length > 0 && <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>{d.photos.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`${t("Photo")} ${i + 1}`} style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 10, display: "block" }}/></a>)}</div>}
          {r.rating === "red" && d.repairBooked && <div style={{ fontSize: 13, color: "#fbbf24", marginTop: 8, fontWeight: 700 }}>{t("Repair booked: {date}", { date: ukd(d.repairBooked) })}</div>}
          {r.rating === "amber" && <div style={{ fontSize: 13, color: st.late ? "#fca5a5" : Z.muted, marginTop: 6, fontWeight: 700 }}>{t("Repair by {date}", { date: ukd(st.due) })}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" style={small} data-testid="rack-seen" disabled={busy} onClick={async () => {
              const v = await ask({ title: t("Seen it again?"), message: t("Adds your name and the time to this report, so the racking inspector knows it's still there (or worse)."), ok: t("Add"), fields: [{ id: "note", label: t("Anything new? (optional)"), placeholder: t("e.g. looks worse, more bent") }] });
              if (v) { const ok = await update(r, cur => seenAgain(cur, { user, note: v.note || "" }), `Racking damage seen again: ${bayName(loc)}${v.note ? ` (${v.note})` : ""}`); if (ok) notify(t("Added. Thank you.")); }
            }}>{t("Seen it again")}</button>
            {isInspector && <>
              <button type="button" style={small} data-testid="rack-confirm" disabled={busy} onClick={async () => {
                const v = await ask({ title: "Confirm the rating", message: "Red: offload now and isolate. Amber: repair within 4 weeks, don't reload once empty. Green: within limits, monitor at the weekly check.", ok: "Save",
                  fields: [{ id: "rating", label: "Rating", options: RATINGS.map(x => ({ value: x.id, label: x.label })), value: r.rating, required: true }, { id: "note", label: "Note (optional)" }] });
                if (v) await update(r, cur => confirmRating(cur, { rating: v.rating, by: user.name, note: v.note || "" }), `Racking damage rating ${v.rating === r.rating ? "confirmed" : `changed to ${v.rating}`}: ${bayName(loc)}`);
              }}>{d.confirmedAt ? "Change rating" : "Confirm rating"}</button>
              {r.rating === "red" && !d.offloadedAt && <button type="button" style={small} data-testid="rack-offloaded" disabled={busy} onClick={() => update(r, cur => markOffloaded(cur, { by: user.name }), `Racking bay offloaded: ${bayName(loc)}`)}>Mark offloaded</button>}
              <button type="button" style={small} data-testid="rack-book" disabled={busy} onClick={async () => {
                const v = await ask({ title: "Book the repair", ok: "Save", fields: [{ id: "date", label: "Repair date", type: "date", value: d.repairBooked || "", required: true }] });
                if (v) await update(r, cur => bookRepair(cur, { by: user.name, date: v.date }), `Racking repair booked: ${bayName(loc)} for ${v.date}`);
              }}>Book repair</button>
              <button type="button" style={{ ...small, background: "rgba(16,185,129,0.18)", borderColor: "rgba(16,185,129,0.5)" }} data-testid="rack-repair-btn" onClick={() => { reset(); setMode({ repair: r }); }}>Record repair</button>
              <button type="button" style={{ ...small, background: "none", border: "none", color: Z.muted }} data-testid="rack-dismiss" disabled={busy} onClick={async () => {
                const v = await ask({ title: "Close without a repair?", message: "For a report made by mistake, or damage that turned out to be nothing. It stays in the history.", ok: "Close it", fields: [{ id: "why", label: "Why", required: true }] });
                if (v) await update(r, cur => dismissDamage(cur, { by: user.name, why: v.why }), `Racking damage closed without repair: ${bayName(loc)} (${v.why})`);
              }}>Close</button>
            </>}
          </div>
        </div>
      ); })}
      {err && <div role="alert" style={{ color: "#f87171", fontWeight: 700, fontSize: 13.5 }}>{err}</div>}
      <button type="button" onClick={() => { reset(); setMode("report"); }} data-testid="rack-new" style={btn(open.length ? "plain" : "blue")}>{t("Report new damage here")}</button>
      {closed.length > 0 && (
        <details style={{ fontSize: 13, color: Z.muted }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, padding: "6px 0" }}>{t("Earlier damage on this bay ({n})", { n: closed.length })}</summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
            {closed.map(r => <li key={r.id}>{ukd(r.data.reportedAt)} · {t("level")} {r.data.levels.join("/")} {t(r.data.part).toLowerCase()} ({r.rating}) · {r.status === "repaired" ? `${t("repaired")} ${ukd(r.data.repair && r.data.repair.at)}` : t("closed")}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
