import { getExpiryStatus } from "../../lib/dates";
import { EXT_CERT_TYPES } from "../../data/seedExtCerts";
import { MACHINERY_TYPES } from "../../data/seedMachinery";
import { E } from "../../lib/emoji";

function generateStaffPDF(u, allModules, assigns, comps, docs, docAssignments, docAcknowledgements, extCerts, machineComps, lastLoginMap, Z, allMachineTypes) {
  const machineTypes = allMachineTypes || MACHINERY_TYPES;
  const today = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
  const assignedIds = assigns[u.id]||[];
  const userComps = comps[u.id]||{};
  const a = assignedIds.length;
  const d = assignedIds.filter(mid=>userComps[mid]).length;
  const pct = a ? Math.min(100,Math.round(d/a*100)) : 0;
  const status = pct===100?"Compliant":pct>=50?"In Progress":"Overdue";
  const lastLogin = lastLoginMap[u.id]||"Never";

  // Training rows
  const trainingRows = assignedIds.map(mid=>{
    const m = allModules.find(x=>x.id===mid);
    const c = userComps[mid];
    if (!m) return "";
    const passed = c && c.score>=70;
    const statusTxt = !c?"Not started":passed?"Passed":"Failed";
    const score = c?`${c.score}%`:"—";
    const date = c?c.date:"—";
    const certId = c?.certId||"—";
    let expiry = "—";
    if (c && m.renewalMonths) {
      const ex = getExpiryStatus(c.date, m.renewalMonths);
      expiry = ex ? ex.expiryDate : "—";
    }
    const rowColor = !c?"#fff2f2":passed?"#f0fff4":"#fff8f0";
    const statusColor = !c?"#999":passed?"#15803d":"#b45309";
    return `<tr style="background:${rowColor}">
      <td>${m.icon||""} ${m.title}</td>
      <td style="color:${statusColor};font-weight:600">${statusTxt}</td>
      <td style="text-align:center">${score}</td>
      <td>${date}</td>
      <td>${expiry}</td>
      <td style="font-family:monospace;font-size:11px">${certId}</td>
    </tr>`;
  }).join("");

  // Document acknowledgements
  const assignedDocs = docs.filter(doc=>(docAssignments[String(doc.id)]||[]).includes(String(u.id)));
  const docRows = assignedDocs.map(doc=>{
    const ack=(docAcknowledgements[u.id]||{})[doc.id];
    return `<tr style="background:${ack?"#f0fff4":"#fff2f2"}">
      <td>${doc.title}</td>
      <td>${doc.type||"—"}</td>
      <td style="color:${ack?"#15803d":"#dc2626"};font-weight:600">${ack?`✓ Confirmed ${ack.date}`:"⏳ Not yet confirmed"}</td>
      <td>${doc.version?`v${doc.version}`:"v1"}</td>
    </tr>`;
  }).join("");

  // External certificates
  const userExtCerts = extCerts[u.id]||{};
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

  // Machinery
  const userMachineComps = Object.values(machineComps[u.id]||{});
  const machineRows = userMachineComps.map(mc=>{
    const mType = machineTypes.find(x=>x.id===mc.machineId)||{label:mc.machineId,icon:"🔧"};
    const expired = mc.licenceExpiry && mc.licenceExpiry < new Date().toISOString().slice(0,10);
    return `<tr style="background:${expired?"#fff8f0":"#fff"}">
      <td>${mType.icon||"🔧"} ${mType.label||mc.machineId}</td>
      <td style="color:${mc.status==="competent"?"#15803d":mc.status==="provisional"?"#b45309":"#dc2626"};font-weight:600;text-transform:capitalize">${mc.status||"—"}</td>
      <td>${mc.assessedDate||"—"}</td>
      <td style="color:${expired?"#dc2626":"inherit"}">${mc.licenceExpiry||"—"}${expired?" ⚠ Expired":""}</td>
    </tr>`;
  }).join("");

  const statusColor = pct===100?"#15803d":pct>=50?"#b45309":"#dc2626";

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Compliance Report — ${u.name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background:#fff; padding:32px; font-size:13px; }
  @media print { body { padding:20px; } @page { margin:15mm; size:A4; } }
  .header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:28px; padding-bottom:18px; border-bottom:3px solid #0d1f5c; }
  .header-left h1 { font-size:22px; font-weight:900; color:#0d1f5c; margin-bottom:4px; }
  .header-left p { color:#64748b; font-size:12px; }
  .header-right { text-align:right; }
  .status-badge { display:inline-block; padding:6px 16px; border-radius:20px; font-size:13px; font-weight:700; color:${statusColor}; background:${pct===100?"#f0fff4":pct>=50?"#fff8f0":"#fff2f2"}; border:2px solid ${statusColor}; }
  .meta-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:24px; }
  .meta-card { background:#f8fafc; border-radius:10px; padding:12px 16px; border:1px solid #e2e8f0; }
  .meta-card .label { font-size:10px; font-weight:700; letter-spacing:.5px; color:#94a3b8; text-transform:uppercase; margin-bottom:4px; }
  .meta-card .value { font-size:16px; font-weight:800; color:#0d1f5c; }
  h2 { font-size:14px; font-weight:800; color:#0d1f5c; margin:20px 0 10px; padding-bottom:6px; border-bottom:2px solid #e2e8f0; text-transform:uppercase; letter-spacing:.5px; }
  table { width:100%; border-collapse:collapse; margin-bottom:4px; font-size:12px; }
  th { background:#0d1f5c; color:#fff; padding:8px 12px; text-align:left; font-size:11px; font-weight:700; letter-spacing:.3px; }
  td { padding:8px 12px; border-bottom:1px solid #e2e8f0; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; }
  .no-data { padding:12px 16px; color:#94a3b8; font-style:italic; background:#f8fafc; border-radius:6px; margin-bottom:4px; }
</style>
</head><body>
  <div class="header">
    <div class="header-left">
      <h1>${u.name}</h1>
      <p>${u.jobTitle||""}${u.jobTitle&&u.manager?" · ":""}${u.manager?"Manager: "+u.manager:""}</p>
      <p style="margin-top:4px;color:#94a3b8">Report generated: ${today}</p>
    </div>
    <div class="header-right">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:6px">Zeus Protect H&S Portal</div>
      <div class="status-badge">${status} — ${pct}%</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px">Last active: ${lastLogin}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-card"><div class="label">Modules Assigned</div><div class="value">${a}</div></div>
    <div class="meta-card"><div class="label">Modules Completed</div><div class="value">${d}</div></div>
    <div class="meta-card"><div class="label">Overall Compliance</div><div class="value" style="color:${statusColor}">${pct}%</div></div>
  </div>

  <h2>${E("📚 ","")}Training Modules</h2>
  ${assignedIds.length===0
    ? '<div class="no-data">No modules assigned</div>'
    : `<table><thead><tr><th>Module</th><th>Status</th><th>Score</th><th>Date</th><th>Expiry</th><th>Certificate ID</th></tr></thead><tbody>${trainingRows}</tbody></table>`
  }

  <h2>${E("📄 ","")}Document Acknowledgements</h2>
  ${assignedDocs.length===0
    ? '<div class="no-data">No documents assigned</div>'
    : `<table><thead><tr><th>Document</th><th>Type</th><th>Acknowledgement</th><th>Version</th></tr></thead><tbody>${docRows}</tbody></table>`
  }

  <h2>${E("🩺 ","")}External Certificates</h2>
  <table><thead><tr><th>Certificate</th><th>Status</th><th>Issue Date</th><th>Expiry Date</th></tr></thead><tbody>${extCertRows}</tbody></table>

  ${userMachineComps.length>0?`
  <h2>${E("⚙ ","")}Machinery Competence</h2>
  <table><thead><tr><th>Machine</th><th>Status</th><th>Assessed</th><th>Licence Expiry</th></tr></thead><tbody>${machineRows}</tbody></table>
  `:""}

  <div class="footer">
    <span>Zeus Protect Health & Safety Portal · Confidential</span>
    <span>${u.email}</span>
    <span>Generated ${today}</span>
  </div>
</body></html>`;

  const win = window.open("","_blank","width=900,height=700");
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}


export { generateStaffPDF };