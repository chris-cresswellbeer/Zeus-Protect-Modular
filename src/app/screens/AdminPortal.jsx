/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/screens/AdminPortal.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * The admin portal: the admin menus, notification bell and tabs (`atab`).
 *
 * Reads the app's shared state and actions with useApp() (app/AppContext.js). Moved out of
 * App.jsx in October 2026 without changing what it shows.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { BackupPanel } from "../../domains/audit/BackupPanel";
import { withoutMember } from "../../domains/documents/bundles";
import { generateStaffPDF } from "../../domains/training/generateStaffPDF";
import { auditEvent } from "../../lib/audit";
import { checkPassword as authCheckPassword, changeOwnPassword, makeTempPassword } from "../../lib/auth";
import { isSuperAdmin } from "../../lib/brandCore";
import { todayISO } from "../../lib/dates";
import { E, EmojiCtx } from "../../lib/emoji";
import { languageOf } from "../../lib/i18n";
import { ask, notify } from "../../shared/Feedback";
import { BrandLogo } from "../../shared/Logo";
import { NavMenu } from "../../shared/NavMenu";
import { NewVersionModal } from "../../shared/NewVersionModal";
import { NotificationBell } from "../../shared/NotificationBell";
import { Avatar, Pill } from "../../shared/primitives";
import { QuickSearch } from "../../shared/QuickSearch";
import { ScrollNav } from "../../shared/ScrollNav";
import { WelcomeReplay, WelcomeVideoSettings } from "../../shared/WelcomeVideo";
import { getTheme, oppositeTheme } from "../../theme/tokens";
import { useApp } from "../AppContext";
import { adminNotifications } from "../bell/adminNotifications";
import { EditStaffModal, EquipmentPage, LazyAccountTab, LazyAdminIncidentTab, LazyAdminMachineryTab, LazyAuditTrailTab, LazyContractorsTab, LazyCoshhTab, LazyCreateModuleTab, LazyEquipmentTrackerTab, LazyFireSafetyTab, LazyFirstAidRegisterTab, LazyInvestigationTab, LazyPermitsTab, LazyReportsTab, LazyRiskAssessmentTab, LazySiteInspectionsTab, LazySiteSettingsTab, LoneWorkingTab, ModulePreviewModal, PpeRegisterTab, PreviewModal, RackingTab, TempPasswordsModal } from "../lazyParts";
import { AdminDashboard } from "./admin/AdminDashboard";
import { AssignTrainingTab } from "./admin/AssignTrainingTab";
import { DocumentsTab } from "./admin/DocumentsTab";
import { ModuleLibraryTab } from "./admin/ModuleLibraryTab";
import { StaffAdminTab } from "./admin/StaffAdminTab";

