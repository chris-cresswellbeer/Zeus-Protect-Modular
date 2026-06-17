import { useWindowWidth } from "../../shared/hooks";
import { PERMIT_TYPES } from "../../data/seedPermits";
import { PermitForm } from "./PermitForm";

function PermitsTab({ permits, setPermits, dbSavePermit, dbDeletePermit, staff, contractors, T, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [view, setView] = React.useState("list"); // list | new | detail
  const [selected, setSelected] = React.useState(null);
  const [filterStatus, setFilterStatus] = React.useState("all");
  const [filterType, setFilterType] = React.useState("all");
  const now = new Date().toISOString();
  const today = now.slice(0,10);

  const selPermit = permits.find(p=>p.id===selected);

  function savePermit(p) {
    setPermits(prev=>{
      const exists=prev.findIndex(x=>x.id===p.id);
      if(exists>=0){ const n=[...prev]; n[exists]=p; return n; }
      return [...prev,p];
    });
    dbSavePermit(p);
    setView("list");
    setSelected(null);
  }

  function printPermit(p) {
    const pt=PERMIT_TYPES.find(x=>x.id===p.type)||PERMIT_TYPES[5];
    const hazardsList=Object.entries(p.hazards||{}).filter(([,v])=>v).map(([k])=>`<li>${k}</li>`).join("");
    const precsList=Object.entries(p.precautions||{}).filter(([,v])=>v).map(([k])=>`<li>${k}</li>`).join("");
    const ppe=(p.ppe||[]).join(", ")||"None specified";
    const html=`<!DOCTYPE html><html><head><title>Permit to Work — ${p.id}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:28px;font-size:12px;color:#1e293b}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #0d1f5c}
    h1{font-size:18px;font-weight:900;color:#0d1f5c;margin-bottom:3px}.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${pt.color}22;color:${pt.color};border:1px solid ${pt.color}}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.cell{background:#f8fafc;border-radius:8px;padding:10px 14px;border:1px solid #e2e8f0}
    .cell .label{font-size:9px;font-weight:700;letter-spacing:.5px;color:#94a3b8;text-transform:uppercase;margin-bottom:3px}.cell .value{font-size:13px;font-weight:600;color:#0d1f5c}
    h2{font-size:11px;font-weight:700;color:#0d1f5c;margin:14px 0 8px;text-transform:uppercase;letter-spacing:.5px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
    ul{padding-left:18px;color:#334155;line-height:1.8}
    .sig-box{border:2px solid #0d1f5c;border-radius:8px;padding:16px;margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .sig-line{border-top:1px solid #0d1f5c;padding-top:6px;font-size:10px;color:#64748b;margin-top:32px}
    @media print{@page{margin:12mm;size:A4}}
    </style></head><body>
    <div class="header">
      <div><h1>${pt.icon} Permit to Work — ${pt.label}</h1><p style="color:#64748b;margin-top:4px">Zeus Protect Health &amp; Safety · ${p.id}</p></div>
      <div><div class="badge">${p.status.toUpperCase()}</div><div style="font-size:11px;color:#94a3b8;margin-top:6px;text-align:right">Issued: ${p.startDateTime?.replace("T"," ")||"—"}</div></div>
    </div>
    <div class="grid">
      <div class="cell"><div class="label">Location</div><div class="value">${p.location}</div></div>
      <div class="cell"><div class="label">Valid Period</div><div class="value">${p.startDateTime?.replace("T"," ")||"—"} → ${p.endDateTime?.replace("T"," ")||"—"}</div></div>
      <div class="cell" style="grid-column:1/-1"><div class="label">Description of Work</div><div class="value">${p.description}</div></div>
      <div class="cell"><div class="label">Contractor</div><div class="value">${p.contractor||"Internal"}</div></div>
      <div class="cell"><div class="label">Authorised By</div><div class="value">${p.authorisedBy||"—"}</div></div>
    </div>
    <h2>Hazards Identified</h2>${hazardsList?`<ul>${hazardsList}</ul>`:"<p>None recorded</p>"}
    <h2>Precautions in Place</h2>${precsList?`<ul>${precsList}</ul>`:"<p>None recorded</p>"}
    <h2>PPE Required</h2><p>${ppe}</p>
    ${p.additionalControls?`<h2>Additional Controls</h2><p>${p.additionalControls}</p>`:""}
    <div class="sig-box">
      <div><div style="font-size:11px;font-weight:700;color:#0d1f5c;margin-bottom:12px">AUTHORISING SIGNATURE</div><div class="sig-line">Signature</div><div class="sig-line">Name: ${p.authorisedBy||""}</div><div class="sig-line">Date/Time:</div></div>
      <div><div style="font-size:11px;font-weight:700;color:#0d1f5c;margin-bottom:12px">WORKER ACKNOWLEDGEMENT</div><div class="sig-line">Signature</div><div class="sig-line">Name:</div><div class="sig-line">Date/Time:</div></div>
    </div>
    <script>window.onload=()=>window.print()<\/script></body></html>`;
    const w=window.open("","_blank","width=800,height=700");
    w.document.write(html);
    w.document.close();
  }

  const filtered = permits.filter(p=>{
    if(filterStatus!=="all"&&p.status!==filterStatus) return false;
    if(filterType!=="all"&&p.type!==filterType) return false;
    return true;
  }).sort((a,b)=>b.createdAt?.localeCompare(a.createdAt||"")||0);

  const getStatusStyle = s=>{
    if(s==="active") return {color:"#10b981",bg:"rgba(16,185,129,0.12)",border:"rgba(16,185,129,0.3)"};
    if(s==="draft") return {color:"#f59e0b",bg:"rgba(245,158,11,0.1)",border:"rgba(245,158,11,0.3)"};
    if(s==="closed") return {color:"#64748b",bg:"rgba(100,116,139,0.1)",border:"rgba(100,116,139,0.3)"};
    if(s==="cancelled") return {color:"#f87171",bg:"rgba(239,68,68,0.1)",border:"rgba(239,68,68,0.3)"};
    return {color:T.muted,bg:T.overlay,border:T.borderMd};
  };

  const isExpired = p=>p.status==="active"&&p.endDateTime<now;

  if(view==="new"||(view==="edit"&&selPermit)) {
    return <PermitForm existing={view==="edit"?selPermit:null} staff={staff} contractors={contractors}
      onSave={p=>{savePermit(p);setView("list");}}
      onCancel={()=>setView("list")} T={T} font={font}/>;
  }

  return (
    <div>
      {/* Live board */}
      {(()=>{
        const active=permits.filter(p=>p.status==="active"&&p.startDateTime<=now&&p.endDateTime>=now);
        const expired=permits.filter(p=>p.status==="active"&&p.endDateTime<now);
        if(!active.length&&!expired.length) return null;
        return (
          <div style={{background:`linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))`,borderRadius:16,padding:20,marginBottom:20,border:"1px solid rgba(16,185,129,0.25)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 0 3px rgba(16,185,129,0.25)",animation:"pulse 2s infinite",flexShrink:0}}/>
              <h3 style={{margin:0,fontSize:15,fontWeight:800,color:T.white}}>Active Permits</h3>
              <span style={{fontSize:12,color:"#10b981",fontWeight:600}}>{active.length} active{expired.length>0?` · ${expired.length} expired unclosed`:""}</span>
            </div>
            {expired.length>0 && (
              <div style={{marginBottom:12,padding:"8px 14px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,fontSize:12,color:"#f87171",fontWeight:600}}>
                ⚠ {expired.length} permit{expired.length!==1?"s":""} have passed their end time — please close or extend them.
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
              {[...expired,...active].map((p,i)=>{
                const pt=PERMIT_TYPES.find(x=>x.id===p.type)||PERMIT_TYPES[5];
                const exp=isExpired(p);
                return (
                  <div key={p.id} style={{background:exp?"rgba(239,68,68,0.08)":"rgba(16,185,129,0.06)",borderRadius:12,padding:"12px 14px",border:`1px solid ${exp?"rgba(239,68,68,0.25)":"rgba(16,185,129,0.2)"}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontSize:20}}>{pt.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pt.label}</div>
                        <div style={{fontSize:10,color:exp?"#f87171":"#34d399"}}>{exp?"⚠ Expired":p.endDateTime?.replace("T"," ")}</div>
                      </div>
                    </div>
                    <div style={{fontSize:11,color:T.muted,marginBottom:3}}>📍 {p.location}</div>
                    {p.authorisedBy&&<div style={{fontSize:11,color:T.muted}}>✍ {p.authorisedBy}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Permit to Work Register</h2>
          <p style={{color:T.muted,fontSize:13,margin:0}}>{permits.length} permit{permits.length!==1?"s":""} · {permits.filter(p=>p.status==="active").length} active</p>
        </div>
        <button onClick={()=>setView("new")} style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,boxShadow:`0 4px 14px ${T.accent}44`}}>+ New Permit</button>
      </div>

      {/* Filters */}
      <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",border:`1px solid ${T.border}`}}>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"8px 12px",color:T.white,fontSize:12,outline:"none",fontFamily:font,cursor:"pointer"}}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"8px 12px",color:T.white,fontSize:12,outline:"none",fontFamily:font,cursor:"pointer"}}>
          <option value="all">All Types</option>
          {PERMIT_TYPES.map(pt=><option key={pt.id} value={pt.id}>{pt.icon} {pt.label}</option>)}
        </select>
        <span style={{color:T.muted,fontSize:12,marginLeft:"auto"}}>{filtered.length} of {permits.length}</span>
      </div>

      {/* Permit list */}
      <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
        {!isMobile && (
          <div style={{display:"grid",gridTemplateColumns:"auto 2fr 1.5fr 1fr 1fr 1fr 120px",padding:"10px 20px",background:T.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase",gap:12}}>
            <span>Type</span><span>Description</span><span>Location</span><span>Status</span><span>Start</span><span>End</span><span></span>
          </div>
        )}
        {filtered.length===0 && <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14}}>No permits found. Click <strong>+ New Permit</strong> to create one.</div>}
        {filtered.map((p,i)=>{
          const pt=PERMIT_TYPES.find(x=>x.id===p.type)||PERMIT_TYPES[5];
          const ss=getStatusStyle(p.status);
          const exp=isExpired(p);
          return isMobile ? (
            <div key={p.id} style={{padding:"14px 16px",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{fontSize:22}}>{pt.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.white}}>{pt.label}</div>
                  <div style={{fontSize:11,color:T.muted}}>{p.location}</div>
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:ss.bg,color:ss.color,border:`1px solid ${ss.border}`,textTransform:"capitalize"}}>{exp?"⚠ Expired":p.status}</span>
              </div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8}}>{p.description?.slice(0,80)}{p.description?.length>80?"…":""}</div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setSelected(p.id);setView("edit");}} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11}}>Edit</button>
                <button onClick={()=>printPermit(p)} style={{background:"rgba(16,185,129,0.1)",color:T.green,border:"1px solid rgba(16,185,129,0.25)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11}}>🖨 Print</button>
              </div>
            </div>
          ) : (
            <div key={p.id} style={{display:"grid",gridTemplateColumns:"auto 2fr 1.5fr 1fr 1fr 1fr 140px",padding:"14px 20px",borderTop:i>0?`1px solid ${T.border}`:"none",alignItems:"center",gap:8,background:exp?"rgba(239,68,68,0.03)":"transparent"}}>
              <span style={{fontSize:22}}>{pt.icon}</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:T.white,marginBottom:2}}>{pt.label}</div>
                <div style={{fontSize:11,color:T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:280}}>{p.description}</div>
              </div>
              <span style={{fontSize:12,color:T.muted}}>{p.location}</span>
              <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:ss.bg,color:exp?"#f87171":ss.color,border:`1px solid ${exp?"rgba(239,68,68,0.3)":ss.border}`,textTransform:"capitalize",display:"inline-block",whiteSpace:"nowrap"}}>{exp?"⚠ Expired":p.status}</span>
              <span style={{fontSize:11,color:T.muted}}>{p.startDateTime?.replace("T"," ").slice(0,16)||"—"}</span>
              <span style={{fontSize:11,color:exp?"#f87171":T.muted}}>{p.endDateTime?.replace("T"," ").slice(0,16)||"—"}</span>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                <button onClick={()=>{setSelected(p.id);setView("edit");}} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11}}>✏</button>
                <button onClick={()=>printPermit(p)} style={{background:"rgba(16,185,129,0.1)",color:T.green,border:"1px solid rgba(16,185,129,0.25)",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11}}>🖨</button>
                {p.status==="active"&&<button onClick={()=>{const u={...p,status:"closed",closedAt:new Date().toISOString()};setPermits(prev=>prev.map(x=>x.id===p.id?u:x));dbSavePermit(u);}} style={{background:"rgba(100,116,139,0.1)",color:"#94a3b8",border:"1px solid rgba(100,116,139,0.25)",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:10}}>Close</button>}
                {p.status==="draft"&&<button onClick={()=>{const u={...p,status:"active"};setPermits(prev=>prev.map(x=>x.id===p.id?u:x));dbSavePermit(u);}} style={{background:"rgba(16,185,129,0.1)",color:T.green,border:"1px solid rgba(16,185,129,0.25)",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:10}}>Issue</button>}
                <button onClick={()=>{if(window.confirm("Delete this permit?")){{setPermits(prev=>prev.filter(x=>x.id!==p.id));dbDeletePermit(p.id);}}}} style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.15)",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11}}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PermitsTab };
