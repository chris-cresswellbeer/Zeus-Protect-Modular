// Batch 4: live refresh of training records, major version from the DB, full backup,
// group sessions (admin + manager), per-module pass mark, failed attempts, full Remove.
import { open, store } from "../guide/harness.mjs";
import { go } from "../admin/lib.mjs";
import { TRAINING_MODULES } from "../src/data/seedTraining.js";
import fs from "fs";
import { execFileSync } from "child_process";
const check = (name, ok, extra = "") => console.log(ok ? "PASS" : "FAIL", name, extra);
const B = (page, re) => page.getByRole("button", { name: re }).first();
async function login(page, email) { await page.waitForSelector('input[placeholder="you@company.co.uk"]'); await page.fill('input[placeholder="you@company.co.uk"]', email); await page.fill('input[type="password"]', "pass123"); await page.keyboard.press("Enter"); await page.waitForTimeout(1800); }
const today = new Date().toISOString().slice(0, 10);
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const m7 = TRAINING_MODULES.find(m => m.id === "m7");
store.users.push({ id: "14", data: { id: 14, name: "Jordan Reeves", email: "jordan.reeves@example.com", role: "manager", jobTitle: "Warehouse Manager", manager: "", department: "Warehouse" } });
store.custom_modules = [{ id: "m7", data: { ...m7, passMark: 80, version: 1, _custom: true, _override: true } }];
store.training_assigns = [["2", "m1"], ["2", "m3"], ["2", "m7"], ["4", "m1"], ["9", "m3"], ["7", "m1"], ["7", "m2"]].map(([u, m], i) => ({ id: i + 1, user_id: u, module_id: m }));
store.training_completions = [
  { user_id: "2", module_id: "m1", score: 90, date: daysAgo(30), cert_id: "ZSL-A", answers: {}, module_version: 1 },
  { user_id: "4", module_id: "m1", score: 50, date: daysAgo(20), cert_id: null, answers: {}, module_version: 1 },     // old-style failed attempt
  { user_id: "9", module_id: "m3", score: 80, date: "2025-01-10", cert_id: "ZSL-E", answers: {}, module_version: 1 },  // older than the session
  { user_id: "7", module_id: "m1", score: 85, date: daysAgo(40), cert_id: "ZSL-G", answers: {}, module_version: 1 },
];
store.training_completion_history = [{ user_id: "7", module_id: "m1", score: 85, date: daysAgo(40), cert_id: "ZSL-G", module_version: 1 }];
store.doc_acknowledgements = [{ user_id: "7", doc_id: "d1", date: daysAgo(5), version: 1 }];
store.ext_certs = [{ user_id: "7", cert_type: "first_aid", data: { fileName: "x.pdf", issuedDate: "2025-01-01", expiryDate: "2028-01-01" } }];
store.quiz_failures = [{ id: 900, data: { id: "qf_g", userId: "7", userName: "Grace Lin", moduleId: "m2", moduleTitle: "Manual Handling", score: 40, date: daysAgo(3), acknowledged: false } }];
store.incidents = [{ id: "iG", date: daysAgo(10), type: "near_miss", location: "Office", reported_by: "7", description: "Grace reported this", closed: false, photos: [], details: {} }];
store.audit_log = [];

// ── admin ──
let { browser, page } = await open({ width: 1920, height: 1100 });
page.on("dialog", d => d.accept());
await login(page, "cltestad@zeus.com");
await go(page, "Reports", "Training"); await B(page, /Training Matrix/).click(); await page.waitForTimeout(800);
const cell = (who, mod) => page.locator('[data-testid="training-matrix"] tbody tr', { hasText: who }).locator(`td[title*="${mod}"]`).first();
check("1 an old failed attempt doesn't count as completed", await cell("Tom Hale", "Fire Safety").getAttribute("data-status") === "missing");
check("2 before: Test Staff hasn't done COSHH", await cell("Test Staff", "Chemical Hazards").getAttribute("data-status") === "missing");
// elsewhere: Test Staff finishes COSHH and Owen confirms a document
store.training_completions.push({ user_id: "2", module_id: "m3", score: 100, date: today, cert_id: "ZSL-NEW", answers: {}, module_version: 1 });
store.doc_acknowledgements.push({ user_id: "6", doc_id: "d1", date: today, version: 1 });
await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await page.waitForTimeout(2000);
check("3 completion made elsewhere appears without a reload", await cell("Test Staff", "Chemical Hazards").getAttribute("data-status") === "valid");

