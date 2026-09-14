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
 * `ExtractedInformation.isUserCorrected = true` (la correction prime — §2 #11)
 * et, depuis E5 (US-5.2), les `ActionItem`/`RequiredDocument` déjà traités par
 * l'utilisateur (cochés, ajoutés à la main, ou porteurs d'une note).
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

/**
 * US-5.4 (décision #7) — notifie l'utilisateur de l'issue d'une analyse
 * (succès ou échec), à côté de `recordAnalysisEvent`. `body` ne porte JAMAIS
 * de contenu de courrier — même contrainte que `AuditEvent` (US-8.2) : au plus
 * le titre du dossier, jamais un extrait.
 */
export async function recordAnalysisNotification(input: {
  caseFileId: string;
  userId: string;
  type: "ANALYSE_TERMINEE" | "ANALYSE_ECHEC";
  title: string;
  body: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      caseFileId: input.caseFileId,
      type: input.type,
      title: input.title,
      body: input.body,
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
      select: { id: true, userLockedFields: true },
    });
    if (!exists) throw new NotFoundError("caseFile");

    // US-4.4 AC3 — un champ scalaire corrigé à la main (`userLockedFields`)
    // n'est plus réécrit par une ré-analyse. `summary`/`warnings` ne sont pas
    // verrouillables (aucune AC ne le demande) ; `status` l'est depuis E5
    // (US-5.1 — un changement manuel via `PATCH …/statut` le verrouille).
    const locked = new Set(exists.userLockedFields);
    const data: Prisma.CaseFileUpdateInput = {
      summary: result.summary,
      warnings: result.warnings,
      analysisStatus: "TERMINEE",
      lastActivityAt: new Date(),
    };
    if (!locked.has("organisme")) data.organisme = result.organisme;
    if (!locked.has("title")) data.title = result.title;
    if (!locked.has("documentDate")) {
      data.documentDate = result.documentDate;
      data.documentDateSourceExcerpt = result.documentDateSourceExcerpt;
    }
    if (!locked.has("mainDeadline")) {
      data.mainDeadline = result.mainDeadline?.date ?? null;
      data.mainDeadlineType = result.mainDeadline?.type ?? null;
      data.mainDeadlineSourceExcerpt = result.mainDeadline?.sourceExcerpt ?? null;
      data.mainDeadlineConfidence = result.mainDeadline?.confidence ?? null;
    }
    // US-5.1 — statut dérivé automatiquement de la présence d'actions, sauf
    // verrouillage manuel (US-5.1 AC2, `PATCH …/statut`).
    if (!locked.has("status")) {
      data.status = result.actions.length > 0 ? "ACTION_REQUISE" : "TERMINE";
    }
    await tx.caseFile.update({ where: { id: caseFileId }, data });

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

    // US-5.2/§9.6 E3 — ne supprime que ce qu'une ré-analyse peut sûrement remplacer : une action issue
    // de l'IA et non cochée. Une action cochée (même issue de l'IA) ou ajoutée à la main est protégée.
    await tx.actionItem.deleteMany({
      where: { caseFileId, origin: "ANALYSE", done: false },
    });
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

    // Idem — protégé dès que l'utilisateur a coché "fourni" ou laissé une note.
    await tx.requiredDocument.deleteMany({
      where: { caseFileId, provided: false, userNote: null },
    });
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
