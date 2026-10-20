/**
 * ═══════════════════════════════════════════════════════════════════════════
 * App.jsx — the root of Zeus Protect: puts the app's state and actions together
 * ═══════════════════════════════════════════════════════════════════════════
 * Everything shared lives in src/app/ (see src/app/README.md):
 *   app/useAppState.js ........ all shared state (useState / useRef) and values worked out from it
 *   app/actions/*.js .......... saving and actions, one file per area (training, incidents…)
 *   app/data/ ................. loading (useLoadAll), saving + 30-second refresh (useSyncEffects,
 *                               sync.js), the phone's read/write surface (useMobileWrites)
 *   app/effects/ .............. theme, language, page address, inactivity sign-out…
 *   app/AppContext.js ......... useApp(): any screen reads state and actions from here
 *
 * DATA FLOW CONVENTIONS (please keep to these)
 *   • ids are compared as STRINGS: String(a) === String(b).
 *   • New Supabase reads go into the Promise.allSettled batch in app/data/useLoadAll.js.
 *   • New writes go through dbWrite() (lib/supabase.js), in the app/actions file for that area.
 *   • Prefer upsert-with-onConflict to delete-then-insert.
 *
 * ⚠ RULES OF HOOKS: every hook of the app's shared state is in useAppState / the use* files in
 *   src/app, called in the same order on every render. Never call a hook inside an if, a loop
 *   or a callback; a screen that needs its own state is its own component.
 *
 * KNOWN ISSUES: docs/KNOWN_ISSUES.md.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { Screens } from "./app/screens/Screens";
import { BrandSignInLogo } from "./shared/Logo";
import { Z } from "./theme/tokens";
import { useAppState } from "./app/useAppState";
import { createSync } from "./app/data/sync";
import { createTrainingActions } from "./app/actions/training";
import { createIncidentActions } from "./app/actions/incidents";
import { createDocumentActions } from "./app/actions/documents";
import { createDseActions } from "./app/actions/dse";
import { createAccountActions } from "./app/actions/account";
import { createRegisterActions } from "./app/actions/registers";
import { createManagerActions } from "./app/actions/manager";
import { createSessionActions } from "./app/actions/session";
import { createStaffBulkActions } from "./app/actions/staffBulk";
import { createPlayerActions } from "./app/actions/player";
import { createQuickSearch } from "./app/quickSearch";
import { createNavStyles } from "./app/navStyles";
import { createSiteBars } from "./app/siteBars";
import { useMobileWrites } from "./app/data/useMobileWrites";
import { useSessionEffects } from "./app/effects/useSessionEffects";
import { useLoadAll } from "./app/data/useLoadAll";
import { useSyncEffects } from "./app/data/useSyncEffects";
import { AppContext } from "./app/AppContext";

export default function App() {
  // 1. state (app/useAppState.js), 2. actions, each given what came before (app/actions/…),
  // 3. the phone's read/write surface, 4. effects: session, loading, saving and refresh.
  // The order of these calls never changes, so the hooks inside them always run in the same order.
  const app = useAppState();
  Object.assign(app, createSync(app));
  Object.assign(app, createTrainingActions(app));
  Object.assign(app, createIncidentActions(app));
  Object.assign(app, createDocumentActions(app));
  Object.assign(app, createDseActions(app));
  Object.assign(app, createAccountActions(app));
  Object.assign(app, createRegisterActions(app));
  Object.assign(app, createManagerActions(app));
  Object.assign(app, createSessionActions(app));
  Object.assign(app, createStaffBulkActions(app));
  Object.assign(app, createPlayerActions(app));
  Object.assign(app, createQuickSearch(app));
  Object.assign(app, createNavStyles(app));
  Object.assign(app, createSiteBars(app));
  Object.assign(app, useMobileWrites(app));
  useSessionEffects(app);
  useLoadAll(app);
  useSyncEffects(app);
  const { dbReady, view } = app;


  // ⚠⚠ EARLY RETURN — no React hooks may be declared below this line. ⚠⚠
  // (Uses the default dark tokens `Z` because the user's theme isn't known yet.)
  // ── Show loading screen until Supabase data is ready ────────────────────────
  // (The sign-in screen shows before any data is loaded: the data is loaded after
  //  sign-in, with the person's token.)
  if (!dbReady && view !== "login") return (
    <div style={{minHeight:"100vh",background:Z.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow','Trebuchet MS',system-ui,sans-serif",flexDirection:"column",gap:20}}>
      <BrandSignInLogo/>
      <div style={{color:Z.muted,fontSize:14,letterSpacing:1}}>CONNECTING TO DATABASE…</div>
      <div style={{width:200,height:3,background:Z.border,borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:"60%",background:`linear-gradient(90deg,${Z.accent},${Z.accentLt})`,borderRadius:99,animation:"slide 1.2s ease-in-out infinite"}}/>
      </div>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
    </div>
  );

  return (
    <AppContext.Provider value={app}>
      <Screens/>
    </AppContext.Provider>
  );
}
