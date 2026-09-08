/**
 * US-4.5 AC2 — libellé FR compréhensible d'un `AuditEvent.eventType` pour
 * l'écran d'historique. Aucun nom technique n'est jamais affiché ; un type
 * inconnu (ou produit par un epic ultérieur non prévu ici) retombe sur un
 * libellé générique.
 */
const LABELS: Record<string, string> = {
  "document.imported": "Courrier importé",
  "analysis.completed": "Analyse terminée",
  "analysis.failed": "L'analyse n'a pas abouti",
  "information.corrected": "Information corrigée",
  "deadline.corrected": "Échéance modifiée",
  "case.updated": "Détails du courrier modifiés",
  // Types émis par des epics ultérieurs — libellés prêts (E5 statuts/actions, E7 rappels).
  "case.status_changed": "Statut du dossier modifié",
  "action.completed": "Action cochée",
  "action.reopened": "Action rouverte",
  "reminder.sent": "Rappel envoyé",
  "case.deleted": "Dossier supprimé",
};

export function historyLabel(eventType: string): string {
  return LABELS[eventType] ?? "Modification du dossier";
}
