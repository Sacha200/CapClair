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
npm run db:up                                # Postgres 17 (5434) + Redis 7 (6379)
npm run prisma:deploy                        # applique les migrations + 6 catégories
createdb ... capclair_test  # OU : psql "$DATABASE_URL" -c 'CREATE DATABASE capclair_test;'

# --- lancer ---
npm run dev            # API sur http://localhost:3001  (GET /api/sante)
                       # doc OpenAPI (dev uniquement) : http://localhost:3001/docs
npm run worker         # worker BullMQ (file « analysis » — analyse IA, E3)
cd ../front
cp .env.local.example .env.local
npm run dev            # UI sur http://localhost:3000
```

## Déploiement (pile de production)

Cible actée : **VPS + Docker Compose + Caddy** (ADR-018). Déploiement **manuel**,
pas de CD ce sprint. Aucun port de base de données ni de Redis n'est publié :
seul `caddy` expose 80 et 443.

| Fichier | Rôle |
|---|---|
| `back/Dockerfile` | Image commune API + worker (seule la commande diffère) |
| `front/Dockerfile` | Next en sortie autonome (`output: "standalone"`) |
| `Caddyfile` | Reverse-proxy, TLS automatique, routage par chemin |
| `docker-compose.prod.yml` | Les six services et leurs volumes |
| `deploy.sh` | `git pull` + build + `up -d --wait` + sonde |
| `.env.prod.example` | Gabarit à copier en `.env.prod` sur le serveur |

Le contexte de build est **`07-developpement/`**, pas `back/` ni `front/` :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod build
```

### Routage

Caddy sert une origine publique unique, donc un cookie de session *host-only*
et aucune CORS (ADR-005) :

| Chemin public | Destination |
|---|---|
| `/api/sante` | `back:3001/api/sante` — sonde d'état |
| `/api/back/*` | `back:3001/*` — **le préfixe est retiré** (`handle_path`) |
| tout le reste | `front:3000` |

Le navigateur n'adresse l'API que sur `/api/back/*`
(`front/src/lib/config.ts`, `BROWSER_API_BASE`), en production comme en
développement. C'est le rewrite de `next.config.ts` qui fait ce travail en
local, et Caddy qui le fait en production. **Ne pas router `/api/*` tel quel
vers le back** : `/api/back/api/dossiers` y arriverait sans préfixe retiré, soit
un 404 sur chaque appel.

Les appels serveur → back (composants serveur Next) passent, eux, par
`BACK_ORIGIN=http://back:3001` sur le réseau interne, sans traverser Caddy.

### Migrations

Le service `back` lance `prisma migrate deploy` avant de servir. Une seule
instance, donc pas de course. Le `worker` attend que `back` soit *healthy*, pour
ne toucher la base qu'une fois le schéma à jour.

### Première mise en service sur un serveur

Procédure détaillée, pas à pas, pour une VM cloud gratuite (Oracle Cloud
Always Free, ARM64) : **[`deploiement-vm-gratuite.md`](deploiement-vm-gratuite.md)**.
Les sections 4 à 7 de ce document valent pour n'importe quel hébergeur.

En résumé :

1. VPS (2 vCPU / 4 Go suffisent au volume MVP), Docker et le plugin Compose.
2. Enregistrement DNS **A** du domaine vers l'IP du serveur, **avant** le
   premier démarrage : sans lui, Caddy ne peut pas obtenir son certificat.
3. Cloner le dépôt, puis `cp .env.prod.example .env.prod` et le renseigner.
   `COOKIE_SECURE`, `TRUST_PROXY` et `RATE_LIMIT_REDIS` sont déjà forcés par le
   Compose : ne pas les contredire.
4. `./deploy.sh`
5. Vérifier `https://<domaine>/api/sante`, puis dérouler le parcours complet à
   la main : inscription, import d'un courrier fictif, consentement, analyse,
   dossier.

### Validation locale de la pile

Avant de toucher au serveur, la même pile tourne en local avec
`PUBLIC_DOMAIN=localhost` dans un `.env.prod` de test. Caddy émet alors un
certificat par son autorité interne, d'où le `-k` :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --wait
docker compose -f docker-compose.prod.yml ps
curl -fsSk https://localhost/api/sante
```

Attendu : six services sains et `{"status":"ok","db":"ok","redis":"ok",...}`.
`http://localhost` répond 308 vers HTTPS.

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
  `contract/src/analysis.ts` (schéma à 13 champs, US-3.2).
  **PR-B** : consentement `AI_PROCESSING` (`POST /api/dossiers/:id/consentement-ia`,
  miroir de `confirm-fictional`), déclenchement asynchrone
  (`POST /api/dossiers/:id/analyser` → 202/`EN_ATTENTE`, 403 sans consentement,
  409 si déjà en cours) et polling (`GET /api/dossiers/:id`) —
  `features/cases/*`, `RATE_LIMITS.analysis` ; file BullMQ `analysis`
  (`server/queues/analysis.ts`, payload = id du dossier seul, US-8.2) ; worker
  (`worker/analysis.ts` — `runAnalysisJob` : `EN_COURS` → IA (relance ×1 si
  schéma invalide) → `lib/dates` → transaction `applyAnalysis` idempotente
  préservant les lignes corrigées → `TERMINEE` ; toute erreur → `ECHEC` +
  `AuditEvent` sans contenu de courrier). **PR-C** (front) : `lib/api/cases.ts`,
  étape de consentement IA sur l'écran 03 (case distincte nommant Anthropic —
  US-3.1 AC1/AC2), écran 04 `/dossiers/[id]` « attente d'analyse » (polling 2 s
  sur `GET /api/dossiers/:id`, « Relancer » sur `ECHEC`). Nouvelle variable
  obligatoire : `ANTHROPIC_API_KEY` (aucun défaut, US-8.4).
- **`front/`** : Next.js 16 + Tailwind v4 (thème du design system, clair uniquement),
  écran 01 (connexion / inscription), pages mot-de-passe-oublié / réinitialiser,
  écran 02 (tableau de bord, coquille), écran 03 (`/importer` — dépôt, aperçu,
  consentement fictif + IA), écran 04 (`/dossiers/[id]` — attente d'analyse),
  middleware + garde serveur de l'espace connecté, pages 404/500. `next build` OK.
