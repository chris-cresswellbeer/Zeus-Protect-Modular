/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/screens/Screens.jsx — which screen to show
 * ═══════════════════════════════════════════════════════════════════════════
 * First match wins: sign-in → choose a password → phone layout → DSE assessment → module
 * player → staff portal → admin portal. (Before the data has loaded App.jsx shows the
 * "Connecting…" splash instead.)
 *
 * Reads the app's shared state and actions with useApp() (app/AppContext.js). Moved out of
 * App.jsx in October 2026 without changing what it shows.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useApp } from "../AppContext";
import { ChangePasswordScreen } from "./ChangePasswordScreen";
import { DseScreen } from "./DseScreen";
import { LoginScreen } from "./LoginScreen";
import { PhoneScreen } from "./PhoneScreen";
import { lazyPart, LAZY_PAGE } from "../lazyParts";

// The big screens download when first shown, so the sign-in page needs only the main bundle
// (and staff never download the admin portal).
const AdminPortal = lazyPart(() => import("./AdminPortal").then(m => ({ default: m.AdminPortal })), LAZY_PAGE);
const StaffPortal = lazyPart(() => import("./StaffPortal").then(m => ({ default: m.StaffPortal })), LAZY_PAGE);
const ModulePlayerScreen = lazyPart(() => import("./ModulePlayerScreen").then(m => ({ default: m.ModulePlayerScreen })), LAZY_PAGE);

export function Screens() {
  const {
    dseActive, forceDesktop, isPhone, mod, mustChangePw, user, view
  } = useApp();
  if (view==="login") return <LoginScreen/>;
  if (user && mustChangePw) return <ChangePasswordScreen/>;
  if (isPhone && user && !forceDesktop) return <PhoneScreen/>;
  if (dseActive && view==="staff") return <DseScreen/>;
  if (mod && view==="staff") return <ModulePlayerScreen/>;
  if (view==="staff" && user) return <StaffPortal/>;
  if (view==="admin") return <AdminPortal/>;
  return null;
}
