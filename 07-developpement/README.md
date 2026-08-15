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
  docker-compose.yml     PostgreSQL 17 de développement
  package.json           prisma + dotenv, et les scripts npm
  .env.example           à copier en .env (ignoré par Git)
  prisma.config.ts       URL de connexion + chemins (schéma, migrations, seed)
  prisma/
    schema.prisma        15 modèles, 10 enums
    migrations/
      20260809225640_init              tables, enums, index, clés étrangères
      20260811140006_seed_categories   référentiel D14
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

### Démarrage

Depuis `07-developpement/db/` :

```bash
npm install
cp .env.example .env
npm run db:up            # docker compose up -d --wait
npx prisma migrate deploy
```

La base tourne sur le **port hôte 5434**. Ce n'est pas un caprice : 5432 est
occupé par le PostgreSQL 17 installé nativement sur la machine de dev, et 5433
par le conteneur `sonarqube-db`. Rien n'est arrêté ni remplacé, les trois
instances cohabitent.

| Script | Effet |
|---|---|
| `npm run db:up` | démarre le conteneur et attend qu'il soit *healthy* |
| `npm run db:down` | arrête le conteneur, les données survivent |
| `npm run db:reset` | **supprime le volume** et repart d'une base vide |
| `npm run migrate` | `prisma migrate dev` — nouvelle migration après modification du schéma |
| `npm run studio` | inspecteur web des données |

### État de la base

Les deux migrations sont appliquées. Vérifié en base : **16 tables**
(15 modèles + `_prisma_migrations`), **10 enums**, **16 clés étrangères**, et les
**6 catégories** du référentiel D14.

### Le référentiel des catégories (D14)

Il est inséré par une **migration de données**, pas par `prisma db seed` :
`02-schema-base-de-donnees.md` spécifie « seedée à la migration (valeurs
figées) ». Concrètement, un `migrate deploy` suffit à garantir le référentiel en
production, sans étape séparée — ce qui compte, `ExtractedInformation.categoryId`
étant non nullable et en `onDelete: Restrict` : aucune analyse ne peut rien
enregistrer tant que les catégories n'existent pas.

| `code` | `label` | `icon` | `color` | ordre |
|---|---|---|---|---|
| REFERENCE | Référence | `ri-hashtag` | `#1F5F8B` | 1 |
| MONTANT | Montant | `ri-money-euro-circle-line` | `#1F5F8B` | 2 |
| DATE | Date | `ri-calendar-line` | `#1F5F8B` | 3 |
| IDENTITE | Identité | `ri-user-line` | `#1F5F8B` | 4 |
| CONTACT | Contact | `ri-phone-line` | `#1F5F8B` | 5 |
| AUTRE | Autre | `ri-information-line` | `#5A6472` | 6 |

Valeurs reprises telles quelles de `03-architecture/02-schema-base-de-donnees.md`
et de `04-maquettes/design-system.md` — icônes **Remix Icon** (`@remixicon/react`,
la bibliothèque du DSFR), variantes `-line`.

La migration est écrite en `ON CONFLICT ("code") DO UPDATE`, donc rejouable :
mettre à jour un libellé ou une icône ne change pas les `id` et ne casse donc
aucune `ExtractedInformation` existante. Vérifié par un rejeu — empreinte des
`id` identique, toujours 6 lignes.

Modifier une valeur d'affichage se fait par **une nouvelle migration**, ce qui
est le prix de « valeurs figées » : la contrepartie est qu'aucun environnement
ne peut diverger.

Le tri respecte les accents — `avion < ecole < élève < zebre`. Il fallait pour
cela le fournisseur ICU en locale `fr-FR` : l'image Debian ne génère que
`en_US.UTF-8`, sous laquelle « élève » se serait retrouvé trié après « zebre ».

Pour obtenir le SQL d'une migration **sans** base de données :

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```
