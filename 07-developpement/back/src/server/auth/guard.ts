/**
 * Garde d'authentification pour le scope `/api` (US-1.4 AC3).
 *
 * `fastify.authenticate` est un preHandler : sans session valide → 401 (enveloppe
 * JSON standard). Avec session → `request.user` est renseigné pour les handlers.
 * `/api/sante` reste public (enregistré hors du scope gardé).
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { lookupSession, type SessionUser } from "./session.js";
import { SESSION_COOKIE } from "./cookies.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionUser;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authGuardPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", undefined);

  fastify.decorate(
    "authenticate",
    async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const raw = request.cookies[SESSION_COOKIE];
      const user = await lookupSession(raw);
      if (!user) {
        await reply
          .code(401)
          .send({ error: "Authentification requise.", code: "unauthorized" });
        return;
      }
      request.user = user;
    },
  );
};

export const authGuard = fp(authGuardPlugin, { name: "auth-guard" });

/** Récupère l'utilisateur courant après passage du preHandler `authenticate`. */
export function requireUser(request: FastifyRequest): SessionUser {
  if (!request.user) {
    throw new Error("requireUser appelé sans preHandler `authenticate`.");
  }
  return request.user;
}
