/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/useAppState.js — all the portal's shared state
 * ═══════════════════════════════════════════════════════════════════════════
 * Every useState / useRef / useRemembered of the portal, the values worked out from them
 * (allModules, the theme tokens T, isPhone…), and the per-feature stores (racking, PPE, lone
 * working, site sign-ins). Returns one object; App.jsx adds the actions to it and shares it
 * with every screen through AppContext (useApp()).
 *
 * ⚠ RULES OF HOOKS: hooks here run in the same order on every render: never put one inside
 *   an if, a loop or a callback.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useRef, useState } from "react";
import { MACHINERY_TYPES, hasMachineryAccess } from "../data/seedMachinery";
import { useBrand } from "../lib/brand";
import { withCompany } from "../lib/brandCore";
import { addDays } from "../lib/dueDates";
import { syncEmojiMode } from "../lib/emoji";
import { useLang } from "../lib/i18n";
import { createKeyed } from "../lib/keyedSync";
import { useLoneSessions, useLoneSettings } from "../lib/loneClient";
import { localiseModule, translationKey } from "../lib/moduleTranslate";
import { usePpeIssues, usePpeSettings } from "../lib/ppeClient";
import { useRacking } from "../lib/rackClient";
import { useRemembered } from "../lib/remembered";
import { parseRoute } from "../lib/router";
import { useSiteSignins } from "../lib/siteSignins";
import { confirmLeave, unsavedLabels } from "../lib/unsaved";
import { useWindowWidth } from "../shared/hooks";
import { useSort } from "../shared/Sortable";
import { getThemeTokens, isDarkTheme } from "../theme/tokens";

