// src/mobile/MobileApp.jsx
//
// The mobile shell: header, offline banner, screen router, tab bar.
//
// This component is intentionally a *view* over state that already lives in
// App.jsx. It does not own the domain data and it does not talk to Supabase
// directly — every write goes out through the `db` prop, which is the existing
// dbSave*/dbAcknowledge* functions, wrapped by the offline queue so nothing is
// lost in a chill store.
//
// Mount it from App.jsx when the viewport is phone-sized:
//
//   const winW = useWindowWidth();
//   if (winW <= 700 && user) return <MobileApp … />;
//
// See src/mobile/README.md for the full prop wiring.

import React from "react";
import { getThemeTokens } from "../theme/tokens";
import { getExpiryStatus } from "../lib/dates";
import { useOnline } from "./lib/useOnline";
import { enqueue, listQueue, drainQueue } from "./lib/syncQueue";
import { watchInstallPrompt } from "./registerSW";
import { MobileHeader, OfflineBanner, TabBar } from "./ui";
import { Today } from "./screens/Today";
import { Training } from "./screens/Training";
import { ModulePlayer } from "./screens/ModulePlayer";
import { ReportHazard } from "./screens/ReportHazard";
import { Documents } from "./screens/Documents";
import { DSEMobile } from "./screens/DSEMobile";
import { More, Certificates, CorrectiveActions, TrainingHistory, Appearance } from "./screens/More";
import { AdminOverview, HazardTriage } from "./screens/Admin";
import { Inspections, InspectionRun } from "./screens/Inspection";
import { Permits, PermitDetail } from "./screens/Permits";
import { IncidentRecord } from "./screens/IncidentRecord";
import { INSP_TYPES } from "../data/seedInspections";

const FONT = "'Barlow','Trebuchet MS',system-ui,sans-serif";
const PROGRESS_KEY = "zeus.mobile.progress";
const PREFS_KEY = "zeus.mobile.prefs";

const STAFF_TABS = [
  { id: "today", icon: "◎", label: "Today" },
  { id: "training", icon: "🎓", label: "Training" },
  { id: "report", icon: "⚠", label: "Report" },
  { id: "more", icon: "☰", label: "More" },
];

const ADMIN_TABS = [
  { id: "adminHome", icon: "◎", label: "Overview" },
  { id: "adminIncidents", icon: "🚨", label: "Incidents" },
  { id: "training", icon: "🎓", label: "Training" },
  { id: "more", icon: "☰", label: "More" },
];

const TITLES = {
  today: ["Zeus Protect", "Today"],
  training: ["My training", ""],
  module: ["Training", ""],
  report: ["Report", "Hazard report"],
  documents: ["Documents", "Read & confirm"],
  dse: ["DSE", "Workstation check"],
  more: ["Account", ""],
  certificates: ["Account", "My certificates"],
  actions: ["Account", "Corrective actions"],
  history: ["Account", "Training history"],
  appearance: ["Account", "Appearance & theme"],
  adminHome: ["Zeus Protect · Admin", "Site overview"],
  adminIncidents: ["Admin", "Incidents"],
  triage: ["Admin", ""],
  inspections: ["Inspections", "Due & recent"],
  inspection: ["Inspection", ""],
  permits: ["Permits to work", ""],
  permit: ["Permit to work", ""],
  incidentRecord: ["Admin", ""],
};

const PARENT_TAB = {
  module: "training", documents: "more", dse: "more",
  certificates: "more", actions: "more", history: "more", appearance: "more",
  triage: "adminIncidents",
  inspections: "more", inspection: "inspections",
  permits: "more", permit: "permits",
  incidentRecord: "adminIncidents",
};

// Inspection types that make sense to run from a phone — the long audits stay
// on the desktop where the evidence and sign-off live.
const MOBILE_INSP_TYPES = ["weekly_walk", "office_housekeeping", "warehouse_housekeeping", "fire_drill"];

