import React from "react";
import { notify, ask } from "../../shared/Feedback";
import { Pill } from "../../shared/primitives";
import { sb, dbWrite } from "../../lib/supabase";
import { ACCEPT_IMG_DOCS } from "../../lib/constants";
import { DocAssignPanel } from "./DocAssignPanel";
import { NewVersionModal } from "../../shared/NewVersionModal";
import { auditEvent } from "../../lib/audit";

import { todayISO } from "../../lib/dates";
/**
 * DocCard — one document in the admin Documents library.
 *
 * Shows title/type/version, read-count vs. assigned staff, review-date status
 * (overdue / due within 30 days), an editable description, and actions:
 * Preview, Assign (expands DocAssignPanel), "New Version" upload, Versions, Delete.
 *
 * VERSIONING: "New Version" asks minor/major (NewVersionModal). The previous file is
 * kept (each version is uploaded to its own path, doc_<id>_v<n>_<name>) and listed in
 * d.history; everyone's earlier read confirmations stay in doc_ack_history.
 *
 * Props are mostly pass-throughs of App.jsx state + db helpers
 * (setDocs, dbSaveDoc, dbDeleteDoc, setDocAssignments, dbSaveDocAssignments,
 *  setDocAcknowledgements, setPreviewDoc…), plus pre-computed counts from the parent.
 */
