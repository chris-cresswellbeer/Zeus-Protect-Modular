/**
 * domains/training/TranslationsPanel.jsx — Training → module Preview → Translations (admins)
 *
 * For each language (lib/i18n.js LANGUAGES) shows whether the module has been
 * translated, and lets an admin:
 *   • Translate (or translate again) — the English is sent to DeepL by the
 *     zp-translate Netlify function; the result is saved as "Machine translated".
 *   • Compare — English and the translation side by side, for a bilingual checker.
 *   • Mark as checked — records who checked it and when.
 *   • Remove — staff then see the English.
 * When the English changes, a translation shows as "Out of date" and staff see the
 * English until it is translated again (lib/moduleTranslate.js).
 *
 * Props: m (module, as in allModules), allModules, translations (moduleTrans map),
 *   onSave(row), onDelete(moduleId, lang), user, T, font.
 */
import React from "react";
import { LANGUAGES } from "../../lib/i18n";
import { translateCall, AUTH_MODE } from "../../lib/auth";
import { moduleTexts, flattenTexts, rebuildTexts, sourceHash, translationState, translationKey } from "../../lib/moduleTranslate";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { isHtmlContent } from "./slideTextUtils";
import { auditEvent } from "../../lib/audit";
import { notify, ask } from "../../shared/Feedback";

const TARGETS = LANGUAGES.filter(l => l.code !== "en");
const fmtDate = d => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

const STATE = {
  none:    { label: "Not translated",                     col: "#94a3b8" },
  machine: { label: "Machine translated — not yet checked", col: "#f59e0b" },
  checked: { label: "Checked",                            col: "#10b981" },
  stale:   { label: "Out of date — the English has changed", col: "#ef4444" },
};

/** Translate one module into one language and return the row to save. */
export async function translateModule(mod, lang) {
  const texts = moduleTexts(mod);
  const pieces = flattenTexts(texts);
  const r = await translateCall("translate", { target: lang, items: pieces.map(p => ({ text: p.text, html: p.html })) });
  if (!r.ok) return { ok: false, error: r.error };
  const data = rebuildTexts(texts, pieces, r.translations || []);
  return {
    ok: true, chars: r.chars || 0,
    row: { module_id: String(mod.id), lang, data, source_hash: sourceHash(mod), status: "machine",
           translated_at: new Date().toISOString(), checked_by: null, checked_at: null },
  };
}

