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
import { getThemeTokens, themeForMode, isLightTheme, applyThemeVars } from "../theme/tokens";
import { applyLightThemeFix } from "../lib/lightThemeFix";
import { getExpiryStatus, todayISO } from "../lib/dates";
import { isActionDone } from "../lib/actionStatus";
import { getBrand } from "../lib/brandCore";
import { useBrand } from "../lib/brand";
import { personalCompliance } from "../domains/training/compliance";
import { EXT_CERT_TYPES } from "../data/seedExtCerts";
import { DSE_RENEWAL_MONTHS } from "../data/seedDse";
import { useOnline } from "./lib/useOnline";
import { enqueue, listQueue, drainQueue, retry as retryQueued, isStuck } from "./lib/syncQueue";
import { watchInstallPrompt, keepMediaOffline } from "./registerSW";
import { MobileHeader, OfflineBanner, TabBar } from "./ui";
import { Today } from "./screens/Today";
import { Training } from "./screens/Training";
import { ModulePlayer } from "./screens/ModulePlayer";
import { ReportHazard } from "./screens/ReportHazard";
import { Documents } from "./screens/Documents";
import { More, Certificates, CorrectiveActions, TrainingHistory, Appearance } from "./screens/More";
import { Inspections, InspectionRun } from "./screens/Inspection";
import { Permits, PermitDetail } from "./screens/Permits";
import { LoneWorking, LoneBanner } from "./screens/LoneWorking";
import { LoneRespond } from "../shared/LoneRespond";
import { useLoneSettings, useLoneSessions } from "../lib/loneClient";
import { LONE_OPEN, LONE_ALARM } from "../lib/loneWorking";
import { getSiteLists } from "../lib/siteLists";
import { INSP_TYPES } from "../data/seedInspections";
import { useInspTemplates, inspTypes, inspTypeLabel } from "../lib/inspTemplates";
import { myIncompleteQuickReports } from "../domains/incidents/quickReportStatus";
import { ScrollNav } from "../shared/ScrollNav";
import { bundlesFor } from "../domains/documents/bundles";
import { progressMap, saveProgress as saveModuleProgress, clearProgress } from "../lib/moduleProgress";
import { dueInfo } from "../lib/dueDates";
import { latestByKey } from "../domains/inspections/inspectionDue";
import { isPassed } from "../domains/training/completion";
import { sameName } from "../lib/openActions";
import { t, useLang } from "../lib/i18n";
import { LanguageChooser } from "../shared/LanguageBits";


const FONT = "'Barlow','Trebuchet MS',system-ui,sans-serif";
const OLD_PROGRESS_KEY = "zeus.mobile.progress";   // before Oct 2026: one list for everyone on the phone (removed)
const PREFS_KEY = "zeus.mobile.prefs";

// Bottom tab bar for everyone; admins get extra entries (see where TABS is built below).
const STAFF_TABS = [
  { id: "today", icon: "◎", label: "Today" },
  { id: "training", icon: "🎓", label: "Training" },
  { id: "report", icon: "⚠", label: "Report" },
  { id: "more", icon: "☰", label: "More" },
];

const TITLES = {
  today: [null, "Today"],   // null = the portal name (branding)
  training: ["My training", ""],
  module: ["Training", ""],
  report: ["Report", "Hazard report"],
  documents: ["Documents", "Read & confirm"],
  more: ["Account", ""],
  certificates: ["Account", "My certificates"],
  actions: ["Account", "Corrective actions"],
  history: ["Account", "Training history"],
  appearance: ["Account", "Appearance & theme"],
  language: ["Account", "Language"],
  inspections: ["Inspections", "Due & recent"],
  inspection: ["Inspection", ""],
  permits: ["Permits to work", ""],
  lone: ["Lone working", ""],
  lonealert: ["Lone working", "Alert"],
  permit: ["Permit to work", ""],
};

