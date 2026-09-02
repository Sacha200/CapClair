import { z } from "zod";

/**
 * Schéma de sortie IA (US-3.2) — 13 champs, gabarit `documents.ts`.
 *
 * Règle D7 (doc archi §3) : les dates et délais ne sont JAMAIS calculés par
 * l'IA. Elle ne renvoie que le passage textuel (`rawText`/`sourceExcerpt`) ;
 * le serveur en dérive la valeur (`back/src/lib/dates.ts`). Aucun champ de ce
 * schéma ne porte de date déjà résolue.
 *
 * Chaque item d'un tableau (info extraite, action, justificatif, échéance)
 * porte un `sourceExcerpt` non vide — US-3.2 AC5. C'est la lecture retenue du
 * champ 11/13 « extraits justificatifs » (pas un tableau à plat séparé — voir
 * plan E3 §2 décision #8).
 */

export const OrganismeIASchema = z.enum(["CAF", "CPAM", "FRANCE_TRAVAIL", "INDETERMINE"]);
export const CategorieInfoSchema = z.enum([
  "REFERENCE",
  "MONTANT",
  "DATE",
  "IDENTITE",
  "CONTACT",
  "AUTRE",
]);
export const ConfianceIASchema = z.enum(["FAIBLE", "MOYEN", "ELEVE"]);
export const EcheanceTypeIASchema = z.enum(["EXPLICITE", "RELATIVE"]);

const AvecExtrait = z.object({
  /** Passage littéral du courrier — jamais vide (anti-hallucination, AC5). */
  sourceExcerpt: z.string().min(1),
});

export const InfoExtraiteSchema = AvecExtrait.extend({
  category: CategorieInfoSchema,
  label: z.string().min(1),
  value: z.string().min(1),
  confidence: ConfianceIASchema,
});

export const ActionIASchema = AvecExtrait.extend({
  /** À l'infinitif, ≤ 15 mots (US-3.5 AC1) — la longueur est vérifiée en post-traitement. */
  title: z.string().min(1).max(120),
  /** Texte brut du délai propre à cette action, jamais une date déjà calculée (D7). */
  dueDateRawText: z.string().nullable(),
});

export const JustificatifIASchema = AvecExtrait.extend({
  name: z.string().min(1),
});

export const EcheanceIASchema = AvecExtrait.extend({
  type: EcheanceTypeIASchema,
  /** "15 mars 2026" ou "un mois à compter de la réception…" — jamais une date résolue. */
  rawText: z.string().min(1),
});

export const AnalysisResultSchema = z.object({
  organisme: OrganismeIASchema, // 1
  typeCourrier: z.string().min(1).max(120), // 2 → CaseFile.title
  dateCourrierRawText: z.string().nullable(), // 3 → CaseFile.documentDate (calculé serveur)
  informationsExtraites: z.array(InfoExtraiteSchema), // 4 (références) + 5 (montants), via `category`
  /** 3 à 8 phrases, ≤ 25 mots chacune (US-3.4 AC1/AC2) — vérifié en post-traitement. */
  resume: z.string().min(1), // 6
  actions: z.array(ActionIASchema), // 7
  justificatifs: z.array(JustificatifIASchema), // 8
  echeancePrincipale: EcheanceIASchema.nullable(), // 9 → CaseFile.mainDeadline*
  brouillonReponse: z.string().min(1), // 10 → ResponseDraft.content
  avertissements: z.array(z.string().min(1)), // 13 → CaseFile.warnings
  // 11 : sourceExcerpt par item (ci-dessus). 12 : `confidence` par item + confiance de
  // l'échéance dérivée par le serveur (D7), pas un champ direct de ce schéma.
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type InfoExtraite = z.infer<typeof InfoExtraiteSchema>;
export type ActionIA = z.infer<typeof ActionIASchema>;
export type JustificatifIA = z.infer<typeof JustificatifIASchema>;
export type EcheanceIA = z.infer<typeof EcheanceIASchema>;

/** Messages FR (persona Nadia, A2/B1) — repris à l'identique côté UI. */
export const ANALYSIS_MESSAGES = {
  consentRequired:
    "Vous devez confirmer l'envoi de votre courrier à notre prestataire d'analyse avant de lancer l'analyse.",
  alreadyRunning: "Une analyse est déjà en cours pour ce dossier.",
  analysisFailed: "L'analyse n'a pas abouti. Vous pouvez la relancer.",
} as const;

/** US-2.3 AC2 (confirmation) — même forme que `ConfirmFictionalInputSchema` de `documents.ts`. */
export const ConfirmAiConsentInputSchema = z.object({ confirmed: z.literal(true) });
export type ConfirmAiConsentInput = z.infer<typeof ConfirmAiConsentInputSchema>;

export const AnalysisStatusSchema = z.enum(["EN_ATTENTE", "EN_COURS", "TERMINEE", "ECHEC"]);
export const CaseFileStatusResponseSchema = z.object({
  id: z.string(),
  analysisStatus: AnalysisStatusSchema,
});
export type CaseFileStatusResponse = z.infer<typeof CaseFileStatusResponseSchema>;

export const StartAnalysisResponseSchema = z.object({
  analysisStatus: AnalysisStatusSchema,
});
export type StartAnalysisResponse = z.infer<typeof StartAnalysisResponseSchema>;
