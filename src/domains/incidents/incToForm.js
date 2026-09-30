/**
 * Converts a stored INCIDENT record into IncidentForm state: every field gets a
 * safe default ("" / false / "No") so controlled inputs never receive undefined.
 * Inverse of formToInc() — keep the two field lists in step.
 *
 * @param {object} inc            Incident record.
 * @param {Array}  equipmentList  Equipment register, carried on the form as
 *                                `_equipmentList` so the form can offer a
 *                                "link to equipment" picker. The underscore marks it
 *                                as UI-only — formToInc does not copy it back.
 */
function incToForm(inc, equipmentList) {
  return {
    type: inc.type||"near_miss",
    date: inc.date||"", time: inc.time||"",
    location: inc.location||"", description: inc.description||"",
    accidentCode: inc.accidentCode||"", numberCode: inc.numberCode||"",
    injuryType: inc.injuryType||"None / No injury", riddor: inc.riddor||false,
    personName: inc.personName||"", personDob: inc.personDob||"",
    personAddress: inc.personAddress||"", personPostcode: inc.personPostcode||"",
    witness1Name: inc.witness1Name||"", witness1Contact: inc.witness1Contact||"",
    witness2Name: inc.witness2Name||"", witness2Contact: inc.witness2Contact||"",
    firstAidProvided: inc.firstAidProvided||"No", firstAidDetails: inc.firstAidDetails||"", firstAidBy: inc.firstAidBy||"",
    postIncidentOutcome: inc.postIncidentOutcome||"",
    immediateMeasures: inc.immediateMeasures||"",
    correctiveActions: inc.correctiveActions||"", correctiveActionsBy: inc.correctiveActionsBy||"",
    photos: Array.isArray(inc.photos) ? inc.photos : [],
    equipmentInvolved: inc.equipmentInvolved||false,
    equipmentId: inc.equipmentId||"",
    equipmentDamaged: inc.equipmentDamaged||false,
    equipmentDamageDesc: inc.equipmentDamageDesc||"",
    equipmentDamageSeverity: inc.equipmentDamageSeverity||"medium",
    equipmentOOS: inc.equipmentOOS||false,
    _equipmentList: equipmentList||[],
  };
}

export { incToForm };
