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
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!cookieHeader) return null;

  try {
    const { user } = await getSessionWithCookie(cookieHeader);
    return user ?? null;
  } catch {
    return null;
  }
}
