/**
 * Résolution déterministe des dates et délais (D7, doc archi §3) — LE SEUL
 * endroit du back qui calcule une échéance. L'IA ne renvoie jamais qu'un
 * passage textuel (`rawText`) ; ce module en dérive la valeur, ou renvoie
 * `null` plutôt que de deviner. Risque R1 du projet : une date jamais
 * générée par l'IA est une date jamais hallucinée.
 */
import { addDays, addMonths } from "date-fns";
import type { ConfidenceLevel, EcheanceType } from "../generated/prisma/client.js";
import type { EcheanceIA } from "@capclair/contract";

const MONTHS: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
};

const MONTH_WORD_NUMBERS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4 };

/** Minuscules, sans accents — pour un matching insensible à l'orthographe exacte. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Reconnaît une date française explicite (« 15 mars 2026 », « 1er septembre
 * 2026 », « 12 août 2026 à 10h00 » — l'heure éventuelle est ignorée). `null`
 * si aucun motif connu ne correspond : jamais d'invention.
 */
export function parseExplicitFrenchDate(text: string): Date | null {
  const match = normalize(text).match(/\b(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})\b/);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  if (!dayText || !monthText || !yearText) return null;
  const day = Number(dayText);
  const month = MONTHS[monthText];
  const year = Number(yearText);
  if (month === undefined) return null;

  const date = new Date(Date.UTC(year, month, day));
  // Rejette un jour inexistant (ex. « 31 avril ») : Date normaliserait en mai.
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

/**
 * Calcule une date à partir d'une ancre et d'un délai littéral français
 * (« 30 jours à compter de la réception… », « un mois à compter… »).
 * `null` si le motif n'est pas reconnu — jamais d'invention.
 */
export function resolveRelativeDelay(anchor: Date, text: string): Date | null {
  const normalized = normalize(text);

  const dayMatch = normalized.match(/(\d+)\s*jours?\b/);
  if (dayMatch) return addDays(anchor, Number(dayMatch[1]));

  const numericMonthMatch = normalized.match(/(\d+)\s*mois\b/);
  if (numericMonthMatch) return addMonths(anchor, Number(numericMonthMatch[1]));

  const wordMonthMatch = normalized.match(/\b(un|une|deux|trois|quatre)\s+mois\b/);
  const monthCount = wordMonthMatch?.[1] ? MONTH_WORD_NUMBERS[wordMonthMatch[1]] : undefined;
  if (monthCount !== undefined) return addMonths(anchor, monthCount);

  return null;
}

export interface ResolvedDeadline {
  date: Date | null;
  type: EcheanceType;
  confidence: ConfidenceLevel;
  sourceExcerpt: string;
}

export interface DeriveDeadlineInput {
  echeance: EcheanceIA | null;
  /** Vraie date du courrier si connue — seule base valable pour la règle de cohérence (AC5). */
  documentDate: Date | null;
  /** Date d'import : repli si `documentDate` est inconnue, seulement pour un délai relatif. */
  fallbackAnchor: Date;
}

/**
 * US-3.6 : dérive l'échéance à afficher. Une échéance explicite non
 * reconnue, ou antérieure à la date du courrier (AC5), n'est jamais
 * retournée avec une date — `date: null`, l'absence est préférée à l'erreur.
 */
export function deriveDeadline(input: DeriveDeadlineInput): ResolvedDeadline | null {
  const { echeance, documentDate, fallbackAnchor } = input;
  if (!echeance) return null;

  if (echeance.type === "EXPLICITE") {
    const parsed = parseExplicitFrenchDate(echeance.rawText);
    const coherent = parsed && (!documentDate || parsed.getTime() >= documentDate.getTime());
    return {
      date: coherent ? parsed : null,
      type: "EXPLICITE",
      confidence: coherent ? "ELEVE" : "FAIBLE",
      sourceExcerpt: echeance.sourceExcerpt,
    };
  }

  // RELATIVE : la confiance retombe à FAIBLE si la vraie date du courrier est
  // inconnue (calcul depuis la date d'import, un repli, pas la vérité — D7).
  const anchor = documentDate ?? fallbackAnchor;
  const computed = resolveRelativeDelay(anchor, echeance.rawText);
  return {
    date: computed,
    type: "RELATIVE",
    confidence: computed ? (documentDate ? "MOYEN" : "FAIBLE") : "FAIBLE",
    sourceExcerpt: echeance.sourceExcerpt,
  };
}

export interface DeriveDeadlineFromTextInput {
  /** Passage textuel du délai propre à l'item (`ActionIA.dueDateRawText`) — `null` si absent. */
  rawText: string | null;
  /** Extrait littéral rattaché à l'item, conservé pour la traçabilité. */
  sourceExcerpt: string;
  documentDate: Date | null;
  fallbackAnchor: Date;
}

/**
 * Variante de `deriveDeadline` pour les échéances dont l'IA ne qualifie pas le
 * type (délai d'une action, US-3.5) : le type est **inféré** — une date
 * française explicite reconnue → EXPLICITE, sinon tentative de délai relatif.
 * `null` si `rawText` est absent ou si rien n'est résolu (jamais d'invention).
 */
export function deriveDeadlineFromText(
  input: DeriveDeadlineFromTextInput,
): ResolvedDeadline | null {
  const { rawText, sourceExcerpt, documentDate, fallbackAnchor } = input;
  if (!rawText || rawText.trim().length === 0) return null;

  const explicit = parseExplicitFrenchDate(rawText);
  if (explicit) {
    const coherent = !documentDate || explicit.getTime() >= documentDate.getTime();
    return {
      date: coherent ? explicit : null,
      type: "EXPLICITE",
      confidence: coherent ? "ELEVE" : "FAIBLE",
      sourceExcerpt,
    };
  }

  const anchor = documentDate ?? fallbackAnchor;
  const computed = resolveRelativeDelay(anchor, rawText);
  if (!computed) return null;
  return {
    date: computed,
    type: "RELATIVE",
    confidence: documentDate ? "MOYEN" : "FAIBLE",
    sourceExcerpt,
  };
}
