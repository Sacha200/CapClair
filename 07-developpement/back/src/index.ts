/** Point d'entrée du process API. */
import { buildApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Arrêt du serveur…");
    void app.close().then(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Échec du démarrage");
  process.exit(1);
});
