/**
 * Point d'entrée du process worker (BullMQ).
 *
 * Aucune queue n'est encore déclarée (E1) : le worker se contente d'ouvrir la
 * connexion Redis et de rester en vie. Les files (analyse, rappels, purge)
 * seront ajoutées à partir de E3/E7.
 */
import { createRedisConnection } from "../server/queues/connection.js";
import { logger } from "../lib/logger.js";

async function main(): Promise<void> {
  const connection = createRedisConnection();
  await connection.connect();
  logger.info("worker ready (aucune queue enregistrée pour le moment)");

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Arrêt du worker…");
    void connection.quit().then(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Échec du démarrage du worker");
  process.exit(1);
});
