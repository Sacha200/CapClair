/**
 * File « analyse » (BullMQ) — orchestration asynchrone de l'analyse IA (D8).
 *
 * Le producteur (`features/cases`) enfile un job ; le worker (`worker/`) le
 * consomme. Le payload ne contient QUE l'identifiant du dossier — jamais le
 * texte du courrier (US-8.2) : le worker relit `Document.extractedText` en base
 * par cet id.
 *
 * Une seule frontière avec la file (plan E3 §1) : aucun autre module que
 * celui-ci et `worker/` n'importe `bullmq`.
 */
import { Queue } from "bullmq";
import { createRedisConnection } from "./connection.js";

export const ANALYSIS_QUEUE_NAME = "analysis";

/** Payload d'un job d'analyse — strictement l'id du dossier (US-8.2). */
export interface AnalysisJobData {
  caseFileId: string;
}

let queue: Queue<AnalysisJobData> | undefined;

/** File partagée (créée à la première demande — évite d'ouvrir Redis à l'import). */
export function analysisQueue(): Queue<AnalysisJobData> {
  queue ??= new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      // 2 tentatives au total au niveau applicatif (plan E3 §2 #12) : la
      // relance IA est gérée DANS le job (`runAnalysisJob`), pas par BullMQ.
      // Ici on ne retente que sur crash/coupure réseau du process worker.
      attempts: 2,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { age: 3_600, count: 100 },
      removeOnFail: { age: 24 * 3_600 },
    },
  });
  return queue;
}

/**
 * Enfile l'analyse d'un dossier. `jobId = caseFileId` : deux déclenchements
 * concurrents pour le même dossier ne créent qu'un job tant que le précédent
 * n'est pas terminé (garde-fou anti-doublon, complète le 409 de la route).
 */
export async function enqueueAnalysis(caseFileId: string): Promise<void> {
  await analysisQueue().add("analyze", { caseFileId }, { jobId: caseFileId });
}

/** Ferme la file (arrêt propre du process API). */
export async function closeAnalysisQueue(): Promise<void> {
  await queue?.close();
  queue = undefined;
}
