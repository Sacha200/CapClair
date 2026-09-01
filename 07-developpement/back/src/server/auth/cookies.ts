/**
 * Pose et efface le cookie de session (US-1.2 AC4).
 *
 * `httpOnly` + `secure` + `sameSite=lax`, `path=/`. Le jeton étant déjà opaque
 * et stocké haché, le cookie n'est pas signé. `domain` est omis par défaut
 * (cookie host-only, origine publique unique — ADR-005).
 */
import type { FastifyReply } from "fastify";
import type { CookieSerializeOptions } from "@fastify/cookie";
import { env } from "../../env.js";

const baseOptions: CookieSerializeOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  path: "/",
  domain: env.COOKIE_DOMAIN,
};

export const SESSION_COOKIE = env.SESSION_COOKIE_NAME;

export function setSessionCookie(reply: FastifyReply, rawToken: string): void {
  reply.setCookie(SESSION_COOKIE, rawToken, {
    ...baseOptions,
    maxAge: env.SESSION_TTL_HOURS * 3_600,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, baseOptions);
}
