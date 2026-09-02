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
import { ANALYSIS_MESSAGES } from "./cases.dto.js";

/** 404 (jamais 403) si le dossier n'existe pas ou appartient à un autre compte. */
export function getCaseStatus(db: UserScopedDb, caseFileId: string) {
  return db.caseFiles.findByIdForUser(caseFileId);
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
