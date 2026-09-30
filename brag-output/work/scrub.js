// Injected into the page: swap real staff names for fictional ones, fix blocked logos.
window.__scrub = (mapPairs) => {
  const map = new Map(mapPairs);
  const firstMap = new Map(mapPairs.map(([a,b]) => [a.split(' ')[0], b.split(' ')[0]]));
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  const initMap = new Map(); mapPairs.forEach(([a,b]) => { const k=a.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(); if(!initMap.has(k)) initMap.set(k, b.split(' ').map(x=>x[0]).join('').slice(0,2)); });
  let lastInitials = null;
  for (const n of nodes) {
    let t = n.nodeValue; const tr = t.trim();
    if (/^[A-Z]{2}$/.test(tr)) { lastInitials = n; if (n.__orig===undefined){ n.__orig=tr; if (initMap.has(tr)) n.nodeValue = n.nodeValue.replace(tr, initMap.get(tr)); } continue; }
    let hit = null;
    for (const [a,b] of map) if (t.includes(a)) { t = t.split(a).join(b); hit = b; }
    if (!hit) for (const [a,b] of firstMap) { const re = new RegExp('\\b'+a+'\\b','g'); if (!['Mark','Will','Grace','Rose','Hope','May','Bill','Frank','Jack'].includes(a) && re.test(t) && a.length>2) { t = t.replace(re,b); } }
    if (hit && lastInitials) { lastInitials.nodeValue = lastInitials.nodeValue.replace(/[A-Z]{2}/, hit.split(' ').map(s=>s[0]).join('').slice(0,2)); lastInitials = null; }
    if (t !== n.nodeValue) n.nodeValue = t;
  }
  document.querySelectorAll('img').forEach(img => {
    if (/supabase/.test(img.src) && (img.alt||'').startsWith('Zeus')) {
      const big = img.alt === 'Zeus Protect';
      const s = document.createElement('div');
      s.style.cssText = `display:flex;align-items:center;gap:${big?14:10}px;justify-content:${big?'center':'flex-start'};font-weight:900;letter-spacing:${big?2:1.5}px;color:#fff;font-size:${big?30:19}px`;
      s.innerHTML = `<img src="/icons/icon-192.png" style="height:${big?56:34}px;width:${big?56:34}px;border-radius:${big?12:8}px;box-shadow:0 0 0 1px rgba(255,255,255,.15)">${big?'ZEUS&nbsp;<span style="color:#3b82f6">PROTECT</span>':'ZEUS'}`;
      img.replaceWith(s);
    }
  });
};
