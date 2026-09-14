/**
 * Routes de dossiers (préfixe `/api`, scope gardé — voir app.ts).
 *
 * - `GET   /api/dossiers`                           liste des dossiers + résumé (tableau de bord, US-5.4)
 * - `GET   /api/dossiers/:id`                       statut d'analyse (polling écran 04)
 * - `GET   /api/dossiers/:id/resultat`              graphe complet de l'analyse (écran 05, E4)
 * - `GET   /api/dossiers/:id/historique`            historique du dossier (US-4.5)
 * - `POST  /api/dossiers/:id/consentement-ia`       consentement IA (US-3.1)
 * - `POST  /api/dossiers/:id/analyser`              déclenche l'analyse asynchrone (D8)
 * - `PATCH /api/dossiers/:id/informations/:infoId`  corrige une info extraite (US-4.4)
 * - `PATCH /api/dossiers/:id/echeance`              corrige l'échéance principale (US-4.4 AC5)
 * - `PATCH /api/dossiers/:id`                       corrige organisme/type/date (US-4.4 AC1)
 * - `PATCH /api/dossiers/:id/statut`                change le statut de pilotage (US-5.1 AC2)
 * - `POST  /api/dossiers/:id/actions`               ajoute une action manuelle (US-5.2 AC2)
 * - `PATCH /api/dossiers/:id/actions/:actionId`     coche/décoche une action (US-5.2 AC1)
 * - `DELETE /api/dossiers/:id/actions/:actionId`    supprime définitivement une action (US-5.2 AC3)
 * - `PATCH /api/dossiers/:id/justificatifs/:docId`  coche « fourni » / note libre (US-5.3 AC1/AC2)
 * - `DELETE /api/dossiers/:id`                      suppression définitive et complète (US-5.5)
 *
 * Les routes de *déclenchement* et d'*écriture* (POST, PATCH) portent
 * `config: RATE_LIMITS.analysis` (US-8.1 #48) ; les *lectures* d'écran
 * (`:id`, `:id/resultat`, `:id/historique`) non — seul le plafond global s'applique.
 */
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { RATE_LIMITS } from "../../server/http/rate-limit.js";
import { forUser } from "../../server/database/context.js";
import { requireUser } from "../../server/auth/guard.js";
import * as casesService from "./cases.service.js";
import { toCaseStatusDto } from "./cases.mapper.js";
import {
  ConfirmAiConsentInputSchema,
  CreateActionInputSchema,
  UpdateActionInputSchema,
  UpdateCaseScalarsInputSchema,
  UpdateCaseStatusInputSchema,
  UpdateExtractedInfoInputSchema,
  UpdateMainDeadlineInputSchema,
  UpdateRequiredDocInputSchema,
} from "./cases.dto.js";

const IdParamsSchema = z.object({ id: z.string().uuid() });
const IdInfoParamsSchema = z.object({ id: z.string().uuid(), infoId: z.string().uuid() });
const IdActionParamsSchema = z.object({ id: z.string().uuid(), actionId: z.string().uuid() });
const IdDocParamsSchema = z.object({ id: z.string().uuid(), docId: z.string().uuid() });

