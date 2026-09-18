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

## ADR-013 — Extraction PDF synchrone dans la requête ; barrière « illisible »

**Date** : E2, PR-B (US-2.4, US-2.6).
**Statut** : acté.

**Contexte.** Le pipeline (doc archi §6) prévoit les étapes 2→5 (import,
validation, extraction, barrière) **synchrones** dans la requête web ;
l'enfilement BullMQ de la tâche « analyse » (étape 6) est la frontière E2/E3.

**Décision.**
- `extractPdfText` s'exécute dans le handler d'upload (et de `replace`),
  **en mémoire**, avant toute écriture disque ou base. Budget
  `PDF_EXTRACT_TIMEOUT_MS` (5 s) via `Promise.race` ; tout échec (corrompu,
  chiffré, timeout) vaut `{ text: "", pageCount: 0 }` — jamais de 500.
- **Barrière dure** (US-2.6 AC1/AC3) : sous `UNREADABLE_TEXT_THRESHOLD`
  (100 caractères utiles, contrat partagé), l'import réussit (`readable: false`)
  mais rien n'est amorcé : pas de dossier d'analyse, pas d'appel externe.
  Garantie structurelle : aucun import `bullmq` dans `features/documents/**`.
- Le texte extrait est stocké (`Document.extractedText`) avec son SHA-256
  (`extractedTextHash`), futur cache d'analyse IA (E3, doc archi §7).

**Conséquences.** E3 lit `extractedText` en base et n'extrait jamais lui-même ;
la reprise après illisible passe par `replace` (ADR-011), qui ré-extrait.

---

## ADR-014 — PDF de plus de 10 pages : rejet 422 avec message explicite

