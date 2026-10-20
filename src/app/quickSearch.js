/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/quickSearch.js — createQuickSearch(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Quick search (🔍 in the header, Ctrl+K / ⌘K, shared/QuickSearch.jsx): what it can find and where each result goes.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { hasMachineryAccess, isWarehouseWorker } from "../data/seedMachinery";
import { confirmLeave, unsavedLabels } from "../lib/unsaved";

export function createQuickSearch(app) {
  const {
    allModules, allUsers, assigns, comps, contractors, docs, incidents, setAdminReportView, setAtabRaw,
    setBulkTarget, setDocFolder, setEditingStaff, setFocusContractorId, setFocusIncidentId,
    setInvestigationView, setMod, setPagePreset, setPreviewDoc, setPreviewModule, setShowWelcomeSettings,
    setStabRaw, setStaffFilterManager, setStaffFilterProgress, setStaffFilterSearch, setStaffStatusFilter,
    setTarget, setViewRaw, showMyPpe, startMod, user, view
  } = app;

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
    const STAFF_PAGES = { dashboard: "Dashboard", training: "My Training", history: "My Training → History & certificates", documents: "Documents", incidents: "Report Incident", dse: "My DSE", machinery: "My Training → My machinery", mequip: "Machinery & Equipment", reception: "Reception (contractors on site)", actions: "My Actions", ppe: "My PPE", team: "My Team", account: "My Account" };
    const staffTabs = ["dashboard", "training", "history", ...(isWarehouseWorker(user) ? ["machinery"] : []), "documents", "incidents", "dse", ...(showMyPpe ? ["ppe"] : []), "actions", ...(user.role === "manager" ? ["team"] : []), ...(user.role !== "admin" && hasMachineryAccess(user) ? ["mequip"] : []), ...(user.role !== "admin" && user.reception === true ? ["reception"] : []), "account"];
    staffTabs.forEach(t => items.push({ id: `p:s:${t}`, group: "Pages", icon: "📄", label: STAFF_PAGES[t], sub: isAdmin ? "Your own training view" : "Page", words: t === "history" ? "certificates certificate history" : t === "incidents" ? "report hazard near miss" : t === "ppe" ? "ppe boots gloves hi-vis sign" : "", run: () => toStaff(t) }));
    if (isAdmin) {
      const ADMIN_PAGES = [["dashboard", "Admin dashboard", ""], ["users", "Staff", "staff accounts people users"], ["assign", "Assign Training", "training"], ["modules", "Training Library", "modules training"],
        ["create", "Create Module", "new module training"], ["reports", "Reports", "training matrix report excel"], ["documents", "H&S Documents", "documents bundles policies"], ["coshh", "COSHH Register", "chemicals"],
        ["audit", "Audit Trail & backup", "log history backup download"], ["settings", "Site Settings", "locations first aid zones shifts report locations"], ["incidents", "Incidents", "accidents near miss riddor"], ["inspections", "Inspections", "site inspection"], ["ra", "Risk Assessments", "risk"],
        ["firesafety", "Fire Safety", "wardens extinguishers drills"], ["firstaid", "First Aid", "first aiders"], ["contractors", "Contractors", ""], ["permits", "Permits to Work", "permits permit to work hot work"], ["lone", "Lone Working", "lone worker working alone check-in"],
        ["machinery", "Machinery Competence", "forklift"], ["equipment", "Equipment Register", "equipment"], ["ppe", "PPE Register", "ppe personal protective equipment boots gloves hi-vis ear defenders glasses issue signature"], ["account", "My Account", "password"]];
      const WHERE = { machinery: "Staff ▼", assign: "Training ▼", modules: "Training ▼", create: "Training ▼", ra: "Risk ▼", coshh: "Risk ▼", inspections: "Risk ▼", permits: "Risk ▼",
        firesafety: "Site Safety ▼", firstaid: "Site Safety ▼", lone: "Site Safety ▼", ppe: "Site Safety ▼", settings: "⚙ by your name", audit: "⚙ by your name" };
      ADMIN_PAGES.forEach(([t, l, w]) => items.push({ id: `p:a:${t}`, group: "Pages", icon: "🧭", label: l, sub: WHERE[t] ? `Admin page · ${WHERE[t]}` : "Admin page", words: w, run: () => toAdmin(t) }));
      // pages inside other pages
      items.push({ id: "p:a:investigations", group: "Pages", icon: "🔍", label: "Investigations", sub: "Incidents → Investigations", words: "investigation root cause corrective actions", run: () => toAdmin("investigation", () => setInvestigationView(null)) });
      items.push({ id: "p:a:accidentbook", group: "Pages", icon: "📖", label: "Accident Book", sub: "Incidents → Accident Book", words: "accident book bi510 print", run: () => toAdmin("incidents", () => setPagePreset({ tab: "incidents", accidentBook: true })) });
      [["matrix", "Training Matrix", "matrix excel"], ["monthly", "Monthly management report", "monthly report board"], ["evidence", "Audit evidence pack", "evidence pack audit customer insurer iso 45001 brcgs chas safecontractor"], ["board", "H&S performance (board report)", "board quarterly annual afr ltifr lost time injury frequency rate hours worked kpi year on year"], ["schedule", "Inspection schedule compliance", "inspection audit schedule overdue planned findings ageing non conformance racking checks"], ["riddor", "RIDDOR register", "riddor register hse reportable f2508"], ["dse", "DSE Reports", "dse display screen workstation assessments"],
       ["expiry", "Expiring training", "expiry expired renewals"], ["failures", "Quiz Failures", "quiz failed"], ["documents", "Document Read Status", "read confirmations acknowledgements"]]
        .forEach(([v, l, w]) => items.push({ id: `p:a:rep:${v}`, group: "Pages", icon: "📊", label: l, sub: "Reports", words: w, run: () => toAdmin("reports", () => setAdminReportView(v)) }));
      items.push({ id: "p:a:racking", group: "Pages", icon: "🧭", label: "Racking", sub: "Admin page · Equipment → Racking", words: "racking rack racks damage sema inspection qr labels bays aisles", run: () => toAdmin("equipment", () => setPagePreset({ tab: "racking" })) });
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

  return {
    jump, quickItems
  };
}
