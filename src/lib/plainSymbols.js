/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/plainSymbols.js — Professional Mode: emoji → plain black symbols
 * ═══════════════════════════════════════════════════════════════════════════
 * In Professional Mode every emoji in the portal is shown as a plain Unicode
 * symbol instead (⚠ → ⚠︎, 📅 → ▦, 🔍 → ⌕ …). The symbols are drawn in the text
 * colour, so they follow the theme. The list matches the "Plain substitute"
 * column of Zeus_Protect_Emoji_Inventory.xlsx.
 *
 * Two routes, so nothing is missed:
 *   1. E(emoji, fallback) in lib/emoji.js returns toPlain(emoji) in Professional Mode.
 *   2. startPlainSymbols() watches the page (MutationObserver) and rewrites any
 *      emoji that reach the screen without E() — text, and title / placeholder /
 *      aria-label attributes. Typed-in fields and the rich-text editor are never
 *      touched. stopPlainSymbols() puts the original characters back.
 *
 * Adding a new emoji to the portal? Add its substitute to PLAIN below.
 * Symbols that fonts can also draw as colour emoji carry U+FE0E ("show as text").
 * Emoji with no entry are left as they are.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const PLAIN = {
  "\u2139": "\u24D8", // ℹ → ⓘ
  "\u2197": "\u2197\uFE0E", // ↗ → ↗︎
  "\u21A9": "\u21A9\uFE0E", // ↩ → ↩︎
  "\u2328": "\u2328\uFE0E", // ⌨ → ⌨︎
  "\u2328\uFE0F": "\u2328\uFE0E", // ⌨️ → ⌨︎
  "\u23F0": "\u25F7", // ⏰ → ◷
  "\u23F3": "\u29D7", // ⏳ → ⧗
  "\u23F8": "\u2016", // ⏸ → ‖
  "\u25AA": "\u25AA\uFE0E", // ▪ → ▪︎
  "\u25FC": "\u25A0", // ◼ → ■
  "\u2600": "\u2600\uFE0E", // ☀ → ☀︎
  "\u2600\uFE0F": "\u2600\uFE0E", // ☀️ → ☀︎
  "\u2620": "\u2620\uFE0E", // ☠ → ☠︎
  "\u2622": "\u2622\uFE0E", // ☢ → ☢︎
  "\u2622\uFE0F": "\u2622\uFE0E", // ☢️ → ☢︎
  "\u2623": "\u2623\uFE0E", // ☣ → ☣︎
  "\u2697": "\u2697\uFE0E", // ⚗ → ⚗︎
  "\u2697\uFE0F": "\u2697\uFE0E", // ⚗️ → ⚗︎
  "\u2699": "\u2699\uFE0E", // ⚙ → ⚙︎
  "\u2699\uFE0F": "\u2699\uFE0E", // ⚙️ → ⚙︎
  "\u26A0": "\u26A0\uFE0E", // ⚠ → ⚠︎
  "\u26A0\uFE0F": "\u26A0\uFE0E", // ⚠️ → ⚠︎
  "\u26A1": "\u03DF", // ⚡ → ϟ
  "\u26AB": "\u25CF", // ⚫ → ●
  "\u2705": "\u2714\uFE0E", // ✅ → ✔︎
  "\u270D": "\u270E", // ✍ → ✎
  "\u270F": "\u270E", // ✏ → ✎
  "\u274C": "\u2717", // ❌ → ✗
  "\u2753": "?", // ❓ → ?
  "\u2795": "+", // ➕ → +
  "\u27A1": "\u2192", // ➡ → →
  "\u2B07": "\u2193", // ⬇ → ↓
  "\u2B1B": "\u25A0", // ⬛ → ■
  "\u{1F300}": "\u25CC", // 🌀 → ◌
  "\u{1F30C}": "\u2726", // 🌌 → ✦
  "\u{1F319}": "\u263E", // 🌙 → ☾
  "\u{1F321}": "\u00B0", // 🌡 → °
  "\u{1F321}\uFE0F": "\u00B0", // 🌡️ → °
  "\u{1F332}": "\u2663\uFE0E", // 🌲 → ♣︎
  "\u{1F338}": "\u273F", // 🌸 → ✿
  "\u{1F33F}": "\u2663\uFE0E", // 🌿 → ♣︎
  "\u{1F389}": "\u2605", // 🎉 → ★
  "\u{1F393}": "\u272A", // 🎓 → ✪
  "\u{1F399}": "\u23FA\uFE0E", // 🎙 → ⏺︎
  "\u{1F3AC}": "\u25B6\uFE0E", // 🎬 → ▶︎
  "\u{1F3AF}": "\u25CE", // 🎯 → ◎
  "\u{1F3C5}": "\u2605", // 🏅 → ★
  "\u{1F3C6}": "\u2605", // 🏆 → ★
  "\u{1F3D7}": "\u26DF", // 🏗 → ⛟
  "\u{1F3D7}\uFE0F": "\u26DF", // 🏗️ → ⛟
  "\u{1F3DC}": "\u2234", // 🏜 → ∴
  "\u{1F3E0}": "\u2302", // 🏠 → ⌂
  "\u{1F3E2}": "\u2302", // 🏢 → ⌂
  "\u{1F3E5}": "\u271A", // 🏥 → ✚
  "\u{1F3ED}": "\u2302", // 🏭 → ⌂
  "\u{1F441}": "\u25C9", // 👁 → ◉
  "\u{1F44B}": "", // 👋 → 
  "\u{1F454}": "\u265F\uFE0E", // 👔 → ♟︎
  "\u{1F464}": "\u265F\uFE0E", // 👤 → ♟︎
  "\u{1F465}": "\u265F\uFE0E\u265F\uFE0E", // 👥 → ♟︎♟︎
  "\u{1F477}": "\u26D1\uFE0E", // 👷 → ⛑︎
  "\u{1F480}": "\u2620\uFE0E", // 💀 → ☠︎
  "\u{1F4A1}": "\u24D8", // 💡 → ⓘ
  "\u{1F4A5}": "\u2738", // 💥 → ✸
  "\u{1F4AA}": "\u2726", // 💪 → ✦
  "\u{1F4AC}": "\u275D", // 💬 → ❝
  "\u{1F4BB}": "\u239A", // 💻 → ⎚
  "\u{1F4BE}": "\u2913", // 💾 → ⤓
  "\u{1F4C1}": "\u25AD", // 📁 → ▭
  "\u{1F4C2}": "\u25AD", // 📂 → ▭
  "\u{1F4C4}": "\u25A4", // 📄 → ▤
  "\u{1F4C5}": "\u25A6", // 📅 → ▦
  "\u{1F4CA}": "\u25A5", // 📊 → ▥
  "\u{1F4CB}": "\u2630", // 📋 → ☰
  "\u{1F4CC}": "\u2316", // 📌 → ⌖
  "\u{1F4CD}": "\u2316", // 📍 → ⌖
  "\u{1F4CE}": "\u2398", // 📎 → ⎘
  "\u{1F4D5}": "\u25A4", // 📕 → ▤
  "\u{1F4D6}": "\u25EB", // 📖 → ◫
  "\u{1F4D7}": "\u25A4", // 📗 → ▤
  "\u{1F4D8}": "\u25A4", // 📘 → ▤
  "\u{1F4D9}": "\u25A4", // 📙 → ▤
  "\u{1F4DA}": "\u25EB", // 📚 → ◫
  "\u{1F4DD}": "\u270E", // 📝 → ✎
  "\u{1F4E1}": "\u2301", // 📡 → ⌁
  "\u{1F4E4}": "\u21E7", // 📤 → ⇧
  "\u{1F4E5}": "\u21E9", // 📥 → ⇩
  "\u{1F4E6}": "\u229E", // 📦 → ⊞
  "\u{1F4F7}": "\u25D9", // 📷 → ◙
  "\u{1F4F8}": "\u25D9", // 📸 → ◙
  "\u{1F500}": "\u21C4", // 🔀 → ⇄
  "\u{1F501}": "\u21BB", // 🔁 → ↻
  "\u{1F504}": "\u21BB", // 🔄 → ↻
  "\u{1F50B}": "\u25AF", // 🔋 → ▯
  "\u{1F50D}": "\u2315", // 🔍 → ⌕
  "\u{1F510}": "\u22A0", // 🔐 → ⊠
  "\u{1F511}": "\u26BF", // 🔑 → ⚿
  "\u{1F513}": "\u22A1", // 🔓 → ⊡
  "\u{1F514}": "\u237E", // 🔔 → ⍾
  "\u{1F516}": "\u2691", // 🔖 → ⚑
  "\u{1F517}": "\u26AD", // 🔗 → ⚭
  "\u{1F525}": "\u2668\uFE0E", // 🔥 → ♨︎
  "\u{1F527}": "\u2692\uFE0E", // 🔧 → ⚒︎
  "\u{1F534}": "\u25CF", // 🔴 → ●
  "\u{1F535}": "\u25CF", // 🔵 → ●
  "\u{1F536}": "\u25C6", // 🔶 → ◆
  "\u{1F537}": "\u25C6", // 🔷 → ◆
  "\u{1F53C}": "\u25B2", // 🔼 → ▲
  "\u{1F558}": "\u27F2", // 🕘 → ⟲
  "\u{1F5A5}": "\u239A", // 🖥 → ⎚
  "\u{1F5A5}\uFE0F": "\u239A", // 🖥️ → ⎚
  "\u{1F5A8}": "\u2399", // 🖨 → ⎙
  "\u{1F5BC}": "\u25A3", // 🖼 → ▣
  "\u{1F5BC}\uFE0F": "\u25A3", // 🖼️ → ▣
  "\u{1F5C2}": "\u25A5", // 🗂 → ▥
  "\u{1F5C3}": "\u25A5", // 🗃 → ▥
  "\u{1F5C3}\uFE0F": "\u25A5", // 🗃️ → ▥
  "\u{1F5D1}": "\u2715", // 🗑 → ✕
  "\u{1F5D3}": "\u25A6", // 🗓 → ▦
  "\u{1F648}": "\u25CC", // 🙈 → ◌
  "\u{1F691}": "\u271A", // 🚑 → ✚
  "\u{1F69C}": "\u26DF", // 🚜 → ⛟
  "\u{1F6A7}": "\u25A8", // 🚧 → ▨
  "\u{1F6A8}": "\u203C\uFE0E", // 🚨 → ‼︎
  "\u{1F6AA}": "\u25AF", // 🚪 → ▯
  "\u{1F6AB}": "\u2298", // 🚫 → ⊘
  "\u{1F6B6}": "\u2192", // 🚶 → →
  "\u{1F6D2}": "\u2294", // 🛒 → ⊔
  "\u{1F6E0}": "\u2692\uFE0E", // 🛠 → ⚒︎
  "\u{1F7E0}": "\u25CF", // 🟠 → ●
  "\u{1F7E1}": "\u25CF", // 🟡 → ●
  "\u{1F7E2}": "\u25CF", // 🟢 → ●
  "\u{1F7E4}": "\u25CF", // 🟤 → ●
  "\u{1F9BA}": "\u26D1\uFE0E", // 🦺 → ⛑︎
  "\u{1F9D1}\u200D\u{1F692}": "\u26D1\uFE0E", // 🧑‍🚒 → ⛑︎
  "\u{1F9E0}": "\u2661", // 🧠 → ♡
  "\u{1F9EA}": "\u2697\uFE0E", // 🧪 → ⚗︎
  "\u{1F9EF}": "\u25AE", // 🧯 → ▮
  "\u{1F9F0}": "\u2692\uFE0E", // 🧰 → ⚒︎
  "\u{1FA79}": "\u271A", // 🩹 → ✚
  "\u{1FA7A}": "\u2695\uFE0E", // 🩺 → ⚕︎
  "\u{1FA91}": "\u259F", // 🪑 → ▟
  "\u{1FA9C}": "\u2637", // 🪜 → ☷
  "\u{1FAAA}": "\u25AD", // 🪪 → ▭
};

