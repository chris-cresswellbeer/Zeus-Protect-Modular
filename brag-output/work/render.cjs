const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const mode = process.argv[2];
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('http://127.0.0.1:8765/video.html'); await p.evaluate(() => window.ready);
  const draw = async (t) => p.evaluate(async (t) => { window.render(t); await Promise.all([...document.images].map(i => i.complete ? 0 : i.decode().catch(() => {}))); }, t);
  if (mode === 'stills') {
    fs.mkdirSync('stills', { recursive: true });
    const ts = process.argv.slice(3).map(Number);
    for (const t of ts) { await draw(t); await p.screenshot({ path: `stills/t${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 80 }); }
  } else {
    fs.mkdirSync('frames', { recursive: true });
    const N = 600;
    const F0 = +(process.argv[3]||0), F1 = +(process.argv[4]||N); for (let f = F0; f < F1; f++) { await draw(f / 30); await p.screenshot({ path: `frames/f${String(f).padStart(4,'0')}.jpg`, type: 'jpeg', quality: 95 }); }
  }
  await b.close();
})();
