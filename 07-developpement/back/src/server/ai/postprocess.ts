/**
 * Contrôles de forme sur la sortie IA (US-3.4, US-3.5).
 *
 * NON bloquant : une réponse structurellement valide (schéma Zod) n'est jamais
 * rejetée ici. Ces mesures alimentent les compteurs de l'`AuditEvent`
 * (`worker/analysis.ts`) et le rapport du test corpus (plan E3 §8) — la qualité
 * rédactionnelle se mesure, elle ne se force pas au prix d'une troncature
 * hasardeuse.
 */

/** Bornes US-3.4 AC1/AC2 pour le résumé. */
export const SUMMARY_MIN_SENTENCES = 3;
export const SUMMARY_MAX_SENTENCES = 8;
export const SUMMARY_MAX_WORDS_PER_SENTENCE = 25;

/** Borne US-3.5 AC1 pour un titre d'action (formulé à l'infinitif). */
export const ACTION_MAX_WORDS = 15;

/** Découpe naïve en phrases : coupe sur . ! ? … suivis d'un blanc ou de la fin. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
}

export interface SummaryShape {
  sentenceCount: number;
  longestSentenceWords: number;
  withinBounds: boolean;
}

/** Mesure la conformité d'un résumé aux bornes US-3.4 sans le modifier. */
export function inspectSummary(summary: string): SummaryShape {
  const sentences = splitSentences(summary);
  const longestSentenceWords = sentences.reduce((max, s) => Math.max(max, countWords(s)), 0);
  const withinBounds =
    sentences.length >= SUMMARY_MIN_SENTENCES &&
    sentences.length <= SUMMARY_MAX_SENTENCES &&
    longestSentenceWords <= SUMMARY_MAX_WORDS_PER_SENTENCE;
  return { sentenceCount: sentences.length, longestSentenceWords, withinBounds };
}

/** Nombre d'actions dont le titre dépasse la borne US-3.5 AC1. */
export function countOverlongActionTitles(titles: string[]): number {
  return titles.filter((title) => countWords(title) > ACTION_MAX_WORDS).length;
}
