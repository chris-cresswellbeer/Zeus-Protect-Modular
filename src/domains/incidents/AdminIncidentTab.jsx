import React, { useState } from "react";
import { useWindowWidth } from "../../shared/hooks";
import { Pill, Avatar } from "../../shared/primitives";
import { HelpTip } from "../../shared/HelpTip";
import { IncidentForm } from "./IncidentForm";
import { incToForm } from "./incToForm";
import { formToInc } from "./formToInc";
import { IncidentChart } from "./IncidentChart";
import { IncidentTracker } from "./IncidentTracker";
import { INCIDENT_TYPES, ACCIDENT_CODES, NUMBER_CODES } from "../../data/seedIncidents";

function AdminIncidentTab({ incidents, setIncidents, staff, investigations, setInvestigations, onOpenInvestigation, equipment, setEquipment, focusIncidentId, setFocusIncidentId, showAdminReportForm, setShowAdminReportForm, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [filterType, setFilterType]     = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRiddor, setFilterRiddor] = useState(false);
  const [search, setSearch]             = useState("");
  const [expandedId, setExpandedId] = useState(focusIncidentId||null);
  // Handle focus from dashboard — runs on mount AND on prop change
  React.useEffect(()=>{
    const fid = focusIncidentId;
    if(!fid) return;
    setFilterType("all");
    setFilterStatus("all");
    setSearch("");
    setExpandedId(fid);
    setFocusIncidentId&&setFocusIncidentId(null);
    // Try scrolling multiple times to handle render delay
    [200,500,900].forEach(delay=>setTimeout(()=>{
      const el=document.getElementById(`incident-${fid}`);
      if(el) el.scrollIntoView({behavior:"smooth",block:"center"});
    },delay));
  },[focusIncidentId]);
  const [editingId, setEditingId]       = useState(null);
  const [editForm, setEditForm]         = useState(null);
  const [editErr, setEditErr]           = useState("");
  const [editSaved, setEditSaved]       = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showAccidentBook, setShowAccidentBook] = useState(false);
  const [abDateFrom, setAbDateFrom] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear()-1); return d.toISOString().slice(0,10); });
  const [abDateTo, setAbDateTo] = useState(new Date().toISOString().slice(0,10));
  const showReportForm = showAdminReportForm;
  const setShowReportForm = setShowAdminReportForm;

  function deleteIncident(id) {
    setIncidents(p=>p.filter(i=>i.id!==id));
    setConfirmDeleteId(null);
    setExpandedId(null);
  }

  function toggleClose(id) {
    setIncidents(p=>p.map(i=>i.id===id?{...i,closed:!i.closed}:i));
  }

  function openEdit(inc) {
    setEditForm(incToForm(inc, equipment||[]));
    setEditingId(inc.id);
    setEditErr(""); setEditSaved(false);
    setExpandedId(null);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function cancelEdit() { setEditingId(null); setEditForm(null); setEditErr(""); setEditSaved(false); }

  function setEF(k,v){ setEditForm(p=>({...p,[k]:v})); setEditErr(""); setEditSaved(false); }

  function applyEquipmentSideEffects(f) {
    if (!f.equipmentInvolved || !f.equipmentId) return;
    const today = new Date().toISOString().slice(0,10);
    setEquipment(prev => prev.map(eq => {
      if (eq.id !== f.equipmentId) return eq;
      let updated = {...eq};
      if (f.equipmentOOS) updated.status = "inactive";
      if (f.equipmentDamaged && f.equipmentDamageDesc.trim()) {
        const defect = {
          id: "d"+Date.now(), date: today,
          reportedBy: "Incident Report",
          description: `[Incident report] ${f.equipmentDamageDesc.trim()}`,
          severity: f.equipmentDamageSeverity||"medium",
          status: "open", resolution: "",
          incidentLinked: true,
        };
        updated.defects = [...(eq.defects||[]), defect];
      }
      return updated;
    }));
  }

  function saveEdit() {
    if (!editForm.location.trim()) { setEditErr("Location is required."); return; }
    if (!editForm.description.trim()) { setEditErr("Description is required."); return; }
    if (!editForm.accidentCode) { setEditErr("Please select an Accident Code."); return; }
    if (!editForm.numberCode) { setEditErr("Please select a Number Code."); return; }
    setIncidents(p=>p.map(i=>i.id===editingId ? formToInc(editForm, i) : i));
    applyEquipmentSideEffects(editForm);
    setEditSaved(true);
    setTimeout(()=>{ setEditingId(null); setEditForm(null); setEditSaved(false); }, 1200);
  }

  function exportIncidentReport() {
    const today = new Date().toISOString().slice(0,10);

    // Load SheetJS dynamically then generate workbook
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => {
      const XLSX = window.XLSX;
      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Incident Log ──
      const headers = [
        "Incident ID","Date","Time","Type","Location","Description",
        "Injury Type","RIDDOR","Reported to HSE","HSE Report Date","HSE Reference","Reported By","Accident Code","Number Code","Status",
        "Reported By",
        "Equipment Involved","Equipment Asset No","Equipment Name","Equipment Damaged","Damage Description","Damage Severity","Taken Out of Service",
        "Person Involved","Date of Birth","Address","Postcode",
        "Witness 1 Name","Witness 1 Contact","Witness 2 Name","Witness 2 Contact",
        "First Aid Provided","First Aid Details","First Aid By",
        "Post-Incident Outcome","Immediate Measures","Corrective Actions","Corrective Actions By",
      ];

      const rows = [...incidents]
        .sort((a,b)=>b.date.localeCompare(a.date))
        .map(inc=>{
          const reporter = staff.find(u=>u.id===inc.reportedBy);
          const typeLabel = INCIDENT_TYPES.find(t=>t.id===inc.type)?.label||inc.type;
          const eq = inc.equipmentId ? (equipment||[]).find(e=>e.id===inc.equipmentId) : null;
          return [
            inc.id,
            inc.date,
            inc.time||"",
            typeLabel,
            inc.location,
            inc.description,
            inc.injuryType||"",
            inc.riddor?"Yes":"No",
            inc.riddorReported?"Yes":"No",
            inc.riddorReportedDate||"",
            inc.hseReference||"",
            inc.riddorReportedBy||"",
            inc.accidentCode||"",
            inc.numberCode||"",
            inc.closed?"Closed":"Open",
            reporter?.name||"Unknown",
            inc.equipmentInvolved?"Yes":"No",
            eq?.assetNo||"",
            eq?.name||"",
            inc.equipmentDamaged?"Yes":"No",
            inc.equipmentDamageDesc||"",
            inc.equipmentDamageSeverity||"",
            inc.equipmentOOS?"Yes":"No",
            inc.personName||"",
            inc.personDob||"",
            inc.personAddress||"",
            inc.personPostcode||"",
            inc.witness1Name||"",
            inc.witness1Contact||"",
            inc.witness2Name||"",
            inc.witness2Contact||"",
            inc.firstAidProvided||"",
            inc.firstAidDetails||"",
            inc.firstAidBy||"",
            inc.postIncidentOutcome||"",
            inc.immediateMeasures||"",
            inc.correctiveActions||"",
            inc.correctiveActionsBy||"",
          ];
        });

      const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Column widths
      ws1["!cols"] = [
        {wch:12},{wch:12},{wch:8},{wch:18},{wch:20},{wch:50},
        {wch:20},{wch:8},{wch:14},{wch:12},{wch:10},
        {wch:20},
        {wch:16},{wch:14},{wch:28},{wch:16},{wch:40},{wch:14},{wch:18},
        {wch:22},{wch:14},{wch:30},{wch:12},
        {wch:22},{wch:22},{wch:22},{wch:22},
        {wch:16},{wch:30},{wch:20},
        {wch:30},{wch:30},{wch:40},{wch:22},
      ];

      // Bold header row
      const range = XLSX.utils.decode_range(ws1["!ref"]);
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = XLSX.utils.encode_cell({r:0, c});
        if (!ws1[cell]) continue;
        ws1[cell].s = { font:{bold:true,color:{rgb:"FFFFFF"}}, fill:{fgColor:{rgb:"1E3A8A"}} };
      }

      XLSX.utils.book_append_sheet(wb, ws1, "Incident Log");

      // ── Sheet 2: Monthly Summary ──
      const currentYear = new Date().getFullYear();
      const summaryHeaders = ["Month","Year","Accidents","Near Misses","Unsafe Conditions","Unsafe Acts","RIDDOR","Total"];
      const summaryRows = [];
      for (let yr = currentYear; yr >= currentYear - 2; yr--) {
        for (let m = 1; m <= 12; m++) {
          const key = `${yr}-${String(m).padStart(2,"0")}`;
          const mi = incidents.filter(i=>i.date.startsWith(key));
          if (mi.length === 0 && yr < currentYear) continue;
          summaryRows.push([
            new Date(yr,m-1,1).toLocaleString("default",{month:"long"}),
            yr,
            mi.filter(i=>i.type==="accident").length,
            mi.filter(i=>i.type==="near_miss").length,
            mi.filter(i=>i.type==="unsafe_condition").length,
            mi.filter(i=>i.type==="unsafe_act").length,
            mi.filter(i=>i.riddor).length,
            mi.length,
          ]);
        }
      }
      // Totals row
      summaryRows.push([
        "TOTAL","All",
        `=SUM(C2:C${summaryRows.length+1})`,
        `=SUM(D2:D${summaryRows.length+1})`,
        `=SUM(E2:E${summaryRows.length+1})`,
        `=SUM(F2:F${summaryRows.length+1})`,
        `=SUM(G2:G${summaryRows.length+1})`,
        `=SUM(H2:H${summaryRows.length+1})`,
      ]);

      const ws2 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
      ws2["!cols"] = [{wch:14},{wch:6},{wch:12},{wch:12},{wch:18},{wch:12},{wch:8},{wch:8}];
      XLSX.utils.book_append_sheet(wb, ws2, "Monthly Summary");

      // Save
      XLSX.writeFile(wb, `zeus-incident-report-${today}.xlsx`);
    };
    document.head.appendChild(script);
  }

  function printAccidentBook(bookIncidents) {
    const today = new Date().toLocaleDateString("en-GB");
    const rows = bookIncidents.map((inc, idx) => {
      const reporter = staff.find(u => u.id === inc.reportedBy);
      const typeLabel = INCIDENT_TYPES.find(t => t.id === inc.type)?.label || inc.type;
      const riddorCell = inc.riddor
        ? `<span style="color:#dc2626;font-weight:700">&#9679; RIDDOR${inc.hseReference ? ` (${inc.hseReference})` : ""}</span>`
        : "No";
      const witnesses = [inc.witness1Name, inc.witness2Name].filter(Boolean).join(", ") || "None";
      const firstAid = inc.firstAidProvided === "No" || !inc.firstAidProvided ? "No"
        : `Yes${inc.firstAidBy ? ` — ${inc.firstAidBy}` : ""}`;
      return `<tr style="background:${idx%2===0?"#fff":"#f8fafc"}">
        <td style="text-align:center;font-weight:700;color:#475569">${String(idx+1).padStart(3,"0")}</td>
        <td style="white-space:nowrap">${inc.date}${inc.time?` ${inc.time}`:""}</td>
        <td>${inc.personName||reporter?.name||"Not recorded"}</td>
        <td>${reporter?.jobTitle||reporter?.name||"—"}</td>
        <td><span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#e2e8f0;color:#334155">${typeLabel}</span></td>
        <td>${inc.injuryType||"None / No injury"}</td>
        <td>${inc.location}</td>
        <td style="max-width:260px;font-size:11px">${inc.description}</td>
        <td style="text-align:center">${firstAid}</td>
        <td style="text-align:center;font-size:11px">${witnesses}</td>
        <td style="text-align:center">${riddorCell}</td>
        <td style="text-align:center;color:#64748b;font-size:11px">${reporter?.name||"—"}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Accident Book — Zeus Packaging UK</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; border-bottom: 3px solid #1e3a8a; padding-bottom: 14px; }
      .header-left h1 { font-size: 20px; font-weight: 900; color: #1e3a8a; margin-bottom: 2px; }
      .header-left p { font-size: 12px; color: #64748b; }
      .header-right { text-align: right; font-size: 11px; color: #64748b; line-height: 1.6; }
      .notice { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 14px; margin-bottom: 14px; font-size: 11px; color: #1e40af; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      thead tr { background: #1e3a8a; color: #fff; }
      th { padding: 8px 6px; text-align: left; font-weight: 700; font-size: 10px; letter-spacing: 0.4px; text-transform: uppercase; white-space: nowrap; }
      td { padding: 6px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
      .riddor-notice { margin-top: 14px; padding: 8px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; font-size: 11px; color: #991b1b; }
      @media print {
        body { padding: 12px; }
        .no-print { display: none; }
        tr { page-break-inside: avoid; }
      }
    </style></head><body>
    <div class="header">
      <div class="header-left">
        <h1>ACCIDENT BOOK — ZEUS PACKAGING UK</h1>
        <p>Period: ${abDateFrom} to ${abDateTo} &nbsp;|&nbsp; ${bookIncidents.length} record${bookIncidents.length!==1?"s":""}</p>
      </div>
      <div class="header-right">
        <div><strong>Printed:</strong> ${today}</div>
        <div><strong>Document ref:</strong> AB-${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}</div>
        <div style="margin-top:4px;font-size:10px">Records retained for minimum 3 years (HSE guidance)</div>
      </div>
    </div>
    <div class="notice">
      This accident book is maintained in accordance with HSE guidance (INDG453) and RIDDOR 2013. Records marked RIDDOR have been or must be reported to the Health and Safety Executive.
      All entries are listed chronologically oldest to newest.
    </div>
    <table>
      <thead><tr>
        <th style="width:32px">No.</th>
        <th>Date / Time</th>
        <th>Person Involved</th>
        <th>Job Title</th>
        <th>Type</th>
        <th>Nature of Injury</th>
        <th>Location</th>
        <th>Description</th>
        <th>First Aid</th>
        <th>Witnesses</th>
        <th>RIDDOR</th>
        <th>Reported By</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${bookIncidents.filter(i=>i.riddor).length > 0 ? `
    <div class="riddor-notice">
      <strong>RIDDOR-reportable incidents (${bookIncidents.filter(i=>i.riddor).length}):</strong>
      ${bookIncidents.filter(i=>i.riddor).map(i=>`${i.date} — ${i.location} (${i.hseReference?`Ref: ${i.hseReference}`:"Awaiting HSE reference"})`).join("; ")}
    </div>` : ""}
    <div class="footer">
      <span>Zeus Packaging UK &mdash; Accident Book &mdash; Confidential</span>
      <span>Printed ${today} by authorised person</span>
    </div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`;

    const win = window.open("","_blank","width=1100,height=800");
    if (win) { win.document.write(html); win.document.close(); }
  }

  const typeInfo = (id) => INCIDENT_TYPES.find(t=>t.id===id)||INCIDENT_TYPES[0];

  const filtered = incidents.filter(inc=>{
    if (filterType!=="all" && inc.type!==filterType) return false;
    if (filterStatus==="open" && inc.closed) return false;
    if (filterStatus==="closed" && !inc.closed) return false;
    if (filterRiddor && !inc.riddor) return false;
    if (search) {
      const q = search.toLowerCase();
      const reporter = staff.find(u=>u.id===inc.reportedBy);
      if (!inc.location.toLowerCase().includes(q) &&
          !inc.description.toLowerCase().includes(q) &&
          !(reporter?.name||"").toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));

  const selStyle = {background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"8px 14px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"};

  return (
    <div>
      {showReportForm && (
        <div style={{marginBottom:24,borderRadius:16,border:`1px solid ${Z.borderMd}`,overflow:"hidden"}}>
          <div style={{padding:"12px 20px",background:Z.overlay,borderBottom:`1px solid ${Z.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontWeight:700,fontSize:15,color:Z.white}}>Report New Incident</span>
            <button onClick={()=>setShowReportForm(false)} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>✕ Cancel</button>
          </div>
          <IncidentTracker
            user={staff[0]||{id:1,name:"Admin",role:"admin"}}
            incidents={incidents}
            setIncidents={(fn)=>{ setIncidents(fn); setShowReportForm(false); }}
            equipment={equipment}
            setEquipment={setEquipment}
            Z={Z} font={font}/>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Incident Tracker <HelpTip dark={false} text="All reported incidents across the organisation. RIDDOR-flagged incidents must be reported to the HSE within the required timeframe (typically 10 days for over-7-day injuries). Use Investigate to record root cause and corrective actions."/></h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>All reported incidents — accidents, near misses, unsafe conditions and acts</p>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={()=>setShowReportForm(v=>!v)}
            style={{display:"flex",alignItems:"center",gap:8,background:showReportForm?"rgba(239,68,68,0.1)":`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:showReportForm?"#f87171":"#fff",border:showReportForm?"1px solid rgba(239,68,68,0.2)":"none",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:font,fontSize:13,fontWeight:700,whiteSpace:"nowrap",boxShadow:showReportForm?"none":"0 4px 14px rgba(37,99,235,0.35)"}}>
            {showReportForm ? "✕ Cancel" : "+ Report Incident"}
          </button>
          <div style={{background:"rgba(239,68,68,0.1)",borderRadius:10,padding:"10px 16px",textAlign:"center",minWidth:70}}>
            <div style={{fontSize:20,fontWeight:900,color:"#ef4444"}}>{incidents.filter(i=>!i.closed).length}</div>
            <div style={{fontSize:10,color:Z.muted,marginTop:1}}>Open</div>
          </div>
          <div style={{background:"rgba(239,68,68,0.08)",borderRadius:10,padding:"10px 16px",textAlign:"center",minWidth:70,border:"1px dashed rgba(239,68,68,0.3)"}}>
            <div style={{fontSize:20,fontWeight:900,color:"#f87171"}}>{incidents.filter(i=>i.riddor).length}</div>
            <div style={{fontSize:10,color:Z.muted,marginTop:1}}>RIDDOR</div>
          </div>
          <div style={{background:"rgba(16,185,129,0.1)",borderRadius:10,padding:"10px 16px",textAlign:"center",minWidth:70}}>
            <div style={{fontSize:20,fontWeight:900,color:"#10b981"}}>{incidents.length}</div>
            <div style={{fontSize:10,color:Z.muted,marginTop:1}}>Total</div>
          </div>
          <div style={{width:1,height:36,background:Z.border,margin:"0 2px"}}/>
          <button onClick={()=>onOpenInvestigation(null)}
            style={{display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,rgba(139,92,246,0.2),rgba(139,92,246,0.1))",color:"#c4b5fd",border:"1px solid rgba(139,92,246,0.35)",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:font,fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>
            🔍 Investigations
            {Object.keys(investigations).length > 0 && (
              <span style={{background:"rgba(139,92,246,0.3)",borderRadius:99,padding:"1px 7px",fontSize:11,fontWeight:800}}>
                {Object.keys(investigations).length}
              </span>
            )}
          </button>
          <button onClick={exportIncidentReport}
            style={{display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.1))",color:"#34d399",border:"1px solid rgba(16,185,129,0.35)",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:font,fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>
            ⬇ Export Report
          </button>
          <button onClick={()=>setShowAccidentBook(v=>!v)}
            style={{display:"flex",alignItems:"center",gap:8,background:showAccidentBook?"rgba(245,158,11,0.15)":`linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.08))`,color:"#f59e0b",border:`1px solid ${showAccidentBook?"rgba(245,158,11,0.5)":"rgba(245,158,11,0.3)"}`,borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:font,fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>
            📖 Accident Book
          </button>
        </div>
      </div>

      {/* ── ACCIDENT BOOK VIEW ── */}
      {showAccidentBook && (()=>{
        const bookIncidents = incidents
          .filter(i => (!abDateFrom || i.date >= abDateFrom) && (!abDateTo || i.date <= abDateTo))
          .sort((a,b) => a.date.localeCompare(b.date));
        return (
          <div style={{marginBottom:24}}>
            {/* Header bar */}
            <div style={{background:`linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.06))`,border:`1px solid rgba(245,158,11,0.3)`,borderRadius:"14px 14px 0 0",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:"#f59e0b",marginBottom:2}}>📖 Accident Book</div>
                <div style={{fontSize:12,color:Z.muted}}>{bookIncidents.length} record{bookIncidents.length!==1?"s":""} · Chronological order (oldest first) · HSE guidance INDG453</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:Z.muted,fontWeight:600}}>From</span>
                  <input type="date" value={abDateFrom} onChange={e=>setAbDateFrom(e.target.value)}
                    style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"6px 10px",color:Z.white,fontSize:12,fontFamily:font,outline:"none"}}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:Z.muted,fontWeight:600}}>To</span>
                  <input type="date" value={abDateTo} onChange={e=>setAbDateTo(e.target.value)}
                    style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"6px 10px",color:Z.white,fontSize:12,fontFamily:font,outline:"none"}}/>
                </div>
                <button onClick={()=>printAccidentBook(bookIncidents)}
                  style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:9,padding:"8px 18px",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:font,display:"flex",alignItems:"center",gap:6}}>
                  🖨 Print / Export
                </button>
                <button onClick={()=>setShowAccidentBook(false)} style={{background:"none",border:"none",color:Z.muted,fontSize:18,cursor:"pointer",fontFamily:font}}>✕</button>
              </div>
            </div>
            {/* Table */}
            <div style={{background:Z.overlay,border:`1px solid rgba(245,158,11,0.2)`,borderTop:"none",borderRadius:"0 0 14px 14px",overflowX:"auto"}}>
              {bookIncidents.length === 0 ? (
                <div style={{padding:32,textAlign:"center",color:Z.muted,fontSize:14}}>No incidents recorded in this date range.</div>
              ) : (
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{background:Z.navyMd}}>
                      {["No.","Date / Time","Person Involved","Job Title / Dept","Type","Nature of Injury","Location","Description","First Aid","Witnesses","RIDDOR","Reported By"].map((h,i)=>(
                        <th key={i} style={{padding:"9px 10px",textAlign:"left",color:Z.muted,fontWeight:700,fontSize:10,letterSpacing:.7,textTransform:"uppercase",borderBottom:`1px solid ${Z.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookIncidents.map((inc, idx) => {
                      const reporter = staff.find(u => u.id === inc.reportedBy);
                      const typeInfo2 = INCIDENT_TYPES.find(t => t.id === inc.type);
                      const witnesses = [inc.witness1Name, inc.witness2Name].filter(Boolean).join(", ") || "—";
                      const firstAid = inc.firstAidProvided === "No" || !inc.firstAidProvided ? "No"
                        : `Yes${inc.firstAidBy ? ` — ${inc.firstAidBy}` : ""}`;
                      return (
                        <tr key={inc.id} style={{borderBottom:`1px solid ${Z.border}`,background:idx%2===0?"transparent":Z.overlay}}>
                          <td style={{padding:"8px 10px",fontWeight:700,color:Z.muted,whiteSpace:"nowrap"}}>{String(idx+1).padStart(3,"0")}</td>
                          <td style={{padding:"8px 10px",color:Z.white,whiteSpace:"nowrap",fontWeight:600}}>{inc.date}{inc.time?` ${inc.time}`:""}</td>
                          <td style={{padding:"8px 10px",color:Z.white,fontWeight:600,whiteSpace:"nowrap"}}>{inc.personName||reporter?.name||<span style={{color:Z.muted}}>Not recorded</span>}</td>
                          <td style={{padding:"8px 10px",color:Z.muted,fontSize:11,whiteSpace:"nowrap"}}>{reporter?.jobTitle||reporter?.name||"—"}</td>
                          <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                            <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5,background:`${typeInfo2?.color||"#6b7280"}22`,color:typeInfo2?.color||Z.muted,border:`1px solid ${typeInfo2?.color||"#6b7280"}44`}}>
                              {typeInfo2?.label||inc.type}
                            </span>
                          </td>
                          <td style={{padding:"8px 10px",color:Z.white,fontSize:11}}>{inc.injuryType||"None / No injury"}</td>
                          <td style={{padding:"8px 10px",color:Z.muted,fontSize:11,whiteSpace:"nowrap"}}>{inc.location}</td>
                          <td style={{padding:"8px 10px",color:Z.white,fontSize:11,maxWidth:220,lineHeight:1.4}}>{inc.description}</td>
                          <td style={{padding:"8px 10px",color:firstAid==="No"?Z.muted:"#10b981",fontSize:11,whiteSpace:"nowrap"}}>{firstAid}</td>
                          <td style={{padding:"8px 10px",color:Z.muted,fontSize:11}}>{witnesses}</td>
                          <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                            {inc.riddor
                              ? <span style={{fontSize:11,fontWeight:700,color:"#ef4444"}}>● RIDDOR{inc.hseReference?` ${inc.hseReference}`:""}</span>
                              : <span style={{color:Z.muted,fontSize:11}}>No</span>}
                          </td>
                          <td style={{padding:"8px 10px",color:Z.muted,fontSize:11,whiteSpace:"nowrap"}}>{reporter?.name||"—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {bookIncidents.filter(i=>i.riddor).length > 0 && (
                <div style={{padding:"10px 16px",background:"rgba(239,68,68,0.06)",borderTop:`1px solid rgba(239,68,68,0.2)`,fontSize:11,color:"#f87171"}}>
                  <strong>RIDDOR-reportable incidents ({bookIncidents.filter(i=>i.riddor).length}):</strong>{" "}
                  {bookIncidents.filter(i=>i.riddor).map(i=>`${i.date} — ${i.location}${i.hseReference?` (${i.hseReference})`:""}`).join(" · ")}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Inline edit form */}
      {editingId && editForm && (
        <IncidentForm form={editForm} setF={setEF} err={editErr} saved={editSaved}
          onSubmit={saveEdit} onCancel={cancelEdit} isEdit={true} Z={Z} font={font}/>
      )}

      {/* Chart */}
      <IncidentChart incidents={incidents} Z={Z} font={font}/>

      {/* Filters */}
      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"14px 18px",marginBottom:14,border:`1px solid ${Z.border}`,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        {/* Search */}
        <div style={{position:"relative",flex:"1 1 180px",minWidth:150}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:Z.muted,fontSize:14,pointerEvents:"none"}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search location, description, reporter..."
            style={{...selStyle,paddingLeft:36,width:"100%",boxSizing:"border-box",cursor:"text"}}/>
        </div>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={selStyle}>
          <option value="all">All Types</option>
          {INCIDENT_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}>
          <option value="all">All Status</option>
          <option value="open">⏳ Open</option>
          <option value="closed">✓ Closed</option>
        </select>
        <button onClick={()=>setFilterRiddor(s=>!s)}
          style={{padding:"8px 14px",borderRadius:10,border:`1px solid ${filterRiddor?"rgba(239,68,68,0.5)":Z.borderMd}`,
            background:filterRiddor?"rgba(239,68,68,0.12)":"transparent",
            color:filterRiddor?"#f87171":Z.muted,cursor:"pointer",fontFamily:font,fontSize:13,fontWeight:filterRiddor?700:400}}>
          🏥 RIDDOR only
        </button>
        <span style={{color:Z.muted,fontSize:12,marginLeft:"auto",whiteSpace:"nowrap"}}>{filtered.length} of {incidents.length}</span>
      </div>

      {/* Incident list */}
      {filtered.length===0 ? (
        <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:40,textAlign:"center",border:`1px solid ${Z.border}`}}>
          <div style={{fontSize:40,marginBottom:8}}>📋</div>
          <p style={{color:Z.muted,fontSize:14,margin:0}}>No incidents match the current filters.</p>
        </div>
      ) : (
        <div style={{display:"grid",gap:10}}>
          {filtered.map(inc=>{
            const ti = typeInfo(inc.type);
            const ac = ACCIDENT_CODES.find(c=>c.code===inc.accidentCode);
            const nc = NUMBER_CODES.find(c=>c.num===inc.numberCode);
            const reporter = staff.find(u=>u.id===inc.reportedBy);
            const isOpen = expandedId===inc.id;
            return (
              <div key={inc.id} id={`incident-${inc.id}`} style={{borderRadius:14,border:`1px solid ${inc.riddor?"rgba(239,68,68,0.3)":inc.closed?"rgba(16,185,129,0.2)":Z.border}`,overflow:"hidden",transition:"border-color .2s"}}>

                {/* Header row */}
                <div onClick={()=>setExpandedId(isOpen?null:inc.id)}
                  style={{padding:"14px 18px",background:isOpen?`rgba(37,99,235,0.07)`:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,
                    display:"flex",alignItems:"center",gap:12,cursor:"pointer",userSelect:"none",flexWrap:"wrap"}}>
                  <span style={{fontSize:20,flexShrink:0}}>{ti.icon}</span>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,fontWeight:800,color:ti.color,background:ti.bg,padding:"2px 9px",borderRadius:99}}>{ti.label}</span>
                      {inc.riddor && <span style={{fontSize:10,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,0.12)",padding:"2px 8px",borderRadius:6,border:"1px solid rgba(239,68,68,0.3)"}}>RIDDOR</span>}
                      <span style={{fontSize:11,color:Z.muted}}>📍 {inc.location}</span>
                    </div>
                    <p style={{margin:0,fontSize:13,color:Z.slate,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:isOpen?"normal":"nowrap"}}>{inc.description}</p>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:Z.muted,whiteSpace:"nowrap"}}>{inc.date}</span>
                    {inc.closed
                      ? <Pill label="✓ Closed" col="green"/>
                      : <Pill label="⏳ Open" col="amber"/>
                    }
                    <button onClick={e=>{ e.stopPropagation(); openEdit(inc); }}
                      style={{background:"rgba(37,99,235,0.12)",color:Z.accentLt,border:`1px solid ${Z.accent}33`,borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                      ✏ Edit
                    </button>
                    <button onClick={e=>{ e.stopPropagation(); setConfirmDeleteId(confirmDeleteId===inc.id?null:inc.id); }}
                      style={{background:confirmDeleteId===inc.id?"rgba(239,68,68,0.2)":"rgba(239,68,68,0.08)",color:"#f87171",border:`1px solid ${confirmDeleteId===inc.id?"rgba(239,68,68,0.5)":"rgba(239,68,68,0.2)"}`,borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                      🗑
                    </button>
                    <span style={{color:Z.muted,fontSize:16,transition:"transform .2s",display:"inline-block",transform:isOpen?"rotate(90deg)":"rotate(0deg)"}}>›</span>
                  </div>
                </div>

                {/* Delete confirmation banner */}
                {confirmDeleteId===inc.id && (
                  <div style={{padding:"12px 18px",background:"rgba(239,68,68,0.1)",borderTop:`1px solid rgba(239,68,68,0.25)`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,color:"#fca5a5",fontWeight:600,flex:1}}>⚠ Are you sure you want to permanently delete this incident? This cannot be undone.</span>
                    <button onClick={()=>deleteIncident(inc.id)}
                      style={{background:`linear-gradient(135deg,#ef4444,#b91c1c)`,color:"#fff",border:"none",borderRadius:8,padding:"7px 18px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:12,flexShrink:0}}>
                      Yes, Delete
                    </button>
                    <button onClick={()=>setConfirmDeleteId(null)}
                      style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,flexShrink:0}}>
                      Cancel
                    </button>
                  </div>
                )}

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{borderTop:`1px solid ${Z.border}`,background:Z.overlay,padding:"18px 20px"}}>

                    {/* Top meta row */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12,marginBottom:16}}>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>Reported By</div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {reporter && <Avatar name={reporter.name} size={24}/>}
                          <span style={{fontSize:13,color:Z.white,fontWeight:600}}>{reporter?.name||"Unknown"}</span>
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>Date & Time</div>
                        <div style={{fontSize:13,color:Z.white,fontWeight:600}}>{inc.date}{inc.time?` at ${inc.time}`:""}</div>
                      </div>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>Accident Code</div>
                        <div style={{fontSize:13,color:Z.accentLt,fontWeight:700}}>{ac?`${ac.code} — ${ac.desc}`:"—"}</div>
                      </div>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>Number Code</div>
                        <div style={{fontSize:13,color:Z.accentLt,fontWeight:700}}>{nc?`${nc.num} — ${nc.desc}`:"—"}</div>
                      </div>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>Injury Type</div>
                        <div style={{fontSize:13,color:inc.injuryType==="None / No injury"?Z.muted:"#fca5a5",fontWeight:600}}>{inc.injuryType||"—"}</div>
                      </div>
                      {inc.postIncidentOutcome && (
                        <div>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:4,textTransform:"uppercase"}}>Post-Incident</div>
                          <div style={{fontSize:13,color:"#c4b5fd",fontWeight:600}}>{inc.postIncidentOutcome}</div>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div style={{marginBottom:12,padding:"12px 14px",background:Z.overlay,borderRadius:10,border:`1px solid ${Z.border}`}}>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:6,textTransform:"uppercase"}}>Full Description</div>
                      <p style={{margin:0,fontSize:13,color:Z.slate,lineHeight:1.7}}>{inc.description}</p>
                    </div>

                    {/* Person Involved */}
                    {(inc.personName||inc.personDob||inc.personAddress) && (
                      <div style={{marginBottom:12,padding:"12px 14px",background:Z.overlay,borderRadius:10,border:`1px solid ${Z.border}`}}>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:10,textTransform:"uppercase"}}>👤 Person Involved</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
                          {inc.personName && <div><div style={{fontSize:10,color:Z.muted,marginBottom:2}}>Full Name</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{inc.personName}</div></div>}
                          {inc.personDob && <div><div style={{fontSize:10,color:Z.muted,marginBottom:2}}>Date of Birth</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{inc.personDob}</div></div>}
                          {(inc.personAddress||inc.personPostcode) && <div><div style={{fontSize:10,color:Z.muted,marginBottom:2}}>Home Address</div><div style={{fontSize:12,color:Z.slate}}>{[inc.personAddress,inc.personPostcode].filter(Boolean).join(", ")}</div></div>}
                        </div>
                      </div>
                    )}

                    {/* Witnesses */}
                    {(inc.witness1Name||inc.witness2Name) && (
                      <div style={{marginBottom:12,padding:"12px 14px",background:Z.overlay,borderRadius:10,border:`1px solid ${Z.border}`}}>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,marginBottom:10,textTransform:"uppercase"}}>👁 Witnesses</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          {inc.witness1Name && <div><div style={{fontSize:10,color:Z.muted,marginBottom:2}}>Witness 1</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{inc.witness1Name}{inc.witness1Contact&&<span style={{fontSize:11,color:Z.muted,fontWeight:400}}> · {inc.witness1Contact}</span>}</div></div>}
                          {inc.witness2Name && <div><div style={{fontSize:10,color:Z.muted,marginBottom:2}}>Witness 2</div><div style={{fontSize:13,color:Z.white,fontWeight:600}}>{inc.witness2Name}{inc.witness2Contact&&<span style={{fontSize:11,color:Z.muted,fontWeight:400}}> · {inc.witness2Contact}</span>}</div></div>}
                        </div>
                      </div>
                    )}

                    {/* First Aid */}
                    {inc.firstAidProvided && inc.firstAidProvided!=="No" && (
                      <div style={{marginBottom:12,padding:"12px 14px",background:"rgba(16,185,129,0.06)",borderRadius:10,border:"1px solid rgba(16,185,129,0.18)"}}>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:"#10b981",marginBottom:10,textTransform:"uppercase"}}>🩹 First Aid</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                          <div><div style={{fontSize:10,color:Z.muted,marginBottom:2}}>Type</div><div style={{fontSize:13,color:"#6ee7b7",fontWeight:600}}>{inc.firstAidProvided}</div></div>
                          {inc.firstAidBy && <div><div style={{fontSize:10,color:Z.muted,marginBottom:2}}>First Aider</div><div style={{fontSize:13,color:"#6ee7b7",fontWeight:600}}>{inc.firstAidBy}</div></div>}
                          {inc.firstAidDetails && <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:Z.muted,marginBottom:2}}>Treatment Given</div><div style={{fontSize:12,color:Z.slate,lineHeight:1.6}}>{inc.firstAidDetails}</div></div>}
                        </div>
                      </div>
                    )}

                    {/* Immediate Measures */}
                    {inc.immediateMeasures && (
                      <div style={{marginBottom:12,padding:"12px 14px",background:"rgba(245,158,11,0.06)",borderRadius:10,border:"1px solid rgba(245,158,11,0.18)"}}>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:"#f59e0b",marginBottom:6,textTransform:"uppercase"}}>⚡ Immediate Corrective Measures</div>
                        <p style={{margin:0,fontSize:13,color:Z.slate,lineHeight:1.7}}>{inc.immediateMeasures}</p>
                      </div>
                    )}

                    {/* Corrective Actions */}
                    {inc.correctiveActions && (
                      <div style={{marginBottom:12,padding:"12px 14px",background:"rgba(37,99,235,0.06)",borderRadius:10,border:"1px solid rgba(37,99,235,0.18)"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.accentLt,textTransform:"uppercase"}}>🔧 Corrective Actions to Prevent Recurrence</div>
                          {inc.correctiveActionsBy && <span style={{fontSize:11,color:Z.muted,fontWeight:600}}>Actioned by: {inc.correctiveActionsBy}</span>}
                        </div>
                        <p style={{margin:0,fontSize:13,color:Z.slate,lineHeight:1.7}}>{inc.correctiveActions}</p>
                      </div>
                    )}

                    {/* Equipment involvement */}
                    {inc.equipmentInvolved && inc.equipmentId && (()=>{
                      const eq = (equipment||[]).find(e=>e.id===inc.equipmentId);
                      return (
                        <div style={{marginBottom:12,padding:"12px 14px",background:"rgba(245,158,11,0.06)",borderRadius:10,border:`1px solid ${inc.equipmentOOS?"rgba(239,68,68,0.35)":"rgba(245,158,11,0.25)"}`}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:"#f59e0b",textTransform:"uppercase",marginBottom:8}}>⚙️ Equipment Involvement</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:inc.equipmentDamaged||inc.equipmentOOS?8:0}}>
                            <span style={{fontWeight:700,fontSize:13,color:Z.white}}>{eq?`${eq.assetNo} — ${eq.name}`:inc.equipmentId}</span>
                            {eq && <span style={{fontSize:11,color:Z.muted}}>{eq.location}</span>}
                            {inc.equipmentOOS && <span style={{fontSize:11,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.35)",borderRadius:6,padding:"2px 8px"}}>🚫 Out of Service</span>}
                          </div>
                          {inc.equipmentDamaged && inc.equipmentDamageDesc && (
                            <div style={{fontSize:12,color:"#fca5a5"}}>
                              <span style={{fontWeight:700,color:"#f87171",marginRight:6}}>Damage reported{inc.equipmentDamageSeverity?` (${inc.equipmentDamageSeverity})`:""}:</span>
                              {inc.equipmentDamageDesc}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* RIDDOR notice */}
                    {inc.riddor && (
                      <div style={{marginBottom:12,padding:"12px 16px",background:inc.riddorReported?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.08)",borderRadius:10,border:`1px solid ${inc.riddorReported?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"}`}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:700,color:inc.riddorReported?"#10b981":"#f87171",marginBottom:3}}>
                              {inc.riddorReported ? "✓ Reported to HSE" : "⚠ RIDDOR Reportable — Action Required"}
                            </div>
                            <div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>
                              {inc.riddorReported
                                ? `Reported to HSE on ${inc.riddorReportedDate||"—"}${inc.riddorReportedBy?" by "+inc.riddorReportedBy:""}. Reference: ${inc.hseReference||"not recorded"}.`
                                : "This incident must be reported to the HSE under RIDDOR 2013. Submit form F2508/F2508A at riddor.hse.gov.uk or call 0345 300 9923."}
                            </div>
                            {!inc.riddorReported && (
                              <a href="https://www.hse.gov.uk/riddor/report.htm" target="_blank" rel="noreferrer"
                                style={{fontSize:11,color:"#93c5fd",marginTop:4,display:"inline-block"}}>
                                → Report online at hse.gov.uk
                              </a>
                            )}
                          </div>
                          {!inc.riddorReported ? (
                            <button onClick={()=>{
                              const date = prompt("Date reported to HSE (YYYY-MM-DD):", new Date().toISOString().slice(0,10));
                              if (!date) return;
                              const ref = prompt("HSE reference number (optional):", "") || "";
                              const by = prompt("Reported by (name):", "") || "";
                              setIncidents(p=>p.map(i=>i.id===inc.id?{...i,riddorReported:true,riddorReportedDate:date,hseReference:ref,riddorReportedBy:by}:i));
                            }} style={{background:"linear-gradient(135deg,#ef4444,#b91c1c)",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,flexShrink:0,whiteSpace:"nowrap"}}>
                              ✓ Mark as Reported to HSE
                            </button>
                          ) : (
                            <button onClick={()=>{
                              if(window.confirm("Undo RIDDOR reported status?")) setIncidents(p=>p.map(i=>i.id===inc.id?{...i,riddorReported:false,riddorReportedDate:null,hseReference:null,riddorReportedBy:null}:i));
                            }} style={{background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontFamily:font,flexShrink:0,whiteSpace:"nowrap"}}>
                              Undo
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Open/Close button */}
                    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                      <button onClick={()=>openEdit(inc)}
                        style={{background:"rgba(37,99,235,0.12)",color:Z.accentLt,border:`1px solid ${Z.accent}33`,borderRadius:10,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
                        ✏ Edit Incident
                      </button>
                      <button onClick={()=>onOpenInvestigation(inc.id)}
                        style={{background:"rgba(139,92,246,0.12)",color:"#c4b5fd",border:"1px solid rgba(139,92,246,0.3)",borderRadius:10,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13}}>
                        🔍 {investigations[inc.id] ? "View Investigation" : "Start Investigation"}
                      </button>
                      <button onClick={()=>toggleClose(inc.id)}
                        style={{background:inc.closed?`linear-gradient(135deg,${Z.amber},#d97706)`:`linear-gradient(135deg,${Z.green},#059669)`,
                          color:"#fff",border:"none",borderRadius:10,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,
                          boxShadow:inc.closed?"0 4px 14px rgba(245,158,11,0.35)":"0 4px 14px rgba(16,185,129,0.35)"}}>
                        {inc.closed?"↩ Re-open Incident":"✓ Mark as Closed"}
                      </button>
                      <button onClick={()=>setConfirmDeleteId(confirmDeleteId===inc.id?null:inc.id)}
                        style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,marginLeft:"auto"}}>
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export { AdminIncidentTab };
