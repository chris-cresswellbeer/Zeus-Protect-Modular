# `src/mobile` — Zeus Protect PWA

An installable, offline-capable phone experience for the existing Zeus Protect
portal. It is a **view over the state App.jsx already owns** — it does not
duplicate domain logic and it does not talk to Supabase directly.

Nothing in `src/App.jsx` or `src/domains/` is modified by these files. The only
change needed in the existing app is the mount described below.

## What is here

```
src/mobile/
  MobileApp.jsx          Shell: header, offline banner, screen router, tab bar
  ui.jsx                 Shared primitives (Row, Card, StatusChip, buttons, TabBar)
  registerSW.js          Service worker registration + install prompt
  lib/
    useOnline.js         Connectivity hook
    syncQueue.js         IndexedDB write queue + drain
  screens/
    Today.jsx            Staff home
    Training.jsx         Assigned modules
    ModulePlayer.jsx     Intro → slides → one-question quiz → certificate
    ReportHazard.jsx     Three-step hazard report with camera and dictation
    Documents.jsx        Required reading + acknowledgement
    DSEMobile.jsx        DSE self-assessment, one question per screen
    More.jsx             More tab + certificates, actions, history, appearance
    Admin.jsx            Admin overview + hazard triage
public/
  manifest.webmanifest
  sw.js
```

## Wiring it up

### 1. Mount it

In `App.jsx`, after `user` is set and before the desktop staff/admin returns:

```jsx
import MobileApp from "./mobile/MobileApp.jsx";

// …inside App(), after the `if (view==="login")` block:
if (winW <= 700 && user && !forceDesktop) {
  return (
    <MobileApp
      user={user}
      onSignOut={logout}
      onSwitchToDesktop={() => setForceDesktop(true)}
      allModules={allModules}
      assigns={assigns}
      comps={comps}
      docs={docs}
      docAssignments={docAssignments}
      docAcknowledgements={docAcknowledgements}
      dseReports={dseReports}
      incidents={incidents}
      investigations={investigations}
      theme={theme}
      setTheme={setTheme}
      setDarkMode={setDarkMode}
      db={mobileDb}
    />
  );
}
```

`winW` is the existing `useWindowWidth()` value. `forceDesktop` is a new
`useState(false)` — an escape hatch so a manager on a tablet can still reach the
full portal.

### 2. Provide `db`

`MobileApp` never imports Supabase. Give it an object of the functions that
already exist in `App.jsx`, plus optional optimistic-update callbacks so the UI
updates before the write lands:

```jsx
const mobileDb = React.useMemo(() => ({
  // real writes
  saveCompletion:  (userId, moduleId, record) => dbSaveCompletion(userId, moduleId, record),
  acknowledgeDoc:  (userId, docId, date)      => dbAcknowledgeDoc(userId, docId, date),
  saveIncident:    (record)                   => dbSaveIncident(record),
  saveDseReport:   (userId, report)           => dbSaveDseReport(userId, report),
  saveTheme:       (userId, key)              => dbSaveTheme(userId, key),
  completeAction:  (invId, actionId)          => dbCompleteAction(invId, actionId),

  // optimistic local state — keeps the UI honest while offline
  optimisticCompletion: (userId, r) =>
    setComps(p => ({ ...p, [userId]: { ...(p[userId]||{}), [r.moduleId]: { score:r.score, date:r.date, certId:r.certId } } })),
  optimisticDocAck: (userId, docId, date) =>
    setDocAcknowledgements(p => ({ ...p, [userId]: { ...(p[userId]||{}), [docId]: { date } } })),
  optimisticIncident: (rec) => setIncidents(p => [rec, ...p]),
  optimisticDseReport: (userId, report) =>
    setDseReports(p => ({ ...p, [userId]: [ ...(p[userId]||[]), report ] })),

  // navigation into existing desktop pieces
  previewDoc: (d) => setPreviewDoc(d),
}), [/* the setters above */]);
```

**These edits are already applied** — see `src/App.jsx`. Two notes on them:

- `dbSaveDseReport(userId, reports)` already existed and takes the **whole
  array** for a user, so `mobileDb.saveDseReport` appends the new report and
  passes the full list.
- `dbCompleteAction(incidentId, actionId, completedBy)` is new. It updates the
  action inside its investigation record and persists via the existing
  `dbSaveInvestigation`.

Any handler left off `db` simply degrades: the queue logs a warning and drops
that item rather than blocking the rest.

### 3. Register the service worker

In `src/main.jsx`:

```jsx
import { registerServiceWorker } from "./mobile/registerSW";
registerServiceWorker();
```

It no-ops in dev, so it will not interfere with HMR.

### 4. Link the manifest

In `index.html`, inside `<head>`:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#060d2e" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

Also widen the existing viewport tag so the safe-area insets work:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### 5. Add the icons

`public/icons/icon-192.png`, `icon-512.png` and `icon-maskable-512.png` are
referenced by the manifest and still need producing from the Zeus mark. The
maskable one needs ~20% padding inside the safe zone or Android will crop it.

## Offline model

- **Reads** — the app already loads everything into state at mount via
  `loadAll()`. Once loaded, every screen works with no connection.
- **Writes** — go through `MobileApp`'s `write()`. Online, it calls the `db`
  handler directly and falls back to the queue if the call throws. Offline, it
  queues immediately. Either way the optimistic callback fires first, so the UI
  never waits.
- **Draining** — on reconnect, and on a Background Sync wake-up. Items drain in
  insertion order and stop at the first failure, so a certificate never lands
  before the completion it belongs to.
- **Certificates** — `certId` is generated client-side (`ZSL-…`, matching the
  seed format) so the certificate can be shown immediately. The server should
  still enforce uniqueness on insert.
- **Photos** — downscaled to 1400px and JPEG-encoded at 0.7 before queueing.
  Full-resolution phone photos will exhaust the IndexedDB quota in a handful of
  reports.

## Conventions this code follows

Taken from the existing codebase, not invented:

- Inline style objects, no stylesheet, no CSS classes.
- Theme via the `Z` token object passed down as a `Z` prop; the Barlow stack as
  a `font` prop. Every screen reads `getThemeTokens(themeKey)` so all eight
  themes keep working.
- Status colours use the portal convention: text `COLOR`, fill `COLOR + "18"`,
  border `COLOR + "33"`.
- 44pt minimum touch targets. Rows are `min-height: 56`, buttons 48–54. This is a
  gloves-on requirement — do not shrink them.

## Known gaps

- **Certificate QR** — the certificates screen shows a scan affordance; the
  actual code generation is not implemented. It needs to encode the `certId` and
  verify offline.
- **Admin incidents tab** currently reuses the overview list. If the admin side
  grows, give it its own filtered screen.
- **Push notifications** — not wired. On iOS they only work once the app is
  installed to the home screen, which is the main argument for the native route
  if completion rates depend on nudges.
- **Text scale** applies a root `font-size` multiplier; a few fixed pixel sizes
  inside the screens will not scale with it. Worth converting the type scale to
  `rem` if this becomes a real accessibility requirement.
