/**
 * Service des dossiers (US-3.1 — consentement IA + déclenchement de l'analyse).
 *
 * Ne touche jamais Prisma directement : passe par `UserScopedDb`
 * (`server/database/context.ts`) — isolation `userId`, US-1.5.
 *
 * Frontière avec la file (plan E3 §1) : ce service enfile un job, il ne
 * l'exécute jamais en ligne. Aucun appel IA synchrone dans une requête HTTP.
 */
import type { UserScopedDb } from "../../server/database/context.js";
import { AppError } from "../../lib/errors.js";
import { LEGAL_BUNDLE_VERSION } from "../../lib/legal.js";
import { enqueueAnalysis } from "../../server/queues/analysis.js";
import { rescheduleForCaseFile } from "../reminders/reschedule.js";
import { toCaseResultDto } from "./cases.mapper.js";
import {
  ANALYSIS_MESSAGES,
  type CaseFileResultResponse,
  type UpdateCaseScalarsInput,
  type UpdateExtractedInfoInput,
  type UpdateMainDeadlineInput,
} from "./cases.dto.js";

/** "YYYY-MM-DD" → `Date` à minuit UTC (dates de calendrier, pas d'heure locale). */
function isoDateToUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Minuit UTC du jour d'une `Date` (comparaison de dates de calendrier). */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** 404 (jamais 403) si le dossier n'existe pas ou appartient à un autre compte. */
export function getCaseStatus(db: UserScopedDb, caseFileId: string) {
  return db.caseFiles.findByIdForUser(caseFileId);
}

/**
 * Graphe complet d'un dossier pour l'écran de résultat (E4, US-4.1 → US-4.3).
 *  - 404 si absent/autre compte (via le repository scopé) ;
 *  - 409 `analysis_not_ready` tant que `analysisStatus !== "TERMINEE"` — le
 *    front retombe alors sur l'écran d'attente (polling `GET /api/dossiers/:id`).
 * Le mapper dérive `verifiable` (US-4.2) et le niveau de confiance affiché.
 */
export async function getCaseResult(
  db: UserScopedDb,
  caseFileId: string,
): Promise<CaseFileResultResponse> {
  const row = await db.caseFiles.findResultForUser(caseFileId);
  if (row.analysisStatus !== "TERMINEE") {
    throw new AppError(409, ANALYSIS_MESSAGES.analysisNotReady, { code: "analysis_not_ready" });
  }
  return toCaseResultDto(row, row.documents[0]?.extractedText ?? "");
}

/**
 * Consentement à l'envoi du texte extrait au prestataire d'IA (US-3.1).
 * Action DISTINCTE de la confirmation « document fictif » (AC2) : type de
 * consentement propre `AI_PROCESSING`, endpoint propre. Idempotent : un second
 * appel ne crée pas de doublon de preuve (AC4 : la version de politique est
 * enregistrée à chaque octroi initial).
 */
export async function confirmAiConsent(db: UserScopedDb, caseFileId: string): Promise<void> {
  await db.caseFiles.findByIdForUser(caseFileId); // 404 si absent/autre compte
  const existing = await db.consentLogs.findLatest({
    caseFileId,
    consentType: "AI_PROCESSING",
  });
  if (existing?.granted) return;
  await db.consentLogs.record({
    caseFileId,
    consentType: "AI_PROCESSING",
    granted: true,
    policyVersion: LEGAL_BUNDLE_VERSION,
  });
}

/**
 * Déclenche l'analyse (US-3.1 AC3, D8). Vérifie **avant tout enfilement** :
 *  - le dossier appartient au compte (404 sinon) ;
 *  - un `ConsentLog AI_PROCESSING` accordé, postérieur à la création du
 *    dossier, existe (403 `consentRequired` sinon — aucun appel IA possible
 *    sans cette trace, structurellement) ;
 *  - le dossier n'est pas déjà `EN_COURS`/`TERMINEE` (409 sinon).
 *
 * `enqueue` est injectable pour les tests (défaut : la vraie file BullMQ).
 */
