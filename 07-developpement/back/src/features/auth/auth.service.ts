/**
 * Logique métier de l'authentification (US-1.1 à US-1.3).
 *
 * Règles transverses :
 *  - anti-énumération : `register` et `forgot` répondent avec le même corps, le
 *    même statut et le même délai que l'e-mail existe ou non
 *    (`withMinimumDuration`). Seul l'en-tête `Set-Cookie` de `register` diffère
 *    (auto-login uniquement pour un vrai nouveau compte) — asymétrie assumée
 *    (ADR-004 / B1).
 *  - le serveur décide : les routes ne font que valider l'entrée (Zod) et poser
 *    le cookie ; toute la logique est ici.
 */
import { env } from "../../env.js";
import { AppError } from "../../lib/errors.js";
import { withMinimumDuration } from "../../lib/delay.js";
import { AUTH_MESSAGES, type ForgotInput, type LoginInput, type RegisterInput, type ResetInput } from "./auth.dto.js";
import { toSessionUserDTO } from "./auth.mapper.js";
import type { SessionUserDTO } from "./auth.dto.js";
import { DUMMY_HASH, hashPassword, needsRehash, verifyPassword } from "../../server/auth/password.js";
import { createSession, lookupSession, revokeAllForUser, revokeSession } from "../../server/auth/session.js";
import { consumeResetToken, issueResetToken } from "../../server/auth/tokens.js";
import {
  createAccountWithConsent,
  findByEmail,
  rehashPassword,
  touchActivity,
  updatePasswordHash,
} from "../../server/auth/users.js";
import { mailer } from "../../server/mail/mailer.js";
import { passwordResetMail } from "../../server/mail/templates/passwordReset.js";

export interface RegisterResult {
  /** Jeton de session brut à poser en cookie — présent uniquement pour un vrai nouveau compte. */
  sessionToken?: string;
}

export interface LoginResult {
  user: SessionUserDTO;
  sessionToken: string;
}

const delay = <T>(fn: () => Promise<T>) =>
  withMinimumDuration(fn, env.AUTH_FIXED_DELAY_MS, env.AUTH_FIXED_DELAY_JITTER_MS);

export function register(input: RegisterInput): Promise<RegisterResult> {
  return delay(async () => {
    // Toujours hacher : égalise le temps de traitement quel que soit le cas.
    const passwordHash = await hashPassword(input.password);
    const existing = await findByEmail(input.email);
    if (existing) {
      return {}; // e-mail déjà pris : on ne crée rien, on ne connecte pas.
    }
    const user = await createAccountWithConsent({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    const sessionToken = await createSession(user.id);
    return { sessionToken };
  });
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const account = await findByEmail(input.email);

  if (!account || !account.passwordHash) {
    // Vérification factice pour ne pas révéler l'absence de compte par le temps.
    await verifyPassword(await DUMMY_HASH, input.password);
    throw new AppError(401, AUTH_MESSAGES.invalidCredentials, { code: "invalid_credentials" });
  }

  const ok = await verifyPassword(account.passwordHash, input.password);
  if (!ok) {
    throw new AppError(401, AUTH_MESSAGES.invalidCredentials, { code: "invalid_credentials" });
  }

  if (needsRehash(account.passwordHash)) {
    await rehashPassword(account.id, await hashPassword(input.password));
  }
  await touchActivity(account.id);

  const sessionToken = await createSession(account.id);
  return {
    user: toSessionUserDTO({ id: account.id, email: account.email, name: account.name }),
    sessionToken,
  };
}

export function logout(rawToken: string | undefined): Promise<void> {
  return revokeSession(rawToken);
}

export async function getSession(rawToken: string | undefined): Promise<SessionUserDTO | null> {
  const user = await lookupSession(rawToken);
  return user ? toSessionUserDTO(user) : null;
}

export function forgotPassword(input: ForgotInput): Promise<void> {
  return delay(async () => {
    const account = await findByEmail(input.email);
    if (!account) return; // réponse identique : on ne divulgue rien.
    const rawToken = await issueResetToken(account.email);
    await mailer.send(passwordResetMail({ to: account.email, rawToken }));
  });
}

export async function resetPassword(input: ResetInput): Promise<void> {
  // TODO(hardening) : envelopper consume + updatePassword + revokeAll dans une
  // seule transaction (server/auth). En l'état, si l'update échoue après la
  // consommation du jeton, l'utilisateur doit redemander un lien — sans faille.
  const email = await consumeResetToken(input.token);
  if (!email) {
    throw new AppError(400, AUTH_MESSAGES.resetLinkInvalid, { code: "reset_link_invalid" });
  }
  const account = await findByEmail(email);
  if (!account) {
    // Le compte a disparu entre l'émission et l'usage : jeton déjà consommé, on s'arrête.
    throw new AppError(400, AUTH_MESSAGES.resetLinkInvalid, { code: "reset_link_invalid" });
  }
  const passwordHash = await hashPassword(input.password);
  await updatePasswordHash(account.id, passwordHash);
  await revokeAllForUser(account.id); // US-1.3 AC4 : invalide toutes les sessions.
}
