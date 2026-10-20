/**
 * StaffAdminTab.jsx — Staff: add, import, edit and remove staff, temporary passwords, bulk actions
 * Part of app/screens/AdminPortal.jsx. Reads the app's shared state with useApp() (app/AppContext.js).
 */
import React from "react";
import { isPassed } from "../../../domains/training/completion";
import { staffTraining } from "../../../domains/training/compliance";
import { adminCall, makeTempPassword } from "../../../lib/auth";
import { dueInfo } from "../../../lib/dueDates";
import { E } from "../../../lib/emoji";
import { HelpTip } from "../../../shared/HelpTip";
import { MobileCard, MobileCardRow } from "../../../shared/hooks";
import { Avatar, Bar } from "../../../shared/primitives";
import { SortButton, sortRows } from "../../../shared/Sortable";
import { useApp } from "../../AppContext";
import { SignInAccountsPanel } from "../../lazyParts";

export function StaffAdminTab({ addStaff, removeStaff, staff }) {
  const {
    addErr, allModules, allUsers, assigns, bulkAssignModule, bulkGiveBundle, bulkMarkLeavers, bulkResetDone,
    bulkResetPw, bulkResetScope, bulkResetSelected, bulkSetManager, comps, csvError, csvPreview, dbSaveUser,
    dbSaveUserProfile, dueDates, font, giveNewStarterBundles, isMobile, lastLoginMap, newDepartment,
    newEmail, newIsWarehouse, newJobTitle, newManager, newName, newRole, newStatus, setAddErr, setAllUsers,
    setBulkResetDone, setBulkResetPw, setBulkResetScope, setBulkResetSelected, setCsvError, setCsvPreview,
    setEditingStaff, setNewDepartment, setNewEmail, setNewIsWarehouse, setNewJobTitle, setNewManager,
    setNewName, setNewRole, setNewStatus, setShowAddStaff, setShowBulkReset, setShowCsvImport,
    setShowWelcomeSettings, setStaffFilterManager, setStaffFilterProgress, setStaffFilterSearch,
    setStaffGroupByTeam, setStaffSel, setStaffSortBy, setStaffStatusFilter, setTempPasswordFor,
    setTempPwNotice, showAddStaff, showBulkReset, showCsvImport, staffDeptFilter, staffFilterManager,
    staffFilterProgress, staffFilterSearch, staffGroupByTeam, staffSel, staffSort, staffStatusFilter, T
  } = useApp();
  return (<div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Staff Accounts <HelpTip dark={false} text="All registered portal users. Use Edit to update roles, job titles and managers. Marking someone as Admin gives them full access to this panel. Removing a staff member does not delete their training records."/></h2>
            <p style={{color:T.muted,margin:0,fontSize:13}}>{staff.length} staff member{staff.length!==1?"s":""} registered</p>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setStaffGroupByTeam(g=>!g)}
              style={{background:staffGroupByTeam?`linear-gradient(135deg,${T.navyMd},${T.navy})`:T.overlay,color:staffGroupByTeam?T.gold:T.muted,border:`1px solid ${staffGroupByTeam?T.gold:T.borderMd}`,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
              👥 {staffGroupByTeam?"By Team ✓":"Group by Team"}
            </button>
            <button onClick={()=>setShowWelcomeSettings(true)} title="The video new staff see the first time they sign in"
              style={{background:T.overlay,color:T.white,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
              {E("🎬 ","")}Welcome video
            </button>
            <button onClick={()=>setShowCsvImport(v=>!v)}
              style={{background:showCsvImport?"rgba(239,68,68,0.1)":"rgba(16,185,129,0.1)",color:showCsvImport?"#f87171":T.green,border:showCsvImport?"1px solid rgba(239,68,68,0.25)":"1px solid rgba(16,185,129,0.25)",borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
              📥 {showCsvImport?"✕ Cancel":"Import CSV"}
            </button>
            <button onClick={()=>{setShowBulkReset(s=>!s);setBulkResetPw("");setBulkResetDone(false);setBulkResetSelected([]);}}
              style={{background:showBulkReset?`linear-gradient(135deg,#b91c1c,#991b1b)`:"rgba(239,68,68,0.1)",color:showBulkReset?"#fff":"#f87171",border:showBulkReset?"none":"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
              🔑 {showBulkReset?"✕ Cancel":"Reset Passwords"}
            </button>
            <button onClick={()=>{setShowAddStaff(s=>!s);setAddErr("");}}
              style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:`0 4px 16px ${T.accent}44`,display:"flex",alignItems:"center",gap:6}}>
              {showAddStaff ? "✕ Cancel" : "+ Add Staff Member"}
            </button>
          </div>
        </div>

        {/* Line managers: My Team matches each staff member's Line Manager text to the
            name of an account with the "Line manager" role. Flag the ones that don't match. */}
        <datalist id="zp-manager-names">{allUsers.filter(u=>u.role==="manager").map(u=><option key={u.id} value={u.name}/>)}</datalist>
        {(()=>{
          const nm = x => String(x||"").trim().replace(/\s+/g," ").toLowerCase();
          const mgrs = allUsers.filter(u=>u.role==="manager");
          if (!mgrs.length) return null;
          const names = new Set(mgrs.map(u=>nm(u.name)));
          const unmatched = staff.filter(u=>(u.status||"active")!=="leaver" && nm(u.manager) && !names.has(nm(u.manager)));
          if (!unmatched.length) return null;
          const lm = Array.from(new Set(unmatched.map(u=>u.manager.trim())));
          return (
            <div style={{background:`${T.amber}14`,border:`1px solid ${T.amber}55`,borderRadius:12,padding:"12px 16px",marginBottom:18,fontSize:13,color:T.slate,lineHeight:1.5}}>
              <b style={{color:T.amber}}>{unmatched.length} staff member{unmatched.length!==1?"s have a Line Manager":" has a Line Manager"} with no line-manager account:</b> {lm.slice(0,8).join(", ")}{lm.length>8?` +${lm.length-8} more`:""}.
              {" "}They won't appear in anyone's My Team. Edit the staff record so the Line Manager matches a manager's name exactly, or give that person the <b>Line manager</b> role.
            </div>
          );
        })()}

        {/* Sign-in accounts */}
        <SignInAccountsPanel users={allUsers} onShowPasswords={setTempPwNotice} Z={T} font={font}/>

        {/* Bulk Password Reset Panel */}
        {showBulkReset && (
          <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:20,border:"1px solid rgba(239,68,68,0.3)"}}>
            <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:700,letterSpacing:.5,color:"#f87171",textTransform:"uppercase"}}>🔑 Bulk Password Reset</h3>
            <p style={{color:T.muted,fontSize:12,marginBottom:18}}>Reset passwords for multiple staff members at once. They will need to change their password on next login.</p>

            {bulkResetDone ? (
              <div style={{padding:"14px 18px",background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,color:T.green,fontWeight:700,fontSize:13}}>
                ✓ Passwords reset successfully for {bulkResetScope==="all"?staff.length:bulkResetSelected.length} staff member{(bulkResetScope==="all"?staff.length:bulkResetSelected.length)!==1?"s":""}.
                <button onClick={()=>{setShowBulkReset(false);setBulkResetDone(false);}} style={{marginLeft:12,background:"none",border:"none",color:T.green,cursor:"pointer",fontSize:12,fontWeight:700,textDecoration:"underline"}}>Close</button>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
                <div>
                  <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>APPLY TO</label>
                  <div style={{display:"flex",gap:8,marginBottom:14}}>
                    {[["all","All Staff"],["selected","Selected Staff"]].map(([val,lbl])=>(
                      <button key={val} onClick={()=>setBulkResetScope(val)}
                        style={{flex:1,padding:"8px 14px",borderRadius:9,border:`2px solid ${bulkResetScope===val?"#f87171":T.borderMd}`,background:bulkResetScope===val?"rgba(239,68,68,0.12)":T.overlay,color:bulkResetScope===val?"#f87171":T.muted,fontWeight:bulkResetScope===val?700:400,cursor:"pointer",fontFamily:font,fontSize:12,transition:"all .15s"}}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {bulkResetScope==="selected" && (
                    <div style={{maxHeight:160,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:8,marginBottom:14}}>
                      {staff.map((u,i)=>(
                        <div key={u.id} onClick={()=>setBulkResetSelected(p=>p.includes(String(u.id))?p.filter(x=>x!==String(u.id)):[...p,String(u.id)])}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",background:bulkResetSelected.includes(String(u.id))?"rgba(239,68,68,0.06)":"transparent"}}>
                          <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${bulkResetSelected.includes(String(u.id))?"#ef4444":T.borderMd}`,background:bulkResetSelected.includes(String(u.id))?"#ef4444":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {bulkResetSelected.includes(String(u.id))&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
                          </div>
                          <Avatar name={u.name} size={20}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
                            <div style={{fontSize:10,color:T.muted}}>{u.jobTitle||u.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>NEW PASSWORD</label>
                  <input value={bulkResetPw} onChange={e=>setBulkResetPw(e.target.value)} placeholder="Enter new password for selected staff"
                    style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box",marginBottom:8}}/>
                  {bulkResetPw && bulkResetPw.length < 8 && <div style={{fontSize:11,color:"#f87171",marginBottom:8}}>Password must be at least 8 characters</div>}
                  <div style={{fontSize:11,color:T.muted,marginBottom:14}}>
                    This will reset passwords for <strong style={{color:T.white}}>{bulkResetScope==="all"?staff.length:bulkResetSelected.length} staff member{(bulkResetScope==="all"?staff.length:bulkResetSelected.length)!==1?"s":""}</strong>.
                  </div>
                  <button
                    disabled={!bulkResetPw||bulkResetPw.length<8||(bulkResetScope==="selected"&&bulkResetSelected.length===0)}
                    onClick={async()=>{
                      const targets = bulkResetScope==="all" ? staff.map(u=>u.id) : bulkResetSelected;
                      // Temporary password on each sign-in account; leavers are skipped.
                      const failures = [];
                      for (const id of targets) {
                        const su = allUsers.find(x=>x.id===id); if (!su || (su.status||"active")==="leaver") continue;
                        const r = await setTempPasswordFor(su, bulkResetPw);
                        if (!r.ok) failures.push({ name: su.name, error: r.error });
                      }
                      if (failures.length) setTempPwNotice({ title: "Some passwords weren't reset", items: [], failures });
                      setBulkResetDone(true);
                      setBulkResetPw("");
                    }}
                    style={{width:"100%",background:(!bulkResetPw||bulkResetPw.length<8||(bulkResetScope==="selected"&&bulkResetSelected.length===0))?"rgba(239,68,68,0.3)":`linear-gradient(135deg,#ef4444,#b91c1c)`,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:(!bulkResetPw||bulkResetPw.length<8)?"not-allowed":"pointer",fontFamily:font,fontSize:13,opacity:(!bulkResetPw||bulkResetPw.length<8||(bulkResetScope==="selected"&&bulkResetSelected.length===0))?.5:1}}>
                    🔑 Reset {bulkResetScope==="all"?"All":bulkResetSelected.length} Password{(bulkResetScope==="all"?staff.length:bulkResetSelected.length)!==1?"s":""}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CSV Import Panel */}
        {showCsvImport && (
          <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:20,border:"1px solid rgba(16,185,129,0.3)"}}>
            <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:700,letterSpacing:.5,color:T.green,textTransform:"uppercase"}}>📥 Import Staff from CSV</h3>
            <p style={{color:T.muted,fontSize:12,marginBottom:16}}>Upload a CSV file with columns: <code style={{color:T.gold,background:"rgba(245,158,11,0.1)",padding:"1px 6px",borderRadius:4}}>name, email, jobTitle, manager, department, role</code> — role should be "admin" or "staff".</p>
            {csvError && <div style={{marginBottom:12,padding:"8px 14px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,color:"#f87171",fontSize:12}}>{csvError}</div>}
            <label style={{display:"inline-flex",alignItems:"center",gap:8,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,marginBottom:csvPreview.length>0?16:0}}>
              📂 Choose CSV File
              <input type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={e=>{
                const file=e.target.files[0]; if(!file) return;
                setCsvError(""); setCsvPreview([]);
                // Simple CSV parser: splits on commas, so a quoted value containing a comma
                // (e.g. "Smith, John") will be mis-split. Use a CSV library if that's needed.
                const reader=new FileReader();
                reader.onload=ev=>{
                  const lines=ev.target.result.replace(/\r/g,"").split("\n").filter(l=>l.trim());
                  if(lines.length<2){setCsvError("CSV must have a header row and at least one data row.");return;}
                  const headers=lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/[^a-z]/g,""));
                  const nameIdx=headers.findIndex(h=>h==="name"||h==="fullname");
                  const emailIdx=headers.findIndex(h=>h==="email");
                  if(nameIdx===-1||emailIdx===-1){setCsvError("CSV must have 'name' and 'email' columns.");return;}
                  const jobIdx=headers.findIndex(h=>h==="jobtitle"||h==="title"||h==="position");
                  const managerIdx=headers.findIndex(h=>h==="manager");
                  const deptIdx=headers.findIndex(h=>h==="department"||h==="dept");
                  const roleIdx=headers.findIndex(h=>h==="role");
                  const rows=lines.slice(1).map(line=>{
                    const cols=line.split(",").map(c=>c.trim().replace(/^"|"$/g,""));
                    return {name:cols[nameIdx]||"",email:cols[emailIdx]||"",jobTitle:jobIdx>-1?cols[jobIdx]||"":"",manager:managerIdx>-1?cols[managerIdx]||"":"",department:deptIdx>-1?cols[deptIdx]||"":"",role:roleIdx>-1?cols[roleIdx]||"staff":"staff"};
                  }).filter(r=>r.name&&r.email);
                  if(rows.length===0){setCsvError("No valid rows found. Check name and email columns.");return;}
                  setCsvPreview(rows);
                };
                reader.readAsText(file);
                e.target.value="";
              }}/>
            </label>
            {csvPreview.length>0 && (
              <div>
                <div style={{fontSize:12,fontWeight:700,color:T.green,marginBottom:8}}>✓ Preview — {csvPreview.length} staff found</div>
                <div style={{maxHeight:200,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:10,marginBottom:14}}>
                  {csvPreview.slice(0,10).map((r,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"8px 14px",borderTop:i>0?`1px solid ${T.border}`:"none",fontSize:12}}>
                      <span style={{color:T.white,fontWeight:600}}>{r.name}</span>
                      <span style={{color:T.muted}}>{r.email}</span>
                      <span style={{color:T.muted}}>{r.jobTitle||r.department||r.role}</span>
                    </div>
                  ))}
                  {csvPreview.length>10 && <div style={{padding:"6px 14px",fontSize:11,color:T.muted,borderTop:`1px solid ${T.border}`}}>+{csvPreview.length-10} more…</div>}
                </div>
                <button onClick={async()=>{
                  const existingEmails=new Set(staff.map(u=>u.email.toLowerCase()));
                  const toAdd=csvPreview.filter(r=>!existingEmails.has(r.email.toLowerCase()));
                  const skipped=csvPreview.length-toAdd.length;
                  if(toAdd.length===0){setCsvError("All emails already exist in the system.");return;}
                  // Imported users get sequential numeric ids after the current max id.
                  const maxId=Math.max(0,...allUsers.map(u=>u.id));
                  const newUsers=toAdd.map((r,i)=>({id:maxId+i+1,name:r.name.trim(),email:r.email.trim().toLowerCase(),jobTitle:r.jobTitle,manager:r.manager,department:r.department,role:["admin","manager"].includes(r.role)?r.role:"staff",isWarehouseWorker:false,status:"active"}));
                  // Save the records, then give each person a sign-in account with a temporary password.
                  setAllUsers(p=>[...p,...newUsers]);
                  newUsers.forEach(u=>dbSaveUserProfile(u));
                  await Promise.all(newUsers.map(u=>dbSaveUser(u)));
                  giveNewStarterBundles(newUsers.map(u=>u.id));
                  const passwords = Object.fromEntries(newUsers.map(u=>[String(u.id), makeTempPassword()]));
                  const r = await adminCall("createMissing", { passwords });
                  const byId = Object.fromEntries(newUsers.map(u=>[String(u.id), u]));
                  const results = r.ok ? (r.results||[]) : newUsers.map(u=>({ userId:String(u.id), ok:false, error:r.error }));
                  setTempPwNotice({ title: `Imported ${toAdd.length} staff${skipped>0?` (${skipped} skipped: email already exists)`:""}`,
                    items: results.filter(x=>x.ok).map(x=>({ name: byId[x.userId].name, login: byId[x.userId].email, password: passwords[x.userId] })),
                    failures: results.filter(x=>!x.ok).map(x=>({ name: (byId[x.userId]||{}).name, error: x.error })) });
                  setCsvPreview([]);
                  setShowCsvImport(false);
                }} style={{background:`linear-gradient(135deg,${T.green},#059669)`,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,boxShadow:"0 4px 14px rgba(16,185,129,0.3)"}}>
                  ✓ Import {csvPreview.length} Staff
                </button>
                {csvPreview.length!==csvPreview.filter(r=>!staff.some(u=>u.email.toLowerCase()===r.email.toLowerCase())).length && (
                  <span style={{fontSize:11,color:T.muted,marginLeft:12}}>{csvPreview.filter(r=>staff.some(u=>u.email.toLowerCase()===r.email.toLowerCase())).length} duplicate email{csvPreview.filter(r=>staff.some(u=>u.email.toLowerCase()===r.email.toLowerCase())).length!==1?"s":""} will be skipped</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Add Staff Form */}
        {showAddStaff && (
          <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:20,border:`1px solid ${T.accent}44`}}>
            <h3 style={{margin:"0 0 18px",fontSize:14,fontWeight:700,letterSpacing:.5,color:T.muted}}>NEW STAFF MEMBER</h3>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:14}}>
              <div>
                <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>FULL NAME *</label>
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Jane Doe"
                  style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>EMAIL ADDRESS *</label>
                <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="jane@company.co.uk"
                  style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>JOB TITLE</label>
                <input value={newJobTitle} onChange={e=>setNewJobTitle(e.target.value)} placeholder="e.g. Warehouse Operative"
                  style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>LINE MANAGER</label>
                <input value={newManager} onChange={e=>setNewManager(e.target.value)} placeholder="e.g. John Smith" list="zp-manager-names"
                  style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>PORTAL ROLE</label>
                <select value={newRole} onChange={e=>setNewRole(e.target.value)}
                  style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer",boxSizing:"border-box"}}>
                  <option value="staff">Staff</option>
                  <option value="manager">Line manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {/* Department */}
            <div style={{marginBottom:14}}>
              <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:1,display:"block",marginBottom:6}}>DEPARTMENT</label>
              <input value={newDepartment} onChange={e=>setNewDepartment(e.target.value)} placeholder="e.g. Warehouse, Sales, Finance"
                style={{width:"100%",padding:"11px 14px",background:T.headerBg,border:`1px solid ${T.borderMd}`,borderRadius:10,color:T.white,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:font}}/>
            </div>
            {/* Status */}
            <div style={{marginBottom:14}}>
              <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:1,display:"block",marginBottom:6}}>STATUS</label>
              <div style={{display:"flex",gap:8}}>
                {[["active","✓ Active","#10b981"],["inactive","⏸ Inactive","#f59e0b"],["leaver","👋 Leaver","#94a3b8"]].map(([val,lbl,col])=>(
                  <button key={val} onClick={()=>setNewStatus(val)}
                    style={{flex:1,padding:"8px",borderRadius:9,border:`2px solid ${newStatus===val?col:T.borderMd}`,background:newStatus===val?`${col}18`:T.overlay,color:newStatus===val?col:T.muted,fontWeight:newStatus===val?700:400,cursor:"pointer",fontFamily:font,fontSize:12}}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {/* Warehouse Worker toggle */}
            <div onClick={()=>setNewIsWarehouse(s=>!s)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderRadius:12,marginBottom:14,cursor:"pointer",userSelect:"none",background:newIsWarehouse?"rgba(245,158,11,0.08)":T.overlay,border:`2px solid ${newIsWarehouse?"rgba(245,158,11,0.4)":T.borderMd}`,transition:"all .2s"}}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:T.white,marginBottom:2}}>🏗 Is Warehouse Worker?</div>
                <div style={{fontSize:11,color:T.muted}}>Tick to enable machinery competence tracking for this person</div>
              </div>
              <div style={{flexShrink:0,marginLeft:16,width:44,height:24,borderRadius:12,background:newIsWarehouse?"#f59e0b":T.borderMd,position:"relative",transition:"background .2s"}}>
                <div style={{position:"absolute",top:3,left:newIsWarehouse?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <button onClick={addStaff}
                style={{background:`linear-gradient(135deg,${T.green},#059669)`,color:T.white,border:"none",borderRadius:10,padding:"10px 24px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:14,boxShadow:"0 4px 14px rgba(16,185,129,0.4)"}}>
                ✓ Create Account
              </button>
              <p style={{color:T.muted,fontSize:12,margin:0}}>A temporary password is created and shown once. They choose their own at first sign-in.</p>
            </div>
            {addErr && <p style={{color:"#f87171",fontSize:13,margin:"10px 0 0"}}>{addErr}</p>}
          </div>
        )}

        {/* Filter bar */}
        {(()=>{
          const managers = ["all", ...Array.from(new Set(staff.map(u=>u.manager||"").filter(Boolean))).sort()];
          const selStyle = {background:T.headerBg,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"8px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"};
          const filteredStaff = staff.filter(u=>{
            if (staffStatusFilter!=="all" && (u.status||"active")!==staffStatusFilter) return false;
            if (staffDeptFilter!=="all" && (u.department||"")!==staffDeptFilter) return false;
            if (staffFilterManager!=="all" && (u.manager||"")!==staffFilterManager) return false;
            if (staffFilterSearch) {
              const q = staffFilterSearch.toLowerCase();
              if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.jobTitle||"").toLowerCase().includes(q)) return false;
            }
            if (staffFilterProgress!=="all") {
              const _tr=staffTraining(u.id, assigns, comps, allModules), a=_tr.total, d=_tr.good, pct=_tr.pct;   // training/compliance.js
              if (staffFilterProgress==="compliant" && pct!==100) return false;
              if (staffFilterProgress==="inprogress" && (pct===100||pct===0)) return false;
              if (staffFilterProgress==="overdue" && (a===0 || pct!==0)) return false;   // nothing started (people with no modules are under "No Modules")
              if (staffFilterProgress==="incomplete" && !(a>0 && d<a)) return false;    // dashboard "Training Incomplete"
              if (staffFilterProgress==="pastdue" && !(assigns[u.id]||[]).some(mid=>{ const di=dueInfo(dueDates,u.id,mid,isPassed((comps[u.id]||{})[mid])); return di&&di.overdue; })) return false;
              if (staffFilterProgress==="none" && a!==0) return false;
            }
            return true;
          });
          const activeFilters = (staffFilterManager!=="all"?1:0)+(staffFilterSearch?1:0)+(staffFilterProgress!=="all"?1:0)+(staffStatusFilter!=="all"?1:0);
          // Tick boxes for bulk actions. Ticks survive filtering, so you can tick people from different searches.
          const shownIds = filteredStaff.map(u=>String(u.id));
          const selIds = staffSel.filter(id=>staff.some(u=>String(u.id)===id));
          const allShownSel = shownIds.length>0 && shownIds.every(id=>selIds.includes(id));
          const someShownSel = shownIds.some(id=>selIds.includes(id));
          const toggleSel = id => setStaffSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
          const toggleMany = (ids, on) => setStaffSel(p=>on?[...new Set([...p,...ids])]:p.filter(id=>!ids.includes(id)));
          const runBulk = async fn => { if (await fn(selIds)) setStaffSel([]); };
          // Group by Team: sorted by line manager, with a heading (and tick box) per team
          const teamOf2 = u => (u.manager||"").trim() || "No line manager";
          // Column sort (click a heading); with Group by Team, sorted within each team
          const pctOf = u => { const a=(assigns[u.id]||[]).length; if(!a) return null; return Math.round((assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length/a*100); };
          const ordered = sortRows(filteredStaff, staffSort, {
            name: u=>u.name, email: u=>String(u.email||"").toLowerCase(), job: u=>u.jobTitle, manager: u=>u.manager,
            progress: pctOf, last: u=>lastLoginMap[u.id]||"0000",
          }, staffGroupByTeam ? (a,b)=>((teamOf2(a)==="No line manager")-(teamOf2(b)==="No line manager") || teamOf2(a).localeCompare(teamOf2(b))) : null);
          const sh = (label, by) => <SortButton label={label} by={by} sort={staffSort} onSort={setStaffSortBy} Z={T} font={font}/>;
          const teamHead = (u,i,mobile) => {
            if (!staffGroupByTeam || (i>0 && teamOf2(ordered[i-1])===teamOf2(u))) return null;
            const ids = ordered.filter(x=>teamOf2(x)===teamOf2(u)).map(x=>String(x.id));
            const on = ids.every(id=>selIds.includes(id)), some = ids.some(id=>selIds.includes(id));
            return (
              <div key={`team-${teamOf2(u)}`} data-testid="team-head" style={{display:"flex",alignItems:"center",gap:10,padding:mobile?"10px 4px 6px":"10px 20px",background:mobile?"transparent":T.overlay,borderTop:i>0&&!mobile?`1px solid ${T.border}`:"none",fontSize:12,fontWeight:800,color:T.gold,letterSpacing:.3}}>
                <input type="checkbox" checked={on} ref={el=>{ if(el) el.indeterminate=!on&&some; }} onChange={()=>toggleMany(ids,!on)} aria-label={`Tick everyone in ${teamOf2(u)}'s team`} style={{width:16,height:16,cursor:"pointer"}}/>
                <span>{teamOf2(u)==="No line manager"?"No line manager":`${teamOf2(u)}'s team`}</span>
                <span style={{color:T.muted,fontWeight:600}}>· {ids.length}</span>
              </div>
            );
          };
          const bulkBtn = (label, fn, danger) => (
            <button onClick={()=>runBulk(fn)} style={{background:danger?"rgba(239,68,68,0.12)":T.overlay,color:danger?"#f87171":T.white,border:`1px solid ${danger?"rgba(239,68,68,0.35)":T.borderMd}`,borderRadius:9,padding:"8px 13px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>{label}</button>
          );
          return (
            <>
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"14px 18px",marginBottom:14,border:`1px solid ${T.border}`,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                {/* Search */}
                <div style={{position:"relative",flex:"1 1 180px",minWidth:150}}>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:T.muted,fontSize:14,pointerEvents:"none"}}>🔍</span>
                  <input value={staffFilterSearch} onChange={e=>setStaffFilterSearch(e.target.value)} placeholder="Search name, email, job title..."
                    style={{...selStyle,paddingLeft:36,width:"100%",boxSizing:"border-box"}}/>
                </div>
                {/* Status filter */}
                <select value={staffStatusFilter} onChange={e=>setStaffStatusFilter(e.target.value)} style={selStyle}>
                  <option value="all">All Status</option>
                  <option value="active">✓ Active</option>
                  <option value="inactive">⏸ Inactive</option>
                  <option value="leaver">👋 Leavers</option>
                </select>
                {/* Manager filter */}
                <select value={staffFilterManager} onChange={e=>setStaffFilterManager(e.target.value)} style={selStyle}>
                  <option value="all">All Managers</option>
                  {managers.filter(m=>m!=="all").map(m=><option key={m} value={m}>{m}</option>)}
                  {staff.some(u=>!u.manager) && <option value="">No Manager</option>}
                </select>
                {/* Progress filter */}
                <select value={staffFilterProgress} onChange={e=>setStaffFilterProgress(e.target.value)} style={selStyle}>
                  <option value="all">All Progress</option>
                  <option value="compliant">✓ Compliant</option>
                  <option value="incomplete">Not complete (any)</option>
                  <option value="pastdue">Past due date</option>
                  <option value="inprogress">In Progress</option>
                  <option value="overdue">Not started</option>
                  <option value="none">No Modules</option>
                </select>
                {/* Clear */}
                {activeFilters>0 && (
                  <button onClick={()=>{setStaffFilterManager("all");setStaffFilterSearch("");setStaffFilterProgress("all");setStaffStatusFilter("all");}}
                    style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                    ✕ Clear {activeFilters} filter{activeFilters!==1?"s":""}
                  </button>
                )}
                <span style={{color:T.muted,fontSize:12,marginLeft:"auto",whiteSpace:"nowrap"}}>
                  {filteredStaff.length} of {staff.length} staff
                </span>
              </div>

              {/* Bulk actions for the ticked people */}
              {selIds.length>0 && (
                <div role="region" aria-label="Bulk actions" data-testid="bulk-bar" style={{position:"sticky",top:8,zIndex:20,background:`linear-gradient(135deg,${T.accent},${T.blue})`,borderRadius:14,padding:"10px 14px",marginBottom:14,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",boxShadow:"0 10px 30px rgba(0,0,0,.35)"}}>
                  <span style={{fontWeight:800,fontSize:13,color:"#fff",marginRight:6}}>{selIds.length} ticked{selIds.some(id=>!shownIds.includes(id))?` (${selIds.filter(id=>!shownIds.includes(id)).length} not shown)`:""}</span>
                  {bulkBtn(E("📚 ","")+"Assign a module", bulkAssignModule)}
                  {bulkBtn(E("📦 ","")+"Give a document bundle", bulkGiveBundle)}
                  {bulkBtn(E("👤 ","")+"Set line manager", bulkSetManager)}
                  {bulkBtn(E("👋 ","")+"Mark as leavers", bulkMarkLeavers, true)}
                  <button onClick={()=>setStaffSel([])} style={{marginLeft:"auto",background:"transparent",border:"1px solid rgba(255,255,255,.45)",color:"#fff",borderRadius:9,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>Clear ticks</button>
                </div>
              )}

              {/* Staff Table */}
              {isMobile ? (
                <div>
                  {filteredStaff.length===0 && <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14}}>{staff.length===0?"No staff members yet.":"No staff match filters."}</div>}
                  {filteredStaff.length>0 && (
                    <label style={{display:"flex",alignItems:"center",gap:10,fontSize:13,color:T.muted,padding:"4px 4px 10px",cursor:"pointer"}}>
                      <input type="checkbox" checked={allShownSel} ref={el=>{ if(el) el.indeterminate=!allShownSel&&someShownSel; }} onChange={()=>toggleMany(shownIds,!allShownSel)} style={{width:20,height:20}}/>
                      Tick everyone shown ({shownIds.length})
                    </label>
                  )}
                  {ordered.map((u,i)=>{
                    const tr=staffTraining(u.id, assigns, comps, allModules), a=tr.total, d=tr.good, pct=tr.pct;   // training/compliance.js
                    const barColor={green:T.green,amber:T.accent,red:"#ef4444"}[tr.band.key]||T.muted;
                    const lastActive=lastLoginMap[u.id];
                    return (
                      <React.Fragment key={u.id}>
                      {teamHead(u,i,true)}
                      <MobileCard>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                          <input type="checkbox" checked={selIds.includes(String(u.id))} onChange={()=>toggleSel(String(u.id))} aria-label={`Tick ${u.name}`} style={{width:20,height:20,flexShrink:0}}/>
                          <Avatar name={u.name} size={36}/>
                          <div>
                            <div style={{fontWeight:700,fontSize:15,color:T.white}}>{u.name}</div>
                            <div style={{fontSize:12,color:T.muted}}>{u.email}</div>
                          </div>
                        </div>
                        {u.jobTitle && <MobileCardRow label="Job Title" value={<span>{u.jobTitle}{u.isWarehouseWorker&&" 🏗"}</span>}/>}
                        {u.manager && <MobileCardRow label="Manager" value={u.manager}/>}
                        <MobileCardRow label="Progress" value={<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,color:barColor}}>{d}/{a}</span><Bar pct={pct} color={barColor}/></div>}/>
                        <MobileCardRow label="Last Active" value={<span style={{color:lastActive?T.muted:"#f87171"}}>{lastActive?lastActive.slice(0,10):"Never"}</span>}/>
                        <div style={{display:"flex",gap:8,marginTop:4}}>
                          <button onClick={()=>setEditingStaff(u)} style={{flex:1,background:"rgba(37,99,235,0.15)",color:T.accentLt,border:`1px solid ${T.accent}44`,borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>✏ Edit</button>
                          <button onClick={()=>removeStaff(u.id)} style={{flex:1,background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>Remove</button>
                        </div>
                      </MobileCard>
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
                <div style={{display:"grid",gridTemplateColumns:"34px 2fr 2fr 2fr 2fr 2fr 120px 160px",padding:"12px 20px",background:T.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase",columnGap:0,alignItems:"center"}}>
                  <span><input type="checkbox" checked={allShownSel} ref={el=>{ if(el) el.indeterminate=!allShownSel&&someShownSel; }} onChange={()=>toggleMany(shownIds,!allShownSel)} aria-label={`Tick everyone shown (${shownIds.length})`} title="Tick everyone shown" disabled={!shownIds.length} style={{width:16,height:16,cursor:"pointer"}}/></span>
                  <span style={{paddingRight:12}}>{sh("Name","name")}</span><span style={{paddingRight:12}}>{sh("Email","email")}</span><span style={{paddingRight:12}}>{sh("Job Title","job")}</span><span style={{paddingRight:12}}>{sh("Manager","manager")}</span><span style={{paddingRight:12}}>{sh("Progress","progress")}</span><span style={{paddingRight:12}}>{sh("Last Active","last")}</span><span></span>
                </div>
                {filteredStaff.length===0 && <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14}}>{staff.length===0?"No staff members yet. Add one above.":"No staff match the current filters."}</div>}
                {ordered.map((u,i)=>{
                  const tr=staffTraining(u.id, assigns, comps, allModules), a=tr.total, d=tr.good, pct=tr.pct;   // training/compliance.js
                  const barColor={green:T.green,amber:T.accent,red:"#ef4444"}[tr.band.key]||T.muted;
                  const lastActive=lastLoginMap[u.id];
                  const ticked=selIds.includes(String(u.id));
                  return (
                    <React.Fragment key={u.id}>
                    {teamHead(u,i,false)}
                    <div data-testid="staff-row" style={{display:"grid",gridTemplateColumns:"34px 2fr 2fr 2fr 2fr 2fr 120px 160px",padding:"14px 20px",borderTop:i>0||staffGroupByTeam?`1px solid ${T.border}`:"none",alignItems:"center",columnGap:0,opacity:u.status==="leaver"?0.6:1,background:ticked?"rgba(37,99,235,0.10)":"transparent"}}>
                      <span><input type="checkbox" checked={ticked} onChange={()=>toggleSel(String(u.id))} aria-label={`Tick ${u.name}`} style={{width:16,height:16,cursor:"pointer"}}/></span>
                      <div style={{display:"flex",alignItems:"center",gap:10,paddingRight:12,minWidth:0}}>
                        <Avatar name={u.name} size={32}/>
                        <div style={{minWidth:0}}>
                          <span style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{u.name}</span>
                          {u.status==="inactive" && <span style={{fontSize:9,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,0.12)",padding:"1px 6px",borderRadius:4,border:"1px solid rgba(245,158,11,0.25)"}}>INACTIVE</span>}
                          {u.status==="leaver"   && <span style={{fontSize:9,fontWeight:700,color:"#94a3b8",background:"rgba(148,163,184,0.12)",padding:"1px 6px",borderRadius:4,border:"1px solid rgba(148,163,184,0.25)"}}>LEAVER</span>}
                        </div>
                      </div>
                      <span style={{color:T.muted,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:12}}>{u.email}</span>
                      <span style={{color:T.muted,fontSize:12,whiteSpace:"nowrap",paddingRight:12,display:"flex",alignItems:"center",gap:6}}>{u.jobTitle||<span style={{color:T.muted}}>—</span>}{u.isWarehouseWorker&&<span style={{fontSize:9,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,0.1)",padding:"1px 5px",borderRadius:99,border:"1px solid rgba(245,158,11,0.25)",flexShrink:0}}>🏗</span>}</span>
                      <span style={{color:T.muted,fontSize:12,whiteSpace:"nowrap",paddingRight:12}}>{u.manager||<span style={{color:T.muted}}>—</span>}</span>
                      <div style={{display:"flex",alignItems:"center",gap:8,paddingRight:12}}><span style={{fontWeight:700,color:barColor,fontSize:12,minWidth:28,flexShrink:0}}>{d}/{a}</span><Bar pct={pct} color={barColor}/></div>
                      <span style={{color:lastActive?T.muted:"#f87171",fontSize:11,paddingRight:12,whiteSpace:"nowrap"}}>{lastActive?lastActive.slice(0,10):<span title="Has not logged in">Never</span>}</span>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>setEditingStaff(u)} style={{flex:1,background:"rgba(37,99,235,0.15)",color:T.accentLt,border:`1px solid ${T.accent}44`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>✏ Edit</button>
                        <button onClick={()=>removeStaff(u.id)} style={{flex:1,background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>Remove</button>
                      </div>
                    </div>
                    </React.Fragment>
                  );
                })}
              </div>)}
            </>
          );
        })()}
      </div>
    </div>);
}