**Date** : E2, PR-B (US-2.4 AC3).
**Statut** : acté (à confirmer PO — la limite haute était l'alternative).

**Contexte.** US-2.4 AC3 laisse le choix : traiter jusqu'à un plafond, ou
rejeter avec un message explicite, le comportement retenu devant être documenté.

**Décision.** **Rejet `422`** (`code: "too_many_pages"`, message du contrat
« Ce PDF compte plus de 10 pages. ... ») dès que `pageCount > PDF_MAX_PAGES`
(défaut 10). Justification : SLA d'extraction < 5 s et budget de jetons IA en E3
— un courrier administratif de plus de 10 pages sort du cas d'usage MVP. Le
rejet intervient **avant toute écriture** : ni fichier, ni dossier, ni document.

**Conséquences.** Le seuil est une variable d'env (`PDF_MAX_PAGES`) mais le
message du contrat dit « 10 pages » : ne changer l'un qu'avec l'autre.

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

---

## ADR-016 — Librairie d'extraction PDF : `unpdf`

**Date** : E2, PR-B (US-2.4).
**Statut** : acté.

**Contexte.** `pdf-parse@1.1.1` (le candidat évident) n'est plus maintenu et lit
un fichier local à l'import quand `!module.parent` — précisément le contexte
ESM/`tsx`/Vitest de ce dépôt (plan E2 §12.3).

**Décision.** **`unpdf`** : ESM natif, maintenu, wrapper « serverless » de
PDF.js, sans effet de bord fichier. Chemin « texte seul »
(`getDocumentProxy` + `extractText`), aucun rendu — pas de polyfill DOM requis.
La librairie est **encapsulée dans `server/pdf/extract.ts`**, seul point de
dépendance : un repli (`pdf-parse/lib/pdf-parse.js` ou `pdfjs-dist` direct) ne
toucherait que ce module.

**Conséquences.** Vérifié sur le corpus des 15 courriers fictifs
(`documents.corpus.test.ts`) : texte intégral extrait, largement sous le budget
de 5 s par courrier. L'avertissement `standardFontDataUrl` de PDF.js est
inoffensif sur ce chemin (métriques de polices standard, texte déjà extrait).

---

## ADR-017 — Harnais d'évaluation du corpus IA

**Date** : sprint de consolidation technique (audit du 16 septembre 2026, tâche T1).
**Statut** : acté.

**Contexte.** Le différenciateur produit de CapClair est la fiabilité de
l'analyse, et elle n'était mesurée nulle part. `documents.corpus.test.ts` ne
vérifiait que l'extraction PDF ; `05-courriers-fictifs/dataset-reference.json`
(15 entrées, vérité terrain rédigée à la main) n'était exploité par aucun test.
Le seul composant faillible du système n'avait donc aucun chiffre.

**Décision.**

1. **Emplacement.** `back/test/eval/`, projet Vitest **`eval`** distinct,
   extension `*.eval.ts`. Ni `npm test`, ni `npm run test:int`, ni
   `npm run test:all`, ni la CI ne le ramassent : seul `npm run eval:corpus` le
   déclenche. `test:all` valait `vitest run` sans sélection de projet et aurait
   donc lancé des appels facturés ; il cible désormais `unit` et `integration`
   explicitement.
2. **Périmètre mesuré.** `analyzeLetter()` en direct sur le texte extrait par
   `server/pdf` — pas le parcours HTTP complet. Un écart mesuré ici désigne le
   prompt ou le modèle, jamais le câblage.
3. **Définition d'« invention ».** Deux métriques distinctes, jamais fusionnées :
   **non ancré** (`sourceExcerpt` absent du texte source — défaut objectif, ne
   dépend d'aucun appariement) et **hors référentiel** (ancré mais sans
   correspondance au dataset — informatif, le dataset pouvant être incomplet).
4. **Seuils.** Première exécution = référence, aucun seuil de régression. Les
   seuils seront fixés à partir des chiffres réels.
5. **Critère d'appariement — amendé en cours d'exécution.** Le plan posait
   « l'extrait, jamais le titre ». Vérifié sur CAF-01 : le dataset ancre la
   consigne sur la phrase qui liste les documents, le modèle sur celle qui donne
   le délai et le canal. Les deux extraits sont ancrés, aucun n'a tort, et
   l'appariement par extrait échoue — rappel actions 0 % alors que l'action est
   correctement trouvée. Le critère par extrait est objectif pour un
   **justificatif** (un document nommé n'apparaît qu'une fois) mais pas pour une
   **action**. Les actions passent donc par un appariement en deux passes
   (extrait, puis recouvrement de mots significatifs entre titres) et **deux
   rappels sont publiés** : `actionRecall` strict et `actionRecallLenient`
   souple. Aucune entrée du dataset n'a été modifiée — la vérité terrain reste
   indépendante de ce que le modèle produit.

**Chiffre de référence — `claude-sonnet-5`, 15 courriers, 18 septembre 2026.**

| Métrique | Valeur |
|---|---|
| Réponses conformes à `AnalysisResultSchema` | **100 %** (15/15) |
| Organisme correct | **100 %** (15/15) |
| Date du courrier correcte | **100 %** (15/15) |
| Rappel actions | **92,9 %** (13/14, strict comme souple) |
| Rappel justificatifs | **100 %** (13/13) |
| Extraits non ancrés (actions, justificatifs, informations) | **0 %** |
| Latence médiane d'un appel | **17,2 s** (11,9 s à 22,0 s) |

**Conséquences.** Aucun extrait inventé sur les 15 courriers : la contrainte
anti-hallucination du produit (US-3.2 AC5, US-4.2 AC2) tient sur le corpus.
La table d'interprétation du plan (rappel ≥ 90 %, non ancré ≤ 2 %, schéma
100 %) classe ce résultat en « le pipeline tient, continuer le plan tel quel » :
ni le chantier prompt ni le repli Opus 5 (plan E3 §9.5) ne sont ouverts.

Le seul écart de rappel est CAF-01, où le modèle a bien produit l'action mais
l'a intitulée par son canal (« Envoyer les documents manquants via caf.fr ou par
courrier postal ») là où le dataset l'intitule par ses pièces (« Envoyer le
justificatif de domicile et l'avis d'imposition »). Les deux titres ne partagent
qu'un mot significatif, le repli ne déclenche pas. Le rappel réel est donc
vraisemblablement de 100 % ; **92,9 % est un plancher**, et c'est le chiffre
publié.

Le rapport daté est commité en `07-developpement/plans/eval-reports/` (JSON
complet + résumé Markdown), avec les extraits et titres comparés courrier par
courrier pour qu'un rappel bas soit diagnosticable sans re-payer une exécution.
Le corpus étant fictif, ces extraits peuvent être commités ; avec de vrais
courriers, US-8.2 l'interdirait et le rapport devrait rester local.

Coût constaté : 15 appels Sonnet à `max_tokens: 4096`, environ 4 minutes
d'exécution.

---

## ADR-018 — Déploiement : VPS + Docker Compose + Caddy, mise en service manuelle

**Date** : sprint de consolidation technique (audit du 16 septembre 2026, tâche T2).
**Statut** : acté ; pile validée en local, mise en service serveur à faire.

**Contexte.** Rien n'était déployé : aucun Dockerfile applicatif, pas de
reverse-proxy, pas de CD. L'URL HTTPS était due le 2 août. C'est l'écart le plus
visible entre le plan et le réel, parce qu'il se vérifie en un clic.

