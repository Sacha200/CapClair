/** Utilitaires de base de test (base jetable, distincte de la base de dev). */
import { execFileSync } from "node:child_process";
import { createTestPrisma } from "../../src/server/database/client.js";
import type { PrismaClient } from "../../src/server/database/client.js";

/**
 * Résout l'URL de la base de test. Refuse de tourner si l'URL est absente ou
 * pointe sur la base de développement (nom sans suffixe `_test`).
 */
export function resolveTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL manquante. Renseignez une base jetable, ex. " +
        "postgresql://capclair:capclair_dev@localhost:5434/capclair_test?schema=public",
    );
  }
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!/_test(\b|$)/.test(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL vise « ${dbName} » : le nom doit contenir « _test » pour éviter d'effacer la base de dev.`,
    );
  }
  return url;
}

/** Applique le schéma sur la base de test (créée si absente via CREATE DATABASE). */
export function migrateTestDatabase(url: string): void {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
    shell: process.platform === "win32",
  });
}

const TABLES = [
  "AuditEvent",
  "ConsentLog",
  "Notification",
  "Reminder",
  "ResponseDraft",
  "RequiredDocument",
  "ActionItem",
  "ExtractedInformation",
  "Document",
  "CaseFile",
  "Session",
  "Account",
  "VerificationToken",
  "User",
];

/** Vide toutes les tables métier (garde `Category`, référentiel seedé par migration). */
export async function truncateAll(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`,
  );
}

let shared: PrismaClient | undefined;

/** Client Prisma partagé par les tests d'intégration, branché sur la base de test. */
export function testPrisma(): PrismaClient {
  shared ??= createTestPrisma(resolveTestDatabaseUrl());
  return shared;
}

export async function disconnectTestPrisma(): Promise<void> {
  await shared?.$disconnect();
  shared = undefined;
}
