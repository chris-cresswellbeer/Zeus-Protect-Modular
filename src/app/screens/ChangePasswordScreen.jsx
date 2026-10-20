/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/screens/ChangePasswordScreen.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * First sign-in with a temporary password: choose your own before anything else.
 *
 * Reads the app's shared state and actions with useApp() (app/AppContext.js). Moved out of
 * App.jsx in October 2026 without changing what it shows.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { ForcePasswordChange } from "../../shared/ForcePasswordChange";
import { useApp } from "../AppContext";

// isPhone = window ≤700px wide. `forceDesktop` is set by "Use the full portal" in the mobile More tab.
// Sits above every desktop view so a phone never falls through to the wide
// layout. MobileApp is a view over the state below — it owns no domain data
// and never touches Supabase directly, only the handlers passed in as `db`.
// Temporary password → must choose their own before using the portal (desktop and phone).
export function ChangePasswordScreen() {
  const {
    font, logout, setMustChangePw, T, user
  } = useApp();
    return (
  <ForcePasswordChange user={user} onDone={()=>setMustChangePw(false)} onSignOut={logout} Z={T} font={font}/>
);
}
