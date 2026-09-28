// Whitelist-based HTML sanitizer for training slide rich text.
// No external dependency — uses the browser's own DOMParser.
// Strips anything not on the allow-list (scripts, event handlers, iframes, etc.)
// while keeping the tags/attributes the slide editor actually produces.
//
// WHY THIS EXISTS: training slide text is authored as HTML in RichTextEditor
// and later rendered with dangerouslySetInnerHTML for every staff member.
// Without sanitising, an admin (or anyone who could write to the
// custom_modules table) could inject <script> that runs in every learner's
// browser. ALWAYS pass stored HTML through sanitizeHtml() before rendering it.
//
// TO ALLOW A NEW FORMAT (e.g. headings from the editor): add the tag name in
// UPPERCASE to ALLOWED_TAGS, and any attributes it needs to ALLOWED_ATTRS.
// Keep the list as short as possible — every addition widens the attack surface.

// Tag names are compared against element.tagName, which the DOM always reports in UPPERCASE.
const ALLOWED_TAGS = new Set([
    "P", "BR", "B", "STRONG", "I", "EM", "U",
    "UL", "OL", "LI", "A", "IMG", "DIV", "SPAN",
  ]);
  
  // Per-tag attribute allow-list. Tags not listed here keep NO attributes at all
  // (so class="", style="", onclick="" etc. are stripped from <p>, <span>, ...).
  const ALLOWED_ATTRS = {
    A: new Set(["href", "target", "rel"]),
    IMG: new Set(["src", "alt", "style"]),
  };
  
  // Only allow simple, layout-only style declarations on <img> (no expressions, no url() tricks beyond what's already in src)
  const SAFE_IMG_STYLE = /^(max-width|width|border-radius|opacity|display|margin)\s*:\s*[\w.%#\s-]+$/i;
  
  // Blocks javascript:, vbscript:, data:text/html etc. by only allowing known-good prefixes.
  // Note: "/" also admits protocol-relative URLs ("//other-site.com/x"), which load
  // over HTTPS from another host — acceptable for links/images, not for scripts.
  function isSafeUrl(url) {
    if (!url) return false;
    const trimmed = url.trim().toLowerCase();
    return (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:image/") ||
      trimmed.startsWith("/")
    );
  }
  
  /**
   * Clean an HTML string so it is safe to render with dangerouslySetInnerHTML.
   * @param {string} html  Untrusted HTML (e.g. a slide's rich text from the DB).
   * @returns {string} Sanitised HTML ("" for empty/non-string input).
   *
   * Works by parsing into a detached document (DOMParser does not execute scripts
   * or load images), walking every node, and removing/unwrapping anything unsafe.
   */
  function sanitizeHtml(html) {
    if (!html || typeof html !== "string") return "";
    if (typeof DOMParser === "undefined") return html; // non-browser env fallback (shouldn't happen client-side)
  
    const doc = new DOMParser().parseFromString(html, "text/html");
  
    function clean(node) {
      // iterate over a static copy since we may mutate the tree while walking
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 1) {
          const tag = child.tagName;
          if (!ALLOWED_TAGS.has(tag)) {
            // Unwrap disallowed elements (e.g. <script>, <style>, <iframe>) — drop the tag but keep safe children/text
            if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME" || tag === "OBJECT" || tag === "EMBED") {
              child.remove();
              return;
            }
            const parent = child.parentNode;
            while (child.firstChild) parent.insertBefore(child.firstChild, child);
            parent.removeChild(child);
            return;
          }
          const allowedAttrs = ALLOWED_ATTRS[tag] || new Set();
          [...child.attributes].forEach((attr) => {
            const name = attr.name.toLowerCase();
            if (!allowedAttrs.has(name)) {
              child.removeAttribute(attr.name);
              return;
            }
            if ((name === "href" || name === "src") && !isSafeUrl(attr.value)) {
              child.removeAttribute(attr.name);
              return;
            }
            if (name === "style") {
              const safeDecls = attr.value.split(";").map((s) => s.trim()).filter((s) => SAFE_IMG_STYLE.test(s));
              if (safeDecls.length) child.setAttribute("style", safeDecls.join(";"));
              else child.removeAttribute("style");
            }
          });
          // Force every link to open in a new tab, and stop the opened page
          // getting a handle back to the portal via window.opener ("tabnabbing").
          if (tag === "A") {
            child.setAttribute("target", "_blank");
            child.setAttribute("rel", "noopener noreferrer");
          }
          clean(child); // recurse into allowed element's children
        } else if (child.nodeType === 8) {
          // strip comments
          child.remove();
        }
        // nodeType 3 (plain text) is always kept — DOMParser has already
        // decoded it, and innerHTML re-escapes it on the way out.
      });
    }
  
    clean(doc.body);
    return doc.body.innerHTML;
  }
  
  export { sanitizeHtml };