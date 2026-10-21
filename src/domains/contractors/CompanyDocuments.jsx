/**
 * CompanyDocuments — Contractors → company → Documents: the company's insurance, RAMS and
 * policies, with expiry / review dates, and whether the company is approved.
 *
 * A company is approved when every document Site Settings → Contractor sign-in asks for is on
 * file and in date (lib/contractorApproval.js approvalOf). Approval never stops a contractor
 * signing in: an unapproved company is flagged on the On Site board, in the bell and by email.
 *
 * Stored on the company (contractors.data.documents, no SQL needed):
 *   { id:"d_<ts>", type: COMPANY_DOC_TYPES id, title, fileName, fileUrl, date "YYYY-MM-DD" | "",
 *     uploadedAt, uploadedBy, note }
 * Files: storage bucket "documents", contractor_certs/<companyId>_doc_<type>_<ts>_<name>
 * (admins only, like workers' certificates). Old documents stay as a record; the current one
 * of each type is the one with the latest date.
 */
import React from "react";
import { ask, notify } from "../../shared/Feedback";
import { sb } from "../../lib/supabase";
import { ACCEPT_IMG_DOCS } from "../../lib/constants";
import { COMPANY_DOC_TYPES } from "../../data/seedContractors";
import { ukDate } from "../../lib/dates";
import { approvalOf, currentDocs, docState } from "../../lib/contractorApproval";
import { ApprovalChip } from "./OnSiteBoard";

const STATE_COLOUR = { ok: "#34d399", soon: "#fbbf24", expired: "#f87171", undated: "#94a3b8", missing: "#f87171" };

