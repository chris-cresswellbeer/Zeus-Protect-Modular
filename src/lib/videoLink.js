/**
 * videoLink.js — turn a pasted video link (or embed code) into something a slide can play.
 *
 *   parseVideoLink(input) → { kind: "embed", src, provider }   play inside the slide (iframe)
 *                         | { kind: "file",  src, provider }   a direct .mp4/.webm/.mov link (<video>)
 *                         | { error }
 *
 * Supported:
 *   YouTube   youtube.com/watch?v=…, youtu.be/…, /shorts/…, /embed/…, /live/…  (t= start time kept)
 *             → played from youtube-nocookie.com (no tracking cookies until played)
 *   Vimeo     vimeo.com/123 and unlisted vimeo.com/123/abcdef, player.vimeo.com/video/…
 *   Microsoft Stream / SharePoint — paste the EMBED CODE (Share → Embed) or its link;
 *             only https links on *.sharepoint.com / *.microsoftstream.com are used.
 *   Any https link ending in .mp4 / .webm / .mov / .m4v / .ogv
 *
 * Only https and the hosts above are ever put in an <iframe>.
 */

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

function startSeconds(t) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return +t;
  const m = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0;
}

export function parseVideoLink(input) {
  let raw = String(input || "").trim();
  if (!raw) return { error: "Paste a video link." };
  // Embed code pasted: use its src
  const fromIframe = raw.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  if (fromIframe) raw = fromIframe[1].replace(/&amp;/g, "&");
  let u;
  try { u = new URL(raw); } catch { return { error: "That doesn't look like a link. Copy the full address, starting https://" }; }
  if (u.protocol !== "https:") return { error: "Only secure (https://) video links can be used." };
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, "");

  // YouTube
  if (["youtube.com", "youtube-nocookie.com", "youtu.be", "music.youtube.com"].includes(host)) {
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (u.searchParams.get("v")) id = u.searchParams.get("v");
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/); if (m) id = m[1]; }
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return { error: "Couldn't find the video in that YouTube link." };
    const start = startSeconds(u.searchParams.get("t") || u.searchParams.get("start"));
    return { kind: "embed", provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? `&start=${start}` : ""}` };
  }
  // Vimeo
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = host === "player.vimeo.com" ? u.pathname.match(/^\/video\/(\d+)/) : u.pathname.match(/^\/(?:.*\/)?(\d+)(?:\/([0-9a-f]+))?/);
    if (!m) return { error: "Couldn't find the video in that Vimeo link." };
    const h = u.searchParams.get("h") || (host === "vimeo.com" ? m[2] : "");
    return { kind: "embed", provider: "Vimeo", src: `https://player.vimeo.com/video/${m[1]}${h ? `?h=${h}` : ""}` };
  }
  // Microsoft Stream / SharePoint
  if (/(^|\.)sharepoint\.com$/.test(host) || /(^|\.)microsoftstream\.com$/.test(host)) {
    const isEmbed = /embed/i.test(u.pathname) || u.searchParams.has("embed") || /embed\.aspx/i.test(u.pathname);
    if (!isEmbed) return { error: "For Microsoft Stream or SharePoint videos, use Share → Embed (or 'Embed code') and paste that code here. A normal share link can't play inside the slide." };
    return { kind: "embed", provider: "Microsoft Stream", src: u.href };
  }
  // Direct video file
  if (VIDEO_EXT.test(u.pathname)) return { kind: "file", provider: "Video link", src: u.href };
  return { error: "This kind of link can't be played in a slide. Use YouTube, Vimeo, Microsoft Stream (embed code) or a link to an .mp4 file." };
}

/** A stored slide video → what to show. Uploaded files have no `link`. */
export function videoSource(video) {
  if (!video || video.uploading) return null;
  const src = video.url || video.data;
  if (!src) return null;
  if (video.link) { const p = parseVideoLink(src); return p.error ? { kind: "unknown", src } : p; }
  return { kind: "file", src, provider: "" };
}
