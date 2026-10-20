/**
 * app/AppContext.js — the portal's shared state and actions, for any screen.
 *
 *   const { user, incidents, setIncidents, dbSaveUser } = useApp();
 *
 * App.jsx builds the value on every render (useAppState() plus the create*Actions(app)
 * functions) and provides it around the screens. See src/app/README.md.
 */
import { createContext, useContext } from "react";

export const AppContext = createContext(null);
/** Everything in the app's shared state and every action, as one object. */
export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw new Error("useApp() used outside <AppContext.Provider> (App.jsx)");
  return app;
}
