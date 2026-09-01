/**
 * Hachage des mots de passe — argon2id (US-1.1 AC5).
 *
 * `DUMMY_HASH` sert à égaliser le temps de `login` quand l'e-mail n'existe pas :
 * on lance quand même une vérification argon2 pour ne pas révéler l'absence de
 * compte par un temps de réponse plus court.
 */
import argon2 from "argon2";
import { env } from "../../env.js";

const options: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: env.ARGON2_MEMORY_KIB,
  timeCost: env.ARGON2_TIME_COST,
  parallelism: env.ARGON2_PARALLELISM,
};

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, options);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, options);
  } catch {
    return true;
  }
}

/** Hash constant d'une valeur fixe, calculé une fois au démarrage. */
export const DUMMY_HASH: Promise<string> = argon2.hash(
  "capclair-dummy-password-for-constant-time-login",
  options,
);
