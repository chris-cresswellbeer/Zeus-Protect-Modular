import React, { useState, useRef } from "react";
import { sb, SUPABASE_URL } from "../../lib/supabase";
import { pdfToSlideImages, readPptx, pairDeck, notesToHtml, MAX_UPLOAD_MB } from "./slideImport";

/**
 * SlideImportPanel — "Import slides from PowerPoint" on Create Module → Slides.
 *
 *   1. In PowerPoint: File → Export → PDF. Choose that PDF here (required).
 *   2. Optionally also choose the original .pptx: its speaker notes become each slide's
 *      text, its titles become the headings, and videos embedded in it are attached to
 *      their slides (up to MAX_UPLOAD_MB each).
 *   3. Import: every page becomes a slide whose picture is the PowerPoint slide.
 *
 * Pictures and videos upload to the "documents" bucket like any slide upload
 * (slideimg_… / video_…). onImport(slides, mode) hands the new slides to the builder;
 * mode = "replace" | "append".
 */
const safe = s => String(s).replace(/[^a-zA-Z0-9._-]/g, "_");

function SlideImportPanel({ hasContent, onImport, onClose, Z, font }) {
  const [pdf, setPdf] = useState(null);
  const [pptx, setPptx] = useState(null);
  const [modeChoice, setMode] = useState(null);     // null = follow hasContent (add after if there are slides)
  const mode = modeChoice || (hasContent ? "append" : "replace");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);           // { count, notes, videos, warnings }
  const pdfRef = useRef(null), pptxRef = useRef(null);

  const lbl = { fontSize: 11, fontWeight: 700, color: Z.muted, letterSpacing: .5, textTransform: "uppercase", display: "block", margin: "14px 0 6px" };
  const pick = { border: `2px dashed ${Z.borderMd}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: Z.overlaySm };
  const btn = primary => ({ background: primary ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay, color: primary ? "#fff" : Z.muted, border: primary ? "none" : `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: font });

  async function upload(blob, name) {
    const path = `${blob.type.startsWith("video/") ? "video" : "slideimg"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe(name)}`;
    const { error } = await sb.storage.upload("documents", path, blob);
    if (error) throw new Error(`Upload failed for ${name}: ${error}`);
    return `${SUPABASE_URL}/storage/v1/object/public/documents/${path}`;
  }

  async function run() {
    if (!pdf) { setErr("Choose the PDF of your slides first."); return; }
    if (!/\.pdf$/i.test(pdf.name) && pdf.type !== "application/pdf") { setErr("The first file must be a PDF. In PowerPoint use File → Export → PDF."); return; }
    setBusy(true); setErr(""); setDone(null);
    try {
      let deck = null;
      if (pptx) { setStatus("Reading the PowerPoint file…"); deck = readPptx(await pptx.arrayBuffer()); }
      setStatus("Reading the PDF…");
      const pages = await pdfToSlideImages(pdf, (n, total) => setStatus(`Making slide pictures: ${n} of ${total}…`));
      if (!pages.length) throw new Error("The PDF has no pages.");
      const { slides: paired, warnings } = pairDeck(pages, deck);
      const out = [];
      let notes = 0, videos = 0;
      for (let i = 0; i < paired.length; i++) {
        const p = paired[i];
        setStatus(`Uploading slide ${i + 1} of ${paired.length}…`);
        const name = `${safe(pdf.name.replace(/\.pdf$/i, ""))}_slide${i + 1}.jpg`;
        const url = await upload(p.page.blob, name);
        let video = null;
        const v = p.videos[0];
        if (v) {
          if (v.size > MAX_UPLOAD_MB * 1024 * 1024) warnings.push(`Slide ${i + 1}: its video (${Math.round(v.size / 1048576)} MB) is over ${MAX_UPLOAD_MB} MB, so it wasn't added. Put it on YouTube, Vimeo or Stream and add the link instead.`);
          else {
            setStatus(`Uploading the video on slide ${i + 1}…`);
            const vurl = await upload(v.blob, v.name);
            video = { name: v.name, type: v.type, url: vurl, data: vurl };
            videos++;
          }
          if (p.videos.length > 1) warnings.push(`Slide ${i + 1} has ${p.videos.length} videos; only the first was added.`);
        }
        if (p.notes.length) notes++;
        out.push({
          heading: p.title, text: notesToHtml(p.notes), video,
          images: [{ name, type: "image/jpeg", url, data: url, deck: true }],
          hotspots: null, hotspotInstructions: "",
        });
      }
      onImport(out, mode);
      setDone({ count: out.length, notes, videos, warnings });
      setStatus("");
    } catch (e) {
      console.error("Slide import failed:", e);
      setErr(String(e && e.message || e)); setStatus("");
    }
    setBusy(false);
  }

  return (
    <div data-testid="slide-import" style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, borderRadius: 16, padding: 22, marginBottom: 16, border: `1px solid ${Z.accent}55`, fontFamily: font }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: Z.white, flex: 1 }}>📥 Import slides from PowerPoint</h4>
        <button onClick={onClose} aria-label="Close import" style={{ ...btn(false), padding: "5px 11px" }}>✕</button>
      </div>
      <ol style={{ margin: "10px 0 0", paddingLeft: 20, fontSize: 12.5, color: Z.muted, lineHeight: 1.7 }}>
        <li>In PowerPoint, choose <b style={{ color: Z.white }}>File → Export → PDF</b> (on a Mac: File → Export… → File Format: PDF) and save it.</li>
        <li>Choose that PDF below. Each page becomes a slide showing exactly what the PowerPoint slide looks like.</li>
        <li>Optionally choose the original <b style={{ color: Z.white }}>.pptx</b> too: speaker notes become each slide's text, and videos embedded in the deck are added (up to {MAX_UPLOAD_MB} MB each).</li>
      </ol>

      <label style={lbl}>PDF of the slides *</label>
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} data-testid="import-pdf"
        onChange={e => { setPdf(e.target.files[0] || null); setErr(""); setDone(null); e.target.value = ""; }} />
      <div style={pick} onClick={() => !busy && pdfRef.current && pdfRef.current.click()}>
        <span style={{ fontSize: 22 }}>📄</span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
          <div style={{ fontWeight: 700, color: Z.white }}>{pdf ? pdf.name : "Choose PDF…"}</div>
          <div style={{ color: Z.muted }}>{pdf ? `${(pdf.size / 1048576).toFixed(1)} MB` : "Exported from PowerPoint"}</div>
        </div>
      </div>

      <label style={lbl}>Original PowerPoint (.pptx) — optional</label>
      <input ref={pptxRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" style={{ display: "none" }} data-testid="import-pptx"
        onChange={e => { setPptx(e.target.files[0] || null); setErr(""); setDone(null); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <div style={{ ...pick, flex: 1 }} onClick={() => !busy && pptxRef.current && pptxRef.current.click()}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
            <div style={{ fontWeight: 700, color: Z.white }}>{pptx ? pptx.name : "Choose .pptx…"}</div>
            <div style={{ color: Z.muted }}>{pptx ? `${(pptx.size / 1048576).toFixed(1)} MB` : "For speaker notes, titles and embedded videos"}</div>
          </div>
        </div>
        {pptx && <button onClick={() => setPptx(null)} style={btn(false)} disabled={busy}>Remove</button>}
      </div>

      {hasContent && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14, fontSize: 13, color: Z.white }}>
          <label style={{ cursor: "pointer" }}><input type="radio" name="imp-mode" checked={mode === "append"} onChange={() => setMode("append")} /> Add after the current slides</label>
          <label style={{ cursor: "pointer" }}><input type="radio" name="imp-mode" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace the current slides</label>
        </div>
      )}

      {status && <div role="status" style={{ marginTop: 14, fontSize: 13, color: Z.accentLt, fontWeight: 700 }}>⏳ {status}</div>}
      {err && <div role="alert" style={{ marginTop: 14, fontSize: 13, color: "#f87171", fontWeight: 700 }}>{err}</div>}
      {done && (
        <div data-testid="import-done" style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 13, lineHeight: 1.6 }}>
          <b style={{ color: Z.green }}>✓ {done.count} slide{done.count !== 1 ? "s" : ""} imported</b>
          {pptx && <span style={{ color: Z.muted }}> · speaker notes on {done.notes} · {done.videos} video{done.videos !== 1 ? "s" : ""} added</span>}
          <div style={{ color: Z.muted }}>Check each slide's heading and text below, then add your quiz.</div>
          {done.warnings.map((w, i) => <div key={i} style={{ color: "#fbbf24", marginTop: 4 }}>⚠ {w}</div>)}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={run} disabled={busy || !pdf} style={{ ...btn(true), opacity: busy || !pdf ? .5 : 1, cursor: busy || !pdf ? "not-allowed" : "pointer" }}>
          {busy ? "Importing…" : "Import slides"}
        </button>
      </div>
    </div>
  );
}

export { SlideImportPanel };
