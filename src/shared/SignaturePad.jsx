/**
 * SignaturePad — sign with a finger, stylus or mouse (PPE register: issuing on a tablet,
 * and "Sign for your PPE" on the phone and desktop).
 *   onChange(dataUrl | null)   a small PNG (dark ink on a transparent background, at most
 *                              600 px wide) once something has been drawn; null when cleared
 * The ink is drawn on a white panel so it shows in every theme. Keyboard users can type
 * their name instead (typedName), which is drawn as the signature.
 */
import React from "react";

const INK = "#0d1f5c";

export function SignaturePad({ onChange, height = 200, label = "Signature", hint = "Sign with your finger", clearLabel = "Clear", typeLabel = "Type my name instead", typedName = "", font, testid = "sig", Z }) {
  const wrap = React.useRef(null);
  const cv = React.useRef(null);
  const drawing = React.useRef(false);
  const last = React.useRef(null);
  const [has, setHas] = React.useState(false);
  const [typed, setTyped] = React.useState(null);   // null = drawing; string = typed name

  const ctx = () => cv.current && cv.current.getContext("2d");
  const size = React.useCallback(() => {
    const c = cv.current, w = wrap.current; if (!c || !w) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(200, Math.round(w.clientWidth));
    if (c.width === Math.round(cw * dpr)) return;
    c.width = Math.round(cw * dpr); c.height = Math.round(height * dpr);
    c.style.width = `${cw}px`; c.style.height = `${height}px`;
    const x = ctx(); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = INK; x.lineWidth = 2.6;
    setHas(false); onChange && onChange(null);
  }, [height]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { size(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(size) : null; if (ro && wrap.current) ro.observe(wrap.current); return () => ro && ro.disconnect(); }, [size]);

  const out = () => {
    const c = cv.current; if (!c) return null;
    const w = Math.min(600, c.width), h = Math.round(c.height * (w / c.width));
    const o = document.createElement("canvas"); o.width = w; o.height = h;
    o.getContext("2d").drawImage(c, 0, 0, w, h);
    return o.toDataURL("image/png");
  };
  const pos = e => { const r = cv.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = e => { e.preventDefault(); try { cv.current.setPointerCapture(e.pointerId); } catch { /* */ } drawing.current = true; last.current = pos(e); const x = ctx(); x.beginPath(); x.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2); x.fillStyle = INK; x.fill(); };
  const move = e => { if (!drawing.current) return; e.preventDefault(); const p = pos(e); const x = ctx(); x.beginPath(); x.moveTo(last.current.x, last.current.y); x.lineTo(p.x, p.y); x.stroke(); last.current = p; };
  const up = () => { if (!drawing.current) return; drawing.current = false; setHas(true); onChange && onChange(out()); };
  const clear = () => { const c = cv.current; if (c) { ctx().clearRect(0, 0, c.width, c.height); } setHas(false); onChange && onChange(null); };

  // typed name → drawn in a handwriting-ish italic, so the record still holds a picture
  React.useEffect(() => {
    if (typed == null) return;
    const c = cv.current; if (!c) return;
    const x = ctx(); const w = c.clientWidth;
    x.clearRect(0, 0, c.width, c.height);
    const name = typed.trim();
    if (!name) { setHas(false); onChange && onChange(null); return; }
    x.fillStyle = INK; x.font = `italic 600 ${Math.min(44, Math.round(w / Math.max(6, name.length * 0.62)))}px "Segoe Script","Brush Script MT",cursive`;
    x.textBaseline = "middle"; x.fillText(name, 22, height / 2 - 6);
    setHas(true); onChange && onChange(out());
  }, [typed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ fontFamily: font }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: Z ? Z.muted : "#94a3b8", textTransform: "uppercase", letterSpacing: .6 }}>{label}</span>
        <span style={{ display: "flex", gap: 4 }}>
          <button type="button" onClick={() => { if (typed == null) { clear(); setTyped(typedName || ""); } else { setTyped(null); clear(); } }} data-testid={`${testid}-type`}
            style={{ background: "none", border: "none", color: "#94a3b8", fontFamily: font, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "8px 6px", minHeight: 36 }}>{typed == null ? typeLabel : "Draw instead"}</button>
          <button type="button" onClick={() => { if (typed != null) setTyped(""); else clear(); }} data-testid={`${testid}-clear`} disabled={!has}
            style={{ background: "none", border: "none", color: has ? "#94a3b8" : "rgba(148,163,184,.4)", fontFamily: font, fontSize: 13, fontWeight: 700, cursor: has ? "pointer" : "default", padding: "8px 6px", minHeight: 36 }}>{clearLabel}</button>
        </span>
      </div>
      {typed != null && (
        <input aria-label="Your name, as your signature" value={typed} onChange={e => setTyped(e.target.value.slice(0, 60))} data-testid={`${testid}-typed`} autoFocus
          style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, background: Z ? Z.overlay : "rgba(255,255,255,.07)", border: `1px solid ${Z ? Z.borderMd : "rgba(255,255,255,.18)"}`, borderRadius: 10, padding: "11px 12px", color: Z ? Z.white : "#fff", fontFamily: font, fontSize: 15 }}/>
      )}
      <div ref={wrap} style={{ position: "relative", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 14, overflow: "hidden", height, boxSizing: "border-box" }}>
        <canvas ref={cv} data-testid={testid} role="img" aria-label={has ? "Signature drawn" : "Signature box: sign here"}
          onPointerDown={typed == null ? down : undefined} onPointerMove={typed == null ? move : undefined} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
          style={{ display: "block", touchAction: "none", cursor: typed == null ? "crosshair" : "default" }}/>
        <div aria-hidden="true" style={{ position: "absolute", left: 22, right: 22, bottom: 36, borderTop: "1.5px solid #cbd5e1", pointerEvents: "none" }}/>
        {!has && <div aria-hidden="true" style={{ position: "absolute", left: 22, bottom: 12, fontSize: 12, color: "#64748b", pointerEvents: "none" }}>{hint}</div>}
      </div>
    </div>
  );
}

/** Shows a stored signature (on white, so the ink shows in every theme). */
export function SignatureImage({ src, height = 70, alt = "Signature" }) {
  if (!src) return null;
  return <span style={{ display: "inline-block", background: "#f8fafc", borderRadius: 8, padding: "4px 8px" }}><img src={src} alt={alt} style={{ height, width: "auto", display: "block" }}/></span>;
}
