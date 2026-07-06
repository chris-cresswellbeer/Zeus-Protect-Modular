import React, { useState, useEffect, useRef } from "react";
import { INIT_DSE_REPORTS } from "./data/dseReports";
import { HS_DOCS, INIT_ASSIGN, INIT_COMPLETE } from "./data/seedDocs";
import { INIT_EQUIPMENT } from "./data/seedEquipment";
import { EXT_CERT_TYPES } from "./data/seedExtCerts";
import { INIT_FIRE_WARDENS, INIT_FIRE_DRILLS, INIT_ALARM_TESTS, INIT_EXTINGUISHERS, INIT_EMERG_LIGHTING, INIT_FRA_REVIEWS } from "./data/seedFireSafety";
import { FA_ZONES } from "./data/seedFirstAid";
import { INIT_INCIDENTS } from "./data/seedIncidents";
import { INIT_SITE_INSPECTIONS } from "./data/seedInspections";
import { INIT_INVESTIGATIONS } from "./data/seedInvestigations";
import { isWarehouseWorker, INIT_MACHINE_COMPS, MACHINERY_TYPES } from "./data/seedMachinery";
import { INIT_RAS } from "./data/seedRiskAssessments";
import { TRAINING_MODULES } from "./data/seedTraining";
import { USERS } from "./data/seedUsers";
const LazyContractorsTab = React.lazy(() => import("./domains/contractors/ContractorsTab").then(m => ({ default: m.ContractorsTab })));
const LazyCoshhTab = React.lazy(() => import("./domains/coshh/CoshhTab").then(m => ({ default: m.CoshhTab })));
import { DocCard } from "./domains/documents/DocCard";
import { ExternalCertsSection } from "./domains/documents/ExternalCertsSection";
import { PreviewModal } from "./domains/documents/PreviewModal";
import { DSEAssessment } from "./domains/dse/DSEAssessment";
const LazyStaffDSETab = React.lazy(() => import("./domains/dse/StaffDSETab").then(m => ({ default: m.StaffDSETab })));
const LazyEquipmentTrackerTab = React.lazy(() => import("./domains/equipment/EquipmentTrackerTab").then(m => ({ default: m.EquipmentTrackerTab })));
const LazyFireSafetyTab = React.lazy(() => import("./domains/fireSafety/FireSafetyTab").then(m => ({ default: m.FireSafetyTab })));
const LazyFirstAidRegisterTab = React.lazy(() => import("./domains/firstAid/FirstAidRegisterTab").then(m => ({ default: m.FirstAidRegisterTab })));
const LazyAdminIncidentTab = React.lazy(() => import("./domains/incidents/AdminIncidentTab").then(m => ({ default: m.AdminIncidentTab })));
const LazyIncidentTracker = React.lazy(() => import("./domains/incidents/IncidentTracker").then(m => ({ default: m.IncidentTracker })));
const LazyInvestigationTab = React.lazy(() => import("./domains/incidents/InvestigationTab").then(m => ({ default: m.InvestigationTab })));
import { QuickReportModal } from "./domains/incidents/QuickReportModal";
const LazySiteInspectionsTab = React.lazy(() => import("./domains/inspections/SiteInspectionsTab").then(m => ({ default: m.SiteInspectionsTab })));
const LazyAdminMachineryTab = React.lazy(() => import("./domains/machinery/AdminMachineryTab").then(m => ({ default: m.AdminMachineryTab })));
const LazyMachineryCompetenceTab = React.lazy(() => import("./domains/machinery/MachineryCompetenceTab").then(m => ({ default: m.MachineryCompetenceTab })));
const LazyPermitsTab = React.lazy(() => import("./domains/permits/PermitsTab").then(m => ({ default: m.PermitsTab })));
const LazyRiskAssessmentTab = React.lazy(() => import("./domains/riskAssessments/RiskAssessmentTab").then(m => ({ default: m.RiskAssessmentTab })));
import { generateRAHtml } from "./domains/riskAssessments/generateRAHtml";
const LazyAccountTab = React.lazy(() => import("./domains/staff/AccountTab").then(m => ({ default: m.AccountTab })));
import { EditStaffModal } from "./domains/staff/EditStaffModal";
const LazyStaffActionsTab = React.lazy(() => import("./domains/staff/StaffActionsTab").then(m => ({ default: m.StaffActionsTab })));
const LazyCreateModuleTab = React.lazy(() => import("./domains/training/CreateModuleTab").then(m => ({ default: m.CreateModuleTab })));
import { ModulePreviewModal } from "./domains/training/ModulePreviewModal";
const LazyReportsTab = React.lazy(() => import("./domains/training/ReportsTab").then(m => ({ default: m.ReportsTab })));
import { generateStaffPDF } from "./domains/training/generateStaffPDF";
import { getExpiryStatus } from "./lib/dates";
import { EmojiCtx, E, syncEmojiMode } from "./lib/emoji";
import { sb, hashPassword, DEFAULT_HASH, dbWrite } from "./lib/supabase";
import { HelpTip } from "./shared/HelpTip";
import { ZeusLogo, ZeusProtectLogo, ZEUS_LOGO_LIGHT_SRC } from "./shared/Logo";
import { NotificationBell } from "./shared/NotificationBell";
import { useWindowWidth, MobileCard, MobileCardRow } from "./shared/hooks";
import { Pill, Avatar, Bar } from "./shared/primitives";
import { Z, getThemeTokens } from "./theme/tokens";

