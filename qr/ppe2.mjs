// End-to-end: the PPE register against the REAL database rules (e2e database + PostgREST).
// Admin sets up items, issues PPE on a "tablet" with a signature, issues without one,
// replaces and returns; staff sign and report a problem on the phone; a line manager sees
// and issues for their team only; staff on the desktop see only their own.
// Run: node qr/ppe2.mjs  (needs dist-auth on :4174 and a fresh e2e database)
import { execFileSync } from "child_process";
process.env.ZP_BASE = "http://localhost:4174/";
const { open } = await import("../guide/harness.mjs");
const M = await import("./mockauth.mjs");
const { handler: adminFn } = await import("../netlify/functions/zp-admin.mjs");
M.useRealDatabase("zeus-protect-e2e-test-secret-0123456789abcdef", "http://127.0.0.1:5570");
const srv = await M.serve(5564);
const S = await import("./mockstorage.mjs");
const sql = q => execFileSync("psql", ["-h", "/var/tmp/zpg", "-p", "5499", "-U", "postgres", "-d", "e2e", "-At", "-c", q]).toString().trim();
const check = (name, ok, extra = "") => console.log(ok ? "PASS" : "FAIL", name, extra);
const errors = [], failed = [], received = {};
M.addAuthUser({ email: "cltestad@zeus.com", password: "AdminPass#1", app_metadata: { zp_id: "1", zp_role: "admin", must_change_password: false } });
M.addAuthUser({ email: "clteststaff@zeus.com", password: "StaffPass#1", app_metadata: { zp_id: "2", zp_role: "staff", must_change_password: false } });
M.addAuthUser({ email: "owen.birch@example.com", password: "OwenPass#1", app_metadata: { zp_id: "6", zp_role: "staff", must_change_password: false } });
M.addAuthUser({ email: "jordan.reeves@example.com", password: "MgrPass#1", app_metadata: { zp_id: "14", zp_role: "manager", must_change_password: false } });
sql("delete from ppe_issues; delete from app_settings where id='ppe'");

