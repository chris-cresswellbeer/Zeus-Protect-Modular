import React from "react";
import { useWindowWidth } from "../../shared/hooks";
import { Avatar } from "../../shared/primitives";
import { ContractorDetail } from "./ContractorDetail";
import { CompanyForm } from "./CompanyForm";

function ContractorsTab({ contractors, setContractors, contractorInductions, setContractorInductions, contractorCerts, setContractorCerts, contractorVisits, setContractorVisits, dbSaveContractor, dbDeleteContractor, dbSaveContractorInductions, dbSaveContractorCerts, dbSaveContractorVisits, staff, T, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [view, setView] = React.useState("list");
  const [selected, setSelected] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const today = new Date().toISOString().slice(0,10);

  const selCon = contractors.find(c=>c.id===selected);
  const filtered = contractors.filter(c=>{
    if (filterStatus!=="all"&&c.status!==filterStatus) return false;
    if (search) { const q=search.toLowerCase(); if(!c.name.toLowerCase().includes(q)) return false; }
    return true;
  });

  if (view==="detail"&&selCon) {
    return <ContractorDetail selCon={selCon} contractorInductions={contractorInductions} setContractorInductions={setContractorInductions} contractorCerts={contractorCerts} setContractorCerts={setContractorCerts} contractorVisits={contractorVisits} setContractorVisits={setContractorVisits} contractors={contractors} setContractors={setContractors} dbSaveContractor={dbSaveContractor} dbDeleteContractor={dbDeleteContractor} dbSaveContractorInductions={dbSaveContractorInductions} dbSaveContractorCerts={dbSaveContractorCerts} dbSaveContractorVisits={dbSaveContractorVisits} staff={staff} isMobile={isMobile} setView={setView} T={T} font={font}/>;
  }

  return (
    <div>
      {/* On Site Now Board */}
      {(() => {
        const onSiteNow = [];
        contractors.forEach(c=>{
          const todayVisits = (contractorVisits[c.id]||[]).filter(v=>v.date===today);
          todayVisits.forEach(v=>{
            if (v.workers&&v.workers.length>0) {
              v.workers.forEach(wid=>{
                const w=(c.workers||[]).find(x=>x.id===wid);
                if (w) onSiteNow.push({company:c,worker:w,visit:v,signedOut:!!(v.timeOut&&v.timeOut<new Date().toTimeString().slice(0,5))});
              });
            } else {
              // Visit logged but no specific workers — show the company
              onSiteNow.push({company:c,worker:null,visit:v,signedOut:!!(v.timeOut&&v.timeOut<new Date().toTimeString().slice(0,5))});
            }
          });
        });
        const active = onSiteNow.filter(x=>!x.signedOut);
        const signedOut = onSiteNow.filter(x=>x.signedOut);
        if (onSiteNow.length===0) return null;
        return (
          <div style={{background:active.length>0?`linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05))`:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:20,marginBottom:20,border:`1px solid ${active.length>0?"rgba(16,185,129,0.3)":T.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:active.length>0?"#10b981":"#64748b",boxShadow:active.length>0?"0 0 0 3px rgba(16,185,129,0.25)":"none",animation:active.length>0?"pulse 2s infinite":"none",flexShrink:0}}/>
              <h3 style={{margin:0,fontSize:15,fontWeight:800,color:T.white}}>On Site Right Now</h3>
              <span style={{fontSize:12,color:active.length>0?"#10b981":T.muted,fontWeight:600}}>{active.length} active · {signedOut.length} signed out</span>
              <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,0.25)}50%{box-shadow:0 0 0 6px rgba(16,185,129,0.1)}}`}</style>
            </div>
            {active.length>0 && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:signedOut.length>0?16:0}}>
                {active.map((entry,i)=>(
                  <div key={i} style={{background:"rgba(16,185,129,0.08)",borderRadius:12,padding:"12px 14px",border:"1px solid rgba(16,185,129,0.25)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      {entry.worker ? <Avatar name={entry.worker.name} size={28}/> : <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${T.accent},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🏢</div>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{entry.worker?entry.worker.name:entry.company.name}</div>
                        <div style={{fontSize:10,color:"#34d399"}}>{entry.worker?entry.company.name:entry.visit.purpose}</div>
                      </div>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#10b981",flexShrink:0}}/>
                    </div>
                    {entry.worker && <div style={{fontSize:11,color:T.muted,marginBottom:3}}>{entry.worker.role||entry.company.type}</div>}
                    <div style={{fontSize:11,color:T.muted}}>{entry.visit.timeIn?`In: ${entry.visit.timeIn}`:""}{entry.visit.areas?` · ${entry.visit.areas}`:""}</div>
                    {entry.visit.purpose && entry.worker && <div style={{fontSize:11,color:T.muted,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{entry.visit.purpose}</div>}
                    {entry.visit.permitRequired && <div style={{marginTop:5,fontSize:10,fontWeight:700,color:"#f59e0b"}}>⚠ Permit to Work active</div>}
                  </div>
                ))}
              </div>
            )}
            {signedOut.length>0 && (
              <div>
                <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Signed Out Today</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {signedOut.map((entry,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 12px",borderRadius:20,background:T.overlay,border:`1px solid ${T.border}`}}>
                      {entry.worker ? <Avatar name={entry.worker.name} size={18}/> : <span style={{fontSize:12}}>🏢</span>}
                      <span style={{fontSize:12,color:T.muted}}>{entry.worker?entry.worker.name:entry.company.name}</span>
                      {entry.visit.timeOut && <span style={{fontSize:11,color:T.muted}}>Out {entry.visit.timeOut}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          {/* Upcoming today / this week */}
          {(()=>{
            const upcomingAll=[];
            const soon=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
            contractors.forEach(c=>{
              (contractorVisits[c.id]||[]).filter(v=>v.date>today&&v.date<=soon).forEach(v=>{
                const daysUntil=Math.ceil((new Date(v.date)-new Date())/86400000);
                upcomingAll.push({company:c,visit:v,daysUntil});
              });
            });
            upcomingAll.sort((a,b)=>a.visit.date.localeCompare(b.visit.date));
            if(!upcomingAll.length) return null;
            return (
              <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
                <div style={{fontSize:11,fontWeight:700,color:"#f59e0b",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>📅 Scheduled This Week</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {upcomingAll.map((entry,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:10,background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)"}}>
                      <span style={{fontSize:12,fontWeight:800,color:"#f59e0b"}}>{entry.daysUntil===1?"Tomorrow":entry.visit.date}</span>
                      <span style={{fontSize:12,color:T.white,fontWeight:600}}>{entry.company.name}</span>
                      <span style={{fontSize:11,color:T.muted}}>— {entry.visit.purpose}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          </div>
        );
      })()}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Contractor Register</h2>
          <p style={{color:T.muted,fontSize:13,margin:0}}>{contractors.filter(c=>c.status==="active").length} active companies · {contractors.reduce((s,c)=>(s+(c.workers||[]).length),0)} workers total</p>
        </div>
        <button onClick={()=>setShowForm(v=>!v)} style={{background:showForm?"rgba(239,68,68,0.1)":`linear-gradient(135deg,${T.accent},${T.blue})`,color:showForm?"#f87171":"#fff",border:showForm?"1px solid rgba(239,68,68,0.2)":"none",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>
          {showForm?"✕ Cancel":"+ Add Company"}
        </button>
      </div>
      {showForm && <CompanyForm onSave={c=>{setContractors(p=>[c,...p]);dbSaveContractor(c);setShowForm(false);}} onCancel={()=>setShowForm(false)} T={T} font={font}/>}

      <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",border:`1px solid ${T.border}`}}>
        <div style={{position:"relative",flex:"1 1 200px"}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.muted,pointerEvents:"none"}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company name..."
            style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"8px 10px 8px 32px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
        </div>
        {[["all","All"],["active","Active"],["inactive","Inactive"],["banned","Banned"]].map(([val,lbl])=>(
          <button key={val} onClick={()=>setFilterStatus(val)} style={{padding:"7px 14px",borderRadius:9,border:`1px solid ${filterStatus===val?T.accent:T.borderMd}`,background:filterStatus===val?`rgba(37,99,235,0.15)`:T.overlay,color:filterStatus===val?T.accentLt:T.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:filterStatus===val?700:400}}>{lbl}</button>
        ))}
        <span style={{color:T.muted,fontSize:12,marginLeft:"auto"}}>{filtered.length} of {contractors.length}</span>
      </div>

      <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
        {!isMobile && (
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px",padding:"10px 20px",background:T.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase"}}>
            <span>Company</span><span>Type</span><span>Status</span><span>Workers</span><span>Visits</span><span></span>
          </div>
        )}
        {filtered.length===0 && <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14}}>No companies found.</div>}
        {filtered.map((c,i)=>{
          const cv=contractorVisits[c.id]||[];
          const lastVisit=cv.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.date;
          const onSiteToday=cv.some(v=>v.date===today);
          const ss=c.status==="active"?{color:"#10b981",bg:"rgba(16,185,129,0.12)",border:"rgba(16,185,129,0.3)"}:c.status==="banned"?{color:"#f87171",bg:"rgba(239,68,68,0.12)",border:"rgba(239,68,68,0.3)"}:{color:T.muted,bg:T.overlay,border:T.borderMd};
          const hasExpiredWorkerCert=(c.workers||[]).some(w=>Object.values(contractorCerts[`${c.id}_${w.id}`]||{}).some(cert=>cert.expiryDate&&cert.expiryDate<today));
          return isMobile ? (
            <div key={c.id} onClick={()=>{setSelected(c.id);setView("detail");}} style={{padding:"14px 16px",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🏢</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:T.white}}>{c.name}</div>
                <div style={{fontSize:11,color:T.muted}}>{c.type} · {(c.workers||[]).length} workers</div>
              </div>
              <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:ss.bg,color:ss.color,border:`1px solid ${ss.border}`,textTransform:"capitalize"}}>{c.status}</span>
            </div>
          ) : (
            <div key={c.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px",padding:"14px 20px",borderTop:i>0?`1px solid ${T.border}`:"none",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🏢</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:T.white,display:"flex",alignItems:"center",gap:6}}>
                    {c.name}
                    {onSiteToday && <span style={{fontSize:9,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,0.12)",padding:"1px 6px",borderRadius:20,border:"1px solid rgba(16,185,129,0.3)"}}>ON SITE</span>}
                    {hasExpiredWorkerCert && <span style={{fontSize:9,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,0.1)",padding:"1px 6px",borderRadius:20,border:"1px solid rgba(239,68,68,0.2)"}}>CERT EXPIRED</span>}
                  </div>
                  {c.email && <div style={{fontSize:11,color:T.muted}}>{c.email}</div>}
                </div>
              </div>
              <span style={{fontSize:12,color:T.muted}}>{c.type}</span>
              <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:ss.bg,color:ss.color,border:`1px solid ${ss.border}`,textTransform:"capitalize",display:"inline-block"}}>{c.status}</span>
              <span style={{fontSize:12,color:T.white,fontWeight:600}}>{(c.workers||[]).length} worker{(c.workers||[]).length!==1?"s":""}</span>
              <div>
                <div style={{fontSize:12,color:T.white,fontWeight:600}}>{cv.length} visit{cv.length!==1?"s":""}</div>
                {lastVisit && <div style={{fontSize:10,color:T.muted}}>Last: {lastVisit}</div>}
              </div>
              <button onClick={()=>{setSelected(c.id);setView("detail");}} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11}}>View →</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export { ContractorsTab };
