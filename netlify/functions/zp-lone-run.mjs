/**
 * netlify/functions/zp-lone-run.mjs — lone working check (and red racking alerts not yet
 * sent, see netlify/shared/rackingJob.mjs), every 2 minutes.
 * Scheduled in netlify.toml. Netlify only runs schedules on the PUBLISHED (live) deploy;
 * on staging, zp-lone (called by the phone after "I need help" and by the portal's
 * Lone working screen) does the same check. See netlify/shared/loneJob.mjs.
 */
import { runLoneJob } from "../shared/loneJob.mjs";
import { runRackingJob } from "../shared/rackingJob.mjs";

export const handler = async () => {
  try {
    const r = await runLoneJob({});
    if (r.changed || !r.ok) console.log(`[zp-lone-run] ${r.changed || 0} changed, ${r.emailed || 0} emailed, ${r.failed || 0} failed ${r.message || ""}`);
  } catch (e) { console.error(`[zp-lone-run] failed: ${e.message}`); }
  // red racking alerts not yet sent (normally zp-racking sends them straight away)
  try {
    const r = await runRackingJob({});
    if (r.alerted || !r.ok) console.log(`[zp-lone-run] racking: ${r.alerted || 0} alerted, ${r.emailed || 0} emailed ${r.message || ""}`);
  } catch (e) { console.error(`[zp-lone-run] racking failed: ${e.message}`); }
  return { statusCode: 200 };
};
