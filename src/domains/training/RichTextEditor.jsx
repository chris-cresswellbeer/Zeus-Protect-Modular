import React, { useRef, useEffect } from "react";
import { notify } from "../../shared/Feedback";
import { sb, SUPABASE_URL } from "../../lib/supabase";
import { ACCEPT_IMAGES } from "../../lib/constants";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { ensureRteStyles } from "./slideTextUtils";

// Lightweight contentEditable rich text editor — no external dependency.
// value/onChange carry sanitized HTML. Supports bold/italic/underline,
// bullet/numbered lists, links, and inline image upload+insert.
//
// Props: value (HTML string), onChange(html), Z (theme), font, placeholder, minHeight.
//
// HOW IT WORKS
//   • The editor div is UNCONTROLLED: React never renders its children. We write
//     innerHTML imperatively only when `value` changes from outside (see the
//     lastEmittedRef effect). Do NOT change this to dangerouslySetInnerHTML or
//     `children` — that re-renders on every keystroke and jumps the cursor to the start.
//   • Formatting uses document.execCommand (deprecated in the spec but still
//     supported by all major browsers). If it's ever removed, swap in a library
//     such as TipTap/Lexical.
//   • Toolbar buttons use onMouseDown preventDefault so clicking them doesn't
//     steal focus/selection from the text.
//   • On blur the HTML is sanitised and emitted again — the saved value is always clean.
//   • Inline images upload to the "documents" storage bucket as slidetext_<ts>_<name>.
function RichTextEditor({ value, onChange, Z, font, placeholder, minHeight = 120 }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const lastEmittedRef = useRef(null); // tracks the last HTML this editor itself produced

  useEffect(() => { ensureRteStyles(); }, []);

  // Imperative sync: only overwrite the live DOM when `value` changed from
  // OUTSIDE this editor — e.g. switching slides, loading a module for edit,
  // or the blur-time sanitize pass. If `value` matches what this editor last
  // emitted itself, the DOM already shows it — skip the write. Re-assigning
  // innerHTML with the identical string still destroys and rebuilds the DOM
  // nodes, which is what was resetting the cursor to the start on every
  // keystroke.
  useEffect(() => {
    if (!editorRef.current) return;
    if (value === lastEmittedRef.current) return;
    editorRef.current.innerHTML = value || "";
    lastEmittedRef.current = value || "";
  }, [value]);

  function emitChange() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastEmittedRef.current = html;
    onChange(html);
  }

  // Run a formatting command on the current selection, then report the new HTML.
  function exec(cmd, arg = null) {
    editorRef.current && editorRef.current.focus();
    document.execCommand(cmd, false, arg);
    emitChange();
  }

  // Remember the caret position before the hidden file picker opens (opening it blurs the editor),
  // so the uploaded image is inserted where the user was typing.
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    const sel = window.getSelection();
    if (savedRangeRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  }

  function handleLink() {
    editorRef.current && editorRef.current.focus();
    const url = window.prompt("Link URL (https://…):");
    if (!url) return;
    const safe = url.trim();
    if (!/^https?:\/\//i.test(safe)) { notify("Links must start with http:// or https://", { kind: "error" }); return; }
    exec("createLink", safe);
  }

  // 1) insert a faded 1×1 GIF placeholder at the caret, 2) upload, 3) swap the placeholder's src
  // for the real URL (or remove it on failure). e.target.value is cleared so picking the
  // same file twice still fires onChange.
  async function handleImageFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    editorRef.current && editorRef.current.focus();
    restoreSelection();

    const placeholderId = `img-uploading-${Date.now()}`;
    document.execCommand(
      "insertHTML",
      false,
      `<img id="${placeholderId}" alt="Uploading…" style="max-width:100%;border-radius:8px;opacity:.5;" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7"/>`
    );
    emitChange();

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `slidetext_${Date.now()}_${safeName}`;
    const { error } = await sb.storage.upload("documents", path, file);
    const placeholder = editorRef.current && editorRef.current.querySelector(`#${placeholderId}`);

    if (error) {
      if (placeholder) placeholder.remove();
      emitChange();
      notify("Image upload failed: " + error, { kind: "error" });
      return;
    }
    const url = `${SUPABASE_URL}/storage/v1/object/public/documents/${path}`;
    if (placeholder) {
      placeholder.src = url;
      placeholder.alt = file.name;
      placeholder.removeAttribute("id");
      placeholder.style.opacity = "1";
    }
    emitChange();
  }

  // Final clean-up when the user leaves the editor.
  function handleBlur() {
    if (!editorRef.current) return;
    const clean = sanitizeHtml(editorRef.current.innerHTML);
    if (clean !== editorRef.current.innerHTML) editorRef.current.innerHTML = clean;
    lastEmittedRef.current = clean;
    onChange(clean);
  }

  const btnStyle = { background: Z.overlay, color: Z.muted, border: `1px solid ${Z.borderMd}`, borderRadius: 6, padding: "5px 9px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: font, lineHeight: 1 };
  const divider = { width: 1, alignSelf: "stretch", background: Z.borderMd, margin: "0 3px" };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderRadius: "10px 10px 0 0", padding: 6 }}>
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec("bold")} style={btnStyle} title="Bold"><b>B</b></button>
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec("italic")} style={btnStyle} title="Italic"><i>I</i></button>
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec("underline")} style={btnStyle} title="Underline"><u>U</u></button>
        <div style={divider}/>
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec("insertUnorderedList")} style={btnStyle} title="Bullet list">• List</button>
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec("insertOrderedList")} style={btnStyle} title="Numbered list">1. List</button>
        <div style={divider}/>
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={handleLink} style={btnStyle} title="Insert link">🔗 Link</button>
        <button type="button" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>imageInputRef.current&&imageInputRef.current.click()} style={btnStyle} title="Insert image here">🖼️ Image</button>
        <input ref={imageInputRef} type="file" accept={ACCEPT_IMAGES} style={{ display: "none" }} onChange={handleImageFile}/>
      </div>
      <div
        ref={editorRef}
        className="rte-content rte-editable"
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={handleBlur}
        data-placeholder={placeholder}
        style={{ minHeight, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "9px 13px", color: Z.white, fontSize: 13, lineHeight: 1.6, outline: "none", fontFamily: font, boxSizing: "border-box" }}
      />
    </div>
  );
}

export { RichTextEditor };