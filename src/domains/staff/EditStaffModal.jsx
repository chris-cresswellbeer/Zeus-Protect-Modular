import React, { useState } from "react";
import { useWindowWidth } from "../../shared/hooks";
import { Avatar } from "../../shared/primitives";
import { hashPassword } from "../../lib/supabase";

function EditStaffModal({ staffUser, allUsers, setAllUsers, passwords, setPasswords, onClose, onSaveProfile, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [name,              setName]             = useState(staffUser.name);
  const [email,             setEmail]            = useState(staffUser.email);
  const [jobTitle,          setJobTitle]         = useState(staffUser.jobTitle||"");
  const [manager,           setManager]          = useState(staffUser.manager||"");
  const [role,              setRole]             = useState(staffUser.role);
  const [isWarehouse,       setIsWarehouse]      = useState(staffUser.isWarehouseWorker||false);
  const [department,        setDepartment]       = useState(staffUser.department||"");
  const [status,            setStatus]           = useState(staffUser.status||"active");
  const [resetPw,           setResetPw]          = useState(false);
  const [newPw,    setNewPw]    = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [err,      setErr]      = useState("");
  const [saved,    setSaved]    = useState(false);

  const save = () => {
    if (!name.trim()) { setErr("Name is required."); return; }
    if (!email.trim() || !email.includes("@")) { setErr("Valid email is required."); return; }
    if (email !== staffUser.email && allUsers.find(u=>u.email===email.trim())) { setErr("That email is already in use."); return; }
    if (resetPw && newPw.length < 6) { setErr("New password must be at least 6 characters."); return; }
    const updated = {...staffUser, name:name.trim(), email:email.trim(), jobTitle:jobTitle.trim(), manager:manager.trim(), role, isWarehouseWorker:isWarehouse, department:department.trim(), status};
    setAllUsers(p=>p.map(u=>u.id===staffUser.id ? updated : u));
    if (onSaveProfile) onSaveProfile(updated);
    if (resetPw && newPw) {
      hashPassword(newPw).then(hashed => {
        setPasswords(p=>({...p,[staffUser.id]:hashed}));
      });
    }
    setSaved(true); setErr("");
    setTimeout(onClose, 900);
  };

  const inputStyle = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 14px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const labelStyle = {color:Z.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6};

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:`linear-gradient(160deg,${Z.navyMd},${Z.navyDk})`,borderRadius:20,padding:32,width:"100%",maxWidth:520,border:`1px solid ${Z.borderMd}`,boxShadow:"0 30px 80px rgba(0,0,0,.6)"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,paddingBottom:18,borderBottom:`1px solid ${Z.border}`}}>
          <Avatar name={staffUser.name} size={40}/>
          <div style={{flex:1}}>
            <h2 style={{margin:0,fontSize:18,fontWeight:900,color:Z.white,letterSpacing:-.5}}>Edit Staff Member</h2>
            <p style={{margin:0,color:Z.muted,fontSize:12,marginTop:2}}>{staffUser.email}</p>
          </div>
          <button onClick={onClose} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"6px 12px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>✕</button>
        </div>

        {/* Status */}
        <div style={{marginBottom:14}}>
          <label style={labelStyle}>STATUS</label>
          <div style={{display:"flex",gap:8}}>
            {[["active","✓ Active","#10b981"],["inactive","⏸ Inactive","#f59e0b"],["leaver","👋 Leaver","#94a3b8"]].map(([val,lbl,col])=>(
              <button key={val} onClick={()=>setStatus(val)}
                style={{flex:1,padding:"8px",borderRadius:9,border:`2px solid ${status===val?col:Z.borderMd}`,background:status===val?`${col}18`:Z.overlay,color:status===val?col:Z.muted,fontWeight:status===val?700:400,cursor:"pointer",fontFamily:font,fontSize:12}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {/* Fields */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
          <div>
            <label style={labelStyle}>FULL NAME *</label>
            <input value={name} onChange={e=>{setName(e.target.value);setErr("");setSaved(false);}} style={inputStyle} placeholder="Full name"/>
          </div>
          <div>
            <label style={labelStyle}>EMAIL ADDRESS *</label>
            <input value={email} onChange={e=>{setEmail(e.target.value);setErr("");setSaved(false);}} style={inputStyle} placeholder="email@zeus.com"/>
          </div>
          <div>
            <label style={labelStyle}>JOB TITLE</label>
            <input value={jobTitle} onChange={e=>{setJobTitle(e.target.value);setSaved(false);}} style={inputStyle} placeholder="e.g. Warehouse Operative"/>
          </div>
          <div>
            <label style={labelStyle}>LINE MANAGER</label>
            <input value={manager} onChange={e=>{setManager(e.target.value);setSaved(false);}} style={inputStyle} placeholder="e.g. John Smith"/>
          </div>
          <div>
            <label style={labelStyle}>DEPARTMENT</label>
            <input value={department} onChange={e=>{setDepartment(e.target.value);setSaved(false);}} style={inputStyle} placeholder="e.g. Warehouse, Sales"/>
          </div>
          <div>
            <label style={labelStyle}>PORTAL ROLE</label>
            <select value={role} onChange={e=>{setRole(e.target.value);setSaved(false);}}
              style={{...inputStyle,cursor:"pointer"}}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {/* Warehouse Worker toggle */}
        <div onClick={()=>{setIsWarehouse(s=>!s);setSaved(false);}}
          style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderRadius:12,marginBottom:14,cursor:"pointer",userSelect:"none",background:isWarehouse?"rgba(245,158,11,0.08)":Z.overlay,border:`2px solid ${isWarehouse?"rgba(245,158,11,0.4)":Z.overlay}`,transition:"all .2s"}}>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:Z.white,marginBottom:3}}>🏗 Is Warehouse Worker?</div>
            <div style={{fontSize:11,color:Z.muted,lineHeight:1.4}}>Enables machinery competence tracking and the Machinery tab in this staff member's profile. Only tick for warehouse, logistics, production, and maintenance roles.</div>
          </div>
          <div style={{flexShrink:0,marginLeft:16,width:44,height:24,borderRadius:12,background:isWarehouse?"#f59e0b":Z.borderMd,position:"relative",transition:"background .2s"}}>
            <div style={{position:"absolute",top:3,left:isWarehouse?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
          </div>
        </div>

        {/* Password reset section */}
        <div style={{background:Z.overlay,borderRadius:12,padding:16,marginBottom:16,border:`1px solid ${Z.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:resetPw?14:0}}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:Z.white}}>Reset Password</div>
              <div style={{color:Z.muted,fontSize:11,marginTop:2}}>Set a new password for this staff member</div>
            </div>
            <button onClick={()=>{setResetPw(s=>!s);setNewPw("");setErr("");setSaved(false);}}
              style={{background:resetPw?`rgba(37,99,235,0.2)`:Z.overlay,border:`1px solid ${resetPw?Z.accent:Z.borderMd}`,borderRadius:8,padding:"6px 14px",color:resetPw?Z.accentLt:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12}}>
              {resetPw?"✕ Cancel":"Set New Password"}
            </button>
          </div>
          {resetPw && (
            <div>
              <label style={labelStyle}>NEW PASSWORD (min. 6 characters)</label>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} value={newPw}
                  onChange={e=>{setNewPw(e.target.value);setErr("");setSaved(false);}}
                  placeholder="••••••••"
                  style={{...inputStyle,paddingRight:44}}/>
                <button onClick={()=>setShowPw(s=>!s)}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:Z.muted,cursor:"pointer",fontSize:14,padding:0}}>
                  {showPw?"🙈":"👁"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error / success */}
        {err && (
          <div style={{marginBottom:14,padding:"10px 14px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,fontSize:13,color:"#f87171",fontWeight:600}}>
            ⚠ {err}
          </div>
        )}
        {saved && (
          <div style={{marginBottom:14,padding:"10px 14px",background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,fontSize:13,color:Z.green,fontWeight:600}}>
            ✓ Changes saved successfully
          </div>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={save}
            style={{flex:1,background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:14,boxShadow:`0 4px 16px ${Z.accent}44`}}>
            Save Changes
          </button>
          <button onClick={onClose}
            style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:14}}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}


export { EditStaffModal };
