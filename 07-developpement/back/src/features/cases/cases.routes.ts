/**
 * Routes de dossiers (préfixe `/api`, scope gardé — voir app.ts).
 *
 * - `GET  /api/dossiers/:id`                 statut d'analyse (polling écran 04)
 * - `POST /api/dossiers/:id/consentement-ia` consentement IA (US-3.1), miroir
 *                                            de `confirm-fictional`
 * - `POST /api/dossiers/:id/analyser`        déclenche l'analyse asynchrone (D8)
 *
 * Toutes portent `config: RATE_LIMITS.analysis` (clôt US-8.1 #48).
 */
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { RATE_LIMITS } from "../../server/http/rate-limit.js";
import { forUser } from "../../server/database/context.js";
import { requireUser } from "../../server/auth/guard.js";
import * as casesService from "./cases.service.js";
import { toCaseStatusDto } from "./cases.mapper.js";
import { ConfirmAiConsentInputSchema } from "./cases.dto.js";

const IdParamsSchema = z.object({ id: z.string().uuid() });

export const caseRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/api/dossiers/:id",
    { config: RATE_LIMITS.analysis, schema: { params: IdParamsSchema } },
    async (request) => {
      const db = forUser(requireUser(request).id);
      const caseFile = await casesService.getCaseStatus(db, request.params.id);
      return toCaseStatusDto(caseFile);
    },
  );

  // Consentement IA (US-3.1) : `confirmed` doit être littéralement `true`
  // (schéma du contrat) — `false` échoue en validation. Action distincte de
  // la confirmation « document fictif » (AC2).
  app.post(
    "/api/dossiers/:id/consentement-ia",
    {
      config: RATE_LIMITS.analysis,
      schema: { params: IdParamsSchema, body: ConfirmAiConsentInputSchema },
    },
    async (request) => {
      const db = forUser(requireUser(request).id);
      await casesService.confirmAiConsent(db, request.params.id);
      return { ok: true };
    },
  );

  // Déclenchement (US-3.1 AC3, D8) : 403 sans consentement valide, 409 si déjà
  // en cours/terminé, 202 + `EN_ATTENTE` sinon (le worker prend le relais).
  app.post(
    "/api/dossiers/:id/analyser",
    { config: RATE_LIMITS.analysis, schema: { params: IdParamsSchema } },
    async (request, reply) => {
      const db = forUser(requireUser(request).id);
      const result = await casesService.startAnalysis(db, request.params.id);
      return reply.code(202).send(result);
    },
  );
};