export function CompanyDocuments({ company, required, today, me, onSave, T, font }) {
  const [busy, setBusy] = React.useState("");
  const [showOld, setShowOld] = React.useState(false);
  const docs = company.documents || [];
  const cur = currentDocs(company);
  const a = approvalOf(company, { required, today });
  const btn = primary => ({ background: primary ? `linear-gradient(135deg,${T.accent},${T.blue})` : T.overlay, color: "#fff", border: primary ? "none" : `1px solid ${T.borderMd}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, minHeight: 32, display: "inline-flex", alignItems: "center", gap: 6 });

  async function upload(type, file, input) {
    const t = COMPANY_DOC_TYPES.find(x => x.id === type);
    const v = await ask({ title: t.label, message: `"${file.name}"`, ok: "Upload", fields: [
      ...(type === "other" ? [{ id: "title", label: "What is it?", required: true }] : []),
      { id: "date", label: t.date === "review" ? "Review by (optional)" : "Expiry date", type: "date", required: t.date !== "review" && type !== "other" },
      { id: "note", label: "Note (optional), e.g. policy number, insurer" },
    ] });
    if (input) input.value = "";
    if (!v) return;
    setBusy(type);
    const ts = Date.now();
    const path = `contractor_certs/${company.id}_doc_${type}_${ts}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await sb.storage.upload("documents", path, file);
    if (error) { setBusy(""); notify(`Upload failed: ${error}`, { kind: "error" }); return; }
    const doc = { id: `d_${ts}`, type, title: (v.title || "").trim(), fileName: file.name, fileUrl: sb.storage.getPublicUrl("documents", path),
      date: v.date || "", uploadedAt: new Date().toISOString(), uploadedBy: (me && me.name) || "", note: (v.note || "").trim() };
    await onSave({ ...company, documents: [...docs, doc] });
    setBusy("");
    notify(`${t.short} saved.`);
  }
  async function remove(d) {
    const t = COMPANY_DOC_TYPES.find(x => x.id === d.type) || { short: "Document" };
    if (!(await ask({ title: `Remove this ${t.short.toLowerCase()}?`, message: `${d.fileName}${d.date ? `, ${ukDate(d.date)}` : ""}. Remove it only if it was uploaded by mistake: an old certificate is kept as a record when a new one is added.`, ok: "Remove", danger: true }))) return;
    await onSave({ ...company, documents: docs.filter(x => x.id !== d.id) }, { removedDocs: [d.id] });
  }
  async function editDate(d) {
    const t = COMPANY_DOC_TYPES.find(x => x.id === d.type) || { date: "expiry" };
    const v = await ask({ title: "Change the date", ok: "Save", fields: [{ id: "date", label: t.date === "review" ? "Review by" : "Expiry date", type: "date", value: d.date || "" }] });
    if (!v) return;
    await onSave({ ...company, documents: docs.map(x => (x.id === d.id ? { ...x, date: v.date || "" } : x)) });
  }

  const UploadBtn = ({ type, label }) => (
    <label style={{ ...btn(!cur[type]), cursor: busy ? "wait" : "pointer" }} data-testid={`doc-upload-${type}`}>
      {busy === type ? "⏳ Uploading…" : label}
      <input type="file" accept={ACCEPT_IMG_DOCS} style={{ display: "none" }} disabled={!!busy} aria-label={`Upload ${type}`}
        onChange={e => { const f = e.target.files && e.target.files[0]; if (f) upload(type, f, e.target); }}/>
    </label>
  );
  const DocLine = ({ d }) => (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: T.muted }}>
      <a href={d.fileUrl} target="_blank" rel="noreferrer" style={{ color: T.accentLt, fontWeight: 700, textDecoration: "none" }}>{d.title || d.fileName}</a>
      {d.note && <span>{d.note}</span>}
      <span>uploaded {ukDate(String(d.uploadedAt || "").slice(0, 10))}{d.uploadedBy ? ` by ${d.uploadedBy}` : ""}</span>
      <button type="button" onClick={() => editDate(d)} style={{ ...btn(false), minHeight: 26, padding: "2px 8px", fontSize: 11 }}>Date</button>
      <button type="button" aria-label={`Remove ${d.fileName}`} onClick={() => remove(d)} style={{ ...btn(false), minHeight: 26, padding: "2px 8px", fontSize: 11, color: "#f87171" }}>🗑</button>
    </div>
  );

  const curIds = new Set(Object.values(cur).map(d => d.id));
  const others = docs.filter(d => d.type === "other");
  const old = docs.filter(d => d.type !== "other" && !curIds.has(d.id)).sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));
  return (
    <div data-testid="company-docs">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.white }}>Documents</h3>
        <ApprovalChip company={company} required={required} today={today}/>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>
        {a.key === "banned" || a.key === "inactive" ? `${a.issues[0]}. Change it with ✏ Edit.` :
          a.approved ? "Everything needed is on file and in date." : `To be approved: ${a.issues.join("; ")}.`}
        {" "}What's needed is set in Site Settings → Contractor sign-in. Nothing here stops anyone signing in: reception and H&S are told.
      </p>
      <div style={{ background: `linear-gradient(135deg,${T.navyMd},${T.navy})`, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}` }}>
        {COMPANY_DOC_TYPES.filter(t => t.id !== "other").map((t, i) => {
          const d = cur[t.id], st = docState(d, t.id, today), req = (required || []).includes(t.id);
          return (
            <div key={t.id} data-testid={`doc-row-${t.id}`} style={{ padding: "13px 18px", borderTop: i ? `1px solid ${T.border}` : "none", display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{t.label}</span>
                  {req && <span style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, border: `1px solid ${T.borderMd}`, borderRadius: 10, padding: "1px 6px" }}>NEEDED</span>}
                </div>
                <div data-testid={`doc-state-${t.id}`} style={{ fontSize: 12, fontWeight: 700, marginTop: 3, color: d || req ? STATE_COLOUR[st.key] : T.muted }}>{d || req ? st.text : "Not needed for approval"}</div>
                {d && <div style={{ marginTop: 4 }}><DocLine d={d}/></div>}
              </div>
              <UploadBtn type={t.id} label={d ? "↑ Upload a newer one" : "↑ Upload"}/>
            </div>
          );
        })}
        <div style={{ padding: "13px 18px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Other documents <span style={{ fontWeight: 400, color: T.muted, fontSize: 12 }}>(accreditations, licences…)</span></span>
            <UploadBtn type="other" label="↑ Upload"/>
          </div>
          {others.map(d => <div key={d.id} style={{ marginTop: 6 }}><DocLine d={d}/>{d.date && <div style={{ fontSize: 11.5, color: STATE_COLOUR[docState(d, "other", today).key] }}>{docState(d, "other", today).text}</div>}</div>)}
        </div>
      </div>
      {old.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button type="button" style={btn(false)} onClick={() => setShowOld(v => !v)}>{showOld ? "▾" : "▸"} Older documents ({old.length})</button>
          {showOld && <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {old.map(d => <div key={d.id}><span style={{ fontSize: 12, color: T.white, fontWeight: 700, marginRight: 8 }}>{(COMPANY_DOC_TYPES.find(x => x.id === d.type) || {}).short}{d.date ? `, ${ukDate(d.date)}` : ""}</span><DocLine d={d}/></div>)}
          </div>}
        </div>
      )}
    </div>
  );
}
