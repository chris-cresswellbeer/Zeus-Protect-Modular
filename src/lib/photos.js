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

import { sb } from "./supabase";

const IS_URL = /^https?:\/\//i;
const IS_DATA_IMAGE = /^data:image\//i;

function isUploaded(p) {
  return typeof p === "string" && IS_URL.test(p);
}

// Downscale before queueing — a full-resolution phone photo will blow the
// IndexedDB quota after a handful of reports.
function compressToDataUrl(file, maxEdge = 1400, quality = 0.7) {
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

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

// photos: array of data URLs and/or already-uploaded https URLs.
// Returns the same array with every data URL swapped for a storage URL.
// A failed upload keeps its data URL, so the photo is never lost — the next
// save of that record retries it.
async function uploadPhotos(bucket, prefix, photos) {
  if (!Array.isArray(photos) || photos.length === 0) return photos || [];
  const out = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (isUploaded(p)) { out.push(p); continue; }
    if (typeof p !== "string" || !IS_DATA_IMAGE.test(p)) continue; // drop junk
    try {
      const blob = await dataUrlToBlob(p);
      const path = `${prefix}_${i}_${Date.now()}.jpg`;
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

const PHOTO_BUCKET = "incident-photos";

export { compressToDataUrl, uploadPhotos, isUploaded, PHOTO_BUCKET };
