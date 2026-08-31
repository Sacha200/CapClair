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

/** Connexion mutualisée pour les usages non-worker (rate-limit, health check). */
export function sharedRedis(): Redis {
  shared ??= new Redis(env.REDIS_URL, { lazyConnect: true });
  return shared;
}
