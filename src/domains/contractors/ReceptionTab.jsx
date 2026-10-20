/**
 * ReceptionTab — staff menu → Reception, for people an admin has given Reception access
 * (Edit Staff; users.data.reception). Admins use Contractors instead.
 *
 * Who is on site now (OnSiteBoard.jsx): contractors who signed in with the reception QR code
 * and visits H&S logged, with anything to check (company not approved, permit to work not
 * issued, new company), one-tap Sign out, the end-of-day reminder and the fire roll call.
 * Reception can see the register and sign people out, nothing more (contractor_approval.sql).
 */
import React from "react";
import { useSiteSignins, useSigninSettings } from "../../lib/siteSignins";
import { OnSiteBoard, useRegisterCatchUp } from "./OnSiteBoard";

export function ReceptionTab({ me, contractors, contractorVisits, contractorCerts, permits, refreshContractors, T, font }) {
  const signins = useSiteSignins(true, { fresh: true });
  const settings = useSigninSettings(true);
  useRegisterCatchUp(signins, contractors, refreshContractors);
  return (
    <div data-testid="reception-tab">
      <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -.5, margin: "0 0 4px", color: T.white }}>Reception</h2>
      <p style={{ color: T.muted, fontSize: 13, margin: "0 0 18px", lineHeight: 1.5, maxWidth: 760 }}>
        Contractors on site now. They sign in and out with the QR code on the reception poster; if someone leaves without signing out, tap <b>Sign out</b>.
        Anything amber or red is for you to check with them or their host before work starts. In a fire evacuation, press <b>🔥 Roll call</b> and take the list to the assembly point.
      </p>
      <OnSiteBoard signins={signins} contractors={contractors} contractorVisits={contractorVisits} contractorCerts={contractorCerts} permits={permits}
        settings={settings} me={me} T={T} font={font}/>
    </div>
  );
}
