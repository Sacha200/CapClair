/**
 * Assemblage de l'application Fastify.
 *
 * Périmètre des routes :
 *  - `GET /api/sante`      : public (sonde d'état).
 *  - `/auth/*`             : public (register/login/logout/session/password).
 *  - `/api/*` (autre)      : gardé — 401 sans session valide (US-1.4 AC3).
 *    dont `/api/documents/*` (US-2.1/US-2.2, import et aperçu de documents).
 *
 * Le gestionnaire d'erreurs unique traduit les erreurs applicatives en
 * `{ error, code?, fields? }` sans jamais fuiter d'interne (US-8.2).
 */
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { env, isProd } from "./env.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./lib/errors.js";
import { authGuard } from "./server/auth/guard.js";
import { authRoutes } from "./features/auth/auth.routes.js";
import { documentRoutes } from "./features/documents/index.js";
import { caseRoutes } from "./features/cases/index.js";
import { healthRoutes } from "./features/health/health.routes.js";
import { closeAnalysisQueue } from "./server/queues/analysis.js";
import { AUTH_MESSAGES, MAX_UPLOAD_BYTES } from "@capclair/contract";

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    trustProxy: env.TRUST_PROXY,
    disableRequestLogging: !isProd,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  // Import de documents (US-2.1). `limits.fileSize` coupe le flux au plafond
  // du contrat partagé (source unique : le message 413 y est figé à « 10 Mo ») ;
  // `throwFileSizeLimit: false` laisse `part.file.truncated` se positionner
  // SANS lever d'erreur générique côté plugin — c'est `assertValidUpload` qui
  // décide et produit le message 413 exact (voir upload-validation.ts).
  await app.register(multipart, {
    throwFileSizeLimit: false,
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4, parts: 6 },
  });
  // Limitation de débit (US-8.1). Plafond global = garde-fou anti-abus sur
  // TOUTES les routes (y compris celles d'import/analyse à venir) ; les routes
  // sensibles le resserrent via `config: RATE_LIMITS.*` (voir server/http/rate-limit).
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_GLOBAL_MAX,
    timeWindow: env.RATE_LIMIT_GLOBAL_WINDOW,
    keyGenerator: (request) => request.ip,
    // Enveloppe d'erreur standard `{ error, code }` + délai d'attente en français.
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      code: "rate_limited",
      error: `Trop de tentatives. Réessayez dans ${context.after}.`,
    }),
  });

  // Gestionnaires d'erreur AVANT l'enregistrement des routes : les contextes
  // enfants (plugins de routes) héritent du gestionnaire présent à leur création.
  app.setNotFoundHandler((_request, reply) => {
    void reply.code(404).send({ error: "Route inconnue.", code: "not_found" });
  });

  app.setErrorHandler((error, request, reply) => {
    // Échec de validation Zod (corps/params/query).
    if (hasZodFastifySchemaValidationErrors(error)) {
      const fields: Record<string, string> = {};
      for (const issue of error.validation) {
        const path = issue.params?.issue?.path?.join(".") ?? issue.instancePath.replace(/^\//, "");
        if (path) fields[path] = issue.params?.issue?.message ?? issue.message ?? "Champ invalide.";
      }
      return reply.code(400).send({ error: "Requête invalide.", code: "validation", fields });
    }

    if (error instanceof AppError) {
      return reply.code(error.status).send({
        error: error.message,
        code: error.code,
        ...(error.fields ? { fields: error.fields } : {}),
      });
    }

    const fastifyError = error as { statusCode?: number; code?: string };

    if (fastifyError.statusCode === 429) {
      return reply
        .code(429)
        .send({ error: AUTH_MESSAGES.tooManyAttempts, code: "rate_limited" });
    }

    // Erreurs de requête côté client (corps JSON absent/malformé, content-type…).
    if (typeof fastifyError.statusCode === "number" && fastifyError.statusCode < 500) {
      return reply
        .code(fastifyError.statusCode)
        .send({ error: "Requête invalide.", code: fastifyError.code ?? "bad_request" });
    }

    request.log.error({ err: error }, "Erreur non gérée");
    return reply.code(500).send({ error: "Erreur interne.", code: "internal" });
  });

  // --- Routes publiques ---
  await app.register(healthRoutes);
  await app.register(authRoutes);

  // --- Scope /api gardé ---
  await app.register(async (secured) => {
    await secured.register(authGuard);
    secured.addHook("preHandler", secured.authenticate);

    // Route de fumée pour tester la garde (US-1.4 AC3/AC4).
    secured.get("/api/_ping", async (request) => ({ ok: true, userId: request.user?.id }));

    await secured.register(documentRoutes); // US-2.1/US-2.2
    await secured.register(caseRoutes); // US-3.1 (consentement IA + déclenchement)
  });

  // La file BullMQ est ouverte paresseusement au premier enfilement ; on la
  // referme à l'arrêt du serveur pour ne pas laisser fuiter une connexion Redis.
  app.addHook("onClose", async () => {
    await closeAnalysisQueue();
  });

  return app;
}
