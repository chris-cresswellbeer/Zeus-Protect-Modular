import React from "react";
import { useWindowWidth } from "../../shared/hooks";
import { SectionHeader } from "../../shared/SectionHeader";
import { INCIDENT_TYPES, ACCIDENT_CODES, NUMBER_CODES, INJURY_TYPES } from "../../data/seedIncidents";

function IncidentForm({ form, setF, err, saved, onSubmit, onCancel, isEdit, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const selStyle = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 14px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer",boxSizing:"border-box"};
  const inputStyle = {...selStyle,cursor:"text"};
  const labelStyle = {color:Z.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6};
  // Inject placeholder colour that matches the theme muted colour
  const placeholderStyle = `
    .zeus-incident-form input::placeholder,
    .zeus-incident-form textarea::placeholder { color: ${Z.muted}; opacity: 1; }
    .zeus-incident-form select option { background: ${Z.navyMd}; color: ${Z.white}; }
  `;

  return (
    <div className="zeus-incident-form" style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:28,marginBottom:24,border:`1px solid rgba(239,68,68,0.25)`}}>
      <style>{placeholderStyle}</style>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <h3 style={{margin:0,fontSize:14,fontWeight:800,letterSpacing:.5,color:"#f87171",textTransform:"uppercase"}}>
          {isEdit ? E("✏ ","")+"Edit Incident Report" : "New Incident Report"}
        </h3>
        <button onClick={onCancel} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 12px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>✕ Cancel</button>
      </div>
      <p style={{margin:"0 0 20px",fontSize:12,color:Z.muted}}>Complete all sections as fully as possible — the more detail provided the better the investigation</p>

      <SectionHeader icon="📋" label="Incident Details" Z={Z}/>
      <div style={{marginBottom:16}}>
        <label style={labelStyle}>INCIDENT TYPE *</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {INCIDENT_TYPES.map(t=>(
            <button key={t.id} onClick={()=>setF("type",t.id)}
              style={{display:"flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:10,
                border:`2px solid ${form.type===t.id?t.color:Z.borderMd}`,
                background:form.type===t.id?t.bg:Z.overlay,
                color:form.type===t.id?t.color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:form.type===t.id?700:400,fontSize:13,transition:"all .2s"}}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:14}}>
        <div><label style={labelStyle}>DATE OF INCIDENT *</label><input type="date" value={form.date} onChange={e=>setF("date",e.target.value)} style={inputStyle}/></div>
        <div><label style={labelStyle}>TIME OF INCIDENT</label><input type="time" value={form.time} onChange={e=>setF("time",e.target.value)} style={inputStyle}/></div>
        <div><label style={labelStyle}>LOCATION *</label><input value={form.location} onChange={e=>setF("location",e.target.value)} placeholder="e.g. Warehouse Bay 3" style={inputStyle}/></div>
      </div>

      <div style={{marginBottom:14}}>
        <label style={labelStyle}>DESCRIPTION OF INCIDENT *</label>
        <textarea value={form.description} onChange={e=>setF("description",e.target.value)}
          placeholder="Describe exactly what happened — sequence of events, conditions at the time, and any contributing factors..."
          rows={4} style={{...inputStyle,resize:"vertical",lineHeight:1.6}}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
        <div>
          <label style={labelStyle}>ACCIDENT CODE *</label>
          <select value={form.accidentCode} onChange={e=>setF("accidentCode",e.target.value)} style={selStyle}>
            <option value="">— Select Code —</option>
            {ACCIDENT_CODES.map(c=><option key={c.code} value={c.code}>{c.code} — {c.desc}</option>)}
          </select>
          {form.accidentCode && <div style={{marginTop:5,fontSize:11,color:Z.muted,padding:"5px 10px",background:"rgba(37,99,235,0.08)",borderRadius:8,border:"1px solid rgba(37,99,235,0.15)"}}>{ACCIDENT_CODES.find(c=>c.code===form.accidentCode)?.desc}</div>}
        </div>
        <div>
          <label style={labelStyle}>NUMBER CODE *</label>
          <select value={form.numberCode} onChange={e=>setF("numberCode",e.target.value)} style={selStyle}>
            <option value="">— Select Number —</option>
            {NUMBER_CODES.map(c=><option key={c.num} value={c.num}>{c.num} — {c.desc}</option>)}
          </select>
          {form.numberCode && <div style={{marginTop:5,fontSize:11,color:Z.muted,padding:"5px 10px",background:"rgba(37,99,235,0.08)",borderRadius:8,border:"1px solid rgba(37,99,235,0.15)"}}>{NUMBER_CODES.find(c=>c.num===parseInt(form.numberCode))?.desc}</div>}
        </div>
      </div>

      <div style={{marginBottom:6}}>
        <label style={labelStyle}>INJURY TYPE</label>
        <select value={form.injuryType} onChange={e=>setF("injuryType",e.target.value)} style={selStyle}>
          {INJURY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <SectionHeader icon="👤" label="Person Involved" Z={Z}/>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
        <div><label style={labelStyle}>FULL NAME</label><input value={form.personName} onChange={e=>setF("personName",e.target.value)} placeholder="e.g. John Smith" style={inputStyle}/></div>
        <div><label style={labelStyle}>DATE OF BIRTH</label><input type="date" value={form.personDob} onChange={e=>setF("personDob",e.target.value)} style={inputStyle}/></div>
        <div><label style={labelStyle}>HOME ADDRESS</label><input value={form.personAddress} onChange={e=>setF("personAddress",e.target.value)} placeholder="e.g. 12 Oak Street, Dublin" style={inputStyle}/></div>
        <div><label style={labelStyle}>EIRCODE / POSTCODE</label><input value={form.personPostcode} onChange={e=>setF("personPostcode",e.target.value)} placeholder="e.g. D01 AB12" style={inputStyle}/></div>
      </div>

      <SectionHeader icon="👁" label="Witness Details" Z={Z}/>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
        <div><label style={labelStyle}>WITNESS 1 — NAME</label><input value={form.witness1Name} onChange={e=>setF("witness1Name",e.target.value)} placeholder="Full name" style={inputStyle}/></div>
        <div><label style={labelStyle}>WITNESS 1 — CONTACT / DEPT</label><input value={form.witness1Contact} onChange={e=>setF("witness1Contact",e.target.value)} placeholder="e.g. Ext 204 / Warehouse" style={inputStyle}/></div>
        <div><label style={labelStyle}>WITNESS 2 — NAME</label><input value={form.witness2Name} onChange={e=>setF("witness2Name",e.target.value)} placeholder="Full name" style={inputStyle}/></div>
        <div><label style={labelStyle}>WITNESS 2 — CONTACT / DEPT</label><input value={form.witness2Contact} onChange={e=>setF("witness2Contact",e.target.value)} placeholder="e.g. Ext 301 / Logistics" style={inputStyle}/></div>
      </div>

      <SectionHeader icon="🩹" label="First Aid" Z={Z}/>
      <div style={{marginBottom:14}}>
        <label style={labelStyle}>FIRST AID PROVIDED?</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["No","Yes — on site","Yes — called 999 / 112"].map(opt=>(
            <button key={opt} onClick={()=>setF("firstAidProvided",opt)}
              style={{padding:"8px 16px",borderRadius:10,border:`2px solid ${form.firstAidProvided===opt?"#10b981":Z.borderMd}`,
                background:form.firstAidProvided===opt?"rgba(16,185,129,0.12)":Z.overlay,
                color:form.firstAidProvided===opt?"#10b981":Z.muted,cursor:"pointer",fontFamily:font,fontWeight:form.firstAidProvided===opt?700:400,fontSize:12,transition:"all .2s"}}>
              {opt}
            </button>
          ))}
        </div>
      </div>
      {form.firstAidProvided!=="No" && (
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:14,marginBottom:14}}>
          <div><label style={labelStyle}>FIRST AID TREATMENT GIVEN</label><textarea value={form.firstAidDetails} onChange={e=>setF("firstAidDetails",e.target.value)} placeholder="Describe treatment given..." rows={2} style={{...inputStyle,resize:"vertical",lineHeight:1.6}}/></div>
          <div><label style={labelStyle}>FIRST AIDER NAME</label><input value={form.firstAidBy} onChange={e=>setF("firstAidBy",e.target.value)} placeholder="Name of first aider" style={inputStyle}/></div>
        </div>
      )}

      <SectionHeader icon="🏥" label="Post-Incident — Where Did the Person Go?" Z={Z}/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {["Returned to work","Sent home","Taken to hospital","GP referral","Ambulance called","Other"].map(opt=>(
          <button key={opt} onClick={()=>setF("postIncidentOutcome",opt)}
            style={{padding:"8px 16px",borderRadius:10,border:`2px solid ${form.postIncidentOutcome===opt?"#8b5cf6":Z.borderMd}`,
              background:form.postIncidentOutcome===opt?"rgba(139,92,246,0.12)":Z.overlay,
              color:form.postIncidentOutcome===opt?"#c4b5fd":Z.muted,cursor:"pointer",fontFamily:font,fontWeight:form.postIncidentOutcome===opt?700:400,fontSize:12,transition:"all .2s"}}>
            {opt}
          </button>
        ))}
      </div>

      <SectionHeader icon="🔧" label="Corrective & Preventive Actions" Z={Z}/>
      <div style={{marginBottom:14}}>
        <label style={labelStyle}>IMMEDIATE CORRECTIVE MEASURES TAKEN</label>
        <textarea value={form.immediateMeasures} onChange={e=>setF("immediateMeasures",e.target.value)}
          placeholder="Describe any immediate steps taken to address the hazard..." rows={3} style={{...inputStyle,resize:"vertical",lineHeight:1.6}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:14,marginBottom:14}}>
        <div><label style={labelStyle}>CORRECTIVE ACTIONS TO PREVENT RECURRENCE</label><textarea value={form.correctiveActions} onChange={e=>setF("correctiveActions",e.target.value)} placeholder="Longer-term actions planned or implemented..." rows={3} style={{...inputStyle,resize:"vertical",lineHeight:1.6}}/></div>
        <div><label style={labelStyle}>ACTIONED BY</label><input value={form.correctiveActionsBy} onChange={e=>setF("correctiveActionsBy",e.target.value)} placeholder="Name / role" style={inputStyle}/></div>
      </div>

      <SectionHeader icon="⚙️" label="Equipment Involvement" Z={Z}/>
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"13px 18px",background:"rgba(245,158,11,0.06)",borderRadius:12,border:`1px solid ${form.equipmentInvolved?"rgba(245,158,11,0.35)":Z.border}`}}>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:2}}>⚙️ Was equipment involved in this incident?</div>
            <div style={{fontSize:12,color:Z.muted}}>Select yes if any item from the equipment register was involved</div>
          </div>
          <button onClick={()=>setF("equipmentInvolved",!form.equipmentInvolved)}
            style={{flexShrink:0,padding:"8px 18px",borderRadius:10,border:`2px solid ${form.equipmentInvolved?"#f59e0b":Z.borderMd}`,
              background:form.equipmentInvolved?"rgba(245,158,11,0.15)":Z.overlay,
              color:form.equipmentInvolved?"#f59e0b":Z.muted,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,transition:"all .2s"}}>
            {form.equipmentInvolved?"✓ Yes — Equipment Involved":"No"}
          </button>
        </div>
      </div>

      {form.equipmentInvolved && (
        <div style={{background:"rgba(245,158,11,0.06)",borderRadius:12,border:"1px solid rgba(245,158,11,0.2)",padding:"18px 20px",marginBottom:14}}>
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>SELECT EQUIPMENT FROM REGISTER *</label>
            <select value={form.equipmentId||""} onChange={e=>setF("equipmentId",e.target.value)} style={selStyle}>
              <option value="">— Select equipment —</option>
              {(form._equipmentList||[]).map(eq=>(
                <option key={eq.id} value={eq.id}>{eq.assetNo} — {eq.name} ({eq.location}){eq.status==="inactive"?" [OUT OF SERVICE]":""}</option>
              ))}
            </select>
          </div>

          {form.equipmentId && (<>
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 16px",background:"rgba(239,68,68,0.07)",borderRadius:10,border:`1px solid ${form.equipmentDamaged?"rgba(239,68,68,0.35)":Z.border}`}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:2}}>🔴 Was the equipment damaged?</div>
                  <div style={{fontSize:12,color:Z.muted}}>This will log a defect on the equipment record</div>
                </div>
                <button onClick={()=>setF("equipmentDamaged",!form.equipmentDamaged)}
                  style={{flexShrink:0,padding:"8px 18px",borderRadius:10,border:`2px solid ${form.equipmentDamaged?"#ef4444":Z.borderMd}`,
                    background:form.equipmentDamaged?"rgba(239,68,68,0.15)":Z.overlay,
                    color:form.equipmentDamaged?"#f87171":Z.muted,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,transition:"all .2s"}}>
                  {form.equipmentDamaged?"✓ Yes — Damaged":"No Damage"}
                </button>
              </div>
            </div>

            {form.equipmentDamaged && (
              <div style={{marginBottom:14}}>
                <label style={labelStyle}>DAMAGE DESCRIPTION *</label>
                <textarea value={form.equipmentDamageDesc||""} onChange={e=>setF("equipmentDamageDesc",e.target.value)}
                  placeholder="Describe the damage observed..." rows={3} style={{...inputStyle,resize:"vertical",lineHeight:1.6}}/>
                <div style={{marginTop:8,display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["low","medium","high","critical"].map(sev=>(
                    <button key={sev} onClick={()=>setF("equipmentDamageSeverity",sev)}
                      style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${form.equipmentDamageSeverity===sev?"#f59e0b":Z.borderMd}`,
                        background:form.equipmentDamageSeverity===sev?"rgba(245,158,11,0.15)":Z.overlay,
                        color:form.equipmentDamageSeverity===sev?"#f59e0b":Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:form.equipmentDamageSeverity===sev?700:400,textTransform:"capitalize"}}>
                      {sev}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{padding:"12px 16px",background:"rgba(239,68,68,0.07)",borderRadius:10,border:`1px solid ${form.equipmentOOS?"rgba(239,68,68,0.45)":"rgba(239,68,68,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:form.equipmentOOS?"#f87171":Z.white,marginBottom:2}}>🚫 Take equipment out of service pending review?</div>
                <div style={{fontSize:12,color:Z.muted}}>This will set the equipment to inactive in the equipment register immediately</div>
              </div>
              <button onClick={()=>setF("equipmentOOS",!form.equipmentOOS)}
                style={{flexShrink:0,padding:"8px 18px",borderRadius:10,border:`2px solid ${form.equipmentOOS?"#ef4444":Z.borderMd}`,
                  background:form.equipmentOOS?"rgba(239,68,68,0.2)":Z.overlay,
                  color:form.equipmentOOS?"#f87171":Z.muted,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,transition:"all .2s"}}>
                {form.equipmentOOS?"✓ Out of Service":"Keep In Service"}
              </button>
            </div>
          </>)}
        </div>
      )}

      <div style={{marginBottom:20,padding:"14px 18px",background:"rgba(239,68,68,0.06)",borderRadius:12,border:"1px solid rgba(239,68,68,0.18)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:3}}>🏥 RIDDOR Reportable</div>
            <div style={{fontSize:12,color:Z.muted}}>Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013</div>
          </div>
          <button onClick={()=>setF("riddor",!form.riddor)}
            style={{flexShrink:0,padding:"8px 18px",borderRadius:10,border:`2px solid ${form.riddor?"#ef4444":Z.borderMd}`,
              background:form.riddor?"rgba(239,68,68,0.2)":Z.overlay,
              color:form.riddor?"#f87171":Z.muted,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,transition:"all .2s"}}>
            {form.riddor?"✓ Yes — RIDDOR":"No — Not RIDDOR"}
          </button>
        </div>
      </div>

      {/* Photo / file attachments */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:10,textTransform:"uppercase"}}>📎 Evidence Photos & Files</div>
        {(form.photos||[]).length > 0 && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10,marginBottom:12}}>
            {(form.photos||[]).map((p,i)=>(
              <div key={i} style={{position:"relative",borderRadius:10,overflow:"hidden",border:`1px solid ${Z.borderMd}`,background:Z.overlay}}>
                {p.type&&p.type.startsWith("image/")
                  ? <img src={p.data||p.url} alt={p.name} style={{width:"100%",height:80,objectFit:"cover",display:"block"}}/>
                  : <div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>📄</div>
                }
                <div style={{padding:"4px 6px",fontSize:10,color:Z.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                <button onClick={()=>setF("photos",(form.photos||[]).filter((_,j)=>j!==i))}
                  style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:11,lineHeight:"20px",padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            ))}
          </div>
        )}
        <label style={{display:"inline-flex",alignItems:"center",gap:8,background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700,color:Z.muted}}>
          📎 Add Photos / Files
          <input type="file" accept={ACCEPT_IMG_DOCS} multiple style={{display:"none"}}
            onChange={e=>{
              Array.from(e.target.files).forEach(file=>{
                const reader=new FileReader();
                reader.onload=ev=>setF("photos",[...(form.photos||[]),{name:file.name,type:file.type,data:ev.target.result}]);
                reader.readAsDataURL(file);
              });
              e.target.value="";
            }}/>
        </label>
      </div>

      {err && <div style={{marginBottom:14,padding:"10px 14px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,color:"#f87171",fontSize:13,fontWeight:600}}>⚠ {err}</div>}
      {saved && <div style={{marginBottom:14,padding:"10px 14px",background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,color:"#10b981",fontSize:13,fontWeight:600}}>✓ {isEdit?"Changes saved successfully":"Incident report submitted successfully"}</div>}

      <button onClick={onSubmit}
        style={{background:`linear-gradient(135deg,#ef4444,#b91c1c)`,color:"#fff",border:"none",borderRadius:10,padding:"12px 32px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:14,boxShadow:"0 4px 16px rgba(239,68,68,0.35)"}}>
        {isEdit ? "💾 Save Changes" : "Submit Report →"}
      </button>
    </div>
  );
}

export { IncidentForm };
