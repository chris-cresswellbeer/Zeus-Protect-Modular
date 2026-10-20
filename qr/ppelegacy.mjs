// The PPE register with the OLD sign-in (no database rules): issue with a signature on the
// desktop, sign and report on the phone. Run: node qr/ppelegacy.mjs (dist on :4173)
const { open, login, store } = await import("../guide/harness.mjs");
const check = (name, ok, extra = "") => console.log(ok ? "PASS" : "FAIL", name, extra);
const errors = [];
store.ppe_issues = [];
async function draw(P, testid) {
  const c = P.getByTestId(testid); await c.scrollIntoViewIfNeeded(); const b = await c.boundingBox();
  await P.mouse.move(b.x + 30, b.y + b.height / 2); await P.mouse.down();
  for (let i = 1; i <= 10; i++) await P.mouse.move(b.x + 30 + i * 18, b.y + b.height / 2 + (i % 2 ? -20 : 16), { steps: 3 });
  await P.mouse.up(); await P.waitForTimeout(200);
}
let o = await open({ width: 1440, height: 900 }); let P = o.page;
P.on("pageerror", e => errors.push(e.message));
await login(P, "cltestad@zeus.com");
await P.keyboard.press("Control+k"); await P.getByTestId("qs").getByRole("combobox").fill("PPE Register"); await P.waitForTimeout(400); await P.keyboard.press("Enter"); await P.waitForTimeout(1200);
check("1 admin: PPE Register opens", (await P.getByTestId("ppe-tab").count()) === 1);
await P.getByTestId("ppe-issue-btn").click(); await P.waitForTimeout(300);
await P.getByTestId("ppe-person").selectOption("6");
await P.getByTestId("ppe-line-item").first().selectOption("boots"); await P.getByTestId("ppe-line-size").first().selectOption("UK 8");
await draw(P, "ppe-sig"); await P.getByTestId("ppe-issue-sign").click(); await P.waitForTimeout(1200);
await P.getByTestId("ppe-issue-btn").click(); await P.waitForTimeout(300);
await P.getByTestId("ppe-person").selectOption("6");
await P.getByTestId("ppe-line-item").first().selectOption("hivis-vest"); await P.getByTestId("ppe-line-size").first().selectOption("XL");
await P.getByTestId("ppe-issue-nosign").click(); await P.waitForTimeout(1200);
check("2 saved: two issues for Owen, one signed", store.ppe_issues.length === 2 && store.ppe_issues.filter(r => r.data.signature).length === 1, JSON.stringify(store.ppe_issues.map(r => r.data.item)));
await o.page.context().browser().close();

o = await open({ width: 393, height: 852, mobile: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }); P = o.page;
P.on("pageerror", e => errors.push(e.message));
await login(P, "owen.birch@example.com"); await P.waitForTimeout(1000);
check("3 phone: sign banner", (await P.getByTestId("m-ppe-banner").count()) === 1);
await P.getByTestId("m-ppe-banner").click(); await P.waitForTimeout(500);
await P.getByTestId("m-ppe-sign").click(); await P.waitForTimeout(300);
await draw(P, "m-ppe-sig"); await P.getByTestId("m-ppe-sign-save").click(); await P.waitForTimeout(1200);
check("4 signed on the phone", store.ppe_issues.every(r => r.data.signature) && store.ppe_issues.some(r => r.data.signedVia === "phone"));
await P.getByTestId("m-ppe-report").first().click(); await P.getByTestId("m-ppe-kind-lost").click(); await P.getByTestId("m-ppe-report-send").click(); await P.waitForTimeout(1200);
check("5 problem reported", store.ppe_issues.some(r => (r.data.problems || []).some(p => p.kind === "lost")));
await o.page.context().browser().close();
o = await open({ width: 393, height: 852, mobile: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }); P = o.page;
await login(P, "priya.shah@example.com"); await P.waitForTimeout(1000);
await P.getByText("More", { exact: true }).last().click(); await P.waitForTimeout(400);
await P.getByText("My PPE", { exact: true }).first().click(); await P.waitForTimeout(500);
check("6 another person's phone doesn't show Owen's PPE", (await P.getByTestId("m-ppe-item").count()) === 0 && /Nothing is recorded/.test(await P.locator("main").innerText()));
await o.page.context().browser().close();
check("7 no page errors", errors.length === 0, errors.join(" | "));
process.exit(0);
