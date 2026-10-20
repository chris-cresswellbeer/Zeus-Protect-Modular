/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/screens/PhoneScreen.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * Phones (≤700 px wide) get the phone layout (src/mobile/MobileApp.jsx), unless "Use the full portal" was chosen.
 *
 * Reads the app's shared state and actions with useApp() (app/AppContext.js). Moved out of
 * App.jsx in October 2026 without changing what it shows.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useApp } from "../AppContext";
import { MobileApp, PreviewModal } from "../lazyParts";

export function PhoneScreen() {
  const {
    allUsers, assigns, chooseLanguage, comps, docAcknowledgements, docAssignments, docBundles, docs,
    dseReports, dueDates, extCerts, font, incidents, investigations, logout, mobileDb, mobilePermits,
    myLangModules, previewDoc, setDarkMode, setForceDesktop, setPreviewDoc, setQuickEditId, setStab,
    setTheme, siteInspections, T, theme, user, userLang
  } = useApp();
  return (
    <>
    {/* The phone layout's document preview (MobileApp's "Read" → mobileDb.previewDoc). */}
    <div style={{fontFamily:font,color:T.white}}><PreviewModal doc={previewDoc} onClose={()=>setPreviewDoc(null)} Z={T} font={font}/></div>
    <MobileApp
      user={user}
      docBundles={docBundles}
      onSignOut={logout}
      onSwitchToDesktop={() => setForceDesktop(true)}
      onCompleteQuickReport={(inc) => { setForceDesktop(true); setStab("incidents"); setQuickEditId(inc.id); }}
      allModules={myLangModules}
      language={userLang}
      onChangeLanguage={chooseLanguage}
      assigns={assigns}
      comps={comps}
      docs={docs}
      docAssignments={docAssignments}
      docAcknowledgements={docAcknowledgements}
      dseReports={dseReports}
      extCerts={extCerts}
      incidents={incidents}
      investigations={investigations}
      allUsers={allUsers}
      dueDates={dueDates}
      siteInspections={siteInspections}
      permits={mobilePermits}
      theme={theme}
      setTheme={setTheme}
      setDarkMode={setDarkMode}
      db={mobileDb}
    />
    </>
  );
}