export function TranslationsPanel({ m: given, allModules = [], translations = {}, onSave, onDelete, user, langsInUse = [], T, font }) {
  // Use the module exactly as staff get it (company name filled in), so the fingerprint matches.
  const m = allModules.find(x => String(x.id) === String(given.id)) || given;
  const [busy, setBusy] = React.useState("");          // "fr" | "all" | "" …
  const [status, setStatus] = React.useState(null);    // translation service status
  const [compare, setCompare] = React.useState(null);  // lang being compared
  const [showAll, setShowAll] = React.useState(false); // languages nobody uses, folded away
  const supa = AUTH_MODE === "supabase";

  React.useEffect(() => {
    if (!supa) return;
    let on = true;
    translateCall("status").then(r => { if (on) setStatus(r); });
    return () => { on = false; };
  }, [supa]);

  const rowOf = lang => translations[translationKey(m.id, lang)];
  const stateOf = lang => translationState(m, rowOf(lang));

  async function run(lang) {
    setBusy(lang);
    const r = await translateModule(m, lang);
    if (!r.ok) { setBusy(""); notify(`Couldn't translate into ${langName(lang)}: ${r.error}`, { kind: "error" }); return; }
    const ok = await onSave(r.row);
    setBusy("");
    if (ok) {
      auditEvent("module", m.id, "translate", `Machine translated into ${langName(lang)}`, {}, m.title);
      notify(`Translated into ${langName(lang)}. Ask a ${langName(lang)} speaker to check it, then mark it as checked.`);
    }
  }

  // Languages someone on the staff list uses, or that this module already has, come first;
  // "Translate all" only does the languages people use (saves the DeepL allowance).
  const inUse = new Set(langsInUse);
  const shown = TARGETS.filter(l => inUse.has(l.code) || rowOf(l.code));
  const folded = TARGETS.filter(l => !shown.includes(l));
  async function runAll() {
    const todo = TARGETS.filter(l => inUse.has(l.code) && (stateOf(l.code) === "none" || stateOf(l.code) === "stale")).map(l => l.code);
    for (const code of todo) { await run(code); }
  }

  async function markChecked(lang) {
    const row = rowOf(lang);
    if (!row) return;
    const ok = await onSave({ ...row, status: "checked", checked_by: (user && user.name) || "", checked_at: new Date().toISOString() });
    if (ok) { auditEvent("module", m.id, "translation_checked", `${langName(lang)} translation marked as checked`, {}, m.title); notify(`${langName(lang)} translation marked as checked.`); }
  }

  async function remove(lang) {
    if (!(await ask({ title: `Remove the ${langName(lang)} translation?`, message: "Staff who use this language will see the module in English until it's translated again.", ok: "Remove translation", danger: true }))) return;
    const ok = await onDelete(m.id, lang);
    if (ok) { auditEvent("module", m.id, "translation_removed", `${langName(lang)} translation removed`, {}, m.title); if (compare === lang) setCompare(null); }
  }

  const btn = (primary, danger) => ({
    background: primary ? `linear-gradient(135deg,${T.accent},${T.blue})` : T.overlay, color: primary ? "#fff" : danger ? "#f87171" : T.white,
    border: primary ? "none" : `1px solid ${danger ? "rgba(239,68,68,0.4)" : T.borderMd}`, borderRadius: 9, padding: "7px 13px",
    cursor: busy ? "wait" : "pointer", fontFamily: font, fontWeight: 700, fontSize: 12, opacity: busy ? 0.6 : 1, whiteSpace: "nowrap",
  });

  if (compare) return <CompareView m={m} row={rowOf(compare)} lang={compare} onBack={() => setCompare(null)}
    onMarkChecked={() => markChecked(compare)} T={T} font={font} btn={btn} />;

  const needAll = TARGETS.filter(l => inUse.has(l.code) && (stateOf(l.code) === "none" || stateOf(l.code) === "stale")).length;
  return (
    <div data-testid="translations-panel">
      <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, margin: "0 0 14px" }}>
        Staff who have chosen another language see this module in it once it's translated here.
        The English stays the official version. Machine translations should be read by a bilingual member of staff
        and marked as checked — safety wording matters.
      </p>
      {!supa && <Note T={T} col="#f59e0b">Translation needs the new sign-in (Supabase sign-in mode).</Note>}
      {supa && status && !status.ok && <Note T={T} col="#ef4444">{status.error}</Note>}
      {supa && status && status.ok && !status.configured && (
        <Note T={T} col="#f59e0b">Translation isn't set up yet. Add <b>DEEPL_API_KEY</b> in Netlify (Site configuration → Environment variables), then redeploy. See INSTALL.txt.</Note>
      )}
      {supa && status && status.ok && status.configured && status.limit > 0 && (
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12 }} data-testid="deepl-usage">
          DeepL ({status.plan}): {Number(status.used).toLocaleString("en-GB")} of {Number(status.limit).toLocaleString("en-GB")} characters used this month.
        </div>
      )}
      {!shown.length && <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }} data-testid="no-langs-in-use">Nobody's language is set to anything but English yet (Staff → Edit → Language). You can still translate into any language below.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...shown, ...(showAll || !shown.length ? folded : [])].map(l => {
          const st = stateOf(l.code); const row = rowOf(l.code); const s = STATE[st];
          return (
            <div key={l.code} data-testid={`trans-${l.code}`} style={{ background: T.overlay, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: T.white }}>{l.label} <span style={{ color: T.muted, fontWeight: 600 }}>· {l.native}</span>
                  {inUse.has(l.code) && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, color: T.accentLt, border: `1px solid ${T.borderMd}`, borderRadius: 6, padding: "1px 6px" }}>in use</span>}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.col, marginTop: 2 }} data-testid={`trans-state-${l.code}`}>{s.label}</div>
                {row && (
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    Translated {fmtDate(row.translated_at)}{row.status === "checked" && row.checked_by ? ` · checked by ${row.checked_by} on ${fmtDate(row.checked_at)}` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {row && <button style={btn(false)} disabled={!!busy} onClick={() => setCompare(l.code)}>Compare</button>}
                {st === "machine" && <button style={btn(false)} disabled={!!busy} onClick={() => markChecked(l.code)} data-testid={`check-${l.code}`}>✓ Mark as checked</button>}
                <button style={btn(st === "none" || st === "stale")} disabled={!!busy || !supa} onClick={() => run(l.code)} data-testid={`translate-${l.code}`}>
                  {busy === l.code ? "Translating…" : st === "none" ? "Translate" : "Translate again"}
                </button>
                {row && <button style={btn(false, true)} disabled={!!busy} onClick={() => remove(l.code)}>Remove</button>}
              </div>
            </div>
          );
        })}
      </div>
      {shown.length > 0 && folded.length > 0 && (
        <button type="button" onClick={() => setShowAll(v => !v)} data-testid="more-langs"
          style={{ background: "none", border: "none", color: T.accentLt, cursor: "pointer", fontFamily: font, fontWeight: 700, fontSize: 12.5, marginTop: 10, padding: 0 }}>
          {showAll ? "▾ Hide languages nobody uses" : `▸ ${folded.length} more languages nobody uses yet`}
        </button>
      )}
      {needAll > 1 && supa && (
        <button style={{ ...btn(true), marginTop: 12 }} disabled={!!busy} onClick={runAll} data-testid="translate-all">
          Translate into all {needAll} languages in use that need it
        </button>
      )}
      <BulkTranslate allModules={allModules} translations={translations} onSave={onSave} supa={supa} inUse={inUse} T={T} font={font} btn={btn} />
    </div>
  );
}