export default function App() {
  const [darkMode, setDarkMode] = useState(true); // kept for backward compat
  const [theme, setTheme] = useState("dark"); // "dark"|"light"|"slate"|"forest"|"graphite"|"arctic"|"sand"
  const T = getThemeTokens(theme); // active theme tokens
  const [user,    setUser]    = useState(null);
  const [view,    setView]    = useState("login");
  const [allUsers,setAllUsers]= useState([]); // loaded from Supabase users table; USERS constant is seed-only
  const [passwords, setPasswords] = useState({}); // userId -> password (overrides default)
  const [assigns, setAssigns] = useState(INIT_ASSIGN);
  const [comps,   setComps]   = useState(INIT_COMPLETE);
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [err,     setErr]     = useState("");
  const [mod,     setMod]     = useState(null);
  const [step,    setStep]    = useState(0);
  const [qans,    setQans]    = useState({});
  const [qsub,    setQsub]    = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null); // image URL to show in lightbox
  const [atab,    setAtab]    = useState("dashboard");
  const [adminReportView, setAdminReportView] = useState("staff");
  const [focusIncidentId, setFocusIncidentId] = useState(null);
  const [showAdminReportForm, setShowAdminReportForm] = useState(false);
  const [stab,    setStab]    = useState("dashboard");
  const [cert,    setCert]    = useState(null);
  const [target,  setTarget]  = useState("1");
  const [docs,    setDocs]    = useState(HS_DOCS);
  const [docName, setDocName] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [docAssignments, setDocAssignments] = useState({}); // { docId: [userId, ...] }
  const [docAcknowledgements, setDocAcknowledgements] = useState({}); // { userId: { docId: { date } } }
  const [dseActive, setDseActive] = useState(false);
  const [dseAnswers, setDseAnswers] = useState({});
  const [dseComments, setDseComments] = useState({});
  const [dseSection, setDseSection] = useState(0);
  const [dseSubmitted, setDseSubmitted] = useState(false);
  const [dseReports, setDseReports] = useState(INIT_DSE_REPORTS);
  const [adminResponses, setAdminResponses] = useState({}); // { userId: { reportIdx_issueIdx: { comment, resolved } } }
  const [incidents, setIncidents] = useState(INIT_INCIDENTS);
  const [investigations, setInvestigations] = useState(INIT_INVESTIGATIONS);   // { incidentId: { ... } }
  const [investigationView, setInvestigationView] = useState(null); // incidentId to open
  const [lastLoginMap, setLastLoginMap] = useState({}); // userId -> ISO date string
  const [equipment, setEquipment] = useState(INIT_EQUIPMENT);
  const [machineComps, setMachineComps] = useState(INIT_MACHINE_COMPS);
  const [siteInspections, setSiteInspections] = useState(INIT_SITE_INSPECTIONS);
  const [customModules, setCustomModules] = useState([]); // admin-created training modules
  const [customMachineTypes, setCustomMachineTypes] = useState([]); // admin-created machinery types
  const [ras, setRas] = useState(INIT_RAS);
  const [permits, setPermits] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [contractorInductions, setContractorInductions] = useState({});
  const [contractorCerts, setContractorCerts] = useState({});
  const [contractorVisits, setContractorVisits] = useState({}); // risk assessments
  const [quizFailures, setQuizFailures] = useState([]); // [{ userId, userName, moduleId, moduleTitle, score, date }]
  const [extCerts, setExtCerts] = useState({}); // { userId: { certType: { fileName, fileUrl, issuedDate, expiryDate, uploadedAt } } }
  const [msdsFiles, setMsdsFiles] = useState({}); // { [chemCode]: { fileName, fileData, fileUrl, uploadedAt } }
  const [customChemicals, setCustomChemicals] = useState([]);
  const [emojiMode, setEmojiMode] = useState(true); // true = show emojis, false = professional mode // admin-added COSHH chemicals
  // Keep the module-level emoji flag (read by E()) in sync with state.
  // This replaces the old useContext-inside-E() approach, which violated
  // the Rules of Hooks whenever E() was called a different number of
  // times across renders (e.g. switching between staff/admin views).
  useEffect(() => {
    syncEmojiMode(emojiMode);
  }, [emojiMode]);
  const [fireSafety, setFireSafety] = useState({ wardens:INIT_FIRE_WARDENS, drills:INIT_FIRE_DRILLS, alarmTests:INIT_ALARM_TESTS, extinguishers:INIT_EXTINGUISHERS, emergLighting:INIT_EMERG_LIGHTING, fraReviews:INIT_FRA_REVIEWS });
  const [firstAidData, setFirstAidData] = useState({ aiders:[], kits:[], assessment:{} });
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
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffFilterManager,  setStaffFilterManager]  = useState("all");
  const [staffFilterSearch,   setStaffFilterSearch]   = useState("");
  const [showBulkReset, setShowBulkReset] = useState(false);
  const [docFolder, setDocFolder] = useState("all"); // active folder filter
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
  const [staffFilterProgress, setStaffFilterProgress] = useState("all");
  const [staffGroupByTeam,    setStaffGroupByTeam]    = useState(false);
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
  const [staffStatusFilter, setStaffStatusFilter] = useState("all");
  const [addErr,  setAddErr]    = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState("individual");
  const [bulkManager, setBulkManager] = useState("");
  const [dbReady, setDbReady] = useState(false); // true once initial Supabase load is complete
  const [loginAttempts, setLoginAttempts] = useState({}); // { email: { count, lockedUntil } }
  const inactivityTimer = React.useRef(null);
  const INACTIVITY_MINUTES = 30;
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 15;

  const font = "'Barlow','Trebuchet MS',system-ui,sans-serif";
  const winW = useWindowWidth();
  const isMobile = winW <= 1024;
  const isSmall = winW <= 480;

  // ── Ensure correct viewport meta tag for mobile ─────────────────────────────
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
  }, []);

  // ── Inactivity timeout — log out after 30 minutes of no interaction ──────────
  useEffect(() => {
    if (!user) return; // only run when logged in
    const reset = () => {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        setUser(null); setView("login"); setMod(null);
        alert("You have been logged out due to 30 minutes of inactivity.");
      }, INACTIVITY_MINUTES * 60 * 1000);
    };
    const events = ["mousemove","keydown","mousedown","touchstart","scroll","click"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start timer immediately on login
    return () => {
      clearTimeout(inactivityTimer.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user]); // eslint-disable-line

  // ── Show inactivity warning banner 2 mins before logout ─────────────────────
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const warningTimer = React.useRef(null);
  useEffect(() => {
    if (!user) { setShowInactivityWarning(false); return; }
    const resetWarning = () => {
      setShowInactivityWarning(false);
      clearTimeout(warningTimer.current);
      warningTimer.current = setTimeout(() => {
        setShowInactivityWarning(true);
      }, (INACTIVITY_MINUTES - 2) * 60 * 1000);
    };
    const events = ["mousemove","keydown","mousedown","touchstart","scroll","click"];
    events.forEach(e => window.addEventListener(e, resetWarning, { passive: true }));
    resetWarning();
    return () => {
      clearTimeout(warningTimer.current);
      events.forEach(e => window.removeEventListener(e, resetWarning));
    };
  }, [user]); // eslint-disable-line

  // ── Load all persisted data from Supabase on mount ───────────────────────────
  useEffect(() => {
    async function loadAll() {
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
          ffrRes, faRes, cmtRes,
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
          sb.from("user_passwords").select("*"),
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
        ]);

        // Small helper: allSettled wraps each result in {status, value} or
        // {status, reason}. Treat a rejected/failed query the same as "no
        // rows" (data: null) rather than letting it throw and abort
        // everything else's processing below.
        const rows = (res) => (res.status === "fulfilled" ? (res.value?.data ?? null) : null);
        if (usersRes.status === "rejected") console.error("Supabase load error (users):", usersRes.reason);
        [aRes,cRes,iRes,invRes,ackRes,daRes,docRes,dseRes,resRes,llRes,pwRes,upRes,ecRes,qfRes,conRes,conIndRes,conCertRes,conVisitRes,permitRes,raRes,cmRes,mcRes,eqRes,siRes,msdsRes,ccRes,fwRes,fdRes,fatRes,fexRes,felRes,ffrRes,faRes,cmtRes]
          .forEach(r => { if (r.status === "rejected") console.error("Supabase load error:", r.reason); });

        // Training assigns
        const aRows = rows(aRes);
        if (aRows && aRows.length) {
          const map = {};
          aRows.forEach(r => {
            const uid = String(r.user_id);
            map[uid] = map[uid] || [];
            map[uid].push(String(r.module_id));
          });
          setAssigns(map);
        } else {
          // Normalise INIT_ASSIGN keys to strings
          const normalised = {};
          Object.entries(INIT_ASSIGN).forEach(([k,v]) => { normalised[String(k)] = v; });
          setAssigns(normalised);
        }

        // Training completions
        const cRows = rows(cRes);
        if (cRows && cRows.length) {
          const map = {};
          cRows.forEach(r => {
            const tc_uid=String(r.user_id); map[tc_uid] = map[tc_uid] || {};
            map[tc_uid][String(r.module_id)] = { score: r.score, date: r.date, certId: r.cert_id, answers: r.answers };
          });
          setComps(map);
        }

        // Incidents
        const iRows = rows(iRes);
        if (iRows && iRows.length) {
          setIncidents(iRows.map(r => ({
            id: r.id, date: r.date, type: r.type, accidentCode: r.accident_code,
            numberCode: r.number_code, location: r.location, reportedBy: r.reported_by,
            description: r.description, injuryType: r.injury_type, riddor: r.riddor, closed: r.closed,
            riddorReported: r.riddor_reported||false,
            riddorReportedDate: r.riddor_reported_date||null,
            hseReference: r.hse_reference||null,
            riddorReportedBy: r.riddor_reported_by||null,
          })));
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
          const map = {};
          ackRows.forEach(r => { const auid=String(r.user_id); const adid=String(r.doc_id); map[auid] = map[auid] || {}; map[auid][adid] = { date: r.date }; });
          setDocAcknowledgements(map);
        }

        // Doc assignments
        const daRows = rows(daRes);
        if (daRows && daRows.length) {
          const map = {};
          daRows.forEach(r => { const did=String(r.doc_id); map[did] = map[did] || []; map[did].push(String(r.user_id)); });
          setDocAssignments(map);
        }

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
            map[ar_uid][`${r.report_idx}_${r.issue_idx}`] = { comment: r.comment, resolved: r.resolved };
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

        // Users — DB is source of truth; seed with USERS constant on first run
        const usersRows = rows(usersRes);
        if (usersRows && usersRows.length) {
          setAllUsers(usersRows.map(r => r.data));
        } else {
          // First run — seed the users table from the hardcoded USERS constant
          setAllUsers(USERS);
          try {
            await dbWrite(sb.from("users").insert(USERS.map(u => ({ id: String(u.id), data: u }))), "seed users");
          } catch(seedErr) {
            console.warn("User seed error (may already exist):", seedErr);
          }
        }

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
          setQuizFailures(qfRows.map(r => r.data));
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

        // Risk assessments (custom/edited ones override INIT_RAS)
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

        // Machine completions
        const mcRows = rows(mcRes);
        if (mcRows && mcRows.length) {
          const map = {};
          mcRows.forEach(r => { const mcuid=String(r.user_id); map[mcuid] = map[mcuid] || {}; map[mcuid][r.machine_id] = r.data; });
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
        const ccRows = rows(ccRes);
        if (ccRows && ccRows.length) {
          setCustomChemicals(ccRows.map(r => r.data));
        }

        // Fire Safety
        const fwRows  = rows(fwRes);
        const fdRows  = rows(fdRes);
        const fatRows = rows(fatRes);
        const fexRows = rows(fexRes);
        const felRows = rows(felRes);
        const ffrRows = rows(ffrRes);
        // Only override each sub-array if the DB returned rows for it.
        // If none of the tables have any rows yet (fresh install), keep seed data.
        const anyFireData = [fwRows,fdRows,fatRows,fexRows,felRows,ffrRows].some(r=>r&&r.length>0);
        setFireSafety({
          wardens:      fwRows  && fwRows.length  ? fwRows.map(r=>r.data)  : (anyFireData ? [] : INIT_FIRE_WARDENS),
          drills:       fdRows  && fdRows.length  ? fdRows.map(r=>r.data)  : (anyFireData ? [] : INIT_FIRE_DRILLS),
          alarmTests:   fatRows && fatRows.length ? fatRows.map(r=>r.data) : (anyFireData ? [] : INIT_ALARM_TESTS),
          extinguishers:fexRows && fexRows.length ? fexRows.map(r=>r.data) : (anyFireData ? [] : INIT_EXTINGUISHERS),
          emergLighting:felRows && felRows.length ? felRows.map(r=>r.data) : (anyFireData ? [] : INIT_EMERG_LIGHTING),
          fraReviews:   ffrRows && ffrRows.length ? ffrRows.map(r=>r.data) : (anyFireData ? [] : INIT_FRA_REVIEWS),
        });

        // First Aid Register
        const faRow = rows(faRes);
        if (faRow && faRow.length) setFirstAidData(faRow[0].data);
      } catch (e) {
        console.error("Supabase load error:", e);
      } finally {
        setDbReady(true);
      }
    }
    loadAll();
  }, []);

  // Seed Documents tab with RA docs on mount (moved from RiskAssessmentTab)
  useEffect(() => {
    setDocs(prevDocs => {
      const existingRaIds = new Set(prevDocs.filter(d=>d.raId).map(d=>d.raId));
      const newEntries = INIT_RAS
        .filter(ra => !existingRaIds.has(ra.id))
        .map(ra => {
          const html = generateRAHtml(ra);
          const b64 = "data:text/html;base64," + btoa(unescape(encodeURIComponent(html)));
          return {
            id: "d_" + ra.id,
            title: ra.title,
            date: ra.date,
            size: Math.round(html.length / 1024) + " KB",
            type: "Risk Assessment",
            fileData: b64,
            fileName: ra.title.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"") + ".html",
            ext: "HTML",
            raId: ra.id,
          };
        });
      return newEntries.length > 0 ? [...prevDocs, ...newEntries] : prevDocs;
    });
  }, []); // eslint-disable-line

  // ── Auto-sync watchers — fire whenever state changes after initial load ───────
  const _ready = useRef(false);
  useEffect(() => { if (dbReady) _ready.current = true; }, [dbReady]);

  useEffect(() => { if (!_ready.current) return;
    incidents.forEach(inc => dbSaveIncident(inc));
  }, [incidents]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    Object.entries(investigations).forEach(([id, data]) => dbSaveInvestigation(id, data));
  }, [investigations]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    Object.entries(dseReports).forEach(([uid, reports]) => dbSaveDseReport(Number(uid), reports));
  }, [dseReports]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    Object.entries(adminResponses).forEach(([uid, keys]) => {
      Object.entries(keys).forEach(([key, rec]) => {
        const [ri, ii] = key.split("_").map(Number);
        dbSaveDseAdminResponse(Number(uid), ri, ii, rec);
      });
    });
  }, [adminResponses]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    dbSaveEquipment(equipment);
  }, [equipment]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    dbSaveSiteInspections(siteInspections);
  }, [siteInspections]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    dbSaveFireSafety(fireSafety);
  }, [fireSafety]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    dbSaveFirstAidData(firstAidData);
  }, [firstAidData]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    customModules.forEach(m => dbSaveCustomModule(m));
  }, [customModules]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    customMachineTypes.forEach(m => dbSaveCustomMachineType(m));
  }, [customMachineTypes]); // eslint-disable-line

  useEffect(() => { if (!_ready.current) return;
    Object.entries(passwords).forEach(([uid, pw]) => dbSavePassword(Number(uid), pw));
  }, [passwords]); // eslint-disable-line

  // ── Sync helpers — call these wherever state currently changes ───────────────

  async function dbSaveAssigns(newAssigns) {
    for (const [uid, mids] of Object.entries(newAssigns)) {
      await dbWrite(sb.from("training_assigns").delete().eq("user_id", String(uid)), "training assignments clear");
      if (mids && mids.length) {
        const rows = mids.map(mid => ({ user_id: String(uid), module_id: String(mid) }));
        const { error } = await sb.from("training_assigns").insert(rows);
        if (error) console.error("training_assigns insert error:", error);
      }
    }
  }

  async function dbSaveCompletion(userId, moduleId, rec) {
    await dbWrite(sb.from("training_completions").upsert({
      user_id: userId, module_id: moduleId,
      score: rec.score, date: rec.date, cert_id: rec.certId, answers: rec.answers,
    }, { onConflict: "user_id,module_id" }), "training completion");
  }

  async function dbSaveIncident(inc) {
    await dbWrite(sb.from("incidents").upsert({
      id: inc.id, date: inc.date, type: inc.type, accident_code: inc.accidentCode,
      number_code: inc.numberCode, location: inc.location, reported_by: inc.reportedBy,
      description: inc.description, injury_type: inc.injuryType, riddor: inc.riddor, closed: inc.closed,
      riddor_reported: inc.riddorReported||false,
      riddor_reported_date: inc.riddorReportedDate||null,
      hse_reference: inc.hseReference||null,
      riddor_reported_by: inc.riddorReportedBy||null,
    }, { onConflict: "id" }), "incident", { alertOnError: true });
  }

  async function dbDeleteIncident(id) {
    await dbWrite(sb.from("incidents").delete().eq("id", id), "incident delete");
  }

  async function dbSaveInvestigation(incidentId, data) {
    await dbWrite(sb.from("investigations").upsert({ incident_id: incidentId, data }, { onConflict: "incident_id" }), "investigation");
  }

  async function dbAcknowledgeDoc(userId, docId, date) {
    await dbWrite(sb.from("doc_acknowledgements").upsert({ user_id: String(userId), doc_id: String(docId), date }, { onConflict: "user_id,doc_id" }), "document acknowledgement");
  }

  async function dbSaveDocAssignments(docId, userIds) {
    await dbWrite(sb.from("doc_assignments").delete().eq("doc_id", String(docId)), "doc assignments clear");
    if (userIds.length) await dbWrite(sb.from("doc_assignments").insert(userIds.map(uid => ({ doc_id: String(docId), user_id: String(uid) }))), "doc assignments");
  }

  async function dbSaveDoc(doc, file) {
    // Upload raw file to Storage bucket — flat path, no subfolders
    if (file) {
      const safeName = doc.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `doc_${doc.id}_${safeName}`;
      const { error } = await sb.storage.upload("documents", path, file);
      if (error) { console.error("Doc upload failed:", error); alert("Upload failed: " + error); return; }
      doc.fileUrl = sb.storage.getPublicUrl("documents", path);
    }
    await dbWrite(sb.from("documents").upsert({
      id: doc.id, title: doc.title, date: doc.date, size: doc.size,
      type: doc.type, ext: doc.ext, file_name: doc.fileName, file_url: doc.fileUrl || null,
      version: doc.version || 1,
      review_date: doc.reviewDate || null,
      description: doc.description || null,
    }, { onConflict: "id" }), "document", { alertOnError: true });
  }

  async function dbDeleteDoc(id, fileName) {
    if (fileName) {
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      await dbWrite(sb.storage.remove("documents", [`doc_${id}_${safeName}`]), "document file delete");
    }
    await dbWrite(sb.from("documents").delete().eq("id", id), "document delete");
    await dbWrite(sb.from("doc_assignments").delete().eq("doc_id", id), "doc assignments delete");
    await dbWrite(sb.from("doc_acknowledgements").delete().eq("doc_id", id), "doc acknowledgements delete");
  }

  async function dbSaveDseReport(userId, reports) {
    await dbWrite(sb.from("dse_reports").delete().eq("user_id", userId), "DSE reports clear");
    if (reports.length) {
      await dbWrite(sb.from("dse_reports").insert(reports.map((r, i) => ({ user_id: String(userId), report_idx: i, data: r }))), "DSE reports");
    }
  }

  async function dbSaveDseAdminResponse(userId, reportIdx, issueIdx, rec) {
    await dbWrite(sb.from("dse_admin_responses").upsert({
      user_id: userId, report_idx: reportIdx, issue_idx: issueIdx,
      comment: rec.comment, resolved: rec.resolved,
    }, { onConflict: "user_id,report_idx,issue_idx" }), "DSE admin response");
  }

  async function dbRecordLogin(userId, ts) {
    await dbWrite(sb.from("last_logins").upsert({ user_id: String(userId), last_login: ts }, { onConflict: "user_id" }), "last login");
  }

  async function dbSavePassword(userId, password) {
    // Always store hashed — hash it here if it's not already a 64-char hex hash
    const isAlreadyHashed = /^[0-9a-f]{64}$/.test(password);
    const hashed = isAlreadyHashed ? password : await hashPassword(password);
    await dbWrite(sb.from("user_passwords").upsert({ user_id: String(userId), password: hashed }, { onConflict: "user_id" }), "password", { alertOnError: true });
  }

  async function dbSaveTheme(userId, themeKey) {
    const sid = String(userId);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}), theme: themeKey };
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    await dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "theme preference");
  }

  async function dbSaveEmojiMode(userId, enabled) {
    const sid = String(userId);
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const existing = profiles.find(r => String(r.user_id) === sid);
    const merged = { ...(existing?.data || {}), emojiMode: enabled };
    window.__userProfiles = profiles.map(r => String(r.user_id)===sid ? {...r, data:merged} : r);
    if (!existing) window.__userProfiles.push({ user_id: sid, data: merged });
    await dbWrite(sb.from("user_profiles").upsert({ user_id: sid, data: merged }, { onConflict: "user_id" }), "emoji mode preference");
  }

  async function dbSaveUser(user) {
    await dbWrite(sb.from("users").upsert({ id: String(user.id), data: user }, { onConflict: "id" }), "user", { alertOnError: true });
  }

  async function dbDeleteUser(userId) {
    await dbWrite(sb.from("users").delete().eq("id", String(userId)), "user delete", { alertOnError: true });
  }

  async function dbSaveUserProfile(user) {
    await dbWrite(sb.from("user_profiles").upsert({ user_id: String(user.id), data: user }, { onConflict: "user_id" }), "user profile");
  }

  async function dbDeleteUserProfile(userId) {
    await dbWrite(sb.from("user_profiles").delete().eq("user_id", String(userId)), "user profile delete");
  }

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
    await dbWrite(sb.from("risk_assessments").upsert({ id: ra.id, data: ra }, { onConflict: "id" }), "risk assessment", { alertOnError: true });
  }

  async function dbSaveQuizFailure(record) {
    await dbWrite(sb.from("quiz_failures").insert({ data: record }), "quiz failure record");
  }

  async function dbSaveExtCert(userId, certType, data) {
    await dbWrite(sb.from("ext_certs").upsert({ user_id: String(userId), cert_type: certType, data }, { onConflict: "user_id,cert_type" }), "external certificate", { alertOnError: true });
  }

  async function dbDeleteExtCert(userId, certType) {
    await dbWrite(sb.from("ext_certs").delete().match({ user_id: userId, cert_type: certType }), "external certificate delete");
  }

  async function dbSaveCustomModule(mod) {
    await dbWrite(sb.from("custom_modules").upsert({ id: mod.id, data: mod }, { onConflict: "id" }), `module "${mod.title || mod.id}"`);
  }

  async function dbDeleteCustomModule(id) {
    await dbWrite(sb.from("custom_modules").delete().eq("id", id), "module delete");
  }

  async function dbSaveCustomMachineType(type) {
    await dbWrite(sb.from("custom_machine_types").upsert({ id: type.id, data: type }, { onConflict: "id" }), "custom machine type");
  }

  async function dbDeleteCustomMachineType(id) {
    await dbWrite(sb.from("custom_machine_types").delete().eq("id", id), "custom machine type delete");
  }

  async function dbSaveMachineComp(userId, machineId, data) {
    await dbWrite(sb.from("machine_completions").upsert({ user_id: String(userId), machine_id: String(machineId), data }, { onConflict: "user_id,machine_id" }), "machine competence record", { alertOnError: true });
  }

  async function dbDeleteMachineComp(userId, machineId) {
    await dbWrite(sb.from("machine_completions").delete().match({ user_id: String(userId), machine_id: String(machineId) }), "machine competence delete", { alertOnError: true });
  }

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

  async function dbSaveFirstAidData(data) {
    await dbWrite(sb.from("first_aid_register").upsert({ id: "singleton", data }, { onConflict: "id" }), "first aid register");
  }

  async function dbSaveFireSafety(fs) {
    const upsertTable = async (table, items) => {
      if (!items || !items.length) return;
      const rows = table === "fire_fra_reviews"
        ? items.map(r => { const {fileData, _fileObj, ...rest} = r; return { id: r.id, data: rest }; })
        : items.map(r => { const {_fileObj, ...rest} = r; return { id: r.id, data: rest }; });
      await dbWrite(sb.from(table).upsert(rows, { onConflict: "id" }), `fire safety: ${table}`);
    };
    const deleteRemoved = async (table, items) => {
      if (!items || !items.length) return;
      // Delete rows in DB that are no longer in state
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

  // ── Show loading screen until Supabase data is ready ────────────────────────
  if (!dbReady) return (
    <div style={{minHeight:"100vh",background:Z.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow','Trebuchet MS',system-ui,sans-serif",flexDirection:"column",gap:20}}>
      <ZeusProtectLogo/>
      <div style={{color:Z.muted,fontSize:14,letterSpacing:1}}>CONNECTING TO DATABASE…</div>
      <div style={{width:200,height:3,background:Z.border,borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:"60%",background:`linear-gradient(90deg,${Z.accent},${Z.accentLt})`,borderRadius:99,animation:"slide 1.2s ease-in-out infinite"}}/>
      </div>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
    </div>
  );

  async function login() {
    const emailKey = email.toLowerCase().trim();

    // Check lockout
    const attempt = loginAttempts[emailKey];
    if (attempt?.lockedUntil && Date.now() < attempt.lockedUntil) {
      const minsLeft = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      setErr(`Too many failed attempts. Try again in ${minsLeft} minute${minsLeft!==1?"s":""}.`);
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

    // Success — clear attempts
    setLoginAttempts(p => { const n={...p}; delete n[emailKey]; return n; });
    const ts = new Date().toISOString().slice(0,16).replace("T"," ");
    setLastLoginMap(p=>({...p, [u.id]: ts}));
    dbRecordLogin(u.id, ts);
    // Restore saved theme for this user
    const profiles = Array.isArray(window.__userProfiles) ? window.__userProfiles : [];
    const profile = profiles.find(r => String(r.user_id) === String(u.id));
    if (profile?.data?.theme) {
      setTheme(profile.data.theme);
      setDarkMode(["dark","slate","forest","graphite"].includes(profile.data.theme));
    }
    if (profile?.data?.emojiMode === false) setEmojiMode(false);
    setUser(u); setView(u.role==="admin"?"admin":"staff"); setErr("");
  }

  function logout() { setUser(null); setView("login"); setMod(null); }

  function startMod(m) { setMod(m); setStep(0); setQans({}); setQsub(false); setShowCelebration(false); }

  function submitQuiz() {
    let score=0;
    mod.quiz.forEach((q,i)=>{ if(qans[i]===q.answer) score++; });
    const pct=Math.round(score/mod.quiz.length*100);
    setQsub(true);
    const certId = pct>=70 ? "ZSL-" + (user.id.toString(36) + mod.id + Date.now().toString(36)).toUpperCase().slice(-8) : null;
    if (pct>=70) setShowCelebration(true);
    const rec = {score:pct, date:new Date().toISOString().slice(0,10), answers:{...qans}, certId};
    setComps(p=>({...p,[user.id]:{...p[user.id],[mod.id]:rec}}));
    dbSaveCompletion(user.id, mod.id, rec);
    // Record failure for admin visibility
    if (pct < 70) {
      const failure = {
        id: "qf_" + Date.now(),
        userId: user.id,
        userName: user.name,
        moduleId: mod.id,
        moduleTitle: mod.title,
        score: pct,
        date: new Date().toISOString().slice(0,10),
        acknowledged: false,
      };
      setQuizFailures(p=>[...p, failure]);
      dbSaveQuizFailure(failure);
    }
  }

  const totalSlides = mod ? mod.content.length : 0;
  const quizStep = totalSlides+1;

  // ── Shared nav styles ──
  const navBtn = (active, col=T.accentLt) => ({
    padding:"16px 16px", background:"none", border:"none",
    borderBottom:`3px solid ${active?col:"transparent"}`,
    color:active?col:darkMode?"#94a3b8":"#475569",
    fontWeight:active?700:500, cursor:"pointer", fontSize:12,
    textTransform:"uppercase", letterSpacing:.8,
    fontFamily:font, transition:"color .2s",
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════════════════
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
          <button onClick={login} style={{marginTop:4,background:"linear-gradient(135deg,#2563eb,#152370)",color:"#ffffff",border:"none",borderRadius:10,padding:"13px",fontWeight:800,fontSize:15,cursor:"pointer",letterSpacing:.5,fontFamily:font,boxShadow:"0 4px 20px rgba(37,99,235,.4)"}}>
            Sign In →
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
  // DSE ASSESSMENT
  // ══════════════════════════════════════════════════════════════════════════
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
      Z={T} font={font}
    />;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE PLAYER
  // ══════════════════════════════════════════════════════════════════════════
  if (mod && view==="staff") {
    const isIntro = step===0;
    const isQuiz  = step===quizStep;
    const slide   = (!isIntro && !isQuiz) ? mod.content[step-1] : null;

    let qScore=0, qPct=0, passed=false;
    if (qsub) {
      mod.quiz.forEach((q,i)=>{ if(qans[i]===q.answer) qScore++; });
      qPct = Math.round(qScore/mod.quiz.length*100);
      passed = qPct>=70;
    }

    return (
      <>
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
                    setCert({module:mod,score:qPct,date:new Date().toLocaleDateString(),certId:(comps[user.id]||{})[mod.id]?.certId||null});
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

        <div style={{maxWidth:720,margin:"0 auto",padding:"44px 24px"}}>

          {isIntro && (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:72,marginBottom:16}}>{mod.icon}</div>
              <h1 style={{fontSize:32,fontWeight:900,letterSpacing:-1,marginBottom:6}}>{mod.title}</h1>
              <p style={{color:T.muted,fontSize:15,marginBottom:28}}>{mod.category} · {mod.duration} · <span style={{color:mod.level==="Mandatory"?"#f87171":T.accentLt}}>{mod.level}</span> · {totalSlides} slides · {mod.quiz.length} quiz questions</p>
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:28,textAlign:"left",border:`1px solid ${T.border}`}}>
                <p style={{margin:0,color:T.slate,lineHeight:1.8,fontSize:15}}>Read through each slide carefully, then complete the knowledge check. A score of <strong style={{color:T.green}}>70% or above</strong> is required to pass and receive your Zeus certificate.</p>
              </div>
              <button onClick={()=>{setStep(1);window.scrollTo({top:0,behavior:"smooth"});}} style={{marginTop:32,background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:T.white,border:"none",borderRadius:12,padding:"14px 44px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:font,boxShadow:`0 6px 24px ${T.accent}55`,letterSpacing:.5}}>
                Begin Module →
              </button>
            </div>
          )}

          {slide && (
            <div>
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:20,padding:40,border:`1px solid ${T.border}`,boxShadow:"0 8px 40px rgba(0,0,0,.4)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <div style={{color:T.muted,fontSize:11,fontWeight:800,letterSpacing:2}}>SLIDE {step} OF {totalSlides}</div>
                  <div style={{display:"flex",gap:4}}>
                    {Array.from({length:totalSlides}).map((_,i)=>(
                      <div key={i} style={{width:i===step-1?20:6,height:6,borderRadius:99,background:i===step-1?T.accentLt:T.borderMd,transition:"width .3s"}}/>
                    ))}
                  </div>
                </div>
                {slide.heading && (
                  <h2 style={{fontSize:22,fontWeight:900,color:T.white,margin:"0 0 18px",letterSpacing:-.5,paddingBottom:14,borderBottom:`1px solid ${T.borderMd}`}}>
                    {slide.heading}
                  </h2>
                )}
                {((slide.images||[]).length>0 || slide.image?.data || slide.image?.url) && (
                  <div style={{marginBottom:20,display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center"}}>
                    {/* new images[] array */}
                    {(slide.images||[]).map((img,ii)=>(
                      <img key={ii} src={img.url||img.data} alt={img.name||""} onClick={()=>setLightboxSrc(img.url||img.data)}
                        style={{maxWidth:"100%",flex:"1 1 220px",maxHeight:360,borderRadius:12,border:`1px solid ${T.borderMd}`,objectFit:"contain",cursor:"zoom-in"}}/>
                    ))}
                    {/* backwards compat: old single image field */}
                    {(slide.images||[]).length===0 && (slide.image?.data||slide.image?.url) && (
                      <img src={slide.image.data||slide.image.url} alt={slide.image.name||""} onClick={()=>setLightboxSrc(slide.image.data||slide.image.url)}
                        style={{maxWidth:"100%",maxHeight:360,borderRadius:12,border:`1px solid ${T.borderMd}`,objectFit:"contain",cursor:"zoom-in"}}/>
                    )}
                  </div>
                )}
                {slide.video && (
                  <div style={{marginBottom:20,borderRadius:12,overflow:"hidden",background:"#000",border:`1px solid ${T.borderMd}`}}>
                    {slide.video.uploading
                      ? <div style={{padding:32,textAlign:"center",color:"#aaa",fontSize:13}}>⏳ Uploading video…</div>
                      : <video src={slide.video.url||slide.video.data} controls style={{width:"100%",maxHeight:360,display:"block"}}/>
                    }
                  </div>
                )}
                {slide.text && (
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
                )}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:24,gap:12}}>
                <button onClick={()=>{setStep(s=>s-1);window.scrollTo({top:0,behavior:"smooth"});}} disabled={step===1}
                  style={{background:T.headerBgMd,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 28px",color:T.muted,cursor:"pointer",fontWeight:700,fontFamily:font,opacity:step===1?.4:1}}>← Previous</button>
                <button onClick={()=>{setStep(s=>s+1);window.scrollTo({top:0,behavior:"smooth"});}}
                  style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,border:"none",borderRadius:10,padding:"10px 28px",color:T.white,cursor:"pointer",fontWeight:800,fontFamily:font,boxShadow:`0 4px 16px ${T.accent}44`}}>
                  {step===totalSlides?"Take Quiz →":"Next Slide →"}
                </button>
              </div>
            </div>
          )}

          {isQuiz && !qsub && (
            <div>
              <h2 style={{fontSize:24,fontWeight:900,marginBottom:4,letterSpacing:-.5}}>Knowledge Check</h2>
              <p style={{color:T.muted,marginBottom:28,fontSize:14}}>{mod.quiz.length} questions · 70% needed to pass</p>
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
                {!passed && <p style={{color:T.amber,marginTop:6}}>You need 70% to pass. Review the slides and try again.</p>}
                <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:28,flexWrap:"wrap"}}>
                  {passed && (
                    <button onClick={()=>setCert({module:mod,score:qPct,date:new Date().toLocaleDateString(),certId:(comps[user.id]||{})[mod.id]?.certId||null})}
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
      {/* Lightbox overlay */}
      {lightboxSrc && (
        <div
          onClick={()=>setLightboxSrc(null)}
          onKeyDown={e=>e.key==="Escape"&&setLightboxSrc(null)}
          tabIndex={-1}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:20,cursor:"zoom-out"}}
        >
          <button
            onClick={e=>{e.stopPropagation();setLightboxSrc(null);}}
            style={{position:"absolute",top:18,right:22,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:99,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,cursor:"pointer",fontWeight:700,lineHeight:1}}
          >✕</button>
          <img
            src={lightboxSrc}
            alt=""
            onClick={e=>e.stopPropagation()}
            style={{maxWidth:"100%",maxHeight:"90vh",borderRadius:10,boxShadow:"0 24px 80px rgba(0,0,0,0.8)",objectFit:"contain",cursor:"default"}}
          />
        </div>
      )}
      </>
    );
  }
  const CertModal = () => cert && (() => {
    const certRef = React.useRef(null);
    const certId = cert.certId || "ZSL-"+Math.random().toString(36).slice(2,8).toUpperCase();
    const issueDate = cert.date;
    const moduleIcon = cert.module.icon || "🏅";

    function printCert() {
      const el = certRef.current;
      if (!el) return;
      const win = window.open("","_blank","width=900,height=650");
      win.document.write(`
        <html><head><title>Certificate — ${cert.module.title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&display=swap');
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#091548; font-family:'Barlow',sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          @media print { body { background:#091548; } @page { margin:0; size: A4 landscape; } }
        </style></head>
        <body>${el.outerHTML}<script>window.onload=()=>{window.print();}<\/script></body></html>
      `);
      win.document.close();
    }

    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20,overflow:"auto"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,width:"100%",maxWidth:640}}>

          {/* Certificate card */}
          <div ref={certRef} style={{
            width:"100%",
            background:"linear-gradient(160deg,#0d1f5c 0%,#091548 60%,#0a1a4a 100%)",
            borderRadius:20,
            padding:0,
            position:"relative",
            overflow:"hidden",
            boxShadow:`0 0 0 1px rgba(245,158,11,0.4), 0 0 0 4px rgba(245,158,11,0.08), 0 40px 80px rgba(0,0,0,0.7)`,
          }}>

            {/* Full decorative border using absolute positioned div */}
            <div style={{position:"absolute",inset:0,borderRadius:20,border:"3px solid rgba(245,158,11,0.6)",pointerEvents:"none",zIndex:2}}/>
            <div style={{position:"absolute",inset:8,borderRadius:14,border:"1px solid rgba(245,158,11,0.2)",pointerEvents:"none",zIndex:2}}/>
            {/* Corner ornaments */}
            {[["top:12px","left:12px"],["top:12px","right:12px"],["bottom:12px","left:12px"],["bottom:12px","right:12px"]].map((pos,i)=>{
              const style = {position:"absolute",width:20,height:20,zIndex:3,pointerEvents:"none"};
              pos.forEach(p=>{ const [k,v]=p.split(":"); style[k]=v; });
              const r = i===1||i===3 ? "rotate(90deg)" : i===2 ? "rotate(-90deg)" : i===3 ? "rotate(180deg)" : "none";
              const transforms = ["none","rotate(90deg)","rotate(-90deg)","rotate(180deg)"];
              return (
                <svg key={i} style={{...style,transform:transforms[i]}} viewBox="0 0 20 20">
                  <path d="M0,0 L16,0 L16,2 L2,2 L2,16 L0,16 Z" fill="#f59e0b" opacity="0.8"/>
                  <circle cx="2" cy="2" r="2" fill="#f59e0b"/>
                </svg>
              );
            })}

            {/* Watermark */}
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:0}}>
              <div style={{fontSize:72,fontWeight:900,color:"rgba(245,158,11,0.04)",letterSpacing:8,textTransform:"uppercase",transform:"rotate(-30deg)",whiteSpace:"nowrap",userSelect:"none"}}>
                ZEUS PROTECT
              </div>
            </div>

            {/* Top gold bar */}
            <div style={{height:6,background:"linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b)",position:"relative",zIndex:1}}/>

            {/* Content */}
            <div style={{padding:"20px 48px 24px",position:"relative",zIndex:1,textAlign:"center"}}>

              {/* Logo + title row */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
                <img src={ZEUS_LOGO_LIGHT_SRC} alt="Zeus" style={{height:44,objectFit:"contain"}}/>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:3,color:"rgba(245,158,11,0.7)",textTransform:"uppercase",marginBottom:2}}>Zeus Protect</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:1}}>Health & Safety Training</div>
                </div>
              </div>

              {/* Divider */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(245,158,11,0.4))"}}/>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:"rgba(245,158,11,0.8)",textTransform:"uppercase"}}>Certificate of Completion</div>
                <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(245,158,11,0.4),transparent)"}}/>
              </div>

              {/* This certifies */}
              <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>This is to certify that</div>

              {/* Name */}
              <div style={{fontSize:30,fontWeight:900,color:"#ffffff",letterSpacing:-0.5,marginBottom:2,lineHeight:1.1}}>{user?.name}</div>
              {user?.jobTitle && <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:10}}>{user.jobTitle}</div>}

              {/* has successfully completed */}
              <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>has successfully completed</div>

              {/* Module */}
              <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:12,padding:"10px 24px",marginBottom:12,display:"inline-block",minWidth:300}}>
                <div style={{fontSize:28,marginBottom:6}}>{moduleIcon}</div>
                <div style={{fontSize:18,fontWeight:800,color:"#f59e0b",lineHeight:1.2}}>{cert.module.title}</div>
                {cert.module.category && <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:4}}>{cert.module.category}</div>}
              </div>

              {/* Score + date row */}
              <div style={{display:"flex",justifyContent:"center",gap:32,marginBottom:24}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",marginBottom:4}}>Score Achieved</div>
                  <div style={{fontSize:22,fontWeight:900,color:"#10b981"}}>{cert.score}%</div>
                </div>
                <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",marginBottom:4}}>Date Issued</div>
                  <div style={{fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.8)"}}>{issueDate}</div>
                </div>
                {cert.module.renewalMonths && <>
                  <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",marginBottom:4}}>Valid For</div>
                    <div style={{fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.8)"}}>{cert.module.renewalMonths} months</div>
                  </div>
                </>}
              </div>

              {/* Signature line + seal row */}
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:20}}>
                {/* Signature */}
                <div style={{textAlign:"left"}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:22,color:"rgba(255,255,255,0.7)",letterSpacing:1,marginBottom:4,fontStyle:"italic"}}>Zeus Protect</div>
                  <div style={{width:120,height:1,background:"rgba(255,255,255,0.2)",marginBottom:6}}/>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:1,textTransform:"uppercase"}}>Authorised Signature</div>
                </div>

                {/* Gold seal */}
                <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
                  <svg viewBox="0 0 80 80" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
                    {/* Starburst */}
                    {Array.from({length:16}).map((_,i)=>{
                      const a = (i*22.5)*Math.PI/180;
                      const a2 = (i*22.5+11.25)*Math.PI/180;
                      const x1=40+34*Math.cos(a), y1=40+34*Math.sin(a);
                      const x2=40+28*Math.cos(a2), y2=40+28*Math.sin(a2);
                      const x3=40+34*Math.cos(a+22.5*Math.PI/180), y3=40+34*Math.sin(a+22.5*Math.PI/180);
                      return <polygon key={i} points={`40,40 ${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill="#f59e0b" opacity="0.9"/>;
                    })}
                    <circle cx="40" cy="40" r="24" fill="#0d1f5c" stroke="#f59e0b" strokeWidth="1.5"/>
                    <text x="40" y="35" textAnchor="middle" fill="#f59e0b" fontSize="7" fontWeight="700" fontFamily="Barlow,sans-serif" letterSpacing="1">ZEUS</text>
                    <text x="40" y="44" textAnchor="middle" fill="#fbbf24" fontSize="5.5" fontFamily="Barlow,sans-serif" letterSpacing="0.5">PROTECT</text>
                    <text x="40" y="53" textAnchor="middle" fill="rgba(245,158,11,0.6)" fontSize="4.5" fontFamily="Barlow,sans-serif">VERIFIED</text>
                  </svg>
                </div>

                {/* Cert ref */}
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Certificate ID</div>
                  <div style={{fontSize:12,fontWeight:700,color:"rgba(245,158,11,0.7)",letterSpacing:2,fontFamily:"monospace"}}>{certId}</div>
                </div>
              </div>
            </div>

            {/* Bottom gold bar */}
            <div style={{height:4,background:"linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b)"}}/>
          </div>

          {/* Buttons */}
          <div style={{display:"flex",gap:10}}>
            <button onClick={printCert}
              style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"11px 24px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,boxShadow:"0 4px 14px rgba(37,99,235,0.4)"}}>
              🖨 Print / Save PDF
            </button>
            <button onClick={()=>setCert(null)}
              style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"11px 24px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  })();

  // ══════════════════════════════════════════════════════════════════════════
  // STAFF PORTAL
  // ══════════════════════════════════════════════════════════════════════════
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
    // Modules needing attention (not started + expired)
    const actionNeeded = [...notStarted, ...expired];
    // Next due = soonest expiring module or oldest not-started
    const nextUp = notStarted.length ? notStarted[0] : expiring.length ? expiring[0] : null;

    // ── DSE tracking ────────────────────────────────────────────────────────
    const myDseReports   = dseReports[user.id]||[];
    const lastDseReport  = myDseReports[myDseReports.length-1];
    const lastDseRi      = myDseReports.length-1;
    const myAdminResps   = adminResponses[user.id]||{};
    const dseCompleted   = !!lastDseReport;
    // DSE renewal — recommended annually
    const DSE_RENEWAL_MONTHS = 12;
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
    const expiringCerts = myCertTypes.filter(ct=>{ const c=myExtCerts[ct.id]; if(!c.expiryDate) return false; const d=Math.ceil((new Date(c.expiryDate)-new Date())/86400000); return d>=0&&d<=90; });
    // Documents needing acknowledgement
    const myDocAssigns = Object.entries(docAssignments||{}).filter(([,uids])=>uids.includes(String(user.id))).map(([did])=>did);
    const unreadDocs = myDocAssigns.filter(did=>!(docAcknowledgements[String(user.id)]||{})[did]);
    // Overall health score — includes DSE as one item
    const totalItems = myMods.length + myCertTypes.length + 1; // +1 for DSE
    const goodItems  = upToDate.length + myCertTypes.filter(ct=>!expiredCerts.find(e=>e.id===ct.id)&&!expiringCerts.find(e=>e.id===ct.id)).length + (dseCompleted&&!dseExpired?1:0);
    const healthPct  = totalItems ? Math.round(goodItems/totalItems*100) : 100;
    const healthColor = healthPct===100?"#10b981":healthPct>=70?"#f59e0b":"#ef4444";
    const healthLabel = healthPct===100?"Fully Compliant":healthPct>=70?"Mostly Compliant":"Needs Attention";
    const totalActionNeeded = actionNeeded.length + (dseNeedsAction?1:0);

    return (
      <EmojiCtx.Provider value={emojiMode}>
      <div style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.white}}>
        <CertModal/>
        <PreviewModal doc={previewDoc} onClose={()=>setPreviewDoc(null)} Z={T} font={font}/>
        {/* Nav */}
        <div style={{background:`linear-gradient(90deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:"0 24px",display:"flex",alignItems:"center",position:"relative"}}>
          <div style={{marginRight:20,padding:"10px 0",flexShrink:0}}><ZeusLogo darkMode={darkMode}/></div>
          <div style={{display:"flex",alignItems:"center",gap:2,flex:1,overflowX:"auto"}} className="staff-nav-tabs">
            {["dashboard","training","history","documents","incidents","dse",...(isWarehouseWorker(user)?["machinery"]:[]),"actions"].map(t=>(
              <button key={t} onClick={()=>setStab(t)}
                style={{background:"none",border:"none",borderBottom:stab===t?`2px solid ${T.accent}`:"2px solid transparent",color:stab===t?T.white:T.muted,fontWeight:stab===t?700:400,fontSize:13,cursor:"pointer",padding:"14px 14px 12px",fontFamily:font,whiteSpace:"nowrap",letterSpacing:.3,transition:"color .15s"}}>
                {{dashboard:"Dashboard",training:"My Training",history:"History",documents:"Documents",incidents:"Report Incident",dse:"My DSE",machinery:"My Machinery",actions:"My Actions"}[t]}
              </button>
            ))}
          </div>
          <button className="mobile-ham" style={{display:"none",background:"none",border:`1px solid ${T.borderMd}`,borderRadius:8,color:T.white,fontSize:20,cursor:"pointer",padding:"4px 10px",lineHeight:1,fontFamily:font,flexShrink:0}}
            onClick={()=>setMobileMenuOpen(m=>!m)}>
            {mobileMenuOpen?"✕":"☰"}
          </button>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:isMobile?6:10}}>
            {(()=>{
              const notifications = [];
              const myIds = assigns[user.id]||[];
              const myC   = comps[user.id]||{};
              // Incomplete modules
              const pending = allModules.filter(m=>myIds.includes(m.id)&&!myC[m.id]);
              pending.forEach(m=>notifications.push({type:"module",urgent:m.level==="Mandatory",title:`Complete: ${m.title}`,detail:m.level==="Mandatory"?"Mandatory module — action required":m.duration,nav:{tab:"training"}}));
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
              if(!(dseReports[user.id]||[]).length) notifications.push({type:"dse",urgent:false,title:"Complete your DSE workstation assessment",detail:"DSE Regulations 1992 — required for all screen users",nav:{tab:"dse"}});
              // Open DSE issues with no admin response
              const latestDse=(dseReports[user.id]||[])[( dseReports[user.id]||[]).length-1];
              if(latestDse){
                const ri = (dseReports[user.id]||[]).length - 1;
                const openIssues=latestDse.issues.filter((_,ii)=>!(adminResponses[user.id]||{})[`${ri}_${ii}`]?.resolved&&latestDse.issueCount>0);
                if(openIssues.length) notifications.push({type:"dse",urgent:false,title:`${openIssues.length} open DSE issue${openIssues.length!==1?"s":""}`,detail:"Check My DSE for manager responses",nav:{tab:"dse"}});
              }
              // Investigation corrective actions assigned to this user
              const myActions = Object.values(investigations).flatMap(inv=>
                (inv.actions||[]).filter(a=>a.owner===user.name&&a.status!=="complete"&&a.status!=="closed")
              );
              const overdueActions = myActions.filter(a=>a.dueDate&&a.dueDate<new Date().toISOString().slice(0,10));
              if(overdueActions.length) notifications.push({type:"report",urgent:true,title:`${overdueActions.length} overdue corrective action${overdueActions.length!==1?"s":""}`,detail:"Investigation actions past due date — action required",nav:{tab:"actions"}});
              else if(myActions.length) notifications.push({type:"report",urgent:false,title:`${myActions.length} open corrective action${myActions.length!==1?"s":""}`,detail:`You have been assigned action${myActions.length!==1?"s":""} from an investigation`,nav:{tab:"actions"}});
              return <NotificationBell notifications={notifications} onNavigate={n=>setStab(n.tab)} Z={T} font={font}/>;
            })()}
            <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>
            <button title={`Theme: ${theme} — click to cycle`} onClick={()=>{
              const order=["dark","light","slate","forest","graphite","arctic","sand","rose"];
              const next=order[(order.indexOf(theme)+1)%order.length];
              setTheme(next);
              setDarkMode(["dark","slate","forest","graphite"].includes(next));
              dbSaveTheme(user.id,next);
            }} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"5px 10px",color:T.muted,cursor:"pointer",fontSize:14,fontFamily:font,display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}>
              {theme==="dark"?"🌙":theme==="light"?"☀️":theme==="slate"?"◼":theme==="forest"?"🌲":theme==="graphite"?"⬛":theme==="arctic"?"🌌":theme==="sand"?"🏜":"🌸"}
            </button>
            <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>
            <div onClick={()=>setStab("account")}
              title="My Account"
              style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 8px 4px 4px",borderRadius:10,transition:"background .15s",background:stab==="account"?T.overlay:"transparent",border:stab==="account"?`1px solid ${T.borderMd}`:"1px solid transparent"}}
              onMouseEnter={e=>{ if(stab!=="account") e.currentTarget.style.background=T.overlay; }}
              onMouseLeave={e=>{ e.currentTarget.style.background=stab==="account"?T.overlay:"transparent"; }}>
              <Avatar name={user.name} size={32}/>
              <span style={{fontSize:13,color:stab==="account"?T.white:T.muted,fontWeight:600}}>{user.name.split(" ")[0]}</span>
            </div>
            <button onClick={logout} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,fontFamily:font}}>Sign Out</button>
          </div>
        </div>


      {/* Mobile nav drawer */}
        {mobileMenuOpen && (
          <div className="mobile-nav-drawer" style={{position:"relative"}}>
            {["dashboard","training","history","documents","incidents","dse",...(isWarehouseWorker(user)?["machinery"]:[]),"actions"].map(t=>(
              <button key={t} onClick={()=>{setStab(t);setMobileMenuOpen(false);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"12px 24px",background:stab===t?"rgba(37,99,235,0.15)":"transparent",border:"none",borderBottom:`1px solid rgba(255,255,255,0.05)`,color:stab===t?T.white:T.muted,fontWeight:stab===t?700:400,fontSize:14,cursor:"pointer",fontFamily:font}}>
                {{dashboard:E("🏠 ","")+"Dashboard",training:E("📚 ","")+"My Training",history:E("📋 ","")+"History",documents:E("📄 ","")+"Documents",incidents:E("🚨 ","")+"Report Incident",dse:"🖥️ My DSE",machinery:"⚙️ My Machinery",actions:"✅ My Actions"}[t]}
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
                  { label:"Assigned",   value:myMods.length,          color:T.accentLt,    sub:"modules total" },
                  { label:"Up to Date", value:upToDate.length,         color:"#10b981",     sub:"completed & valid" },
                  { label:"Not Started",value:notStarted.length,       color:notStarted.length>0?"#f59e0b":"#10b981", sub:"awaiting completion" },
                  { label:"Expired",    value:expired.length,          color:expired.length>0?"#ef4444":"#10b981",    sub:"need renewal" },
                  { label:"Expiring",   value:expiring.length,         color:expiring.length>0?"#f59e0b":"#10b981",   sub:"within 90 days" },
                  { label:"Documents",  value:unreadDocs.length,       color:unreadDocs.length>0?"#f59e0b":"#10b981", sub:"need acknowledgement" },
                ].map((s,i)=>(
                  <div key={i} style={{background:T.overlay,borderRadius:12,padding:"14px 16px",border:`1px solid ${s.value>0&&s.color!=="#10b981"?s.color+"44":T.borderMd}`}}>
                    <div style={{fontSize:22,fontWeight:900,color:s.color,lineHeight:1,marginBottom:3}}>{s.value}</div>
                    <div style={{fontSize:12,fontWeight:700,color:T.white}}>{s.label}</div>
                    <div style={{fontSize:10,color:T.muted,marginTop:1}}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Alerts — expired / expiring */}
              {(expired.length>0||expiring.length>0||expiredCerts.length>0||expiringCerts.length>0||unreadDocs.length>0||dseNeedsAction||dseExpiring) && (
                <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:14,padding:"16px 20px",marginBottom:20}}>
                  <div style={{fontWeight:800,fontSize:13,color:"#f87171",marginBottom:10}}>⚠ Action Required</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {!dseCompleted && (
                      <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(139,92,246,0.1)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>{ setDseAnswers({}); setDseComments({}); setDseSection(0); setDseSubmitted(false); setDseActive(true); }}>
                        <span style={{fontSize:20}}>🖥️</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>DSE Workstation Self-Assessment</div>
                          <div style={{fontSize:11,color:"#c4b5fd"}}>Required — DSE Regulations 1992 · not yet completed</div>
                        </div>
                        <button style={{background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Start →</button>
                      </div>
                    )}
                    {dseExpired && (
                      <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 12px",cursor:"pointer"}} onClick={()=>{ setDseAnswers({}); setDseComments({}); setDseSection(0); setDseSubmitted(false); setDseActive(true); }}>
                        <span style={{fontSize:20}}>🖥️</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.white}}>DSE Workstation Self-Assessment</div>
                          <div style={{fontSize:11,color:"#f87171"}}>Annual re-assessment due — last completed {lastDseReport.date}</div>
                        </div>
                        <button style={{background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:font,whiteSpace:"nowrap"}}>Retake →</button>
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
                  const dseStatusLabel = !dseCompleted?"Not completed":dseExpired?"Re-assessment due":dseExpiring?dseExpiryStatus?.label:"Completed";
                  return (
                    <div onClick={()=>{ setDseAnswers({}); setDseComments({}); setDseSection(0); setDseSubmitted(false); setDseActive(true); }}
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
                      {isDone && <span style={{fontSize:11,color:T.muted}}>{myC[m.id].score}%</span>}
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
                {myMods.map(m=>{
                  const isDone = !!myC[m.id];
                  return (
                    <div key={m.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:18,padding:24,border:`1px solid ${isDone?"rgba(16,185,129,0.25)":T.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                        <span style={{fontSize:36}}>{m.icon}</span>
                        <Pill label={isDone?"Completed":"Pending"} col={isDone?"green":"amber"}/>
                      </div>
                      <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:800}}>{m.title}</h3>
                      <p style={{color:T.muted,fontSize:12,margin:"0 0 14px"}}>{m.category} · {m.duration} · <span style={{color:m.level==="Mandatory"?"#f87171":T.accentLt}}>{m.level}</span>{m.renewalLabel&&<span style={{color:T.muted}}> · 🔄 {m.renewalLabel} renewal</span>}</p>
                      {isDone && (
                        <div style={{marginBottom:14}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                            <Bar pct={myC[m.id].score} color={myC[m.id].score>=70?T.green:T.amber}/>
                            <span style={{color:myC[m.id].score>=70?T.green:T.amber,fontWeight:700,fontSize:13}}>{myC[m.id].score}%</span>
                          </div>
                          <p style={{color:T.muted,fontSize:11,margin:"0 0 6px"}}>Completed {myC[m.id].date}</p>
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
                          {isDone?(()=>{const ex=m.renewalMonths?getExpiryStatus(myC[m.id].date,m.renewalMonths):null; return ex&&ex.status==="expired"?"Renew Now →":ex&&ex.status==="expiring"?"Renew Soon →":"Review Module"})():"Start →"}
                        </button>
                        {isDone && (
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
                      <button onClick={()=>{ setDseAnswers({}); setDseComments({}); setDseSection(0); setDseSubmitted(false); setDseActive(true); }}
                        style={{width:"100%",background:lastReport?T.overlay:`linear-gradient(135deg,#8b5cf6,#7c3aed)`,color:lastReport?"#8b5cf6":"#fff",border:lastReport?`1px solid ${T.borderMd}`:"none",borderRadius:10,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:font}}>
                        {lastReport?"Retake Assessment →":"Start Assessment →"}
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
                          <MobileCardRow label="Score" value={<span style={{color:myC[m.id].score>=70?T.green:T.amber,fontWeight:800}}>{myC[m.id].score}%</span>}/>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
                            <Pill label={myC[m.id].score>=70?"Passed":"Failed"} col={myC[m.id].score>=70?"green":"red"}/>
                            {myC[m.id].score>=70 && <button onClick={()=>setCert({module:m,score:myC[m.id].score,date:myC[m.id].date,certId:myC[m.id].certId||null})} style={{background:"rgba(245,158,11,0.1)",border:`1px solid rgba(245,158,11,0.3)`,color:T.gold,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>🏅 Certificate</button>}
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
                        <span style={{color:myC[m.id].score>=70?T.green:T.amber,fontWeight:800,fontSize:15}}>{myC[m.id].score}%</span>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <Pill label={myC[m.id].score>=70?"Passed":"Failed"} col={myC[m.id].score>=70?"green":"red"}/>
                          {myC[m.id].score>=70&&<button onClick={()=>setCert({module:m,score:myC[m.id].score,date:myC[m.id].date,certId:myC[m.id].certId||null})} style={{background:"rgba(245,158,11,0.1)",border:`1px solid rgba(245,158,11,0.3)`,color:T.gold,borderRadius:8,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>🏅 Cert</button>}
                        </div>
                      </div>
                    ))}
                  </div>)}</div>
                )}
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

                return (
                  <>
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
                                          onClick={()=>{const dt=new Date().toISOString().slice(0,10);setDocAcknowledgements(p=>({...p,[user.id]:{...(p[user.id]||{}),[d.id]:{date:dt}}}));dbAcknowledgeDoc(user.id,d.id,dt);}}
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

          {stab==="account" && <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}><LazyAccountTab user={user} passwords={passwords} setPasswords={setPasswords} darkMode={darkMode} setDarkMode={setDarkMode} theme={theme} setTheme={setTheme} onSaveTheme={k=>dbSaveTheme(user.id,k)} emojiMode={emojiMode} onSaveEmojiMode={v=>{setEmojiMode(v);dbSaveEmojiMode(user.id,v);}} Z={T} font={font}/></React.Suspense>}

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
            <LazyIncidentTracker user={user} incidents={incidents} setIncidents={setIncidents} equipment={equipment} setEquipment={setEquipment} Z={T} font={font}/>
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
              Z={T} font={font}
            />
            </React.Suspense>
          )}
          {stab==="actions" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyStaffActionsTab
              user={user}
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
              setStab={setStab} setMod={setMod}
              Z={T} font={font}
            />
            </React.Suspense>
          )}
        </div>
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
  if (view==="admin") {
    const staff = allUsers.filter(u=>u.id!==1); // show all users except the primary admin account
    const tUser = allUsers.find(u=>String(u.id)===String(target));
    const tAssigned = assigns[String(target)]||[];

    const toggleAssign = (uid, mid) => {
      const suid = String(uid);
      setAssigns(p=>{
        const c=p[suid]||[];
        const updated = c.includes(mid)?c.filter(x=>x!==mid):[...c,mid];
        const next = {...p,[suid]:updated};
        dbSaveAssigns({[suid]: updated});
        return next;
      });
    };

    const addStaff = () => {
      if (!newName.trim()) { setAddErr("Name is required."); return; }
      if (!newEmail.trim() || !newEmail.includes("@")) { setAddErr("Valid email is required."); return; }
      if (allUsers.find(u=>u.email===newEmail.trim())) { setAddErr("Email already exists."); return; }
      const id = Date.now();
      const newUser = { id, name:newName.trim(), email:newEmail.trim(), role:newRole, jobTitle:newJobTitle.trim(), manager:newManager.trim(), isWarehouseWorker:newIsWarehouse };
      setAllUsers(p=>[...p, newUser]);
      dbSaveUser(newUser);
      dbSaveUserProfile(newUser);
      setNewName(""); setNewEmail(""); setNewJobTitle(""); setNewManager(""); setNewRole("staff"); setNewIsWarehouse(false); setNewDepartment(""); setNewStatus("active"); setAddErr(""); setShowAddStaff(false);
    };

    const removeStaff = (uid) => {
      const u = allUsers.find(x=>x.id===uid);
      if (!window.confirm(`Are you sure you want to remove ${u?.name||"this staff member"}?\n\nThis will permanently delete their account, training assignments, and all associated records. This cannot be undone.`)) return;
      setAllUsers(p=>p.filter(u=>u.id!==uid));
      dbDeleteUser(uid);
      dbDeleteUserProfile(uid);
      setAssigns(p=>{ const n={...p}; delete n[uid]; return n; });
      setComps(p=>{ const n={...p}; delete n[uid]; return n; });
    };

    return (
      <EmojiCtx.Provider value={emojiMode}>
      <div style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.white,overflowX:"hidden"}}>
        {showInactivityWarning && (
          <div style={{background:"rgba(245,158,11,0.15)",borderBottom:"1px solid rgba(245,158,11,0.3)",padding:"8px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,fontSize:13,color:"#fbbf24",fontFamily:font}}>
            <span>⚠ You'll be logged out in 2 minutes due to inactivity.</span>
            <button onClick={()=>setShowInactivityWarning(false)} style={{background:"rgba(245,158,11,0.2)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,color:"#fbbf24",cursor:"pointer",fontSize:12,fontWeight:700,padding:"3px 10px",fontFamily:font}}>Dismiss</button>
          </div>
        )}
        <PreviewModal doc={previewDoc} onClose={()=>setPreviewDoc(null)} Z={T} font={font}/>
        {editingStaff && (
          <EditStaffModal
            staffUser={editingStaff}
            allUsers={allUsers} setAllUsers={setAllUsers} onSaveProfile={u=>{dbSaveUser(u);dbSaveUserProfile(u);}}
            passwords={passwords} setPasswords={setPasswords}
            onClose={()=>setEditingStaff(null)}
            Z={T} font={font}
          />
        )}
        {/* Nav */}
        <div style={{background:`linear-gradient(90deg,${T.navyDk},${T.navyMd})`,borderBottom:`1px solid ${T.border}`,padding:isMobile?"0 12px":"0 28px",display:"flex",alignItems:"center",position:"relative"}}>
          <div style={{marginRight:isMobile?8:28,padding:"12px 0",flexShrink:0}}><ZeusLogo darkMode={darkMode}/></div>
          {!isMobile && <><div style={{width:1,height:28,background:T.headerBgMd,marginRight:8}}/><Pill label="ADMIN" col="navy"/><div style={{width:1,height:20,background:T.headerBgMd,margin:"0 12px"}}/></>}
          {!isMobile && (()=>{
            const TRAINING_TABS=["assign","modules","create","reports"]; const trainingActive=TRAINING_TABS.includes(atab);
            const ME_TABS=["machinery","equipment"]; const meActive=ME_TABS.includes(atab);
            return (<>
              <button onClick={()=>setAtab("dashboard")} style={navBtn(atab==="dashboard",T.gold)}>Dashboard</button>
              <button onClick={()=>setAtab("users")} style={navBtn(atab==="users",T.gold)}>Staff</button>
              <div style={{position:"relative",display:"inline-block"}} onMouseEnter={e=>e.currentTarget.querySelector(".training-dd").style.display="block"} onMouseLeave={e=>e.currentTarget.querySelector(".training-dd").style.display="none"}>
                <button style={{...navBtn(trainingActive,T.gold),display:"flex",alignItems:"center",gap:5}}>Training<span style={{fontSize:9,opacity:.7,marginTop:1}}>▼</span></button>
                <div className="training-dd" style={{display:"none",position:"absolute",top:"100%",left:0,zIndex:200,minWidth:160,background:`linear-gradient(135deg,${T.navyDk},${T.navyMd})`,border:`1px solid ${T.borderMd}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,0.35)",overflow:"hidden",paddingTop:4,paddingBottom:4}}>
                  {[["assign","Assign Training"],["modules","Training Library"],["create","Create Module"],["reports","Reports"]].map(([id,label])=>(<button key={id} onClick={()=>setAtab(id)} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 18px",background:atab===id?`rgba(245,158,11,0.12)`:"transparent",border:"none",color:atab===id?T.gold:T.white,fontWeight:atab===id?700:500,fontSize:13,cursor:"pointer",fontFamily:font,transition:"background .15s",letterSpacing:.3}}>{label}</button>))}
                </div>
              </div>
              <button onClick={()=>setAtab("firesafety")} style={navBtn(atab==="firesafety",T.gold)}>Fire Safety</button>
              <button onClick={()=>setAtab("firstaid")} style={navBtn(atab==="firstaid",T.gold)}>First Aid</button>
              <button onClick={()=>setAtab("incidents")} style={navBtn(atab==="incidents",T.gold)}>Incidents</button>
              <button onClick={()=>setAtab("ra")} style={navBtn(atab==="ra",T.gold)}>Risk Assessments</button>
              <button onClick={()=>setAtab("inspections")} style={navBtn(atab==="inspections",T.gold)}>Inspections</button>
              {(()=>{ const CON_TABS=["contractors","permits"]; const conActive=CON_TABS.includes(atab); return (
                <div style={{position:"relative",display:"inline-block"}} onMouseEnter={e=>e.currentTarget.querySelector(".con-dd").style.display="block"} onMouseLeave={e=>e.currentTarget.querySelector(".con-dd").style.display="none"}>
                  <button style={{...navBtn(conActive,T.gold),display:"flex",alignItems:"center",gap:5}}>Contractors<span style={{fontSize:9,opacity:.7,marginTop:1}}>▼</span></button>
                  <div className="con-dd" style={{display:"none",position:"absolute",top:"100%",left:0,zIndex:200,minWidth:180,background:`linear-gradient(135deg,${T.navyDk},${T.navyMd})`,border:`1px solid ${T.borderMd}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,0.35)",overflow:"hidden",paddingTop:4,paddingBottom:4}}>
                    {[["contractors","Contractors"],["permits","Permits"]].map(([id,label])=>(<button key={id} onClick={()=>setAtab(id)} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 18px",background:atab===id?`rgba(245,158,11,0.12)`:"transparent",border:"none",color:atab===id?T.gold:T.white,fontWeight:atab===id?700:500,fontSize:13,cursor:"pointer",fontFamily:font,transition:"background .15s",letterSpacing:.3}}>{label}</button>))}
                  </div>
                </div>
              ); })()}
              {(()=>{ const DOC_TABS=["documents","coshh"]; const docActive=DOC_TABS.includes(atab); return (
                <div style={{position:"relative",display:"inline-block"}} onMouseEnter={e=>e.currentTarget.querySelector(".doc-dd").style.display="block"} onMouseLeave={e=>e.currentTarget.querySelector(".doc-dd").style.display="none"}>
                  <button style={{...navBtn(docActive,T.gold),display:"flex",alignItems:"center",gap:5}}>Documents<span style={{fontSize:9,opacity:.7,marginTop:1}}>▼</span></button>
                  <div className="doc-dd" style={{display:"none",position:"absolute",top:"100%",left:0,zIndex:200,minWidth:180,background:`linear-gradient(135deg,${T.navyDk},${T.navyMd})`,border:`1px solid ${T.borderMd}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,0.35)",overflow:"hidden",paddingTop:4,paddingBottom:4}}>
                    {[["documents","H&S Documents"],["coshh","COSHH Register"]].map(([id,label])=>(<button key={id} onClick={()=>setAtab(id)} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 18px",background:atab===id?`rgba(245,158,11,0.12)`:"transparent",border:"none",color:atab===id?T.gold:T.white,fontWeight:atab===id?700:500,fontSize:13,cursor:"pointer",fontFamily:font,transition:"background .15s",letterSpacing:.3}}>{label}</button>))}
                  </div>
                </div>
              ); })()}
              <div style={{position:"relative",display:"inline-block"}} onMouseEnter={e=>e.currentTarget.querySelector(".me-dd").style.display="block"} onMouseLeave={e=>e.currentTarget.querySelector(".me-dd").style.display="none"}>
                <button style={{...navBtn(meActive,T.gold),display:"flex",alignItems:"center",gap:5}}>Machinery &amp; Equipment<span style={{fontSize:9,opacity:.7,marginTop:1}}>▼</span></button>
                <div className="me-dd" style={{display:"none",position:"absolute",top:"100%",left:0,zIndex:200,minWidth:180,background:`linear-gradient(135deg,${T.navyDk},${T.navyMd})`,border:`1px solid ${T.borderMd}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,0.35)",overflow:"hidden",paddingTop:4,paddingBottom:4}}>
                  {[["machinery","Machinery Competence"],["equipment","Equipment Register"]].map(([id,label])=>(<button key={id} onClick={()=>setAtab(id)} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 18px",background:atab===id?`rgba(245,158,11,0.12)`:"transparent",border:"none",color:atab===id?T.gold:T.white,fontWeight:atab===id?700:500,fontSize:13,cursor:"pointer",fontFamily:font,transition:"background .15s",letterSpacing:.3}}>{label}</button>))}
                </div>
              </div>
            </>);
          })()}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:isMobile?6:10}}>
            {isMobile && (<button onClick={()=>setMobileMenuOpen(m=>!m)} style={{background:"none",border:`1px solid ${T.borderMd}`,borderRadius:8,color:T.white,fontSize:20,cursor:"pointer",padding:"4px 10px",lineHeight:1,fontFamily:font,flexShrink:0}}>{mobileMenuOpen?"✕":"☰"}</button>)}
            {(()=>{
              const notifications = [];
              // Staff with overdue mandatory modules
              const overdueStaff = staff.filter(u=>{
                const mandatory = allModules.filter(m=>m.level==="Mandatory"&&(assigns[u.id]||[]).includes(m.id));
                return mandatory.some(m=>!(comps[u.id]||{})[m.id]);
              });
              if(overdueStaff.length) notifications.push({type:"module",urgent:true,title:`${overdueStaff.length} staff with overdue mandatory training`,detail:overdueStaff.map(u=>u.name.split(" ")[0]).slice(0,4).join(", ")+(overdueStaff.length>4?` +${overdueStaff.length-4} more`:"...tap to view"),nav:{tab:"reports"}});
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
              else if(expiringCount>0) notifications.push({type:"module",urgent:false,title:`${expiringCount} training certificate${expiringCount!==1?"s":""} expiring within 60 days`,detail:"Review Reports tab to see who needs to renew",nav:{tab:"reports"}});
              // Open incidents
              const openIncidents = incidents.filter(i=>!i.closed);
              const riddorIncidents = incidents.filter(i=>i.riddor&&!i.closed);
              if(riddorIncidents.length) notifications.push({type:"report",urgent:true,title:`${riddorIncidents.length} open RIDDOR reportable incident${riddorIncidents.length!==1?"s":""}`,detail:"Check Incidents tab — HSE reporting may be required",nav:{tab:"incidents"}});
              else if(openIncidents.length) notifications.push({type:"report",urgent:false,title:`${openIncidents.length} open incident${openIncidents.length!==1?"s":""}`,detail:"Check Incidents tab to review and close",nav:{tab:"incidents"}});
              // Quiz failures in last 7 days
              const recentFailures = quizFailures.filter(f=>!f.acknowledged && f.date >= new Date(Date.now()-7*86400000).toISOString().slice(0,10));
              if(recentFailures.length) notifications.push({type:"module",urgent:false,title:`${recentFailures.length} quiz failure${recentFailures.length!==1?"s":""} in last 7 days`,detail:"Check Training → Reports to review",nav:{tab:"reports"}});
              // RA review dates
              const today2 = new Date().toISOString().slice(0,10);
              const overdueRAs = ras.filter(ra2=>ra2.reviewDate&&ra2.reviewDate<today2);
              const soonRAs = ras.filter(ra2=>ra2.reviewDate&&ra2.reviewDate>=today2&&Math.ceil((new Date(ra2.reviewDate)-new Date())/86400000)<=30);
              if(overdueRAs.length) notifications.push({type:"report",urgent:true,title:`${overdueRAs.length} risk assessment${overdueRAs.length!==1?"s":""} overdue for review`,detail:overdueRAs.map(r=>r.title).join(", "),nav:{tab:"ra"}});
              else if(soonRAs.length) notifications.push({type:"report",urgent:false,title:`${soonRAs.length} risk assessment${soonRAs.length!==1?"s":""} due for review soon`,detail:soonRAs.map(r=>r.title).join(", "),nav:{tab:"ra"}});

              // Contractor alerts
              const today3=new Date().toISOString().slice(0,10);
              const expiredConCerts=(contractors||[]).filter(c=>Object.values(contractorCerts[c.id]||{}).some(cert=>cert.expiryDate&&cert.expiryDate<today3));
              if(expiredConCerts.length) notifications.push({type:"document",urgent:true,title:`${expiredConCerts.length} contractor${expiredConCerts.length!==1?"s":""} with expired certificates`,detail:"Check Contractors tab",nav:{tab:"contractors"}});

              // Fire safety alerts
              const fs2 = fireSafety||{};
              const expiredFW = (fs2.wardens||[]).filter(w=>{ const exp=new Date(w.qualDate); exp.setMonth(exp.getMonth()+(w.renewalMonths||36)); return exp.toISOString().slice(0,10)<today2; });
              const expiringFW = (fs2.wardens||[]).filter(w=>{ const exp=new Date(w.qualDate); exp.setMonth(exp.getMonth()+(w.renewalMonths||36)); const d=Math.ceil((exp-new Date())/86400000); return d>=0&&d<=60; });
              if(expiredFW.length) notifications.push({type:"report",urgent:true,title:`${expiredFW.length} fire warden cert${expiredFW.length!==1?"s":""} expired`,detail:"Check Fire Safety → Wardens",nav:{tab:"firesafety"}});
              else if(expiringFW.length) notifications.push({type:"report",urgent:false,title:`${expiringFW.length} fire warden cert${expiringFW.length!==1?"s":""} expiring`,detail:"Check Fire Safety → Wardens",nav:{tab:"firesafety"}});
              const overdueExtsN = (fs2.extinguishers||[]).filter(e=>e.nextServiceDue&&e.nextServiceDue<today2);
              if(overdueExtsN.length) notifications.push({type:"report",urgent:true,title:`${overdueExtsN.length} fire extinguisher${overdueExtsN.length!==1?"s":""} overdue for service`,detail:"Check Fire Safety → Extinguishers",nav:{tab:"firesafety"}});
              const lastDrillN = (fs2.drills||[]).length?(fs2.drills||[]).slice().sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
              const daysDrillN = lastDrillN?Math.floor((new Date()-new Date(lastDrillN.date))/86400000):null;
              if(daysDrillN!==null&&daysDrillN>365) notifications.push({type:"report",urgent:true,title:"Fire drill overdue — last drill was "+daysDrillN+" days ago",detail:"Schedule a full evacuation drill",nav:{tab:"firesafety"}});
              const lastFraN = (fs2.fraReviews||[]).length?(fs2.fraReviews||[]).slice().sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
              if(lastFraN?.nextReviewDue&&lastFraN.nextReviewDue<today2) notifications.push({type:"report",urgent:true,title:"Fire Risk Assessment review overdue",detail:`Review was due ${lastFraN.nextReviewDue}`,nav:{tab:"firesafety"}});

              // Document review dates
              const overdueReviews = docs.filter(d=>d.reviewDate&&d.reviewDate<today2);
              const soonReviews = docs.filter(d=>d.reviewDate&&d.reviewDate>=today2&&Math.ceil((new Date(d.reviewDate)-new Date())/86400000)<=30);
              if(overdueReviews.length) notifications.push({type:"document",urgent:true,title:`${overdueReviews.length} document${overdueReviews.length!==1?"s":""} overdue for review`,detail:overdueReviews.map(d=>d.title).join(", "),nav:{tab:"documents"}});
              else if(soonReviews.length) notifications.push({type:"document",urgent:false,title:`${soonReviews.length} document${soonReviews.length!==1?"s":""} due for review soon`,detail:soonReviews.map(d=>d.title).join(", "),nav:{tab:"documents"}});
              return <NotificationBell notifications={notifications} onNavigate={n=>{setAtab(n.tab);if(n.view)setAdminReportView(n.view);}} Z={T} font={font}/>;
            })()}
            <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>
            {/* Quick theme cycle button */}
            <button onClick={()=>{
              const order=["dark","light","slate","forest","graphite","arctic","sand","rose"];
              const next=order[(order.indexOf(theme)+1)%order.length];
              setTheme(next);
              setDarkMode(["dark","slate","forest","graphite","aurora"].includes(next));
              dbSaveTheme(user.id,next);
            }} style={{background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"5px 10px",color:T.muted,cursor:"pointer",fontSize:14,fontFamily:font,display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}
              title={`Theme: ${theme} — click to cycle`}>
              {theme==="dark"?"🌙":theme==="light"?"☀️":theme==="slate"?"◼":theme==="forest"?"🌲":theme==="graphite"?"⬛":theme==="arctic"?"🌌":theme==="sand"?"🏜":"🌸"}
            </button>
            <div style={{width:1,height:20,background:T.headerBgMd,margin:"0 4px"}}/>
            <div onClick={()=>setAtab(atab==="account"?"users":"account")}
              title="My Account"
              style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 8px 4px 4px",borderRadius:10,transition:"background .15s",background:atab==="account"?T.overlay:"transparent",border:atab==="account"?`1px solid ${T.borderMd}`:"1px solid transparent"}}
              onMouseEnter={e=>{ if(atab!=="account") e.currentTarget.style.background=T.overlay; }}
              onMouseLeave={e=>{ e.currentTarget.style.background=atab==="account"?T.overlay:"transparent"; }}>
              <Avatar name={user.name} size={32}/>
              <span style={{fontSize:13,color:atab==="account"?T.white:T.muted,fontWeight:600}}>{user.name.split(" ")[0]}</span>
            </div>
            <button onClick={logout} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,fontFamily:font}}>Sign Out</button>
          </div>
        </div>

        {/* Module Preview Modal */}
        {previewModule && (
          <ModulePreviewModal m={previewModule} staff={staff} assigns={assigns} comps={comps} isMobile={isMobile} setAtab={setAtab} onClose={()=>setPreviewModule(null)} T={T} font={font}/>
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

          {atab==="dashboard" && (() => {
            const today = new Date().toISOString().slice(0,10);

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
            const last30Inc = incidents.filter(i=>i.date>=new Date(Date.now()-30*86400000).toISOString().slice(0,10));

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

            const card = (icon,label,value,sub,col,urgent,onClick) => (
              <div onClick={onClick} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"18px 20px",border:`1px solid ${urgent?"rgba(239,68,68,0.4)":col?"rgba(245,158,11,0.25)":T.border}`,cursor:onClick?"pointer":"default",transition:"transform .15s,box-shadow .15s"}}
                onMouseEnter={e=>{if(onClick){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.3)";}}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:.5,color:T.muted,textTransform:"uppercase",marginBottom:6}}>{label}</div>
                    <div style={{fontSize:32,fontWeight:900,color:urgent?"#f87171":col?"#f59e0b":value===0?T.green:"#fff",lineHeight:1}}>{value}</div>
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

                {/* Stat grid */}
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:14,marginBottom:28}}>
                  {card(E("📚",""),"Training Incomplete",overdueTraining.length,`of ${staffList.length} staff`,null,overdueTraining.length>0,()=>setAtab("assign"))}
                  {card(E("🔄",""),"Expiring/Expired",expiringTraining.length,"training renewals",expiringTraining.length>0,false,()=>{setAtab("reports");setAdminReportView("expiry");})}
                  {card(E("⚠️",""),"Open Incidents",openIncidents2.length,`${riddorOpen2.length} RIDDOR unreported`,null,riddorOpen2.length>0,()=>setAtab("incidents"))}
                  {card(E("📄",""),"Unread Documents",unreadDocs.length,"assigned but unacknowledged",unreadDocs.length>0,false,()=>setAtab("documents"))}
                  {card(E("🔧",""),"Equipment Overdue",overdueEquipment.length,"inspection overdue",null,overdueEquipment.length>0,()=>setAtab("equipment"))}
                  {card(E("📋",""),"Out of Service",outOfService.length,"equipment items",null,false,()=>setAtab("equipment"))}
                  {card(E("❌",""),"Quiz Failures",unreviewedFailures.length,"unreviewed",unreviewedFailures.length>0,false,()=>{setAtab("reports");setAdminReportView("failures");})}
                  {card(E("📅",""),"Reviews Overdue",overdueDocReviews.length+overdueRAReviews.length,"docs & RAs",overdueDocReviews.length+overdueRAReviews.length>0,false,()=>setAtab("documents"))}
                  {(()=>{
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
                  })()}
                  {(()=>{
                    const fs = fireSafety||{};
                    const wardens2 = fs.wardens||[];
                    const drills2 = fs.drills||[];
                    const extinguishers2 = fs.extinguishers||[];
                    const fraReviews2 = fs.fraReviews||[];
                    const lastDrill2 = drills2.length?drills2.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
                    const daysSinceDrill2 = lastDrill2?Math.floor((new Date()-new Date(lastDrill2.date))/86400000):null;
                    const expiredWardens2 = wardens2.filter(w=>{ const exp=new Date(w.qualDate); exp.setMonth(exp.getMonth()+(w.renewalMonths||36)); return exp.toISOString().slice(0,10)<today; });
                    const overdueExts2 = extinguishers2.filter(e=>e.nextServiceDue&&e.nextServiceDue<today);
                    const lastFra2 = fraReviews2.length?fraReviews2.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
                    const fraOverdue2 = lastFra2?.nextReviewDue&&lastFra2.nextReviewDue<today;
                    const issues = expiredWardens2.length+overdueExts2.length+(fraOverdue2?1:0)+(daysSinceDrill2!==null&&daysSinceDrill2>365?1:0);
                    const sub = issues>0?`${issues} item${issues!==1?"s":""} need attention`:(daysSinceDrill2!==null?`Last drill ${daysSinceDrill2}d ago`:"");
                    return card(E("🔥",""),"Fire Safety",wardens2.length,sub,null,issues>0,()=>setAtab("firesafety"));
                  })()}
                  {(()=>{
                    const fa = firstAidData||{};
                    const faAiders = fa.aiders||[];
                    const faCustomZones = fa.customZones||[];
                    const faAllZones = [...FA_ZONES, ...faCustomZones];
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
                    // Count coverage gaps
                    const SHIFTS3 = ["Day Shift (08:30–16:00)","Late Shift (16:00–02:00)","Office Hours (08:30–17:30)"];
                    let gapCount = 0;
                    faAllZones.forEach(zone=>{
                      SHIFTS3.forEach(shift=>{
                        const count = validAiders.filter(a=>{
                          const shiftsOk = !a.shifts?.length || a.shifts.includes("All Shifts") || a.shifts.includes(shift);
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
                  })()}
                </div>

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
                          <div style={{fontSize:13,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
                          <div style={{fontSize:11,color:T.muted}}>{d}/{a} modules · {pct}%</div>
                        </div>
                        <button onClick={()=>setAtab("assign")} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:`1px solid ${T.accent}33`,borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>Assign →</button>
                      </>);
                    },()=>setAtab("assign"))
                  )}

                  {/* Open incidents */}
                  {section("Open incidents",
                    listCard(openIncidents2,"No open incidents",inc=>(
                      <>
                        <span style={{fontSize:18,flexShrink:0}}>{{accident:"🚑",near_miss:"⚠️",unsafe_condition:"🏗",unsafe_act:"🚫"}[inc.type]||"📋"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inc.description?.slice(0,60)}{inc.description?.length>60?"…":""}</div>
                          <div style={{fontSize:11,color:T.muted}}>{inc.date} · {inc.location}</div>
                        </div>
                        {inc.riddor&&!inc.riddorReported&&<span style={{fontSize:10,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,0.1)",padding:"2px 7px",borderRadius:6,border:"1px solid rgba(239,68,68,0.25)",flexShrink:0}}>RIDDOR ⚠</span>}
                        <button onClick={()=>{setFocusIncidentId(inc.id);setAtab("incidents");}} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>View →</button>
                      </>
                    ),()=>setAtab("incidents"))
                  )}

                  {/* Equipment overdue */}
                  {section("Equipment inspection overdue",
                    listCard([...overdueEquipment,...soonEquipment].slice(0,5),"All equipment inspections up to date",e=>{
                      const overdue = e.nextService<today;
                      const days = Math.ceil((new Date(e.nextService)-new Date())/86400000);
                      return (<>
                        <span style={{fontSize:18,flexShrink:0}}>🔧</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</div>
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
                          <div style={{fontSize:13,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.user.name}</div>
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
                        <div style={{fontSize:13,fontWeight:600,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inc.description?.slice(0,70)}{inc.description?.length>70?"…":""}</div>
                        <div style={{fontSize:11,color:T.muted}}>{inc.date} · {inc.location} · {inc.closed?"Closed":"Open"}</div>
                      </div>
                    </>
                  ),()=>setAtab("incidents"))
                )}
              </div>
            );
          })()}

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
                        {bulkResetPw && bulkResetPw.length < 6 && <div style={{fontSize:11,color:"#f87171",marginBottom:8}}>Password must be at least 6 characters</div>}
                        <div style={{fontSize:11,color:T.muted,marginBottom:14}}>
                          This will reset passwords for <strong style={{color:T.white}}>{bulkResetScope==="all"?staff.length:bulkResetSelected.length} staff member{(bulkResetScope==="all"?staff.length:bulkResetSelected.length)!==1?"s":""}</strong>.
                        </div>
                        <button
                          disabled={!bulkResetPw||bulkResetPw.length<6||(bulkResetScope==="selected"&&bulkResetSelected.length===0)}
                          onClick={async()=>{
                            const targets = bulkResetScope==="all" ? staff.map(u=>u.id) : bulkResetSelected;
                            const hashed = await hashPassword(bulkResetPw);
                            setPasswords(p=>{
                              const n={...p};
                              targets.forEach(id=>{ n[id]=hashed; });
                              return n;
                            });
                            await Promise.all(targets.map(id=>dbSavePassword(id, hashed)));
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
                        const hashed=await hashPassword("pass123");
                        const maxId=Math.max(0,...allUsers.map(u=>u.id));
                        const newUsers=toAdd.map((r,i)=>({id:maxId+i+1,name:r.name.trim(),email:r.email.trim().toLowerCase(),jobTitle:r.jobTitle,manager:r.manager,department:r.department,role:r.role==="admin"?"admin":"staff",isWarehouseWorker:false,status:"active",password:hashed}));
                        newUsers.forEach(u=>{
                          setAllUsers(p=>[...p,u]);
                          dbSaveUser(u);
                          dbSaveUserProfile(u);
                          dbSavePassword(u.id,hashed);
                        });
                        setCsvPreview([]);
                        setShowCsvImport(false);
                        alert(`✓ Imported ${toAdd.length} staff.${skipped>0?` ${skipped} skipped (email already exists).`:""} Default password: pass123`);
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
                      <input value={newManager} onChange={e=>setNewManager(e.target.value)} placeholder="e.g. John Smith"
                        style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <label style={{color:T.muted,fontSize:11,fontWeight:700,letterSpacing:.5,display:"block",marginBottom:6}}>PORTAL ROLE</label>
                      <select value={newRole} onChange={e=>setNewRole(e.target.value)}
                        style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"10px 14px",color:T.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer",boxSizing:"border-box"}}>
                        <option value="staff">Staff</option>
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
                    <p style={{color:T.muted,fontSize:12,margin:0}}>Default password: <code style={{color:T.gold,background:"rgba(245,158,11,0.1)",padding:"2px 8px",borderRadius:4}}>pass123</code></p>
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
                    if (staffFilterProgress==="overdue" && pct!==0) return false;
                    if (staffFilterProgress==="none" && a!==0) return false;
                  }
                  return true;
                });
                const activeFilters = (staffFilterManager!=="all"?1:0)+(staffFilterSearch?1:0)+(staffFilterProgress!=="all"?1:0)+(staffStatusFilter!=="all"?1:0);
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
                        <option value="inprogress">In Progress</option>
                        <option value="overdue">Overdue</option>
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

                    {/* Staff Table */}
                    {isMobile ? (
                      <div>
                        {filteredStaff.length===0 && <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14}}>{staff.length===0?"No staff members yet.":"No staff match filters."}</div>}
                        {filteredStaff.map((u)=>{
                          const a=(assigns[u.id]||[]).length, d=(assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length;
                          const pct=a?Math.min(100, Math.round(d/a*100)):0;
                          const barColor=pct===100?T.green:pct>=50?T.accent:"#ef4444";
                          const lastActive=lastLoginMap[u.id];
                          return (
                            <MobileCard key={u.id}>
                              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
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
                          );
                        })}
                      </div>
                    ) : (
                    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 2fr 2fr 2fr 120px 160px",padding:"12px 20px",background:T.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase",columnGap:0}}>
                        <span style={{paddingRight:12}}>Name</span><span style={{paddingRight:12}}>Email</span><span style={{paddingRight:12}}>Job Title</span><span style={{paddingRight:12}}>Manager</span><span style={{paddingRight:12}}>Progress</span><span style={{paddingRight:12}}>Last Active</span><span></span>
                      </div>
                      {filteredStaff.length===0 && <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14}}>{staff.length===0?"No staff members yet. Add one above.":"No staff match the current filters."}</div>}
                      {filteredStaff.map((u,i)=>{
                        const a=(assigns[u.id]||[]).length, d=(assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length;
                        const pct=a?Math.min(100, Math.round(d/a*100)):0;
                        const barColor=pct===100?T.green:pct>=50?T.accent:"#ef4444";
                        const lastActive=lastLoginMap[u.id];
                        return (
                          <div key={u.id} style={{display:"grid",gridTemplateColumns:"2fr 2fr 2fr 2fr 2fr 120px 160px",padding:"14px 20px",borderTop:i>0?`1px solid ${T.border}`:"none",alignItems:"center",columnGap:0,opacity:u.status==="leaver"?0.6:1}}>
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
                        );
                      })}
                    </div>)}
                  </>
                );
              })()}
            </div>
          </div>)}

          {atab==="assign" && (
            <div>
              <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:6}}>Assign Training <HelpTip dark={false} text="Tick modules to assign them to staff. Assigned modules appear on the staff member's dashboard as required training. Use bulk assignment to push modules to an entire team at once."/></h2>
              <p style={{color:T.muted,fontSize:13,marginBottom:20}}>Assign modules to individuals, teams, or all staff at once.</p>

              {(()=>{
                const uniqueManagers = [...new Set(staff.map(u=>u.manager).filter(Boolean))].sort();
                const effectiveBulkManager = bulkManager || uniqueManagers[0] || "";

                const targetStaff = bulkTarget === "all" ? staff
                  : bulkTarget === "warehouse" ? staff.filter(u=>u.isWarehouseWorker)
                  : bulkTarget === "team" ? staff.filter(u=>u.manager===effectiveBulkManager)
                  : null; // individual

                const targetLabel = bulkTarget==="all"?`all ${staff.length} staff`:bulkTarget==="warehouse"?`${staff.filter(u=>u.isWarehouseWorker).length} warehouse staff`:bulkTarget==="team"?`${(targetStaff||[]).length} staff in ${effectiveBulkManager}'s team`:"selected staff";

                const bulkAssignMod = (mid) => {
                  if (!targetStaff) return;
                  const m = allModules.find(x=>x.id===mid);
                  if (!window.confirm(`Assign "${m?.title||mid}" to ${targetLabel}?`)) return;
                  setAssigns(p => {
                    const next = {...p};
                    const affected = {};
                    targetStaff.forEach(u => {
                      if (!(next[u.id]||[]).includes(mid)) {
                        next[u.id] = [...(next[u.id]||[]), mid];
                        affected[u.id] = next[u.id];
                      }
                    });
                    if (Object.keys(affected).length) dbSaveAssigns(affected);
                    return next;
                  });
                };
                const bulkUnassignMod = (mid) => {
                  if (!targetStaff) return;
                  const m = allModules.find(x=>x.id===mid);
                  if (!window.confirm(`Remove "${m?.title||mid}" from ${targetLabel}? Staff who have already completed it will keep their completion record.`)) return;
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
                const bulkAssignAll = () => {
                  if (!targetStaff) return;
                  if (!window.confirm(`Assign ALL ${allModules.length} modules to ${targetLabel}? This will add every module to their training plan.`)) return;
                  setAssigns(p => {
                    const next = {...p};
                    const affected = {};
                    targetStaff.forEach(u => { next[u.id] = allModules.map(m=>m.id); affected[u.id] = next[u.id]; });
                    if (Object.keys(affected).length) dbSaveAssigns(affected);
                    return next;
                  });
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
                        const tUser = allUsers.find(u=>u.id===target);
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
                    </div>

                    {/* Module list */}
                    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}>
                      <div style={{display:"grid",gap:10}}>
                        {allModules.map(m=>{
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

          {atab==="create" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyCreateModuleTab
              editingModule={editingModule}
              onSave={m=>{
                if (editingModule) {
                  // Editing existing — update in customModules or TRAINING_MODULES override
                  if (editingModule._custom) {
                    setCustomModules(prev=>prev.map(x=>x.id===m.id?{...m,_custom:true}:x));
                    dbSaveCustomModule({...m,_custom:true});
                  } else {
                    // Override built-in by adding to customModules with same id
                    setCustomModules(prev=>{
                      const exists = prev.find(x=>x.id===m.id);
                      if (exists) return prev.map(x=>x.id===m.id?{...m,_custom:true,_override:true}:x);
                      return [...prev, {...m,_custom:true,_override:true}];
                    });
                    dbSaveCustomModule({...m,_custom:true,_override:true});
                  }
                } else {
                  setCustomModules(prev=>[...prev,m]);
                }
                setEditingModule(null);
                setAtab("modules");
              }}
              Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="modules" && (
            <div>
              <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:24}}>Training Library <HelpTip dark={false} text="All available training modules. Built-in modules are provided by Zeus Protect. Custom modules are ones you've created. Modules with a renewal period will show as expired when due for re-completion."/></h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
                {allModules.map(m=>(
                  <div key={m.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,border:`1px solid ${m._custom?"rgba(245,158,11,0.35)":T.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                      <span style={{fontSize:36}}>{m.icon||"📋"}</span>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        {m._custom && <span style={{fontSize:10,fontWeight:700,color:T.gold,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,padding:"2px 7px",letterSpacing:.5}}>CUSTOM</span>}
                        <Pill label={m.level} col={m.level==="Mandatory"?"red":"navy"}/>
                      </div>
                    </div>
                    <h3 style={{margin:"0 0 6px",fontSize:16,fontWeight:800}}>{m.title}</h3>
                    <p style={{color:T.muted,fontSize:12,margin:"0 0 14px"}}>{m.category} · {m.duration} · {(m.quiz||[]).length} questions</p>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:m._custom?12:0}}>
                      <Pill label={`${staff.filter(u=>(assigns[u.id]||[]).includes(m.id)).length} assigned`} col="navy"/>
                      <Pill label={`${staff.filter(u=>comps[u.id]?.[m.id]).length} completed`} col="green"/>
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
                      {m._custom && !m._override && (
                        <button onClick={()=>{
                          setCustomModules(prev=>prev.filter(x=>x.id!==m.id));
                          dbDeleteCustomModule(m.id);
                          setAtab("modules");
                        }} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                          🗑 Delete
                        </button>
                      )}
                      {m._override && (
                        <button onClick={()=>{
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
            </div>
          )}

          {atab==="documents" && (
            <div>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:6}}>
                <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:0}}>H&S Documentation <HelpTip dark={false} text="Upload policies, procedures, risk assessments and guidance documents. Use the Assign button on each document to nominate staff for required reading — they'll be prompted to confirm they've read it in their portal."/></h2>
                <button onClick={()=>setShowBulkDocAssign(v=>!v)}
                  style={{background:showBulkDocAssign?`rgba(239,68,68,0.1)`:`rgba(37,99,235,0.1)`,color:showBulkDocAssign?"#f87171":T.accentLt,border:showBulkDocAssign?"1px solid rgba(239,68,68,0.25)":`1px solid rgba(37,99,235,0.25)`,borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,whiteSpace:"nowrap"}}>
                  {showBulkDocAssign?"✕ Cancel":E("👥 ","")+"Bulk Assign"}
                </button>
              </div>
              <p style={{color:T.muted,marginBottom:16,fontSize:13}}>Upload documents and assign them for required reading.</p>

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
                          onClick={()=>{
                            if(!window.confirm(`Assign ${bulkDocSelectedDocs.length} document${bulkDocSelectedDocs.length!==1?"s":""} to ${targetStaff2.length} staff member${targetStaff2.length!==1?"s":""}?`)) return;
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
                {(["all",...Array.from(new Set(docs.map(d=>d.type||"Document"))).sort()]).map(f=>(
                  <button key={f} onClick={()=>setDocFolder(f)}
                    style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${docFolder===f?T.accent:T.borderMd}`,background:docFolder===f?`linear-gradient(135deg,${T.accent},${T.blue})`:T.overlay,color:docFolder===f?"#fff":T.muted,fontWeight:docFolder===f?700:400,cursor:"pointer",fontFamily:font,fontSize:12}}>
                    {f==="all"?`📁 All (${docs.length})`:`${f==="Policy"?"📋":f==="Procedure"?"📝":f==="Guidance"?"📖":f==="Risk Assessment"?"⚠️":f==="COSHH"?"🧪":"📄"} ${f} (${docs.filter(d=>(d.type||"Document")===f).length})`}
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
                      {["Policy","Procedure","Guidance","Risk Assessment","COSHH","Report","Presentation","Document"].map(t=><option key={t} value={t}>{t}</option>)}
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
                      const newDoc={id,title:file.name.substring(0,file.name.lastIndexOf(".")>0?file.name.lastIndexOf("."):file.name.length),date:new Date().toISOString().slice(0,10),size:`${(file.size/1024).toFixed(0)} KB`,type:docType,fileUrl:null,fileData:null,fileName:file.name,ext,version:1};
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
                        const newDoc={id,title:file.name.substring(0,file.name.lastIndexOf(".")>0?file.name.lastIndexOf("."):file.name.length),date:new Date().toISOString().slice(0,10),size:`${(file.size/1024).toFixed(0)} KB`,type:docType,fileUrl:null,fileData:null,fileName:file.name,ext,version:1};
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

              {/* Document list */}
              {docs.length===0
                ? <div style={{textAlign:"center",padding:40,color:T.muted,fontSize:14}}>No documents uploaded yet.</div>
                : (
                  <div style={{display:"grid",gap:14}}>
                    {docs.filter(d=>docFolder==="all"||(d.type||"Document")===docFolder).map(d=>{
                      const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
                      const icon=extIcons[d.ext]||"📄";
                      const assignedIds = docAssignments[String(d.id)] || [];
                      const assignedStaff = staff.filter(u=>assignedIds.includes(String(u.id)));
                      const readCount = assignedStaff.filter(u=>(docAcknowledgements[String(u.id)]||{})[String(d.id)]).length;
                      const unreadCount = assignedStaff.length - readCount;

                      return (
                        <DocCard key={d.id} d={d} staff={staff} assignedIds={assignedIds} assignedStaff={assignedStaff} readCount={readCount} unreadCount={unreadCount} icon={icon} docAcknowledgements={docAcknowledgements} setDocAcknowledgements={setDocAcknowledgements} setDocAssignments={setDocAssignments} dbSaveDocAssignments={dbSaveDocAssignments} setDocs={setDocs} dbDeleteDoc={dbDeleteDoc} dbSaveDoc={dbSaveDoc} setPreviewDoc={setPreviewDoc} T={T} font={font}/>
                      );
                    })}
                  </div>
                )
              }
            </div>
          )}

          {atab==="coshh" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyCoshhTab Z={T} font={font} msdsFiles={msdsFiles} setMsdsFiles={setMsdsFiles} customChemicals={customChemicals} setCustomChemicals={setCustomChemicals}/>
            </React.Suspense>
          )}

          {atab==="reports" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyReportsTab staff={staff} assigns={assigns} comps={comps} docs={docs} docAssignments={docAssignments} docAcknowledgements={docAcknowledgements} reportView={adminReportView} setReportView={setAdminReportView} dseReports={dseReports} adminResponses={adminResponses} setAdminResponses={setAdminResponses} darkMode={darkMode} Z={T} font={font} modules={allModules} machineComps={machineComps} allMachineTypes={allMachineTypes} lastLoginMap={lastLoginMap} extCerts={extCerts} quizFailures={quizFailures} setQuizFailures={setQuizFailures} incidents={incidents} inspections={siteInspections} ras={ras} investigations={investigations} setAtab={setAtab} onExportPDF={u=>generateStaffPDF(u,allModules,assigns,comps,docs,docAssignments,docAcknowledgements,extCerts,machineComps,lastLoginMap,T,allMachineTypes)}/>
            </React.Suspense>
          )}

          {atab==="incidents" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyAdminIncidentTab incidents={incidents} setIncidents={setIncidents} staff={staff} focusIncidentId={focusIncidentId} setFocusIncidentId={setFocusIncidentId} showAdminReportForm={showAdminReportForm} setShowAdminReportForm={setShowAdminReportForm}
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
            <LazyAdminMachineryTab allStaff={staff} machineComps={machineComps} setMachineComps={setMachineComps} allMachineTypes={allMachineTypes} allMachineCategories={allMachineCategories} setCustomMachineTypes={setCustomMachineTypes} dbDeleteCustomMachineType={dbDeleteCustomMachineType} dbSaveMachineComp={dbSaveMachineComp} dbDeleteMachineComp={dbDeleteMachineComp} Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="equipment" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyEquipmentTrackerTab equipment={equipment} setEquipment={setEquipment} staff={staff} Z={T} font={font}/>
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
            <LazySiteInspectionsTab inspections={siteInspections} setInspections={setSiteInspections} staff={staff} Z={T} font={font}/>
            </React.Suspense>
          )}

          {atab==="firesafety" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyFireSafetyTab fireSafety={fireSafety} setFireSafety={setFireSafety} staff={staff} onUploadFraDoc={dbUploadFraDocument} onDeleteFraDoc={dbDeleteFraDocument} Z={T} font={font}/>
            </React.Suspense>
          )}
          {atab==="account" && (
            <React.Suspense fallback={<div style={{padding:40,textAlign:"center",color:T.muted}}>Loading…</div>}>
            <LazyAccountTab user={user} passwords={passwords} setPasswords={setPasswords} darkMode={darkMode} setDarkMode={setDarkMode} theme={theme} setTheme={setTheme} onSaveTheme={k=>dbSaveTheme(user.id,k)} emojiMode={emojiMode} onSaveEmojiMode={v=>{setEmojiMode(v);dbSaveEmojiMode(user.id,v);}} Z={T} font={font}/>
            </React.Suspense>
          )}
        </div>
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