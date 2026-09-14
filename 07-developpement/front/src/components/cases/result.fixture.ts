import type {
  CaseFileResultResponse,
  ResultAction,
  ResultInfo,
  ResultRequiredDoc,
} from "@capclair/contract";

/** Fabrique de `CaseFileResultResponse` pour les tests de l'écran 05. */
export function makeResult(
  overrides: Partial<CaseFileResultResponse> = {},
): CaseFileResultResponse {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    analysisStatus: "TERMINEE",
    status: "A_ANALYSER",
    organisme: "CAF",
    title: "Demande de justificatifs",
    documentDate: "2026-07-03T00:00:00.000Z",
    documentDateSourceExcerpt: "courrier du 3 juillet 2026",
    summary: "La CAF vous demande deux documents pour instruire votre dossier RSA.",
    warnings: [],
    mainDeadline: {
      date: "2026-08-02T00:00:00.000Z",
      type: "RELATIVE",
      confidence: "FAIBLE",
      sourceExcerpt: "30 jours à compter de la réception du présent courrier",
      computedFromDelay: true,
      overdue: false,
      isUserCorrected: false,
    },
    actions: [],
    requiredDocuments: [],
    informations: [],
    infosToVerify: [],
    responseDraft: { hasContent: true, preview: "Madame, Monsieur, je vous adresse…" },
    lockedFields: [],
    ...overrides,
  };
}

export function makeInfo(overrides: Partial<ResultInfo> = {}): ResultInfo {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    categoryCode: "REFERENCE",
    categoryLabel: "Référence",
    categoryIcon: null,
    label: "Référence allocataire",
    value: "0847213C",
    sourceExcerpt: "référence allocataire : 0847213C",
    verifiable: true,
    confidenceLevel: "ELEVE",
    isUserCorrected: false,
    ...overrides,
  };
}

export function makeAction(overrides: Partial<ResultAction> = {}): ResultAction {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Envoyer le justificatif de domicile",
    description: null,
    done: false,
    position: 0,
    origin: "ANALYSE",
    dueDate: null,
    dueDateType: null,
    dueDateConfidence: null,
    dueDateSourceExcerpt: null,
    sourceExcerpt: "merci de nous transmettre un justificatif de domicile",
    verifiable: true,
    ...overrides,
  };
}

export function makeRequiredDoc(
  overrides: Partial<ResultRequiredDoc> = {},
): ResultRequiredDoc {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Justificatif de domicile de moins de 3 mois",
    provided: false,
    userNote: null,
    sourceExcerpt: "justificatif de domicile de moins de 3 mois",
    verifiable: true,
    ...overrides,
  };
}
