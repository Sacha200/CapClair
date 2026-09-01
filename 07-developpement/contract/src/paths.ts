/** Chemins des endpoints d'authentification (hors préfixe `/api`). */
export const AUTH_PATHS = {
  REGISTER: "/auth/register",
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  SESSION: "/auth/session",
  FORGOT: "/auth/password/forgot",
  RESET: "/auth/password/reset",
} as const;

export const HEALTH_PATH = "/api/sante";
