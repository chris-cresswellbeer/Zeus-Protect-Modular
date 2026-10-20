# src/app — the portal's shared state, actions and screens

Until October 2026 all of this was one 6,300-line `App.jsx`. It was split up without changing
what the portal does. `App.jsx` is now about 100 lines that put the pieces together.

## How it fits together

```
App.jsx
  const app = useAppState();                        state: every useState / useRef, and values worked out from them
  Object.assign(app, createSync(app));              each create…(app) gets everything made before it
  Object.assign(app, createTrainingActions(app));   … and adds its own functions to `app`
  …
  Object.assign(app, useMobileWrites(app));         the phone layout's read/write surface
  useSessionEffects(app); useLoadAll(app); useSyncEffects(app);   effects
  <AppContext.Provider value={app}> <Screens/> </AppContext.Provider>
```

Any screen reads what it needs with `useApp()`:

```js
import { useApp } from "../AppContext";
const { user, incidents, setIncidents, dbSaveIncident, T, font } = useApp();
```

`app` is rebuilt on every render, exactly as App.jsx's variables were, so nothing behaves
differently: functions see the current state, and every screen redraws when state changes.

## Files

| File | What's in it |
|---|---|
| `useAppState.js` | All shared state: users, training, documents, DSE, incidents, registers, the admin forms' state, theme, page (`view`, `atab`, `stab`), and values worked out from them (`allModules`, `T`, `isPhone`…). Also the per-feature stores (racking, PPE, lone working, site sign-ins). |
| `AppContext.js` | `useApp()` |
| `records.js` | Database rows → the shapes the screens use, comparing and merging records, the tables the refresh checks |
| `lazyParts.jsx` | Parts downloaded the first time they're shown (`lazyPart`, `React.lazy`) |
| **data/** | |
| `data/useLoadAll.js` | `loadAll()`: reads every table after sign-in. **New tables are read here.** |
| `data/useSyncEffects.js` | Saving what changed (incidents, investigations, DSE, equipment, inspections, fire safety, first aid, modules, machine types) and the 30-second refresh |
| `data/sync.js` | The refresh itself (`refreshSharedRecords`) and helpers the saves share (`markWrite`, `inTurn`) |
| `data/useMobileWrites.js` | `mobileDb` / `mobilePermits`: what the phone layout reads and writes |
| **actions/** | One file per area; each save goes through `dbWrite()` (lib/supabase.js) |
| `actions/training.js` | Assigning, due dates, completions, evidence, quiz failures, custom modules, versions, translations |
| `actions/incidents.js` | Incidents and investigations (one save at a time, merging two people's changes) |
| `actions/documents.js` | Documents, who must read them, read confirmations, bundles |
| `actions/dse.js` | DSE reports, responses, the unfinished draft |
| `actions/account.js` | Staff records, profiles, theme / language / emoji, temporary passwords |
| `actions/registers.js` | Contractors, permits, risk assessments, certificates, machinery, equipment, inspections, first aid, fire safety |
| `actions/manager.js` | Line managers: assign, sign off DSE and actions |
| `actions/session.js` | Sign in / out, open a module |
| `actions/staffBulk.js` | Staff list bulk actions |
| `actions/player.js` | The module player: the module in the person's language, marking the quiz |
| `effects/useSessionEffects.js` | Theme, language, emoji, welcome video, page address (Back / Forward), viewport, 30-minute sign-out, module progress |
| `quickSearch.js`, `navStyles.js`, `siteBars.jsx` | Quick search results; header button sizes; the racking bay window (`?rack=`) and the lone working alert bar |
| **bell/** | What the notification bell lists: `adminNotifications.js`, `staffNotifications.js`, `rackingNotifications.js`. Plain functions (data in, list out), tested in `tests/portal/belllib.mjs`. |
| **screens/** | |
| `screens/Screens.jsx` | Which screen to show (sign-in, choose a password, phone, DSE, module player, staff, admin) |
| `screens/LoginScreen.jsx`, `ChangePasswordScreen.jsx`, `PhoneScreen.jsx`, `DseScreen.jsx`, `ModulePlayerScreen.jsx`, `CertModal.jsx` | One screen each |
| `screens/AdminPortal.jsx` | Admin header, menus, bell and the smaller tabs; the big tabs are in `screens/admin/` (dashboard, staff, assign training, training library, documents) |
| `screens/StaffPortal.jsx` | Staff header, menu, bell and the smaller tabs; the big tabs are in `screens/staff/`. `staff/myOverview.js` works out the person's own figures (used by the staff dashboard and tabs). |

The admin portal, staff portal and module player download when first shown (`Screens.jsx`),
so the sign-in page needs only the main bundle.

## Adding something

- **New shared state**: a `useState` in `useAppState.js` (and add it to the `return` at the end).
- **New table**: read it in `data/useLoadAll.js`; save it from the `actions/` file for its area
  (or an auto-sync effect in `data/useSyncEffects.js` for a register edited in place).
- **New action**: a function in the `actions/` file for its area, added to that file's `return`.
  It can use anything from `useAppState` or an earlier `create…` (the order is in App.jsx);
  list what it uses in the `const { … } = app;` at the top of the file.
- **New admin page**: a lazy component in `lazyParts.jsx`, a menu entry and
  `{atab==="x" && <MyPage …/>}` in `screens/AdminPortal.jsx`, a line in `quickSearch.js`, and
  the page name in `lib/router.js`.
- **New bell item**: in `bell/adminNotifications.js` or `staffNotifications.js`, with a check in
  `tests/portal/belllib.mjs`. If it needs more data, add it to the call in the portal.

## Rules

1. **Hooks** (`useState`, `useEffect`, `useMemo`, `use…`) only in `useAppState.js`, the `use…`
   files and at the top of a component, never inside an `if`, a loop or a callback. `create…`
   functions must not call hooks (they're ordinary functions).
2. A `create…(app)` can only use names from `useAppState` or the `create…` calls above it in
   App.jsx. A name used but not listed in its `const { … } = app;` is reported by `npm run lint`;
   a name listed that isn't made until later is `undefined`, so keep the order in App.jsx.
3. Compare ids as strings, dates as `YYYY-MM-DD`, show dates with `ukDate()`, colours from `T`.
