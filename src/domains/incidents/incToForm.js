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
