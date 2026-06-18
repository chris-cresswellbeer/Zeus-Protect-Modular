function generateRAHtml(ra) {
  const riskBadge = (l,s) => {
    if (!l||!s) return '<span style="color:#888">—</span>';
    const score=l*s;
    const col = score>=15?"#dc2626":score>=10?"#f97316":score>=5?"#f59e0b":score>=3?"#22c55e":"#10b981";
    const lbl = score>=15?"Very High":score>=10?"High":score>=5?"Medium":score>=3?"Low":"Very Low";
    return `<span style="background:${col};color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px">${lbl} (${score})</span>`;
  };

  const rows = ra.hazards.map((h,i)=>`
    <tr style="background:${i%2===0?"#f8faff":"#fff"}">
      <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;vertical-align:top">${i+1}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top">${h.hazard||"—"}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top">${h.whoAffected||"—"}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top">${h.existingControls||"—"}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;vertical-align:top">${riskBadge(h.initialRisk.likelihood,h.initialRisk.severity)}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top">${h.furtherControls||"—"}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top">${h.responsiblePerson||"—"}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;vertical-align:top">${h.targetDate||"—"}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;vertical-align:top">${riskBadge(h.residualRisk.likelihood,h.residualRisk.severity)}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;vertical-align:top">${h.actionComplete?"<span style='color:#10b981;font-weight:700'>✓ Done</span>":"<span style='color:#f59e0b'>Pending</span>"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${ra.title} — Risk Assessment</title>
  <style>body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;margin:0;padding:24px 32px;background:#fff}
  h1{font-size:22px;margin:0 0 4px;color:#0d1f5c}h2{font-size:14px;color:#64748b;margin:0 0 20px;font-weight:400}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;background:#f0f4ff;padding:16px;border-radius:8px;margin-bottom:24px}
  .meta-item label{font-size:10px;font-weight:700;letter-spacing:.5px;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px}
  .meta-item span{font-size:13px;font-weight:600;color:#1e293b}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#0d1f5c;color:#fff;padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.3px}
  .footer{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
  </style></head><body>
  <h1>⚠ Risk Assessment: ${ra.title}</h1>
  <h2>${ra.location} &nbsp;·&nbsp; ${ra.activity}</h2>
  <div class="meta">
    <div class="meta-item"><label>Reference</label><span>${ra.reference||"—"}</span></div>
    <div class="meta-item"><label>Assessor</label><span>${ra.assessor||"—"}</span></div>
    <div class="meta-item"><label>Review Date</label><span>${ra.reviewDate||"—"}</span></div>
    <div class="meta-item"><label>Date Created</label><span>${ra.date}</span></div>
    <div class="meta-item"><label>Department</label><span>${ra.department||"—"}</span></div>
    <div class="meta-item"><label>Status</label><span style="color:#10b981;font-weight:700">Completed</span></div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Hazard</th><th>Who Affected</th><th>Existing Controls</th>
      <th>Initial Risk</th><th>Further Controls Required</th>
      <th>Responsible Person</th><th>Target Date</th><th>Residual Risk</th><th>Complete</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>Zeus Health &amp; Safety Portal &nbsp;·&nbsp; Generated ${ra.date}</span>
    <span>Assessor: ${ra.assessor||"—"} &nbsp;·&nbsp; Review: ${ra.reviewDate||"—"}</span>
  </div>
  </body></html>`;
}

export { generateRAHtml };
