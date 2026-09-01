/**
 * Limitation de débit par route (US-8.1).
 *
 * `@fastify/rate-limit` est enregistré globalement dans `src/app.ts` avec un
 * plafond large (garde-fou anti-abus). Les routes sensibles resserrent ce
 * plafond via `config: RATE_LIMITS.<preset>`. Tous les seuils viennent de
 * l'environnement (US-8.1 AC3) — voir `.env.example`.
 *
 * Le dépassement renvoie `429 { error, code: "rate_limited" }` avec un message
 * français indiquant le délai d'attente (US-8.1 AC2), construit par
 * `errorResponseBuilder` dans `src/app.ts`.
 */
import { env } from "../../env.js";

/** Config `rateLimit` d'une route Fastify (`{ rateLimit: { max, timeWindow } }`). */
export function routeRateLimit(max: number, timeWindow: string) {
  return { rateLimit: { max, timeWindow } } as const;
}

/**
 * Presets nommés, un par domaine soumis à limitation (US-8.1 AC1).
 * `import` et `analysis` sont prêts pour les routes d'E2/E3 : à la création de
 * ces routes, il suffit d'ajouter `config: RATE_LIMITS.import` (resp. `.analysis`).
 */
export const RATE_LIMITS = {
  login: routeRateLimit(env.RATE_LIMIT_LOGIN_MAX, env.RATE_LIMIT_LOGIN_WINDOW),
  register: routeRateLimit(env.RATE_LIMIT_REGISTER_MAX, env.RATE_LIMIT_REGISTER_WINDOW),
  forgot: routeRateLimit(env.RATE_LIMIT_FORGOT_MAX, env.RATE_LIMIT_FORGOT_WINDOW),
  reset: routeRateLimit(env.RATE_LIMIT_RESET_MAX, env.RATE_LIMIT_RESET_WINDOW),
  import: routeRateLimit(env.RATE_LIMIT_IMPORT_MAX, env.RATE_LIMIT_IMPORT_WINDOW),
  analysis: routeRateLimit(env.RATE_LIMIT_ANALYSIS_MAX, env.RATE_LIMIT_ANALYSIS_WINDOW),
} as const;