// Longest keys first, so multi-character emoji (e.g. 🧑‍🚒) win over their parts.
// An optional trailing U+FE0F ("show as emoji") is swallowed with the match.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const KEYS = Object.keys(PLAIN).sort((a, b) => b.length - a.length);
// (?!\uFE0E) skips symbols already marked "show as text", so running toPlain()
// on text it has already converted changes nothing (the page watcher relies on this).
const RE = new RegExp("(?:" + KEYS.map(escapeRe).join("|") + ")(?!\uFE0E)\uFE0F?", "gu");
const HAS = new RegExp(RE.source, "u");

/** Replace every known emoji in a string with its plain substitute. */
function toPlain(str) {
  if (typeof str !== "string" || !str) return str;
  return str.replace(RE, (m) => { const k = m.replace(/\uFE0F$/, ""); return PLAIN[k] ?? PLAIN[m] ?? m; });
}

// ── Page watcher ────────────────────────────────────────────────────────────
const ATTRS = ["title", "placeholder", "aria-label"];
let observer = null;
const originalText = new WeakMap();   // text node → text before we changed it
const originalAttr = new WeakMap();   // element → { attr: value before we changed it }

function skip(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (!el) return true;
  if (el.closest("script,style,textarea,[contenteditable=''],[contenteditable='true']")) return true;
  return false;
}
function fixText(node) {
  const v = node.nodeValue;
  if (!v || !HAS.test(v) || skip(node)) return;
  const p = toPlain(v);
  if (p !== v) { originalText.set(node, { orig: v, plain: p }); node.nodeValue = p; }
}
function fixAttrs(el) {
  if (skip(el)) return;
  ATTRS.forEach((a) => {
    const v = el.getAttribute && el.getAttribute(a);
    if (!v || !HAS.test(v)) return;
    const p = toPlain(v);
    if (p === v) return;
    const rec = originalAttr.get(el) || {};
    rec[a] = { orig: v, plain: p };
    originalAttr.set(el, rec);
    el.setAttribute(a, p);
  });
}
function scan(root) {
  if (!root) return;
  if (root.nodeType === 3) { fixText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1) fixAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); }
}

/** Turn the page watcher on (Professional Mode). Safe to call more than once. */
function startPlainSymbols() {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") fixText(m.target);
      else if (m.type === "attributes") fixAttrs(m.target);
      else m.addedNodes.forEach(scan);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  scan(document.body);
}

/** Turn it off and put back the original emoji wherever the page still shows our substitute. */
function stopPlainSymbols() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) {
      const r = originalText.get(n);
      if (r && n.nodeValue === r.plain) n.nodeValue = r.orig;
    } else {
      const rec = originalAttr.get(n);
      if (rec) Object.entries(rec).forEach(([a, r]) => { if (n.getAttribute(a) === r.plain) n.setAttribute(a, r.orig); });
    }
  }
}

export { PLAIN, toPlain, startPlainSymbols, stopPlainSymbols };
