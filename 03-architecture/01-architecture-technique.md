# DossierClair — Architecture technique

**Version** : 1.0 — 22 juillet 2026
**Statut** : décisions techniques tranchées, à valider

Ce document est la version détaillée de la section 7 du cahier des charges. Il fige les choix d'architecture et tranche les quatre décisions techniques restées ouvertes (D7, D8, D11, D14).

---

## 1. Principe directeur

L'architecture sert un seul objectif produit : **produire une analyse vérifiable**. Chaque choix technique en découle. La règle qui structure tout le reste :

> L'IA propose du texte. Le serveur décide de ce qui est enregistré. L'utilisateur a le dernier mot.

Concrètement, trois barrières successives séparent la sortie de l'IA de la base de données : la **validation de schéma** (rien de malformé n'entre), les **règles déterministes** (les dates et montants ne sont jamais ceux calculés par l'IA), et la **correction manuelle** (l'utilisateur écrase toute valeur). Aucune de ces barrières n'est optionnelle.

---

## 2. Vue d'ensemble

Monolithe modulaire Next.js (App Router, TypeScript) accompagné d'un worker asynchrone. Cinq conteneurs : `web`, `worker`, `postgres`, `redis`, `reverse-proxy`.

```text
                        ┌─────────────────┐
      Navigateur ──────▶│  reverse-proxy  │  HTTPS, redirection HTTP→HTTPS
                        │  (Caddy)        │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐        ┌──────────────┐
                        │  web (Next.js)  │───────▶│  API IA      │
                        │  App Router     │        │  (externe)   │
                        │  Server Actions │        └──────────────┘
                        └───┬────────┬────┘
                            │        │
              ┌─────────────▼──┐  ┌──▼──────────────┐
              │  postgres      │  │  redis          │
              │  (données +    │  │  (file BullMQ)  │
              │   fichiers réf) │  └──┬──────────────┘
              └────────▲────────┘     │
                       │        ┌─────▼───────────┐     ┌──────────────┐
                       └────────│  worker (Node)  │────▶│  SMTP / API  │
                                │  rappels,       │     │  e-mail      │
                                │  analyses, purge│     └──────────────┘
                                └─────────────────┘
```

Le `web` et le `worker` partagent le même code (monorepo, packages communs) mais tournent dans deux processus distincts. Ils communiquent uniquement par la base et par Redis, jamais par appel direct.

---

## 3. Décisions techniques tranchées

### D7 — Le calcul des dates et montants est fait par le serveur, jamais par l'IA ✅

**Décision** : l'IA repère et renvoie le **passage textuel** qui contient une date ou un délai (le `sourceExcerpt`). Le serveur en extrait la valeur par des règles déterministes.

**Justification** : une date jamais générée par l'IA est une date jamais hallucinée. C'est la mitigation du risque R1, le plus élevé du projet.

**Mise en œuvre**

