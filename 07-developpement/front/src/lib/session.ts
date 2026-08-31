import "server-only";
import { cookies } from "next/headers";
import type { SessionUser } from "@capclair/contract";
import { getSessionWithCookie } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";

/**
 * Vérifie la session côté serveur en interrogeant le back (`GET /auth/session`),
 * en transmettant le cookie de la requête entrante. Renvoie `null` si absente ou
 * invalide. Utilisé par le layout de l'espace connecté (garde autoritaire).
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!cookieHeader) return null;

  try {
    const { user } = await getSessionWithCookie(cookieHeader);
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
