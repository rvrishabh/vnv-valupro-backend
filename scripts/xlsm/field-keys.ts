/**
 * Maps a workbook input cell to the semantic key the API and UI use for it.
 *
 * The workbook identifies a dropdown by cell reference; the application needs a
 * stable name. Keeping the mapping in one place means a dropdown's options can
 * be re-extracted from a revised book without touching application code.
 */
export const FIELD_KEYS: Record<string, Record<string, string>> = {
  'M-Doc': {
    C7: 'methodOfValuation',
    C8: 'propertyType',
    C12: 'bank',
    C14: 'city',
    C15: 'receivedThrough',
    C33: 'ownershipType',
    C34: 'sharesDivided',
    C48: 'tehsil',
    C50: 'wardTehsilRegistration',
    C55: 'assetsSoldAsPerDeed',
    C62: 'tenure',
    C80: 'boundariesMatching',
    C81: 'boundaryMismatchReason',
    C82: 'plotDemarcated',
    C83: 'ownershipVerified',
    C91: 'unitOfDimensions',
    C92: 'unitOfArea',
    C108: 'areaUnderConsideration',
    C122: 'totalFloors',
    C123: 'floorSituated',
    C124: 'flatType',
  },
  'M-Rate': {
    C4: 'typeOfConstruction',
    C5: 'foundation',
    C12: 'qualityOfConstruction',
    C13: 'stageOfConstruction',
    C16: 'roofingTerracing',
    C19: 'waterSupply',
    C20: 'sewerage',
    C21: 'typeOfRoad',
    C22: 'widthOfRoad',
    C23: 'maintenance',
    C24: 'exterior',
    C25: 'interior',
    C26: 'appearanceOfBuilding',
    C39: 'plotPosition',
    C59: 'coveredAreaConsideration',
    // Floorwise specifications (M-Rate 65-79), applied per floor.
    C66: 'floor.walls',
    C67: 'floor.partitions',
    C68: 'floor.doors',
    C69: 'floor.windows',
    C70: 'floor.flooring',
    C71: 'floor.finishing',
    C72: 'floor.ceiling',
    C73: 'floor.roofingTerracing',
    C74: 'floor.roofType',
    C75: 'floor.wiring',
    C76: 'floor.electricalFittings',
    C77: 'floor.sanitaryInstallations',
    C79: 'floor.constructionCategory',
  },
  'M-Gen': {
    C3: 'approvedColony',
    C4: 'buildingPlanApproved',
    C5: 'approvingAuthority',
    C6: 'constructionAsPerLayout',
    C8: 'natureOfViolations',
    C9: 'propertyTaxPaid',
    C10: 'occupancyStatus',
    C13: 'occupantsRelated',
    C14: 'tenancy',
    C24: 'cityTownVillage',
    C25: 'approvedLandUse',
    C26: 'purposeOfUse',
    C27: 'classOfLocality',
    C28: 'urbanSemiUrbanRural',
    C29: 'corporationLimit',
    C30: 'restrictiveCovenant',
    C31: 'usedForSanctionedPurpose',
    C32: 'proximityToAmenities',
    C37: 'developmentOfArea',
    C38: 'levelOfLand',
    C39: 'roadFacilities',
    C44: 'floodingProne',
    C47: 'plotShape',
    C68: 'powerSupply',
  },
};

/** Sq.ft/Sq.m rows the workbook repeats across floors share one option list. */
export function keyFor(sheet: string, cellRef: string): string | undefined {
  const col = cellRef.split(':')[0];
  return FIELD_KEYS[sheet]?.[col];
}
