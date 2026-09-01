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
  // En prod, le hachage argon2 (timeCost 3 / 64 MiB, ~200 ms) domine et absorbe
  // l'écart d'insertion entre les branches de `register`. En test, argon2 est
  // dialé au minimum : on relève donc le plancher pour que les deux branches
  // restent bornées par lui (US-1.1 AC4).
  process.env.AUTH_FIXED_DELAY_MS ??= "400";
  process.env.AUTH_FIXED_DELAY_JITTER_MS ??= "20";
  migrateTestDatabase(url);
}
