import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const BACK_ORIGIN = process.env.BACK_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  // Sortie autonome pour l'image Docker : Next produit .next/standalone avec un
  // serveur Node et uniquement les dépendances tracées. Sans cela, l'image
  // devrait embarquer tout node_modules du workspace.
  output: "standalone",
  // Le tracing doit remonter à la racine du workspace npm, sinon
  // `@capclair/contract` (file:../contract, résolu par symlink) n'est pas copié
  // dans la sortie autonome et le serveur ne démarre pas.
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
  // Paquet local (file:../contract) : Next doit le transpiler / le résoudre via le symlink.
  transpilePackages: ["@capclair/contract"],
  async rewrites() {
    // Le navigateur n'appelle que `/api/back/*` (même origine → cookie first-party,
    // pas de CORS). En prod, ce routage est fait par le reverse-proxy (ADR-005).
    return [
      { source: "/api/back/:path*", destination: `${BACK_ORIGIN}/:path*` },
    ];
  },
};

export default nextConfig;
