/**
 * Appels API des dossiers (E3). Routes sous le scope gardé `/api/*` : le
 * cookie de session part automatiquement (même origine via le rewrite).
 */
import {
  CASE_FILE_PATHS,
  type CaseFileStatusResponse,
  type StartAnalysisResponse,
} from "@capclair/contract";
import { apiRequest } from "./client";

/** Statut d'analyse d'un dossier — support du polling de l'écran 04. */
export function getCaseFile(id: string): Promise<CaseFileStatusResponse> {
  return apiRequest(CASE_FILE_PATHS.detail(id), { method: "GET" });
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
