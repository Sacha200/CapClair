/**
 * Accès aux données de l'analyse IA — couche **système** (non scopée `userId`).
 *
 * Le worker (`worker/analysis.ts`) consomme un job dont le payload a été produit
 * côté serveur par une route déjà scopée (`features/cases`), qui a vérifié la
 * propriété du dossier ET le consentement (US-3.1 AC3) avant d'enfiler. Le
 * worker n'a donc pas d'utilisateur courant : il agit par `caseFileId` de
 * confiance. C'est la seule raison pour laquelle ce module contourne
 * `context.forUser` — et il vit sous `server/database/` pour rester le seul
 * endroit, avec `repositories.ts`, à toucher Prisma directement.
 *
 * `applyAnalysis` est une transaction unique et idempotente (plan E3 §6.1) :
 * une ré-analyse remplace intégralement le graphe dérivé, SAUF les lignes
 * `ExtractedInformation.isUserCorrected = true` (la correction prime — §2 #11).
 */
import { prisma } from "./client.js";
import { NotFoundError } from "../../lib/errors.js";
import type {
  AnalysisStatus,
  ConfidenceLevel,
  EcheanceType,
  Organisme,
  Prisma,
} from "../../generated/prisma/client.js";

/** Échéance déjà résolue par `lib/dates.ts` — jamais un `rawText` brut de l'IA. */
export interface ResolvedDeadline {
  date: Date | null;
  type: EcheanceType;
  confidence: ConfidenceLevel;
  sourceExcerpt: string;
}

export interface PersistableInfo {
  /** Code du référentiel `Category` (D14) ; un code inconnu retombe sur AUTRE. */
  categoryCode: string;
  label: string;
  value: string;
  sourceExcerpt: string;
  confidenceLevel: ConfidenceLevel;
}

export interface PersistableAction {
  title: string;
  sourceExcerpt: string;
  position: number;
  dueDate: ResolvedDeadline | null;
}

/**
 * Résultat d'analyse prêt à écrire : `AnalysisResult` du contrat une fois passé
 * par `lib/dates.ts` (dates résolues) et les enums traduits vers Prisma.
 */
export interface PersistableAnalysis {
  organisme: Organisme;
  title: string;
  summary: string;
  documentDate: Date | null;
  documentDateSourceExcerpt: string | null;
  warnings: string[];
  mainDeadline: ResolvedDeadline | null;
  informations: PersistableInfo[];
  actions: PersistableAction[];
  requiredDocuments: Array<{ name: string; sourceExcerpt: string }>;
  responseDraft: string;
}

export interface AnalysisContext {
  caseFileId: string;
  userId: string;
  /** Texte du courrier à analyser (barrière « illisible » déjà franchie en E2). */
  extractedText: string;
  /** `null` si le courrier n'a jamais été daté à l'import. */
  documentDate: Date | null;
  /** Repli d'ancre pour un délai relatif quand `documentDate` est inconnue (D7). */
  importedAt: Date;
}

/**
 * Charge le contexte d'analyse d'un dossier. Lève `NotFoundError` si le dossier
 * est absent/supprimé, ou n'a pas de document exploitable (ne devrait pas
 * arriver : la route refuse d'enfiler dans ce cas).
 */
export async function loadAnalysisContext(caseFileId: string): Promise<AnalysisContext> {
  const caseFile = await prisma.caseFile.findFirst({
    where: { id: caseFileId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      documentDate: true,
      documents: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { extractedText: true, createdAt: true },
      },
    },
  });
  if (!caseFile) throw new NotFoundError("caseFile");

  const document = caseFile.documents[0];
  if (!document?.extractedText || document.extractedText.trim().length === 0) {
    throw new NotFoundError("document");
  }

  return {
    caseFileId: caseFile.id,
    userId: caseFile.userId,
    extractedText: document.extractedText,
    documentDate: caseFile.documentDate,
    importedAt: document.createdAt,
  };
}

/**
 * Journalise un évènement d'analyse (coupe C9 — l'écran d'historique est
 * reporté, la trace est écrite au fil de l'eau). `metadata` ne porte JAMAIS de
 * contenu de courrier : compteurs et indicateurs uniquement (US-8.2).
 */