async function session(opts, email, pw) {
  const o = await open(opts);
  await S.installStorage(o.ctx);
  await o.ctx.route(/supabase\.co\/rest\/v1/, async route => {
    const req = route.request(); const u = new URL(req.url());
    const tok = String(req.headers()["authorization"] || "").replace(/^Bearer\s+/i, "");
    const f = await M.forwardRest(req.method(), u.pathname + u.search, req.headers(), req.postData(), M.isOurToken(tok) ? tok : null);
    if (f.status >= 400 && !/email_log|site_signins|lone_working/.test(u.pathname)) failed.push(`${email} ${req.method()} ${u.pathname}${u.search.slice(0, 50)} → ${f.status} ${f.text.slice(0, 140)}`);
    if (req.method() === "GET" && /\/ppe_issues/.test(u.pathname)) { try { const ids = JSON.parse(f.text).map(x => x.user_id); received[email] = [...new Set([...(received[email] || []), ...ids])]; } catch { /* */ } }
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
const IPHONE = { width: 393, height: 852, mobile: true, dpr: 2, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" };
const rows = () => JSON.parse(sql("select coalesce(json_agg(json_build_object('id',id,'user_id',user_id,'status',status,'replace_by',replace_by,'data',data) order by created_at),'[]') from ppe_issues") || "[]");
const search = async (P, text) => { await P.keyboard.press("Control+k"); await P.getByTestId("qs").getByRole("combobox").fill(text); await P.waitForTimeout(400); await P.keyboard.press("Enter"); await P.waitForTimeout(1400); };
async function draw(P, testid) {
  const c = P.getByTestId(testid); await c.scrollIntoViewIfNeeded(); const b = await c.boundingBox();
  await P.mouse.move(b.x + 30, b.y + b.height / 2); await P.mouse.down();
  for (let i = 1; i <= 12; i++) await P.mouse.move(b.x + 30 + i * 18, b.y + b.height / 2 + (i % 2 ? -22 : 18), { steps: 3 });
  await P.mouse.up(); await P.waitForTimeout(200);
}
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

// ── 1. admin: the register and the items ──
let A = await session({ width: 1500, height: 950 }, "cltestad@zeus.com", "AdminPass#1"); let P = A.page;
await search(P, "PPE Register");
check("1 quick search → PPE Register, empty", (await P.getByTestId("ppe-tab").count()) === 1 && /No PPE recorded yet/.test(await P.getByTestId("ppe-tab").innerText()));
const meMenu = await P.getByRole("button", { name: /Machinery & Equipment/ }).first(); await meMenu.click(); await P.waitForTimeout(300);
check("2 Machinery & Equipment ▼ has PPE Register", (await P.getByRole("menuitem", { name: "PPE Register" }).count()) + (await P.getByText("PPE Register", { exact: true }).count()) > 1);
await P.keyboard.press("Escape");
await P.getByTestId("ppe-items-btn").click(); await P.waitForTimeout(400);
check("3 Items & sizes: starting list of 9", (await P.getByTestId("ppe-item-row").count()) === 9);
await P.getByTestId("ppe-item-add").click();
const last = P.getByTestId("ppe-item-row").last();
await last.getByLabel(/name$/).fill("Chemical apron"); await last.getByLabel(/standard$/).fill("EN 14605"); await last.getByLabel(/months$/).fill("6"); await last.getByLabel(/sizes$/).fill("M, L, XL");
await P.getByTestId("ppe-items-save").click(); await P.waitForTimeout(1200);
const st = JSON.parse(sql("select data::text from app_settings where id='ppe'") || "{}");
check("4 saved: 10 items, the apron with its sizes and 6 months", st.items && st.items.length === 10 && st.items[9].name === "Chemical apron" && st.items[9].sizes.join() === "M,L,XL" && st.items[9].life === 6, JSON.stringify(st.items && st.items[9]));

// ── 2. issue on a tablet, signed ──
await P.getByTestId("ppe-issue-btn").click(); await P.waitForTimeout(400);
await P.getByTestId("ppe-person-search").fill("owen"); await P.getByTestId("ppe-person").selectOption("6");
await P.getByTestId("ppe-line-item").first().selectOption("boots"); await P.getByTestId("ppe-line-size").first().selectOption("UK 9");
await P.getByTestId("ppe-add-line").click(); await P.getByTestId("ppe-line-item").nth(1).selectOption("gloves"); await P.getByTestId("ppe-line-size").nth(1).selectOption("9 (L)"); await P.getByTestId("ppe-line-qty").nth(1).selectOption("2");
await P.getByTestId("ppe-issue-sign").click(); await P.waitForTimeout(300);
check("5 can't confirm without a signature", /needs to sign/.test(await P.getByTestId("ppe-issue").innerText()) && rows().length === 0);
await draw(P, "ppe-sig");
await P.getByTestId("ppe-issue-sign").click(); await P.waitForTimeout(1500);
let R = rows();
const boots = R.find(r => r.data.itemId === "boots"), gl = R.find(r => r.data.itemId === "gloves");
check("6 two issues saved for Owen, signed in person, by Test Admin", R.length === 2 && boots && gl && boots.user_id === "6" && /^data:image\/png;base64,/.test(boots.data.signature) && boots.data.signedVia === "in person" && boots.data.issuedBy === "Test Admin" && gl.data.qty === 2, JSON.stringify(R.map(r => [r.data.item, r.data.size, r.data.qty, !!r.data.signature])));
check("7 replace-by dates from the item lives (12 and 3 months)", boots.replace_by === boots.data.replaceBy && boots.data.replaceBy.slice(0, 4) === String(Number(today.slice(0, 4)) + 1) && gl.data.life === 3, `${boots.replace_by} ${gl.replace_by}`);
check("8 the signature is small (under 40 KB)", boots.data.signature.length < 40000, String(boots.data.signature.length));

// ── 3. issue without a signature (they sign later) ──
await P.getByTestId("ppe-issue-btn").click(); await P.waitForTimeout(400);
await P.getByTestId("ppe-person").selectOption("6");
await P.getByTestId("ppe-line-item").first().selectOption("hivis-vest"); await P.getByTestId("ppe-line-size").first().selectOption("L");
await P.getByTestId("ppe-issue-nosign").click(); await P.waitForTimeout(1500);
await P.getByTestId("ppe-issue-btn").click(); await P.waitForTimeout(400);
await P.getByTestId("ppe-person").selectOption("2");
await P.getByTestId("ppe-line-item").first().selectOption("glasses");
check("9 one-size item: size filled in", (await P.getByTestId("ppe-line-size").first().inputValue()) === "One size");
await P.getByTestId("ppe-issue-nosign").click(); await P.waitForTimeout(1500);
R = rows();
check("10 unsigned issues saved", R.length === 4 && R.filter(r => !r.data.signature).length === 2);
check("11 tiles: waiting for a signature 2, issued 4", (await P.getByTestId("ppe-tile-unsigned-n").innerText()) === "2" && (await P.getByTestId("ppe-tile-issued12-n").innerText()) === "4");
await P.getByTestId("ppe-filter-unsigned").click(); await P.waitForTimeout(300);
check("12 filter Not signed → 2 rows", (await P.getByTestId("ppe-row").count()) === 2);
await P.getByTestId("ppe-filter-current").click(); await P.waitForTimeout(300);

// ── 4. the person record: replace and return ──
await P.getByTestId("ppe-row-person").filter({ hasText: "Owen Birch" }).first().click(); await P.waitForTimeout(500);
check("13 Owen's record: 3 current items, sizes remembered", (await P.getByTestId("ppe-current").count()) === 3 && /UK 9/.test(await P.getByTestId("ppe-person").innerText()));
await P.evaluate(() => { window.__zpTestAutoAnswer = o => (o.fields ? (o.fields[0].id === "reason" ? { reason: "Damaged, disposed of", on: "" } : { note: "found it" }) : true); });
await P.getByTestId("ppe-current").filter({ hasText: "Safety gloves" }).getByTestId("ppe-return").click(); await P.waitForTimeout(1200);
R = rows(); const g2 = R.find(r => r.data.itemId === "gloves");
check("14 Return: gloves returned with the reason and today's date", g2.status === "returned" && g2.data.returnReason === "Damaged, disposed of" && g2.data.returnedOn === today && g2.data.returnedBy === "Test Admin");
await P.getByTestId("ppe-current").filter({ hasText: "Safety boots" }).getByTestId("ppe-replace").click(); await P.waitForTimeout(500);
check("15 Replace opens Issue PPE for Owen, boots UK 9, 'replaces the one issued…'", /Replaces the one issued/.test(await P.getByTestId("ppe-issue").innerText()) && (await P.getByTestId("ppe-line-size").first().inputValue()) === "UK 9");
await P.getByTestId("ppe-line-size").first().selectOption("UK 10");
await draw(P, "ppe-sig"); await P.getByTestId("ppe-issue-sign").click(); await P.waitForTimeout(1500);
R = rows(); const oldB = R.find(r => r.id === boots.id), newB = R.find(r => r.data.replaces === boots.id);
check("16 old boots 'replaced' → new boots UK 10 (linked both ways, reason 'worn')", oldB.status === "replaced" && newB && oldB.data.replacedBy === newB.id && newB.data.size === "UK 10" && newB.data.reason === "worn" && !!newB.data.signature);
await P.waitForTimeout(400);
check("17 back on Owen's record: history shows issued / returned / replaced", (await P.getByTestId("ppe-history-row").count()) >= 4 && /Returned Safety gloves/.test(await P.getByTestId("ppe-person").innerText()));
const [popup] = await Promise.all([P.waitForEvent("popup", { timeout: 5000 }).catch(() => null), P.getByTestId("ppe-print").click()]);
let ptxt = ""; if (popup) { await popup.waitForLoadState(); ptxt = await popup.locator("body").innerText(); await popup.close(); }
check("18 Print record: a printable copy with the statement and every issue", /PPE issue record: Owen Birch/.test(ptxt) && /Statement signed/.test(ptxt) && (ptxt.match(/Safety boots/g) || []).length >= 2, ptxt.slice(0, 80));
await P.keyboard.press("Escape"); await P.waitForTimeout(300);
const [dl] = await Promise.all([P.waitForEvent("download", { timeout: 5000 }).catch(() => null), P.getByTestId("ppe-csv").click()]);
let csv = ""; if (dl) { const fs = await import("fs"); csv = fs.readFileSync(await dl.path(), "utf8"); }
check("19 Export CSV: current items (3)", csv.split("\r\n").length === 4 && /Owen Birch/.test(csv), String(csv.split("\r\n").length));
await A.page.context().browser().close();

// ── 5. staff on the phone: sign, report a problem ──
let F = await session(IPHONE, "owen.birch@example.com", "OwenPass#1"); let Q = F.page;
check("20 phone Today: 'Sign for your new PPE' banner", (await Q.getByTestId("m-ppe-banner").count()) === 1);
await Q.getByTestId("m-ppe-banner").click(); await Q.waitForTimeout(600);
check("21 My PPE: 2 items (vest to sign, new boots)", (await Q.getByTestId("m-ppe-item").count()) === 2);
await Q.getByTestId("m-ppe-sign").click(); await Q.waitForTimeout(400);
await draw(Q, "m-ppe-sig"); await Q.getByTestId("m-ppe-sign-save").click(); await Q.waitForTimeout(1500);
R = rows(); const vest = R.find(r => r.data.itemId === "hivis-vest");
check("22 signed on the phone (signedVia phone), thanked", vest.data.signedVia === "phone" && !!vest.data.signature && (await Q.getByTestId("m-ppe-done").count()) === 1);
await Q.getByTestId("m-ppe-report").first().click(); await Q.waitForTimeout(300);
await Q.getByTestId("m-ppe-kind-fit").click(); await Q.locator("#m-ppe-note").fill("too big"); await Q.getByTestId("m-ppe-report-send").click(); await Q.waitForTimeout(1500);
R = rows(); const withP = R.find(r => (r.data.problems || []).length);
check("23 problem reported: doesn't fit, 'too big', by Owen", withP && withP.data.problems[0].kind === "fit" && withP.data.problems[0].note === "too big" && withP.data.problems[0].by === "Owen Birch");
check("24 nothing else about the record changed (database guard allowed the update)", withP.status === "issued" && failed.length === 0, failed.join(" | "));
await Q.getByText("More", { exact: true }).last().click(); await Q.waitForTimeout(500);
check("25 More → My PPE row", (await Q.getByText("My PPE", { exact: true }).count()) >= 1);
await F.page.context().browser().close();

// ── 6. line manager: team only ──
let J = await session({ width: 1440, height: 900 }, "jordan.reeves@example.com", "MgrPass#1"); P = J.page;
await search(P, "My PPE");
const jt = await P.getByTestId("my-ppe").innerText();
check("26 manager: My PPE with the team's register (Owen, Test Staff)", /My team's PPE/.test(jt) && /Owen Birch/.test(jt) && /Test Staff/.test(jt));
await P.getByTestId("ppe-issue-btn").click(); await P.waitForTimeout(400);
const opts = await P.getByTestId("ppe-person").locator("option").allInnerTexts();
check("28 manager can issue only to their team", opts.some(o => /Owen Birch/.test(o)) && !opts.some(o => /Tom Hale|Test Admin/.test(o)), opts.join("|"));
await P.getByTestId("ppe-person").selectOption("9"); await P.getByTestId("ppe-line-item").first().selectOption("ear-plugs");
await P.getByTestId("ppe-issue-nosign").click(); await P.waitForTimeout(1500);
R = rows();
check("29 manager's issue saved (database allowed it), by Jordan Reeves", R.some(r => r.user_id === "9" && r.data.issuedBy === "Jordan Reeves") && failed.length === 0, failed.join(" | "));
await J.page.context().browser().close();

// ── 7. staff on the desktop: own only ──
let D = await session({ width: 1440, height: 900 }, "clteststaff@zeus.com", "StaffPass#1"); P = D.page;
await search(P, "My PPE");
check("30 staff desktop My PPE: own glasses only, sign banner", (await P.getByTestId("my-ppe-item").count()) === 1 && /Safety glasses/.test(await P.getByTestId("my-ppe").innerText()) && (await P.getByTestId("my-ppe-sign").count()) === 1);
await P.getByTestId("my-ppe-sign").click(); await P.waitForTimeout(400);
await P.getByTestId("ppe-sig2-type").click(); await P.getByTestId("ppe-sig2-typed").fill("Test Staff"); await P.waitForTimeout(200);
await P.getByTestId("ppe-sign-save").click(); await P.waitForTimeout(1500);
R = rows(); const gls = R.find(r => r.data.itemId === "glasses");
check("31 signed on the portal with a typed name", gls.data.signedVia === "portal" && /^data:image\/png/.test(gls.data.signature));
await D.page.context().browser().close();
check("32 staff's browser only received their own rows; the manager's only the team's (database rules)", JSON.stringify(received["clteststaff@zeus.com"]) === '["2"]' && (received["jordan.reeves@example.com"] || []).every(id => ["2", "3", "6", "9", "10", "12"].includes(id)), JSON.stringify(received));

// ── 8. admin: bell and problems ──
A = await session({ width: 1500, height: 950 }, "cltestad@zeus.com", "AdminPass#1"); P = A.page;
await P.waitForTimeout(1500);
const bellTxt = await P.evaluate(() => document.body.innerText);
await search(P, "PPE Register");
check("33 problems tile 1, waiting for a signature 1 (manager's ear plugs)", (await P.getByTestId("ppe-tile-problem-n").innerText()) === "1" && (await P.getByTestId("ppe-tile-unsigned-n").innerText()) === "1");
await P.getByTestId("ppe-tile-problem").click(); await P.waitForTimeout(300);
check("34 problem filter → the reported item, 'Problem reported', Replace offered", (await P.getByTestId("ppe-row").count()) === 1 && (await P.getByTestId("ppe-row-state").first().getAttribute("data-state")) === "problem" && (await P.getByTestId("ppe-row-replace").count()) === 1);
await P.getByTestId("ppe-row-person").first().click(); await P.waitForTimeout(500);
await P.evaluate(() => { window.__zpTestAutoAnswer = o => (o.fields ? { note: "swapped for a M from stock" } : true); });
await P.getByTestId("ppe-dealt").click(); await P.waitForTimeout(1200);
R = rows(); const v2 = R.find(r => (r.data.problems || []).length);
check("35 Mark dealt with: problem closed with the note", v2.data.problems[0].dealtBy === "Test Admin" && v2.data.problems[0].dealtNote === "swapped for a M from stock");
const audit = sql("select count(*) from audit_log where entity='ppe'");
check("36 audit trail entries for PPE", Number(audit) >= 8, audit);
check("37 no page errors", errors.length === 0, errors.join(" | "));
check("38 no refused database requests", failed.length === 0, failed.join(" | "));
await A.page.context().browser().close();
srv.close();
process.exit(0);