- Dates explicites (« avant le 15 mars 2026 ») : parsées côté serveur avec une librairie de dates (date-fns) sur un ensemble de formats français connus.
- Délais relatifs (« dans un délai d'un mois à compter de la réception ») : le serveur calcule `dateDuCourrier + délai`. La date du courrier est elle-même extraite de façon déterministe, avec repli sur la date d'import si absente (et l'incertitude est alors signalée).
- Montants : l'IA renvoie la chaîne littérale (« 1 250,30 € »), le serveur normalise en `Decimal`.
- Toute date d'échéance antérieure à la date du courrier est **rejetée** (règle de cohérence).

**Conséquence sur le schéma IA** : les champs `échéances` et `montants` renvoyés par l'IA contiennent un `rawText` + un `sourceExcerpt`, jamais une valeur normalisée directement consommée.

### D8 — L'analyse est asynchrone dès le départ ✅

**Décision** : l'analyse d'un courrier est une tâche de file (BullMQ sur Redis), traitée par le worker, pas un appel synchrone dans la requête HTTP.

**Justification** : l'API IA peut être lente (jusqu'à 30 s) ou indisponible. Un appel synchrone bloque la requête, expose à des timeouts de proxy, et n'offre aucune reprise. Ajouté après coup, l'asynchrone est coûteux ; prévu dès le départ, il est gratuit puisque le worker existe déjà pour les rappels.

**Mise en œuvre**

- Le dossier porte un état d'analyse : `EN_ATTENTE` → `EN_COURS` → `TERMINÉE` | `ÉCHEC`.
- L'écran affiche un état d'attente et interroge l'avancement (polling léger toutes les 2 s, ou revalidation).
- Un bouton « Relancer l'analyse » réémet la tâche sur un dossier en `ÉCHEC`.
- La tâche est idempotente : relancer une analyse remplace le résultat précédent sans dupliquer les entités, et **préserve les corrections manuelles** (`isUserCorrected = true`).

### D11 — Redis est conservé, assumé comme choix de démonstration ✅

**Décision** : Redis + BullMQ pour la file de tâches, plutôt qu'une file en PostgreSQL.

**Justification honnête** : au volume attendu (quelques rappels et analyses par jour), PostgreSQL avec `FOR UPDATE SKIP LOCKED` suffirait. Redis n'est pas une nécessité de charge. Il est retenu comme **choix de démonstration** : BullMQ apporte les retries, le backoff exponentiel, la planification différée et un tableau de bord des jobs — des compétences recherchées, défendables en soutenance. Ce choix est documenté comme tel dans le README, sans le maquiller en contrainte technique.

**Conséquence** : Redis sert deux usages — file BullMQ et, accessoirement, cache des analyses identiques (même hash de texte extrait → résultat réutilisé, économie d'appels IA).

### D14 — `ExtractedInformation.category` est une énumération fermée ✅

**Décision** : le champ `category` devient un type énuméré contrôlé par le schéma Zod : `REFERENCE`, `MONTANT`, `DATE`, `IDENTITE`, `CONTACT`, `AUTRE`.

**Justification** : un champ libre produirait « Numéro allocataire », « N° allocataire », « Référence dossier » de façon interchangeable, rendant impossible tout affichage cohérent et toute mesure de qualité. `label` reste libre (le texte affiché), mais `category` est contraint.

---

## 4. Modèle de données

Onze entités. Clés primaires UUID. Toutes les entités liées à un dossier portent `caseFileId` et sont supprimées en cascade avec lui.

### Entités et champs clés

**User** — `id`, `name`, `email` (unique), `passwordHash`, `emailVerifiedAt`, `createdAt`, `updatedAt`.

**CaseFile** — `id`, `userId` (FK), `title`, `organization` (enum `CAF|CPAM|FRANCE_TRAVAIL|INCERTAIN`), `documentType`, `status` (enum, 6 valeurs), `analysisState` (enum `EN_ATTENTE|EN_COURS|TERMINEE|ECHEC`), `summary`, `confidenceScore` (Decimal, stocké mais affiché en 3 niveaux), `documentDate`, `primaryDeadline`, `createdAt`, `updatedAt`.

**Document** — `id`, `caseFileId` (FK), `originalName`, `mimeType`, `storagePath`, `extractedText`, `extractedTextHash` (pour le cache IA), `fileSize`, `createdAt`.

**ExtractedInformation** — `id`, `caseFileId` (FK), `category` (enum fermée — D14), `label`, `value`, `sourceExcerpt`, `confidenceScore`, `isUserCorrected` (bool). *La correction manuelle prime : ce drapeau protège la ligne contre l'écrasement par une nouvelle analyse.*

**ActionItem** — `id`, `caseFileId` (FK), `title`, `description`, `dueDate`, `completed` (bool), `source` (enum `AI|USER`), `position` (int), `sourceExcerpt`.

**RequiredDocument** — `id`, `caseFileId` (FK), `name`, `available` (bool), `note`, `sourceExcerpt`.

**ResponseDraft** — `id`, `caseFileId` (FK, unique), `content`, `generatedContent` (version initiale conservée), `updatedAt`.

**Reminder** — `id`, `caseFileId` (FK), `channel` (enum `EMAIL|INTERNAL`), `reminderType` (enum `J7|J3|J0`), `scheduledAt`, `sentAt`, `status` (enum `PENDING|SENT|FAILED`), `errorMessage`. **Contrainte d'unicité : (`caseFileId`, `reminderType`, `channel`)** — garantie anti-doublon au niveau base (US-7.3).

**Notification** — `id`, `userId` (FK), `caseFileId` (FK), `title`, `message`, `readAt`, `createdAt`.

**ConsentLog** — `id`, `userId` (FK), `caseFileId` (FK nullable), `consentType` (enum `CGU|AI_PROCESSING|FICTIONAL_DOCUMENT`), `acceptedAt`, `policyVersion`.

**AuditEvent** — `id`, `userId` (FK), `caseFileId` (FK nullable), `eventType`, `metadata` (JSON, **jamais de contenu de document**), `createdAt`. *Écrit dès le début même si l'écran d'historique est reporté (réserve C9).*

### Diagramme relationnel

```text
User 1───∞ CaseFile 1───1 Document
              │ 1───∞ ExtractedInformation
              │ 1───∞ ActionItem
              │ 1───∞ RequiredDocument
              │ 1───1 ResponseDraft
              │ 1───∞ Reminder        (unique: caseFileId+reminderType+channel)
User 1───∞ Notification ∞───1 CaseFile
User 1───∞ ConsentLog
User 1───∞ AuditEvent
```

---

## 5. Organisation du code

```text
src/
  app/
    (auth)/            connexion, inscription, réinitialisation
    dashboard/         tableau de bord
    dossiers/[id]/     détail, résultat, brouillon
    api/               routes API + webhooks
  components/          UI partagée (shadcn/ui)
  features/
    auth/  documents/  analysis/  cases/  reminders/  notifications/
      └── chaque module : composants, services, schémas Zod, tests
  server/
    auth/  database/  ai/  mail/  storage/  queues/
  schemas/             schémas Zod partagés (dont sortie IA)
  lib/                 utilitaires (dates déterministes, formatage)
  types/
worker/                point d'entrée du process worker (BullMQ)
prisma/                schéma + migrations
tests/                 intégration, E2E, dataset de référence
docker/
```

Chaque module de `features/` est autonome : il contient ses composants, sa logique serveur, ses schémas de validation et ses tests. Un module ne dépend jamais des internes d'un autre — seulement de `server/` et `schemas/`.

---

## 6. Flux d'analyse (asynchrone)

```text
1.  Utilisateur importe un PDF
2.  web : validation signature + taille → stockage hors racine web (nom UUID)
3.  web : extraction du texte PDF → Document.extractedText (+ hash)
4.  web : si texte < 100 caractères → arrêt, message "illisible", AUCUN appel IA
5.  web : consentement AI_PROCESSING enregistré (ConsentLog)
6.  web : CaseFile.analysisState = EN_ATTENTE, tâche "analyse" mise en file (BullMQ)
7.  web : réponse immédiate → écran d'attente
─── worker ───
8.  worker : analysisState = EN_COURS
9.  worker : cache ? (hash identique déjà analysé) → réutilise, sinon appel API IA
10. worker : validation Zod stricte
      └─ invalide → relance (max 2) → si échec définitif : analysisState = ECHEC
11. worker : règles déterministes (dates, montants) côté serveur — D7
12. worker : cohérence (échéance ≥ date du courrier)
13. worker : persistance (préserve les lignes isUserCorrected)
14. worker : programmation des rappels J-7/J-3/J-0 (idempotent, contrainte unique)
15. worker : analysisState = TERMINEE, AuditEvent écrit
─── retour UI ───
16. web : l'écran d'attente bascule sur le résultat
```

L'étape 4 est une **barrière dure** : aucun appel externe si le texte est trop court, vérifié par test (US-2.6).

---

## 7. Flux de rappel

```text
worker (planifié)
  → sélectionne les Reminder PENDING dont scheduledAt est échu
  → ignore les dossiers au statut "Terminé"
  → vérifie les préférences utilisateur (rappels e-mail activés ?)
  → envoie l'e-mail (ou crée la notification interne)
  → SUCCÈS : status = SENT, sentAt renseigné
  → ÉCHEC  : status = FAILED, errorMessage, backoff (max 3 tentatives)
```

L'anti-doublon repose sur deux niveaux : la **contrainte d'unicité en base** (`caseFileId`+`reminderType`+`channel`) et l'atomicité du passage `PENDING → SENT` (un seul worker peut réserver un rappel). Testé par un scénario lançant deux workers en parallèle (US-7.3).

---

## 8. Sécurité (rappel des mesures architecturales)

| Mesure | Mise en œuvre |
|---|---|
| Isolation des données | Filtrage `userId` dans la couche `server/database`, jamais seulement dans l'UI. Accès étranger → 404. |
| Mots de passe | argon2id (ou bcrypt coût ≥ 12). |
| Sessions | Cookies `httpOnly`, `secure`, `sameSite=lax` ; invalidation serveur à la déconnexion. |
| Fichiers | Stockage hors racine web, nom UUID généré serveur, validation par signature. |
| Validation | Zod sur chaque endpoint (entrée) et sur la sortie IA. |
| Limitation de débit | Auth, import, analyse — seuils par variable d'environnement. |
| Logs | Aucun contenu de document, nom d'origine ou brouillon — vérifié par test. |
| Secrets | Hors dépôt Git, `.env.example` fourni, refus de démarrage si variable manquante. |
| Consentement | Enregistré, versionné, horodaté, antérieur obligatoire à l'appel IA. |
| Suppression | Cascade complète (fichier + entités) ; seul l'AuditEvent de suppression subsiste. |

---

## 9. Conteneurs et déploiement

| Conteneur | Rôle | Volume persistant |
|---|---|---|
| `web` | Application Next.js | — |
| `worker` | Tâches asynchrones (analyses, rappels, purge) | — |
| `postgres` | Base de données | `pgdata` |
| `redis` | File BullMQ + cache | `redisdata` (optionnel) |
| `reverse-proxy` | HTTPS, redirection, routage (Caddy — certificat automatique) | `caddydata` |

Les fichiers importés sont stockés sur un volume monté (`uploads`), hors de la racine servie par le proxy.

**Choix du proxy** : Caddy plutôt que Nginx, pour la gestion automatique des certificats TLS (Let's Encrypt intégré) — un point de friction en moins pour une première mise en HTTPS.

**Déploiement** : script manuel déclenché après fusion (décision C6). Le script se connecte en SSH, récupère la version, applique les migrations Prisma, redémarre Compose et vérifie le health check `/api/sante`. Le déploiement continu automatique reste en roadmap.

---

## 10. Décisions restant à trancher

| Sujet | Recommandation | Statut |
|---|---|---|
| Librairie de dates (date-fns vs Luxon) | date-fns (léger, tree-shakable) | à confirmer |
| Extraction PDF (pdf-parse vs pdfjs) | pdf-parse pour les PDF texte natifs du corpus | à confirmer |
| Fournisseur d'API IA | à choisir selon coût/qualité sur le corpus | à confirmer |
| Emplacement du stockage fichiers (volume local vs S3/MinIO) | volume local pour le MVP, abstraction `storage/` pour évoluer | à confirmer |

Ces choix ne bloquent pas le démarrage : ils sont encapsulés derrière les modules `server/ai`, `server/storage` et `lib/dates`, et peuvent être tranchés au sprint 2 sans impact structurel.
