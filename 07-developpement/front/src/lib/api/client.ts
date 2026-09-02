import { BACK_ORIGIN, BROWSER_API_BASE } from "@/lib/config";
import { ApiError } from "./errors";

const isServer = typeof window === "undefined";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Côté serveur, transmettre l'en-tête Cookie de la requête entrante. */
  cookieHeader?: string;
}

/**
 * Appel HTTP vers le back.
 * - navigateur : URL relative `/api/back/*` (réécrite par next.config.ts), cookie first-party ;
 * - serveur (RSC/middleware/route handlers) : URL absolue + `Cookie` transmis explicitement.
 *
 * Toute défaillance (back injoignable, réponse non-JSON, statut d'erreur) est
 * normalisée en `ApiError` — jamais de `TypeError`/`SyntaxError` qui remonterait
 * brut jusqu'à une page.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = isServer ? BACK_ORIGIN : BROWSER_API_BASE;
  const hasBody = options.body !== undefined;
  // Un FormData part tel quel : le navigateur pose lui-même le content-type
  // multipart avec sa boundary — ne surtout pas l'écraser (upload E2).
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {};
  // Ne PAS annoncer un content-type JSON sans corps : Fastify rejette alors la
  // requête (FST_ERR_CTP_EMPTY_JSON_BODY → 400). Concerne p. ex. POST /auth/logout.
  if (hasBody && !isForm) headers["content-type"] = "application/json";
  if (options.cookieHeader) headers.cookie = options.cookieHeader;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: hasBody ? (isForm ? (options.body as FormData) : JSON.stringify(options.body)) : undefined,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    // Back injoignable (connexion refusée, DNS, timeout…).
    throw new ApiError(0, { error: "Service indisponible. Réessayez dans un instant.", code: "network" });
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined; // Réponse non-JSON (page d'erreur HTML d'un proxy, par ex.).
  }

  if (!res.ok) {
    const envelope =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    throw new ApiError(res.status, envelope);
  }
  return data as T;
}