function MobileApp({
  // identity
  user, onSignOut, onSwitchToDesktop,
  // domain state, straight from App.jsx
  allModules, assigns, comps, docs, docAssignments, docAcknowledgements,
  dseReports, incidents, investigations, allUsers = [],
  siteInspections = [], permits = [],
  // theme
  theme, setTheme, setDarkMode,
  // writes — the existing App.jsx functions
  db,
}) {
  const [online] = useOnline();
  const [followSystem, setFollowSystem] = React.useState(() => loadPrefs().followSystem !== false);
  const [systemDark, setSystemDark] = React.useState(
    () => !window.matchMedia || window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const effectiveTheme = followSystem ? (systemDark ? "dark" : "light") : theme;
  const T = getThemeTokens(effectiveTheme);

  const [tab, setTab] = React.useState(user.role === "admin" ? "adminHome" : "today");
  const [screen, setScreen] = React.useState(user.role === "admin" ? "adminHome" : "today");
  const [activeModule, setActiveModule] = React.useState(null);
  const [activeHazard, setActiveHazard] = React.useState(null);
  const [activeInspection, setActiveInspection] = React.useState(null);
  const [activePermit, setActivePermit] = React.useState(null);
  const [activeIncident, setActiveIncident] = React.useState(null);
  const [queue, setQueue] = React.useState([]);
  const [canInstall, setCanInstall] = React.useState(false);
  const [progress, setProgress] = React.useState(loadProgress);
  const [prefs, setPrefs] = React.useState(loadPrefs);
  const [textScale, setTextScale] = React.useState(() => loadPrefs().textScale || 1);

  // ── System theme ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Install prompt ────────────────────────────────────────────────────────
  React.useEffect(() => { watchInstallPrompt(setCanInstall); }, []);

  // ── Queue ─────────────────────────────────────────────────────────────────
  const refreshQueue = React.useCallback(() => { listQueue().then(setQueue); }, []);
  React.useEffect(refreshQueue, [refreshQueue]);

  const handlers = React.useMemo(() => ({
    completion: (p) => db.saveCompletion(p.userId, p.moduleId, p.record),
    docAck: (p) => db.acknowledgeDoc(p.userId, p.docId, p.date),
    incident: (p) => db.saveIncident(p.record),
    dseReport: (p) => db.saveDseReport(p.userId, p.report),
    actionComplete: (p) => db.completeAction(p.investigationId, p.actionId),
    theme: (p) => db.saveTheme(p.userId, p.theme),
    inspection: (p) => db.saveInspection(p.record),
    permitSignOn: (p) => db.savePermitSignOn(p.entry),
    permitSignOff: (p) => db.savePermitSignOff(p.entry),
    riddorReported: (p) => db.markRiddorReported(p.incidentId),
  }), [db]);

  React.useEffect(() => {
    if (!online) return;
    drainQueue(handlers).then((n) => { if (n) refreshQueue(); });
  }, [online, handlers, refreshQueue]);

  async function write(type, payload, label, optimistic) {
    if (optimistic) optimistic();
    if (online) {
      try {
        await handlers[type](payload);
        return;
      } catch (err) {
        console.warn("[mobile] direct write failed, queueing", err);
      }
    }
    await enqueue(type, payload, label);
    refreshQueue();
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const myIds = assigns[String(user.id)] || [];
  const myComps = comps[user.id] || {};
  const myMods = allModules
    .filter((m) => myIds.includes(m.id))
    .map((m) => ({ ...m, progressSlide: progress[m.id] || 0, offline: !!prefs.keepOffline }));

  const requiredDocs = docs.filter((d) =>
    (docAssignments[String(d.id)] || []).includes(String(user.id))
  );
  const myAcks = docAcknowledgements[user.id] || {};
  const unreadDocs = requiredDocs.filter((d) => !myAcks[d.id]);

  const myDse = dseReports[user.id] || [];
  const lastDse = myDse[myDse.length - 1];
  const dseExpiry = lastDse ? getExpiryStatus(lastDse.date, 12) : null;
  const dseState = {
    completed: !!lastDse,
    expired: dseExpiry ? dseExpiry.status === "expired" : false,
    needsAction: !lastDse || (dseExpiry && dseExpiry.status === "expired"),
    last: lastDse,
  };

  const certificates = myMods
    .filter((m) => myComps[m.id])
    .map((m) => {
      const c = myComps[m.id];
      const ex = m.renewalMonths ? getExpiryStatus(c.date, m.renewalMonths) : null;
      return {
        moduleId: m.id, title: m.title, icon: m.icon, score: c.score, certId: c.certId,
        validUntil: ex ? ex.expiryDate : null,
        lapsed: ex ? ex.status === "expired" : false,
        expiredOn: ex ? ex.expiryDate : null,
      };
    });

  const myActions = Object.entries(investigations || {}).flatMap(([invId, inv]) =>
    (inv.actions || [])
      .filter((a) => a.owner === user.name)
      .map((a) => ({ ...a, investigationId: invId, ref: invId }))
  );
  const openActions = myActions.filter((a) => a.status !== "complete" && a.status !== "closed");
  const closedActions = myActions.filter((a) => a.status === "complete" || a.status === "closed");

  const historyEntries = certificates.map((c) => ({
    date: (myComps[c.moduleId] || {}).date,
    title: c.title,
    lapsed: c.lapsed,
    outcome: c.lapsed ? `Passed · ${c.score}% · now expired` : `Passed · ${c.score}%`,
  })).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const historyStats = {
    passed: certificates.length,
    average: certificates.length
      ? Math.round(certificates.reduce((s, c) => s + (c.score || 0), 0) / certificates.length)
      : 0,
    retakes: 0,
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  function go(next, extra) {
    setScreen(next);
    const parent = PARENT_TAB[next] || next;
    if (STAFF_TABS.concat(ADMIN_TABS).some((t) => t.id === parent)) setTab(parent);
    if (extra) extra();
  }

  function back() {
    const parent = PARENT_TAB[screen];
    go(parent || (user.role === "admin" ? "adminHome" : "today"));
  }

  // Android hardware/gesture back.
  React.useEffect(() => {
    const onPop = () => { if (PARENT_TAB[screen]) { back(); window.history.pushState(null, ""); } };
    window.history.pushState(null, "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [screen]);

  // ── Writes ────────────────────────────────────────────────────────────────
  function saveProgress(moduleId, slide) {
    setProgress((p) => {
      const next = { ...p, [moduleId]: slide };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function completeModule(record) {
    if (!record.passed) return;
    write(
      "completion",
      { userId: user.id, moduleId: record.moduleId, record: { score: record.score, date: record.date, certId: record.certId } },
      `Certificate · ${(activeModule || {}).title || record.moduleId}`,
      () => db.optimisticCompletion && db.optimisticCompletion(user.id, record)
    );
    saveProgress(record.moduleId, 0);
  }

  function acknowledgeDoc(doc) {
    const date = new Date().toISOString().slice(0, 10);
    write(
      "docAck",
      { userId: user.id, docId: doc.id, date },
      `Document read · ${doc.title}`,
      () => db.optimisticDocAck && db.optimisticDocAck(user.id, doc.id, date)
    );
  }

  function submitHazard(record) {
    write("incident", { record }, `Hazard report · ${record.location}`,
      () => db.optimisticIncident && db.optimisticIncident(record));
  }

  function submitDse(report) {
    write("dseReport", { userId: user.id, report }, "DSE assessment",
      () => db.optimisticDseReport && db.optimisticDseReport(user.id, report));
  }

  function completeAction(action) {
    write("actionComplete", { investigationId: action.investigationId, actionId: action.id },
      `Action complete · ${action.title}`);
  }

  function submitInspection(record) {
    write("inspection", { record }, `Inspection · ${typeLabel(record.type)}`,
      () => db.optimisticInspection && db.optimisticInspection(record));
  }

  function signOnPermit(entry) {
    write("permitSignOn", { entry }, `Permit sign-on · ${entry.ref}`,
      () => db.optimisticPermitSignOn && db.optimisticPermitSignOn(entry));
  }

  function signOffPermit(entry) {
    write("permitSignOff", { entry }, `Permit sign-off · ${entry.ref}`,
      () => db.optimisticPermitSignOff && db.optimisticPermitSignOff(entry));
    back();
  }

  function reportRiddor(incidentId) {
    write("riddorReported", { incidentId }, `RIDDOR reported · ${incidentId}`);
  }

  function typeLabel(id) {
    const t = INSP_TYPES.find((x) => x.id === id);
    return t ? t.label : "walkround";
  }

  function changeTheme(key) {
    setFollowSystem(false);
    savePrefs({ ...prefs, followSystem: false });
    setTheme(key);
    setDarkMode(["dark", "slate", "forest", "graphite"].includes(key));
    write("theme", { userId: user.id, theme: key }, "Theme preference");
  }

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  }

  // ── Admin view models ─────────────────────────────────────────────────────
  const openIncidents = (incidents || []).filter((i) => !i.closed);
  const inboundHazards = openIncidents
    .filter((i) => i.quickReport)
    .slice(0, 10)
    .map((i) => ({
      id: i.id,
      ref: i.id.replace("qr_", "QR-").slice(0, 9),
      icon: i.urgency === "high" ? "🔴" : i.urgency === "medium" ? "🟠" : "🟡",
      title: i.description ? i.description.slice(0, 44) : "Hazard report",
      description: i.description,
      reporter: nameFor(i.reportedBy),
      location: i.location,
      when: `${i.date} ${i.time || ""}`.trim(),
      urgency: i.urgency,
      photos: i.photos,
      status: i.triaged ? "triaged" : "new",
    }));

  function nameFor(id) {
    if (String(id) === String(user.id)) return "You";
    const u = allUsers.find((x) => String(x.id) === String(id));
    return u ? u.name : `Staff #${id}`;
  }

  const adminAlerts = [];
  const riddorOpen = openIncidents.filter((i) => i.riddor && !i.riddorReported);
  if (riddorOpen.length) {
    adminAlerts.push({
      id: "riddor", icon: "🚨",
      title: `${riddorOpen.length} RIDDOR report${riddorOpen.length !== 1 ? "s" : ""} outstanding`,
      detail: "Statutory deadline applies — report via HSE",
    });
  }
  const overdueAll = Object.values(investigations || {}).flatMap((inv) =>
    (inv.actions || []).filter((a) =>
      a.status !== "complete" && a.status !== "closed" &&
      a.dueDate && a.dueDate < new Date().toISOString().slice(0, 10))
  );
  if (overdueAll.length) {
    adminAlerts.push({
      id: "actions", icon: "⏱",
      title: `${overdueAll.length} corrective action${overdueAll.length !== 1 ? "s" : ""} overdue`,
      detail: "Investigation actions past their due date",
    });
  }

  const adminStats = [
    { label: "Training incomplete", value: countIncompleteTraining(), sub: `of ${Object.keys(assigns).length} staff`, color: "#f59e0b" },
    { label: "Open incidents", value: openIncidents.length, sub: `${riddorOpen.length} RIDDOR unreported`, color: "#ef4444" },
    { label: "Docs unread", value: countUnreadDocs(), sub: "across the team", color: "#3b82f6" },
    { label: "Overdue actions", value: overdueAll.length, sub: "corrective actions", color: overdueAll.length ? "#ef4444" : "#10b981" },
  ];

  function countIncompleteTraining() {
    return Object.entries(assigns).filter(([uid, ids]) => {
      const c = comps[uid] || {};
      return (ids || []).some((id) => !c[id]);
    }).length;
  }

  function countUnreadDocs() {
    let n = 0;
    Object.entries(docAssignments || {}).forEach(([docId, uids]) => {
      (uids || []).forEach((uid) => {
        if (!(docAcknowledgements[uid] || {})[docId]) n++;
      });
    });
    return n;
  }

  // ── Inspections & permits ─────────────────────────────────────────────────
  // One "due" row per mobile-runnable inspection type, from the latest record
  // of that type: its nextDue and the location it was last run at.
  const todayIso = new Date().toISOString().slice(0, 10);
  const inspectionsDue = MOBILE_INSP_TYPES.map((typeId) => {
    const ofType = (siteInspections || [])
      .filter((r) => r.type === typeId)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const latest = ofType[ofType.length - 1];
    if (!latest || !latest.nextDue) return null;
    if (latest.nextDue > todayIso) return null;
    return {
      typeId,
      location: latest.location,
      dueDate: latest.nextDue,
      overdue: latest.nextDue < todayIso,
    };
  }).filter(Boolean);

  const recentInspections = (siteInspections || [])
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const myPermits = (permits || []).filter(
    (p) => !p.site || !user.site || p.site === user.site
  );
  const permitsToSign = myPermits.filter((p) => !p.closed && !p.signedOnAt);

  function incidentVM(inc) {
    if (!inc) return null;
    const inv = (investigations || {})[inc.id];
    const riddorDueDate = inc.riddorDueDate || addDaysIso(inc.date, 10);
    return {
      id: inc.id,
      ref: inc.id.startsWith("qr_") ? inc.id.replace("qr_", "QR-").slice(0, 9) : `INC-${String(inc.numberCode || "").padStart(4, "0")}`,
      type: inc.type,
      title: (inc.description || "Incident").split(" — ")[0].slice(0, 60),
      description: inc.description,
      date: inc.date,
      time: inc.time,
      location: inc.location,
      person: inc.injuredPerson ? nameFor(inc.injuredPerson) : null,
      reporter: nameFor(inc.reportedBy),
      injuryType: inc.injuryType,
      accidentCode: inc.accidentCode,
      daysLost: inc.daysLost,
      riskScore: inc.riskScore,
      riskBand: inc.riskScore == null ? null
        : inc.riskScore > 16 ? "Unacceptable" : inc.riskScore >= 10 ? "High" : inc.riskScore >= 5 ? "Medium" : "Low",
      riddor: !!inc.riddor,
      riddorReported: !!inc.riddorReported,
      riddorDueDate,
      riddorReason: inc.riddorReason || "Reportable under RIDDOR 2013 — confirm the category before submitting.",
      photos: inc.photos,
      closed: !!inc.closed,
      hasInvestigation: !!inv,
    };
  }

  function investigationVM(incId) {
    const inv = (investigations || {})[incId];
    if (!inv) return null;
    return {
      rootCause: inv.rootCause || (inv.fiveWhys && inv.fiveWhys.rootCause) || null,
      actions: (inv.actions || []).map((a) => {
        const late = a.status !== "complete" && a.status !== "closed" && a.dueDate && a.dueDate < todayIso;
        return {
          ...a,
          investigationId: incId,
          overdue: !!late,
          overdueDays: late ? Math.ceil((Date.now() - new Date(a.dueDate).getTime()) / 86400000) : 0,
        };
      }),
    };
  }

  // ── Header ────────────────────────────────────────────────────────────────
  const [kicker, fixedTitle] = TITLES[screen] || TITLES.today;
  const title =
    fixedTitle ||
    (screen === "training" ? `${myMods.length} modules assigned`
      : screen === "module" ? (activeModule || {}).title
      : screen === "more" ? user.name
      : screen === "triage" ? (activeHazard || {}).ref
      : screen === "inspection" ? typeLabel((activeInspection || {}).typeId)
      : screen === "permits" ? `${myPermits.filter((p) => !p.closed).length} live on site`
      : screen === "permit" ? `${(activePermit || {}).ref || ""} · sign on`
      : screen === "incidentRecord" ? ((incidentVM(activeIncident) || {}).ref || "")
      : "");

  const tabs = user.role === "admin" && isAdminScreen(screen) ? ADMIN_TABS : STAFF_TABS;
  const activeTab = PARENT_TAB[screen] || screen;

  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      background: T.bg, color: T.white, fontFamily: FONT,
      fontSize: `${textScale}rem`, overscrollBehavior: "none",
    }}>
      <MobileHeader
        kicker={kicker}
        title={title}
        onBack={PARENT_TAB[screen] ? back : undefined}
        right={user.role === "admin" ? (
          <button
            onClick={() => {
              const toAdmin = !isAdminScreen(screen);
              go(toAdmin ? "adminHome" : "today");
            }}
            style={{
              flexShrink: 0, height: 34, padding: "0 12px", borderRadius: 11,
              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.32)",
              color: T.gold, fontWeight: 800, fontSize: 10.5, letterSpacing: 0.6,
              fontFamily: FONT, cursor: "pointer", textTransform: "uppercase",
            }}
          >
            {isAdminScreen(screen) ? "Admin" : "Staff"}
          </button>
        ) : null}
        Z={T} font={FONT}
      />

      {(!online || queue.length > 0) && <OfflineBanner queueCount={queue.length} Z={T} />}

      <main style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        {screen === "today" && (
          <Today
            user={user} myMods={myMods} myComps={myComps} unreadDocs={unreadDocs} dseState={dseState}
            onResume={(m) => { setActiveModule(m); go("module"); }}
            onOpenModule={(m) => { setActiveModule(m); go("module"); }}
            onOpenDocs={() => go("documents")}
            onOpenDse={() => go("dse")}
            onReport={() => go("report")}
            Z={T} font={FONT}
          />
        )}

        {screen === "training" && (
          <Training
            myMods={myMods} myComps={myComps}
            onOpenModule={(m) => { setActiveModule(m); go("module"); }}
            Z={T} font={FONT}
          />
        )}

        {screen === "module" && activeModule && (
          <ModulePlayer
            mod={activeModule} user={user}
            initialSlide={progress[activeModule.id] || 0}
            offline={!!prefs.keepOffline}
            onExit={() => go(user.role === "admin" ? "adminHome" : "today")}
            onProgress={saveProgress}
            onComplete={completeModule}
            Z={T} font={FONT}
          />
        )}

        {screen === "report" && (
          <ReportHazard
            user={user}
            managerName={user.manager}
            suggestedLocation={prefs.lastLocation}
            online={online}
            onSubmit={(rec) => { updatePref("lastLocation", rec.location); submitHazard(rec); }}
            onDone={() => go(user.role === "admin" ? "adminHome" : "today")}
            Z={T} font={FONT}
          />
        )}

        {screen === "documents" && (
          <Documents
            docs={docs} required={requiredDocs} acknowledgements={myAcks}
            onAcknowledge={acknowledgeDoc}
            onPreview={(d) => db.previewDoc && db.previewDoc(d)}
            Z={T} font={FONT}
          />
        )}

        {screen === "dse" && (
          <DSEMobile user={user} onSubmit={submitDse} onExit={() => go("today")} Z={T} font={FONT} />
        )}

        {screen === "more" && (
          <More
            user={user}
            counts={{
              unreadDocs: unreadDocs.length,
              certificates: certificates.filter((c) => !c.lapsed).length,
              openActions: openActions.length,
              inspectionsDue: inspectionsDue.length,
              permitsToSign: permitsToSign.length,
            }}
            dseState={dseState}
            queue={queue}
            canInstall={canInstall}
            onOpenDocs={() => go("documents")}
            onOpenDse={() => go("dse")}
            onOpenCerts={() => go("certificates")}
            onOpenActions={() => go("actions")}
            onOpenInspections={() => go("inspections")}
            onOpenPermits={() => go("permits")}
            onOpenHistory={() => go("history")}
            onOpenAppearance={() => go("appearance")}
            onSignOut={onSignOut}
            onSwitchToDesktop={onSwitchToDesktop}
            Z={T} font={FONT}
          />
        )}

        {screen === "certificates" && <Certificates certificates={certificates} Z={T} font={FONT} />}

        {screen === "actions" && (
          <CorrectiveActions
            open={openActions} closed={closedActions}
            onComplete={completeAction}
            onAddProof={(a) => db.addActionProof && db.addActionProof(a)}
            Z={T} font={FONT}
          />
        )}

        {screen === "history" && (
          <TrainingHistory entries={historyEntries} stats={historyStats} Z={T} font={FONT} />
        )}

        {screen === "appearance" && (
          <Appearance
            theme={theme}
            followSystem={followSystem}
            onSelectTheme={changeTheme}
            onFollowSystem={() => { setFollowSystem(true); savePrefs({ ...prefs, followSystem: true }); }}
            textScale={textScale}
            onTextScale={(v) => { setTextScale(v); savePrefs({ ...prefs, textScale: v }); }}
            prefs={prefs}
            onPrefChange={updatePref}
            storageUsed={prefs.storageUsed || "—"}
            Z={T} font={FONT}
          />
        )}

        {screen === "adminHome" && (
          <AdminOverview
            alerts={adminAlerts} stats={adminStats} inbound={inboundHazards}
            onOpenHazard={(h) => { setActiveHazard(h); go("triage"); }}
            onOpenAlert={(a) => {
              const first = a && a.id === "riddor" ? riddorOpen[0] : null;
              if (first) { setActiveIncident(first); go("incidentRecord"); }
              else go("adminIncidents");
            }}
            Z={T} font={FONT}
          />
        )}

        {screen === "adminIncidents" && (
          <AdminOverview
            alerts={[]} stats={[]} inbound={inboundHazards}
            onOpenHazard={(h) => { setActiveHazard(h); go("triage"); }}
            onOpenAlert={() => {}}
            Z={T} font={FONT}
          />
        )}

        {screen === "inspections" && (
          <Inspections
            due={inspectionsDue}
            recent={recentInspections}
            onStart={(d) => { setActiveInspection(d); go("inspection"); }}
            onOpenDesktop={onSwitchToDesktop}
            Z={T} font={FONT}
          />
        )}

        {screen === "inspection" && activeInspection && (
          <InspectionRun
            typeId={activeInspection.typeId}
            location={activeInspection.location}
            user={user}
            onSubmit={submitInspection}
            onExit={() => go("inspections")}
            Z={T} font={FONT}
          />
        )}

        {screen === "permits" && (
          <Permits
            permits={myPermits}
            user={user}
            onOpenPermit={(p) => { setActivePermit(p); go("permit"); }}
            Z={T} font={FONT}
          />
        )}

        {screen === "permit" && activePermit && (
          <PermitDetail
            permit={activePermit}
            user={user}
            onSignOn={signOnPermit}
            onSignOff={signOffPermit}
            Z={T} font={FONT}
          />
        )}

        {screen === "incidentRecord" && activeIncident && (
          <IncidentRecord
            incident={incidentVM(activeIncident)}
            investigation={investigationVM(activeIncident.id)}
            onReportRiddor={() => reportRiddor(activeIncident.id)}
            onChaseAction={(a) => db.chaseAction && db.chaseAction(a)}
            onOpenDesktop={onSwitchToDesktop}
            Z={T} font={FONT}
          />
        )}

        {screen === "triage" && activeHazard && (
          <HazardTriage
            hazard={activeHazard}
            history={[]}
            onResolve={() => { db.resolveIncident && db.resolveIncident(activeHazard.id); back(); }}
            onAssign={() => db.assignAction && db.assignAction(activeHazard.id)}
            onEscalate={() => db.escalateIncident && db.escalateIncident(activeHazard.id)}
            Z={T} font={FONT}
          />
        )}
      </main>

      <TabBar tabs={tabs} active={activeTab} onSelect={(id) => go(id)} Z={T} font={FONT} />
    </div>
  );
}

function isAdminScreen(screen) {
  return screen === "adminHome" || screen === "adminIncidents" || screen === "triage" ||
    screen === "incidentRecord";
}

function addDaysIso(dateStr, days) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
  catch { return {}; }
}

function loadPrefs() {
  try {
    return Object.assign(
      { followSystem: true, keepOffline: true, mobileData: false, textScale: 1 },
      JSON.parse(localStorage.getItem(PREFS_KEY)) || {}
    );
  } catch {
    return { followSystem: true, keepOffline: true, mobileData: false, textScale: 1 };
  }
}

function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* quota */ }
}

export default MobileApp;
export { MobileApp };
