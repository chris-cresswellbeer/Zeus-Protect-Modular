/**
 * MyDocumentsTab.jsx — My Documents: documents to read and confirm
 * Part of app/screens/StaffPortal.jsx. Reads the app's shared state with useApp() (app/AppContext.js).
 */
import { bundleNamesOf, bundlesFor } from "../../../domains/documents/bundles";
import { todayISO, ukDate } from "../../../lib/dates";
import { E } from "../../../lib/emoji";
import { HelpTip } from "../../../shared/HelpTip";
import { Pill } from "../../../shared/primitives";
import { useApp } from "../../AppContext";
import { MyBundles } from "../../lazyParts";

export function MyDocumentsTab() {
  const {
    dbAcknowledgeDoc, docAcknowledgements, docAssignments, docBundles, docs, font, setDocAcknowledgements,
    setPreviewDoc, T, user
  } = useApp();
  return (
      <div>
        <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:8}}>H&S Documentation <HelpTip dark={true} text="Policies and procedures your manager has asked you to read. Once you've read a document click Confirm I Have Read This — this logs your acknowledgement with a date stamp visible to your manager."/></h2>
        <p style={{color:T.muted,marginBottom:24,fontSize:13}}>Documents assigned to you for required reading are highlighted. Please read and confirm each one.</p>

        {/* Required reading section */}
        {(()=>{
          const required = docs.filter(d=>(docAssignments[String(d.id)]||[]).includes(String(user.id)));
          const allOther = docs.filter(d=>!(docAssignments[String(d.id)]||[]).includes(String(user.id)));
          const unread = required.filter(d=>!(docAcknowledgements[user.id]||{})[d.id]);
          const myBundles = bundlesFor(docBundles, user.id);

          return (
            <>
              <MyBundles bundles={myBundles} userId={String(user.id)} docs={docs} acks={docAcknowledgements} Z={T} font={font}/>
              {required.length>0 && (
                <div style={{marginBottom:28}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <h3 style={{margin:0,fontSize:14,fontWeight:700,color:"#fff"}}>Required Reading</h3>
                    {unread.length>0
                      ? <Pill label={`${unread.length} unread`} col="red"/>
                      : <Pill label="All read ✓" col="green"/>
                    }
                  </div>
                  <div style={{display:"grid",gap:10}}>
                    {required.map(d=>{
                      const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
                      const icon=extIcons[d.ext]||"📄";
                      const ack=(docAcknowledgements[user.id]||{})[d.id];
                      return (
                        <div key={d.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,border:`2px solid ${ack?"rgba(16,185,129,0.35)":"rgba(245,158,11,0.4)"}`,overflow:"hidden"}}>
                          <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                            <span style={{fontSize:26,flexShrink:0}}>{icon}</span>
                            <div style={{flex:1,minWidth:160}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2,flexWrap:"wrap"}}>
                                <span style={{fontWeight:700,fontSize:14,color:"#fff"}}>{d.title}</span>
                                {!ack && <Pill label="Required Reading" col="amber"/>}
                                {bundleNamesOf(myBundles, d.id).map(n=><span key={n} style={{fontSize:11,fontWeight:600,color:"#60a5fa",background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:20,padding:"1px 8px"}}>{E("📚 ","")}{n}</span>)}
                              </div>
                              <div style={{color:T.muted,fontSize:12}}>Updated: {ukDate(d.date)} · {d.size}{d.fileName?` · ${d.fileName.split(".").pop().toUpperCase()}`:""}</div>
                              {ack && <div style={{color:T.green,fontSize:12,marginTop:3,fontWeight:600}}>✓ You confirmed reading this on {ukDate(ack.date)}</div>}
                            </div>
                            <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
                              {d.fileData && (
                                <button onClick={()=>setPreviewDoc(d)}
                                  style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                                  👁 View
                                </button>
                              )}
                              {d.fileData && (
                                <a href={d.fileData} download={d.fileName||d.title}
                                  style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,textDecoration:"none",whiteSpace:"nowrap"}}>
                                  ↓ Download
                                </a>
                              )}
                              {ack
                                ? <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",color:T.green,fontSize:12,fontWeight:700}}>
                                    ✓ Read & Confirmed
                                  </div>
                                : <button
                                    onClick={()=>{const dt=todayISO();setDocAcknowledgements(p=>({...p,[user.id]:{...(p[user.id]||{}),[d.id]:{date:dt,version:d.version||1}}}));dbAcknowledgeDoc(user.id,d.id,dt);}}
                                    style={{background:`linear-gradient(135deg,${T.green},#059669)`,color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap",boxShadow:"0 2px 10px rgba(16,185,129,0.4)"}}>
                                    ✓ Confirm I Have Read This
                                  </button>
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {allOther.length>0 && (
                <div>
                  {required.length>0 && <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:"#fff"}}>All Documents</h3>}
                  <div style={{display:"grid",gap:10}}>
                    {allOther.map(d=>{
                      const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
                      const icon=extIcons[d.ext]||"📄";
                      return (
                        <div key={d.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,border:`1px solid ${T.border}`,flexWrap:"wrap"}}>
                          <span style={{fontSize:26,flexShrink:0}}>{icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.title}</div>
                            <div style={{color:T.muted,fontSize:12,marginTop:2}}>Updated: {ukDate(d.date)} · {d.size}{d.fileName?` · ${d.fileName.split(".").pop().toUpperCase()}`:""}</div>
                          </div>
                          <Pill label={d.type} col="navy"/>
                          {d.fileData && (
                            <button onClick={()=>setPreviewDoc(d)}
                              style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                              👁 View
                            </button>
                          )}
                          {d.fileData && (
                            <a href={d.fileData} download={d.fileName||d.title}
                              style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,textDecoration:"none",whiteSpace:"nowrap"}}>
                              ↓ Download
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {docs.length===0 && (
                <div style={{textAlign:"center",padding:48,color:T.muted,fontSize:14}}>No documents have been uploaded yet. Check back soon.</div>
              )}
            </>
          );
        })()}
      </div>
    );
}
