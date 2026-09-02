/**
 * Point d'entrée du process worker (BullMQ).
 *
 * File enregistrée : `analysis` (E3, D8) — analyse asynchrone d'un courrier.
 * Les files rappels/purge viendront à partir de E7.
 *
 * Concurrency 1 (plan E3 §6.2) : pas de besoin de parallélisme au volume MVP,
 * et cela évite qu'une relance manuelle croise un job encore en cours sur le
 * même dossier.
 */
import { Worker } from "bullmq";
import { createRedisConnection } from "../server/queues/connection.js";
import { ANALYSIS_QUEUE_NAME, type AnalysisJobData } from "../server/queues/analysis.js";
import { runAnalysisJob } from "./analysis.js";
import { logger } from "../lib/logger.js";

async function main(): Promise<void> {
  const connection = createRedisConnection();
  await connection.connect();

  const analysisWorker = new Worker<AnalysisJobData>(
    ANALYSIS_QUEUE_NAME,
    async (job) => {
      // `runAnalysisJob` ne lève jamais : il traduit toute erreur métier en
      // AnalysisStatus.ECHEC. Une exception ici signifierait un bug de câblage.
      await runAnalysisJob(job.data.caseFileId);
    },
    { connection: createRedisConnection(), concurrency: 1 },
  );

  analysisWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Job d'analyse en échec (niveau BullMQ)");
  });

  logger.info({ queue: ANALYSIS_QUEUE_NAME }, "worker prêt");

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Arrêt du worker…");
    void Promise.allSettled([analysisWorker.close(), connection.quit()]).then(() =>
      process.exit(0),
    );
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Échec du démarrage du worker");
  process.exit(1);
});