function DocCard({ d, staff, assignedIds, assignedStaff, readCount, unreadCount, icon, docAcknowledgements, setDocAcknowledgements, setDocAssignments, dbSaveDocAssignments, setDocs, dbDeleteDoc, dbSaveDoc, setPreviewDoc, docAckHistory = [], bundleNames = [], T, font }) {
  const [expanded, setExpanded] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState(null); // new-version file awaiting the minor/major choice
  const [showVersions, setShowVersions] = React.useState(false);
  const [editingReview, setEditingReview] = React.useState(false);
  const [reviewInput, setReviewInput] = React.useState(d.reviewDate||"");
  const [editingDesc, setEditingDesc] = React.useState(false);
  const [descInput, setDescInput] = React.useState(d.description||"");
  const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
  const docIcon = extIcons[d.ext] || "📄";

  const today = todayISO();
  const reviewDate = d.reviewDate || null;
  const daysToReview = reviewDate ? Math.ceil((new Date(reviewDate) - new Date()) / 86400000) : null;
  const reviewOverdue = daysToReview !== null && daysToReview < 0;
  const reviewSoon = daysToReview !== null && daysToReview >= 0 && daysToReview <= 30;
  const reviewStatus = reviewOverdue ? {label:`Review overdue by ${Math.abs(daysToReview)}d`, color:"#f87171", bg:"rgba(239,68,68,0.12)", border:"rgba(239,68,68,0.3)"}
    : reviewSoon ? {label:`Review due in ${daysToReview}d`, color:"#f59e0b", bg:"rgba(245,158,11,0.12)", border:"rgba(245,158,11,0.3)"}
    : reviewDate ? {label:`Review: ${reviewDate}`, color:T.muted, bg:"transparent", border:"transparent"}
    : null;

  // Review date and description edits save metadata only (file = null → no re-upload).
  function saveReviewDate(val) {
    const updated = {...d, reviewDate: val||null};
    setDocs(p=>p.map(x=>x.id===d.id?updated:x));
    dbSaveDoc(updated, null);
    setEditingReview(false);
  }

  function saveDescription(val) {
    const updated = {...d, description: val||null};
    setDocs(p=>p.map(x=>x.id===d.id?updated:x));
    dbSaveDoc(updated, null);
    setEditingDesc(false);
  }

  // Upload `file` as version n+1. The old version's details go into d.history (its file
  // stays in storage under its own path). "major" clears every current read confirmation
  // so everyone assigned must read it again — the earlier confirmations remain in
  // doc_ack_history. "minor" keeps them (each records the version that was read).
  function uploadNewVersion(file, change, note) {
    const prevVer = d.version||1, newVer = prevVer+1, today = todayISO();
    const ext2=file.name.split(".").pop().toUpperCase();
    const path2=`doc_${d.id}_v${newVer}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const prevEntry={version:prevVer,date:d.date,fileName:d.fileName||"",fileUrl:d.fileUrl||d.fileData||null,size:d.size||"",ext:d.ext||"",replacedOn:today,replacedBy:change,note:d.versionNote||""}; // note = what changed IN that version
    const newDoc={...d,version:newVer,date:today,size:`${(file.size/1024).toFixed(0)} KB`,fileName:file.name,ext:ext2,
      history:[...(d.history||[]),prevEntry],versionNote:note||"",versionChange:change};
    let cleared=0;
    if (change==="major") {
      cleared=Object.keys(docAcknowledgements).filter(uid=>docAcknowledgements[uid]&&docAcknowledgements[uid][d.id]).length;
      setDocAcknowledgements(p=>{
        const n={};
        Object.keys(p).forEach(uid=>{ n[uid]={...p[uid]}; if(n[uid][d.id]) delete n[uid][d.id]; });
        return n;
      });
      Object.keys(docAcknowledgements).forEach(uid=>{
        if(docAcknowledgements[uid]&&docAcknowledgements[uid][d.id]) dbWrite(sb.from("doc_acknowledgements").delete().match({user_id:String(uid),doc_id:String(d.id)}), "doc acknowledgement delete");
      });
    }
    sb.storage.upload("documents",path2,file).then(({error})=>{
      if (error) { console.error("New version upload failed:", error); notify("Upload failed: " + error, { kind: "error" }); return; }
      newDoc.fileUrl=sb.storage.getPublicUrl("documents",path2);
      newDoc.fileData=newDoc.fileUrl;
      setDocs(p=>p.map(x=>x.id===d.id?newDoc:x));
      dbSaveDoc(newDoc,null);
      auditEvent("document", d.id, "new_version",
        `Version ${newVer} (${change==="major"?`major — ${cleared} ${cleared===1?"person":"people"} must re-read`:"minor — read confirmations kept"})${note?`: ${note}`:""}`,
        { version:{from:prevVer,to:newVer}, fileName:{from:d.fileName||"",to:file.name} }, d.title);
    });
  }

  async function confirmDelete() {
    if (d.raId) {
      notify(`"${d.title}" is created from a risk assessment, so it can't be removed here. To remove it, delete or change the risk assessment under Risk Assessments.`, { kind: "info", timeout: 9000 });
      return;
    }
    const lines = [`Delete "${d.title}"?`, ""];
    if (assignedStaff.length) lines.push(`It is assigned to ${assignedStaff.length} staff member${assignedStaff.length!==1?"s":""} (${readCount} ha${readCount!==1?"ve":"s"} confirmed reading it). Their assignments and read confirmations will be removed too.`, "");
    lines.push("The file will be deleted. This cannot be undone.");
    if (!(await ask({ title: `Delete "${d.title}"?`, danger: true, ok: "Delete document", message: lines.slice(1).join("\n").trim() }))) return;
    setDocs(p=>p.filter(x=>x.id!==d.id));
    dbDeleteDoc(d.id,d.fileName);
    auditEvent("document", d.id, "delete", `Deleted document "${d.title}" (v${d.version||1})`,
      { title:{from:d.title,to:null}, fileName:{from:d.fileName||"",to:null}, assignedTo:{from:assignedStaff.length,to:0}, confirmedReading:{from:readCount,to:0} }, d.title);
  }

  const myHistory = docAckHistory.filter(h=>String(h.doc_id)===String(d.id));
  const versionRows = [
    { version:d.version||1, date:d.date, fileName:d.fileName, fileUrl:d.fileUrl||d.fileData, current:true, note:d.versionNote||"" },
    ...[...(d.history||[])].reverse(),
  ];

  return (
    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,border:`1px solid ${reviewOverdue?"rgba(239,68,68,0.4)":reviewSoon?"rgba(245,158,11,0.35)":T.border}`,overflow:"hidden"}}>
      <div style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <span style={{fontSize:26,flexShrink:0}}>{docIcon}</span>
        {/* flex-basis keeps the title readable; the buttons wrap onto a second line when space runs out */}
        <div style={{flex:"1 1 260px",minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.title}</div>
          {!editingDesc ? (
            <div onClick={()=>{setDescInput(d.description||"");setEditingDesc(true);}}
              style={{color:d.description?T.muted:T.mutedDk,fontSize:12,marginTop:2,cursor:"pointer",fontStyle:d.description?"normal":"italic",
                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {d.description || "+ Add description"}
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"flex-start",gap:6,marginTop:4}}>
              <textarea value={descInput} onChange={e=>setDescInput(e.target.value)} autoFocus rows={2}
                placeholder="What is this document for?"
                style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:6,padding:"4px 8px",color:T.white,fontSize:12,outline:"none",fontFamily:font,resize:"vertical",flex:1,minWidth:180}}/>
              <button onClick={()=>saveDescription(descInput)} style={{background:"rgba(16,185,129,0.15)",color:T.green,border:"1px solid rgba(16,185,129,0.3)",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>✓</button>
              <button onClick={()=>setEditingDesc(false)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,fontFamily:font}}>✕</button>
            </div>
          )}
          <div style={{color:T.muted,fontSize:12,marginTop:2,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span>{d.date} · {d.size}{d.fileName?` · ${d.fileName.split(".").pop().toUpperCase()}`:""}</span>
            {/* Review date display / edit */}
            {!editingReview ? (
              <span onClick={()=>{setReviewInput(d.reviewDate||"");setEditingReview(true);}}
                style={{cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4,padding:"1px 7px",borderRadius:20,
                  background:reviewStatus?reviewStatus.bg:"rgba(255,255,255,0.06)",
                  border:`1px solid ${reviewStatus?reviewStatus.border:"rgba(255,255,255,0.1)"}`,
                  color:reviewStatus?reviewStatus.color:T.muted,fontSize:11,fontWeight:reviewStatus?700:400}}>
                {reviewOverdue?"⚠":reviewSoon?"⏳":"📅"}
                {reviewStatus ? reviewStatus.label : "Set review date"}
              </span>
            ) : (
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                <input type="date" value={reviewInput} onChange={e=>setReviewInput(e.target.value)} autoFocus
                  style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:6,padding:"2px 8px",color:T.white,fontSize:11,outline:"none",fontFamily:font}}/>
                <button onClick={()=>saveReviewDate(reviewInput)} style={{background:"rgba(16,185,129,0.15)",color:T.green,border:"1px solid rgba(16,185,129,0.3)",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>✓</button>
                {reviewInput && <button onClick={()=>saveReviewDate("")} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:11,fontFamily:font}}>Clear</button>}
                <button onClick={()=>setEditingReview(false)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,fontFamily:font}}>✕</button>
              </span>
            )}
            {bundleNames.length>0 && (
              <span title="Document bundles this document is part of" style={{display:"inline-flex",alignItems:"center",gap:4,padding:"1px 7px",borderRadius:20,background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.3)",color:"#60a5fa",fontSize:11,fontWeight:600}}>
                📚 {bundleNames.join(", ")}
              </span>
            )}
          </div>
        </div>
        <Pill label={d.type} col="navy"/>
        {assignedStaff.length>0 && (
          <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <Pill label={`✓ ${readCount} read`} col="green"/>
            {unreadCount>0 && <Pill label={`${unreadCount} unread`} col="red"/>}
          </div>
        )}
        {d.fileData && (
          <button onClick={()=>setPreviewDoc(d)} style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
            👁 View
          </button>
        )}
        {d.fileData && (
          <a href={d.fileData} download={d.fileName||d.title} style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,textDecoration:"none",whiteSpace:"nowrap"}}>
            ↓ Download
          </a>
        )}
        <button onClick={()=>setExpanded(v=>!v)}
          style={{background:expanded?"rgba(37,99,235,0.2)":T.headerBgMd,color:expanded?T.accentLt:T.muted,border:`1px solid ${expanded?T.accent+"55":T.borderMd}`,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
          {expanded ? "▲ Assign" : "▼ Assign"}{assignedStaff.length>0?` (${assignedStaff.length})`:""}
        </button>
        <label style={{background:"rgba(37,99,235,0.1)",color:"#93c5fd",border:"1px solid rgba(37,99,235,0.25)",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
          ↑ New Version
          <input type="file" accept={ACCEPT_IMG_DOCS} style={{display:"none"}}
            // NEW VERSION FLOW: pick file → NewVersionModal (minor/major + note) → uploadNewVersion().
            onChange={e=>{
              const file=e.target.files[0]; e.target.value=""; if(!file) return;
              setPendingFile(file);
            }}/>
        </label>
        <button onClick={()=>setShowVersions(v=>!v)}
          style={{background:showVersions?"rgba(37,99,235,0.2)":T.headerBgMd,color:showVersions?T.accentLt:T.muted,border:`1px solid ${showVersions?T.accent+"55":T.borderMd}`,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
          v{d.version||1} · Versions
        </button>
        {/* Remove is inside the Versions panel, away from the everyday buttons */}
      </div>
      {pendingFile && (
        <NewVersionModal kind="document" title={`${d.title} — ${pendingFile.name}`} fromVersion={d.version||1}
          affectedCount={Object.keys(docAcknowledgements).filter(uid=>docAcknowledgements[uid]&&docAcknowledgements[uid][d.id]).length}
          onConfirm={(change,note)=>{ const f=pendingFile; setPendingFile(null); uploadNewVersion(f,change,note); }}
          onCancel={()=>setPendingFile(null)} Z={T} font={font}/>
      )}
      {showVersions && (
        <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 20px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Version history</div>
          {versionRows.map(v=>{
            const reads = myHistory.filter(h=>(h.version||1)===v.version);
            const readers = Array.from(new Set(reads.map(h=>String(h.user_id))));
            return (
              <div key={v.version} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.border}`,flexWrap:"wrap"}}>
                <span style={{fontWeight:800,fontSize:13,color:v.current?T.gold:T.white,minWidth:36}}>v{v.version}</span>
                <span style={{fontSize:12,color:T.muted,flex:1,minWidth:160}}>
                  {v.current?"Current · ":""}{v.date||""}{v.fileName?` · ${v.fileName}`:""}{v.replacedOn?` · replaced ${v.replacedOn} (${v.replacedBy==="major"?"major":"minor"} change)`:""}
                  {v.note?<span style={{display:"block",color:T.slate}}>{v.note}</span>:null}
                </span>
                <span title={readers.map(uid=>(staff.find(u=>String(u.id)===uid)||{}).name||uid).join(", ")} style={{fontSize:12,color:T.green,fontWeight:700}}>{readers.length} read</span>
                {v.fileUrl && <a href={v.fileUrl} target="_blank" rel="noreferrer" style={{fontSize:12,color:T.accentLt,fontWeight:700,textDecoration:"none"}}>Open ↗</a>}
              </div>
            );
          })}
          <div style={{fontSize:11,color:T.muted,marginTop:8}}>Hover a "read" count to see who confirmed that version.</div>
          {/* Delete asks for confirmation first (it removes the file, assignments and read records).
              Risk-assessment documents are rebuilt from their RA on every load, so they can't be
              deleted here — the admin is told to delete or edit the risk assessment instead. */}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
            <button onClick={confirmDelete}
              style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
              🗑 Remove this document
            </button>
          </div>
        </div>
      )}
      {expanded && (
        <DocAssignPanel d={d} staff={staff} assignedIds={assignedIds} docAcknowledgements={docAcknowledgements} setDocAssignments={setDocAssignments} dbSaveDocAssignments={dbSaveDocAssignments} T={T} font={font}/>
      )}
    </div>
  );
}

export { DocCard };