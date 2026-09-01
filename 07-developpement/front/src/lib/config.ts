/** Configuration front (valeurs non secrètes ; le back a sa propre validation). */

/** Origine du back pour les appels côté serveur (RSC, middleware, route handlers). */
export const BACK_ORIGIN = process.env.BACK_ORIGIN ?? "http://localhost:3001";

/** Préfixe des appels côté navigateur : réécrit vers le back par next.config.ts. */
export const BROWSER_API_BASE = "/api/back";

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "capclair_session";

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
