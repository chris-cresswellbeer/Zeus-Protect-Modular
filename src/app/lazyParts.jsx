/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/lazyParts.jsx — lazy-loaded parts
 * ═══════════════════════════════════════════════════════════════════════════
 * Parts of the portal downloaded only when first shown (React.lazy). Each is a normal component
 * name, so the code that uses it doesn't change. Keeps the first download small.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { lazyFresh } from "../lib/staleBuild";

// The built-in training modules (data/seedTraining.js, ~100 KB of slides and questions) aren't
// needed for the sign-in screen, so they download alongside it and are ready by sign-in.
let builtInModulesPromise = null;
const loadBuiltInModules = () => builtInModulesPromise || (builtInModulesPromise =
  import("../data/seedTraining").then(m => m.TRAINING_MODULES, e => { builtInModulesPromise = null; throw e; }));
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
  const L = lazyFresh(loader);
  const Part = props => <React.Suspense fallback={fallback}><L {...props}/></React.Suspense>;
  return Part;
}
const RecordCompletionModal = lazyPart(() => import("../domains/training/RecordCompletion").then(m => ({ default: m.RecordCompletionModal })), null);
const ImportPriorTrainingModal = lazyPart(() => import("../domains/training/RecordCompletion").then(m => ({ default: m.ImportPriorTrainingModal })), null);
const GroupSessionModal = lazyPart(() => import("../domains/training/RecordCompletion").then(m => ({ default: m.GroupSessionModal })), null);
const DSEAssessment = lazyPart(() => import("../domains/dse/DSEAssessment").then(m => ({ default: m.DSEAssessment })), LAZY_PAGE);
const MachineryEquipmentPage = lazyPart(() => import("../domains/machinery/MachineryEquipmentPage").then(m => ({ default: m.MachineryEquipmentPage })), LAZY_BLOCK);
const QuickReportModal = lazyPart(() => import("../domains/incidents/QuickReportModal").then(m => ({ default: m.QuickReportModal })), null);
const EditStaffModal = lazyPart(() => import("../domains/staff/EditStaffModal").then(m => ({ default: m.EditStaffModal })), null);
const ModulePreviewModal = lazyPart(() => import("../domains/training/ModulePreviewModal").then(m => ({ default: m.ModulePreviewModal })), null);
const HotspotActivity = lazyPart(() => import("../domains/training/HotspotActivity").then(m => ({ default: m.HotspotActivity })), LAZY_BLOCK);
const TempPasswordsModal = lazyPart(() => import("../shared/TempPasswordsModal").then(m => ({ default: m.TempPasswordsModal })), null);
const SignInAccountsPanel = lazyPart(() => import("../domains/staff/SignInAccountsPanel").then(m => ({ default: m.SignInAccountsPanel })), LAZY_BLOCK);
const MobileApp = lazyPart(() => import("../mobile/MobileApp.jsx").then(m => ({ default: m.default })), LAZY_PAGE);
const CertificateModal = lazyPart(() => import("../domains/training/CertificateModal").then(m => ({ default: m.CertificateModal })), null);
const DocBundles = lazyPart(() => import("../domains/documents/DocBundles").then(m => ({ default: m.DocBundles })), LAZY_BLOCK);
const MyBundles = lazyPart(() => import("../domains/documents/DocBundles").then(m => ({ default: m.MyBundles })));
const LazySortableStatGrid = lazyFresh(() => import("../shared/SortableStatGrid"));

