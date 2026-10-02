/**
 * ═══════════════════════════════════════════════════════════════════════════
 * lib/xlsxWriter.js — tiny Excel (.xlsx) writer, no dependencies
 * ═══════════════════════════════════════════════════════════════════════════
 * Enough of the .xlsx format for formatted reports: several sheets, bold/coloured
 * text, cell fills, borders, wrapped / rotated text, column widths, row heights,
 * merged cells, frozen panes and auto-filter. Text is written inline (no shared
 * strings table), and the zip is "stored" (uncompressed), so the file is a
 * little larger than Excel's own but opens in Excel, Numbers, LibreOffice and
 * Google Sheets.
 *
 *   const blob = buildXlsx([{
 *     name: "Matrix",
 *     cols: [30, 12],                        // widths (characters)
 *     rows: [ [ {v:"Name", s:{bold:true, fill:"DDEBF7"}}, 5 ], ... ],
 *     rowHeights: { 0: 30 },                 // row index → points
 *     merges: ["A1:D1"],
 *     freeze: { row: 1, col: 1 },            // rows/cols kept visible
 *     autoFilter: "A3:F40",
 *   }]);
 *   downloadBlob(blob, "file.xlsx");
 *
 * Style keys: bold, italic, color (hex text colour), size, fill (hex background),
 * h ("left"|"center"|"right"), v ("top"|"center"|"bottom"), wrap, rotate (0-180),
 * border (thin grey all round), numFmt (e.g. "0%").
 */

// ── zip (store only) ─────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files) {                       // files: [{ name, data: Uint8Array }]
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const u16 = n => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
  files.forEach(f => {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...name]);
    parts.push(local, f.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + size;
  });
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ── xml helpers ──────────────────────────────────────────────────────────────
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
function colName(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
const hex = h => "FF" + String(h || "000000").replace("#", "").toUpperCase().padStart(6, "0").slice(-6);

// ── styles ───────────────────────────────────────────────────────────────────
function makeStyleTable() {
  const fonts = ['<font><sz val="11"/><name val="Calibri"/></font>'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>'];
  const numFmts = [];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const cache = new Map();
  const idx = (arr, xml) => { let i = arr.indexOf(xml); if (i < 0) { arr.push(xml); i = arr.length - 1; } return i; };
  function id(s) {
    if (!s) return 0;
    const key = JSON.stringify(s);
    if (cache.has(key)) return cache.get(key);
    const font = `<font>${s.bold ? "<b/>" : ""}${s.italic ? "<i/>" : ""}<sz val="${s.size || 11}"/><color rgb="${hex(s.color || "000000")}"/><name val="Calibri"/></font>`;
    const fontId = idx(fonts, font);
    const fillId = s.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${hex(s.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const borderId = s.border ? 1 : 0;
    let numFmtId = 0;
    if (s.numFmt) {
      const builtin = { "0": 1, "0.00": 2, "0%": 9, "0.00%": 10 }[s.numFmt];
      if (builtin != null) numFmtId = builtin;
      else { const i = numFmts.indexOf(s.numFmt); numFmtId = 164 + (i < 0 ? numFmts.push(s.numFmt) - 1 : i); }
    }
    const align = (s.h || s.v || s.wrap || s.rotate)
      ? `<alignment${s.h ? ` horizontal="${s.h}"` : ""}${s.v ? ` vertical="${s.v}"` : ""}${s.wrap ? ' wrapText="1"' : ""}${s.rotate ? ` textRotation="${s.rotate}"` : ""}/>` : "";
    xfs.push(`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ""} applyFont="1"${fillId ? ' applyFill="1"' : ""}${borderId ? ' applyBorder="1"' : ""}${align ? ' applyAlignment="1">' + align + "</xf>" : "/>"}`);
    cache.set(key, xfs.length - 1);
    return xfs.length - 1;
  }
  function xml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join("")}</numFmts>` : ""}<fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
  return { id, xml };
}

function sheetXml(sheet, styles) {
  const rows = sheet.rows || [];
  const heights = sheet.rowHeights || {};
  let cols = "";
  if (sheet.cols && sheet.cols.length) cols = `<cols>${sheet.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
  let pane = "";
  if (sheet.freeze && (sheet.freeze.row || sheet.freeze.col)) {
    const r = sheet.freeze.row || 0, c = sheet.freeze.col || 0;
    const cell = colName(c) + (r + 1);
    const which = r && c ? "bottomRight" : r ? "bottomLeft" : "topRight";
    pane = `<pane${c ? ` xSplit="${c}"` : ""}${r ? ` ySplit="${r}"` : ""} topLeftCell="${cell}" activePane="${which}" state="frozen"/><selection pane="${which}" activeCell="${cell}" sqref="${cell}"/>`;
  }
  const data = rows.map((row, ri) => {
    const cells = (row || []).map((cell, ci) => {
      if (cell === null || cell === undefined) return "";
      const c = (typeof cell === "object" && !(cell instanceof Date)) ? cell : { v: cell };
      const ref = colName(ci) + (ri + 1);
      const s = styles.id(c.s);
      const sAttr = s ? ` s="${s}"` : "";
      if (c.v === null || c.v === undefined || c.v === "") return s ? `<c r="${ref}"${sAttr}/>` : "";
      if (typeof c.v === "number" && isFinite(c.v)) return `<c r="${ref}"${sAttr}><v>${c.v}</v></c>`;
      return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
    }).join("");
    const h = heights[ri];
    return `<row r="${ri + 1}"${h ? ` ht="${h}" customHeight="1"` : ""}>${cells}</row>`;
  }).join("");
  const merges = (sheet.merges || []).length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  const filter = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : "";
  const setup = sheet.landscape ? `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>` : "";
  const fit = sheet.landscape ? `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${fit}<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${data}</sheetData>${filter}${merges}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>${setup}</worksheet>`;
}

/** Build an .xlsx Blob from sheet descriptions (see header). */
function buildXlsx(sheets) {
  const enc = new TextEncoder();
  const styles = makeStyleTable();
  const safeName = (n, i) => (String(n || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `Sheet${i + 1}`);
  const sheetXmls = sheets.map(s => sheetXml(s, styles));
  const files = [
    { name: "[Content_Types].xml", xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: "_rels/.rels", xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: "docProps/core.xml", xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Zeus Protect</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
    { name: "xl/workbook.xml", xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(safeName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${sheets.some(s => s.autoFilter) ? `<definedNames>${sheets.map((s, i) => s.autoFilter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(safeName(s.name, i)).replace(/'/g, "''")}'!${s.autoFilter.split(":").map(p => p.replace(/([A-Z]+)(\d+)/, "$$$1$$$2")).join(":")}</definedName>` : "").join("")}</definedNames>` : ""}</workbook>` },
    { name: "xl/_rels/workbook.xml.rels", xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    ...sheetXmls.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, xml })),
    { name: "xl/styles.xml", xml: styles.xml() },   // last: styles are collected while writing the sheets
  ];
  return zipStore(files.map(f => ({ name: f.name, data: enc.encode(f.xml) })));
}

/** Save a Blob as a file download. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export { buildXlsx, downloadBlob, colName, zipStore };
