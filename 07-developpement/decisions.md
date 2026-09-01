# Journal de décisions (ADR) — CapClair

Registre des arbitrages techniques pris pendant le développement. Complète le
registre produit de `01-cadrage/03-incoherences-et-arbitrages.md` (section F).
Une entrée par décision : contexte, décision, conséquences.

---

## ADR-001 — Deux applications séparées `front/` et `back/`

**Date** : démarrage du développement (sprint 1).
**Statut** : acté.

**Contexte.** `03-architecture/01-architecture-technique.md` décrivait un monolithe
modulaire Next.js (routes API + Server Actions + worker, un seul dépôt). Le dossier
`07-developpement/` a été amorcé avec `front/`, `back/`, `db/` distincts.

**Décision.** Deux applications, destinées à terme à deux dépôts :
- `front/` — Next.js App Router (UI uniquement) ;
- `back/` — API **Fastify** + process worker **BullMQ**, même base de code ;
- reliées par un **contrat d'API HTTP** ; **pas de Server Actions**.
`db/` (schéma Prisma + migrations) est **rattaché au `back/`**.

**Conséquences.**
- La section « Organisation du code » de la doc d'archi (§5) est remplacée par
  l'arborescence par domaines de `back/` et l'arborescence Next de `front/`.
- Un contrat d'API explicite est à maintenir (voir ADR-003).
- Le partage de session repose sur le cookie et une origine publique unique (ADR-005).

---

## ADR-002 — Authentification : sessions opaques maison côté `back/`

**Date** : sprint 1 (epic E1).
**Statut** : acté.

**Contexte.** Le schéma Prisma est « compatible Auth.js » (`User`/`Account`/`Session`/
`VerificationToken`). Mais NextAuth est une bibliothèque Next.js et le `back/` est un
service Fastify séparé.

**Décision.** Le `back/` implémente sa propre authentification :
- endpoints `POST /auth/register|login|logout`, `GET /auth/session`,
  `POST /auth/password/forgot|reset` ;
- **session opaque** : jeton aléatoire 256 bits ; on stocke `sha256(jeton)` dans la
  table `Session` existante ; cookie `httpOnly` + `secure` + `sameSite=lax` ;
- mots de passe hachés en **argon2id** (`node-argon2`) ;
- la table `VerificationToken` est réutilisée pour les jetons de réinitialisation
  (identifier = e-mail, token = `sha256(jetonBrut)`, usage unique, expiration 60 min) ;
- **NextAuth n'est pas utilisé** ; la table `Account` reste vide (réservée à un
  éventuel OAuth futur).

**Conséquences.**
- La révocation immédiate est possible (suppression de la ligne `Session`) — requis
  par US-1.2 (« la déconnexion invalide la session côté serveur »).
- Pas de JWT, pas de refresh token.
- Anti-énumération de comptes : corps, statut HTTP et **délai** identiques que
  l'e-mail existe ou non (`withMinimumDuration`), pour l'inscription et le
  « mot de passe oublié ».

---

## ADR-003 — Contrat d'API : paquet Zod interne `@capclair/contract`

**Date** : sprint 1.
**Statut** : acté.

**Contexte.** `front/` et `back/` doivent partager la forme des requêtes/réponses.
Options : OpenAPI + codegen de types ; types écrits à la main ; schémas partagés.

**Décision.** Un paquet interne `07-developpement/contract/` (`@capclair/contract`)
contenant des schémas **Zod** (+ types inférés) et les chemins d'endpoints.
Dépendance `file:../contract` dans `back/` et `front/`. Ordre de build imposé :
`contract` avant `back`/`front`.

**Justification.** Un seul schéma Zod sert **à la fois** de validateur côté Fastify
(`fastify-type-provider-zod`) et de resolver de formulaire côté front
(`@hookform/resolvers`), plus le parsing des réponses. Zéro dérive entre types
statiques et validation runtime. À la séparation des dépôts, le paquet sera publié
(registre privé ou dépendance git) sans changer les imports.

**Conséquences.** Un `tsc` supplémentaire dans le pipeline ; discipline « build
contract d'abord » (CI + README). Voir **ADR-007** : un workspace npm a finalement
été adopté à l'amorçage pour fiabiliser la résolution du paquet.

---

## ADR-004 — `ConsentLog` : `createdAt` fait foi, une ligne `CGU` par inscription

**Date** : sprint 1 (US-1.1).
**Statut** : acté (à revoir avec US-8.3 si contrainte juridique).

**Contexte.** US-1.1 exige d'enregistrer l'acceptation des CGU dans `ConsentLog` avec
`policyVersion` et `acceptedAt`. Le schéma actuel n'a ni `policyVersion` ni
`acceptedAt` ; l'enum `ConsentType` vaut `{ ANALYSE_IA, CGU }` (pas de valeur
distincte pour la politique de confidentialité).

