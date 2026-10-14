const { open } = require('./common.cjs');
(async () => {
  const { b, p, shot } = await open({ width: 1600, height: 900 }, 1.5, 'admin@zeus.com');
  await p.waitForTimeout(800);
  const nav = async (t, sub) => { await p.getByText(new RegExp('^' + t, 'i')).first().click(); await p.waitForTimeout(400); if (sub) { await p.getByText(sub, { exact: true }).first().click(); await p.waitForTimeout(500); } await p.mouse.click(1595, 895); await p.waitForTimeout(1200); };
  const box = async (loc) => { const bb = await loc.boundingBox(); return bb && { x: bb.x + bb.width/2, y: bb.y + bb.height/2 }; };
  const out = {};
  // dashboard: equipment card position
  out.eqCard = await box(p.getByText(/equipment overdue/i).first());
  // equipment register
  await nav('MACHINERY', 'Equipment Register'); await shot('shots/x_equipment.png');
  await p.screenshot({ path: 'shots/x_equipment_full.png', fullPage: true });
  // risk assessments -> new
  await nav('RISK ASSESSMENTS'); await shot('shots/x_ra_list.png');
  const btn = p.getByText('+ New Risk Assessment').first(); out.raNew = await box(btn);
  await btn.click(); await p.waitForTimeout(1200); await shot('shots/x_ra_new.png');
  await p.screenshot({ path: 'shots/x_ra_new_full.png', fullPage: true });
  console.log('RA text', (await p.evaluate(() => document.body.innerText)).slice(0, 1200));
  // reports -> training matrix
  await p.keyboard.press('Escape');
  await nav('TRAINING', 'Reports');
  const tm = p.getByText(/Training Matrix/).first(); out.tm = await box(tm);
  await shot('shots/x_reports.png');
  await tm.click(); await p.waitForTimeout(1500); await shot('shots/x_matrix.png');
  await p.screenshot({ path: 'shots/x_matrix_full.png', fullPage: true });
  const mr = p.getByText(/Monthly Report/).first(); out.mr = await box(mr);
  await mr.click(); await p.waitForTimeout(1500); await shot('shots/x_monthly.png');
  await p.screenshot({ path: 'shots/x_monthly_full.png', fullPage: true });
  require('fs').writeFileSync('layout2.json', JSON.stringify(out));
  console.log(JSON.stringify(out));
  await b.close();
})();
