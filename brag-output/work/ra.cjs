const { open } = require('./common.cjs');
(async () => {
  const { b, p, shot } = await open({ width: 1600, height: 900 }, 1.5, 'admin@zeus.com');
  await p.waitForTimeout(800);
  await p.getByText(/^RISK\s*ASSESSMENTS/i).first().click(); await p.waitForTimeout(1200);
  await p.getByText('+ New Risk Assessment').first().click(); await p.waitForTimeout(1000);
  const title = p.getByPlaceholder('e.g. Manual Handling of Warehouse Goods');
  const tb = await title.boundingBox(); console.log('title', JSON.stringify(tb));
  const text = 'Forklift Operations — Loading Bay';
  const steps = [0, 4, 9, 15, 20, 26, text.length];
  for (let i = 0; i < steps.length; i++) { await title.fill(text.slice(0, steps[i])); await shot(`shots/ra_t${i}.png`); }
  await p.getByPlaceholder('e.g. Warehouse — Goods-In Area').fill('Loading Bay');
  await p.getByPlaceholder('e.g. Warehouse Operations').fill('Warehouse Operations');
  await p.locator('textarea').first().fill('Loading and unloading trailers with counterbalance forklifts, with pedestrians crossing the bay.');
  await shot('shots/ra_filled.png');
  const nx = p.getByText('Next: Add Hazards →'); await nx.scrollIntoViewIfNeeded(); const nb = await nx.boundingBox(); console.log('next', JSON.stringify(nb));
  await nx.click(); await p.waitForTimeout(1000);
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot('shots/ra_step2.png');
  const desc = p.getByPlaceholder(/Manual handling of heavy pallets/);
  const dtext = 'Pedestrian struck by reversing forklift';
  const ds = [5, 12, 20, 29, dtext.length];
  for (let i = 0; i < ds.length; i++) { await desc.fill(dtext.slice(0, ds[i])); await shot(`shots/ra_d${i}.png`); }
  await p.getByPlaceholder(/Warehouse operatives, visiting/).fill('Loading bay staff, delivery drivers');
  await p.getByPlaceholder(/Manual handling training completed/).fill('Marked walkways, reversing alarms, hi-vis mandatory');
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot('shots/ra_d_full.png');
  const top0 = async () => { await p.waitForTimeout(400); await p.evaluate(() => window.scrollTo(0, 0)); };
  await p.mouse.click(489, 597); await top0(); await shot('shots/ra_m1.png');
  await p.mouse.click(939, 673); await top0(); await shot('shots/ra_m2.png');
  console.log('scrollY', await p.evaluate(() => window.scrollY));
  await b.close();
})();
