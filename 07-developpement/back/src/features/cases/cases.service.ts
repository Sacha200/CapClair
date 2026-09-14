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
import * as storage from "../../server/storage/index.js";
import { historyLabel } from "./history-label.js";
import { toCaseListDto, toCaseResultDto } from "./cases.mapper.js";
import {
  ANALYSIS_MESSAGES,
  type CaseFileHistoryResponse,
  type CaseFileListResponse,
  type CaseFileResultResponse,
  type CreateActionInput,
  type UpdateActionInput,
  type UpdateCaseScalarsInput,
  type UpdateCaseStatusInput,
  type UpdateExtractedInfoInput,
  type UpdateMainDeadlineInput,
  type UpdateRequiredDocInput,
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

/**
 * US-5.1 AC2 — change le statut de pilotage du dossier. Le champ est ajouté à
 * `userLockedFields` (via le repository) : une ré-analyse ne le réécrase plus.
 * Statut identique au statut courant → aucun `AuditEvent` (pas de bruit
 * journal). 404 si absent/autre compte.
 */
export async function updateCaseStatus(
  db: UserScopedDb,
  caseFileId: string,
  input: UpdateCaseStatusInput,
): Promise<void> {
  const { from } = await db.caseFiles.updateStatusForUser(caseFileId, input.status);
  if (from !== input.status) {
    await db.auditEvents.record({
      caseFileId,
      eventType: "case.status_changed",
      metadata: { from, to: input.status },
    });
  }
}

/**
 * US-5.2 AC2 — ajoute une action manuelle. Pas d'`AuditEvent` : aucune AC
 * US-5.2 ne le demande explicitement (contrairement à la suppression, AC3).
 * 404 si le dossier n'appartient pas au compte.
 */
export async function createAction(
  db: UserScopedDb,
  caseFileId: string,
  input: CreateActionInput,
): Promise<{ id: string }> {
  const action = await db.actionItems.createForUser(caseFileId, {
    title: input.title,
    description: input.description,
    dueDate: input.dueDate ? isoDateToUtc(input.dueDate) : undefined,
  });
  return { id: action.id };
}

/**
 * US-5.2 AC1 — coche/décoche une action, journalise (`action.completed` /
 * `action.reopened`). 404 si `actionId` n'est pas dans ce dossier de ce compte.
 */
export async function toggleAction(
  db: UserScopedDb,
  caseFileId: string,
  actionId: string,
  input: UpdateActionInput,
): Promise<void> {
  await db.actionItems.updateForUser(caseFileId, actionId, input);
  await db.auditEvents.record({
    caseFileId,
    eventType: input.done ? "action.completed" : "action.reopened",
    metadata: { actionId },
  });
}

/**
 * US-5.2 AC3 — suppression définitive d'une action, journalise
 * (`action.deleted`, événement journalisé). 404 si hors scope.
 */
export async function deleteAction(
  db: UserScopedDb,
  caseFileId: string,
  actionId: string,
): Promise<void> {
  await db.actionItems.deleteForUser(caseFileId, actionId);
  await db.auditEvents.record({ caseFileId, eventType: "action.deleted", metadata: { actionId } });
}

/**
 * US-5.3 AC1/AC2 — coche « fourni » et/ou pose une note libre sur un
 * justificatif. Pas d'`AuditEvent` : aucune AC US-5.3 ne demande de
 * journalisation pour la checklist. 404 si `docId` n'est pas dans ce dossier
 * de ce compte.
 */
export async function updateRequiredDocument(
  db: UserScopedDb,
  caseFileId: string,
  docId: string,
  input: UpdateRequiredDocInput,
): Promise<void> {
  await db.requiredDocs.updateForUser(caseFileId, docId, input);
}

/**
 * US-5.5 — suppression définitive et complète d'un dossier. La confirmation
 * explicite (AC1) est une responsabilité front — aucune confirmation
 * supplémentaire ici. Purge best-effort des fichiers sur disque après la
 * transaction en base (`deleteForUser`) : un fichier déjà absent ne fait
 * jamais échouer la requête (même convention que `documents.service.ts`).
 * 404 si absent/autre compte.
 */
export async function deleteCase(db: UserScopedDb, caseFileId: string): Promise<void> {
  const { storagePaths } = await db.caseFiles.deleteForUser(caseFileId);
  await Promise.all(storagePaths.map((p) => storage.deleteDocument(p).catch(() => {})));
}

/**
 * US-5.4 — liste des dossiers du compte + résumé pour le tableau de bord.
 * Isolation par compte déjà garantie par `db.caseFiles.listWithSummaryForUser`
 * (scopée `userId`, US-1.5) : aucun filtrage supplémentaire ici.
 */
export async function listCasesWithSummary(db: UserScopedDb): Promise<CaseFileListResponse> {
  const { cases, summary } = await db.caseFiles.listWithSummaryForUser();
  return toCaseListDto(cases, summary);
}

/**
 * US-4.5 — historique du dossier : entrées du plus récent au plus ancien,
 * libellés FR (aucun `eventType` technique, AC2), sans aucun contenu de
 * courrier (AC3 — `metadata` n'est même pas lu). 404 si absent/autre compte.
 */
export async function getCaseHistory(
  db: UserScopedDb,
  caseFileId: string,
): Promise<CaseFileHistoryResponse> {
  const events = await db.auditEvents.listForCaseFileForUser(caseFileId);
  return {
    entries: events.map((event) => ({
      id: event.id,
      at: event.createdAt.toISOString(),
      label: historyLabel(event.eventType),
    })),
  };
}
