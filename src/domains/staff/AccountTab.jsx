import React, { useState } from "react";
import { useWindowWidth } from "../../shared/hooks";
import { Avatar } from "../../shared/primitives";
import { hashPassword, DEFAULT_HASH } from "../../lib/supabase";

function AccountTab({ user, passwords, setPasswords, darkMode, setDarkMode, theme, setTheme, onSaveTheme, emojiMode, onSaveEmojiMode, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [oldPw,    setOldPw]    = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [confirmPw,setConfirmPw]= useState("");
  const [pwMsg,    setPwMsg]    = useState(null);
  const [showOld,  setShowOld]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);

  const currentPassword = passwords[user.id] || DEFAULT_HASH;
  const strength = newPw.length >= 12 ? 3 : newPw.length >= 8 ? 2 : newPw.length >= 6 ? 1 : 0;
  const strengthLabels = ["Too short","Weak","Good","Strong"];
  const strengthColors = ["#ef4444","#f59e0b",Z.accentLt,Z.green];

  const changePassword = async () => {
    const oldHash = await hashPassword(oldPw);
    // Support both plain-text (legacy) and hashed comparison
    if (oldHash !== currentPassword && oldPw !== currentPassword) {
      setPwMsg({type:"error", text:"Current password is incorrect."}); return;
    }
    if (newPw.length < 6) { setPwMsg({type:"error", text:"New password must be at least 6 characters."}); return; }
    if (newPw !== confirmPw) { setPwMsg({type:"error", text:"New passwords do not match."}); return; }
    if (newPw === oldPw) { setPwMsg({type:"error", text:"New password must differ from your current password."}); return; }
    const newHash = await hashPassword(newPw);
    setPasswords(p=>({...p,[user.id]:newHash}));
    setOldPw(""); setNewPw(""); setConfirmPw("");
    setPwMsg({type:"success", text:"Password changed successfully."});
  };

  const card = {background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:28,border:`1px solid ${Z.border}`};
  const inputStyle = {width:"100%",background:Z.headerBg,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 44px 11px 14px",color:Z.white,fontSize:14,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const labelStyle = {color:Z.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6};

  const fields = [
    {label:"CURRENT PASSWORD",    val:oldPw,     set:setOldPw,     show:showOld,  toggle:()=>setShowOld(s=>!s)},
    {label:"NEW PASSWORD",         val:newPw,     set:setNewPw,     show:showNew,  toggle:()=>setShowNew(s=>!s)},
    {label:"CONFIRM NEW PASSWORD", val:confirmPw, set:setConfirmPw, show:showConf, toggle:()=>setShowConf(s=>!s)},
  ];

  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:24,color:Z.white}}>My Account</h2>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20,maxWidth:800}}>

        {/* Profile */}
        <div style={card}>
          <h3 style={{fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,margin:"0 0 20px",textTransform:"uppercase"}}>Profile</h3>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
            <Avatar name={user.name} size={56}/>
            <div>
              <div style={{fontWeight:800,fontSize:18,color:Z.white}}>{user.name}</div>
              <div style={{color:Z.muted,fontSize:13,marginTop:3}}>{user.jobTitle||""}</div>
            </div>
          </div>
          {[
            {label:"Email",     val:user.email},
            {label:"Job Title", val:user.jobTitle||"—"},
            {label:"Manager",   val:user.manager||"—"},
            {label:"Role",      val:user.role==="admin"?"Administrator":"Staff"},
          ].map(row=>(
            <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${Z.border}`}}>
              <span style={{color:Z.muted,fontSize:13}}>{row.label}</span>
              <span style={{color:Z.white,fontSize:13,fontWeight:600}}>{row.val}</span>
            </div>
          ))}
        </div>

        {/* Change Password */}
        <div style={card}>
          <h3 style={{fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,margin:"0 0 20px",textTransform:"uppercase"}}>Change Password</h3>
          {fields.map(field=>(
            <div key={field.label} style={{marginBottom:14}}>
              <label style={labelStyle}>{field.label}</label>
              <div style={{position:"relative"}}>
                <input type={field.show?"text":"password"} value={field.val}
                  onChange={e=>{field.set(e.target.value); setPwMsg(null);}}
                  placeholder="••••••••" style={inputStyle}/>
                <button onClick={field.toggle}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:Z.muted,cursor:"pointer",fontSize:14,padding:0,lineHeight:1}}>
                  {field.show?"🙈":"👁"}
                </button>
              </div>
            </div>
          ))}
          {newPw.length > 0 && (
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",gap:4,marginBottom:4}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{flex:1,height:4,borderRadius:99,background:i<strength?strengthColors[strength]:Z.border,transition:"background .3s"}}/>
                ))}
              </div>
              <span style={{fontSize:11,color:strengthColors[strength],fontWeight:700}}>{strengthLabels[strength]}</span>
            </div>
          )}
          {pwMsg && (
            <div style={{marginBottom:14,padding:"10px 14px",background:pwMsg.type==="success"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",border:`1px solid ${pwMsg.type==="success"?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`,borderRadius:10,fontSize:13,color:pwMsg.type==="success"?Z.green:"#f87171",fontWeight:600}}>
              {pwMsg.type==="success"?"✓ ":"⚠ "}{pwMsg.text}
            </div>
          )}
          <button onClick={changePassword} disabled={!oldPw||!newPw||!confirmPw}
            style={{width:"100%",background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:14,opacity:(!oldPw||!newPw||!confirmPw)?.45:1,boxShadow:`0 4px 16px ${Z.accent}44`}}>
            Update Password
          </button>
        </div>


          {/* Theme toggle — spans full width of grid */}
        <div style={{...card,gridColumn:isMobile?"1":"1 / -1",padding:24}}>
          <h3 style={{fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,margin:"0 0 16px",textTransform:"uppercase"}}>Display Theme</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
            {[
              {key:"dark",     label:"🌙 Dark Mode",      desc:"Default navy",       preview:["#060d2e","#0d1f5c","#2563eb"]},
              {key:"light",    label:"☀️ Light Mode",     desc:"Clean & bright",     preview:["#e8edf7","#ffffff","#2563eb"]},
              {key:"slate",    label:"◼ Midnight Slate",  desc:"Charcoal + teal",    preview:["#0d1117","#1a1f2e","#0d9488"]},
              {key:"forest",   label:"🌲 Deep Forest",    desc:"Dark green + amber", preview:["#0a150a","#1a2e1a","#16a34a"]},
              {key:"graphite", label:"⬛ Graphite & Gold", desc:"Near-black + gold",  preview:["#0a0a0a","#1c1c1e","#f59e0b"]},
              {key:"arctic",   label:"🌌 Aurora",          desc:"Deep purple + cyan",  preview:["#0a0718","#1a1033","#06b6d4"]},
              {key:"sand",     label:"🏜 Warm Sand",      desc:"Cream & terracotta", preview:["#f0e6d3","#fdf8f0","#c2522a"]},
              {key:"rose",     label:"🌸 Rose",             desc:"Blush & deep rose",   preview:["#fce7ed","#fff0f3","#e11d48"]},
            ].map(opt=>{
              const isActive = theme===opt.key;
              return (
                <button key={opt.key} onClick={()=>{ setTheme(opt.key); setDarkMode(opt.key==="dark"||opt.key==="slate"||opt.key==="forest"||opt.key==="graphite"||opt.key==="arctic"); if(onSaveTheme) onSaveTheme(opt.key); }}
                  style={{padding:"12px 14px",borderRadius:12,border:`2px solid ${isActive?Z.accent:Z.border}`,background:isActive?`rgba(37,99,235,0.12)`:Z.overlay,cursor:"pointer",textAlign:"left",fontFamily:font,transition:"all .2s"}}>
                  {/* Colour swatch */}
                  <div style={{display:"flex",gap:4,marginBottom:8}}>
                    {opt.preview.map((c,i)=><div key={i} style={{width:18,height:18,borderRadius:4,background:c,border:"1px solid rgba(255,255,255,0.15)"}}/>)}
                  </div>
                  <div style={{fontWeight:700,fontSize:13,color:isActive?Z.accentLt:Z.white,marginBottom:2}}>{opt.label}</div>
                  <div style={{fontSize:11,color:Z.muted}}>{opt.desc}</div>
                  {isActive && <div style={{marginTop:5,fontSize:10,color:Z.accentLt,fontWeight:700,letterSpacing:.5}}>✓ ACTIVE</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Professional Mode toggle — spans full width */}
        <div style={{...card,gridColumn:isMobile?"1":"1 / -1",padding:24}}>
          <h3 style={{fontSize:13,fontWeight:700,letterSpacing:.5,color:Z.muted,margin:"0 0 4px",textTransform:"uppercase"}}>Display Preferences</h3>
          <p style={{fontSize:12,color:Z.muted,margin:"0 0 20px",lineHeight:1.5}}>Control how the portal presents information. Professional Mode removes decorative emoji from navigation, headers, and UI labels throughout the portal.</p>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",background:Z.overlay,borderRadius:12,border:`1px solid ${!emojiMode?"rgba(37,99,235,0.35)":Z.borderMd}`,transition:"border .2s"}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:Z.white,marginBottom:3}}>
                {emojiMode ? "Standard Mode" : "Professional Mode"}
              </div>
              <div style={{fontSize:12,color:Z.muted}}>
                {emojiMode
                  ? "Emoji icons are shown throughout the portal interface"
                  : "Emoji icons are hidden — clean text-only labels"}
              </div>
            </div>
            <button onClick={()=>{ const next=!emojiMode; onSaveEmojiMode(next); }}
              style={{
                position:"relative", width:52, height:28, borderRadius:99,
                background:!emojiMode?`linear-gradient(135deg,${Z.accent},${Z.blue})`:"rgba(100,116,139,0.3)",
                border:"none", cursor:"pointer", transition:"background .25s", flexShrink:0,
              }}>
              <span style={{
                position:"absolute", top:3, left:!emojiMode?26:3,
                width:22, height:22, borderRadius:"50%", background:"#fff",
                transition:"left .25s", display:"block", boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
              }}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AccountTab };
