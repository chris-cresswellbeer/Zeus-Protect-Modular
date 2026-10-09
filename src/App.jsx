/**
 * ═══════════════════════════════════════════════════════════════════════════
 * App.jsx — Composition root of Zeus Protect (desktop portal + mobile switch)
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE DOES
 *   1. Holds ALL shared application state (users, training, incidents, docs,
 *      DSE, fire safety, etc.) as React useState in the single <App/> component.
 *   2. Loads every table from Supabase once on start-up (loadAll, below).
 *   3. Persists changes back to Supabase via the dbSave* / dbDelete* helpers,
 *      either called directly by handlers or via "auto-sync" useEffects.
 *   4. Handles login/logout, inactivity timeout and login lockout.
 *   5. Chooses which screen to render, in this order (first match wins):
 *        !dbReady                     → "Connecting to database…" splash
 *        view === "login"             → login form
 *        phone-width & logged in      → <MobileApp/> (src/mobile)
 *        dseActive (staff)            → DSE self-assessment wizard
 *        mod (staff)                  → training module player + quiz
 *        view === "staff"             → staff portal (tabs driven by `stab`)
 *        view === "admin"             → admin portal (tabs driven by `atab`)
 *   6. Passes state + setters + db helpers down to the domain tabs in
 *      src/domains/* (most are lazy-loaded to keep the first download small).
 *
 * FILE MAP (search for these banners)
 *   SortableStatGrid ............ draggable dashboard cards (shared/SortableStatGrid.jsx, lazy)
 *   ── state declarations ....... top of App()
 *   ── Load all persisted data .. loadAll() — the big Promise.allSettled
 *   ── Auto-sync watchers ....... useEffects that save whole collections
 *   ── Sync helpers ............. dbSave* / dbDelete* functions (one per table)
 *   ── Mobile permits view model / Mobile write surface (mobileDb)
 *   LOGIN / MOBILE PWA / DSE ASSESSMENT / MODULE PLAYER / CertModal
 *   STAFF PORTAL ................ staff tabs (stab)
 *   ADMIN PORTAL ................ admin tabs (atab) + global hover CSS
 *
 * DATA FLOW CONVENTIONS (please keep to these)
 *   • user_id / ids are compared as STRINGS — always wrap with String(id)
 *     (DB columns are TEXT; older records may have numeric ids in memory).
 *   • New Supabase reads go INTO the Promise.allSettled batch in loadAll().
 *   • New writes go through dbWrite() (lib/supabase.js).
 *   • Prefer upsert-with-onConflict + prune over delete-then-insert.
 *   • Seed data (src/data/*) is only a fallback when a table is empty.
 *
 * ⚠ RULES OF HOOKS: every useState/useEffect/useRef/useMemo in App() MUST sit
 *   ABOVE the `if (!dbReady) return` early return (≈ the "Show loading screen"
 *   banner). Adding a hook below it will crash with "Rendered more hooks than
 *   during the previous render". Never call hooks inside .map(), IIFEs or
 *   conditionals — extract a module-level component instead (see shared/SortableStatGrid.jsx).
 *
 * KNOWN TECHNICAL DEBT (documented, not yet addressed)
 *   • Auto-sync effects re-save the ENTIRE collection on any change (e.g. every
 *     incident is upserted when one changes). A "save only the changed record"
 *     refactor is planned.
 *   • No protection against two admins editing the same record at once
 *     (last write wins).
 *   • Saves never clear a person's rows and write them back: training and document
 *     assignments and DSE assessments compare with what's stored and add, change or
 *     remove only the differences, so a dropped connection can't lose records.
 *   • This file is very large (~4,000 lines). Staff/admin tab bodies that are
 *     still inline here are good candidates for extraction into src/domains/.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useRef } from "react";
// ── Seed / reference data (src/data). Used as defaults until Supabase has rows. ──
import { EXT_CERT_TYPES } from "./data/seedExtCerts";
import { INSP_TYPES } from "./data/seedInspections";
import { PERMIT_TYPES } from "./data/seedPermits";
import { isWarehouseWorker, hasMachineryAccess, MACHINERY_TYPES, machineState, compsFor } from "./data/seedMachinery";
import { TRAINING_MODULES } from "./data/seedTraining";
// ── Domain tabs. `React.lazy` = the tab's code is only downloaded the first time it is
// opened (code-splitting). Each lazy tab must be rendered inside <React.Suspense>.
// The `.then(m => ({ default: m.X }))` adapts a NAMED export to what React.lazy expects.
// ── Parts of the portal loaded only when first shown ─────────────────────────
// Each is a normal component name, so the code that uses it doesn't change; the file
// itself is downloaded the first time it appears. Keeps the first download small
// (most people never open most of these on a given day). Hooks: none here.
const LAZY_PAGE  = <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", color: "#94a3b8", background: "#060d2e" }}>Loading…</div>;
const LAZY_BLOCK = <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading…</div>;
function lazyPart(loader, fallback = null) {
  const L = React.lazy(loader);
  const Part = props => <React.Suspense fallback={fallback}><L {...props}/></React.Suspense>;
  return Part;
}
const RecordCompletionModal = lazyPart(() => import("./domains/training/RecordCompletion").then(m => ({ default: m.RecordCompletionModal })), null);
const ImportPriorTrainingModal = lazyPart(() => import("./domains/training/RecordCompletion").then(m => ({ default: m.ImportPriorTrainingModal })), null);
const GroupSessionModal = lazyPart(() => import("./domains/training/RecordCompletion").then(m => ({ default: m.GroupSessionModal })), null);
const DSEAssessment = lazyPart(() => import("./domains/dse/DSEAssessment").then(m => ({ default: m.DSEAssessment })), LAZY_PAGE);
const MachineryEquipmentPage = lazyPart(() => import("./domains/machinery/MachineryEquipmentPage").then(m => ({ default: m.MachineryEquipmentPage })), LAZY_BLOCK);
const QuickReportModal = lazyPart(() => import("./domains/incidents/QuickReportModal").then(m => ({ default: m.QuickReportModal })), null);
const EditStaffModal = lazyPart(() => import("./domains/staff/EditStaffModal").then(m => ({ default: m.EditStaffModal })), null);
const ModulePreviewModal = lazyPart(() => import("./domains/training/ModulePreviewModal").then(m => ({ default: m.ModulePreviewModal })), null);
const HotspotActivity = lazyPart(() => import("./domains/training/HotspotActivity").then(m => ({ default: m.HotspotActivity })), LAZY_BLOCK);
const TempPasswordsModal = lazyPart(() => import("./shared/TempPasswordsModal").then(m => ({ default: m.TempPasswordsModal })), null);
const SignInAccountsPanel = lazyPart(() => import("./domains/staff/SignInAccountsPanel").then(m => ({ default: m.SignInAccountsPanel })), LAZY_BLOCK);
const MobileApp = lazyPart(() => import("./mobile/MobileApp.jsx").then(m => ({ default: m.default })), LAZY_PAGE);
const CertificateModal = lazyPart(() => import("./domains/training/CertificateModal").then(m => ({ default: m.CertificateModal })), null);
const DocBundles = lazyPart(() => import("./domains/documents/DocBundles").then(m => ({ default: m.DocBundles })), LAZY_BLOCK);
const MyBundles = lazyPart(() => import("./domains/documents/DocBundles").then(m => ({ default: m.MyBundles })));
const LazySortableStatGrid = React.lazy(() => import("./shared/SortableStatGrid"));

const LazyContractorsTab = React.lazy(() => import("./domains/contractors/ContractorsTab").then(m => ({ default: m.ContractorsTab })));
const LazyMyTeamTab = React.lazy(() => import("./domains/manager/MyTeamTab").then(m => ({ default: m.MyTeamTab })));
const LazyAuditTrailTab = React.lazy(() => import("./domains/audit/AuditTrailTab").then(m => ({ default: m.AuditTrailTab })));
const LazyCoshhTab = React.lazy(() => import("./domains/coshh/CoshhTab").then(m => ({ default: m.CoshhTab })));
import { DocCard } from "./domains/documents/DocCard";
import { SlideVideo } from "./shared/SlideVideo";
import { parseRoute, routeHash, routeAllowed } from "./lib/router";
import { notify, ask, notifyAfterReload, setFeedbackTheme } from "./shared/Feedback";
import { confirmLeave, unsavedLabels, setDraftUser, clearDrafts } from "./lib/unsaved";
import { mapBundleRows, bundleRow, addAssignments, removeAssignments, bundlesFor, bundleNamesOf, withoutDoc, withoutMember } from "./domains/documents/bundles";
import { ExternalCertsSection } from "./domains/documents/ExternalCertsSection";
import { PreviewModal } from "./domains/documents/PreviewModal";
import { openFile } from "./lib/fileAccess";
import { ScrollNav } from "./shared/ScrollNav";
import { BackupPanel, BACKUP_DUE_DAYS } from "./domains/audit/BackupPanel";
import { lastBackupAt } from "./lib/backup";
import { EvidenceLinks, AttachEvidenceModal, SessionsModal } from "./domains/training/TrainingEvidence";
import { uploadEvidence, listSessions, sessionKey, evidenceLabel } from "./domains/training/evidence";
import { teamOf } from "./domains/manager/team";
import { isPassed, scoreText, recordedText, passMarkOf } from "./domains/training/completion";
import { DSE_RENEWAL_MONTHS, DSE_QUESTION_COUNT } from "./data/seedDse";
const LazyStaffDSETab = React.lazy(() => import("./domains/dse/StaffDSETab").then(m => ({ default: m.StaffDSETab })));
const LazyEquipmentTrackerTab = React.lazy(() => import("./domains/equipment/EquipmentTrackerTab").then(m => ({ default: m.EquipmentTrackerTab })));
const LazyFireSafetyTab = React.lazy(() => import("./domains/fireSafety/FireSafetyTab").then(m => ({ default: m.FireSafetyTab })));
const LazyFirstAidRegisterTab = React.lazy(() => import("./domains/firstAid/FirstAidRegisterTab").then(m => ({ default: m.FirstAidRegisterTab })));
const LazyAdminIncidentTab = React.lazy(() => import("./domains/incidents/AdminIncidentTab").then(m => ({ default: m.AdminIncidentTab })));
const LazyIncidentTracker = React.lazy(() => import("./domains/incidents/IncidentTracker").then(m => ({ default: m.IncidentTracker })));
const LazyInvestigationTab = React.lazy(() => import("./domains/incidents/InvestigationTab").then(m => ({ default: m.InvestigationTab })));
import { isIncompleteQuickReport, myIncompleteQuickReports, isQuickReportOverdue, quickReportDueLabel } from "./domains/incidents/quickReportStatus";
const LazySiteInspectionsTab = React.lazy(() => import("./domains/inspections/SiteInspectionsTab").then(m => ({ default: m.SiteInspectionsTab })));
const LazySiteSettingsTab = React.lazy(() => import("./domains/settings/SiteSettingsTab").then(m => ({ default: m.SiteSettingsTab })));
const LazyAdminMachineryTab = React.lazy(() => import("./domains/machinery/AdminMachineryTab").then(m => ({ default: m.AdminMachineryTab })));
const LazyMachineryCompetenceTab = React.lazy(() => import("./domains/machinery/MachineryCompetenceTab").then(m => ({ default: m.MachineryCompetenceTab })));
const LazyPermitsTab = React.lazy(() => import("./domains/permits/PermitsTab").then(m => ({ default: m.PermitsTab })));
const LazyRiskAssessmentTab = React.lazy(() => import("./domains/riskAssessments/RiskAssessmentTab").then(m => ({ default: m.RiskAssessmentTab })));
import { generateRAHtml } from "./domains/riskAssessments/generateRAHtml";
const LazyAccountTab = React.lazy(() => import("./domains/staff/AccountTab").then(m => ({ default: m.AccountTab })));
const LazyStaffActionsTab = React.lazy(() => import("./domains/staff/StaffActionsTab").then(m => ({ default: m.StaffActionsTab })));
const LazyCreateModuleTab = React.lazy(() => import("./domains/training/CreateModuleTab").then(m => ({ default: m.CreateModuleTab })));
const LazyReportsTab = React.lazy(() => import("./domains/training/ReportsTab").then(m => ({ default: m.ReportsTab })));
import { isHtmlContent, ensureRteStyles } from "./domains/training/slideTextUtils";
// ── Core libraries, shared UI and theme ──
import { generateStaffPDF } from "./domains/training/generateStaffPDF";   // kept up front: it opens a window, which must happen straight from the click
import { sanitizeHtml } from "./lib/sanitizeHtml";
import { EXPIRY_WARNING_DAYS, getExpiryStatus, localISO, todayISO, localDateTime } from "./lib/dates";
import { EmojiCtx, E, syncEmojiMode } from "./lib/emoji";
import { startPlainSymbols, stopPlainSymbols } from "./lib/plainSymbols";
import { sb, hashPassword, DEFAULT_HASH, dbWrite } from "./lib/supabase";
import { AUTH_MODE, signIn, signOut, meta as authMeta, adminCall, makeTempPassword, checkPassword as authCheckPassword, changeOwnPassword } from "./lib/auth";
import { ForcePasswordChange } from "./shared/ForcePasswordChange";
import { uploadPhotos, PHOTO_BUCKET } from "./lib/photos";
import { HelpTip } from "./shared/HelpTip";
import { ZeusLogo, ZeusProtectLogo, ZEUS_LOGO_LIGHT_SRC } from "./shared/Logo";
import { NotificationBell } from "./shared/NotificationBell";
import { useWindowWidth, MobileCard, MobileCardRow } from "./shared/hooks";
import { Pill, Avatar, Bar } from "./shared/primitives";
import { Z, getThemeTokens, getTheme, isDarkTheme, rememberTheme, oppositeTheme } from "./theme/tokens";
import { applyLightThemeFix, isLightTheme } from "./lib/lightThemeFix";
import { mergeInvestigation, changedSince } from "./domains/incidents/investigationMerge";
import { QuickSearch } from "./shared/QuickSearch";
import { NewVersionModal } from "./shared/NewVersionModal";   // also used by DocCard, so it can't load separately
import { ticksFrom, Tick, TickAll, BulkBar } from "./shared/BulkBar";
import { NavMenu } from "./shared/NavMenu";
import { useSort, sortRows, SortButton } from "./shared/Sortable";
import { getProgress, saveProgress, clearProgress, resumeLabel } from "./lib/moduleProgress";
import { mapDueRows, dueInfo, dueText, formatDue, addDays, DUE_CHOICES, overdueByPerson } from "./lib/dueDates";
import { startSession, stopSession, setSessionTheme } from "./shared/SessionTimeout";
import { fireSummary, todayLocal as fireToday } from "./domains/fireSafety/fireLogic";
import { riddorDue, riddorDueText, riddorUrgent } from "./domains/incidents/riddor";
import { loadSiteLists, getSiteLists, coverShifts, isAllShift } from "./lib/siteLists";
import { loadWelcomeVideo, showWelcome, hideWelcome, WelcomeReplay, WelcomeVideoSettings } from "./shared/WelcomeVideo";
import { useRemembered, clearRemembered } from "./lib/remembered";
import { setAuditUser, primeAudit, primeAuditList, primeAuditMap, auditRecord, auditList, auditDelete, auditEvent } from "./lib/audit";
import { pingIncidentAlert } from "./lib/incidentAlert";
import { sameName } from "./lib/openActions";


/**
 * The whole application. See the file header for the render order and conventions.
 * State below is grouped roughly as: auth/session → training → documents → DSE →
 * incidents/investigations → other H&S registers → admin UI form state.
 */
// One `incidents` table row → the incident record the app uses. Shared by loadAll()
// and refreshSharedRecords(). Everything without its own column comes back from the
// jsonb `details` column; the core columns below always win.
const mapIncidentRow = (r) => ({
            // Everything the core columns don't hold (injured person, witnesses,
            // first aid, post-incident, measures, corrective actions, equipment,
            // time, triaged…) comes back from the jsonb `details` column.
            // Spread first so the core columns below always win.
            ...((r.details && typeof r.details === "object") ? r.details : {}),
            id: r.id, date: r.date, type: r.type, accidentCode: r.accident_code,
            numberCode: r.number_code, location: r.location, reportedBy: r.reported_by,
            description: r.description, injuryType: r.injury_type, riddor: r.riddor, closed: r.closed,
            riddorReported: r.riddor_reported||false,
            riddorReportedDate: r.riddor_reported_date||null,
            hseReference: r.hse_reference||null,
            riddorReportedBy: r.riddor_reported_by||null,
            quickReport: !!r.quick_report,
            urgency: r.urgency||null,
            photos: Array.isArray(r.photos) ? r.photos : [],
});

// Key-order-independent JSON, used to tell whether a record really changed.
/** A short fingerprint of a history table: its row ids, plus `recorded` (attached evidence),
 *  which can change on an existing row. null if any row has no id (then always re-read). */
function idsKey(rows) {
  if (!Array.isArray(rows) || rows.some(r => r == null || r.id == null)) return null;
  return rows.map(r => `${r.id}:${r.recorded == null ? "" : stableJSON(r.recorded)}`).sort().join(",");
}

function stableJSON(v) {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableJSON).join(",") + "]";
  return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + stableJSON(v[k])).join(",") + "}";
}

// Short human-readable labels for audit-trail entries.
const INCIDENT_TYPE_LABELS = { accident:"Accident", near_miss:"Near miss", unsafe_condition:"Unsafe condition", unsafe_act:"Unsafe act" };
const incidentAuditLabel = (inc) => inc ? [inc.date, INCIDENT_TYPE_LABELS[inc.type] || inc.type, inc.location].filter(Boolean).join(" · ") : "";

// Incident fields that have their own column in the `incidents` table.
// Everything else on an incident record is stored in the jsonb `details` column.
// ── Row → state mappers for training and reading records (used by loadAll and
// by the 30-second refresh, so both build exactly the same shapes) ──
function mapAssignRows(rows) {
  const map = {};
  (rows || []).forEach(r => { const uid = String(r.user_id); (map[uid] = map[uid] || []).push(String(r.module_id)); });
  return map;
}
function mapDocAssignRows(rows) {
  const map = {};
  (rows || []).forEach(r => { const did = String(r.doc_id); (map[did] = map[did] || []).push(String(r.user_id)); });
  return map;
}
function mapCompRows(rows) {
  const map = {};
  (rows || []).forEach(r => {
    // Older versions also saved FAILED attempts here (no certificate, under 70%). A
    // failed attempt isn't a completion — those are listed under Quiz Failures.
    if (!r.recorded && !r.cert_id && r.score !== null && r.score !== undefined && Number(r.score) < 70) return;
    const uid = String(r.user_id); map[uid] = map[uid] || {};
    map[uid][String(r.module_id)] = { score: r.score, date: r.date, certId: r.cert_id, answers: r.answers, moduleVersion: r.module_version || 1, ...(r.recorded ? { recorded: r.recorded } : {}) };
  });
  return map;
}
function mapAckRows(rows) {
  const map = {};
  (rows || []).forEach(r => { const uid = String(r.user_id), did = String(r.doc_id); map[uid] = map[uid] || {}; map[uid][did] = { date: r.date, version: r.version || 1 }; });
  return map;
}
// Merge freshly-read {person: {item: record}} into what's on screen. Records this
// browser changed in the last minute keep the on-screen version (its save may still
// be on its way); everything else takes the database's version.
const RECENT_MS = 60000;
function mergeNested(cur, fresh, recent, prefix) {
  const next = {}; Object.entries(fresh).forEach(([u, m]) => { next[u] = { ...m }; });
  const now = Date.now();
  recent.forEach((t, key) => {
    if (now - t > RECENT_MS || !key.startsWith(prefix + ":")) return;
    const [, u, k] = key.split(":");
    const local = cur[u] && cur[u][k];
    if (local) { next[u] = next[u] || {}; next[u][k] = local; } else if (next[u]) delete next[u][k];
  });
  return stableJSON(next) === stableJSON(cur) ? cur : next;
}
// Also used for document assignments ({docId: [userId]}, prefix "d").
function mergeAssigns(cur, fresh, recent, prefix = "a") {
  const next = { ...fresh }; const now = Date.now();
  recent.forEach((t, key) => { if (now - t <= RECENT_MS && key.startsWith(prefix + ":")) { const u = key.slice(prefix.length + 1); if (cur[u]) next[u] = cur[u]; else delete next[u]; } });
  Object.keys(next).forEach(u => { if (!next[u] || !next[u].length) delete next[u]; });
  const norm = o => stableJSON(Object.fromEntries(Object.entries(o).filter(([, v]) => v && v.length).map(([k, v]) => [k, [...v].sort()])));
  return norm(next) === norm(cur) ? cur : next;
}

const INCIDENT_CORE_KEYS = new Set([
  "id","date","type","accidentCode","numberCode","location","reportedBy",
  "description","injuryType","riddor","closed","photos",
  "riddorReported","riddorReportedDate","hseReference","riddorReportedBy",
  "quickReport","urgency",
]);

// No demo data is built into the portal any more (it used to fill empty screens in the
// old sign-in mode, and the bundle carried a real staff list). Every screen shows only
// what is in the database. The demo data now lives in demo/ for the test scripts.

export default function App() {
  const [theme, setTheme] = useState("dark"); // a key from THEMES in theme/tokens.js
  const T = getThemeTokens(theme); // active theme tokens
  // darkMode (logo artwork, a few older screens) follows the theme's mode.
  const darkMode = isDarkTheme(theme);
  const setDarkMode = () => {}; // kept for older callers; darkMode now follows the theme
  const [user,    setUser]    = useState(null);
  // Remember this person's last light and last dark theme (for the header ☀/🌙 button).
  // Not before sign-in, or the starting "dark" would overwrite what they last chose.
  const signedIn = !!user;
  useEffect(() => { if (signedIn) rememberTheme(theme); }, [theme, signedIn]);
  const [view,    setViewRaw] = useState("login");
  const [allUsers,setAllUsers]= useState([]); // loaded from the Supabase users table
  // ── Auth & users ──
  const [passwords, setPasswords] = useState({}); // userId -> password (overrides default)
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
  const [showCelebration, setShowCelebration] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null); // image URL to show in lightbox
  const [lightboxZoomed, setLightboxZoomed] = useState(false); // true = zoomed in past fit-to-screen
  // ── Navigation: atab = active ADMIN tab key, stab = active STAFF tab key (see the render sections) ──
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
  useEffect(() => {
    syncEmojiMode(emojiMode);
    // Professional Mode: swap every emoji on the page for its plain symbol
    // (including ones not wrapped in E()); switching back restores them.
    if (emojiMode) stopPlainSymbols(); else startPlainSymbols();
  }, [emojiMode]);
  useEffect(() => { ensureRteStyles(); }, []);
  // Fire safety is ONE state object holding six lists; each list maps to its own Supabase table (see dbSaveFireSafety).
  const [fireSafety, setFireSafety] = useState({ wardens:[], drills:[], alarmTests:[], extinguishers:[], emergLighting:[], fraReviews:[] });
  const [firstAidData, setFirstAidData] = useState({ aiders:[], kits:[], assessment:{} });
  // ── Module merge model ─────────────────────────────────────────────────────
  // Built-in modules live in data/seedTraining.js (TRAINING_MODULES, read-only code).
  // Admin changes are stored in the custom_modules table as customModules:
  //   _custom:true               → admin-created (or edited) module
  //   _custom:true,_override:true→ replaces the built-in module with the SAME id
  //   _hidden:true               → soft-deleted (hidden from assignment lists)
  // Always read modules via `allModules`, never TRAINING_MODULES directly.
  // allModules: custom overrides replace built-in modules with same id
  const allModules = [
    ...TRAINING_MODULES.map(m => customModules.find(c=>c.id===m.id&&c._override) || m),
    ...customModules.filter(c=>!c._override),
  ];
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
  useEffect(() => { setFeedbackTheme(T, font); }, [theme]); // eslint-disable-line
  // Welcome video (shared/WelcomeVideo.jsx): set by finishLogin() on someone's very first
  // sign-in; shown once they're in the portal (after choosing their password, if asked to).
  const [welcomePending, setWelcomePending] = useState(false);
  const [showWelcomeSettings, setShowWelcomeSettings] = useState(false);
  useEffect(() => {
    if (!welcomePending || !user || mustChangePw) return;
    setWelcomePending(false);
    loadWelcomeVideo().then(v => { if (v) showWelcome({ video: v, name: user.name, Z: T, font }); });
  }, [welcomePending, user, mustChangePw]); // eslint-disable-line
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
  useEffect(() => { if (!phoneLayout) applyLightThemeFix(isLightTheme(theme)); }, [theme, phoneLayout]);
  const routerOn = !!user && (view === "admin" || view === "staff") && !(isPhone && !forceDesktop);
  // Keep the address in step with the page; each page change is a new Back/Forward step.
  // (After Back/Forward the address already matches, so nothing is added.)
  const routeStartedRef = useRef(false);
  useEffect(() => {
    if (!routerOn) return;
    const h = routeHash({ view, atab, stab, moduleId: view === "staff" && mod ? mod.id : null });
    if (!h || window.location.hash === h) { routeStartedRef.current = true; return; }
    if (!routeStartedRef.current) { window.history.replaceState(null, "", h); routeStartedRef.current = true; }
    else window.history.pushState(null, "", h);
  }, [routerOn, view, atab, stab, mod && mod.id]); // eslint-disable-line
  // Back / Forward
  useEffect(() => {
    if (!routerOn) return;
    const onPop = async () => {
      const r = parseRoute(window.location.hash);
      if (!r || !routeAllowed(r, user)) return;
      // unsaved work: ask once; if they stay, the address is put back by the effect above
      if (unsavedLabels().length && !(await confirmLeave())) { window.history.pushState(null, "", routeHash({ view, atab, stab, moduleId: view === "staff" && mod ? mod.id : null })); return; }
      if (r.area === "admin") { setMod(null); setViewRaw("admin"); setAtabRaw(r.tab); return; }
      setViewRaw("staff"); setStabRaw(r.tab);
      const m = r.moduleId && allModules.find(x => String(x.id) === r.moduleId);
      if (m) { if (!mod || mod.id !== m.id) startMod(m); } else setMod(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [routerOn, user, allModules, mod, view, atab, stab]); // eslint-disable-line
  // A module in the address (refresh in the player) reopens once modules have loaded.
  useEffect(() => {
    const id = pendingModuleRef.current;
    if (!id || !user) return;
    const m = allModules.find(x => String(x.id) === id);
    if (m) { pendingModuleRef.current = null; startMod(m); }
  }, [allModules, user]); // eslint-disable-line

  // (maximum-scale=1 stops iOS auto-zooming into inputs, but also disables pinch-zoom — an accessibility trade-off.)
  // ── Ensure correct viewport meta tag for mobile ─────────────────────────────
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
  }, []);

  // ── Inactivity timeout — sign out after 30 minutes of no activity ───────────
  // shared/SessionTimeout.jsx: 2-minute countdown warning with "Stay signed in";
  // a playing video counts as activity. Same on the phone layout.
  useEffect(() => {
    if (!user) { stopSession(); return; }
    startSession({
      Z: T, font,
      onSignOut: () => logout(),
      onExpire: () => {
        if (AUTH_MODE === "supabase") {
          notifyAfterReload("You were signed out after 30 minutes without activity. Sign in again to carry on where you were.", { kind: "info", timeout: 0 });
          signOut().finally(() => window.location.reload());
          return;
        }
        setUser(null); setViewRaw("login"); setMod(null); setMustChangePw(false);
        notify("You were signed out after 30 minutes without activity. Sign in again to carry on where you were.", { kind: "info", timeout: 0 });
      },
    });
    return () => stopSession();
  }, [user]); // eslint-disable-line
  useEffect(() => { setSessionTheme(T, font); }, [theme]); // eslint-disable-line
  // Remember the slide reached in a module so it can be carried on later (lib/moduleProgress.js)
  useEffect(() => {
    if (!mod || !user || view !== "staff" || qsub || step < 1) return;
    saveProgress(user.id, mod, step);
  }, [mod && mod.id, step]); // eslint-disable-line

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
  useEffect(() => {
    async function loadAll() {
      loadSiteLists();          // site-specific lists (Site Settings)
      try {
        // Fire all 35 independent reads concurrently instead of one at a
        // time. None of these queries depends on another's result, so
        // there's no correctness reason to wait for each to finish before
        // starting the next — doing so was adding the sum of every
        // round-trip's latency to every single login. allSettled (not
        // Promise.all) is used deliberately: if one table fails to load
        // (network blip, permissions issue, etc.) the other 34 should
        // still populate rather than the whole load silently aborting.
        const [
          aRes, cRes, iRes, invRes, ackRes, daRes, docRes, dseRes, resRes,
          llRes, pwRes, usersRes, upRes, ecRes, qfRes, conRes, conIndRes,
          conCertRes, conVisitRes, permitRes, raRes, cmRes, mcRes, eqRes,
          siRes, msdsRes, ccRes, fwRes, fdRes, fatRes, fexRes, felRes,
          ffrRes, faRes, cmtRes, dlRes, caRes, dahRes, chRes, mvRes, bdRes,
        ] = await Promise.allSettled([
          sb.from("training_assigns").select("*"),
          sb.from("training_completions").select("*"),
          sb.from("incidents").select("*"),
          sb.from("investigations").select("*"),
          sb.from("doc_acknowledgements").select("*"),
          sb.from("doc_assignments").select("*"),
          sb.from("documents").select("*"),
          sb.from("dse_reports").select("*"),
          sb.from("dse_admin_responses").select("*"),
          sb.from("last_logins").select("*"),
          AUTH_MODE === "supabase" ? Promise.resolve({ data: [], error: null }) : sb.from("user_passwords").select("*"),   // old sign-in only
          sb.from("users").select("*"),
          sb.from("user_profiles").select("*"),
          sb.from("ext_certs").select("*"),
          sb.from("quiz_failures").select("*"),
          sb.from("contractors").select("*"),
          sb.from("contractor_inductions").select("*"),
          sb.from("contractor_certs").select("*"),
          sb.from("contractor_visits").select("*"),
          sb.from("permits").select("*"),
          sb.from("risk_assessments").select("*"),
          sb.from("custom_modules").select("*"),
          sb.from("machine_completions").select("*"),
          sb.from("equipment").select("*"),
          sb.from("site_inspections").select("*"),
          sb.from("msds_files").select("*"),
          sb.from("custom_chemicals").select("*"),
          sb.from("fire_wardens").select("*"),
          sb.from("fire_drills").select("*"),
          sb.from("fire_alarm_tests").select("*"),
          sb.from("fire_extinguishers").select("*"),
          sb.from("fire_emerg_lighting").select("*"),
          sb.from("fire_fra_reviews").select("*"),
          sb.from("first_aid_register").select("*").eq("id","singleton"),
          sb.from("custom_machine_types").select("*"),
          sb.from("dashboard_layout").select("*"),
          sb.from("coshh_assessments").select("*"),
          // history tables load just AFTER the first screen (loadHistory below) — they grow fastest
          Promise.resolve({ data: null, error: null }),
          Promise.resolve({ data: null, error: null }),
          Promise.resolve({ data: null, error: null }),
          sb.from("doc_bundles").select("*"),
        ]);

        // Small helper: allSettled wraps each result in {status, value} or
        // {status, reason}. Treat a rejected/failed query the same as "no
        // rows" (data: null) rather than letting it throw and abort
        // everything else's processing below.
        const rows = (res) => (res.status === "fulfilled" ? (res.value?.data ?? null) : null);
        if (usersRes.status === "rejected") console.error("Supabase load error (users):", usersRes.reason);
        [aRes,cRes,iRes,invRes,ackRes,daRes,docRes,dseRes,resRes,llRes,pwRes,upRes,ecRes,qfRes,conRes,conIndRes,conCertRes,conVisitRes,permitRes,raRes,cmRes,mcRes,eqRes,siRes,msdsRes,ccRes,fwRes,fdRes,fatRes,fexRes,felRes,ffrRes,faRes,cmtRes,dlRes,caRes,dahRes,chRes,mvRes,bdRes]
          .forEach(r => { if (r.status === "rejected") console.error("Supabase load error:", r.reason); });

        // Pattern used below: rows(x) → null/[] means "nothing stored".
        // Training assigns
        const aRows = rows(aRes);
        if (aRows && aRows.length) {
          setAssigns(mapAssignRows(aRows));
          setDueDates(mapDueRows(aRows));
        } else {
          setAssigns({});
        }

        // Training completions
        const cRows = rows(cRes);
        if (cRows && cRows.length) {
          setComps(mapCompRows(cRows));
        }

        // Incidents
        const iRows = rows(iRes);
        if (iRows && iRows.length) {
          setIncidents(iRows.map(mapIncidentRow));
        }

        // Investigations
        const invRows = rows(invRes);
        if (invRows && invRows.length) {
          const map = {};
          invRows.forEach(r => { map[r.incident_id] = r.data; });
          setInvestigations(map);
        }

        // Doc acknowledgements
        const ackRows = rows(ackRes);
        if (ackRows && ackRows.length) {
          setDocAcknowledgements(mapAckRows(ackRows));
        }

        // Doc assignments
        const daRows = rows(daRes);
        if (daRows && daRows.length) {
          setDocAssignments(mapDocAssignRows(daRows));
        }

        // Document bundles (doc_bundles_table.sql — until it has been run this read fails and there are none)
        const bdRows = rows(bdRes);
        if (bdRows) setDocBundles(mapBundleRows(bdRows));

        // Documents (uploaded by admin)
        const docRows = rows(docRes);
        if (docRows && docRows.length) {
          setDocs(prev => {
            const existingIds = new Set(docRows.map(r => r.id));
            const kept = prev.filter(d => !existingIds.has(d.id));
            return [...kept, ...docRows.map(r => ({
              id: r.id, title: r.title, date: r.date, size: r.size,
              type: r.type, ext: r.ext, fileName: r.file_name, fileData: r.file_url || null, fileUrl: r.file_url || null, version: r.version || 1, reviewDate: r.review_date || null,
              description: r.description || null,
              history: Array.isArray(r.history) ? r.history : [],
            }))];
          });
        }

        // DSE reports
        const dseRows = rows(dseRes);
        if (dseRows && dseRows.length) {
          const map = {};
          dseRows.forEach(r => { const duid=String(r.user_id); map[duid] = map[duid] || []; map[duid][r.report_idx] = r.data; });
          setDseReports(map);
        }

        // Admin DSE responses
        const resRows = rows(resRes);
        if (resRows && resRows.length) {
          const map = {};
          resRows.forEach(r => {
            const ar_uid=String(r.user_id); map[ar_uid] = map[ar_uid] || {};
            map[ar_uid][`${r.report_idx}_${r.issue_idx}`] = { comment: r.comment, resolved: r.resolved, ...(r.signed_off_by ? { signedOffBy: r.signed_off_by, signedOffAt: r.signed_off_at } : {}) };
          });
          setAdminResponses(map);
        }

        // Last logins
        const llRows = rows(llRes);
        if (llRows && llRows.length) {
          const map = {};
          llRows.forEach(r => { map[String(r.user_id)] = r.last_login; });
          setLastLoginMap(map);
        }

        // Passwords
        const pwRows = rows(pwRes);
        if (pwRows && pwRows.length) {
          const map = {};
          pwRows.forEach(r => { map[String(r.user_id)] = r.password; });
          setPasswords(map);
        }

        // The users table stores the whole user object in a JSON `data` column.
        // Users — the database is the only source (a new site starts with new_site_first_admin.sql)
        const usersRows = rows(usersRes);
        if (usersRows && usersRows.length) {
          setAllUsers(usersRows.map(r => r.data));
        }

        // Stored on `window` (a global) rather than state so login() and dbSaveTheme()
        // can read the latest copy without a re-render. Treat as a private cache.
        // User profiles (theme, emojiMode preferences — separate from user records)
        const upRows = rows(upRes);
        // Store profile rows for theme restoration at login
        window.__userProfiles = Array.isArray(upRows) ? upRows : [];

        // External certificates
        const ecRows = rows(ecRes);
        if (ecRows && ecRows.length) {
          const map = {};
          ecRows.forEach(r => {
            const ec_uid=String(r.user_id); map[ec_uid] = map[ec_uid] || {};
            map[ec_uid][r.cert_type] = r.data;
          });
          setExtCerts(map);
        }

        // Quiz failures
        const qfRows = rows(qfRes);
        if (qfRows && qfRows.length) {
          setQuizFailures(qfRows.map(r => ({ ...r.data, _rowId: r.id })));   // _rowId: fallback key for "Mark reviewed"
        }

        // Contractors
        const conRows = rows(conRes);
        if (conRows?.length) setContractors(conRows.map(r=>r.data));
        const conIndRows = rows(conIndRes);
        if (conIndRows?.length) { const m={}; conIndRows.forEach(r=>{m[r.contractor_id]=r.data;}); setContractorInductions(m); }
        const conCertRows = rows(conCertRes);
        if (conCertRows?.length) { const m={}; conCertRows.forEach(r=>{m[r.contractor_id]=r.data;}); setContractorCerts(m); }
        const conVisitRows = rows(conVisitRes);
        if (conVisitRows?.length) { const m={}; conVisitRows.forEach(r=>{m[r.contractor_id]=r.data;}); setContractorVisits(m); }

        // Permits
        const permitRows = rows(permitRes);
        if (permitRows?.length) setPermits(permitRows.map(r=>r.data));

        // Same override idea as modules: DB rows are merged ON TOP of seed RAs with the same id.
        // Risk assessments (all from the database)
        const raRows = rows(raRes);
        if (raRows && raRows.length) {
          setRas(prev => {
            // Merge saved data into existing seed RAs
            const merged = prev.map(r => {
              const saved = raRows.find(x => x.id === r.id);
              return saved ? { ...r, ...saved.data } : r;
            });
            // Append any RAs created by admin that aren't in the seed list
            const existingIds = new Set(prev.map(r => r.id));
            const newRas = raRows
              .filter(x => !existingIds.has(x.id) && x.data)
              .map(x => x.data);
            return [...merged, ...newRas];
          });
        }

        // Custom modules
        const cmRows = rows(cmRes);
        if (cmRows && cmRows.length) {
          setCustomModules(cmRows.map(r => r.data));
        }

        // Custom machinery types (admin-added equipment categories)
        const cmtRows = rows(cmtRes);
        if (cmtRows && cmtRows.length) {
          setCustomMachineTypes(cmtRows.map(r => r.data));
        }

        // Dashboard stat-card order (per admin)
        const dlRows = rows(dlRes);
        if (dlRows && dlRows.length) {
          const map = {};
          dlRows.forEach(r => { map[String(r.user_id)] = r.card_order || []; });
          setDashboardLayouts(map);
        }

        // Machine completions
        const mcRows = rows(mcRes);
        if (mcRows && mcRows.length) {
          const map = {};
          mcRows.forEach(r => { const mcuid=String(r.user_id); map[mcuid] = map[mcuid] || {}; map[mcuid][r.machine_id] = { ...(r.data || {}), id: (r.data && r.data.id) || r.machine_id }; });
          setMachineComps(map);
        }

        // Equipment
        const eqRows = rows(eqRes);
        if (eqRows && eqRows.length) {
          setEquipment(eqRows.map(r => r.data));
        }

        // Site inspections
        const siRows = rows(siRes);
        if (siRows && siRows.length) {
          setSiteInspections(siRows.map(r => r.data));
        }

        // MSDS files
        const msdsRows = rows(msdsRes);
        if (msdsRows && msdsRows.length) {
          const map = {};
          msdsRows.forEach(r => { map[r.code] = { fileName: r.file_name, fileData: r.file_url, fileUrl: r.file_url, uploadedAt: r.uploaded_at }; });
          setMsdsFiles(map);
        }

        // Custom chemicals
        // Versioning history: loaded by loadHistory() once the first screen is showing.
        void dahRes; void chRes; void mvRes;

        // COSHH assessments (one per substance code)
        const caRows = rows(caRes);
        if (caRows && caRows.length) {
          const map = {};
          caRows.forEach(r => { if (r && r.code != null) map[String(r.code)] = r.data; });
          setCoshhAssessments(map);
        }

        const ccRows = rows(ccRes);
        if (ccRows && ccRows.length) {
          setCustomChemicals(ccRows.map(r => r.data));
        }

        // Fire Safety
        fireLoadOkRef.current = [fwRes, fdRes, fatRes, fexRes, felRes, ffrRes]
          .every(r => r.status === "fulfilled" && !r.value?.error);
        const fwRows  = rows(fwRes);
        const fdRows  = rows(fdRes);
        const fatRows = rows(fatRes);
        const fexRows = rows(fexRes);
        const felRows = rows(felRes);
        const ffrRows = rows(ffrRes);
        // Only override each sub-array if the DB returned rows for it.
        // If none of the tables have any rows yet (fresh install), keep seed data.
        
        setFireSafety({
          wardens:      fwRows  && fwRows.length  ? fwRows.map(r=>r.data)  : [],
          drills:       fdRows  && fdRows.length  ? fdRows.map(r=>r.data)  : [],
          alarmTests:   fatRows && fatRows.length ? fatRows.map(r=>r.data) : [],
          extinguishers:fexRows && fexRows.length ? fexRows.map(r=>r.data) : [],
          emergLighting:felRows && felRows.length ? felRows.map(r=>r.data) : [],
          fraReviews:   ffrRows && ffrRows.length ? ffrRows.map(r=>r.data) : [],
        });

        // The first aid register is a single JSON document stored in one row with id "singleton".
        // First Aid Register
        const faRow = rows(faRes);
        if (faRow && faRow.length) setFirstAidData(faRow[0].data);
      } catch (e) {
        console.error("Supabase load error:", e);
      } finally {
        setDbReady(true);
        loadHistory();   // not awaited: the portal is usable while this arrives
      }
    }
    // Stage 2: the history tables (every quiz result and every "I've read this", and old
    // module versions). They only grow, aren't needed for the first screen, and on a busy
    // site are the biggest tables. Anything added in this browser meanwhile is kept.
    async function loadHistory() {
      const [dah, ch, mv] = await Promise.all([
        sb.from("doc_ack_history").select("*"), sb.from("training_completion_history").select("*"), sb.from("module_versions").select("*"),
      ]);
      const ok = r => r && !r.error && Array.isArray(r.data);
      const keep = (fresh, cur, key) => { const have = new Set(fresh.map(key)); return [...fresh, ...cur.filter(x => !have.has(key(x)))]; };
      if (ok(dah)) setDocAckHistory(cur => keep(dah.data, cur, h => `${h.user_id}|${h.doc_id}|${h.version}|${h.date}`));
      if (ok(ch)) { setCompHistory(cur => keep(ch.data, cur, h => `${h.user_id}|${h.module_id}|${h.date}|${h.score}`)); historyIdsRef.current = idsKey(ch.data); }
      if (ok(mv)) setModuleVersions(cur => keep(mv.data, cur, v => String(v.id)));
      historyReadyRef.current = true;
    }
    loadAllRef.current = loadAll;
    if (AUTH_MODE !== "supabase") loadAll();
  }, []);

  // Every risk assessment (seed RAs and admin-created ones, as loaded from
  // risk_assessments) is turned into an HTML "document" (base64 data URL) so it
  // appears in the Documents library. These are generated in the browser once the
  // data has loaded and are NOT saved to the documents table — regenerating them
  // from `ras` is what stops a published RA vanishing from Documents on reload.
  // The id "d_<raId>" is stable, so document assignments/acknowledgements match
  // across reloads (RiskAssessmentTab.finalise uses the same id).
  useEffect(() => {
    if (!dbReady) return;
    setDocs(prevDocs => {
      const raDocs = ras.map(ra => {
        const html = generateRAHtml(ra);
        const b64 = "data:text/html;base64," + btoa(unescape(encodeURIComponent(html)));
        return {
          id: "d_" + ra.id,
          title: ra.title || "Untitled Risk Assessment",
          date: ra.date,
          size: Math.round(html.length / 1024) + " KB",
          type: "Risk Assessment",
          fileData: b64,
          fileName: (ra.title || "risk-assessment").toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"") + ".html",
          ext: "HTML",
          raId: ra.id,
        };
      });
      const raIds = new Set(raDocs.map(d => d.raId));
      return [...prevDocs.filter(d => !(d.raId && raIds.has(d.raId))), ...raDocs];
    });
  }, [dbReady]); // eslint-disable-line

  // HOW AUTO-SYNC WORKS
  // `_ready` stays false until loadAll() has finished, so the initial setState
  // calls from loading do NOT trigger a save-back. After that, whenever one of
  // these collections changes (from anywhere in the app) the whole collection is
  // written to Supabase. That's simple but chatty — see "Known technical debt"
  // in the file header. Collections NOT listed here (e.g. permits, users,
  // assigns, completions) are saved explicitly by the code that changes them.
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
  const equipmentSavedRef = useRef(new Map());   // non-admin sessions: last saved copy of each equipment item
  const refreshBusyRef = useRef(false);
  // Training/reading records this browser just changed: key → time ("c:uid:mid", "k:uid:docId", "a:uid").
  const recentWriteRef = useRef(new Map());
  const markWrite = key => recentWriteRef.current.set(key, Date.now());
  // Once data has loaded, snapshot every audited record WITHOUT logging (lib/audit.js),
  // so only real changes from here on create audit-trail entries. Declared before the
  // auto-sync effects below so the snapshots exist before their first re-save.
  useEffect(() => { if (!dbReady) return;
    primeAuditList("incident", incidents);
    primeAuditMap("investigation", investigations);
    primeAuditList("risk_assessment", ras);
    primeAuditMap("coshh_assessment", coshhAssessments);
    primeAuditMap("dse_report", dseReports);
    primeAuditMap("dse_response", adminResponses);
    primeAuditList("inspection", siteInspections);
    incidents.forEach(i => incidentSavedRef.current.set(String(i.id), stableJSON(i)));
    Object.entries(investigations).forEach(([id, d]) => { investigationSavedRef.current.set(String(id), stableJSON(d)); investigationBaseRef.current.set(String(id), d); });
    equipment.forEach(e => equipmentSavedRef.current.set(String(e.id), stableJSON(e)));
    Object.entries(dseReports).forEach(([uid, reps]) => dseSavedRef.current.set(String(uid), stableJSON(reps)));
    _ready.current = true;
  }, [dbReady]); // eslint-disable-line

  // Audit entries are attributed to whoever is signed in.
  useEffect(() => { setAuditUser(user); setDraftUser(user && user.id); }, [user]);
  const auditNameOf = (uid) => (allUsers.find(u => String(u.id) === String(uid)) || {}).name || `User ${uid}`;

  // Only incidents / investigations that changed since they were last saved or loaded are written.
  useEffect(() => { if (!_ready.current) return;
    incidents.forEach(inc => {
      const id = String(inc.id), j = stableJSON(inc);
      if (incidentSavedRef.current.get(id) === j) return;
      incidentSavedRef.current.set(id, j);
      dbSaveIncident(inc);
    });
  }, [incidents]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    Object.entries(investigations).forEach(([id, data]) => {
      const j = stableJSON(data);
      if (investigationSavedRef.current.get(String(id)) === j) return;
      investigationSavedRef.current.set(String(id), j);
      dbSaveInvestigation(id, data);
    });
  }, [investigations]); // eslint-disable-line

  // ── Live refresh ────────────────────────────────────────────────────────────
  // Everything else is loaded once per page load, so an admin who stays signed in
  // wouldn't see incidents reported by others (or their investigation updates, e.g.
  // actions completed on the phone). Re-read both tables every 30 s while the tab is
  // visible, when the window regains focus, and when an incidents screen is opened.
  // Records with a save still in flight from THIS browser are kept as they are.
  async function refreshSharedRecords() {
    if (!_ready.current || refreshBusyRef.current) return;
    refreshBusyRef.current = true;
    try {
      // Training history only grows, and can be the biggest table: read just its row ids,
      // and the full rows only when they changed (or the table has no ids to compare).
      const historyRead = async () => {
        if (!historyReadyRef.current) return { data: null, error: "not loaded yet" };
        const ids = await sb.from("training_completion_history").select("id,recorded");   // every page; recorded = evidence, which can change
        if (!ids.error && Array.isArray(ids.data)) {
          const k = idsKey(ids.data);
          if (k !== null && k === historyIdsRef.current) return { data: null, error: "unchanged" };
        }
        const full = await sb.from("training_completion_history").select("*");
        if (!full.error && Array.isArray(full.data)) historyIdsRef.current = idsKey(full.data);
        return full;
      };
      const [iRes, invRes, cRes, ackRes, aRes, hRes, daRes, bdRes] = await Promise.all([sb.from("incidents").select("*"), sb.from("investigations").select("*"),
        sb.from("training_completions").select("*"), sb.from("doc_acknowledgements").select("*"), sb.from("training_assigns").select("*"),
        historyRead(), sb.from("doc_assignments").select("*"), sb.from("doc_bundles").select("*")]);
      // Training completions, assignments and document confirmations made elsewhere
      // (a member of staff finishing a module, a manager assigning one) appear here
      // without a reload. With the old sign-in an empty table means "use the demo data".
      const okRows = r => !r.error && Array.isArray(r.data);
      const recent = recentWriteRef.current;
      if (okRows(cRes)) setComps(cur => mergeNested(cur, mapCompRows(cRes.data), recent, "c"));
      if (okRows(ackRes)) setDocAcknowledgements(cur => mergeNested(cur, mapAckRows(ackRes.data), recent, "k"));
      if (okRows(aRes)) setAssigns(cur => mergeAssigns(cur, mapAssignRows(aRes.data), recent));
      if (okRows(aRes)) setDueDates(cur => {
        // due dates for people with a save in flight keep their on-screen value
        const fresh = mapDueRows(aRes.data), now = Date.now();
        recent.forEach((t, key) => { if (now - t <= RECENT_MS && key.startsWith("a:")) { const u = key.slice(2); if (cur[u]) fresh[u] = cur[u]; else delete fresh[u]; } });
        return stableJSON(fresh) === stableJSON(cur) ? cur : fresh;
      });
      // Required reading given elsewhere (e.g. an admin assigning a bundle) appears without a reload.
      if (okRows(daRes)) setDocAssignments(cur => mergeAssigns(cur, mapDocAssignRows(daRes.data), recent, "d"));
      if (!bdRes.error && Array.isArray(bdRes.data)) setDocBundles(cur => {
        const fresh = mapBundleRows(bdRes.data), now = Date.now();
        const isRecent = id => { const t = recent.get(`b:${id}`); return t && now - t < RECENT_MS; };
        const next = [...fresh.filter(b => !isRecent(b.id)), ...cur.filter(b => isRecent(b.id))].sort((a, b) => a.name.localeCompare(b.name));
        return stableJSON(next) === stableJSON(cur) ? cur : next;
      });
      if (okRows(hRes)) setCompHistory(cur => {
        const now = Date.now();
        const pending = cur.filter(h => h.at && now - new Date(h.at).getTime() < RECENT_MS && !hRes.data.some(r => String(r.user_id) === String(h.user_id) && String(r.module_id) === String(h.module_id) && r.date === h.date));
        const next = [...hRes.data, ...pending];
        return stableJSON(next) === stableJSON(cur) ? cur : next;
      });
      if (!iRes.error && Array.isArray(iRes.data)) {
        const fresh = iRes.data.map(mapIncidentRow);
        setIncidents(cur => {
          const writing = incidentWritingRef.current;
          const freshIds = new Set(fresh.map(i => String(i.id)));
          const curById = new Map(cur.map(i => [String(i.id), i]));
          const merged = [
            ...fresh.map(f => (writing.has(String(f.id)) && curById.get(String(f.id))) || f),
            ...cur.filter(i => !freshIds.has(String(i.id)) && writing.has(String(i.id))),   // new, save in flight
          ];
          const same = merged.length === cur.length && merged.every(m => { const c = curById.get(String(m.id)); return c && stableJSON(c) === stableJSON(m); });
          if (same) return cur;
          // Treat what we just read as "already saved" and "already audited", so it
          // is neither written back nor logged as a change made in this browser.
          merged.forEach(m => { if (!writing.has(String(m.id))) { incidentSavedRef.current.set(String(m.id), stableJSON(m)); primeAudit("incident", m.id, m); } });
          // Keep the current on-screen order; new arrivals go to the top.
          const order = new Map(cur.map((c, i) => [String(c.id), i]));
          return merged.sort((a, b) => (order.has(String(a.id)) ? order.get(String(a.id)) : -1) - (order.has(String(b.id)) ? order.get(String(b.id)) : -1));
        });
      }
      if (!invRes.error && Array.isArray(invRes.data)) {
        const fresh = {}; invRes.data.forEach(r => { fresh[r.incident_id] = r.data; });
        setInvestigations(cur => {
          const writing = investigationWritingRef.current;
          const next = { ...fresh };
          Object.keys(cur).forEach(id => { if (writing.has(String(id))) next[id] = cur[id]; });
          const keys = new Set([...Object.keys(cur), ...Object.keys(next)]);
          if ([...keys].every(k => stableJSON(cur[k]) === stableJSON(next[k]))) return cur;
          Object.entries(next).forEach(([id, d]) => { if (!writing.has(String(id))) { investigationSavedRef.current.set(String(id), stableJSON(d)); investigationBaseRef.current.set(String(id), d); primeAudit("investigation", id, d); } });
          return next;
        });
      }
    } finally {
      refreshBusyRef.current = false;
    }
  }
  useEffect(() => {
    if (!dbReady || !user) return;
    const tick = () => { if (document.visibilityState === "visible") refreshSharedRecords(); };
    const iv = setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(iv); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [dbReady, user]); // eslint-disable-line

  // Admins: when was the last full backup downloaded? (drives the bell reminder)
  useEffect(() => {
    if (!dbReady || !user || user.role !== "admin") return;
    let live = true;
    lastBackupAt().then(at => { if (live) setLastBackup(at); });
    return () => { live = false; };
  }, [dbReady, user && user.id, user && user.role]); // eslint-disable-line
  useEffect(() => {
    if ((view === "admin" && atab === "incidents") || (view === "staff" && (stab === "incidents" || stab === "actions" || stab === "team"))) refreshSharedRecords();
  }, [view, atab, stab]); // eslint-disable-line

  // Supabase sign-in: only admins may change shared registers, so other people's
  // browsers don't try to save them back (the database would refuse anyway).
  const writesAll = () => AUTH_MODE !== "supabase" || (user && user.role === "admin");
  // Machinery Competence + Equipment Register: also people with Machinery & Equipment access.
  const writesMachinery = () => writesAll() || hasMachineryAccess(user);

  useEffect(() => { if (!_ready.current) return;
    Object.entries(dseReports).filter(([uid]) => writesAll() || String(uid) === String(user && user.id)).forEach(([uid, reports]) => {
      // only people whose assessments changed since the last save (not everyone, every time)
      const j = stableJSON(reports);
      if (dseSavedRef.current.get(String(uid)) === j) return;
      dseSavedRef.current.set(String(uid), j);
      auditRecord("dse_report", uid, reports, auditNameOf(uid));
      dbSaveDseReport(Number(uid), reports).then(ok => { if (ok === false) dseSavedRef.current.delete(String(uid)); });   // retried on the next change
    });
  }, [dseReports]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    // Admins save any response; line managers only their team's (sign-offs); staff none.
    Object.entries(adminResponses).filter(([uid]) => writesAll() || (user && user.role === "manager" && String(uid) !== String(user.id))).forEach(([uid, keys]) => {
      auditRecord("dse_response", uid, keys, auditNameOf(uid));
      Object.entries(keys).forEach(([key, rec]) => {
        const [ri, ii] = key.split("_").map(Number);
        dbSaveDseAdminResponse(Number(uid), ri, ii, rec);
      });
    });
  }, [adminResponses]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    if (!writesAll()) {
      // Not an admin: save just the items that changed (e.g. an incident report adding a defect).
      equipment.forEach(e => {
        const k = String(e.id), j = stableJSON(e);
        if (equipmentSavedRef.current.get(k) === j) return;
        equipmentSavedRef.current.set(k, j);
        dbWrite(sb.from("equipment").upsert({ id: e.id, data: e }, { onConflict: "id" }), "equipment");
      });
      // Machinery & Equipment access: also delete the items THEY removed — only ones this
      // browser loaded or saved, never rows it simply hasn't seen (added by someone else since).
      if (hasMachineryAccess(user)) {
        const now = new Set(equipment.map(e => String(e.id)));
        [...equipmentSavedRef.current.keys()].filter(k => !now.has(k)).forEach(k => {
          equipmentSavedRef.current.delete(k);
          dbWrite(sb.from("equipment").delete().eq("id", k), "equipment delete");
        });
      }
      return;
    }
    dbSaveEquipment(equipment);
  }, [equipment]); // eslint-disable-line

  useEffect(() => { if (!_ready.current || !writesAll()) return;
    auditList("inspection", siteInspections, i => [i.date, (INSP_TYPES.find(t => t.id === i.type) || {}).label || i.type, i.location].filter(Boolean).join(" · "));
    dbSaveSiteInspections(siteInspections);
  }, [siteInspections]); // eslint-disable-line

  // One fire safety save at a time: a change made while a save is running (e.g. Undo
  // straight after a remove) waits and is saved next, so the prune of the earlier save
  // can't delete a row the later change put back.
  const fireSaveRef = useRef({ running: false, next: null });
  useEffect(() => { if (!_ready.current || !writesAll()) return;
    const q = fireSaveRef.current;
    q.next = fireSafety;
    if (q.running) return;
    (async () => {
      q.running = true;
      try { while (q.next) { const fs = q.next; q.next = null; await dbSaveFireSafety(fs); } }
      finally { q.running = false; }
    })();
  }, [fireSafety]); // eslint-disable-line

  useEffect(() => { if (!_ready.current || !writesAll()) return;
    dbSaveFirstAidData(firstAidData);
  }, [firstAidData]); // eslint-disable-line

  useEffect(() => { if (!_ready.current || !writesAll()) return;
    customModules.forEach(m => dbSaveCustomModule(m));
  }, [customModules]); // eslint-disable-line

  useEffect(() => { if (!_ready.current || !writesMachinery()) return;
    customMachineTypes.forEach(m => dbSaveCustomMachineType(m));
  }, [customMachineTypes]); // eslint-disable-line

  // NB: there is deliberately NO auto-sync effect for `passwords`. It used to write
  // EVERY user's password whenever any one changed, so a browser that had been open
  // since before a reset could put everyone's old passwords back. Password changes
  // now go through savePasswordFor(), which writes that one user only.

  // ── Sync helpers — call these wherever state currently changes ───────────────

  // Replaces the assignment list for each user in `newAssigns` ({userId:[moduleIds]}).
  // Delete-then-insert (not atomic) — pass ONLY the users that changed.
  // Saves each person's full list of assigned modules. Only the differences are
  // written: modules newly assigned are added, unassigned ones removed. (It used to
  // clear the person's list and write it again, so a refused write — e.g. a staff id
  // too long for an "integer" column, see user_id_text_columns.sql — silently lost
  // ALL their assignments.) If anything is refused, the admin is told why and the
  // screen goes back to what is really stored.
  // due (optional): { uid: { mid: "YYYY-MM-DD" } } — due dates for modules being ADDED now.
  async function dbSaveAssigns(newAssigns, due) {
    Object.keys(newAssigns).forEach(uid => markWrite(`a:${uid}`));
    const failed = [];
    for (const [uid, mids] of Object.entries(newAssigns)) {
      const suid = String(uid);
      const want = [...new Set((mids || []).map(String))];
      const { data, error: readErr } = await sb.from("training_assigns").query(`select=user_id,module_id&user_id=eq.${encodeURIComponent(suid)}`);
      if (readErr) { failed.push({ uid: suid, error: readErr }); continue; }
      const have = new Set((data || []).filter(r => String(r.user_id) === suid).map(r => String(r.module_id)));
      const add = want.filter(m => !have.has(m));
      const drop = [...have].filter(m => !want.includes(m));
      if (add.length) {
        // due_date is only sent when there is one, so assigning never depends on that column
        const { error } = await sb.from("training_assigns").insert(add.map(m => {
          const d = due && due[suid] && due[suid][m];
          return d ? { user_id: suid, module_id: m, due_date: d } : { user_id: suid, module_id: m };
        }));
        if (error) failed.push({ uid: suid, error });
      }
      for (const m of drop) {
        const { error } = await sb.from("training_assigns").delete().match({ user_id: suid, module_id: m });
        if (error) failed.push({ uid: suid, error });
      }
    }
    if (failed.length) {
      console.error("training_assigns save error:", failed);
      failed.forEach(f => recentWriteRef.current.delete(`a:${f.uid}`));   // let the next refresh show what is really stored
      const names = [...new Set(failed.map(f => auditNameOf(f.uid)))].join(", ");
      notify(`Training assignments for ${names} could not be saved.\n${String(failed[0].error).slice(0, 300)}\nIf this mentions "out of range for type integer", run user_id_text_columns.sql in the Supabase SQL Editor.`, { kind: "error" });
      refreshSharedRecords();
    }
    return failed.length === 0;
  }

  // Change (or clear, with null) the due date of existing assignments.
  // entries: [{ uid, mid, due }]. Shows an error if the database refuses.
  async function dbSetDueDates(entries) {
    const failed = [];
    setDueDates(p => {
      const n = { ...p };
      entries.forEach(({ uid, mid, due }) => { const u = String(uid); const m = { ...(n[u] || {}) }; if (due) m[String(mid)] = due; else delete m[String(mid)]; if (Object.keys(m).length) n[u] = m; else delete n[u]; });
      return n;
    });
    for (const { uid, mid, due } of entries) {
      markWrite(`a:${uid}`);
      const { error } = await sb.from("training_assigns").update({ due_date: due || null }).match({ user_id: String(uid), module_id: String(mid) });
      if (error) failed.push(error);
    }
    if (failed.length) notify(`The due date couldn't be saved.\n${String(failed[0]).slice(0, 240)}\nIf this mentions "due_date", run assign_due_dates.sql in the Supabase SQL Editor.`, { kind: "error" });
    return !failed.length;
  }
  // Record due dates locally for modules just assigned (the rows were inserted with them).
  const noteDue = due => { if (!due) return; setDueDates(p => { const n = { ...p }; Object.entries(due).forEach(([u, ms]) => { n[u] = { ...(n[u] || {}), ...ms }; }); return n; }); };
  // Training Matrix cell actions (domains/training/TrainingMatrixView.jsx)
  async function matrixAssign(uid, mid) {
    const k = String(uid), cur = assigns[k] || [];
    if (cur.includes(mid)) return;
    const m = allModules.find(x => String(x.id) === String(mid)), u = allUsers.find(x => String(x.id) === k);
    setAssigns(p => ({ ...p, [k]: [...cur, mid] }));
    const ok = await dbSaveAssigns({ [k]: [...cur, mid] });
    if (ok) notify(`"${m ? m.title : mid}" assigned to ${u ? u.name : "them"}.`, { undo: () => { setAssigns(p => ({ ...p, [k]: (p[k] || []).filter(x => x !== mid) })); dbSaveAssigns({ [k]: (assigns[k] || []).filter(x => x !== mid) }); } });
  }
  const openInAssign = (uid, then) => { setBulkTarget("individual"); setTarget(String(uid)); setAtab("assign"); if (then) then(); };
  // Ask for a due date (or none) for one assignment.
  async function askDueDate(uid, mid) {
    const u = allUsers.find(x => String(x.id) === String(uid)), m = allModules.find(x => String(x.id) === String(mid));
    const cur = ((dueDates[String(uid)] || {})[String(mid)]) || "";
    const v = await ask({ title: "Due date", message: `${u ? u.name : "This person"} — ${m ? m.title : "this module"}`, ok: "Save",
      fields: [{ id: "due", label: "Complete by", type: "date", value: cur || addDays(14), help: "Clear the date for no due date." }] });
    if (!v) return;
    const due = (v.due || "").trim() || null;
    if (due === (cur || null)) return;
    if (await dbSetDueDates([{ uid, mid, due }])) notify(due ? `Due date set: ${formatDue(due)}.` : "Due date removed.", { undo: () => dbSetDueDates([{ uid, mid, due: cur || null }]) });
  }

  // One row per (user, module). Retaking a module overwrites the previous result.
  // Also appends to training_completion_history, so earlier results (and which
  // module version they were for) are kept when a retake or a major new version
  // replaces the current row.
  async function dbSaveCompletion(userId, moduleId, rec) {
    markWrite(`c:${userId}:${moduleId}`);
    const moduleVersion = rec.moduleVersion || (allModules.find(m => String(m.id) === String(moduleId)) || {}).version || 1;
    // `recorded` (admin-recorded prior training, see completion.js) is only sent when
    // present, so ordinary quiz results never depend on that column existing.
    // A quiz result replacing a recorded completion clears the "recorded" mark.
    const wasRecorded = !!((comps[String(userId)] || {})[String(moduleId)] || {}).recorded;
    const rc = rec.recorded ? { recorded: rec.recorded } : wasRecorded ? { recorded: null } : {};
    const hist = { user_id: String(userId), module_id: String(moduleId), module_version: moduleVersion, score: rec.score, date: rec.date, cert_id: rec.certId || null, at: new Date().toISOString(), ...(rec.recorded ? rc : {}) };
    setCompHistory(p => [...p, hist]);
    const ok = await dbWrite(sb.from("training_completions").upsert({
      user_id: userId, module_id: moduleId,
      score: rec.score, date: rec.date, cert_id: rec.certId, answers: rec.answers,
      module_version: moduleVersion, ...rc,
    }, { onConflict: "user_id,module_id" }), "training completion", rec.recorded ? { alertOnError: true } : undefined);
    if (rec.recorded && !ok) return false;
    await dbWrite(sb.from("training_completion_history").insert(hist), "training completion history");
    return true;
  }

  // ── Admin: record training completed before the portal (e.g. on the old system) ──
  // items: [{ userId, moduleId, date: "YYYY-MM-DD", note }]. Each person is also
  // assigned the module if they weren't already, so it counts towards compliance.
  // Anyone who already has a result for that module is skipped (never overwritten).
  // Returns { saved, skipped:[{userId,moduleId,reason}] }.
  async function recordCompletions(items) {
    const at = new Date().toISOString();
    const by = user ? user.name : "", byId = user ? String(user.id) : "";
    const skipped = [], toSave = [];
    items.forEach(it => {
      const uid = String(it.userId), mid = String(it.moduleId);
      // A group session (it.session) renews an OLDER result; anything else never overwrites one.
      const existing = (comps[uid] || {})[mid];
      if (existing && !(it.session && String(existing.date || "") < it.date)) {
        skipped.push({ ...it, reason: it.session ? "already has a result from that date or later" : "already has a result for this module" }); return;
      }
      if (toSave.some(x => x.uid === uid && x.mid === mid)) { skipped.push({ ...it, reason: "listed twice" }); return; }
      const mod = allModules.find(m => String(m.id) === mid);
      toSave.push({ uid, mid, rec: { score: null, date: it.date, certId: null, answers: null, moduleVersion: (mod && mod.version) || 1,
        recorded: { by, byId, at, ...(it.note ? { note: String(it.note).slice(0, 300) } : {}), ...(it.session ? { session: it.session } : {}),
          ...(it.evidence && it.evidence.length ? { evidence: it.evidence } : {}) } } });
    });
    if (!toSave.length) return { saved: 0, skipped };
    // assignments first (one write per person), then the completions
    const addAssign = {};
    toSave.forEach(({ uid, mid }) => { const cur = addAssign[uid] || assigns[uid] || []; if (!cur.includes(mid)) addAssign[uid] = [...cur, mid]; });
    if (Object.keys(addAssign).length) { setAssigns(p => ({ ...p, ...addAssign })); await dbSaveAssigns(addAssign); }
    let saved = 0;
    for (const { uid, mid, rec } of toSave) {
      const ok = await dbSaveCompletion(uid, mid, rec);
      if (!ok) { skipped.push({ userId: uid, moduleId: mid, date: rec.date, reason: "couldn't be saved" }); continue; }
      saved++;
      setComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [mid]: rec } }));
      const who = (allUsers.find(u => String(u.id) === uid) || {}).name || uid;
      const title = (allModules.find(m => String(m.id) === mid) || {}).title || mid;
      auditEvent("training_completion", uid, "record", `${rec.recorded.session ? "Group session" : "Recorded as completed"} on ${rec.date}: ${title}${rec.recorded.note ? ` — ${rec.recorded.note}` : ""}${rec.recorded.evidence ? ` (${evidenceLabel(rec, 0).toLowerCase()} attached: ${rec.recorded.evidence.map(e => e.name).join(", ")})` : ""}`,
        { module: { from: null, to: title }, completed: { from: null, to: rec.date } }, who);
    }
    return { saved, skipped };
  }
  // Evidence for recorded training (training/evidence.js): the signed sign-in sheet of a
  // group session, or a certificate for prior training. Added to the current record and
  // its history row, for every target. Returns an error message, or "" when all saved.
  async function attachEvidence(targets, files, key) {
    let evidence;
    try { evidence = await uploadEvidence(files, key, user ? user.name : ""); }
    catch (e) { return String(e.message || e); }
    const failed = [];
    for (const t of targets) {
      const uid = String(t.uid), mid = String(t.mid);
      const c = (comps[uid] || {})[mid];
      if (!c || !c.recorded) continue;
      const recorded = { ...c.recorded, evidence: [...(c.recorded.evidence || []), ...evidence] };
      markWrite(`c:${uid}:${mid}`);
      const { error } = await sb.from("training_completions").update({ recorded }).match({ user_id: uid, module_id: mid });
      if (error) { console.error("evidence save failed:", error); failed.push(uid); continue; }
      dbWrite(sb.from("training_completion_history").update({ recorded }).match({ user_id: uid, module_id: mid, date: c.date }), "evidence history");
      setComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [mid]: { ...((p[uid] || {})[mid] || c), recorded } } }));
      setCompHistory(p => p.map(h => String(h.user_id) === uid && String(h.module_id) === mid && h.date === c.date && h.recorded ? { ...h, recorded } : h));
      const who = (allUsers.find(u => String(u.id) === uid) || {}).name || uid;
      const title = (allModules.find(m => String(m.id) === mid) || {}).title || mid;
      auditEvent("training_completion", uid, "evidence", `${evidenceLabel({ recorded }, 0)} attached to ${c.recorded.session ? "group session" : "recorded completion"} (${c.date}): ${title} — ${evidence.map(e => e.name).join(", ")}`,
        { evidence: { from: (c.recorded.evidence || []).map(e => e.name), to: recorded.evidence.map(e => e.name) } }, who);
    }
    if (failed.length) return `The file was uploaded, but it couldn't be linked to ${failed.length} record${failed.length !== 1 ? "s" : ""} (${failed.map(auditNameOf).join(", ")}). Try again.`;
    return "";
  }
  // Attach to a whole group session (every attendee's record), from the session register.
  const attachToSession = (session, files) =>
    attachEvidence(session.attendees.map(uid => ({ uid, mid: session.moduleId })), files, session.key.startsWith("gs_") ? session.key : `gs_legacy_${session.moduleId}_${session.date}`);

  // Undo a recorded completion (only recorded ones — quiz results can't be removed here).
  async function removeRecordedCompletion(userId, moduleId) {
    const uid = String(userId), mid = String(moduleId);
    const c = (comps[uid] || {})[mid];
    if (!c || !c.recorded) return;
    markWrite(`c:${uid}:${mid}`);
    const ok = await dbWrite(sb.from("training_completions").delete().match({ user_id: uid, module_id: mid }), "recorded completion delete", { alertOnError: true });
    if (!ok) return;
    dbWrite(sb.from("training_completion_history").delete().match({ user_id: uid, module_id: mid, date: c.date }), "recorded completion history delete");
    setComps(p => { const n = { ...p, [uid]: { ...(p[uid] || {}) } }; delete n[uid][mid]; return n; });
    setCompHistory(p => p.filter(h => !(String(h.user_id) === uid && String(h.module_id) === mid && h.recorded && h.date === c.date)));
    const who = (allUsers.find(u => String(u.id) === uid) || {}).name || uid;
    const title = (allModules.find(m => String(m.id) === mid) || {}).title || mid;
    auditEvent("training_completion", uid, "remove", `Removed recorded completion (${c.date}): ${title}`, { module: { from: title, to: null } }, who);
    // no "are you sure?" first: it can be put straight back
    notify(`Removed the recorded completion of "${title}" for ${who}.`, { undo: async () => {
      const ok2 = await dbSaveCompletion(uid, mid, c);
      if (!ok2) { notify("Couldn't put it back. Record it again with Record as completed.", { kind: "error" }); return; }
      setComps(p => ({ ...p, [uid]: { ...(p[uid] || {}), [mid]: c } }));
      auditEvent("training_completion", uid, "record", `Put back recorded completion (${c.date}): ${title}`, { module: { from: null, to: title } }, who);
      notify(`"${title}" is recorded as completed again.`);
    } });
  }

  // Upserts one incident (and uploads any new photos first). Called for EVERY incident by the auto-sync effect.
  async function dbSaveIncident(inc) {
    incidentWritingRef.current.add(String(inc.id));
    try { await dbSaveIncidentNow(inc); } finally { incidentWritingRef.current.delete(String(inc.id)); }
  }
  async function dbSaveIncidentNow(inc) {
    // Photos arrive from the mobile app as data URLs. Push them to Storage and
    // store the resulting URLs — a data URL in the row would bloat every read.
    // Already-uploaded photos pass straight through, so this is a no-op on the
    // repeat saves the [incidents] effect fires.
    const photos = await uploadPhotos(PHOTO_BUCKET, `inc_${inc.id}`, inc.photos);
    const prev = inc.photos || [];
    if (photos.length !== prev.length || photos.some((p, i) => p !== prev[i])) {
      setIncidents(list => list.map(i => i.id === inc.id ? { ...i, photos } : i));
    }
    // Core fields have their own columns (below). EVERY other field on the
    // incident — injured person, witnesses, first aid, post-incident outcome,
    // immediate measures, corrective actions, equipment, time, triaged, and
    // anything added to the form later — is saved in the jsonb `details`
    // column (see incident_details_column.sql) and restored by loadAll().
    const details = {};
    Object.entries(inc).forEach(([k, v]) => {
      if (!INCIDENT_CORE_KEYS.has(k) && v !== undefined && typeof v !== "function") details[k] = v;
    });
    const savedOk = await dbWrite(sb.from("incidents").upsert({
      id: inc.id, date: inc.date, type: inc.type, accident_code: inc.accidentCode,
      number_code: inc.numberCode, location: inc.location, reported_by: inc.reportedBy,
      description: inc.description, injury_type: inc.injuryType, riddor: inc.riddor, closed: inc.closed,
      photos,
      riddor_reported: inc.riddorReported||false,
      riddor_reported_date: inc.riddorReportedDate||null,
      hse_reference: inc.hseReference||null,
      riddor_reported_by: inc.riddorReportedBy||null,
      quick_report: !!inc.quickReport,
      urgency: inc.urgency||null,
      details,
    }, { onConflict: "id" }), "incident", { alertOnError: true });
    if (savedOk) pingIncidentAlert(inc.id);   // high-risk? the server emails admins straight away (Site Settings → Email reminders)
    auditRecord("incident", inc.id, { ...inc, photos }, incidentAuditLabel(inc));
  }

  async function dbDeleteIncident(id) {
    auditDelete("incident", id, incidentAuditLabel(incidents.find(i => i.id === id)));
    await dbWrite(sb.from("incidents").delete().eq("id", id), "incident delete");
  }

  // Investigations are keyed by incident id; the whole investigation is one JSON `data` blob.
  async function dbSaveInvestigation(incidentId, data) {
    investigationWritingRef.current.add(String(incidentId));
    try { await dbSaveInvestigationNow(incidentId, data); } finally { investigationWritingRef.current.delete(String(incidentId)); }
  }
  // Reads ONE investigation straight from the database.
  // Returns { ok:true, data } (data undefined if there is no row yet) or { ok:false }.
  async function fetchInvestigation(incidentId) {
    try {
      const { data, error } = await sb.from("investigations").query(`select=*&incident_id=eq.${encodeURIComponent(incidentId)}`);
      if (error || !Array.isArray(data)) return { ok: false };
      const row = data.find(r => String(r.incident_id) === String(incidentId));
      return { ok: true, data: row ? row.data : undefined };
    } catch { return { ok: false }; }
  }
  // The investigation screen calls this after the person has seen the other
  // person's version and chosen what to do, so the save below doesn't merge again.
  function acceptInvestigationBase(incidentId, data) {
    investigationBaseRef.current.set(String(incidentId), data);
  }
  async function dbSaveInvestigationNow(incidentId, data) {
    // Someone else saved since we last read it? Combine rather than overwrite.
    // (The investigation screen asks the person first; this catches background
    // saves such as an action being ticked off on a phone.)
    const key = String(incidentId);
    const cur = await fetchInvestigation(incidentId);
    const base = investigationBaseRef.current.get(key) || {};   // {} = we've never seen a saved copy
    if (cur.ok && cur.data !== undefined && changedSince(base, cur.data) && changedSince(data, cur.data)) {
      const { merged } = mergeInvestigation(base, data, cur.data);
      primeAudit("investigation", incidentId, cur.data);   // log only what THIS person changed
      data = merged;
      investigationSavedRef.current.set(key, stableJSON(merged));
      setInvestigations(p => ({ ...p, [incidentId]: merged }));
    }
    auditRecord("investigation", incidentId, data, incidentAuditLabel(incidents.find(i => String(i.id) === String(incidentId))) || String(incidentId));
    const ok = await dbWrite(sb.from("investigations").upsert({ incident_id: incidentId, data }, { onConflict: "incident_id" }), "investigation");
    if (ok) investigationBaseRef.current.set(key, data);   // only once it's really in the database
  }

  // Marks a single corrective action complete inside its investigation and
  // persists the whole investigation record. Used by the mobile My Actions
  // screen; safe to call from the desktop investigation tab too.
  async function dbCompleteAction(incidentId, actionId, completedBy) {
    const inv = investigations[incidentId];
    if (!inv) return;
    const next = {
      ...inv,
      actions: (inv.actions || []).map(a =>
        a.id === actionId
          ? { ...a, status: "complete", completedDate: todayISO(), completedBy: completedBy || "" }
          : a
      ),
    };
    setInvestigations(p => ({ ...p, [incidentId]: next }));
    await dbSaveInvestigation(incidentId, next);
  }

  // Records which VERSION was read, and appends to doc_ack_history so earlier reads
  // are kept when a major new version clears the current acknowledgements.
  async function dbAcknowledgeDoc(userId, docId, date) {
    markWrite(`k:${userId}:${docId}`);
    const version = (docs.find(d => String(d.id) === String(docId)) || {}).version || 1;
    const hist = { user_id: String(userId), doc_id: String(docId), version, date, at: new Date().toISOString() };
    setDocAckHistory(p => [...p, hist]);
    await dbWrite(sb.from("doc_acknowledgements").upsert({ user_id: String(userId), doc_id: String(docId), date, version }, { onConflict: "user_id,doc_id" }), "document acknowledgement");
    await dbWrite(sb.from("doc_ack_history").insert(hist), "document read history");
  }

  // Replaces the full list of staff a document is assigned to (delete-then-insert).
  // Saves for the same document / person run one after another (quick tick-untick
  // clicks can't overlap and leave the database different from the screen).
  const saveQueueRef = useRef(new Map());
  const inTurn = (key, fn) => {
    const q = saveQueueRef.current;
    const next = (q.get(key) || Promise.resolve()).catch(() => {}).then(fn);
    q.set(key, next);
    next.finally(() => { if (q.get(key) === next) q.delete(key); });
    return next;
  };
  // Compare with what's stored and change only the differences (never clear and rewrite,
  // which could lose everyone's assignment if the connection dropped in between).
  function dbSaveDocAssignments(docId, userIds) { return inTurn(`d:${docId}`, () => saveDocAssignmentsNow(docId, userIds)); }
  async function saveDocAssignmentsNow(docId, userIds) {
    markWrite(`d:${docId}`);
    const sid = String(docId);
    const want = [...new Set((userIds || []).map(String))];
    const { data, error } = await sb.from("doc_assignments").query(`select=user_id&doc_id=eq.${encodeURIComponent(sid)}`);
    if (error) { notify("Document assignments weren't saved. Please try again.", { kind: "error" }); return false; }
    const have = new Set((data || []).map(r => String(r.user_id)));
    const add = want.filter(u => !have.has(u));
    const drop = [...have].filter(u => !want.includes(u));
    let ok = true;
    if (add.length) ok = (await dbWrite(sb.from("doc_assignments").insert(add.map(u => ({ doc_id: sid, user_id: u }))), "doc assignments")) !== false && ok;
    for (const u of drop) ok = (await dbWrite(sb.from("doc_assignments").delete().match({ doc_id: sid, user_id: u }), "doc assignments remove")) !== false && ok;
    return ok;
  }

  // Saves document metadata, uploading the file first if one is supplied.
  // Storage path is doc_<id>_<sanitisedFileName> in the "documents" bucket —
  // dbDeleteDoc rebuilds the same path to delete it, so keep the two in step.
  // NOTE: mutates `doc.fileUrl` on the object passed in.
  async function dbSaveDoc(doc, file) {
    // Upload raw file to Storage bucket — flat path, no subfolders
    if (file) {
      const safeName = doc.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `doc_${doc.id}_${safeName}`;
      const { error } = await sb.storage.upload("documents", path, file);
      if (error) { console.error("Doc upload failed:", error); notify("Upload failed: " + error, { kind: "error" }); return; }
      doc.fileUrl = sb.storage.getPublicUrl("documents", path);
    }
    await dbWrite(sb.from("documents").upsert({
      id: doc.id, title: doc.title, date: doc.date, size: doc.size,
      type: doc.type, ext: doc.ext, file_name: doc.fileName, file_url: doc.fileUrl || null,
      version: doc.version || 1,
      review_date: doc.reviewDate || null,
      description: doc.description || null,
      history: doc.history || [],
    }, { onConflict: "id" }), "document", { alertOnError: true });
  }

  // Removes the file, the document row, and its assignment + acknowledgement rows.
  async function dbDeleteDoc(id, fileName) {
    if (fileName) {
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      await dbWrite(sb.storage.remove("documents", [`doc_${id}_${safeName}`]), "document file delete");
    }
    await dbWrite(sb.from("documents").delete().eq("id", id), "document delete");
    await dbWrite(sb.from("doc_assignments").delete().eq("doc_id", id), "doc assignments delete");
    await dbWrite(sb.from("doc_acknowledgements").delete().eq("doc_id", id), "doc acknowledgements delete");
    // ...and take it out of any document bundle
    const inBundles = withoutDoc(docBundles, id);
    if (inBundles.length) {
      setDocBundles(p => p.map(b => inBundles.find(c => c.id === b.id) || b));
      await Promise.all(inBundles.map(dbSaveBundle));
    }
  }

  // ── Document bundles ─────────────────────────────────────────────────────────
  // A named set of documents assigned together as required reading. Assigning a
  // bundle writes the normal doc_assignments rows, so everything else (Required
  // Reading, confirmations, reminders, reports) works unchanged. See bundles.js.
  const sortBundles = list => [...list].sort((a, b) => a.name.localeCompare(b.name));
  async function dbSaveBundle(b) {
    markWrite(`b:${b.id}`);
    return dbWrite(sb.from("doc_bundles").upsert(bundleRow(b), { onConflict: "id" }), "document bundle", { alertOnError: true });
  }
  // Saves the per-document assignment lists that changed.
  async function writeDocAssignments(next, changed) {
    const ids = [...new Set(changed)];
    if (!ids.length) return;
    setDocAssignments(next);
    await Promise.all(ids.map(did => dbSaveDocAssignments(did, next[did] || [])));
  }
  const existingDocIds = ids => ids.filter(id => docs.some(d => String(d.id) === id));
  const bundleNames = ids => ids.map(id => auditNameOf(id));
  // Create or edit. Documents added to a bundle go straight to everyone who has it;
  // removed ones come off their reading only if the admin ticked that option.
  async function saveBundle(b, { unassignRemoved } = {}) {
    const old = docBundles.find(x => x.id === b.id);
    const now = new Date().toISOString();
    const rec = old ? { ...b, memberIds: old.memberIds, updatedAt: now }
      : { ...b, id: "bd" + Date.now(), memberIds: [], createdBy: user?.name || "", createdAt: now, updatedAt: now };
    if (!(await dbSaveBundle(rec))) return false;
    setDocBundles(p => sortBundles([...p.filter(x => x.id !== rec.id), rec]));
    let da = docAssignments; const changed = [];
    const added = old ? rec.docIds.filter(d => !old.docIds.includes(d)) : [];
    const removed = old ? old.docIds.filter(d => !rec.docIds.includes(d)) : [];
    if (rec.memberIds.length) {
      const r1 = addAssignments(da, existingDocIds(added), rec.memberIds); da = r1.next; changed.push(...r1.changed);
      if (unassignRemoved) { const r2 = removeAssignments(da, removed, rec.memberIds, docBundles.filter(x => x.id !== rec.id)); da = r2.next; changed.push(...r2.changed); }
    }
    await writeDocAssignments(da, changed);
    const title = id => (docs.find(d => String(d.id) === id) || {}).title || id;
    auditEvent("doc_bundle", rec.id, old ? "update" : "create",
      old ? `Edited document bundle "${rec.name}"${added.length ? ` — added ${added.map(title).join(", ")}` : ""}${removed.length ? ` — removed ${removed.map(title).join(", ")}${unassignRemoved && rec.memberIds.length ? " (taken off members' reading)" : ""}` : ""}`
          : `Created document bundle "${rec.name}" with ${rec.docIds.length} document${rec.docIds.length !== 1 ? "s" : ""}`,
      old ? { name: old.name !== rec.name ? { from: old.name, to: rec.name } : undefined, documents: added.length || removed.length ? { from: old.docIds.map(title), to: rec.docIds.map(title) } : undefined, autoNew: old.autoNew !== rec.autoNew ? { from: old.autoNew, to: rec.autoNew } : undefined }
          : { documents: { from: null, to: rec.docIds.map(title) } }, rec.name);
    return true;
  }
  async function deleteBundle(b, { unassign } = {}) {
    markWrite(`b:${b.id}`);
    if (!(await dbWrite(sb.from("doc_bundles").delete().eq("id", b.id), "document bundle delete", { alertOnError: true }))) return;
    setDocBundles(p => p.filter(x => x.id !== b.id));
    if (unassign) { const r = removeAssignments(docAssignments, b.docIds, b.memberIds, docBundles.filter(x => x.id !== b.id)); await writeDocAssignments(r.next, r.changed); }
    auditEvent("doc_bundle", b.id, "delete", `Deleted document bundle "${b.name}"${unassign && b.memberIds.length ? " and took its documents off members' reading" : ""}`, {}, b.name);
  }
  // Give a bundle to people → number newly given it.
  async function assignBundle(b, userIds) {
    const cur = docBundles.find(x => x.id === b.id) || b;
    const add = [...new Set(userIds.map(String))].filter(u => !cur.memberIds.includes(u));
    if (!add.length) return 0;
    const rec = { ...cur, memberIds: [...cur.memberIds, ...add], updatedAt: new Date().toISOString() };
    if (!(await dbSaveBundle(rec))) return 0;
    setDocBundles(p => p.map(x => x.id === rec.id ? rec : x));
    const r = addAssignments(docAssignments, existingDocIds(rec.docIds), add);
    await writeDocAssignments(r.next, r.changed);
    auditEvent("doc_bundle", rec.id, "assign", `Assigned document bundle "${rec.name}" to ${add.length} ${add.length !== 1 ? "people" : "person"}: ${bundleNames(add).join(", ")}`, { people: { from: null, to: bundleNames(add) } }, rec.name);
    return add.length;
  }
  // Take a bundle away: its documents come off their reading unless another bundle of theirs has them.
  async function unassignBundle(b, userIds) {
    const cur = docBundles.find(x => x.id === b.id) || b;
    const drop = userIds.map(String);
    const rec = { ...cur, memberIds: cur.memberIds.filter(u => !drop.includes(u)), updatedAt: new Date().toISOString() };
    if (!(await dbSaveBundle(rec))) return;
    setDocBundles(p => p.map(x => x.id === rec.id ? rec : x));
    const r = removeAssignments(docAssignments, rec.docIds, drop, docBundles.filter(x => x.id !== rec.id));
    await writeDocAssignments(r.next, r.changed);
    auditEvent("doc_bundle", rec.id, "unassign", `Took document bundle "${rec.name}" away from ${bundleNames(drop).join(", ")}`, { people: { from: bundleNames(drop), to: null } }, rec.name);
  }
  // New staff get every bundle marked "give to new staff automatically".
  async function giveNewStarterBundles(userIds) {
    const ids = userIds.map(String);
    const autos = docBundles.filter(b => b.autoNew);
    if (!autos.length || !ids.length) return;
    let da = docAssignments; const changed = [], recs = [];
    autos.forEach(b => {
      const add = ids.filter(u => !b.memberIds.includes(u));
      if (!add.length) return;
      recs.push({ ...b, memberIds: [...b.memberIds, ...add] });
      const r = addAssignments(da, existingDocIds(b.docIds), add); da = r.next; changed.push(...r.changed);
    });
    if (!recs.length) return;
    setDocBundles(p => p.map(b => recs.find(r => r.id === b.id) || b));
    await Promise.all(recs.map(dbSaveBundle));
    await writeDocAssignments(da, changed);
    recs.forEach(b => auditEvent("doc_bundle", b.id, "assign", `New staff given document bundle "${b.name}" automatically: ${bundleNames(ids).join(", ")}`, {}, b.name));
  }

  // Rewrites ALL of a user's DSE reports; report_idx = position in the array (so order matters —
  // admin responses reference reports by this index).
  // One row per assessment (report_idx = position). Compare with what's stored: add new
  // assessments, update changed ones, remove only rows past the end — never clear first.
  function dbSaveDseReport(userId, reports) { return inTurn(`dse:${userId}`, () => saveDseReportNow(userId, reports)); }
  async function saveDseReportNow(userId, reports) {
    const sid = String(userId);
    const { data, error } = await sb.from("dse_reports").query(`select=report_idx,data&user_id=eq.${encodeURIComponent(sid)}`);
    if (error) { notify("The DSE assessment wasn't saved. Please try again.", { kind: "error" }); return false; }
    const stored = new Map((data || []).map(r => [Number(r.report_idx), r.data]));
    const list = reports || [];
    let ok = true;
    const add = list.map((r, i) => [r, i]).filter(([, i]) => !stored.has(i));
    if (add.length) ok = (await dbWrite(sb.from("dse_reports").insert(add.map(([r, i]) => ({ user_id: sid, report_idx: i, data: r }))), "DSE reports")) !== false && ok;
    for (const [r, i] of list.map((r, i) => [r, i]).filter(([, i]) => stored.has(i))) {
      if (stableJSON(stored.get(i)) === stableJSON(r)) continue;
      ok = (await dbWrite(sb.from("dse_reports").update({ data: r }).match({ user_id: sid, report_idx: i }), "DSE report")) !== false && ok;
    }
    const extra = [...stored.keys()].filter(i => i >= list.length);
    for (const i of extra) ok = (await dbWrite(sb.from("dse_reports").delete().match({ user_id: sid, report_idx: i }), "DSE reports remove")) !== false && ok;
    return ok;
  }

  async function dbSaveDseAdminResponse(userId, reportIdx, issueIdx, rec) {
    await dbWrite(sb.from("dse_admin_responses").upsert({
      user_id: userId, report_idx: reportIdx, issue_idx: issueIdx,
      comment: rec.comment, resolved: rec.resolved,
      signed_off_by: rec.signedOffBy || null, signed_off_at: rec.signedOffAt || null,
    }, { onConflict: "user_id,report_idx,issue_idx" }), "DSE admin response");
  }

  async function dbRecordLogin(userId, ts) {
    await dbWrite(sb.from("last_logins").upsert({ user_id: String(userId), last_login: ts }, { onConflict: "user_id" }), "last login");
  }

  // Change ONE user's password: update local state and write just that user's row.
  // Use this (not setPasswords) wherever a password changes.
  function savePasswordFor(userId, hash) {
    setPasswords(p => ({ ...p, [String(userId)]: hash }));
    return dbSavePassword(userId, hash);
  }

  // Accepts either a plain password or an existing 64-char SHA-256 hash and always stores the hash.
  async function dbSavePassword(userId, password) {
    // Always store hashed — hash it here if it's not already a 64-char hex hash
    const isAlreadyHashed = /^[0-9a-f]{64}$/.test(password);
    const hashed = isAlreadyHashed ? password : await hashPassword(password);
    await dbWrite(sb.from("user_passwords").upsert({ user_id: String(userId), password: hashed }, { onConflict: "user_id" }), "password", { alertOnError: true });
  }

  // user_profiles.data holds per-user UI preferences ({theme, emojiMode}). Merge, don't overwrite.
  async function dbSaveTheme(userId, themeKey) {
    const sid = String(userId);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}), theme: themeKey };
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    await dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "theme preference");
  }

  // ── Mobile permits view model ───────────────────────────────────────────────
  // PermitsTab keeps permits in its own authoring shape; the phone wants the
  // job in front of it, with this user's own sign-on state. Sign-ons live on
  // the permit record as { signOns: { [userId]: { at, date } }, signOffs: {…} }.
  const mobilePermits = React.useMemo(() => (permits || [])
    .filter(p => p.status === "active" || p.status === "closed")
    .map(p => {
      const pt = PERMIT_TYPES.find(t => t.id === p.type);
      const uid = String(user?.id);
      const on = (p.signOns || {})[uid];
      const off = (p.signOffs || {})[uid];
      const hazards = Object.keys(p.hazards || {}).filter(k => p.hazards[k]);
      const precautions = Object.keys(p.precautions || {}).filter(k => p.precautions[k]);
      return {
        id: p.id,
        ref: "PTW-" + String(p.id).replace(/\D/g, "").slice(-4),
        typeId: p.type,
        task: (p.description || (pt ? pt.label : "Permit")).split(/[.\n]/)[0].slice(0, 60),
        location: p.location,
        issuedBy: p.authorisedBy,
        issuedAt: (p.startDateTime || "").slice(11, 16),
        validUntil: (p.endDateTime || "").slice(11, 16),
        signedOnAt: on ? on.at : null,
        signedOffAt: off ? off.at : null,
        closed: p.status === "closed" || !!off,
        // undefined, not [], so the screen falls back to the permit type's list
        hazards: hazards.length ? hazards : undefined,
        precautions: precautions.length ? precautions : undefined,
        ppe: p.ppe || [],
      };
    }), [permits, user]);

  // useMemo recreates this object only when the listed dependencies change, so the
  // closures inside always see current state. If you add a function that reads
  // another piece of state, ADD THAT STATE TO THE DEPENDENCY LIST at the bottom.
  // ── Mobile write surface ────────────────────────────────────────────────────
  // Everything src/mobile is allowed to do to the database, in one object.
  // Real writes go to the existing db* functions; the optimistic* callbacks
  // update local state first so the UI never waits on a network round-trip.
  const mobileDb = React.useMemo(() => ({
    saveCompletion: (userId, moduleId, rec) => dbSaveCompletion(userId, moduleId, rec),
    acknowledgeDoc: (userId, docId, date)   => dbAcknowledgeDoc(userId, docId, date),
    saveIncident:   (rec)                   => dbSaveIncident(rec),
    saveTheme:      (userId, key)           => dbSaveTheme(userId, key),
    completeAction: (incidentId, actionId)  => dbCompleteAction(incidentId, actionId, user?.name),

    // dbSaveDseReport takes the whole array for a user, so append then save.
    saveDseReport: (userId, report) => {
      const next = [ ...(dseReports[userId] || []), report ];
      return dbSaveDseReport(userId, next);
    },

    optimisticCompletion: (userId, r) => setComps(p => ({
      ...p,
      [userId]: { ...(p[userId] || {}), [r.moduleId]: { score: r.score, date: r.date, certId: r.certId } },
    })),
    optimisticDocAck: (userId, docId, date) => (markWrite(`k:${userId}:${docId}`), setDocAcknowledgements(p => ({
      ...p,
      [userId]: { ...(p[userId] || {}), [docId]: { date, version: (docs.find(d => String(d.id) === String(docId)) || {}).version || 1 } },
    }))),
    optimisticIncident: (rec) => setIncidents(p => [rec, ...p]),
    optimisticDseReport: (userId, report) => setDseReports(p => ({
      ...p,
      [userId]: [ ...(p[userId] || []), report ],
    })),

    // Phone "Read": pictures, web pages and text show in the preview window (rendered
    // with MobileApp below). PDFs and Office files open in their own tab, where the
    // phone's viewer can show them — most phones can't display a PDF inside a page.
    previewDoc: (d) => {
      const ext = String((d.fileName ? d.fileName.split(".").pop() : d.ext) || "").toUpperCase();
      const inPage = ["PNG","JPG","JPEG","GIF","WEBP","SVG","HTML","TXT","CSV","MD"].includes(ext);
      if (!d.fileData || inPage) { setPreviewDoc({ ...d, ext }); return; }
      if (!openFile(d.fileData)) setPreviewDoc({ ...d, ext });   // tab blocked → show the preview window instead
    },
    resolveIncident: (id) => {
      setIncidents(p => p.map(i => i.id === id ? { ...i, closed: true, triaged: true } : i));
      const inc = incidents.find(i => i.id === id);
      if (inc) dbSaveIncident({ ...inc, closed: true, triaged: true });
    },

    // ── Inspections, permits, RIDDOR (mobile-only writes) ───────────────────
    // dbSaveSiteInspections() upserts AND prunes anything not in the array it
    // is given, so a single record must never be passed to it. Instead we put
    // the record into state (deduped by id, because the offline queue may
    // replay a write we already applied optimistically) and let the existing
    // [siteInspections] effect persist the whole array.
    saveInspection: async (record) => {
      // site_inspections stores the whole record as jsonb, so the photos have
      // to become URLs before the record goes into state.
      const ncs = await Promise.all((record.nonConformances || []).map(async (nc, i) => ({
        ...nc,
        photos: await uploadPhotos(PHOTO_BUCKET, `insp_${record.id}_${i}`, nc.photos),
      })));
      const next = { ...record, nonConformances: ncs };
      setSiteInspections(p => [next, ...p.filter(r => r.id !== next.id)]);
    },

    savePermitSignOn: (entry) => {
      const p = permits.find(x => x.id === entry.permitId);
      if (!p) return;
      const next = {
        ...p,
        signOns: { ...(p.signOns || {}), [String(entry.userId)]: { at: entry.signedOnAt, date: entry.date } },
      };
      setPermits(list => list.map(x => x.id === next.id ? next : x));
      return dbSavePermit(next);
    },

    savePermitSignOff: (entry) => {
      const p = permits.find(x => x.id === entry.permitId);
      if (!p) return;
      const next = {
        ...p,
        signOffs: { ...(p.signOffs || {}), [String(entry.userId)]: { at: entry.signedOffAt } },
      };
      setPermits(list => list.map(x => x.id === next.id ? next : x));
      return dbSavePermit(next);
    },

    markRiddorReported: (incidentId) => {
      const inc = incidents.find(i => i.id === incidentId);
      if (!inc) return;
      const next = {
        ...inc,
        riddorReported: true,
        riddorReportedDate: todayISO(),
        riddorReportedBy: user?.name || "",
      };
      setIncidents(list => list.map(i => i.id === next.id ? next : i));
      return dbSaveIncident(next);
    },

    // The chase button on the incident record — no notification service yet, so
    // this just flags the action as chased on its investigation.
    chaseAction: (a) => {
      const inv = investigations[a.investigationId];
      if (!inv) return;
      const next = {
        ...inv,
        actions: (inv.actions || []).map(x => x.id === a.id
          ? { ...x, chasedOn: todayISO(), chasedBy: user?.name || "" }
          : x),
      };
      setInvestigations(p => ({ ...p, [a.investigationId]: next }));
      return dbSaveInvestigation(a.investigationId, next);
    },
  }), [dseReports, incidents, permits, investigations, user]);

  // Same merge pattern as dbSaveTheme, for the emoji on/off preference.
  async function dbSaveEmojiMode(userId, enabled) {    const sid = String(userId);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}), emojiMode: enabled };
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    await dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "emoji mode preference");
  }

  // Same merge pattern, for an unfinished DSE assessment (null = none / finished).
  async function dbSaveDseDraft(userId, draft) {
    const sid = String(userId);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}) };
    if (draft) merged.dseDraft = draft; else delete merged.dseDraft;
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    await dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "DSE progress");
  }
  function saveDseProgress(draft) {
    if (!user) return;
    setDseDraft(draft);
    dbSaveDseDraft(user.id, draft);
  }
  // Opens the DSE wizard: carries on from saved progress if there is some, otherwise starts fresh.
  function openDse() {
    const d = dseDraft;
    setDseAnswers(d?.answers || {}); setDseComments(d?.comments || {}); setDseSection(d?.section || 0);
    setDseSubmitted(false); setDseActive(true);
  }

  // users table: { id: TEXT, data: JSON user object }. `user` here shadows the logged-in user — it's the record being saved.
  async function dbSaveUser(user) {
    const ok = await dbWrite(sb.from("users").upsert({ id: String(user.id), data: user }, { onConflict: "id" }), "user", { alertOnError: true });
    // Supabase sign-in: copy login, role and leaver status onto their sign-in account.
    if (ok && AUTH_MODE === "supabase") {
      const r = await adminCall("sync", { userId: String(user.id) });
      if (!r.ok) notify(`The staff record was saved, but their sign-in account wasn't updated:\n${r.error}`, { kind: "error" });
    }
    return ok;
  }

  // Supabase sign-in: set a temporary password (they choose their own at next sign-in).
  // Creates the sign-in account if they don't have one yet.
  async function setTempPasswordFor(u, password) {
    const r = await adminCall("setPassword", { userId: String(u.id), password, temporary: true });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async function dbDeleteUser(userId) {
    await dbWrite(sb.from("users").delete().eq("id", String(userId)), "user delete", { alertOnError: true });
    if (AUTH_MODE === "supabase") {
      const r = await adminCall("remove", { userId: String(userId) });
      if (!r.ok) notify(`The staff record was removed, but their sign-in account wasn't:\n${r.error}`, { kind: "error" });
    }
  }

  // ⚠ Writes the WHOLE user object into user_profiles.data — this overwrites any saved
  // theme/emojiMode for that user. Only called on create/edit of staff records.
  // Merge into what's there: the profile also holds the person's own preferences
  // (theme, emojiMode, an unfinished DSE), which an admin edit must not wipe.
  async function dbSaveUserProfile(user) {
    const sid = String(user.id);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}), ...user };
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    await dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "user profile");
  }

  // Remove (not Leaver): delete everything the portal holds about one person, so
  // nothing is left behind. Incidents they reported, investigations, inspections and
  // the Audit Trail are company records and are kept. Returns the rows deleted per table.
  const PERSON_TABLES = ["training_assigns", "training_completions", "training_completion_history", "doc_assignments",
    "doc_acknowledgements", "doc_ack_history", "dse_reports", "dse_admin_responses", "ext_certs", "machine_completions",
    "last_logins", "user_profiles", "dashboard_layout"];
  async function dbDeletePersonRecords(userId) {
    const uid = String(userId);
    const results = await Promise.all([
      ...PERSON_TABLES.map(t => dbWrite(sb.from(t).delete().eq("user_id", uid), `${t} delete`)),
      dbWrite(sb.from("quiz_failures").delete().eq("data->>userId", uid), "quiz failures delete"),
    ]);
    return results.every(Boolean);
  }

  async function dbDeleteUserProfile(userId) {
    await dbWrite(sb.from("user_profiles").delete().eq("user_id", String(userId)), "user profile delete");
  }

  // Contractor data is stored as JSON blobs keyed by contractor id (company, inductions, certs, visits).
  async function dbSaveContractor(c) { await dbWrite(sb.from("contractors").upsert({id:c.id,data:c},{onConflict:"id"}), "contractor"); }
  async function dbDeleteContractor(id) { await dbWrite(sb.from("contractors").delete().eq("id",id), "contractor delete"); }
  async function dbSaveContractorInductions(cid,data) { await dbWrite(sb.from("contractor_inductions").upsert({contractor_id:cid,data},{onConflict:"contractor_id"}), "contractor inductions"); }
  async function dbSaveContractorCerts(cid,data) { await dbWrite(sb.from("contractor_certs").upsert({contractor_id:cid,data},{onConflict:"contractor_id"}), "contractor certs"); }
  async function dbSaveContractorVisits(cid,data) { await dbWrite(sb.from("contractor_visits").upsert({contractor_id:cid,data},{onConflict:"contractor_id"}), "contractor visits"); }

  async function dbSavePermit(p) {
    await dbWrite(sb.from("permits").upsert({ id: p.id, data: p }, { onConflict: "id" }), "permit", { alertOnError: true });
  }
  async function dbDeletePermit(id) {
    await dbWrite(sb.from("permits").delete().eq("id", id), "permit delete");
  }

  async function dbSaveRA(ra) {
    auditRecord("risk_assessment", ra.id, ra, [ra.reference, ra.title].filter(Boolean).join(" · "));
    await dbWrite(sb.from("risk_assessments").upsert({ id: ra.id, data: ra }, { onConflict: "id" }), "risk assessment", { alertOnError: true });
  }

  // Insert-only log of failed quiz attempts (shown to admins for follow-up).
  async function dbSaveQuizFailure(record) {
    await dbWrite(sb.from("quiz_failures").insert({ data: record }), "quiz failure record");
  }

  // both resolve to true when the database accepted the change
  async function dbSaveExtCert(userId, certType, data) {
    return dbWrite(sb.from("ext_certs").upsert({ user_id: String(userId), cert_type: certType, data }, { onConflict: "user_id,cert_type" }), "external certificate", { alertOnError: true });
  }

  async function dbDeleteExtCert(userId, certType) {
    return dbWrite(sb.from("ext_certs").delete().match({ user_id: userId, cert_type: certType }), "external certificate delete");
  }

  async function dbSaveCustomModule(mod) {
    await dbWrite(sb.from("custom_modules").upsert({ id: mod.id, data: mod }, { onConflict: "id" }), `module "${mod.title || mod.id}"`);
  }

  async function dbDeleteCustomModule(id) {
    await dbWrite(sb.from("custom_modules").delete().eq("id", id), "module delete");
  }

  // Admin "Duplicate" action on the Modules tab.
  function duplicateModule(m) {
    // Deep clone via JSON round-trip — module data (slides, quiz, image/video URLs) is plain serializable data.
    const cloned = JSON.parse(JSON.stringify(m));
    cloned.id = `custom_${Date.now()}`;
    cloned.title = `${m.title} (Copy)`;
    cloned._custom = true;
    delete cloned._override; // a duplicate is always a brand new, independent module — never an override
    cloned.version = 1; delete cloned.versionNote; delete cloned.versionChange; cloned.versionDate = todayISO();
    setCustomModules(prev=>[...prev, cloned]);
    dbSaveCustomModule(cloned);
    // Jump straight into the editor so the admin can rename/adjust the new version
    setEditingModule(cloned);
    setAtab("create");
  }

  // "Deleting" a built-in module can't remove it from the TRAINING_MODULES source — instead it's
  // hidden (soft-delete) via an override flag, and can be unhidden again at any time. Fully custom
  // modules are hidden the same way here; hard deletion of custom modules is handled separately.
  function setModuleHidden(m, hidden) {
    const isFullyCustom = m._custom && !m._override;
    if (isFullyCustom) {
      const updated = { ...m, _hidden: hidden };
      setCustomModules(prev=>prev.map(x=>x.id===m.id?updated:x));
      dbSaveCustomModule(updated);
      return;
    }
    const existingOverride = customModules.find(x=>x.id===m.id && x._override);
    const updated = { ...(existingOverride||m), _custom:true, _override:true, _hidden: hidden };
    setCustomModules(prev=>{
      if (existingOverride) return prev.map(x=>x.id===m.id?updated:x);
      return [...prev, updated];
    });
    dbSaveCustomModule(updated);
  }

  // ── Manager actions (My Team tab, role "manager") — each one is audited ──────────
  // Add modules to a team member's assignments (managers can add, not remove).
  function managerAssign(member, moduleIds, dueDate) {
    const uid = String(member.id);
    const current = assigns[uid] || [];
    const added = moduleIds.filter(id => !current.includes(id));
    if (!added.length) return;
    const next = [...current, ...added];
    const due = dueDate ? { [uid]: Object.fromEntries(added.map(id => [id, dueDate])) } : null;
    setAssigns(p => ({ ...p, [uid]: next }));
    if (due) noteDue(due);
    dbSaveAssigns({ [uid]: next }, due);
    const titles = added.map(id => (allModules.find(m => m.id === id) || {}).title || id);
    auditEvent("training_assign", uid, "assign", `Assigned by line manager: ${titles.join(", ")}`, { modules: { from: null, to: titles } }, member.name);
  }
  // Manager signs off one DSE issue as resolved (stored on the admin response record).
  function managerSignOffDse(member, ri, ii, issue, note) {
    const uid = String(member.id), key = `${ri}_${ii}`, today = todayISO();
    const cur = (adminResponses[uid] || adminResponses[member.id] || {})[key] || { comment: "", resolved: false };
    const rec = { ...cur, resolved: true, signedOffBy: user.name, signedOffAt: today,
      comment: note ? (cur.comment ? `${cur.comment}\n${note}` : note) : cur.comment };
    const nextUser = { ...(adminResponses[uid] || adminResponses[member.id] || {}), [key]: rec };
    primeAudit("dse_response", uid, nextUser);   // the explicit sign-off entry below replaces the automatic diff
    setAdminResponses(p => ({ ...p, [uid]: nextUser }));
    auditEvent("dse_response", uid, "sign_off", `Line manager signed off DSE issue: ${issue.question}${note ? ` — ${note}` : ""}`,
      { resolved: { from: !!cur.resolved, to: true }, signedOffBy: { from: null, to: user.name } }, member.name);
  }
  // Manager signs off a corrective action (marks it complete first if it isn't already).
  function managerSignOffAction(incidentId, action, member, note) {
    const inv = investigations[incidentId]; if (!inv) return;
    const today = todayISO();
    const done = action.status === "complete" || action.status === "closed";
    const next = { ...inv, actions: (inv.actions || []).map(a => a.id !== action.id ? a : {
      ...a,
      ...(done ? {} : { status: "complete", completedDate: today, completedBy: user.name }),
      managerSignOff: { by: user.name, date: today, note: note || "" },
    }) };
    primeAudit("investigation", incidentId, next);
    setInvestigations(p => ({ ...p, [incidentId]: next }));
    auditEvent("corrective_action", incidentId, "sign_off",
      `Line manager signed off action for ${member.name}: ${action.description}${done ? "" : " (marked complete)"}${note ? ` — ${note}` : ""}`,
      { status: { from: action.status || "open", to: "complete" }, managerSignOff: { from: null, to: `${user.name} ${today}` } },
      incidentAuditLabel(incidents.find(i => String(i.id) === String(incidentId))));
  }

  // Saves an edited module as a NEW VERSION (called from NewVersionModal).
  //  • the previous content is kept in module_versions (snapshot)
  //  • change "major" clears everyone's current completion so they must redo it —
  //    their earlier result stays in training_completion_history
  //  • change "minor" keeps completions (each records the version it was for)
  function saveModuleVersion(change, note) {
    const { m, prev } = pendingModuleSave;
    const prevVer = prev.version || 1, newVer = prevVer + 1, today = todayISO();
    const snap = { id: `${prev.id}_v${prevVer}`, module_id: String(prev.id), version: prevVer, data: prev,
      saved_at: new Date().toISOString(), saved_by: user ? user.name : "", change, note: note || null };
    setModuleVersions(p => [...p.filter(x => x.id !== snap.id), snap]);
    dbWrite(sb.from("module_versions").upsert(snap, { onConflict: "id" }), "module version snapshot");
    const saved = { ...m, version: newVer, versionDate: today, versionNote: note || "", versionChange: change };
    if (prev._custom) {
      const upd = { ...saved, _custom: true, ...(prev._override ? { _override: true } : {}) };
      setCustomModules(p => p.map(x => x.id === m.id ? upd : x));
      dbSaveCustomModule(upd);
    } else {
      // Built-in module → saved as an override with the same id
      const upd = { ...saved, _custom: true, _override: true };
      setCustomModules(p => p.find(x => x.id === m.id) ? p.map(x => x.id === m.id ? upd : x) : [...p, upd]);
      dbSaveCustomModule(upd);
    }
    const logVersion = cleared => auditEvent("module", m.id, "new_version",
      `Version ${newVer} (${change === "major" ? `major — ${cleared} ${cleared === 1 ? "person" : "people"} must redo it` : "minor — completions kept"})${note ? `: ${note}` : ""}`,
      { version: { from: prevVer, to: newVer }, change: { from: null, to: change } }, m.title || "");
    if (change === "major") {
      // Clear EVERY current completion of this module, as the database has them —
      // not just the ones on this screen, which may be missing someone who finished
      // it after you signed in. Their earlier results stay in the history.
      (async () => {
        const mid = String(m.id);
        const { data, error } = await sb.from("training_completions").query(`select=user_id&module_id=eq.${encodeURIComponent(mid)}`);
        const affected = [...new Set([...(error ? [] : (data || []).map(r => String(r.user_id))),
          ...Object.keys(comps).filter(uid => comps[uid] && comps[uid][m.id])])];
        affected.forEach(uid => markWrite(`c:${uid}:${mid}`));
        setComps(p => { const n = { ...p }; affected.forEach(uid => { if (n[uid]) { n[uid] = { ...n[uid] }; delete n[uid][m.id]; } }); return n; });
        await dbWrite(sb.from("training_completions").delete().eq("module_id", mid), "completion clear (new module version)", { alertOnError: true });
        logVersion(affected.length);
      })();
    } else logVersion(0);
    setPendingModuleSave(null);
    setEditingModule(null);
    setAtab("modules");
  }

  async function dbSaveCustomMachineType(type) {
    await dbWrite(sb.from("custom_machine_types").upsert({ id: type.id, data: type }, { onConflict: "id" }), "custom machine type");
  }

  async function dbDeleteCustomMachineType(id) {
    await dbWrite(sb.from("custom_machine_types").delete().eq("id", id), "custom machine type delete");
  }

  async function dbSaveMachineComp(userId, machineId, data) {
    return dbWrite(sb.from("machine_completions").upsert({ user_id: String(userId), machine_id: String(machineId), data }, { onConflict: "user_id,machine_id" }), "machine competence record", { alertOnError: true });
  }

  async function dbDeleteMachineComp(userId, machineId) {
    return dbWrite(sb.from("machine_completions").delete().match({ user_id: String(userId), machine_id: String(machineId) }), "machine competence delete", { alertOnError: true });
  }

  // UPSERT-AND-PRUNE (the preferred pattern): upsert everything in state, then read the ids
  // in the table and delete any that are no longer in state.
  async function dbSaveEquipment(items) {
    // Upsert-and-prune instead of delete-everything-then-reinsert: only
    // the items that actually changed get rewritten, and only items that
    // were genuinely removed get deleted. The old version deleted and
    // reinserted the entire table on every single edit, regardless of how
    // many items actually changed.
    if (items.length) await dbWrite(sb.from("equipment").upsert(items.map(e => ({ id: e.id, data: e })), { onConflict: "id" }), "equipment sync");
    const { data: existing } = await sb.from("equipment").select("id");
    if (existing && existing.length) {
      const currentIds = new Set(items.map(e => e.id));
      const toDelete = existing.filter(r => !currentIds.has(r.id)).map(r => r.id);
      for (const id of toDelete) await dbWrite(sb.from("equipment").delete().eq("id", id), "equipment delete");
    }
  }

  async function dbSaveSiteInspections(items) {
    // Same upsert-and-prune approach as dbSaveEquipment above.
    if (items.length) await dbWrite(sb.from("site_inspections").upsert(items.map(e => ({ id: e.id, data: e })), { onConflict: "id" }), "site inspections sync");
    const { data: existing } = await sb.from("site_inspections").select("id");
    if (existing && existing.length) {
      const currentIds = new Set(items.map(e => e.id));
      const toDelete = existing.filter(r => !currentIds.has(r.id)).map(r => r.id);
      for (const id of toDelete) await dbWrite(sb.from("site_inspections").delete().eq("id", id), "site inspection delete");
    }
  }

  // Whole first aid register saved as one JSON document (row id "singleton").
  async function dbSaveFirstAidData(data) {
    await dbWrite(sb.from("first_aid_register").upsert({ id: "singleton", data }, { onConflict: "id" }), "first aid register");
  }

  // Saves the six fire-safety lists to their six tables using upsert-and-prune.
  // Transient fields are stripped before saving: `_fileObj` (a browser File object,
  // not serialisable) and, for FRA reviews, the base64 `fileData` (the file itself
  // lives in the "fire-safety" storage bucket instead).
  // Removed items are deleted from the DB, including the very last item of a list
  // (only when every fire table loaded OK — see fireLoadOkRef).
  async function dbSaveFireSafety(fs) {
    const upsertTable = async (table, items) => {
      if (!items || !items.length) return;
      const rows = table === "fire_fra_reviews"
        ? items.map(r => { const {fileData, _fileObj, ...rest} = r; return { id: r.id, data: rest }; })
        : items.map(r => { const {_fileObj, ...rest} = r; return { id: r.id, data: rest }; });
      await dbWrite(sb.from(table).upsert(rows, { onConflict: "id" }), `fire safety: ${table}`);
    };
    const deleteRemoved = async (table, items) => {
      // Delete rows in DB that are no longer in state. This must also run when the
      // list is now EMPTY — returning early here is why deleting the last item in a
      // list used to come back after a reload.
      if (!fireLoadOkRef.current) return;   // list may be seed data — never prune on that
      items = items || [];
      const { data: existing } = await sb.from(table).select("id");
      if (!existing || !existing.length) return;
      const currentIds = new Set(items.map(r => r.id));
      const toDelete = existing.filter(r => !currentIds.has(r.id)).map(r => r.id);
      if (toDelete.length) {
        for (const id of toDelete) await dbWrite(sb.from(table).delete().eq("id", id), `fire safety delete: ${table}`);
      }
    };
    const sync = async (table, items) => {
      await upsertTable(table, items);
      await deleteRemoved(table, items);
    };
    await sync("fire_wardens",       fs.wardens       || []);
    await sync("fire_drills",        fs.drills        || []);
    await sync("fire_alarm_tests",   fs.alarmTests    || []);
    await sync("fire_extinguishers", fs.extinguishers || []);
    await sync("fire_emerg_lighting",fs.emergLighting || []);
    await sync("fire_fra_reviews",   fs.fraReviews    || []);
  }

  // Fire Risk Assessment PDF upload → returns the public URL, or null on failure.
  async function dbUploadFraDocument(reviewId, file, fileName) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `fra_${reviewId}_${safeName}`;
    const { error } = await sb.storage.upload("fire-safety", path, file);
    if (error) { console.error("FRA upload error:", error); return null; }
    return sb.storage.getPublicUrl("fire-safety", path);
  }

  async function dbDeleteFraDocument(reviewId, fileName) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    await dbWrite(sb.storage.remove("fire-safety", [`fra_${reviewId}_${safeName}`]), "FRA document delete");
  }

  // ⚠⚠ EARLY RETURN — no React hooks may be declared below this line. ⚠⚠
  // (Uses the default dark tokens `Z` because the user's theme isn't known yet.)
  // ── Show loading screen until Supabase data is ready ────────────────────────
  // (Supabase sign-in: the login screen shows before any data is loaded — the data
  //  is loaded after sign-in, with the person's token.)
  if (!dbReady && !(AUTH_MODE === "supabase" && view === "login")) return (
    <div style={{minHeight:"100vh",background:Z.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow','Trebuchet MS',system-ui,sans-serif",flexDirection:"column",gap:20}}>
      <ZeusProtectLogo/>
      <div style={{color:Z.muted,fontSize:14,letterSpacing:1}}>CONNECTING TO DATABASE…</div>
      <div style={{width:200,height:3,background:Z.border,borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:"60%",background:`linear-gradient(90deg,${Z.accent},${Z.accentLt})`,borderRadius:99,animation:"slide 1.2s ease-in-out infinite"}}/>
      </div>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
    </div>
  );

  /**
   * Checks the email/password against allUsers + passwords (all client-side).
   * Order: lockout check → user exists → password hash matches → not a leaver →
   * record last login → restore saved theme/emoji prefs → route to admin/staff view.
   */
  async function login() {
    const emailKey = email.toLowerCase().trim();
    // Counts a failed attempt for this email; locks it after MAX_LOGIN_ATTEMPTS.
    const registerFailure = () => setLoginAttempts(p => {
      const cur = p[emailKey]||{count:0};
      const count = cur.count + 1;
      const lockedUntil = count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_MINUTES * 60000 : null;
      setErr(count >= MAX_LOGIN_ATTEMPTS
        ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
        : `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - count} attempt${MAX_LOGIN_ATTEMPTS - count!==1?"s":""} remaining.`);
      return {...p, [emailKey]: {count, lockedUntil}};
    });

    // Check lockout
    const attempt = loginAttempts[emailKey];
    if (attempt?.lockedUntil && Date.now() < attempt.lockedUntil) {
      const minsLeft = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      setErr(`Too many failed attempts. Try again in ${minsLeft} minute${minsLeft!==1?"s":""}.`);
      return;
    }

    // ── Supabase sign-in (lib/auth.js): Supabase checks the password and returns a
    //    token; the account's app_metadata.zp_id links it to the staff record.
    if (AUTH_MODE === "supabase") {
      const r = await signIn(emailKey, pass);
      if (!r.ok) {
        if (r.error === "Invalid email or password.") registerFailure(); else setErr(r.error);
        return;
      }
      const m = authMeta(r.user);
      // The database now answers as this person: find their staff record, then load
      // everything they're allowed to see.
      setSigningIn(true);
      const ures = await sb.from("users").select("*");
      const su = (Array.isArray(ures.data) ? ures.data : []).map(x => x.data).find(x => x && String(x.id) === String(m.zp_id));
      if (!su) { setSigningIn(false); await signOut(); setErr("Your sign-in isn't linked to a staff record. Please contact your administrator."); return; }
      if ((su.status||"active") === "leaver") { setSigningIn(false); await signOut(); setErr("This account is no longer active. Please contact your administrator."); return; }
      if (loadAllRef.current) await loadAllRef.current();
      setSigningIn(false);
      setMustChangePw(!!m.must_change_password);
      finishLogin(su);
      return;
    }

    const u = allUsers.find(x=>x.email.toLowerCase()===emailKey);
    if (!u) {
      // Still increment attempts on unknown email to prevent user enumeration
      setLoginAttempts(p => {
        const cur = p[emailKey]||{count:0};
        const count = cur.count + 1;
        const lockedUntil = count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_MINUTES * 60000 : null;
        return {...p, [emailKey]: {count, lockedUntil}};
      });
      setErr("Invalid email or password."); return;
    }

    const storedHash = passwords[u.id] || DEFAULT_HASH;
    const enteredHash = await hashPassword(pass);
    // Accepts the hash OR a legacy plain-text stored password.
    // ⚠ Side effect: typing the stored hash itself also logs in. Since hashes are readable
    // with the public anon key, removing `|| pass === storedHash` (after confirming no
    // plain-text passwords remain in user_passwords) would close that gap.
    const isMatch = enteredHash === storedHash || pass === storedHash;

    if (!isMatch) {
      setLoginAttempts(p => {
        const cur = p[emailKey]||{count:0};
        const count = cur.count + 1;
        const lockedUntil = count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_MINUTES * 60000 : null;
        const msg = count >= MAX_LOGIN_ATTEMPTS
          ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
          : `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - count} attempt${MAX_LOGIN_ATTEMPTS - count!==1?"s":""} remaining.`;
        setErr(msg);
        return {...p, [emailKey]: {count, lockedUntil}};
      });
      return;
    }

    // Leavers are fully blocked from logging in, even with a correct
    // password — the account record is kept (for historical training/
    // incident data) but access is revoked. "inactive" status, by
    // contrast, is informational only and does not affect login.
    // (u.status||"active") matches the fallback used everywhere else in
    // the app, since most existing accounts have no status field set at
    // all and should be treated as active.
    if ((u.status||"active") === "leaver") {
      setErr("This account is no longer active. Please contact your administrator.");
      return;
    }

    finishLogin(u);
  }

  // Shared end of a successful sign-in (both modes).
  function finishLogin(u) {
    const emailKey = String(u.email||"").toLowerCase().trim();
    // Success — clear attempts
    setLoginAttempts(p => { const n={...p}; delete n[emailKey]; delete n[email.toLowerCase().trim()]; return n; });
    const ts = localDateTime().replace("T"," ");   // UK time, as shown under Last Active
    setLastLoginMap(p=>({...p, [u.id]: ts}));
    // First ever sign-in? (no login recorded for them yet) → welcome video. Checked BEFORE
    // this login is recorded; if the check fails, no video (never shown to someone by mistake).
    (async () => {
      let first = false;
      try { const r = await sb.from("last_logins").select("user_id").eq("user_id", String(u.id)); first = !r.error && Array.isArray(r.data) && r.data.length === 0; } catch { /* */ }
      await dbRecordLogin(u.id, ts);
      if (first) setWelcomePending(true);
    })();
    // Restore saved theme for this user
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const profile = profiles.find(r => String(r.user_id) === String(u.id));
    // Their saved theme, or the default, so a shared computer doesn't keep the last person's.
    setTheme(profile?.data?.theme || "dark");
    setDseDraft(profile?.data?.dseDraft || null);
    if (profile?.data?.emojiMode === false) setEmojiMode(false);
    setUser(u); setErr("");
    // Back to the page in the address (refresh / bookmark / link) if this person may see it.
    const r = initialRouteRef.current || parseRoute(window.location.hash); initialRouteRef.current = null;
    if (r && routeAllowed(r, u)) {
      if (r.area === "admin") { setViewRaw("admin"); setAtabRaw(r.tab); }
      else { setViewRaw("staff"); setStabRaw(r.tab); pendingModuleRef.current = r.moduleId || null; }
    } else setViewRaw(u.role==="admin"?"admin":"staff");
  }

  // Clears the session (and, in Supabase sign-in mode, ends the server session too).
  // In Supabase sign-in mode the page is reloaded after signing out, so nothing the
  // last person could see stays in memory for the next person on this computer.
  async function logout() {
    if (!(await confirmLeave())) return;      // unsaved form? ask first
    // forget the page address, so the next person to sign in on this computer starts at their dashboard
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch { /* */ }
    // ...and forget their remembered filters (lib/remembered.js)
    clearRemembered();
    // ...and their unsaved-form drafts on this computer (lib/unsaved.jsx)
    clearDrafts(user && user.id);
    hideWelcome(); setWelcomePending(false);
    if (AUTH_MODE === "supabase") { signOut().finally(() => window.location.reload()); return; }
    setMustChangePw(false); setUser(null); setViewRaw("login"); setMod(null); setDseDraft(null); setDseActive(false);
    setAdminReportView("staff"); setShowHiddenModules(false); setStaffFilterManager("all"); setDocFolder("all"); setStaffFilterProgress("all");
    setStaffGroupByTeam(false); setStaffStatusFilter("all"); setBulkTarget("individual"); setBulkManager(""); setStaffFilterSearch(""); setStaffSel([]);
  }

  // Opens a module in the player and resets all per-attempt state.
  function startMod(m) { setMod(m); setStep(0); setQans({}); setQsub(false); setShowCelebration(false); setHotspotComplete({}); }

  // ── Quick search (🔍 in the header, Ctrl+K / ⌘K) ── shared/QuickSearch.jsx
  // Builds the list of things a person can jump to. Only runs while the search is open.
  // jump() asks once about unsaved work, then changes page with the raw setters
  // (the guarded setters would each ask separately).
  const jump = fn => { if (!unsavedLabels().length) { fn(); return; } confirmLeave().then(ok => { if (ok) fn(); }); };
  function quickItems() {
    if (!user) return [];
    const items = [];
    const isAdmin = user.role === "admin";
    const toStaff = (tab, then) => jump(() => { setMod(null); setViewRaw("staff"); setStabRaw(tab); if (then) then(); });
    const toAdmin = (tab, then) => jump(() => { setMod(null); setViewRaw("admin"); setAtabRaw(tab); if (then) then(); });
    const fmt = d => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
    // pages
    const STAFF_PAGES = { dashboard: "Dashboard", training: "My Training", history: "Training history & certificates", documents: "Documents", incidents: "Report Incident", dse: "My DSE", machinery: "My Machinery", mequip: "Machinery & Equipment", actions: "My Actions", team: "My Team", account: "My Account" };
    const staffTabs = ["dashboard", "training", "history", "documents", "incidents", "dse", ...(isWarehouseWorker(user) ? ["machinery"] : []), "actions", ...(user.role === "manager" ? ["team"] : []), ...(user.role !== "admin" && hasMachineryAccess(user) ? ["mequip"] : []), "account"];
    staffTabs.forEach(t => items.push({ id: `p:s:${t}`, group: "Pages", icon: "📄", label: STAFF_PAGES[t], sub: isAdmin ? "Your own training view" : "Page", words: t === "history" ? "certificates certificate history" : t === "incidents" ? "report hazard near miss" : "", run: () => toStaff(t) }));
    if (isAdmin) {
      const ADMIN_PAGES = [["dashboard", "Admin dashboard", ""], ["users", "Staff", "staff accounts people users"], ["assign", "Assign Training", "training"], ["modules", "Training Library", "modules training"],
        ["create", "Create Module", "new module training"], ["reports", "Reports", "training matrix report excel"], ["documents", "H&S Documents", "documents bundles policies"], ["coshh", "COSHH Register", "chemicals"],
        ["audit", "Audit Trail", "log history"], ["settings", "Site Settings", "locations first aid zones shifts report locations"], ["incidents", "Incidents", "accidents near miss riddor"], ["inspections", "Inspections", "site inspection"], ["ra", "Risk Assessments", "risk"],
        ["firesafety", "Fire Safety", "wardens extinguishers drills"], ["firstaid", "First Aid", "first aiders"], ["contractors", "Contractors", ""], ["permits", "Permits", "permit to work"],
        ["machinery", "Machinery Competence", "forklift"], ["equipment", "Equipment Register", "equipment"], ["account", "My Account", "password"]];
      ADMIN_PAGES.forEach(([t, l, w]) => items.push({ id: `p:a:${t}`, group: "Pages", icon: "🧭", label: l, sub: "Admin page", words: w, run: () => toAdmin(t) }));
      // pages inside other pages
      items.push({ id: "p:a:investigations", group: "Pages", icon: "🔍", label: "Investigations", sub: "Incidents → Investigations", words: "investigation root cause corrective actions", run: () => toAdmin("investigation", () => setInvestigationView(null)) });
      items.push({ id: "p:a:accidentbook", group: "Pages", icon: "📖", label: "Accident Book", sub: "Incidents → Accident Book", words: "accident book bi510 print", run: () => toAdmin("incidents", () => setPagePreset({ tab: "incidents", accidentBook: true })) });
      [["matrix", "Training Matrix", "matrix excel"], ["monthly", "Monthly management report", "monthly report board"], ["dse", "DSE Reports", "dse display screen workstation assessments"],
       ["expiry", "Expiring training", "expiry expired renewals"], ["failures", "Quiz Failures", "quiz failed"], ["documents", "Document Read Status", "read confirmations acknowledgements"]]
        .forEach(([v, l, w]) => items.push({ id: `p:a:rep:${v}`, group: "Pages", icon: "📊", label: l, sub: "Reports", words: w, run: () => toAdmin("reports", () => setAdminReportView(v)) }));
      items.push({ id: "p:a:welcome", group: "Pages", icon: "🎬", label: "Welcome video", sub: "Staff → the video new staff see when they first sign in", words: "first sign in login new starter induction tour", run: () => toAdmin("users", () => setShowWelcomeSettings(true)) });
      // people
      allUsers.forEach(u => {
        const leaver = (u.status || "active") === "leaver";
        const open = () => toAdmin("users", () => { setStaffFilterSearch(u.name); setStaffFilterManager("all"); setStaffFilterProgress("all"); setStaffStatusFilter("all"); setEditingStaff(null); });
        items.push({ id: `u:${u.id}`, group: "People", icon: "👤", label: u.name, sub: [u.jobTitle, u.manager && `Manager: ${u.manager}`, leaver && "Leaver"].filter(Boolean).join(" · "), words: `${u.email || ""} ${u.department || ""}`, run: open,
          actions: [{ label: "Assign training", run: () => toAdmin("assign", () => { setBulkTarget("individual"); setTarget(String(u.id)); }) },
                    { label: "Edit", run: () => toAdmin("users", () => { setStaffFilterSearch(u.name); setStaffFilterManager("all"); setStaffFilterProgress("all"); setStaffStatusFilter("all"); setEditingStaff(u); }) }] });
      });
      allModules.forEach(m => items.push({ id: `m:${m.id}`, group: "Modules", icon: m.icon || "📚", label: m.title, sub: [m.category, m.level, m._hidden && "Hidden"].filter(Boolean).join(" · "), words: m.description || "", run: () => setPreviewModule(m) }));
      const INC = { near_miss: "Near miss", unsafe_condition: "Unsafe condition", unsafe_act: "Unsafe act", accident: "Accident", dangerous_occurrence: "Dangerous occurrence", ill_health: "Ill health" };
      incidents.forEach(i => items.push({ id: `i:${i.id}`, group: "Incidents", icon: i.riddor ? "🚨" : "⚠️", label: `${INC[i.type] || "Incident"} — ${i.location || "no location"}`, sub: [fmt(i.date), i.closed ? "Closed" : "Open", i.riddor && "RIDDOR", i.description].filter(Boolean).join(" · "), words: `${i.id} ${(allUsers.find(u => String(u.id) === String(i.reportedBy)) || {}).name || ""}`,
        run: () => toAdmin("incidents", () => setFocusIncidentId(i.id)) }));
      (contractors || []).forEach(c => items.push({ id: `c:${c.id}`, group: "Contractors", icon: "🦺", label: c.name, sub: [c.trade || c.type, c.status].filter(Boolean).join(" · "), words: `${c.contact || ""} ${(c.workers || []).map(w => w.name).join(" ")}`,
        run: () => toAdmin("contractors", () => setFocusContractorId(c.id)) }));
    } else {
      const myIds = (assigns[String(user.id)] || []).map(String);
      allModules.filter(m => myIds.includes(String(m.id))).forEach(m => {
        const done = (comps[user.id] || comps[String(user.id)] || {})[m.id];
        items.push({ id: `m:${m.id}`, group: "My training", icon: m.icon || "📚", label: m.title, sub: done ? `Completed ${fmt(done.date)}` : "To do", words: m.category || "", run: () => toStaff("training", () => startMod(m)) });
      });
    }
    // documents (everyone can read the H&S documents)
    docs.forEach(d => items.push({ id: `d:${d.id}`, group: "Documents", icon: "📘", label: d.title, sub: [d.type || d.category, d.date && `Updated ${d.date}`].filter(Boolean).join(" · "), words: d.fileName || "",
      run: () => (isAdmin && view === "admin" ? toAdmin : toStaff)("documents", () => { setDocFolder("all"); if (d.fileData) setPreviewDoc(d); }) }));
    return items;
  }

  // ── Staff list bulk actions (tick people → one action for all of them) ──
  // Each asks once in an on-page window, then shows a message with Undo.
  const peopleNamed = ids => { const n = ids.map(id => (allUsers.find(u => String(u.id) === id) || {}).name).filter(Boolean); return n.length <= 3 ? n.join(", ") : `${n.slice(0, 3).join(", ")} and ${n.length - 3} more`; };
  async function bulkAssignModule(ids) {
    const mods = allModules.filter(m => !m._hidden);
    const v = await ask({ title: `Assign a module to ${ids.length} ${ids.length !== 1 ? "people" : "person"}`, message: peopleNamed(ids), ok: "Assign",
      fields: [{ id: "mid", label: "Module", required: true, placeholder: "Choose a module…", options: mods.map(m => ({ value: String(m.id), label: `${m.title}${m.level === "Mandatory" ? " (mandatory)" : ""}` })) },
               { id: "due", label: "Due by (optional)", type: "date", help: "Leave empty for no due date." }] });
    if (!v) return false;
    const m = mods.find(x => String(x.id) === v.mid); if (!m) return false;
    const d = (v.due || "").trim() || null;
    const affected = {}, added = [], due = {};
    ids.forEach(id => { const cur = assigns[id] || []; if (!cur.includes(m.id)) { affected[id] = [...cur, m.id]; added.push(id); if (d) due[id] = { [m.id]: d }; } });
    if (!added.length) { notify(`Everyone ticked already has "${m.title}".`, { kind: "info" }); return true; }
    setAssigns(p => ({ ...p, ...affected }));
    if (d) noteDue(due);
    await dbSaveAssigns(affected, d ? due : null);
    notify(`"${m.title}" assigned to ${added.length} ${added.length !== 1 ? "people" : "person"}${added.length < ids.length ? ` (${ids.length - added.length} already had it)` : ""}.`, { undo: () => {
      const back = {}; added.forEach(id => { back[id] = (affected[id] || []).filter(x => x !== m.id); });
      setAssigns(p => { const n = { ...p }; added.forEach(id => { n[id] = (n[id] || []).filter(x => x !== m.id); }); return n; });
      dbSaveAssigns(back); notify(`"${m.title}" taken off again.`, { kind: "info" });
    } });
    return true;
  }
  async function bulkGiveBundle(ids) {
    if (!docBundles.length) { notify("There are no document bundles yet. Create one under H&S Documents → Bundles.", { kind: "info", timeout: 7000 }); return false; }
    const v = await ask({ title: `Give a document bundle to ${ids.length} ${ids.length !== 1 ? "people" : "person"}`, message: peopleNamed(ids), ok: "Give bundle",
      fields: [{ id: "bid", label: "Document bundle", required: true, placeholder: "Choose a bundle…", options: docBundles.map(b => ({ value: String(b.id), label: `${b.name} (${(b.docIds || []).length} documents)` })) }] });
    if (!v) return false;
    const b = docBundles.find(x => String(x.id) === v.bid); if (!b) return false;
    const added = ids.filter(id => !(b.memberIds || []).includes(id));
    if (!added.length) { notify(`Everyone ticked already has "${b.name}".`, { kind: "info" }); return true; }
    const n = await assignBundle(b, added);
    if (n) notify(`"${b.name}" given to ${n} ${n !== 1 ? "people" : "person"} as required reading.`, { undo: () => { unassignBundle(b, added); notify(`"${b.name}" taken off again.`, { kind: "info" }); } });
    return true;
  }
  async function saveUsersBulk(updated) {
    setAllUsers(p => p.map(u => updated.find(x => x.id === u.id) || u));
    for (const u of updated) { await dbSaveUser(u); await dbSaveUserProfile(u); }
  }
  async function bulkSetManager(ids) {
    const managerNames = allUsers.filter(u => u.role === "manager" && (u.status || "active") !== "leaver").map(u => u.name).sort();
    const v = await ask({ title: `Set the line manager for ${ids.length} ${ids.length !== 1 ? "people" : "person"}`, message: peopleNamed(ids), ok: "Set line manager",
      fields: [{ id: "manager", label: "Line manager", required: true, suggestions: managerNames, placeholder: "Type or pick a name",
        help: "Pick a name from the list so they appear in that manager's My Team (the name must match a Line manager account exactly)." }] });
    if (!v) return false;
    const name = v.manager.trim().replace(/\s+/g, " ");
    const people = allUsers.filter(u => ids.includes(String(u.id)));
    const before = people.map(u => ({ ...u }));
    await saveUsersBulk(people.map(u => ({ ...u, manager: name })));
    const known = managerNames.some(x => x.toLowerCase() === name.toLowerCase());
    notify(`Line manager set to ${name} for ${people.length} ${people.length !== 1 ? "people" : "person"}.${known ? "" : " (No Line manager account has that name yet, so they won't appear in anyone's My Team.)"}`, { kind: known ? "success" : "warn", undo: () => { saveUsersBulk(before); notify("Line managers put back.", { kind: "info" }); } });
    return true;
  }
  async function bulkMarkLeavers(ids) {
    const people = allUsers.filter(u => ids.includes(String(u.id)) && String(u.id) !== String(user.id) && (u.status || "active") !== "leaver");
    if (!people.length) { notify("Everyone ticked is already a leaver.", { kind: "info" }); return false; }
    const ok = await ask({ title: `Mark ${people.length} ${people.length !== 1 ? "people" : "person"} as leavers?`, danger: true, ok: "Mark as leavers",
      message: `${peopleNamed(people.map(u => String(u.id)))}\n\nLeavers can no longer sign in and drop out of reminders and compliance figures. Their training records, certificates and history are kept, and you can make them active again from Edit.` });
    if (!ok) return false;
    const before = people.map(u => ({ ...u }));
    await saveUsersBulk(people.map(u => ({ ...u, status: "leaver" })));
    notify(`${people.length} ${people.length !== 1 ? "people" : "person"} marked as leavers.`, { undo: () => { saveUsersBulk(before); notify("Put back as they were.", { kind: "info" }); } });
    return true;
  }

  // Scores the quiz against the module's own pass mark (passMarkOf: default 70%,
  // set per module in Create/Edit Module). The phone player does the same.
  // A pass creates a certificate id "ZSL-XXXXXXXX" and becomes their result. A fail
  // is logged to quiz_failures only — it never replaces an earlier pass, and it
  // doesn't count as completed.
  function submitQuiz() {
    let score=0;
    mod.quiz.forEach((q,i)=>{ if(qans[i]===q.answer) score++; });
    const pct=Math.round(score/mod.quiz.length*100);
    const mark = passMarkOf(mod);
    setQsub(true);
    const certId = pct>=mark ? "ZSL-" + (user.id.toString(36) + mod.id + Date.now().toString(36)).toUpperCase().slice(-8) : null;
    if (pct>=mark) {
      clearProgress(user.id, mod);   // passed: no place to carry on from (lib/moduleProgress.js)
      setShowCelebration(true);
      const rec = {score:pct, date:todayISO(), answers:{...qans}, certId, moduleVersion: mod.version||1};
      setComps(p=>({...p,[user.id]:{...p[user.id],[mod.id]:rec}}));
      dbSaveCompletion(user.id, mod.id, rec);
    }
    // Record failure for admin visibility
    if (pct < mark) {
      const failure = {
        id: "qf_" + Date.now(),
        userId: user.id,
        userName: user.name,
        moduleId: mod.id,
        moduleTitle: mod.title,
        score: pct,
        date: todayISO(),
        acknowledged: false,
        passMark: mark,
      };
      setQuizFailures(p=>[...p, failure]);
      dbSaveQuizFailure(failure);
    }
  }

  const totalSlides = mod ? mod.content.length : 0;
  const quizStep = totalSlides+1;

  // Style factory for the top-nav tab buttons (active tab gets a coloured underline).
  // ── Shared nav styles ──
  // Narrower screens get tighter menu items so the whole admin bar (including Sign Out) fits;
  // if it still doesn't, the right-hand group wraps onto a second row instead of being cut off.
  const navTight = winW < 2100;
  const navCompact = winW < 1900;   // laptop screens: icon-only My Training, no first name, tighter items
  const navTiny = winW < 1500;      // small laptops (1366–1440): smaller type; theme button left to My Account
  const navBtn = (active, col=T.accentLt) => ({
    padding:navTiny?"16px 5px":navCompact?"16px 7px":navTight?"16px 9px":"16px 16px", background:"none", border:"none",
    borderBottom:`3px solid ${active?col:"transparent"}`,
    color:active?col:darkMode?"#94a3b8":"#475569",
    fontWeight:active?700:500, cursor:"pointer", fontSize:navTiny?11:navCompact?11.5:12,
    textTransform:"uppercase", letterSpacing:navTiny?0:navCompact?.2:navTight?.4:.8,
    fontFamily:font, transition:"color .2s",
    // long labels ("Risk Assessments") go onto two lines rather than widening the bar
    maxWidth:navCompact?96:navTight?118:"none", lineHeight:1.25, textAlign:"center",
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════════════════
  // The login screen deliberately ignores the theme (always dark navy) because no user is known yet.
  if (view==="login") return (
    <div style={{minHeight:"100vh",background:"#060d2e",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font,padding:20,position:"relative",overflow:"hidden"}}>
      {/* background grid — always dark navy, never themed */}

      <div style={{position:"absolute",top:"-30%",right:"-10%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,#1a3a9e22,transparent 70%)",pointerEvents:"none"}}/>

      <div style={{background:"linear-gradient(160deg,#152370,#0d1f5c)",borderRadius:isMobile?16:24,padding:isMobile?"28px 20px":"48px 44px",width:"100%",maxWidth:440,boxShadow:"0 30px 80px rgba(0,0,0,.6)",border:"1px solid rgba(255,255,255,0.08)",position:"relative",zIndex:1}}>
        {/* Logo */}
        <div style={{marginBottom:32,paddingBottom:24,borderBottom:"1px solid rgba(255,255,255,0.10)"}}>
          <ZeusProtectLogo/>
        </div>

        <div style={{marginBottom:28}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:600,color:"#94a3b8",letterSpacing:-.3}}>Health & Safety Hub</h3>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={{color:"#94a3b8",fontSize:11,fontWeight:700,letterSpacing:1}}>EMAIL ADDRESS</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@zeus.com"
              style={{width:"100%",marginTop:6,padding:"11px 14px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,color:"#ffffff",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:font}}/>
          </div>
          <div>
            <label style={{color:"#94a3b8",fontSize:11,fontWeight:700,letterSpacing:1}}>PASSWORD</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
              onKeyDown={e=>e.key==="Enter"&&login()}
              style={{width:"100%",marginTop:6,padding:"11px 14px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,color:"#ffffff",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:font}}/>
          </div>
          {err && <p style={{color:"#f87171",fontSize:13,margin:0}}>{err}</p>}
          <button onClick={login} disabled={signingIn} style={{opacity:signingIn?0.7:1,marginTop:4,background:"linear-gradient(135deg,#2563eb,#152370)",color:"#ffffff",border:"none",borderRadius:10,padding:"13px",fontWeight:800,fontSize:15,cursor:"pointer",letterSpacing:.5,fontFamily:font,boxShadow:"0 4px 20px rgba(37,99,235,.4)"}}>
            {signingIn ? "Signing in…" : "Sign In →"}
          </button>
        </div>

        <div style={{marginTop:28,padding:16,background:"rgba(255,255,255,0.04)",borderRadius:12,fontSize:12}}>
          <strong style={{color:"#94a3b8",letterSpacing:.5,fontSize:11}}>NEED HELP?</strong>
          <div style={{marginTop:6,color:"#94a3b8",fontSize:11,lineHeight:1.6}}>Contact your Health &amp; Safety Manager or IT administrator if you have forgotten your password or cannot access your account.</div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}`}</style>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // MOBILE PWA
  // ══════════════════════════════════════════════════════════════════════════
  // isPhone = window ≤700px wide. `forceDesktop` is set by "Use the full portal" in the mobile More tab.
  // Sits above every desktop view so a phone never falls through to the wide
  // layout. MobileApp is a view over the state below — it owns no domain data
  // and never touches Supabase directly, only the handlers passed in as `db`.
  // Temporary password → must choose their own before using the portal (desktop and phone).
  if (user && mustChangePw) return (
    <ForcePasswordChange user={user} onDone={()=>setMustChangePw(false)} onSignOut={logout} Z={T} font={font}/>
  );

  if (isPhone && user && !forceDesktop) {
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
        allModules={allModules}
        assigns={assigns}
        comps={comps}
        docs={docs}
        docAssignments={docAssignments}
        docAcknowledgements={docAcknowledgements}
        dseReports={dseReports}
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

  // ══════════════════════════════════════════════════════════════════════════
  // DSE ASSESSMENT
  // ══════════════════════════════════════════════════════════════════════════
  // Full-screen DSE wizard (domains/dse/DSEAssessment.jsx). Closing it resets the draft answers.
  if (dseActive && view==="staff") {
    return <DSEAssessment
      user={user}
      dseAnswers={dseAnswers} setDseAnswers={setDseAnswers}
      dseComments={dseComments} setDseComments={setDseComments}
      dseSection={dseSection} setDseSection={setDseSection}
      dseSubmitted={dseSubmitted} setDseSubmitted={setDseSubmitted}
      dseReports={dseReports} setDseReports={setDseReports}
      adminResponses={adminResponses}
      darkMode={darkMode}
      onClose={()=>{ setDseActive(false); setDseAnswers({}); setDseComments({}); setDseSection(0); setDseSubmitted(false); }}
      onSaveProgress={saveDseProgress}
      Z={T} font={font}
    />;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE PLAYER
  // ══════════════════════════════════════════════════════════════════════════
  // Full-screen module player. Step numbering:
  //   0 = intro card, 1..totalSlides = content slides, quizStep (= totalSlides+1) = quiz.
  // Slides may contain: heading, images[] (or legacy single `image`), video, text
  // (plain text or sanitised HTML), and hotspots (click-the-hazard activity).
  // Hotspot slides block "Next" until HotspotActivity reports completion.
  if (mod && view==="staff") {
    const isIntro = step===0;
    const isQuiz  = step===quizStep;
    const slide   = (!isIntro && !isQuiz) ? mod.content[step-1] : null;
    // A slide imported from PowerPoint (images[0].deck, see slideImport.js) is shown large:
    // wider column, less padding, a small heading (the title is in the picture) and the
    // picture sized to fit the screen height. Hotspot slides keep the normal layout.
    const isDeck  = !!(slide && (slide.images||[])[0] && slide.images[0].deck && !(slide.hotspots&&slide.hotspots.length>0));

    let qScore=0, qPct=0, passed=false;
    if (qsub) {
      mod.quiz.forEach((q,i)=>{ if(qans[i]===q.answer) qScore++; });
      qPct = Math.round(qScore/mod.quiz.length*100);
      passed = qPct>=passMarkOf(mod);
    }

    return (
      <>
      {/* Certificate from "View Certificate" after a pass — this screen must render it
          itself, because the staff views (which also show it) aren't on screen here. */}
      {cert && <CertificateModal cert={cert} user={user} onClose={() => setCert(null)} T={T} font={font}/>}
      <div style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.white,overflowX:"hidden"}}>

        {/* Celebration Overlay */}
        {showCelebration && (
          <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)"}}>
            {/* Confetti */}
            <style>{`
              @keyframes confettiFall {
                0%   { transform: translateY(-20px) rotate(0deg);   opacity:1; }
                100% { transform: translateY(110vh) rotate(720deg); opacity:0; }
              }
              @keyframes certBounce {
                0%   { transform: scale(0.5) translateY(40px); opacity:0; }
                60%  { transform: scale(1.05) translateY(-8px); opacity:1; }
                100% { transform: scale(1) translateY(0);       opacity:1; }
              }
              @keyframes sealPulse {
                0%,100% { transform: scale(1);    opacity:1; }
                50%      { transform: scale(1.12); opacity:.85; }
              }
              @keyframes shimmer {
                0%   { background-position: -200% center; }
                100% { background-position:  200% center; }
              }
            `}</style>
            {/* NB: Math.random() runs on every render, so confetti re-shuffles if the component re-renders. Purely cosmetic. */}
            {/* Confetti pieces */}
            {Array.from({length:60}).map((_,i)=>{
              const colors=["#f59e0b","#ffffff","#0d1f5c","#2563eb","#10b981","#f97316","#a78bfa"];
              const size=Math.random()*10+4;
              const left=Math.random()*100;
              const delay=Math.random()*2;
              const dur=Math.random()*2+2;
              const color=colors[Math.floor(Math.random()*colors.length)];
              const isRect=Math.random()>0.5;
              return (
                <div key={i} style={{
                  position:"fixed",
                  left:`${left}%`,
                  top:"-20px",
                  width:isRect?size:size/2,
                  height:size,
                  background:color,
                  borderRadius:isRect?2:"50%",
                  animation:`confettiFall ${dur}s ${delay}s ease-in forwards`,
                  zIndex:501,
                  pointerEvents:"none",
                }}/>
              );
            })}

            {/* Certificate card */}
            <div style={{animation:"certBounce .6s .3s cubic-bezier(.34,1.56,.64,1) both",zIndex:502,width:"100%",maxWidth:440,margin:"0 16px"}}>
              <div style={{
                background:"linear-gradient(160deg,#0d1f5c,#091548)",
                borderRadius:20,
                padding:"32px 36px",
                border:"2px solid rgba(245,158,11,0.5)",
                boxShadow:"0 0 0 4px rgba(245,158,11,0.08), 0 40px 80px rgba(0,0,0,0.8)",
                textAlign:"center",
                position:"relative",
                overflow:"hidden",
              }}>
                {/* Shimmer bar */}
                <div style={{
                  position:"absolute",top:0,left:0,right:0,height:4,
                  background:"linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b,#fbbf24)",
                  backgroundSize:"200% auto",
                  animation:"shimmer 2s linear infinite",
                }}/>
                {/* Corner ornaments */}
                {[["top:10px","left:10px"],["top:10px","right:10px"],["bottom:10px","left:10px"],["bottom:10px","right:10px"]].map((pos,ci)=>{
                  const transforms=["none","rotate(90deg)","rotate(-90deg)","rotate(180deg)"];
                  const s={position:"absolute",width:16,height:16,zIndex:1,opacity:.6};
                  pos.forEach(p=>{const[k,v]=p.split(":");s[k]=v;});
                  return (<svg key={ci} style={{...s,transform:transforms[ci]}} viewBox="0 0 16 16"><path d="M0,0 L12,0 L12,2 L2,2 L2,12 L0,12 Z" fill="#f59e0b"/></svg>);
                })}

                <div style={{fontSize:56,marginBottom:8,animation:"sealPulse 1.5s ease-in-out infinite"}}>{mod?.icon||"🏅"}</div>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:"rgba(245,158,11,0.8)",textTransform:"uppercase",marginBottom:4}}>Certificate of Completion</div>
                <div style={{fontSize:26,fontWeight:900,color:"#fff",marginBottom:4,letterSpacing:-.5}}>{user?.name}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:16}}>has successfully completed</div>
                <div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:"12px 20px",marginBottom:20}}>
                  <div style={{fontSize:18,fontWeight:800,color:"#f59e0b"}}>{mod?.title}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginTop:4}}>Score: <span style={{color:"#10b981",fontWeight:700}}>{qPct}%</span></div>
                </div>

                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  <button onClick={()=>{
                    setShowCelebration(false);
                    setCert({module:mod,score:qPct,date:(comps[user.id]||{})[mod.id]?.date||todayISO(),certId:(comps[user.id]||{})[mod.id]?.certId||null});
                  }} style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#0d1f5c",border:"none",borderRadius:10,padding:"10px 22px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:13}}>
                    🎓 View Certificate
                  </button>
                  <button onClick={()=>setShowCelebration(false)}
                    style={{background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"10px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{background:`linear-gradient(90deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",alignItems:"center",gap:16}}>
          <ZeusLogo darkMode={darkMode}/>
          <div style={{width:1,height:28,background:T.headerBgMd,margin:"0 8px"}}/>
          <button onClick={()=>setMod(null)} style={{background:T.headerBgMd,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"6px 14px",color:T.muted,cursor:"pointer",fontWeight:700,fontFamily:font,fontSize:12}}>← Back</button>
          <span style={{fontSize:18}}>{mod.icon}</span>
          <h2 style={{margin:0,fontSize:15,fontWeight:700}}>{mod.title}</h2>
          <div style={{marginLeft:"auto",color:T.muted,fontSize:12,letterSpacing:.5}}>STEP {step} / {quizStep}</div>
        </div>
        {/* Progress strip */}
        <div style={{height:3,background:T.headerBgMd}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${T.accent},${T.accentLt})`,width:`${(step/quizStep)*100}%`,transition:"width .4s"}}/>
        </div>

        <div style={{maxWidth:isDeck?1280:720,margin:"0 auto",padding:isDeck?"20px 24px":"44px 24px"}}>

          {isIntro && (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:72,marginBottom:16}}>{mod.icon}</div>
              <h1 style={{fontSize:32,fontWeight:900,letterSpacing:-1,marginBottom:6}}>{mod.title}</h1>
              <p style={{color:T.muted,fontSize:15,marginBottom:28}}>{mod.category} · {mod.duration} · <span style={{color:mod.level==="Mandatory"?"#f87171":T.accentLt}}>{mod.level}</span> · {totalSlides} slides · {mod.quiz.length} quiz questions</p>
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:28,textAlign:"left",border:`1px solid ${T.border}`}}>
                <p style={{margin:0,color:T.slate,lineHeight:1.8,fontSize:15}}>Read through each slide carefully, then complete the knowledge check. A score of <strong style={{color:T.green}}>{passMarkOf(mod)}% or above</strong> is required to pass and receive your Zeus certificate.</p>
              </div>
              {(()=>{ const p = getProgress(user.id, mod); if (!p) return null; return (
                <div style={{marginTop:28,display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",alignItems:"center"}} data-testid="resume">
                  <button onClick={()=>{setStep(p.step);window.scrollTo({top:0,behavior:"smooth"});}} data-testid="resume-btn"
                    style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:12,padding:"14px 36px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:font,boxShadow:`0 6px 24px ${T.accent}55`}}>
                    {resumeLabel(p)} →
                  </button>
                  <button onClick={()=>{clearProgress(user.id, mod);setStep(1);window.scrollTo({top:0,behavior:"smooth"});}} data-testid="restart-btn"
                    style={{background:"transparent",color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:12,padding:"13px 24px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:font}}>
                    Start from the beginning
                  </button>
                  <div style={{width:"100%",fontSize:12,color:T.muted}}>You got to {p.quiz?"the quiz":`slide ${p.step} of ${p.of}`} last time ({new Date(p.at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}).</div>
                </div>); })()}
              {!getProgress(user.id, mod) && <button onClick={()=>{setStep(1);window.scrollTo({top:0,behavior:"smooth"});}} style={{marginTop:32,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:12,padding:"14px 44px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:font,boxShadow:`0 6px 24px ${T.accent}55`,letterSpacing:.5}}>
                Begin Module →
              </button>}
            </div>
          )}

          {slide && (
            <div>
              <div data-testid="slide-card" data-deck={isDeck?"1":undefined} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:20,padding:isDeck?"16px 20px 20px":40,border:`1px solid ${T.border}`,boxShadow:"0 8px 40px rgba(0,0,0,.4)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isDeck?10:20}}>
                  <div style={{color:T.muted,fontSize:11,fontWeight:800,letterSpacing:2}}>SLIDE {step} OF {totalSlides}</div>
                  <div style={{display:"flex",gap:4}}>
                    {Array.from({length:totalSlides}).map((_,i)=>(
                      <div key={i} style={{width:i===step-1?20:6,height:6,borderRadius:99,background:i===step-1?T.accentLt:T.borderMd,transition:"width .3s"}}/>
                    ))}
                  </div>
                </div>
                {slide.heading && (
                  <h2 style={isDeck
                    ? {fontSize:15,fontWeight:800,color:T.muted,margin:"0 0 10px",letterSpacing:-.2}
                    : {fontSize:22,fontWeight:900,color:T.white,margin:"0 0 18px",letterSpacing:-.5,paddingBottom:14,borderBottom:`1px solid ${T.borderMd}`}}>
                    {slide.heading}
                  </h2>
                )}
                {((slide.images||[]).length>0 || slide.image?.data || slide.image?.url) && !(slide.hotspots&&slide.hotspots.length>0) && (
                  <div style={{marginBottom:20,display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center"}}>
                    {/* new images[] array */}
                    {/* deck: a whole PowerPoint slide imported from a PDF — shown full width */}
                    {(slide.images||[]).map((img,ii)=>(
                      <img key={ii} src={img.url||img.data} alt={img.deck ? (slide.heading||"Slide") : (img.name||"")} onClick={()=>{setLightboxSrc(img.url||img.data);setLightboxZoomed(false);}}
                        style={img.deck
                          ? {maxWidth:"100%",maxHeight:"max(260px, calc(100vh - 250px))",width:"auto",height:"auto",borderRadius:10,border:`1px solid ${T.borderMd}`,cursor:"zoom-in",background:"#fff",display:"block"}
                          : {maxWidth:"100%",flex:"1 1 220px",maxHeight:360,borderRadius:12,border:`1px solid ${T.borderMd}`,objectFit:"contain",cursor:"zoom-in"}}/>
                    ))}
                    {/* backwards compat: old single image field */}
                    {(slide.images||[]).length===0 && (slide.image?.data||slide.image?.url) && (
                      <img src={slide.image.data||slide.image.url} alt={slide.image.name||""} onClick={()=>{setLightboxSrc(slide.image.data||slide.image.url);setLightboxZoomed(false);}}
                        style={{maxWidth:"100%",maxHeight:360,borderRadius:12,border:`1px solid ${T.borderMd}`,objectFit:"contain",cursor:"zoom-in"}}/>
                    )}
                  </div>
                )}
                {/* uploaded file, or a YouTube / Vimeo / Stream link (shared/SlideVideo.jsx) */}
                {slide.video && <SlideVideo video={slide.video} Z={T} style={{marginBottom:20}}/>}
                {/* Rich (HTML) text is ALWAYS passed through sanitizeHtml before rendering. Plain text is split on ". " and lines like "Step 2: ..." become numbered badges. */}
                {slide.text && (
                  isHtmlContent(slide.text) ? (
                    <div className="rte-content" style={{fontSize:15,lineHeight:1.9,color:T.slate}} dangerouslySetInnerHTML={{__html: sanitizeHtml(slide.text)}}/>
                  ) : (
                    <div style={{fontSize:15,lineHeight:1.9,color:T.slate}}>
                      {slide.text.split(". ").map((sentence,i,arr)=>{
                        const trimmed = sentence.trim();
                        const stepMatch = trimmed.match(/^(Step\s)?(\d+)[.:\)]\s*(.*)/);
                        if (stepMatch) return (
                          <div key={i} style={{display:"flex",gap:12,marginBottom:10,alignItems:"flex-start"}}>
                            <span style={{background:T.accent,color:"#fff",borderRadius:6,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,flexShrink:0,marginTop:1}}>{stepMatch[2]}</span>
                            <span>{stepMatch[3]}</span>
                          </div>
                        );
                        const full = sentence + (i<arr.length-1?". ":"");
                        return <p key={i} style={{margin:"0 0 10px"}}>{full}</p>;
                      })}
                    </div>
                  )
                )}
                {slide.hotspots && slide.hotspots.length>0 && (
                  <HotspotActivity
                    imageUrl={(slide.images&&slide.images[0]&&(slide.images[0].url||slide.images[0].data))||slide.image?.url||slide.image?.data}
                    instructions={slide.hotspotInstructions||"Click every hazard you can find in the image above."}
                    hotspots={slide.hotspots}
                    passThreshold={1}
                    onStatusChange={complete=>setHotspotComplete(prev=>prev[step]===complete?prev:{...prev,[step]:complete})}
                    Z={T} font={font}
                  />
                )}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:24,gap:12}}>
                <button onClick={()=>{setStep(s=>s-1);window.scrollTo({top:0,behavior:"smooth"});}} disabled={step===1}
                  style={{background:T.headerBgMd,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 28px",color:T.muted,cursor:"pointer",fontWeight:700,fontFamily:font,opacity:step===1?.4:1}}>← Previous</button>
                <button onClick={()=>{setStep(s=>s+1);window.scrollTo({top:0,behavior:"smooth"});}}
                  disabled={slide.hotspots&&slide.hotspots.length>0&&!hotspotComplete[step]}
                  style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,border:"none",borderRadius:10,padding:"10px 28px",color:T.white,cursor:"pointer",fontWeight:800,fontFamily:font,boxShadow:`0 4px 16px ${T.accent}44`,opacity:(slide.hotspots&&slide.hotspots.length>0&&!hotspotComplete[step])?.4:1}}>
                  {step===totalSlides?"Take Quiz →":"Next Slide →"}
                </button>
              </div>
            </div>
          )}

          {isQuiz && !qsub && (
            <div>
              <h2 style={{fontSize:24,fontWeight:900,marginBottom:4,letterSpacing:-.5}}>Knowledge Check</h2>
              <p style={{color:T.muted,marginBottom:28,fontSize:14}}>{mod.quiz.length} questions · {passMarkOf(mod)}% needed to pass</p>
              {mod.quiz.map((q,qi)=>(
                <div key={qi} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:14,border:`1px solid ${T.border}`}}>
                  <p style={{fontWeight:700,marginBottom:16,fontSize:15}}><span style={{color:T.accentLt}}>Q{qi+1}.</span> {q.q}</p>
                  {q.options.map((opt,oi)=>(
                    <div key={oi} onClick={()=>setQans(a=>({...a,[qi]:oi}))}
                      style={{padding:"11px 16px",borderRadius:10,marginBottom:8,cursor:"pointer",border:`2px solid ${qans[qi]===oi?T.accent:T.border}`,background:qans[qi]===oi?`rgba(37,99,235,0.2)`:"transparent",transition:"all .2s",fontWeight:qans[qi]===oi?700:400,fontSize:14}}>
                      {opt}
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={submitQuiz} disabled={Object.keys(qans).length<mod.quiz.length}
                style={{width:"100%",marginTop:8,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:12,padding:"14px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:font,opacity:Object.keys(qans).length<mod.quiz.length?.45:1,boxShadow:`0 4px 20px ${T.accent}44`}}>
                Submit Quiz
              </button>
            </div>
          )}

          {isQuiz && qsub && (
            <div>
              <div style={{textAlign:"center",marginBottom:32}}>
                <div style={{fontSize:72,marginBottom:16}}>{passed?"🏆":"📖"}</div>
                <h2 style={{fontSize:36,fontWeight:900,color:passed?T.green:T.amber,letterSpacing:-1}}>{passed?"Passed!":"Not Quite"}</h2>
                <div style={{fontSize:60,fontWeight:900,color:T.white,margin:"8px 0",fontFamily:"'Barlow Condensed',sans-serif"}}>{qPct}%</div>
                <p style={{color:T.muted}}>{qScore} of {mod.quiz.length} correct</p>
                {!passed && <p style={{color:T.amber,marginTop:6}}>You need {passMarkOf(mod)}% to pass. Review the slides and try again.</p>}
                <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:28,flexWrap:"wrap"}}>
                  {passed && (
                    <button onClick={()=>setCert({module:mod,score:qPct,date:(comps[user.id]||{})[mod.id]?.date||todayISO(),certId:(comps[user.id]||{})[mod.id]?.certId||null})}
                      style={{background:`linear-gradient(135deg,${T.gold},#d97706)`,color:T.navyDk,border:"none",borderRadius:12,padding:"12px 28px",fontWeight:800,cursor:"pointer",fontFamily:font}}>
                      🎓 View Certificate
                    </button>
                  )}
                  {!passed && (
                    <button onClick={()=>{setStep(1);setQans({});setQsub(false);window.scrollTo({top:0,behavior:"smooth"});}}
                      style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:12,padding:"12px 28px",fontWeight:800,cursor:"pointer",fontFamily:font}}>
                      Retake Module
                    </button>
                  )}
                  <button onClick={()=>setMod(null)} style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:12,padding:"12px 28px",fontWeight:700,cursor:"pointer",fontFamily:font}}>
                    Back to Dashboard
                  </button>
                </div>
              </div>
              {/* Answer review */}
              <div>
                <h3 style={{fontSize:14,fontWeight:800,letterSpacing:.5,color:T.muted,textTransform:"uppercase",marginBottom:16}}>Answer Review</h3>
                {mod.quiz.map((q,qi)=>{
                  const chosen = qans[qi];
                  const correct = q.answer;
                  const isRight = chosen === correct;
                  return (
                    <div key={qi} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:20,marginBottom:12,border:`1px solid ${isRight?"rgba(16,185,129,0.35)":"rgba(239,68,68,0.35)"}`}}>
                      <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:14}}>
                        <div style={{width:24,height:24,borderRadius:99,background:isRight?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)",border:`1px solid ${isRight?T.green:"#ef4444"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:1}}>{isRight?"✓":"✗"}</div>
                        <p style={{margin:0,fontWeight:700,fontSize:14,color:T.white,lineHeight:1.5}}>{q.q}</p>
                      </div>
                      <div style={{display:"grid",gap:6,marginBottom:12}}>
                        {q.options.map((opt,oi)=>{
                          const isCorrect = oi===correct;
                          const isChosen = oi===chosen;
                          let bg = "transparent"; let border = T.border; let col = T.muted;
                          if (isCorrect) { bg="rgba(16,185,129,0.15)"; border="rgba(16,185,129,0.5)"; col=T.green; }
                          else if (isChosen && !isCorrect) { bg="rgba(239,68,68,0.12)"; border="rgba(239,68,68,0.4)"; col="#f87171"; }
                          return (
                            <div key={oi} style={{padding:"9px 14px",borderRadius:10,background:bg,border:`1px solid ${border}`,fontSize:13,color:col,fontWeight:isCorrect||isChosen?700:400,display:"flex",alignItems:"center",gap:8}}>
                              {isCorrect && <span>✓</span>}{isChosen&&!isCorrect && <span>✗</span>}
                              {opt}
                              {isCorrect && <span style={{marginLeft:"auto",fontSize:11,color:T.green,fontWeight:700}}>Correct answer</span>}
                            </div>
                          );
                        })}
                      </div>
                      {!isRight && (
                        <div style={{padding:"10px 14px",background:"rgba(37,99,235,0.1)",borderRadius:10,border:"1px solid rgba(37,99,235,0.25)",fontSize:12,color:T.accentLt,lineHeight:1.6}}>
                          💡 <strong>Explanation:</strong> The correct answer is <em>"{q.options[correct]}"</em>. Review the relevant slide for more detail.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Click the backdrop to close; click the image to toggle 1:1 zoom (scrollable). */}
      {/* Lightbox overlay */}
      {lightboxSrc && (
        <div
          onClick={()=>{setLightboxSrc(null);setLightboxZoomed(false);}}
          onKeyDown={e=>e.key==="Escape"&&(setLightboxSrc(null),setLightboxZoomed(false))}
          tabIndex={-1}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:lightboxZoomed?0:20,cursor:lightboxZoomed?"zoom-out":"default",overflow:lightboxZoomed?"auto":"hidden"}}
        >
          <button
            onClick={e=>{e.stopPropagation();setLightboxSrc(null);setLightboxZoomed(false);}}
            style={{position:"fixed",top:18,right:22,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:99,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,cursor:"pointer",fontWeight:700,lineHeight:1,zIndex:2001}}
          >✕</button>
          {!lightboxZoomed && (
            <div style={{position:"fixed",bottom:22,left:0,right:0,textAlign:"center",color:"rgba(255,255,255,0.55)",fontSize:12,fontWeight:600,pointerEvents:"none"}}>
              Click image to zoom in
            </div>
          )}
          <img
            src={lightboxSrc}
            alt=""
            onClick={e=>{e.stopPropagation();setLightboxZoomed(z=>!z);}}
            style={lightboxZoomed
              ? {width:"auto",height:"auto",maxWidth:"none",maxHeight:"none",borderRadius:0,cursor:"zoom-out",display:"block"}
              : {maxWidth:"100%",maxHeight:"90vh",borderRadius:10,boxShadow:"0 24px 80px rgba(0,0,0,0.8)",objectFit:"contain",cursor:"zoom-in"}}
          />
        </div>
      )}
      </>
    );
  }
  // Certificate viewer / print: domains/training/CertificateModal.jsx. Shown whenever
  // `cert` is set — in the staff views AND in the module player (see below).
  const CertModal = () => cert ? <CertificateModal cert={cert} user={user} onClose={() => setCert(null)} T={T} font={font}/> : null;

  // ══════════════════════════════════════════════════════════════════════════
  // STAFF PORTAL
  // ══════════════════════════════════════════════════════════════════════════
  // Everything computed here is derived from state on each render (no extra state).
  // `stab` selects the tab. Admins can also reach this view via "My Training".
  if (view==="staff" && user) {
    const myIds = assigns[String(user.id)]||[];
    const myMods = allModules.filter(m=>myIds.includes(m.id));
    const myC = comps[user.id]||{};
    const done = myMods.filter(m=>myC[m.id]);
    const pct = myMods.length ? Math.round(done.length/myMods.length*100) : 0;

    // ── Training breakdown ──────────────────────────────────────────────────
    const notStarted  = myMods.filter(m=>!myC[m.id]);
    const completed   = myMods.filter(m=>myC[m.id]);
    const expired     = completed.filter(m=>{ if(!m.renewalMonths) return false; const ex=getExpiryStatus(myC[m.id].date,m.renewalMonths); return ex?.status==="expired"; });
    const expiring    = completed.filter(m=>{ if(!m.renewalMonths) return false; const ex=getExpiryStatus(myC[m.id].date,m.renewalMonths); return ex?.status==="expiring"; });
    const upToDate    = completed.filter(m=>{ if(!m.renewalMonths) return true; const ex=getExpiryStatus(myC[m.id].date,m.renewalMonths); return !ex||ex.status==="valid"; });
    // Due dates (lib/dueDates.js): overdue and due-within-a-week, for modules not passed yet
    const myDue = m => dueInfo(dueDates, user.id, m.id, isPassed(myC[m.id]));
    const pastDue = myMods.filter(m => (myDue(m)||{}).overdue);
    const dueSoon = myMods.filter(m => { const d = myDue(m); return d && !d.overdue && d.soon; });
    // Modules needing attention (not started + expired)
    const actionNeeded = [...notStarted, ...expired];
    // Next up = the not-started module due soonest (then any not started), else the soonest expiring
    const byDue = (a, b) => ((myDue(a)||{}).due || "9999").localeCompare((myDue(b)||{}).due || "9999");
    const nextUp = notStarted.length ? [...notStarted].sort(byDue)[0] : expiring.length ? expiring[0] : null;

    // ── DSE tracking ────────────────────────────────────────────────────────
    const myDseReports   = dseReports[user.id]||[];
    const lastDseReport  = myDseReports[myDseReports.length-1];
    const lastDseRi      = myDseReports.length-1;
    const myAdminResps   = adminResponses[user.id]||{};
    const dseCompleted   = !!lastDseReport;
    // DSE renewal — recommended annually (data/seedDse.js)
    const dseExpiryStatus = dseCompleted ? getExpiryStatus(lastDseReport.date, DSE_RENEWAL_MONTHS) : null;
    const dseExpired  = dseExpiryStatus?.status==="expired";
    const dseExpiring = dseExpiryStatus?.status==="expiring";
    const dseIssueCount   = lastDseReport?.issueCount||0;
    const dseResolvedCount = lastDseReport ? lastDseReport.issues.filter((_,ii)=>myAdminResps[`${lastDseRi}_${ii}`]?.resolved).length : 0;
    const dseNeedsAction  = !dseCompleted || dseExpired;
    // External certs
    const myExtCerts = extCerts[user.id]||{};
    const myCertTypes = EXT_CERT_TYPES.filter(ct=>myExtCerts[ct.id]);
    const expiredCerts  = myCertTypes.filter(ct=>{ const c=myExtCerts[ct.id]; return c.expiryDate && new Date(c.expiryDate)<new Date(); });
    const expiringCerts = myCertTypes.filter(ct=>{ const c=myExtCerts[ct.id]; if(!c.expiryDate) return false; const d=Math.ceil((new Date(c.expiryDate)-new Date())/86400000); return d>=0&&d<=EXPIRY_WARNING_DAYS; });
    // Documents needing acknowledgement
    const myDocAssigns = Object.entries(docAssignments||{}).filter(([,uids])=>uids.includes(String(user.id))).map(([did])=>did);
    const unreadDocs = myDocAssigns.filter(did=>!(docAcknowledgements[String(user.id)]||{})[did]);
    // Quick hazard reports this user still has to complete in the full form
    const myQuickToComplete = myIncompleteQuickReports(incidents, user.id);
    const openQuickReport = (inc) => { setStab("incidents"); setQuickEditId(inc.id); };
    // Compliance % = good items / all items (assigned modules + uploaded ext. certs + 1 for DSE).
    // Bands: 100% green, ≥70% amber, otherwise red.
    // Overall health score — includes DSE as one item
    const totalItems = myMods.length + myCertTypes.length + 1; // +1 for DSE
    const goodItems  = upToDate.length + myCertTypes.filter(ct=>!expiredCerts.find(e=>e.id===ct.id)&&!expiringCerts.find(e=>e.id===ct.id)).length + (dseCompleted&&!dseExpired?1:0);
    const healthPct  = totalItems ? Math.round(goodItems/totalItems*100) : 100;
    const healthColor = healthPct===100?"#10b981":healthPct>=70?"#f59e0b":"#ef4444";
    const healthLabel = healthPct===100?"Fully Compliant":healthPct>=70?"Mostly Compliant":"Needs Attention";
    const totalActionNeeded = actionNeeded.length + (dseNeedsAction?1:0);

    // Staff menu bar widths: the tabs must never be hidden behind the bell. Wider than
    // 1700px everything is shown in full; narrower, the search shrinks to 🔍; below 1400
    // the first name goes, the labels drop "My" and the tabs tighten up. At 1024px and
    // below the ☰ menu takes over (CSS below).
    const sTight = winW < 1700, sTiny = winW < 1400;
    const STAFF_TAB_LABEL = {dashboard:"Dashboard",training:"My Training",history:"History",documents:"Documents",incidents:"Report Incident",dse:"My DSE",machinery:"My Machinery",mequip:"Machinery & Equipment",actions:"My Actions",team:"My Team"};
    const STAFF_TAB_SHORT = {dashboard:"Dashboard",training:"Training",history:"History",documents:"Documents",incidents:"Report",dse:"DSE",machinery:"Machinery",mequip:"Equipment",actions:"Actions",team:"Team"};
    return (
      <EmojiCtx.Provider value={emojiMode}>
      <div style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.white}}>
        <CertModal/>
        <PreviewModal doc={previewDoc} onClose={()=>setPreviewDoc(null)} Z={T} font={font}/>
        {/* ▲/▼ top-of-page / bottom-of-page buttons on long screens (shared/ScrollNav.jsx) */}
        <ScrollNav bottom={isMobile && stab!=="dashboard" ? 92 : 24} Z={T} font={font}/>
        {/* Nav */}
        <div style={{background:`linear-gradient(90deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:sTiny?"0 14px":"0 24px",display:"flex",alignItems:"center",position:"relative"}}>
          <div style={{marginRight:sTiny?10:20,padding:"10px 0",flexShrink:0}}><ZeusLogo darkMode={darkMode}/></div>
          <div style={{display:"flex",alignItems:"center",gap:sTiny?0:2,flex:1,minWidth:0,overflowX:"auto"}} className="staff-nav-tabs" data-testid="staff-tabs">
            {["dashboard","training","history","documents","incidents","dse",...(isWarehouseWorker(user)?["machinery"]:[]),"actions",...(user.role==="manager"?["team"]:[]),...(user.role!=="admin"&&hasMachineryAccess(user)?["mequip"]:[])].map(t=>(
              <button key={t} onClick={()=>setStab(t)} title={STAFF_TAB_LABEL[t]}
                style={{background:"none",border:"none",borderBottom:stab===t?`2px solid ${T.accent}`:"2px solid transparent",color:stab===t?T.white:T.muted,fontWeight:stab===t?700:400,fontSize:13,cursor:"pointer",padding:sTiny?"14px 8px 12px":sTight?"14px 10px 12px":"14px 14px 12px",fontFamily:font,whiteSpace:"nowrap",letterSpacing:.3,transition:"color .15s"}}>
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
              const notifications = [];
              // Quick hazard reports awaiting the full form (urgent once overdue)
              myIncompleteQuickReports(incidents, user.id).forEach(inc=>notifications.push({type:"report",urgent:isQuickReportOverdue(inc),title:`Finish your hazard report — ${inc.location}`,detail:`Add the full incident details · ${quickReportDueLabel(inc)}`,nav:{tab:"incidents",editId:inc.id}}));
              const myIds = assigns[user.id]||[];
              const myC   = comps[user.id]||{};
              // Incomplete modules
              const pending = allModules.filter(m=>myIds.includes(m.id)&&!myC[m.id]);
              pending.forEach(m=>{ const d=dueInfo(dueDates,user.id,m.id,false);
                notifications.push({type:"module",urgent:m.level==="Mandatory"||!!(d&&(d.overdue||d.soon)),title:`Complete: ${m.title}`,detail:d?`${dueText(d)}${m.level==="Mandatory"?" · Mandatory":""}`:m.level==="Mandatory"?"Mandatory module — action required":m.duration,nav:{tab:"training"}}); });
              // My machinery competences needing renewal (warehouse roles)
              if (isWarehouseWorker(user)) compsFor(machineComps, user.id).forEach(c=>{
                const st = machineState(c, allMachineTypes); const t = allMachineTypes.find(x=>x.id===c.machineId);
                if (!t || !st || (st.key!=="expired" && st.key!=="expiring")) return;
                notifications.push({type:"module",urgent:st.key==="expired",title:`${st.key==="expired"?"Renewal required":"Renew soon"}: ${t.label}`,detail:st.ex?`${st.key==="expired"?"Expired":"Renew by"} ${st.ex.expiryDate.split("-").reverse().join("/")} (${st.ex.why}). Speak to your manager to book a reassessment.`:"Speak to your manager to book a reassessment.",nav:{tab:"machinery"}});
              });
              // Expired or expiring modules
              allModules.filter(m=>myIds.includes(m.id)&&myC[m.id]&&m.renewalMonths).forEach(m=>{
                const ex = getExpiryStatus(myC[m.id].date, m.renewalMonths);
                if (ex && ex.status==="expired") notifications.push({type:"module",urgent:true,title:`Renewal required: ${m.title}`,detail:`Certificate expired ${Math.abs(ex.daysLeft)} days ago — retake now`,nav:{tab:"training"}});
                else if (ex && ex.status==="expiring") notifications.push({type:"module",urgent:false,title:`Expiring soon: ${m.title}`,detail:ex.label+" · Renews every "+m.renewalLabel,nav:{tab:"training"}});
              });
              // Unread documents
              docs.filter(d=>(docAssignments[String(d.id)]||[]).includes(String(user.id))&&!(docAcknowledgements[user.id]||{})[d.id])
                .forEach(d=>notifications.push({type:"document",urgent:true,title:`Read & confirm: ${d.title}`,detail:"Required reading — confirmation pending",nav:{tab:"documents"}}));
              // DSE not completed
              if(dseDraft) notifications.push({type:"dse",urgent:false,title:"Finish your DSE workstation assessment",detail:`In progress — ${Object.keys(dseDraft.answers||{}).length} of ${DSE_QUESTION_COUNT} questions answered`,nav:{tab:"dse"}});
              else if(!(dseReports[user.id]||[]).length) notifications.push({type:"dse",urgent:false,title:"Complete your DSE workstation assessment",detail:"DSE Regulations 1992 — required for all screen users",nav:{tab:"dse"}});
              // Open DSE issues with no admin response
              const latestDse=(dseReports[user.id]||[])[( dseReports[user.id]||[]).length-1];
              if(latestDse){
                const ri = (dseReports[user.id]||[]).length - 1;
                const openIssues=latestDse.issues.filter((_,ii)=>!(adminResponses[user.id]||{})[`${ri}_${ii}`]?.resolved&&latestDse.issueCount>0);
                if(openIssues.length) notifications.push({type:"dse",urgent:false,title:`${openIssues.length} open DSE issue${openIssues.length!==1?"s":""}`,detail:"Check My DSE for H&S team responses",nav:{tab:"dse"}});
              }
              // NB: action owners are matched by NAME (lib/openActions sameName: ignoring case and extra spaces), not id — renaming a user orphans their actions.
              // Investigation corrective actions assigned to this user
              const myActions = Object.values(investigations).flatMap(inv=>
                (inv.actions||[]).filter(a=>sameName(a.owner,user.name)&&a.status!=="complete"&&a.status!=="closed")
              );
              const overdueActions = myActions.filter(a=>a.dueDate&&a.dueDate<todayISO());
              // Line managers: team items waiting for their sign-off
              if (user.role==="manager") {
                const team = teamOf(user, allUsers);
                const teamNames = new Set(team.map(u=>String(u.name).trim().toLowerCase()));
                const dseOpen = team.reduce((n,u)=>{ const reps=dseReports[u.id]||dseReports[String(u.id)]||[]; const ri=reps.length-1; if(ri<0) return n;
                  const resp=adminResponses[u.id]||adminResponses[String(u.id)]||{}; return n+(reps[ri].issues||[]).filter((_,ii)=>!(resp[`${ri}_${ii}`]||{}).resolved).length; },0);
                const actsToSign = Object.values(investigations).flatMap(inv=>(inv.actions||[]).filter(a=>teamNames.has(String(a.owner||"").trim().toLowerCase())&&(a.status==="complete"||a.status==="closed")&&!a.managerSignOff)).length;
                if (dseOpen) notifications.push({type:"dse",urgent:false,title:`${dseOpen} team DSE issue${dseOpen!==1?"s":""} to sign off`,detail:"Open My Team to review and sign off",nav:{tab:"team"}});
                if (actsToSign) notifications.push({type:"report",urgent:false,title:`${actsToSign} completed team action${actsToSign!==1?"s":""} awaiting your sign-off`,detail:"Open My Team to sign them off",nav:{tab:"team"}});
              }
              if(overdueActions.length) notifications.push({type:"report",urgent:true,title:`${overdueActions.length} overdue corrective action${overdueActions.length!==1?"s":""}`,detail:"Investigation actions past due date — action required",nav:{tab:"actions"}});
              else if(myActions.length) notifications.push({type:"report",urgent:false,title:`${myActions.length} open corrective action${myActions.length!==1?"s":""}`,detail:`You have been assigned action${myActions.length!==1?"s":""} from an investigation`,nav:{tab:"actions"}});
              return <NotificationBell notifications={notifications} onNavigate={n=>{ setStab(n.tab); if(n.editId) setQuickEditId(n.editId); }} Z={T} font={font}/>;
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
            <button onClick={logout} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,fontFamily:font,whiteSpace:"nowrap"}}>Sign Out</button>
          </div>
        </div>


      {/* Mobile nav drawer */}
        {mobileMenuOpen && (
          <div className="mobile-nav-drawer" style={{position:"relative"}}>
            {["dashboard","training","history","documents","incidents","dse",...(isWarehouseWorker(user)?["machinery"]:[]),"actions",...(user.role==="manager"?["team"]:[]),...(user.role!=="admin"&&hasMachineryAccess(user)?["mequip"]:[])].map(t=>(
              <button key={t} onClick={()=>{setStab(t);setMobileMenuOpen(false);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"12px 24px",background:stab===t?"rgba(37,99,235,0.15)":"transparent",border:"none",borderBottom:`1px solid rgba(255,255,255,0.05)`,color:stab===t?T.white:T.muted,fontWeight:stab===t?700:400,fontSize:14,cursor:"pointer",fontFamily:font}}>
                {{dashboard:E("🏠 ","")+"Dashboard",training:E("📚 ","")+"My Training",history:E("📋 ","")+"History",documents:E("📄 ","")+"Documents",incidents:E("🚨 ","")+"Report Incident",dse:"🖥️ My DSE",machinery:"⚙️ My Machinery",mequip:"🛠 Machinery & Equipment",actions:"✅ My Actions",team:E("👥 ","")+"My Team"}[t]}
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

          {stab==="dashboard" && (
            <div>
              {/* Header */}
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:4}}>
                <h1 style={{fontSize:26,fontWeight:900,letterSpacing:-.5,margin:0}}>Welcome back, {user.name.split(" ")[0]} <HelpTip dark={true} text="Your personal H&S summary. The tiles show outstanding training, documents awaiting your confirmation, and any open actions assigned to you. Overdue items are highlighted — complete them to keep your record up to date."/></h1>
                <button onClick={()=>setShowQuickReport(true)}
                  style={{display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",cursor:"pointer",fontFamily:font,fontWeight:800,fontSize:13,boxShadow:"0 4px 16px rgba(245,158,11,0.4)",flexShrink:0,whiteSpace:"nowrap"}}>
                  ⚠ Report a Hazard
                </button>
              </div>
              <p style={{color:T.muted,margin:"0 0 24px",fontSize:13}}>{user.jobTitle||""}{user.jobTitle?" · ":""}{user.email}</p>

              {/* Health score banner */}
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:"18px 24px",marginBottom:20,border:`1px solid ${healthColor}44`,display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
                <div style={{width:56,height:56,borderRadius:"50%",background:`${healthColor}18`,border:`3px solid ${healthColor}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:22,fontWeight:900,color:healthColor}}>{healthPct}%</span>
                </div>
                <div style={{flex:1,minWidth:120}}>
                  <div style={{fontWeight:800,fontSize:16,color:healthColor,marginBottom:2}}>{healthLabel}</div>
                  <div style={{fontSize:12,color:T.muted}}>Your overall H&S training compliance score</div>
                  <div style={{marginTop:8,height:6,background:T.overlay,borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${healthPct}%`,background:`linear-gradient(90deg,${healthColor},${healthColor}aa)`,borderRadius:99,transition:"width .6s"}}/>
                  </div>
                </div>
                {totalActionNeeded>0 && (
                  <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"8px 16px",textAlign:"center",flexShrink:0}}>
                    <div style={{fontSize:22,fontWeight:900,color:"#f87171"}}>{totalActionNeeded}</div>
                    <div style={{fontSize:11,color:"#f87171",fontWeight:700}}>Need Attention</div>
                  </div>
                )}
              </div>

              {/* Stat tiles */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:24}}>
                {[
                  { label:"Assigned",   value:myMods.length,          color:T.accentLt,    sub:"modules total", go:"training" },
                  { label:"Up to Date", value:upToDate.length,         color:"#10b981",     sub:"completed & valid", go:"history" },
                  { label:"Not Started",value:notStarted.length,       color:pastDue.length>0?"#ef4444":notStarted.length>0?"#f59e0b":"#10b981", sub:pastDue.length?`${pastDue.length} past due date`:"awaiting completion", go:"training" },
                  { label:"Expired",    value:expired.length,          color:expired.length>0?"#ef4444":"#10b981",    sub:"need renewal", go:"training" },
                  { label:"Expiring",   value:expiring.length,         color:expiring.length>0?"#f59e0b":"#10b981",   sub:`within ${EXPIRY_WARNING_DAYS} days`, go:"training" },
                  { label:"Documents",  value:unreadDocs.length,       color:unreadDocs.length>0?"#f59e0b":"#10b981", sub:"need acknowledgement", go:"documents" },
                ].map((s,i)=>(
                  // each figure opens the page behind it (click, or Tab + Enter)
                  <div key={i} role="button" tabIndex={0} data-testid="dash-figure" onClick={()=>setStab(s.go)} onKeyDown={e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); setStab(s.go); } }}
                    aria-label={`${s.label}: ${s.value} ${s.sub}. Open ${s.go==="history"?"History":s.go==="documents"?"Documents":"My Training"}.`} title={`Open ${s.go==="history"?"History":s.go==="documents"?"Documents":"My Training"}`}
                    style={{background:T.overlay,borderRadius:12,padding:"14px 16px",cursor:"pointer",border:`1px solid ${s.value>0&&s.color!=="#10b981"?s.color+"44":T.borderMd}`}}>
                    <div style={{fontSize:22,fontWeight:900,color:s.color,lineHeight:1,marginBottom:3}}>{s.value}</div>
                    <div style={{fontSize:12,fontWeight:700,color:T.white}}>{s.label}</div>
                    <div style={{fontSize:10,color:T.muted,marginTop:1}}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Alerts — expired / expiring */}
              {(myQuickToComplete.length>0||pastDue.length>0||dueSoon.length>0||expired.length>0||expiring.length>0||expiredCerts.length>0||expiringCerts.length>0||unreadDocs.length>0||dseNeedsAction||dseExpiring) && (
                <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:14,padding:"16px 20px",marginBottom:20}}>
                  <div style={{fontWeight:800,fontSize:13,color:"#f87171",marginBottom:10}}>⚠ Action Required</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {myQuickToComplete.map(inc=>{ const late=isQuickReportOverdue(inc); const qc=late?T.red:T.amber; return (
                      <div key={inc.id} style={{display:"flex",alignItems:"center",gap:12,background:`${qc}14`,borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>openQuickReport(inc)}>
                        <span style={{fontSize:20}}>⚡</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>Finish your hazard report — {inc.location}</div>
                          <div style={{fontSize:11,color:qc}}>Quick report from {inc.date} needs full details · {quickReportDueLabel(inc)}</div>
                        </div>
                        <button style={{background:qc,border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>Complete →</button>
                      </div>
                    ); })}
                    {!dseCompleted && (
                      <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(139,92,246,0.1)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={openDse}>
                        <span style={{fontSize:20}}>🖥️</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>DSE Workstation Self-Assessment</div>
                          <div style={{fontSize:11,color:"#c4b5fd"}}>{dseDraft?`In progress — ${Object.keys(dseDraft.answers||{}).length} of ${DSE_QUESTION_COUNT} questions answered`:"Required — DSE Regulations 1992 · not yet completed"}</div>
                        </div>
                        <button style={{background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>{dseDraft?"Continue →":"Start →"}</button>
                      </div>
                    )}
                    {dseExpired && (
                      <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={openDse}>
                        <span style={{fontSize:20}}>🖥️</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>DSE Workstation Self-Assessment</div>
                          <div style={{fontSize:11,color:"#f87171"}}>Annual re-assessment due — last completed {lastDseReport.date}{dseDraft?` · in progress, ${Object.keys(dseDraft.answers||{}).length} of ${DSE_QUESTION_COUNT} answered`:""}</div>
                        </div>
                        <button style={{background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>{dseDraft?"Continue →":"Retake →"}</button>
                      </div>
                    )}
                    {dseExpiring && !dseExpired && (
                      <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px"}}>
                        <span style={{fontSize:20}}>🖥️</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>DSE Workstation Self-Assessment</div>
                          <div style={{fontSize:11,color:"#f59e0b"}}>{dseExpiryStatus?.label} — annual re-assessment due soon</div>
                        </div>
                      </div>
                    )}
                    {[...pastDue, ...dueSoon].map(m=>{ const d=myDue(m); const col=d.overdue?"#f87171":"#fbbf24"; const p=getProgress(user.id,m); return (
                      <div key={"due"+m.id} data-testid="due-item" style={{display:"flex",alignItems:"center",gap:12,background:d.overdue?"rgba(239,68,68,0.1)":"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>startMod(m)}>
                        <span style={{fontSize:20}}>{m.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>{m.title}</div>
                          <div style={{fontSize:11,color:col}}>{dueText(d)}{d.overdue?` — it was due ${formatDue(d.due)}`:""}{p?` · ${resumeLabel(p).toLowerCase()}`:""}</div>
                        </div>
                        <button style={{background:d.overdue?"linear-gradient(135deg,#ef4444,#dc2626)":"rgba(245,158,11,0.15)",border:d.overdue?"none":"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:"5px 14px",color:d.overdue?"#fff":"#f59e0b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>{p?"Carry on →":"Start →"}</button>
                      </div>
                    ); })}
                    {expired.map(m=>(
                      <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>startMod(m)}>
                        <span style={{fontSize:20}}>{m.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>{m.title}</div>
                          <div style={{fontSize:11,color:"#f87171"}}>Certificate expired — renewal required</div>
                        </div>
                        <button style={{background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Retake →</button>
                      </div>
                    ))}
                    {expiring.map(m=>{ const ex=getExpiryStatus(myC[m.id].date,m.renewalMonths); return (
                      <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>startMod(m)}>
                        <span style={{fontSize:20}}>{m.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>{m.title}</div>
                          <div style={{fontSize:11,color:"#f59e0b"}}>{ex?.label} — plan your renewal</div>
                        </div>
                        <button style={{background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:"5px 14px",color:"#f59e0b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Renew →</button>
                      </div>
                    );})}
                    {expiredCerts.map(ct=>(
                      <div key={ct.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 12px"}}>
                        <span style={{fontSize:20}}>{ct.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>{ct.label} Certificate</div>
                          <div style={{fontSize:11,color:"#f87171"}}>External certificate expired — speak to your manager</div>
                        </div>
                      </div>
                    ))}
                    {expiringCerts.map(ct=>{ const d=Math.ceil((new Date(myExtCerts[ct.id].expiryDate)-new Date())/86400000); return (
                      <div key={ct.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px"}}>
                        <span style={{fontSize:20}}>{ct.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>{ct.label} Certificate</div>
                          <div style={{fontSize:11,color:"#f59e0b"}}>Expires in {d} day{d!==1?"s":""} — arrange renewal with your manager</div>
                        </div>
                      </div>
                    );})}
                    {unreadDocs.length>0 && (
                      <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>setStab("documents")}>
                        <span style={{fontSize:20}}>📄</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>{unreadDocs.length} document{unreadDocs.length!==1?"s":""} need your acknowledgement</div>
                          <div style={{fontSize:11,color:"#f59e0b"}}>Go to Documents to review and confirm</div>
                        </div>
                        <button style={{background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:"5px 14px",color:"#f59e0b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Review →</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Next up */}
              {nextUp && (
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.muted,letterSpacing:.8,textTransform:"uppercase",marginBottom:10}}>Up Next</div>
                  <div onClick={()=>startMod(nextUp)} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"16px 20px",border:`1px solid ${T.accent}55`,cursor:"pointer",display:"flex",alignItems:"center",gap:16}}>
                    <span style={{fontSize:32}}>{nextUp.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:15,color:T.white,marginBottom:2}}>{nextUp.title}</div>
                      <div style={{fontSize:12,color:T.muted}}>{nextUp.category} · {nextUp.duration} · <span style={{color:nextUp.level==="Mandatory"?"#f87171":T.accentLt}}>{nextUp.level}</span></div>
                    </div>
                    <button style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,border:"none",borderRadius:10,padding:"9px 20px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Start →</button>
                  </div>
                </div>
              )}

              {/* All modules — compact list */}
              <div style={{marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,letterSpacing:.8,textTransform:"uppercase"}}>All Assigned Modules</div>
                <button onClick={()=>setStab("training")} style={{background:"none",border:"none",color:T.accentLt,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font}}>View all →</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {/* DSE row */}
                {(()=>{
                  const dseStatusColor = !dseCompleted?"#8b5cf6":dseExpired?"#ef4444":dseExpiring?"#f59e0b":"#10b981";
                  const dseStatusLabel = dseDraft?"In progress":!dseCompleted?"Not completed":dseExpired?"Re-assessment due":dseExpiring?dseExpiryStatus?.label:"Completed";
                  return (
                    <div onClick={openDse}
                      style={{background:T.overlay,border:`1px solid ${dseExpired?"rgba(239,68,68,0.25)":T.borderMd}`,borderRadius:10,padding:"10px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"background .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.navyMd}
                      onMouseLeave={e=>e.currentTarget.style.background=T.overlay}>
                      <span style={{fontSize:22,flexShrink:0}}>🖥️</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:13,color:T.white}}>DSE Workstation Self-Assessment</div>
                        <div style={{fontSize:11,color:T.muted}}>Display Screen Equipment · DSE Regulations 1992 · Annual</div>
                      </div>
                      {dseCompleted && dseIssueCount>0 && <span style={{fontSize:11,color:T.muted}}>{dseResolvedCount}/{dseIssueCount} issues</span>}
                      {dseCompleted && <span style={{fontSize:11,color:T.muted}}>{lastDseReport.date}</span>}
                      <span style={{fontSize:11,fontWeight:700,color:dseStatusColor,background:`${dseStatusColor}18`,border:`1px solid ${dseStatusColor}33`,borderRadius:6,padding:"2px 8px",whiteSpace:"nowrap",flexShrink:0}}>{dseStatusLabel}</span>
                    </div>
                  );
                })()}
                {myMods.map(m=>{
                  const isDone = !!myC[m.id];
                  const ex = isDone&&m.renewalMonths ? getExpiryStatus(myC[m.id].date,m.renewalMonths) : null;
                  const isExpired  = ex?.status==="expired";
                  const isExpiring = ex?.status==="expiring";
                  const statusColor = !isDone?"#f59e0b":isExpired?"#ef4444":isExpiring?"#f59e0b":"#10b981";
                  const statusLabel = !isDone?"Not started":isExpired?"Expired":isExpiring?ex.label:"Completed";
                  return (
                    <div key={m.id} onClick={()=>startMod(m)} style={{background:T.overlay,border:`1px solid ${isExpired?"rgba(239,68,68,0.25)":T.borderMd}`,borderRadius:10,padding:"10px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"background .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.navyMd}
                      onMouseLeave={e=>e.currentTarget.style.background=T.overlay}>
                      <span style={{fontSize:22,flexShrink:0}}>{m.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:13,color:T.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title}</div>
                        <div style={{fontSize:11,color:T.muted}}>{m.category} · {m.duration}</div>
                      </div>
                      {isDone && <span style={{fontSize:11,color:T.muted}}>{scoreText(myC[m.id])}</span>}
                      <span style={{fontSize:11,fontWeight:700,color:statusColor,background:`${statusColor}18`,border:`1px solid ${statusColor}33`,borderRadius:6,padding:"2px 8px",whiteSpace:"nowrap",flexShrink:0}}>{statusLabel}</span>
                    </div>
                  );
                })}
                {myMods.length===0 && <div style={{color:T.muted,fontSize:14,padding:"24px 0",textAlign:"center"}}>No training modules assigned yet. Check back soon.</div>}
              </div>
            </div>
          )}

          {stab==="training" && (
            <div>
              <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:24}}>My Assigned Training <HelpTip dark={true} text="Modules assigned to you by your manager. Work through each one at your own pace — you'll need to pass the quiz at the end to receive your certificate. Modules with an expiry date will need to be repeated periodically."/></h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
                {/* not done first, soonest due date first; then completed */}
                {[...myMods].sort((a,b)=>(!!myC[a.id])-(!!myC[b.id]) || byDue(a,b)).map(m=>{
                  const isDone = !!myC[m.id];
                  const due = myDue(m), prog = !isDone ? getProgress(user.id, m) : null;
                  return (
                    <div key={m.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:18,padding:24,border:`1px solid ${isDone?"rgba(16,185,129,0.25)":T.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                        <span style={{fontSize:36}}>{m.icon}</span>
                        <Pill label={isDone?"Completed":due&&due.overdue?"Overdue":"Pending"} col={isDone?"green":due&&due.overdue?"red":"amber"}/>
                      </div>
                      {due && <div data-testid="due-label" style={{display:"inline-block",fontSize:11,fontWeight:800,color:due.overdue?"#f87171":due.soon?"#fbbf24":T.muted,background:due.overdue?"rgba(239,68,68,0.1)":due.soon?"rgba(245,158,11,0.1)":T.overlay,border:`1px solid ${due.overdue?"rgba(239,68,68,0.35)":due.soon?"rgba(245,158,11,0.3)":T.borderMd}`,borderRadius:99,padding:"2px 10px",marginBottom:8}}>{dueText(due)}{due.overdue||due.days>14?"":` · ${formatDue(due.due)}`}</div>}
                      <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:800}}>{m.title}</h3>
                      <p style={{color:T.muted,fontSize:12,margin:"0 0 14px"}}>{m.category} · {m.duration} · <span style={{color:m.level==="Mandatory"?"#f87171":T.accentLt}}>{m.level}</span>{m.renewalLabel&&<span style={{color:T.muted}}> · 🔄 {m.renewalLabel} renewal</span>}</p>
                      {isDone && (
                        <div style={{marginBottom:14}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                            <Bar pct={myC[m.id].recorded?100:myC[m.id].score} color={isPassed(myC[m.id])?T.green:T.amber}/>
                            <span style={{color:isPassed(myC[m.id])?T.green:T.amber,fontWeight:700,fontSize:13}}>{scoreText(myC[m.id])}</span>
                          </div>
                          <p style={{color:T.muted,fontSize:11,margin:"0 0 6px"}}>Completed {myC[m.id].date}{myC[m.id].recorded?(myC[m.id].recorded.session?" · in a group session":" · from your earlier training records"):""}</p>
                          {m.renewalMonths && (() => {
                            const ex = getExpiryStatus(myC[m.id].date, m.renewalMonths);
                            if (!ex) return null;
                            return (
                              <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:99,background:ex.bg,border:`1px solid ${ex.color}44`,fontSize:11,fontWeight:700,color:ex.color}}>
                                {ex.status==="expired"?"⚠":ex.status==="expiring"?"⏳":"✓"} {ex.label}
                                <span style={{fontWeight:400,color:T.muted,fontSize:10}}>· Renews every {m.renewalLabel}</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>startMod(m)}
                          style={{flex:1,
                            background: isDone
                              ? (()=>{ const ex=m.renewalMonths?getExpiryStatus(myC[m.id].date,m.renewalMonths):null;
                                  return ex&&ex.status!=="valid" ? `linear-gradient(135deg,${T.accent},${T.blue})` : T.overlay; })()
                              : `linear-gradient(135deg,${T.accent},${T.blue})`,
                            color: isDone
                              ? (()=>{ const ex=m.renewalMonths?getExpiryStatus(myC[m.id].date,m.renewalMonths):null;
                                  return ex&&ex.status!=="valid" ? "#fff" : T.white; })()
                              : "#fff",
                            border: isDone
                              ? (()=>{ const ex=m.renewalMonths?getExpiryStatus(myC[m.id].date,m.renewalMonths):null;
                                  return ex&&ex.status!=="valid" ? "none" : `1px solid ${T.borderMd}`; })()
                              : "none",
                            borderRadius:10,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:font}}>
                          {isDone?(()=>{const ex=m.renewalMonths?getExpiryStatus(myC[m.id].date,m.renewalMonths):null; return ex&&ex.status==="expired"?"Renew Now →":ex&&ex.status==="expiring"?"Renew Soon →":"Review Module"})():prog?`${resumeLabel(prog)} →`:"Start →"}
                        </button>
                        {isDone && !myC[m.id].recorded && (
                          <button onClick={()=>setCert({module:m,score:myC[m.id].score,date:myC[m.id].date,certId:myC[m.id].certId||null})}
                            style={{background:"rgba(245,158,11,0.12)",color:T.gold,border:`1px solid rgba(245,158,11,0.3)`,borderRadius:10,padding:"10px 14px",fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:font}}>
                            🏅
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* DSE Assessment Card */}
                {(()=>{
                  const myDseReports = dseReports[user.id]||[];
                  const lastReport = myDseReports[myDseReports.length-1];
                  const lastRi = myDseReports.length - 1;
                  const myAdminResps = adminResponses[user.id] || {};
                  const resolvedCount = lastReport ? lastReport.issues.filter((_,ii) => myAdminResps[`${lastRi}_${ii}`]?.resolved).length : 0;
                  const allResolved = lastReport && lastReport.issueCount > 0 && resolvedCount === lastReport.issueCount;
                  return (
                    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:18,padding:24,border:`1px solid ${allResolved?"rgba(16,185,129,0.4)":lastReport?"rgba(16,185,129,0.25)":"rgba(139,92,246,0.3)"}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                        <span style={{fontSize:36}}>🖥️</span>
                        <Pill label={allResolved?"✓ All Resolved":lastReport?"Completed":"Required"} col={allResolved?"green":lastReport?"green":"amber"}/>
                      </div>
                      <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:800,color:T.white}}>DSE Workstation Self-Assessment</h3>
                      <p style={{color:T.muted,fontSize:12,margin:"0 0 14px"}}>Display Screen Equipment · DSE Regulations 1992 · Mandatory</p>
                      {lastReport && (
                        <div style={{marginBottom:14}}>
                          {lastReport.issueCount > 0 ? (
                            <p style={{color:allResolved?T.green:resolvedCount>0?T.amber:"#f87171",fontSize:12,fontWeight:700,margin:"0 0 2px"}}>
                              {allResolved ? "All issues resolved ✓" : `${resolvedCount}/${lastReport.issueCount} issues resolved`}
                            </p>
                          ) : (
                            <p style={{color:T.green,fontSize:12,fontWeight:700,margin:"0 0 2px"}}>No issues found ✓</p>
                          )}
                          <p style={{color:T.muted,fontSize:11,margin:0}}>Last completed: {lastReport.date}</p>
                        </div>
                      )}
                      <button onClick={openDse}
                        style={{width:"100%",background:lastReport?T.overlay:`linear-gradient(135deg,#8b5cf6,#7c3aed)`,color:lastReport?"#8b5cf6":"#fff",border:lastReport?`1px solid ${T.borderMd}`:"none",borderRadius:10,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:font}}>
                        {dseDraft?"Continue Assessment →":lastReport?"Retake Assessment →":"Start Assessment →"}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {stab==="history" && (
            <div>
              <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:24}}>Training History <HelpTip dark={true} text="A record of all modules you've completed, including your score and the date. Use the certificate button to view and print your certificates."/></h2>
              {!Object.keys(myC).length
                ? <p style={{color:T.muted}}>No completed training yet.</p>
                : (
                  <div>{isMobile ? (
                    <div>
                      {allModules.filter(m=>myC[m.id]).map((m)=>(
                        <MobileCard key={m.id}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                            <span style={{fontSize:20}}>{m.icon}</span>
                            <span style={{fontWeight:700,fontSize:14,color:T.white}}>{m.title}</span>
                          </div>
                          <MobileCardRow label="Date" value={myC[m.id].date}/>
                          <MobileCardRow label="Score" value={<span style={{color:isPassed(myC[m.id])?T.green:T.amber,fontWeight:800}}>{scoreText(myC[m.id])}</span>}/>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
                            <Pill label={myC[m.id].recorded?"Completed":isPassed(myC[m.id])?"Passed":"Failed"} col={isPassed(myC[m.id])?"green":"red"}/>
                            {isPassed(myC[m.id]) && !myC[m.id].recorded && <button onClick={()=>setCert({module:m,score:myC[m.id].score,date:myC[m.id].date,certId:myC[m.id].certId||null})} style={{background:"rgba(245,158,11,0.1)",border:`1px solid rgba(245,158,11,0.3)`,color:T.gold,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>🏅 Certificate</button>}
                          </div>
                        </MobileCard>
                      ))}
                    </div>
                  ) : (
                  <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
                    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"12px 20px",background:T.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase"}}>
                      <span>Module</span><span>Date</span><span>Score</span><span>Status</span>
                    </div>
                    {allModules.filter(m=>myC[m.id]).map((m,i)=>(
                      <div key={m.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"16px 20px",borderTop:i>0?`1px solid ${T.border}`:"none",alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}><span>{m.icon}</span><span style={{fontSize:14,fontWeight:700}}>{m.title}</span></div>
                        <span style={{color:T.muted,fontSize:13}}>{myC[m.id].date}</span>
                        <span title={myC[m.id].recorded?"Recorded from your earlier training records":undefined} style={{color:isPassed(myC[m.id])?T.green:T.amber,fontWeight:800,fontSize:15}}>{scoreText(myC[m.id])}</span>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <Pill label={myC[m.id].recorded?"Completed":isPassed(myC[m.id])?"Passed":"Failed"} col={isPassed(myC[m.id])?"green":"red"}/>
                          {isPassed(myC[m.id])&&!myC[m.id].recorded&&<button onClick={()=>setCert({module:m,score:myC[m.id].score,date:myC[m.id].date,certId:myC[m.id].certId||null})} style={{background:"rgba(245,158,11,0.1)",border:`1px solid rgba(245,158,11,0.3)`,color:T.gold,borderRadius:8,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>🏅 Cert</button>}
                        </div>
                      </div>
                    ))}
                  </div>)}</div>
                )}
              {/* Passed results for EARLIER versions of a module (kept when a module is
                  updated — see saveModuleVersion). Certificates stay viewable. */}
              {(()=>{
                const earlier = compHistory.filter(h=>String(h.user_id)===String(user.id) && h.score>=70 && (()=>{
                  const m = allModules.find(x=>String(x.id)===String(h.module_id));
                  return m && (h.module_version||1) < (m.version||1);
                })()).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
                if (!earlier.length) return null;
                return (
                  <div style={{marginTop:28}}>
                    <h3 style={{fontSize:15,fontWeight:800,margin:"0 0 10px",color:T.white}}>Earlier versions</h3>
                    <p style={{color:T.muted,fontSize:12,margin:"0 0 12px"}}>Modules you passed before they were updated. Your result and certificate for that version are kept here.</p>
                    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
                      {earlier.map((h,i)=>{ const m=allModules.find(x=>String(x.id)===String(h.module_id)); return (
                        <div key={i} style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"2fr 1fr 1fr 1fr",gap:8,padding:"12px 20px",borderTop:i>0?`1px solid ${T.border}`:"none",alignItems:"center"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}><span>{m.icon}</span><span style={{fontSize:13,fontWeight:700}}>{m.title} <span style={{color:T.muted,fontWeight:600}}>· v{h.module_version||1}</span></span></div>
                          {!isMobile && <span style={{color:T.muted,fontSize:13}}>{h.date}</span>}
                          {!isMobile && <span style={{color:T.green,fontWeight:800,fontSize:14}}>{h.score}%</span>}
                          <button onClick={()=>setCert({module:m,score:h.score,date:h.date,certId:h.cert_id||null})} style={{justifySelf:"start",background:`${T.gold}1A`,border:`1px solid ${T.gold}4D`,color:T.gold,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>{E("🏅 ","")}Certificate</button>
                        </div>
                      );})}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {stab==="documents" && (
            <div>
              <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:8}}>H&S Documentation <HelpTip dark={true} text="Policies and procedures your manager has asked you to read. Once you've read a document click Confirm I Have Read This — this logs your acknowledgement with a date stamp visible to your manager."/></h2>
              <p style={{color:T.muted,marginBottom:24,fontSize:13}}>Documents assigned to you for required reading are highlighted. Please read and confirm each one.</p>

              {/* Required reading section */}
              {(()=>{
                const required = docs.filter(d=>(docAssignments[String(d.id)]||[]).includes(String(user.id)));
                const allOther = docs.filter(d=>!(docAssignments[String(d.id)]||[]).includes(String(user.id)));
                const unread = required.filter(d=>!(docAcknowledgements[user.id]||{})[d.id]);
                const myBundles = bundlesFor(docBundles, user.id);

                return (
                  <>
                    <MyBundles bundles={myBundles} userId={String(user.id)} docs={docs} acks={docAcknowledgements} Z={T} font={font}/>
                    {required.length>0 && (
                      <div style={{marginBottom:28}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                          <h3 style={{margin:0,fontSize:14,fontWeight:700,color:"#fff"}}>Required Reading</h3>
                          {unread.length>0
                            ? <Pill label={`${unread.length} unread`} col="red"/>
                            : <Pill label="All read ✓" col="green"/>
                          }
                        </div>
                        <div style={{display:"grid",gap:10}}>
                          {required.map(d=>{
                            const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
                            const icon=extIcons[d.ext]||"📄";
                            const ack=(docAcknowledgements[user.id]||{})[d.id];
                            return (
                              <div key={d.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,border:`2px solid ${ack?"rgba(16,185,129,0.35)":"rgba(245,158,11,0.4)"}`,overflow:"hidden"}}>
                                <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                                  <span style={{fontSize:26,flexShrink:0}}>{icon}</span>
                                  <div style={{flex:1,minWidth:160}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2,flexWrap:"wrap"}}>
                                      <span style={{fontWeight:700,fontSize:14,color:"#fff"}}>{d.title}</span>
                                      {!ack && <Pill label="Required Reading" col="amber"/>}
                                      {bundleNamesOf(myBundles, d.id).map(n=><span key={n} style={{fontSize:11,fontWeight:600,color:"#60a5fa",background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:20,padding:"1px 8px"}}>{E("📚 ","")}{n}</span>)}
                                    </div>
                                    <div style={{color:T.muted,fontSize:12}}>Updated: {d.date} · {d.size}{d.fileName?` · ${d.fileName.split(".").pop().toUpperCase()}`:""}</div>
                                    {ack && <div style={{color:T.green,fontSize:12,marginTop:3,fontWeight:600}}>✓ You confirmed reading this on {ack.date}</div>}
                                  </div>
                                  <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
                                    {d.fileData && (
                                      <button onClick={()=>setPreviewDoc(d)}
                                        style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                                        👁 View
                                      </button>
                                    )}
                                    {d.fileData && (
                                      <a href={d.fileData} download={d.fileName||d.title}
                                        style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,textDecoration:"none",whiteSpace:"nowrap"}}>
                                        ↓ Download
                                      </a>
                                    )}
                                    {ack
                                      ? <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",color:T.green,fontSize:12,fontWeight:700}}>
                                          ✓ Read & Confirmed
                                        </div>
                                      : <button
                                          onClick={()=>{const dt=todayISO();setDocAcknowledgements(p=>({...p,[user.id]:{...(p[user.id]||{}),[d.id]:{date:dt,version:d.version||1}}}));dbAcknowledgeDoc(user.id,d.id,dt);}}
                                          style={{background:`linear-gradient(135deg,${T.green},#059669)`,color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap",boxShadow:"0 2px 10px rgba(16,185,129,0.4)"}}>
                                          ✓ Confirm I Have Read This
                                        </button>
                                    }
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {allOther.length>0 && (
                      <div>
                        {required.length>0 && <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:"#fff"}}>All Documents</h3>}
                        <div style={{display:"grid",gap:10}}>
                          {allOther.map(d=>{
                            const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
                            const icon=extIcons[d.ext]||"📄";
                            return (
                              <div key={d.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,border:`1px solid ${T.border}`,flexWrap:"wrap"}}>
                                <span style={{fontSize:26,flexShrink:0}}>{icon}</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.title}</div>
                                  <div style={{color:T.muted,fontSize:12,marginTop:2}}>Updated: {d.date} · {d.size}{d.fileName?` · ${d.fileName.split(".").pop().toUpperCase()}`:""}</div>
                                </div>
                                <Pill label={d.type} col="navy"/>
                                {d.fileData && (
                                  <button onClick={()=>setPreviewDoc(d)}
                                    style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                                    👁 View
                                  </button>
                                )}
                                {d.fileData && (
                                  <a href={d.fileData} download={d.fileName||d.title}
                                    style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,textDecoration:"none",whiteSpace:"nowrap"}}>
                                    ↓ Download
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {docs.length===0 && (
                      <div style={{textAlign:"center",padding:48,color:T.muted,fontSize:14}}>No documents have been uploaded yet. Check back soon.</div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {stab==="account" && <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}><LazyAccountTab user={user} passwords={passwords} onSetPassword={savePasswordFor} authMode={AUTH_MODE} onChangeOwnPassword={async (oldPw,newPw)=>{ if (!(await authCheckPassword(user.email, oldPw))) return { ok:false, error:"Current password is incorrect." }; return changeOwnPassword(newPw); }} darkMode={darkMode} setDarkMode={setDarkMode} theme={theme} setTheme={setTheme} onSaveTheme={k=>dbSaveTheme(user.id,k)} emojiMode={emojiMode} onSaveEmojiMode={v=>{setEmojiMode(v);dbSaveEmojiMode(user.id,v);}} Z={T} font={font}/></React.Suspense>}
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
            <MachineryEquipmentPage Z={T} font={font} initial={pagePreset&&pagePreset.tab==="equipment"?"equipment":"machinery"}
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

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN PORTAL
  // ══════════════════════════════════════════════════════════════════════════
  // Admin portal. `atab` selects the tab. Top nav groups several tabs into dropdowns
  // (Training: assign/modules/create/reports, M&E: machinery/equipment,
  // Contractors: contractors/permits, Documents: documents/coshh).
  if (view==="admin") {
    // ⚠ Strict !== 1: if the primary admin's id is stored as the STRING "1" it will not be excluded.
    const staff = allUsers.filter(u=>u.id!==1); // show all users except the primary admin account
    const tUser = allUsers.find(u=>String(u.id)===String(target));
    const tAssigned = assigns[String(target)]||[];

    // Assign/unassign one module for one user (saves just that user's list).
    // Adding one uses the page's "Due by" choice; removing one also drops its due date.
    const toggleAssign = (uid, mid) => {
      const suid = String(uid);
      const c = assigns[suid]||[];
      const adding = !c.includes(mid);
      const updated = adding ? [...c,mid] : c.filter(x=>x!==mid);
      const due = adding && newAssignDue() ? { [suid]: { [mid]: newAssignDue() } } : null;
      setAssigns(p=>({...p,[suid]:updated}));
      if (due) noteDue(due);
      if (!adding) setDueDates(p=>{ if(!(p[suid]||{})[mid]) return p; const m={...p[suid]}; delete m[mid]; return {...p,[suid]:m}; });
      dbSaveAssigns({[suid]: updated}, due);
    };

    // Manual "Add staff" form. id = Date.now() (a large number; the users table stores it as TEXT).
    // New users log in with the default password (pass123) until changed — or, in
    // Supabase sign-in mode, with a temporary password shown once to the admin.
    const addStaff = () => {
      if (!newName.trim()) { setAddErr("Name is required."); return; }
      if (!newEmail.trim() || !newEmail.includes("@")) { setAddErr("Valid email is required."); return; }
      if (allUsers.find(u=>u.email===newEmail.trim())) { setAddErr("Email already exists."); return; }
      const id = Date.now();
      const newUser = { id, name:newName.trim(), email:newEmail.trim(), role:newRole, jobTitle:newJobTitle.trim(), manager:newManager.trim(), isWarehouseWorker:newIsWarehouse, department:newDepartment.trim(), status:newStatus };
      setAllUsers(p=>[...p, newUser]);
      if (AUTH_MODE === "supabase") {
        // Save the record, then create their sign-in account with a temporary password.
        (async () => {
          await dbSaveUser(newUser);
          if ((newUser.status||"active") === "leaver") return;
          giveNewStarterBundles([id]);
          const pw = makeTempPassword();
          const r = await setTempPasswordFor(newUser, pw);
          setTempPwNotice(r.ok
            ? { title: `Sign-in account created for ${newUser.name}`, items: [{ name: newUser.name, login: newUser.email.toLowerCase(), password: pw }], failures: [] }
            : { title: "Sign-in account not created", items: [], failures: [{ name: newUser.name, error: r.error }] });
        })();
      } else dbSaveUser(newUser).then(()=>{ if ((newUser.status||"active") !== "leaver") giveNewStarterBundles([id]); });
      dbSaveUserProfile(newUser);
      setNewName(""); setNewEmail(""); setNewJobTitle(""); setNewManager(""); setNewRole("staff"); setNewIsWarehouse(false); setNewDepartment(""); setNewStatus("active"); setAddErr(""); setShowAddStaff(false);
    };

    // Remove = delete the staff record, their sign-in account and ALL their personal
    // records (training, reading, DSE, certificates, machinery, preferences). Incidents,
    // investigations, inspections and the Audit Trail are kept. For people who leave,
    // use the Leaver status instead (keeps everything for audit).
    const removeStaff = async (uid) => {
      const u = allUsers.find(x=>x.id===uid);
      const sid = String(uid);
      const n = {
        results: Object.keys(comps[sid]||{}).length, assigned: (assigns[sid]||[]).length,
        docs: Object.keys(docAcknowledgements[sid]||{}).length, dse: (dseReports[sid]||dseReports[uid]||[]).length,
        certs: Object.keys(extCerts[sid]||extCerts[uid]||{}).length,
      };
      const detail = [`${n.results} training result${n.results!==1?"s":""}`, `${n.assigned} assigned module${n.assigned!==1?"s":""}`,
        `${n.docs} document confirmation${n.docs!==1?"s":""}`, `${n.dse} DSE assessment${n.dse!==1?"s":""}`, `${n.certs} external certificate${n.certs!==1?"s":""}`].join(", ");
      if (!(await ask({ title: `Remove ${u?.name||"this staff member"} completely?`, danger: true, ok: "Remove permanently", message: `This permanently deletes their staff record, sign-in account and personal records: ${detail}, plus their training and reading history, machinery competences and preferences. It can't be undone.\n\nIncidents they reported, investigations and the Audit Trail are kept.\n\nIf they have left the company, cancel and set their status to Leaver instead — that keeps their training record for audits.` }))) return;
      setAllUsers(p=>p.filter(u=>u.id!==uid));
      const strip = o => { const c={...o}; delete c[sid]; delete c[uid]; return c; };
      setAssigns(strip); setComps(strip); setDocAcknowledgements(strip); setDseReports(strip); setAdminResponses(strip); setExtCerts(strip); setMachineComps(strip);
      setDocAssignments(p=>Object.fromEntries(Object.entries(p).map(([d,ids])=>[d,(ids||[]).filter(x=>String(x)!==sid)])));
      setCompHistory(p=>p.filter(h=>String(h.user_id)!==sid)); setDocAckHistory(p=>p.filter(h=>String(h.user_id)!==sid));
      setQuizFailures(p=>p.filter(f=>String(f.userId)!==sid));
      const inBundles = withoutMember(docBundles, sid);
      if (inBundles.length) { setDocBundles(p=>p.map(b=>inBundles.find(c=>c.id===b.id)||b)); await Promise.all(inBundles.map(dbSaveBundle)); }
      await dbDeleteUser(uid);
      const ok = await dbDeletePersonRecords(uid);
      auditEvent("staff", sid, "remove", `Removed staff member and their records (${detail})${ok ? "" : " — some records could not be deleted"}`, {}, u?.name || sid);
      if (!ok) notify("The staff member was removed, but some of their records couldn't be deleted. Try again later or check the Audit Trail.", { kind: "error" });
      else notify(`${u?.name||"Staff member"} and their records were removed.`);
    };

    return (
      <EmojiCtx.Provider value={emojiMode}>
      <div style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.white,overflowX:"hidden"}}>
        <PreviewModal doc={previewDoc} onClose={()=>setPreviewDoc(null)} Z={T} font={font}/>
        {/* ▲/▼ top-of-page / bottom-of-page buttons on long screens (shared/ScrollNav.jsx) */}
        <ScrollNav bottom={24} Z={T} font={font}/>
        {pendingModuleSave && (
          <NewVersionModal kind="module" title={pendingModuleSave.m.title || "Training module"}
            fromVersion={pendingModuleSave.prev.version || 1}
            affectedCount={Object.keys(comps).filter(uid => comps[uid] && comps[uid][pendingModuleSave.m.id]).length}
            onConfirm={saveModuleVersion} onCancel={() => setPendingModuleSave(null)} Z={T} font={font}/>
        )}
        {editingStaff && (
          <EditStaffModal
            staffUser={editingStaff}
            allUsers={allUsers} setAllUsers={setAllUsers} onSaveProfile={u=>{dbSaveUser(u);dbSaveUserProfile(u);}}
            passwords={passwords} onSetPassword={savePasswordFor}
            onSetTempPassword={AUTH_MODE==="supabase" ? async (su, pw) => {
              const r = await setTempPasswordFor(su, pw);
              if (!r.ok) setTempPwNotice({ title: "Password not changed", items: [], failures: [{ name: su.name, error: r.error }] });
            } : null}
            onClose={()=>setEditingStaff(null)}
            Z={T} font={font}
          />
        )}
        {tempPwNotice && <TempPasswordsModal {...tempPwNotice} onClose={()=>setTempPwNotice(null)} Z={T} font={font}/>}
        {showWelcomeSettings && <WelcomeVideoSettings user={user} onClose={()=>setShowWelcomeSettings(false)} Z={T} font={font}/>}
        {/* Nav */}
        <div style={{background:`linear-gradient(90deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:isMobile?"0 12px":navTight?"0 16px":"0 28px",display:"flex",alignItems:"center",position:"relative",flexWrap:isMobile?"nowrap":"wrap",rowGap:0}}>
          <div style={{marginRight:isMobile?8:navTight?14:28,padding:"12px 0",flexShrink:0}}><ZeusLogo darkMode={darkMode}/></div>
          {!isMobile && !navCompact && <><div style={{width:1,height:28,background:T.headerBgMd,marginRight:8}}/><Pill label="ADMIN" col="navy"/><div style={{width:1,height:20,background:T.headerBgMd,margin:"0 12px"}}/></>}
          {!isMobile && (()=>{
            const TRAINING_TABS=["assign","modules","create","reports"]; const trainingActive=TRAINING_TABS.includes(atab);
            const ME_TABS=["machinery","equipment"]; const meActive=ME_TABS.includes(atab);
            return (<>
              <button onClick={()=>setAtab("dashboard")} style={navBtn(atab==="dashboard",T.gold)}>Dashboard</button>
              <button onClick={()=>setAtab("users")} style={navBtn(atab==="users",T.gold)}>Staff</button>
              <NavMenu label="Training" active={trainingActive} items={[["assign","Assign Training"],["modules","Training Library"],["create","Create Module"],["reports","Reports"]]} current={atab} onPick={setAtab} btnStyle={{...navBtn(trainingActive,T.gold),maxWidth:"none",whiteSpace:"nowrap"}} Z={T} font={font}/>
              <button onClick={()=>setAtab("firesafety")} style={navBtn(atab==="firesafety",T.gold)}>Fire Safety</button>
              <button onClick={()=>setAtab("firstaid")} style={navBtn(atab==="firstaid",T.gold)}>First Aid</button>
              <button onClick={()=>setAtab("incidents")} style={navBtn(atab==="incidents",T.gold)}>Incidents</button>
              <button onClick={()=>setAtab("ra")} style={navBtn(atab==="ra",T.gold)}>Risk Assessments</button>
              <button onClick={()=>setAtab("inspections")} style={navBtn(atab==="inspections",T.gold)}>Inspections</button>
              {(()=>{ const CON_TABS=["contractors","permits"]; const conActive=CON_TABS.includes(atab); return (
                <NavMenu label="Contractors" active={conActive} items={[["contractors","Contractors"],["permits","Permits"]]} current={atab} onPick={setAtab} btnStyle={{...navBtn(conActive,T.gold),maxWidth:"none",whiteSpace:"nowrap"}} Z={T} font={font}/>
              ); })()}
              {(()=>{ const DOC_TABS=["documents","coshh","audit","settings"]; const docActive=DOC_TABS.includes(atab); return (
                <NavMenu label="Documents" active={docActive} items={[["documents","H&S Documents"],["coshh","COSHH Register"],["audit","Audit Trail"],["settings","Site Settings"]]} current={atab} onPick={setAtab} btnStyle={{...navBtn(docActive,T.gold),maxWidth:"none",whiteSpace:"nowrap"}} Z={T} font={font}/>
              ); })()}
              <NavMenu label="Machinery & Equipment" active={meActive} items={[["machinery","Machinery Competence"],["equipment","Equipment Register"]]} current={atab} onPick={setAtab} btnStyle={{...navBtn(meActive,T.gold),maxWidth:navTight?124:"none"}} Z={T} font={font}/>
            </>);
          })()}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:isMobile?6:navCompact?6:10}}>
            {isMobile && (<button onClick={()=>setMobileMenuOpen(m=>!m)} style={{background:"none",border:`1px solid ${T.borderMd}`,borderRadius:8,color:T.white,fontSize:20,cursor:"pointer",padding:"4px 10px",lineHeight:1,fontFamily:font,flexShrink:0}}>{mobileMenuOpen?"✕":"☰"}</button>)}
            {(()=>{
              // Admin notification list (same shape as the staff one; nav.tab = admin tab key).
              // Thresholds used: training/certificates expiring ≤EXPIRY_WARNING_DAYS (lib/dates.js), RA/doc review ≤30d, drill >365d,
              // fire warden cert default 36 months.
              const notifications = [];
              // Full backup reminder (Audit Trail → Download full backup)
              if (lastBackup !== undefined && (lastBackup === null || (Date.now() - new Date(lastBackup).getTime()) / 86400000 >= BACKUP_DUE_DAYS))
                notifications.push({type:"report",urgent:false,title:lastBackup?"A full backup is due":"Download a first full backup",detail:lastBackup?`Last one ${Math.floor((Date.now()-new Date(lastBackup).getTime())/86400000)} days ago — Documents ▼ → Audit Trail`:"Keeps a copy of every record — Documents ▼ → Audit Trail",nav:{tab:"audit"}});
              // Staff with overdue mandatory modules
              const overdueStaff = staff.filter(u=>{
                const mandatory = allModules.filter(m=>m.level==="Mandatory"&&(assigns[u.id]||[]).includes(m.id));
                return mandatory.some(m=>!(comps[u.id]||{})[m.id]);
              });
              if(overdueStaff.length) notifications.push({type:"module",urgent:true,title:`${overdueStaff.length} staff with overdue mandatory training`,detail:overdueStaff.map(u=>u.name.split(" ")[0]).slice(0,4).join(", ")+(overdueStaff.length>4?` +${overdueStaff.length-4} more`:"...tap to view"),nav:{tab:"reports"}});
              // Training past its due date (lib/dueDates.js)
              const pastDueBy = overdueByPerson(assigns, dueDates, (uid, mid) => isPassed((comps[uid]||{})[mid]));
              const pastDuePeople = staff.filter(u=>(u.status||"active")!=="leaver" && pastDueBy[String(u.id)]);
              if(pastDuePeople.length) { const n = pastDuePeople.reduce((t,u)=>t+pastDueBy[String(u.id)],0);
                notifications.push({type:"module",urgent:true,title:`${n} training assignment${n!==1?"s":""} past the due date`,detail:`${pastDuePeople.length} ${pastDuePeople.length!==1?"people":"person"}: ${pastDuePeople.map(u=>u.name.split(" ")[0]).slice(0,4).join(", ")}${pastDuePeople.length>4?` +${pastDuePeople.length-4} more`:""}`,nav:{tab:"users",staffProgress:"pastdue"}}); }
              // Machinery competences expired / expiring (data/seedMachinery.js machineState)
              { let ex = 0, soon = 0; const who = new Set();
                staff.filter(u=>(u.status||"active")!=="leaver"&&u.role!=="admin"&&isWarehouseWorker(u)).forEach(u=>compsFor(machineComps,u.id).forEach(c=>{
                  if (!allMachineTypes.some(t=>t.id===c.machineId)) return;
                  const k = machineState(c, allMachineTypes).key; if (k==="expired") { ex++; who.add(u.name.split(" ")[0]); } else if (k==="expiring") { soon++; who.add(u.name.split(" ")[0]); } }));
                if (ex || soon) notifications.push({type:"report",urgent:ex>0,title:ex?`${ex} machinery competence${ex!==1?"s":""} need${ex===1?"s":""} renewing${soon?` (+${soon} due within 60 days)`:""}`:`${soon} machinery competence${soon!==1?"s":""} due for renewal within 60 days`,
                  detail:[...who].slice(0,4).join(", ")+(who.size>4?` +${who.size-4} more`:""),nav:{tab:"machinery",preset:{tab:"machinery",show:"attention"}}}); }
              // Unread required documents
              const unreadDoc = staff.filter(u=>docs.some(d=>(docAssignments[String(d.id)]||[]).includes(String(u.id))&&!(docAcknowledgements[u.id]||{})[d.id]));
              if(unreadDoc.length) notifications.push({type:"document",urgent:false,title:`${unreadDoc.length} staff with unread required documents`,detail:"Check Documents tab for details",nav:{tab:"reports"}});
              // DSE assessments not submitted
              const noDse = staff.filter(u=>!(dseReports[u.id]||[]).length);
              if(noDse.length) notifications.push({type:"dse",urgent:false,title:`${noDse.length} staff yet to complete DSE assessment`,detail:noDse.map(u=>u.name.split(" ")[0]).slice(0,4).join(", ")+(noDse.length>4?` +${noDse.length-4} more`:""),nav:{tab:"reports"}});
              // DSE issues awaiting admin response
              const awaitingResp = staff.filter(u=>{
                const reports=dseReports[u.id]||[]; if(!reports.length) return false;
                const ri=reports.length-1; const latest=reports[ri];
                if(!latest.issues||!latest.issueCount) return false;
                return latest.issues.some((_,ii)=>!(adminResponses[u.id]||{})[`${ri}_${ii}`]?.resolved);
              });
              if(awaitingResp.length) notifications.push({type:"report",urgent:false,title:`${awaitingResp.length} DSE report${awaitingResp.length!==1?"s":""} awaiting your response`,detail:"Check Reports → DSE Reports tab",nav:{tab:"reports"}});
              // Staff with no modules assigned
              const noModules = staff.filter(u=>!(assigns[u.id]||[]).length);
              if(noModules.length) notifications.push({type:"staff",urgent:false,title:`${noModules.length} staff member${noModules.length!==1?"s":""} with no modules assigned`,detail:"Visit Assign tab to assign training",nav:{tab:"assign"}});
              // Expired training across all staff
              let expiredCount = 0, expiringCount = 0;
              staff.forEach(u=>{
                const uc = comps[u.id]||{};
                (assigns[u.id]||[]).forEach(mid=>{
                  const m = allModules.find(x=>x.id===mid);
                  if(m&&uc[mid]&&m.renewalMonths){
                    const ex = getExpiryStatus(uc[mid].date, m.renewalMonths);
                    if(ex&&ex.status==="expired") expiredCount++;
                    else if(ex&&ex.status==="expiring") expiringCount++;
                  }
                });
              });
              if(expiredCount>0) notifications.push({type:"module",urgent:true,title:`${expiredCount} expired training certificate${expiredCount!==1?"s":""}`,detail:"Staff need to renew — check Reports tab",nav:{tab:"reports"}});
              else if(expiringCount>0) notifications.push({type:"module",urgent:false,title:`${expiringCount} training certificate${expiringCount!==1?"s":""} expiring within ${EXPIRY_WARNING_DAYS} days`,detail:"Review Reports tab to see who needs to renew",nav:{tab:"reports"}});
              // Open incidents
              const openIncidents = incidents.filter(i=>!i.closed);
              const riddorIncidents = incidents.filter(i=>i.riddor&&!i.closed);
              // Quick hazard reports whose reporter hasn't completed the full form yet
              const pendingQuick = incidents.filter(isIncompleteQuickReport);
              if(pendingQuick.length){ const lateQuick = pendingQuick.filter(i=>isQuickReportOverdue(i)).length;
                notifications.push({type:"report",urgent:lateQuick>0,title:`${pendingQuick.length} quick hazard report${pendingQuick.length!==1?"s":""} awaiting full details`,detail:lateQuick?`${lateQuick} overdue — reporters are reminded until complete`:"Reporters are reminded until they complete the full form",nav:{tab:"incidents"}}); }
              // RIDDOR reports still to be made, with their deadlines (domains/incidents/riddor.js)
              const riddorToReport = riddorIncidents.concat(incidents.filter(i=>i.riddor&&i.closed)).map(i=>({i,d:riddorDue(i)})).filter(x=>x.d)
                .sort((a,b)=>(a.d.dueDate||"0").localeCompare(b.d.dueDate||"0"));
              if(riddorToReport.length){ const late=riddorToReport.filter(x=>x.d.state==="overdue").length, now=riddorToReport.filter(x=>riddorUrgent(x.d)).length;
                notifications.push({type:"report",urgent:now>0,title:`${riddorToReport.length} RIDDOR report${riddorToReport.length!==1?"s":""} to make to HSE${late?` (${late} overdue)`:""}`,
                  detail:riddorToReport.slice(0,3).map(x=>`${x.i.location||"Incident"}: ${riddorDueText(x.d)}`).join(" · "),nav:{tab:"incidents",preset:{tab:"incidents",riddor:true}}}); }
              if(riddorIncidents.length && !riddorToReport.length) notifications.push({type:"report",urgent:false,title:`${riddorIncidents.length} open RIDDOR incident${riddorIncidents.length!==1?"s":""} (reported to HSE)`,detail:"Close them once the investigation is done",nav:{tab:"incidents"}});
              else if(!riddorIncidents.length && openIncidents.length) notifications.push({type:"report",urgent:false,title:`${openIncidents.length} open incident${openIncidents.length!==1?"s":""}`,detail:"Check Incidents tab to review and close",nav:{tab:"incidents"}});
              // Quiz failures in last 7 days
              const recentFailures = quizFailures.filter(f=>!f.acknowledged && f.date >= localISO(new Date(Date.now()-7*86400000)));
              if(recentFailures.length) notifications.push({type:"module",urgent:false,title:`${recentFailures.length} quiz failure${recentFailures.length!==1?"s":""} in last 7 days`,detail:"Check Training → Reports to review",nav:{tab:"reports"}});
              // RA review dates
              const today2 = todayISO();
              const overdueRAs = ras.filter(ra2=>ra2.reviewDate&&ra2.reviewDate<today2);
              const soonRAs = ras.filter(ra2=>ra2.reviewDate&&ra2.reviewDate>=today2&&Math.ceil((new Date(ra2.reviewDate)-new Date())/86400000)<=30);
              if(overdueRAs.length) notifications.push({type:"report",urgent:true,title:`${overdueRAs.length} risk assessment${overdueRAs.length!==1?"s":""} overdue for review`,detail:overdueRAs.map(r=>r.title).join(", "),nav:{tab:"ra"}});
              else if(soonRAs.length) notifications.push({type:"report",urgent:false,title:`${soonRAs.length} risk assessment${soonRAs.length!==1?"s":""} due for review soon`,detail:soonRAs.map(r=>r.title).join(", "),nav:{tab:"ra"}});

              // Contractor alerts
              const today3=todayISO();
              const expiredConCerts=(contractors||[]).filter(c=>Object.values(contractorCerts[c.id]||{}).some(cert=>cert.expiryDate&&cert.expiryDate<today3));
              if(expiredConCerts.length) notifications.push({type:"document",urgent:true,title:`${expiredConCerts.length} contractor${expiredConCerts.length!==1?"s":""} with expired certificates`,detail:"Check Contractors tab",nav:{tab:"contractors"}});

              // Fire safety alerts — same rules as the Fire Safety screen (domains/fireSafety/fireLogic.js)
              const fsum = fireSummary({ fireSafety: fireSafety||{}, extCerts: extCerts||{}, staff, inspections: siteInspections||[], today: fireToday() });
              if(fsum.expiredWardens.length) notifications.push({type:"report",urgent:true,title:`${fsum.expiredWardens.length} fire warden cert${fsum.expiredWardens.length!==1?"s":""} expired`,detail:fsum.expiredWardens.map(w=>w.name).join(", "),nav:{tab:"firesafety"}});
              else if(fsum.expiringWardens.length) notifications.push({type:"report",urgent:false,title:`${fsum.expiringWardens.length} fire warden cert${fsum.expiringWardens.length!==1?"s":""} expiring`,detail:fsum.expiringWardens.map(w=>`${w.name} (${w.expiry})`).join(", "),nav:{tab:"firesafety"}});
              if(fsum.undatedWardens.length) notifications.push({type:"report",urgent:false,title:`${fsum.undatedWardens.length} fire warden certificate${fsum.undatedWardens.length!==1?"s have":" has"} no expiry date`,detail:fsum.undatedWardens.map(w=>w.name).join(", "),nav:{tab:"firesafety"}});
              if(fsum.overdueExtinguishers.length) notifications.push({type:"report",urgent:true,title:`${fsum.overdueExtinguishers.length} fire extinguisher${fsum.overdueExtinguishers.length!==1?"s":""} overdue for service`,detail:"Check Fire Safety → Extinguishers",nav:{tab:"firesafety"}});
              if(fsum.drillOverdue) notifications.push({type:"report",urgent:true,title:"Fire drill overdue — last drill was "+fsum.daysSinceDrill+" days ago",detail:"Schedule a full evacuation drill",nav:{tab:"firesafety"}});
              if(fsum.fraOverdue) notifications.push({type:"report",urgent:true,title:"Fire Risk Assessment review overdue",detail:`Review was due ${fsum.fraNext}`,nav:{tab:"firesafety"}});

              // Document review dates
              const overdueReviews = docs.filter(d=>d.reviewDate&&d.reviewDate<today2);
              const soonReviews = docs.filter(d=>d.reviewDate&&d.reviewDate>=today2&&Math.ceil((new Date(d.reviewDate)-new Date())/86400000)<=30);
              if(overdueReviews.length) notifications.push({type:"document",urgent:true,title:`${overdueReviews.length} document${overdueReviews.length!==1?"s":""} overdue for review`,detail:overdueReviews.map(d=>d.title).join(", "),nav:{tab:"documents"}});
              else if(soonReviews.length) notifications.push({type:"document",urgent:false,title:`${soonReviews.length} document${soonReviews.length!==1?"s":""} due for review soon`,detail:soonReviews.map(d=>d.title).join(", "),nav:{tab:"documents"}});
              return <NotificationBell notifications={notifications} onNavigate={n=>{ if(n.preset) setPagePreset(n.preset); if(n.staffProgress){ setStaffFilterSearch(""); setStaffFilterManager("all"); setStaffStatusFilter("all"); setStaffFilterProgress(n.staffProgress); } setAtab(n.tab);if(n.view)setAdminReportView(n.view);}} Z={T} font={font}/>;
            })()}
            <QuickSearch getItems={quickItems} Z={T} font={font} compact={winW<2200}/>
            {!navCompact && <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>}
            {/* My Training — lets an admin see/complete their own assigned training via the staff view */}
            <button onClick={()=>{ setStab("training"); setView("staff"); }}
              title="My Training: your own assigned training" aria-label="My Training"
              style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:navCompact?"5px 9px":"5px 12px",color:T.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,display:"flex",alignItems:"center",gap:5,transition:"all .15s",whiteSpace:"nowrap"}}>
              {navCompact
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>
                : <>{E("📚 ","")}My Training</>}
            </button>
            {!navCompact && <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>}
            {/* Quick theme cycle button */}
            {!navTiny && (()=>{ const next=oppositeTheme(theme); const lbl=`Switch to ${getTheme(next).label} (${darkMode?"light":"dark"}). More themes in My Account.`; return (
            <button onClick={()=>{
              setTheme(next);
              dbSaveTheme(user.id,next);
            }} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"5px 10px",color:T.muted,cursor:"pointer",fontSize:14,fontFamily:font,display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}
              title={lbl} aria-label={lbl} data-zp-theme-toggle="">
              {darkMode?"☀️":"🌙"}
            </button>); })()}
            {!navCompact && <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>}
            <button type="button" onClick={()=>setAtab(atab==="account"?"users":"account")}
              title={`My Account (${user.name})`} aria-label={`My Account (${user.name})`}
              style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 8px 4px 4px",borderRadius:10,transition:"background .15s",background:atab==="account"?T.overlay:"transparent",border:atab==="account"?`1px solid ${T.borderMd}`:"1px solid transparent",fontFamily:font,color:"inherit"}}
              onMouseEnter={e=>{ if(atab!=="account") e.currentTarget.style.background=T.overlay; }}
              onMouseLeave={e=>{ e.currentTarget.style.background=atab==="account"?T.overlay:"transparent"; }}>
              <Avatar name={user.name} size={32}/>
              {!navCompact && <span style={{fontSize:13,color:atab==="account"?T.white:T.muted,fontWeight:600}}>{user.name.split(" ")[0]}</span>}
            </button>
            <button onClick={logout} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,fontFamily:font,whiteSpace:"nowrap"}}>Sign Out</button>
          </div>
        </div>

        {/* Module Preview Modal */}
        {previewModule && (
          <ModulePreviewModal m={previewModule} staff={staff} assigns={assigns} comps={comps} compHistory={compHistory} moduleVersions={moduleVersions} isMobile={isMobile} setAtab={setAtab} onClose={()=>setPreviewModule(null)} T={T} font={font}/>
        )}

        {/* Mobile nav drawer */}
        {isMobile && mobileMenuOpen && (
          <div style={{background:`linear-gradient(135deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:"8px 0",zIndex:300,position:"relative"}}>
            {[
              ["dashboard", E("🏠 ","")+"Dashboard"],
              ["users", E("👥 ","")+"Staff"],
              ["assign", E("📋 ","")+"Assign Training"],
              ["modules", E("📚 ","")+"Training Library"],
              ["create","➕ Create Module"],
              ["reports", E("📊 ","")+"Reports"],
              ["firesafety", E("🔥 ","")+"Fire Safety"],
              ["firstaid","First Aid Register"],
              ["incidents", E("⚠️ ","")+"Incidents"],
              ["ra","🔍 Risk Assessments"],
              ["inspections","🏗️ Inspections"],
              ["contractors","🪪 Contractors"],
              ["permits", E("📋 ","")+"Permits"],
              ["documents","📄 H&S Documents"],
              ["coshh","🧪 COSHH Register"],
              ["audit", E("🕘 ","")+"Audit Trail"],
              ["settings", E("⚙ ","")+"Site Settings"],
              ["machinery","🔧 Machinery Competence"],
              ["equipment","📦 Equipment Register"],
              ["account","👤 My Account"],
            ].map(([id,label])=>(
              <button key={id} onClick={()=>{setAtab(id);setMobileMenuOpen(false);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"13px 20px",background:atab===id?`rgba(245,158,11,0.12)`:"transparent",border:"none",borderBottom:`1px solid rgba(255,255,255,0.05)`,color:atab===id?T.gold:T.white,fontWeight:atab===id?700:400,fontSize:14,cursor:"pointer",fontFamily:font}}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"16px 12px":"36px 28px"}}>

          {/* ── ADMIN DASHBOARD: KPI cards (drag-reorderable, saved per admin in dashboard_layout) + summary lists ── */}
          {atab==="dashboard" && (() => {
            const today = todayISO();

            // ── Training stats ────────────────────────────────────────────────
            const staffList = staff;
            const overdueTraining = staffList.filter(u=>{
              const a=(assigns[u.id]||[]).length;
              const d=(assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length;
              return a>0 && d<a;
            });
            const expiringTraining = staffList.filter(u=>
              (assigns[u.id]||[]).some(mid=>{
                const c=(comps[u.id]||{})[mid];
                const m=allModules.find(x=>x.id===mid);
                if(!c||!m?.renewalMonths) return false;
                const ex=getExpiryStatus(c.date,m.renewalMonths);
                return ex&&(ex.status==="expired"||ex.status==="expiring");
              })
            );

            // ── Incident stats ────────────────────────────────────────────────
            const openIncidents2 = incidents.filter(i=>!i.closed);
            const riddorOpen2 = incidents.filter(i=>i.riddor&&!i.closed&&!i.riddorReported);
            const last30Inc = incidents.filter(i=>i.date>=localISO(new Date(Date.now()-30*86400000)));

            // ── Document stats ────────────────────────────────────────────────
            const assignedDocs = docs.filter(d=>Object.keys(docAssignments[d.id]||{}).length>0||(docAssignments[d.id]||[]).length>0);
            const unreadDocs = docs.filter(d=>{
              const assigned = docAssignments[d.id]||[];
              return assigned.some(uid=>!(docAcknowledgements[uid]||{})[d.id]);
            });
            const overdueDocReviews = docs.filter(d=>d.reviewDate&&d.reviewDate<today);
            const overdueRAReviews = ras.filter(r=>r.reviewDate&&r.reviewDate<today);

            // ── Equipment stats ───────────────────────────────────────────────
            const overdueEquipment = equipment.filter(e=>e.nextService&&e.nextService<today&&e.status==="active");
            const soonEquipment = equipment.filter(e=>e.nextService&&e.nextService>=today&&Math.ceil((new Date(e.nextService)-new Date())/86400000)<=30&&e.status==="active");
            const outOfService = equipment.filter(e=>e.status==="inactive");

            // ── Quiz failures ─────────────────────────────────────────────────
            const unreviewedFailures = quizFailures.filter(f=>!f.acknowledged);

            // ── External certs ────────────────────────────────────────────────
            const expiredExtCerts = [];
            staffList.forEach(u=>{
              EXT_CERT_TYPES.forEach(ct=>{
                const cert=(extCerts[u.id]||{})[ct.id];
                if(cert&&cert.expiryDate&&cert.expiryDate<today) expiredExtCerts.push({user:u,cert,certType:ct});
              });
            });

            // Each figure opens the list behind it, already filtered (click, or Tab + Enter)
            const showStaff = progress => { setStaffFilterSearch(""); setStaffFilterManager("all"); setStaffStatusFilter("all"); setStaffGroupByTeam(false); setStaffFilterProgress(progress); setAtab("users"); };
            const showOpenIncidents = () => { setPagePreset({tab:"incidents",status:"open"}); setAtab("incidents"); };
            const card = (icon,label,value,sub,col,urgent,onClick) => (
              <div onClick={onClick} role={onClick?"button":undefined} tabIndex={onClick?0:undefined} title={onClick?`Show ${label.toLowerCase()}`:undefined}
                aria-label={onClick?`${label}: ${value}${sub?`, ${sub}`:""}. Show these.`:undefined} data-testid={onClick?"dash-figure":undefined}
                onKeyDown={e=>{ if(onClick&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); onClick(); } }}
                style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"18px 20px",border:`1px solid ${urgent?"rgba(239,68,68,0.4)":col?"rgba(245,158,11,0.25)":T.border}`,cursor:onClick?"pointer":"default",transition:"transform .15s,box-shadow .15s"}}
                onMouseEnter={e=>{if(onClick){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.3)";}}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:.5,color:T.muted,textTransform:"uppercase",marginBottom:6}}>{label}</div>
                    <div style={{fontSize:32,fontWeight:900,color:urgent?"#f87171":col?"#f59e0b":value===0?T.green:T.white,lineHeight:1}}>{value}</div>
                    {sub && <div style={{fontSize:11,color:T.muted,marginTop:5}}>{sub}</div>}
                  </div>
                  <span style={{fontSize:28,opacity:.7}}>{icon}</span>
                </div>
              </div>
            );

            const section = (title, children) => (
              <div style={{marginBottom:28}}>
                <h3 style={{fontSize:14,fontWeight:700,letterSpacing:.5,color:T.muted,textTransform:"uppercase",margin:"0 0 12px"}}>{title}</h3>
                {children}
              </div>
            );

            const listCard = (items, emptyMsg, renderItem, onMoreClick) => (
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,border:`1px solid ${T.border}`,overflow:"hidden"}}>
                {items.length===0
                  ? <div style={{padding:"20px",textAlign:"center",color:T.green,fontSize:13,fontWeight:600}}>✓ {emptyMsg}</div>
                  : items.slice(0,5).map((item,i)=>(
                    <div key={i} style={{padding:"12px 16px",borderTop:i>0?`1px solid ${T.border}`:"none",display:"flex",alignItems:"center",gap:12}}>
                      {renderItem(item,i)}
                    </div>
                  ))
                }
                {items.length>5 && (
                  <div onClick={onMoreClick} style={{padding:"8px 16px",borderTop:`1px solid ${T.border}`,fontSize:11,color:onMoreClick?T.accentLt:T.muted,textAlign:"center",cursor:onMoreClick?"pointer":"default",fontWeight:onMoreClick?700:400,transition:"background .15s"}}
                    onMouseEnter={e=>{if(onMoreClick)e.currentTarget.style.background="rgba(37,99,235,0.08)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="";}}>
                    +{items.length-5} more{onMoreClick?" →":""}
                  </div>
                )}
              </div>
            );

            return (
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
                  <div>
                    <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Admin Dashboard</h2>
                    <p style={{color:T.muted,fontSize:13,margin:0}}>Health & Safety overview — {new Date().toLocaleDateString("en-GB",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{setShowAdminReportForm(true);setAtab("incidents");}} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>+ Report Incident</button>
                  </div>
                </div>

                {/* Stat grid — order is draggable per-admin via the ⠿⠿ handle, saved to Supabase */}
                {(() => {
                  const statCardDefs = [
                    { id:"trainingIncomplete", node: card(E("📚",""),"Training Incomplete",overdueTraining.length,`of ${staffList.length} staff`,null,overdueTraining.length>0,()=>showStaff("incomplete")) },
                    { id:"trainingPastDue", node: (()=>{ const by = overdueByPerson(assigns, dueDates, (uid, mid) => isPassed((comps[uid]||{})[mid]));
                        const people = staffList.filter(u=>(u.status||"active")!=="leaver" && by[String(u.id)]); const n = people.reduce((t,u)=>t+by[String(u.id)],0);
                        return card(E("⏰",""),"Training Past Due",people.length,n?`${n} assignment${n!==1?"s":""} late`:"none late",null,people.length>0,()=>showStaff("pastdue")); })() },
                    { id:"expiringExpired", node: card(E("🔄",""),"Expiring/Expired",expiringTraining.length,"training renewals",expiringTraining.length>0,false,()=>{setAtab("reports");setAdminReportView("expiry");}) },
                    { id:"openIncidents", node: card(E("⚠️",""),"Open Incidents",openIncidents2.length,(()=>{ const un=incidents.filter(i=>riddorDue(i)); const late=un.filter(i=>riddorDue(i).state==="overdue").length; return `${un.length} RIDDOR unreported${late?` · ${late} overdue`:""}`; })(),null,incidents.some(i=>riddorDue(i)),showOpenIncidents) },
                    { id:"unreadDocuments", node: card(E("📄",""),"Unread Documents",unreadDocs.length,"assigned but unacknowledged",unreadDocs.length>0,false,()=>{setAtab("reports");setAdminReportView("documents");}) },
                    { id:"equipmentOverdue", node: card(E("🔧",""),"Equipment Overdue",overdueEquipment.length,"service overdue",null,overdueEquipment.length>0,()=>{setPagePreset({tab:"equipment",show:"overdue"});setAtab("equipment");}) },
                    { id:"machineryRenewals", node: (()=>{ let ex=0, soon=0;
                        staffList.filter(u=>(u.status||"active")!=="leaver"&&u.role!=="admin"&&isWarehouseWorker(u)).forEach(u=>compsFor(machineComps,u.id).forEach(c=>{
                          if (!allMachineTypes.some(t=>t.id===c.machineId)) return;
                          const k=machineState(c,allMachineTypes).key; if(k==="expired")ex++; else if(k==="expiring")soon++; }));
                        return card(E("🏗",""),"Machinery Renewals",ex+soon,ex?`${ex} overdue · ${soon} due in 60 days`:soon?`${soon} due in 60 days`:"all in date",soon>0&&!ex,ex>0,()=>{setPagePreset({tab:"machinery",show:"attention"});setAtab("machinery");}); })() },
                    { id:"outOfService", node: card(E("📋",""),"Out of Service",outOfService.length,"equipment items",null,false,()=>{setPagePreset({tab:"equipment",status:"inactive"});setAtab("equipment");}) },
                    { id:"quizFailures", node: card(E("❌",""),"Quiz Failures",unreviewedFailures.length,"unreviewed",unreviewedFailures.length>0,false,()=>{setAtab("reports");setAdminReportView("failures");}) },
                    { id:"reviewsOverdue", node: card(E("📅",""),"Reviews Overdue",overdueDocReviews.length+overdueRAReviews.length,"docs & RAs",overdueDocReviews.length+overdueRAReviews.length>0,false,()=>setAtab(overdueDocReviews.length||!overdueRAReviews.length?"documents":"ra")) },
                    { id:"onSiteNow", node: (()=>{
                      const onSiteWorkers = [];
                      (contractors||[]).forEach(c=>{
                        const todayV=(contractorVisits[c.id]||[]).filter(v=>v.date===today);
                        todayV.forEach(v=>{
                          if(v.workers&&v.workers.length>0) v.workers.forEach(wid=>{const w=(c.workers||[]).find(x=>x.id===wid);if(w)onSiteWorkers.push(w.name);});
                          else onSiteWorkers.push(c.name);
                        });
                      });
                      const uniqueOnSite=[...new Set(onSiteWorkers)];
                      return card(E("🪪",""),"On Site Now",uniqueOnSite.length,uniqueOnSite.length>0?uniqueOnSite.slice(0,2).join(", ")+(uniqueOnSite.length>2?` +${uniqueOnSite.length-2} more`:""):"No contractors today",null,false,()=>setAtab("contractors"));
                    })() },
                    { id:"fireSafety", node: (()=>{
                      // same rules as the Fire Safety screen (domains/fireSafety/fireLogic.js)
                      const f = fireSummary({ fireSafety: fireSafety||{}, extCerts: extCerts||{}, staff: staffList, inspections: siteInspections||[], today: fireToday() });
                      const sub = f.issues>0?`${f.issues} item${f.issues!==1?"s":""} need attention`:(f.daysSinceDrill!==null?`Last drill ${f.daysSinceDrill}d ago`:"No drills recorded");
                      return card(E("🔥",""),"Fire Safety",f.wardens.length,sub,null,f.issues>0,()=>setAtab("firesafety"));
                    })() },
                    { id:"firstAid", node: (()=>{
                      const fa = firstAidData||{};
                      const faAiders = fa.aiders||[];
                      const faCustomZones = fa.customZones||[];
                      const faAllZones = [...new Set([...getSiteLists().firstAidZones, ...faCustomZones])];
                      const minPerShift = fa.assessment?.minPerShift||1;
                      // Build combined aider list (manual + cert-detected), same logic as FirstAidRegisterTab
                      const faCertAiders = [];
                      Object.entries(extCerts||{}).forEach(([uid2, certs2])=>{
                        if(certs2.first_aid){ const u2=staffList.find(s=>String(s.id)===String(uid2)); if(u2) faCertAiders.push({id:`cert_${uid2}`,expiryDate:certs2.first_aid.expiryDate||"",shifts:certs2.first_aid.shifts||[],zones:certs2.first_aid.zones||[]}); }
                      });
                      const manualIds = new Set(faAiders.filter(a=>a.staffId).map(a=>String(a.staffId)));
                      const allFaAiders = [...faAiders, ...faCertAiders.filter(c=>!manualIds.has(String(c.staffId||c.id.replace("cert_",""))))];
                      const validAiders = allFaAiders.filter(a=>{ if(!a.expiryDate) return false; return Math.ceil((new Date(a.expiryDate)-new Date())/86400000)>=0; });
                      const expiredCount = allFaAiders.length - validAiders.length;
                      // A "gap" = a zone/shift combination with fewer valid first aiders than minPerShift.
                      // Keep in step with the equivalent logic in FirstAidRegisterTab.jsx.
                      // Count coverage gaps
                      const SHIFTS3 = coverShifts(getSiteLists().firstAidShifts);   // this site's shifts (Site Settings)
                      let gapCount = 0;
                      faAllZones.forEach(zone=>{
                        SHIFTS3.forEach(shift=>{
                          const count = validAiders.filter(a=>{
                            const shiftsOk = !a.shifts?.length || a.shifts.some(isAllShift) || a.shifts.includes(shift);
                            const zonesOk  = !a.zones?.length  || a.zones.includes(zone);
                            return shiftsOk && zonesOk;
                          }).length;
                          if(count < minPerShift) gapCount++;
                        });
                      });
                      const sub = validAiders.length===0 ? "No qualified first aiders" :
                        gapCount>0 ? `${gapCount} zone/shift gap${gapCount!==1?"s":""}` :
                        expiredCount>0 ? `${expiredCount} cert${expiredCount!==1?"s":""} expired` :
                        "All shifts covered";
                      const isAlert = validAiders.length===0 || gapCount>0 || expiredCount>0;
                      return card(E("🩺",""),"First Aid",validAiders.length,sub,null,isAlert,()=>setAtab("firstaid"));
                    })() },
                  ];

                  // Saved order is filtered against current card ids, and any NEW cards are appended — so
                  // adding/removing a card in statCardDefs never breaks a saved layout.
                  const defaultOrder = statCardDefs.map(c => c.id);
                  const savedOrder = (dashboardLayouts[String(user.id)] || []).filter(id => defaultOrder.includes(id));
                  const order = [...savedOrder, ...defaultOrder.filter(id => !savedOrder.includes(id))];
                  const nodeById = Object.fromEntries(statCardDefs.map(c => [c.id, c.node]));

                  const onReorder = newOrder => {
                    setDashboardLayouts(prev => ({ ...prev, [String(user.id)]: newOrder }));
                    dbWrite(sb.from("dashboard_layout").upsert({ user_id: String(user.id), card_order: newOrder }, { onConflict: "user_id" }), "dashboard layout");
                  };
                  const gridStyle = {display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:14,marginBottom:28};
                  // the drag-and-drop grid loads separately; until then the same cards show without handles
                  return (
                    <React.Suspense fallback={<div style={gridStyle}>{order.map(id => <div key={id}>{nodeById[id]}</div>)}</div>}>
                      <LazySortableStatGrid order={order} nodeById={nodeById} onReorder={onReorder} gridStyle={gridStyle}/>
                    </React.Suspense>
                  );
                })()}

                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20}}>
                  {/* Incomplete training */}
                  {section("Staff with incomplete training",
                    listCard(overdueTraining,"All staff training complete",u=>{
                      const a=(assigns[u.id]||[]).length;
                      const d=(assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length;
                      const pct=a?Math.min(100,Math.round(d/a*100)):0;
                      return (<>
                        <Avatar name={u.name} size={28}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
                          <div style={{fontSize:11,color:T.muted}}>{d}/{a} modules · {pct}%</div>
                        </div>
                        <button onClick={()=>{setBulkTarget("individual");setTarget(String(u.id));setAtab("assign");}} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:`1px solid ${T.accent}33`,borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>Assign →</button>
                      </>);
                    },()=>showStaff("incomplete"))
                  )}

                  {/* Open incidents */}
                  {section("Open incidents",
                    listCard(openIncidents2,"No open incidents",inc=>(
                      <>
                        <span style={{fontSize:18,flexShrink:0}}>{{accident:"🚑",near_miss:"⚠️",unsafe_condition:"🏗",unsafe_act:"🚫"}[inc.type]||"📋"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inc.description?.slice(0,60)}{inc.description?.length>60?"…":""}</div>
                          <div style={{fontSize:11,color:T.muted}}>{inc.date} · {inc.location}</div>
                        </div>
                        {inc.riddor&&!inc.riddorReported&&<span style={{fontSize:10,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,0.1)",padding:"2px 7px",borderRadius:6,border:"1px solid rgba(239,68,68,0.25)",flexShrink:0}}>RIDDOR ⚠</span>}
                        <button onClick={()=>{setFocusIncidentId(inc.id);setAtab("incidents");}} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>View →</button>
                      </>
                    ),showOpenIncidents)
                  )}

                  {/* Equipment overdue */}
                  {section("Equipment service due",
                    listCard([...overdueEquipment,...soonEquipment].slice(0,5),"All equipment servicing up to date",e=>{
                      const overdue = e.nextService<today;
                      const days = Math.ceil((new Date(e.nextService)-new Date())/86400000);
                      return (<>
                        <span style={{fontSize:18,flexShrink:0}}>🔧</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</div>
                          <div style={{fontSize:11,color:overdue?"#f87171":"#f59e0b"}}>{overdue?`Overdue by ${Math.abs(days)}d`:`Due in ${days}d`} · {e.location||"—"}</div>
                        </div>
                        <button onClick={()=>setAtab("equipment")} style={{background:"rgba(245,158,11,0.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.2)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>View →</button>
                      </>);
                    },()=>setAtab("equipment"))
                  )}

                  {/* Expiring external certs */}
                  {section("Expired external certificates",
                    listCard(expiredExtCerts,"All external certificates valid",(item)=>(
                      <>
                        <span style={{fontSize:18,flexShrink:0}}>{item.certType.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.user.name}</div>
                          <div style={{fontSize:11,color:"#f87171"}}>{item.certType.label} expired {item.cert.expiryDate}</div>
                        </div>
                        <button onClick={()=>setAtab("assign")} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>Update →</button>
                      </>
                    ),()=>setAtab("assign"))
                  )}
                </div>

                {/* Recent activity */}
                {section("Recent incidents (last 30 days)",
                  listCard(last30Inc,"No incidents in the last 30 days",inc=>(
                    <>
                      <span style={{fontSize:16,flexShrink:0}}>{{accident:"🚑",near_miss:"⚠️",unsafe_condition:"🏗",unsafe_act:"🚫"}[inc.type]||"📋"}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inc.description?.slice(0,70)}{inc.description?.length>70?"…":""}</div>
                        <div style={{fontSize:11,color:T.muted}}>{inc.date} · {inc.location} · {inc.closed?"Closed":"Open"}</div>
                      </div>
                    </>
                  ),()=>setAtab("incidents"))
                )}
              </div>
            );
          })()}

          {/* ── STAFF MANAGEMENT: bulk password reset, CSV import, add-staff form, filterable staff table ── */}
          {atab==="users" && (<div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div>
                  <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Staff Accounts <HelpTip dark={false} text="All registered portal users. Use Edit to update roles, job titles and managers. Marking someone as Admin gives them full access to this panel. Removing a staff member does not delete their training records."/></h2>
                  <p style={{color:T.muted,margin:0,fontSize:13}}>{staff.length} staff member{staff.length!==1?"s":""} registered</p>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>setStaffGroupByTeam(g=>!g)}
                    style={{background:staffGroupByTeam?`linear-gradient(135deg,${T.navyMd},${T.navy})`:T.overlay,color:staffGroupByTeam?T.gold:T.muted,border:`1px solid ${staffGroupByTeam?T.gold:T.borderMd}`,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                    👥 {staffGroupByTeam?"By Team ✓":"Group by Team"}
                  </button>
                  <button onClick={()=>setShowWelcomeSettings(true)} title="The video new staff see the first time they sign in"
                    style={{background:T.overlay,color:T.white,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                    {E("🎬 ","")}Welcome video
                  </button>
                  <button onClick={()=>setShowCsvImport(v=>!v)}
                    style={{background:showCsvImport?"rgba(239,68,68,0.1)":"rgba(16,185,129,0.1)",color:showCsvImport?"#f87171":T.green,border:showCsvImport?"1px solid rgba(239,68,68,0.25)":"1px solid rgba(16,185,129,0.25)",borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                    📥 {showCsvImport?"✕ Cancel":"Import CSV"}
                  </button>
                  <button onClick={()=>{setShowBulkReset(s=>!s);setBulkResetPw("");setBulkResetDone(false);setBulkResetSelected([]);}}
                    style={{background:showBulkReset?`linear-gradient(135deg,#b91c1c,#991b1b)`:"rgba(239,68,68,0.1)",color:showBulkReset?"#fff":"#f87171",border:showBulkReset?"none":"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                    🔑 {showBulkReset?"✕ Cancel":"Reset Passwords"}
                  </button>
                  <button onClick={()=>{setShowAddStaff(s=>!s);setAddErr("");}}
                    style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:`0 4px 16px ${T.accent}44`,display:"flex",alignItems:"center",gap:6}}>
                    {showAddStaff ? "✕ Cancel" : "+ Add Staff Member"}
                  </button>
                </div>
              </div>

              {/* Line managers: My Team matches each staff member's Line Manager text to the
                  name of an account with the "Line manager" role. Flag the ones that don't match. */}
              <datalist id="zp-manager-names">{allUsers.filter(u=>u.role==="manager").map(u=><option key={u.id} value={u.name}/>)}</datalist>
              {(()=>{
                const nm = x => String(x||"").trim().replace(/\s+/g," ").toLowerCase();
                const mgrs = allUsers.filter(u=>u.role==="manager");
                if (!mgrs.length) return null;
                const names = new Set(mgrs.map(u=>nm(u.name)));
                const unmatched = staff.filter(u=>(u.status||"active")!=="leaver" && nm(u.manager) && !names.has(nm(u.manager)));
                if (!unmatched.length) return null;
                const lm = Array.from(new Set(unmatched.map(u=>u.manager.trim())));
                return (
                  <div style={{background:`${T.amber}14`,border:`1px solid ${T.amber}55`,borderRadius:12,padding:"12px 16px",marginBottom:18,fontSize:13,color:T.slate,lineHeight:1.5}}>
                    <b style={{color:T.amber}}>{unmatched.length} staff member{unmatched.length!==1?"s have a Line Manager":" has a Line Manager"} with no line-manager account:</b> {lm.slice(0,8).join(", ")}{lm.length>8?` +${lm.length-8} more`:""}.
                    {" "}They won't appear in anyone's My Team. Edit the staff record so the Line Manager matches a manager's name exactly, or give that person the <b>Line manager</b> role.
                  </div>
                );
              })()}

              {/* Sign-in accounts (Supabase sign-in mode only) */}
              {AUTH_MODE==="supabase" && <SignInAccountsPanel users={allUsers} onShowPasswords={setTempPwNotice} Z={T} font={font}/>}

              {/* Bulk Password Reset Panel */}
              {showBulkReset && (
                <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:20,border:"1px solid rgba(239,68,68,0.3)"}}>
                  <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:700,letterSpacing:.5,color:"#f87171",textTransform:"uppercase"}}>🔑 Bulk Password Reset</h3>
                  <p style={{color:T.muted,fontSize:12,marginBottom:18}}>Reset passwords for multiple staff members at once. They will need to change their password on next login.</p>

                  {bulkResetDone ? (
                    <div style={{padding:"14px 18px",background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,color:T.green,fontWeight:700,fontSize:13}}>
                      ✓ Passwords reset successfully for {bulkResetScope==="all"?staff.length:bulkResetSelected.length} staff member{(bulkResetScope==="all"?staff.length:bulkResetSelected.length)!==1?"s":""}.
                      <button onClick={()=>{setShowBulkReset(false);setBulkResetDone(false);}} style={{marginLeft:12,background:"none",border:"none",color:T.green,cursor:"pointer",fontSize:12,fontWeight:700,textDecoration:"underline"}}>Close</button>
                    </div>
                  ) : (
                    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
                      <div>
                        <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>APPLY TO</label>
                        <div style={{display:"flex",gap:8,marginBottom:14}}>
                          {[["all","All Staff"],["selected","Selected Staff"]].map(([val,lbl])=>(
                            <button key={val} onClick={()=>setBulkResetScope(val)}
                              style={{flex:1,padding:"8px 14px",borderRadius:9,border:`2px solid ${bulkResetScope===val?"#f87171":T.borderMd}`,background:bulkResetScope===val?"rgba(239,68,68,0.12)":T.overlay,color:bulkResetScope===val?"#f87171":T.muted,fontWeight:bulkResetScope===val?700:400,cursor:"pointer",fontFamily:font,fontSize:12,transition:"all .15s"}}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                        {bulkResetScope==="selected" && (
                          <div style={{maxHeight:160,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:8,marginBottom:14}}>
                            {staff.map((u,i)=>(
                              <div key={u.id} onClick={()=>setBulkResetSelected(p=>p.includes(String(u.id))?p.filter(x=>x!==String(u.id)):[...p,String(u.id)])}
                                style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",background:bulkResetSelected.includes(String(u.id))?"rgba(239,68,68,0.06)":"transparent"}}>
                                <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${bulkResetSelected.includes(String(u.id))?"#ef4444":T.borderMd}`,background:bulkResetSelected.includes(String(u.id))?"#ef4444":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  {bulkResetSelected.includes(String(u.id))&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
                                </div>
                                <Avatar name={u.name} size={20}/>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,fontWeight:600,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
                                  <div style={{fontSize:10,color:T.muted}}>{u.jobTitle||u.email}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>NEW PASSWORD</label>
                        <input value={bulkResetPw} onChange={e=>setBulkResetPw(e.target.value)} placeholder="Enter new password for selected staff"
                          style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box",marginBottom:8}}/>
                        {bulkResetPw && bulkResetPw.length < (AUTH_MODE==="supabase"?8:6) && <div style={{fontSize:11,color:"#f87171",marginBottom:8}}>Password must be at least {AUTH_MODE==="supabase"?8:6} characters</div>}
                        <div style={{fontSize:11,color:T.muted,marginBottom:14}}>
                          This will reset passwords for <strong style={{color:T.white}}>{bulkResetScope==="all"?staff.length:bulkResetSelected.length} staff member{(bulkResetScope==="all"?staff.length:bulkResetSelected.length)!==1?"s":""}</strong>.
                        </div>
                        <button
                          disabled={!bulkResetPw||bulkResetPw.length<(AUTH_MODE==="supabase"?8:6)||(bulkResetScope==="selected"&&bulkResetSelected.length===0)}
                          onClick={async()=>{
                            const targets = bulkResetScope==="all" ? staff.map(u=>u.id) : bulkResetSelected;
                            if (AUTH_MODE === "supabase") {
                              // Temporary password on each sign-in account; leavers are skipped.
                              const failures = [];
                              for (const id of targets) {
                                const su = allUsers.find(x=>x.id===id); if (!su || (su.status||"active")==="leaver") continue;
                                const r = await setTempPasswordFor(su, bulkResetPw);
                                if (!r.ok) failures.push({ name: su.name, error: r.error });
                              }
                              if (failures.length) setTempPwNotice({ title: "Some passwords weren't reset", items: [], failures });
                            } else {
                            const hashed = await hashPassword(bulkResetPw);
                            // One write per selected user (savePasswordFor updates state + that row only).
                            await Promise.all(targets.map(id=>savePasswordFor(id, hashed)));
                            }
                            setBulkResetDone(true);
                            setBulkResetPw("");
                          }}
                          style={{width:"100%",background:(!bulkResetPw||bulkResetPw.length<6||(bulkResetScope==="selected"&&bulkResetSelected.length===0))?"rgba(239,68,68,0.3)":`linear-gradient(135deg,#ef4444,#b91c1c)`,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:(!bulkResetPw||bulkResetPw.length<6)?"not-allowed":"pointer",fontFamily:font,fontSize:13,opacity:(!bulkResetPw||bulkResetPw.length<6||(bulkResetScope==="selected"&&bulkResetSelected.length===0))?.5:1}}>
                          🔑 Reset {bulkResetScope==="all"?"All":bulkResetSelected.length} Password{(bulkResetScope==="all"?staff.length:bulkResetSelected.length)!==1?"s":""}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CSV Import Panel */}
              {showCsvImport && (
                <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:20,border:"1px solid rgba(16,185,129,0.3)"}}>
                  <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:700,letterSpacing:.5,color:T.green,textTransform:"uppercase"}}>📥 Import Staff from CSV</h3>
                  <p style={{color:T.muted,fontSize:12,marginBottom:16}}>Upload a CSV file with columns: <code style={{color:T.gold,background:"rgba(245,158,11,0.1)",padding:"1px 6px",borderRadius:4}}>name, email, jobTitle, manager, department, role</code> — role should be "admin" or "staff".</p>
                  {csvError && <div style={{marginBottom:12,padding:"8px 14px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,color:"#f87171",fontSize:12}}>{csvError}</div>}
                  <label style={{display:"inline-flex",alignItems:"center",gap:8,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,marginBottom:csvPreview.length>0?16:0}}>
                    📂 Choose CSV File
                    <input type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={e=>{
                      const file=e.target.files[0]; if(!file) return;
                      setCsvError(""); setCsvPreview([]);
                      // Simple CSV parser: splits on commas, so a quoted value containing a comma
                      // (e.g. "Smith, John") will be mis-split. Use a CSV library if that's needed.
                      const reader=new FileReader();
                      reader.onload=ev=>{
                        const lines=ev.target.result.replace(/\r/g,"").split("\n").filter(l=>l.trim());
                        if(lines.length<2){setCsvError("CSV must have a header row and at least one data row.");return;}
                        const headers=lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/[^a-z]/g,""));
                        const nameIdx=headers.findIndex(h=>h==="name"||h==="fullname");
                        const emailIdx=headers.findIndex(h=>h==="email");
                        if(nameIdx===-1||emailIdx===-1){setCsvError("CSV must have 'name' and 'email' columns.");return;}
                        const jobIdx=headers.findIndex(h=>h==="jobtitle"||h==="title"||h==="position");
                        const managerIdx=headers.findIndex(h=>h==="manager");
                        const deptIdx=headers.findIndex(h=>h==="department"||h==="dept");
                        const roleIdx=headers.findIndex(h=>h==="role");
                        const rows=lines.slice(1).map(line=>{
                          const cols=line.split(",").map(c=>c.trim().replace(/^"|"$/g,""));
                          return {name:cols[nameIdx]||"",email:cols[emailIdx]||"",jobTitle:jobIdx>-1?cols[jobIdx]||"":"",manager:managerIdx>-1?cols[managerIdx]||"":"",department:deptIdx>-1?cols[deptIdx]||"":"",role:roleIdx>-1?cols[roleIdx]||"staff":"staff"};
                        }).filter(r=>r.name&&r.email);
                        if(rows.length===0){setCsvError("No valid rows found. Check name and email columns.");return;}
                        setCsvPreview(rows);
                      };
                      reader.readAsText(file);
                      e.target.value="";
                    }}/>
                  </label>
                  {csvPreview.length>0 && (
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:T.green,marginBottom:8}}>✓ Preview — {csvPreview.length} staff found</div>
                      <div style={{maxHeight:200,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:10,marginBottom:14}}>
                        {csvPreview.slice(0,10).map((r,i)=>(
                          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"8px 14px",borderTop:i>0?`1px solid ${T.border}`:"none",fontSize:12}}>
                            <span style={{color:T.white,fontWeight:600}}>{r.name}</span>
                            <span style={{color:T.muted}}>{r.email}</span>
                            <span style={{color:T.muted}}>{r.jobTitle||r.department||r.role}</span>
                          </div>
                        ))}
                        {csvPreview.length>10 && <div style={{padding:"6px 14px",fontSize:11,color:T.muted,borderTop:`1px solid ${T.border}`}}>+{csvPreview.length-10} more…</div>}
                      </div>
                      <button onClick={async()=>{
                        const existingEmails=new Set(staff.map(u=>u.email.toLowerCase()));
                        const toAdd=csvPreview.filter(r=>!existingEmails.has(r.email.toLowerCase()));
                        const skipped=csvPreview.length-toAdd.length;
                        if(toAdd.length===0){setCsvError("All emails already exist in the system.");return;}
                        const hashed = AUTH_MODE==="supabase" ? null : await hashPassword("pass123");
                        // Imported users get sequential numeric ids after the current max id.
                        const maxId=Math.max(0,...allUsers.map(u=>u.id));
                        const newUsers=toAdd.map((r,i)=>({id:maxId+i+1,name:r.name.trim(),email:r.email.trim().toLowerCase(),jobTitle:r.jobTitle,manager:r.manager,department:r.department,role:["admin","manager"].includes(r.role)?r.role:"staff",isWarehouseWorker:false,status:"active",...(hashed?{password:hashed}:{})}));
                        if (AUTH_MODE === "supabase") {
                          // Save the records, then give each person a sign-in account with a temporary password.
                          setAllUsers(p=>[...p,...newUsers]);
                          newUsers.forEach(u=>dbSaveUserProfile(u));
                          await Promise.all(newUsers.map(u=>dbSaveUser(u)));
                          giveNewStarterBundles(newUsers.map(u=>u.id));
                          const passwords = Object.fromEntries(newUsers.map(u=>[String(u.id), makeTempPassword()]));
                          const r = await adminCall("createMissing", { passwords });
                          const byId = Object.fromEntries(newUsers.map(u=>[String(u.id), u]));
                          const results = r.ok ? (r.results||[]) : newUsers.map(u=>({ userId:String(u.id), ok:false, error:r.error }));
                          setTempPwNotice({ title: `Imported ${toAdd.length} staff${skipped>0?` (${skipped} skipped: email already exists)`:""}`,
                            items: results.filter(x=>x.ok).map(x=>({ name: byId[x.userId].name, login: byId[x.userId].email, password: passwords[x.userId] })),
                            failures: results.filter(x=>!x.ok).map(x=>({ name: (byId[x.userId]||{}).name, error: x.error })) });
                          setCsvPreview([]);
                          setShowCsvImport(false);
                          return;
                        }
                        newUsers.forEach(u=>{
                          setAllUsers(p=>[...p,u]);
                          dbSaveUser(u);
                          dbSaveUserProfile(u);
                          savePasswordFor(u.id,hashed);
                        });
                        giveNewStarterBundles(newUsers.map(u=>u.id));
                        setCsvPreview([]);
                        setShowCsvImport(false);
                        notify(`✓ Imported ${toAdd.length} staff.${skipped>0?` ${skipped} skipped (email already exists).`:""} Default password: pass123`, { timeout: 10000 });
                      }} style={{background:`linear-gradient(135deg,${T.green},#059669)`,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,boxShadow:"0 4px 14px rgba(16,185,129,0.3)"}}>
                        ✓ Import {csvPreview.length} Staff
                      </button>
                      {csvPreview.length!==csvPreview.filter(r=>!staff.some(u=>u.email.toLowerCase()===r.email.toLowerCase())).length && (
                        <span style={{fontSize:11,color:T.muted,marginLeft:12}}>{csvPreview.filter(r=>staff.some(u=>u.email.toLowerCase()===r.email.toLowerCase())).length} duplicate email{csvPreview.filter(r=>staff.some(u=>u.email.toLowerCase()===r.email.toLowerCase())).length!==1?"s":""} will be skipped</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Add Staff Form */}
              {showAddStaff && (
                <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:20,border:`1px solid ${T.accent}44`}}>
                  <h3 style={{margin:"0 0 18px",fontSize:14,fontWeight:700,letterSpacing:.5,color:T.muted}}>NEW STAFF MEMBER</h3>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:14}}>
                    <div>
                      <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>FULL NAME *</label>
                      <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Jane Doe"
                        style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>EMAIL ADDRESS *</label>
                      <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="jane@zeus.com"
                        style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>JOB TITLE</label>
                      <input value={newJobTitle} onChange={e=>setNewJobTitle(e.target.value)} placeholder="e.g. Warehouse Operative"
                        style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>LINE MANAGER</label>
                      <input value={newManager} onChange={e=>setNewManager(e.target.value)} placeholder="e.g. John Smith" list="zp-manager-names"
                        style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>PORTAL ROLE</label>
                      <select value={newRole} onChange={e=>setNewRole(e.target.value)}
                        style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer",boxSizing:"border-box"}}>
                        <option value="staff">Staff</option>
                        <option value="manager">Line manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  {/* Department */}
                  <div style={{marginBottom:14}}>
                    <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:1,display:"block",marginBottom:6}}>DEPARTMENT</label>
                    <input value={newDepartment} onChange={e=>setNewDepartment(e.target.value)} placeholder="e.g. Warehouse, Sales, Finance"
                      style={{width:"100%",padding:"11px 14px",background:T.headerBg,border:`1px solid ${T.borderMd}`,borderRadius:10,color:T.white,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:font}}/>
                  </div>
                  {/* Status */}
                  <div style={{marginBottom:14}}>
                    <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:1,display:"block",marginBottom:6}}>STATUS</label>
                    <div style={{display:"flex",gap:8}}>
                      {[["active","✓ Active","#10b981"],["inactive","⏸ Inactive","#f59e0b"],["leaver","👋 Leaver","#94a3b8"]].map(([val,lbl,col])=>(
                        <button key={val} onClick={()=>setNewStatus(val)}
                          style={{flex:1,padding:"8px",borderRadius:9,border:`2px solid ${newStatus===val?col:T.borderMd}`,background:newStatus===val?`${col}18`:T.overlay,color:newStatus===val?col:T.muted,fontWeight:newStatus===val?700:400,cursor:"pointer",fontFamily:font,fontSize:12}}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Warehouse Worker toggle */}
                  <div onClick={()=>setNewIsWarehouse(s=>!s)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderRadius:12,marginBottom:14,cursor:"pointer",userSelect:"none",background:newIsWarehouse?"rgba(245,158,11,0.08)":T.overlay,border:`2px solid ${newIsWarehouse?"rgba(245,158,11,0.4)":T.borderMd}`,transition:"all .2s"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:T.white,marginBottom:2}}>🏗 Is Warehouse Worker?</div>
                      <div style={{fontSize:11,color:T.muted}}>Tick to enable machinery competence tracking for this person</div>
                    </div>
                    <div style={{flexShrink:0,marginLeft:16,width:44,height:24,borderRadius:12,background:newIsWarehouse?"#f59e0b":T.borderMd,position:"relative",transition:"background .2s"}}>
                      <div style={{position:"absolute",top:3,left:newIsWarehouse?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <button onClick={addStaff}
                      style={{background:`linear-gradient(135deg,${T.green},#059669)`,color:T.white,border:"none",borderRadius:10,padding:"10px 24px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:14,boxShadow:"0 4px 14px rgba(16,185,129,0.4)"}}>
                      ✓ Create Account
                    </button>
                    {AUTH_MODE==="supabase"
                      ? <p style={{color:T.muted,fontSize:12,margin:0}}>A temporary password is created and shown once. They choose their own at first sign-in.</p>
                      : <p style={{color:T.muted,fontSize:12,margin:0}}>Default password: <code style={{color:T.gold,background:"rgba(245,158,11,0.1)",padding:"2px 8px",borderRadius:4}}>pass123</code></p>}
                  </div>
                  {addErr && <p style={{color:"#f87171",fontSize:13,margin:"10px 0 0"}}>{addErr}</p>}
                </div>
              )}

              {/* Filter bar */}
              {(()=>{
                const managers = ["all", ...Array.from(new Set(staff.map(u=>u.manager||"").filter(Boolean))).sort()];
                const selStyle = {background:T.headerBg,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"8px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"};
                const filteredStaff = staff.filter(u=>{
                  if (staffStatusFilter!=="all" && (u.status||"active")!==staffStatusFilter) return false;
                  if (staffDeptFilter!=="all" && (u.department||"")!==staffDeptFilter) return false;
                  if (staffFilterManager!=="all" && (u.manager||"")!==staffFilterManager) return false;
                  if (staffFilterSearch) {
                    const q = staffFilterSearch.toLowerCase();
                    if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.jobTitle||"").toLowerCase().includes(q)) return false;
                  }
                  if (staffFilterProgress!=="all") {
                    const a=(assigns[u.id]||[]).length;
                    const d=(assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length;
                    const pct=a?Math.min(100, Math.round(d/a*100)):0;
                    if (staffFilterProgress==="compliant" && pct!==100) return false;
                    if (staffFilterProgress==="inprogress" && (pct===100||pct===0)) return false;
                    if (staffFilterProgress==="overdue" && (a===0 || pct!==0)) return false;   // nothing started (people with no modules are under "No Modules")
                    if (staffFilterProgress==="incomplete" && !(a>0 && d<a)) return false;    // dashboard "Training Incomplete"
                    if (staffFilterProgress==="pastdue" && !(assigns[u.id]||[]).some(mid=>{ const di=dueInfo(dueDates,u.id,mid,isPassed((comps[u.id]||{})[mid])); return di&&di.overdue; })) return false;
                    if (staffFilterProgress==="none" && a!==0) return false;
                  }
                  return true;
                });
                const activeFilters = (staffFilterManager!=="all"?1:0)+(staffFilterSearch?1:0)+(staffFilterProgress!=="all"?1:0)+(staffStatusFilter!=="all"?1:0);
                // Tick boxes for bulk actions. Ticks survive filtering, so you can tick people from different searches.
                const shownIds = filteredStaff.map(u=>String(u.id));
                const selIds = staffSel.filter(id=>staff.some(u=>String(u.id)===id));
                const allShownSel = shownIds.length>0 && shownIds.every(id=>selIds.includes(id));
                const someShownSel = shownIds.some(id=>selIds.includes(id));
                const toggleSel = id => setStaffSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
                const toggleMany = (ids, on) => setStaffSel(p=>on?[...new Set([...p,...ids])]:p.filter(id=>!ids.includes(id)));
                const runBulk = async fn => { if (await fn(selIds)) setStaffSel([]); };
                // Group by Team: sorted by line manager, with a heading (and tick box) per team
                const teamOf2 = u => (u.manager||"").trim() || "No line manager";
                // Column sort (click a heading); with Group by Team, sorted within each team
                const pctOf = u => { const a=(assigns[u.id]||[]).length; if(!a) return null; return Math.round((assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length/a*100); };
                const ordered = sortRows(filteredStaff, staffSort, {
                  name: u=>u.name, email: u=>String(u.email||"").toLowerCase(), job: u=>u.jobTitle, manager: u=>u.manager,
                  progress: pctOf, last: u=>lastLoginMap[u.id]||"0000",
                }, staffGroupByTeam ? (a,b)=>((teamOf2(a)==="No line manager")-(teamOf2(b)==="No line manager") || teamOf2(a).localeCompare(teamOf2(b))) : null);
                const sh = (label, by) => <SortButton label={label} by={by} sort={staffSort} onSort={setStaffSortBy} Z={T} font={font}/>;
                const teamHead = (u,i,mobile) => {
                  if (!staffGroupByTeam || (i>0 && teamOf2(ordered[i-1])===teamOf2(u))) return null;
                  const ids = ordered.filter(x=>teamOf2(x)===teamOf2(u)).map(x=>String(x.id));
                  const on = ids.every(id=>selIds.includes(id)), some = ids.some(id=>selIds.includes(id));
                  return (
                    <div key={`team-${teamOf2(u)}`} data-testid="team-head" style={{display:"flex",alignItems:"center",gap:10,padding:mobile?"10px 4px 6px":"10px 20px",background:mobile?"transparent":T.overlay,borderTop:i>0&&!mobile?`1px solid ${T.border}`:"none",fontSize:12,fontWeight:800,color:T.gold,letterSpacing:.3}}>
                      <input type="checkbox" checked={on} ref={el=>{ if(el) el.indeterminate=!on&&some; }} onChange={()=>toggleMany(ids,!on)} aria-label={`Tick everyone in ${teamOf2(u)}'s team`} style={{width:16,height:16,cursor:"pointer"}}/>
                      <span>{teamOf2(u)==="No line manager"?"No line manager":`${teamOf2(u)}'s team`}</span>
                      <span style={{color:T.muted,fontWeight:600}}>· {ids.length}</span>
                    </div>
                  );
                };
                const bulkBtn = (label, fn, danger) => (
                  <button onClick={()=>runBulk(fn)} style={{background:danger?"rgba(239,68,68,0.12)":T.overlay,color:danger?"#f87171":T.white,border:`1px solid ${danger?"rgba(239,68,68,0.35)":T.borderMd}`,borderRadius:9,padding:"8px 13px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>{label}</button>
                );
                return (
                  <>
                    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"14px 18px",marginBottom:14,border:`1px solid ${T.border}`,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                      {/* Search */}
                      <div style={{position:"relative",flex:"1 1 180px",minWidth:150}}>
                        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:T.muted,fontSize:14,pointerEvents:"none"}}>🔍</span>
                        <input value={staffFilterSearch} onChange={e=>setStaffFilterSearch(e.target.value)} placeholder="Search name, email, job title..."
                          style={{...selStyle,paddingLeft:36,width:"100%",boxSizing:"border-box"}}/>
                      </div>
                      {/* Status filter */}
                      <select value={staffStatusFilter} onChange={e=>setStaffStatusFilter(e.target.value)} style={selStyle}>
                        <option value="all">All Status</option>
                        <option value="active">✓ Active</option>
                        <option value="inactive">⏸ Inactive</option>
                        <option value="leaver">👋 Leavers</option>
                      </select>
                      {/* Manager filter */}
                      <select value={staffFilterManager} onChange={e=>setStaffFilterManager(e.target.value)} style={selStyle}>
                        <option value="all">All Managers</option>
                        {managers.filter(m=>m!=="all").map(m=><option key={m} value={m}>{m}</option>)}
                        {staff.some(u=>!u.manager) && <option value="">No Manager</option>}
                      </select>
                      {/* Progress filter */}
                      <select value={staffFilterProgress} onChange={e=>setStaffFilterProgress(e.target.value)} style={selStyle}>
                        <option value="all">All Progress</option>
                        <option value="compliant">✓ Compliant</option>
                        <option value="incomplete">Not complete (any)</option>
                        <option value="pastdue">Past due date</option>
                        <option value="inprogress">In Progress</option>
                        <option value="overdue">Not started</option>
                        <option value="none">No Modules</option>
                      </select>
                      {/* Clear */}
                      {activeFilters>0 && (
                        <button onClick={()=>{setStaffFilterManager("all");setStaffFilterSearch("");setStaffFilterProgress("all");setStaffStatusFilter("all");}}
                          style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                          ✕ Clear {activeFilters} filter{activeFilters!==1?"s":""}
                        </button>
                      )}
                      <span style={{color:T.muted,fontSize:12,marginLeft:"auto",whiteSpace:"nowrap"}}>
                        {filteredStaff.length} of {staff.length} staff
                      </span>
                    </div>

                    {/* Bulk actions for the ticked people */}
                    {selIds.length>0 && (
                      <div role="region" aria-label="Bulk actions" data-testid="bulk-bar" style={{position:"sticky",top:8,zIndex:20,background:`linear-gradient(135deg,${T.accent},${T.blue})`,borderRadius:14,padding:"10px 14px",marginBottom:14,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",boxShadow:"0 10px 30px rgba(0,0,0,.35)"}}>
                        <span style={{fontWeight:800,fontSize:13,color:"#fff",marginRight:6}}>{selIds.length} ticked{selIds.some(id=>!shownIds.includes(id))?` (${selIds.filter(id=>!shownIds.includes(id)).length} not shown)`:""}</span>
                        {bulkBtn(E("📚 ","")+"Assign a module", bulkAssignModule)}
                        {bulkBtn(E("📦 ","")+"Give a document bundle", bulkGiveBundle)}
                        {bulkBtn(E("👤 ","")+"Set line manager", bulkSetManager)}
                        {bulkBtn(E("👋 ","")+"Mark as leavers", bulkMarkLeavers, true)}
                        <button onClick={()=>setStaffSel([])} style={{marginLeft:"auto",background:"transparent",border:"1px solid rgba(255,255,255,.45)",color:"#fff",borderRadius:9,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>Clear ticks</button>
                      </div>
                    )}

                    {/* Staff Table */}
                    {isMobile ? (
                      <div>
                        {filteredStaff.length===0 && <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14}}>{staff.length===0?"No staff members yet.":"No staff match filters."}</div>}
                        {filteredStaff.length>0 && (
                          <label style={{display:"flex",alignItems:"center",gap:10,fontSize:13,color:T.muted,padding:"4px 4px 10px",cursor:"pointer"}}>
                            <input type="checkbox" checked={allShownSel} ref={el=>{ if(el) el.indeterminate=!allShownSel&&someShownSel; }} onChange={()=>toggleMany(shownIds,!allShownSel)} style={{width:20,height:20}}/>
                            Tick everyone shown ({shownIds.length})
                          </label>
                        )}
                        {ordered.map((u,i)=>{
                          const a=(assigns[u.id]||[]).length, d=(assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length;
                          const pct=a?Math.min(100, Math.round(d/a*100)):0;
                          const barColor=pct===100?T.green:pct>=50?T.accent:"#ef4444";
                          const lastActive=lastLoginMap[u.id];
                          return (
                            <React.Fragment key={u.id}>
                            {teamHead(u,i,true)}
                            <MobileCard>
                              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                                <input type="checkbox" checked={selIds.includes(String(u.id))} onChange={()=>toggleSel(String(u.id))} aria-label={`Tick ${u.name}`} style={{width:20,height:20,flexShrink:0}}/>
                                <Avatar name={u.name} size={36}/>
                                <div>
                                  <div style={{fontWeight:700,fontSize:15,color:T.white}}>{u.name}</div>
                                  <div style={{fontSize:12,color:T.muted}}>{u.email}</div>
                                </div>
                              </div>
                              {u.jobTitle && <MobileCardRow label="Job Title" value={<span>{u.jobTitle}{u.isWarehouseWorker&&" 🏗"}</span>}/>}
                              {u.manager && <MobileCardRow label="Manager" value={u.manager}/>}
                              <MobileCardRow label="Progress" value={<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,color:barColor}}>{d}/{a}</span><Bar pct={pct} color={barColor}/></div>}/>
                              <MobileCardRow label="Last Active" value={<span style={{color:lastActive?T.muted:"#f87171"}}>{lastActive?lastActive.slice(0,10):"Never"}</span>}/>
                              <div style={{display:"flex",gap:8,marginTop:4}}>
                                <button onClick={()=>setEditingStaff(u)} style={{flex:1,background:"rgba(37,99,235,0.15)",color:T.accentLt,border:`1px solid ${T.accent}44`,borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>✏ Edit</button>
                                <button onClick={()=>removeStaff(u.id)} style={{flex:1,background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>Remove</button>
                              </div>
                            </MobileCard>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ) : (
                    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
                      <div style={{display:"grid",gridTemplateColumns:"34px 2fr 2fr 2fr 2fr 2fr 120px 160px",padding:"12px 20px",background:T.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase",columnGap:0,alignItems:"center"}}>
                        <span><input type="checkbox" checked={allShownSel} ref={el=>{ if(el) el.indeterminate=!allShownSel&&someShownSel; }} onChange={()=>toggleMany(shownIds,!allShownSel)} aria-label={`Tick everyone shown (${shownIds.length})`} title="Tick everyone shown" disabled={!shownIds.length} style={{width:16,height:16,cursor:"pointer"}}/></span>
                        <span style={{paddingRight:12}}>{sh("Name","name")}</span><span style={{paddingRight:12}}>{sh("Email","email")}</span><span style={{paddingRight:12}}>{sh("Job Title","job")}</span><span style={{paddingRight:12}}>{sh("Manager","manager")}</span><span style={{paddingRight:12}}>{sh("Progress","progress")}</span><span style={{paddingRight:12}}>{sh("Last Active","last")}</span><span></span>
                      </div>
                      {filteredStaff.length===0 && <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14}}>{staff.length===0?"No staff members yet. Add one above.":"No staff match the current filters."}</div>}
                      {ordered.map((u,i)=>{
                        const a=(assigns[u.id]||[]).length, d=(assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length;
                        const pct=a?Math.min(100, Math.round(d/a*100)):0;
                        const barColor=pct===100?T.green:pct>=50?T.accent:"#ef4444";
                        const lastActive=lastLoginMap[u.id];
                        const ticked=selIds.includes(String(u.id));
                        return (
                          <React.Fragment key={u.id}>
                          {teamHead(u,i,false)}
                          <div data-testid="staff-row" style={{display:"grid",gridTemplateColumns:"34px 2fr 2fr 2fr 2fr 2fr 120px 160px",padding:"14px 20px",borderTop:i>0||staffGroupByTeam?`1px solid ${T.border}`:"none",alignItems:"center",columnGap:0,opacity:u.status==="leaver"?0.6:1,background:ticked?"rgba(37,99,235,0.10)":"transparent"}}>
                            <span><input type="checkbox" checked={ticked} onChange={()=>toggleSel(String(u.id))} aria-label={`Tick ${u.name}`} style={{width:16,height:16,cursor:"pointer"}}/></span>
                            <div style={{display:"flex",alignItems:"center",gap:10,paddingRight:12,minWidth:0}}>
                              <Avatar name={u.name} size={32}/>
                              <div style={{minWidth:0}}>
                                <span style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{u.name}</span>
                                {u.status==="inactive" && <span style={{fontSize:9,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,0.12)",padding:"1px 6px",borderRadius:4,border:"1px solid rgba(245,158,11,0.25)"}}>INACTIVE</span>}
                                {u.status==="leaver"   && <span style={{fontSize:9,fontWeight:700,color:"#94a3b8",background:"rgba(148,163,184,0.12)",padding:"1px 6px",borderRadius:4,border:"1px solid rgba(148,163,184,0.25)"}}>LEAVER</span>}
                              </div>
                            </div>
                            <span style={{color:T.muted,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:12}}>{u.email}</span>
                            <span style={{color:T.muted,fontSize:12,whiteSpace:"nowrap",paddingRight:12,display:"flex",alignItems:"center",gap:6}}>{u.jobTitle||<span style={{color:T.muted}}>—</span>}{u.isWarehouseWorker&&<span style={{fontSize:9,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,0.1)",padding:"1px 5px",borderRadius:99,border:"1px solid rgba(245,158,11,0.25)",flexShrink:0}}>🏗</span>}</span>
                            <span style={{color:T.muted,fontSize:12,whiteSpace:"nowrap",paddingRight:12}}>{u.manager||<span style={{color:T.muted}}>—</span>}</span>
                            <div style={{display:"flex",alignItems:"center",gap:8,paddingRight:12}}><span style={{fontWeight:700,color:barColor,fontSize:12,minWidth:28,flexShrink:0}}>{d}/{a}</span><Bar pct={pct} color={barColor}/></div>
                            <span style={{color:lastActive?T.muted:"#f87171",fontSize:11,paddingRight:12,whiteSpace:"nowrap"}}>{lastActive?lastActive.slice(0,10):<span title="Has not logged in">Never</span>}</span>
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={()=>setEditingStaff(u)} style={{flex:1,background:"rgba(37,99,235,0.15)",color:T.accentLt,border:`1px solid ${T.accent}44`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>✏ Edit</button>
                              <button onClick={()=>removeStaff(u.id)} style={{flex:1,background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>Remove</button>
                            </div>
                          </div>
                          </React.Fragment>
                        );
                      })}
                    </div>)}
                  </>
                );
              })()}
            </div>
          </div>)}

          {/* ── ASSIGN TRAINING: pick individual / team / warehouse / all, then toggle modules on/off ── */}
          {atab==="assign" && (
            <div>
              <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:6}}>Assign Training <HelpTip dark={false} text="Tick modules to assign them to staff. Assigned modules appear on the staff member's dashboard as required training. Use bulk assignment to push modules to an entire team at once."/></h2>
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:20}}>
                <p style={{color:T.muted,fontSize:13,margin:0,flex:1,minWidth:240}}>Assign modules to individuals, teams, or all staff at once.</p>
                <button onClick={()=>setGroupSessionFor("all")}
                  style={{background:"rgba(37,99,235,0.12)",color:T.accentLt,border:`1px solid ${T.accent}55`,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
                  {E("👥 ","")}Record a group session
                </button>
                <button onClick={()=>setShowImportPrior(true)}
                  style={{background:"rgba(16,185,129,0.1)",color:T.green,border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
                  {E("📥 ","")}Import training done before the portal
                </button>
                {(()=>{ const ss=listSessions(comps); const miss=ss.filter(x=>!x.evidence.length).length; return (
                  <button onClick={()=>setShowSessions("all")}
                    style={{background:T.overlay,color:T.white,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
                    {E("📋 ","")}Group session records{ss.length?` (${ss.length})`:""}{miss?<span style={{color:"#fbbf24"}}> · {miss} without sign-in sheet</span>:null}
                  </button>); })()}
              </div>
              {showSessions==="all" && <SessionsModal sessions={listSessions(comps)} people={allUsers} modules={allModules}
                onAttach={attachToSession} onClose={()=>setShowSessions(null)} Z={T} font={font}/>}
              {evidenceFor && (()=>{ const c=(comps[evidenceFor.uid]||{})[evidenceFor.mid]; if(!c||!c.recorded) return null;
                const pm=allModules.find(m=>String(m.id)===String(evidenceFor.mid)); const pu=allUsers.find(u=>String(u.id)===evidenceFor.uid);
                const key=sessionKey(evidenceFor.mid,c); const sess=key && listSessions(comps).find(x=>x.key===key);
                return <AttachEvidenceModal
                  title={sess?`Sign-in sheet: ${pm?pm.title:""}`:`Evidence: ${pu?pu.name:""} — ${pm?pm.title:""}`}
                  intro={sess?`The signed sign-in sheet for the session on ${String(c.date).split("-").reverse().join("/")}. It will be linked to all ${sess.attendees.length} attendees' records.`:"A certificate or old-system record showing this training was done."}
                  onSave={files=>sess?attachToSession(sess,files):attachEvidence([{uid:evidenceFor.uid,mid:evidenceFor.mid}],files,`rec_${evidenceFor.uid}_${evidenceFor.mid}`)}
                  onClose={()=>setEvidenceFor(null)} Z={T} font={font}/>; })()}
              {groupSessionFor==="all" && <GroupSessionModal people={allUsers.filter(u=>(u.status||"active")!=="leaver")} modules={allModules.filter(m=>!m._hidden)} comps={comps}
                leaderName={user.name} onSave={recordCompletions} onClose={()=>setGroupSessionFor(null)} Z={T} font={font}/>}
              {showImportPrior && <ImportPriorTrainingModal users={allUsers.filter(u=>(u.status||"active")!=="leaver")} modules={allModules} comps={comps}
                onImport={recordCompletions} onClose={()=>setShowImportPrior(false)} Z={T} font={font}/>}
              {recordFor && (()=>{ const pu=allUsers.find(u=>String(u.id)===String(recordFor.uid)); const pm=allModules.find(m=>m.id===recordFor.mid);
                return pu && pm ? <RecordCompletionModal person={pu} module={pm}
                  byName={user.name} onSave={(date,note,evidence)=>recordCompletions([{userId:pu.id,moduleId:pm.id,date,note,evidence}])}
                  onClose={()=>setRecordFor(null)} Z={T} font={font}/> : null; })()}

              {(()=>{
                const uniqueManagers = [...new Set(staff.map(u=>u.manager).filter(Boolean))].sort();
                const effectiveBulkManager = bulkManager || uniqueManagers[0] || "";

                const targetStaff = bulkTarget === "all" ? staff
                  : bulkTarget === "warehouse" ? staff.filter(u=>u.isWarehouseWorker)
                  : bulkTarget === "team" ? staff.filter(u=>u.manager===effectiveBulkManager)
                  : null; // individual

                const targetLabel = bulkTarget==="all"?`all ${staff.length} staff`:bulkTarget==="warehouse"?`${staff.filter(u=>u.isWarehouseWorker).length} warehouse staff`:bulkTarget==="team"?`${(targetStaff||[]).length} staff in ${effectiveBulkManager}'s team`:"selected staff";

                // Hidden modules are excluded from new assignments — staff who already have them keep their records.
                const assignableModules = allModules.filter(m=>!m._hidden);

                const bulkAssignMod = async (mid) => {
                  if (!targetStaff) return;
                  const m = allModules.find(x=>x.id===mid);
                  const d = newAssignDue();
                  if (!(await ask({ title: "Assign module", message: `Assign "${m?.title||mid}" to ${targetLabel}?${d?`\n\nDue by ${formatDue(d)}.`:""}`, ok: "Assign" }))) return;
                  const affected = {}, due = {};
                  targetStaff.forEach(u => { const k=String(u.id); const cur=assigns[k]||[]; if (!cur.includes(mid)) { affected[k]=[...cur,mid]; if (d) due[k]={[mid]:d}; } });
                  if (!Object.keys(affected).length) return;
                  setAssigns(p => ({...p, ...affected}));
                  if (d) noteDue(due);
                  dbSaveAssigns(affected, d ? due : null);
                };
                const bulkUnassignMod = async (mid) => {
                  if (!targetStaff) return;
                  const m = allModules.find(x=>x.id===mid);
                  if (!(await ask({ title: "Remove module", message: `Remove "${m?.title||mid}" from ${targetLabel}?\n\nStaff who have already completed it keep their completion record.`, ok: "Remove", danger: true }))) return;
                  setAssigns(p => {
                    const next = {...p};
                    const affected = {};
                    targetStaff.forEach(u => {
                      next[u.id] = (next[u.id]||[]).filter(x=>x!==mid);
                      affected[u.id] = next[u.id];
                    });
                    if (Object.keys(affected).length) dbSaveAssigns(affected);
                    return next;
                  });
                };
                const bulkAssignAll = async () => {
                  if (!targetStaff) return;
                  const d = newAssignDue();
                  if (!(await ask({ title: "Assign every module", message: `Assign ALL ${assignableModules.length} modules to ${targetLabel}?\n\nThis adds every module to their training plan.${d?` Newly added modules are due by ${formatDue(d)}.`:""}`, ok: "Assign all" }))) return;
                  const affected = {}, due = {};
                  targetStaff.forEach(u => { const k=String(u.id); const cur=assigns[k]||[]; affected[k] = assignableModules.map(m=>m.id);
                    if (d) { const add = affected[k].filter(x=>!cur.includes(x)); if (add.length) due[k] = Object.fromEntries(add.map(x=>[x,d])); } });
                  setAssigns(p => ({...p, ...affected}));
                  if (d) noteDue(due);
                  dbSaveAssigns(affected, d ? due : null);
                };

                const selStyle2 = {background:T.navyMd,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"9px 14px",color:T.white,fontSize:13,cursor:"pointer",fontFamily:font,outline:"none"};

                return (
                  <>
                    {/* Target selector */}
                    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:20,marginBottom:20,border:`1px solid ${T.border}`}}>
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,marginBottom:14,textTransform:"uppercase"}}>Who to assign to</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                        {[["individual",E("👤 ","")+"Individual"],["all",E("👥 ","")+"All Staff"],["warehouse",E("🏗 ","")+"Warehouse Staff"],["team",E("🗂 ","")+"By Manager"]].map(([v,l])=>(
                          <button key={v} onClick={()=>setBulkTarget(v)}
                            style={{padding:"8px 16px",borderRadius:10,border:`1px solid ${bulkTarget===v?T.accent:T.borderMd}`,background:bulkTarget===v?`rgba(37,99,235,0.2)`:T.overlay,color:bulkTarget===v?T.accentLt:T.muted,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,transition:"all .15s"}}>
                            {l}
                          </button>
                        ))}
                        {bulkTarget==="team" && (
                          <select value={effectiveBulkManager} onChange={e=>setBulkManager(e.target.value)} style={selStyle2}>
                            {uniqueManagers.map(m=><option key={m} value={m}>{m}</option>)}
                          </select>
                        )}
                        {bulkTarget==="individual" && (
                          <select value={target} onChange={e=>setTarget(e.target.value)} style={selStyle2}>
                            {staff.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        )}
                        {targetStaff && (
                          <span style={{color:T.muted,fontSize:12,marginLeft:4}}>
                            {targetStaff.length} staff member{targetStaff.length!==1?"s":""}
                          </span>
                        )}
                      </div>

                      {/* Individual card */}
                      {bulkTarget==="individual" && (() => {
                        const tUser = allUsers.find(u=>String(u.id)===String(target));
                        return (
                          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
                            <Avatar name={tUser?.name||""}/>
                            <div>
                              <div style={{fontWeight:800}}>{tUser?.name}</div>
                              <div style={{color:T.muted,fontSize:12,marginTop:2}}>{tUser?.jobTitle||""}{tUser?.manager?` · Manager: ${tUser.manager}`:""}</div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Bulk quick actions */}
                      {targetStaff && (
                        <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <button onClick={bulkAssignAll}
                            style={{padding:"7px 16px",borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12}}>
                            ✓ Assign All Modules to {targetStaff.length} Staff
                          </button>
                          <button onClick={()=>setAssigns(p=>{const n={...p};const affected={};targetStaff.forEach(u=>{n[u.id]=[];affected[u.id]=[];});dbSaveAssigns(affected);return n;})}
                            style={{padding:"7px 16px",borderRadius:10,background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12}}>
                            ✕ Clear All Assignments
                          </button>
                        </div>
                      )}

                      {/* Due date for assignments made on this page (lib/dueDates.js) */}
                      <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                        <label htmlFor="assign-due" style={{fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase"}}>Due by</label>
                        <select id="assign-due" value={assignDueChoice} onChange={e=>setAssignDueChoice(e.target.value)} style={selStyle2} data-testid="assign-due">
                          {DUE_CHOICES.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {assignDueChoice==="date" && <input type="date" value={assignDueDate} min={todayISO()} onChange={e=>setAssignDueDate(e.target.value)} aria-label="Due date" data-testid="assign-due-date" style={{...selStyle2,colorScheme:"dark"}}/>}
                        <span style={{fontSize:12,color:T.muted}}>{newAssignDue() ? `Modules you assign now must be completed by ${formatDue(newAssignDue())}.` : "Applies to modules you assign on this page. Optional."}</span>
                      </div>
                    </div>

                    {/* Module list */}
                    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}>
                      <div style={{display:"grid",gap:10}}>
                        {assignableModules.map(m=>{
                          let on, partialCount=0;
                          if (bulkTarget==="individual") {
                            on = (assigns[String(target)]||[]).includes(m.id);
                          } else {
                            partialCount = targetStaff.filter(u=>(assigns[u.id]||[]).includes(m.id)).length;
                            on = partialCount === targetStaff.length;
                          }
                          const partial = !on && partialCount > 0;
                          return (
                            <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",background:on?"rgba(37,99,235,0.12)":partial?"rgba(245,158,11,0.07)":T.overlay,border:`1px solid ${on?T.accent+"44":partial?"rgba(245,158,11,0.25)":T.border}`,borderRadius:12,transition:"all .2s",flexWrap:"wrap",gap:12}}>
                              <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0}}>
                                <span style={{fontSize:24,flexShrink:0}}>{m.icon||"📋"}</span>
                                <div style={{minWidth:0}}>
                                  <div style={{fontWeight:700,fontSize:14}}>{m.title}</div>
                                  <div style={{color:T.muted,fontSize:12}}>{m.category} · {m.duration} · <span style={{color:m.level==="Mandatory"?"#f87171":T.accentLt}}>{m.level}</span>
                                    {targetStaff && <span style={{color:T.muted}}> · {partialCount}/{targetStaff.length} assigned</span>}
                                  </div>
                                </div>
                              </div>
                              {bulkTarget==="individual" && on && !isPassed((comps[String(target)]||{})[m.id]) && (()=>{
                                // Due date for this assignment: click to set or change
                                const di = dueInfo(dueDates, target, m.id, false);
                                return (
                                  <button onClick={()=>askDueDate(target,m.id)} data-testid="due-chip" title="Set or change the due date"
                                    style={{background:di&&di.overdue?"rgba(239,68,68,0.14)":di&&di.soon?"rgba(245,158,11,0.12)":"transparent",color:di&&di.overdue?"#f87171":di&&di.soon?"#fbbf24":di?T.slate||T.white:T.muted,border:`1px ${di?"solid":"dashed"} ${di&&di.overdue?"rgba(239,68,68,0.45)":T.borderMd}`,borderRadius:8,padding:"5px 10px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:11,marginRight:8,flexShrink:0,whiteSpace:"nowrap"}}>
                                    {di ? dueText(di) : "+ Due date"}
                                  </button>);
                              })()}
                              {bulkTarget==="individual" && (()=>{
                                // Completion status + "Record as completed" (training done before the portal)
                                const c=(comps[String(target)]||{})[m.id];
                                const dd=c&&c.date?String(c.date).split("-").reverse().join("/"):"";
                                if (!c) return (
                                  <button onClick={()=>setRecordFor({uid:target,mid:m.id})} title="Record training they've already done, e.g. on the old system"
                                    style={{background:"transparent",color:T.green,border:"1px solid rgba(16,185,129,0.35)",borderRadius:10,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,marginRight:8,flexShrink:0}}>
                                    {E("✓ ","")}Record as completed
                                  </button>);
                                if (c.recorded) return (
                                  <span style={{display:"inline-flex",alignItems:"center",gap:6,marginRight:8,flexShrink:0}}>
                                    <span title={recordedText(c)} style={{fontSize:11,fontWeight:700,color:T.green,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:"4px 10px"}}>{c.recorded.session?"Group session":"Recorded"} · completed {dd}</span>
                                    {(c.recorded.evidence||[]).length>0
                                      ? <EvidenceLinks evidence={c.recorded.evidence} label={evidenceLabel(c,0)} Z={T}/>
                                      : <button onClick={()=>setEvidenceFor({uid:String(target),mid:m.id})} title={c.recorded.session?"Attach the signed sign-in sheet (linked to everyone at that session)":"Attach a certificate or old-system record"}
                                          style={{background:"transparent",color:T.accentLt,border:`1px solid ${T.accent}55`,borderRadius:8,padding:"3px 9px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>{E("📎 ","")}{c.recorded.session?"Attach sign-in sheet":"Attach evidence"}</button>}
                                    <button onClick={()=>removeRecordedCompletion(target,m.id)} title="Remove this recorded completion (you can undo it straight after)"
                                      style={{background:"transparent",color:T.muted,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,textDecoration:"underline"}}>Undo</button>
                                  </span>);
                                return <span style={{fontSize:11,fontWeight:700,color:isPassed(c)?T.green:T.amber,marginRight:10,flexShrink:0}}>{isPassed(c)?"Completed":"Attempted"} {dd} · {scoreText(c)}</span>;
                              })()}
                              {bulkTarget==="individual"
                                ? <button onClick={()=>toggleAssign(target,m.id)}
                                    style={{background:on?`rgba(37,99,235,0.25)`:T.border,color:on?T.accentLt:T.muted,border:`1px solid ${on?T.accent+"55":T.borderMd}`,borderRadius:10,padding:"8px 20px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:font,transition:"all .2s",flexShrink:0}}>
                                    {on?"✓ Assigned":"+ Assign"}
                                  </button>
                                : <div style={{display:"flex",gap:8,flexShrink:0}}>
                                    <button onClick={()=>bulkAssignMod(m.id)} disabled={on}
                                      style={{background:on?T.overlay:`linear-gradient(135deg,${T.accent},${T.blue})`,color:on?T.muted:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontWeight:700,cursor:on?"default":"pointer",fontSize:12,fontFamily:font,opacity:on?.5:1}}>
                                      {on?"✓ All Assigned":"+ Assign All"}
                                    </button>
                                    <button onClick={()=>bulkUnassignMod(m.id)} disabled={partialCount===0}
                                      style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 16px",fontWeight:700,cursor:partialCount===0?"default":"pointer",fontSize:12,fontFamily:font,opacity:partialCount===0?.4:1}}>
                                      Remove All
                                    </button>
                                  </div>
                              }
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* External Certificates */}
              <ExternalCertsSection
                staff={staff}
                extCerts={extCerts}
                setExtCerts={setExtCerts}
                dbSaveExtCert={dbSaveExtCert}
                dbDeleteExtCert={dbDeleteExtCert}
                customZones={firstAidData?.customZones||[]}
                T={T} font={font}/>

            </div>
          )}


          {atab==="firstaid" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyFirstAidRegisterTab
              staff={staff}
              extCerts={extCerts}
              firstAidData={firstAidData}
              setFirstAidData={setFirstAidData}
              Z={T} font={font}/>
            </React.Suspense>
          )}

          {/* ── CREATE/EDIT MODULE: editing a built-in module saves it as an _override in custom_modules ── */}
          {atab==="create" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyCreateModuleTab
              editingModule={editingModule}
              onSave={m=>{
                // Editing an existing module = a new VERSION: ask minor/major first
                // (NewVersionModal → saveModuleVersion). A brand-new module is version 1.
                if (editingModule) { setPendingModuleSave({ m, prev: editingModule }); return; }
                setCustomModules(prev=>[...prev,{...m, version:1, versionDate:todayISO()}]);
                setEditingModule(null);
                setAtab("modules");
              }}
              Z={T} font={font}/>
            </React.Suspense>
          )}

          {/* ── MODULE LIBRARY: preview, edit, duplicate, hide/unhide, delete (custom) or reset (override) ── */}
          {atab==="modules" && (
            <div>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
                <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:0}}>Training Library <HelpTip dark={false} text="All available training modules. Built-in modules are provided by Zeus Protect. Custom modules are ones you've created. Modules with a renewal period will show as expired when due for re-completion. Hidden modules are removed from this library and the assignment picker, but staff who already have them stay unaffected."/></h2>
                {allModules.some(m=>m._hidden) && (
                  <button onClick={()=>setShowHiddenModules(v=>!v)}
                    style={{background:showHiddenModules?"rgba(37,99,235,0.1)":T.overlay,color:showHiddenModules?T.accentLt:T.muted,border:`1px solid ${showHiddenModules?"rgba(37,99,235,0.25)":T.borderMd}`,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                    {showHiddenModules?"Hide hidden modules":`👁 Show hidden (${allModules.filter(m=>m._hidden).length})`}
                  </button>
                )}
              </div>
              {(() => {
                const visibleModules = allModules.filter(m=>showHiddenModules || !m._hidden);
                return (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
                {visibleModules.map(m=>(
                  <div key={m.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,border:`1px solid ${m._custom?"rgba(245,158,11,0.35)":T.border}`,opacity:m._hidden?0.55:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                      <span style={{fontSize:36}}>{m.icon||"📋"}</span>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        {m._hidden && <span style={{fontSize:10,fontWeight:700,color:T.muted,background:"rgba(148,163,184,0.12)",border:`1px solid ${T.borderMd}`,borderRadius:6,padding:"2px 7px",letterSpacing:.5}}>HIDDEN</span>}
                        {m._custom && <span style={{fontSize:10,fontWeight:700,color:T.gold,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,padding:"2px 7px",letterSpacing:.5}}>CUSTOM</span>}
                        <Pill label={m.level} col={m.level==="Mandatory"?"red":"navy"}/>
                      </div>
                    </div>
                    <h3 style={{margin:"0 0 6px",fontSize:16,fontWeight:800}}>{m.title}</h3>
                    <p style={{color:T.muted,fontSize:12,margin:"0 0 14px"}}>{m.category} · {m.duration} · {(m.quiz||[]).length} questions</p>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:m._custom?12:0}}>
                      <Pill label={`${staff.filter(u=>(assigns[u.id]||[]).includes(m.id)).length} assigned`} col="navy"/>
                      <Pill label={`${staff.filter(u=>comps[u.id]?.[m.id]).length} completed`} col="green"/>
                      <Pill label={`v${m.version||1}`} col="amber"/>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                      <button onClick={()=>setPreviewModule(m)}
                        style={{background:T.overlay,color:T.accentLt,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,display:"flex",alignItems:"center",gap:5}}>
                        👁 Preview
                      </button>
                      <button onClick={()=>{ setEditingModule(m); setAtab("create"); }}
                        style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:`1px solid rgba(37,99,235,0.25)`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                        ✏ Edit
                      </button>
                      <button onClick={()=>duplicateModule(m)}
                        style={{background:"rgba(148,163,184,0.1)",color:T.slate||T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                        ⧉ Duplicate
                      </button>
                      {m._hidden ? (
                        <button onClick={()=>setModuleHidden(m,false)}
                          style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                          👁 Unhide
                        </button>
                      ) : (
                        <button onClick={async()=>{
                          if(!(await ask({ title: `Hide "${m.title||"this module"}"?`, ok: "Hide module", message: `Hide it from the Training Library?\n\nIt won't appear here or in the assignment picker for new assignments, but staff who already have it assigned or completed keep their records. You can unhide it again at any time.` }))) return;
                          setModuleHidden(m,true);
                        }} style={{background:T.overlay,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                          🙈 Hide
                        </button>
                      )}
                      {m._custom && !m._override && (
                        <button onClick={async()=>{
                          if(!(await ask({ title: `Delete "${m.title||"this module"}"?`, danger: true, ok: "Delete module", message: "This permanently removes the module, its slides and quiz. Staff who have already completed it keep their completion record.\n\nThis can't be undone." }))) return;
                          setCustomModules(prev=>prev.filter(x=>x.id!==m.id));
                          dbDeleteCustomModule(m.id);
                          setAtab("modules");
                        }} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                          🗑 Delete
                        </button>
                      )}
                      {m._override && (
                        <button onClick={async()=>{
                          if(!(await ask({ title: `Reset "${m.title||"this module"}"?`, danger: true, ok: "Reset to original", message: "Reset it to its original built-in version? Any customisations you've made will be lost.\n\nThis can't be undone." }))) return;
                          setCustomModules(prev=>prev.filter(x=>x.id!==m.id));
                          dbDeleteCustomModule(m.id);
                          setAtab("modules");
                        }} style={{background:"rgba(245,158,11,0.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.25)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                          ↩ Reset to Original
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
                );
              })()}
            </div>
          )}

          {/* ── DOCUMENT LIBRARY: upload (drag-drop or picker), folder filter, bulk assign, read-tracking ── */}
          {atab==="documents" && (
            <div>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:6}}>
                <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:0}}>H&S Documentation <HelpTip dark={false} text="Upload policies, procedures, risk assessments and guidance documents. Use the Assign button on each document to nominate staff for required reading — they'll be prompted to confirm they've read it in their portal."/></h2>
                {docView!=="bundles" && <button onClick={()=>setShowBulkDocAssign(v=>!v)}
                  style={{background:showBulkDocAssign?`rgba(239,68,68,0.1)`:`rgba(37,99,235,0.1)`,color:showBulkDocAssign?"#f87171":T.accentLt,border:showBulkDocAssign?"1px solid rgba(239,68,68,0.25)":`1px solid rgba(37,99,235,0.25)`,borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,whiteSpace:"nowrap"}}>
                  {showBulkDocAssign?"✕ Cancel":E("👥 ","")+"Bulk Assign"}
                </button>}
              </div>
              <p style={{color:T.muted,marginBottom:12,fontSize:13}}>Upload documents and assign them for required reading.</p>

              {/* Documents | Document bundles */}
              <div role="tablist" style={{display:"inline-flex",gap:4,padding:4,borderRadius:12,background:T.overlay,border:`1px solid ${T.border}`,marginBottom:18}}>
                {[["docs",`${E("📁 ","")}Documents (${docs.length})`],["bundles",`${E("📚 ","")}Document bundles (${docBundles.length})`]].map(([v,l])=>(
                  <button key={v} role="tab" aria-selected={docView===v} onClick={()=>{setDocView(v);setShowBulkDocAssign(false);}}
                    style={{padding:"8px 16px",borderRadius:9,border:"none",background:docView===v?`linear-gradient(135deg,${T.accent},${T.blue})`:"transparent",color:docView===v?"#fff":T.muted,fontWeight:docView===v?800:600,cursor:"pointer",fontFamily:font,fontSize:13}}>{l}</button>
                ))}
              </div>

              {docView==="bundles" && (
                <DocBundles bundles={docBundles} docs={docs} staff={staff.filter(u=>(u.status||"active")!=="leaver")} allPeople={allUsers}
                  docAcknowledgements={docAcknowledgements} onSave={saveBundle} onDelete={deleteBundle} onAssign={assignBundle} onUnassign={unassignBundle}
                  Z={T} font={font} isMobile={isMobile}/>
              )}
              {docView!=="bundles" && <>

              {/* Bulk assign panel */}
              {showBulkDocAssign && (() => {
                const managers = [...new Set(staff.map(u=>u.manager||"").filter(Boolean))].sort();
                const targetStaff2 = bulkDocTarget==="all" ? staff
                  : bulkDocTarget==="team" ? staff.filter(u=>u.manager===bulkDocManager)
                  : staff.filter(u=>bulkDocSelectedStaff.includes(String(u.id)));
                const inp3 = {background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"8px 12px",color:T.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"};
                return (
                  <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:20,marginBottom:20,border:`1px solid ${T.accent}44`}}>
                    <h4 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:T.accentLt,textTransform:"uppercase",letterSpacing:.5}}>👥 Bulk Document Assignment</h4>
                    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Assign To</div>
                        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                          {[["all","All Staff"],["team","A Team"],["individual","Select Staff"]].map(([val,lbl])=>(
                            <button key={val} onClick={()=>setBulkDocTarget(val)} style={{padding:"7px 14px",borderRadius:9,border:`1px solid ${bulkDocTarget===val?T.accent:T.borderMd}`,background:bulkDocTarget===val?`rgba(37,99,235,0.15)`:T.overlay,color:bulkDocTarget===val?T.accentLt:T.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:bulkDocTarget===val?700:400}}>{lbl}</button>
                          ))}
                        </div>
                        {bulkDocTarget==="team" && (
                          <select value={bulkDocManager} onChange={e=>setBulkDocManager(e.target.value)} style={{...inp3,width:"100%",marginBottom:10}}>
                            <option value="">Select manager...</option>
                            {managers.map(m=><option key={m} value={m}>{m} ({staff.filter(u=>u.manager===m).length} staff)</option>)}
                          </select>
                        )}
                        {bulkDocTarget==="individual" && (
                          <div style={{maxHeight:150,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:8,marginBottom:10}}>
                            {staff.map((u,i)=>(
                              <div key={u.id} onClick={()=>setBulkDocSelectedStaff(p=>p.includes(String(u.id))?p.filter(x=>x!==String(u.id)):[...p,u.id])}
                                style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",background:bulkDocSelectedStaff.includes(u.id)?"rgba(37,99,235,0.08)":"transparent"}}>
                                <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${bulkDocSelectedStaff.includes(u.id)?T.accent:T.borderMd}`,background:bulkDocSelectedStaff.includes(u.id)?T.accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  {bulkDocSelectedStaff.includes(String(u.id))&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                                </div>
                                <span style={{fontSize:12,color:T.white}}>{u.name}</span>
                                <span style={{fontSize:11,color:T.muted,marginLeft:"auto"}}>{u.jobTitle||""}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{fontSize:11,color:T.muted}}>{targetStaff2.length} staff will be assigned</div>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Select Documents</div>
                        <div style={{maxHeight:180,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:8,marginBottom:10}}>
                          {docs.map((d,i)=>(
                            <div key={d.id} onClick={()=>setBulkDocSelectedDocs(p=>p.includes(d.id)?p.filter(x=>x!==d.id):[...p,d.id])}
                              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",background:bulkDocSelectedDocs.includes(d.id)?"rgba(37,99,235,0.08)":"transparent"}}>
                              <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${bulkDocSelectedDocs.includes(d.id)?T.accent:T.borderMd}`,background:bulkDocSelectedDocs.includes(d.id)?T.accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                {bulkDocSelectedDocs.includes(d.id)&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                              </div>
                              <span style={{fontSize:12,color:T.white,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.title}</span>
                              <span style={{fontSize:10,color:T.muted,flexShrink:0}}>{d.type}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          disabled={bulkDocSelectedDocs.length===0||targetStaff2.length===0}
                          onClick={async()=>{
                            if(!(await ask({ title: "Assign documents", ok: "Assign", message: `Assign ${bulkDocSelectedDocs.length} document${bulkDocSelectedDocs.length!==1?"s":""} to ${targetStaff2.length} staff member${targetStaff2.length!==1?"s":""} as required reading?` }))) return;
                            setDocAssignments(p=>{
                              const n={...p};
                              bulkDocSelectedDocs.forEach(did=>{
                                const sdid=String(did);
                                const current=n[sdid]||[];
                                const toAdd=targetStaff2.map(u=>String(u.id)).filter(id=>!current.includes(id));
                                n[sdid]=[...current,...toAdd];
                                dbSaveDocAssignments(did, n[sdid]);
                              });
                              return n;
                            });
                            setShowBulkDocAssign(false);
                            setBulkDocSelectedDocs([]);
                            setBulkDocSelectedStaff([]);
                          }}
                          style={{background:(bulkDocSelectedDocs.length===0||targetStaff2.length===0)?"rgba(37,99,235,0.3)":`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:(bulkDocSelectedDocs.length===0||targetStaff2.length===0)?"not-allowed":"pointer",fontFamily:font,fontWeight:700,fontSize:13,opacity:(bulkDocSelectedDocs.length===0||targetStaff2.length===0)?.5:1}}>
                          Assign {bulkDocSelectedDocs.length>0?bulkDocSelectedDocs.length+" ":""} Doc{bulkDocSelectedDocs.length!==1?"s":""} to {targetStaff2.length} Staff
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Folder tabs */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
                {(["all",...Array.from(new Set([...docs.map(d=>d.type||"Document"),...(docFolder!=="all"?[docFolder]:[])])).sort()]).map(f=>(
                  <button key={f} onClick={()=>setDocFolder(f)}
                    style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${docFolder===f?T.accent:T.borderMd}`,background:docFolder===f?`linear-gradient(135deg,${T.accent},${T.blue})`:T.overlay,color:docFolder===f?"#fff":T.muted,fontWeight:docFolder===f?700:400,cursor:"pointer",fontFamily:font,fontSize:12}}>
                    {f==="all"?`📁 All (${docs.length})`:`${f==="Policy"?"📋":f==="Procedure"?"📝":f==="Guidance"?"📖":f==="Risk Assessment"?"⚠️":f==="COSHH"?"🧪":f==="User Manual"?"📘":"📄"} ${f} (${docs.filter(d=>(d.type||"Document")===f).length})`}
                  </button>
                ))}
              </div>

              {/* Upload area */}
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,marginBottom:20,border:`1px solid ${T.border}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
                  <h4 style={{margin:0,fontSize:12,fontWeight:700,letterSpacing:1,color:T.muted}}>UPLOAD NEW DOCUMENT</h4>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:T.muted}}>Category:</span>
                    <select value={docFolder==="all"?"Document":docFolder} onChange={e=>setDocFolder(e.target.value)}
                      style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"5px 10px",color:T.white,fontSize:12,outline:"none",fontFamily:font,cursor:"pointer"}}>
                      {["Policy","Procedure","Guidance","User Manual","Risk Assessment","COSHH","Report","Presentation","Document"].map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <label style={{display:"block",border:"2px dashed T.borderMd",borderRadius:14,padding:"28px 20px",textAlign:"center",cursor:"pointer",transition:"border-color .2s",background:T.overlay}}
                  onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=T.accent}}
                  onDragLeave={e=>{e.currentTarget.style.borderColor=T.borderMd}}
                  onDrop={e=>{
                    e.preventDefault();
                    e.currentTarget.style.borderColor=T.borderMd;
                    const files=Array.from(e.dataTransfer.files);
                    files.forEach(async file=>{
                      const ext=file.name.split(".").pop().toUpperCase();
                      const typeMap={PDF:"Policy",DOCX:"Guidance",DOC:"Guidance",XLSX:"Report",XLS:"Report",PPTX:"Presentation",PPT:"Presentation"};
                      const id="d"+Date.now()+Math.random();
                      const docType = docFolder!=="all"?docFolder:typeMap[ext]||"Document";
                      const newDoc={id,title:file.name.substring(0,file.name.lastIndexOf(".")>0?file.name.lastIndexOf("."):file.name.length),date:todayISO(),size:`${(file.size/1024).toFixed(0)} KB`,type:docType,fileUrl:null,fileData:null,fileName:file.name,ext,version:1};
                      setDocs(p=>[...p,newDoc]);
                      await dbSaveDoc(newDoc,file);
                      setDocs(p=>p.map(d=>d.id===id?{...d,fileUrl:newDoc.fileUrl,fileData:newDoc.fileUrl}:d));
                    });
                  }}>
                  <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg"
                    style={{display:"none"}}
                    onChange={e=>{
                      Array.from(e.target.files).forEach(async file=>{
                        const ext=file.name.split(".").pop().toUpperCase();
                        const typeMap={PDF:"Policy",DOCX:"Guidance",DOC:"Guidance",XLSX:"Report",XLS:"Report",PPTX:"Presentation",PPT:"Presentation"};
                        const id="d"+Date.now()+Math.random();
                        const docType = docFolder!=="all"?docFolder:typeMap[ext]||"Document";
                        const newDoc={id,title:file.name.substring(0,file.name.lastIndexOf(".")>0?file.name.lastIndexOf("."):file.name.length),date:todayISO(),size:`${(file.size/1024).toFixed(0)} KB`,type:docType,fileUrl:null,fileData:null,fileName:file.name,ext,version:1};
                        setDocs(p=>[...p,newDoc]);
                        await dbSaveDoc(newDoc,file);
                        setDocs(p=>p.map(d=>d.id===id?{...d,fileUrl:newDoc.fileUrl,fileData:newDoc.fileUrl}:d));
                      });
                      e.target.value="";
                    }}/>
                  <div style={{fontSize:36,marginBottom:10}}>📂</div>
                  <div style={{color:T.white,fontWeight:700,fontSize:14,marginBottom:4}}>Drop files here or click to browse</div>
                  <div style={{color:T.muted,fontSize:12}}>PDF, Word, Excel, PowerPoint, images supported · Multiple files at once</div>
                </label>
              </div>

              {/* Document list: folder + search */}
              {(()=>{ const q=String(docSearch||"").trim().toLowerCase(); const inFolder=docs.filter(d=>docFolder==="all"||(d.type||"Document")===docFolder);
                const shownDocs=q?inFolder.filter(d=>[d.title,d.description,d.fileName,d.type].some(v=>String(v||"").toLowerCase().includes(q))):inFolder;
                // tick boxes + bulk actions (no bulk delete: deleting also removes read confirmations)
                const docTicks = ticksFrom(docSel, setDocSel, shownDocs.map(d=>d.id), docs.map(d=>d.id));
                const DOC_FOLDERS = ["Policy","Procedure","Guidance","User Manual","Risk Assessment","COSHH","Report","Presentation","Document"];
                const ticked = ids => docs.filter(d=>ids.includes(String(d.id)));
                const saveDocsMeta = async (ids, change, msg) => {
                  const list = ticked(ids).filter(d=>!d.raId).map(d=>({ ...d, ...change }));
                  const skipped = ids.length - list.length;
                  setDocs(p=>p.map(d=>list.find(x=>x.id===d.id)||d));
                  await Promise.all(list.map(d=>dbSaveDoc(d, null)));   // a failed save shows its own message
                  notify(`${msg} (${list.length} document${list.length!==1?"s":""})${skipped?`. ${skipped} made from a risk assessment ${skipped===1?"was":"were"} left as ${skipped===1?"it is":"they are"}.`:"."}`, { kind:"success" });
                };
                const docActions = [
                  { label: "📁 Move to folder…", run: async ids => {
                      const v = await ask({ title:`Move ${ids.length} document${ids.length!==1?"s":""}`, ok:"Move", fields:[{ id:"type", label:"Folder", required:true, options: DOC_FOLDERS.map(f=>({ value:f, label:f })) }] });
                      if (!v) return false; await saveDocsMeta(ids, { type: v.type }, `Moved to ${v.type}`); } },
                  { label: "📅 Set review date…", run: async ids => {
                      const v = await ask({ title:`Review date for ${ids.length} document${ids.length!==1?"s":""}`, ok:"Set date", fields:[{ id:"date", label:"Next review", type:"date", required:true }] });
                      if (!v || !v.date) return false; await saveDocsMeta(ids, { reviewDate: v.date }, `Review date set to ${v.date}`); } },
                  ...(docBundles.length ? [{ label: "📦 Add to bundle…", run: async ids => {
                      const v = await ask({ title:`Add ${ids.length} document${ids.length!==1?"s":""} to a bundle`, ok:"Add", message:"Anyone the bundle has been given to is assigned the added documents too.",
                        fields:[{ id:"bundle", label:"Bundle", required:true, options: docBundles.map(b=>({ value:b.id, label:b.name })) }] });
                      if (!v) return false;
                      const b = docBundles.find(x=>x.id===v.bundle); if (!b) return false;
                      const add = ids.filter(id=>!b.docIds.map(String).includes(id));
                      if (!add.length) { notify(`They're all in "${b.name}" already.`, { kind:"info" }); return; }
                      if (await saveBundle({ ...b, docIds:[...b.docIds, ...add] }) !== false) notify(`${add.length} document${add.length!==1?"s":""} added to "${b.name}".`, { kind:"success" });
                    } }] : []),
                ];
                return docs.length===0
                ? <div style={{textAlign:"center",padding:40,color:T.muted,fontSize:14}}>No documents uploaded yet.</div>
                : (
                  <div style={{display:"grid",gap:14}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                      <input aria-label="Search documents" value={docSearch} onChange={e=>setDocSearch(e.target.value)} placeholder="🔍 Search documents by title, description or file name…"
                        style={{flex:1,minWidth:240,background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"9px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font}}/>
                      <TickAll ticks={docTicks} label={`Tick all ${shownDocs.length}`} T={T} font={font}/>
                      <span style={{fontSize:12,color:T.muted,whiteSpace:"nowrap"}}>{shownDocs.length} of {docs.length}</span>
                      {q && <button type="button" onClick={()=>setDocSearch("")} style={{background:"none",border:"none",color:T.accentLt,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>Clear</button>}
                    </div>
                    <BulkBar ticks={docTicks} actions={docActions} T={T} font={font}/>
                    {shownDocs.length===0 && <div style={{textAlign:"center",padding:24,color:T.muted,fontSize:13}}>No documents match.</div>}
                    {shownDocs.map(d=>{
                      const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
                      const icon=extIcons[d.ext]||"📄";
                      const assignedIds = docAssignments[String(d.id)] || [];
                      const assignedStaff = staff.filter(u=>assignedIds.includes(String(u.id)));
                      const readCount = assignedStaff.filter(u=>(docAcknowledgements[String(u.id)]||{})[String(d.id)]).length;
                      const unreadCount = assignedStaff.length - readCount;

                      return (
                        <DocCard key={d.id} tick={<Tick ticks={docTicks} id={d.id} label={`Tick ${d.title}`}/>} d={d} staff={staff} assignedIds={assignedIds} assignedStaff={assignedStaff} readCount={readCount} unreadCount={unreadCount} icon={icon} docAcknowledgements={docAcknowledgements} setDocAcknowledgements={setDocAcknowledgements} setDocAssignments={setDocAssignments} dbSaveDocAssignments={dbSaveDocAssignments} setDocs={setDocs} dbDeleteDoc={dbDeleteDoc} dbSaveDoc={dbSaveDoc} setPreviewDoc={setPreviewDoc} docAckHistory={docAckHistory} bundleNames={bundleNamesOf(docBundles, d.id)} T={T} font={font}/>
                      );
                    })}
                  </div>
                ); })()}
              </>}
            </div>
          )}

          {/* ── Remaining admin tabs are thin wrappers around lazy-loaded domain components ── */}
          {atab==="coshh" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyCoshhTab Z={T} font={font} msdsFiles={msdsFiles} setMsdsFiles={setMsdsFiles} customChemicals={customChemicals} setCustomChemicals={setCustomChemicals} assessments={coshhAssessments} setAssessments={setCoshhAssessments}/>
            </React.Suspense>
          )}

          {atab==="settings" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazySiteSettingsTab Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="audit" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <BackupPanel user={user} onBackedUp={setLastBackup} Z={T} font={font}/>
            <LazyAuditTrailTab Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="reports" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyReportsTab staff={staff} assigns={assigns} comps={comps} docs={docs} docAssignments={docAssignments} docAcknowledgements={docAcknowledgements} reportView={adminReportView} setReportView={setAdminReportView} dseReports={dseReports} adminResponses={adminResponses} setAdminResponses={setAdminResponses} darkMode={darkMode} Z={T} font={font} modules={allModules} machineComps={machineComps} allMachineTypes={allMachineTypes} lastLoginMap={lastLoginMap} extCerts={extCerts} quizFailures={quizFailures} setQuizFailures={setQuizFailures} incidents={incidents} inspections={siteInspections} ras={ras} investigations={investigations} setAtab={setAtab} userName={user?.name||""}
              dueDates={dueDates} onMatrixAssign={matrixAssign} onMatrixDue={askDueDate} onMatrixOpen={uid=>openInAssign(uid)}
              onMatrixRecord={(uid,mid)=>openInAssign(uid, ()=>setRecordFor({uid:String(uid),mid}))}
              onExportPDF={u=>generateStaffPDF(u,allModules,assigns,comps,docs,docAssignments,docAcknowledgements,extCerts,machineComps,lastLoginMap,T,allMachineTypes)}/>
            </React.Suspense>
          )}

          {atab==="incidents" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyAdminIncidentTab user={user} incidents={incidents} setIncidents={setIncidents} dbDeleteIncident={dbDeleteIncident} staff={staff} focusIncidentId={focusIncidentId} setFocusIncidentId={setFocusIncidentId} preset={pagePreset&&pagePreset.tab==="incidents"?pagePreset:null} clearPreset={()=>setPagePreset(null)} showAdminReportForm={showAdminReportForm} setShowAdminReportForm={setShowAdminReportForm}
              investigations={investigations} setInvestigations={setInvestigations}
              onOpenInvestigation={id=>{ setInvestigationView(id); setAtab("investigation"); }}
              equipment={equipment} setEquipment={setEquipment}
              Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="investigation" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyInvestigationTab incidents={incidents} setIncidents={setIncidents} staff={staff}
              investigations={investigations} setInvestigations={setInvestigations}
              fetchInvestigation={fetchInvestigation} acceptInvestigationBase={acceptInvestigationBase}
              focusedId={investigationView} setFocusedId={setInvestigationView}
              onBack={()=>setAtab("incidents")}
              Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="ra" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyRiskAssessmentTab docs={docs} setDocs={setDocs} setAtab={setAtab} ras={ras} setRas={setRas} dbSaveRA={dbSaveRA} Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="machinery" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyAdminMachineryTab allStaff={staff} machineComps={machineComps} setMachineComps={setMachineComps} allMachineTypes={allMachineTypes} allMachineCategories={allMachineCategories} customMachineTypes={customMachineTypes} preset={pagePreset&&pagePreset.tab==="machinery"?pagePreset:null} clearPreset={()=>setPagePreset(null)} onOpenStaff={()=>setAtab("users")} setCustomMachineTypes={setCustomMachineTypes} dbDeleteCustomMachineType={dbDeleteCustomMachineType} dbSaveMachineComp={dbSaveMachineComp} dbDeleteMachineComp={dbDeleteMachineComp} Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="equipment" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyEquipmentTrackerTab equipment={equipment} setEquipment={setEquipment} preset={pagePreset&&pagePreset.tab==="equipment"?pagePreset:null} clearPreset={()=>setPagePreset(null)} staff={staff}
              extinguishers={(fireSafety&&fireSafety.extinguishers)||[]} onOpenFireSafety={()=>{ setPagePreset({tab:"firesafety",sub:"extinguishers"}); setAtab("firesafety"); }} Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="contractors" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyContractorsTab
              contractors={contractors} setContractors={setContractors}
              contractorInductions={contractorInductions} setContractorInductions={setContractorInductions}
              contractorCerts={contractorCerts} setContractorCerts={setContractorCerts}
              contractorVisits={contractorVisits} setContractorVisits={setContractorVisits}
              dbSaveContractor={dbSaveContractor} dbDeleteContractor={dbDeleteContractor}
              dbSaveContractorInductions={dbSaveContractorInductions}
              dbSaveContractorCerts={dbSaveContractorCerts}
              dbSaveContractorVisits={dbSaveContractorVisits}
              focusContractorId={focusContractorId} setFocusContractorId={setFocusContractorId}
              staff={staff} T={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="permits" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyPermitsTab permits={permits} setPermits={setPermits} dbSavePermit={dbSavePermit} dbDeletePermit={dbDeletePermit} staff={staff} contractors={contractors} T={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="inspections" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazySiteInspectionsTab inspections={siteInspections} setInspections={setSiteInspections} staff={staff} userName={user&&user.name} preset={pagePreset&&pagePreset.tab==="inspections"?pagePreset:null} clearPreset={()=>setPagePreset(null)} Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="firesafety" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyFireSafetyTab fireSafety={fireSafety} setFireSafety={setFireSafety} staff={staff} onUploadFraDoc={dbUploadFraDocument} onDeleteFraDoc={dbDeleteFraDocument}
              extCerts={extCerts} setExtCerts={setExtCerts} onSaveCert={dbSaveExtCert} onDeleteCert={dbDeleteExtCert} userName={user&&user.name}
              preset={pagePreset&&pagePreset.tab==="firesafety"?pagePreset:null} clearPreset={()=>setPagePreset(null)}
              inspections={siteInspections} onOpenInspection={id=>{ setPagePreset({tab:"inspections",openId:id}); setAtab("inspections"); }}
              Z={T} font={font}/>
            </React.Suspense>
          )}
          {atab==="account" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyAccountTab user={user} passwords={passwords} onSetPassword={savePasswordFor} authMode={AUTH_MODE} onChangeOwnPassword={async (oldPw,newPw)=>{ if (!(await authCheckPassword(user.email, oldPw))) return { ok:false, error:"Current password is incorrect." }; return changeOwnPassword(newPw); }} darkMode={darkMode} setDarkMode={setDarkMode} theme={theme} setTheme={setTheme} onSaveTheme={k=>dbSaveTheme(user.id,k)} emojiMode={emojiMode} onSaveEmojiMode={v=>{setEmojiMode(v);dbSaveEmojiMode(user.id,v);}} Z={T} font={font}/>
            </React.Suspense>
          )}
          {atab==="account" && <WelcomeReplay name={user.name} Z={T} font={font}/>}
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

  return null;
}