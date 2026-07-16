import React, { useRef, useEffect } from "react";
import { sb, SUPABASE_URL } from "../../lib/supabase";
import { ACCEPT_IMAGES } from "../../lib/constants";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { ensureRteStyles } from "./slideTextUtils";

// Lightweight contentEditable rich text editor — no external dependency.
// value/onChange carry sanitized HTML. Supports bold/italic/underline,
// bullet/numbered lists, links, and inline image upload+insert.
function RichTextEditor({ value, onChange, Z, font, placeholder, minHeight = 120 }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const savedRangeRef = useRef(null);

  useEffect(() => { ensureRteStyles(); }, []);

  // Note: initial/updated content is set via dangerouslySetInnerHTML below, not an effect.
  // React only touches the DOM when the __html string actually differs from what's already
  // rendered, so typing (which updates `value` to match the current DOM) doesn't reset the
  // cursor — a real reset only happens when the slide's content changes from outside (e.g. switching slides).

  function emitChange() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    onChange(html);
  }

  function exec(cmd, arg = null) {
    editorRef.current && editorRef.current.focus();
    document.execCommand(cmd, false, arg);
    emitChange();
  }

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
    if (!/^https?:\/\//i.test(safe)) { alert("Links must start with http:// or https://"); return; }
    exec("createLink", safe);
  }

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
      alert("Image upload failed: " + error);
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

  function handleBlur() {
    if (!editorRef.current) return;
    const clean = sanitizeHtml(editorRef.current.innerHTML);
    if (clean !== editorRef.current.innerHTML) editorRef.current.innerHTML = clean;
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
        dangerouslySetInnerHTML={{ __html: value || "" }}
        style={{ minHeight, background: Z.overlay, border: `1px solid ${Z.borderMd}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "9px 13px", color: Z.white, fontSize: 13, lineHeight: 1.6, outline: "none", fontFamily: font, boxSizing: "border-box" }}
      />
    </div>
  );
}

export { RichTextEditor };