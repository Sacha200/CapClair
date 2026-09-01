/**
 * Jetons de réinitialisation de mot de passe (US-1.3).
 *
 * Réutilise la table `VerificationToken` (ADR-002) : `identifier` = e-mail,
 * `token` = SHA-256 du jeton brut, `expires` = +60 min. Usage unique : consommer
 * supprime la ligne. Le jeton brut n'existe que dans le lien envoyé par e-mail.
 */
import { prisma as defaultPrisma } from "../database/client.js";
import type { PrismaClient } from "../database/client.js";
import { env } from "../../env.js";
import { randomToken, sha256hex } from "../../lib/crypto.js";

const PURPOSE = "password-reset";

/** `identifier` combiné pour ne pas collisionner avec d'autres usages de la table. */
function identifierFor(email: string): string {
  return `${PURPOSE}:${email.toLowerCase()}`;
}

/** Supprime tout jeton de reset en attente pour cet e-mail (avant d'en émettre un neuf). */
export async function purgeResetTokens(
  email: string,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  await client.verificationToken.deleteMany({ where: { identifier: identifierFor(email) } });
}

/** Émet un jeton de reset et renvoie sa valeur brute (à mettre dans le lien e-mail). */
export async function issueResetToken(
  email: string,
  client: PrismaClient = defaultPrisma,
): Promise<string> {
  await purgeResetTokens(email, client);
  const raw = randomToken(32);
  await client.verificationToken.create({
    data: {
      identifier: identifierFor(email),
      token: sha256hex(raw),
      expires: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000),
    },
  });
  return raw;
}

/**
 * Consomme un jeton brut : renvoie l'e-mail associé si le jeton est valide et non
 * expiré, puis supprime la ligne (usage unique). Renvoie `null` sinon.
 */
export async function consumeResetToken(
  rawToken: string,
  client: PrismaClient = defaultPrisma,
): Promise<string | null> {
  const hash = sha256hex(rawToken);
  const row = await client.verificationToken.findUnique({ where: { token: hash } });
  if (!row || !row.identifier.startsWith(`${PURPOSE}:`)) return null;
  if (row.expires.getTime() <= Date.now()) {
    await client.verificationToken.deleteMany({ where: { token: hash } });
    return null;
  }
  await client.verificationToken.deleteMany({ where: { token: hash } });
  return row.identifier.slice(PURPOSE.length + 1);
}
