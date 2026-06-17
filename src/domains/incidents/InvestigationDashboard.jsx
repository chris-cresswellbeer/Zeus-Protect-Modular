function InvestigationDashboard({ incidents, investigations, onOpen, Z, font }) {
  const today = new Date().toISOString().slice(0,10);

  // Flatten all actions across all investigations
  const allActions = [];
  Object.entries(investigations).forEach(([incId, inv]) => {
    (inv.actions||[]).forEach(a => allActions.push({...a, incId, incLocation: incidents.find(i=>i.id===incId)?.location||"Unknown"}));
  });

  const openActions    = allActions.filter(a => a.status !== "complete");
  const overdueActions = allActions.filter(a => a.status !== "complete" && a.dueDate && a.dueDate < today);
  const highRiskOpen   = incidents.filter(i => {
    if (i.closed) return false;
    if (i.riddor) return true;
    if (i.injuryType && i.injuryType !== "None / No injury") return true;
    return false;
  });

  // Repeat issues: same location appears in 2+ incidents within 12 months
  const locCounts = {};
  incidents.forEach(i => {
    const loc = i.location.trim().toLowerCase();
    if (!locCounts[loc]) locCounts[loc] = [];
    locCounts[loc].push(i);
  });
  const repeatIssues = Object.entries(locCounts)
    .filter(([,arr]) => arr.length >= 2)
    .sort((a,b)=>b[1].length-a[1].length)
    .slice(0,5);

  const statCard = (icon, val, label, col, sub) => (
    <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:"20px 22px",border:`2px solid ${col}33`,flex:"1 1 150px",minWidth:140}}>
      <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:36,fontWeight:900,color:col,lineHeight:1}}>{val}</div>
      <div style={{fontSize:12,fontWeight:700,color:Z.white,marginTop:4}}>{label}</div>
      {sub && <div style={{fontSize:11,color:Z.muted,marginTop:2}}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <h3 style={{fontSize:14,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase",margin:"0 0 16px"}}>Investigation Dashboard</h3>

      {/* Stat cards */}
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:28}}>
        {statCard(E("📋",""), openActions.length,    "Open Actions",          "#60a5fa", "Actions not yet complete")}
        {statCard(E("🚨",""), overdueActions.length, "Overdue Actions",       "#f87171", overdueActions.length>0?"Past due date — action required":"All actions on track")}
        {statCard(E("⚠️",""), highRiskOpen.length,   "High-Risk Unresolved",  "#fb923c", "RIDDOR / injury incidents open")}
        {statCard(E("🔁",""), repeatIssues.length,   "Repeat Issue Locations",  "#a78bfa", "Locations with 2+ incidents")}
      </div>

      {/* Overdue actions */}
      {overdueActions.length > 0 && (
        <div style={{marginBottom:22,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:14,padding:"14px 18px"}}>
          <div style={{fontSize:12,fontWeight:800,letterSpacing:.5,color:"#f87171",textTransform:"uppercase",marginBottom:12}}>🚨 Overdue Actions ({overdueActions.length})</div>
          <div style={{display:"grid",gap:8}}>
            {overdueActions.map((a,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 12px",background:"rgba(239,68,68,0.06)",borderRadius:10,border:"1px solid rgba(239,68,68,0.15)",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:160}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#fca5a5"}}>{a.description}</div>
                  <div style={{fontSize:11,color:Z.muted,marginTop:2}}>📍 {a.incLocation} · Owner: {a.owner||"Unassigned"} · Due: {a.dueDate}</div>
                </div>
                <button onClick={()=>onOpen(a.incId)}
                  style={{background:"rgba(239,68,68,0.15)",color:"#f87171",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"5px 14px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                  View →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High-risk unresolved */}
      {highRiskOpen.length > 0 && (
        <div style={{marginBottom:22,background:"rgba(251,146,60,0.07)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:14,padding:"14px 18px"}}>
          <div style={{fontSize:12,fontWeight:800,letterSpacing:.5,color:"#fb923c",textTransform:"uppercase",marginBottom:12}}>⚠️ High-Risk Unresolved Incidents ({highRiskOpen.length})</div>
          <div style={{display:"grid",gap:8}}>
            {highRiskOpen.map(inc=>(
              <div key={inc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 12px",background:"rgba(251,146,60,0.06)",borderRadius:10,border:"1px solid rgba(251,146,60,0.15)",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:160}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#fdba74"}}>{inc.description.slice(0,80)}{inc.description.length>80?"…":""}</div>
                  <div style={{fontSize:11,color:Z.muted,marginTop:2}}>📍 {inc.location} · {inc.date}{inc.riddor?<span style={{color:"#f87171",fontWeight:700}}> · RIDDOR</span>:""}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                  {investigations[inc.id] ? <span style={{fontSize:10,color:"#a78bfa",fontWeight:700,background:"rgba(139,92,246,0.12)",padding:"3px 8px",borderRadius:6}}>🔍 Under Investigation</span> : <span style={{fontSize:10,color:Z.muted,fontWeight:700,background:Z.overlay,padding:"3px 8px",borderRadius:6}}>No investigation</span>}
                  <button onClick={()=>onOpen(inc.id)}
                    style={{background:"rgba(251,146,60,0.12)",color:"#fb923c",border:"1px solid rgba(251,146,60,0.3)",borderRadius:8,padding:"5px 14px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                    {investigations[inc.id]?"View →":"Investigate →"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repeat issues */}
      {repeatIssues.length > 0 && (
        <div style={{marginBottom:22,background:"rgba(167,139,250,0.07)",border:"1px solid rgba(167,139,250,0.22)",borderRadius:14,padding:"14px 18px"}}>
          <div style={{fontSize:12,fontWeight:800,letterSpacing:.5,color:"#a78bfa",textTransform:"uppercase",marginBottom:12}}>🔁 Repeat Issue Locations</div>
          <div style={{display:"grid",gap:8}}>
            {repeatIssues.map(([loc,arr])=>(
              <div key={loc} style={{padding:"9px 12px",background:"rgba(167,139,250,0.06)",borderRadius:10,border:"1px solid rgba(167,139,250,0.15)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#c4b5fd",flex:1}}>📍 {arr[0].location}</span>
                  <span style={{fontSize:11,background:"rgba(167,139,250,0.2)",color:"#a78bfa",padding:"2px 10px",borderRadius:99,fontWeight:700}}>{arr.length} incidents</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {arr.slice(0,4).map(i=>(
                    <button key={i.id} onClick={()=>onOpen(i.id)}
                      style={{fontSize:10,background:Z.overlay,color:Z.muted,border:`1px solid ${Z.border}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:font,fontWeight:600}}>
                      {i.date}
                    </button>
                  ))}
                  {arr.length>4 && <span style={{fontSize:10,color:Z.muted,padding:"3px 0"}}>+{arr.length-4} more</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {openActions.length===0 && overdueActions.length===0 && highRiskOpen.length===0 && (
        <div style={{textAlign:"center",padding:40,color:Z.muted,fontSize:13}}>
          <div style={{fontSize:40,marginBottom:8}}>✅</div>
          No outstanding actions, overdue items, or high-risk open incidents.
        </div>
      )}
    </div>
  );
}

export { InvestigationDashboard };