**Décision.**
- Migration additive : `ConsentLog.policyVersion String @default("v1")`. L'application
  passe **toujours** `LEGAL_BUNDLE_VERSION` explicitement (`back/src/lib/legal.ts`).
- Pas de nouveau champ `acceptedAt` : `ConsentLog.createdAt` (`@default(now())`,
  immuable, pas d'`updatedAt`) **est** l'horodatage d'acceptation. Le mapper API
  l'expose sous le nom `acceptedAt`.
- Les deux cases du formulaire (CGU + politique de confidentialité) sont validées
  **séparément** dans l'UI mais donnent **une seule** ligne `ConsentLog`
  (`consentType = CGU`, `granted = true`, `policyVersion = LEGAL_BUNDLE_VERSION`).

**Alternative si le juridique exige une preuve indépendante par document** : ajouter
la valeur d'enum `CONFIDENTIALITE` et écrire deux lignes. À trancher avec US-8.3.

**Conséquences.** `LEGAL_BUNDLE_VERSION` versionne le couple (CGU, politique) ; tout
changement de l'un ou l'autre incrémente la version du bundle.

---

## ADR-005 — Partage du cookie de session : origine publique unique

**Date** : sprint 1 (E1).
**Statut** : acté (dépend de l'infra prod — à confirmer).

**Contexte.** `front/` et `back/` sont deux services ; le cookie de session doit être
lisible par les deux sans complexité CORS.

**Décision.**
- **Prod** : une seule origine publique (ex. `app.capclair.fr`). Le reverse-proxy
  **Caddy** route `/api/*` et `/auth/*` vers le conteneur `back`, le reste vers
  `front`. Cookie **host-only** (`Domain` absent), `Secure`, `SameSite=Lax`.
  Aucune CORS. Les composants serveur et le middleware Next transfèrent l'en-tête
  `Cookie` lors des appels serveur→back.
- **Dev** : `next.config.ts` `rewrites()` mappe `/api/back/:path*` →
  `http://localhost:3001/:path*`. Le navigateur ne parle qu'à `localhost:3000` →
  cookie *first-party*, pas de CORS. `COOKIE_SECURE=false`, `COOKIE_DOMAIN` vide.

**Repli** si le back doit vivre sur un domaine distinct : `Domain=.capclair.fr` +
`@fastify/cors` `credentials:true` + `fetch(credentials:'include')`.

**Conséquences.** L'infra prod doit pouvoir faire du routage par chemin sur une
origine unique. À valider avec la mise en place du déploiement (US-10.3).

---

## ADR-006 — Alignement du schéma Prisma sur la doc d'architecture

**Date** : sprint 1 (T-1, base vide).
**Statut** : acté.

**Contexte.** Écarts entre `03-architecture` / user stories et `schema.prisma` :
`ExtractedInformation.isUserCorrected` décrit mais absent ; `ReminderType` code
`J_MOINS_1` alors que la doc et US-7.1 parlent de « J-7 / J-3 / J-0 ».

**Décision.** Migration `align_schema_with_architecture` (base encore vide, donc sans
risque de données) :
- `+ ExtractedInformation.isUserCorrected Boolean @default(false)` ;
- `ALTER TYPE "ReminderType" RENAME VALUE 'J_MOINS_1' TO 'J_MOINS_3'`.
`ConsentType` (`AI_PROCESSING` / `FICTIONAL_DOCUMENT`) n'est **pas** touché ici : il
sera revu avec US-2.3 et US-3.1.

**Conséquences.** Le schéma correspond désormais à la préservation des corrections
manuelles (US-4.4) et au calendrier de rappels J-7/J-3/J-0 (US-7.1).

---

## ADR-007 — Workspace npm à la racine de `07-developpement/`

**Date** : sprint 1 (amorçage).
**Statut** : acté (révise le B8 du plan « pas de workspace racine »).

**Contexte.** Avec `@capclair/contract` déclaré en `file:../contract`, Node le
résout nativement (le back build sans souci) mais **Turbopack** (bundler par
défaut de Next 16) échoue à résoudre le paquet à travers le lien symbolique
(`Module not found: Can't resolve '@capclair/contract'`).

**Décision.** Un `07-developpement/package.json` privé déclare
`"workspaces": ["contract", "back", "front"]`. Un seul `npm install` à ce niveau,
`node_modules` hoisté, `@capclair/contract` devient un paquet de workspace résolu
nativement par tous les outils (tsc, Vitest, Next/Turbopack).

**Conséquences.**
- Un seul `package-lock.json` (`07-developpement/package-lock.json`).
- Les commandes se lancent par workspace : `npm run <script> --workspace capclair-back`
  (ou `--workspace front`, `--workspace @capclair/contract`).
- À la séparation en deux dépôts : `contract/` est publié (registre privé ou
  dépendance git), le workspace disparaît, les imports ne changent pas.
- Le `.gitignore` racine (`node_modules/`) couvre `07-developpement/node_modules/`.

## ADR-008 — Framework back : Fastify ; front : Next.js 16 sans shadcn/ui

**Date** : sprint 1.
**Statut** : acté.

**Contexte.** Le plan citait shadcn/ui côté front. `create-next-app` a produit
Next **16** + React **19** + Tailwind **v4** (config CSS-first via `@theme`).

**Décision.**
- Back : **Fastify 5** (API) + un process worker BullMQ distinct.
- Front : Next.js 16 App Router + Tailwind v4. Les quelques primitives d'UI
  nécessaires à E1 (Button, TextField, CheckboxField, Alert) sont **écrites à la
  main** (~15 lignes chacune, accessibles) plutôt que via `shadcn init`, dont la
  compatibilité avec Tailwind v4 + React 19 + Next 16 était incertaine au moment
  de l'amorçage. shadcn/ui pourra être introduit plus tard si le besoin grandit.
- Polices : **Spectral** (lecture) via `next/font/google` ; **Marianne** substituée
  par **Mulish** en attendant les fichiers officiels et la validation de licence
  (la variable CSS reste `--font-marianne`).

---

## ADR-009 — Limitation de débit : plafond global + presets par route

**Date** : sprint 1 (US-8.1).
**Statut** : acté.

**Contexte.** US-8.1 impose une limitation de débit sur `connexion`, `inscription`,
`réinitialisation`, `import` et `analyse`, un `429` avec message français indiquant
le délai, et des seuils **configurables par variable d'environnement**. À l'amorçage
E1, `@fastify/rate-limit` était enregistré avec `global: false` : seules les routes
`/auth/*` portant un `config.rateLimit` étaient couvertes ; les routes d'import (E2)
et d'analyse (E3) n'existent pas encore.

**Décision.**
- **Plafond global** (`global: true`, `RATE_LIMIT_GLOBAL_MAX` / `_WINDOW`,
  défaut 1000 / minute / IP) : garde-fou anti-abus sur **toutes** les routes,
  présentes et futures. Clé = `request.ip` (dépend de `TRUST_PROXY`).
- **Presets par domaine** dans `back/src/server/http/rate-limit.ts`
  (`RATE_LIMITS.{login,register,forgot,reset,import,analysis}`) : chacun resserre
  le plafond global ; **tous** les seuils (max *et* fenêtre) viennent de l'env.
- `import` et `analysis` sont **pré-provisionnés** : les variables et le preset
  existent ; à la création des routes en E2/E3, il suffit d'ajouter
  `config: RATE_LIMITS.import` (resp. `.analysis`). US-8.1 reste ouverte jusque-là.
- **Réponse `429`** : `errorResponseBuilder` renvoie l'enveloppe standard
  `{ error, code: "rate_limited" }` — `error` = « Trop de tentatives. Réessayez
  dans <délai>. » ; en-tête `Retry-After` posé par le plugin.

**Conséquences.**
- Store **mémoire** par défaut (mono-instance) ; `RATE_LIMIT_REDIS=true` +
  `REDIS_URL` pour un déploiement multi-instances (à câbler avec US-10.3).
- Les tests d'intégration partagent une instance d'app : le store n'est pas remis
  à zéro entre tests. Le plafond global (1000) reste hors de portée du volume de
  la suite ; les tests de limite ciblent une IP dédiée.

---

## ADR-010 — `.env.example` : fichiers d'exemple suivis par Git (front + back)

**Date** : sprint 1 (US-8.4).
**Statut** : acté.

**Contexte.** US-8.4 AC2 exige « un fichier `.env.example` qui liste toutes les
variables requises, sans valeur réelle ». Le `.gitignore` du `front/` généré par
`create-next-app` contient `.env*`, qui **exclut aussi** `.env.local.example` :
le fichier existait sur disque mais n'était pas versionné.

**Décision.** Aligner le `front/` sur le `back/` : `.gitignore` ignore `.env` et
`.env.*` mais **ré-inclut** `!.env.local.example`. Les secrets locaux
(`.env`, `.env.local`) restent exclus ; seul l'exemple, sans valeur réelle, est
suivi. Les deux exemples sont allowlistés dans `.gitleaks.toml` (AC1).

**Conséquences.** `back/.env.example` et `front/.env.local.example` sont la source
de vérité des variables attendues ; le scan `gitleaks` en CI (job `secret-scan`,
bloquant) garantit AC1, la validation au boot (`back/src/env.ts`) garantit AC3.

---

## ADR-011 — Import : création du `CaseFile` dès le dépôt ; `Organisme.INDETERMINE`

**Date** : E2, PR-A (US-2.1).
**Statut** : acté.

**Contexte.** `Document.caseFileId` est NOT NULL et `CaseFile.organisme` / `.title`
sont NOT NULL sans défaut, mais la détection de l'organisme est du ressort de E3
(US-3.3). L'isolation des entités liées passe par `caseFile.userId` : un document
doit donc être rattaché à un dossier appartenant à l'utilisateur dès sa création.

**Décision.**
- L'upload crée le `CaseFile` **et** le `Document` dans une **transaction unique**
  (`DocumentRepository.createWithCase`) : un import réussi produit les deux lignes,
  ou aucune.
- Nouvelle valeur d'enum `Organisme.INDETERMINE` ; `title` = nom de fichier
  nettoyé (`safeName`). E3 écrasera `organisme` / `title` à l'analyse.
- **Un document ↔ un dossier** au MVP (`caseFileId` reste NOT NULL). Le retrait
  avant analyse (`DELETE /api/documents/:id`) supprime le document, purge le
  fichier disque (best-effort) et supprime le dossier s'il n'est pas encore
  analysé (`analysisStatus = EN_ATTENTE`).

**Conséquences.** Le re-import sans recréer le dossier (US-2.6 AC4) se fera via
`POST /api/documents/:id/replace` (PR-B). La suppression de dossier d'E5 (US-5.5)
réutilisera la purge disque des `Document` liés.

---

## ADR-012 — Stockage des fichiers : volume local, module `server/storage`

**Date** : E2, PR-A (US-2.1 AC4/AC5).
**Statut** : acté (MVP ; abstraction pour évoluer).

**Contexte.** La doc d'archi (§11) laissait ouvert « volume local vs S3/MinIO »,
avec une abstraction `storage/` prévue.

**Décision.**
- MVP : **volume local monté**, racine `STORAGE_DIR` (relative à `back/` ou
  absolue), **hors de toute racine servie** — le back ne sert aucun fichier
  statique ; en prod le reverse-proxy ne route que `/api/*` et `/auth/*` (ADR-005).
  US-2.1 AC5 satisfait par construction.
- Nom sur disque = **UUID généré serveur** + extension canonique (déduite des
  magic bytes, jamais du mime déclaré client). `Document.storagePath` = le
  basename seul ; `server/storage` ne résout jamais que `basename(storagePath)`
  sous `STORAGE_DIR` (**anti path-traversal**).
- Le nom d'origine ne vit qu'en base (`Document.originalName`, US-2.1 AC4),
  nettoyé par `safeName` (retrait chemin / caractères de contrôle / guillemets).
- API `saveDocument` / `openDocumentStream` / `deleteDocument` — remplaçable par
  un backend S3/MinIO sans changer les appelants. **Pas d'antivirus au MVP.**

**Conséquences.** Dimensionnement mémoire du conteneur `web` à prévoir
(`@fastify/multipart` bufferise le fichier — jusqu'à `MAX_UPLOAD_BYTES` par
requête). Les tests isolent `STORAGE_DIR` dans un dossier temporaire purgé en
fin de suite (`test/setup.ts`).

---

## ADR-015 — `ConsentType` : `FICTIONAL_DOCUMENT` ajouté en E2 ; renommage reporté

**Date** : E2, PR-A (US-2.3).
**Statut** : acté. Complète **ADR-006**.

**Contexte.** ADR-006 avait reporté la réconciliation de `ConsentType`
(`ANALYSE_IA` / `CGU` en base vs `AI_PROCESSING` / `FICTIONAL_DOCUMENT` dans la
doc et les user stories) « à US-2.3 et US-3.1 ».

**Décision.** La migration E2 ajoute **uniquement** la valeur
`ConsentType.FICTIONAL_DOCUMENT` (US-2.3 AC2). Le renommage
`ANALYSE_IA -> AI_PROCESSING` reste **reporté à E3/US-3.1** (il touche du code de
consentement IA qui n'existe pas encore). `ALTER TYPE ... ADD VALUE` est sûr en
transaction ici : aucune ligne n'utilise la nouvelle valeur dans la migration
(PG >= 12).

**Conséquences.** L'endpoint `POST /api/documents/:id/confirm-fictional` qui
écrit la ligne `ConsentLog { consentType: FICTIONAL_DOCUMENT }` est livré en
PR-B.
