// src/lib/photos.js
//
// Photo pipeline for the mobile app.
//
// Phones capture 4–12 MP JPEGs. Those are too big for the offline queue and far
// too big to sit inside a Postgres row, so a photo goes through two stages:
//
//   1. compressToDataUrl(file)  — on capture. Downscaled + re-encoded, held as
//      a data URL so it survives IndexedDB and the offline sync queue.
//   2. uploadPhotos(...)        — on save. Data URLs are pushed to Supabase
//      Storage and replaced by public URLs, which is what the database stores.
//
// Anything already an http(s) URL is passed through untouched, so re-saving a
// record never re-uploads its photos.
//
// Used by: mobile ReportHazard / Inspection screens, and desktop incident
// photo handling. All photos land in the PHOTO_BUCKET storage bucket below.

import { sb } from "./supabase";

// Pattern tests used to classify an entry in a photos array.
const IS_URL = /^https?:\/\//i;          // already in Supabase Storage (or any web URL)
const IS_DATA_IMAGE = /^data:image\//i;  // still local, waiting to be uploaded

/** True if this photo entry is already a web URL (i.e. no upload needed). */
function isUploaded(p) {
  return typeof p === "string" && IS_URL.test(p);
}

// Downscale before queueing — a full-resolution phone photo will blow the
// IndexedDB quota after a handful of reports.
//
// Resolves to a data URL, or null if the file could not be read at all.
// Always call as (file) => compressToDataUrl(file): passing this straight to
// Array.map hands it the index as maxEdge and scales the first photo to 0x0.
//
// @param {File}   file     From an <input type="file"> or camera capture.
// @param {number} maxEdge  Longest side in pixels after resizing (default 1400px).
// @param {number} quality  JPEG quality 0–1 (default 0.7 ≈ 150–300 KB per photo).
// Output is always JPEG (transparency in PNGs becomes black).
function compressToDataUrl(file, maxEdge = 1400, quality = 0.7) {
  // Defensive parsing — see the Array.map warning above.
  const edge = Number(maxEdge) > 0 ? Number(maxEdge) : 1400;
  const q = Number(quality) > 0 && Number(quality) <= 1 ? Number(quality) : 0.7;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const original = reader.result;
      if (typeof original !== "string" || !original.startsWith("data:")) {
        resolve(null);
        return;
      }
      const img = new Image();
      // iOS cannot decode HEIC in canvas; keep the original rather than lose it.
      img.onerror = () => resolve(original);
      img.onload = () => {
        try {
          // scale ≤ 1 → never upscale small images, only shrink big ones.
          const scale = Math.min(1, edge / Math.max(img.width, img.height, 1));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL("image/jpeg", q);
          // Safari returns a stub ("data:,") when the canvas is too big.
          resolve(out && out.length > 1000 ? out : original);
        } catch (err) {
          console.warn("[photos] compress failed, keeping original", err);
          resolve(original);
        }
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

// fetch() understands data: URLs, which is the simplest way to turn one back
// into a binary Blob for uploading.
async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

// photos: array of entries in either format:
//   • a string — a data URL (phone camera) or an already-uploaded https URL
//   • an object {name, type, data} from the desktop incident form ("Add Photos /
//     Files"), which may be a photo or a document such as a PDF; after upload it
//     becomes {name, type, url}.
// Returns the same array with every data URL uploaded to storage. Photos come back
// as plain URL strings (the format the phone app and IncidentPhotos expect);
// other files come back as {name, type, url}.
// A failed upload keeps its data URL, so the photo is never lost — the next
// save of that record retries it.
//
// @param {string} bucket  Storage bucket name (normally PHOTO_BUCKET).
// @param {string} prefix  Filename prefix identifying the record, e.g. "hazard_1712345".
//                         Final path = `${prefix}_${index}_${timestamp}.jpg`.
// Uploads run one at a time (sequential loop) to keep mobile data use gentle.
async function uploadPhotos(bucket, prefix, photos) {
  if (!Array.isArray(photos) || photos.length === 0) return photos || [];
  const out = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (isUploaded(p)) { out.push(p); continue; }
    // Desktop attachment object
    if (p && typeof p === "object") {
      if (typeof p.url === "string" && IS_URL.test(p.url)) { out.push(p); continue; }       // already uploaded
      if (typeof p.data !== "string" || !/^data:/i.test(p.data)) continue;                    // nothing to upload
      const isImage = /^data:image\//i.test(p.data) || String(p.type || "").startsWith("image/");
      try {
        const blob = await dataUrlToBlob(p.data);
        const nameExt = String(p.name || "").split(".").pop();
        const ext = (/^[a-z0-9]{1,5}$/i.test(nameExt) ? nameExt : (blob.type.split("/")[1] || "bin")).toLowerCase().replace("jpeg", "jpg");
        const path = `${prefix}_${i}_${Date.now()}.${ext}`;
        const { error } = await sb.storage.upload(bucket, path, blob);
        if (error) { out.push(p); continue; }                                                // keep it; retried on next save
        const url = sb.storage.getPublicUrl(bucket, path);
        out.push(isImage ? url : { name: p.name || `file-${i + 1}.${ext}`, type: p.type || blob.type, url });
      } catch (err) {
        console.warn("[photos] upload failed, keeping local copy", err);
        out.push(p);
      }
      continue;
    }
    if (typeof p !== "string" || !IS_DATA_IMAGE.test(p)) continue; // drop junk
    try {
      const blob = await dataUrlToBlob(p);
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${prefix}_${i}_${Date.now()}.${ext}`;
      const { error } = await sb.storage.upload(bucket, path, blob);
      if (error) { out.push(p); continue; }
      out.push(sb.storage.getPublicUrl(bucket, path));
    } catch (err) {
      console.warn("[photos] upload failed, keeping local copy", err);
      out.push(p);
    }
  }
  return out;
}

// Investigation evidence photos ({name, type, uploaded} objects, desktop Investigation tab).
// Each photo is shrunk and uploaded to storage straight away, and the record keeps only
// its link: { name, type, url, uploaded }. Older records hold the picture itself in
// `data` (base64); toStoredPhotos() moves those to storage the next time the
// investigation is saved. If an upload fails (no signal) the picture is kept in `data`
// and tried again on the next save, so it is never lost.
// Path: inc_<incident id>_inv_<time>_<n>.<ext> — the incident-photos bucket's rules let
// whoever can see that incident open it (db_rules.sql, section 4).
async function uploadDataUrl(bucket, path, dataUrl) {
  try {
    const blob = await dataUrlToBlob(dataUrl);
    const { error } = await sb.storage.upload(bucket, path, blob);
    return error ? null : sb.storage.getPublicUrl(bucket, path);
  } catch (err) {
    console.warn("[photos] upload failed", err);
    return null;
  }
}
const extOf = dataUrl => ((String(dataUrl).match(/^data:image\/([a-z0-9+]+)/i) || [])[1] || "jpg").toLowerCase().replace("jpeg", "jpg").replace("svg+xml", "svg");

/** Shrink and upload picked image files → [{ name, type, url | data, uploaded }]. */
async function photosFromFiles(files, incidentId, today) {
  const out = [];
  let n = 0;
  for (const f of files) {
    const data = await compressToDataUrl(f);
    if (!data) continue;
    const url = await uploadDataUrl(PHOTO_BUCKET, `inc_${incidentId}_inv_${Date.now()}_${n++}.${extOf(data)}`, data);
    out.push(url ? { name: f.name, type: f.type, url, uploaded: today } : { name: f.name, type: f.type, data, uploaded: today });
  }
  return out;
}

/** Move any photos still held as base64 to storage. Returns the same array if none were moved. */
async function toStoredPhotos(photos, incidentId) {
  const list = Array.isArray(photos) ? photos : [];
  if (!list.some(p => p && !p.url && /^data:image\//i.test(p.data || ""))) return photos;
  const out = [];
  let n = 0;
  for (const p of list) {
    if (!p || p.url || !/^data:image\//i.test(p.data || "")) { out.push(p); continue; }
    const url = await uploadDataUrl(PHOTO_BUCKET, `inc_${incidentId}_inv_${Date.now()}_${n++}.${extOf(p.data)}`, p.data);
    if (!url) { out.push(p); continue; }
    const { data, ...rest } = p;   // eslint-disable-line no-unused-vars
    out.push({ ...rest, url });
  }
  return out;
}

// Supabase Storage bucket for all captured photos. Public with the old sign-in; private
// with the new one (links are swapped for signed links on screen — lib/fileAccess.js).
// Renaming it here without migrating files will break existing photo links.
const PHOTO_BUCKET = "incident-photos";

export { compressToDataUrl, uploadPhotos, isUploaded, photosFromFiles, toStoredPhotos, PHOTO_BUCKET };