**Décision.**

1. **Cible : VPS + Docker Compose + Caddy.** Caddy gère le TLS automatiquement et
   sait router par chemin sur une origine unique, ce qu'exige ADR-005. Écarté :
   un PaaS (Railway, Render), plus rapide mais qui masque l'exploitation ; et
   Kubernetes, surdimensionné pour deux process et `concurrency: 1`. Scalingo
   (hébergeur français annonçant une certification HDS) ne devient pertinent
   qu'au passage aux vrais courriers, où l'article 9 du RGPD s'applique.
2. **Une seule image pour le back et le worker**, seule la commande diffère. Même
   code, même `node_modules`, une surface de build au lieu de deux.
3. **Pas de CD automatique ce sprint** (décision de cadrage existante).
   `deploy.sh` fait `git pull --ff-only`, build, `up -d --wait`, puis sonde
   `https://<domaine>/api/sante`. Le CD reste en roadmap E10.
4. **Migrations au démarrage du service `back`** (`prisma migrate deploy` avant
   de servir). Une seule instance, donc pas de course. Le `worker` attend que le
   `back` soit *healthy* : il ne touche la base qu'une fois le schéma à jour.
5. **`node_modules` complet dans l'image de runtime**, dépendances de
   développement comprises. C'est un choix, pas un oubli : `migrate deploy`
   exige la CLI `prisma` (devDependency) et le chargeur TypeScript qu'elle
   embarque pour lire `prisma.config.ts`. Un `npm prune --production` casserait
   les migrations au démarrage.

**Amendement d'ADR-005 — le chemin d'API publié.** ADR-005 annonçait que Caddy
routerait `/api/*` et `/auth/*` vers le back. C'est inapplicable en l'état : le
front appelle l'API sur `/api/back/*` en dur (`front/src/lib/config.ts`,
`BROWSER_API_BASE`), en production comme en développement. Router `/api/*` tel
quel aurait envoyé `/api/back/api/dossiers` au back **sans retirer le préfixe**,
soit un 404 sur chaque appel depuis le navigateur.

Le Caddyfile utilise donc `handle_path /api/back/*`, qui retire le préfixe
exactement comme le rewrite de `next.config.ts` en développement. Conséquence
utile : le navigateur voit les mêmes chemins dans les deux environnements.
L'alternative — rendre `BROWSER_API_BASE` dépendante de l'environnement pour
publier des URL plus propres — touchait le chemin de données de tous les écrans
d'E1 à E5 pour un gain cosmétique, et introduisait une divergence dev/prod. Elle
est écartée.

Les exigences de fond d'ADR-005 sont préservées : origine publique unique,
cookie *host-only* (`path=/`), aucune CORS, `@fastify/cors` toujours inutile
(constat #9 de l'audit, traité en T8).

**Conséquences.** Vérifié en local sur la pile complète, le 18 septembre 2026 :
les trois images se construisent, les six services démarrent sains, les 7
migrations s'appliquent au démarrage, le worker se déclare prêt sur la file,
Caddy émet son certificat, `/api/sante` renvoie
`{"status":"ok","db":"ok","redis":"ok"}`, `/api/back/api/dossiers` renvoie 401
(et non 404 : la preuve que le préfixe est bien retiré), et `http://` redirige
en 308 vers `https://`.

Deux risques anticipés par le plan n'existaient pas :

- `@capclair/contract` n'apparaît pas comme paquet dans la sortie autonome de
  Next, mais `transpilePackages` l'inline dans les chunks serveur — vérifié, ses
  messages FR y sont présents, et le serveur autonome sert `/connexion` en 200.
- `argon2` v0.44 embarque `prebuilds/linux-x64/argon2.musl.node` : elle ne
  compile rien à l'installation, donc rien à outiller sur Alpine.

Un piège Windows en revanche était réel : `Dockerfile` et `Caddyfile` n'ont pas
d'extension et tombaient sous `* text=auto`, donc livrés en CRLF sur un poste
Windows — une continuation `\` suivie de CRLF casse un `RUN`. Les deux sont
désormais épinglés en LF dans `.gitattributes`, et `deploy.sh` est en `100755`
faute de quoi `./deploy.sh` échoue sur le serveur.

**Reste à faire (hors de cette décision).** Provisionner le VPS, poser
l'enregistrement DNS, dérouler le parcours complet sur le domaine public. Les
sauvegardes, le durcissement du serveur et le CD restent dans E10.