export function useAppState() {
  const brand = useBrand();   // company names/logos/colours (lib/brand.js); re-renders when they change
  const [theme, setTheme] = useState("dark"); // a key from THEMES in theme/tokens.js
  const T = getThemeTokens(theme); // active theme tokens
  // darkMode (logo artwork, a few older screens) follows the theme's mode.
  const darkMode = isDarkTheme(theme);
  const setDarkMode = () => {}; // kept for older callers; darkMode now follows the theme
  const [user,    setUser]    = useState(null);
  // Remember this person's last light and last dark theme (for the header ☀/🌙 button).
  // Not before sign-in, or the starting "dark" would overwrite what they last chose.
  const signedIn = !!user;
  const [view,    setViewRaw] = useState("login");
  const [allUsers,setAllUsers]= useState([]); // loaded from the Supabase users table
  // ── Auth & users ──
  // ── Training: assigns = { [userId]: [moduleId,...] }, comps = { [userId]: { [moduleId]: {score,date,certId,answers} } } ──
  const [assigns, setAssigns] = useState({});
  const [comps,   setComps]   = useState({});
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [err,     setErr]     = useState("");
  // ── Module player (staff taking a module): mod = module being played, step = 0 intro / 1..n slides / n+1 quiz ──
  const [mod,     setMod]     = useState(null);
  const [step,    setStep]    = useState(0);
  const [qans,    setQans]    = useState({});
  const [qsub,    setQsub]    = useState(false);
  const [hotspotComplete, setHotspotComplete] = useState({}); // { [step]: boolean } — gates "Next Slide" for hotspot activity slides
  const [playEnglish, setPlayEnglish] = useState(false);       // "Show in English" in the module player (translated modules)
  // ── Languages (lib/i18n.js, lib/moduleTranslate.js) ──
  // moduleTrans = { "<moduleId>|<lang>": module_translations row }; userLang = the signed-in person's language.
  const [moduleTrans, setModuleTrans] = useState({});
  const [userLang, setUserLang] = useState("en");
  const [profilesTick, setProfilesTick] = useState(0);   // bumped when user_profiles (which hold the language) change
  useLang();   // re-render when the wording for a language has loaded
  const [showCelebration, setShowCelebration] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null); // image URL to show in lightbox
  const [lightboxZoomed, setLightboxZoomed] = useState(false); // true = zoomed in past fit-to-screen
  // ── Navigation: atab = active ADMIN tab key, stab = active STAFF tab key (app/screens/AdminPortal.jsx, StaffPortal.jsx) ──
  const [atab,    setAtabRaw] = useState("dashboard");
  const [dashboardLayouts, setDashboardLayouts] = useState({}); // { [userId]: [cardId, ...] } — admin's saved stat-card order
  const [adminReportView, setAdminReportView] = useRemembered("admin.reportView", "staff");
  const [focusIncidentId, setFocusIncidentId] = useState(null);
  const [focusContractorId, setFocusContractorId] = useState(null); // quick search → open this contractor
  const [pagePreset, setPagePreset] = useState(null); // dashboard figure → open a page already filtered, e.g. {tab:"incidents", status:"open"}
  const [showAdminReportForm, setShowAdminReportForm] = useState(false);
  const [stab,    setStabRaw] = useState("dashboard");
  // Moving to another page asks first if a form has unsaved changes (lib/unsaved.js).
  const guarded = raw => v => { if (!unsavedLabels().length) { raw(v); return; } confirmLeave().then(ok => { if (ok) raw(v); }); };
  const setView = guarded(setViewRaw), setAtab = guarded(setAtabRaw), setStab = guarded(setStabRaw);
  // Page addresses (lib/router.js): the address the portal was opened with (a refresh,
  // bookmark or link) is applied once the person has signed in.
  const initialRouteRef = useRef(parseRoute(typeof window !== "undefined" ? window.location.hash : ""));
  const pendingModuleRef = useRef(null);   // module to reopen from the address, once modules have loaded
  const [quickEditId, setQuickEditId] = useState(null); // quick report to open in the full form (reminder deep link)
  const [cert,    setCert]    = useState(null);
  const [target,  setTarget]  = useState("1");
  const [docs,    setDocs]    = useState([]);
  const [docName, setDocName] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [docAssignments, setDocAssignments] = useState({}); // { docId: [userId, ...] }
  const [docBundles, setDocBundles] = useState([]);         // document bundles (domains/documents/bundles.js)
  const [docView, setDocView] = useState("docs");           // admin Documents tab: docs | bundles
  const [docAcknowledgements, setDocAcknowledgements] = useState({}); // { userId: { docId: { date, version } } }
  // ── Versioning history (append-only tables, see audit_manager_versioning.sql) ──
  const [docAckHistory, setDocAckHistory] = useState([]);   // every "I've read this": { user_id, doc_id, version, date }
  const [compHistory, setCompHistory]     = useState([]);   // every quiz result: { user_id, module_id, module_version, score, date, cert_id }
  const [moduleVersions, setModuleVersions] = useState([]); // snapshots of superseded module versions: { module_id, version, data, saved_at, saved_by, change, note }
  const [pendingModuleSave, setPendingModuleSave] = useState(null); // { m, prev } while the admin chooses minor/major
  // ── DSE (Display Screen Equipment) self-assessment wizard state + stored reports ──
  const [dseActive, setDseActive] = useState(false);
  const [dseAnswers, setDseAnswers] = useState({});
  const [dseComments, setDseComments] = useState({});
  const [dseSection, setDseSection] = useState(0);
  const [dseSubmitted, setDseSubmitted] = useState(false);
  // An unfinished assessment, saved to the person's account (user_profiles.data.dseDraft):
  // { answers, comments, section, at } or null. Shown in My Actions and resumed by openDse().
  const [dseDraft, setDseDraft] = useState(null);
  const [dseReports, setDseReports] = useState({});
  const [adminResponses, setAdminResponses] = useState({}); // { userId: { reportIdx_issueIdx: { comment, resolved } } }
  // ── Incidents, investigations and other H&S registers ──
  const [incidents, setIncidents] = useState([]);
  const [investigations, setInvestigations] = useState({});   // { incidentId: { ... } }
  const [investigationView, setInvestigationView] = useState(null); // incidentId to open
  const [lastLoginMap, setLastLoginMap] = useState({}); // userId -> ISO date string
  const [equipment, setEquipment] = useState([]);
  const [machineComps, setMachineComps] = useState({});
  const [siteInspections, setSiteInspections] = useState([]);
  const [customModules, setCustomModules] = useState([]); // admin-created training modules
  const [customMachineTypes, setCustomMachineTypes] = useState([]); // admin-created machinery types
  const [ras, setRas] = useState([]);
  const [permits, setPermits] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [contractorInductions, setContractorInductions] = useState({});
  const [contractorCerts, setContractorCerts] = useState({});
  const [contractorVisits, setContractorVisits] = useState({}); // risk assessments
  // contractors who signed in with the reception QR code (admins only; lib/siteSignins.js)
  const siteSignins = useSiteSignins(!!user && user.role === "admin");
  // lone working (lib/loneClient.js): settings for everyone signed in; sessions for admins and
  // line managers, for the alert bar. ?lone=ID (the link in an alert email) opens that alert.
  const loneSettings = useLoneSettings(!!user);
  const loneWatch = !!user && loneSettings.enabled && (user.role === "admin" || user.role === "manager");
  const loneSessions = useLoneSessions(loneWatch, { every: 30000 });
  const [loneFocus, setLoneFocus] = useState(() => { try { return new URLSearchParams(window.location.search).get("lone"); } catch { return null; } });
  // PPE register (lib/ppeClient.js): what each person may see (own; line managers their team; admins all).
  const ppeSettings = usePpeSettings(!!user);
  const ppeRows = usePpeIssues(!!user);
  const showMyPpe = !!user && (ppeSettings.staffCanSee || user.role === "manager");
  const [ppeFocus, setPpeFocus] = useState(null);
  // Racking (lib/rackClient.js): racking inspectors (admins + Machinery & Equipment access)
  // get the bell items; ?rack=CODE (the QR label on a bay) opens that bay for anyone.
  const rackInspector = !!user && (user.role === "admin" || hasMachineryAccess(user));
  const [rackFocus, setRackFocus] = useState(() => { try { return new URLSearchParams(window.location.search).get("rack"); } catch { return null; } });
  const racking = useRacking(!!user && (rackInspector || !!rackFocus), { checks: rackInspector });
  const [quizFailures, setQuizFailures] = useState([]); // [{ userId, userName, moduleId, moduleTitle, score, date }]
  const [extCerts, setExtCerts] = useState({}); // { userId: { certType: { fileName, fileUrl, issuedDate, expiryDate, uploadedAt } } }
  const [msdsFiles, setMsdsFiles] = useState({}); // { [chemCode]: { fileName, fileData, fileUrl, uploadedAt } }
  const [customChemicals, setCustomChemicals] = useState([]);
  const [coshhAssessments, setCoshhAssessments] = useState({}); // { chemCode: assessmentData } — coshh_assessments table
  const [emojiMode, setEmojiMode] = useState(true); // true = show emojis, false = professional mode // admin-added COSHH chemicals
  // Keep the module-level emoji flag (read by E()) in sync with state.
  // This replaces the old useContext-inside-E() approach, which violated
  // the Rules of Hooks whenever E() was called a different number of
  // times across renders (e.g. switching between staff/admin views).
  // Set during render (not only in the effect) so E() calls in THIS render already
  // use the new setting — otherwise the screen lagged one render behind the toggle.
  syncEmojiMode(emojiMode);
  // Fire safety is ONE state object holding six lists; each list maps to its own Supabase table (see dbSaveFireSafety).
  const [fireSafety, setFireSafety] = useState({ wardens:[], drills:[], alarmTests:[], extinguishers:[], emergLighting:[], fraReviews:[] });
  const [firstAidData, setFirstAidData] = useState({ aiders:[], kits:[], assessment:{} });
  // ── Module merge model ─────────────────────────────────────────────────────
  // Built-in modules live in data/seedTraining.js (TRAINING_MODULES, read-only code; loaded as builtInModules).
  // Admin changes are stored in the custom_modules table as customModules:
  //   _custom:true               → admin-created (or edited) module
  //   _custom:true,_override:true→ replaces the built-in module with the SAME id
  //   _hidden:true               → soft-deleted (hidden from assignment lists)
  // Always read modules via `allModules`, never builtInModules / TRAINING_MODULES directly.
  // allModules: custom overrides replace built-in modules with same id
  const [builtInModules, setBuiltInModules] = useState([]);   // data/seedTraining.js, loaded just after the page (see loadBuiltInModules)
  const allModules = [
    ...builtInModules.map(m => customModules.find(c=>c.id===m.id&&c._override) || m),
    ...customModules.filter(c=>!c._override),
  ].map(withCompany);   // "{company}" in built-in training text → the company's name (branding)
  // What the signed-in person sees in their own training: their language where an up-to-date
  // translation exists, otherwise English (lib/moduleTranslate.js). Admin screens use allModules.
  const myLangModules = userLang === "en" ? allModules
    : allModules.map(m => localiseModule(m, userLang, moduleTrans[translationKey(m.id, userLang)]));
  // allMachineTypes: same override/merge pattern as allModules
  const allMachineTypes = [
    ...MACHINERY_TYPES.map(m => customMachineTypes.find(c=>c.id===m.id&&c._override) || m),
    ...customMachineTypes.filter(c=>!c._override),
  ];
  const allMachineCategories = [...new Set(allMachineTypes.map(m=>m.category))];
  // ── Admin UI form/filter state (staff management, bulk actions, CSV import, doc bulk-assign) ──
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showHiddenModules, setShowHiddenModules] = useRemembered("modules.showHidden", false);
  const [staffFilterManager,  setStaffFilterManager]  = useRemembered("staff.manager", "all");
  const [staffFilterSearch,   setStaffFilterSearch]   = useState("");
  const [staffSel, setStaffSel] = useState([]); // Staff list: ticked people (string ids) for bulk actions
  const [docSel, setDocSel] = useState([]);     // H&S Documents: ticked documents for bulk actions
  const [staffSort, setStaffSortBy] = useSort("staff", { by: "name", dir: "asc" }); // Staff list column sort (shared/Sortable.jsx)
  // Due dates on assigned training (lib/dueDates.js): { uid: { mid: "YYYY-MM-DD" } }, from training_assigns.due_date
  const [dueDates, setDueDates] = useState({});
  const [assignDueChoice, setAssignDueChoice] = useRemembered("assign.dueChoice", "");   // Assign Training: due date for new assignments
  const [assignDueDate, setAssignDueDate] = useRemembered("assign.dueDate", "");
  const newAssignDue = () => assignDueChoice === "date" ? (assignDueDate || null) : assignDueChoice ? addDays(Number(assignDueChoice)) : null;
  const [showBulkReset, setShowBulkReset] = useState(false);
  const [docFolder, setDocFolder] = useRemembered("docs.folder", "all"); // active folder filter
  const [docSearch, setDocSearch] = useState("");    // H&S Documents search (not remembered, like other search boxes)
  const [showBulkDocAssign, setShowBulkDocAssign] = useState(false);
  const [bulkDocTarget, setBulkDocTarget] = useState("all"); // all | team | individual
  const [bulkDocManager, setBulkDocManager] = useState("");
  const [bulkDocSelectedStaff, setBulkDocSelectedStaff] = useState([]);
  const [bulkDocSelectedDocs, setBulkDocSelectedDocs] = useState([]);
  const [previewModule, setPreviewModule] = useState(null);
  const [editingModule, setEditingModule] = useState(null); // module being edited // module being previewed
  const [showQuickReport, setShowQuickReport] = useState(false);
  const [bulkResetPw, setBulkResetPw] = useState("");
  const [bulkResetScope, setBulkResetScope] = useState("all"); // "all" | "selected"
  const [bulkResetSelected, setBulkResetSelected] = useState([]);
  const [bulkResetDone, setBulkResetDone] = useState(false);
  const [staffFilterProgress, setStaffFilterProgress] = useRemembered("staff.progress", "all");
  const [staffGroupByTeam,    setStaffGroupByTeam]    = useRemembered("staff.byTeam", false);
  const [staffExpandedTeams,  setStaffExpandedTeams]  = useState({});
  const [editingStaff, setEditingStaff] = useState(null); // user object being edited
  const [newName, setNewName]           = useState("");
  const [newEmail,setNewEmail]          = useState("");
  const [newJobTitle, setNewJobTitle]   = useState("");
  const [newManager, setNewManager]     = useState("");
  const [newRole, setNewRole]           = useState("staff");
  const [newIsWarehouse, setNewIsWarehouse] = useState(false);
  const [newDepartment, setNewDepartment] = useState("");
  const [newStatus, setNewStatus] = useState("active"); // active | inactive | leaver
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]); // [{name,email,jobTitle,manager,department,role}]
  const [csvError, setCsvError] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [staffDeptFilter, setStaffDeptFilter] = useState("all");
  const [staffStatusFilter, setStaffStatusFilter] = useRemembered("staff.status", "all");
  const [addErr,  setAddErr]    = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useRemembered("assign.who", "individual");
  const [recordFor, setRecordFor] = useState(null);          // Assign Training: { uid, mid } → "Record as completed" window
  const [showSessions, setShowSessions] = useState(null);    // "all" | "team" → group session records (training/TrainingEvidence.jsx)
  const [evidenceFor, setEvidenceFor] = useState(null);      // { uid, mid } → attach evidence to one recorded completion
  const [showImportPrior, setShowImportPrior] = useState(false); // Assign Training: import prior training (CSV)
  const [groupSessionFor, setGroupSessionFor] = useState(null); // "all" (admin) | "team" (line manager) → group session window
  const [lastBackup, setLastBackup] = useState(undefined);   // admin: when the last full backup was downloaded (null = never)
  const [bulkManager, setBulkManager] = useRemembered("assign.manager", "");
  // ── Session safety ──
  const [dbReady, setDbReady] = useState(false); // true once initial Supabase load is complete
  // NOTE: lockout counters live only in memory — a page refresh resets them. For real brute-force
  // protection this would need to be enforced server-side.
  const [loginAttempts, setLoginAttempts] = useState({}); // { email: { count, lockedUntil } }
  // Supabase sign-in mode (lib/auth.js): true while the person must replace a temporary password.
  const [mustChangePw, setMustChangePw] = useState(false);
  const [signingIn, setSigningIn] = useState(false);   // Supabase sign-in: loading data after the password check
  // Temporary passwords to show the admin once: { title, items:[{name,login,password}], failures:[{name,error}] }
  const [tempPwNotice, setTempPwNotice] = useState(null);
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 15;

  // Global font stack + responsive breakpoints (desktop layouts collapse at ≤1024px).
  const font = "'Barlow','Trebuchet MS',system-ui,sans-serif";
  // Welcome video (shared/WelcomeVideo.jsx): set by finishLogin() on someone's very first
  // sign-in; shown once they're in the portal (after choosing their password, if asked to).
  const [welcomePending, setWelcomePending] = useState(false);
  const [showWelcomeSettings, setShowWelcomeSettings] = useState(false);
  const winW = useWindowWidth();
  const isMobile = winW <= 1024;
  const isSmall = winW <= 480;

  // ── Mobile PWA ──────────────────────────────────────────────────────────────
  // Phone-sized viewports get the dedicated mobile shell in src/mobile. This is
  // an escape hatch, not a lock-in: "Use the full portal" in the mobile More tab
  // sets forceDesktop and returns the user here.
  const isPhone = winW <= 700;
  const [forceDesktop, setForceDesktop] = useState(false);
  // Light themes: darken the pale dark-theme text colours so admin text stays readable.
  // The phone layout does this itself, because "Follow system" can show a different theme.
  const phoneLayout = isPhone && !!user && !forceDesktop;
  const routerOn = !!user && (view === "admin" || view === "staff") && !(isPhone && !forceDesktop);
  // Keep the address in step with the page; each page change is a new Back/Forward step.
  // (After Back/Forward the address already matches, so nothing is added.)
  const routeStartedRef = useRef(false);

  // Runs ONCE on first render. Each table is fetched in parallel, then converted
  // from database shape (snake_case columns, one row per record) into the
  // in-memory shape the UI uses (camelCase, often maps keyed by userId).
  // If a table returns no rows, that screen is simply empty.
  // ADDING A NEW TABLE: add the query to the array below, add a matching
  // variable name (same position!) in the destructuring list, add it to the
  // error-logging list, then add a block that converts rows → state.
  // dbReady is set in `finally`, so the app always leaves the splash screen.
  // ── Load all persisted data from Supabase on mount ───────────────────────────
  // loadAll is also called after sign-in in Supabase sign-in mode (see login()),
  // because the database only returns data once it knows who is asking.
  const loadAllRef = useRef(null);

  // HOW AUTO-SYNC WORKS (the effects are in app/data/useSyncEffects.js)
  // `_ready` stays false until loadAll() has finished, so the initial setState
  // calls from loading do NOT trigger a save-back. After that, whenever one of
  // these collections changes (from anywhere in the app) the records in it that
  // changed are written to Supabase. Collections NOT saved this way (e.g. permits,
  // users, assigns, completions) are saved explicitly by the code that changes them.
  // ⚠ dseReports/adminResponses effects convert uid with Number(uid) —
  //   fine for numeric ids, but a non-numeric text id would become NaN.
  // ── Auto-sync watchers — fire whenever state changes after initial load ───────
  const _ready = useRef(false);
  // True only if every Fire Safety table was read successfully at load. Deleting
  // "rows no longer in the list" is only safe when we know the list came from the
  // database (not seed data shown because a read failed).
  const fireLoadOkRef = useRef(false);
  // Last version of each incident / investigation known to be in the database
  // (id → stableJSON). The auto-sync effects below only write records that differ,
  // so one browser can no longer overwrite another's newer changes with its stale
  // copy just because something ELSE changed. refreshSharedRecords() keeps these up to date.
  const incidentSavedRef = useRef(new Map());
  const investigationSavedRef = useRef(new Map());
  const incidentWritingRef = useRef(new Set());       // incident ids with a save in flight
  const investigationWritingRef = useRef(new Set());
  // The version of each investigation this browser last read from / wrote to the
  // database. Before saving, the DB copy is compared with it: if someone else has
  // saved in between, the two sets of changes are combined (investigationMerge.js)
  // instead of the last save silently wiping out the other.
  const investigationBaseRef = useRef(new Map());
  const dseSavedRef = useRef(new Map());
  const historyReadyRef = useRef(false);   // stage-2 history tables loaded (loadHistory)
  const historyIdsRef = useRef(null);      // ids of the training history rows last read (refresh skips it if unchanged)   // last saved copy of each person's DSE assessments
  // Registers kept as lists of records: what was last saved/loaded, per record (lib/keyedSync.js),
  // so only changed records are written and other people's changes are never overwritten.
  const regRef = useRef(null);
  if (!regRef.current) {
    const noFile = r => { const { _fileObj, ...rest } = r || {}; return rest; };
    const noFra  = r => { const { _fileObj, fileData, ...rest } = r || {}; return rest; };
    regRef.current = {
      equipment: createKeyed(), inspections: createKeyed(), modules: createKeyed(), machineTypes: createKeyed(),
      fire: { wardens: createKeyed(noFile), drills: createKeyed(noFile), alarmTests: createKeyed(noFile),
              extinguishers: createKeyed(noFile), emergLighting: createKeyed(noFile), fraReviews: createKeyed(noFra) },
    };
  }
  const firstAidSavedRef = useRef(null);         // last saved/loaded first aid register (JSON)
  const firstAidWroteRef = useRef(0);            // when this browser last saved the first aid register
  const dseRespSavedRef = useRef(new Map());     // last saved copy of each DSE response ("uid|ri|ii")
  const refreshBusyRef = useRef(false);
  // Training/reading records this browser just changed: key → time ("c:uid:mid", "k:uid:docId", "a:uid").
  const recentWriteRef = useRef(new Map());

  // Only admins may change shared registers, so other people's browsers don't try to
  // save them back (the database would refuse anyway).
  const writesAll = () => !!user && user.role === "admin";
  // Machinery Competence + Equipment Register: also people with Machinery & Equipment access.
  const writesMachinery = () => writesAll() || hasMachineryAccess(user);

  // Saves the full list of staff a document is assigned to (only the differences are written).
  // Saves for the same document / person run one after another (quick tick-untick
  // clicks can't overlap and leave the database different from the screen).
  const saveQueueRef = useRef(new Map());

  return {
    brand, theme, setTheme, T, darkMode, setDarkMode, user, setUser, signedIn, view, setViewRaw, allUsers,
    setAllUsers, assigns, setAssigns, comps, setComps, email, setEmail, pass, setPass, err, setErr, mod,
    setMod, step, setStep, qans, setQans, qsub, setQsub, hotspotComplete, setHotspotComplete, playEnglish,
    setPlayEnglish, moduleTrans, setModuleTrans, userLang, setUserLang, profilesTick, setProfilesTick,
    showCelebration, setShowCelebration, lightboxSrc, setLightboxSrc, lightboxZoomed, setLightboxZoomed,
    atab, setAtabRaw, dashboardLayouts, setDashboardLayouts, adminReportView, setAdminReportView,
    focusIncidentId, setFocusIncidentId, focusContractorId, setFocusContractorId, pagePreset, setPagePreset,
    showAdminReportForm, setShowAdminReportForm, stab, setStabRaw, guarded, setView, setAtab, setStab,
    initialRouteRef, pendingModuleRef, quickEditId, setQuickEditId, cert, setCert, target, setTarget, docs,
    setDocs, docName, setDocName, previewDoc, setPreviewDoc, docAssignments, setDocAssignments, docBundles,
    setDocBundles, docView, setDocView, docAcknowledgements, setDocAcknowledgements, docAckHistory,
    setDocAckHistory, compHistory, setCompHistory, moduleVersions, setModuleVersions, pendingModuleSave,
    setPendingModuleSave, dseActive, setDseActive, dseAnswers, setDseAnswers, dseComments, setDseComments,
    dseSection, setDseSection, dseSubmitted, setDseSubmitted, dseDraft, setDseDraft, dseReports,
    setDseReports, adminResponses, setAdminResponses, incidents, setIncidents, investigations,
    setInvestigations, investigationView, setInvestigationView, lastLoginMap, setLastLoginMap, equipment,
    setEquipment, machineComps, setMachineComps, siteInspections, setSiteInspections, customModules,
    setCustomModules, customMachineTypes, setCustomMachineTypes, ras, setRas, permits, setPermits,
    contractors, setContractors, contractorInductions, setContractorInductions, contractorCerts,
    setContractorCerts, contractorVisits, setContractorVisits, siteSignins, loneSettings, loneWatch,
    loneSessions, loneFocus, setLoneFocus, ppeSettings, ppeRows, showMyPpe, ppeFocus, setPpeFocus,
    rackInspector, rackFocus, setRackFocus, racking, quizFailures, setQuizFailures, extCerts, setExtCerts,
    msdsFiles, setMsdsFiles, customChemicals, setCustomChemicals, coshhAssessments, setCoshhAssessments,
    emojiMode, setEmojiMode, fireSafety, setFireSafety, firstAidData, setFirstAidData, builtInModules,
    setBuiltInModules, allModules, myLangModules, allMachineTypes, allMachineCategories, showAddStaff,
    setShowAddStaff, showHiddenModules, setShowHiddenModules, staffFilterManager, setStaffFilterManager,
    staffFilterSearch, setStaffFilterSearch, staffSel, setStaffSel, docSel, setDocSel, staffSort,
    setStaffSortBy, dueDates, setDueDates, assignDueChoice, setAssignDueChoice, assignDueDate,
    setAssignDueDate, newAssignDue, showBulkReset, setShowBulkReset, docFolder, setDocFolder, docSearch,
    setDocSearch, showBulkDocAssign, setShowBulkDocAssign, bulkDocTarget, setBulkDocTarget, bulkDocManager,
    setBulkDocManager, bulkDocSelectedStaff, setBulkDocSelectedStaff, bulkDocSelectedDocs,
    setBulkDocSelectedDocs, previewModule, setPreviewModule, editingModule, setEditingModule,
    showQuickReport, setShowQuickReport, bulkResetPw, setBulkResetPw, bulkResetScope, setBulkResetScope,
    bulkResetSelected, setBulkResetSelected, bulkResetDone, setBulkResetDone, staffFilterProgress,
    setStaffFilterProgress, staffGroupByTeam, setStaffGroupByTeam, staffExpandedTeams, setStaffExpandedTeams,
    editingStaff, setEditingStaff, newName, setNewName, newEmail, setNewEmail, newJobTitle, setNewJobTitle,
    newManager, setNewManager, newRole, setNewRole, newIsWarehouse, setNewIsWarehouse, newDepartment,
    setNewDepartment, newStatus, setNewStatus, showCsvImport, setShowCsvImport, csvPreview, setCsvPreview,
    csvError, setCsvError, staffSearch, setStaffSearch, staffDeptFilter, setStaffDeptFilter,
    staffStatusFilter, setStaffStatusFilter, addErr, setAddErr, mobileMenuOpen, setMobileMenuOpen,
    bulkTarget, setBulkTarget, recordFor, setRecordFor, showSessions, setShowSessions, evidenceFor,
    setEvidenceFor, showImportPrior, setShowImportPrior, groupSessionFor, setGroupSessionFor, lastBackup,
    setLastBackup, bulkManager, setBulkManager, dbReady, setDbReady, loginAttempts, setLoginAttempts,
    mustChangePw, setMustChangePw, signingIn, setSigningIn, tempPwNotice, setTempPwNotice,
    MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES, font, welcomePending, setWelcomePending, showWelcomeSettings,
    setShowWelcomeSettings, winW, isMobile, isSmall, isPhone, forceDesktop, setForceDesktop, phoneLayout,
    routerOn, routeStartedRef, loadAllRef, _ready, fireLoadOkRef, incidentSavedRef, investigationSavedRef,
    incidentWritingRef, investigationWritingRef, investigationBaseRef, dseSavedRef, historyReadyRef,
    historyIdsRef, regRef, firstAidSavedRef, firstAidWroteRef, dseRespSavedRef, refreshBusyRef,
    recentWriteRef, writesAll, writesMachinery, saveQueueRef
  };
}
