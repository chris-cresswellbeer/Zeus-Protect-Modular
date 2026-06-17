import React from "react";
import { useWindowWidth } from "../../shared/hooks";
import { Avatar } from "../../shared/primitives";
import { INDUCTION_ITEMS, CONTRACTOR_CERT_TYPES } from "../../data/seedContractors";

function WorkerDetailModal({ worker, companyId, contractorInductions, setContractorInductions, contractorCerts, setContractorCerts, dbSaveContractorInductions, dbSaveContractorCerts, onClose, T, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const today = new Date().toISOString().slice(0,10);
  const [tab, setTab] = React.useState("induction");
  const [certUploading, setCertUploading] = React.useState(null);
  const wid = `${companyId}_${worker.id}`;
  const ind = contractorInductions[wid]||{};
  const certs = contractorCerts[wid]||{};
  const indDone = INDUCTION_ITEMS.filter(i=>ind[i.id]?.done).length;
  const indPct = Math.round(indDone/INDUCTION_ITEMS.length*100);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflow:"auto"}}>
      <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:20,width:"100%",maxWidth:560,maxHeight:"90vh",overflow:"auto",border:`1px solid ${T.borderMd}`,boxShadow:"0 32px 80px rgba(0,0,0,0.7)"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:`linear-gradient(135deg,${T.navyMd},${T.navy})`}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Avatar name={worker.name} size={36}/>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:T.white}}>{worker.name}</div>
              <div style={{fontSize:12,color:T.muted}}>{worker.role||"Worker"}{worker.phone?` · ${worker.phone}`:""}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"7px 13px",color:T.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>✕</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,padding:"0 24px"}}>
          {[["induction",`✅ Induction (${indPct}%)`],["certs","🪪 Certs"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"11px 16px",background:"none",border:"none",borderBottom:`2px solid ${tab===id?T.gold:"transparent"}`,color:tab===id?T.white:T.muted,fontWeight:tab===id?700:400,cursor:"pointer",fontFamily:font,fontSize:13}}>{label}</button>
          ))}
        </div>
        <div style={{padding:24}}>
          {tab==="induction" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <span style={{fontSize:13,color:T.muted}}>{indDone} of {INDUCTION_ITEMS.length} completed</span>
                <span style={{fontSize:13,fontWeight:800,color:indPct===100?T.green:indPct>0?"#f59e0b":"#f87171"}}>{indPct===100?"✓ Inducted":`${indPct}%`}</span>
              </div>
              <div style={{height:4,background:T.border,borderRadius:99,marginBottom:14,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${indPct}%`,background:indPct===100?T.green:"#f59e0b",borderRadius:99}}/>
              </div>
              {INDUCTION_ITEMS.map(item=>{
                const done=ind[item.id]?.done;
                return (
                  <div key={item.id} onClick={()=>{
                    const newInd={...ind,[item.id]:{done:!done,date:today,by:"Admin"}};
                    setContractorInductions(p=>({...p,[wid]:newInd}));
                    dbSaveContractorInductions(wid,newInd);
                  }} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,background:done?"rgba(16,185,129,0.07)":T.overlay,border:`1px solid ${done?"rgba(16,185,129,0.2)":T.border}`,cursor:"pointer",marginBottom:6}}>
                    <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${done?"#10b981":T.borderMd}`,background:done?"#10b981":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {done && <span style={{color:"#fff",fontSize:11,fontWeight:900}}>✓</span>}
                    </div>
                    <span style={{flex:1,fontSize:13,color:done?T.white:T.muted,fontWeight:done?600:400}}>{item.label}</span>
                    {done && ind[item.id].date && <span style={{fontSize:10,color:T.green}}>{ind[item.id].date}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {tab==="certs" && (
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
              {CONTRACTOR_CERT_TYPES.map(ct=>{
                const cert=certs[ct.id];
                const expired=cert?.expiryDate&&cert.expiryDate<today;
                const daysLeft=cert?.expiryDate?Math.ceil((new Date(cert.expiryDate)-new Date())/86400000):null;
                return (
                  <div key={ct.id} style={{background:cert?(expired?"rgba(239,68,68,0.07)":"rgba(16,185,129,0.07)"):T.overlay,borderRadius:10,padding:"12px 14px",border:`1px solid ${cert?(expired?"rgba(239,68,68,0.25)":"rgba(16,185,129,0.25)"):T.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:18}}>{ct.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.white}}>{ct.label}</div>
                        {cert && <div style={{fontSize:10,color:expired?"#f87171":daysLeft<=30?"#f59e0b":T.green}}>{expired?`⚠ Expired`:daysLeft<=30?`⏳ ${daysLeft}d`:`✓ ${cert.expiryDate}`}</div>}
                      </div>
                      {cert ? (
                        <div style={{display:"flex",gap:5}}>
                          {cert.fileUrl && <a href={cert.fileUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:T.accentLt,textDecoration:"none",fontWeight:700}}>View</a>}
                          <button onClick={()=>{const n={...certs};delete n[ct.id];setContractorCerts(p=>({...p,[wid]:n}));dbSaveContractorCerts(wid,n);}} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>✕</button>
                        </div>
                      ) : (
                        <label style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",borderRadius:6,padding:"4px 8px",cursor:certUploading===ct.id?"wait":"pointer",fontFamily:font,fontWeight:700,fontSize:10}}>
                          {certUploading===ct.id?"⏳":"↑"}
                          <input type="file" accept={ACCEPT_IMG_DOCS} style={{display:"none"}} disabled={!!certUploading}
                            onChange={async e=>{
                              const file=e.target.files[0]; if(!file) return;
                              setCertUploading(ct.id);
                              const path=`contractor_certs/${wid}_${ct.id}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
                              await sb.storage.upload("documents",path,file);
                              const fileUrl=sb.storage.getPublicUrl("documents",path);
                              const issued=prompt("Issue date (YYYY-MM-DD):","")||"";
                              const expiry=prompt("Expiry date (YYYY-MM-DD):","")||"";
                              const newCerts={...certs,[ct.id]:{fileName:file.name,fileUrl,issuedDate:issued,expiryDate:expiry}};
                              setContractorCerts(p=>({...p,[wid]:newCerts}));
                              dbSaveContractorCerts(wid,newCerts);
                              setCertUploading(null);
                              e.target.value="";
                            }}/>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export { WorkerDetailModal };