export async function startAnalysis(
  db: UserScopedDb,
  caseFileId: string,
  enqueue: (id: string) => Promise<void> = enqueueAnalysis,
): Promise<{ analysisStatus: "EN_ATTENTE" }> {
  const caseFile = await db.caseFiles.findByIdForUser(caseFileId);

  const consent = await db.consentLogs.findLatest({
    caseFileId,
    consentType: "AI_PROCESSING",
  });
  const consentValid =
    consent?.granted === true && consent.createdAt.getTime() >= caseFile.createdAt.getTime();
  if (!consentValid) {
    throw new AppError(403, ANALYSIS_MESSAGES.consentRequired, { code: "consent_required" });
  }

  const outcome = await db.caseFiles.requeueForAnalysis(caseFileId);
  if (!outcome.queued) {
    throw new AppError(409, ANALYSIS_MESSAGES.alreadyRunning, { code: "analysis_conflict" });
  }

  await enqueue(caseFileId);
  return { analysisStatus: "EN_ATTENTE" };
}

/**
 * US-4.4 — corrige une information extraite. `isUserCorrected` passe à `true`
 * (la ligne ne sera plus écrasée par une ré-analyse) et l'action est
 * journalisée. La métadonnée ne porte que l'id et le code de catégorie —
 * jamais la valeur corrigée (US-8.2). 404 si l'info n'est pas dans ce dossier
 * de ce compte.
 */
export async function correctInformation(
  db: UserScopedDb,
  caseFileId: string,
  infoId: string,
  input: UpdateExtractedInfoInput,
): Promise<void> {
  const row = await db.extractedInfos.updateForUser(caseFileId, infoId, input);
  await db.auditEvents.record({
    caseFileId,
    eventType: "information.corrected",
    metadata: { infoId, categoryCode: row.category.code },
  });
}

/**
 * US-4.4 AC5 — corrige l'échéance principale (date de calendrier). Refuse une
 * date antérieure à la date du courrier (400 `deadline_before_document`, règle
 * US-3.6 AC5). Recalcule et écrit la date côté serveur, journalise, puis
 * appelle le hook de reprogrammation des rappels (no-op tant que E7 n'existe
 * pas — voir plan §8.1). 404 si absent/autre compte.
 */
export async function correctMainDeadline(
  db: UserScopedDb,
  caseFileId: string,
  input: UpdateMainDeadlineInput,
): Promise<void> {
  const caseFile = await db.caseFiles.findByIdForUser(caseFileId);
  const date = isoDateToUtc(input.date);
  if (
    caseFile.documentDate &&
    date.getTime() < startOfUtcDay(caseFile.documentDate).getTime()
  ) {
    throw new AppError(400, ANALYSIS_MESSAGES.deadlineBeforeDocument, {
      code: "deadline_before_document",
    });
  }
  await db.caseFiles.setCorrectedDeadlineForUser(caseFileId, date);
  await db.auditEvents.record({ caseFileId, eventType: "deadline.corrected", metadata: {} });
  await rescheduleForCaseFile(caseFileId);
}

/**
 * US-4.4 AC1 — corrige organisme / type de courrier / date du courrier. Au
 * moins une clé (garanti par le schéma). Les champs touchés sont verrouillés
 * contre la ré-analyse (AC3) et listés dans la trace `AuditEvent`. 404 si
 * absent/autre compte.
 */
export async function updateCaseScalars(
  db: UserScopedDb,
  caseFileId: string,
  input: UpdateCaseScalarsInput,
): Promise<void> {
  const { touched } = await db.caseFiles.updateScalarsForUser(caseFileId, {
    organisme: input.organisme,
    title: input.title,
    documentDate:
      input.documentDate === undefined
        ? undefined
        : input.documentDate === null
          ? null
          : isoDateToUtc(input.documentDate),
  });
  await db.auditEvents.record({
    caseFileId,
    eventType: "case.updated",
    metadata: { fields: touched },
  });
}
