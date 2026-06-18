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
  };
}

export { formToInc };
