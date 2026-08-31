/**
 * Sessions opaques (ADR-002).
 *
 * Le jeton livré au client est aléatoire (256 bits, base64url). En base on ne
 * stocke que son empreinte SHA-256 : une fuite de la table `Session` ne permet
 * pas de forger un cookie valide. Révocation = suppression de la ligne
 * (US-1.2 AC5, US-1.3 AC4).
 */
import { prisma as defaultPrisma } from "../database/client.js";
import type { PrismaClient } from "../database/client.js";
import { env } from "../../env.js";
import { randomToken, sha256hex } from "../../lib/crypto.js";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

function ttlDate(): Date {
  return new Date(Date.now() + env.SESSION_TTL_HOURS * 3_600_000);
}

/** Crée une session et renvoie le jeton brut à poser en cookie. */
export async function createSession(
  userId: string,
  client: PrismaClient = defaultPrisma,
): Promise<string> {
  const raw = randomToken(32);
  await client.session.create({
    data: { sessionToken: sha256hex(raw), userId, expires: ttlDate() },
  });
  return raw;
}

/** Résout un jeton brut en utilisateur, ou `null` si absent/expiré (ligne purgée). */
export async function lookupSession(
  rawToken: string | undefined,
  client: PrismaClient = defaultPrisma,
): Promise<SessionUser | null> {
  if (!rawToken) return null;
  const hash = sha256hex(rawToken);
  const row = await client.session.findUnique({
    where: { sessionToken: hash },
    include: { user: true },
  });
  if (!row) return null;
  if (row.expires.getTime() <= Date.now()) {
    await client.session.deleteMany({ where: { sessionToken: hash } });
    return null;
  }
  return { id: row.user.id, email: row.user.email, name: row.user.name };
}

/** Révoque une session précise (déconnexion). Idempotent. */
export async function revokeSession(
  rawToken: string | undefined,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  if (!rawToken) return;
  await client.session.deleteMany({ where: { sessionToken: sha256hex(rawToken) } });
}

/** Révoque toutes les sessions d'un compte (réinitialisation de mot de passe). */
export async function revokeAllForUser(
  userId: string,
  client: PrismaClient = defaultPrisma,
): Promise<number> {
  const { count } = await client.session.deleteMany({ where: { userId } });
  return count;
}
