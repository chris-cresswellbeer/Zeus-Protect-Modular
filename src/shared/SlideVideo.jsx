import React from "react";
import { videoSource } from "../lib/videoLink";

/**
 * SlideVideo — plays a training slide's video (desktop player and module preview).
 *   Uploaded file or direct .mp4 link → <video controls>
 *   YouTube / Vimeo / Microsoft Stream link → embedded player (16:9)
 * The phone player has its own version (mobile/screens/ModulePlayer.jsx) using the
 * same videoSource() rules.
 */
function SlideVideo({ video, Z, maxHeight = 360, style }) {
  if (video && video.uploading)
    return <div style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 13, background: "#000", borderRadius: 12, ...style }}>⏳ Uploading video…</div>;
  const v = videoSource(video);
  if (!v) return null;
  const box = { borderRadius: 12, overflow: "hidden", background: "#000", border: `1px solid ${Z.borderMd}`, ...style };
  if (v.kind === "embed")
    return (
      <div style={box} data-testid="slide-video-embed">
        <div style={{ position: "relative", paddingTop: "56.25%" }}>
          <iframe src={v.src} title={video.name || "Training video"} loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        </div>
      </div>
    );
  if (v.kind === "file")
    return <div style={box}><video src={v.src} controls playsInline preload="metadata" style={{ width: "100%", maxHeight, display: "block" }} /></div>;
  return (
    <div style={{ ...box, background: Z.overlay, padding: 14, fontSize: 13, color: Z.muted }}>
      This video can't be played here. <a href={v.src} target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd", fontWeight: 700 }}>Open video ↗</a>
    </div>
  );
}

export { SlideVideo };