// ── backup ──
await page.getByText("🔔").first().click(); await page.waitForTimeout(400);
check("4 bell: first backup reminder", (await page.getByText("Download a first full backup").count()) === 1);
await page.getByText("Download a first full backup").click(); await page.waitForTimeout(900);
const panel = page.locator('[data-testid="backup-panel"]');
check("5 bell opens the Audit Trail with the backup panel", (await panel.count()) === 1 && /No backup has been downloaded yet/.test(await panel.innerText()));
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), panel.getByRole("button", { name: /Download full backup/ }).click()]);
const zp = "/tmp/claude-0/b4backup.zip"; await dl.saveAs(zp); await page.waitForTimeout(800);
const listing = execFileSync("python3", ["-c", `import zipfile,json,sys
z=zipfile.ZipFile("${zp}"); n=z.namelist(); j=json.loads(z.read("zeus-protect-backup.json"))
import io
print(json.dumps({"names":n,"tables":len(j["tables"]),"tc":len(j["tables"]["training_completions"]),"users":len(j["tables"]["users"]),"passwords":"user_passwords" in j["tables"],"xlsx":z.read("zeus-protect-backup.xlsx")[:2].decode("latin1")}))`]).toString();
const bj = JSON.parse(listing);
check("6 backup zip has json, xlsx and read-me", ["zeus-protect-backup.json", "zeus-protect-backup.xlsx", "READ ME.txt"].every(n => bj.names.includes(n)) && bj.xlsx === "PK", JSON.stringify(bj.names));
check("7 backup holds every table and every row (no password hashes)", bj.tables === 47 && bj.tc === store.training_completions.length && bj.users === store.users.length && !bj.passwords, JSON.stringify(bj));
check("8 backup logged in the Audit Trail and shown as today", store.audit_log.some(a => a.entity === "backup") && /Last backup: .*today/.test(await panel.innerText()), (await panel.innerText()).split("\n").find(l => /Last backup/.test(l)));
await page.getByText("🔔").first().click(); await page.waitForTimeout(300);
check("9 reminder gone after backing up", (await page.getByText(/A full backup is due|Download a first full backup/).count()) === 0);
await page.keyboard.press("Escape"); await page.mouse.click(5, 900);

// ── group session (admin) ──
await go(page, "Assign Training", "Training");
await B(page, /Record a group session/).click(); await page.waitForTimeout(400);
const gs = page.getByRole("dialog");
await gs.locator("#gs-mod").selectOption("m3");
await gs.locator("#gs-date").fill(daysAgo(1));
await gs.locator("#gs-where").fill("Goods-in, 7am briefing");
for (const n of ["Test Staff", "Priya Shah", "Ellie Dunn", "Tom Hale"]) await gs.getByLabel(n, { exact: true }).check();
const rowTxt = n => gs.locator("tbody tr", { hasText: n }).innerText();
check("10 shows each person's current result; newer one marked kept", /newer — kept/.test(await rowTxt("Test Staff")) && /80% · 10\/01\/2025/.test(await rowTxt("Ellie Dunn")), (await rowTxt("Test Staff")).replace(/\s+/g, " "));
const [sheet] = await Promise.all([page.context().waitForEvent("page"), B(gs, /Print sign-in sheet/).click()]);
await sheet.waitForLoadState(); const sheetTxt = await sheet.innerText("body"); await sheet.close();
check("11 printable sign-in sheet lists the ticked people", /Training sign-in sheet/.test(sheetTxt) && /Priya Shah/.test(sheetTxt) && /Ellie Dunn/.test(sheetTxt) && /Chemical Hazards/.test(sheetTxt));
await page.screenshot({ path: "qr/b4_group.png" });
await B(gs, /Record attendance for 4/).click(); await page.waitForTimeout(2500);
const comp = (u, m) => store.training_completions.find(r => String(r.user_id) === u && r.module_id === m);
const gtxt = await gs.innerText();
check("12 3 recorded, 1 skipped (newer result kept)", /3 attendees recorded/.test(gtxt) && /Test Staff \(already has a result from that date or later\)/.test(gtxt), gtxt.split("\n").find(l => /recorded/.test(l)));
check("13 session saved as recorded, with leader and place", ["3", "9", "4"].every(u => { const r = comp(u, "m3"); return r && r.recorded && r.recorded.session && r.recorded.session.leader === "Test Admin" && r.date === daysAgo(1) && r.score === null; }));
check("14 older result renewed by the session; newer one untouched", comp("9", "m3").recorded && comp("2", "m3").score === 100);
check("15 module assigned to those who didn't have it", ["3", "4"].every(u => store.training_assigns.some(a => String(a.user_id) === u && a.module_id === "m3")));
check("16 audited as a group session", store.audit_log.some(a => /^Group session on/.test(a.summary || "")));
await gs.getByRole("button", { name: "Close" }).last().click(); await page.waitForTimeout(300);

// ── pass mark on the module form ──
await go(page, "Training Library", "Training");
const mcard = page.getByText("Near Miss Reporting & Incident Prevention", { exact: true }).first().locator("xpath=ancestor::div[.//button[contains(.,'Edit')]][1]");
await mcard.getByRole("button", { name: /Edit/ }).first().click(); await page.waitForTimeout(700);
check("17 module form shows its pass mark (80)", await page.locator("#cm-pass").inputValue() === "80");
await browser.close();

