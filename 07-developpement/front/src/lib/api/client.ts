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
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = isServer ? BACK_ORIGIN : BROWSER_API_BASE;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.cookieHeader) headers.cookie = options.cookieHeader;

  const res = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, (data as Record<string, unknown>) ?? {});
  }
  return data as T;
}
