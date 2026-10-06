import { useState, useRef, useEffect } from "react";
import { E } from "../../lib/emoji";
import { notify, ask } from "../../shared/Feedback";
import { sb } from "../../lib/supabase";
import { openFile } from "../../lib/fileAccess";
import { auditEvent } from "../../lib/audit";
import { useSiteLists } from "../../lib/siteLists";
import { useRemembered } from "../../lib/remembered";
import { checkMachineFiles, MACHINE_EVIDENCE_ACCEPT } from "../machinery/machineEvidence";
import { fireSummary, expiryState, plusMonths, todayLocal, WARDEN_CERT } from "./fireLogic";

import { todayISO } from "../../lib/dates";
/**
 * FireSafetyTab — admin fire safety log book (Regulatory Reform (Fire Safety) Order 2005).
 *
 * Six sub-tabs, each a list stored in its own Supabase table:
 *   wardens        → the Fire Warden certificate on each staff member (ext_certs "fire_marshall":
 *                    { issuedDate, expiryDate, zones, fileName, fileUrl }), plus any older
 *                    typed-in rows in fire_wardens { id, name, zone, qualDate, renewalMonths }
 *                    until they are linked to a staff member (fireLogic.js wardenList).
 *   drills         → fire_drills         { id, date, time, zone, evacuTime "m:ss", headcountOk, conductedBy, issues, weather }
 *   alarm          → fire_alarm_tests    { id, date, callPoint, testedBy, result: pass|fault, notes }  (weekly test)
 *   extinguishers  → fire_extinguishers  { id, location, type, serialNo, lastService, nextServiceDue, lastVisualDate, visualOk, notes }
 *   lighting       → fire_emerg_lighting { id, date, testType: monthly|annual, zone, testedBy, result, notes }
 *   fra            → fire_fra_reviews    { id, date, reviewedBy, trigger, changes, nextReviewDue, fileName?, fileUrl? }
 * (Examples in demo/seedFireSafety.js; the per-tab form below is the source of truth.)
 *
 * All six live in ONE state object `fireSafety` in App.jsx; any change is saved by the
 * [fireSafety] auto-sync effect → dbSaveFireSafety (upsert-and-prune per table).
 * Add/edit uses a single shared modal whose fields depend on `subTab` (wardens have their
 * own form, which saves the certificate record instead).
 * Fire Drill and Fire Risk Assessment INSPECTIONS (Inspections screen) are listed in the
 * Drill Log and FRA Reviews too, and count in the summary (fireLogic.js).
 * Removing a log entry can be undone for a few seconds (FRA entries with a file ask first).
 *
 * FRA documents: a picked file is held as `_fileObj` (+ base64 `fileData` for instant
 * preview) and uploaded to the "fire-safety" bucket only when the modal is saved.
 * Extinguishers support bulk CSV import (columns: location, type, serialno,
 * lastservice, nextservicedue — validated and previewed before import).
 */
