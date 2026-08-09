# 07-developpement

Tout le code du projet. Les dossiers `01-` à `06-` restent de la documentation ;
à partir d'ici, ce sont des sources destinées à être exécutées.

| Dossier | Contenu | Dépôt cible |
|---|---|---|
| `front/` | Interface Next.js | dépôt front |
| `back/` | API, worker BullMQ, services serveur | dépôt back |
| `db/` | Schéma Prisma, configuration, migrations, seed | rattaché au back |

> **À trancher.** `03-architecture/01-architecture-technique.md` décrit un
> **monolithe modulaire** (Next.js avec ses routes API + un worker, un seul dépôt).
> La séparation front / back en deux dépôts s'en écarte : elle ajoute un contrat
> d'API à maintenir et retire les Server Actions du jeu. Si le choix est confirmé,
> la section « Organisation du code » de ce document est à reprendre.

---

## db/ — Prisma 7

```text
db/
  prisma.config.ts       URL de connexion + chemins (schéma, migrations, seed)
  prisma/
    schema.prisma        15 modèles, 10 enums
    migrations/          (à générer)
```

### Trois changements de Prisma 7 à connaître

Ils ont tous été vérifiés en exécutant la CLI 7.9.1 sur ce schéma.

**1. L'URL de connexion sort du schéma.** Le bloc `datasource` ne contient plus
que `provider`. Un `url = env("DATABASE_URL")` dans `schema.prisma` fait échouer
toute commande avec `P1012`. L'URL vit dans `prisma.config.ts`.

**2. Prisma ne lit plus `.env` tout seul.** Sans `import "dotenv/config"` en tête
de `prisma.config.ts`, un fichier `.env` correct est purement ignoré :
`PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`.

**3. `npx prisma` seul ne suffit plus.** Le fichier de config importe
`prisma/config`, qui doit être résolvable depuis un `node_modules` local. Sans
installation locale : `Cannot find module 'prisma/config'`.

Le client est aussi généré dans le dépôt (`src/generated/prisma`) et non plus
dans `node_modules` — l'`output` du générateur est obligatoire en v7, et ce
dossier est à ajouter au `.gitignore` du dépôt back.

### Commandes

Depuis `07-developpement/db/`, avec `prisma` et `dotenv` installés en
devDependencies et un `.env` contenant `DATABASE_URL` :

```bash
npx prisma validate      # état actuel : valide
npx prisma format
npx prisma generate
npx prisma migrate dev --name init
```

`migrate dev` demande une base PostgreSQL réellement joignable (Supabase, ou
Docker en local) — c'est la seule des quatre commandes qui ne peut pas tourner
à vide. Elle écrira `prisma/migrations/`.

Pour obtenir le SQL de la migration initiale **sans** base de données :

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```
