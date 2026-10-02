import React from "react";
import { sb, SUPABASE_URL } from "../lib/supabase";
import { SlideVideo } from "./SlideVideo";
import { parseVideoLink } from "../lib/videoLink";
import { MAX_UPLOAD_MB } from "../domains/training/slideImport";
import { notify, ask } from "./Feedback";
import { auditEvent } from "../lib/audit";

/**
 * WelcomeVideo — the video a person sees the very first time they sign in.
 *
 *   Setting       app_settings row id "welcome_video", data:
 *                   { url, name, size, link, provider, path, updatedAt, updatedBy }
 *                 (url = uploaded file in the documents bucket under welcome/, or a
 *                  YouTube / Vimeo / Stream link). No row, or no url = no welcome video.
 *   First sign-in App.jsx finishLogin(): no last_logins row for them yet → showWelcome()
 *                 once they reach the portal (after choosing their password).
 *                 People who have signed in before never see it automatically.
 *   Admin         <WelcomeVideoSettings/> from the Staff screen: upload / link / preview / remove.
 *   Replay        <WelcomeReplay/> on My Account, and on the phone's More tab (only shown when a video is set).
 *
 * <WelcomeHost/> is mounted once in main.jsx (desktop and phone).
 */

const ROW = "welcome_video";

export async function loadWelcomeVideo() {
  try {
    const r = await sb.from("app_settings").select("*").eq("id", ROW);
    const d = !r.error && Array.isArray(r.data) && r.data[0] ? r.data[0].data : null;
    return d && d.url ? d : null;
  } catch { return null; }
}

