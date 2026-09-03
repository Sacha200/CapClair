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
  /** E4 — `GET …/resultat` sur un dossier pas encore `TERMINEE` (409). */
  analysisNotReady: "L'analyse de ce dossier n'est pas encore terminée.",
  /** E4 US-4.4 AC5 — échéance corrigée antérieure à la date du courrier (400). */
  deadlineBeforeDocument: "L'échéance ne peut pas précéder la date du courrier.",
  /** E4 US-4.4 AC1 — `PATCH` de correction reçu sans aucune modification (400). */
  nothingToUpdate: "Aucune modification fournie.",
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

// ===========================================================================
// E4 — Consultation et vérification du dossier (écran 05)
// ===========================================================================

/**
 * US-4.1 AC3 — avertissement PERMANENT de l'écran de résultat. Texte exact,
 * source unique, repris tel quel par l'UI. Distinct des `warnings` propres au
 * courrier (champ 13/13 de l'analyse), qui sont contextuels.
 */
export const RESULT_WARNING_BANNER =
  "Cette analyse est générée automatiquement à partir d'un document fictif. " +
  "Vérifiez les informations importantes avant toute utilisation.";

/**
 * Niveau de confiance AFFICHÉ — dérivé par le serveur (US-4.2 AC3, US-4.3) ;
 * peut différer de la valeur stockée : `!verifiable` ⇒ FAIBLE, `isUserCorrected`
 * ⇒ ELEVE.
 */
export const DisplayConfidenceSchema = ConfianceIASchema;
export type DisplayConfidence = z.infer<typeof DisplayConfidenceSchema>;

/**
 * US-4.4 AC3 — seules valeurs admises dans `CaseFile.userLockedFields`. Une
 * correction manuelle sur l'un de ces champs scalaires le protège d'une
 * ré-analyse (`applyAnalysis` l'omet). Les lignes `ExtractedInformation`
 * gardent leur propre flag `isUserCorrected`.
 */
export const LOCKABLE_FIELDS = ["organisme", "title", "documentDate", "mainDeadline"] as const;
export type LockableField = (typeof LOCKABLE_FIELDS)[number];

export const ResultInfoSchema = z.object({
  id: z.string().uuid(),
  categoryCode: CategorieInfoSchema,
  categoryLabel: z.string(),
  /** Nom d'icône Remix Icon (référentiel `Category`) ; `null` si non renseigné. */
  categoryIcon: z.string().nullable(),
  label: z.string(),
  value: z.string(),
  sourceExcerpt: z.string(),
  /** US-4.2 AC2 — `sourceExcerpt` est une sous-chaîne littérale du texte extrait. */
  verifiable: z.boolean(),
  confidenceLevel: DisplayConfidenceSchema,
  isUserCorrected: z.boolean(),
});
export type ResultInfo = z.infer<typeof ResultInfoSchema>;

export const ResultActionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  done: z.boolean(),
  position: z.number().int(),
  dueDate: z.string().datetime().nullable(),
  dueDateType: EcheanceTypeIASchema.nullable(),
  dueDateConfidence: DisplayConfidenceSchema.nullable(),
  dueDateSourceExcerpt: z.string().nullable(),
  sourceExcerpt: z.string(),
  verifiable: z.boolean(),
});
export type ResultAction = z.infer<typeof ResultActionSchema>;

export const ResultRequiredDocSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  provided: z.boolean(),
  sourceExcerpt: z.string(),
  verifiable: z.boolean(),
});
export type ResultRequiredDoc = z.infer<typeof ResultRequiredDocSchema>;

export const ResultDeadlineSchema = z.object({
  date: z.string().datetime().nullable(),
  type: EcheanceTypeIASchema.nullable(),
  confidence: DisplayConfidenceSchema.nullable(),
  sourceExcerpt: z.string().nullable(),
  /** `type === "RELATIVE"` ⇒ l'UI mentionne « calculée à partir du délai indiqué » (D7). */
  computedFromDelay: z.boolean(),
  /** `date` révolue (comparaison serveur) ⇒ « Échéance dépassée » (US-3.6 AC4). */
  overdue: z.boolean(),
  isUserCorrected: z.boolean(),
});
export type ResultDeadline = z.infer<typeof ResultDeadlineSchema>;

export const ResultDraftSchema = z.object({
  hasContent: z.boolean(),
  /** Aperçu court — jamais le corps complet (l'édition du brouillon est E6). */
  preview: z.string(),
});
export type ResultDraft = z.infer<typeof ResultDraftSchema>;

/**
 * US-4.1 — graphe complet d'un dossier analysé, pour l'écran 05. Renvoyé (200)
 * uniquement si `analysisStatus === "TERMINEE"` ; sinon 409 `analysis_not_ready`.
 * Ne contient jamais le texte extrait du courrier — seulement le booléen
 * `verifiable` par item (US-8.2).
 */
export const CaseFileResultResponseSchema = z.object({
  id: z.string().uuid(),
  analysisStatus: z.literal("TERMINEE"),
  organisme: OrganismeIASchema,
  title: z.string(),
  documentDate: z.string().datetime().nullable(),
  documentDateSourceExcerpt: z.string().nullable(),
  summary: z.string().nullable(),
  warnings: z.array(z.string()),
  mainDeadline: ResultDeadlineSchema.nullable(),
  actions: z.array(ResultActionSchema),
  requiredDocuments: z.array(ResultRequiredDocSchema),
  informations: z.array(ResultInfoSchema),
  /** US-4.3 AC3 — infos de confiance FAIBLE non corrigées (bandeau récap). */
  infosToVerify: z.array(z.object({ id: z.string().uuid(), label: z.string() })),
  responseDraft: ResultDraftSchema.nullable(),
  /** Sous-ensemble de `LOCKABLE_FIELDS` verrouillé par une correction manuelle. */
  lockedFields: z.array(z.string()),
});
export type CaseFileResultResponse = z.infer<typeof CaseFileResultResponseSchema>;

/** US-4.4 — correction d'une information extraite. */
export const UpdateExtractedInfoInputSchema = z.object({
  value: z.string().trim().min(1).max(500),
  label: z.string().trim().min(1).max(200).optional(),
});
export type UpdateExtractedInfoInput = z.infer<typeof UpdateExtractedInfoInputSchema>;

/**
 * US-4.4 AC5 — correction de l'échéance principale (date de calendrier). Le
 * serveur refuse une date antérieure à `documentDate` (règle US-3.6 AC5).
 */
export const UpdateMainDeadlineInputSchema = z.object({
  date: z.string().date(),
});
export type UpdateMainDeadlineInput = z.infer<typeof UpdateMainDeadlineInputSchema>;

/** US-4.4 AC1 — organisme / type de courrier / date du courrier. Au moins une clé. */
export const UpdateCaseScalarsInputSchema = z
  .object({
    organisme: OrganismeIASchema.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    documentDate: z.string().date().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: ANALYSIS_MESSAGES.nothingToUpdate,
  });
export type UpdateCaseScalarsInput = z.infer<typeof UpdateCaseScalarsInputSchema>;
