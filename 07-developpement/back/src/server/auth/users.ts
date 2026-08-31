/**
 * Persistance des comptes et du consentement CGU (ADR-002, ADR-004).
 *
 * Vit dans `server/auth/` (exempté de la règle « pas de Prisma direct ») car il
 * s'agit d'infra d'authentification/conformité, pas d'entités métier scopées par
 * dossier.
 */
import { prisma as defaultPrisma } from "../database/client.js";
import type { PrismaClient } from "../database/client.js";
import { LEGAL_BUNDLE_VERSION } from "../../lib/legal.js";

export interface AccountRecord {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
}

export function findByEmail(
  email: string,
  client: PrismaClient = defaultPrisma,
): Promise<AccountRecord | null> {
  return client.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
}

/**
 * Crée le compte et enregistre le consentement CGU dans la même transaction
 * (US-1.1 AC7). Une seule ligne `ConsentLog` de type `CGU` couvre les deux cases
 * (CGU + confidentialité), horodatée par `createdAt`, versionnée par
 * `LEGAL_BUNDLE_VERSION`.
 */
export async function createAccountWithConsent(
  params: { email: string; name: string; passwordHash: string },
  client: PrismaClient = defaultPrisma,
): Promise<AccountRecord> {
  return client.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: params.email.toLowerCase(),
        name: params.name,
        passwordHash: params.passwordHash,
        lastActivityAt: new Date(),
      },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    await tx.consentLog.create({
      data: {
        userId: user.id,
        consentType: "CGU",
        granted: true,
        policyVersion: LEGAL_BUNDLE_VERSION,
      },
    });
    return user;
  });
}

/** Met à jour le hash du mot de passe (réinitialisation). */
export async function updatePasswordHash(
  userId: string,
  passwordHash: string,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  await client.user.update({ where: { id: userId }, data: { passwordHash } });
}

/** Touche `lastActivityAt` (pilote la purge 12 mois — D12). */
export async function touchActivity(
  userId: string,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  await client.user.update({ where: { id: userId }, data: { lastActivityAt: new Date() } });
}

export async function rehashPassword(
  userId: string,
  passwordHash: string,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  await client.user.update({ where: { id: userId }, data: { passwordHash } });
}
