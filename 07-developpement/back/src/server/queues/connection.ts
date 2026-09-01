/**
 * Connexion Redis partagée pour BullMQ (file de tâches) et, en option, le store
 * de rate-limit. Aucune queue n'est encore déclarée (E1) ; ce module fournit la
 * fabrique de connexions.
 */
import { Redis } from "ioredis";
import { env } from "../../env.js";

/** BullMQ exige `maxRetriesPerRequest: null` sur la connexion des workers. */
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
}

let shared: Redis | undefined;

/**
 * Connexion mutualisée pour les usages non-worker (rate-limit, sonde d'état).
 * Réglée pour **échouer vite** : la sonde `/api/sante` ne doit jamais se bloquer
 * si Redis est indisponible.
 */
export function sharedRedis(): Redis {
  if (!shared) {
    shared = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 1_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    // La sonde d'état gère l'indisponibilité ; on évite juste le bruit "unhandled error".
    shared.on("error", () => {});
  }
  return shared;
}
