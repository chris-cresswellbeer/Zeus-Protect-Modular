import React from "react";
import { useRemembered } from "../lib/remembered";

/**
 * Click-to-sort column headings.
 *
 *   const [sort, setSortBy] = useSort("staff", { by: "name", dir: "asc" });
 *   const rows = sortRows(list, sort, { name: u => u.name, progress: u => pct(u), last: u => lastLogin(u) });
 *   <SortButton label="Name" by="name" sort={sort} onSort={setSortBy} Z={T} font={font}/>
 *
 * Click a heading to sort by it; click again to reverse. Text sorts A–Z, numbers and
 * dates low→high; empty values always go last. The choice is remembered like the
 * filters (lib/remembered.js: this tab, until sign-out).
 */
export function useSort(key, initial) {
  const [sort, setSort] = useRemembered(`sort.${key}`, initial || { by: null, dir: "asc" });
  const setSortBy = by => setSort(s => (s && s.by === by ? { by, dir: s.dir === "asc" ? "desc" : "asc" } : { by, dir: "asc" }));
  return [sort || { by: null, dir: "asc" }, setSortBy];
}

const isEmpty = v => v === null || v === undefined || v === "" || (typeof v === "number" && isNaN(v));
export function compareValues(a, b) {
  if (isEmpty(a) && isEmpty(b)) return 0;
  if (isEmpty(a)) return 1;
  if (isEmpty(b)) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en-GB", { numeric: true, sensitivity: "base" });
}

/** A sorted copy. `first` (optional) groups rows before the chosen sort (e.g. by team). */
export function sortRows(rows, sort, getters, first) {
  const list = [...(rows || [])];
  const get = sort && sort.by && getters[sort.by];
  if (!get && !first) return list;
  const dir = sort && sort.dir === "desc" ? -1 : 1;
  return list.sort((x, y) => {
    if (first) { const f = first(x, y); if (f) return f; }
    if (!get) return 0;
    const a = get(x), b = get(y);
    // empty values stay last whichever way round
    if (isEmpty(a) || isEmpty(b)) return compareValues(a, b);
    return dir * compareValues(a, b);
  });
}

/** A heading that sorts. Put it inside the header cell; it fills the cell's text. */
export function SortButton({ label, by, sort, onSort, Z = {}, font, align = "left", style }) {
  const on = sort && sort.by === by;
  const arrow = on ? (sort.dir === "asc" ? "▲" : "▼") : "⇅";
  return (
    <button type="button" onClick={() => onSort(by)} data-sort={by} aria-label={`Sort by ${label}${on ? (sort.dir === "asc" ? ", currently A to Z / lowest first" : ", currently Z to A / highest first") : ""}`}
      title={`Sort by ${label}`}
      style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", font: "inherit", color: on ? (Z.white || "inherit") : "inherit",
        letterSpacing: "inherit", textTransform: "inherit", display: "inline-flex", alignItems: "center", gap: 5, justifyContent: align === "center" ? "center" : "flex-start", fontFamily: font || "inherit", ...style }}>
      <span>{label}</span>
      <span aria-hidden="true" style={{ fontSize: "0.85em", opacity: on ? 1 : 0.45 }}>{arrow}</span>
    </button>
  );
}
