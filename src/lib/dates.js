function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getExpiryStatus(completionDate, renewalMonths) {
  // returns: { expiryDate, daysLeft, status: "valid"|"expiring"|"expired", label }
  if (!completionDate || !renewalMonths) return null;
  const expiry = addMonths(completionDate, renewalMonths);
  const today  = new Date();
  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  const expiryStr = expiry.toISOString().slice(0,10);
  if (daysLeft < 0)  return { expiryDate:expiryStr, daysLeft, status:"expired",  label:"Expired",          color:"#ef4444", bg:"rgba(239,68,68,0.15)"  };
  if (daysLeft <= 60) return { expiryDate:expiryStr, daysLeft, status:"expiring", label:`Expires in ${daysLeft}d`, color:"#f59e0b", bg:"rgba(245,158,11,0.15)" };
  return               { expiryDate:expiryStr, daysLeft, status:"valid",    label:`Valid until ${expiryStr}`,  color:"#10b981", bg:"rgba(16,185,129,0.12)" };
}

// ─── Zeus Logo SVG (text-based approximation) ────────────────────────────────

export { addMonths, getExpiryStatus };