function FireSafetyTab({ fireSafety, setFireSafety, staff, onUploadFraDoc, onDeleteFraDoc,
  extCerts={}, setExtCerts, onSaveCert, onDeleteCert, inspections=[], onOpenInspection, preset, clearPreset, userName="", Z, font }) {
  const {
    alarmTests=[], extinguishers=[], emergLighting=[]
  } = fireSafety;
  const site = useSiteLists();
  const sum = fireSummary({ fireSafety, extCerts, staff, inspections, today: todayLocal() });

  // remembered while signed in, so the page reopens on the tab you were using (and a
  // refresh of the page underneath can't drop you back on Wardens)
  const [subTab, setSubTab] = useRemembered("fire.tab", "wardens");
  // opened from elsewhere on a particular list (e.g. Equipment Register → extinguishers)
  useEffect(() => { if (preset && preset.sub) { setSubTab(preset.sub); clearPreset && clearPreset(); } }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showModal, setShowModal] = useState(false);
  const [modalForm, setModalForm] = useState({});
  const [editId, setEditId] = useState(null);
  const [fraFileUploading, setFraFileUploading] = useState(false);
  const fraFileRef = useRef(null);
  const [showExtCsvImport, setShowExtCsvImport] = useState(false);
  const [extCsvPreview, setExtCsvPreview] = useState([]);
  const [extCsvError, setExtCsvError] = useState("");
  const extCsvRef = useRef(null);
  const [wForm, setWForm] = useState(null);        // the warden form (null = closed)
  const [wBusy, setWBusy] = useState(false);
  const wFileRef = useRef(null);

  const today = todayISO();

  // helpers
  // Short random id for new rows (7 chars). Not globally unique, but ample per list.
  const uid = () => Math.random().toString(36).slice(2,9);
  const inp = { width:"100%", background:Z.overlay, border:`1px solid ${Z.borderMd}`, borderRadius:10, padding:"9px 13px", color:Z.white, fontSize:13, outline:"none", fontFamily:font, boxSizing:"border-box" };
  const label = (t) => <div style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4,marginTop:14}}>{t}</div>;

  function daysSince(dateStr) {
    if(!dateStr) return null;
    return Math.floor((new Date() - new Date(dateStr)) / 86400000);
  }
  function daysUntil(dateStr) {
    if(!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  }
  // Generic due-date badge: Overdue / Due in N days (≤ urgentDays) / OK.
  function expiryBadge(dateStr, urgentDays=60) {
    if(!dateStr) return null;
    const d = daysUntil(dateStr);
    if(d < 0)  return { label:"Overdue",      color:"#ef4444", bg:"rgba(239,68,68,0.15)" };
    if(d <= urgentDays) return { label:`Due in ${d}d`, color:"#f59e0b", bg:"rgba(245,158,11,0.15)" };
    return { label:"OK",          color:"#10b981", bg:"rgba(16,185,129,0.12)" };
  }

  const SUB_TABS = [
    { id:"wardens",   label:E("🧑‍🚒 ","")+"Wardens",          count: sum.wardens.filter(w=>w.state.key!=="valid").length || null },
    { id:"drills",    label:E("🚨 ","")+"Drill Log",          count: null },
    { id:"alarm",     label:E("🔔 ","")+"Alarm Tests",        count: alarmTests.filter(t=>t.result==="fault").length || null },
    { id:"extinguishers", label:E("🧯 ","")+"Extinguishers",  count: extinguishers.filter(e=>{ const b=expiryBadge(e.nextServiceDue); return b&&b.color!=="#10b981"; }).length || null },
    { id:"lighting",  label:E("💡 ","")+"Emerg. Lighting",    count: null },
    { id:"fra",       label:E("📋 ","")+"FRA Reviews",        count: null },
  ];

  // ── MODALS ──
  // New entries start with the choices the drop-downs show, so what you see is what is saved.
  // …and your own name as the person who did it (change it if someone else did)
  const ADD_DEFAULTS = { drills:{ headcountOk:"true", weather:"Dry", date:todayLocal(), conductedBy:userName }, alarm:{ result:"pass", date:todayLocal(), testedBy:userName }, extinguishers:{ type:"CO2", visualOk:"true" },
    lighting:{ testType:"monthly", result:"pass", date:todayLocal(), testedBy:userName }, fra:{ reviewType:"internal", trigger:"Annual review", date:todayLocal(), reviewedBy:userName } };
  function openAdd() { if (subTab==="wardens") { openWarden(null); return; } setEditId(null); setModalForm({ ...(ADD_DEFAULTS[subTab]||{}) }); setFraFileUploading(false); setShowModal(true); }
  function openEdit(item) { setEditId(item.id); setModalForm({...item}); setFraFileUploading(false); setShowModal(true); }
  // `key` maps the active sub-tab to its list inside the fireSafety object.
  const listKey = () => subTab==="drills"?"drills":subTab==="alarm"?"alarmTests":subTab==="extinguishers"?"extinguishers":subTab==="lighting"?"emergLighting":"fraReviews";
  const NOUN = { drills:"Drill", alarmTests:"Alarm test", extinguishers:"Extinguisher", emergLighting:"Lighting test", fraReviews:"FRA review" };
  // Removes the entry with a few seconds to Undo. An FRA review with a stored file asks
  // first instead, because the file is deleted too and can't be put back.
  async function deleteItem(id) {
    const key = listKey();
    const item = (fireSafety[key]||[]).find(x=>x.id===id);
    if (!item) return;
    if (key==="fraReviews" && item.fileName) {
      const ok = await ask({ title:"Remove this FRA review?", message:`The review of ${item.date||"this date"} and its attached document (${item.fileName}) will be deleted. This can't be undone.`, ok:"Remove review", danger:true });
      if (!ok) return;
      if (onDeleteFraDoc) onDeleteFraDoc(id, item.fileName);
      setFireSafety(prev => ({ ...prev, [key]: (prev[key]||[]).filter(x=>x.id!==id) }));
      notify("FRA review removed.");
      return;
    }
    const at = (fireSafety[key]||[]).findIndex(x=>x.id===id);
    setFireSafety(prev => ({ ...prev, [key]: (prev[key]||[]).filter(x=>x.id!==id) }));
    notify(`${NOUN[key]} removed.`, { undo: () => setFireSafety(prev => {
      const list = (prev[key]||[]).filter(x=>x.id!==id); list.splice(Math.min(at, list.length), 0, item);
      return { ...prev, [key]: list };
    }) });
  }
  // The fields each log needs before it can be saved.
  const REQUIRED = { drills:[["date","the date"]], alarmTests:[["date","the date"],["callPoint","the call point"]], extinguishers:[["location","the location"],["type","the type"]], emergLighting:[["date","the date"],["zone","the zone or area"]], fraReviews:[["date","the review date"]] };
  const missing = () => (REQUIRED[listKey()]||[]).filter(([k])=>!String(modalForm[k]??"").trim()).map(([,l])=>l);
  // Uploads a pending FRA file first (so the saved record has its URL), then adds or
  // replaces the record in the active list.
  async function saveModal() {
    const key = listKey();
    const gap = missing();
    if (gap.length) { notify(`Please add ${gap.join(" and ")}.`, { kind:"error", timeout:5000 }); return; }
    let formToSave = {...modalForm};

    // If saving an FRA review with a new file object, upload to Storage first
    if(subTab==="fra" && formToSave._fileObj && onUploadFraDoc) {
      const recordId = editId || uid();
      const fileUrl = await onUploadFraDoc(recordId, formToSave._fileObj, formToSave.fileName);
      if(fileUrl) {
        formToSave = {...formToSave, fileUrl, fileData: fileUrl };
      }
      delete formToSave._fileObj;
      formToSave.id = recordId;
    }
    setFireSafety(prev => {
      const list = prev[key] || [];
      if(editId) return { ...prev, [key]: list.map(x=>x.id===editId?{...formToSave,id:editId}:x) };
      return { ...prev, [key]: [...list, {...formToSave, id: formToSave.id || uid()}] };
    });
    setShowModal(false);
  }

  const Badge = ({label:bl, color, bg}) => (
    <span style={{fontSize:11,fontWeight:700,color,background:bg,border:`1px solid ${color}33`,borderRadius:8,padding:"2px 9px",whiteSpace:"nowrap"}}>{bl}</span>
  );

  const Row = ({children, onClick}) => (
    <div onClick={onClick} style={{display:"grid",gridTemplateColumns:"1fr",gap:0}}>
      {children}
    </div>
  );

  const AddBtn = ({label:bl}) => (
    <button onClick={openAdd} style={{background:`linear-gradient(135deg,#ef4444,#dc2626)`,border:"none",borderRadius:10,padding:"9px 20px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:font,display:"flex",alignItems:"center",gap:6}}>
      + {bl}
    </button>
  );

  const tableHead = (cols) => (
    <div style={{display:"grid",gridTemplateColumns:cols,gap:8,padding:"8px 16px",background:Z.overlay,borderRadius:10,marginBottom:6,fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.8,textTransform:"uppercase"}}>
    </div>
  );

  // (fInp/fSel/fTA are plain functions returning JSX — NOT components — so they can be
  // called inline without breaking input focus. Keep it that way.)
  // ── RENDER FORMS — inline JSX only, no nested component definitions ──
  const fSet = (k,v) => setModalForm(p=>({...p,[k]:v}));
  const fInp = (k, type="text", placeholder="") => (
    <input type={type} value={modalForm[k]||""} onChange={e=>fSet(k,e.target.value)} placeholder={placeholder} style={{...inp,marginBottom:0}}/>
  );
  // a name box that suggests staff names (anyone can still be typed, e.g. a contractor)
  const fName = (k, placeholder="Name") => (
    <input value={modalForm[k]||""} onChange={e=>fSet(k,e.target.value)} placeholder={placeholder} list="fs-staff" aria-label={placeholder} style={{...inp,marginBottom:0}}/>
  );
  const fSel = (k, options) => (
    <select value={modalForm[k]||""} onChange={e=>fSet(k,e.target.value)} style={{...inp,marginBottom:0}}>
      {options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
    </select>
  );
  const fTA = (k, rows=3, placeholder="") => (
    <textarea rows={rows} value={modalForm[k]||""} onChange={e=>fSet(k,e.target.value)} placeholder={placeholder} style={{...inp,resize:"vertical",marginBottom:0}}/>
  );

  const formContent = subTab==="drills" ? (<>
    {label("Date")} {fInp("date","date")}
    {label("Time")} {fInp("time","time")}
    {label("Zone / Scope")} {fInp("zone","text","e.g. Full Site")}
    {label("Evacuation Time (mm:ss)")} {fInp("evacuTime","text","e.g. 4:15")}
    {label("Headcount Confirmed?")} {fSel("headcountOk",[{v:"true",l:"Yes — all accounted for"},{v:"false",l:"No — discrepancy noted"}])}
    {label("Conducted By")} {fName("conductedBy","Name")}
    {label("Weather Conditions")} {fSel("weather",["Dry","Wet","Cold","Hot","Windy"])}
    {label("Issues / Observations")} {fTA("issues",4,"Record any issues, deviations, or observations...")}
  </>) : subTab==="alarm" ? (<>
    {label("Date")} {fInp("date","date")}
    {label("Call Point Tested")} {fInp("callPoint","text","e.g. MCP-03 — Loading Dock")}
    {label("Tested By")} {fName("testedBy","Name")}
    {label("Result")} {fSel("result",[{v:"pass",l:"Pass"},{v:"fault",l:"Fault — action required"}])}
    {label("Notes / Actions")} {fTA("notes",3,"Note any issues or follow-up actions...")}
  </>) : subTab==="extinguishers" ? (<>
    {label("Location")} {fInp("location","text","e.g. Warehouse — Bay 1")}
    {label("Type")} {fSel("type",["CO2","Powder","Water","Foam","Wet Chemical","Halon (decommission)"])}
    {label("Serial / ID Number")} {fInp("serialNo","text","e.g. CO2-005")}
    {label("Last Annual Service Date")} {fInp("lastService","date")}
    {label("Next Service Due")} {fInp("nextServiceDue","date")}
    {label("Last Monthly Visual Check")} {fInp("lastVisualDate","date")}
    {label("Visual Check OK?")} {fSel("visualOk",[{v:"true",l:"Pass"},{v:"false",l:"Issue noted"}])}
    {label("Notes")} {fTA("notes",3,"Any issues, replacements etc...")}
  </>) : subTab==="lighting" ? (<>
    {label("Date")} {fInp("date","date")}
    {label("Test Type")} {fSel("testType",[{v:"monthly",l:"Monthly functional (flick test)"},{v:"annual",l:"Annual full-duration (3-hour discharge)"}])}
    {label("Zone / Area")} {fInp("zone","text","e.g. Office Block A")}
    {label("Tested By")} {fName("testedBy","Name or contractor")}
    {label("Result")} {fSel("result",[{v:"pass",l:"Pass"},{v:"fault",l:"Fault — action required"}])}
    {label("Notes / Actions")} {fTA("notes",3,"Any failed luminaires, follow-up actions...")}
  </>) : subTab==="fra" ? (<>
    {label("Review Type")} {fSel("reviewType",[{v:"internal",l:"Internal review"},{v:"external",l:"External company review"}])}
    {label("Review Date")} {fInp("date","date")}
    {label("Reviewed By")} {fName("reviewedBy",modalForm.reviewType==="external"?"Lead assessor name":"Name")}
    {modalForm.reviewType==="external" && (<>
      {label("Company Name")} {fInp("externalCompany","text","e.g. FireSafe Consulting Ltd")}
      {label("Assessor Qualifications")} {fInp("assessorQual","text","e.g. NEBOSH Fire, IFE Member, CFPA-E")}
      {label("Report Reference / Number")} {fInp("reportRef","text","e.g. FSC-2026-047")}
    </>)}
    {label("Trigger for Review")} {fSel("trigger",["Annual review","Post-incident / near miss","Premises change","Change of use","Post-inspection","Enforcement notice","Other"])}
    {label("Significant Changes / Findings")} {fTA("changes",4,"Describe any changes made to the FRA, new hazards identified, or actions arising...")}
    {label("Next Review Due")} {fInp("nextReviewDue","date")}
    {label("Upload FRA Document (PDF)")}
    {modalForm.fileName ? (
      <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:10,padding:"10px 14px"}}>
        <span style={{fontSize:16}}>📄</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:"#10b981",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{modalForm.fileName}</div>
          <div style={{fontSize:11,color:Z.muted}}>File attached</div>
        </div>
        <button type="button" onClick={()=>setModalForm(p=>({...p,fileName:null,fileData:null}))} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:18,lineHeight:1,fontFamily:font}}>✕</button>
      </div>
    ) : (
      <div>
        <input ref={fraFileRef} type="file" accept=".pdf,.doc,.docx" style={{display:"none"}} onChange={async e=>{
          const file = e.target.files[0];
          if(!file) return;
          setFraFileUploading(true);
          // Store base64 locally for immediate preview; Storage upload happens on save
          const reader = new FileReader();
          reader.onload = ev => {
            setModalForm(p=>({...p, fileName:file.name, fileData:ev.target.result, _fileObj:file, fileType:file.type}));
            setFraFileUploading(false);
          };
          reader.readAsDataURL(file);
        }}/>
        <button type="button" onClick={()=>fraFileRef.current&&fraFileRef.current.click()}
          style={{width:"100%",background:Z.overlay,border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"12px",color:Z.muted,cursor:"pointer",fontSize:13,fontFamily:font,fontWeight:600,textAlign:"center"}}>
          {fraFileUploading ? "Uploading..." : "Click to attach FRA document"}
        </button>
      </div>
    )}
  </>) : null;

  // ── SUMMARY FOR TOP OF PAGE (fireLogic.js — the dashboard card and bell use the same) ──
  const { expiredWardens, expiringWardens, lastDrill, daysSinceDrill, overdueExtinguishers, fraNext: fraNextDue } = sum;
  const fraStatus = fraNextDue ? expiryBadge(fraNextDue, 30) : null;
  const staffName = id => ((staff||[]).find(u=>String(u.id)===String(id))||{}).name || "";

  // ── WARDENS: the form saves the person's Fire Warden certificate record ──
  // w = an entry from sum.wardens (edit / link), or null (new)
  function openWarden(w) {
    const c = w && w.cert ? w.cert : null;
    setWForm({
      key: w ? w.key : null, legacyId: w && w.source==="record" ? w.record.id : null,
      // only a person who is in the list can be pre-chosen (never a leaver)
      staffId: w && w.staffId && (staff||[]).some(u=>String(u.id)===String(w.staffId)&&u.status!=="leaver") ? String(w.staffId) : "", zones: w ? [...w.zones] : [],
      issuedDate: w ? (w.issued||"") : "", renewal: 36, expiryDate: w ? (w.expiry||"") : "", expiryTouched: !!(c && c.expiryDate),
      file: null, fileName: c ? c.fileName||"" : "", fileUrl: c ? c.fileUrl||"" : "", zoneText: "", legacyName: w && w.source==="record" ? w.name : "",
    });
  }
  // the storage path of one of our certificate files (from its link), or null
  const filePath = url => { const m = String(url||"").match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/documents\/([^?#]+)/); try { return m ? m[1].split("/").map(decodeURIComponent).join("/") : null; } catch { return null; } };
  const removeFile = path => { if (path) sb.storage.remove("documents", [path]).catch(() => {}); };
  const fileIsFor = (url, staffId) => { const p = filePath(url); return !p || p.startsWith(`ext_certs/${staffId}_`); };
  const wSet = patch => setWForm(f => {
    const n = { ...f, ...patch };
    // a file stored under another person can't be opened by the new one: attach theirs instead
    if ("staffId" in patch && n.fileUrl && !fileIsFor(n.fileUrl, n.staffId)) { n.fileUrl = ""; n.fileName = ""; }
    if (!n.expiryTouched && ("issuedDate" in patch || "renewal" in patch)) n.expiryDate = n.issuedDate ? plusMonths(n.issuedDate, n.renewal) : "";
    return n;
  });
  const wardenZones = [...new Set([...(site.firstAidZones||[]), ...((wForm&&wForm.zones)||[])])];
  async function saveWarden() {
    const f = wForm;
    if (!f.staffId) { notify("Choose the staff member.", { kind:"error", timeout:4000 }); return; }
    if (!f.issuedDate) { notify("Add the date they qualified.", { kind:"error", timeout:4000 }); return; }
    if (!f.expiryDate) { notify("Add the expiry date.", { kind:"error", timeout:4000 }); return; }
    if (f.expiryDate <= f.issuedDate) { notify("The expiry date must be after the date they qualified.", { kind:"error", timeout:5000 }); return; }
    const existing = (extCerts[f.staffId]||{})[WARDEN_CERT] || null;
    // editing a warden and changing the person: the old person's record goes
    const oldStaff = f.key && f.key.startsWith("cert_") ? f.key.slice(5) : null;
    // saving onto someone who already has a warden certificate replaces it — say so first
    if (existing && oldStaff !== String(f.staffId) && !(await ask({ title:"Replace their Fire Warden certificate?", message:`${staffName(f.staffId)} already has a Fire Warden certificate (expires ${existing.expiryDate||"—"}). Saving replaces it with these details.`, ok:"Replace" }))) return;
    setWBusy(true);
    let fileName = f.fileName, fileUrl = f.fileUrl, newPath = null;
    if (f.file) {
      const safe = f.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `ext_certs/${f.staffId}_${WARDEN_CERT}_${Date.now()}_${safe}`;
      const { error } = await sb.storage.upload("documents", path, f.file);
      if (error) { setWBusy(false); notify(`The certificate file couldn't be uploaded: ${error}`, { kind:"error" }); return; }
      fileName = f.file.name; fileUrl = sb.storage.getPublicUrl("documents", path); newPath = path;
    }
    const rec = { ...(existing||{}), issuedDate: f.issuedDate, expiryDate: f.expiryDate, zones: f.zones, fileName: fileName||"", fileUrl: fileUrl||"",
      uploadedAt: f.file ? new Date().toLocaleDateString("en-GB") : (existing && existing.uploadedAt) || new Date().toLocaleDateString("en-GB") };
    const ok = await onSaveCert(f.staffId, WARDEN_CERT, rec);
    if (!ok) { removeFile(newPath); setWBusy(false); return; }   // onSaveCert has already said what went wrong
    setExtCerts(p => ({ ...p, [f.staffId]: { ...(p[f.staffId]||{}), [WARDEN_CERT]: rec } }));
    // the file this record replaced (a new upload over an old one) is no longer needed
    if (existing && existing.fileUrl && filePath(existing.fileUrl) !== filePath(fileUrl)) removeFile(filePath(existing.fileUrl));
    let warn = "";
    if (oldStaff && oldStaff !== String(f.staffId)) {
      const oldCert = (extCerts[oldStaff]||{})[WARDEN_CERT];
      if (await onDeleteCert(oldStaff, WARDEN_CERT)) {
        setExtCerts(p => { const n = { ...p }; if (n[oldStaff]) { n[oldStaff] = { ...n[oldStaff] }; delete n[oldStaff][WARDEN_CERT]; } return n; });
        if (oldCert && oldCert.fileUrl && filePath(oldCert.fileUrl) !== filePath(fileUrl)) removeFile(filePath(oldCert.fileUrl));
      } else warn = ` ${staffName(oldStaff)}'s old Fire Warden record couldn't be removed: remove it from the list.`;
    }
    if (f.legacyId) setFireSafety(prev => ({ ...prev, wardens: (prev.wardens||[]).filter(x=>x.id!==f.legacyId) }));
    auditEvent("fire_warden", f.staffId, f.key ? "update" : "create", `${f.key ? "Fire warden updated" : "Fire warden added"}: ${staffName(f.staffId)} (expires ${f.expiryDate})`, { zones: f.zones.join(", "), file: fileName||"" }, staffName(f.staffId));
    setWBusy(false); setWForm(null);
    notify((f.legacyId ? `${staffName(f.staffId)} is now linked to their staff record.` : "Fire warden saved.") + warn, warn ? { kind:"error" } : {});
  }
  async function removeWarden(w) {
    if (w.source==="record") {
      const row = w.record;
      setFireSafety(prev => ({ ...prev, wardens: (prev.wardens||[]).filter(x=>x.id!==row.id) }));
      notify(`${w.name} removed from the wardens list.`, { undo: () => setFireSafety(prev => ({ ...prev, wardens: [...(prev.wardens||[]).filter(x=>x.id!==row.id), row] })) });
      return;
    }
    const ok = await ask({ title:`Remove ${w.name} as a fire warden?`, message:"This deletes their Fire Warden certificate record (the same one shown under Assign Training → External Certificates). Their training records are not affected.", ok:"Remove warden", danger:true });
    if (!ok) return;
    const saved = await onDeleteCert(w.staffId, WARDEN_CERT);
    if (saved === false) { notify("The warden couldn't be removed. Please try again.", { kind:"error" }); return; }
    setExtCerts(p => { const n = { ...p }; if (n[w.staffId]) { n[w.staffId] = { ...n[w.staffId] }; delete n[w.staffId][WARDEN_CERT]; } return n; });
    removeFile(filePath(w.fileUrl));
    auditEvent("fire_warden", w.staffId, "delete", `Fire warden removed: ${w.name}`, {}, w.name);
    notify(`${w.name} removed as a fire warden.`);
  }

  const summaryCards = [
    { icon:E("🧑‍🚒","👤"), label:"Wardens",      value:sum.wardens.length,   sub: expiredWardens.length>0?`${expiredWardens.length} expired`:sum.undatedWardens.length>0?`${sum.undatedWardens.length} with no expiry date`:`${expiringWardens.length} expiring`, alert:expiredWardens.length>0, warn:expiringWardens.length>0||sum.undatedWardens.length>0 },
    { icon:E("🚨","!"), label:"Last Drill",   value:lastDrill?lastDrill.date:"None recorded", sub: daysSinceDrill!==null?`${daysSinceDrill} days ago`:"", alert:daysSinceDrill!==null&&daysSinceDrill>365, warn:daysSinceDrill!==null&&daysSinceDrill>300 },
    { icon:E("🧯","Ex"), label:"Extinguishers",value:extinguishers.length, sub: overdueExtinguishers.length>0?`${overdueExtinguishers.length} service overdue`:"All services current", alert:overdueExtinguishers.length>0, warn:false },
    { icon:E("📋","Doc"), label:"FRA Next Review", value:fraNextDue||"Not set", sub:fraStatus?fraStatus.label:"", alert:fraStatus?.color==="#ef4444", warn:fraStatus?.color==="#f59e0b" },
  ];

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:20}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px",color:Z.white}}>{E("🔥 ","")}Fire Safety Register</h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>Manage fire wardens, drills, alarm tests, extinguishers, emergency lighting and FRA reviews</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {summaryCards.map((c,i)=>(
          <div key={i} style={{background:c.alert?"rgba(239,68,68,0.08)":c.warn?"rgba(245,158,11,0.08)":Z.overlay, border:`1px solid ${c.alert?"rgba(239,68,68,0.3)":c.warn?"rgba(245,158,11,0.3)":Z.borderMd}`, borderRadius:12, padding:"14px 16px"}}>
            <div style={{fontSize:22,marginBottom:4}}>{c.icon}</div>
            <div style={{fontSize:11,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:2}}>{c.label}</div>
            <div style={{fontSize:16,fontWeight:800,color:c.alert?"#f87171":c.warn?"#f59e0b":Z.white}}>{c.value}</div>
            {c.sub && <div style={{fontSize:11,color:c.alert?"#f87171":c.warn?"#f59e0b":Z.muted,marginTop:2}}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Sub-tab bar */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
        {SUB_TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{background:subTab===t.id?`linear-gradient(135deg,#ef4444,#dc2626)`:Z.overlay,border:`1px solid ${subTab===t.id?"#ef4444":Z.borderMd}`,borderRadius:10,padding:"8px 14px",color:subTab===t.id?"#fff":Z.muted,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:font,display:"flex",alignItems:"center",gap:6}}>
            {t.label}
            {t.count>0 && <span style={{background:"rgba(239,68,68,0.25)",color:"#f87171",borderRadius:6,padding:"1px 6px",fontSize:10,fontWeight:800}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── WARDENS ── */}
      {subTab==="wardens" && (
        <div data-testid="fire-wardens">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>Fire Wardens</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>Each warden is a member of staff with a current Fire Warden certificate. The certificate is the same one shown under Assign Training → External Certificates.</div>
            </div>
            <AddBtn label="Add Warden"/>
          </div>
          {sum.unlinkedWardens.length>0 && (
            <div role="status" style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:Z.white,lineHeight:1.5}}>
              {sum.unlinkedWardens.length} warden{sum.unlinkedWardens.length!==1?"s were":" was"} typed in before wardens were linked to staff. Click <b>Link to staff</b> on each to choose the person and attach their certificate.
            </div>
          )}
          {sum.wardens.length===0 && <div style={{color:Z.muted,fontSize:14,padding:"24px 0",textAlign:"center"}}>No fire wardens yet. Click <b>+ Add Warden</b>.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sum.wardens.map(w=>{
              const st = w.state;
              return (
                <div key={w.key} data-testid="warden-row" style={{background:Z.overlay,border:`1px solid ${st.key==="expired"?"rgba(239,68,68,0.35)":Z.borderMd}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(239,68,68,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{E("🧑‍🚒","W")}</div>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{fontWeight:700,fontSize:14,color:Z.white,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      {w.name}
                      {w.source==="record" && <span style={{fontSize:10,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,padding:"1px 7px"}}>Not linked to staff</span>}
                    </div>
                    <div style={{fontSize:12,color:Z.muted,marginTop:1}}>{[w.jobTitle, w.zones.length?w.zones.join(", "):"No areas set"].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div style={{textAlign:"center",minWidth:90}}>
                    <div style={{fontSize:11,color:Z.muted,fontWeight:600,marginBottom:2}}>QUALIFIED</div>
                    <div style={{fontSize:13,color:Z.white,fontWeight:700}}>{w.issued||"—"}</div>
                  </div>
                  <div style={{textAlign:"center",minWidth:90}}>
                    <div style={{fontSize:11,color:Z.muted,fontWeight:600,marginBottom:2}}>EXPIRES</div>
                    <div style={{fontSize:13,fontWeight:700,color:st.color}}>{w.expiry||"—"}</div>
                  </div>
                  <Badge label={st.label} color={st.color} bg={st.bg}/>
                  <div style={{display:"flex",gap:6,marginLeft:"auto",flexWrap:"wrap"}}>
                    {w.fileUrl
                      ? <button type="button" onClick={()=>{ if(!openFile(w.fileUrl)) notify("Your browser blocked the new tab. Allow pop-ups for this site.", { kind:"error" }); }} style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:8,padding:"5px 12px",color:"#10b981",cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:700}}>📄 Certificate</button>
                      : w.source==="cert" && <span style={{fontSize:11,color:"#f59e0b",alignSelf:"center"}}>No certificate file</span>}
                    <button type="button" onClick={()=>openWarden(w)} style={{background:w.source==="record"?"rgba(245,158,11,0.12)":Z.overlay,border:`1px solid ${w.source==="record"?"rgba(245,158,11,0.35)":Z.borderMd}`,borderRadius:8,padding:"5px 12px",color:w.source==="record"?"#f59e0b":Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:700}}>{w.source==="record"?"Link to staff":"Edit"}</button>
                    <button type="button" aria-label={`Remove ${w.name}`} onClick={()=>removeWarden(w)} style={{background:"none",border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 10px",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Remove</button>
                  </div>
                  {w.record && w.record.notes && <div style={{fontSize:12,color:Z.muted,width:"100%",marginTop:4,paddingTop:8,borderTop:`1px solid ${Z.border}`}}>{w.record.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DRILLS (drill log + Fire Drill inspections) ── */}
      {subTab==="drills" && (
        <div data-testid="fire-drills">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>Fire Drill Log</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>HSE recommends at least one full evacuation drill per year. Many insurers require two. Fire Drill checklists done under Inspections (or on a phone) are listed here too.</div>
            </div>
            <AddBtn label="Log Drill"/>
          </div>
          {daysSinceDrill!==null && daysSinceDrill>300 && (
            <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#f87171",fontWeight:600}}>
              ⚠️ Last drill was {daysSinceDrill} days ago — consider scheduling the next drill.
            </div>
          )}
          {sum.drills.length===0 && <div style={{color:Z.muted,fontSize:14,padding:"24px 0",textAlign:"center"}}>No drills recorded yet.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {sum.drills.map(row=>{
              const d = row.drill, ins = row.inspection;
              const pct = ins && ins.maxScore>0 ? Math.round(ins.overallScore/ins.maxScore*100) : null;
              const insLink = ins && (
                <button type="button" onClick={()=>onOpenInspection&&onOpenInspection(ins.id)} style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:"5px 12px",color:"#f59e0b",cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:700}}>
                  🔔 Checklist{pct!=null?` ${pct}%`:""} →
                </button>);
              if (!d) return (
                <div key={row.key} data-testid="drill-row" style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{fontSize:22}}>{E("🔔","")}</div>
                  <div style={{flex:1,minWidth:140}}>
                    <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{ins.date}</div>
                    <div style={{fontSize:12,color:Z.muted,marginTop:1}}>{[ins.location, ins.inspector && `Checked by ${ins.inspector}`, "Fire Drill checklist (Inspections)"].filter(Boolean).join(" · ")}</div>
                  </div>
                  {insLink}
                </div>);
              const hcOk = d.headcountOk===true||d.headcountOk==="true";
              return (
              <div key={row.key} data-testid="drill-row" style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:d.issues?10:0}}>
                  <div style={{fontSize:22}}>🚨</div>
                  <div style={{flex:1,minWidth:100}}>
                    <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{d.date}{d.time?` at ${d.time}`:""}</div>
                    <div style={{fontSize:12,color:Z.muted,marginTop:1}}>{[d.zone, d.conductedBy && `Conducted by ${d.conductedBy}`, d.weather].filter(Boolean).join(" · ")}</div>
                  </div>
                  {d.evacuTime && <div style={{textAlign:"center",padding:"6px 14px",background:"rgba(37,99,235,0.1)",borderRadius:8,border:"1px solid rgba(37,99,235,0.2)"}}>
                    <div style={{fontSize:10,color:Z.muted,fontWeight:600,marginBottom:1}}>EVAC TIME</div>
                    <div style={{fontSize:16,fontWeight:800,color:"#93c5fd"}}>{d.evacuTime}</div>
                  </div>}
                  <Badge label={hcOk?"✓ Headcount OK":"⚠ Headcount Issue"} color={hcOk?"#10b981":"#f59e0b"} bg={hcOk?"rgba(16,185,129,0.12)":"rgba(245,158,11,0.12)"}/>
                  <div style={{display:"flex",gap:6,marginLeft:"auto",flexWrap:"wrap"}}>
                    {insLink}
                    <button onClick={()=>openEdit(d)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 12px",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Edit</button>
                    <button aria-label="Remove drill" onClick={()=>deleteItem(d.id)} style={{background:"none",border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 10px",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Remove</button>
                  </div>
                </div>
                {d.issues && <div style={{fontSize:12,color:Z.muted,paddingTop:8,borderTop:`1px solid ${Z.border}`,lineHeight:1.5}}><span style={{fontWeight:600,color:Z.white}}>Notes: </span>{d.issues}</div>}
              </div>
            );})}
          </div>
        </div>
      )}

      {/* ── ALARM TESTS ── */}
      {subTab==="alarm" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>Fire Alarm Test Log</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>Weekly call-point tests are a legal requirement under BS 5839. Rotate through all call points.</div>
            </div>
            <AddBtn label="Log Test"/>
          </div>
          {alarmTests.length===0 && <div style={{color:Z.muted,fontSize:14,padding:"24px 0",textAlign:"center"}}>No alarm tests recorded yet.</div>}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:Z.overlay}}>
                  {["Date","Call Point","Tested By","Result","Notes",""].map((h,i)=>(
                    <th key={i} style={{padding:"9px 12px",textAlign:"left",color:Z.muted,fontWeight:700,fontSize:11,letterSpacing:.8,textTransform:"uppercase",borderBottom:`1px solid ${Z.border}`,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alarmTests.slice().sort((a,b)=>b.date.localeCompare(a.date)).map((t,i)=>(
                  <tr key={t.id} style={{borderBottom:`1px solid ${Z.border}`,background:i%2===0?"transparent":Z.overlay}}>
                    <td style={{padding:"9px 12px",color:Z.white,fontWeight:600,whiteSpace:"nowrap"}}>{t.date}</td>
                    <td style={{padding:"9px 12px",color:Z.white}}>{t.callPoint}</td>
                    <td style={{padding:"9px 12px",color:Z.muted}}>{t.testedBy}</td>
                    <td style={{padding:"9px 12px"}}>
                      <Badge label={t.result==="pass"?"✓ Pass":"⚠ Fault"} color={t.result==="pass"?"#10b981":"#ef4444"} bg={t.result==="pass"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.15)"}/>
                    </td>
                    <td style={{padding:"9px 12px",color:Z.muted,fontSize:12,maxWidth:220}}>{t.notes||"—"}</td>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{display:"flex",gap:5}}>
                        <button onClick={()=>openEdit(t)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:7,padding:"4px 10px",color:Z.muted,cursor:"pointer",fontSize:11,fontFamily:font,fontWeight:600}}>Edit</button>
                        <button aria-label="Remove" onClick={()=>deleteItem(t.id)} style={{background:"none",border:`1px solid ${Z.borderMd}`,borderRadius:7,padding:"4px 10px",color:Z.muted,cursor:"pointer",fontSize:11,fontFamily:font,fontWeight:600}}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EXTINGUISHERS ── */}
      {subTab==="extinguishers" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>Extinguisher Inspection Log</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>Annual service by competent person required. Monthly visual checks by a responsible person. This is the one list of extinguishers: the Equipment Register links here, and keeps the other fire equipment (alarm panel, hose reels).</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{ setShowExtCsvImport(true); setExtCsvPreview([]); setExtCsvError(""); }}
                style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 16px",color:Z.muted,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font,display:"flex",alignItems:"center",gap:6}}>
                📥 Import CSV
              </button>
              <button onClick={()=>{
                const csv = "location,type,serialNo,lastService,nextServiceDue,lastVisualDate,visualOk,notes\nWarehouse — Bay 1,CO2,CO2-001,2025-11-10,2026-11-10,2026-06-01,true,\nOffice Block A — Corridor,Powder,PD-001,2025-11-10,2026-11-10,2026-06-01,true,Check pin condition monthly";
                const blob = new Blob([csv], {type:"text/csv"});
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "extinguisher_import_template.csv"; a.click();
              }} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 16px",color:Z.muted,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font,display:"flex",alignItems:"center",gap:6}}>
                📄 Template
              </button>
              <AddBtn label="Add Extinguisher"/>
            </div>
          </div>

          {/* CSV Import Panel */}
          {showExtCsvImport && (
            <div style={{background:"rgba(37,99,235,0.06)",border:`1px solid rgba(37,99,235,0.25)`,borderRadius:12,padding:"18px 20px",marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:14,color:Z.white}}>Import Extinguishers from CSV</div>
                <button onClick={()=>{setShowExtCsvImport(false);setExtCsvPreview([]);setExtCsvError("");}} style={{background:"none",border:"none",color:Z.muted,fontSize:18,cursor:"pointer",fontFamily:font}}>✕</button>
              </div>
              <div style={{fontSize:12,color:Z.muted,marginBottom:12,lineHeight:1.6}}>
                CSV must include these columns (in any order):<br/>
                <code style={{background:Z.overlay,borderRadius:6,padding:"2px 7px",fontSize:11,color:"#93c5fd"}}>location, type, serialNo, lastService, nextServiceDue, lastVisualDate, visualOk, notes</code><br/>
                <span style={{marginTop:4,display:"block"}}>Dates must be <strong style={{color:Z.white}}>YYYY-MM-DD</strong>. Valid types: CO2, Powder, Water, Foam, Wet Chemical, Halon (decommission). visualOk: true or false.</span>
              </div>
              <input ref={extCsvRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>{
                const file = e.target.files[0];
                if(!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  const text = ev.target.result;
                  const lines = text.split(/\r?\n/).filter(l=>l.trim());
                  if(lines.length < 2) { setExtCsvError("File appears empty or has no data rows."); return; }
                  const headers = lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/\s+/g,""));
                  const required = ["location","type","serialno","lastservice","nextservicedue"];
                  const missing = required.filter(r=>!headers.includes(r));
                  if(missing.length) { setExtCsvError(`Missing required columns: ${missing.join(", ")}`); return; }
                  const VALID_TYPES = ["co2","powder","water","foam","wet chemical","halon (decommission)"];
                  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
                  const rows = [];
                  const errors = [];
                  lines.slice(1).forEach((line, i) => {
                    if(!line.trim()) return;
                    // Handle quoted fields with commas
                    const cols = [];
                    let cur = "", inQ = false;
                    for(const ch of line) {
                      if(ch==='"') inQ=!inQ;
                      else if(ch===','&&!inQ) { cols.push(cur.trim()); cur=""; }
                      else cur+=ch;
                    }
                    cols.push(cur.trim());
                    const get = (key) => { const idx=headers.indexOf(key); return idx>=0?(cols[idx]||"").trim():""; };
                    const rowNum = i+2;
                    const rowErrors = [];
                    const location = get("location");
                    const type = get("type");
                    const serialNo = get("serialno");
                    const lastService = get("lastservice");
                    const nextServiceDue = get("nextservicedue");
                    const lastVisualDate = get("lastvisualdate");
                    const visualOkRaw = get("visualok");
                    const notes = get("notes");
                    if(!location) rowErrors.push("location is required");
                    if(!type) rowErrors.push("type is required");
                    else if(!VALID_TYPES.includes(type.toLowerCase())) rowErrors.push(`unknown type "${type}"`);
                    if(!serialNo) rowErrors.push("serialNo is required");
                    if(lastService && !DATE_RE.test(lastService)) rowErrors.push(`lastService "${lastService}" is not YYYY-MM-DD`);
                    if(nextServiceDue && !DATE_RE.test(nextServiceDue)) rowErrors.push(`nextServiceDue "${nextServiceDue}" is not YYYY-MM-DD`);
                    if(lastVisualDate && !DATE_RE.test(lastVisualDate)) rowErrors.push(`lastVisualDate "${lastVisualDate}" is not YYYY-MM-DD`);
                    // Normalise type capitalisation
                    const TYPE_MAP = {"co2":"CO2","powder":"Powder","water":"Water","foam":"Foam","wet chemical":"Wet Chemical","halon (decommission)":"Halon (decommission)"};
                    const normType = TYPE_MAP[type.toLowerCase()]||type;
                    const visualOk = visualOkRaw.toLowerCase()==="false" ? false : true;
                    if(rowErrors.length) errors.push(`Row ${rowNum}: ${rowErrors.join("; ")}`);
                    rows.push({ _rowNum:rowNum, _errors:rowErrors, location, type:normType, serialNo, lastService, nextServiceDue, lastVisualDate, visualOk, notes });
                  });
                  setExtCsvError(errors.length ? errors.join("\n") : "");
                  setExtCsvPreview(rows);
                };
                reader.readAsText(file);
                e.target.value="";
              }}/>
              {extCsvPreview.length===0 ? (
                <button onClick={()=>extCsvRef.current&&extCsvRef.current.click()}
                  style={{width:"100%",background:Z.overlay,border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"16px",color:Z.muted,cursor:"pointer",fontSize:13,fontFamily:font,fontWeight:600,textAlign:"center"}}>
                  Click to choose CSV file
                </button>
              ) : (
                <div>
                  {extCsvError && (
                    <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#f87171",whiteSpace:"pre-line",fontFamily:"monospace"}}>
                      ⚠ {extCsvError}
                    </div>
                  )}
                  <div style={{fontSize:12,fontWeight:700,color:Z.white,marginBottom:8}}>
                    Preview — {extCsvPreview.filter(r=>!r._errors.length).length} valid row{extCsvPreview.filter(r=>!r._errors.length).length!==1?"s":""} of {extCsvPreview.length} total
                  </div>
                  <div style={{overflowX:"auto",marginBottom:14,maxHeight:280,overflowY:"auto",borderRadius:8,border:`1px solid ${Z.border}`}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:700}}>
                      <thead>
                        <tr style={{background:Z.overlay,position:"sticky",top:0}}>
                          {["","Location","Type","S/N","Last Service","Next Due","Visual Date","OK?","Notes"].map((h,i)=>(
                            <th key={i} style={{padding:"7px 10px",textAlign:"left",color:Z.muted,fontWeight:700,fontSize:10,letterSpacing:.7,textTransform:"uppercase",borderBottom:`1px solid ${Z.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {extCsvPreview.map((r,i)=>{
                          const hasErr = r._errors.length > 0;
                          const TYPE_COLORS = {"CO2":"#3b82f6","Powder":"#f59e0b","Water":"#06b6d4","Foam":"#10b981","Wet Chemical":"#8b5cf6","Halon (decommission)":"#ef4444"};
                          const tc = TYPE_COLORS[r.type]||"#6b7280";
                          return (
                            <tr key={i} style={{borderBottom:`1px solid ${Z.border}`,background:hasErr?"rgba(239,68,68,0.06)":i%2===0?"transparent":Z.overlay}}>
                              <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>
                                {hasErr ? <span style={{color:"#f87171",fontSize:14}}>✕</span> : <span style={{color:"#10b981",fontSize:14}}>✓</span>}
                              </td>
                              <td style={{padding:"7px 10px",color:hasErr?Z.muted:Z.white,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.location||"—"}</td>
                              <td style={{padding:"7px 10px"}}>
                                {r.type && <span style={{color:tc,fontWeight:700,background:`${tc}18`,border:`1px solid ${tc}33`,borderRadius:5,padding:"1px 7px",fontSize:11}}>{r.type}</span>}
                              </td>
                              <td style={{padding:"7px 10px",color:Z.muted,fontFamily:"monospace"}}>{r.serialNo||"—"}</td>
                              <td style={{padding:"7px 10px",color:Z.white,whiteSpace:"nowrap"}}>{r.lastService||"—"}</td>
                              <td style={{padding:"7px 10px",color:Z.white,whiteSpace:"nowrap"}}>{r.nextServiceDue||"—"}</td>
                              <td style={{padding:"7px 10px",color:Z.muted,whiteSpace:"nowrap"}}>{r.lastVisualDate||"—"}</td>
                              <td style={{padding:"7px 10px"}}>
                                <Badge label={r.visualOk!==false?"Pass":"Issue"} color={r.visualOk!==false?"#10b981":"#f59e0b"} bg={r.visualOk!==false?"rgba(16,185,129,0.12)":"rgba(245,158,11,0.12)"}/>
                              </td>
                              <td style={{padding:"7px 10px",color:Z.muted,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.notes||"—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button
                      disabled={extCsvPreview.filter(r=>!r._errors.length).length===0}
                      onClick={()=>{
                        const valid = extCsvPreview.filter(r=>!r._errors.length);
                        const newItems = valid.map(r=>({ id:Math.random().toString(36).slice(2,9), location:r.location, type:r.type, serialNo:r.serialNo, lastService:r.lastService, nextServiceDue:r.nextServiceDue, lastVisualDate:r.lastVisualDate, visualOk:r.visualOk, notes:r.notes }));
                        setFireSafety(prev=>({...prev, extinguishers:[...(prev.extinguishers||[]), ...newItems]}));
                        setShowExtCsvImport(false); setExtCsvPreview([]); setExtCsvError("");
                      }}
                      style={{background:`linear-gradient(135deg,#ef4444,#dc2626)`,border:"none",borderRadius:10,padding:"10px 22px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:font,opacity:extCsvPreview.filter(r=>!r._errors.length).length===0?0.4:1}}>
                      Import {extCsvPreview.filter(r=>!r._errors.length).length} Extinguisher{extCsvPreview.filter(r=>!r._errors.length).length!==1?"s":""}
                    </button>
                    <button onClick={()=>extCsvRef.current&&extCsvRef.current.click()} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"10px 16px",color:Z.muted,cursor:"pointer",fontSize:13,fontFamily:font,fontWeight:600}}>
                      Choose different file
                    </button>
                    {extCsvPreview.some(r=>r._errors.length>0) && (
                      <span style={{fontSize:12,color:"#f87171",marginLeft:4}}>{extCsvPreview.filter(r=>r._errors.length>0).length} row{extCsvPreview.filter(r=>r._errors.length>0).length!==1?"s":""} with errors will be skipped</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {extinguishers.length===0 && !showExtCsvImport && <div style={{color:Z.muted,fontSize:14,padding:"24px 0",textAlign:"center"}}>No extinguishers recorded yet. Add one manually or import from CSV.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {extinguishers.map(e=>{
              const svcBadge = expiryBadge(e.nextServiceDue);
              const TYPE_COLORS = {"CO2":"#3b82f6","Powder":"#f59e0b","Water":"#06b6d4","Foam":"#10b981","Wet Chemical":"#8b5cf6","Halon (decommission)":"#ef4444"};
              const tc = TYPE_COLORS[e.type]||"#6b7280";
              return (
                <div key={e.id} style={{background:Z.overlay,border:`1px solid ${svcBadge?.color==="#ef4444"?"rgba(239,68,68,0.35)":svcBadge?.color==="#f59e0b"?"rgba(245,158,11,0.25)":Z.borderMd}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:`${tc}20`,border:`2px solid ${tc}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🧯</div>
                    <div style={{flex:1,minWidth:120}}>
                      <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{e.location}</div>
                      <div style={{fontSize:12,marginTop:1}}>
                        <span style={{color:tc,fontWeight:700,background:`${tc}18`,border:`1px solid ${tc}33`,borderRadius:6,padding:"1px 8px",fontSize:11}}>{e.type}</span>
                        <span style={{color:Z.muted,marginLeft:8}}>S/N: {e.serialNo}</span>
                      </div>
                    </div>
                    <div style={{textAlign:"center",minWidth:80}}>
                      <div style={{fontSize:10,color:Z.muted,fontWeight:600,marginBottom:2}}>LAST SERVICE</div>
                      <div style={{fontSize:12,color:Z.white,fontWeight:700}}>{e.lastService||"—"}</div>
                    </div>
                    <div style={{textAlign:"center",minWidth:80}}>
                      <div style={{fontSize:10,color:Z.muted,fontWeight:600,marginBottom:2}}>NEXT DUE</div>
                      <div style={{fontSize:12,fontWeight:700,color:svcBadge?.color||Z.white}}>{e.nextServiceDue||"—"}</div>
                    </div>
                    {svcBadge && <Badge label={svcBadge.label} color={svcBadge.color} bg={svcBadge.bg}/>}
                    <div style={{textAlign:"center",minWidth:80}}>
                      <div style={{fontSize:10,color:Z.muted,fontWeight:600,marginBottom:2}}>VISUAL CHECK</div>
                      <div style={{fontSize:12,fontWeight:700,color:Z.white}}>{e.lastVisualDate||"—"}</div>
                      {!(e.visualOk===true||e.visualOk==="true") && e.lastVisualDate && <Badge label="Issue noted" color="#f59e0b" bg="rgba(245,158,11,0.12)"/>}
                    </div>
                    <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
                      <button onClick={()=>openEdit(e)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 12px",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Edit</button>
                      <button aria-label="Remove extinguisher" onClick={()=>deleteItem(e.id)} style={{background:"none",border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 10px",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Remove</button>
                    </div>
                  </div>
                  {e.notes && <div style={{fontSize:12,color:Z.muted,paddingTop:8,marginTop:8,borderTop:`1px solid ${Z.border}`}}>{e.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── EMERGENCY LIGHTING ── */}
      {subTab==="lighting" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>Emergency Lighting Test Log</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>Monthly functional (flick) tests and annual 3-hour full discharge test required under BS 5266.</div>
            </div>
            <AddBtn label="Log Test"/>
          </div>
          {emergLighting.length===0 && <div style={{color:Z.muted,fontSize:14,padding:"24px 0",textAlign:"center"}}>No lighting tests recorded yet.</div>}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:Z.overlay}}>
                  {["Date","Type","Zone / Area","Tested By","Result","Notes",""].map((h,i)=>(
                    <th key={i} style={{padding:"9px 12px",textAlign:"left",color:Z.muted,fontWeight:700,fontSize:11,letterSpacing:.8,textTransform:"uppercase",borderBottom:`1px solid ${Z.border}`,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emergLighting.slice().sort((a,b)=>b.date.localeCompare(a.date)).map((t,i)=>(
                  <tr key={t.id} style={{borderBottom:`1px solid ${Z.border}`,background:i%2===0?"transparent":Z.overlay}}>
                    <td style={{padding:"9px 12px",color:Z.white,fontWeight:600,whiteSpace:"nowrap"}}>{t.date}</td>
                    <td style={{padding:"9px 12px"}}>
                      <Badge label={t.testType==="annual"?"Annual 3hr":"Monthly"} color={t.testType==="annual"?"#8b5cf6":"#3b82f6"} bg={t.testType==="annual"?"rgba(139,92,246,0.12)":"rgba(59,130,246,0.12)"}/>
                    </td>
                    <td style={{padding:"9px 12px",color:Z.white}}>{t.zone}</td>
                    <td style={{padding:"9px 12px",color:Z.muted}}>{t.testedBy}</td>
                    <td style={{padding:"9px 12px"}}>
                      <Badge label={t.result==="pass"?"✓ Pass":"⚠ Fault"} color={t.result==="pass"?"#10b981":"#ef4444"} bg={t.result==="pass"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.15)"}/>
                    </td>
                    <td style={{padding:"9px 12px",color:Z.muted,fontSize:12,maxWidth:200}}>{t.notes||"—"}</td>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{display:"flex",gap:5}}>
                        <button onClick={()=>openEdit(t)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:7,padding:"4px 10px",color:Z.muted,cursor:"pointer",fontSize:11,fontFamily:font,fontWeight:600}}>Edit</button>
                        <button aria-label="Remove" onClick={()=>deleteItem(t.id)} style={{background:"none",border:`1px solid ${Z.borderMd}`,borderRadius:7,padding:"4px 10px",color:Z.muted,cursor:"pointer",fontSize:11,fontFamily:font,fontWeight:600}}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FRA REVIEWS ── */}
      {subTab==="fra" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:Z.white}}>Fire Risk Assessment Review Log</div>
              <div style={{fontSize:12,color:Z.muted,marginTop:2}}>Record internal reviews and upload external company FRA reports. The RRO requires review regularly and whenever conditions change.</div>
            </div>
            <AddBtn label="Log Review"/>
          </div>
          {fraNextDue && fraStatus && fraStatus.color!=="#10b981" && (
            <div style={{background:fraStatus.color==="#ef4444"?"rgba(239,68,68,0.08)":"rgba(245,158,11,0.08)",border:`1px solid ${fraStatus.color==="#ef4444"?"rgba(239,68,68,0.25)":"rgba(245,158,11,0.25)"}`,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:fraStatus.color==="#ef4444"?"#f87171":"#f59e0b",fontWeight:600}}>
              {fraStatus.color==="#ef4444"?E("⚠️ ","")+"FRA review is overdue":E("⏰ ","")+"FRA review due soon"} — next review was due {fraNextDue}
            </div>
          )}
          {sum.fras.length===0 && <div style={{color:Z.muted,fontSize:14,padding:"24px 0",textAlign:"center"}}>No FRA reviews recorded yet.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {sum.fras.map(row=>{
              const r = row.review, ins = row.inspection;
              const pct = ins && ins.maxScore>0 ? Math.round(ins.overallScore/ins.maxScore*100) : null;
              const insLink = ins && (
                <button type="button" onClick={()=>onOpenInspection&&onOpenInspection(ins.id)} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"5px 12px",color:"#f87171",cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:700}}>
                  {E("🔥 ","")}FRA checklist{pct!=null?` ${pct}%`:""} →
                </button>);
              const due = row.nextDue && (()=>{ const b = expiryBadge(row.nextDue, 30); return (
                <div style={{textAlign:"right",minWidth:110}}>
                  <div style={{fontSize:10,color:Z.muted,fontWeight:600,marginBottom:3}}>NEXT REVIEW DUE</div>
                  <Badge label={row.nextDue} color={b?.color||Z.white} bg={b?.bg||"transparent"}/>
                </div>); })();
              if (!r) return (
                <div key={row.key} data-testid="fra-row" style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:12,padding:"16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(239,68,68,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{E("🔥","")}</div>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{ins.date}{ins.inspector?` — ${ins.inspector}`:""}</div>
                    <div style={{fontSize:12,color:Z.muted,marginTop:2}}>{[ins.location, "Fire Risk Assessment checklist (Inspections)"].filter(Boolean).join(" · ")}</div>
                  </div>
                  {due}
                  {insLink}
                </div>);
              return (
              <div key={row.key} data-testid="fra-row" style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:12,padding:"16px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:r.reviewType==="external"?"rgba(139,92,246,0.15)":"rgba(239,68,68,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{r.reviewType==="external"?"🏢":"📋"}</div>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:2}}>
                      <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{r.date}{r.reviewedBy?` — ${r.reviewedBy}`:""}</div>
                      {r.reviewType==="external" && <span style={{fontSize:11,fontWeight:700,color:"#a78bfa",background:"rgba(139,92,246,0.15)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:6,padding:"1px 8px"}}>External</span>}
                    </div>
                    {r.reviewType==="external" && r.externalCompany && (
                      <div style={{fontSize:12,color:"#a78bfa",fontWeight:600,marginBottom:2}}>
                        {r.externalCompany}{r.assessorQual ? ` — ${r.assessorQual}` : ""}{r.reportRef ? ` · Ref: ${r.reportRef}` : ""}
                      </div>
                    )}
                    {r.trigger && <div style={{fontSize:12,color:Z.muted,marginBottom:6}}><span style={{fontWeight:600,color:"#93c5fd"}}>Trigger: </span>{r.trigger}</div>}
                    {r.changes && <div style={{fontSize:13,color:Z.white,lineHeight:1.5}}>{r.changes}</div>}
                    {r.fileName && (r.fileUrl || r.fileData) && (
                      <div style={{marginTop:10}}>
                        <a href={r.fileUrl || r.fileData} target="_blank" rel="noreferrer"
                          style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:8,padding:"6px 12px",color:"#10b981",fontSize:12,fontWeight:700,textDecoration:"none",fontFamily:font}}>
                          📄 {r.fileName}
                        </a>
                      </div>
                    )}
                  </div>
                  {due}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {insLink}
                    <button onClick={()=>openEdit(r)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 12px",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Edit</button>
                    <button aria-label="Remove review" onClick={()=>deleteItem(r.id)} style={{background:"none",border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 10px",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:600}}>Remove</button>
                  </div>
                </div>
              </div>
            );})}
          </div>
        </div>
      )}

      {/* ── WARDEN FORM ── */}
      {wForm && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div role="dialog" aria-modal="true" aria-label="Fire warden" data-testid="warden-form" tabIndex={-1}
            ref={el=>{ if (el && !el.dataset.focused) { el.dataset.focused = "1"; el.focus(); } }}
            onKeyDown={e=>{ if (e.key==="Escape" && !wBusy) setWForm(null); }} style={{outline:"none",background:`linear-gradient(135deg,${Z.navyDk||"#060d2e"},${Z.navyMd||"#0d1f5c"})`,border:`1px solid ${Z.borderMd}`,borderRadius:16,padding:28,width:"100%",maxWidth:560,maxHeight:"88vh",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <h3 style={{margin:0,fontSize:17,fontWeight:800,color:Z.white}}>{wForm.legacyId?"Link warden to staff":wForm.key?"Edit fire warden":"Add fire warden"}</h3>
              <button type="button" aria-label="Close" onClick={()=>setWForm(null)} style={{background:"none",border:"none",color:Z.muted,fontSize:20,cursor:"pointer",fontFamily:font,lineHeight:1}}>✕</button>
            </div>
            {wForm.legacyId && <div style={{fontSize:12.5,color:Z.muted,lineHeight:1.5,marginBottom:4}}>Typed in as <b style={{color:Z.white}}>{wForm.legacyName}</b>. Choose the staff member and save: the old entry is replaced by their Fire Warden certificate record.</div>}
            {label("Staff member *")}
            <select aria-label="Staff member" value={wForm.staffId} onChange={e=>wSet({staffId:e.target.value})} style={{...inp,marginBottom:0}}>
              <option value="">Choose…</option>
              {(staff||[]).filter(u=>u.status!=="leaver").sort((a,b)=>a.name.localeCompare(b.name)).map(u=><option key={u.id} value={String(u.id)}>{u.name}{u.jobTitle?` — ${u.jobTitle}`:""}</option>)}
            </select>
            {label("Areas they cover")}
            {wardenZones.length ? (
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {wardenZones.map(z=>{ const on = wForm.zones.includes(z); return (
                  <button key={z} type="button" aria-pressed={on} onClick={()=>wSet({zones:on?wForm.zones.filter(x=>x!==z):[...wForm.zones,z]})}
                    style={{padding:"5px 11px",borderRadius:8,border:`1px solid ${on?"#ef4444":Z.borderMd}`,background:on?"rgba(239,68,68,0.12)":Z.overlay,color:on?"#fca5a5":Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:on?700:500}}>
                    {on?"✓ ":""}{z}
                  </button>); })}
              </div>
            ) : <div style={{fontSize:12,color:Z.muted}}>No areas set up yet: add them in Documents ▼ → Site Settings (first aid zones). You can type one below.</div>}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input aria-label="Add another area" value={wForm.zoneText} onChange={e=>wSet({zoneText:e.target.value})} placeholder="Another area…" style={{...inp,marginBottom:0,flex:1}}
                onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); const v=wForm.zoneText.trim(); if(v&&!wForm.zones.includes(v)) wSet({zones:[...wForm.zones,v],zoneText:""}); } }}/>
              <button type="button" onClick={()=>{ const v=wForm.zoneText.trim(); if(v&&!wForm.zones.includes(v)) wSet({zones:[...wForm.zones,v],zoneText:""}); }} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"8px 14px",color:Z.white,cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12}}>+ Add</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>{label("Qualified on *")}<input aria-label="Qualified on" type="date" value={wForm.issuedDate} onChange={e=>wSet({issuedDate:e.target.value})} style={{...inp,marginBottom:0}}/></div>
              <div>{label("Renewal")}
                <select aria-label="Renewal" value={wForm.renewal} onChange={e=>wSet({renewal:Number(e.target.value),expiryTouched:false})} style={{...inp,marginBottom:0}}>
                  <option value={12}>12 months</option><option value={24}>24 months</option><option value={36}>36 months (usual)</option>
                </select></div>
            </div>
            {label("Expires *")}
            <input aria-label="Expires" type="date" value={wForm.expiryDate} onChange={e=>setWForm(f=>({...f,expiryDate:e.target.value,expiryTouched:true}))} style={{...inp,marginBottom:0}}/>
            <div style={{fontSize:11.5,color:Z.muted,marginTop:4}}>Worked out from the qualified date and renewal. Change it if the certificate shows a different date.</div>
            {label("Certificate")}
            <input ref={wFileRef} type="file" accept={MACHINE_EVIDENCE_ACCEPT} style={{display:"none"}} data-testid="warden-file" onChange={e=>{
              const f = e.target.files && e.target.files[0]; e.target.value = "";
              if (!f) return; const bad = checkMachineFiles([f]); if (bad) { notify(bad, { kind:"error" }); return; }
              setWForm(w=>({...w,file:f}));
            }}/>
            {wForm.file || wForm.fileName ? (
              <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:10,padding:"10px 14px"}}>
                <span style={{fontSize:16}}>📄</span>
                <div style={{flex:1,minWidth:0,fontSize:13,fontWeight:700,color:"#10b981",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wForm.file ? wForm.file.name : wForm.fileName}{wForm.file?" (new)":""}</div>
                <button type="button" onClick={()=>wFileRef.current&&wFileRef.current.click()} style={{background:"none",border:"none",color:Z.muted,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:700}}>Replace</button>
              </div>
            ) : (
              <button type="button" onClick={()=>wFileRef.current&&wFileRef.current.click()} style={{width:"100%",background:Z.overlay,border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"12px",color:Z.muted,cursor:"pointer",fontSize:13,fontFamily:font,fontWeight:600}}>Attach the certificate (PDF or photo)</button>
            )}
            <div style={{display:"flex",gap:10,marginTop:22}}>
              <button type="button" data-testid="warden-save" onClick={saveWarden} disabled={wBusy} style={{flex:1,background:`linear-gradient(135deg,#ef4444,#dc2626)`,border:"none",borderRadius:10,padding:"11px",color:"#fff",fontWeight:700,fontSize:14,cursor:wBusy?"default":"pointer",fontFamily:font,opacity:wBusy?.6:1}}>
                {wBusy?"Saving…":wForm.legacyId?"Link and save":"Save warden"}
              </button>
              <button type="button" onClick={()=>setWForm(null)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 20px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:600}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:`linear-gradient(135deg,${Z.navyDk||"#060d2e"},${Z.navyMd||"#0d1f5c"})`,border:`1px solid ${Z.borderMd}`,borderRadius:16,padding:28,width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <h3 style={{margin:0,fontSize:17,fontWeight:800,color:Z.white}}>{editId?"Edit":"Add"} {SUB_TABS.find(t=>t.id===subTab)?.label?.replace(/^[^ ]+ /,"")}</h3>
              <button onClick={()=>setShowModal(false)} style={{background:"none",border:"none",color:Z.muted,fontSize:20,cursor:"pointer",fontFamily:font,lineHeight:1}}>✕</button>
            </div>
            {formContent}
            <datalist id="fs-staff">{(staff||[]).filter(u=>u.status!=="leaver").map(u=><option key={u.id} value={u.name}/>)}</datalist>
            <div style={{display:"flex",gap:10,marginTop:22}}>
              <button onClick={saveModal} style={{flex:1,background:`linear-gradient(135deg,#ef4444,#dc2626)`,border:"none",borderRadius:10,padding:"11px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:font}}>
                {editId?"Save Changes":"Add Record"}
              </button>
              <button onClick={()=>setShowModal(false)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"11px 20px",color:Z.muted,cursor:"pointer",fontFamily:font,fontWeight:600}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export { FireSafetyTab };