// Admin portal. `atab` selects the tab. Top nav groups several tabs into dropdowns
// (Training: assign/modules/create/reports, M&E: machinery/equipment,
// Contractors: contractors/permits, Documents: documents/coshh).
export function AdminPortal() {
  const {
    acceptInvestigationBase, adminReportView, adminResponses, allMachineCategories, allMachineTypes,
    allModules, allUsers, askDueDate, assigns, atab, chooseLanguage, compHistory, comps, contractorCerts,
    contractorInductions, contractors, contractorVisits, coshhAssessments, customChemicals,
    customMachineTypes, darkMode, dbDeleteContractor, dbDeleteCustomMachineType, dbDeleteExtCert,
    dbDeleteFraDocument, dbDeleteIncident, dbDeleteMachineComp, dbDeletePermit, dbDeletePersonRecords,
    dbDeleteTranslation, dbDeleteUser, dbSaveAssigns, dbSaveBundle, dbSaveContractor, dbSaveContractorCerts,
    dbSaveContractorInductions, dbSaveContractorVisits, dbSaveEmojiMode, dbSaveExtCert, dbSaveMachineComp,
    dbSavePermit, dbSaveRA, dbSaveTheme, dbSaveTranslation, dbSaveUser, dbSaveUserProfile,
    dbUploadFraDocument, docAcknowledgements, docAssignments, docBundles, docs, dseReports, dueDates,
    editingModule, editingStaff, emojiMode, equipment, extCerts, fetchInvestigation, fireSafety,
    firstAidData, focusContractorId, focusIncidentId, font, giveNewStarterBundles, incidents, investigations,
    investigationView, isMobile, lastBackup, lastLoginMap, logout, loneBar, loneSessions, loneSettings,
    machineComps, matrixAssign, mobileMenuOpen, moduleTrans, moduleVersions, msdsFiles, navBtn, navCompact,
    navTight, navTiny, newAssignDue, newDepartment, newEmail, newIsWarehouse, newJobTitle, newManager,
    newName, newRole, newStatus, noteDue, openInAssign, pagePreset, pendingModuleSave, permits, ppeFocus, refreshContractors, signinSettings,
    ppeRows, ppeSettings, previewDoc, previewModule, quickItems, quizFailures, racking, rackInspector,
    rackWindow, ras, saveModuleVersion, setAddErr, setAdminReportView, setAdminResponses, setAllUsers,
    setAssigns, setAtab, setCompHistory, setComps, setContractorCerts, setContractorInductions,
    setContractors, setContractorVisits, setCoshhAssessments, setCustomChemicals, setCustomMachineTypes,
    setCustomModules, setDarkMode, setDocAckHistory, setDocAcknowledgements, setDocAssignments,
    setDocBundles, setDocs, setDseReports, setDueDates, setEditingModule, setEditingStaff, setEmojiMode,
    setEquipment, setExtCerts, setFireSafety, setFirstAidData, setFocusContractorId, setFocusIncidentId,
    setIncidents, setInvestigations, setInvestigationView, setLastBackup, setMachineComps, setMobileMenuOpen,
    setMsdsFiles, setNewDepartment, setNewEmail, setNewIsWarehouse, setNewJobTitle, setNewManager,
    setNewName, setNewRole, setNewStatus, setPagePreset, setPendingModuleSave, setPermits, setPpeFocus,
    setPreviewDoc, setPreviewModule, setQuizFailures, setRas, setRecordFor, setShowAddStaff,
    setShowAdminReportForm, setShowWelcomeSettings, setSiteInspections, setStab, setStaffFilterManager,
    setStaffFilterProgress, setStaffFilterSearch, setStaffStatusFilter, setTempPasswordFor, setTempPwNotice,
    setTheme, setView, showAdminReportForm, showWelcomeSettings, siteInspections, siteSignins, T,
    tempPwNotice, theme, user, userLang, winW
  } = useApp();
  // ⚠ Strict !== 1: if the primary admin's id is stored as the STRING "1" it will not be excluded.
  const staff = allUsers.filter(u=>u.id!==1); // show all users except the primary admin account

  // Assign/unassign one module for one user (saves just that user's list).
  // Adding one uses the page's "Due by" choice; removing one also drops its due date.
  const toggleAssign = (uid, mid) => {
    const suid = String(uid);
    const c = assigns[suid]||[];
    const adding = !c.includes(mid);
    const updated = adding ? [...c,mid] : c.filter(x=>x!==mid);
    const due = adding && newAssignDue() ? { [suid]: { [mid]: newAssignDue() } } : null;
    setAssigns(p=>({...p,[suid]:updated}));
    if (due) noteDue(due);
    if (!adding) setDueDates(p=>{ if(!(p[suid]||{})[mid]) return p; const m={...p[suid]}; delete m[mid]; return {...p,[suid]:m}; });
    dbSaveAssigns({[suid]: updated}, due);
  };

  // Manual "Add staff" form. id = Date.now() (a large number; the users table stores it as TEXT).
  // New users sign in with a temporary password shown once to the admin, and choose
  // their own at first sign-in.
  const addStaff = () => {
    if (!newName.trim()) { setAddErr("Name is required."); return; }
    if (!newEmail.trim() || !newEmail.includes("@")) { setAddErr("Valid email is required."); return; }
    if (allUsers.find(u=>u.email===newEmail.trim())) { setAddErr("Email already exists."); return; }
    const id = Date.now();
    const newUser = { id, name:newName.trim(), email:newEmail.trim(), role:newRole, jobTitle:newJobTitle.trim(), manager:newManager.trim(), isWarehouseWorker:newIsWarehouse, department:newDepartment.trim(), status:newStatus };
    setAllUsers(p=>[...p, newUser]);
    // Save the record, then create their sign-in account with a temporary password.
    (async () => {
      await dbSaveUser(newUser);
      if ((newUser.status||"active") === "leaver") return;
      giveNewStarterBundles([id]);
      const pw = makeTempPassword();
      const r = await setTempPasswordFor(newUser, pw);
      setTempPwNotice(r.ok
        ? { title: `Sign-in account created for ${newUser.name}`, items: [{ name: newUser.name, login: newUser.email.toLowerCase(), password: pw }], failures: [] }
        : { title: "Sign-in account not created", items: [], failures: [{ name: newUser.name, error: r.error }] });
    })();
    dbSaveUserProfile(newUser);
    setNewName(""); setNewEmail(""); setNewJobTitle(""); setNewManager(""); setNewRole("staff"); setNewIsWarehouse(false); setNewDepartment(""); setNewStatus("active"); setAddErr(""); setShowAddStaff(false);
  };

  // Remove = delete the staff record, their sign-in account and ALL their personal
  // records (training, reading, DSE, certificates, machinery, preferences). Incidents,
  // investigations, inspections and the Audit Trail are kept. For people who leave,
  // use the Leaver status instead (keeps everything for audit).
  const removeStaff = async (uid) => {
    const u = allUsers.find(x=>x.id===uid);
    const sid = String(uid);
    const n = {
      results: Object.keys(comps[sid]||{}).length, assigned: (assigns[sid]||[]).length,
      docs: Object.keys(docAcknowledgements[sid]||{}).length, dse: (dseReports[sid]||dseReports[uid]||[]).length,
      certs: Object.keys(extCerts[sid]||extCerts[uid]||{}).length,
    };
    const detail = [`${n.results} training result${n.results!==1?"s":""}`, `${n.assigned} assigned module${n.assigned!==1?"s":""}`,
      `${n.docs} document confirmation${n.docs!==1?"s":""}`, `${n.dse} DSE assessment${n.dse!==1?"s":""}`, `${n.certs} external certificate${n.certs!==1?"s":""}`].join(", ");
    if (!(await ask({ title: `Remove ${u?.name||"this staff member"} completely?`, danger: true, ok: "Remove permanently", message: `This permanently deletes their staff record, sign-in account and personal records: ${detail}, plus their training and reading history, machinery competences and preferences. It can't be undone.\n\nIncidents they reported, investigations and the Audit Trail are kept.\n\nIf they have left the company, cancel and set their status to Leaver instead — that keeps their training record for audits.` }))) return;
    setAllUsers(p=>p.filter(u=>u.id!==uid));
    const strip = o => { const c={...o}; delete c[sid]; delete c[uid]; return c; };
    setAssigns(strip); setComps(strip); setDocAcknowledgements(strip); setDseReports(strip); setAdminResponses(strip); setExtCerts(strip); setMachineComps(strip);
    setDocAssignments(p=>Object.fromEntries(Object.entries(p).map(([d,ids])=>[d,(ids||[]).filter(x=>String(x)!==sid)])));
    setCompHistory(p=>p.filter(h=>String(h.user_id)!==sid)); setDocAckHistory(p=>p.filter(h=>String(h.user_id)!==sid));
    setQuizFailures(p=>p.filter(f=>String(f.userId)!==sid));
    const inBundles = withoutMember(docBundles, sid);
    if (inBundles.length) { setDocBundles(p=>p.map(b=>inBundles.find(c=>c.id===b.id)||b)); await Promise.all(inBundles.map(dbSaveBundle)); }
    await dbDeleteUser(uid);
    const ok = await dbDeletePersonRecords(uid);
    auditEvent("staff", sid, "remove", `Removed staff member and their records (${detail})${ok ? "" : " — some records could not be deleted"}`, {}, u?.name || sid);
    if (!ok) notify("The staff member was removed, but some of their records couldn't be deleted. Try again later or check the Audit Trail.", { kind: "error" });
    else notify(`${u?.name||"Staff member"} and their records were removed.`);
  };

  return (
    <EmojiCtx.Provider value={emojiMode}>
    <div className="zp-shell" style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.white,overflowX:"hidden"}}>
      <PreviewModal doc={previewDoc} onClose={()=>setPreviewDoc(null)} Z={T} font={font}/>
      {/* ▲/▼ top-of-page / bottom-of-page buttons on long screens (shared/ScrollNav.jsx) */}
      <ScrollNav bottom={24} Z={T} font={font}/>
      {pendingModuleSave && (
        <NewVersionModal kind="module" title={pendingModuleSave.m.title || "Training module"}
          fromVersion={pendingModuleSave.prev.version || 1}
          affectedCount={Object.keys(comps).filter(uid => comps[uid] && comps[uid][pendingModuleSave.m.id]).length}
          onConfirm={saveModuleVersion} onCancel={() => setPendingModuleSave(null)} Z={T} font={font}/>
      )}
      {editingStaff && (
        <EditStaffModal
          staffUser={editingStaff}
          allUsers={allUsers} setAllUsers={setAllUsers} onSaveProfile={u=>{dbSaveUser(u);dbSaveUserProfile(u);}}
          onSetTempPassword={async (su, pw) => {
            const r = await setTempPasswordFor(su, pw);
            if (!r.ok) setTempPwNotice({ title: "Password not changed", items: [], failures: [{ name: su.name, error: r.error }] });
          }}
          onClose={()=>setEditingStaff(null)}
          Z={T} font={font}
        />
      )}
      {tempPwNotice && <TempPasswordsModal {...tempPwNotice} onClose={()=>setTempPwNotice(null)} Z={T} font={font}/>}
      {showWelcomeSettings && <WelcomeVideoSettings user={user} onClose={()=>setShowWelcomeSettings(false)} Z={T} font={font}/>}
      {loneBar()}
      {rackWindow()}
      {/* Nav */}
      <div style={{background:`linear-gradient(90deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:isMobile?"0 12px":navTight?"0 16px":"0 28px",display:"flex",alignItems:"center",position:"relative",flexWrap:isMobile?"nowrap":"wrap",rowGap:0}}>
        <div style={{marginRight:isMobile?8:navTight?14:28,padding:"12px 0",flexShrink:0}}><BrandLogo darkMode={darkMode}/></div>
        {!isMobile && !navCompact && <><div style={{width:1,height:28,background:T.headerBgMd,marginRight:8}}/><Pill label="ADMIN" col="navy"/><div style={{width:1,height:20,background:T.headerBgMd,margin:"0 12px"}}/></>}
        {!isMobile && (()=>{
          // Menus grouped by the kind of work (Oct 2026): people, training, incidents, risk,
          // site safety, then equipment, contractors, documents and reports. Site Settings and
          // the Audit Trail are under the ⚙ by your name.
          const STAFF_TABS=["users","machinery"]; const staffActive=STAFF_TABS.includes(atab);
          const TRAINING_TABS=["assign","modules","create"]; const trainingActive=TRAINING_TABS.includes(atab);
          const RISK_TABS=["ra","coshh","inspections","permits"]; const riskActive=RISK_TABS.includes(atab);
          const SAFETY_TABS=["firesafety","firstaid","lone","ppe"]; const safetyActive=SAFETY_TABS.includes(atab);
          const menuBtn = a => ({...navBtn(a,T.gold),maxWidth:"none",whiteSpace:"nowrap"});
          return (<>
            <button onClick={()=>setAtab("dashboard")} style={navBtn(atab==="dashboard",T.gold)}>Dashboard</button>
            <NavMenu label="Staff" testId="nav-staff" active={staffActive} items={[["users","Staff"],["machinery","Machinery Competence"]]} current={atab} onPick={setAtab} btnStyle={menuBtn(staffActive)} Z={T} font={font}/>
            <NavMenu label="Training" testId="nav-training" active={trainingActive} items={[["assign","Assign Training"],["modules","Training Library"],["create","Create Module"]]} current={atab} onPick={setAtab} btnStyle={menuBtn(trainingActive)} Z={T} font={font}/>
            <button onClick={()=>setAtab("incidents")} style={navBtn(atab==="incidents"||atab==="investigation",T.gold)}>Incidents</button>
            <NavMenu label="Risk" testId="nav-risk" active={riskActive} items={[["ra","Risk Assessments"],["coshh","COSHH Register"],["inspections","Inspections"],["permits","Permits to Work"]]} current={atab} onPick={setAtab} btnStyle={menuBtn(riskActive)} Z={T} font={font}/>
            <NavMenu label="Site Safety" testId="nav-safety" active={safetyActive} items={[["firesafety","Fire Safety"],["firstaid","First Aid"],...(loneSettings.enabled||atab==="lone"?[["lone","Lone Working"]]:[]),["ppe","PPE Register"]]} current={atab} onPick={setAtab} btnStyle={menuBtn(safetyActive)} Z={T} font={font}/>
            <button onClick={()=>setAtab("equipment")} style={navBtn(atab==="equipment",T.gold)}>Equipment</button>
            <button onClick={()=>setAtab("contractors")} style={navBtn(atab==="contractors",T.gold)}>Contractors</button>
            <button onClick={()=>setAtab("documents")} style={navBtn(atab==="documents",T.gold)}>Documents</button>
            <button onClick={()=>setAtab("reports")} style={navBtn(atab==="reports",T.gold)}>Reports</button>
          </>);
        })()}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:isMobile?6:navCompact?6:10}}>
          {isMobile && (<button onClick={()=>setMobileMenuOpen(m=>!m)} style={{background:"none",border:`1px solid ${T.borderMd}`,borderRadius:8,color:T.white,fontSize:20,cursor:"pointer",padding:"4px 10px",lineHeight:1,fontFamily:font,flexShrink:0}}>{mobileMenuOpen?"✕":"☰"}</button>)}
          {(()=>{
            // Admin notification list (same shape as the staff one; nav.tab = admin tab key).
            // Thresholds used: training/certificates expiring ≤EXPIRY_WARNING_DAYS (lib/dates.js), RA/doc review ≤30d, drill >365d,
            // fire warden cert default 36 months.
            // the list itself: app/bell/adminNotifications.js
            const notifications = adminNotifications({
              adminResponses, allMachineTypes, allModules, assigns, comps, contractorCerts, contractors, contractorVisits, permits, signinSettings,
              docAcknowledgements, docAssignments, docs, dseReports, dueDates, extCerts, fireSafety, incidents,
              lastBackup, loneSessions, machineComps, ppeRows, ppeSettings, quizFailures, racking,
              rackInspector, ras, siteInspections, siteSignins, staff
            });
            return <NotificationBell notifications={notifications} onNavigate={n=>{ if(n.preset) setPagePreset(n.preset); if(n.staffProgress){ setStaffFilterSearch(""); setStaffFilterManager("all"); setStaffStatusFilter("all"); setStaffFilterProgress(n.staffProgress); } setAtab(n.tab);if(n.view)setAdminReportView(n.view);}} Z={T} font={font}/>;
          })()}
          <QuickSearch getItems={quickItems} Z={T} font={font} compact={winW<2200}/>
          {!navCompact && <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>}
          {/* My Training — lets an admin see/complete their own assigned training via the staff view */}
          <button onClick={()=>{ setStab("training"); setView("staff"); }}
            title="My Training: your own assigned training" aria-label="My Training"
            style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:navCompact?"5px 9px":"5px 12px",color:T.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,display:"flex",alignItems:"center",gap:5,transition:"all .15s",whiteSpace:"nowrap"}}>
            {navCompact
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>
              : <>{E("📚 ","")}My Training</>}
          </button>
          {!navCompact && <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>}
          {/* Quick theme cycle button */}
          {!navTiny && (()=>{ const next=oppositeTheme(theme); const lbl=`Switch to ${getTheme(next).label} (${darkMode?"light":"dark"}). More themes in My Account.`; return (
          <button onClick={()=>{
            setTheme(next);
            dbSaveTheme(user.id,next);
          }} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"5px 10px",color:T.muted,cursor:"pointer",fontSize:14,fontFamily:font,display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}
            title={lbl} aria-label={lbl} data-zp-theme-toggle="">
            {darkMode?"☀️":"🌙"}
          </button>); })()}
          {!navCompact && <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>}
          {!isMobile && <NavMenu testId="nav-admin" align="right" arrow={false} ariaLabel="Settings and Audit Trail" active={["settings","audit"].includes(atab)}
            label={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>}
            items={[["settings","Site Settings"],["audit","Audit Trail & backup"]]} current={atab} onPick={setAtab}
            btnStyle={{background:["settings","audit"].includes(atab)?"rgba(245,158,11,0.14)":T.overlay,border:`1px solid ${["settings","audit"].includes(atab)?T.gold:T.borderMd}`,borderRadius:8,padding:"6px 9px",color:["settings","audit"].includes(atab)?T.gold:T.muted,cursor:"pointer",fontFamily:font}} Z={T} font={font}/>}
          <button type="button" onClick={()=>setAtab(atab==="account"?"users":"account")}
            title={`My Account (${user.name})`} aria-label={`My Account (${user.name})`}
            style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 8px 4px 4px",borderRadius:10,transition:"background .15s",background:atab==="account"?T.overlay:"transparent",border:atab==="account"?`1px solid ${T.borderMd}`:"1px solid transparent",fontFamily:font,color:"inherit"}}
            onMouseEnter={e=>{ if(atab!=="account") e.currentTarget.style.background=T.overlay; }}
            onMouseLeave={e=>{ e.currentTarget.style.background=atab==="account"?T.overlay:"transparent"; }}>
            <Avatar name={user.name} size={32}/>
            {!navCompact && <span style={{fontSize:13,color:atab==="account"?T.white:T.muted,fontWeight:600}}>{user.name.split(" ")[0]}</span>}
          </button>
          <button onClick={logout} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,fontFamily:font,whiteSpace:"nowrap"}}>Sign Out</button>
        </div>
      </div>

      {/* Module Preview Modal */}
      {previewModule && (
        <ModulePreviewModal m={previewModule} staff={staff} assigns={assigns} comps={comps} compHistory={compHistory} moduleVersions={moduleVersions} isMobile={isMobile} setAtab={setAtab} onClose={()=>setPreviewModule(null)} T={T} font={font}
          allModules={allModules} translations={moduleTrans} onSaveTranslation={dbSaveTranslation} onDeleteTranslation={dbDeleteTranslation} user={user}
          langsInUse={[...new Set(allUsers.filter(u => (u.status || "active") !== "leaver").map(u => languageOf(u)).filter(l => l !== "en"))]}/>
      )}

      {/* Mobile nav drawer */}
      {isMobile && mobileMenuOpen && (
        <div style={{background:`linear-gradient(135deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:"8px 0",zIndex:300,position:"relative"}}>
          {[
            ["dashboard", E("🏠 ","")+"Dashboard"],
            ["users", E("👥 ","")+"Staff"],
            ["machinery","🔧 Machinery Competence"],
            ["assign", E("📋 ","")+"Assign Training"],
            ["modules", E("📚 ","")+"Training Library"],
            ["create","➕ Create Module"],
            ["incidents", E("⚠️ ","")+"Incidents"],
            ["ra","🔍 Risk Assessments"],
            ["coshh","🧪 COSHH Register"],
            ["inspections","🏗️ Inspections"],
            ["permits", E("📋 ","")+"Permits to Work"],
            ["firesafety", E("🔥 ","")+"Fire Safety"],
            ["firstaid","First Aid"],
            ...(loneSettings.enabled ? [["lone", E("🧍 ","")+"Lone Working"]] : []),
            ["ppe", E("🦺 ","")+"PPE Register"],
            ["equipment","📦 Equipment Register"],
            ["contractors","🪪 Contractors"],
            ["documents","📄 H&S Documents"],
            ["reports", E("📊 ","")+"Reports"],
            ["settings", E("⚙ ","")+"Site Settings"],
            ["audit", E("🕘 ","")+"Audit Trail & backup"],
            ["account","👤 My Account"],
          ].map(([id,label])=>(
            <button key={id} onClick={()=>{setAtab(id);setMobileMenuOpen(false);}}
              style={{display:"block",width:"100%",textAlign:"left",padding:"13px 20px",background:atab===id?`rgba(245,158,11,0.12)`:"transparent",border:"none",borderBottom:`1px solid rgba(255,255,255,0.05)`,color:atab===id?T.gold:T.white,fontWeight:atab===id?700:400,fontSize:14,cursor:"pointer",fontFamily:font}}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"16px 12px":"36px 28px"}}>

        {/* ── ADMIN DASHBOARD: KPI cards (drag-reorderable, saved per admin in dashboard_layout) + summary lists ── */}
        {atab==="dashboard" && <AdminDashboard staff={staff}/>}

        {/* ── STAFF MANAGEMENT: bulk password reset, CSV import, add-staff form, filterable staff table ── */}
        {atab==="users" && <StaffAdminTab addStaff={addStaff} removeStaff={removeStaff} staff={staff}/>}

        {/* ── ASSIGN TRAINING: pick individual / team / warehouse / all, then toggle modules on/off ── */}
        {atab==="assign" && <AssignTrainingTab staff={staff} toggleAssign={toggleAssign}/>}


        {atab==="firstaid" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyFirstAidRegisterTab
            staff={staff}
            extCerts={extCerts}
            firstAidData={firstAidData}
            setFirstAidData={setFirstAidData}
            Z={T} font={font}/>
          </React.Suspense>
        )}

        {/* ── CREATE/EDIT MODULE: editing a built-in module saves it as an _override in custom_modules ── */}
        {atab==="create" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyCreateModuleTab
            editingModule={editingModule} userId={user && user.id}
            onSave={m=>{
              // Editing an existing module = a new VERSION: ask minor/major first
              // (NewVersionModal → saveModuleVersion). A brand-new module is version 1.
              if (editingModule) { setPendingModuleSave({ m, prev: editingModule }); return; }
              setCustomModules(prev=>[...prev,{...m, version:1, versionDate:todayISO()}]);
              setEditingModule(null);
              setAtab("modules");
            }}
            Z={T} font={font}/>
          </React.Suspense>
        )}

        {/* ── MODULE LIBRARY: preview, edit, duplicate, hide/unhide, delete (custom) or reset (override) ── */}
        {atab==="modules" && <ModuleLibraryTab staff={staff}/>}

        {/* ── DOCUMENT LIBRARY: upload (drag-drop or picker), folder filter, bulk assign, read-tracking ── */}
        {atab==="documents" && <DocumentsTab staff={staff}/>}

        {/* ── Remaining admin tabs are thin wrappers around lazy-loaded domain components ── */}
        {atab==="coshh" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyCoshhTab Z={T} font={font} msdsFiles={msdsFiles} setMsdsFiles={setMsdsFiles} customChemicals={customChemicals} setCustomChemicals={setCustomChemicals} assessments={coshhAssessments} setAssessments={setCoshhAssessments}/>
          </React.Suspense>
        )}

        {atab==="settings" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazySiteSettingsTab Z={T} font={font} superAdmin={isSuperAdmin(user)} user={user}/>
          </React.Suspense>
        )}

        {atab==="audit" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <BackupPanel user={user} onBackedUp={setLastBackup} Z={T} font={font}/>
          <LazyAuditTrailTab Z={T} font={font}/>
          </React.Suspense>
        )}

        {atab==="reports" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyReportsTab staff={staff} assigns={assigns} comps={comps} docs={docs} docAssignments={docAssignments} docAcknowledgements={docAcknowledgements} reportView={adminReportView} setReportView={setAdminReportView} dseReports={dseReports} adminResponses={adminResponses} setAdminResponses={setAdminResponses} darkMode={darkMode} Z={T} font={font} modules={allModules} machineComps={machineComps} allMachineTypes={allMachineTypes} lastLoginMap={lastLoginMap} extCerts={extCerts} quizFailures={quizFailures} setQuizFailures={setQuizFailures} incidents={incidents} inspections={siteInspections} ras={ras} investigations={investigations} setAtab={setAtab} userName={user?.name||""}
            evidenceData={{ fireSafety, firstAidData, coshhAssessments, customChemicals, equipment, permits, contractors, contractorInductions, contractorCerts, contractorVisits, siteSignins }}
            dueDates={dueDates} onMatrixAssign={matrixAssign} onMatrixDue={askDueDate} onMatrixOpen={uid=>openInAssign(uid)}
            onMatrixRecord={(uid,mid)=>openInAssign(uid, ()=>setRecordFor({uid:String(uid),mid}))}
            onExportPDF={u=>generateStaffPDF(u,allModules,assigns,comps,docs,docAssignments,docAcknowledgements,extCerts,machineComps,lastLoginMap,T,allMachineTypes)}/>
          </React.Suspense>
        )}

        {atab==="incidents" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyAdminIncidentTab user={user} incidents={incidents} setIncidents={setIncidents} dbDeleteIncident={dbDeleteIncident} staff={staff} focusIncidentId={focusIncidentId} setFocusIncidentId={setFocusIncidentId} preset={pagePreset&&pagePreset.tab==="incidents"?pagePreset:null} clearPreset={()=>setPagePreset(null)} showAdminReportForm={showAdminReportForm} setShowAdminReportForm={setShowAdminReportForm}
            investigations={investigations} setInvestigations={setInvestigations}
            onOpenInvestigation={id=>{ setInvestigationView(id); setAtab("investigation"); }}
            equipment={equipment} setEquipment={setEquipment}
            Z={T} font={font}/>
          </React.Suspense>
        )}

        {atab==="investigation" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyInvestigationTab userName={user?.name || ""} incidents={incidents} setIncidents={setIncidents} staff={staff}
            investigations={investigations} setInvestigations={setInvestigations}
            fetchInvestigation={fetchInvestigation} acceptInvestigationBase={acceptInvestigationBase}
            focusedId={investigationView} setFocusedId={setInvestigationView}
            onBack={()=>setAtab("incidents")}
            Z={T} font={font}/>
          </React.Suspense>
        )}

        {atab==="ra" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyRiskAssessmentTab docs={docs} setDocs={setDocs} setAtab={setAtab} ras={ras} setRas={setRas} dbSaveRA={dbSaveRA} Z={T} font={font}/>
          </React.Suspense>
        )}

        {atab==="machinery" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyAdminMachineryTab allStaff={staff} machineComps={machineComps} setMachineComps={setMachineComps} allMachineTypes={allMachineTypes} allMachineCategories={allMachineCategories} customMachineTypes={customMachineTypes} preset={pagePreset&&pagePreset.tab==="machinery"?pagePreset:null} clearPreset={()=>setPagePreset(null)} onOpenStaff={()=>setAtab("users")} setCustomMachineTypes={setCustomMachineTypes} dbDeleteCustomMachineType={dbDeleteCustomMachineType} dbSaveMachineComp={dbSaveMachineComp} dbDeleteMachineComp={dbDeleteMachineComp} Z={T} font={font}/>
          </React.Suspense>
        )}

        {atab==="equipment" && (
          <EquipmentPage key={pagePreset&&pagePreset.tab==="racking"?"rk":"as"} initial={pagePreset&&pagePreset.tab==="racking"?"racking":"assets"} Z={T} font={font}
            assets={<React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyEquipmentTrackerTab equipment={equipment} setEquipment={setEquipment} preset={pagePreset&&pagePreset.tab==="equipment"?pagePreset:null} clearPreset={()=>setPagePreset(null)} staff={staff}
            extinguishers={(fireSafety&&fireSafety.extinguishers)||[]} onOpenFireSafety={()=>{ setPagePreset({tab:"firesafety",sub:"extinguishers"}); setAtab("firesafety"); }} Z={T} font={font}/>
          </React.Suspense>}
            racking={<RackingTab me={user} Z={T} font={font}/>}/>
        )}

        {atab==="contractors" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyContractorsTab
            contractors={contractors} setContractors={setContractors}
            contractorInductions={contractorInductions} setContractorInductions={setContractorInductions}
            contractorCerts={contractorCerts} setContractorCerts={setContractorCerts}
            contractorVisits={contractorVisits} setContractorVisits={setContractorVisits}
            dbSaveContractor={dbSaveContractor} dbDeleteContractor={dbDeleteContractor}
            dbSaveContractorInductions={dbSaveContractorInductions}
            dbSaveContractorCerts={dbSaveContractorCerts}
            dbSaveContractorVisits={dbSaveContractorVisits}
            focusContractorId={focusContractorId} setFocusContractorId={setFocusContractorId}
            permits={permits} me={user} refreshContractors={refreshContractors} staff={staff} T={T} font={font}/>
          </React.Suspense>
        )}

        {atab==="ppe" && (
          <PpeRegisterTab me={user} people={allUsers} scope={allUsers} isAdmin focus={ppeFocus} onFocusDone={()=>setPpeFocus(null)} Z={T} font={font}/>
        )}
        {atab==="lone" && (
          <LoneWorkingTab me={user} people={allUsers} settings={loneSettings} onOpenSettings={()=>setAtab("settings")} Z={T} font={font}/>
        )}
        {atab==="permits" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyPermitsTab permits={permits} setPermits={setPermits} dbSavePermit={dbSavePermit} dbDeletePermit={dbDeletePermit} staff={staff} contractors={contractors} T={T} font={font}/>
          </React.Suspense>
        )}

        {atab==="inspections" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazySiteInspectionsTab inspections={siteInspections} setInspections={setSiteInspections} staff={staff} userName={user&&user.name} preset={pagePreset&&pagePreset.tab==="inspections"?pagePreset:null} clearPreset={()=>setPagePreset(null)} Z={T} font={font}/>
          </React.Suspense>
        )}

        {atab==="firesafety" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyFireSafetyTab fireSafety={fireSafety} setFireSafety={setFireSafety} staff={staff} onUploadFraDoc={dbUploadFraDocument} onDeleteFraDoc={dbDeleteFraDocument}
            extCerts={extCerts} setExtCerts={setExtCerts} onSaveCert={dbSaveExtCert} onDeleteCert={dbDeleteExtCert} userName={user&&user.name}
            preset={pagePreset&&pagePreset.tab==="firesafety"?pagePreset:null} clearPreset={()=>setPagePreset(null)}
            inspections={siteInspections} onOpenInspection={id=>{ setPagePreset({tab:"inspections",openId:id}); setAtab("inspections"); }}
            Z={T} font={font}/>
          </React.Suspense>
        )}
        {atab==="account" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyAccountTab user={user} onChangeOwnPassword={async (oldPw,newPw)=>{ if (!(await authCheckPassword(user.email, oldPw))) return { ok:false, error:"Current password is incorrect." }; return changeOwnPassword(newPw); }} darkMode={darkMode} setDarkMode={setDarkMode} theme={theme} setTheme={setTheme} onSaveTheme={k=>dbSaveTheme(user.id,k)} emojiMode={emojiMode} onSaveEmojiMode={v=>{setEmojiMode(v);dbSaveEmojiMode(user.id,v);}} language={userLang} onChangeLanguage={chooseLanguage} Z={T} font={font}/>
          </React.Suspense>
        )}
        {atab==="account" && <WelcomeReplay name={user.name} Z={T} font={font}/>}
      </div>
      {/* Global hover/focus CSS for this portal (same block in the staff and admin views — keep in sync).
          ⚠ Attribute selectors like [style*="cursor:pointer"] / [style*="borderBottom"] rely on
          the text of the inline style attribute. React writes styles as "cursor: pointer;" and
          "border-bottom: ...", so those particular rules probably never match. Test before relying on them. */}
      <style>{`
          @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}

          /* ── Select dropdowns — dark theme ── */
          select { color-scheme: dark; }
          select option { background: #1a2e6e !important; color: #f1f5f9 !important; }
          select option:checked { background: #2563eb !important; font-weight: 700; }

          /* ── Global button transitions ── */
          button { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease, filter 0.15s ease, opacity 0.15s ease; }

          /* ── Primary gradient buttons — lift + brighten ── */
          button[style*="linear-gradient"]:not([disabled]):hover {
            transform: translateY(-2px) scale(1.025) !important;
            filter: brightness(1.14) saturate(1.1) !important;
            box-shadow: 0 8px 24px rgba(37,99,235,0.35) !important;
          }
          button[style*="linear-gradient"]:not([disabled]):active {
            transform: translateY(0) scale(0.97) !important;
            filter: brightness(0.94) !important;
          }

          /* ── Ghost / overlay / outline buttons — subtle lift ── */
          button:not([disabled]):not([style*="linear-gradient"]):hover {
            filter: brightness(1.18) !important;
            transform: translateY(-1px) !important;
          }
          button:not([disabled]):not([style*="linear-gradient"]):active {
            transform: translateY(0) scale(0.97) !important;
            filter: brightness(0.94) !important;
          }

          /* ── Nav bar top-level tabs — colour sweep on hover ── */
          div[style*="borderBottom"] button:not([disabled]):hover {
            color: #f59e0b !important;
            transform: none !important;
            filter: none !important;
          }

          /* ── Dropdown menu items — indent slide + gold tint ── */
          .training-dd button, .me-dd button, .doc-dd button {
            transition: background 0.15s ease, color 0.15s ease, padding-left 0.15s ease !important;
          }
          .training-dd button:hover, .me-dd button:hover, .doc-dd button:hover {
            background: rgba(245,158,11,0.1) !important;
            color: #f59e0b !important;
            padding-left: 26px !important;
            transform: none !important;
            filter: none !important;
          }

          /* ── Clickable cards — float up ── */
          div[style*="cursor:pointer"]:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.22);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          div[style*="cursor:pointer"]:active { transform: translateY(-1px); }

          /* ── Disabled buttons — no effects ── */
          button[disabled] { pointer-events: none !important; transform: none !important; filter: none !important; }

          /* ── Focus ring ── */
          button:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; border-radius: 6px; }
        `}</style>

    </div>
    </EmojiCtx.Provider>
  );
}
