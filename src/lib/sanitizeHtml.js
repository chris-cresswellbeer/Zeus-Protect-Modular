// Whitelist-based HTML sanitizer for training slide rich text.
// No external dependency — uses the browser's own DOMParser.
// Strips anything not on the allow-list (scripts, event handlers, iframes, etc.)
// while keeping the tags/attributes the slide editor actually produces.

const ALLOWED_TAGS = new Set([
    "P", "BR", "B", "STRONG", "I", "EM", "U",
    "UL", "OL", "LI", "A", "IMG", "DIV", "SPAN",
  ]);
  
  const ALLOWED_ATTRS = {
    A: new Set(["href", "target", "rel"]),
    IMG: new Set(["src", "alt", "style"]),
  };
  
  // Only allow simple, layout-only style declarations on <img> (no expressions, no url() tricks beyond what's already in src)
  const SAFE_IMG_STYLE = /^(max-width|width|border-radius|opacity|display|margin)\s*:\s*[\w.%#\s-]+$/i;
  
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
          if (tag === "A") {
            child.setAttribute("target", "_blank");
            child.setAttribute("rel", "noopener noreferrer");
          }
          clean(child);
        } else if (child.nodeType === 8) {
          // strip comments
          child.remove();
        }
      });
    }
  
    clean(doc.body);
    return doc.body.innerHTML;
  }
  
  export { sanitizeHtml };