/**
 * Converts the incident FORM state (all strings, as edited in IncidentForm) back
 * into an INCIDENT record for storage, trimming free-text fields.
 * The inverse of incToForm() — if you add a field to the incident form, add it
 * to BOTH functions or it will be lost on save/edit.
 *
 * @param {object} form      Current IncidentForm values.
 * @param {object} existing  The original incident (spread first so fields the form
 *                           doesn't know about — id, photos, closed, RIDDOR flags… — are kept).
 * @returns {object} merged incident record
 */
// Fields without their own column in the incidents table are saved in its jsonb
// `details` column (App.jsx dbSaveIncident / INCIDENT_CORE_KEYS), so they survive a reload.
function formToInc(form, existing) {
  return {
    ...existing,
    date: form.date, time: form.time,
    type: form.type,
    accidentCode: form.accidentCode,
    numberCode: parseInt(form.numberCode)||form.numberCode,
    location: form.location.trim(),
    description: form.description.trim(),
    injuryType: form.injuryType,
    riddor: form.riddor,
    personName: form.personName.trim(), personDob: form.personDob,
    personAddress: form.personAddress.trim(), personPostcode: form.personPostcode.trim(),
    witness1Name: form.witness1Name.trim(), witness1Contact: form.witness1Contact.trim(),
    witness2Name: form.witness2Name.trim(), witness2Contact: form.witness2Contact.trim(),
    firstAidProvided: form.firstAidProvided, firstAidDetails: form.firstAidDetails.trim(), firstAidBy: form.firstAidBy.trim(),
    postIncidentOutcome: form.postIncidentOutcome,
    immediateMeasures: form.immediateMeasures.trim(),
    correctiveActions: form.correctiveActions.trim(), correctiveActionsBy: form.correctiveActionsBy.trim(),
    equipmentInvolved: form.equipmentInvolved||false,
    equipmentId: form.equipmentInvolved ? (form.equipmentId||"") : "",
    equipmentDamaged: form.equipmentInvolved && form.equipmentDamaged,
    equipmentDamageDesc: (form.equipmentInvolved && form.equipmentDamaged) ? (form.equipmentDamageDesc||"").trim() : "",
    equipmentDamageSeverity: (form.equipmentInvolved && form.equipmentDamaged) ? (form.equipmentDamageSeverity||"medium") : "",
    equipmentOOS: form.equipmentInvolved && form.equipmentOOS,
    // Evidence photos & files added or removed on the form (uploaded on save by App.jsx).
    photos: Array.isArray(form.photos) ? form.photos : (existing && existing.photos) || [],
  };
}

export { formToInc };
