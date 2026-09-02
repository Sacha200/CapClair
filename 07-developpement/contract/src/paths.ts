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

/** Chemins des endpoints de documents (préfixe `/api`, scope gardé). */
export const DOCUMENT_PATHS = {
  UPLOAD: "/api/documents",
  detail: (id: string) => `/api/documents/${id}`,
  file: (id: string) => `/api/documents/${id}/file`,
  replace: (id: string) => `/api/documents/${id}/replace`,
  confirmFictional: (id: string) => `/api/documents/${id}/confirm-fictional`,
} as const;

/** Chemins des endpoints de dossiers (préfixe `/api`, scope gardé — E3). */
export const CASE_FILE_PATHS = {
  detail: (id: string) => `/api/dossiers/${id}`,
  consentAi: (id: string) => `/api/dossiers/${id}/consentement-ia`,
  analyze: (id: string) => `/api/dossiers/${id}/analyser`,
} as const;
