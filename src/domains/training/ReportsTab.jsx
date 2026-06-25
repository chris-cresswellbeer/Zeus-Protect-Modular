import React, { useState } from "react";
import { useWindowWidth } from "../../shared/hooks";
import { Pill, Avatar, StatCard, Bar } from "../../shared/primitives";
import { HelpTip } from "../../shared/HelpTip";
import { E } from "../../lib/emoji";
import { sb, dbWrite } from "../../lib/supabase";
import { TRAINING_MODULES } from "../../data/seedTraining";
import { getExpiryStatus } from "../../lib/dates";
import { isWarehouseWorker, machineExpiryStatus } from "../../data/seedMachinery";
import { EXT_CERT_TYPES } from "../../data/seedExtCerts";
import { ManagerRow } from "./ManagerRow";
import { AdminDSETab } from "../dse/AdminDSETab";

function ReportsTab({ staff, assigns, comps, docs, docAssignments, docAcknowledgements, reportView, setReportView, dseReports, adminResponses, setAdminResponses, darkMode, Z, font, modules, machineComps, allMachineTypes, lastLoginMap, extCerts, quizFailures, setQuizFailures, incidents, inspections, ras, investigations, onExportPDF, setAtab }) {
  const isMobile = useWindowWidth() <= 1024;
  const [rptFilterSearch, setRptFilterSearch] = React.useState("");
  const [showTeamExport, setShowTeamExport] = React.useState(false);
  const [exportManager, setExportManager] = React.useState("");
  const [rptFilterManager, setRptFilterManager] = React.useState("all");
  const [rptFilterProgress, setRptFilterProgress] = React.useState("all");
  const allModules = modules || TRAINING_MODULES;
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [expandedModule, setExpandedModule] = useState(null);

  // ── Manager performance calculations ──────────────────────────────────────
  const managerData = (() => {
    const map = {};
    staff.forEach(u => {
      const mgr = u.manager || "No Manager Assigned";
      if (!map[mgr]) map[mgr] = { name: mgr, members: [] };
      map[mgr].members.push(u);
    });
    return Object.values(map).map(m => {
      const totalAssigned   = m.members.reduce((s,u)=>(assigns[u.id]||[]).length+s, 0);
      const totalCompleted  = m.members.reduce((s,u)=>Object.keys(comps[u.id]||{}).length+s, 0);
      const totalPending    = totalAssigned - totalCompleted;
      const compliancePct   = totalAssigned ? Math.min(100, Math.round(totalCompleted / totalAssigned * 100)) : 0;
      const fullyCompliant  = m.members.filter(u=>{
        const a=(assigns[u.id]||[]).length;
        const c=Object.keys(comps[u.id]||{}).length;
        return a > 0 && c === a;
      }).length;
      const nonCompliant    = m.members.filter(u=>{
        const a=(assigns[u.id]||[]).length;
        const c=Object.keys(comps[u.id]||{}).length;
        return a > 0 && c < a;
      }).length;
      const noModules       = m.members.filter(u=>(assigns[u.id]||[]).length===0).length;
      const status = compliancePct === 100 ? "green" : compliancePct >= 50 ? "amber" : "red";
      return { ...m, totalAssigned, totalCompleted, totalPending, compliancePct, fullyCompliant, nonCompliant, noModules, status };
    }).sort((a,b) => a.compliancePct - b.compliancePct);
  })();

  // ── CSV export helpers ─────────────────────────────────────────────────────
  function downloadCsv(filename, rows) {
    const csv = rows.map(r => r.map(cell => {
      const s = String(cell === null || cell === undefined ? "" : cell);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportStaffReport() {
    const today = new Date().toISOString().slice(0,10);
    const rows = [
      ["Zeus Protect — Staff Compliance Report"],
      [`Generated: ${today}`],
      [],
      ["Name","Email","Job Title","Manager","Last Login","Modules Assigned","Modules Completed","Modules Pending","Compliance %","Status","Incomplete Modules","Certificates","First Aid Cert","First Aid Expiry","Fire Marshall Cert","Fire Marshall Expiry"],
    ];
    staff.forEach(u => {
      const assignedIds = assigns[u.id]||[];
      const userComps   = comps[u.id]||{};
      const a = assignedIds.length;
      const d = assignedIds.filter(mid => userComps[mid]).length;
      const pct = a ? Math.min(100, Math.round(d/a*100)) : 0;
      const pending = allModules.filter(m=>assignedIds.includes(m.id)&&!userComps[m.id]).map(m=>m.title).join("; ");
      const certs = allModules.filter(m=>assignedIds.includes(m.id)&&userComps[m.id]?.certId).map(m=>`${m.title}: ${userComps[m.id].certId}`).join("; ");
      const expiredMods = allModules.filter(m=>assignedIds.includes(m.id)&&userComps[m.id]&&m.renewalMonths&&getExpiryStatus(userComps[m.id].date,m.renewalMonths)?.status==="expired").map(m=>m.title).join("; ");
      const status = pct===100?"Compliant":pct>=50?"In Progress":"Overdue";
      const lastLogin = (lastLoginMap&&lastLoginMap[u.id]) || "Never";
      const userExtCerts = (extCerts||{})[u.id] || {};
      const firstAid = userExtCerts["first_aid"];
      const fireMarshal = userExtCerts["fire_marshall"];
      const firstAidStatus = firstAid ? (new Date(firstAid.expiryDate) < new Date() ? "Expired" : "Valid") : "Not uploaded";
      const fireMarshalStatus = fireMarshal ? (new Date(fireMarshal.expiryDate) < new Date() ? "Expired" : "Valid") : "Not uploaded";
      rows.push([u.name, u.email, u.jobTitle||"", u.manager||"", lastLogin, a, d, a-d, pct+"%", status, pending, certs,
        firstAidStatus, firstAid?.expiryDate||"",
        fireMarshalStatus, fireMarshal?.expiryDate||""]);
    });
    rows.push([]);
    rows.push([`Total Staff: ${staff.length}`, `Total Completions: ${staff.reduce((s,u)=>s+Object.keys(comps[u.id]||{}).length,0)}`, `Average Compliance: ${staff.length?Math.min(100, Math.round(staff.reduce((s,u)=>{const a=(assigns[u.id]||[]).length;const c=Object.keys(comps[u.id]||{}).length;return s+(a?c/a:0);},0)/staff.length*100)):0}%`]);
    downloadCsv(`zeus-staff-report-${today}.csv`, rows);
  }

  function exportManagerReport() {
    const today = new Date().toISOString().slice(0,10);
    const certCols = EXT_CERT_TYPES.map(ct => ct.label);
    const rows = [
      ["Zeus Protect — Manager Performance Report"],
      [`Generated: ${today}`],
      [],
      ["Manager","Team Size","Modules Assigned","Modules Completed","Modules Pending","Compliance %","Fully Compliant Staff","Overdue Staff","No Modules Assigned","Status"],
    ];
    managerData.forEach(mgr => {
      rows.push([mgr.name, mgr.members.length, mgr.totalAssigned, mgr.totalCompleted, mgr.totalPending, mgr.compliancePct+"%", mgr.fullyCompliant, mgr.nonCompliant, mgr.noModules, mgr.status==="green"?"All Compliant":mgr.status==="amber"?"In Progress":"Overdue"]);
    });
    rows.push([]);
    rows.push(["--- Staff Detail by Manager ---"]);
    rows.push([]);
    managerData.forEach(mgr => {
      rows.push([`Manager: ${mgr.name}`]);
      rows.push(["  Staff Member","  Job Title","  Modules Assigned","  Completed","  Compliance %","  Outstanding Modules", ...certCols.map(c=>"  "+c), "  Machinery Competent", "  Machinery Provisional", "  Machinery Renewal Required"]);
      mgr.members.forEach(u => {
        const assignedIds = assigns[u.id]||[];
        const userComps   = comps[u.id]||{};
        const a = assignedIds.length;
        const d = (assigns[u.id]||[]).filter(mid => userComps[mid]).length;
        const pct = a ? Math.min(100, Math.round(d/a*100)) : 0;
        const pending = allModules.filter(m=>assignedIds.includes(m.id)&&!userComps[m.id]).map(m=>m.title).join("; ");
        const userExtCerts = (extCerts||{})[u.id] || {};
        const certValues = EXT_CERT_TYPES.map(ct => {
          const cert = userExtCerts[ct.id];
          if (!cert) return "Not uploaded";
          const isExpired = cert.expiryDate && new Date(cert.expiryDate) < new Date();
          return isExpired ? `Expired (${cert.expiryDate})` : `Valid (exp ${cert.expiryDate||"—"})`;
        });
        const userMachComps = Object.values((machineComps||{})[u.id]||{});
        const machineTypes = allMachineTypes || [];
        const machCompetent   = userMachComps.filter(c=>{const ex=machineExpiryStatus(c,machineTypes);return c.status==="competent"&&!(ex?.status==="expired");}).length;
        const machProvisional = userMachComps.filter(c=>c.status==="provisional").length;
        const machExpired     = userMachComps.filter(c=>{const ex=machineExpiryStatus(c,machineTypes);return c.status==="expired"||ex?.status==="expired";}).length;
        rows.push(["  "+u.name, "  "+(u.jobTitle||""), a, d, pct+"%", pending, ...certValues, machCompetent, machProvisional, machExpired]);
      });
      rows.push([]);
    });
    downloadCsv(`zeus-manager-report-${today}.csv`, rows);
  }

  const tabBtn = (id, label) => (
    <button onClick={()=>setReportView(id)}
      style={{padding:"8px 18px",borderRadius:10,border:`1px solid ${reportView===id?Z.accent:Z.borderMd}`,background:reportView===id?`linear-gradient(135deg,${Z.accent},${Z.blue})`:Z.overlay,color:reportView===id?"#fff":Z.muted,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,transition:"all .2s"}}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:14}}>
        <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:0}}>Compliance Reports <HelpTip dark={false} text="View completion rates, expiry status, document acknowledgements and DSE assessments across all staff. Use the Training Expiry tab to identify anyone with overdue renewals before they become a compliance issue."/></h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {tabBtn("staff",     E("👥 ","")+"Staff Overview")}
          {tabBtn("manager",   E("📊 ","")+"Manager Performance")}
          {tabBtn("dse",       E("🖥 ","")+"DSE Reports")}
          {tabBtn("documents", E("📄 ","")+"Document Read Status")}
          {tabBtn("expiry",    E("⏰ ","")+"Training Expiry")}
          {tabBtn("failures",  E("❌ ","")+"Quiz Failures", (quizFailures||[]).filter(f=>!f.acknowledged).length)}
          {tabBtn("trends",    E("📊 ","")+"Incident Trends")}
          {tabBtn("actions",   E("🔧 ","")+"Overdue Actions")}
          <div style={{width:1,height:28,background:Z.borderMd,margin:"0 4px"}}/>
          <button
            onClick={reportView==="staff" ? exportStaffReport : exportManagerReport}
            style={{padding:"8px 18px",borderRadius:10,border:"1px solid rgba(16,185,129,0.35)",background:"rgba(16,185,129,0.12)",color:Z.green,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6,transition:"all .2s"}}>
            ↓ Export {reportView==="staff"?"Staff":"Manager"} Report
          </button>
          <button onClick={()=>setShowTeamExport(v=>!v)}
            style={{padding:"8px 18px",borderRadius:10,border:"1px solid rgba(37,99,235,0.35)",background:showTeamExport?"rgba(37,99,235,0.2)":"rgba(37,99,235,0.1)",color:Z.accentLt,fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,display:"flex",alignItems:"center",gap:6,transition:"all .2s"}}>
            🖨 Team PDF Export
          </button>
        </div>
      </div>

      {/* ── TEAM PDF EXPORT PANEL ── */}
      {showTeamExport && (() => {
        const managers = [...new Set(staff.map(u=>u.manager||"").filter(Boolean))].sort();
        const teamStaff = exportManager ? staff.filter(u=>u.manager===exportManager) : [];
        return (
          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:20,marginBottom:20,border:`1px solid ${Z.accent}44`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10}}>
              <div>
                <h4 style={{margin:0,fontSize:14,fontWeight:700,color:Z.white}}>🖨 Team Compliance PDF Export</h4>
                <p style={{margin:"3px 0 0",fontSize:12,color:Z.muted}}>Select a manager to export individual compliance reports for all of their staff as separate PDF pages.</p>
              </div>
              <button onClick={()=>setShowTeamExport(false)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 12px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>✕ Close</button>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              <select value={exportManager} onChange={e=>setExportManager(e.target.value)}
                style={{flex:"1 1 220px",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 13px",color:exportManager?Z.white:Z.muted,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"}}>
                <option value="">Select a manager...</option>
                {managers.map(m=>{
                  const count = staff.filter(u=>u.manager===m).length;
                  return <option key={m} value={m}>{m} ({count} staff)</option>;
                })}
              </select>
              {exportManager && teamStaff.length>0 && (
                <button
                  onClick={()=>{
                    // Open a single print window with all team members' reports
                    const allHtml = teamStaff.map(u=>{
                      const assignedIds = assigns[u.id]||[];
                      const userComps = comps[u.id]||{};
                      const a = assignedIds.length;
                      const d = assignedIds.filter(mid=>userComps[mid]).length;
                      const pct = a ? Math.min(100,Math.round(d/a*100)) : 0;
                      const status = pct===100?"Compliant":pct>=50?"In Progress":"Overdue";
                      const today = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
                      const statusColor = pct===100?"#15803d":pct>=50?"#b45309":"#dc2626";
                      const trainingRows = assignedIds.map(mid=>{
                        const m = allModules.find(x=>x.id===mid); if(!m) return "";
                        const c = userComps[mid];
                        const passed = c&&c.score>=70;
                        return `<tr style="background:${!c?"#fff2f2":passed?"#f0fff4":"#fff8f0"}">
                          <td>${m.icon||""} ${m.title}</td>
                          <td style="color:${!c?"#999":passed?"#15803d":"#b45309"};font-weight:600">${!c?"Not started":passed?"Passed":"Failed"}</td>
                          <td style="text-align:center">${c?c.score+"%":"—"}</td>
                          <td>${c?c.date:"—"}</td>
                          <td style="font-family:monospace;font-size:11px">${c?.certId||"—"}</td>
                        </tr>`;
                      }).join("");
                      const docRows = (docs||[]).filter(doc=>(docAssignments[String(doc.id)]||[]).includes(String(u.id))).map(doc=>{
                        const ack=(docAcknowledgements[u.id]||{})[doc.id];
                        return `<tr style="background:${ack?"#f0fff4":"#fff2f2"}"><td>${doc.title}</td><td>${doc.type||"—"}</td><td style="color:${ack?"#15803d":"#dc2626"};font-weight:600">${ack?`✓ ${ack.date}`:"⏳ Pending"}</td></tr>`;
                      }).join("");
                      const userExtCerts = (extCerts||{})[u.id] || {};
                      const extCertRows = EXT_CERT_TYPES.map(ct=>{
                        const cert=userExtCerts[ct.id];
                        if (!cert) return `<tr style="background:#fff2f2"><td>${ct.icon} ${ct.label}</td><td style="color:#dc2626;font-weight:600">Not uploaded</td><td>—</td><td>—</td></tr>`;
                        const expired = cert.expiryDate && cert.expiryDate < new Date().toISOString().slice(0,10);
                        return `<tr style="background:${expired?"#fff8f0":"#f0fff4"}">
                          <td>${ct.icon} ${ct.label}</td>
                          <td style="color:${expired?"#b45309":"#15803d"};font-weight:600">${expired?"⚠ Expired":"✓ Valid"}</td>
                          <td>${cert.issuedDate||"—"}</td>
                          <td>${cert.expiryDate||"—"}</td>
                        </tr>`;
                      }).join("");
                      const userMachineComps = Object.values((machineComps||{})[u.id]||{});
                      const machineTypesForExport = allMachineTypes || [];
                      const machineRows = userMachineComps.map(mc=>{
                        const mType = machineTypesForExport.find(x=>x.id===mc.machineId)||{label:mc.machineId,icon:"🔧"};
                        const expired = mc.licenceExpiry && mc.licenceExpiry < new Date().toISOString().slice(0,10);
                        return `<tr style="background:${expired?"#fff8f0":"#fff"}">
                          <td>${mType.icon||"🔧"} ${mType.label||mc.machineId}</td>
                          <td style="color:${mc.status==="competent"?"#15803d":mc.status==="provisional"?"#b45309":"#dc2626"};font-weight:600;text-transform:capitalize">${mc.status||"—"}</td>
                          <td>${mc.assessmentDate||"—"}</td>
                          <td style="color:${expired?"#dc2626":"inherit"}">${mc.licenceExpiry||"—"}${expired?" ⚠ Expired":""}</td>
                        </tr>`;
                      }).join("");
                      return `<div class="page-break">
                        <div class="header">
                          <div><h1>${u.name}</h1><p>${u.jobTitle||""}${u.manager?" · Manager: "+u.manager:""}</p><p style="color:#94a3b8;font-size:12px">Generated: ${today}</p></div>
                          <div style="text-align:right"><div style="font-size:11px;color:#94a3b8;margin-bottom:6px">Zeus Protect H&S Portal</div><div class="status-badge" style="color:${statusColor};border-color:${statusColor};background:${pct===100?"#f0fff4":pct>=50?"#fff8f0":"#fff2f2"}">${status} — ${pct}%</div></div>
                        </div>
                        <div class="meta-grid">
                          <div class="meta-card"><div class="label">Assigned</div><div class="value">${a}</div></div>
                          <div class="meta-card"><div class="label">Completed</div><div class="value">${d}</div></div>
                          <div class="meta-card"><div class="label">Compliance</div><div class="value" style="color:${statusColor}">${pct}%</div></div>
                        </div>
                        <h2>Training</h2>
                        ${a===0?'<div class="no-data">No modules assigned</div>':`<table><thead><tr><th>Module</th><th>Status</th><th>Score</th><th>Date</th><th>Certificate</th></tr></thead><tbody>${trainingRows}</tbody></table>`}
                        ${docRows?`<h2>Document Acknowledgements</h2><table><thead><tr><th>Document</th><th>Type</th><th>Status</th></tr></thead><tbody>${docRows}</tbody></table>`:""}
                        <h2>External Certificates</h2>
                        <table><thead><tr><th>Certificate</th><th>Status</th><th>Issue Date</th><th>Expiry Date</th></tr></thead><tbody>${extCertRows}</tbody></table>
                        ${userMachineComps.length>0?`<h2>Machinery Competence</h2><table><thead><tr><th>Machine</th><th>Status</th><th>Assessed</th><th>Licence Expiry</th></tr></thead><tbody>${machineRows}</tbody></table>`:""}
                      </div>`;
                    }).join("");

                    const win = window.open("","_blank","width=900,height=700");
                    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
                      <title>Team Compliance Report — ${exportManager}</title>
                      <style>
                        *{margin:0;padding:0;box-sizing:border-box}
                        body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;padding:32px;font-size:13px}
                        @media print{body{padding:20px}@page{margin:15mm;size:A4}.page-break{page-break-after:always}}
                        .page-break{padding-bottom:32px;margin-bottom:32px;border-bottom:2px dashed #e2e8f0}
                        .page-break:last-child{border-bottom:none}
                        .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #0d1f5c}
                        .header h1{font-size:20px;font-weight:900;color:#0d1f5c;margin-bottom:3px}
                        .header p{color:#64748b;font-size:12px;margin-top:2px}
                        .status-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:700;border:2px solid}
                        .meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}
                        .meta-card{background:#f8fafc;border-radius:8px;padding:10px 14px;border:1px solid #e2e8f0}
                        .meta-card .label{font-size:10px;font-weight:700;letter-spacing:.5px;color:#94a3b8;text-transform:uppercase;margin-bottom:3px}
                        .meta-card .value{font-size:18px;font-weight:900;color:#0d1f5c}
                        h2{font-size:13px;font-weight:800;color:#0d1f5c;margin:14px 0 8px;padding-bottom:4px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px}
                        table{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:12px}
                        th{background:#0d1f5c;color:#fff;padding:7px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.3px}
                        td{padding:7px 10px;border-bottom:1px solid #e2e8f0}
                        .no-data{padding:10px;color:#94a3b8;font-style:italic;background:#f8fafc;border-radius:6px}
                      </style></head><body>
                      <div style="text-align:center;padding:16px 0 24px;border-bottom:3px solid #0d1f5c;margin-bottom:28px">
                        <h1 style="font-size:22px;font-weight:900;color:#0d1f5c;margin-bottom:4px">Team Compliance Report</h1>
                        <p style="color:#64748b;font-size:13px">Manager: ${exportManager} · ${teamStaff.length} staff members · Generated ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})}</p>
                      </div>
                      ${allHtml}
                      <script>window.onload=()=>window.print()<\/script>
                    </body></html>`);
                    win.document.close();
                  }}
                  style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,boxShadow:`0 4px 14px ${Z.accent}44`,whiteSpace:"nowrap"}}>
                  🖨 Export {teamStaff.length} Report{teamStaff.length!==1?"s":""} for {exportManager.split(" ")[0]}'s Team
                </button>
              )}
            </div>
            {exportManager && teamStaff.length===0 && (
              <p style={{color:Z.muted,fontSize:12,marginTop:10}}>No staff found reporting to {exportManager}.</p>
            )}
          </div>
        );
      })()}

      {/* ── STAFF OVERVIEW ── */}
      {reportView === "staff" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:28}}>
            <StatCard icon={E("👥","👥")} val={staff.length} label="Total Staff" accent={Z.accentLt} Z={Z}/>
            <StatCard icon="📚" val={allModules.length} label="Modules Available" accent="#a78bfa" Z={Z}/>
            <StatCard icon="✅" val={staff.reduce((s,u)=>s+Object.keys(comps[u.id]||{}).length,0)} label="Total Completions" accent={Z.green} Z={Z}/>
            <StatCard icon={E("📊","📊")} val={staff.length?`${Math.min(100, Math.round(staff.reduce((s,u)=>{const a=(assigns[u.id]||[]).length;const c=Object.keys(comps[u.id]||{}).length;return s+(a?c/a:0);},0)/staff.length*100))}%`:"—"} label="Avg Compliance" accent={Z.gold} Z={Z}/>
          </div>
          {(()=>{
            const managers = ["all", ...Array.from(new Set(staff.map(u=>u.manager||"").filter(Boolean))).sort()];
            const selStyle = {background:Z.headerBg,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"8px 14px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,cursor:"pointer"};
            const filteredStaff = staff.filter(u=>{
              if (rptFilterManager!=="all" && (u.manager||"")!==rptFilterManager) return false;
              if (rptFilterSearch) {
                const q = rptFilterSearch.toLowerCase();
                if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.jobTitle||"").toLowerCase().includes(q)) return false;
              }
              if (rptFilterProgress!=="all") {
                const a=(assigns[u.id]||[]).length;
                const d=(assigns[u.id]||[]).filter(mid=>(comps[u.id]||{})[mid]).length;
                const pct=a?Math.min(100,Math.round(d/a*100)):0;
                if (rptFilterProgress==="compliant" && pct!==100) return false;
                if (rptFilterProgress==="inprogress" && (pct===100||pct===0)) return false;
                if (rptFilterProgress==="overdue" && pct!==0) return false;
                if (rptFilterProgress==="none" && a!==0) return false;
              }
              return true;
            });
            const activeFilters = (rptFilterManager!=="all"?1:0)+(rptFilterSearch?1:0)+(rptFilterProgress!=="all"?1:0);
            return (<>
              <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"14px 18px",marginBottom:14,border:`1px solid ${Z.border}`,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{position:"relative",flex:"1 1 180px",minWidth:150}}>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:Z.muted,fontSize:14,pointerEvents:"none"}}>🔍</span>
                  <input value={rptFilterSearch} onChange={e=>setRptFilterSearch(e.target.value)} placeholder="Search name, email, job title..."
                    style={{...selStyle,paddingLeft:36,width:"100%",boxSizing:"border-box"}}/>
                </div>
                <select value={rptFilterManager} onChange={e=>setRptFilterManager(e.target.value)} style={selStyle}>
                  <option value="all">All Managers</option>
                  {managers.filter(m=>m!=="all").map(m=><option key={m} value={m}>{m}</option>)}
                  {staff.some(u=>!u.manager) && <option value="">No Manager</option>}
                </select>
                <select value={rptFilterProgress} onChange={e=>setRptFilterProgress(e.target.value)} style={selStyle}>
                  <option value="all">All Progress</option>
                  <option value="compliant">✓ Compliant</option>
                  <option value="inprogress">In Progress</option>
                  <option value="overdue">Overdue</option>
                  <option value="none">No Modules</option>
                </select>
                {activeFilters>0 && (
                  <button onClick={()=>{setRptFilterManager("all");setRptFilterSearch("");setRptFilterProgress("all");}}
                    style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                    ✕ Clear {activeFilters} filter{activeFilters!==1?"s":""}
                  </button>
                )}
                <span style={{color:Z.muted,fontSize:12,marginLeft:"auto",whiteSpace:"nowrap"}}>{filteredStaff.length} of {staff.length} staff</span>
              </div>

          <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${Z.border}`}}>
            <div style={{padding:"14px 20px",borderBottom:`1px solid ${Z.border}`,fontWeight:700,fontSize:12,letterSpacing:1,color:Z.muted,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>STAFF COMPLIANCE OVERVIEW</span>
              <span style={{fontWeight:400,fontSize:11,color:Z.muted}}>Click a row to expand · Click a module to see quiz results</span>
            </div>
            {staff.length === 0 && (
              <div style={{padding:"32px 20px",textAlign:"center",color:Z.muted,fontSize:14}}>No staff members yet.</div>
            )}
            {filteredStaff.map((u,i)=>{
              const assignedIds = assigns[u.id]||[];
              const userComps = comps[u.id]||{};
              const a = assignedIds.length;
              const d = (assigns[u.id]||[]).filter(mid => userComps[mid]).length;
              const p = a ? Math.min(100, Math.round(d/a*100)) : 0;
              const isOpen = expandedStaff === u.id;
              const notDone = allModules.filter(m => assignedIds.includes(m.id) && !userComps[m.id]);
              const doneModules = allModules.filter(m => assignedIds.includes(m.id) && userComps[m.id]);

              return (
                <div key={u.id} style={{borderTop:i>0?`1px solid ${Z.border}`:"none"}}>
                  <div onClick={()=>{ setExpandedStaff(isOpen?null:u.id); setExpandedModule(null); }}
                    style={{padding:"14px 20px",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 2fr auto",alignItems:"center",gap:14,cursor:"pointer",background:isOpen?"rgba(37,99,235,0.1)":"transparent",transition:"background .15s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <Avatar name={u.name} size={28}/>
                      <div>
                        <div style={{fontSize:14,fontWeight:700}}>{u.name}</div>
                        <div style={{fontSize:11,color:Z.muted,display:"flex",alignItems:"center",gap:6}}>{u.jobTitle||""}{u.isWarehouseWorker&&<span style={{fontSize:9,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,0.1)",padding:"1px 5px",borderRadius:99,border:"1px solid rgba(245,158,11,0.25)"}}>🏗</span>}</div>
                      </div>
                    </div>
                    <span style={{color:Z.muted,fontSize:13}}>{d}/{a} done</span>
                    <Pill label={p===100?"✓ Compliant":p>=50?"In Progress":"Overdue"} col={p===100?"green":p>=50?"navy":"red"}/>
                    <Bar pct={p} color={p===100?Z.green:p>=50?Z.accent:Z.red}/>
                    <span style={{color:Z.muted,fontSize:18,lineHeight:1,transition:"transform .2s",transform:isOpen?"rotate(90deg)":"rotate(0deg)",display:"inline-block",minWidth:16,textAlign:"center"}}>›</span>
                  </div>
                  {isOpen && (
                    <div style={{background:Z.overlay,borderTop:`1px solid ${Z.border}`,padding:"18px 24px 22px"}}>
                      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
                        <button onClick={()=>onExportPDF&&onExportPDF(u)}
                          style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:9,padding:"8px 18px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,boxShadow:`0 4px 14px ${Z.accent}44`,display:"flex",alignItems:"center",gap:7}}>
                          🖨 Export Compliance Report PDF
                        </button>
                      </div>
                      {a === 0 ? (
                        <p style={{color:Z.muted,fontSize:13,margin:0}}>No modules assigned yet.</p>
                      ) : (
                        <>
                          {notDone.length > 0 && (
                            <>
                              <p style={{color:"#f87171",fontSize:11,fontWeight:700,letterSpacing:1,margin:"0 0 10px",textTransform:"uppercase"}}>⚠ {notDone.length} incomplete module{notDone.length!==1?"s":""}</p>
                              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8,marginBottom:20}}>
                                {notDone.map(m=>(
                                  <div key={m.id} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
                                    <span style={{fontSize:22,flexShrink:0}}>{m.icon}</span>
                                    <div>
                                      <div style={{fontWeight:700,fontSize:13,color:Z.white}}>{m.title}</div>
                                      <div style={{fontSize:11,color:Z.muted,marginTop:2}}>{m.duration} · <span style={{color:m.level==="Mandatory"?"#f87171":Z.accentLt}}>{m.level}</span></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                          {doneModules.length > 0 && (
                            <>
                              <p style={{color:Z.green,fontSize:11,fontWeight:700,letterSpacing:1,margin:"0 0 10px",textTransform:"uppercase"}}>✓ {doneModules.length} completed — click a module to see quiz answers</p>
                              <div style={{display:"grid",gap:8}}>
                                {doneModules.map(m=>{
                                  const result = userComps[m.id];
                                  const modKey = `${u.id}_${m.id}`;
                                  const isModOpen = expandedModule === modKey;
                                  const savedAnswers = result.answers || {};
                                  const incorrectQs = m.quiz.map((q,qi)=>({...q,qi,given:savedAnswers[qi]})).filter(q=>q.given!==q.answer);
                                  const correctCount = m.quiz.length - incorrectQs.length;
                                  const hasAnswers = Object.keys(savedAnswers).length > 0;
                                  const certId = result.certId || null;
                                  return (
                                    <div key={m.id} style={{borderRadius:12,overflow:"hidden",border:`1px solid ${result.score>=70?"rgba(16,185,129,0.25)":"rgba(245,158,11,0.25)"}`}}>
                                      <div onClick={()=>setExpandedModule(isModOpen?null:modKey)}
                                        style={{background:isModOpen?"rgba(37,99,235,0.12)":result.score>=70?"rgba(16,185,129,0.07)":"rgba(245,158,11,0.07)",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,cursor:hasAnswers?"pointer":"default"}}>
                                        <span style={{fontSize:22,flexShrink:0}}>{m.icon}</span>
                                        <div style={{flex:1}}>
                                          <div style={{fontWeight:700,fontSize:13,color:Z.white}}>{m.title}</div>
                                          <div style={{fontSize:11,marginTop:2,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                                            <span style={{color:result.score>=70?Z.green:Z.amber,fontWeight:700}}>{result.score}%</span>
                                            <span style={{color:Z.muted}}>{result.date}</span>
                                            {hasAnswers && <span style={{color:incorrectQs.length>0?"#f87171":Z.green}}>{incorrectQs.length>0?`${incorrectQs.length} wrong`:"All correct ✓"}</span>}
                                            {m.renewalMonths && (() => {
                                              const ex = getExpiryStatus(result.date, m.renewalMonths);
                                              if (!ex) return null;
                                              return <span style={{background:ex.bg,border:`1px solid ${ex.color}44`,borderRadius:6,padding:"2px 8px",color:ex.color,fontWeight:700,fontSize:10}}>{ex.status==="expired"?"⚠ Expired":ex.status==="expiring"?`⏳ ${ex.label}`:`✓ ${ex.expiryDate}`}</span>;
                                            })()}
                                            {certId && (
                                              <span style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,padding:"2px 8px",color:Z.gold,fontWeight:700,fontSize:10,letterSpacing:.5,fontFamily:"monospace"}}>
                                                🏅 {certId}
                                              </span>
                                            )}
                                            {!certId && result.score < 70 && (
                                              <span style={{color:Z.muted,fontSize:10,fontStyle:"italic"}}>No certificate (failed)</span>
                                            )}
                                          </div>
                                        </div>
                                        {hasAnswers && <span style={{color:Z.muted,fontSize:16,lineHeight:1,transition:"transform .2s",transform:isModOpen?"rotate(90deg)":"rotate(0deg)",display:"inline-block",flexShrink:0}}>›</span>}
                                        {!hasAnswers && <span style={{color:Z.muted,fontSize:11,fontStyle:"italic"}}>No answer data</span>}
                                      </div>
                                      {isModOpen && hasAnswers && (
                                        <div style={{background:Z.overlay,borderTop:`1px solid ${Z.border}`,padding:"14px 16px"}}>
                                          {incorrectQs.length === 0 ? (
                                            <div style={{display:"flex",alignItems:"center",gap:8,color:Z.green,fontWeight:700,fontSize:13}}>
                                              <span>🎉</span> All {m.quiz.length} questions answered correctly!
                                            </div>
                                          ) : (
                                            <>
                                              <p style={{fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,margin:"0 0 10px",textTransform:"uppercase"}}>{incorrectQs.length} incorrect · {correctCount}/{m.quiz.length} correct</p>
                                              <div style={{display:"grid",gap:8}}>
                                                {incorrectQs.map((q,idx)=>(
                                                  <div key={idx} style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:10,padding:"12px 14px"}}>
                                                    <p style={{fontWeight:700,fontSize:12,color:Z.white,margin:"0 0 8px",lineHeight:1.5}}><span style={{color:Z.muted,marginRight:6}}>Q{q.qi+1}.</span>{q.q}</p>
                                                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                                                      <div style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"7px 10px"}}>
                                                        <div style={{fontSize:9,fontWeight:700,letterSpacing:.5,color:"#f87171",marginBottom:3}}>THEIR ANSWER</div>
                                                        <div style={{fontSize:12,color:"#fca5a5"}}>{q.given!==undefined?q.options[q.given]:"Not answered"}</div>
                                                      </div>
                                                      <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:"7px 10px"}}>
                                                        <div style={{fontSize:9,fontWeight:700,letterSpacing:.5,color:Z.green,marginBottom:3}}>CORRECT ANSWER</div>
                                                        <div style={{fontSize:12,color:"#6ee7b7"}}>{q.options[q.answer]}</div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </>
                      )}

                      {/* External Certificates */}
                      {(() => {
                        const userExtCerts = (extCerts||{})[u.id] || {};
                        const certEntries = EXT_CERT_TYPES.filter(ct => userExtCerts[ct.id]);
                        const missingCerts = EXT_CERT_TYPES.filter(ct => !userExtCerts[ct.id]);
                        if (!certEntries.length && !missingCerts.length) return null;
                        return (
                          <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${Z.border}`}}>
                            <p style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,margin:"0 0 10px",textTransform:"uppercase"}}>External Certificates</p>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                              {EXT_CERT_TYPES.map(ct => {
                                const cert = userExtCerts[ct.id];
                                const isExpired = cert?.expiryDate && new Date(cert.expiryDate) < new Date();
                                const daysLeft = cert?.expiryDate ? Math.ceil((new Date(cert.expiryDate) - new Date()) / 86400000) : null;
                                return (
                                  <div key={ct.id} style={{background:cert?(isExpired?"rgba(239,68,68,0.08)":"rgba(16,185,129,0.08)"):"rgba(255,255,255,0.03)",border:`1px solid ${cert?(isExpired?"rgba(239,68,68,0.25)":"rgba(16,185,129,0.25)"):"rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
                                    <span style={{fontSize:20,flexShrink:0}}>{ct.icon}</span>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontWeight:700,fontSize:12,color:Z.white}}>{ct.label}</div>
                                      {cert ? (
                                        <>
                                          <div style={{fontSize:10,color:isExpired?"#f87171":Z.green,marginTop:2}}>{isExpired?"⚠ Expired":daysLeft<=30?`⏳ ${daysLeft}d left`:"✓ Valid"}</div>
                                          <div style={{fontSize:10,color:Z.muted}}>Expires: {cert.expiryDate||"—"}</div>
                                        </>
                                      ) : (
                                        <div style={{fontSize:10,color:"#f87171",marginTop:2}}>⚠ Not uploaded</div>
                                      )}
                                    </div>
                                    {cert && (
                                      <a href={cert.fileUrl} target="_blank" rel="noreferrer"
                                        style={{fontSize:11,color:Z.accentLt,textDecoration:"none",fontWeight:700,flexShrink:0}}>View</a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Machinery Competence */}
                      {(() => {
                        const userMachComps = Object.values(machineComps[u.id]||{});
                        if (!userMachComps.length) return null;
                        const machineTypes = allMachineTypes || [];
                        return (
                          <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${Z.border}`}}>
                            <p style={{fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,margin:"0 0 10px",textTransform:"uppercase"}}>Machinery Competence</p>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
                              {userMachComps.map(comp => {
                                const mType = machineTypes.find(m=>m.id===comp.machineId) || {label:comp.machineId, icon:"🔧"};
                                const ex = machineExpiryStatus(comp, machineTypes);
                                const isExpired = comp.status==="expired" || ex?.status==="expired";
                                const isProvisional = comp.status==="provisional";
                                const bg = isExpired?"rgba(239,68,68,0.08)":isProvisional?"rgba(245,158,11,0.08)":"rgba(16,185,129,0.08)";
                                const border = isExpired?"rgba(239,68,68,0.25)":isProvisional?"rgba(245,158,11,0.25)":"rgba(16,185,129,0.25)";
                                const statusColor = isExpired?"#f87171":isProvisional?Z.amber:Z.green;
                                return (
                                  <div key={comp.id} style={{background:bg,border:`1px solid ${border}`,borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
                                    <span style={{fontSize:20,flexShrink:0}}>{mType.icon}</span>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontWeight:700,fontSize:12,color:Z.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{mType.label}</div>
                                      <div style={{fontSize:10,color:statusColor,marginTop:2}}>
                                        {isExpired?"⚠ Renewal required":isProvisional?"⏳ Provisional":"✓ Competent"}
                                      </div>
                                      {comp.licenceExpiry && <div style={{fontSize:10,color:Z.muted}}>Licence expires: {comp.licenceExpiry}</div>}
                                      {comp.licenceRef && <div style={{fontSize:9,fontFamily:"monospace",color:Z.gold,marginTop:1}}>{comp.licenceRef}</div>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </>);
          })()}
        </div>
      )}

      {/* ── MANAGER PERFORMANCE ── */}
      {reportView === "failures" && (
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
            <div>
              <h3 style={{fontSize:18,fontWeight:800,margin:"0 0 4px"}}>Quiz Failures</h3>
              <p style={{color:Z.muted,fontSize:13,margin:0}}>Staff who have failed a module quiz in the last 30 days.</p>
            </div>
            {(quizFailures||[]).filter(f=>!f.acknowledged).length > 0 && (
              <button onClick={()=>{
                const updated = (quizFailures||[]).map(f=>({...f,acknowledged:true}));
                setQuizFailures(updated);
                updated.forEach(f=>dbWrite(sb.from("quiz_failures").upsert({data:f},{onConflict:"data->>'id'"}), "quiz failure update"));
              }} style={{background:"rgba(16,185,129,0.1)",color:Z.green,border:"1px solid rgba(16,185,129,0.25)",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
                ✓ Mark all as reviewed
              </button>
            )}
          </div>
          {(quizFailures||[]).length === 0 ? (
            <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:"40px 20px",textAlign:"center",border:`1px solid ${Z.border}`,color:Z.muted,fontSize:14}}>
              ✓ No quiz failures recorded
            </div>
          ) : (
            <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${Z.border}`}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 2fr 1fr 1fr 1fr",padding:"10px 20px",background:Z.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}>
                <span>Staff Member</span>
                {!isMobile && <><span>Module</span><span>Score</span><span>Date</span><span>Status</span></>}
              </div>
              {[...(quizFailures||[])].sort((a,b)=>b.date.localeCompare(a.date)).map((f,i)=>(
                <div key={f.id||i} style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 2fr 1fr 1fr 1fr",padding:"14px 20px",borderTop:i>0?`1px solid ${Z.border}`:"none",alignItems:"center",background:f.acknowledged?"transparent":"rgba(239,68,68,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <Avatar name={f.userName} size={28}/>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:Z.white}}>{f.userName}</div>
                      {isMobile && <div style={{fontSize:11,color:Z.muted,marginTop:2}}>{f.moduleTitle} · <span style={{color:"#f87171",fontWeight:700}}>{f.score}%</span> · {f.date}</div>}
                    </div>
                  </div>
                  {!isMobile && <>
                    <span style={{fontSize:13,color:Z.muted}}>{f.moduleTitle}</span>
                    <span style={{fontWeight:800,color:"#f87171",fontSize:15}}>{f.score}%</span>
                    <span style={{fontSize:12,color:Z.muted}}>{f.date}</span>
                    <span>
                      {f.acknowledged
                        ? <Pill label="Reviewed" col="green"/>
                        : <button onClick={()=>{
                            const updated = (quizFailures||[]).map(x=>x.id===f.id?{...x,acknowledged:true}:x);
                            setQuizFailures(updated);
                            dbWrite(sb.from("quiz_failures").upsert({data:{...f,acknowledged:true}},{onConflict:"data->>'id'"}), "quiz failure acknowledgement");
                          }} style={{background:"rgba(37,99,235,0.1)",color:Z.accentLt,border:`1px solid rgba(37,99,235,0.25)`,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                            Mark reviewed
                          </button>
                      }
                    </span>
                  </>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {reportView === "trends" && (() => {
        const inc = incidents || [];
        const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const TYPE_COLORS = { accident:"#ef4444", near_miss:"#f59e0b", unsafe_condition:"#fb923c", unsafe_act:"#a78bfa" };
        const TYPE_LABELS = { accident:"Accident", near_miss:"Near Miss", unsafe_condition:"Unsafe Condition", unsafe_act:"Unsafe Act" };

        // Last 12 months
        const now = new Date();
        const last12 = Array.from({length:12},(_,i)=>{
          const d = new Date(now.getFullYear(), now.getMonth()-11+i, 1);
          return { year:d.getFullYear(), month:d.getMonth(), label:MONTHS[d.getMonth()]+" "+String(d.getFullYear()).slice(2) };
        });

        const byMonth = last12.map(m => {
          const hits = inc.filter(i => {
            const d = new Date(i.date);
            return d.getFullYear()===m.year && d.getMonth()===m.month;
          });
          return {
            ...m, total:hits.length,
            accident: hits.filter(i=>i.type==="accident").length,
            near_miss: hits.filter(i=>i.type==="near_miss").length,
            unsafe_condition: hits.filter(i=>i.type==="unsafe_condition").length,
            unsafe_act: hits.filter(i=>i.type==="unsafe_act").length,
            riddor: hits.filter(i=>i.riddor).length,
          };
        });

        const maxMonthly = Math.max(...byMonth.map(m=>m.total), 1);

        // By type totals
        const byType = Object.keys(TYPE_COLORS).map(k=>({ id:k, label:TYPE_LABELS[k], color:TYPE_COLORS[k], count:inc.filter(i=>i.type===k).length }));
        const typeTotal = byType.reduce((s,t)=>s+t.count,0)||1;

        // By location top 8
        const locMap = {};
        inc.forEach(i=>{ if(i.location) locMap[i.location.trim()]=(locMap[i.location.trim()]||0)+1; });
        const byLocation = Object.entries(locMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
        const maxLoc = byLocation[0]?.[1]||1;

        // Stats
        const open = inc.filter(i=>!i.closed).length;
        const riddorOpen = inc.filter(i=>i.riddor&&!i.closed).length;
        const last30 = inc.filter(i=>new Date(i.date)>=new Date(Date.now()-30*86400000)).length;
        const last30prev = inc.filter(i=>{const d=new Date(i.date);return d>=new Date(Date.now()-60*86400000)&&d<new Date(Date.now()-30*86400000);}).length;
        const trend = last30-last30prev;

        const card = {background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:24,border:`1px solid ${Z.border}`};
        const statCard = (icon,label,value,sub,col="#fff") => (
          <div style={{...card,textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:6}}>{icon}</div>
            <div style={{fontSize:28,fontWeight:900,color:col,lineHeight:1}}>{value}</div>
            <div style={{fontSize:12,fontWeight:700,color:Z.muted,marginTop:4,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
            {sub && <div style={{fontSize:11,color:Z.muted,marginTop:3}}>{sub}</div>}
          </div>
        );

        return (
          <div>
            <h3 style={{fontSize:18,fontWeight:800,margin:"0 0 4px"}}>Incident Trends</h3>
            <p style={{color:Z.muted,fontSize:13,marginBottom:20}}>Analysis of all {inc.length} recorded incidents.</p>

            {/* Stat tiles */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:14,marginBottom:24}}>
              {statCard(E("📋",""), "Total Incidents",inc.length,"")}
              {statCard(E("🔓",""), "Open Incidents",open,open>0?"Awaiting closure":"All closed",open>0?"#f87171":Z.green)}
              {statCard(E("⚠️",""), "RIDDOR Open",riddorOpen,riddorOpen>0?"HSE reporting required":"",riddorOpen>0?"#f87171":Z.green)}
              {statCard(E("📅",""), "Last 30 Days",last30,trend===0?"Same as previous 30d":trend>0?`▲ ${trend} more than prev 30d`:`▼ ${Math.abs(trend)} fewer than prev 30d`,trend>0?"#f87171":trend<0?Z.green:"#fff")}
            </div>

            {/* Monthly bar chart */}
            <div style={{...card,marginBottom:24}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Incidents by Month</div>
              <div style={{fontSize:12,color:Z.muted,marginBottom:16}}>Last 12 months</div>
              {/* Legend */}
              <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:16}}>
                {Object.entries(TYPE_COLORS).map(([k,c])=>(
                  <div key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:Z.muted}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c,flexShrink:0}}/>
                    {TYPE_LABELS[k]}
                  </div>
                ))}
              </div>
              {/* Bars */}
              <div style={{display:"flex",alignItems:"flex-end",gap:isMobile?4:8,height:160}}>
                {byMonth.map((m,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,height:"100%",justifyContent:"flex-end"}}>
                    <div style={{fontSize:10,fontWeight:700,color:m.total>0?Z.white:Z.muted,marginBottom:2}}>{m.total||""}</div>
                    <div style={{width:"100%",display:"flex",flexDirection:"column",gap:1,justifyContent:"flex-end"}}>
                      {["unsafe_act","unsafe_condition","near_miss","accident"].map(type=>(
                        m[type]>0 && <div key={type} title={`${TYPE_LABELS[type]}: ${m[type]}`} style={{width:"100%",height:Math.max(4,m[type]/maxMonthly*120),background:TYPE_COLORS[type],borderRadius:type==="unsafe_act"?"3px 3px 0 0":"0",transition:"height .3s"}}/>
                      ))}
                    </div>
                    <div style={{fontSize:9,color:Z.muted,marginTop:4,whiteSpace:"nowrap",transform:"rotate(-45deg)",transformOrigin:"center",width:20,textAlign:"center"}}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20,marginBottom:24}}>
              {/* Donut chart by type */}
              <div style={card}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Incidents by Type</div>
                <div style={{fontSize:12,color:Z.muted,marginBottom:16}}>All time</div>
                <div style={{display:"flex",gap:20,alignItems:"center"}}>
                  <svg viewBox="0 0 100 100" style={{width:120,height:120,flexShrink:0}}>
                    {(() => {
                      let angle = -90;
                      return byType.filter(t=>t.count>0).map((t,i)=>{
                        const pct = t.count/typeTotal;
                        const start = angle*(Math.PI/180);
                        angle += pct*360;
                        const end = angle*(Math.PI/180);
                        const x1=50+40*Math.cos(start), y1=50+40*Math.sin(start);
                        const x2=50+40*Math.cos(end), y2=50+40*Math.sin(end);
                        const largeArc = pct>0.5?1:0;
                        return <path key={i} d={`M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`} fill={t.color} opacity={0.9}/>;
                      });
                    })()}
                    <circle cx="50" cy="50" r="22" fill={Z.navyMd}/>
                    <text x="50" y="47" textAnchor="middle" fill={Z.white} fontSize="8" fontWeight="700">{inc.length}</text>
                    <text x="50" y="56" textAnchor="middle" fill={Z.muted} fontSize="6">total</text>
                  </svg>
                  <div style={{display:"flex",flexDirection:"column",gap:8,flex:1}}>
                    {byType.map(t=>(
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:10,height:10,borderRadius:2,background:t.color,flexShrink:0}}/>
                        <div style={{flex:1,fontSize:12,color:Z.muted}}>{t.label}</div>
                        <div style={{fontWeight:700,fontSize:13,color:Z.white}}>{t.count}</div>
                        <div style={{fontSize:11,color:Z.muted,minWidth:32,textAlign:"right"}}>{typeTotal>0?Math.round(t.count/typeTotal*100):0}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* By location */}
              <div style={card}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Incidents by Location</div>
                <div style={{fontSize:12,color:Z.muted,marginBottom:16}}>Top {byLocation.length} locations</div>
                {byLocation.length===0
                  ? <div style={{color:Z.muted,fontSize:13,textAlign:"center",paddingTop:20}}>No location data yet</div>
                  : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {byLocation.map(([loc,cnt],i)=>(
                      <div key={i}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:12,color:Z.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{loc}</span>
                          <span style={{fontSize:12,fontWeight:700,color:Z.accentLt,flexShrink:0}}>{cnt}</span>
                        </div>
                        <div style={{height:6,background:Z.border,borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${cnt/maxLoc*100}%`,background:`linear-gradient(90deg,${Z.accent},${Z.accentLt})`,borderRadius:99,transition:"width .4s"}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>

            {/* RIDDOR line chart */}
            <div style={card}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>RIDDOR Reportable — Monthly</div>
              <div style={{fontSize:12,color:Z.muted,marginBottom:16}}>Last 12 months · {inc.filter(i=>i.riddor).length} total RIDDOR incidents recorded</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:isMobile?4:8,height:80}}>
                {byMonth.map((m,i)=>{
                  const h = Math.max(m.riddor>0?8:0, m.riddor/Math.max(...byMonth.map(x=>x.riddor),1)*70);
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,height:"100%",justifyContent:"flex-end"}}>
                      {m.riddor>0 && <div style={{fontSize:9,fontWeight:700,color:"#f87171"}}>{m.riddor}</div>}
                      <div style={{width:"100%",height:h||2,background:m.riddor>0?"#ef4444":"rgba(255,255,255,0.05)",borderRadius:3}}/>
                      <div style={{fontSize:9,color:Z.muted,marginTop:4,whiteSpace:"nowrap",transform:"rotate(-45deg)",transformOrigin:"center",width:20,textAlign:"center"}}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {reportView === "actions" && (() => {
        const today = new Date().toISOString().slice(0,10);
        const allActions = [];

        // ── Incident corrective actions ────────────────────────────────────
        (incidents||[]).forEach(inc=>{
          const inv = investigations[inc.id];
          if (!inv?.correctiveActions?.length) return;
          inv.correctiveActions.forEach((a,i)=>{
            if (a.actionStatus==="complete") return;
            const daysOld = a.date ? Math.floor((new Date()-new Date(a.date))/86400000) : null;
            allActions.push({
              id: `inc_${inc.id}_${i}`,
              source: "Incident",
              sourceIcon: "🚨",
              title: a.action||"Corrective action",
              ref: inc.description?.slice(0,50)||(inc.location||"Unknown location"),
              assignedTo: a.assignedTo||"Unassigned",
              dueDate: a.dueDate||null,
              raisedDate: a.date||inc.date||null,
              daysOld,
              priority: inc.riddor?"high":daysOld>30?"high":daysOld>14?"medium":"low",
              status: a.actionStatus||"open",
              onClick: ()=>setAtab("incidents"),
            });
          });
        });

        // ── Inspection non-conformances ────────────────────────────────────
        (inspections||[]).forEach(ins=>{
          (ins.nonConformances||[]).forEach((nc,i)=>{
            if (nc.actionStatus==="complete") return;
            const daysOld = ins.date ? Math.floor((new Date()-new Date(ins.date))/86400000) : null;
            allActions.push({
              id: `ins_${ins.id}_${i}`,
              source: "Inspection",
              sourceIcon: "🏗",
              title: nc.description||nc.finding||"Non-conformance",
              ref: `${ins.location||"Unknown"} — ${ins.date||""}`,
              assignedTo: nc.responsiblePerson||"Unassigned",
              dueDate: nc.dueDate||null,
              raisedDate: ins.date||null,
              daysOld,
              priority: nc.severity==="high"||nc.priority==="high"?"high":daysOld>30?"high":daysOld>14?"medium":"low",
              status: nc.actionStatus||"open",
              onClick: ()=>setAtab("inspections"),
            });
          });
        });

        // ── Risk assessment actions ─────────────────────────────────────────
        (ras||[]).forEach(ra=>{
          (ra.hazards||[]).forEach((h,hi)=>{
            (h.actions||[]).forEach((a,ai)=>{
              if (a.done) return;
              const daysOld = ra.date ? Math.floor((new Date()-new Date(ra.date))/86400000) : null;
              allActions.push({
                id: `ra_${ra.id}_${hi}_${ai}`,
                source: "Risk Assessment",
                sourceIcon: "⚠️",
                title: a.action||a.text||"Control measure",
                ref: `${ra.title||ra.location||"Unknown RA"}`,
                assignedTo: ra.assessor||"Unassigned",
                dueDate: a.dueDate||ra.reviewDate||null,
                raisedDate: ra.date||null,
                daysOld,
                priority: h.residualRisk==="high"||h.riskLevel==="high"?"high":daysOld>30?"high":"medium",
                status: "open",
                onClick: ()=>setAtab("ra"),
              });
            });
          });
        });

        // Sort: overdue first, then by priority, then by days old
        const priorityOrder = {high:0,medium:1,low:2};
        allActions.sort((a,b)=>{
          const aOverdue = a.dueDate&&a.dueDate<today;
          const bOverdue = b.dueDate&&b.dueDate<today;
          if(aOverdue&&!bOverdue) return -1;
          if(!aOverdue&&bOverdue) return 1;
          if(priorityOrder[a.priority]!==priorityOrder[b.priority]) return priorityOrder[a.priority]-priorityOrder[b.priority];
          return (b.daysOld||0)-(a.daysOld||0);
        });

        const overdue = allActions.filter(a=>a.dueDate&&a.dueDate<today);
        const noDue = allActions.filter(a=>!a.dueDate);
        const upcoming = allActions.filter(a=>a.dueDate&&a.dueDate>=today);

        const priorityStyle = p=>p==="high"?{color:"#f87171",bg:"rgba(239,68,68,0.1)",border:"rgba(239,68,68,0.25)"}:p==="medium"?{color:"#f59e0b",bg:"rgba(245,158,11,0.1)",border:"rgba(245,158,11,0.25)"}:{color:Z.muted,bg:Z.overlay,border:Z.borderMd};

        const ActionRow = ({a,i})=>{
          const ps=priorityStyle(a.priority);
          const isOverdue=a.dueDate&&a.dueDate<today;
          const daysUntil=a.dueDate?Math.ceil((new Date(a.dueDate)-new Date())/86400000):null;
          return (
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1.5fr 1fr 1fr 80px",gap:12,padding:"14px 20px",borderTop:i>0?`1px solid ${Z.border}`:"none",alignItems:"center"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:14}}>{a.sourceIcon}</span>
                  <span style={{fontSize:11,color:Z.muted,fontWeight:600}}>{a.source}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:20,background:ps.bg,color:ps.color,border:`1px solid ${ps.border}`,textTransform:"uppercase"}}>{a.priority}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:Z.white,marginBottom:2}}>{a.title}</div>
                <div style={{fontSize:11,color:Z.muted}}>{a.ref}</div>
              </div>
              {!isMobile && <>
                <span style={{fontSize:12,color:Z.muted}}>{a.assignedTo}</span>
                <span style={{fontSize:12,color:isOverdue?"#f87171":a.dueDate?"#f59e0b":Z.muted,fontWeight:isOverdue?700:400}}>
                  {a.dueDate?(isOverdue?`⚠ ${Math.abs(daysUntil)}d overdue`:`Due in ${daysUntil}d`):"No due date"}
                </span>
                <span style={{fontSize:11,color:Z.muted}}>{a.raisedDate||"—"}</span>
                <button onClick={a.onClick} style={{background:`rgba(37,99,235,0.1)`,color:Z.accentLt,border:`1px solid rgba(37,99,235,0.25)`,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>View →</button>
              </>}
            </div>
          );
        };

        return (
          <div>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
              <div>
                <h3 style={{fontSize:18,fontWeight:800,margin:"0 0 4px"}}>Overdue Actions</h3>
                <p style={{color:Z.muted,fontSize:13,margin:0}}>All open corrective actions across incidents, inspections and risk assessments.</p>
              </div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {[["🚨",overdue.length,"Overdue","#f87171"],["⏳",upcoming.length,"Upcoming","#f59e0b"],["📋",noDue.length,"No Due Date",Z.muted]].map(([icon,count,label,col])=>(
                  <div key={label} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:12,padding:"10px 16px",border:`1px solid ${Z.border}`,textAlign:"center",minWidth:80}}>
                    <div style={{fontSize:20,fontWeight:900,color:col}}>{count}</div>
                    <div style={{fontSize:10,color:Z.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>{icon} {label}</div>
                  </div>
                ))}
              </div>
            </div>

            {allActions.length===0 ? (
              <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:"40px 20px",textAlign:"center",border:`1px solid ${Z.border}`,color:Z.green,fontSize:14,fontWeight:600}}>
                ✓ No open actions — everything is up to date
              </div>
            ) : (
              <>
                {overdue.length>0 && (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#f87171",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>⚠ Overdue ({overdue.length})</div>
                    <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:"1px solid rgba(239,68,68,0.3)",overflow:"hidden"}}>
                      {!isMobile && <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 80px",gap:12,padding:"10px 20px",background:Z.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}><span>Action</span><span>Assigned To</span><span>Due</span><span>Raised</span><span></span></div>}
                      {overdue.map((a,i)=><ActionRow key={a.id} a={a} i={i}/>)}
                    </div>
                  </div>
                )}
                {upcoming.length>0 && (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#f59e0b",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>⏳ Upcoming ({upcoming.length})</div>
                    <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:`1px solid rgba(245,158,11,0.25)`,overflow:"hidden"}}>
                      {!isMobile && <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 80px",gap:12,padding:"10px 20px",background:Z.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}><span>Action</span><span>Assigned To</span><span>Due</span><span>Raised</span><span></span></div>}
                      {upcoming.map((a,i)=><ActionRow key={a.id} a={a} i={i}/>)}
                    </div>
                  </div>
                )}
                {noDue.length>0 && (
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>📋 No Due Date ({noDue.length})</div>
                    <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:`1px solid ${Z.border}`,overflow:"hidden"}}>
                      {!isMobile && <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 80px",gap:12,padding:"10px 20px",background:Z.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}><span>Action</span><span>Assigned To</span><span>Due</span><span>Raised</span><span></span></div>}
                      {noDue.map((a,i)=><ActionRow key={a.id} a={a} i={i}/>)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {reportView === "manager" && (
        <div>
          {/* Summary stat cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:16}}>
            <StatCard icon="👤" val={managerData.length} label="Managers" accent="#a78bfa" Z={Z}/>
            <StatCard icon="🟢" val={managerData.filter(m=>m.status==="green").length} label="All Teams Compliant" accent={Z.green} Z={Z}/>
            <StatCard icon="🟡" val={managerData.filter(m=>m.status==="amber").length} label="Teams In Progress" accent={Z.amber} Z={Z}/>
            <StatCard icon="🔴" val={managerData.filter(m=>m.status==="red").length} label="Teams Overdue" accent="#ef4444" Z={Z}/>
          </div>

          <div style={{display:"grid",gap:12}}>
            {managerData.length === 0 && (
              <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:40,textAlign:"center",color:Z.muted,fontSize:14,border:`1px solid ${Z.border}`}}>
                No manager data yet. Assign managers to staff members in the Staff tab.
              </div>
            )}
            {managerData.map((mgr,mi)=>(
              <ManagerRow key={mgr.name} mgr={mgr} assigns={assigns} comps={comps} Z={Z} font={font} modules={allModules} extCerts={extCerts} machineComps={machineComps} allMachineTypes={allMachineTypes}/>
            ))}

          </div>
        </div>
      )}

      {/* ── TRAINING EXPIRY REPORT ── */}
      {reportView === "expiry" && (
        <div>
          <div style={{marginBottom:20}}>
            <h3 style={{fontSize:15,fontWeight:800,color:Z.white,margin:"0 0 4px"}}>Training Expiry Overview</h3>
            <p style={{color:Z.muted,fontSize:13,margin:0}}>Shows renewal status for all staff who have completed modules with expiry periods</p>
          </div>
          {/* Summary stats */}
          {(()=>{
            let expired=0, expiring=0, valid=0;
            staff.forEach(u=>{
              (assigns[u.id]||[]).forEach(mid=>{
                const m=allModules.find(x=>x.id===mid);
                const c=(comps[u.id]||{})[mid];
                if(m&&c&&m.renewalMonths){
                  const ex=getExpiryStatus(c.date,m.renewalMonths);
                  if(ex?.status==="expired") expired++;
                  else if(ex?.status==="expiring") expiring++;
                  else if(ex?.status==="valid") valid++;
                }
              });
            });
            return (
              <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
                <div style={{background:"rgba(239,68,68,0.1)",borderRadius:12,padding:"14px 20px",flex:1,minWidth:120,textAlign:"center",border:"1px solid rgba(239,68,68,0.2)"}}>
                  <div style={{fontSize:28,fontWeight:900,color:"#ef4444",fontFamily:"'Barlow Condensed',sans-serif"}}>{expired}</div>
                  <div style={{fontSize:11,color:Z.muted,marginTop:2}}>⚠ Expired</div>
                </div>
                <div style={{background:"rgba(245,158,11,0.1)",borderRadius:12,padding:"14px 20px",flex:1,minWidth:120,textAlign:"center",border:"1px solid rgba(245,158,11,0.2)"}}>
                  <div style={{fontSize:28,fontWeight:900,color:"#f59e0b",fontFamily:"'Barlow Condensed',sans-serif"}}>{expiring}</div>
                  <div style={{fontSize:11,color:Z.muted,marginTop:2}}>⏳ Expiring &lt;60 days</div>
                </div>
                <div style={{background:"rgba(16,185,129,0.1)",borderRadius:12,padding:"14px 20px",flex:1,minWidth:120,textAlign:"center",border:"1px solid rgba(16,185,129,0.2)"}}>
                  <div style={{fontSize:28,fontWeight:900,color:"#10b981",fontFamily:"'Barlow Condensed',sans-serif"}}>{valid}</div>
                  <div style={{fontSize:11,color:Z.muted,marginTop:2}}>✓ Valid</div>
                </div>
              </div>
            );
          })()}
          {/* Per-staff expiry breakdown */}
          <div style={{display:"grid",gap:12}}>
            {staff.map(u=>{
              const uc = comps[u.id]||{};
              const expiries = (assigns[u.id]||[]).map(mid=>{
                const m=allModules.find(x=>x.id===mid);
                const c=uc[mid];
                if(!m||!c||!m.renewalMonths) return null;
                return { m, c, ex:getExpiryStatus(c.date,m.renewalMonths) };
              }).filter(Boolean);
              if(!expiries.length) return null;
              const hasIssue = expiries.some(e=>e.ex.status!=="valid");
              return (
                <div key={u.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:`1px solid ${hasIssue?"rgba(239,68,68,0.25)":Z.border}`,overflow:"hidden"}}>
                  <div style={{padding:"12px 18px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${Z.border}`}}>
                    <Avatar name={u.name} size={32}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{u.name}</div>
                      <div style={{fontSize:11,color:Z.muted,marginTop:1}}>{u.role} · {u.department}</div>
                    </div>
                    {expiries.filter(e=>e.ex.status==="expired").length>0 && <Pill label={`${expiries.filter(e=>e.ex.status==="expired").length} expired`} col="red"/>}
                    {expiries.filter(e=>e.ex.status==="expiring").length>0 && <Pill label={`${expiries.filter(e=>e.ex.status==="expiring").length} expiring soon`} col="amber"/>}
                  </div>
                  <div style={{padding:"10px 18px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:8}}>
                    {expiries.map(({m,c,ex})=>(
                      <div key={m.id} style={{padding:"8px 12px",borderRadius:10,background:ex.bg,border:`1px solid ${ex.color}33`,display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:16,flexShrink:0}}>{m.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.title}</div>
                          <div style={{fontSize:10,color:Z.muted,marginTop:1}}>Completed {c.date} · {m.renewalLabel} renewal</div>
                        </div>
                        <span style={{fontSize:10,fontWeight:800,color:ex.color,flexShrink:0,whiteSpace:"nowrap"}}>
                          {ex.status==="expired"?"⚠ Expired":ex.status==="expiring"?`⏳ ${ex.daysLeft}d left`:"✓ Valid"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>

          {/* ── Machinery Competency Expiry ── */}
          {(()=>{
            const today = new Date();
            // Build flat list of comps with expiry dates
            const machExpiries = [];
            staff.forEach(u => {
              Object.values(machineComps[u.id]||{}).forEach(comp => {
                if(!comp.licenceExpiry) return;
                const expDate = new Date(comp.licenceExpiry);
                const daysLeft = Math.round((expDate - today) / 86400000);
                const status = daysLeft < 0 ? "expired" : daysLeft <= 60 ? "expiring" : "valid";
                const bg = status==="expired"?"rgba(239,68,68,0.08)":status==="expiring"?"rgba(245,158,11,0.08)":"rgba(16,185,129,0.08)";
                const color = status==="expired"?"#ef4444":status==="expiring"?"#f59e0b":"#10b981";
                const mType = (allMachineTypes||[]).find(x=>x.id===comp.machineId)||{label:comp.machineId,icon:"🔧"};
                machExpiries.push({ u, comp, expDate, daysLeft, status, bg, color, mType });
              });
            });
            if(!machExpiries.length) return null;

            const mExpired  = machExpiries.filter(x=>x.status==="expired").length;
            const mExpiring = machExpiries.filter(x=>x.status==="expiring").length;
            const mValid    = machExpiries.filter(x=>x.status==="valid").length;

            // Group by staff member
            const byStaff = {};
            machExpiries.forEach(x => {
              if(!byStaff[x.u.id]) byStaff[x.u.id] = { u:x.u, items:[] };
              byStaff[x.u.id].items.push(x);
            });

            return (
              <div style={{marginTop:32}}>
                <div style={{marginBottom:16,paddingTop:24,borderTop:`1px solid ${Z.border}`}}>
                  <h3 style={{fontSize:15,fontWeight:800,color:Z.white,margin:"0 0 4px"}}>Machinery Competency Expiry</h3>
                  <p style={{color:Z.muted,fontSize:13,margin:"0 0 16px"}}>Licence and competency expiry dates from the machinery competency register</p>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    <div style={{background:"rgba(239,68,68,0.1)",borderRadius:12,padding:"14px 20px",flex:1,minWidth:100,textAlign:"center",border:"1px solid rgba(239,68,68,0.2)"}}>
                      <div style={{fontSize:28,fontWeight:900,color:"#ef4444"}}>{mExpired}</div>
                      <div style={{fontSize:11,color:Z.muted,marginTop:2}}>⚠ Expired</div>
                    </div>
                    <div style={{background:"rgba(245,158,11,0.1)",borderRadius:12,padding:"14px 20px",flex:1,minWidth:100,textAlign:"center",border:"1px solid rgba(245,158,11,0.2)"}}>
                      <div style={{fontSize:28,fontWeight:900,color:"#f59e0b"}}>{mExpiring}</div>
                      <div style={{fontSize:11,color:Z.muted,marginTop:2}}>⏳ Expiring &lt;60 days</div>
                    </div>
                    <div style={{background:"rgba(16,185,129,0.1)",borderRadius:12,padding:"14px 20px",flex:1,minWidth:100,textAlign:"center",border:"1px solid rgba(16,185,129,0.2)"}}>
                      <div style={{fontSize:28,fontWeight:900,color:"#10b981"}}>{mValid}</div>
                      <div style={{fontSize:11,color:Z.muted,marginTop:2}}>✓ Valid</div>
                    </div>
                  </div>
                </div>

                <div style={{display:"grid",gap:12}}>
                  {Object.values(byStaff).map(({u, items})=>{
                    const hasIssue = items.some(x=>x.status!=="valid");
                    return (
                      <div key={u.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:`1px solid ${hasIssue?"rgba(239,68,68,0.25)":Z.border}`,overflow:"hidden"}}>
                        <div style={{padding:"12px 18px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${Z.border}`}}>
                          <Avatar name={u.name} size={32}/>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:14,color:Z.white}}>{u.name}</div>
                            <div style={{fontSize:11,color:Z.muted,marginTop:1}}>{u.jobTitle||u.role}</div>
                          </div>
                          {items.filter(x=>x.status==="expired").length>0 && <Pill label={`${items.filter(x=>x.status==="expired").length} expired`} col="red"/>}
                          {items.filter(x=>x.status==="expiring").length>0 && <Pill label={`${items.filter(x=>x.status==="expiring").length} expiring soon`} col="amber"/>}
                        </div>
                        <div style={{padding:"10px 18px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:8}}>
                          {items.map(({comp,expDate,daysLeft,status,bg,color,mType})=>(
                            <div key={comp.id} style={{padding:"8px 12px",borderRadius:10,background:bg,border:`1px solid ${color}33`,display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontSize:16,flexShrink:0}}>{mType.icon||"🔧"}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{mType.label}</div>
                                <div style={{fontSize:10,color:Z.muted,marginTop:1}}>
                                  Expires {comp.licenceExpiry}{comp.licenceRef?` · ${comp.licenceRef}`:""}
                                </div>
                              </div>
                              <span style={{fontSize:10,fontWeight:800,color,flexShrink:0,whiteSpace:"nowrap"}}>
                                {status==="expired"?`⚠ ${Math.abs(daysLeft)}d ago`:status==="expiring"?`⏳ ${daysLeft}d left`:"✓ Valid"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── DSE REPORTS ── */}
      {reportView === "dse" && (
        <AdminDSETab staff={staff} dseReports={dseReports} adminResponses={adminResponses} setAdminResponses={setAdminResponses} darkMode={darkMode} Z={Z} font={font}/>
      )}

      {/* ── DOCUMENT READ STATUS ── */}
      {reportView === "documents" && (
        <div>
          <div style={{marginBottom:24}}>
            <h3 style={{fontSize:15,fontWeight:800,color:Z.white,margin:"0 0 4px"}}>Document Read Status</h3>
            <p style={{color:Z.muted,fontSize:13,margin:0}}>Shows which staff have confirmed reading each assigned document</p>
          </div>

          {docs.filter(d=>(docAssignments[d.id]||[]).length>0).length===0 ? (
            <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:40,textAlign:"center",border:`1px solid ${Z.border}`}}>
              <div style={{fontSize:40,marginBottom:12}}>📄</div>
              <p style={{color:Z.muted,fontSize:14,margin:0}}>No documents have been assigned for reading yet.<br/>Go to Admin → Documents to assign documents to staff.</p>
            </div>
          ) : (
            <div style={{display:"grid",gap:16}}>
              {docs.filter(d=>(docAssignments[d.id]||[]).length>0).map(d=>{
                const extIcons={PDF:"📕",DOCX:"📘",DOC:"📘",XLSX:"📗",XLS:"📗",PPTX:"📙",PPT:"📙",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",TXT:"📄",CSV:"📊"};
                const icon=extIcons[d.ext]||"📄";
                const assignedIds = docAssignments[d.id]||[];
                const assignedStaff = staff.filter(u=>assignedIds.includes(String(u.id)));
                const readStaff   = assignedStaff.filter(u=>(docAcknowledgements[u.id]||{})[d.id]);
                const unreadStaff = assignedStaff.filter(u=>!(docAcknowledgements[u.id]||{})[d.id]);
                const pct = assignedStaff.length ? Math.round(readStaff.length/assignedStaff.length*100) : 0;

                return (
                  <div key={d.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,border:`1px solid ${pct===100?"rgba(16,185,129,0.3)":unreadStaff.length>0?"rgba(239,68,68,0.2)":Z.overlay}`,overflow:"hidden"}}>

                    {/* Doc header */}
                    <div style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:14,borderBottom:`1px solid ${Z.border}`,flexWrap:"wrap"}}>
                      <span style={{fontSize:24,flexShrink:0}}>{icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:15,color:Z.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.title}</div>
                        <div style={{color:Z.muted,fontSize:12,marginTop:2}}>{d.type} · Assigned to {assignedStaff.length} staff member{assignedStaff.length!==1?"s":""}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontSize:20,fontWeight:900,color:pct===100?Z.green:pct>0?Z.amber:"#f87171",fontFamily:"'Barlow Condensed',sans-serif"}}>{pct}%</div>
                          <div style={{fontSize:10,color:Z.muted,letterSpacing:.5}}>READ</div>
                        </div>
                        <Pill label={`✓ ${readStaff.length} read`} col="green"/>
                        {unreadStaff.length>0 && <Pill label={`${unreadStaff.length} unread`} col="red"/>}
                      </div>
                      <Bar pct={pct} color={pct===100?Z.green:pct>0?Z.accent:"#ef4444"}/>
                    </div>

                    {/* Staff read status grid */}
                    <div style={{padding:"14px 20px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8}}>
                      {assignedStaff.map(u=>{
                        const ack=(docAcknowledgements[u.id]||{})[d.id];
                        return (
                          <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,background:ack?"rgba(16,185,129,0.07)":"rgba(239,68,68,0.06)",border:`1px solid ${ack?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.15)"}`}}>
                            <Avatar name={u.name} size={28}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
                              <div style={{fontSize:11,marginTop:1}}>
                                {ack
                                  ? <span style={{color:Z.green}}>✓ Read on {ack.date}</span>
                                  : <span style={{color:"#f87171"}}>⏳ Not yet confirmed</span>
                                }
                              </div>
                            </div>
                            <span style={{fontSize:16,flexShrink:0}}>{ack?"✅":"⏳"}</span>
                          </div>
                        );
                      })}
                    </div>

                    {unreadStaff.length>0 && (
                      <div style={{padding:"10px 20px",background:"rgba(245,158,11,0.06)",borderTop:"1px solid rgba(245,158,11,0.12)"}}>
                        <span style={{fontSize:12,color:Z.amber,fontWeight:600}}>
                          ⚠ {unreadStaff.length} staff member{unreadStaff.length!==1?" have":" has"} not yet confirmed reading this document: {unreadStaff.map(u=>u.name.split(" ")[0]).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { ReportsTab };