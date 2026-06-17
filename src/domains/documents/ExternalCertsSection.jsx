import React from "react";
import { useWindowWidth } from "../../shared/hooks";
import { FA_ZONES } from "../../data/seedFirstAid";

function ExternalCertsSection({ staff, extCerts, setExtCerts, dbSaveExtCert, dbDeleteExtCert, customZones=[], T, font }) {
  const allZones = [...FA_ZONES, ...customZones];
  const isMobile = useWindowWidth() <= 1024;
  const [selectedUser, setSelectedUser] = React.useState(staff[0]?.id || null);
  const [uploadingFor, setUploadingFor] = React.useState(null); // certType being uploaded
  const [form, setForm] = React.useState({ issuedDate: "", expiryDate: "" });

  const userCerts = extCerts[selectedUser] || {};

  async function handleUpload(certType, file) {
    setUploadingFor(certType);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `ext_certs/${selectedUser}_${certType}_${safeName}`;
    const { error } = await sb.storage.upload("documents", path, file);
    if (error) { alert("Upload failed: " + error); setUploadingFor(null); return; }
    const fileUrl = sb.storage.getPublicUrl("documents", path);
    const rec = { fileName: file.name, fileUrl, issuedDate: form.issuedDate, expiryDate: form.expiryDate, uploadedAt: new Date().toLocaleDateString("en-GB") };
    setExtCerts(p => ({ ...p, [selectedUser]: { ...(p[selectedUser]||{}), [certType]: rec } }));
    dbSaveExtCert(selectedUser, certType, rec);
    setUploadingFor(null);
    setForm({ issuedDate: "", expiryDate: "" });
  }

  function removeCert(certType) {
    setExtCerts(p => { const n = {...p}; if (n[selectedUser]) { n[selectedUser] = {...n[selectedUser]}; delete n[selectedUser][certType]; } return n; });
    dbDeleteExtCert(selectedUser, certType);
  }

  return (
    <div style={{marginTop:32,borderTop:`1px solid ${T.border}`,paddingTop:28}}>
      <h3 style={{fontSize:18,fontWeight:800,letterSpacing:-.3,marginBottom:4,margin:"0 0 4px"}}>External Certificates</h3>
      <p style={{color:T.muted,fontSize:13,marginBottom:20}}>Upload externally issued certificates such as First Aid and Fire Marshall training.</p>

      {/* Staff selector */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,flexShrink:0}}>Staff Member:</span>
        <select value={selectedUser||""} onChange={e=>setSelectedUser(Number(e.target.value))}
          style={{flex:1,minWidth:200,maxWidth:360,background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"9px 13px",color:T.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"}}>
          {staff.map(u=><option key={u.id} value={u.id}>{u.name}{u.jobTitle?` — ${u.jobTitle}`:""}</option>)}
        </select>
      </div>

      {/* Certificate cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        {EXT_CERT_TYPES.map(ct => {
          const cert = userCerts[ct.id];
          const isExpired = cert?.expiryDate && new Date(cert.expiryDate) < new Date();
          const daysLeft = cert?.expiryDate ? Math.ceil((new Date(cert.expiryDate) - new Date()) / 86400000) : null;
          return (
            <div key={ct.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,border:`1px solid ${cert?(isExpired?"rgba(239,68,68,0.4)":"rgba(16,185,129,0.3)"):T.border}`,overflow:"hidden"}}>
              {/* Header */}
              <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:28}}>{ct.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15,color:T.white}}>{ct.label}</div>
                  <div style={{fontSize:11,color:T.muted}}>Renews every {ct.renewalMonths} months</div>
                </div>
                {cert && (
                  <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:isExpired?"rgba(239,68,68,0.15)":"rgba(16,185,129,0.15)",color:isExpired?"#f87171":"#10b981",border:`1px solid ${isExpired?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.3)"}`}}>
                    {isExpired ? "⚠ Expired" : daysLeft <= 30 ? `⏳ ${daysLeft}d left` : "✓ Valid"}
                  </span>
                )}
              </div>

              {/* Content */}
              <div style={{padding:"14px 18px"}}>
                {cert ? (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                      <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Issued</div><div style={{fontSize:13,fontWeight:600,color:T.white}}>{cert.issuedDate||"—"}</div></div>
                      <div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Expires</div><div style={{fontSize:13,fontWeight:600,color:isExpired?"#f87171":T.white}}>{cert.expiryDate||"—"}</div></div>
                    </div>
                    {ct.id==="first_aid" && (
                      <div style={{marginBottom:12,padding:"10px 12px",background:T.overlay,borderRadius:8,border:`1px solid ${T.border}`}}>
                        <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Coverage — First Aid Register</div>
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:11,color:T.muted,marginBottom:4}}>Zones / Areas</div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {allZones.map(z=>{
                              const on=(cert.zones||[]).includes(z);
                              return <button key={z} type="button"
                                onClick={()=>{
                                  const updated={...cert,zones:on?(cert.zones||[]).filter(x=>x!==z):[...(cert.zones||[]),z]};
                                  dbSaveExtCert(selectedUser,ct.id,updated);
                                  setExtCerts(p=>({...p,[selectedUser]:{...(p[selectedUser]||{}),[ct.id]:updated}}));
                                }}
                                style={{padding:"3px 9px",borderRadius:6,border:`1px solid ${on?"#3b82f6":T.borderMd}`,background:on?"rgba(59,130,246,0.12)":T.overlay,color:on?"#93c5fd":T.muted,cursor:"pointer",fontFamily:font,fontSize:10,fontWeight:on?700:400}}>
                                {z}
                              </button>;
                            })}
                          </div>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:T.muted,marginBottom:4}}>Shifts</div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {FA_SHIFTS.map(s=>{
                              const on=(cert.shifts||[]).includes(s);
                              return <button key={s} type="button"
                                onClick={()=>{
                                  const updated={...cert,shifts:on?(cert.shifts||[]).filter(x=>x!==s):[...(cert.shifts||[]),s]};
                                  dbSaveExtCert(selectedUser,ct.id,updated);
                                  setExtCerts(p=>({...p,[selectedUser]:{...(p[selectedUser]||{}),[ct.id]:updated}}));
                                }}
                                style={{padding:"3px 9px",borderRadius:6,border:`1px solid ${on?"#10b981":T.borderMd}`,background:on?"rgba(16,185,129,0.1)":T.overlay,color:on?"#10b981":T.muted,cursor:"pointer",fontFamily:font,fontSize:10,fontWeight:on?700:400}}>
                                {s.split(" ")[0]}{s.includes("Office")?" (Office)":""}
                              </button>;
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <a href={cert.fileUrl} target="_blank" rel="noreferrer"
                        style={{flex:1,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,textDecoration:"none",textAlign:"center",whiteSpace:"nowrap"}}>
                        👁 View Certificate
                      </a>
                      <button onClick={()=>removeCert(ct.id)}
                        style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
                        🗑
                      </button>
                    </div>
                    <div style={{fontSize:10,color:T.muted,marginTop:8}}>Uploaded {cert.uploadedAt} · {cert.fileName}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      <div>
                        <label style={{fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Issue Date</label>
                        <input type="date" value={form.issuedDate} onChange={e=>setForm(p=>({...p,issuedDate:e.target.value}))}
                          style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 10px",color:T.white,fontSize:12,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
                      </div>
                      <div>
                        <label style={{fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Expiry Date</label>
                        <input type="date" value={form.expiryDate} onChange={e=>setForm(p=>({...p,expiryDate:e.target.value}))}
                          style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 10px",color:T.white,fontSize:12,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
                      </div>
                    </div>
                    <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:uploadingFor===ct.id?"rgba(37,99,235,0.1)":`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700,border:uploadingFor===ct.id?`1px solid ${T.accent}`:"none",transition:"all .2s"}}>
                      {uploadingFor===ct.id ? "⏳ Uploading…" : "↑ Upload Certificate"}
                      <input type="file" accept={ACCEPT_IMG_DOCS} style={{display:"none"}} disabled={!!uploadingFor}
                        onChange={e=>{ if(e.target.files[0]) handleUpload(ct.id, e.target.files[0]); e.target.value=""; }}/>
                    </label>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ExternalCertsSection };
