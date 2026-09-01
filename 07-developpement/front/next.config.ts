import type { NextConfig } from "next";

const BACK_ORIGIN = process.env.BACK_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
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
