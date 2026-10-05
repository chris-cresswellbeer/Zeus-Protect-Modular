/**
 * data/seedRiskAssessments.js — blank hazard template for the risk assessment builder.
 * (The ten Biggleswade baseline risk assessments that used to be built in are now rows in
 * the risk_assessments table — site_content.sql put them there; demo/seedRiskAssessments.js
 * keeps a copy for the test scripts.)
 * EMPTY_HAZARD(): factory for a new hazard row (call it — it returns a fresh object with a new id).
 */

const EMPTY_HAZARD = () => ({
  id: "h"+Date.now()+Math.random(),
  hazard:"", whoAffected:"", existingControls:"",
  initialRisk:{ likelihood:0, severity:0 },
  furtherControls:"", responsiblePerson:"", targetDate:"",
  residualRisk:{ likelihood:0, severity:0 },
  actionComplete: false,
});

export { EMPTY_HAZARD };
