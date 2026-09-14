import type { CaseStatus } from "@capclair/contract";

/**
 * E5 US-5.1 — libellés FR des 6 statuts de pilotage du dossier. Réutilisé par
 * le badge (écran 05, lecture seule) et le sélecteur (écran 06, US-5.1 AC2).
 */
const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  A_ANALYSER: "À analyser",
  ACTION_REQUISE: "Action requise",
  DOCUMENTS_A_PREPARER: "Documents à préparer",
  REPONSE_PRETE: "Réponse prête",
  EN_ATTENTE: "En attente",
  TERMINE: "Terminé",
};

/** Ordre d'affichage des 6 statuts (options du sélecteur, écran 06). */
export const CASE_STATUSES = Object.keys(CASE_STATUS_LABELS) as CaseStatus[];

export function caseStatusLabel(status: CaseStatus): string {
  return CASE_STATUS_LABELS[status];
}
