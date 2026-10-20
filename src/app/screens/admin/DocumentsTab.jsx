/**
 * DocumentsTab.jsx — Documents: upload, folders, bundles, assign and read tracking
 * Part of app/screens/AdminPortal.jsx. Reads the app's shared state with useApp() (app/AppContext.js).
 */
import { bundleNamesOf } from "../../../domains/documents/bundles";
import { todayISO } from "../../../lib/dates";
import { E } from "../../../lib/emoji";
import { BulkBar, Tick, TickAll, ticksFrom } from "../../../shared/BulkBar";
import { ask, notify } from "../../../shared/Feedback";
import { HelpTip } from "../../../shared/HelpTip";
import { useApp } from "../../AppContext";
import { DocBundles, DocCard } from "../../lazyParts";

export function DocumentsTab({ staff }) {
  const {
    allUsers, assignBundle, bulkDocManager, bulkDocSelectedDocs, bulkDocSelectedStaff, bulkDocTarget,
    dbDeleteDoc, dbSaveDoc, dbSaveDocAssignments, deleteBundle, docAckHistory, docAcknowledgements,
    docAssignments, docBundles, docFolder, docs, docSearch, docSel, docView, font, isMobile, saveBundle,
    setBulkDocManager, setBulkDocSelectedDocs, setBulkDocSelectedStaff, setBulkDocTarget,
    setDocAcknowledgements, setDocAssignments, setDocFolder, setDocs, setDocSearch, setDocSel, setDocView,
    setPreviewDoc, setShowBulkDocAssign, showBulkDocAssign, T, unassignBundle
  } = useApp();
  return (
      <div>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:6}}>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:0}}>H&S Documentation <HelpTip dark={false} text="Upload policies, procedures, risk assessments and guidance documents. Use the Assign button on each document to nominate staff for required reading — they'll be prompted to confirm they've read it in their portal."/></h2>
          {docView!=="bundles" && <button onClick={()=>setShowBulkDocAssign(v=>!v)}
            style={{background:showBulkDocAssign?`rgba(239,68,68,0.1)`:`rgba(37,99,235,0.1)`,color:showBulkDocAssign?"#f87171":T.accentLt,border:showBulkDocAssign?"1px solid rgba(239,68,68,0.25)":`1px solid rgba(37,99,235,0.25)`,borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,whiteSpace:"nowrap"}}>
            {showBulkDocAssign?"✕ Cancel":E("👥 ","")+"Bulk Assign"}
          </button>}
        </div>
        <p style={{color:T.muted,marginBottom:12,fontSize:13}}>Upload documents and assign them for required reading.</p>

        {/* Documents | Document bundles */}
        <div role="tablist" style={{display:"inline-flex",gap:4,padding:4,borderRadius:12,background:T.overlay,border:`1px solid ${T.border}`,marginBottom:18}}>
          {[["docs",`${E("📁 ","")}Documents (${docs.length})`],["bundles",`${E("📚 ","")}Document bundles (${docBundles.length})`]].map(([v,l])=>(
            <button key={v} role="tab" aria-selected={docView===v} onClick={()=>{setDocView(v);setShowBulkDocAssign(false);}}
              style={{padding:"8px 16px",borderRadius:9,border:"none",background:docView===v?`linear-gradient(135deg,${T.accent},${T.blue})`:"transparent",color:docView===v?"#fff":T.muted,fontWeight:docView===v?800:600,cursor:"pointer",fontFamily:font,fontSize:13}}>{l}</button>
          ))}
        </div>

        {docView==="bundles" && (
          <DocBundles bundles={docBundles} docs={docs} staff={staff.filter(u=>(u.status||"active")!=="leaver")} allPeople={allUsers}
            docAcknowledgements={docAcknowledgements} onSave={saveBundle} onDelete={deleteBundle} onAssign={assignBundle} onUnassign={unassignBundle}
            Z={T} font={font} isMobile={isMobile}/>
        )}
        {docView!=="bundles" && <>

        {/* Bulk assign panel */}
        {showBulkDocAssign && (() => {
          const managers = [...new Set(staff.map(u=>u.manager||"").filter(Boolean))].sort();
          const targetStaff2 = bulkDocTarget==="all" ? staff
            : bulkDocTarget==="team" ? staff.filter(u=>u.manager===bulkDocManager)
            : staff.filter(u=>bulkDocSelectedStaff.includes(String(u.id)));
          const inp3 = {background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"8px 12px",color:T.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"};
          return (
            <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:20,marginBottom:20,border:`1px solid ${T.accent}44`}}>
              <h4 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:T.accentLt,textTransform:"uppercase",letterSpacing:.5}}>👥 Bulk Document Assignment</h4>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Assign To</div>
                  <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                    {[["all","All Staff"],["team","A Team"],["individual","Select Staff"]].map(([val,lbl])=>(
                      <button key={val} onClick={()=>setBulkDocTarget(val)} style={{padding:"7px 14px",borderRadius:9,border:`1px solid ${bulkDocTarget===val?T.accent:T.borderMd}`,background:bulkDocTarget===val?`rgba(37,99,235,0.15)`:T.overlay,color:bulkDocTarget===val?T.accentLt:T.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:bulkDocTarget===val?700:400}}>{lbl}</button>
                    ))}
                  </div>
                  {bulkDocTarget==="team" && (
                    <select value={bulkDocManager} onChange={e=>setBulkDocManager(e.target.value)} style={{...inp3,width:"100%",marginBottom:10}}>
                      <option value="">Select manager...</option>
                      {managers.map(m=><option key={m} value={m}>{m} ({staff.filter(u=>u.manager===m).length} staff)</option>)}
                    </select>
                  )}
                  {bulkDocTarget==="individual" && (
                    <div style={{maxHeight:150,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:8,marginBottom:10}}>
                      {staff.map((u,i)=>(
                        <div key={u.id} onClick={()=>setBulkDocSelectedStaff(p=>p.includes(String(u.id))?p.filter(x=>x!==String(u.id)):[...p,u.id])}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",background:bulkDocSelectedStaff.includes(u.id)?"rgba(37,99,235,0.08)":"transparent"}}>
                          <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${bulkDocSelectedStaff.includes(u.id)?T.accent:T.borderMd}`,background:bulkDocSelectedStaff.includes(u.id)?T.accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {bulkDocSelectedStaff.includes(String(u.id))&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                          </div>
                          <span style={{fontSize:12,color:T.white}}>{u.name}</span>
                          <span style={{fontSize:11,color:T.muted,marginLeft:"auto"}}>{u.jobTitle||""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:11,color:T.muted}}>{targetStaff2.length} staff will be assigned</div>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Select Documents</div>
                  <div style={{maxHeight:180,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:8,marginBottom:10}}>
                    {docs.map((d,i)=>(
                      <div key={d.id} onClick={()=>setBulkDocSelectedDocs(p=>p.includes(d.id)?p.filter(x=>x!==d.id):[...p,d.id])}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",background:bulkDocSelectedDocs.includes(d.id)?"rgba(37,99,235,0.08)":"transparent"}}>
                        <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${bulkDocSelectedDocs.includes(d.id)?T.accent:T.borderMd}`,background:bulkDocSelectedDocs.includes(d.id)?T.accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {bulkDocSelectedDocs.includes(d.id)&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                        </div>
                        <span style={{fontSize:12,color:T.white,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.title}</span>
                        <span style={{fontSize:10,color:T.muted,flexShrink:0}}>{d.type}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    disabled={bulkDocSelectedDocs.length===0||targetStaff2.length===0}
                    onClick={async()=>{
                      if(!(await ask({ title: "Assign documents", ok: "Assign", message: `Assign ${bulkDocSelectedDocs.length} document${bulkDocSelectedDocs.length!==1?"s":""} to ${targetStaff2.length} staff member${targetStaff2.length!==1?"s":""} as required reading?` }))) return;
                      setDocAssignments(p=>{
                        const n={...p};
                        bulkDocSelectedDocs.forEach(did=>{
                          const sdid=String(did);
                          const current=n[sdid]||[];
                          const toAdd=targetStaff2.map(u=>String(u.id)).filter(id=>!current.includes(id));
                          n[sdid]=[...current,...toAdd];
                          dbSaveDocAssignments(did, n[sdid]);
                        });
                        return n;
                      });
                      setShowBulkDocAssign(false);
                      setBulkDocSelectedDocs([]);
                      setBulkDocSelectedStaff([]);
                    }}
                    style={{background:(bulkDocSelectedDocs.length===0||targetStaff2.length===0)?"rgba(37,99,235,0.3)":`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:(bulkDocSelectedDocs.length===0||targetStaff2.length===0)?"not-allowed":"pointer",fontFamily:font,fontWeight:700,fontSize:13,opacity:(bulkDocSelectedDocs.length===0||targetStaff2.length===0)?.5:1}}>
                    Assign {bulkDocSelectedDocs.length>0?bulkDocSelectedDocs.length+" ":""} Doc{bulkDocSelectedDocs.length!==1?"s":""} to {targetStaff2.length} Staff
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Folder tabs */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {(["all",...Array.from(new Set([...docs.map(d=>d.type||"Document"),...(docFolder!=="all"?[docFolder]:[])])).sort()]).map(f=>(
            <button key={f} onClick={()=>setDocFolder(f)}
              style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${docFolder===f?T.accent:T.borderMd}`,background:docFolder===f?`linear-gradient(135deg,${T.accent},${T.blue})`:T.overlay,color:docFolder===f?"#fff":T.muted,fontWeight:docFolder===f?700:400,cursor:"pointer",fontFamily:font,fontSize:12}}>
              {f==="all"?`📁 All (${docs.length})`:`${f==="Policy"?"📋":f==="Procedure"?"📝":f==="Guidance"?"📖":f==="Risk Assessment"?"⚠️":f==="COSHH"?"🧪":f==="User Manual"?"📘":"📄"} ${f} (${docs.filter(d=>(d.type||"Document")===f).length})`}
            </button>
          ))}
        </div>

        {/* Upload area */}
        <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:20,border:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <h4 style={{margin:0,fontSize:12,fontWeight:700,letterSpacing:1,color:T.muted}}>UPLOAD NEW DOCUMENT</h4>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:T.muted}}>Category:</span>
              <select value={docFolder==="all"?"Document":docFolder} onChange={e=>setDocFolder(e.target.value)}
                style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"5px 10px",color:T.white,fontSize:12,outline:"none",fontFamily:font,cursor:"pointer"}}>
                {["Policy","Procedure","Guidance","User Manual","Risk Assessment","COSHH","Report","Presentation","Document"].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <label style={{display:"block",border:"2px dashed T.borderMd",borderRadius:14,padding:"28px 20px",textAlign:"center",cursor:"pointer",transition:"border-color .2s",background:T.overlay}}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=T.accent}}
            onDragLeave={e=>{e.currentTarget.style.borderColor=T.borderMd}}
            onDrop={e=>{
              e.preventDefault();
              e.currentTarget.style.borderColor=T.borderMd;
              const files=Array.from(e.dataTransfer.files);
              files.forEach(async file=>{
                const ext=file.name.split(".").pop().toUpperCase();
                const typeMap={PDF:"Policy",DOCX:"Guidance",DOC:"Guidance",XLSX:"Report",XLS:"Report",PPTX:"Presentation",PPT:"Presentation"};
                const id="d"+Date.now()+Math.random();
                const docType = docFolder!=="all"?docFolder:typeMap[ext]||"Document";
                const newDoc={id,title:file.name.substring(0,file.name.lastIndexOf(".")>0?file.name.lastIndexOf("."):file.name.length),date:todayISO(),size:`${(file.size/1024).toFixed(0)} KB`,type:docType,fileUrl:null,fileData:null,fileName:file.name,ext,version:1};
                setDocs(p=>[...p,newDoc]);
                await dbSaveDoc(newDoc,file);
                setDocs(p=>p.map(d=>d.id===id?{...d,fileUrl:newDoc.fileUrl,fileData:newDoc.fileUrl}:d));
              });
            }}>
            <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg"
              style={{display:"none"}}
              onChange={e=>{
                Array.from(e.target.files).forEach(async file=>{
                  const ext=file.name.split(".").pop().toUpperCase();
                  const typeMap={PDF:"Policy",DOCX:"Guidance",DOC:"Guidance",XLSX:"Report",XLS:"Report",PPTX:"Presentation",PPT:"Presentation"};
                  const id="d"+Date.now()+Math.random();
                  const docType = docFolder!=="all"?docFolder:typeMap[ext]||"Document";
                  const newDoc={id,title:file.name.substring(0,file.name.lastIndexOf(".")>0?file.name.lastIndexOf("."):file.name.length),date:todayISO(),size:`${(file.size/1024).toFixed(0)} KB`,type:docType,fileUrl:null,fileData:null,fileName:file.name,ext,version:1};
                  setDocs(p=>[...p,newDoc]);
                  await dbSaveDoc(newDoc,file);
                  setDocs(p=>p.map(d=>d.id===id?{...d,fileUrl:newDoc.fileUrl,fileData:newDoc.fileUrl}:d));
                });
                e.target.value="";
              }}/>
            <div style={{fontSize:36,marginBottom:10}}>📂</div>
            <div style={{color:T.white,fontWeight:700,fontSize:14,marginBottom:4}}>Drop files here or click to browse</div>
            <div style={{color:T.muted,fontSize:12}}>PDF, Word, Excel, PowerPoint, images supported · Multiple files at once</div>
          </label>
        </div>

        {/* Document list: folder + search */}
        {(()=>{ const q=String(docSearch||"").trim().toLowerCase(); const inFolder=docs.filter(d=>docFolder==="all"||(d.type||"Document")===docFolder);
          const shownDocs=q?inFolder.filter(d=>[d.title,d.description,d.fileName,d.type].some(v=>String(v||"").toLowerCase().includes(q))):inFolder;
          // tick boxes + bulk actions (no bulk delete: deleting also removes read confirmations)
          const docTicks = ticksFrom(docSel, setDocSel, shownDocs.map(d=>d.id), docs.map(d=>d.id));
          const DOC_FOLDERS = ["Policy","Procedure","Guidance","User Manual","Risk Assessment","COSHH","Report","Presentation","Document"];
          const ticked = ids => docs.filter(d=>ids.includes(String(d.id)));
          const saveDocsMeta = async (ids, change, msg) => {
            const list = ticked(ids).filter(d=>!d.raId).map(d=>({ ...d, ...change }));
            const skipped = ids.length - list.length;
            setDocs(p=>p.map(d=>list.find(x=>x.id===d.id)||d));
            await Promise.all(list.map(d=>dbSaveDoc(d, null)));   // a failed save shows its own message
            notify(`${msg} (${list.length} document${list.length!==1?"s":""})${skipped?`. ${skipped} made from a risk assessment ${skipped===1?"was":"were"} left as ${skipped===1?"it is":"they are"}.`:"."}`, { kind:"success" });
          };
          const docActions = [
            { label: "📁 Move to folder…", run: async ids => {
                const v = await ask({ title:`Move ${ids.length} document${ids.length!==1?"s":""}`, ok:"Move", fields:[{ id:"type", label:"Folder", required:true, options: DOC_FOLDERS.map(f=>({ value:f, label:f })) }] });
                if (!v) return false; await saveDocsMeta(ids, { type: v.type }, `Moved to ${v.type}`); } },
            { label: "📅 Set review date…", run: async ids => {
                const v = await ask({ title:`Review date for ${ids.length} document${ids.length!==1?"s":""}`, ok:"Set date", fields:[{ id:"date", label:"Next review", type:"date", required:true }] });
                if (!v || !v.date) return false; await saveDocsMeta(ids, { reviewDate: v.date }, `Review date set to ${v.date}`); } },
            ...(docBundles.length ? [{ label: "📦 Add to bundle…", run: async ids => {
                const v = await ask({ title:`Add ${ids.length} document${ids.length!==1?"s":""} to a bundle`, ok:"Add", message:"Anyone the bundle has been given to is assigned the added documents too.",
                  fields:[{ id:"bundle", label:"Bundle", required:true, options: docBundles.map(b=>({ value:b.id, label:b.name })) }] });
                if (!v) return false;
                const b = docBundles.find(x=>x.id===v.bundle); if (!b) return false;
                const add = ids.filter(id=>!b.docIds.map(String).includes(id));
                if (!add.length) { notify(`They're all in "${b.name}" already.`, { kind:"info" }); return; }
                if (await saveBundle({ ...b, docIds:[...b.docIds, ...add] }) !== false) notify(`${add.length} document${add.length!==1?"s":""} added to "${b.name}".`, { kind:"success" });
              } }] : []),
          ];
          return docs.length===0
          ? <div style={{textAlign:"center",padding:40,color:T.muted,fontSize:14}}>No documents uploaded yet.</div>
          : (
            <div style={{display:"grid",gap:14}}>
              <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                <input aria-label="Search documents" value={docSearch} onChange={e=>setDocSearch(e.target.value)} placeholder="🔍 Search documents by title, description or file name…"
                  style={{flex:1,minWidth:240,background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"9px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font}}/>
                <TickAll ticks={docTicks} label={`Tick all ${shownDocs.length}`} T={T} font={font}/>
                <span style={{fontSize:12,color:T.muted,whiteSpace:"nowrap"}}>{shownDocs.length} of {docs.length}</span>
                {q && <button type="button" onClick={()=>setDocSearch("")} style={{background:"none",border:"none",color:T.accentLt,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>Clear</button>}
              </div>
              <BulkBar ticks={docTicks} actions={docActions} T={T} font={font}/>
              {shownDocs.length===0 && <div style={{textAlign:"center",padding:24,color:T.muted,fontSize:13}}>No documents match.</div>}
              {shownDocs.map(d=>{
                const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
                const icon=extIcons[d.ext]||"📄";
                const assignedIds = docAssignments[String(d.id)] || [];
                const assignedStaff = staff.filter(u=>assignedIds.includes(String(u.id)));
                const readCount = assignedStaff.filter(u=>(docAcknowledgements[String(u.id)]||{})[String(d.id)]).length;
                const unreadCount = assignedStaff.length - readCount;

                return (
                  <DocCard key={d.id} tick={<Tick ticks={docTicks} id={d.id} label={`Tick ${d.title}`}/>} d={d} staff={staff} assignedIds={assignedIds} assignedStaff={assignedStaff} readCount={readCount} unreadCount={unreadCount} icon={icon} docAcknowledgements={docAcknowledgements} setDocAcknowledgements={setDocAcknowledgements} setDocAssignments={setDocAssignments} dbSaveDocAssignments={dbSaveDocAssignments} setDocs={setDocs} dbDeleteDoc={dbDeleteDoc} dbSaveDoc={dbSaveDoc} setPreviewDoc={setPreviewDoc} docAckHistory={docAckHistory} bundleNames={bundleNamesOf(docBundles, d.id)} T={T} font={font}/>
                );
              })}
            </div>
          ); })()}
        </>}
      </div>
    );
}
