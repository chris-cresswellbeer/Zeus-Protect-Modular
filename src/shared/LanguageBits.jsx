/**
 * shared/LanguageBits.jsx — small pieces for staff working in their own language.
 *   <ReadAloud text lang/>        🔊 button: reads the text with the device's own voice
 *   <TranslationNote status/>     "Machine translated / Checked translation — English is official"
 *   <LanguageChooser value onChange/>  the four languages as big buttons (phone More, My Account)
 * Wording comes from lib/i18n.js.
 */
import React from "react";
import { t, LANGUAGES, canSpeak, speak, stopSpeaking, useVoice, langInfo } from "../lib/i18n";

/** 🔊 Read aloud / ■ Stop. Hidden where the browser can't speak at all. */
export function ReadAloud({ text, lang = "en", Z, font, compact, style }) {
  const [on, setOn] = React.useState(false);
  const hasVoice = useVoice(lang);
  React.useEffect(() => () => { if (on) stopSpeaking(); }, [on]);
  React.useEffect(() => { setOn(false); stopSpeaking(); }, [text, lang]);   // new slide: stop the old one
  if (!canSpeak() || !String(text || "").trim()) return null;
  const toggle = e => {
    if (e) e.stopPropagation();
    if (on) { stopSpeaking(); setOn(false); return; }
    setOn(true);
    speak(text, lang, () => setOn(false));
  };
  const label = on ? t("Stop") : t("Read aloud");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, ...(style || {}) }}>
      <button type="button" onClick={toggle} data-testid="read-aloud" aria-pressed={on} aria-label={label} title={label}
        style={{
          background: on ? `${Z.accent}33` : Z.overlay, border: `1px solid ${on ? Z.accent : Z.borderMd}`, borderRadius: 99,
          color: on ? Z.white : Z.slate, cursor: "pointer", fontFamily: font, fontWeight: 700, letterSpacing: 0,
          fontSize: compact ? 11.5 : 13, padding: compact ? "4px 10px" : "8px 14px", minHeight: compact ? 28 : 40, whiteSpace: "nowrap",
          textTransform: "none",
        }}>
        {on ? "■" : "🔊"} {label}
      </button>
      {!hasVoice && lang !== "en" && (
        <span data-testid="no-voice" style={{ fontSize: 11, color: Z.muted, fontWeight: 600, letterSpacing: 0, textTransform: "none" }}>
          {t("No {language} voice on this device yet", { language: langInfo(lang).native })}
        </span>
      )}
    </span>
  );
}

/** Shown on translated training so nobody mistakes it for the official text. */
export function TranslationNote({ status, Z, font, style }) {
  const checked = status === "checked";
  const col = checked ? (Z.green || "#10b981") : (Z.amber || "#f59e0b");
  return (
    <div data-testid="translation-note" style={{
      background: `${col}14`, border: `1px solid ${col}55`, borderRadius: 12, padding: "9px 12px",
      fontSize: 12.5, lineHeight: 1.45, color: Z.slate, fontFamily: font, ...(style || {}),
    }}>
      <b style={{ color: col }}>{checked ? t("Checked translation.") : t("Machine translated — not yet checked.")}</b>{" "}
      {t("The English version is the official one. If anything is unclear, ask your supervisor.")}
    </div>
  );
}

/** The four languages as large, tappable choices (each shown in its own language). */
export function LanguageChooser({ value, onChange, Z, font }) {
  return (
    <div role="radiogroup" aria-label="Language" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {LANGUAGES.map(l => {
        const on = value === l.code;
        return (
          <button key={l.code} type="button" role="radio" aria-checked={on} onClick={() => onChange(l.code)} data-testid={`lang-${l.code}`}
            style={{
              width: "100%", boxSizing: "border-box", textAlign: "left", display: "flex", alignItems: "center", gap: 13,
              minHeight: 56, padding: "12px 15px", borderRadius: 14, cursor: "pointer", fontFamily: font,
              border: on ? `2px solid ${Z.accent}` : `1px solid ${Z.borderMd}`,
              background: on ? `${Z.accent}1f` : Z.overlay,
            }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: on ? Z.accentLt : Z.muted, width: 26 }}>{l.code.toUpperCase()}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: on ? 800 : 700, color: Z.white }}>{l.native}</span>
              {l.code !== "en" && <span style={{ display: "block", fontSize: 11.5, color: Z.muted, marginTop: 1 }}>{l.label}</span>}
            </span>
            {on && <span style={{ color: Z.accentLt, fontSize: 17 }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}
