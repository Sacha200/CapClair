/**
 * Traitement d'un job d'analyse (D8, doc archi §6 étapes 8-15).
 *
 * `runAnalysisJob` est isolé du câblage BullMQ (`worker/index.ts`) pour être
 * testable en direct, sans Redis : on lui passe un `caseFileId`, il fait tout
 * le reste. Il **n'échoue jamais** — toute erreur devient
 * `AnalysisStatus.ECHEC` + un `AuditEvent`. Le worker BullMQ ne retente donc
 * que sur crash brutal du process (job resté « actif »), pas sur une erreur
 * métier.
 *
 * Règle D7 : aucune date n'est produite par l'IA. `lib/dates.ts` dérive les
 * échéances à partir des seuls passages textuels renvoyés.
 */
import { analyzeLetter, classifyOrganismeHeuristic } from "../server/ai/index.js";
import { countOverlongActionTitles, inspectSummary } from "../server/ai/postprocess.js";
import {
  applyAnalysis,
  loadAnalysisContext,
  recordAnalysisEvent,
  setAnalysisStatus,
  type PersistableAnalysis,
  type ResolvedDeadline,
} from "../server/database/analysis-store.js";
import { deriveDeadline, deriveDeadlineFromText, parseExplicitFrenchDate } from "../lib/dates.js";
import { logger } from "../lib/logger.js";
import type { AnalysisResult } from "@capclair/contract";
import type { ConfidenceLevel, Organisme } from "../generated/prisma/client.js";

/** 1 appel initial + 1 relance si la réponse ne valide pas le schéma (plan E3 §2 #12). */
const MAX_VALIDATION_ATTEMPTS = 2;

class AnalysisValidationError extends Error {
  constructor(attempts: number) {
    super(`Réponse IA invalide après ${attempts} tentative(s).`);
    this.name = "AnalysisValidationError";
  }
}

function toOrganisme(value: AnalysisResult["organisme"]): Organisme {
  return value; // OrganismeIASchema ⊆ Organisme (mêmes valeurs, validé par Zod en amont)
}

function toConfidenceLevel(value: "FAIBLE" | "MOYEN" | "ELEVE"): ConfidenceLevel {
  return value;
}

async function analyzeWithRetry(
  text: string,
  organisme: ReturnType<typeof classifyOrganismeHeuristic>,
): Promise<AnalysisResult> {
  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt += 1) {
    const { result } = await analyzeLetter(text, organisme);
    if (result) return result;
    logger.warn({ attempt }, "Réponse IA non conforme au schéma — relance");
  }
  throw new AnalysisValidationError(MAX_VALIDATION_ATTEMPTS);
}

/** Traduit le résultat IA + les dates dérivées en objet prêt à persister. */
function toPersistable(
  result: AnalysisResult,
  opts: { documentDate: Date | null; fallbackAnchor: Date },
): { persistable: PersistableAnalysis; mainDeadline: ResolvedDeadline | null } {
  const { documentDate, fallbackAnchor } = opts;

  const mainDeadline = deriveDeadline({
    echeance: result.echeancePrincipale,
    documentDate,
    fallbackAnchor,
  });

  const persistable: PersistableAnalysis = {
    organisme: toOrganisme(result.organisme),
    title: result.typeCourrier,
    summary: result.resume,
    documentDate,
    documentDateSourceExcerpt: result.dateCourrierRawText,
    warnings: result.avertissements,
    mainDeadline,
    informations: result.informationsExtraites.map((info) => ({
      categoryCode: info.category,
      label: info.label,
      value: info.value,
      sourceExcerpt: info.sourceExcerpt,
      confidenceLevel: toConfidenceLevel(info.confidence),
    })),
    actions: result.actions.map((action, index) => ({
      title: action.title,
      sourceExcerpt: action.sourceExcerpt,
      position: index,
      dueDate: deriveDeadlineFromText({
        rawText: action.dueDateRawText,
        sourceExcerpt: action.sourceExcerpt,
        documentDate,
        fallbackAnchor,
      }),
    })),
    requiredDocuments: result.justificatifs.map((doc) => ({
      name: doc.name,
      sourceExcerpt: doc.sourceExcerpt,
    })),
    responseDraft: result.brouillonReponse,
  };

  return { persistable, mainDeadline };
}

/**
 * Analyse complète d'un dossier. Résout toujours (jamais de `throw`) : succès →
 * `TERMINEE`, échec → `ECHEC`. Le statut passe d'abord par `EN_COURS`.
 */
export async function runAnalysisJob(caseFileId: string): Promise<void> {
  await setAnalysisStatus(caseFileId, "EN_COURS");

  let userId: string | null = null;
  try {
    const ctx = await loadAnalysisContext(caseFileId);
    userId = ctx.userId;

    const organisme = classifyOrganismeHeuristic(ctx.extractedText);
    const result = await analyzeWithRetry(ctx.extractedText, organisme);

    const documentDate = result.dateCourrierRawText
      ? parseExplicitFrenchDate(result.dateCourrierRawText)
      : null;

    const { persistable, mainDeadline } = toPersistable(result, {
      documentDate,
      fallbackAnchor: ctx.importedAt,
    });

    await applyAnalysis(caseFileId, persistable);

    // Compteurs uniquement — aucun extrait de courrier (US-8.2).
    const summaryShape = inspectSummary(result.resume);
    await recordAnalysisEvent({
      caseFileId,
      userId,
      eventType: "analysis.completed",
      metadata: {
        organisme: persistable.organisme,
        heuristicOrganisme: organisme,
        documentDateResolved: documentDate !== null,
        mainDeadlineResolved: mainDeadline?.date != null,
        counts: {
          informations: persistable.informations.length,
          actions: persistable.actions.length,
          requiredDocuments: persistable.requiredDocuments.length,
          warnings: persistable.warnings.length,
        },
        summarySentences: summaryShape.sentenceCount,
        summaryWithinBounds: summaryShape.withinBounds,
        overlongActionTitles: countOverlongActionTitles(
          persistable.actions.map((a) => a.title),
        ),
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.name : "UnknownError";
    logger.error({ err, caseFileId }, "Échec de l'analyse");
    await setAnalysisStatus(caseFileId, "ECHEC");
    await recordAnalysisEvent({
      caseFileId,
      userId,
      eventType: "analysis.failed",
      // `reason` = nom de classe d'erreur, jamais le message complet (US-8.2).
      metadata: { reason },
    });
  }
}
