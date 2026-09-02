/**
 * Mesure des caractères « utiles » d'un texte extrait (US-2.6 AC1).
 *
 * Barrière dure : sous `UNREADABLE_TEXT_THRESHOLD` caractères utiles, l'analyse
 * n'est pas lancée et aucun appel à l'API d'IA n'est effectué. Le seuil vit dans
 * le contrat partagé (`@capclair/contract`) : le front affiche le même verdict.
 */
import { UNREADABLE_TEXT_THRESHOLD } from "@capclair/contract";

export { UNREADABLE_TEXT_THRESHOLD };

/** Longueur après compactage des blancs (espaces, tabulations, sauts de ligne). */
export function usefulLength(text: string): number {
  return text.replace(/\s+/g, " ").trim().length;
}

export function isReadable(text: string): boolean {
  return usefulLength(text) >= UNREADABLE_TEXT_THRESHOLD;
}