// ── staff: pass mark 80 ──
({ browser, page } = await open({ width: 1440, height: 900 }));
page.on("dialog", d => d.accept());
await login(page, "clteststaff@zeus.com");
await page.getByText("My Training", { exact: true }).first().click(); await page.waitForTimeout(600);
const startM7 = async () => {
  await page.locator("div", { hasText: m7.title }).filter({ has: page.getByRole("button", { name: /Start|Review|Renew|Retake/ }) }).last().getByRole("button", { name: /Start|Review|Renew|Retake/ }).first().click(); await page.waitForTimeout(600);
  await B(page, /Begin Module/).click(); await page.waitForTimeout(400);
  for (let i = 1; i < m7.content.length; i++) { await B(page, /Next Slide/).click(); await page.waitForTimeout(120); }
  await B(page, /Take Quiz/).click(); await page.waitForTimeout(400);
};
await startM7();
check("18 quiz says 80% needed", (await page.getByText(/80% needed to pass/).count()) === 1);
// 7 of 10 right = 70%: passes the old 70% rule, fails this module's 80%
for (const [i, q] of m7.quiz.entries()) { const pick = i < 7 ? q.answer : (q.answer + 1) % q.options.length; await page.getByText(q.options[pick], { exact: true }).first().click(); await page.waitForTimeout(40); }
await B(page, /Submit Quiz/).click(); await page.waitForTimeout(2000);
check("19 70% fails a module with an 80% pass mark", (await page.getByText("Not Quite").count()) === 1 && (await page.getByText(/You need 80% to pass/).count()) === 1);
check("20 the failed attempt is not saved as a completion", !comp("2", "m7"));
check("21 failure logged for the admin, with the pass mark", store.quiz_failures.some(f => f.data.moduleId === "m7" && f.data.score === 70 && f.data.passMark === 80));
await B(page, /Retake Module/).click(); await page.waitForTimeout(500);
for (let i = 1; i < m7.content.length; i++) { await B(page, /Next Slide/).click(); await page.waitForTimeout(100); }
await B(page, /Take Quiz/).click(); await page.waitForTimeout(400);
for (const q of m7.quiz) { await page.getByText(q.options[q.answer], { exact: true }).first().click(); await page.waitForTimeout(40); }
await B(page, /Submit Quiz/).click(); await page.waitForTimeout(2500);
check("22 100% passes and is saved with a certificate", comp("2", "m7") && comp("2", "m7").score === 100 && !!comp("2", "m7").cert_id);
await browser.close();

// ── manager group session ──
({ browser, page } = await open({ width: 1440, height: 900 }));
page.on("dialog", d => d.accept());
await login(page, "jordan.reeves@example.com");
await page.getByText("My Team", { exact: true }).first().click(); await page.waitForTimeout(800);
await B(page, /Record a group session/).click(); await page.waitForTimeout(400);
const mg = page.getByRole("dialog");
const names = await mg.locator("tbody tr td:nth-child(2)").allInnerTexts();
check("23 manager sees only their own team", names.includes("Owen Birch") && names.includes("Priya Shah") && !names.includes("Tom Hale") && !names.includes("Grace Lin"), names.join(", "));
await mg.locator("#gs-mod").selectOption("m2");
await mg.getByLabel("Owen Birch", { exact: true }).check();
await B(mg, /Record attendance for 1/).click(); await page.waitForTimeout(2000);
check("24 manager's session saved, recorded by them", comp("6", "m2") && comp("6", "m2").recorded.by === "Jordan Reeves" && comp("6", "m2").recorded.session.leader === "Jordan Reeves");
await browser.close();

// ── full Remove ──
({ browser, page } = await open({ width: 1920, height: 1100 }));
page.on("dialog", d => d.accept());
await login(page, "cltestad@zeus.com");
await page.getByRole("button", { name: "Staff", exact: true }).first().click(); await page.waitForTimeout(800);
await page.locator("div").filter({ hasText: "Grace Lin" }).filter({ has: page.locator("button", { hasText: "Remove" }) }).last().locator("button", { hasText: "Remove" }).first().click();
await page.waitForTimeout(2500);
const left = ["training_assigns", "training_completions", "training_completion_history", "doc_acknowledgements", "ext_certs"].filter(t => (store[t] || []).some(r => String(r.user_id) === "7"));
check("25 Remove deletes the person's records", !store.users.some(u => String(u.id) === "7") && left.length === 0 && !store.quiz_failures.some(f => String(f.data.userId) === "7"), left.join(","));
check("26 Remove keeps incidents they reported", store.incidents.some(i => i.id === "iG"));
check("27 Remove is audited with what was deleted", store.audit_log.some(a => a.entity === "staff" && /Removed staff member and their records \(1 training result, 2 assigned modules, 1 document confirmation/.test(a.summary)), JSON.stringify(store.audit_log.filter(a => a.entity === "staff").map(a => a.summary)));
await browser.close();
process.exit(0);
