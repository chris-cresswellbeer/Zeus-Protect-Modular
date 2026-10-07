/**
 * lib/emailTemplates.js — the look of every reminder email (lib/reminders.js).
 *
 * Plain HTML with inline styles and tables, which is what email programs (Outlook,
 * Gmail, phone mail apps) display reliably, plus a plain-text copy for programs
 * that don't show HTML. Light background so it prints and reads well everywhere.
 *
 * Emails say WHAT needs doing and link to the portal; they never carry incident
 * details, health information, files or file links (the portal is where those live,
 * behind a sign-in).
 */
export const ukDate = d => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split("-").reverse().join("/") : "");

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NAVY = "#0d1f5c", ACCENT = "#2563eb", RED = "#b91c1c", MUTED = "#5b6478", LINE = "#e3e8f2";
const FONT = "Arial,Helvetica,sans-serif";

/**
 * renderEmail({ preheader, greeting, intro, stats?:[{label, value, warn?}], sections:[{title, items:[{text, sub, flag}]}], note?, button?:{label, href}, banner? })
 * → { html, text }
 * banner: a coloured line at the very top (used for test copies: "This would have gone to …").
 */
export function renderEmail({ preheader = "", greeting = "", intro = "", stats = [], sections = [], note = "", button = null, banner = "" }) {
  const statHtml = stats.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border-collapse:separate;border-spacing:6px">
    ${chunk(stats, 3).map(row => `<tr>${row.map(x => { const hot = x.warn !== false && !!x.value; return `<td width="33%" style="background:${hot ? "#fff4f4" : "#f4f7fc"};border:1px solid ${hot ? "#f5c2c2" : LINE};border-radius:8px;padding:10px 8px;text-align:center;font-family:${FONT}">
      <div style="font-size:22px;font-weight:bold;color:${hot ? RED : NAVY}">${esc(x.value)}</div><div style="font-size:11px;color:${MUTED};margin-top:2px">${esc(x.label)}</div></td>`; }).join("")}</tr>`).join("")}
  </table>` : "";
  const secHtml = sections.map(sec => `
    <div style="font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:.6px;text-transform:uppercase;color:${MUTED};margin:18px 0 6px">${esc(sec.title)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${sec.items.map(it => `<tr><td style="border-top:1px solid ${LINE};padding:9px 0 9px 10px;border-left:3px solid ${it.flag ? RED : ACCENT};font-family:${FONT}">
        <div style="font-size:14px;color:#111827;font-weight:bold">${esc(it.text)}</div>
        ${it.sub ? `<div style="font-size:12.5px;color:${it.flag ? RED : MUTED};margin-top:2px">${esc(it.sub)}</div>` : ""}</td></tr>`).join("")}
    </table>`).join("");
  const btn = button && button.href ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px"><tr><td style="background:${ACCENT};border-radius:8px">
      <a href="${esc(button.href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(button.label)}</a></td></tr></table>` : "";
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(preheader)}</title></head>
<body style="margin:0;padding:0;background:#eef1f7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
${banner ? `<div style="background:#fff3cd;border-bottom:1px solid #f0d58a;padding:10px 16px;font-family:${FONT};font-size:13px;color:#5c4400;text-align:center">${esc(banner)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f7"><tr><td align="center" style="padding:20px 10px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${LINE}">
    <tr><td style="background:${NAVY};padding:16px 24px;font-family:${FONT}">
      <span style="font-size:18px;font-weight:bold;color:#ffffff">Zeus Protect</span>
      <span style="font-size:12px;color:#aab6dd;padding-left:8px">Health &amp; Safety</span></td></tr>
    <tr><td style="padding:22px 24px 26px">
      ${greeting ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:15px;color:#111827">${esc(greeting)}</p>` : ""}
      ${intro ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:14px;line-height:1.5;color:#374151">${esc(intro)}</p>` : ""}
      ${statHtml}${secHtml}
      ${note ? `<p style="margin:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED}">${esc(note)}</p>` : ""}
      ${btn}
      ${button && button.href ? `<p style="margin:6px 0 0;font-family:${FONT};font-size:11.5px;color:${MUTED}">You'll be asked to sign in first.</p>` : ""}
    </td></tr>
    <tr><td style="background:#f6f8fc;border-top:1px solid ${LINE};padding:14px 24px;font-family:${FONT};font-size:11.5px;line-height:1.5;color:${MUTED}">
      This is an automatic message from Zeus Protect, the H&amp;S portal. Please don't reply to it: if something looks wrong, speak to the H&amp;S team.
    </td></tr>
  </table>
</td></tr></table></body></html>`;

  const text = [banner && `*** ${banner} ***\n`, greeting, intro,
    stats.length ? stats.map(x => `${x.label}: ${x.value}`).join("\n") : "",
    ...sections.map(sec => `${sec.title.toUpperCase()}\n${sec.items.map(it => `${it.flag ? "! " : "- "}${it.text}${it.sub ? `\n    ${it.sub}` : ""}`).join("\n")}`),
    note, button && button.href ? `${button.label}: ${button.href}\n(You'll be asked to sign in first.)` : "",
    "--\nThis is an automatic message from Zeus Protect, the H&S portal. Please don't reply to it: if something looks wrong, speak to the H&S team."]
    .filter(Boolean).join("\n\n");
  return { html, text };
}

function chunk(list, n) { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; }
