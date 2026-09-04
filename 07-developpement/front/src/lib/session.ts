import "server-only";
import { cookies } from "next/headers";
import type { SessionUser } from "@capclair/contract";
import { getSessionWithCookie } from "@/lib/api/auth";

/**
 * Vérifie la session côté serveur en interrogeant le back (`GET /auth/session`).
 *
 * Renvoie `null` dès qu'on ne peut PAS confirmer une session valide : cookie
 * absent, `401`, back injoignable, réponse inattendue. Un back en panne rend
 * l'utilisateur « non connecté », il ne fait pas planter la page.
 */
/**
 * Reconstruit l'en-tête `Cookie` de la requête entrante, pour le relayer au
 * back depuis un server component (les appels RSC ne portent pas le cookie
 * first-party automatiquement). Chaîne vide si aucun cookie.
 */
export async function readCookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieHeader = await readCookieHeader();
  if (!cookieHeader) return null;

  try {
    const { user } = await getSessionWithCookie(cookieHeader);
    return user ?? null;
  } catch {
    return null;
  }
}
