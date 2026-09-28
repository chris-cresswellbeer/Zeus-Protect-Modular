/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/constants.js — Shared file-upload "accept" strings
 * ═══════════════════════════════════════════════════════════════════════════
 * These strings are passed to <input type="file" accept={...}> across the app
 * so the OS file picker only offers suitable file types.
 *
 * IMPORTANT: `accept` is only a UI hint for the file picker. It is NOT
 * validation — a user can still choose "All files". Any code that relies on
 * the file being an image/video must check `file.type` itself.
 *
 * To allow a new format everywhere (e.g. HEIC photos from iPhones), add its
 * MIME type here once rather than editing individual components.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Image types used for photo uploads (incidents, hazards, hotspot slides, etc.). */
const ACCEPT_IMAGES = ["image/jpeg","image/png","image/gif","image/webp"].join(",");

/** Video types used for training-module video slides. `quicktime` = .mov from iPhones. */
const ACCEPT_VIDEO  = ["video/mp4","video/webm","video/ogg","video/quicktime"].join(",");

/** Images plus common document types (used for certificates / evidence attachments). */
const ACCEPT_IMG_DOCS = ACCEPT_IMAGES + ",.pdf,.doc,.docx";

export { ACCEPT_IMAGES, ACCEPT_VIDEO, ACCEPT_IMG_DOCS };
