/**
 * netlify/functions/zp-email-run.mjs — the email reminder job, every 15 minutes.
 * Scheduled in netlify.toml. Netlify only runs schedules on the PUBLISHED (live)
 * deploy, never on staging or previews; use the "Send now" button there instead.
 * See netlify/shared/emailJob.mjs for what it does and the settings it needs.
 */
import { runEmailJob } from "../shared/emailJob.mjs";

export const handler = async () => {
  try {
    const r = await runEmailJob({ mode: "scheduled" });
    console.log(`[zp-email-run] ${r.message || ""}`);
  } catch (e) {
    console.error(`[zp-email-run] failed: ${e.message}`);
  }
  return { statusCode: 200, body: "" };
};
