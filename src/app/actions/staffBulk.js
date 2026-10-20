/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/actions/staffBulk.js — createStaffBulkActions(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Staff list bulk actions: tick people, then one action for all of them.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { ask, notify } from "../../shared/Feedback";

export function createStaffBulkActions(app) {
  const {
    allModules, allUsers, assignBundle, assigns, dbSaveAssigns, dbSaveUser, dbSaveUserProfile, docBundles,
    noteDue, setAllUsers, setAssigns, unassignBundle, user
  } = app;

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

  return {
    peopleNamed, bulkAssignModule, bulkGiveBundle, saveUsersBulk, bulkSetManager, bulkMarkLeavers
  };
}