const langName = code => (LANGUAGES.find(l => l.code === code) || {}).label || code;

function Note({ T, col, children }) {
  return <div style={{ background: `${col}14`, border: `1px solid ${col}55`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: T.slate || T.white, lineHeight: 1.5, marginBottom: 12 }}>{children}</div>;
}

/** Every module at once: translate whatever is missing or out of date, in every language staff use. */
function BulkTranslate({ allModules, translations, onSave, supa, inUse, T, font, btn }) {
  const [prog, setProg] = React.useState(null);   // { done, total, failed }
  const visible = allModules.filter(x => !x._hidden);
  const jobs = [];
  visible.forEach(mod => TARGETS.filter(l => inUse.has(l.code)).forEach(l => {   // only languages people use
    const st = translationState(mod, translations[translationKey(mod.id, l.code)]);
    if (st === "none" || st === "stale") jobs.push({ mod, lang: l.code });
  }));
  if (!supa || (!jobs.length && !prog)) return null;
  async function go() {
    if (!(await ask({ title: "Translate all training?", message: `${jobs.length} translation${jobs.length !== 1 ? "s" : ""} (modules × languages) are missing or out of date. They'll be machine translated now and marked "not yet checked". This can take a few minutes.`, ok: "Translate all" }))) return;
    let done = 0, failed = 0;
    setProg({ done, total: jobs.length, failed });
    for (const j of jobs) {
      const r = await translateModule(j.mod, j.lang);
      if (r.ok && (await onSave(r.row))) done++; else { failed++; if (!r.ok && /allowance|API key|isn't set up/i.test(r.error || "")) { notify(r.error, { kind: "error" }); break; } }
      setProg({ done, total: jobs.length, failed });
    }
    auditEvent("module", "all", "translate", `Bulk machine translation: ${done} done${failed ? `, ${failed} failed` : ""}`);
    notify(failed ? `${done} translated, ${failed} couldn't be done — try those again.` : `${done} translations done. Ask bilingual staff to check them.`, { kind: failed ? "error" : undefined });
  }
  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>All training modules</div>
      {prog ? (
        <div style={{ fontSize: 13, color: T.white }} data-testid="bulk-progress">{prog.done + prog.failed < prog.total ? "Translating…" : "Finished:"} {prog.done} of {prog.total} done{prog.failed ? `, ${prog.failed} failed` : ""}</div>
      ) : (
        <button style={btn(false)} onClick={go} data-testid="translate-everything">
          Translate every module that needs it ({jobs.length})
        </button>
      )}
    </div>
  );
}

function ShowText({ v, T }) {
  return isHtmlContent(v) ? <div className="rte-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(v) }} /> : <div style={{ whiteSpace: "pre-wrap" }}>{v || <span style={{ color: T.muted }}>—</span>}</div>;
}
function Pair({ label, a, b, T, lang }) {
  if (!a && !b) return null;
  const cell = { background: T.overlay, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, lineHeight: 1.55, color: T.white, minWidth: 0, overflowWrap: "anywhere" };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={cell}><ShowText v={a} T={T} /></div><div style={cell} lang={lang}><ShowText v={b} T={T} /></div>
      </div>
    </div>
  );
}

