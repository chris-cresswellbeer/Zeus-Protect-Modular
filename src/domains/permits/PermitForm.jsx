import { useWindowWidth } from "../../shared/hooks";
import { PERMIT_TYPES, PPE_OPTIONS } from "../../data/seedPermits";

function PermitForm({ existing, staff, contractors, onSave, onCancel, T, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const now = new Date();
  const todayStr = now.toISOString().slice(0,16);
  const endDefault = new Date(now.getTime()+8*3600000).toISOString().slice(0,16);

  const [form, setForm] = React.useState(existing || {
    id:"ptw_"+Date.now(),
    type:"hot_works",
    location:"",
    description:"",
    startDateTime:todayStr,
    endDateTime:endDefault,
    contractor:"",
    workers:[],
    authorisedBy:"",
    hazards:{},
    precautions:{},
    ppe:[],
    additionalControls:"",
    status:"draft",
    createdAt:todayStr,
  });

  const pt = PERMIT_TYPES.find(p=>p.id===form.type)||PERMIT_TYPES[0];
  const inp = {width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"9px 13px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const lbl = {fontSize:11,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5};
  const check = (group, key, label, col) => {
    const checked = !!form[group][key];
    return (
      <label key={key} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"6px 10px",borderRadius:8,background:checked?`${col||T.accent}18`:T.overlay,border:`1px solid ${checked?col||T.accent:T.border}`,transition:"all .15s"}}>
        <input type="checkbox" checked={checked} onChange={e=>setForm(p=>({...p,[group]:{...p[group],[key]:e.target.checked}}))} style={{accentColor:col||T.accent,width:14,height:14,flexShrink:0}}/>
        <span style={{fontSize:12,color:checked?T.white:T.muted,fontWeight:checked?600:400}}>{label}</span>
      </label>
    );
  };

  return (
    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,border:`1px solid ${T.borderMd}`,marginBottom:20}}>
      <h3 style={{margin:"0 0 20px",fontSize:16,fontWeight:800,color:T.white}}>{existing?"Edit":"New"} Permit to Work</h3>

      {/* Permit type selector */}
      <div style={{marginBottom:18}}>
        <label style={lbl}>Permit Type *</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
          {PERMIT_TYPES.map(pt2=>(
            <button key={pt2.id} onClick={()=>setForm(p=>({...p,type:pt2.id,hazards:{},precautions:{}}))}
              style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:10,border:`2px solid ${form.type===pt2.id?pt2.color:T.borderMd}`,background:form.type===pt2.id?`${pt2.color}18`:T.overlay,cursor:"pointer",fontFamily:font,textAlign:"left",transition:"all .15s"}}>
              <span style={{fontSize:18}}>{pt2.icon}</span>
              <span style={{fontSize:12,fontWeight:form.type===pt2.id?700:400,color:form.type===pt2.id?pt2.color:T.muted}}>{pt2.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:14}}>
        <div style={{gridColumn:"1/-1"}}><label style={lbl}>Description of Work *</label><textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={{...inp,minHeight:70,resize:"vertical"}} placeholder="Describe the work to be carried out in detail..."/></div>
        <div><label style={lbl}>Location *</label><input style={inp} value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="e.g. Boiler Room, Zone A"/></div>
        <div><label style={lbl}>Contractor / Company</label>
          <select style={inp} value={form.contractor} onChange={e=>setForm(p=>({...p,contractor:e.target.value,workers:[]}))}>
            <option value="">Select contractor (optional)...</option>
            {contractors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Start Date & Time *</label><input type="datetime-local" style={inp} value={form.startDateTime} onChange={e=>setForm(p=>({...p,startDateTime:e.target.value}))}/></div>
        <div><label style={lbl}>End Date & Time *</label><input type="datetime-local" style={inp} value={form.endDateTime} onChange={e=>setForm(p=>({...p,endDateTime:e.target.value}))}/></div>
        <div><label style={lbl}>Authorised By (Zeus Staff) *</label>
          <select style={inp} value={form.authorisedBy} onChange={e=>setForm(p=>({...p,authorisedBy:e.target.value}))}>
            <option value="">Select authorising person...</option>
            {staff.filter(u=>u.role==="admin"||u.manager).map(u=><option key={u.id} value={u.name}>{u.name}{u.jobTitle?` — ${u.jobTitle}`:""}</option>)}
          </select>
        </div>
      </div>

      {/* Hazard checklist */}
      <div style={{marginBottom:14}}>
        <label style={lbl}>Hazards Identified</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:6}}>
          {pt.hazards.map(h=>check("hazards",h,h,"#ef4444"))}
        </div>
      </div>

      {/* Precautions checklist */}
      <div style={{marginBottom:14}}>
        <label style={lbl}>Precautions in Place</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:6}}>
          {pt.precautions.map(p2=>check("precautions",p2,p2,T.green))}
        </div>
      </div>

      {/* PPE */}
      <div style={{marginBottom:14}}>
        <label style={lbl}>PPE Required</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {PPE_OPTIONS.map(p2=>{
            const sel=form.ppe.includes(p2);
            return <button key={p2} onClick={()=>setForm(p=>({...p,ppe:sel?p.ppe.filter(x=>x!==p2):[...p.ppe,p2]}))}
              style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${sel?T.accent:T.borderMd}`,background:sel?`rgba(37,99,235,0.15)`:T.overlay,color:sel?T.accentLt:T.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:sel?700:400}}>{p2}</button>;
          })}
        </div>
      </div>

      <div style={{marginBottom:18}}><label style={lbl}>Additional Controls / Notes</label><textarea value={form.additionalControls} onChange={e=>setForm(p=>({...p,additionalControls:e.target.value}))} style={{...inp,minHeight:60,resize:"vertical"}} placeholder="Any additional safety measures or notes..."/></div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button onClick={()=>onSave({...form,status:"draft"})} disabled={!form.description.trim()||!form.location.trim()||!form.startDateTime||!form.endDateTime}
          style={{background:T.overlay,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 20px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>
          💾 Save as Draft
        </button>
        <button onClick={()=>onSave({...form,status:"active"})} disabled={!form.description.trim()||!form.location.trim()||!form.startDateTime||!form.endDateTime||!form.authorisedBy}
          style={{background:(!form.description.trim()||!form.location.trim()||!form.authorisedBy)?T.overlay:`linear-gradient(135deg,#10b981,#059669)`,color:(!form.description.trim()||!form.location.trim()||!form.authorisedBy)?T.muted:"#fff",border:"none",borderRadius:10,padding:"10px 24px",cursor:(!form.description.trim()||!form.location.trim()||!form.authorisedBy)?"not-allowed":"pointer",fontFamily:font,fontWeight:700,fontSize:13,opacity:(!form.description.trim()||!form.location.trim()||!form.authorisedBy)?.5:1,boxShadow:(!form.description.trim()||!form.location.trim()||!form.authorisedBy)?"none":"0 4px 14px rgba(16,185,129,0.3)"}}>
          ✓ Issue Permit
        </button>
        <button onClick={onCancel} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>Cancel</button>
      </div>
    </div>
  );
}

export { PermitForm };
