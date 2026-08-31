/**
 * `globalSetup` des tests d'intégration.
 *
 * - force `DATABASE_URL` sur la base de test (les workers en héritent : le
 *   singleton Prisma de l'app tourne donc sur la base jetable) ;
 * - applique les migrations une fois pour toute la suite.
 */
import { migrateTestDatabase, resolveTestDatabaseUrl } from "./helpers/testDb.js";

export default function setup(): void {
  const url = resolveTestDatabaseUrl();
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = url;
  // argon2 rapide en test.
  process.env.ARGON2_MEMORY_KIB ??= "8192";
  process.env.ARGON2_TIME_COST ??= "1";
  process.env.AUTH_FIXED_DELAY_MS ??= "60";
  process.env.AUTH_FIXED_DELAY_JITTER_MS ??= "10";
  migrateTestDatabase(url);
}
