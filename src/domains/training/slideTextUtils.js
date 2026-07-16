// Shared helpers for training slide "text" content, which can be either:
//  - legacy plain text (older modules, no HTML tags) — rendered with the
//    existing sentence-splitting / "Step N:" formatter
//  - rich HTML produced by RichTextEditor (contains tags) — rendered as HTML

function isHtmlContent(text) {
    if (!text) return false;
    return /<[a-z][\s\S]*>/i.test(text);
  }
  
  function htmlToPlainText(html) {
    if (!html) return "";
    if (!isHtmlContent(html)) return html;
    if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ").trim();
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent || div.innerText || "").trim();
  }
  
  let injected = false;
  function ensureRteStyles() {
    if (injected || typeof document === "undefined") return;
    if (document.getElementById("rte-shared-styles")) { injected = true; return; }
    const style = document.createElement("style");
    style.id = "rte-shared-styles";
    style.textContent = `
      .rte-content { }
      .rte-content ul, .rte-content ol { margin: 8px 0; padding-left: 22px; }
      .rte-content li { margin-bottom: 4px; }
      .rte-content p { margin: 0 0 10px; }
      .rte-content a { color: #60a5fa; text-decoration: underline; }
      .rte-content img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
      .rte-content b, .rte-content strong { font-weight: 700; }
      .rte-editable:empty:before { content: attr(data-placeholder); color: #6b7280; pointer-events: none; }
      .rte-editable:focus { outline: none; }
    `;
    document.head.appendChild(style);
    injected = true;
  }
  
  export { isHtmlContent, htmlToPlainText, ensureRteStyles };