const LazyContractorsTab = lazyFresh(() => import("../domains/contractors/ContractorsTab").then(m => ({ default: m.ContractorsTab })));
const LazyMyTeamTab = lazyFresh(() => import("../domains/manager/MyTeamTab").then(m => ({ default: m.MyTeamTab })));
const LazyAuditTrailTab = lazyFresh(() => import("../domains/audit/AuditTrailTab").then(m => ({ default: m.AuditTrailTab })));
const LazyCoshhTab = lazyFresh(() => import("../domains/coshh/CoshhTab").then(m => ({ default: m.CoshhTab })));
// Opened by fewer people, or only on their own page (Oct 2026: moved out of the first download)
const DocCard = lazyPart(() => import("../domains/documents/DocCard").then(m => ({ default: m.DocCard })), null);
const ExternalCertsSection = lazyPart(() => import("../domains/documents/ExternalCertsSection").then(m => ({ default: m.ExternalCertsSection })), LAZY_BLOCK);
const PreviewModal = lazyPart(() => import("../domains/documents/PreviewModal").then(m => ({ default: m.PreviewModal })), null);
const LoneWorkingTab = lazyPart(() => import("../domains/lone/LoneWorkingTab").then(m => ({ default: m.LoneWorkingTab })), LAZY_BLOCK);
const PpeRegisterTab = lazyPart(() => import("../domains/ppe/PpeRegisterTab").then(m => ({ default: m.PpeRegisterTab })), LAZY_BLOCK);
const MyPpeTab = lazyPart(() => import("../domains/ppe/MyPpeTab").then(m => ({ default: m.MyPpeTab })), LAZY_BLOCK);
const RackBay = lazyPart(() => import("../shared/RackBay").then(m => ({ default: m.RackBay })), LAZY_BLOCK);
const RackingTab = lazyPart(() => import("../domains/racking/RackingTab").then(m => ({ default: m.RackingTab })), LAZY_BLOCK);
const EquipmentPage = lazyPart(() => import("../domains/racking/RackingTab").then(m => ({ default: m.EquipmentPage })), LAZY_BLOCK);
const EvidenceLinks = lazyPart(() => import("../domains/training/TrainingEvidence").then(m => ({ default: m.EvidenceLinks })), null);
const AttachEvidenceModal = lazyPart(() => import("../domains/training/TrainingEvidence").then(m => ({ default: m.AttachEvidenceModal })), null);
const SessionsModal = lazyPart(() => import("../domains/training/TrainingEvidence").then(m => ({ default: m.SessionsModal })), null);
const LazyStaffDSETab = lazyFresh(() => import("../domains/dse/StaffDSETab").then(m => ({ default: m.StaffDSETab })));
const LazyEquipmentTrackerTab = lazyFresh(() => import("../domains/equipment/EquipmentTrackerTab").then(m => ({ default: m.EquipmentTrackerTab })));
const LazyFireSafetyTab = lazyFresh(() => import("../domains/fireSafety/FireSafetyTab").then(m => ({ default: m.FireSafetyTab })));
const LazyFirstAidRegisterTab = lazyFresh(() => import("../domains/firstAid/FirstAidRegisterTab").then(m => ({ default: m.FirstAidRegisterTab })));
const LazyAdminIncidentTab = lazyFresh(() => import("../domains/incidents/AdminIncidentTab").then(m => ({ default: m.AdminIncidentTab })));
const LazyIncidentTracker = lazyFresh(() => import("../domains/incidents/IncidentTracker").then(m => ({ default: m.IncidentTracker })));
const LazyInvestigationTab = lazyFresh(() => import("../domains/incidents/InvestigationTab").then(m => ({ default: m.InvestigationTab })));
const LazySiteInspectionsTab = lazyFresh(() => import("../domains/inspections/SiteInspectionsTab").then(m => ({ default: m.SiteInspectionsTab })));
const LazySiteSettingsTab = lazyFresh(() => import("../domains/settings/SiteSettingsTab").then(m => ({ default: m.SiteSettingsTab })));
const LazyAdminMachineryTab = lazyFresh(() => import("../domains/machinery/AdminMachineryTab").then(m => ({ default: m.AdminMachineryTab })));
const LazyMachineryCompetenceTab = lazyFresh(() => import("../domains/machinery/MachineryCompetenceTab").then(m => ({ default: m.MachineryCompetenceTab })));
const LazyPermitsTab = lazyFresh(() => import("../domains/permits/PermitsTab").then(m => ({ default: m.PermitsTab })));
const LazyRiskAssessmentTab = lazyFresh(() => import("../domains/riskAssessments/RiskAssessmentTab").then(m => ({ default: m.RiskAssessmentTab })));
const LazyAccountTab = lazyFresh(() => import("../domains/staff/AccountTab").then(m => ({ default: m.AccountTab })));
const LazyStaffActionsTab = lazyFresh(() => import("../domains/staff/StaffActionsTab").then(m => ({ default: m.StaffActionsTab })));
const LazyCreateModuleTab = lazyFresh(() => import("../domains/training/CreateModuleTab").then(m => ({ default: m.CreateModuleTab })));
const LazyReportsTab = lazyFresh(() => import("../domains/training/ReportsTab").then(m => ({ default: m.ReportsTab })));

export {
  builtInModulesPromise, loadBuiltInModules, LAZY_PAGE, LAZY_BLOCK, lazyPart, RecordCompletionModal, ImportPriorTrainingModal, GroupSessionModal, DSEAssessment, MachineryEquipmentPage, QuickReportModal, EditStaffModal, ModulePreviewModal, HotspotActivity, TempPasswordsModal, SignInAccountsPanel, MobileApp, CertificateModal, DocBundles, MyBundles, LazySortableStatGrid, LazyContractorsTab, LazyMyTeamTab, LazyAuditTrailTab, LazyCoshhTab, DocCard, ExternalCertsSection, PreviewModal, LoneWorkingTab, PpeRegisterTab, MyPpeTab, RackBay, RackingTab, EquipmentPage, EvidenceLinks, AttachEvidenceModal, SessionsModal, LazyStaffDSETab, LazyEquipmentTrackerTab, LazyFireSafetyTab, LazyFirstAidRegisterTab, LazyAdminIncidentTab, LazyIncidentTracker, LazyInvestigationTab, LazySiteInspectionsTab, LazySiteSettingsTab, LazyAdminMachineryTab, LazyMachineryCompetenceTab, LazyPermitsTab, LazyRiskAssessmentTab, LazyAccountTab, LazyStaffActionsTab, LazyCreateModuleTab, LazyReportsTab,
};
