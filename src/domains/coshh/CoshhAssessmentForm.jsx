function CoshhAssessmentForm({ c, existing, onSave, onCancel, Z, font, isMobile }) {
  const BLANK = {
    preparedBy:"", reviewDate:"", location:"", frequency:"",
    exposureRoutes:{ inhalation:false, skin:false, ingestion:false, eye:false, injection:false },
    healthEffects:"",
    controlMeasures:{ substitution:false, enclosure:false, ventilation:false, ppe:false, training:false, monitoring:false },
    ppeRequired:{ gloves:"", respirator:"", eyeProtection:"", bodyProtection:"", footProtection:"" },
    emergencyProcedures:"", wasteDisposal:"", assessmentDate:"", nextReviewDate:"", riskRating:"medium",
  };
  const [form, setForm] = React.useState(existing || BLANK);
  const inp2 = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 11px",color:Z.white,fontSize:12,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const lbl2 = {fontSize:10,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:4};
  const checkRow = (group, key, label) => (
    <label key={key} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:Z.white}}>
      <input type="checkbox" checked={!!form[group][key]} onChange={e=>setForm(p=>({...p,[group]:{...p[group],[key]:e.target.checked}}))} style={{accentColor:Z.accent,width:14,height:14}}/>
      {label}
    </label>
  );
  return (
    <div style={{padding:"16px"}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:14}}>
        <div><label style={lbl2}>Prepared By</label><input style={inp2} value={form.preparedBy} onChange={e=>setForm(p=>({...p,preparedBy:e.target.value}))}/></div>
        <div><label style={lbl2}>Location / Area Used</label><input style={inp2} value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}/></div>
        <div><label style={lbl2}>Assessment Date</label><input type="date" style={inp2} value={form.assessmentDate} onChange={e=>setForm(p=>({...p,assessmentDate:e.target.value}))}/></div>
        <div><label style={lbl2}>Next Review Date</label><input type="date" style={inp2} value={form.nextReviewDate} onChange={e=>setForm(p=>({...p,nextReviewDate:e.target.value}))}/></div>
        <div><label style={lbl2}>Frequency of Use</label><input style={inp2} value={form.frequency} onChange={e=>setForm(p=>({...p,frequency:e.target.value}))} placeholder="e.g. Daily, Weekly"/></div>
        <div><label style={lbl2}>Risk Rating</label>
          <select style={inp2} value={form.riskRating} onChange={e=>setForm(p=>({...p,riskRating:e.target.value}))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div style={{marginBottom:14}}><label style={lbl2}>Health Effects / Hazards</label><textarea style={{...inp2,minHeight:60,resize:"vertical"}} value={form.healthEffects} onChange={e=>setForm(p=>({...p,healthEffects:e.target.value}))}/></div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:14}}>
        <div style={{background:Z.overlay,borderRadius:10,padding:"12px 14px",border:`1px solid ${Z.border}`}}>
          <div style={lbl2}>Exposure Routes</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[["inhalation","Inhalation"],["skin","Skin contact"],["ingestion","Ingestion"],["eye","Eye contact"],["injection","Injection"]].map(([k,l])=>checkRow("exposureRoutes",k,l))}
          </div>
        </div>
        <div style={{background:Z.overlay,borderRadius:10,padding:"12px 14px",border:`1px solid ${Z.border}`}}>
          <div style={lbl2}>Control Measures</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[["substitution","Substitution"],["enclosure","Enclosure"],["ventilation","Local exhaust ventilation"],["ppe","PPE"],["training","Training & instruction"],["monitoring","Health monitoring"]].map(([k,l])=>checkRow("controlMeasures",k,l))}
          </div>
        </div>
      </div>
      <div style={{background:Z.overlay,borderRadius:10,padding:"12px 14px",border:`1px solid ${Z.border}`,marginBottom:14}}>
        <div style={lbl2}>PPE Required</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8}}>
          {[["gloves","Gloves (type)"],["respirator","Respirator (type)"],["eyeProtection","Eye protection"],["bodyProtection","Body protection"],["footProtection","Foot protection"]].map(([k,l])=>(
            <div key={k}><label style={{...lbl2,textTransform:"none",fontSize:11}}>{l}</label><input style={inp2} value={form.ppeRequired[k]||""} onChange={e=>setForm(p=>({...p,ppeRequired:{...p.ppeRequired,[k]:e.target.value}}))}/></div>
          ))}
        </div>
      </div>
      <div style={{marginBottom:14}}><label style={lbl2}>Emergency Procedures (spill / first aid)</label><textarea style={{...inp2,minHeight:60,resize:"vertical"}} value={form.emergencyProcedures} onChange={e=>setForm(p=>({...p,emergencyProcedures:e.target.value}))}/></div>
      <div style={{marginBottom:16}}><label style={lbl2}>Waste Disposal Method</label><input style={inp2} value={form.wasteDisposal} onChange={e=>setForm(p=>({...p,wasteDisposal:e.target.value}))}/></div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>onSave(form)}
          style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font,flex:1,boxShadow:"0 4px 14px rgba(16,185,129,0.3)"}}>
          ✓ Save Assessment
        </button>
        <button onClick={onCancel}
          style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 18px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export { CoshhAssessmentForm };
