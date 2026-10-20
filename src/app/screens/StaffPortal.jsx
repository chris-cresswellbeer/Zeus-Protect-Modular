/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/screens/StaffPortal.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * The staff portal: the staff menu and tabs (`stab`).
 *
 * Reads the app's shared state and actions with useApp() (app/AppContext.js). Moved out of
 * App.jsx in October 2026 without changing what it shows.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { hasMachineryAccess, isWarehouseWorker } from "../../data/seedMachinery";
import { teamOf } from "../../domains/manager/team";
import { listSessions } from "../../domains/training/evidence";
import { checkPassword as authCheckPassword, changeOwnPassword } from "../../lib/auth";
import { E, EmojiCtx } from "../../lib/emoji";
import { t } from "../../lib/i18n";
import { BrandLogo } from "../../shared/Logo";
import { NotificationBell } from "../../shared/NotificationBell";
import { Avatar } from "../../shared/primitives";
import { QuickSearch } from "../../shared/QuickSearch";
import { ScrollNav } from "../../shared/ScrollNav";
import { WelcomeReplay } from "../../shared/WelcomeVideo";
import { getTheme, oppositeTheme } from "../../theme/tokens";
import { useApp } from "../AppContext";
import { staffNotifications } from "../bell/staffNotifications";
import { GroupSessionModal, LazyAccountTab, LazyAdminMachineryTab, LazyEquipmentTrackerTab, LazyIncidentTracker, LazyMachineryCompetenceTab, LazyMyTeamTab, LazyStaffActionsTab, LazyStaffDSETab, MachineryEquipmentPage, MyPpeTab, PreviewModal, QuickReportModal, RackingTab, SessionsModal } from "../lazyParts";
import { CertModal } from "./CertModal";
import { MyDocumentsTab } from "./staff/MyDocumentsTab";
import { MyHistoryTab } from "./staff/MyHistoryTab";
import { MyTrainingTab } from "./staff/MyTrainingTab";
import { StaffDashboard } from "./staff/StaffDashboard";

