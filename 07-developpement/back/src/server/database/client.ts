/**
 * Client Prisma unique (singleton), branché sur PostgreSQL via l'adaptateur pg.
 *
 * Prisma 7 : le client est généré dans le dépôt (src/generated/prisma), l'URL de
 * connexion vient de l'environnement (jamais du schéma).
 *
 * ⚠️ N'importez PAS ce module depuis `features/*` : passez par
 * `server/database/context.ts` (isolation `userId`, US-1.5).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../../env.js";

function createPrisma(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __capclairPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__capclairPrisma ?? createPrisma(env.DATABASE_URL);

if (env.NODE_ENV !== "production") {
  globalForPrisma.__capclairPrisma = prisma;
}

/** Client jetable pour les tests d'intégration (base séparée). À `$disconnect()` en fin de suite. */
export function createTestPrisma(connectionString: string): PrismaClient {
  return createPrisma(connectionString);
}

export type { PrismaClient };
