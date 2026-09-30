const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const pairs = require('./names.json');
const scrubSrc = fs.readFileSync(__dirname + '/scrub.js', 'utf8');
async function open(vp, dsf, email) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dsf, hasTouch: vp.width < 600, isMobile: vp.width < 600 });
  await ctx.addInitScript(scrubSrc);
  await ctx.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const l=document.createElement('link'); l.rel='stylesheet'; l.href='https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&display=block'; document.head.appendChild(l); }); });
  const p = await ctx.newPage();
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(__dirname + '/fonts/barlow.css', 'utf8') }));
  await p.route(/fonts\.gstatic\.com/, r => { const f = r.request().url().split('/').pop(); r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(__dirname + '/fonts/' + f) }); });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(2000);
  const shotLogin = async (f) => { await scrub(); await p.screenshot({ path: f }); };
  const scrub = () => p.evaluate(pp => window.__scrub(pp), pairs);
  if (email) { const i = await p.$$('input'); await i[0].fill(email); await i[1].fill('pass123'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); }
  const shot = async (f, opts={}) => { await p.evaluate(() => document.fonts.ready); await scrub(); await p.waitForTimeout(150); await p.screenshot({ path: f, ...opts }); };
  return { b, p, shot, scrub, shotLogin };
}
module.exports = { open };
