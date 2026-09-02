# 07-developpement

Tout le code du projet. Les dossiers `01-` à `06-` restent de la documentation ;
à partir d'ici, ce sont des sources destinées à être exécutées.

## Structure

| Dossier | Contenu | Dépôt cible |
|---|---|---|
| `contract/` | Contrat d'API : schémas Zod partagés (`@capclair/contract`) | publié / vendu à la séparation |
| `back/` | API **Fastify** + worker BullMQ + schéma Prisma & migrations | dépôt back |
| `front/` | Interface **Next.js** (App Router) | dépôt front |

**Workspace npm.** `07-developpement/package.json` déclare les trois paquets en
workspace : un seul `npm install` à ce niveau, un seul `package-lock.json`.
`@capclair/contract` est ainsi résolu nativement par tsc, Vitest et Next
(cf. `decisions.md`, ADR-003 & ADR-007). À la séparation en deux dépôts, le
workspace disparaît et `contract/` est publié — les imports ne changent pas.

Décisions structurantes : `decisions.md` (ADR-001 à 008).

## Démarrage

```bash
cd 07-developpement
npm install                                  # installe les 3 paquets
npm run build --workspace @capclair/contract # à faire avant back/front

# --- base de données (Docker) ---
cd back
cp .env.example .env                         # renseigner les variables
npm run db:up                                # Postgres 17 sur le port hôte 5434
npm run prisma:deploy                        # applique les migrations + 6 catégories
createdb ... capclair_test  # OU : psql "$DATABASE_URL" -c 'CREATE DATABASE capclair_test;'

# --- lancer ---
npm run dev            # API sur http://localhost:3001  (GET /api/sante)
npm run worker         # worker BullMQ (aucune queue pour l'instant)
cd ../front
cp .env.local.example .env.local
npm run dev            # UI sur http://localhost:3000
```

## Commandes par paquet

```bash
npm run <script> --workspace capclair-back      # ex. typecheck, lint, test, test:int
npm run <script> --workspace front
npm run <script> --workspace @capclair/contract
```

| Script (back) | Effet |
|---|---|
| `dev` / `worker` | API / worker en watch (`tsx`) |
| `build` | `prisma generate` puis `tsc` (→ `dist/`) |
| `typecheck` / `lint` | `tsc --noEmit` / `eslint .` |
| `test` / `test:int` | Vitest unitaires / intégration (Postgres jetable) |
| `db:up` / `db:down` / `db:reset` | conteneur Postgres (le `reset` supprime le volume) |
| `prisma:migrate` / `prisma:deploy` | nouvelle migration / applique les migrations |
| `studio` | inspecteur web des données |

## back/ — Prisma 7 (points d'attention)

Le schéma (`back/prisma/schema.prisma`, **15 modèles, 10 enums**) et les migrations
étaient auparavant dans `db/`, désormais rapatriés dans `back/`.

1. **L'URL de connexion sort du schéma** : `datasource` ne contient que `provider` ;
   l'URL vit dans `back/prisma.config.ts`. Un `url = env(...)` dans `schema.prisma`
   fait échouer les commandes (`P1012`).
2. **Prisma ne lit plus `.env` seul** : `import "dotenv/config"` en tête de
   `prisma.config.ts` (déjà présent).
3. **`prisma` doit être une devDependency locale** : le fichier de config importe
   `prisma/config`.
4. **Le client est généré dans le dépôt** (`back/src/generated/prisma`, **git-ignoré**).

Base Postgres locale sur le **port hôte 5434** (5432 = Postgres natif, 5433 =
conteneur `sonarqube-db` — les trois cohabitent). Référentiel des 6 catégories (D14)
inséré par la migration `20260811140006_seed_categories` (donc `prisma:deploy` suffit).

Migrations ajoutées à l'amorçage E1 (ADR-006, ADR-004) — à générer avec la base
Docker démarrée :
- `align_schema_with_architecture` : `+ ExtractedInformation.isUserCorrected`,
  `ReminderType` `J_MOINS_1` → `J_MOINS_3` ;
- `consentlog_policy_version` : `+ ConsentLog.policyVersion`.

## État

- **`contract/`** : schémas Zod d'auth + de documents (messages FR, chemins
  d'endpoints, enveloppe d'erreur). Buildé (`dist/`).
- **`back/`** : Fastify + authentification complète (E1), `GET /api/sante`,
  **import et lecture de documents** (E2/PR-A+B : `POST /api/documents` validé
  par signature (magic bytes) + taille, stockage local hors racine web sous
  `STORAGE_DIR` avec nom UUID, **extraction PDF synchrone** via `unpdf`
  (`server/pdf/extract.ts`, ADR-013/016) avec barrière « illisible »
  < 100 caractères utiles et rejet 422 des PDF > 10 pages (ADR-014), aperçu
  authentifié `GET /api/documents/:id/file`, remplacement
  `POST /api/documents/:id/replace`, consentement fictif
  `POST /api/documents/:id/confirm-fictional` (US-2.3), retrait
  `DELETE /api/documents/:id`), couche d'accès scopée `userId`, rate-limit
  global + presets par route (`server/http/rate-limit.ts`, seuils par env —
  US-8.1 ; `/api/documents` porte `RATE_LIMITS.import`), config validée au boot,
  logs avec `redact` pino sur le contenu des documents (US-8.2).
  Tests unitaires verts ; suites d'intégration (nécessitent la base Docker) dont
  `documents.corpus.test.ts`, qui rejoue les 15 courriers fictifs de
  `05-courriers-fictifs/` (sautée si le corpus est absent).
  Variables d'env : `STORAGE_DIR`, `PDF_MAX_PAGES`, `PDF_EXTRACT_TIMEOUT_MS`
  (voir `.env.example` ; le plafond d'upload vient du contrat partagé) ;
  `back/storage/` est git-ignoré.
  **Consentement et appel à l'IA (E3/PR-A)** : `server/ai/` — seule frontière avec
  le SDK Anthropic (`@anthropic-ai/sdk`), modèle `claude-sonnet-5` par défaut
  (`ANTHROPIC_MODEL`), sortie contrainte par JSON Schema
  (`zod-to-json-schema` + `AnalysisResultSchema.safeParse`, plan E3 §2 #2) ;
  classification d'organisme par heuristique de mots-clés
  (`server/ai/prompts.ts`, 15/15 sur le corpus) ; règles déterministes de date
  (`lib/dates.ts`, D7 — dates/délais jamais calculés par l'IA). Contrat :
  `contract/src/analysis.ts` (schéma à 13 champs, US-3.2). Reste à brancher :
  consentement `AI_PROCESSING`, file BullMQ, worker, routes de dossier (PR-B),
  écran de consentement + attente (PR-C) — voir
  `plans/E3-consentement-et-appel-a-l-ia.md`. Nouvelle variable obligatoire :
  `ANTHROPIC_API_KEY` (aucun défaut, US-8.4).
- **`front/`** : Next.js 16 + Tailwind v4 (thème du design system, clair uniquement),
  écran 01 (connexion / inscription), pages mot-de-passe-oublié / réinitialiser,
  middleware + garde serveur de l'espace connecté, pages 404/500. `next build` OK.
