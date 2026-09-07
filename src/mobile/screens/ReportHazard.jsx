// src/mobile/screens/ReportHazard.jsx
//
// The quick hazard report, ported from src/domains/incidents/QuickReportModal.jsx
// and split one decision per screen. The submitted record keeps exactly the shape
// that modal produces, so the admin side and Supabase need no changes.

import React from "react";
import { QUICK_LOCATIONS } from "../../data/seedQuickReport";
import { Screen, SectionLabel, PrimaryButton } from "../ui";

const URGENCY_OPTIONS = [
  { id: "low",    label: "Safe to leave",     desc: "Not an immediate risk — log for awareness", icon: "🟡", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.45)" },
  { id: "medium", label: "Needs attention",   desc: "Should be fixed today",                     icon: "🟠", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.45)" },
  { id: "high",   label: "STOP WORK — urgent", desc: "Immediate risk — escalate now",            icon: "🔴", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.45)" },
];

function ReportHazard({ user, managerName, suggestedLocation, online, onSubmit, onDone, Z, font }) {
  const [step, setStep] = React.useState(1);
  const [what, setWhat] = React.useState("");
  const [where, setWhere] = React.useState(suggestedLocation || "");
  const [whereOther, setWhereOther] = React.useState("");
  const [urgency, setUrgency] = React.useState("");
  const [photos, setPhotos] = React.useState([]);
  const [reference, setReference] = React.useState(null);
  const fileRef = React.useRef(null);

  function addPhotos(e) {
    const files = Array.from(e.target.files || []);
    Promise.all(files.map(readAsCompressedDataUrl)).then((urls) => {
      setPhotos((p) => [...p, ...urls]);
    });
    e.target.value = "";
  }

  function submit() {
    const location = where === "Other" ? (whereOther.trim() || "Other") : where;
    const rec = {
      id: "qr_" + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      type: urgency === "high" ? "unsafe_condition" : "near_miss",
      location,
      description: what.trim(),
      reportedBy: String(user.id),
      injuryType: "None / No injury",
      riddor: false,
      closed: false,
      quickReport: true,
      urgency,
      photos,
    };
    onSubmit(rec);
    setReference(rec.id.replace("qr_", "QR-").slice(0, 9));
    setStep(4);
  }

  const canAdvance = step === 1 ? what.trim().length > 0
    : step === 2 ? (where && (where !== "Other" || whereOther.trim()))
    : step === 3 ? !!urgency
    : true;

  return (
    <Screen Z={Z}>
      {step < 4 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 99,
              background: step >= n ? Z.gold : Z.borderMd,
            }} />
          ))}
        </div>
      )}

      {step === 1 && (
        <>
          <h2 style={{ fontSize: 23, fontWeight: 900, letterSpacing: -0.5, margin: "0 0 5px", color: Z.white }}>
            What did you see?
          </h2>
          <p style={{ color: Z.muted, fontSize: 13, margin: "0 0 18px", lineHeight: 1.5 }}>
            A sentence is plenty. Thanks for flagging it — this is exactly how we stop
            someone getting hurt.
          </p>
          <textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            rows={4}
            placeholder="Describe the hazard or unsafe condition briefly…"
            style={{
              width: "100%", boxSizing: "border-box", background: Z.overlay,
              border: `1px solid ${Z.borderMd}`, borderRadius: 14, padding: 14,
              color: Z.white, fontSize: 14.5, lineHeight: 1.55, fontFamily: font,
              outline: "none", resize: "none", marginBottom: 12,
            }}
          />
          <div style={{ display: "flex", gap: 9, marginBottom: 18 }}>
            <VoiceButton onResult={(t) => setWhat((w) => (w ? w + " " : "") + t)} Z={Z} font={font} />
            <button
              onClick={() => fileRef.current && fileRef.current.click()}
              style={{
                flex: 1, minHeight: 50, background: Z.overlay, border: `1px solid ${Z.borderMd}`,
                borderRadius: 13, padding: 14, color: Z.slate, fontWeight: 700,
                fontSize: 13.5, fontFamily: font, cursor: "pointer",
              }}
            >
              📷 Add photo
            </button>
            <input
              ref={fileRef} type="file" accept="image/*" capture="environment"
              multiple onChange={addPhotos} style={{ display: "none" }}
            />
          </div>
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img
                    src={src} alt=""
                    style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 13, border: `1px solid ${Z.borderMd}` }}
                  />
                  <button
                    onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    aria-label="Remove photo"
                    style={{
                      position: "absolute", top: -6, right: -6, width: 24, height: 24,
                      borderRadius: "50%", background: Z.navy, border: `1px solid ${Z.borderMd}`,
                      color: Z.muted, fontSize: 11, cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <PrimaryButton onClick={() => setStep(2)} disabled={!canAdvance} Z={Z} font={font}>
            Next — where was it?
          </PrimaryButton>
        </>
      )}

      {step === 2 && (
        <>
          <h2 style={{ fontSize: 23, fontWeight: 900, letterSpacing: -0.5, margin: "0 0 5px", color: Z.white }}>
            Where was it?
          </h2>
          <p style={{ color: Z.muted, fontSize: 13, margin: "0 0 16px" }}>
            {suggestedLocation ? "We've guessed from your last sign-in. Tap to change." : "Pick the closest match."}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
            {QUICK_LOCATIONS.map((loc) => {
              const on = where === loc;
              const suggested = loc === suggestedLocation;
              return (
                <button
                  key={loc}
                  onClick={() => { setWhere(loc); if (loc !== "Other") setWhereOther(""); }}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                    minHeight: 56, borderRadius: 14, padding: 15, cursor: "pointer", fontFamily: font,
                    border: on ? `2px solid ${Z.accent}` : `1px solid ${Z.borderMd}`,
                    background: on ? "rgba(37,99,235,0.18)" : Z.overlay,
                  }}
                >
                  <span style={{ fontSize: 21 }}>{loc === "Other" ? "✎" : "📍"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: on ? 800 : 600, color: Z.white }}>
                      {loc === "Other" ? "Somewhere else…" : loc}
                    </div>
                    {suggested && (
                      <div style={{ fontSize: 11.5, color: "#a5b4fc", marginTop: 1 }}>Detected from last sign-in</div>
                    )}
                  </div>
                  {on && <span style={{ color: Z.accentLt, fontSize: 17 }}>✓</span>}
                </button>
              );
            })}
          </div>
          {where === "Other" && (
            <input
              value={whereOther}
              onChange={(e) => setWhereOther(e.target.value)}
              placeholder="Describe the location…"
              style={{
                width: "100%", boxSizing: "border-box", background: Z.overlay,
                border: `1px solid ${Z.borderMd}`, borderRadius: 14, padding: 15,
                color: Z.white, fontSize: 14.5, fontFamily: font, outline: "none", marginBottom: 18,
              }}
            />
          )}
          <PrimaryButton onClick={() => setStep(3)} disabled={!canAdvance} Z={Z} font={font}>
            Next — how urgent?
          </PrimaryButton>
        </>
      )}

      {step === 3 && (
        <>
          <h2 style={{ fontSize: 23, fontWeight: 900, letterSpacing: -0.5, margin: "0 0 5px", color: Z.white }}>
            How urgent is it?
          </h2>
          <p style={{ color: Z.muted, fontSize: 13, margin: "0 0 16px" }}>
            Your call — you&rsquo;re the one stood there.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {URGENCY_OPTIONS.map((opt) => {
              const on = urgency === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setUrgency(opt.id)}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 13,
                    minHeight: 66, padding: 16, borderRadius: 15, cursor: "pointer", fontFamily: font,
                    border: `2px solid ${on ? opt.border : Z.border}`,
                    background: on ? opt.bg : Z.overlay,
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: on ? 800 : 700, fontSize: 15, color: on ? opt.color : Z.white }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 12, color: Z.muted, marginTop: 1 }}>{opt.desc}</div>
                  </div>
                  {on && <span style={{ color: opt.color, fontSize: 17 }}>✓</span>}
                </button>
              );
            })}
          </div>
          <PrimaryButton tone="gold" onClick={submit} disabled={!canAdvance} Z={Z} font={font}>
            Send hazard report
          </PrimaryButton>
        </>
      )}

      {step === 4 && (
        <div style={{ textAlign: "center", padding: "28px 6px" }}>
          <div style={{
            width: 82, height: 82, borderRadius: "50%", margin: "0 auto 16px",
            background: "rgba(16,185,129,0.14)", border: "2px solid rgba(16,185,129,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: Z.white, margin: "0 0 8px", letterSpacing: -0.5 }}>
            Thank you, {(user.name || "").split(" ")[0]}
          </h2>
          <p style={{ color: Z.muted, fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
            You&rsquo;ve done the important bit. {online
              ? `${managerName || "Your H&S manager"} has been notified.`
              : `It's stored on your phone and will reach ${managerName || "your H&S manager"} as soon as you have signal.`}
          </p>
          <div style={{
            background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 15,
            padding: 15, textAlign: "left", marginBottom: 20,
          }}>
            <SummaryRow label="Reference" value={reference} Z={Z} />
            <SummaryRow label="Location" value={where === "Other" ? whereOther : where} Z={Z} />
            <SummaryRow
              label="Urgency"
              value={(URGENCY_OPTIONS.find((o) => o.id === urgency) || {}).label}
              color={(URGENCY_OPTIONS.find((o) => o.id === urgency) || {}).color}
              Z={Z}
            />
            <SummaryRow
              label="Status"
              value={online ? "✓ Sent" : "⏳ Queued to send"}
              color={online ? Z.green : Z.gold}
              Z={Z}
            />
          </div>
          <PrimaryButton onClick={onDone} Z={Z} font={font}>Done</PrimaryButton>
        </div>
      )}
    </Screen>
  );
}

function SummaryRow({ label, value, color, Z }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", fontSize: 13 }}>
      <span style={{ color: Z.muted }}>{label}</span>
      <span style={{ color: color || Z.white, fontWeight: color ? 800 : 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// Web Speech API where available; degrades to a disabled button rather than
// pretending. Frontline staff use this with gloves on.
function VoiceButton({ onResult, Z, font }) {
  const Rec = typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;
  const [listening, setListening] = React.useState(false);
  const recRef = React.useRef(null);

  function toggle() {
    if (!Rec) return;
    if (listening) { recRef.current && recRef.current.stop(); return; }
    const rec = new Rec();
    rec.lang = "en-GB";
    rec.interimResults = false;
    rec.onresult = (e) => onResult(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  return (
    <button
      onClick={toggle}
      disabled={!Rec}
      title={Rec ? "Dictate" : "Voice input is not available on this device"}
      style={{
        flex: 1, minHeight: 50, borderRadius: 13, padding: 14, cursor: Rec ? "pointer" : "not-allowed",
        background: listening ? "rgba(239,68,68,0.15)" : Z.overlay,
        border: `1px solid ${listening ? "rgba(239,68,68,0.4)" : Z.borderMd}`,
        color: listening ? "#f87171" : Z.slate,
        fontWeight: 700, fontSize: 13.5, fontFamily: font, opacity: Rec ? 1 : 0.4,
      }}
    >
      {listening ? "● Listening…" : "🎙 Speak it"}
    </button>
  );
}

// Downscale before queueing — a full-resolution phone photo will blow the
// IndexedDB quota after a handful of reports.
function readAsCompressedDataUrl(file, maxEdge = 1400, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export { ReportHazard, URGENCY_OPTIONS };
