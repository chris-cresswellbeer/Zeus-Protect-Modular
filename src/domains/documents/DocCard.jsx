import React from "react";

function DocCard({ d, staff, assignedIds, assignedStaff, readCount, unreadCount, icon, docAcknowledgements, setDocAcknowledgements, setDocAssignments, dbSaveDocAssignments, setDocs, dbDeleteDoc, dbSaveDoc, setPreviewDoc, T, font }) {
  const [expanded, setExpanded] = React.useState(false);
  const [editingReview, setEditingReview] = React.useState(false);
  const [reviewInput, setReviewInput] = React.useState(d.reviewDate||"");
  const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
  const docIcon = extIcons[d.ext] || "📄";

  const today = new Date().toISOString().slice(0,10);
  const reviewDate = d.reviewDate || null;
  const daysToReview = reviewDate ? Math.ceil((new Date(reviewDate) - new Date()) / 86400000) : null;
  const reviewOverdue = daysToReview !== null && daysToReview < 0;
  const reviewSoon = daysToReview !== null && daysToReview >= 0 && daysToReview <= 30;
  const reviewStatus = reviewOverdue ? {label:`Review overdue by ${Math.abs(daysToReview)}d`, color:"#f87171", bg:"rgba(239,68,68,0.12)", border:"rgba(239,68,68,0.3)"}
    : reviewSoon ? {label:`Review due in ${daysToReview}d`, color:"#f59e0b", bg:"rgba(245,158,11,0.12)", border:"rgba(245,158,11,0.3)"}
    : reviewDate ? {label:`Review: ${reviewDate}`, color:T.muted, bg:"transparent", border:"transparent"}
    : null;

  function saveReviewDate(val) {
    const updated = {...d, reviewDate: val||null};
    setDocs(p=>p.map(x=>x.id===d.id?updated:x));
    dbSaveDoc(updated, null);
    setEditingReview(false);
  }

  return (
    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,border:`1px solid ${reviewOverdue?"rgba(239,68,68,0.4)":reviewSoon?"rgba(245,158,11,0.35)":T.border}`,overflow:"hidden"}}>
      <div style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <span style={{fontSize:26,flexShrink:0}}>{docIcon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.title}</div>
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
            onChange={e=>{
              const file=e.target.files[0]; if(!file) return;
              if(!window.confirm(`Upload "${file.name}" as a new version of "${d.title}"?\n\nThis will clear all existing staff acknowledgements.`)) return;
              const ext2=file.name.split(".").pop().toUpperCase();
              const path2=`doc_${d.id}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
              const fileUrl2=sb.storage.getPublicUrl("documents",path2);
              const newDoc={...d,version:(d.version||1)+1,date:new Date().toISOString().slice(0,10),size:`${(file.size/1024).toFixed(0)} KB`,fileName:file.name,ext:ext2,fileData:fileUrl2,fileUrl:fileUrl2};
              setDocAcknowledgements(p=>{
                const n={};
                Object.keys(p).forEach(uid=>{
                  n[uid]={...p[uid]};
                  if(n[uid][d.id]) { delete n[uid][d.id]; sb.from("doc_acknowledgements").delete().match({user_id:String(uid),doc_id:String(d.id)}); }
                });
                return n;
              });
              setDocs(p=>p.map(x=>x.id===d.id?newDoc:x));
              sb.storage.upload("documents",path2,file).then(()=>{
                newDoc.fileUrl=sb.storage.getPublicUrl("documents",path2);
                newDoc.fileData=newDoc.fileUrl;
                setDocs(p=>p.map(x=>x.id===d.id?newDoc:x));
                dbSaveDoc(newDoc,null);
              });
              e.target.value="";
            }}/>
        </label>
        <button onClick={()=>{setDocs(p=>p.filter(x=>x.id!==d.id));dbDeleteDoc(d.id,d.fileName);}}
          style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
          Remove
        </button>
      </div>
      {expanded && (
        <DocAssignPanel d={d} staff={staff} assignedIds={assignedIds} docAcknowledgements={docAcknowledgements} setDocAssignments={setDocAssignments} dbSaveDocAssignments={dbSaveDocAssignments} T={T} font={font}/>
      )}
    </div>
  );
}

export { DocCard };
