# Zeus Protect — Vite Module Structure

This is the modularised version of `zeus-hs-portal-v4-supabase_stable_11-06-26.jsx`
(17,890 lines, single file) split into a standard Vite project. The original file
is preserved untouched at the project root for reference/diff purposes if you keep it nearby.

## What changed, and what didn't

This was a **mechanical extraction**, not a rewrite. Every component, data
constant, and the App shell were cut out by exact line range and given an
`export`, then wired up with `import` statements pointing at the new file
locations. No component logic, JSX, or business logic was rewritten.

Two pre-existing bugs in the original file were fixed in passing because the
Vite build flagged them (they were harmless but worth a one-line cleanup
while we were already touching this code):

1. The theme-cycle button in `App.jsx` had a duplicate `title` attribute on
   the same JSX element (browsers silently took the later one — display
   behaviour is unchanged).
2. The Excel cell style object in `AdminIncidentTab.jsx`'s export function had
   a duplicate `font` key (JS silently took the later one — the bold+white
   styling that was actually rendering is unchanged).

Nothing else was altered. In particular:

- **`E()` emoji helper** (`lib/emoji.js`) still calls `React.useContext` on
  every render, exactly as it did in the source file. The fix mentioned in
  earlier sessions (replacing it with a module-level `_emojiMode` variable)
  was **not** present in this specific source file, so it was not
  retroactively applied here. If you want that fix, it's a quick follow-up.
- **Supabase credentials**: the uploaded source file had placeholder values
  (`YOUR_PROJECT_ID`, `YOUR_ANON_PUBLIC_KEY`). The project URL has been
  restored to `aoahugfyswgcisfiosyn.supabase.co` from prior context, but the
  **anon key still needs to be pasted in** at `src/lib/supabase.js` — search
  for the `TODO` comment.

## Structure

```
src/
  lib/            Supabase client, emoji helper, date/expiry helpers, file-type constants
  theme/           Z / Z_LIGHT / Z_SLATE / ... theme token objects + getThemeTokens()
  shared/           Cross-domain UI primitives: Pill, Avatar, Bar, StatCard, HelpTip,
                    SectionHeader, NotificationBell, RiskMatrix, ZeusLogo, useWindowWidth
  data/              Seed/static data constants — one file per domain (seedUsers,
                      seedTraining, seedIncidents, seedRiskAssessments, etc.)
  domains/            One folder per H&S module, matching the app's nav structure:
    dse/, training/, documents/, riskAssessments/, incidents/, machinery/,
    equipment/, inspections/, coshh/, fireSafety/, firstAid/, contractors/,
    permits/, staff/
  App.jsx             The ~3,770-line application shell: all useState/useEffect,
                       the dbSave*/dbLoad* Supabase sync functions, and the main
                       JSX layout/routing. This was intentionally NOT split
                       further this round — see "What wasn't done" below.
  main.jsx            ReactDOM mount point
```

Every domain folder's components were checked against the original file for
their actual cross-references (which shared primitives they use, which data
files they import) — nothing was assumed; it was derived by grepping each
component's body. `App.jsx`'s own 49-line import block was generated the same
way: every exported symbol was checked against App.jsx's body for real usage
before being added.

## What wasn't done (and why)

`App.jsx` itself was extracted as a single file, not decomposed further. It
holds ~70 `useState` calls, ~15 `useEffect` sync watchers, ~40 `dbSave*`/`dbLoad*`
Supabase functions, and the JSX view router — all of which currently share
closures and state in a way that would require a real refactor (e.g. a reducer,
context providers, or custom hooks) to split safely. That's a meaningfully
higher-risk change than a mechanical extraction and wasn't part of this pass.
Per the trigger points noted previously (second developer joining, more than
2-3 updates/week, or the file exceeding ~25,000 lines), this is worth revisiting
later — but the 3,770-line App.jsx is a much smaller, more manageable unit than
the original 17,890-line file even as-is.

## Verification performed

- Every line of the original 17,890-line file was tracked through extraction;
  a coverage script confirmed zero gaps (aside from blank lines and decorative
  comments) and zero overlapping extractions.
- All 73 extracted files were parsed individually with Babel's React preset —
  zero syntax errors.
- A full `vite build` was run against the assembled project — it compiled
  cleanly (98 modules, single bundle, no errors).
- The Vite dev server was booted and confirmed to start without errors.

This doesn't guarantee the app is bug-for-bug identical at runtime (a build
passing isn't the same as a full manual QA pass), but it gives high confidence
that the split didn't break anything structural.

## Getting started

```bash
npm install
npm run dev      # local dev server at http://localhost:5173
npm run build    # production build to dist/
```

Before running against your real Supabase project, paste your anon key into
`src/lib/supabase.js` (marked with a TODO comment).

## Suggested next steps

1. Paste in the real Supabase anon key and do a smoke test against a staging
   branch/Netlify preview deploy, per your existing dev → main workflow.
2. Push this structure to GitHub as a new branch, not directly to `main`.
3. Do a manual pass through each H&S module in the running app to confirm
   behaviour matches the original single-file version before merging.
4. Consider whether to apply the `E()` emoji helper fix now that everything's
   modular and the change is isolated to one small file.
