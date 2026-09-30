const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'shots/login.png' });
  const inputs = await p.$$('input');
  console.log('inputs', inputs.length);
  await inputs[0].fill('admin@zeus.com'); await inputs[1].fill('pass123');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'shots/home.png' });
  const txt = await p.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log(txt);
  await b.close();
})();
