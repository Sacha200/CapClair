/**
 * Routes de dossiers (préfixe `/api`, scope gardé — voir app.ts).
 *
 * - `GET  /api/dossiers/:id`                 statut d'analyse (polling écran 04)
 * - `GET  /api/dossiers/:id/resultat`        graphe complet de l'analyse (écran 05, E4)
 * - `POST /api/dossiers/:id/consentement-ia` consentement IA (US-3.1), miroir
 *                                            de `confirm-fictional`
 * - `POST /api/dossiers/:id/analyser`        déclenche l'analyse asynchrone (D8)
 *
 * Les routes de *déclenchement* portent `config: RATE_LIMITS.analysis` (US-8.1
 * #48) ; les *lectures* d'écran (`:id`, `:id/resultat`) non — seul le plafond
 * global s'applique.
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

  // Statut d'analyse : consulté en **polling** (2 s, écran 04) — il ne porte
  // donc PAS le preset serré `RATE_LIMITS.analysis` (10/min), qui protège les
  // routes de *déclenchement* (US-8.1 #48) et couperait le polling au bout de
  // ~20 s. Le plafond global (`RATE_LIMIT_GLOBAL_MAX`) reste le garde-fou.
  app.get(
    "/api/dossiers/:id",
    { schema: { params: IdParamsSchema } },
    async (request) => {
      const db = forUser(requireUser(request).id);
      const caseFile = await casesService.getCaseStatus(db, request.params.id);
      return toCaseStatusDto(caseFile);
    },
  );

  // Résultat d'analyse (écran 05, US-4.1 → US-4.3) : 200 + graphe complet si
  // `TERMINEE`, 409 `analysis_not_ready` sinon (le front retombe sur l'écran
  // d'attente), 404 si absent/autre compte. Lecture d'écran → pas de preset
  // serré, comme `GET /api/dossiers/:id`.
  app.get(
    "/api/dossiers/:id/resultat",
    { schema: { params: IdParamsSchema } },
    async (request) => {
      const db = forUser(requireUser(request).id);
      return casesService.getCaseResult(db, request.params.id);
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
