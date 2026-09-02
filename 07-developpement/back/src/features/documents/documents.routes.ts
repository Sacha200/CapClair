/**
 * Routes de documents (préfixe `/api`, scope gardé — voir app.ts).
 *
 * Le corps d'upload est multipart/form-data : PAS de `schema.body` Zod (le
 * body n'est pas JSON) — la validation (signature, taille) est faite
 * explicitement dans le service via `assertValidUpload` (US-8.1 : voir
 * `upload-validation.ts`). Les `:id` de chemin restent validés par schéma.
 */
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { RATE_LIMITS } from "../../server/http/rate-limit.js";
import { forUser } from "../../server/database/context.js";
import { requireUser } from "../../server/auth/guard.js";
import { AppError } from "../../lib/errors.js";
import * as documentsService from "./documents.service.js";
import { toDocumentMetadataDto, toUploadResponseDto } from "./documents.mapper.js";

const IdParamsSchema = z.object({ id: z.string().uuid() });

export const documentRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post("/api/documents", { config: RATE_LIMITS.import }, async (request, reply) => {
    const part = await request.file();
    if (!part) {
      throw new AppError(400, "Aucun fichier reçu.", { code: "validation" });
    }
    const buffer = await part.toBuffer();
    const db = forUser(requireUser(request).id);
    const result = await documentsService.uploadDocument(db, {
      buffer,
      truncated: part.file.truncated,
      filename: part.filename,
    });
    return reply.code(201).send(toUploadResponseDto(result));
  });

  app.get(
    "/api/documents/:id",
    { config: RATE_LIMITS.import, schema: { params: IdParamsSchema } },
    async (request) => {
      const db = forUser(requireUser(request).id);
      const doc = await documentsService.getDocumentMetadata(db, request.params.id);
      return toDocumentMetadataDto(doc);
    },
  );

  // Aperçu authentifié (US-2.2 AC1/AC3) : 401 sans session (garde du scope),
  // 404 — jamais 403 — si le document appartient à un autre compte (US-1.5).
  app.get(
    "/api/documents/:id/file",
    { config: RATE_LIMITS.import, schema: { params: IdParamsSchema } },
    async (request, reply) => {
      const db = forUser(requireUser(request).id);
      const { mimeType, stream } = await documentsService.openDocumentFile(db, request.params.id);
      return reply
        .header("content-type", mimeType)
        // Sans `filename=` : `originalName` est contrôlé par le client, on
        // évite toute injection dans l'en-tête (voir safeName + plan E2 §12.11).
        .header("content-disposition", "inline")
        .header("x-content-type-options", "nosniff")
        // Contenu contrôlé par l'utilisateur servi inline sous l'origine de
        // l'app (Helmet ne pose pas de CSP globale) : `default-src 'none'`
        // interdit tout chargement de sous-ressource si la réponse était
        // interprétée comme un document. PAS de directive `sandbox` : elle
        // désactive les plugins (spec HTML) et le viewer PDF de Chrome en est
        // un — l'aperçu inline afficherait une page vide (vérifié).
        .header("content-security-policy", "default-src 'none'")
        .header("cache-control", "private, no-store")
        .send(stream);
    },
  );

  app.delete(
    "/api/documents/:id",
    { config: RATE_LIMITS.import, schema: { params: IdParamsSchema } },
    async (request, reply) => {
      const db = forUser(requireUser(request).id);
      await documentsService.removeDocument(db, request.params.id);
      return reply.code(204).send();
    },
  );
};
