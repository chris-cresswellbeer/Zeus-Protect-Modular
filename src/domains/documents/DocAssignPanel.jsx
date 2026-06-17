import React from "react";

function DocAssignPanel({ d, staff, assignedIds, docAcknowledgements, setDocAssignments, dbSaveDocAssignments, T, font }) {
  const [docSearch, setDocSearch] = React.useState("");
  const filteredForDoc = staff.filter(u=>
    u.name.toLowerCase().includes(docSearch.toLowerCase()) ||
    (u.jobTitle||"").toLowerCase().includes(docSearch.toLowerCase())
  );
  const assignedCount = assignedIds.length;
  const readCount = assignedIds.filter(uid=>(docAcknowledgements[String(uid)]||{})[String(d.id)]).length;
  return (
    <div style={{borderTop:`1px solid ${T.border}`,padding:"14px 20px",background:T.overlaySm}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:.5,color:T.muted,textTransform:"uppercase"}}>Assign to Staff</span>
          {assignedCount>0 && <span style={{fontSize:11,fontWeight:700,color:T.accentLt,background:"rgba(37,99,235,0.12)",border:`1px solid rgba(37,99,235,0.25)`,borderRadius:20,padding:"2px 8px"}}>{assignedCount} assigned · {readCount} read</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setDocAssignments(p=>{const ids=staff.map(u=>String(u.id));const next={...p,[String(d.id)]:ids};dbSaveDocAssignments(d.id,ids);return next;})} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${T.borderMd}`,background:T.headerBgMd,cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700,color:T.muted}}>✓ All</button>
          {assignedCount>0 && <button onClick={()=>setDocAssignments(p=>{const next={...p,[String(d.id)]:[]};dbSaveDocAssignments(d.id,[]);return next;})} style={{padding:"5px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,0.2)",background:"rgba(239,68,68,0.06)",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700,color:"#f87171"}}>✕ Clear</button>}
        </div>
      </div>
      <div style={{position:"relative",marginBottom:8}}>
        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,pointerEvents:"none"}}>🔍</span>
        <input value={docSearch} onChange={e=>setDocSearch(e.target.value)} placeholder="Search by name, job title or manager..." style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 10px 7px 32px",color:"#fff",fontSize:12,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
        {docSearch && <button onClick={()=>setDocSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:14,lineHeight:1,padding:0}}>✕</button>}
      </div>
      <div style={{maxHeight:220,overflowY:"auto",borderRadius:8,border:`1px solid ${T.border}`}}>
        {filteredForDoc.length===0 && <div style={{padding:"12px 14px",color:T.muted,fontSize:12,textAlign:"center"}}>No staff match your search</div>}
        {filteredForDoc.map((u,i)=>{
          const isAssigned = assignedIds.includes(String(u.id));
          const ack = (docAcknowledgements[String(u.id)]||{})[String(d.id)];
          return (
            <div key={u.id} onClick={()=>setDocAssignments(p=>{const cur=p[String(d.id)]||[];const newIds=isAssigned?cur.filter(x=>x!==String(u.id)):[...cur,String(u.id)];const next={...p,[String(d.id)]:newIds};dbSaveDocAssignments(d.id,newIds);return next;})}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",background:isAssigned?"rgba(37,99,235,0.06)":"transparent",transition:"background .15s"}}>
              <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${isAssigned?T.accent:T.borderMd}`,background:isAssigned?T.accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {isAssigned && <span style={{color:"#fff",fontSize:10,fontWeight:900,lineHeight:1}}>✓</span>}
              </div>
              <Avatar name={u.name} size={24}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:isAssigned?700:400,color:isAssigned?"#fff":T.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
                {u.jobTitle && <div style={{fontSize:10,color:T.muted,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.jobTitle}{u.manager?` · ${u.manager}`:""}</div>}
              </div>
              {isAssigned && <span style={{fontSize:10,fontWeight:700,flexShrink:0,color:ack?T.green:"#f87171"}}>{ack?`✓ Read ${ack.date}`:"⏳ Pending"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}


export { DocAssignPanel };
