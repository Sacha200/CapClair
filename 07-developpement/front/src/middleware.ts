import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/config";

/**
 * Première couche de protection des routes (US-1.4 AC1/AC2).
 *
 * Vérifie seulement la *présence* du cookie de session — l'Edge runtime interdit
 * un appel réseau vers le back ici. La validation réelle est faite par
 * `app/(app)/layout.tsx` (server component). En l'absence de cookie on
 * redirige immédiatement vers /connexion en conservant l'URL demandée.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/connexion";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/dossiers/:path*", "/importer/:path*"],
};