export const caseRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // Liste des dossiers + résumé (tableau de bord, US-5.4) : lecture d'écran →
  // pas de preset serré, comme les autres `GET` de ce fichier.
  app.get(
    "/api/dossiers",
    async (request) => {
      const db = forUser(requireUser(request).id);
      return casesService.listCasesWithSummary(db);
    },
  );

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

  // Historique du dossier (US-4.5) : entrées du plus récent au plus ancien,
  // libellés FR (aucun nom technique, AC2), aucun contenu de courrier (AC3).
  // Lecture d'écran → pas de preset serré.
  app.get(
    "/api/dossiers/:id/historique",
    { schema: { params: IdParamsSchema } },
    async (request) => {
      const db = forUser(requireUser(request).id);
      return casesService.getCaseHistory(db, request.params.id);
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

  // Correction d'une information extraite (US-4.4) : pose `isUserCorrected`,
  // journalise. 404 si l'info n'est pas dans ce dossier de ce compte.
  app.patch(
    "/api/dossiers/:id/informations/:infoId",
    {
      config: RATE_LIMITS.analysis,
      schema: { params: IdInfoParamsSchema, body: UpdateExtractedInfoInputSchema },
    },
    async (request) => {
      const db = forUser(requireUser(request).id);
      await casesService.correctInformation(
        db,
        request.params.id,
        request.params.infoId,
        request.body,
      );
      return { ok: true };
    },
  );

  // Correction de l'échéance principale (US-4.4 AC5) : 400
  // `deadline_before_document` si la date précède la date du courrier, 404
  // sinon comme les autres.
  app.patch(
    "/api/dossiers/:id/echeance",
    {
      config: RATE_LIMITS.analysis,
      schema: { params: IdParamsSchema, body: UpdateMainDeadlineInputSchema },
    },
    async (request) => {
      const db = forUser(requireUser(request).id);
      await casesService.correctMainDeadline(db, request.params.id, request.body);
      return { ok: true };
    },
  );

  // Correction organisme / type de courrier / date du courrier (US-4.4 AC1) :
  // au moins une clé (schéma), champs touchés verrouillés contre la ré-analyse.
  app.patch(
    "/api/dossiers/:id",
    {
      config: RATE_LIMITS.analysis,
      schema: { params: IdParamsSchema, body: UpdateCaseScalarsInputSchema },
    },
    async (request) => {
      const db = forUser(requireUser(request).id);
      await casesService.updateCaseScalars(db, request.params.id, request.body);
      return { ok: true };
    },
  );

  // Changement de statut de pilotage (US-5.1 AC2) : verrouille "status" contre
  // la ré-analyse (`LOCKABLE_FIELDS`), journalise sauf si statut identique.
  app.patch(
    "/api/dossiers/:id/statut",
    {
      config: RATE_LIMITS.analysis,
      schema: { params: IdParamsSchema, body: UpdateCaseStatusInputSchema },
    },
    async (request) => {
      const db = forUser(requireUser(request).id);
      await casesService.updateCaseStatus(db, request.params.id, request.body);
      return { ok: true };
    },
  );

  // Ajout manuel d'une action (US-5.2 AC2) : `origin: "MANUEL"`, pas d'extrait
  // source. 404 si le dossier n'appartient pas au compte, 400 sur titre
  // vide/trop long (schéma).
  app.post(
    "/api/dossiers/:id/actions",
    { config: RATE_LIMITS.analysis, schema: { params: IdParamsSchema, body: CreateActionInputSchema } },
    async (request, reply) => {
      const db = forUser(requireUser(request).id);
      const result = await casesService.createAction(db, request.params.id, request.body);
      return reply.code(201).send(result);
    },
  );

  // Coche/décoche une action (US-5.2 AC1) : journalise `action.completed`/
  // `action.reopened`. 404 si `actionId` hors du dossier/compte.
  app.patch(
    "/api/dossiers/:id/actions/:actionId",
    { config: RATE_LIMITS.analysis, schema: { params: IdActionParamsSchema, body: UpdateActionInputSchema } },
    async (request) => {
      const db = forUser(requireUser(request).id);
      await casesService.toggleAction(db, request.params.id, request.params.actionId, request.body);
      return { ok: true };
    },
  );

  // Suppression définitive d'une action (US-5.2 AC3) : journalise
  // `action.deleted`. 404 si hors du dossier/compte.
  app.delete(
    "/api/dossiers/:id/actions/:actionId",
    { config: RATE_LIMITS.analysis, schema: { params: IdActionParamsSchema } },
    async (request) => {
      const db = forUser(requireUser(request).id);
      await casesService.deleteAction(db, request.params.id, request.params.actionId);
      return { ok: true };
    },
  );

  // Checklist des justificatifs (US-5.3 AC1/AC2) : coche « fourni » et/ou pose
  // une note libre. 404 si `docId` hors du dossier/compte, 400 si le corps ne
  // porte aucune des deux clés (schéma) ou dépasse 500 caractères.
  app.patch(
    "/api/dossiers/:id/justificatifs/:docId",
    {
      config: RATE_LIMITS.analysis,
      schema: { params: IdDocParamsSchema, body: UpdateRequiredDocInputSchema },
    },
    async (request) => {
      const db = forUser(requireUser(request).id);
      await casesService.updateRequiredDocument(
        db,
        request.params.id,
        request.params.docId,
        request.body,
      );
      return { ok: true };
    },
  );

  // Suppression définitive et complète du dossier (US-5.5) : aucune
  // confirmation supplémentaire côté serveur — la confirmation explicite
  // (AC1) est une responsabilité front. 404 si absent/autre compte.
  app.delete(
    "/api/dossiers/:id",
    { config: RATE_LIMITS.analysis, schema: { params: IdParamsSchema } },
    async (request) => {
      const db = forUser(requireUser(request).id);
      await casesService.deleteCase(db, request.params.id);
      return { ok: true };
    },
  );
};
