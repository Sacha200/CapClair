/**
 * Routes d'authentification (préfixe `/auth`, hors scope `/api` donc non gardées).
 *
 * Chaque route valide son entrée avec le schéma Zod du contrat. Les limites de
 * débit (US-8.1) sont posées par route via `config.rateLimit` — seuils issus de
 * l'environnement.
 */
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "../../env.js";
import { AUTH_MESSAGES } from "./auth.dto.js";
import {
  ForgotInputSchema,
  LoginInputSchema,
  RegisterInputSchema,
  ResetInputSchema,
} from "./auth.dto.js";
import * as authService from "./auth.service.js";
import { SESSION_COOKIE, clearSessionCookie, setSessionCookie } from "../../server/auth/cookies.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/auth/register",
    {
      config: { rateLimit: { max: env.RATE_LIMIT_REGISTER_MAX, timeWindow: "15 minutes" } },
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
      config: {
        rateLimit: { max: env.RATE_LIMIT_LOGIN_MAX, timeWindow: env.RATE_LIMIT_LOGIN_WINDOW },
      },
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
      config: { rateLimit: { max: env.RATE_LIMIT_FORGOT_MAX, timeWindow: "15 minutes" } },
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
      config: { rateLimit: { max: env.RATE_LIMIT_RESET_MAX, timeWindow: "15 minutes" } },
      schema: { body: ResetInputSchema },
    },
    async (request, reply) => {
      await authService.resetPassword(request.body);
      return reply.code(200).send({ ok: true });
    },
  );
};
