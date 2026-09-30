const { open } = require('./common.cjs');
(async () => {
  const { b, p, shot } = await open({ width: 1600, height: 900 }, 1.5, 'admin@zeus.com');
  await p.waitForTimeout(800);
  const items = [['TRAINING','Training Library'],['TRAINING','Reports'],['DOCUMENTS','COSHH Register'],['CONTRACTORS','Permits'],['MACHINERY','Equipment Register'],['MACHINERY','Machinery Competence']];
  for (const [t, sub] of items) {
    try {
      await p.getByText(new RegExp('^' + t, 'i')).first().click(); await p.waitForTimeout(400);
      await p.getByText(sub, { exact: true }).first().click(); await p.waitForTimeout(600); await p.mouse.move(1595, 895); await p.mouse.click(1595, 895); await p.waitForTimeout(1200);
      await shot(`shots/d_sub_${sub.replace(/ /g,'_').toLowerCase()}.png`); console.log('ok', sub);
    } catch (e) { console.log('fail', sub, e.message.split('\n')[0]); }
  }
  await b.close();
})();
