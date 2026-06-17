import { useState } from "react";

function IncidentChart({ incidents, Z, font }) {
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2];
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Build all 12 months for the selected year
  const months = Array.from({length:12},(_,i)=>({
    key: `${selectedYear}-${String(i+1).padStart(2,"0")}`,
    label: new Date(selectedYear, i, 1).toLocaleString("default",{month:"short"}),
  }));

  const yearIncidents = incidents.filter(inc => inc.date.startsWith(String(selectedYear)));

  const data = months.map(m => {
    const mi = incidents.filter(inc => inc.date.startsWith(m.key));
    return {
      label: m.label,
      accident:         mi.filter(i=>i.type==="accident").length,
      near_miss:        mi.filter(i=>i.type==="near_miss").length,
      unsafe_condition: mi.filter(i=>i.type==="unsafe_condition").length,
      unsafe_act:       mi.filter(i=>i.type==="unsafe_act").length,
      riddor:           mi.filter(i=>i.riddor).length,
      total:            mi.length,
    };
  });

  const maxVal = Math.max(...data.map(d=>d.total), 1);
  const BAR_H = 160;
  const typeColors = { accident:"#ef4444", near_miss:"#f59e0b", unsafe_condition:"#8b5cf6", unsafe_act:"#3b82f6" };

  const totals = {
    accident:         yearIncidents.filter(i=>i.type==="accident").length,
    near_miss:        yearIncidents.filter(i=>i.type==="near_miss").length,
    unsafe_condition: yearIncidents.filter(i=>i.type==="unsafe_condition").length,
    unsafe_act:       yearIncidents.filter(i=>i.type==="unsafe_act").length,
    riddor:           yearIncidents.filter(i=>i.riddor).length,
    total:            yearIncidents.length,
  };

  const legend = [
    {id:"accident",         label:"Accident",         color:"#ef4444"},
    {id:"near_miss",        label:"Near Miss",         color:"#f59e0b"},
    {id:"unsafe_condition", label:"Unsafe Condition",  color:"#8b5cf6"},
    {id:"unsafe_act",       label:"Unsafe Act",        color:"#3b82f6"},
  ];

  return (
    <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:24,border:`1px solid ${Z.border}`,marginBottom:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:900,color:Z.white,letterSpacing:-.3}}>Monthly Incident Summary</h3>
          <p style={{margin:0,fontSize:12,color:Z.muted}}>All 12 months — {selectedYear}</p>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          {/* Year selector */}
          <div style={{display:"flex",gap:4}}>
            {availableYears.map(yr=>(
              <button key={yr} onClick={()=>setSelectedYear(yr)}
                style={{padding:"5px 14px",borderRadius:8,border:`1px solid ${selectedYear===yr?Z.accentLt:Z.borderMd}`,
                  background:selectedYear===yr?`rgba(59,130,246,0.18)`:"transparent",
                  color:selectedYear===yr?Z.accentLt:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:selectedYear===yr?700:400,fontSize:13,transition:"all .2s"}}>
                {yr}
              </button>
            ))}
          </div>
          <div style={{width:1,height:18,background:Z.border}}/>
          {/* Legend */}
          {legend.map(l=>(
            <div key={l.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:Z.muted}}>
              <div style={{width:10,height:10,borderRadius:2,background:l.color,flexShrink:0}}/>
              {l.label}
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:Z.muted}}>
            <div style={{width:10,height:10,borderRadius:2,background:Z.borderMd,flexShrink:0,border:"1px dashed rgba(239,68,68,0.6)"}}/>
            RIDDOR
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{display:"flex",gap:4,height:BAR_H+32,paddingBottom:24,position:"relative",borderBottom:`1px solid ${Z.border}`}}>
        {/* Y-axis guide lines */}
        {[0.25,0.5,0.75,1].map(frac=>(
          <div key={frac} style={{position:"absolute",left:0,right:0,bottom:24+Math.round(BAR_H*frac),borderTop:`1px dashed ${Z.border}`,zIndex:0}}/>
        ))}
        {data.map((d,di)=>{
          const stackOrder = ["unsafe_act","unsafe_condition","near_miss","accident"];
          let cumH = 0;
          const totalBarH = Math.round((d.total/maxVal)*BAR_H);
          return (
            <div key={di} style={{flex:1,position:"relative",height:BAR_H+8,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",zIndex:1}}>
              <div style={{position:"relative",width:"74%",height:BAR_H,flexShrink:0}}>
                {stackOrder.map(type=>{
                  const v = d[type];
                  if (!v) return null;
                  const segH = Math.max(Math.round((v/maxVal)*BAR_H), 3);
                  const bottom = Math.round((cumH/maxVal)*BAR_H);
                  cumH += v;
                  return (
                    <div key={type}
                      title={`${INCIDENT_TYPES.find(t=>t.id===type)?.label}: ${v}`}
                      style={{position:"absolute",bottom,left:0,right:0,height:segH,
                        background:typeColors[type],
                        borderRadius:cumH===d.total?"4px 4px 0 0":"0",
                        transition:"height .4s ease"}}/>
                  );
                })}
                {/* Total label above bar */}
                {d.total>0 && (
                  <div style={{position:"absolute",bottom:totalBarH+3,left:0,right:0,textAlign:"center",fontSize:10,fontWeight:800,color:Z.white}}>
                    {d.total}
                  </div>
                )}
                {/* RIDDOR badge */}
                {d.riddor>0 && (
                  <div style={{position:"absolute",bottom:totalBarH+17,left:"50%",transform:"translateX(-50%)",fontSize:9,fontWeight:800,color:"#f87171",background:"rgba(239,68,68,0.2)",border:"1px solid rgba(239,68,68,0.5)",borderRadius:4,padding:"1px 4px",whiteSpace:"nowrap",zIndex:2}}>
                    R:{d.riddor}
                  </div>
                )}
              </div>
              {/* Month label */}
              <div style={{fontSize:10,color:Z.muted,fontWeight:600,textAlign:"center",marginTop:4,flexShrink:0}}>{d.label}</div>
            </div>
          );
        })}
      </div>

      {/* Year totals summary */}
      <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
        <div style={{background:"rgba(239,68,68,0.1)",borderRadius:10,padding:"10px 14px",flex:1,minWidth:90,textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:"#ef4444",fontFamily:"'Barlow Condensed',sans-serif"}}>{totals.accident}</div>
          <div style={{fontSize:10,color:Z.muted,marginTop:1}}>🚨 Accidents</div>
        </div>
        <div style={{background:"rgba(245,158,11,0.1)",borderRadius:10,padding:"10px 14px",flex:1,minWidth:90,textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:"#f59e0b",fontFamily:"'Barlow Condensed',sans-serif"}}>{totals.near_miss}</div>
          <div style={{fontSize:10,color:Z.muted,marginTop:1}}>⚠️ Near Misses</div>
        </div>
        <div style={{background:"rgba(139,92,246,0.1)",borderRadius:10,padding:"10px 14px",flex:1,minWidth:90,textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:"#8b5cf6",fontFamily:"'Barlow Condensed',sans-serif"}}>{totals.unsafe_condition}</div>
          <div style={{fontSize:10,color:Z.muted,marginTop:1}}>🔶 Unsafe Conds.</div>
        </div>
        <div style={{background:"rgba(59,130,246,0.1)",borderRadius:10,padding:"10px 14px",flex:1,minWidth:90,textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:"#3b82f6",fontFamily:"'Barlow Condensed',sans-serif"}}>{totals.unsafe_act}</div>
          <div style={{fontSize:10,color:Z.muted,marginTop:1}}>🔷 Unsafe Acts</div>
        </div>
        <div style={{background:"rgba(16,185,129,0.1)",borderRadius:10,padding:"10px 14px",flex:1,minWidth:90,textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:"#10b981",fontFamily:"'Barlow Condensed',sans-serif"}}>{totals.total}</div>
          <div style={{fontSize:10,color:Z.muted,marginTop:1}}>📊 Total</div>
        </div>
        <div style={{background:"rgba(239,68,68,0.07)",borderRadius:10,padding:"10px 14px",flex:1,minWidth:90,textAlign:"center",border:"1px dashed rgba(239,68,68,0.35)"}}>
          <div style={{fontSize:22,fontWeight:900,color:"#f87171",fontFamily:"'Barlow Condensed',sans-serif"}}>{totals.riddor}</div>
          <div style={{fontSize:10,color:Z.muted,marginTop:1}}>🏥 RIDDOR</div>
        </div>
      </div>
    </div>
  );
}

export { IncidentChart };
