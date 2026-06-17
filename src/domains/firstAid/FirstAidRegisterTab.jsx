import { FA_SHIFTS, FA_ZONES, FA_CERT_TYPES, FA_KIT_TYPES } from "../../data/seedFirstAid";

function FirstAidRegisterTab({ staff, extCerts, firstAidData, setFirstAidData, Z, font }) {
  const [subTab, setSubTab] = useState("aiders");
  const [showModal, setShowModal] = useState(false);
  const [modalSection, setModalSection] = useState("aider");
  const [modalForm, setModalForm] = useState({});
  const [editId, setEditId] = useState(null);
  const [newZone, setNewZone] = useState("");

  const { aiders=[], kits=[], assessment={}, customZones=[] } = firstAidData || {};
  const allZones = [...FA_ZONES, ...customZones];
  const today = new Date().toISOString().slice(0,10);

  // ── Pull first aiders from extCerts automatically ─────────────────────────
  // Build a combined list: manually added aiders + auto-detected from extCerts
  const certAiders = [];
  Object.entries(extCerts || {}).forEach(([uid, certs]) => {
    if (certs.first_aid) {
      const u = staff.find(s => String(s.id) === String(uid));
      if (u) certAiders.push({
        _fromCert: true,
        id: `cert_${uid}`,
        staffId: uid,
        name: u.name,
        jobTitle: u.jobTitle || "",
        certType: "First Aid at Work (FAW)",
        issuedDate: certs.first_aid.issuedDate || "",
        expiryDate: certs.first_aid.expiryDate || "",
        shifts: certs.first_aid.shifts || [],
        zones:  certs.first_aid.zones  || [],
        phone: "",
        isLead: false,
      });
    }
  });
  // Merge: manual aiders take precedence over cert-auto entries for same staffId
  const manualStaffIds = new Set(aiders.filter(a=>a.staffId).map(a=>String(a.staffId)));
  const allAiders = [
    ...aiders,
    ...certAiders.filter(c => !manualStaffIds.has(String(c.staffId))),
  ];

  // ── Helpers ───────────────────────────────────────────────────────────────
  const uid = () => Math.random().toString(36).slice(2,9);
  const addZone = () => {
    const z = newZone.trim();
    if (!z || allZones.includes(z)) return;
    setFirstAidData(p=>({...p, customZones:[...(p.customZones||[]), z]}));
    setNewZone("");
  };
  const removeZone = (z) => setFirstAidData(p=>({...p, customZones:(p.customZones||[]).filter(x=>x!==z)}));
  const inp = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 13px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const lbl = t => <div style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4,marginTop:14}}>{t}</div>;

  function daysUntil(d) { return d ? Math.ceil((new Date(d)-new Date())/86400000) : null; }
  function certBadge(expiryDate) {
    const d = daysUntil(expiryDate);
    if (d === null) return { label:"No date", color:"#6b7280", bg:"rgba(107,114,128,0.12)" };
    if (d < 0)   return { label:"Expired",          color:"#ef4444", bg:"rgba(239,68,68,0.15)" };
    if (d <= 90) return { label:`Exp. in ${d}d`,    color:"#f59e0b", bg:"rgba(245,158,11,0.15)" };
    return               { label:"Valid",            color:"#10b981", bg:"rgba(16,185,129,0.12)" };
  }
  function kitBadge(lastCheckDate) {
    const d = daysUntil(lastCheckDate ? new Date(new Date(lastCheckDate).getTime()+35*86400000).toISOString().slice(0,10) : null);
    if (d === null) return { label:"Never checked", color:"#ef4444", bg:"rgba(239,68,68,0.15)" };
    if (d < 0)     return { label:"Check overdue",  color:"#ef4444", bg:"rgba(239,68,68,0.15)" };
    if (d <= 7)    return { label:`Due in ${d}d`,   color:"#f59e0b", bg:"rgba(245,158,11,0.15)" };
    return                 { label:"OK",             color:"#10b981", bg:"rgba(16,185,129,0.12)" };
  }
  const Badge = ({label:bl,color,bg}) => (
    <span style={{fontSize:11,fontWeight:700,color,background:bg,border:`1px solid ${color}33`,borderRadius:8,padding:"2px 9px",whiteSpace:"nowrap"}}>{bl}</span>
  );

  // ── Coverage matrix ───────────────────────────────────────────────────────
  const SHIFT_SHORT = ["Early","Late","Night","All"];
  function coverageCount(zone, shift) {
    return allAiders.filter(a => {
      const b = certBadge(a.expiryDate);
      if (b.color === "#ef4444") return false; // expired
      const shiftsOk = !a.shifts?.length || a.shifts.includes("All Shifts") || a.shifts.includes(shift);
      const zonesOk  = !a.zones?.length  || a.zones.includes(zone);
      return shiftsOk && zonesOk;
    }).length;
  }

  function openAdd(section) { setModalSection(section); setEditId(null); setModalForm({}); setShowModal(true); }
  function openEdit(item, section) { setModalSection(section); setEditId(item.id); setModalForm({...item, shifts:[...(item.shifts||[])], zones:[...(item.zones||[])]}); setShowModal(true); }
  function deleteItem(id, key) { setFirstAidData(p=>({...p,[key]:(p[key]||[]).filter(x=>x.id!==id)})); }

  function saveModal() {
    if (modalSection === "assessment") {
      setFirstAidData(p=>({...p, assessment:{...p.assessment,...modalForm}}));
      setShowModal(false); return;
    }
    const key = modalSection === "aider" ? "aiders" : "kits";
    setFirstAidData(p=>{
      const list = p[key]||[];
      if (editId) return {...p,[key]:list.map(x=>x.id===editId?{...modalForm,id:editId}:x)};
      return {...p,[key]:[...list,{...modalForm,id:uid()}]};
    });
    setShowModal(false);
  }

  // ── Form content ──────────────────────────────────────────────────────────
  const fSet = (k,v) => setModalForm(p=>({...p,[k]:v}));
  const toggleArr = (k,v) => setModalForm(p=>({ ...p,[k]: (p[k]||[]).includes(v) ? (p[k]||[]).filter(x=>x!==v) : [...(p[k]||[]),v] }));

  const formContent = modalSection==="aider" ? (<>
    {lbl("Staff Member")}
    <select value={modalForm.staffId||""} onChange={e=>{ const u=staff.find(s=>String(s.id)===e.target.value); fSet("staffId",e.target.value); if(u){fSet("name",u.name);fSet("jobTitle",u.jobTitle||"");} }} style={{...inp,marginBottom:0}}>
      <option value="">— Select staff member —</option>
      {staff.map(u=><option key={u.id} value={String(u.id)}>{u.name}</option>)}
    </select>
    {lbl("Certificate Type")}
    <select value={modalForm.certType||""} onChange={e=>fSet("certType",e.target.value)} style={{...inp,marginBottom:0}}>
      <option value="">— Select —</option>
      {FA_CERT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
    </select>
    {lbl("Issue Date")} <input type="date" value={modalForm.issuedDate||""} onChange={e=>fSet("issuedDate",e.target.value)} style={{...inp,marginBottom:0}}/>
    {lbl("Expiry Date")} <input type="date" value={modalForm.expiryDate||""} onChange={e=>fSet("expiryDate",e.target.value)} style={{...inp,marginBottom:0}}/>
    {lbl("Shifts Covered")}
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {FA_SHIFTS.map(s=>{
        const on=(modalForm.shifts||[]).includes(s);
        return <button key={s} type="button" onClick={()=>toggleArr("shifts",s)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${on?"#10b981":Z.borderMd}`,background:on?"rgba(16,185,129,0.12)":Z.overlay,color:on?"#10b981":Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:on?700:400}}>{s}</button>;
      })}
    </div>
    {lbl("Zones / Areas Covered")}
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {allZones.map(z=>{
        const on=(modalForm.zones||[]).includes(z);
        return <button key={z} type="button" onClick={()=>toggleArr("zones",z)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${on?"#3b82f6":Z.borderMd}`,background:on?"rgba(59,130,246,0.12)":Z.overlay,color:on?"#93c5fd":Z.muted,cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:on?700:400}}>{z}</button>;
      })}
    </div>
    {lbl("Contact / Extension")} <input type="text" value={modalForm.phone||""} onChange={e=>fSet("phone",e.target.value)} placeholder="e.g. Ext 204 or mobile" style={{...inp,marginBottom:0}}/>
    {lbl("Designated Lead First Aider?")}
    <div style={{display:"flex",gap:8}}>
      {[["Yes",true],["No",false]].map(([l,v])=>{
        const on=modalForm.isLead===v;
        return <button key={l} type="button" onClick={()=>fSet("isLead",v)} style={{padding:"7px 20px",borderRadius:9,border:`1px solid ${on?"#f59e0b":Z.borderMd}`,background:on?"rgba(245,158,11,0.12)":Z.overlay,color:on?"#f59e0b":Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:on?700:400}}>{l}</button>;
      })}
    </div>
  </>) : modalSection==="kit" ? (<>
    {lbl("Location")} <input type="text" value={modalForm.location||""} onChange={e=>fSet("location",e.target.value)} placeholder="e.g. Warehouse Bay 2 — Wall mount" style={{...inp,marginBottom:0}}/>
    {lbl("Kit Type")}
    <select value={modalForm.kitType||""} onChange={e=>fSet("kitType",e.target.value)} style={{...inp,marginBottom:0}}>
      <option value="">— Select —</option>
      {FA_KIT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
    </select>
    {lbl("Kit Reference / ID")} <input type="text" value={modalForm.kitRef||""} onChange={e=>fSet("kitRef",e.target.value)} placeholder="e.g. FAK-003" style={{...inp,marginBottom:0}}/>
    {lbl("Last Monthly Check Date")} <input type="date" value={modalForm.lastCheckDate||""} onChange={e=>fSet("lastCheckDate",e.target.value)} style={{...inp,marginBottom:0}}/>
    {lbl("Checked By")} <input type="text" value={modalForm.checkedBy||""} onChange={e=>fSet("checkedBy",e.target.value)} placeholder="Name" style={{...inp,marginBottom:0}}/>
    {lbl("Condition")}
    <select value={modalForm.condition||"good"} onChange={e=>fSet("condition",e.target.value)} style={{...inp,marginBottom:0}}>
      <option value="good">Good — fully stocked</option>
      <option value="low">Low stock — items needed</option>
      <option value="restock">Restock required — out of service</option>
    </select>
    {lbl("Notes")} <textarea rows={2} value={modalForm.notes||""} onChange={e=>fSet("notes",e.target.value)} placeholder="Any items missing, damage, or actions needed..." style={{...inp,resize:"vertical",marginBottom:0}}/>
  </>) : (<>
    {lbl("Assessment Date")} <input type="date" value={modalForm.date||assessment.date||""} onChange={e=>fSet("date",e.target.value)} style={{...inp,marginBottom:0}}/>
    {lbl("Conducted By")} <input type="text" value={modalForm.conductedBy||assessment.conductedBy||""} onChange={e=>fSet("conductedBy",e.target.value)} placeholder="Name and role" style={{...inp,marginBottom:0}}/>
    {lbl("Recommended First Aiders (per shift)")} <input type="number" min={1} value={modalForm.minPerShift||assessment.minPerShift||1} onChange={e=>fSet("minPerShift",Number(e.target.value))} style={{...inp,marginBottom:0}}/>
    {lbl("Risk Level of Site")}
    <select value={modalForm.riskLevel||assessment.riskLevel||"medium"} onChange={e=>fSet("riskLevel",e.target.value)} style={{...inp,marginBottom:0}}>
      <option value="low">Low risk (offices, retail)</option>
      <option value="medium">Medium risk (light industry, warehousing)</option>
      <option value="high">High risk (heavy industry, construction, chemicals)</option>
    </select>
    {lbl("Conclusions / Findings")} <textarea rows={4} value={modalForm.conclusions||assessment.conclusions||""} onChange={e=>fSet("conclusions",e.target.value)} placeholder="Summarise the findings of the first aid needs assessment and any actions arising..." style={{...inp,resize:"vertical",marginBottom:0}}/>
    {lbl("Next Review Due")} <input type="date" value={modalForm.nextReview||assessment.nextReview||""} onChange={e=>fSet("nextReview",e.target.value)} style={{...inp,marginBottom:0}}/>
  </>);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const validCount   = allAiders.filter(a=>certBadge(a.expiryDate).color==="#10b981").length;
  const expiringCount= allAiders.filter(a=>certBadge(a.expiryDate).color==="#f59e0b").length;
  const expiredCount = allAiders.filter(a=>certBadge(a.expiryDate).color==="#ef4444").length;
  const kitIssues    = kits.filter(k=>kitBadge(k.lastCheckDate).color==="#ef4444").length;
  const minPerShift  = assessment.minPerShift || 1;
  const coverageGaps = allZones.reduce((acc,z) => acc + (["Day Shift (08:30–16:00)","Late Shift (16:00–02:00)","Office Hours (08:30–17:30)"].filter(s=>coverageCount(z,s)<minPerShift).length),0);

  const SUBTABS = [
    { id:"aiders",     label:"First Aiders",      alert: expiredCount>0, warn: expiringCount>0, count: expiredCount||expiringCount||null },
    { id:"coverage",   label:"Coverage Matrix",   alert: coverageGaps>0, warn: false,           count: coverageGaps||null },
    { id:"kits",       label:"First Aid Kits",    alert: kitIssues>0,    warn: false,           count: kitIssues||null },
    { id:"assessment", label:"Needs Assessment",  alert: assessment.nextReview && assessment.nextReview<today, warn:false, count:null },
  ];

  return (
    <div style={{padding:"24px 0"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:20}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px",color:Z.white}}>First Aid Register</h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>First aiders, coverage matrix, kit inspections and needs assessment — Health and Safety (First Aid) Regulations 1981</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[
          { label:"Qualified First Aiders", value:allAiders.length, sub:`${validCount} valid · ${expiringCount} expiring · ${expiredCount} expired`, alert:expiredCount>0, warn:expiringCount>0 },
          { label:"Coverage Gaps", value:coverageGaps, sub:coverageGaps===0?"All shifts covered":"zone/shift combinations below minimum", alert:coverageGaps>0, warn:false },
          { label:"First Aid Kits", value:kits.length, sub:kitIssues>0?`${kitIssues} check overdue`:"All kits current", alert:kitIssues>0, warn:false },
          { label:"Needs Assessment", value:assessment.date||"Not recorded", sub:assessment.nextReview?`Next review: ${assessment.nextReview}`:"", alert:!!(assessment.nextReview&&assessment.nextReview<today), warn:false },
        ].map((c,i)=>(
          <div key={i} style={{background:c.alert?"rgba(239,68,68,0.08)":c.warn?"rgba(245,158,11,0.08)":Z.overlay,border:`1px solid ${c.alert?"rgba(239,68,68,0.3)":c.warn?"rgba(245,158,11,0.3)":Z.borderMd}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{c.label}</div>
            <div style={{fontSize:16,fontWeight:800,color:c.alert?"#f87171":c.warn?"#f59e0b":Z.white,marginBottom:2}}>{c.value}</div>
            {c.sub&&<div style={{fontSize:11,color:c.alert?"#f87171":c.warn?"#f59e0b":Z.muted}}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Sub-tab bar */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
        {SUBTABS.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{background:subTab===t.id?`linear-gradient(135deg,#ef4444,#dc2626)`:Z.overlay,border:`1px solid ${subTab===t.id?"#ef4444":Z.borderMd}`,borderRadius:10,padding:"8px 16px",color:subTab===t.id?"#fff":Z.muted,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:font,display:"flex",alignItems:"center",gap:6}}>
            {t.label}
            {(t.count||0)>0 && <span style={{background:"rgba(239,68,68,0.25)",color:"#f87171",borderRadius:6,padding:"1px 6px",fontSize:10,fontWeight:800}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── FIRST AIDERS ── */}
      {subTab==="aiders" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>Qualified First Aiders</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>Staff with First Aid certificates are automatically pulled from External Certificates. Add additional details or manual entries below.</div>
            </div>
            <button onClick={()=>openAdd("aider")} style={{background:`linear-gradient(135deg,#ef4444,#dc2626)`,border:"none",borderRadius:10,padding:"9px 18px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:font}}>+ Add First Aider</button>
          </div>
          {allAiders.length===0 && <div style={{color:Z.muted,fontSize:14,padding:"32px 0",textAlign:"center"}}>No first aiders recorded. Upload First Aid certificates in External Certificates or add manually.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {allAiders.sort((a,b)=>a.name.localeCompare(b.name)).map(a=>{
              const badge = certBadge(a.expiryDate);
              return (
                <div key={a.id} style={{background:Z.overlay,border:`1px solid ${badge.color==="#ef4444"?"rgba(239,68,68,0.3)":badge.color==="#f59e0b"?"rgba(245,158,11,0.25)":Z.borderMd}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:a.isLead?"rgba(245,158,11,0.15)":"rgba(239,68,68,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🩺</div>
                    <div style={{flex:1,minWidth:120}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{a.name}</div>
                        {a.isLead && <span style={{fontSize:10,fontWeight:800,color:"#f59e0b",background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,padding:"1px 7px"}}>LEAD</span>}
                        {a._fromCert && <span style={{fontSize:10,color:Z.muted,background:Z.overlay,border:`1px solid ${Z.border}`,borderRadius:6,padding:"1px 7px"}}>from cert</span>}
                      </div>
                      <div style={{fontSize:12,color:Z.muted,marginTop:1}}>{a.jobTitle||""}{a.phone?` · ${a.phone}`:""}</div>
                    </div>
                    <div style={{textAlign:"center",minWidth:90}}>
                      <div style={{fontSize:10,color:Z.muted,fontWeight:600,marginBottom:2}}>CERT TYPE</div>
                      <div style={{fontSize:11,color:Z.white,fontWeight:600}}>{a.certType||"FAW"}</div>
                    </div>
                    <div style={{textAlign:"center",minWidth:80}}>
                      <div style={{fontSize:10,color:Z.muted,fontWeight:600,marginBottom:2}}>EXPIRES</div>
                      <div style={{fontSize:13,fontWeight:700,color:badge.color}}>{a.expiryDate||"—"}</div>
                    </div>
                    <Badge label={badge.label} color={badge.color} bg={badge.bg}/>
                    {a.shifts?.length>0 && (
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {a.shifts.map(s=><span key={s} style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:"rgba(59,130,246,0.1)",color:"#93c5fd",border:"1px solid rgba(59,130,246,0.2)"}}>{s.split(" ")[0]}</span>)}
                      </div>
                    )}
                    {!a._fromCert && (
                      <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
                        <button onClick={()=>openEdit(a,"aider")} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 12px",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Edit</button>
                        <button onClick={()=>deleteItem(a.id,"aiders")} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"5px 12px",color:"#f87171",cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Delete</button>
                      </div>
                    )}
                    {a._fromCert && <div style={{fontSize:11,color:"#93c5fd",marginLeft:"auto"}}>Set zones/shifts in Training → Assign Training → External Certificates</div>}
                  </div>
                  {a.zones?.length>0 && (
                    <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${Z.border}`,display:"flex",gap:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:Z.muted,marginRight:4}}>Zones:</span>
                      {a.zones.map(z=><span key={z} style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:"rgba(16,185,129,0.08)",color:"#6ee7b7",border:"1px solid rgba(16,185,129,0.2)"}}>{z}</span>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── COVERAGE MATRIX ── */}
      {subTab==="coverage" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>Coverage Matrix</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>Shows how many valid first aiders cover each zone/shift. Minimum required: {minPerShift} per cell (set in Needs Assessment).</div>
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:Z.overlay}}>
                  <th style={{padding:"10px 14px",textAlign:"left",color:Z.muted,fontWeight:700,fontSize:11,letterSpacing:.7,textTransform:"uppercase",borderBottom:`1px solid ${Z.border}`}}>Zone / Area</th>
                  {["Day Shift","Late Shift","Office Hours"].map(s=>(
                    <th key={s} style={{padding:"10px 14px",textAlign:"center",color:Z.muted,fontWeight:700,fontSize:11,letterSpacing:.7,textTransform:"uppercase",borderBottom:`1px solid ${Z.border}`,whiteSpace:"nowrap"}}>{s}</th>
                  ))}
                  <th style={{padding:"10px 14px",borderBottom:`1px solid ${Z.border}`,width:40}}/>
                </tr>
              </thead>
              <tbody>
                {allZones.map((zone,i)=>{
                  const isCustom = customZones.includes(zone);
                  return (
                    <tr key={zone} style={{borderBottom:`1px solid ${Z.border}`,background:i%2===0?"transparent":Z.overlay}}>
                      <td style={{padding:"10px 14px",color:Z.white,fontWeight:600}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {zone}
                          {isCustom && <span style={{fontSize:9,fontWeight:700,color:Z.muted,background:Z.overlay,border:`1px solid ${Z.border}`,borderRadius:4,padding:"1px 5px",textTransform:"uppercase",letterSpacing:.5}}>custom</span>}
                        </div>
                      </td>
                      {["Day Shift (08:30–16:00)","Late Shift (16:00–02:00)","Office Hours (08:30–17:30)"].map(shift=>{
                        const count = coverageCount(zone,shift);
                        const alert = count < minPerShift;
                        const warn  = count === minPerShift;
                        const color = alert?"#ef4444":warn?"#f59e0b":"#10b981";
                        const bg    = alert?"rgba(239,68,68,0.1)":warn?"rgba(245,158,11,0.08)":"rgba(16,185,129,0.08)";
                        return (
                          <td key={shift} style={{padding:"10px 14px",textAlign:"center"}}>
                            <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:3,background:bg,border:`1px solid ${color}33`,borderRadius:10,padding:"8px 20px",minWidth:80}}>
                              <div style={{fontSize:22,fontWeight:900,color,lineHeight:1}}>{count}</div>
                              <div style={{fontSize:10,color,fontWeight:700}}>{alert?"Gap":warn?"Minimum":"Covered"}</div>
                            </div>
                          </td>
                        );
                      })}
                      <td style={{padding:"6px 8px",textAlign:"center"}}>
                        {isCustom && (
                          <button onClick={()=>removeZone(zone)}
                            style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,padding:"3px 8px",color:"#f87171",cursor:"pointer",fontSize:11,fontFamily:font,fontWeight:700}}>✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Add zone row */}
                <tr style={{borderBottom:`1px solid ${Z.border}`,background:Z.overlay}}>
                  <td colSpan={5} style={{padding:"10px 14px"}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <input
                        value={newZone}
                        onChange={e=>setNewZone(e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&addZone()}
                        placeholder="Add a custom zone or area…"
                        style={{flex:1,background:"transparent",border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 12px",color:Z.white,fontSize:12,outline:"none",fontFamily:font}}/>
                      <button onClick={addZone} disabled={!newZone.trim()||allZones.includes(newZone.trim())}
                        style={{background:`linear-gradient(135deg,#ef4444,#dc2626)`,border:"none",borderRadius:8,padding:"7px 16px",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:font,opacity:!newZone.trim()||allZones.includes(newZone.trim())?0.4:1,whiteSpace:"nowrap"}}>
                        + Add Zone
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{marginTop:14,display:"flex",gap:16,fontSize:12,color:Z.muted,flexWrap:"wrap"}}>
            <span><span style={{color:"#ef4444",fontWeight:700}}>●</span> Below minimum ({`<${minPerShift}`})</span>
            <span><span style={{color:"#f59e0b",fontWeight:700}}>●</span> Minimum met (={minPerShift})</span>
            <span><span style={{color:"#10b981",fontWeight:700}}>●</span> Good coverage ({`>${minPerShift}`})</span>
          </div>
          <div style={{marginTop:8,fontSize:11,color:Z.muted,background:Z.overlay,borderRadius:8,padding:"8px 12px",border:`1px solid ${Z.border}`}}>
            <strong style={{color:Z.white}}>Site shifts:</strong> Warehouse — Day (08:30–16:00) and Late (16:00–02:00). Office — Office Hours (08:30–17:30) only. First aiders tagged "All Shifts" count across all columns.
          </div>
        </div>
      )}

      {/* ── KITS ── */}
      {subTab==="kits" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>First Aid Kit Register</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>Monthly visual checks required. Record condition and any items restocked.</div>
            </div>
            <button onClick={()=>openAdd("kit")} style={{background:`linear-gradient(135deg,#ef4444,#dc2626)`,border:"none",borderRadius:10,padding:"9px 18px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:font}}>+ Add Kit</button>
          </div>
          {kits.length===0 && <div style={{color:Z.muted,fontSize:14,padding:"32px 0",textAlign:"center"}}>No kits recorded yet.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {kits.map(k=>{
              const badge = kitBadge(k.lastCheckDate);
              const COND_COLOR = {good:"#10b981",low:"#f59e0b",restock:"#ef4444"};
              const COND_LABEL = {good:"Fully stocked",low:"Low stock",restock:"Restock needed"};
              return (
                <div key={k.id} style={{background:Z.overlay,border:`1px solid ${badge.color==="#ef4444"?"rgba(239,68,68,0.3)":Z.borderMd}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(239,68,68,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🧰</div>
                    <div style={{flex:1,minWidth:120}}>
                      <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{k.location}</div>
                      <div style={{fontSize:12,color:Z.muted,marginTop:1}}>{k.kitType||"Standard Kit"}{k.kitRef?` · ${k.kitRef}`:""}</div>
                    </div>
                    <div style={{textAlign:"center",minWidth:90}}>
                      <div style={{fontSize:10,color:Z.muted,fontWeight:600,marginBottom:2}}>LAST CHECK</div>
                      <div style={{fontSize:12,color:Z.white,fontWeight:700}}>{k.lastCheckDate||"Never"}</div>
                      {k.checkedBy && <div style={{fontSize:10,color:Z.muted}}>{k.checkedBy}</div>}
                    </div>
                    {k.condition && <span style={{fontSize:11,fontWeight:700,color:COND_COLOR[k.condition]||"#10b981",background:`${COND_COLOR[k.condition]||"#10b981"}18`,border:`1px solid ${COND_COLOR[k.condition]||"#10b981"}33`,borderRadius:8,padding:"2px 9px"}}>{COND_LABEL[k.condition]||k.condition}</span>}
                    <Badge label={badge.label} color={badge.color} bg={badge.bg}/>
                    <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
                      <button onClick={()=>openEdit(k,"kit")} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 12px",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Edit</button>
                      <button onClick={()=>deleteItem(k.id,"kits")} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"5px 12px",color:"#f87171",cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Delete</button>
                    </div>
                  </div>
                  {k.notes && <div style={{fontSize:12,color:Z.muted,paddingTop:8,marginTop:8,borderTop:`1px solid ${Z.border}`}}>{k.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── NEEDS ASSESSMENT ── */}
      {subTab==="assessment" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>First Aid Needs Assessment</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>HSE requires employers to assess first aid needs before determining what provision is adequate. This record documents that assessment.</div>
            </div>
            <button onClick={()=>openAdd("assessment")} style={{background:`linear-gradient(135deg,#ef4444,#dc2626)`,border:"none",borderRadius:10,padding:"9px 18px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:font}}>
              {assessment.date ? "Update Assessment" : "Record Assessment"}
            </button>
          </div>
          {!assessment.date ? (
            <div style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:12,padding:32,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:8}}>📋</div>
              <div style={{fontWeight:700,color:Z.white,marginBottom:6}}>No needs assessment recorded</div>
              <div style={{fontSize:13,color:Z.muted,maxWidth:400,margin:"0 auto"}}>The HSE requires employers to carry out a needs assessment to determine what first aid provision is necessary. Record yours here.</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:12,padding:"20px 24px"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:16}}>
                  {[
                    {label:"Assessment Date",    value:assessment.date},
                    {label:"Conducted By",       value:assessment.conductedBy},
                    {label:"Risk Level",         value:{low:"Low risk",medium:"Medium risk",high:"High risk"}[assessment.riskLevel]||assessment.riskLevel},
                    {label:"Min. First Aiders",  value:`${assessment.minPerShift||1} per shift`},
                    {label:"Next Review Due",    value:assessment.nextReview||"Not set"},
                  ].map((f,i)=>(
                    <div key={i}>
                      <div style={{fontSize:10,color:Z.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>{f.label}</div>
                      <div style={{fontSize:14,fontWeight:700,color:Z.white}}>{f.value||"—"}</div>
                    </div>
                  ))}
                </div>
                {assessment.conclusions && (
                  <div style={{paddingTop:14,borderTop:`1px solid ${Z.border}`}}>
                    <div style={{fontSize:11,color:Z.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:6}}>Conclusions / Findings</div>
                    <div style={{fontSize:13,color:Z.white,lineHeight:1.6}}>{assessment.conclusions}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:`linear-gradient(135deg,${Z.navyDk||"#060d2e"},${Z.navyMd||"#0d1f5c"})`,border:`1px solid ${Z.borderMd}`,borderRadius:16,padding:28,width:"100%",maxWidth:540,maxHeight:"88vh",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <h3 style={{margin:0,fontSize:17,fontWeight:800,color:Z.white}}>
                {modalSection==="aider"?"Add First Aider":modalSection==="kit"?"Add First Aid Kit":"First Aid Needs Assessment"}
              </h3>
              <button onClick={()=>setShowModal(false)} style={{background:"none",border:"none",color:Z.muted,fontSize:20,cursor:"pointer",fontFamily:font}}>✕</button>
            </div>
            {formContent}
            <div style={{display:"flex",gap:10,marginTop:22}}>
              <button onClick={saveModal} style={{flex:1,background:`linear-gradient(135deg,#ef4444,#dc2626)`,border:"none",borderRadius:10,padding:11,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:font}}>
                {editId?"Save Changes":"Save Record"}
              </button>
              <button onClick={()=>setShowModal(false)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 20px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:600}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export { FirstAidRegisterTab };
