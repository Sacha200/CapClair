/**
 * Appels API des dossiers (E3). Routes sous le scope gardé `/api/*` : le
 * cookie de session part automatiquement (même origine via le rewrite).
 */
import {
  CASE_FILE_PATHS,
  type CaseFileHistoryResponse,
  type CaseFileListResponse,
  type CaseFileResultResponse,
  type CaseFileStatusResponse,
  type CreateActionInput,
  type StartAnalysisResponse,
  type UpdateActionInput,
  type UpdateCaseScalarsInput,
  type UpdateCaseStatusInput,
  type UpdateExtractedInfoInput,
  type UpdateMainDeadlineInput,
  type UpdateRequiredDocInput,
} from "@capclair/contract";
import { apiRequest } from "./client";

/**
 * US-5.4 — liste des dossiers du compte + résumé du tableau de bord. Appelé
 * par le server component de `/dashboard`, `cookieHeader` relaie le cookie de
 * la requête entrante (gabarit `getCaseResult`).
 */
export function listCases(cookieHeader?: string): Promise<CaseFileListResponse> {
  return apiRequest(CASE_FILE_PATHS.list(), { method: "GET", cookieHeader });
}

/** Statut d'analyse d'un dossier — support du polling de l'écran 04. */
export function getCaseFile(id: string): Promise<CaseFileStatusResponse> {
  return apiRequest(CASE_FILE_PATHS.detail(id), { method: "GET" });
}

/**
 * Graphe complet d'un dossier analysé — écran 05 (E4). Appelé une seule fois
 * par le server component : `200` seulement si `analysisStatus === "TERMINEE"`,
 * sinon `ApiError` (`409` `analysis_not_ready` tant que l'analyse tourne, `404`
 * si le dossier n'existe pas / appartient à un autre compte). Côté serveur, on
 * relaie l'en-tête `Cookie` de la requête entrante.
 */
export function getCaseResult(
  id: string,
  cookieHeader?: string,
): Promise<CaseFileResultResponse> {
  return apiRequest(CASE_FILE_PATHS.result(id), { method: "GET", cookieHeader });
}

/**
 * Consentement à l'envoi du texte extrait au prestataire d'IA (US-3.1).
 * Action distincte de la confirmation « document fictif ».
 */
export function confirmAiConsent(id: string): Promise<{ ok: true }> {
  return apiRequest(CASE_FILE_PATHS.consentAi(id), {
    method: "POST",
    body: { confirmed: true },
  });
}

/** Déclenche l'analyse asynchrone (202 `EN_ATTENTE`). 403 sans consentement. */
export function startAnalysis(id: string): Promise<StartAnalysisResponse> {
  return apiRequest(CASE_FILE_PATHS.analyze(id), { method: "POST" });
}

/**
 * US-4.4 — corrige une information extraite. Le serveur pose `isUserCorrected`
 * et journalise ; `404` si l'info n'est pas dans ce dossier de ce compte.
 */
export function updateExtractedInfo(
  id: string,
  infoId: string,
  body: UpdateExtractedInfoInput,
): Promise<{ ok: true }> {
  return apiRequest(CASE_FILE_PATHS.updateInfo(id, infoId), { method: "PATCH", body });
}

/**
 * US-4.4 AC5 — corrige l'échéance principale (date `YYYY-MM-DD`). `400`
 * `deadline_before_document` si la date précède la date du courrier.
 */
export function updateMainDeadline(
  id: string,
  body: UpdateMainDeadlineInput,
): Promise<{ ok: true }> {
  return apiRequest(CASE_FILE_PATHS.deadline(id), { method: "PATCH", body });
}

/** US-4.4 AC1 — corrige organisme / type de courrier / date du courrier. */
export function updateCaseScalars(
  id: string,
  body: UpdateCaseScalarsInput,
): Promise<{ ok: true }> {
  return apiRequest(CASE_FILE_PATHS.detail(id), { method: "PATCH", body });
}

/**
 * US-4.5 — historique du dossier (entrées du plus récent au plus ancien,
 * libellés FR). `404` si le dossier n'existe pas / appartient à un autre compte.
 */
export function getCaseHistory(
  id: string,
  cookieHeader?: string,
): Promise<CaseFileHistoryResponse> {
  return apiRequest(CASE_FILE_PATHS.history(id), { method: "GET", cookieHeader });
}

/** US-5.1 AC2 — change le statut de pilotage du dossier (écran 06). */
export function updateCaseStatus(
  id: string,
  body: UpdateCaseStatusInput,
): Promise<{ ok: true }> {
  return apiRequest(CASE_FILE_PATHS.status(id), { method: "PATCH", body });
}

/** US-5.2 AC2 — ajoute une action manuelle (écran 06). */
export function createAction(id: string, body: CreateActionInput): Promise<{ id: string }> {
  return apiRequest(CASE_FILE_PATHS.actions(id), { method: "POST", body });
}

/** US-5.2 AC1 — coche/décoche une action (écran 06). */
export function toggleAction(
  id: string,
  actionId: string,
  body: UpdateActionInput,
): Promise<{ ok: true }> {
  return apiRequest(CASE_FILE_PATHS.action(id, actionId), { method: "PATCH", body });
}

/** US-5.2 AC3 — supprime définitivement une action (écran 06). */
export function deleteAction(id: string, actionId: string): Promise<{ ok: true }> {
  return apiRequest(CASE_FILE_PATHS.action(id, actionId), { method: "DELETE" });
}

/** US-5.3 AC1/AC2 — coche « fourni » et/ou pose une note libre sur un justificatif (écran 06). */
export function updateRequiredDoc(
  id: string,
  docId: string,
  body: UpdateRequiredDocInput,
): Promise<{ ok: true }> {
  return apiRequest(CASE_FILE_PATHS.requiredDoc(id, docId), { method: "PATCH", body });
}

/** US-5.5 — suppression définitive et complète du dossier (écran 06). */
export function deleteCase(id: string): Promise<{ ok: true }> {
  return apiRequest(CASE_FILE_PATHS.detail(id), { method: "DELETE" });
}
