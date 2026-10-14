const { open } = require('./common.cjs');
const fs = require('fs');
(async () => {
  const { b, p, shot, scrub } = await open({ width: 1600, height: 900 }, 1.5, 'admin@zeus.com');
  await p.waitForTimeout(800);
  await shot('shots/d_dash.png');
  await scrub();
  const cards = await p.evaluate(() => [...document.querySelectorAll('[aria-roledescription="sortable"]')].map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, t: e.innerText.split('\n')[0] }; }));
  console.log('cards', cards.length, JSON.stringify(cards[0]));
  fs.writeFileSync('layout.json', JSON.stringify({ cards }));
  await p.evaluate(() => document.querySelectorAll('[aria-roledescription="sortable"]').forEach(e => e.style.visibility = 'hidden'));
  await shot('shots/d_dash_bare.png');
  await p.evaluate(() => document.querySelectorAll('[aria-roledescription="sortable"]').forEach(e => e.style.visibility = ''));
  const tabs = ['STAFF','TRAINING','FIRE SAFETY','FIRST AID','INCIDENTS','RISK ASSESSMENTS','INSPECTIONS','CONTRACTORS','DOCUMENTS','MACHINERY'];
  for (const t of tabs) {
    try {
      const el = p.locator('header, nav, div').getByText(new RegExp('^' + t.replace(' ', '\\s*'), 'i')).first();
      await el.click({ timeout: 3000 }); await p.waitForTimeout(1500);
      const menu = await p.evaluate(() => document.body.innerText.slice(0, 0));
      await shot(`shots/d_tab_${t.replace(/ /g,'_').toLowerCase()}.png`);
      await p.keyboard.press('Escape');
      console.log('ok', t);
    } catch (e) { console.log('fail', t, e.message.split('\n')[0]); }
  }
  await b.close();
})();
