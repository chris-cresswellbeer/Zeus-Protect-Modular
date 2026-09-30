const { open } = require('./common.cjs');
(async () => {
  const { b, p, shot } = await open({ width: 390, height: 844 }, 2, 'daniel.cooke@zeus.com');
  await p.waitForTimeout(800);
  await shot('shots/m_today.png');
  await p.getByText('Report a hazard').click(); await p.waitForTimeout(500);
  const text = 'Someone climbing the racking instead of using the steps';
  const ta = p.locator('textarea');
  const words = text.split(' ');
  await shot('shots/m_type_00.png');
  for (let i = 1; i <= words.length; i++) {
    await ta.fill(words.slice(0, i).join(' '));
    await shot(`shots/m_type_${String(i).padStart(2,'0')}.png`);
  }
  await p.getByText('Next — where was it?').click(); await p.waitForTimeout(400);
  await shot('shots/m_where_0.png');
  console.log((await p.evaluate(() => document.body.innerText)).slice(0,500));
  await p.getByText('Racking Aisle', { exact: true }).click(); await p.waitForTimeout(300);
  await shot('shots/m_where_1.png');
  const nxt = p.locator('button', { hasText: /^Next/ }); await nxt.last().click(); await p.waitForTimeout(400);
  await p.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('*').forEach(e=>{if(e.scrollTop)e.scrollTop=0})}); await shot('shots/m_urg_0.png');
  console.log('---', (await p.evaluate(() => document.body.innerText)).slice(0,500));
  await p.getByText('STOP WORK — urgent').click(); await p.waitForTimeout(300);
  await p.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('*').forEach(e=>{if(e.scrollTop)e.scrollTop=0})}); await shot('shots/m_urg_1.png');
  await p.getByText('Send hazard report').click(); await p.waitForTimeout(800);
  await shot('shots/m_done.png');
  console.log('---', (await p.evaluate(() => document.body.innerText)).slice(0,700));
  await b.close();
})();