async function saveWelcomeVideo(data) {
  try {
    const r = await sb.from("app_settings").upsert({ id: ROW, data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    return r && r.error ? String(r.error.message || r.error) : null;
  } catch (e) { return String(e && e.message || e); }
}

// ── the window ───────────────────────────────────────────────────────────────
let current = null;            // { video, name, Z, font, replay }
const subs = new Set();
const emit = () => subs.forEach(f => f());
export function showWelcome(opts) { current = opts; emit(); }
export function hideWelcome() { current = null; emit(); }

const FALLBACK = { navyMd: "#152370", navyDk: "#091548", borderMd: "rgba(255,255,255,0.15)", overlay: "rgba(255,255,255,0.06)", white: "#f1f5f9", muted: "#94a3b8", accent: "#2563eb", blue: "#1d4ed8", gold: "#f59e0b" };

export function WelcomeHost() {
  const [, force] = React.useReducer(x => x + 1, 0);
  const [ended, setEnded] = React.useState(false);
  React.useEffect(() => { subs.add(force); return () => subs.delete(force); }, []);
  const c = current;
  React.useEffect(() => { setEnded(false); }, [c]);
  React.useEffect(() => {
    if (!c) return;
    const onKey = e => { if (e.key === "Escape") hideWelcome(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c]);
  if (!c) return null;
  const Z = c.Z || FALLBACK, font = c.font || "system-ui,sans-serif";
  const first = String(c.name || "").trim().split(/\s+/)[0];
  const phone = typeof window !== "undefined" && window.innerWidth <= 700;
  const isFile = !c.video.link;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 5800, background: "rgba(3,8,30,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: phone ? 10 : 24, fontFamily: font }}>
      <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" data-testid="welcome"
        style={{ width: "100%", maxWidth: 980, maxHeight: "100%", overflowY: "auto", background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: `1px solid ${Z.borderMd}`, borderRadius: phone ? 14 : 20, padding: phone ? 16 : 28, color: Z.white, boxShadow: "0 30px 90px rgba(0,0,0,.55)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 id="welcome-title" style={{ margin: 0, fontSize: phone ? 20 : 26, fontWeight: 900, letterSpacing: -0.3 }}>
              {c.replay ? "Welcome video" : `Welcome to Zeus Protect${first ? `, ${first}` : ""}`}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: Z.muted, lineHeight: 1.5 }}>
              {c.replay ? "A short tour of the portal." : `Here's a short tour of the portal before you start. You can watch it again any time from ${phone ? "the More tab" : "My Account"}.`}
            </p>
          </div>
          <button onClick={hideWelcome} aria-label="Close the welcome video"
            style={{ background: Z.overlay, border: `1px solid ${Z.borderMd}`, color: Z.white, borderRadius: 10, width: 44, height: 44, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>
        {isFile
          ? <div style={{ borderRadius: 12, overflow: "hidden", background: "#000", border: `1px solid ${Z.borderMd}` }}>
              <video src={c.video.url} controls autoPlay playsInline preload="auto" onEnded={() => setEnded(true)} data-testid="welcome-player"
                style={{ width: "100%", maxHeight: phone ? "60vh" : "62vh", display: "block", background: "#000" }} />
            </div>
          : <SlideVideo video={{ ...c.video, data: c.video.url }} Z={Z} maxHeight={560} />}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={hideWelcome} data-testid="welcome-done"
            style={{ background: ended ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay, color: ended ? "#fff" : Z.white, border: ended ? "none" : `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "12px 22px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: font, minHeight: 44 }}>
            {ended ? "Get started →" : c.replay ? "Close" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── replay link (My Account) ───────────────────────────────────────────────
export function WelcomeReplay({ name, Z, font }) {
  const [video, setVideo] = React.useState(null);
  React.useEffect(() => { let on = true; loadWelcomeVideo().then(v => { if (on) setVideo(v); }); return () => { on = false; }; }, []);
  if (!video) return null;
  return (
    <div style={{ marginTop: 20, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontFamily: font }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: Z.white }}>Welcome video</div>
        <div style={{ fontSize: 12, color: Z.muted, marginTop: 2 }}>The short tour of the portal shown when you first signed in.</div>
      </div>
      <button onClick={() => showWelcome({ video, name, Z, font, replay: true })} data-testid="welcome-replay"
        style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: font }}>▶ Watch it again</button>
    </div>
  );
}

// ── admin settings window (Staff screen → Welcome video) ───────────────────
export function WelcomeVideoSettings({ user, onClose, Z, font }) {
  const [video, setVideo] = React.useState(undefined);   // undefined = loading, null = none
  const [busy, setBusy] = React.useState("");
  const [link, setLink] = React.useState("");
  const [err, setErr] = React.useState("");
  const fileRef = React.useRef(null);
  React.useEffect(() => { loadWelcomeVideo().then(v => setVideo(v)); }, []);
  React.useEffect(() => {
    const onKey = e => { if (e.key === "Escape" && !busy && !document.querySelector('[data-testid="ask"]') && !document.querySelector('[data-testid="welcome"]')) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const store = async (next, verb) => {
    const prev = video;
    const e = await saveWelcomeVideo(next || {});
    if (e) { notify("The welcome video couldn't be saved: " + e, { kind: "error" }); return false; }
    setVideo(next && next.url ? next : null);
    auditEvent("settings", ROW, verb, verb === "remove" ? `Removed the welcome video (${prev && prev.name || "video"})` : `Welcome video set to ${next.name}`,
      { video: { from: prev ? prev.name : null, to: next && next.url ? next.name : null } }, "Welcome video");
    // the file being replaced is no longer used anywhere: tidy it away
    if (prev && prev.path && (!next || next.path !== prev.path)) sb.storage.remove("documents", [prev.path]).catch(() => {});
    return true;
  };

  const upload = async file => {
    setErr("");
    if (!file) return;
    if (!/^video\//.test(file.type) && !/\.(mp4|m4v|mov|webm)$/i.test(file.name)) { setErr("Choose a video file (.mp4 works everywhere)."); return; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setErr(`That video is ${Math.round(file.size / 1048576)} MB. Uploads can be up to ${MAX_UPLOAD_MB} MB. Make a smaller copy (for example QuickTime → File → Export As → 720p), or put it on YouTube (unlisted), Vimeo or Microsoft Stream and paste the link instead.`);
      return;
    }
    setBusy(`Uploading ${file.name}…`);
    const path = `welcome/welcome_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await sb.storage.upload("documents", path, file);
    if (error) { setBusy(""); setErr("Upload failed: " + error); return; }
    const url = `${SUPABASE_URL}/storage/v1/object/public/documents/${path}`;
    const ok = await store({ url, path, name: file.name, size: file.size, type: file.type || "video/mp4", link: false, updatedAt: new Date().toISOString(), updatedBy: user ? user.name : "" }, "update");
    setBusy("");
    if (ok) notify(`Welcome video saved. New staff will see "${file.name}" the first time they sign in.`);
  };

  const applyLink = async () => {
    setErr("");
    const r = parseVideoLink(link);
    if (r.error) { setErr(r.error); return; }
    setBusy("Saving…");
    const ok = await store({ url: r.src, name: `${r.provider} video`, link: r.kind === "embed", provider: r.provider, updatedAt: new Date().toISOString(), updatedBy: user ? user.name : "" }, "update");
    setBusy("");
    if (ok) { setLink(""); notify("Welcome video saved."); }
  };

  const remove = async () => {
    if (!(await ask({ title: "Remove the welcome video?", message: "New staff won't see a video when they first sign in. You can add one again at any time.", ok: "Remove video", danger: true }))) return;
    setBusy("Removing…");
    const ok = await store(null, "remove");
    setBusy("");
    if (ok) notify("Welcome video removed.");
  };

  const btn = (primary, danger) => ({
    background: danger ? "rgba(239,68,68,0.12)" : primary ? `linear-gradient(135deg,${Z.accent},${Z.blue})` : Z.overlay,
    color: danger ? "#f87171" : primary ? "#fff" : Z.white, border: danger ? "1px solid rgba(239,68,68,0.35)" : primary ? "none" : `1px solid ${Z.borderMd}`,
    borderRadius: 10, padding: "10px 16px", fontWeight: 800, fontSize: 13, cursor: busy ? "wait" : "pointer", fontFamily: font, minHeight: 40,
  });
  const when = video && video.updatedAt ? new Date(video.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="wv-title" data-testid="welcome-settings"
        style={{ width: "100%", maxWidth: 720, maxHeight: "92vh", overflowY: "auto", background: `linear-gradient(160deg,${Z.navyMd},${Z.navyDk || Z.navy})`, border: `1px solid ${Z.borderMd}`, borderRadius: 18, padding: 24, color: Z.white, fontFamily: font }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h3 id="wv-title" style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Welcome video for new staff</h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: Z.muted, lineHeight: 1.55 }}>
              Shown once, the very first time someone signs in (after they choose their password). Anyone who has signed in before won't see it, but everyone can watch it again from My Account.
            </p>
          </div>
          <button onClick={onClose} disabled={!!busy} aria-label="Close" style={{ ...btn(false), width: 40, padding: 0 }}>✕</button>
        </div>

        <div style={{ marginTop: 18 }}>
          {video === undefined ? <div style={{ color: Z.muted, fontSize: 13 }}>Loading…</div>
            : video ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: Z.muted, textTransform: "uppercase", marginBottom: 8 }}>Current video</div>
                <SlideVideo video={{ ...video, data: video.url }} Z={Z} maxHeight={300} />
                <div style={{ fontSize: 12, color: Z.muted, marginTop: 8 }} data-testid="wv-current">
                  <b style={{ color: Z.white }}>{video.name}</b>{video.size ? ` · ${video.size < 1048576 ? `${Math.max(1, Math.round(video.size / 1024))} KB` : `${(video.size / 1048576).toFixed(1)} MB`}` : ""}{when ? ` · set ${when}` : ""}{video.updatedBy ? ` by ${video.updatedBy}` : ""}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button style={btn(false)} disabled={!!busy} onClick={() => showWelcome({ video, name: user ? user.name : "", Z, font })}>▶ Preview what new staff see</button>
                  <button style={btn(false, true)} disabled={!!busy} onClick={remove}>Remove video</button>
                </div>
              </>
            ) : (
              <div style={{ background: Z.overlay, border: `1px dashed ${Z.borderMd}`, borderRadius: 12, padding: 16, fontSize: 13, color: Z.muted }} data-testid="wv-none">
                No welcome video yet. New staff go straight to their dashboard.
              </div>
            )}
        </div>

        <div style={{ marginTop: 22, borderTop: `1px solid ${Z.borderMd}`, paddingTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: Z.muted, textTransform: "uppercase", marginBottom: 10 }}>{video ? "Replace it" : "Add a video"}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm" style={{ display: "none" }} data-testid="wv-file"
              onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; upload(f); }} />
            <button style={btn(true)} disabled={!!busy} onClick={() => fileRef.current && fileRef.current.click()}>⬆ Upload a video file</button>
            <span style={{ fontSize: 12, color: Z.muted }}>MP4 is best · up to {MAX_UPLOAD_MB} MB</span>
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: Z.muted, margin: "16px 0 6px" }} htmlFor="wv-link">…or paste a YouTube, Vimeo or Microsoft Stream link</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="wv-link" value={link} onChange={e => setLink(e.target.value)} placeholder="https://"
              onKeyDown={e => { if (e.key === "Enter" && link.trim()) applyLink(); }}
              style={{ flex: 1, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: 10, padding: "10px 12px", color: Z.white, fontSize: 13, fontFamily: font, minWidth: 0 }} />
            <button style={btn(false)} disabled={!!busy || !link.trim()} onClick={applyLink}>Use link</button>
          </div>
          {busy && <div style={{ marginTop: 12, fontSize: 13, color: Z.gold || "#f59e0b" }} role="status">⏳ {busy}</div>}
          {err && <div style={{ marginTop: 12, fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }} role="alert" data-testid="wv-error">{err}</div>}
        </div>
      </div>
    </div>
  );
}