/** English and the translation side by side, for checking. */
function CompareView({ m, row, lang, onBack, onMarkChecked, T, font, btn }) {
  const en = moduleTexts(m);
  const tr = (row && row.data) || {};
  const stale = translationState(m, row) === "stale";
  return (
    <div data-testid="compare-view">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button style={btn(false)} onClick={onBack}>← Back</button>
        <div style={{ flex: 1, fontWeight: 800, color: T.white }}>English · {langName(lang)}</div>
        {row && row.status !== "checked" && !stale && <button style={btn(true)} onClick={onMarkChecked}>✓ Mark as checked</button>}
      </div>
      {stale && <Note T={T} col="#ef4444">The English has changed since this was translated — translate it again before checking.</Note>}
      <Pair T={T} lang={lang} label="Title" a={en.title} b={tr.title} />
      {en.content.map((s, i) => {
        const ts = (tr.content || [])[i] || {};
        return (
          <div key={i} style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.accentLt, marginBottom: 6 }}>Slide {i + 1}</div>
            <Pair T={T} lang={lang} label="Heading" a={s.heading} b={ts.heading} />
            <Pair T={T} lang={lang} label="Text" a={s.text} b={ts.text} />
            <Pair T={T} lang={lang} label="Hotspot instructions" a={s.hotspotInstructions} b={ts.hotspotInstructions} />
            {s.hotspots.map((h, j) => { const th = (ts.hotspots || [])[j] || {}; return (
              <React.Fragment key={j}><Pair T={T} lang={lang} label={`Hazard ${j + 1}`} a={h.label} b={th.label} /><Pair T={T} lang={lang} label={`Hazard ${j + 1} feedback`} a={h.feedback} b={th.feedback} /></React.Fragment>
            ); })}
          </div>
        );
      })}
      {en.quiz.map((q, i) => {
        const tq = (tr.quiz || [])[i] || {};
        const right = (m.quiz[i] || {}).answer;
        return (
          <div key={"q" + i} style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.gold, marginBottom: 6 }}>Question {i + 1}</div>
            <Pair T={T} lang={lang} label="Question" a={q.q} b={tq.q} />
            {q.options.map((o, j) => <Pair key={j} T={T} lang={lang} label={`Answer ${"ABCDEF"[j]}${j === right ? " ✓ correct" : ""}`} a={o} b={(tq.options || [])[j]} />)}
          </div>
        );
      })}
    </div>
  );
}
