/**
 * Erreurs applicatives. Le gestionnaire d'erreurs Fastify (src/app.ts) les
 * traduit en réponses JSON `{ error, code?, fields? }` sans fuite d'interne.
 */

export interface AppErrorOptions {
  code?: string;
  fields?: Record<string, string>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.status = status;
    this.code = options.code;
    this.fields = options.fields;
  }
}

/** Ressource inexistante OU appartenant à un autre compte. Toujours 404, jamais 403 (US-1.5 AC2). */
export class NotFoundError extends AppError {
  constructor(resource = "resource") {
    super(404, "Ressource introuvable.", { code: "not_found", cause: { resource } });
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(fields: Record<string, string>, message = "Requête invalide.") {
    super(400, message, { code: "validation", fields });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentification requise.") {
    super(401, message, { code: "unauthorized" });
    this.name = "UnauthorizedError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Trop de tentatives. Réessayez plus tard.") {
    super(429, message, { code: "rate_limited" });
    this.name = "RateLimitError";
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
