import React, { useState } from "react";
import { E } from "../../lib/emoji";
import { parseCompletionDate } from "./completion";
import { getExpiryStatus } from "../../lib/dates";

/**
 * Recording training done BEFORE the portal (e.g. on the old system), so staff
 * don't have to resit it. Two ways in, both on Assign Training:
 *   RecordCompletionModal     — one person, one module (Individual view)
 *   ImportPriorTrainingModal  — many at once from a CSV file (for the move)
 * Both call App.jsx recordCompletions(), which assigns the module if needed and
 * never overwrites a result the person already has. See completion.js.
 */

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmt = d => { const [y, m, day] = String(d || "").split("-"); return y && m && day ? `${day}/${m}/${y}` : String(d || ""); };

function Shell({ title, onClose, children, Z, font, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label={title} style={{ background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: `1px solid ${Z.borderMd}`, borderRadius: 18, padding: 24, width: "100%", maxWidth: wide ? 960 : 520, maxHeight: "90vh", overflowY: "auto", fontFamily: font, color: Z.white }}>
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
const btn = (Z, primary) => ({ border: primary ? "none" : `1px solid ${Z.borderMd}`, background: primary ? `linear-gradient(135deg,${Z.green},#059669)` : Z.overlay, color: primary ? "#fff" : Z.muted, borderRadius: 10, padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontSize: 13 });

/** One person, one module. onSave(date, note) → Promise<{saved, skipped}> */
function RecordCompletionModal({ person, module: m, onSave, onClose, Z, font }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ex = date && m.renewalMonths ? getExpiryStatus(date, m.renewalMonths) : null;
  async function save() {
    const iso = parseCompletionDate(date);
    if (!iso) { setErr("Enter the date they completed it. It can't be in the future."); return; }
    setBusy(true); setErr("");
    const r = await onSave(iso, note.trim());
    setBusy(false);
    if (r && r.saved) onClose();
    else setErr((r && r.skipped && r.skipped[0] && `Not recorded: ${r.skipped[0].reason}.`) || "Not recorded.");
  }
  return (
    <Shell title="Record training as completed" onClose={onClose} Z={Z} font={font}>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: Z.muted, lineHeight: 1.5 }}>
        For training <b style={{ color: Z.white }}>{person.name}</b> has already done, for example on the old system, so they don't have to resit it.
      </p>
      <div style={{ fontWeight: 800, fontSize: 15, marginTop: 10 }}>{m.icon || E("📋", "▤")} {m.title}</div>
      <label style={label(Z)} htmlFor="rc-date">Date completed *</label>
      <input id="rc-date" type="date" max={todayIso()} value={date} onChange={e => { setDate(e.target.value); setErr(""); }} style={input(Z)} />
      {ex && <div style={{ fontSize: 12, marginTop: 6, color: ex.color, fontWeight: 700 }}>
        {ex.status === "expired" ? `Already expired (${fmt(ex.expiryDate)}). ${person.name.split(" ")[0]} will be asked to redo it.` : `Valid until ${fmt(ex.expiryDate)}.`}
      </div>}
      <label style={label(Z)} htmlFor="rc-note">Note (optional)</label>
      <input id="rc-note" value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="e.g. Old system record, certificate ref. 4471" style={input(Z)} />
      <p style={{ fontSize: 12, color: Z.muted, margin: "12px 0 0", lineHeight: 1.5 }}>
        It counts as complete from that date, with no quiz score and no portal certificate. The module is assigned to them if it isn't already. Your name and today's date are recorded with it, and it appears in the Audit Trail.
      </p>
      {err && <div role="alert" style={{ color: Z.red || "#f87171", fontWeight: 700, fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={save} disabled={busy} style={btn(Z, true)}>{busy ? "Saving…" : "✓ Record as completed"}</button>
        <button onClick={onClose} style={btn(Z, false)}>Cancel</button>
      </div>
    </Shell>
  );
}

// ── CSV ──────────────────────────────────────────────────────────────────────
/** Minimal CSV parser: commas or semicolons, "quoted, fields", "" escapes, CRLF. */
export function parseCsv(text) {
  const t = String(text || "").replace(/^﻿/, "");
  const firstLine = t.split(/\r?\n/)[0] || "";
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}

const norm = s => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const COLS = {
  email: ["email", "email address", "sign in", "signin", "login", "username"],
  name: ["name", "full name", "staff name", "employee", "employee name"],
  module: ["module", "module title", "course", "course title", "training", "module id"],
  date: ["date", "completed", "date completed", "completion date", "completed on"],
  note: ["note", "notes", "comment", "comments", "reference", "certificate", "cert ref"],
};

/**
 * Match CSV rows to staff and modules. Returns { rows: [...], error }.
 * Each row: { line, raw, user, module, date, note, status: "ok"|"skip"|"error", reason, expired }
 */
export function matchPriorTraining(text, { users, modules, comps }) {
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [], error: "The file needs a header row and at least one row of training." };
  const head = grid[0].map(norm);
  const col = {};
  Object.entries(COLS).forEach(([k, names]) => { const i = head.findIndex(h => names.includes(h)); if (i >= 0) col[k] = i; });
  if (col.module === undefined || col.date === undefined || (col.email === undefined && col.name === undefined))
    return { rows: [], error: "Couldn't find the columns. The header row needs: email (or name), module, date — and optionally note." };
  const byEmail = new Map(), byName = new Map();
  users.forEach(u => { if (u.email) byEmail.set(String(u.email).trim().toLowerCase(), u); const n = norm(u.name); byName.set(n, byName.has(n) ? "dup" : u); });
  const byTitle = new Map(); modules.forEach(m => { byTitle.set(norm(m.title), m); byTitle.set(norm(m.id), m); });
  const seen = new Set();
  const rows = grid.slice(1).map((r, i) => {
    const get = k => col[k] === undefined ? "" : String(r[col[k]] || "").trim();
    const out = { line: i + 2, email: get("email"), name: get("name"), moduleText: get("module"), dateText: get("date"), note: get("note") };
    let u = out.email ? byEmail.get(out.email.toLowerCase()) : null;
    if (!u && out.name) { const hit = byName.get(norm(out.name)); if (hit === "dup") return { ...out, status: "error", reason: "Two staff have this name — use their email" }; u = hit || null; }
    if (!u) return { ...out, status: "error", reason: "Person not found" };
    const m = byTitle.get(norm(out.moduleText));
    if (!m) return { ...out, user: u, status: "error", reason: "Module not found" };
    const date = parseCompletionDate(out.dateText);
    if (!date) return { ...out, user: u, module: m, status: "error", reason: "Date not recognised, or in the future" };
    const key = `${u.id}|${m.id}`;
    if (seen.has(key)) return { ...out, user: u, module: m, date, status: "skip", reason: "Listed twice — first row used" };
    seen.add(key);
    if ((comps[u.id] || {})[m.id]) return { ...out, user: u, module: m, date, status: "skip", reason: "Already has a result for this module" };
    const ex = m.renewalMonths ? getExpiryStatus(date, m.renewalMonths) : null;
    return { ...out, user: u, module: m, date, status: "ok", expired: !!(ex && ex.status === "expired"), expires: ex ? ex.expiryDate : "" };
  });
  return { rows, error: "" };
}

/** Many rows from a CSV file. onImport(items) → Promise<{saved, skipped}> */
function ImportPriorTrainingModal({ users, modules, comps, onImport, onClose, Z, font }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const ok = (rows || []).filter(r => r.status === "ok");
  const bad = (rows || []).filter(r => r.status !== "ok");

  function template() {
    const u = users.find(x => x.email) || { email: "jane.smith@example.com" };
    const m1 = modules[0] || { title: "Fire Safety Fundamentals" }, m2 = modules[1] || m1;
    const csv = `email,module,date,note\n${u.email},${m1.title},14/03/2025,Old system record\n${u.email},${m2.title},02/09/2024,\n`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "prior_training_template.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function load(file) {
    if (!file) return;
    setFileName(file.name); setErr(""); setDone(null);
    const r = new FileReader();
    r.onload = ev => { const res = matchPriorTraining(ev.target.result, { users, modules, comps }); setErr(res.error); setRows(res.error ? null : res.rows); };
    r.readAsText(file);
  }
  async function go() {
    if (!ok.length) return;
    if (!window.confirm(`Record ${ok.length} completion${ok.length !== 1 ? "s" : ""} as done before the portal?`)) return;
    setBusy(true);
    const res = await onImport(ok.map(r => ({ userId: r.user.id, moduleId: r.module.id, date: r.date, note: r.note })));
    setBusy(false); setDone(res); setRows(null);
  }
  const cell = { padding: "6px 8px", borderBottom: `1px solid ${Z.border}`, fontSize: 12, verticalAlign: "top" };
  return (
    <Shell title="Import training done before the portal" onClose={onClose} Z={Z} font={font} wide>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: Z.muted, lineHeight: 1.6 }}>
        Use this when moving from the old system, so staff don't resit training they've already done. Each row records one module as completed on the date given: it counts as complete from that date (and expires as normal), with no quiz score and no portal certificate. The module is assigned if needed. Anyone who already has a result for that module is skipped.
      </p>
      <div style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 12, padding: "10px 14px", fontSize: 12, color: Z.muted, lineHeight: 1.6, marginBottom: 12 }}>
        <b style={{ color: Z.white }}>CSV columns:</b> <code>email</code> (their portal sign-in; or <code>name</code>), <code>module</code> (the title as shown in the portal), <code>date</code> (e.g. 14/03/2025), and optionally <code>note</code>. In Excel: File → Save As → CSV.
        <div style={{ marginTop: 6 }}>Module titles: {modules.map(m => m.title).join(" · ")}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ ...btn(Z, true), background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, display: "inline-block" }}>
          {E("📂 ", "")}Choose CSV file
          <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => { load(e.target.files[0]); e.target.value = ""; }} />
        </label>
        <button onClick={template} style={btn(Z, false)}>{E("⬇ ", "")}Download template</button>
        {fileName && <span style={{ fontSize: 12, color: Z.muted }}>{fileName}</span>}
      </div>
      {err && <div role="alert" style={{ color: Z.red || "#f87171", fontWeight: 700, fontSize: 13, marginTop: 12 }}>{err}</div>}
      {done && (
        <div role="status" style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 13 }}>
          <b style={{ color: Z.green }}>✓ {done.saved} completion{done.saved !== 1 ? "s" : ""} recorded.</b>
          {done.skipped && done.skipped.length > 0 && <span style={{ color: Z.muted }}> {done.skipped.length} not recorded: {done.skipped.map(s => s.reason).join("; ")}.</span>}
        </div>
      )}
      {rows && (
        <>
          <div style={{ display: "flex", gap: 14, margin: "16px 0 8px", fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: Z.green }}>{ok.length} ready</span>
            {bad.length > 0 && <span style={{ color: Z.amber || "#f59e0b" }}>{bad.length} won't be imported</span>}
            {ok.some(r => r.expired) && <span style={{ color: Z.muted, fontWeight: 600 }}>{ok.filter(r => r.expired).length} already expired (they'll be asked to redo them)</span>}
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto", border: `1px solid ${Z.border}`, borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Row", "Person", "Module", "Completed", "Note", "Result"].map(h => <th key={h} style={{ ...cell, textAlign: "left", color: Z.muted, fontSize: 11, position: "sticky", top: 0, background: Z.navyMd }}>{h}</th>)}</tr></thead>
              <tbody>
                {[...bad, ...ok].map(r => (
                  <tr key={r.line} data-status={r.status}>
                    <td style={{ ...cell, color: Z.muted }}>{r.line}</td>
                    <td style={cell}>{r.user ? r.user.name : (r.email || r.name)}</td>
                    <td style={cell}>{r.module ? r.module.title : r.moduleText}</td>
                    <td style={cell}>{r.date ? fmt(r.date) : r.dateText}</td>
                    <td style={{ ...cell, color: Z.muted }}>{r.note}</td>
                    <td style={{ ...cell, fontWeight: 700, color: r.status === "ok" ? (r.expired ? (Z.amber || "#f59e0b") : Z.green) : r.status === "skip" ? Z.muted : (Z.red || "#f87171") }}>
                      {r.status === "ok" ? (r.expired ? `Ready · expired ${fmt(r.expires)}` : r.expires ? `Ready · valid to ${fmt(r.expires)}` : "Ready") : r.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={go} disabled={busy || !ok.length} style={{ ...btn(Z, true), opacity: ok.length ? 1 : .5 }}>{busy ? "Recording…" : `✓ Record ${ok.length} completion${ok.length !== 1 ? "s" : ""}`}</button>
            <button onClick={onClose} style={btn(Z, false)}>Cancel</button>
          </div>
        </>
      )}
    </Shell>
  );
}


// ── Group session / toolbox talk ─────────────────────────────────────────────
/**
 * GroupSessionModal — a supervisor (admin, or a line manager for their own team)
 * records that a group of people completed a module together, e.g. a toolbox
 * talk or classroom session. Each attendee gets a recorded completion dated the
 * day of the session (see completion.js), with who led it and where.
 * A result OLDER than the session is replaced (a refresher renews it); a newer
 * one is left alone. "Print sign-in sheet" gives a paper list to sign on the day.
 *
 * props: people (who can be ticked), modules, comps, leaderName,
 *        onSave(items) → Promise<{saved, skipped}>, onClose, Z, font
 */
function GroupSessionModal({ people, modules, comps, leaderName, onSave, onClose, Z, font }) {
  const [mid, setMid] = useState(modules[0] ? modules[0].id : "");
  const [date, setDate] = useState(todayIso());
  const [leader, setLeader] = useState(leaderName || "");
  const [where, setWhere] = useState("");
  const [picked, setPicked] = useState({});
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const m = modules.find(x => String(x.id) === String(mid));
  const list = people.filter(u => !q || `${u.name} ${u.jobTitle || ""} ${u.manager || ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(a.manager || "").localeCompare(String(b.manager || "")) || a.name.localeCompare(b.name));
  const chosen = people.filter(u => picked[u.id]);
  const statusOf = u => {
    const c = (comps[u.id] || comps[String(u.id)] || {})[mid];
    if (!c) return { text: "Not done", newer: false };
    const ex = m && m.renewalMonths ? getExpiryStatus(c.date, m.renewalMonths) : null;
    const iso = parseCompletionDate(date);
    return { text: `${c.recorded ? "Recorded" : `${c.score}%`} · ${fmt(c.date)}${ex && ex.status === "expired" ? " · expired" : ""}`, newer: !!(iso && c.date >= iso) };
  };
  const toggleAll = on => setPicked(p => { const n = { ...p }; list.forEach(u => { n[u.id] = on; }); return n; });

  function printSheet() {
    const who = chosen.length ? chosen : list;
    const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const w = window.open("", "_blank");
    if (!w) { alert("Allow pop-ups for this site to print the sheet."); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign-in sheet — ${esc(m ? m.title : "")}</title>
      <style>body{font-family:Arial,sans-serif;padding:28px;color:#0f172a}h1{font-size:20px;margin:0 0 4px}p{font-size:13px;color:#334155;margin:2px 0}
      table{border-collapse:collapse;width:100%;margin-top:16px;font-size:13px}th,td{border:1px solid #94a3b8;padding:10px 8px;text-align:left}
      th{background:#0d1f5c;color:#fff}td.sig{width:38%}tr{page-break-inside:avoid}</style></head><body>
      <h1>Training sign-in sheet</h1>
      <p><b>Module:</b> ${esc(m ? m.title : "")}</p><p><b>Date:</b> ${esc(fmt(parseCompletionDate(date) || date))}</p>
      <p><b>Led by:</b> ${esc(leader)}${where ? ` &nbsp; <b>Where:</b> ${esc(where)}` : ""}</p>
      <table><tr><th style="width:4%">#</th><th>Name</th><th>Job title</th><th>Signature</th></tr>
      ${who.map((u, i) => `<tr><td>${i + 1}</td><td>${esc(u.name)}</td><td>${esc(u.jobTitle || "")}</td><td class="sig"></td></tr>`).join("")}
      ${Array.from({ length: 3 }, (_, i) => `<tr><td>${who.length + i + 1}</td><td></td><td></td><td class="sig"></td></tr>`).join("")}
      </table><p style="margin-top:18px">Leader's signature: ______________________________</p>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }
  async function save() {
    const iso = parseCompletionDate(date);
    if (!m) { setErr("Choose the module that was covered."); return; }
    if (!iso) { setErr("Enter the session date. It can't be in the future."); return; }
    if (!leader.trim()) { setErr("Enter who led the session."); return; }
    if (!chosen.length) { setErr("Tick everyone who attended."); return; }
    setBusy(true); setErr("");
    const note = `Group session${where.trim() ? ` at ${where.trim()}` : ""}, led by ${leader.trim()}`;
    const r = await onSave(chosen.map(u => ({ userId: u.id, moduleId: m.id, date: iso, note, session: { leader: leader.trim(), where: where.trim() } })));
    setBusy(false); setDone(r); if (r && r.saved) setPicked({});
  }
  const cell = { padding: "7px 8px", borderBottom: `1px solid ${Z.border}`, fontSize: 12.5 };
  return (
    <Shell title="Record a group session or toolbox talk" onClose={onClose} Z={Z} font={font} wide>
      <p style={{ margin: "0 0 6px", fontSize: 13, color: Z.muted, lineHeight: 1.6 }}>
        For training delivered to a group in person. Everyone you tick is recorded as having completed the module on the session date, with no quiz score. It renews older results, and the module is assigned to them if needed.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div><label style={label(Z)} htmlFor="gs-mod">Module covered *</label>
          <select id="gs-mod" value={mid} onChange={e => { setMid(e.target.value); setDone(null); }} style={input(Z)}>
            {modules.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select></div>
        <div><label style={label(Z)} htmlFor="gs-date">Session date *</label>
          <input id="gs-date" type="date" max={todayIso()} value={date} onChange={e => { setDate(e.target.value); setErr(""); }} style={input(Z)} /></div>
        <div><label style={label(Z)} htmlFor="gs-lead">Led by *</label>
          <input id="gs-lead" value={leader} onChange={e => setLeader(e.target.value)} style={input(Z)} /></div>
        <div><label style={label(Z)} htmlFor="gs-where">Where (optional)</label>
          <input id="gs-where" value={where} onChange={e => setWhere(e.target.value)} placeholder="e.g. Goods-in, 7am briefing" style={input(Z)} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "16px 0 8px", flexWrap: "wrap" }}>
        <b style={{ fontSize: 13 }}>Who attended</b>
        <span style={{ fontSize: 12, color: Z.muted }}>{chosen.length} ticked</span>
        <input aria-label="Search staff" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, job or manager" style={{ ...input(Z), width: 240, padding: "7px 12px", fontSize: 12.5, marginLeft: "auto" }} />
        <button onClick={() => toggleAll(true)} style={{ ...btn(Z, false), padding: "7px 12px", fontSize: 12 }}>Tick all shown</button>
        <button onClick={() => toggleAll(false)} style={{ ...btn(Z, false), padding: "7px 12px", fontSize: 12 }}>Clear</button>
      </div>
      <div style={{ maxHeight: 300, overflowY: "auto", border: `1px solid ${Z.border}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["", "Name", "Job title", "Line manager", "This module now"].map(h => <th key={h} style={{ ...cell, textAlign: "left", color: Z.muted, fontSize: 11, position: "sticky", top: 0, background: Z.navyMd }}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map(u => { const st = statusOf(u); return (
              <tr key={u.id} onClick={() => setPicked(p => ({ ...p, [u.id]: !p[u.id] }))} style={{ cursor: "pointer", background: picked[u.id] ? "rgba(16,185,129,0.08)" : "transparent" }}>
                <td style={{ ...cell, width: 30 }}><input type="checkbox" aria-label={u.name} checked={!!picked[u.id]} onChange={() => {}} /></td>
                <td style={{ ...cell, fontWeight: 700 }}>{u.name}</td>
                <td style={{ ...cell, color: Z.muted }}>{u.jobTitle || ""}</td>
                <td style={{ ...cell, color: Z.muted }}>{u.manager || ""}</td>
                <td style={{ ...cell, color: st.newer ? Z.muted : Z.white }}>{st.text}{st.newer ? " (newer — kept)" : ""}</td>
              </tr>); })}
            {!list.length && <tr><td colSpan={5} style={{ ...cell, color: Z.muted }}>Nobody matches.</td></tr>}
          </tbody>
        </table>
      </div>
      {err && <div role="alert" style={{ color: Z.red || "#f87171", fontWeight: 700, fontSize: 13, marginTop: 12 }}>{err}</div>}
      {done && (
        <div role="status" style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 13 }}>
          <b style={{ color: Z.green }}>✓ {done.saved} attendee{done.saved !== 1 ? "s" : ""} recorded.</b>
          {done.skipped && done.skipped.length > 0 && <span style={{ color: Z.muted }}> {done.skipped.length} not recorded: {done.skipped.map(x => `${(people.find(u => String(u.id) === String(x.userId)) || {}).name || x.userId} (${x.reason})`).join("; ")}.</span>}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={save} disabled={busy} style={btn(Z, true)}>{busy ? "Saving…" : `✓ Record attendance${chosen.length ? ` for ${chosen.length}` : ""}`}</button>
        <button onClick={printSheet} style={btn(Z, false)}>{E("🖨 ", "")}Print sign-in sheet</button>
        <button onClick={onClose} style={{ ...btn(Z, false), marginLeft: "auto" }}>Close</button>
      </div>
    </Shell>
  );
}

export { RecordCompletionModal, ImportPriorTrainingModal, GroupSessionModal };