// Everything computed here is derived from state on each render (no extra state).
// `stab` selects the tab. Admins can also reach this view via "My Training".
export function StaffPortal() {
  const app = useApp();
  const {
    adminResponses, allMachineCategories, allMachineTypes, allModules, allUsers, assigns, attachToSession,
    chooseLanguage, comps, customMachineTypes, darkMode, dbDeleteCustomMachineType, dbDeleteMachineComp,
    dbSaveEmojiMode, dbSaveIncident, dbSaveMachineComp, dbSaveTheme, docAcknowledgements, docAssignments,
    docs, dseDraft, dseReports, dueDates, emojiMode, equipment, fireSafety, font, groupSessionFor, incidents,
    investigations, isMobile, logout, loneBar, machineComps, managerAssign, managerSignOffAction,
    managerSignOffDse, mobileMenuOpen, openDse, pagePreset, ppeRows, ppeSettings, previewDoc, quickEditId,
    quickItems, racking, rackInspector, rackWindow, recordCompletions, setCustomMachineTypes, setDarkMode,
    setDseActive, setDseAnswers, setDseComments, setDseSection, setDseSubmitted, setEmojiMode, setEquipment,
    setGroupSessionFor, setIncidents, setInvestigations, setMachineComps, setMobileMenuOpen, setMod,
    setPagePreset, setPreviewDoc, setQuickEditId, setShowQuickReport, setShowSessions, setStab, setTheme,
    setView, showMyPpe, showQuickReport, showSessions, stab, T, theme, user, userLang, winW
  } = app;


  // Staff menu bar widths: the tabs must never be hidden behind the bell. Wider than
  // 1700px everything is shown in full; narrower, the search shrinks to 🔍; below 1400
  // the first name goes, the labels drop "My" and the tabs tighten up. At 1024px and
  // below the ☰ menu takes over (CSS below).
  // more tabs (machinery, PPE, team, machinery & equipment) need the shorter labels sooner
  // The staff tabs. History and My Machinery are sections of My Training (Oct 2026), so
  // stab "history" / "machinery" still exist and light up the My Training tab.
  const STAFF_BAR = ["dashboard","training","documents","incidents","dse",...(showMyPpe?["ppe"]:[]),"actions",...(user.role==="manager"?["team"]:[]),...(user.role!=="admin"&&hasMachineryAccess(user)?["mequip"]:[])];
  const TRAINING_PARTS = ["training","history",...(isWarehouseWorker(user)?["machinery"]:[])];
  const tabOn = t => stab===t || (t==="training" && TRAINING_PARTS.includes(stab));
  const sTabCount = STAFF_BAR.length;
  const sExtra = Math.max(0, sTabCount - 9) * 130;
  const sTight = winW < 1700 + sExtra, sTiny = winW < 1400 + sExtra, sSnug = sTiny && sTabCount >= 10;
  // Menu names in the person's language (lib/i18n.js); the pages behind them are English for now.
  const inLang = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, t(v)]));
  const STAFF_TAB_LABEL = inLang({dashboard:"Dashboard",training:"My Training",history:"History",documents:"Documents",incidents:"Report Incident",dse:"My DSE",machinery:"My Machinery",mequip:"Machinery & Equipment",actions:"My Actions",ppe:"My PPE",team:"My Team"});
  const STAFF_TAB_SHORT = inLang({dashboard:"Dashboard",training:"Training",history:"History",documents:"Documents",incidents:"Report",dse:"DSE",machinery:"Machinery",mequip:"Equipment",actions:"Actions",ppe:"PPE",team:"Team"});
  return (
    <EmojiCtx.Provider value={emojiMode}>
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.white}}>
      <CertModal/>
      <PreviewModal doc={previewDoc} onClose={()=>setPreviewDoc(null)} Z={T} font={font}/>
      {/* ▲/▼ top-of-page / bottom-of-page buttons on long screens (shared/ScrollNav.jsx) */}
      <ScrollNav bottom={isMobile && stab!=="dashboard" ? 92 : 24} Z={T} font={font}/>
      {loneBar()}
      {rackWindow()}
      {/* Nav */}
      <div style={{background:`linear-gradient(90deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:sTiny?"0 14px":"0 24px",display:"flex",alignItems:"center",position:"relative"}}>
        <div style={{marginRight:sTiny?10:20,padding:"10px 0",flexShrink:0}}><BrandLogo darkMode={darkMode}/></div>
        <div style={{display:"flex",alignItems:"center",gap:sTiny?0:2,flex:1,minWidth:0,overflowX:"auto"}} className="staff-nav-tabs" data-testid="staff-tabs">
          {STAFF_BAR.map(t=>(
            <button key={t} onClick={()=>setStab(t)} title={STAFF_TAB_LABEL[t]}
              aria-current={tabOn(t)?"page":undefined} style={{background:"none",border:"none",borderBottom:tabOn(t)?`2px solid ${T.accent}`:"2px solid transparent",color:tabOn(t)?T.white:T.muted,fontWeight:tabOn(t)?700:400,fontSize:13,cursor:"pointer",padding:sSnug?"14px 6px 12px":sTiny?"14px 8px 12px":sTight?"14px 10px 12px":"14px 14px 12px",fontFamily:font,whiteSpace:"nowrap",letterSpacing:.3,transition:"color .15s"}}>
              {(sTiny?STAFF_TAB_SHORT:STAFF_TAB_LABEL)[t]}
            </button>
          ))}
        </div>
        <button className="mobile-ham" style={{display:"none",background:"none",border:`1px solid ${T.borderMd}`,borderRadius:8,color:T.white,fontSize:20,cursor:"pointer",padding:"4px 10px",lineHeight:1,fontFamily:font,flexShrink:0}}
          onClick={()=>setMobileMenuOpen(m=>!m)}>
          {mobileMenuOpen?"✕":"☰"}
        </button>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:isMobile?6:sTiny?6:10,flexShrink:0,paddingLeft:8}}>
          {/* Staff notification list — rebuilt every render from current state. `nav.tab` is a staff tab key. */}
          {(()=>{
            // the list itself: app/bell/staffNotifications.js
            const notifications = staffNotifications({
              adminResponses, allMachineTypes, allModules, allUsers, assigns, comps, docAcknowledgements,
              docAssignments, docs, dseDraft, dseReports, dueDates, incidents, investigations, machineComps,
              ppeRows, ppeSettings, racking, rackInspector, showMyPpe, user
            });
            return <NotificationBell notifications={notifications} onNavigate={n=>{ if(n.preset) setPagePreset(n.preset); setStab(n.tab); if(n.editId) setQuickEditId(n.editId); }} Z={T} font={font}/>;
          })()}
          <QuickSearch getItems={quickItems} Z={T} font={font} compact={isMobile||sTight}/>
          <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>
          {(()=>{ const next=oppositeTheme(theme); const lbl=`Switch to ${getTheme(next).label} (${darkMode?"light":"dark"}). More themes in My Account.`; return (
          <button title={lbl} aria-label={lbl} data-zp-theme-toggle="" onClick={()=>{
            setTheme(next);
            dbSaveTheme(user.id,next);
          }} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"5px 10px",color:T.muted,cursor:"pointer",fontSize:14,fontFamily:font,display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}>
            {darkMode?"☀️":"🌙"}
          </button>); })()}
          {user.role==="admin" && (<>
            <button onClick={()=>setView("admin")}
              title="Back to the admin panel"
              style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"5px 12px",color:T.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,display:"flex",alignItems:"center",gap:5,transition:"all .15s"}}>
              {E("🛠 ","")}{sTight?"Admin":"Back to Admin"}
            </button>
            <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>
          </>)}
          <div onClick={()=>setStab("account")} role="button" tabIndex={0} aria-label={`My Account (${user.name})`}
            onKeyDown={e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); setStab("account"); } }}
            title="My Account"
            style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 8px 4px 4px",borderRadius:10,transition:"background .15s",background:stab==="account"?T.overlay:"transparent",border:stab==="account"?`1px solid ${T.borderMd}`:"1px solid transparent"}}
            onMouseEnter={e=>{ if(stab!=="account") e.currentTarget.style.background=T.overlay; }}
            onMouseLeave={e=>{ e.currentTarget.style.background=stab==="account"?T.overlay:"transparent"; }}>
            <Avatar name={user.name} size={32}/>
            {!sTiny && <span style={{fontSize:13,color:stab==="account"?T.white:T.muted,fontWeight:600}}>{user.name.split(" ")[0]}</span>}
          </div>
          <button onClick={logout} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,fontFamily:font,whiteSpace:"nowrap"}}>{t("Sign Out")}</button>
        </div>
      </div>


    {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer" style={{position:"relative"}}>
          {STAFF_BAR.map(t=>(
            <button key={t} onClick={()=>{setStab(t);setMobileMenuOpen(false);}}
              style={{display:"block",width:"100%",textAlign:"left",padding:"12px 24px",background:tabOn(t)?"rgba(37,99,235,0.15)":"transparent",border:"none",borderBottom:`1px solid rgba(255,255,255,0.05)`,color:tabOn(t)?T.white:T.muted,fontWeight:tabOn(t)?700:400,fontSize:14,cursor:"pointer",fontFamily:font}}>
              {{dashboard:E("🏠 ",""),training:E("📚 ",""),history:E("📋 ",""),documents:E("📄 ",""),incidents:E("🚨 ",""),dse:"🖥️ ",machinery:"⚙️ ",mequip:"🛠 ",actions:"✅ ",ppe:E("🦺 ",""),team:E("👥 ","")}[t]}{STAFF_TAB_LABEL[t]}
            </button>
          ))}
        </div>
      )}
      <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"16px 12px":"36px 28px"}}>

        {showQuickReport && (
          <QuickReportModal user={user} Z={T} font={font}
            onClose={()=>setShowQuickReport(false)}
            onSubmit={rec=>{
              setIncidents(p=>[rec,...p]);
              dbSaveIncident(rec);
            }}/>
        )}

        {stab==="dashboard" && <StaffDashboard/>}

        {TRAINING_PARTS.includes(stab) && TRAINING_PARTS.length > 1 && (
          <div role="tablist" aria-label="My Training" data-testid="training-parts" style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
            {TRAINING_PARTS.map(p => (
              <button key={p} type="button" role="tab" aria-selected={stab===p} onClick={()=>setStab(p)} data-testid={`training-part-${p}`}
                style={{fontFamily:font,fontSize:13.5,fontWeight:700,cursor:"pointer",borderRadius:20,padding:"8px 16px",minHeight:38,color:stab===p?T.white:T.muted,background:stab===p?`${T.accent}40`:T.overlay,border:`1px solid ${stab===p?T.accent:T.borderMd}`}}>
                {{training:t("Assigned to me"),history:t("History & certificates"),machinery:t("My machinery")}[p]}
              </button>
            ))}
          </div>
        )}
        {stab==="training" && <MyTrainingTab/>}

        {stab==="history" && <MyHistoryTab/>}

        {stab==="documents" && <MyDocumentsTab/>}

        {stab==="account" && <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}><LazyAccountTab user={user} onChangeOwnPassword={async (oldPw,newPw)=>{ if (!(await authCheckPassword(user.email, oldPw))) return { ok:false, error:"Current password is incorrect." }; return changeOwnPassword(newPw); }} darkMode={darkMode} setDarkMode={setDarkMode} theme={theme} setTheme={setTheme} onSaveTheme={k=>dbSaveTheme(user.id,k)} emojiMode={emojiMode} onSaveEmojiMode={v=>{setEmojiMode(v);dbSaveEmojiMode(user.id,v);}} language={userLang} onChangeLanguage={chooseLanguage} Z={T} font={font}/></React.Suspense>}
        {stab==="account" && <WelcomeReplay name={user.name} Z={T} font={font}/>}

        {/* Floating hazard report button — mobile only */}
        {isMobile && stab!=="dashboard" && (
          <button onClick={()=>setShowQuickReport(true)}
            style={{position:"fixed",bottom:24,right:20,zIndex:90,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",border:"none",borderRadius:"50%",width:56,height:56,cursor:"pointer",fontSize:22,boxShadow:"0 6px 20px rgba(245,158,11,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            ⚠
          </button>
        )}

        {stab==="machinery" && isWarehouseWorker(user) && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyMachineryCompetenceTab user={user} machineComps={machineComps} setMachineComps={setMachineComps} allMachineTypes={allMachineTypes} allMachineCategories={allMachineCategories} Z={T} font={font}/>
          </React.Suspense>
        )}

        {stab==="incidents" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyIncidentTracker user={user} incidents={incidents} setIncidents={setIncidents} equipment={equipment} setEquipment={setEquipment} autoEditId={quickEditId} onAutoEditDone={()=>setQuickEditId(null)} Z={T} font={font}/>
          </React.Suspense>
        )}

        {stab==="dse" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyStaffDSETab
            user={user}
            dseReports={dseReports}
            adminResponses={adminResponses}
            setDseAnswers={setDseAnswers}
            setDseComments={setDseComments}
            setDseSection={setDseSection}
            setDseSubmitted={setDseSubmitted}
            setDseActive={setDseActive}
            dseDraft={dseDraft} onStartDse={openDse}
            Z={T} font={font}
          />
          </React.Suspense>
        )}
        {/* Machinery & Equipment for people an admin has given access (Edit Staff): the same
            Machinery Competence and Equipment Register pages admins use. */}
        {stab==="mequip" && user.role!=="admin" && hasMachineryAccess(user) && (
          <MachineryEquipmentPage key={pagePreset&&pagePreset.tab==="racking"?"rk":"me"} Z={T} font={font} initial={pagePreset&&pagePreset.tab==="equipment"?"equipment":pagePreset&&pagePreset.tab==="racking"?"racking":"machinery"}
            racking={<RackingTab me={user} Z={T} font={font}/>}
            machinery={
              <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
              <LazyAdminMachineryTab allStaff={allUsers.filter(u=>u.id!==1)} machineComps={machineComps} setMachineComps={setMachineComps} allMachineTypes={allMachineTypes} allMachineCategories={allMachineCategories} customMachineTypes={customMachineTypes} preset={pagePreset&&pagePreset.tab==="machinery"?pagePreset:null} clearPreset={()=>setPagePreset(null)} setCustomMachineTypes={setCustomMachineTypes} dbDeleteCustomMachineType={dbDeleteCustomMachineType} dbSaveMachineComp={dbSaveMachineComp} dbDeleteMachineComp={dbDeleteMachineComp} Z={T} font={font}/>
              </React.Suspense>}
            equipment={
              <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
              <LazyEquipmentTrackerTab equipment={equipment} setEquipment={setEquipment} preset={pagePreset&&pagePreset.tab==="equipment"?pagePreset:null} clearPreset={()=>setPagePreset(null)} staff={allUsers.filter(u=>u.id!==1)}
                extinguishers={(fireSafety&&fireSafety.extinguishers)||[]} Z={T} font={font}/>
              </React.Suspense>}
          />
        )}

        {stab==="ppe" && showMyPpe && (
          <MyPpeTab user={user} people={allUsers} team={user.role==="manager"?teamOf(user, allUsers):[]} Z={T} font={font}/>
        )}
        {stab==="team" && user.role==="manager" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyMyTeamTab manager={user} users={allUsers} allModules={allModules} assigns={assigns} comps={comps}
            docs={docs} docAssignments={docAssignments} docAcknowledgements={docAcknowledgements}
            dseReports={dseReports} adminResponses={adminResponses} investigations={investigations}
            dueDates={dueDates} onAssign={managerAssign} onSignOffDse={managerSignOffDse} onSignOffAction={managerSignOffAction}
            onGroupSession={()=>setGroupSessionFor("team")}
            onSessions={()=>setShowSessions("team")}
            Z={T} font={font}/>
          {showSessions==="team" && <SessionsModal sessions={listSessions(comps, teamOf(user, allUsers).map(u=>u.id))} people={allUsers} modules={allModules}
            onAttach={attachToSession} onClose={()=>setShowSessions(null)} Z={T} font={font}/>}
          {groupSessionFor==="team" && <GroupSessionModal people={teamOf(user, allUsers)} modules={allModules.filter(m=>!m._hidden)} comps={comps}
            leaderName={user.name} onSave={recordCompletions} onClose={()=>setGroupSessionFor(null)} Z={T} font={font}/>}
          </React.Suspense>
        )}

        {stab==="actions" && (
          <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
          <LazyStaffActionsTab
            user={user}
            onCompleteQuickReport={inc=>{ setStab("incidents"); setQuickEditId(inc.id); }}
            incidents={incidents}
            investigations={investigations}
            setInvestigations={setInvestigations}
            assigns={assigns}
            comps={comps}
            allModules={allModules}
            docs={docs}
            docAssignments={docAssignments}
            docAcknowledgements={docAcknowledgements}
            dseReports={dseReports}
            adminResponses={adminResponses}
            dseDraft={dseDraft} onStartDse={openDse}
            setStab={setStab} setMod={setMod}
            Z={T} font={font}
          />
          </React.Suspense>
        )}
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

          /* ── Mobile responsive nav ── */
          @media (max-width: 1024px) {
            .staff-nav-tabs { display: none !important; }
            .mobile-ham { display: block !important; }
          }

          /* ── Global mobile responsive rules ── */
          @media (max-width: 1024px) {

            /* Collapse all fixed multi-column grids to single column */
            [style*="gridTemplateColumns: \"1fr 1fr\""],
            [style*="gridTemplateColumns:\"1fr 1fr\""],
            [style*='gridTemplateColumns:"1fr 1fr"'],
            [style*="grid-template-columns: 1fr 1fr"] {
              grid-template-columns: 1fr !important;
            }

            /* Collapse 3-column grids */
            [style*="gridTemplateColumns: \"1fr 1fr 1fr\""],
            [style*='gridTemplateColumns:"1fr 1fr 1fr"'] {
              grid-template-columns: 1fr !important;
            }

            /* Collapse complex multi-column grids (2fr 1fr etc) */
            [style*="gridTemplateColumns: \"2fr 1fr\""],
            [style*="gridTemplateColumns: \"2fr 1fr 1fr\""],
            [style*="gridTemplateColumns: \"2fr 2fr 1fr 2fr\""],
            [style*="gridTemplateColumns: \"2fr 1fr 1fr 1fr 2fr auto\""],
            [style*="gridTemplateColumns: \"2fr 1fr 1fr 2fr auto\""],
            [style*="gridTemplateColumns: \"30px 3fr 1fr 1fr 1fr\""] {
              grid-template-columns: 1fr !important;
            }

            /* Reduce horizontal padding on main content areas */
            [style*="padding: 32px"],
            [style*="padding:32px"] {
              padding: 16px !important;
            }

            /* Make stat cards scroll horizontally rather than overflow */
            .stat-row { overflow-x: auto; }

            /* Reduce font sizes for headings on mobile */
            h2 { font-size: 18px !important; }
            h3 { font-size: 15px !important; }

            /* Full width buttons in forms */
            [style*="whiteSpace:\"nowrap\""] {
              white-space: normal !important;
            }

            /* Prevent wide fixed-width tables from breaking layout */
            table { width: 100% !important; display: block; overflow-x: auto; }

            /* Login card full width on mobile */
            [style*="maxWidth: 420"] {
              max-width: 100% !important;
              margin: 16px !important;
            }

            /* Module quiz answers stack vertically */
            [style*="gridTemplateColumns: \"1fr 1fr\""] > * {
              min-width: 0 !important;
            }

            /* Admin tab bar — allow horizontal scroll */
            .admin-tabs { overflow-x: auto; white-space: nowrap; }

            /* Reduce page-level padding */
            .page-content { padding: 12px !important; }

            /* Stack header actions vertically */
            .header-actions { flex-direction: column !important; align-items: stretch !important; }

            /* Make modals full screen on mobile */
            [style*="maxWidth: 900"],
            [style*="maxWidth: 800"],
            [style*="maxWidth: 700"],
            [style*="maxWidth: 600"] {
              max-width: 100% !important;
              margin: 0 !important;
              border-radius: 0 !important;
            }

            /* Ensure text doesn't overflow cards */
            * { word-break: break-word; }
          }

          .helptip-text, .helptip-text * { color: var(--tip-col) !important; -webkit-text-fill-color: var(--tip-col) !important; }

          /* Admin nav bar — hide scrollbar but keep scrollable on mobile */
          .admin-nav-bar { scrollbar-width: none; -ms-overflow-style: none; }
          .admin-nav-bar::-webkit-scrollbar { display: none; }
          .admin-nav-bar button { flex-shrink: 0 !important; white-space: nowrap !important; }
          .admin-nav-bar > * { flex-shrink: 0 !important; }
          @media (max-width: 1024px) {
            .admin-nav-bar button { font-size: 11px !important; padding: 4px 10px !important; }
          }

          /* Extra small screens (phones < 480px) */
          @media (max-width: 480px) {
            /* Hide non-essential table columns */
            .hide-mobile { display: none !important; }

            /* Larger touch targets for buttons */
            button { min-height: 40px; }

            /* Stack nav header items */
            .nav-header-inner { flex-wrap: wrap !important; gap: 8px !important; }
          }
          .mobile-nav-drawer {
            position: absolute; top: 100%; left: 0; right: 0; z-index: 300;
            background: linear-gradient(135deg, #091548, #0d1f5c);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding: 8px 0;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          }
          .mobile-nav-drawer button {
            display: block !important; width: 100%; text-align: left !important;
            padding: 12px 24px !important; border: none !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          }

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