export async function recordAnalysisEvent(input: {
  caseFileId: string;
  userId: string | null;
  eventType: "analysis.completed" | "analysis.failed";
  metadata: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      caseFileId: input.caseFileId,
      userId: input.userId,
      eventType: input.eventType,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
}

/** Transition d'état atomique (EN_COURS au démarrage, ECHEC sur exception). */
export async function setAnalysisStatus(
  caseFileId: string,
  analysisStatus: AnalysisStatus,
): Promise<void> {
  await prisma.caseFile.updateMany({
    where: { id: caseFileId, deletedAt: null },
    data: { analysisStatus },
  });
}

/**
 * Écrit le résultat d'analyse en une transaction. Idempotent : rejouer le même
 * job produit le même état final. Les `ExtractedInformation` corrigées par
 * l'utilisateur sont préservées ; tout le reste du graphe dérivé est remplacé.
 */
export async function applyAnalysis(
  caseFileId: string,
  result: PersistableAnalysis,
): Promise<void> {
  const categories = await prisma.category.findMany({ select: { id: true, code: true } });
  const categoryIdByCode = new Map(categories.map((c) => [c.code, c.id]));
  const fallbackCategoryId = categoryIdByCode.get("AUTRE");

  const resolveCategoryId = (code: string): string => {
    const id = categoryIdByCode.get(code) ?? fallbackCategoryId;
    if (!id) throw new Error("Référentiel Category non seedé (code AUTRE absent).");
    return id;
  };

  await prisma.$transaction(async (tx) => {
    const exists = await tx.caseFile.findFirst({
      where: { id: caseFileId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError("caseFile");

    await tx.caseFile.update({
      where: { id: caseFileId },
      data: {
        organisme: result.organisme,
        title: result.title,
        summary: result.summary,
        documentDate: result.documentDate,
        documentDateSourceExcerpt: result.documentDateSourceExcerpt,
        warnings: result.warnings,
        mainDeadline: result.mainDeadline?.date ?? null,
        mainDeadlineType: result.mainDeadline?.type ?? null,
        mainDeadlineSourceExcerpt: result.mainDeadline?.sourceExcerpt ?? null,
        mainDeadlineConfidence: result.mainDeadline?.confidence ?? null,
        status: "A_FAIRE",
        analysisStatus: "TERMINEE",
        lastActivityAt: new Date(),
      },
    });

    // ExtractedInformation : remplacement partiel — on ne touche jamais une
    // ligne corrigée par l'utilisateur (US-4.4, la correction prime).
    await tx.extractedInformation.deleteMany({
      where: { caseFileId, isUserCorrected: false },
    });
    if (result.informations.length > 0) {
      await tx.extractedInformation.createMany({
        data: result.informations.map((info) => ({
          caseFileId,
          categoryId: resolveCategoryId(info.categoryCode),
          label: info.label,
          value: info.value,
          sourceExcerpt: info.sourceExcerpt,
          confidenceLevel: info.confidenceLevel,
        })),
      });
    }

    // ActionItem / RequiredDocument : pas de flag de protection au MVP
    // (plan E3 §9.6) — remplacement intégral à chaque analyse réussie.
    await tx.actionItem.deleteMany({ where: { caseFileId } });
    if (result.actions.length > 0) {
      await tx.actionItem.createMany({
        data: result.actions.map((action) => ({
          caseFileId,
          title: action.title,
          sourceExcerpt: action.sourceExcerpt,
          position: action.position,
          dueDate: action.dueDate?.date ?? null,
          dueDateType: action.dueDate?.type ?? null,
          dueDateSourceExcerpt: action.dueDate?.sourceExcerpt ?? null,
          dueDateConfidence: action.dueDate?.confidence ?? null,
        })),
      });
    }

    await tx.requiredDocument.deleteMany({ where: { caseFileId } });
    if (result.requiredDocuments.length > 0) {
      await tx.requiredDocument.createMany({
        data: result.requiredDocuments.map((doc) => ({
          caseFileId,
          name: doc.name,
          sourceExcerpt: doc.sourceExcerpt,
        })),
      });
    }

    await tx.responseDraft.upsert({
      where: { caseFileId },
      create: { caseFileId, content: result.responseDraft },
      update: { content: result.responseDraft },
    });
  });
}
