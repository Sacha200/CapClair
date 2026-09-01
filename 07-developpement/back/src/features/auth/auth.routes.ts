/**
 * Routes d'authentification (préfixe `/auth`, hors scope `/api` donc non gardées).
 *
 * Chaque route valide son entrée avec le schéma Zod du contrat. Les limites de
 * débit (US-8.1) sont posées par route via `config: RATE_LIMITS.*` — seuils
 * issus de l'environnement (voir `server/http/rate-limit.ts`).
 */
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { AUTH_MESSAGES } from "./auth.dto.js";
import {
  ForgotInputSchema,
  LoginInputSchema,
  RegisterInputSchema,
  ResetInputSchema,
} from "./auth.dto.js";
import * as authService from "./auth.service.js";
import { SESSION_COOKIE, clearSessionCookie, setSessionCookie } from "../../server/auth/cookies.js";
import { RATE_LIMITS } from "../../server/http/rate-limit.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/auth/register",
    {
      config: RATE_LIMITS.register,
      schema: { body: RegisterInputSchema },
    },
    async (request, reply) => {
      const result = await authService.register(request.body);
      if (result.sessionToken) setSessionCookie(reply, result.sessionToken);
      return reply.code(200).send({ ok: true });
    },
  );

  app.post(
    "/auth/login",
    {
      config: RATE_LIMITS.login,
      schema: { body: LoginInputSchema },
    },
    async (request, reply) => {
      const { user, sessionToken } = await authService.login(request.body);
      setSessionCookie(reply, sessionToken);
      return reply.code(200).send({ ok: true, user });
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    await authService.logout(request.cookies[SESSION_COOKIE]);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/auth/session", async (request, reply) => {
    const user = await authService.getSession(request.cookies[SESSION_COOKIE]);
    if (!user) {
      return reply.code(401).send({ error: AUTH_MESSAGES.invalidCredentials, code: "unauthorized" });
    }
    return reply.code(200).send({ user });
  });

  app.post(
    "/auth/password/forgot",
    {
      config: RATE_LIMITS.forgot,
      schema: { body: ForgotInputSchema },
    },
    async (request, reply) => {
      await authService.forgotPassword(request.body);
      return reply.code(200).send({ status: "ok" });
    },
  );

  app.post(
    "/auth/password/reset",
    {
      config: RATE_LIMITS.reset,
      schema: { body: ResetInputSchema },
    },
    async (request, reply) => {
      await authService.resetPassword(request.body);
      return reply.code(200).send({ ok: true });
    },
  );
};
