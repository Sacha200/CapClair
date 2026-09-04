/**
 * Formatage d'affichage de l'écran 05 (E4). Fonctions pures, testées
 * unitairement — la logique métier (dérivation de `verifiable`, du niveau de
 * confiance affiché, de `overdue`…) reste côté serveur (`cases.mapper.ts`).
 */
import type { DisplayConfidence } from "@capclair/contract";

/** US-4.1 — libellé lisible de l'organisme détecté. */
const ORGANISME_LABELS: Record<string, string> = {
  CAF: "CAF",
  CPAM: "CPAM",
  FRANCE_TRAVAIL: "France Travail",
  INDETERMINE: "Organisme non déterminé",
};

export function organismeLabel(code: string): string {
  return ORGANISME_LABELS[code] ?? "Organisme non déterminé";
}

/** Date ISO → « 2 août 2026 ». Chaîne vide si la date est absente/invalide. */
export function formatFrenchDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * US-4.3 AC2 / D10 — libellé texte du niveau de confiance affiché. `null` pour
 * `ELEVE` (aucun signal, cf. décision D10). Jamais porté par la seule couleur.
 */
export function confidenceLabel(
  level: DisplayConfidence,
  lowLabel = "À vérifier",
): string | null {
  if (level === "FAIBLE") return lowLabel;
  if (level === "MOYEN") return "Confiance moyenne";
  return null;
}
