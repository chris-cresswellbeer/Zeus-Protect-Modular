// Guide pictures: the PPE register (admin guide 20.3, phone guide). Real database rules (e2e
// database), realistic data dated around today. Run: node qr/ppeguide.mjs  (dist-auth on :4174)
import { execFileSync } from "child_process";
import fs from "fs";
process.env.ZP_BASE = "http://localhost:4174/";
const { open } = await import("../guide/harness.mjs");
const M = await import("./mockauth.mjs");
const { handler: adminFn } = await import("../netlify/functions/zp-admin.mjs");
const { shot } = await import("../admin/lib.mjs");
const D = { dir: "qr/ppeg/" }; fs.mkdirSync(D.dir, { recursive: true });
const css = fs.readFileSync("mobile/barlow.css", "utf8");
const FONTS = `(()=>{const add=()=>{if(document.getElementById('__barlow'))return;const s=document.createElement('style');s.id='__barlow';s.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(s);};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add();})();`;
M.useRealDatabase("zeus-protect-e2e-test-secret-0123456789abcdef", "http://127.0.0.1:5570");
const srv = await M.serve(5564);
const S = await import("./mockstorage.mjs");
const sql = q => execFileSync("psql", ["-h", "/var/tmp/zpg", "-p", "5499", "-U", "postgres", "-d", "e2e", "-At", "-c", q], { maxBuffer: 1e8 }).toString().trim();
const errors = [];
M.addAuthUser({ email: "cltestad@zeus.com", password: "AdminPass#1", app_metadata: { zp_id: "1", zp_role: "admin", must_change_password: false } });
M.addAuthUser({ email: "marcus.webb@example.com", password: "MarcusPass#1", app_metadata: { zp_id: "10", zp_role: "staff", must_change_password: false } });
sql("delete from ppe_issues; delete from app_settings where id='ppe'");
sql(`update users set data = data || '{"jobTitle":"Driver"}' where id='10'`);

