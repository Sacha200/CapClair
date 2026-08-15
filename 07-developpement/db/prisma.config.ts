// ============================================================================
// CapClair — Configuration Prisma (v7)
// ----------------------------------------------------------------------------
// Depuis Prisma 7, l'URL de connexion ne vit plus dans le bloc `datasource`
// du schéma : elle est déclarée ici. Ce fichier est aussi le point d'entrée
// des commandes CLI (validate, migrate, generate, db seed).
//
// Deux pièges de la v7, tous deux vérifiés :
//   1. Prisma ne charge plus `.env` tout seul — d'où `import "dotenv/config"`.
//      Sans cette ligne : PrismaConfigEnvError: Cannot resolve environment
//      variable: DATABASE_URL.
//   2. `npx prisma` seul ne suffit plus : `prisma/config` doit être résolvable
//      depuis ce fichier, donc `prisma` doit être installé en devDependency.
//
// À déplacer tel quel à la racine du dépôt applicatif lors du scaffolding,
// avec le dossier prisma/ à côté.
// ============================================================================

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Le référentiel des catégories (D14) n'est PAS ici : il est inséré par la
    // migration 20260811140006_seed_categories, conformément à la spec
    // « seedée à la migration (valeurs figées) ». Un `migrate deploy` suffit
    // donc à l'obtenir, sans étape séparée.
    // Cette entrée reste disponible pour d'éventuels jeux de données de test :
    // seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
