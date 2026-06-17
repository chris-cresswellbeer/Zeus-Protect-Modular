function CompanyForm({ existing, onSave, onCancel, T, font }) {
  const [form, setForm] = React.useState(existing||{id:"con_"+Date.now(),name:"",type:"Contractor",status:"active",email:"",phone:"",notes:"",workers:[]});
  const inp = {width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"9px 13px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const lbl = {fontSize:11,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5};
  return (
    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,border:`1px solid ${T.borderMd}`,marginBottom:20}}>
      <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:800,color:T.white}}>{existing?"Edit":"Add"} Company</h3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div style={{gridColumn:"1/-1"}}><label style={lbl}>Company Name *</label><input style={inp} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
        <div><label style={lbl}>Type</label>
          <select style={inp} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
            {["Contractor","Agency","Maintenance","Cleaning","IT","Delivery","Other"].map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Status</label>
          <select style={inp} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="banned">Banned</option>
          </select>
        </div>
        <div><label style={lbl}>Email</label><input style={inp} value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
        <div><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/></div>
      </div>
      <div style={{marginBottom:14}}><label style={lbl}>Notes</label><textarea style={{...inp,minHeight:50,resize:"vertical"}} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>onSave(form)} disabled={!form.name.trim()} style={{background:form.name.trim()?`linear-gradient(135deg,${T.accent},${T.blue})`:"rgba(37,99,235,0.3)",color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",cursor:form.name.trim()?"pointer":"not-allowed",fontFamily:font,fontWeight:700,fontSize:13,opacity:form.name.trim()?1:.5}}>Save</button>
        <button onClick={onCancel} style={{background:T.overlay,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>Cancel</button>
      </div>
    </div>
  );
}


export { CompanyForm };