async function session(opts, email, pw) {
  const o = await open(opts);
  await S.installStorage(o.ctx);
  await o.ctx.route(/supabase\.co\/rest\/v1/, async route => {
    const req = route.request(); const u = new URL(req.url());
    const tok = String(req.headers()["authorization"] || "").replace(/^Bearer\s+/i, "");
    const f = await M.forwardRest(req.method(), u.pathname + u.search, req.headers(), req.postData(), M.isOurToken(tok) ? tok : null);
    await route.fulfill({ status: f.status, contentType: f.type, body: f.text });
  });
  await o.ctx.route(/supabase\.co\/auth\/v1/, async route => {
    const req = route.request(); const u = new URL(req.url());
    const r = M.handle(req.method(), u.pathname + u.search, req.headers(), req.postData() || "");
    await route.fulfill({ status: r.status, contentType: "application/json", body: r.json == null ? "" : JSON.stringify(r.json) });
  });
  await o.ctx.route("**/.netlify/functions/zp-admin", async route => { const req = route.request(); const res = await adminFn({ httpMethod: req.method(), headers: req.headers(), body: req.postData() }); await route.fulfill({ status: res.statusCode, contentType: "application/json", body: res.body }); });
  o.page.on("pageerror", e => errors.push(`${email}: ${e.message}`));
  await o.page.reload(); await o.page.waitForTimeout(800);
  await o.page.waitForSelector('input[placeholder="you@company.co.uk"]', { timeout: 20000 });
  await o.page.fill('input[placeholder="you@company.co.uk"]', email); await o.page.fill('input[type="password"]', pw);
  await o.page.keyboard.press("Enter"); await o.page.waitForTimeout(2500);
  return o;
}
const IPHONE = { width: 393, height: 852, mobile: true, dpr: 3, init: FONTS, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" };
const search = async (P, text) => { await P.keyboard.press("Control+k"); await P.getByTestId("qs").getByRole("combobox").fill(text); await P.waitForTimeout(400); await P.keyboard.press("Enter"); await P.waitForTimeout(1400); };
async function draw(P, testid, seed = 1) {
  const c = P.getByTestId(testid); await c.scrollIntoViewIfNeeded(); const b = await c.boundingBox();
  const y0 = b.y + b.height / 2 - 4, x0 = b.x + 34, w = Math.min(320, b.width - 80);
  await P.mouse.move(x0, y0); await P.mouse.down();
  for (let i = 1; i <= 90; i++) { const t = i / 90; const x = x0 + t * w + Math.sin(t * 22 + seed) * 9; const y = y0 + Math.sin(t * 11 + seed) * 26 * (1 - t * 0.5) - Math.cos(t * 22) * 8; await P.mouse.move(x, y); }
  await P.mouse.up();
  await P.mouse.move(x0 - 6, y0 + 34); await P.mouse.down(); await P.mouse.move(x0 + w * 0.6, y0 + 30, { steps: 12 }); await P.mouse.up(); await P.waitForTimeout(250);
}

// ── signatures: drawn once per person on a page, stored as small PNGs ──
let A = await session({ width: 1440, height: 900, init: FONTS }, "cltestad@zeus.com", "AdminPass#1"); let P = A.page;
const sigs = await P.evaluate(() => {
  const out = {};
  const make = (seed) => { const c = document.createElement("canvas"); c.width = 600; c.height = 200; const x = c.getContext("2d");
    x.strokeStyle = "#0d1f5c"; x.lineWidth = 5; x.lineCap = "round"; x.lineJoin = "round";
    let r = seed; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    x.beginPath(); let px = 40, py = 110; x.moveTo(px, py);
    for (let i = 0; i < 14; i++) { const nx = px + 22 + rnd() * 26, ny = 70 + rnd() * 70; x.quadraticCurveTo(px + 10, ny < 100 ? 40 + rnd() * 30 : 150 + rnd() * 20, nx, ny); px = nx; py = ny; }
    x.stroke(); x.beginPath(); x.moveTo(30, 150); x.quadraticCurveTo(250, 130 + rnd() * 20, 420 + rnd() * 80, 140); x.lineWidth = 3; x.stroke();
    return c.toDataURL("image/png"); };
  ["2", "6", "9", "10", "12", "3", "4"].forEach((id, i) => { out[id] = make(1234 + i * 777); });
  return out;
});
const S_ = s => s.replace(/'/g, "''");
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const addD = (d, n) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const addM = (d, n) => { const [y, m, dd] = d.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(dd, last)); return t.toISOString().slice(0, 10); };
const STMT = "I have received the PPE listed, it fits me, and I have been shown how to wear, check and store it. I will wear it where it is required, and tell my supervisor if it is damaged, lost or no longer fits.";
const PEOPLE = { 2: ["Test Staff", "Warehouse"], 3: ["Priya Shah", "Office"], 4: ["Tom Hale", "Office"], 6: ["Owen Birch", "Warehouse"], 9: ["Ellie Dunn", "Warehouse"], 10: ["Marcus Webb", "Warehouse"], 12: ["Leo Grant", "Warehouse"] };
const ITEMS = { boots: ["Safety boots", "EN ISO 20345 S3 SRC", 12], "hivis-vest": ["Hi-vis vest", "EN ISO 20471 Class 2", 12], "hivis-jacket": ["Hi-vis jacket", "EN ISO 20471 Class 3", 12], gloves: ["Safety gloves (general handling)", "EN 388", 3], "cut-gloves": ["Cut-resistant gloves", "EN 388 cut level C", 3], glasses: ["Safety glasses", "EN ISO 16321 / EN 166", 6], "ear-defenders": ["Ear defenders", "EN 352-1", 12], "bump-cap": ["Bump cap", "EN 812", 36] };
let n = 0;
function issue(uid, itemId, size, daysAgo, { qty = 1, by = "Test Admin", reason = "new", signed = true, status = "issued", returned = null, problems = [], via = "in person", id } = {}) {
  const [item, standard, life] = ITEMS[itemId]; const on = addD(today, -daysAgo); const rb = addM(on, life);
  const at = `${on}T${String(8 + (n % 8)).padStart(2, "0")}:${String((n * 7) % 60).padStart(2, "0")}:00.000Z`;
  const data = { userId: String(uid), name: PEOPLE[uid][0], dept: PEOPLE[uid][1], itemId, item, standard, size, qty, reason, note: "", issuedOn: on, issuedAt: at, issuedBy: by, life, replaceBy: rb, statement: STMT,
    signature: signed ? sigs[uid] : null, signedAt: signed ? at : null, signedVia: signed ? via : null, problems, ...(returned || {}) };
  const rid = id || `ppe_seed${++n}`;
  sql(`insert into ppe_issues (id, user_id, status, replace_by, data, created_at) values ('${rid}', '${uid}', '${status}', '${rb}', '${S_(JSON.stringify(data))}', '${at}')`);
  return rid;
}
// Ellie: ear defenders overdue; glasses due soon; boots replaced after the sole split
const eOld = issue(9, "boots", "UK 5", 520, { by: "Jordan Reeves", status: "replaced", problems: [{ kind: "damaged", note: "sole coming away at the toe", at: `${addD(today, -158)}T07:40:00.000Z`, by: "Ellie Dunn", dealtBy: "Test Admin", dealtAt: `${addD(today, -157)}T09:10:00.000Z`, dealtNote: "Replaced" }] });
const eNew = issue(9, "boots", "UK 5", 157, { reason: "damaged" });
sql(`update ppe_issues set data = data || '{"returnedOn":"${addD(today, -157)}","returnedBy":"Test Admin","returnReason":"Replaced","replacedBy":"${eNew}"}' where id='${eOld}'`);
sql(`update ppe_issues set data = data || '{"replaces":"${eOld}"}' where id='${eNew}'`);
issue(9, "ear-defenders", "One size", 405, { by: "Jordan Reeves" });
issue(9, "glasses", "One size", 178);
issue(9, "cut-gloves", "7 (S)", 15, { qty: 3, by: "Jordan Reeves" });
// Owen: boots due soon, vest and gloves in date
issue(6, "boots", "UK 9", 348);
issue(6, "hivis-vest", "XL", 228);
issue(6, "gloves", "9 (L)", 45, { qty: 3, by: "Jordan Reeves" });
// Marcus: new jacket waiting for his signature; boots
issue(10, "hivis-jacket", "L", 1, { signed: false });
issue(10, "boots", "UK 10", 118);
// Leo: gloves reported not fitting
issue(12, "gloves", "8 (M)", 57, { qty: 2, by: "Jordan Reeves", problems: [{ kind: "fit", note: "too tight, need a 9", at: `${addD(today, -2)}T13:05:00.000Z`, by: "Leo Grant" }] });
issue(12, "bump-cap", "M", 256);
// Test Staff: vest overdue; glasses
issue(2, "hivis-vest", "M", 381, { by: "Jordan Reeves" });
issue(2, "glasses", "One size", 107, { via: "phone" });
// Priya: vest for the warehouse floor; Tom: boots returned
issue(3, "hivis-vest", "S", 277);
issue(4, "boots", "UK 8", 600, { status: "returned", returned: { returnedOn: addD(today, -108), returnedBy: "Test Admin", returnReason: "No longer needed for the job" } });

// ── admin: the register ──
await P.reload(); await P.waitForSelector('input[placeholder="you@company.co.uk"]'); await P.fill('input[placeholder="you@company.co.uk"]', "cltestad@zeus.com"); await P.fill('input[type="password"]', "AdminPass#1"); await P.keyboard.press("Enter"); await P.waitForTimeout(2500);
await search(P, "PPE Register");
await P.mouse.move(5, 890);
await shot(P, "p1_ppe_register", [
  { n: 1, locs: [P.getByTestId("ppe-tile-issued12"), P.getByTestId("ppe-tile-problem")], pad: 4 },
  { n: 2, locs: [P.getByTestId("ppe-search"), P.getByTestId("ppe-filter-all")], pad: 4 },
  { n: 3, loc: P.getByTestId("ppe-row-state").first(), pad: 4 },
  { n: 4, locs: [P.getByTestId("ppe-row-replace").first(), P.getByTestId("ppe-row-sign").first()], pad: 4 },
  { n: 5, locs: [P.getByTestId("ppe-csv"), P.getByTestId("ppe-issue-btn")], pad: 4 },
], { ...D, around: [P.getByTestId("ppe-tab")], pad: 24 });

// items & sizes
await P.setViewportSize({ width: 1440, height: 2400 });
await P.getByTestId("ppe-items-btn").click(); await P.waitForTimeout(500);
await shot(P, "p2_ppe_items", [
  { n: 1, loc: P.getByTestId("ppe-item-row").first(), pad: 4 },
  { n: 2, loc: P.getByTestId("ppe-item-add"), pad: 4 },
  { n: 3, loc: P.locator("#ppe-statement"), pad: 4 },
  { n: 4, locs: [P.locator("#ppe-days"), P.getByTestId("ppe-staffcansee")], pad: 6 },
], { ...D, around: [P.getByTestId("ppe-items")], pad: 12, col: false });
await P.keyboard.press("Escape"); await P.waitForTimeout(300);

// issue PPE (tablet-sized window)
await P.setViewportSize({ width: 1180, height: 2400 });
await P.getByTestId("ppe-issue-btn").click(); await P.waitForTimeout(400);
await P.getByTestId("ppe-person").selectOption("6");
await P.getByTestId("ppe-line-item").first().selectOption("gloves"); await P.waitForTimeout(200);
await P.getByTestId("ppe-line-qty").first().selectOption("3"); await P.getByTestId("ppe-reason-worn").first().click();
await P.getByTestId("ppe-add-line").click(); await P.getByTestId("ppe-line-item").nth(1).selectOption("glasses");
await draw(P, "ppe-sig", 2);
await shot(P, "p3_ppe_issue", [
  { n: 1, loc: P.getByTestId("ppe-person"), pad: 4 },
  { n: 2, locs: [P.getByTestId("ppe-line-item").first(), P.getByTestId("ppe-line-qty").first()], pad: 4 },
  { n: 3, loc: P.getByTestId("ppe-reason-new").first().locator(".."), pad: 4 },
  { n: 4, loc: P.getByTestId("ppe-add-line"), pad: 4 },
  { n: 5, loc: P.getByTestId("ppe-sig"), pad: 6 },
  { n: 6, locs: [P.getByTestId("ppe-issue-sign"), P.getByTestId("ppe-issue-nosign")], pad: 4 },
], { ...D, around: [P.getByTestId("ppe-issue")], pad: 12, col: false });
await P.keyboard.press("Escape"); await P.waitForTimeout(300);

// Ellie's record
await P.setViewportSize({ width: 1440, height: 2400 });
await P.getByTestId("ppe-row-person").filter({ hasText: "Ellie Dunn" }).first().click(); await P.waitForTimeout(600);
await shot(P, "p4_ppe_person", [
  { n: 1, locs: [P.getByTestId("ppe-print"), P.getByTestId("ppe-person-issue")], pad: 4 },
  { n: 2, loc: P.getByText("Last sizes issued", { exact: false }).locator(".."), pad: 2 },
  { n: 3, loc: P.getByTestId("ppe-replace-now").first().locator(".."), pad: 2 },
  { n: 4, locs: [P.getByTestId("ppe-replace").first(), P.getByTestId("ppe-return").first()], pad: 4 },
  { n: 5, loc: P.getByTestId("ppe-history-row").first(), pad: 2 },
], { ...D, around: [P.getByTestId("ppe-person")], pad: 12, col: false });
const [pop] = await Promise.all([P.waitForEvent("popup"), P.getByTestId("ppe-print").click()]);
await pop.setViewportSize({ width: 1100, height: 700 }); await pop.waitForLoadState(); await pop.waitForTimeout(300);
await pop.screenshot({ path: D.dir + "p5_ppe_print.png", fullPage: true }); await pop.close();
await P.keyboard.press("Escape"); await P.waitForTimeout(300);
// the bell
await P.setViewportSize({ width: 1440, height: 900 });
await A.page.context().browser().close();

// ── Marcus on his phone ──
let F = await session(IPHONE, "marcus.webb@example.com", "MarcusPass#1"); let Q = F.page;
await Q.waitForTimeout(800);
await shot(Q, "50_ppe_banner", [{ n: 1, loc: Q.getByTestId("m-ppe-banner"), pad: 4 }], D);
await Q.getByTestId("m-ppe-banner").click(); await Q.waitForTimeout(700);
await shot(Q, "51_ppe_list", [{ n: 1, loc: Q.getByTestId("m-ppe-sign").locator("xpath=../.."), pad: 2 }, { n: 2, loc: Q.getByTestId("m-ppe-item").nth(1), pad: 3 }, { n: 3, loc: Q.getByTestId("m-ppe-report").nth(1), pad: 3 }], D);
await Q.getByTestId("m-ppe-sign").click(); await Q.waitForTimeout(400);
await draw(Q, "m-ppe-sig", 3);
await shot(Q, "52_ppe_sign", [{ n: 1, loc: Q.getByTestId("m-ppe-sig"), pad: 4 }, { n: 2, loc: Q.getByTestId("m-ppe-sig-type"), pad: 3 }, { n: 3, loc: Q.getByTestId("m-ppe-sign-save").locator(".."), pad: 3 }], D);
await Q.getByText("Cancel", { exact: true }).click(); await Q.waitForTimeout(300);
await Q.getByTestId("m-ppe-report").nth(1).click(); await Q.waitForTimeout(300);
await Q.getByTestId("m-ppe-kind-damaged").click(); await Q.locator("#m-ppe-note").fill("Toe cap showing through");
await shot(Q, "53_ppe_report", [{ n: 1, loc: Q.getByTestId("m-ppe-kind-damaged").locator(".."), pad: 4 }, { n: 2, loc: Q.locator("#m-ppe-note"), pad: 4 }, { n: 3, loc: Q.getByTestId("m-ppe-report-send").locator(".."), pad: 3 }], D);
await F.page.context().browser().close();
console.log(errors.length ? "ERRORS " + errors.join(" | ") : "no page errors");
srv.close(); process.exit(0);
