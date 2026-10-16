// Unit tests for src/lib/ppe.js (plain node: node qr/ppelib.mjs)
import * as P from "../src/lib/ppe.js";
const check = (name, ok, extra = "") => console.log(ok ? "PASS" : "FAIL", name, extra);
const person = { id: 3, name: "Priya Shah", department: "Production" };
const s = P.normalisePpeSettings(null);
const boots = s.items.find(i => i.id === "boots"), plugs = s.items.find(i => i.id === "ear-plugs"), gloves = s.items.find(i => i.id === "gloves");

check("1 default settings: staff see it, 30 days, 9 items, statement", s.staffCanSee && s.dueSoonDays === 30 && s.items.length === 9 && s.statement.length > 50);
check("2 settings tidy: bad days → 30, sizes from text, blank items dropped, duplicate ids made unique",
  (() => { const n = P.normalisePpeSettings({ dueSoonDays: "999", items: [{ name: "Apron", sizes: "S, M ,,L", life: "6" }, { name: "" }, { id: "x", name: "A" }, { id: "x", name: "B" }] });
    return n.dueSoonDays === 30 && n.items.length === 3 && n.items[0].sizes.join() === "S,M,L" && n.items[0].life === 6 && n.items[1].id !== n.items[2].id; })());
check("3 months: 31 Jan + 1 → 28 Feb; 29 Feb 2028 + 12 → 28 Feb 2029; −12", P.addMonthsISO("2027-01-31", 1) === "2027-02-28" && P.addMonthsISO("2028-02-29", 12) === "2029-02-28" && P.addMonthsISO("2026-10-16", -12) === "2025-10-16");

const now = "2026-10-16T09:30:00.000Z";
const r = P.newPpeIssue({ person, item: boots, size: "UK 6", qty: 1, by: "Chris", on: "2026-10-16", signature: "data:image/png;base64,AAA", now });
check("4 new issue: replace by from the item's life, signed in person", r.status === "issued" && r.replace_by === "2027-10-16" && r.data.replaceBy === "2027-10-16" && r.data.signedVia === "in person" && r.data.signedAt === now && r.user_id === "3" && r.data.issuedBy === "Chris");
const u = P.newPpeIssue({ person, item: plugs, size: "One size", qty: 50, on: "2026-10-16", now });
check("5 no fixed life → no replacement date; unsigned; qty capped at 99", u.replace_by === null && u.data.signature === null && u.data.qty === 50 && P.newPpeIssue({ person, item: plugs, qty: 500, now }).data.qty === 99);

const st = (row, today) => P.ppeState(row, today, 30);
check("6 states: in date / due soon (30 days) / overdue", st(r, "2027-01-01").key === "ok" && st(r, "2027-09-20").key === "soon" && st(r, "2027-10-17").key === "overdue" && st(r, "2027-10-16").key === "soon");
check("7 unsigned shows 'Needs signature', overdue beats it", st(u, "2026-10-16").key === "unsigned" && (() => { const g = P.newPpeIssue({ person, item: gloves, size: "8 (M)", on: "2026-01-01", now }); return st(g, "2026-10-16").key === "overdue" && st(g, "2026-10-16").unsigned; })());
const signed = P.signPpe(u, "data:image/png;base64,BBB", "phone", now);
check("8 signing on the phone; signing again changes nothing", signed.data.signedVia === "phone" && signed.data.signature.endsWith("BBB") && P.signPpe(signed, "data:x", "phone").data.signature.endsWith("BBB"));
const rep = P.reportPpeProblem(r, { kind: "damaged", note: "sole split", by: "Priya Shah" }, now);
check("9 a reported problem comes first and stays open", st(rep, "2027-01-01").key === "problem" && P.openProblems(rep).length === 1 && rep.data.problems[0].note === "sole split");
const dealt = P.dealWithPpeProblems(rep, { by: "Jordan", note: "glued" }, now);
check("10 dealt with: closed, state back to in date", P.openProblems(dealt).length === 0 && dealt.data.problems[0].dealtBy === "Jordan" && st(dealt, "2027-01-01").key === "ok");
const nw = P.newPpeIssue({ person, item: boots, size: "UK 6", reason: "damaged", by: "Chris", on: "2026-11-01", now: "2026-11-01T10:00:00.000Z" });
const [o2, n2] = P.replacePpe(rep, nw, { by: "Chris" });
check("11 replace: old is 'replaced' and points to the new one (and back); its problem closed", o2.status === "replaced" && o2.data.replacedBy === n2.id && n2.data.replaces === rep.id && o2.data.returnedOn === "2026-11-01" && P.openProblems(o2).length === 0 && st(o2).key === "replaced");
const ret = P.returnPpe(r, { by: "Chris", reason: "Leaver", on: "2026-12-01" });
check("12 returned", ret.status === "returned" && ret.data.returnReason === "Leaver" && st(ret).key === "returned");
const rows = [r, u, rep, o2, n2, ret].map((x, i) => ({ ...x, id: x.id + i }));
const sum = P.ppeSummary([r, u, P.newPpeIssue({ person, item: gloves, size: "8 (M)", on: "2026-01-01", now }), o2, ret], "2026-10-16", 30);
check("13 summary: issued in 12 months, current, overdue, unsigned", sum.issued12 === 5 && sum.current === 3 && sum.overdue === 1 && sum.unsigned === 2 && sum.soon === 0, JSON.stringify(sum));
check("14 last sizes: the newest issue wins", P.lastSizes([P.newPpeIssue({ person, item: boots, size: "UK 5", now: "2025-01-01T00:00:00Z" }), r], 3).boots === "UK 6");
const csv = P.ppeCsv([r, { ...u, data: { ...u.data, dept: "=SUM(1)", name: "O'Neil, Sam" } }], "2026-10-16");
check("15 CSV: header, one line per issue, commas quoted, formulas made safe", csv.startsWith("﻿Person,Department,Item") && csv.split("\r\n").length === 3 && csv.includes('"O\'Neil, Sam"') && csv.includes("\"'=SUM(1)\"") && !/,=SUM/.test(csv));
