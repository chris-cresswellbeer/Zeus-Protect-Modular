/**
 * teamOf(manager, users) — a line manager's team: active users whose Line Manager
 * text matches the manager's name (ignoring case and extra spaces).
 * Used by the My Team tab and the manager's notification bell.
 */
const normName = s => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
function teamOf(manager, users) {
  if (!manager) return [];
  return (users || []).filter(u =>
    String(u.id) !== String(manager.id) &&
    (u.status || "active") !== "leaver" &&
    normName(u.manager) && normName(u.manager) === normName(manager.name));
}
export { teamOf, normName };
