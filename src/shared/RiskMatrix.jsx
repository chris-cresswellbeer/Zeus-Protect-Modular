const LIKELIHOOD_LABELS = ["Rare","Unlikely","Possible","Likely","Almost Certain"];
const SEVERITY_LABELS   = ["Negligible","Minor","Moderate","Major","Catastrophic"];

function riskLevel(l, s) {
  const score = l * s;
  if (score >= 15) return { label:"Very High", color:"#dc2626", bg:"rgba(220,38,38,0.18)", text:"#fca5a5" };
  if (score >= 10) return { label:"High",      color:"#f97316", bg:"rgba(249,115,22,0.18)", text:"#fdba74" };
  if (score >= 5)  return { label:"Medium",    color:"#f59e0b", bg:"rgba(245,158,11,0.18)", text:"#fde68a" };
  if (score >= 3)  return { label:"Low",       color:"#22c55e", bg:"rgba(34,197,94,0.18)",  text:"#86efac" };
  return              { label:"Very Low",  color:"#10b981", bg:"rgba(16,185,129,0.18)", text:"#6ee7b7" };
}

function RiskMatrix({ value, onChange, Z, font, label }) {
  // value = {likelihood: 1-5, severity: 1-5}
  const L = value.likelihood || 0;
  const S = value.severity   || 0;
  const rl = L && S ? riskLevel(L, S) : null;

  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:10,textTransform:"uppercase"}}>{label}</div>
      {/* Grid: rows = severity (5 top → 1 bottom), cols = likelihood (1 left → 5 right) */}
      <div style={{display:"inline-block",border:`1px solid ${Z.borderMd}`,borderRadius:10,overflow:"hidden",userSelect:"none"}}>
        {/* Column headers */}
        <div style={{display:"grid",gridTemplateColumns:"60px repeat(5,44px)"}}>
          <div style={{background:Z.overlay,padding:"6px 4px",fontSize:9,fontWeight:700,color:Z.muted,display:"flex",alignItems:"flex-end",justifyContent:"center",borderBottom:`1px solid ${Z.borderMd}`}}>
            <span style={{writingMode:"horizontal-tb",textAlign:"center",lineHeight:1.2}}>SEVERITY →<br/>LIKELIHOOD ↓</span>
          </div>
          {LIKELIHOOD_LABELS.map((lbl,i)=>(
            <div key={i} style={{background:Z.overlay,padding:"4px 2px",fontSize:9,fontWeight:700,color:Z.muted,textAlign:"center",borderBottom:`1px solid ${Z.borderMd}`,borderLeft:`1px solid ${Z.borderMd}`,lineHeight:1.2}}>
              {i+1}<br/><span style={{fontWeight:400,fontSize:8}}>{lbl}</span>
            </div>
          ))}
        </div>
        {/* Rows: severity 5→1 */}
        {[5,4,3,2,1].map(sev=>(
          <div key={sev} style={{display:"grid",gridTemplateColumns:"60px repeat(5,44px)"}}>
            {/* Row label */}
            <div style={{background:Z.overlay,padding:"4px 6px",fontSize:9,fontWeight:700,color:Z.muted,display:"flex",alignItems:"center",justifyContent:"flex-end",borderTop:sev<5?`1px solid ${Z.borderMd}`:"none",textAlign:"right",lineHeight:1.2}}>
              {sev} {SEVERITY_LABELS[sev-1]}
            </div>
            {[1,2,3,4,5].map(lik=>{
              const score = lik * sev;
              const rl2 = riskLevel(lik, sev);
              const isSelected = L===lik && S===sev;
              return (
                <div key={lik}
                  onClick={()=>onChange({likelihood:lik, severity:sev})}
                  title={`L${lik} × S${sev} = ${score} (${rl2.label})`}
                  style={{
                    width:44, height:38,
                    background: isSelected ? rl2.color : rl2.bg,
                    border: isSelected ? `2px solid #fff` : `1px solid ${Z.borderMd}`,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    flexDirection:"column", gap:1, transition:"all .15s",
                    borderTop: sev<5 ? `1px solid ${Z.borderMd}` : "none",
                    borderLeft:`1px solid ${Z.borderMd}`,
                    boxSizing:"border-box",
                  }}>
                  <span style={{fontSize:11,fontWeight:800,color:isSelected?"#fff":rl2.text,lineHeight:1}}>{score}</span>
                  {isSelected && <span style={{fontSize:7,color:"#fff",fontWeight:700,lineHeight:1}}>▲</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* Selected risk display */}
      {rl && (
        <div style={{marginTop:8,display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,background:rl.bg,border:`1px solid ${rl.color}44`}}>
          <div style={{width:10,height:10,borderRadius:2,background:rl.color,flexShrink:0}}/>
          <span style={{fontSize:12,fontWeight:700,color:rl.text}}>{rl.label} Risk</span>
          <span style={{fontSize:11,color:Z.muted}}>Score: {L*S} · Likelihood {L} × Severity {S}</span>
        </div>
      )}
    </div>
  );
}


export { RiskMatrix, riskLevel, LIKELIHOOD_LABELS, SEVERITY_LABELS };
