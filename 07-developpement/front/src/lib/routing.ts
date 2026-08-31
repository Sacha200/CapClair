/**
 * N'autorise qu'un chemin interne comme cible de redirection post-connexion
 * (US-1.4 AC2). Bloque les URL absolues et les `//host` (open redirect).
 */
export function sanitizeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