// Sub-screen → owning tab, used by back() and to highlight the right tab.
const PARENT_TAB = {
  module: "training", documents: "more",
  certificates: "more", actions: "more", history: "more", appearance: "more", language: "more",
  inspections: "more", inspection: "inspections",
  permits: "more", permit: "permits",
  lone: "more", lonealert: "today",
};

// Built-in inspection types that make sense to run from a phone (the annual audit and
// FRA stay on the desktop). This site's own checklists (inspection_templates) are added too.
// Inspections and permits are supervisor tools — shown to admins only.
// DSE, incident triage and incident records live in the desktop portal.
const MOBILE_INSP_TYPES = ["weekly_walk", "office_housekeeping", "warehouse_housekeeping", "fire_drill"];

// PROPS: user, onSignOut, onSwitchToDesktop, the domain maps from App.jsx (allModules,
// assigns, comps, docs, docAssignments, docAcknowledgements, dseReports, incidents,
// investigations, allUsers, siteInspections, permits = mobilePermits view model),
// theme/setTheme/setDarkMode, and `db` = App.jsx's mobileDb object.
// Optional db functions (optimistic*, previewDoc, addActionProof…) are always called
// as `db.x && db.x(...)`, so a missing one is simply skipped. Currently mobileDb does
// not provide optimisticInspection, optimisticPermitSignOn/Off or addActionProof.
//
// LOCAL-ONLY STATE (localStorage, per device): module slide progress (lib/moduleProgress.js, per person)
// and display prefs (PREFS_KEY: followSystem, keepOffline, mobileData, textScale).
function MobileApp({
  // identity
  user, onSignOut, onSwitchToDesktop, onCompleteQuickReport,
  // domain state, straight from App.jsx
  allModules, assigns, comps, docs, docAssignments, docAcknowledgements, docBundles = [],
  dseReports, extCerts = {}, incidents, investigations, allUsers = [], dueDates = {},
  siteInspections = [], permits = [],
  // theme
  theme, setTheme, setDarkMode,
  // language ("en" | "fr" | "pl" | "ro") and how to change it (App.jsx chooseLanguage)
  language = "en", onChangeLanguage,
  // writes — the existing App.jsx functions
  db,
}) {
  const [online] = useOnline();
  useLang();   // re-render in the new language when it changes
  const [followSystem, setFollowSystem] = React.useState(() => loadPrefs().followSystem !== false);
  const [systemDark, setSystemDark] = React.useState(
    () => !window.matchMedia || window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  // Follow system: the phone's light/dark setting picks the mode; the theme is
  // the person's saved one if it's that mode, else the last one they used in it.
  const effectiveTheme = followSystem ? themeForMode(systemDark ? "dark" : "light", theme) : theme;
  const T = getThemeTokens(effectiveTheme);
  // Pale-text fix follows the theme actually on screen (App.jsx leaves this to us on phones).
  const brand = useBrand();   // re-render (and re-apply the theme) when the branding changes
  React.useEffect(() => { applyLightThemeFix(isLightTheme(effectiveTheme)); applyThemeVars(effectiveTheme); }, [effectiveTheme, brand]);

  const isAdmin = user.role === "admin";
  // lone working: everyone's own session; admins and line managers also see alerts for others
  const loneSettings = useLoneSettings(true);
  const loneSessions = useLoneSessions(loneSettings.enabled, { every: 20000 });
  const myLone = loneSessions.find((r) => String(r.user_id) === String(user.id) && LONE_OPEN.includes(r.status)) || null;
  // the database rules already limit this to the team (managers) or everyone (admins); the
  // same check here keeps the old sign-in (no database rules) from showing staff other people's
  const norm = (x) => String(x || "").toLowerCase().replace(/\s+/g, " ").trim();
  const myTeam = (r) => isAdmin || (user.role === "manager" && allUsers.some((u) => String(u.id) === String(r.user_id) && norm(u.manager) === norm(user.name)));
  const otherAlarms = loneSessions.filter((r) => String(r.user_id) !== String(user.id) && LONE_ALARM.includes(r.status) && myTeam(r));
  const [loneAlertId, setLoneAlertId] = React.useState(() => { try { return new URLSearchParams(window.location.search).get("lone"); } catch { return null; } });
  const [tab, setTab] = React.useState("today");
  const [screen, setScreen] = React.useState(() => { try { return new URLSearchParams(window.location.search).get("lone") ? "lonealert" : "today"; } catch { return "today"; } });
  const mainRef = React.useRef(null);   // the scrolling <main>, for ScrollNav
  const [activeModule, setActiveModule] = React.useState(null);
  const [activeInspection, setActiveInspection] = React.useState(null);
  const [activePermit, setActivePermit] = React.useState(null);
  const [queue, setQueue] = React.useState([]);
  const [canInstall, setCanInstall] = React.useState(false);
  // Where they got to in each module — per person, shared with the computer layout (lib/moduleProgress.js)
  const [progressTick, setProgressTick] = React.useState(0);
  const progress = React.useMemo(() => progressMap(user.id, allModules), [user.id, allModules, progressTick]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { try { localStorage.removeItem(OLD_PROGRESS_KEY); } catch { /* */ } }, []);
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
  React.useEffect(() => watchInstallPrompt(setCanInstall), []);

  // ── Queue ─────────────────────────────────────────────────────────────────
  const refreshQueue = React.useCallback(() => { listQueue().then(setQueue); }, []);
  React.useEffect(refreshQueue, [refreshQueue]);

  // Queue item `type` → the App.jsx write that performs it. Adding a new offline-capable
  // write = add a handler here + call write("<type>", payload, label, optimistic).
  // Never rename an existing type: items already queued on phones would be dropped.
  // must(): the App.jsx saves resolve false when the database didn't take the write (bad
  // signal, server error) — that must count as FAILED, so the item stays queued and retries.
  const must = (fn) => async (p) => { const r = await fn(p); if (r === false) throw new Error("not saved"); return r; };
  const handlers = React.useMemo(() => ({
    completion: must((p) => db.saveCompletion(p.userId, p.moduleId, p.record)),
    docAck: must((p) => db.acknowledgeDoc(p.userId, p.docId, p.date)),
    incident: must((p) => db.saveIncident(p.record)),
    // dseReport / riddorReported kept only so writes queued by older builds still drain.
    dseReport: must((p) => db.saveDseReport(p.userId, p.report)),
    actionComplete: must((p) => db.completeAction(p.investigationId, p.actionId)),
    theme: must((p) => db.saveTheme(p.userId, p.theme)),
    inspection: must((p) => db.saveInspection(p.record)),
    permitSignOn: must((p) => db.savePermitSignOn(p.entry)),
    permitSignOff: must((p) => db.savePermitSignOff(p.entry)),
    riddorReported: must((p) => db.markRiddorReported(p.incidentId)),
  }), [db]); // eslint-disable-line react-hooks/exhaustive-deps

  // Whenever we come back online, replay queued writes in order — and while online with
  // something waiting, try again every minute (the signal may be weak rather than gone).
  const waiting = queue.filter((q) => !isStuck(q)).length;
  React.useEffect(() => {
    if (!online) return;
    const run = () => drainQueue(handlers).then(() => refreshQueue()).catch(() => {});
    run();
    if (!waiting) return;
    const t = setInterval(run, 60000);
    return () => clearInterval(t);
  }, [online, handlers, refreshQueue, waiting > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  // The offline worker (public/sw.js) wakes the page via Background Sync when signal returns.
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e) => { if (e.data && e.data.type === "zeus-drain-queue") drainQueue(handlers).then(() => refreshQueue()).catch(() => {}); };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [handlers, refreshQueue]);
  const retryItem = (id) => retryQueued(id).then(() => drainQueue(handlers)).then(() => refreshQueue());

  // Central write path: apply the optimistic UI update, then try the write directly
  // when online, otherwise (or if it THROWS) put it in the IndexedDB queue.
  // A save the database refuses counts as failed too (must(), above), so it is queued.
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
    .map((m) => ({ ...m, progressSlide: progress[m.id] || 0, offline: !!prefs.keepOffline, due: dueInfo(dueDates, user.id, m.id, !!myComps[m.id]) }))
    .sort((a, b) => ((a.due || {}).due || "9999").localeCompare((b.due || {}).due || "9999"));   // soonest due first

  // "Keep modules offline" (More): save the pictures of my unfinished modules on the
  // phone now, so they open with no signal. Videos are streamed, not saved.
  const mediaKey = prefs.keepOffline ? myMods.filter((m) => !myComps[m.id]).map((m) => m.id + ":" + (m.version || 1)).join(",") : "";
  React.useEffect(() => {
    if (!mediaKey) return;
    // "Download over mobile data" off: wait for Wi-Fi (where the phone can tell us)
    const conn = navigator.connection;
    if (!prefs.mobileData && conn && (conn.type === "cellular" || conn.saveData)) return;
    const urls = [];
    myMods.filter((m) => !myComps[m.id]).forEach((m) => (m.slides || []).forEach((sl) => {
      [...(sl.images || []).map((im) => im && im.url), sl.image && sl.image.url].forEach((u) => {
        if (typeof u === "string" && /^https:\/\//.test(u)) urls.push(u);
      });
    }));
    if (urls.length) keepMediaOffline([...new Set(urls)]);
  }, [mediaKey, prefs.mobileData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same figure as the computer dashboard (domains/training/compliance.js).
  const myExt = extCerts[user.id] || extCerts[String(user.id)] || {};
  const myDseList = dseReports[user.id] || dseReports[String(user.id)] || [];
  const myCompliance = personalCompliance({ mods: myMods, comps: myComps,
    certs: Object.fromEntries(EXT_CERT_TYPES.filter((ct) => myExt[ct.id]).map((ct) => [ct.id, myExt[ct.id]])),
    lastDse: myDseList[myDseList.length - 1] || null, dseRenewalMonths: DSE_RENEWAL_MONTHS });

  const requiredDocs = docs.filter((d) =>
    (docAssignments[String(d.id)] || []).includes(String(user.id))
  );
  const myAcks = docAcknowledgements[user.id] || {};
  const unreadDocs = requiredDocs.filter((d) => !myAcks[d.id]);
  // Quick hazard reports this user still has to complete in the full (desktop) form.
  const quickToComplete = myIncompleteQuickReports(incidents, user.id);

  // Recorded completions (training done before the portal, entered by an admin)
  // have no portal certificate or score: they're listed in history only.
  const certificates = myMods
    .filter((m) => myComps[m.id] && !myComps[m.id].recorded && isPassed(myComps[m.id], m))   // only passes are certificates
    .map((m) => {
      const c = myComps[m.id];
      const ex = m.renewalMonths ? getExpiryStatus(c.date, m.renewalMonths) : null;
      return {
        moduleId: m.id, title: (m._en || m).title, icon: m.icon, score: c.score, certId: c.certId, completed: c.date || "",   // certificates stay in English
        module: m._en || m, moduleVersion: c.moduleVersion || null,
        validUntil: ex ? ex.expiryDate : null,
        lapsed: ex ? ex.status === "expired" : false,
        expiredOn: ex ? ex.expiryDate : null,
      };
    });

  const myActions = Object.entries(investigations || {}).flatMap(([invId, inv]) =>
    (inv.actions || [])
      .filter((a) => sameName(a.owner, user.name))
      .map((a) => ({ ...a, investigationId: invId, ref: invId }))
  );
  const openActions = myActions.filter((a) => !isActionDone(a));
  const closedActions = myActions.filter((a) => isActionDone(a));

  const recordedDone = myMods.filter((m) => myComps[m.id] && myComps[m.id].recorded).map((m) => {
    const c = myComps[m.id];
    const ex = m.renewalMonths ? getExpiryStatus(c.date, m.renewalMonths) : null;
    return { date: c.date, title: m.title, lapsed: ex ? ex.status === "expired" : false, session: !!(c.recorded && c.recorded.session) };
  });
  const historyEntries = [
    ...certificates.map((c) => ({
      date: (myComps[c.moduleId] || {}).date,
      title: c.title,
      lapsed: c.lapsed,
      outcome: c.lapsed ? `Passed · ${c.score}% · now expired` : `Passed · ${c.score}%`,
    })),
    ...recordedDone.map((r) => { const how = r.session ? "Completed in a group session" : "Completed before the portal";
      return { ...r, outcome: r.lapsed ? `${how} · now expired` : how }; }),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const historyStats = {
    passed: certificates.length + recordedDone.length,
    average: certificates.length
      ? Math.round(certificates.reduce((s, c) => s + (c.score || 0), 0) / certificates.length)
      : 0,
    retakes: 0,
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  function go(next, extra) {
    setScreen(next);
    const parent = PARENT_TAB[next] || next;
    if (STAFF_TABS.some((t) => t.id === parent)) setTab(parent);
    if (extra) extra();
  }

  function back() {
    const parent = PARENT_TAB[screen];
    go(parent || "today");
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
    const m = allModules.find((x) => String(x.id) === String(moduleId));
    if (!m) return;
    if (slide > 0) saveModuleProgress(user.id, m, slide); else clearProgress(user.id, m);
    setProgressTick((t) => t + 1);
  }

  // Only PASSED attempts are recorded from mobile (failures are not logged to quiz_failures here).
  function completeModule(record) {
    if (!record.passed) return;
    write(
      "completion",
      { userId: user.id, moduleId: record.moduleId, record: { score: record.score, date: record.date, certId: record.certId,
        ...(record.lang ? { lang: record.lang, translation: record.translation } : {}) } },   // the language it was done in
      `Certificate · ${(activeModule || {}).title || record.moduleId}`,
      () => db.optimisticCompletion && db.optimisticCompletion(user.id, record)
    );
    saveProgress(record.moduleId, 0);
  }

  function acknowledgeDoc(doc) {
    const date = todayISO();
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

  function typeLabel(id) {
    const t = inspTypes().find((x) => x.id === id);
    return t ? t.label : "walkround";
  }

  function changeTheme(key) {
    setFollowSystem(false);
    savePrefs({ ...prefs, followSystem: false });
    setTheme(key);
    write("theme", { userId: user.id, theme: key }, "Theme preference");
  }

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  }

  // ── Inspections & permits ─────────────────────────────────────────────────
  // One "due" row per mobile-runnable inspection type AND place, from the latest record
  // of that type at that place (same rule as the desktop: domains/inspections/inspectionDue.js).
  const _t = new Date();
  const todayIso = `${_t.getFullYear()}-${String(_t.getMonth() + 1).padStart(2, "0")}-${String(_t.getDate()).padStart(2, "0")}`;
  // this site's own checklists (e.g. the BRCGS audits) can be run on the phone too
  const siteTemplates = useInspTemplates(isAdmin).filter((t) => !t.hidden);
  const startTypes = [...INSP_TYPES.filter((t) => MOBILE_INSP_TYPES.includes(t.id)), ...siteTemplates];
  const inspectionPlaces = [...new Set((siteInspections || []).map((r) => r.location).filter(Boolean))];
  const inspectionsDue = [...latestByKey(siteInspections || []).values()]
    .filter((r) => (MOBILE_INSP_TYPES.includes(r.type) || siteTemplates.some((t) => t.id === r.type)) && r.nextDue && r.nextDue <= todayIso)
    .sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)))
    .map((r) => ({ typeId: r.type, location: r.location, dueDate: r.nextDue, overdue: r.nextDue < todayIso }));

  const recentInspections = (siteInspections || [])
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const myPermits = (permits || []).filter(
    (p) => !p.site || !user.site || p.site === user.site
  );
  const permitsToSign = myPermits.filter((p) => !p.closed && !p.signedOnAt);

  // ── Header ────────────────────────────────────────────────────────────────
  const [kicker, fixedTitle] = TITLES[screen] || TITLES.today;
  const title =
    (fixedTitle && t(fixedTitle)) ||
    (screen === "training" ? t("{n} modules assigned", { n: myMods.length })
      : screen === "module" ? (activeModule || {}).title
      : screen === "more" ? user.name
      : screen === "inspection" ? typeLabel((activeInspection || {}).typeId)
      : screen === "permits" ? `${myPermits.filter((p) => !p.closed).length} live on site`
      : screen === "permit" ? `${(activePermit || {}).ref || ""} · sign on`
      : "");

  const tabs = STAFF_TABS.map((tb) => ({ ...tb, label: t(tb.label) }));
  const activeTab = PARENT_TAB[screen] || screen;

  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      background: T.bg, color: T.white, fontFamily: FONT,
      fontSize: `${textScale}rem`, overscrollBehavior: "none",
    }}>
      <MobileHeader
        kicker={kicker === null ? getBrand().product : t(kicker)}
        title={title}
        onBack={PARENT_TAB[screen] ? back : undefined}
        Z={T} font={FONT}
      />

      {(!online || queue.length > 0) && <OfflineBanner online={online} queueCount={waiting} stuckCount={queue.length - waiting} Z={T} />}

      <main ref={mainRef} style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        {otherAlarms.length > 0 && screen !== "lonealert" && (
          <div style={{ padding: "12px 18px 0", display: "flex", flexDirection: "column", gap: 8 }}>
            {otherAlarms.map((r) => (
              <button key={r.id} type="button" data-testid="m-lone-alarm" onClick={() => { setLoneAlertId(r.id); go("lonealert"); }}
                style={{ textAlign: "left", display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 14, border: "none", background: "linear-gradient(90deg,#b91c1c,#dc2626)", color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                <span style={{ fontSize: 20 }}>🧍</span>
                <span style={{ flex: 1 }}>{(r.data || {}).name} {r.status === "help" ? "has asked for help" : "missed a lone working check-in"}<span style={{ display: "block", fontWeight: 600, fontSize: 12, opacity: .9 }}>{(r.data || {}).place} · tap to respond</span></span>
              </button>
            ))}
          </div>
        )}
        {screen === "today" && myLone && (
          <div style={{ padding: "18px 18px 0" }}><LoneBanner row={myLone} onOpen={() => go("lone")} Z={T} font={FONT} /></div>
        )}
        {screen === "today" && (
          <Today
            user={user} myMods={myMods} myComps={myComps} unreadDocs={unreadDocs} compliance={myCompliance}
            quickToComplete={quickToComplete} onCompleteQuickReport={onCompleteQuickReport}
            onResume={(m) => { setActiveModule(m); go("module"); }}
            onOpenModule={(m) => { setActiveModule(m); go("module"); }}
            onOpenDocs={() => go("documents")}
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
            mod={activeModule} user={user} language={language}
            initialSlide={progress[activeModule.id] || 0}
            offline={!!prefs.keepOffline}
            onExit={() => go("today")}
            onProgress={saveProgress}
            onComplete={completeModule}
            Z={T} font={FONT}
          />
        )}

        {screen === "report" && (
          <ReportHazard
            user={user} language={language}
            managerName={user.manager}
            suggestedLocation={prefs.lastLocation}
            online={online}
            onSubmit={(rec) => { updatePref("lastLocation", rec.location); submitHazard(rec); }}
            onDone={() => go("today")}
            Z={T} font={FONT}
          />
        )}

        {screen === "documents" && (
          <Documents
            docs={docs} required={requiredDocs} acknowledgements={myAcks}
            bundles={bundlesFor(docBundles, user.id)} userId={String(user.id)}
            onAcknowledge={acknowledgeDoc}
            onPreview={(d) => db.previewDoc && db.previewDoc(d)}
            Z={T} font={FONT}
          />
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
            queue={queue}
            onRetryQueued={retryItem}
            canInstall={canInstall}
            onOpenDocs={() => go("documents")}
            onOpenCerts={() => go("certificates")}
            onOpenActions={() => go("actions")}
            onOpenLone={loneSettings.enabled ? () => go("lone") : undefined}
            loneActive={!!myLone}
            onOpenInspections={isAdmin ? () => go("inspections") : undefined}
            onOpenPermits={isAdmin ? () => go("permits") : undefined}
            onOpenHistory={() => go("history")}
            onOpenAppearance={() => go("appearance")}
            onOpenLanguage={onChangeLanguage ? () => go("language") : undefined}
            language={language}
            onSignOut={onSignOut}
            onSwitchToDesktop={onSwitchToDesktop}
            Z={T} font={FONT}
          />
        )}

        {screen === "lone" && (
          <LoneWorking user={user} settings={loneSettings} sessions={loneSessions} online={online}
            places={(getSiteLists() || {}).reportLocations || []} Z={T} font={FONT} />
        )}

        {screen === "lonealert" && (() => {
          const r = loneSessions.find((x) => x.id === loneAlertId);
          const box = { padding: 18 };
          if (!r) return <div style={{ ...box, color: T.muted, fontSize: 14 }}>{loneSessions.length ? "This alert has been closed, or you can't see it." : "Loading…"}</div>;
          if (!LONE_ALARM.includes(r.status)) return <div style={{ ...box, color: T.white, fontSize: 15, lineHeight: 1.5 }} data-testid="m-lone-closed">{(r.data || {}).name}: {r.data && r.data.ack ? `already dealt with by ${r.data.ack.by}.` : "they've checked in, or the session has ended."}</div>;
          return <div style={box}><LoneRespond row={r} people={allUsers} byName={user.name} Z={T} font={FONT} onDone={() => { setLoneAlertId(null); go("today"); }} /></div>;
        })()}

        {screen === "certificates" && <Certificates certificates={certificates} holder={user && user.name} holderJob={(user && user.jobTitle) || ""} Z={T} font={FONT} />}

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

        {screen === "language" && (
          <div style={{ padding: "18px 18px 28px" }} data-testid="language-screen">
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, marginBottom: 14 }}>
              {t("Training and this app are shown in your language where a translation is ready. Certificates and records stay in English.")}
            </div>
            <LanguageChooser value={language} onChange={(code) => { onChangeLanguage && onChangeLanguage(code); }} Z={T} font={FONT} />
          </div>
        )}

        {isAdmin && screen === "inspections" && (
          <Inspections
            due={inspectionsDue}
            recent={recentInspections}
            onStart={(d) => { setActiveInspection(d); go("inspection"); }}
            startTypes={startTypes} places={inspectionPlaces}
            onOpenDesktop={onSwitchToDesktop}
            Z={T} font={FONT}
          />
        )}

        {isAdmin && screen === "inspection" && activeInspection && (
          <InspectionRun
            typeId={activeInspection.typeId}
            location={activeInspection.location}
            user={user}
            onSubmit={submitInspection}
            onExit={() => go("inspections")}
            Z={T} font={FONT}
          />
        )}

        {isAdmin && screen === "permits" && (
          <Permits
            permits={myPermits}
            user={user}
            onOpenPermit={(p) => { setActivePermit(p); go("permit"); }}
            Z={T} font={FONT}
          />
        )}

        {isAdmin && screen === "permit" && activePermit && (
          <PermitDetail
            permit={activePermit}
            user={user}
            onSignOn={signOnPermit}
            onSignOff={signOffPermit}
            Z={T} font={FONT}
          />
        )}

      </main>
      {/* ▲/▼ on long screens, above the tab bar (shared/ScrollNav.jsx) */}
      <ScrollNav scrollRef={mainRef} watchKey={screen} bottom="calc(env(safe-area-inset-bottom, 8px) + 84px)" Z={T} font={FONT} />

      <TabBar tabs={tabs} active={activeTab} onSelect={(id) => go(id)} Z={T} font={FONT} />
    </div>
  );
}

// localStorage helpers — wrapped in try/catch because private browsing / full storage can throw.
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
