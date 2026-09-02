import type { CaseFileStatusResponse } from "./cases.dto.js";

/**
 * Projette un dossier vers le DTO de statut (support du polling écran 04).
 * N'expose QUE l'id et l'état d'analyse — jamais le contenu dérivé, qui relève
 * de l'écran de résultat (E4, hors périmètre E3).
 */
export function toCaseStatusDto(caseFile: {
  id: string;
  analysisStatus: CaseFileStatusResponse["analysisStatus"];
}): CaseFileStatusResponse {
  return { id: caseFile.id, analysisStatus: caseFile.analysisStatus };
}
