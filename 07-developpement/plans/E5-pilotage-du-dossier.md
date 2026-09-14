# Plan d'implémentation — Epic E5 « Pilotage du dossier »

Statut : **décisions §2 verrouillées** (revue du 2026-09-14) — prêt pour PR-A ·
Prérequis : **E1 (auth) + E2 (import/lecture) + E3 (consentement + analyse IA) + E4 (consultation et
vérification)** mergés sur `main` (confirmé sur `main` au 2026-09-14 — sync Jira KAN-6/KAN-7).

Écarts anticipés (vs le code déjà en place) :

- **US-5.1 AC1 (six statuts) vs schéma existant (quatre statuts).** Le cahier des charges (décision
  D9, `01-cadrage/03-incoherences-et-arbitrages.md`) prévoyait 6 statuts au MVP, **à retester à
  l'oral avec 5 utilisateurs réels**, réduits à 4 si < 4/5 classent correctement leur dossier. Le
  schéma (`CaseStatus`) avait anticipé cette réduction (4 valeurs, commentaire « confirmé au retest »)
  sur la seule foi d'une synthèse **simulée** (`06-tests-utilisateurs/08-synthese-simulee.md`), jamais
  un vrai test. **Décision de revue (§2 #1) : revenir aux 6 statuts d'origine**, conformes à la fois
  au cahier des charges et au wireframe (écran 6, qui les montre « sans réduction anticipée ») —
  l'écart entre le code et la maquette disparaît. La réduction à 4 n'était pas confirmée ; ce plan ne
  la reconduit pas. Migration de données non triviale (§3.2), sans enjeu réel : dépôt de démonstration,
  aucune donnée de production.
- **`ActionItem` / `RequiredDocument` n'ont aujourd'hui aucune protection contre la ré-analyse**
  (risque 9.6 identifié dès le plan E3 : « aucune US d'E3 ne l'exige, mais à traiter avant que E5
  rende le problème visible »). `analysis-store.ts::applyAnalysis` les `deleteMany` puis recrée
  **intégralement** à chaque analyse réussie. US-5.2 (cocher une action) et US-5.3 (checklist)
  rendent ce trou visible immédiatement : sans protection, cocher une action puis relancer
  l'analyse (retry sur `ECHEC`, ou un futur bouton « ré-analyser ») perdrait l'état. **E5 doit
  livrer la protection avant/avec US-5.2**, pas après.
- **Écran « Pilotage du dossier » (wireframe #6) : route dédiée, décision de revue (§2 #2).**
  Le wireframe liste un écran 6 séparé (US-5.1/5.2/5.3/5.5 **+ US-4.5**), distinct de l'écran 5
  (résultat d'analyse). E3 (D8) avait fusionné 04/05 sur une seule URL, et E4 a placé
  `<CaseHistory>` (US-4.5) sur l'écran 05 — un précédent qui aurait pu justifier de tout regrouper.
  **La revue a tranché pour suivre la maquette** : nouvelle route `/dossiers/[id]/pilotage`. **Sous-
  décision assumée** (non explicitement demandée en revue, à confirmer si elle ne convient pas) :
  `<CaseHistory>` **reste sur l'écran 05** plutôt que d'être déplacé sur le nouvel écran 6, pour ne
  pas régresser un composant déjà livré et testé en E4 sans qu'aucune US ne l'exige explicitement.
  L'écran 05 garde ses listes d'actions/justificatifs **en lecture seule** (comportement E4 inchangé,
  déjà documenté ainsi dans le code : « US-4.1 — lecture seule en E4 ») ; l'écran 06 porte les
  versions interactives.
- **Maquette Hi-Fi.** Comme pour E4 (§6.6 de son plan), le fichier Figma ne montre que la page basse
  fidélité pour les écrans 2 (tableau de bord) et 6 (pilotage). **Les node-ids Hi-Fi de ces deux
  écrans doivent être fournis par l'utilisateur** avant les PR front — en attendant, référence =
  `04-maquettes/wireframes.html` §Screen 2 / §Screen 6 + `04-maquettes/design-system.md`.
- **US-5.4 « notifications récentes » — décision de revue (§2 #7) : le circuit `Notification` est
  ouvert maintenant.** Rien ne l'alimentait avant E5 (E3/E4 n'écrivent que `AuditEvent`). Le worker
  écrit désormais aussi une ligne `Notification` sur `analysis.completed`/`analysis.failed`,
  préparant le terrain pour E7 (`RAPPEL`) sans y toucher.
- **US-5.4 AC (perf < 1,5 s pour 20 dossiers)** : mesurable seulement par un test de charge réel, pas
  par une assertion Vitest classique. Ce plan couvre la partie vérifiable par le code (nombre de
  requêtes, index utilisés) et documente la mesure de temps comme **hors périmètre automatisable**
  — cf. l'expérience de la réserve KAN-31/AC2 (mémoire `jira-sync-e3`) : ne pas monter une infra de
  test de charge sans décision explicite de l'équipe.

---

## 1. Cadre

- E5 hérite de tout E1-E4. Mêmes frontières : **une seule frontière IA** (`server/ai/`, jamais
  touchée par E5), **une seule frontière file** (`server/queues/` + `worker/`, jamais touchée), une
  seule frontière stockage (`lib/storage.ts`, réutilisée pour US-5.5).
- E5 est **scopé `userId`** comme E4 : tout passe par `context.forUser()` / `repositories.ts` ;
  règle ESLint `no-restricted-syntax` (aucun `prisma.*` direct dans `features/**`). Le seul module
  hors scope qu'E5 modifie est `server/database/analysis-store.ts` (déjà autorisé, couche système)
  pour la garde de protection `ActionItem`/`RequiredDocument`.
- **D9** (doc cadrage) : retour aux 6 statuts d'origine (décision de revue #1, voir écart ci-dessus).
  **D12** (conservation 12 mois) : la suppression manuelle (US-5.5) est un cas particulier de la
  purge déjà prévue par D12 — même mécanique de nettoyage cascade, déclenchée par l'utilisateur
  plutôt que par le job planifié.
- **D8** (écrans 04/05 fusionnés sur une URL, E3) **n'est pas reconduit pour l'écran 06** : décision
  de revue #2, route dédiée `/dossiers/[id]/pilotage`. Les deux pages partagent le même endpoint de
  lecture (`GET …/resultat`, étendu avec `status`) plutôt que d'en dupliquer un — pas de nouvel
  aller-retour réseau côté back, seule la présentation diffère côté front (§6).
- Module `features/cases/` existant (E3/E4) : `cases.routes.ts`, `cases.service.ts`,
  `cases.mapper.ts`, `cases.dto.ts`, `history-label.ts`, `index.ts`. E5 les étend, ne les réécrit
  pas. Le hook `features/reminders/reschedule.ts` (no-op depuis E4) reste no-op — E5 ne touche pas
  aux rappels (E7).
- `history-label.ts` a **déjà réservé** les libellés `case.status_changed`, `action.completed`,
  `action.reopened`, `case.deleted` (commentaire : « types émis par des epics ultérieurs — E5 »).
  E5 les émet enfin ; aucun changement de `history-label.ts` lui-même, sauf le libellé
  `case.status_changed` à préciser si on veut afficher l'ancien/nouveau statut (voir §2 décision #6).

## 2. Décisions à verrouiller

| # | Sujet | Décision | Alternative |
|---|---|---|---|
| 1 | Nombre de statuts (US-5.1 AC1) | **Retour aux 6 statuts d'origine**, conformes au cahier des charges et au wireframe (écran 6) : `A_ANALYSER`, `ACTION_REQUISE`, `DOCUMENTS_A_PREPARER`, `REPONSE_PRETE`, `EN_ATTENTE`, `TERMINE`. La réduction à 4 déjà en base reposait sur une synthèse **simulée** (jamais un vrai test) — pas reconduite. Migration de recréation d'enum (§3.2) : sans enjeu réel, dépôt de démonstration sans donnée de production. **Décidé en revue (2026-09-14), remplace la proposition initiale de ce plan (garder 4).** | Garder les 4 statuts déjà en base — proposition initiale de ce plan, écartée en revue : aurait figé une réduction jamais confirmée par un vrai utilisateur |
| 2 | Écran « Pilotage » vs écran 05 existant | **Nouvelle route `/dossiers/[id]/pilotage`** (écran 6), distincte de `/dossiers/[id]` (écran 5, résultat d'analyse, inchangé et toujours en lecture seule sur actions/justificatifs). Les deux pages consomment le même `GET …/resultat` étendu. **Décidé en revue (2026-09-14), remplace la proposition initiale de ce plan (fusionner sur l'écran 05).** | Étendre `/dossiers/[id]` — proposition initiale de ce plan, écartée en revue : le wireframe distingue clairement les deux écrans (résultat d'analyse = ce que dit le courrier ; pilotage = ce qu'on en fait), et les garder séparés évite de surcharger l'écran 05 déjà dense (6 sections imposées par US-4.1) |
| 3 | Endpoint de changement de statut (US-5.1 AC2) | **`PATCH /api/dossiers/:id/statut`**, body `{ status: CaseStatusSchema }`. Toute transition manuelle est acceptée (aucune matrice de transitions imposée — l'AC ne le demande pas) ; `AuditEvent` `case.status_changed` avec `metadata: { from, to }` (des codes de statut, pas de contenu de courrier — US-8.2 OK). | Matrice de transitions autorisées (ex. impossible de repasser de `TERMINE` à `A_ANALYSER`) — rejeté : aucune AC ne l'exige, ajoute de la friction sans bénéfice démontré |
| 4 | Passage automatique après analyse (US-5.1 AC3) | **`applyAnalysis` fixe `status` conditionnellement** : `ACTION_REQUISE` si `result.actions.length > 0` (libellé littéral de l'AC, désormais un vrai statut distinct grâce à la décision #1), sinon **`TERMINE` directement** — un courrier purement informatif (0 action) n'a rien à « faire », il est traité. `"status"` est **ajouté à `LOCKABLE_FIELDS`** : si l'utilisateur a déjà changé le statut à la main, une ré-analyse ne l'écrase plus (même logique que `organisme`/`title`/`mainDeadline`, US-4.4 AC3). Les statuts `DOCUMENTS_A_PREPARER`, `REPONSE_PRETE`, `EN_ATTENTE` ne sont **jamais** atteints automatiquement — seule la transition décrite par l'AC l'est ; le reste est manuel (AC2). | Toujours `ACTION_REQUISE` quel que soit le nombre d'actions (comportement actuel, transposé tel quel) — rejeté : ne satisfait pas l'AC littéralement, et un dossier 0-action resterait indéfiniment « à faire » sans raison |
| 5 | Protection `ActionItem`/`RequiredDocument` contre la ré-analyse | **Nouvelle colonne `ActionItem.origin` (`ANALYSE` \| `MANUEL`)** : `applyAnalysis` ne supprime/recrée que les lignes `origin = ANALYSE` **et** `done = false` (une action cochée, même issue de l'analyse, est protégée — au même titre qu'une correction US-4.4). `RequiredDocument` protégé dès que `provided = true` **ou** `userNote` non vide. Les lignes `MANUEL` (US-5.2, ajoutées à la main) ne sont **jamais** supprimées par une ré-analyse. | Booléen `isUserModified` calqué texto sur `ExtractedInformation.isUserCorrected` — équivalent pour `RequiredDocument` (retenu) ; pour `ActionItem`, un champ `origin` est préféré parce qu'une action **ajoutée à la main** n'a pas de `sourceExcerpt` réel (décision #8) — distinguer « jamais issue de l'IA » de « issue de l'IA mais cochée » évite d'inventer un `sourceExcerpt` factice |
| 6 | Métadonnées de `case.status_changed` | `metadata: { from: CaseStatus, to: CaseStatus }` — codes techniques, pas de contenu de courrier. `history-label.ts` reste un libellé fixe (« Statut du dossier modifié ») : afficher l'ancien/nouveau statut en clair dans l'historique est un luxe, pas une AC ; à réévaluer si demandé. | Libellé dynamique intégrant les deux statuts en toutes lettres — reporté, pas nécessaire pour satisfaire US-4.5 AC2 |
| 7 | Table `Notification` alimentée ou non par E5 | **E5 ouvre le circuit, minimal.** Le worker (`recordAnalysisEvent`, déjà appelé sur `analysis.completed`/`analysis.failed`) écrit **aussi** une ligne `Notification` (`type: ANALYSE_TERMINEE` \| `ANALYSE_ECHEC`, `title`/`body` courts, `read: false`). Le tableau de bord lit `Notification` (triée `createdAt desc`, non lue en premier) plutôt que de reconstruire une vue depuis `AuditEvent`. Prépare le terrain pour E7 (`RAPPEL`) sans rien y ajouter maintenant. **Confirmé en revue (2026-09-14).** | Dashboard lit directement `AuditEvent` — rejeté : le modèle `Notification` existe précisément pour ça (`read`, `title`, `body` déjà pensés pour l'UI, contrairement à `AuditEvent.metadata`, un `Json?` libre) ; le laisser vide indéfiniment serait une dette qu'E7 devrait de toute façon combler |
| 8 | Action ajoutée manuellement (US-5.2 AC2) — `sourceExcerpt` | `ActionItem.sourceExcerpt` devient **nullable** (`String? @db.Text`). Une action `origin = MANUEL` a `sourceExcerpt = null` : le mapper (`toCaseResultDto`) n'appelle pas `isLiteralExcerpt` dessus et renvoie `verifiable: null` (pas `false` — `false` signifierait « extrait non retrouvé », un signal de défiance qui n'a pas de sens pour une action que l'utilisateur a lui-même écrite). Le front n'affiche pas de `SourceExcerptDisclosure` quand `sourceExcerpt` est `null`. | Chaîne vide `""` au lieu de `null` — rejeté : `isLiteralExcerpt("", text)` renvoie déjà `false` (garde existante), donc une chaîne vide serait interprétée à tort comme « extrait non vérifiable » plutôt que « pas d'extrait du tout » |
| 9 | Description d'une action manuelle | Nouvelle colonne `ActionItem.description String? @db.Text` (distincte de `title`). Les actions issues de l'IA n'ont pas de description (`null`) — seul le titre existe côté analyse (contrat E3, `ActionIASchema`). | Concaténer titre + description dans `title` — rejeté : l'AC les distingue explicitement, et l'écran 05 affiche déjà `title` seul pour les actions IA |
| 10 | Suppression définitive (US-5.5) — portée de la cascade | **`CaseFileRepository.deleteForUser`** : transaction qui (1) crée l'`AuditEvent` `case.deleted` (caseFileId encore valide) avant toute suppression, (2) `deleteMany` sur les **autres** `AuditEvent` du dossier (pour que seul l'événement de suppression survive, AC4), (3) `prisma.caseFile.delete` — le reste (`Document`, `ExtractedInformation`, `ActionItem`, `RequiredDocument`, `ResponseDraft`, `Reminder`, `ConsentLog`, `Notification` — voir décision #11) part par `onDelete: Cascade` déjà en place. Fichiers sur disque supprimés **avant** la transaction (best-effort, `storage.deleteDocument` déjà utilisé par E2, `.catch(() => {})` comme le reste du code) — une transaction Postgres ne protège pas des fichiers, mieux vaut un fichier orphelin sur disque qu'une ligne DB orpheline. | Soft-delete (`deletedAt`) au lieu d'un hard delete — rejeté explicitement par l'AC (« définitive »), et `deletedAt` existe déjà pour un tout autre usage (filtre de lecture courant, pas une suppression) |
| 11 | Relation `Notification.caseFileId` | Migration : `ALTER onDelete SetNull → Cascade`. Une notification liée à un dossier n'a aucun sens sans lui (contrairement à `AuditEvent`, qui est une trace de conformité voulue même orpheline, et `ConsentLog`, qui prouve un consentement passé indépendamment du dossier). | Garder `SetNull` + `deleteMany` manuel dans `deleteForUser` — fonctionnellement équivalent tant qu'on n'oublie pas le `deleteMany` partout où un dossier peut disparaître ; le changement de relation rend l'invariant vrai **structurellement**, pas seulement par discipline de code |
| 12 | Endpoint tableau de bord (US-5.4) | **Pas de nouvel endpoint dédié.** `GET /api/dossiers` (nouveau, liste scopée `userId`) renvoie les dossiers + un résumé calculé en une seule requête (voir §5.1) : compteurs (actifs, échéance < 7 j, actions restantes) + 5 dernières analyses + `Notification` récentes en un seul aller-retour. Alimente à la fois la liste et les tuiles de résumé du tableau de bord. | Deux endpoints séparés (`/dossiers` liste + `/dossiers/resume`) — rejeté : le tableau de bord affiche les deux en même temps, deux requêtes réseau pour un seul écran sans bénéfice de cache démontré |
| 13 | Historique (US-4.5) : écran 05 ou 06 ? | **Reste sur l'écran 05** (`<CaseHistory>`, déjà livré en E4), malgré le wireframe qui le liste sous l'écran 6. Non explicitement demandé en revue — décision d'implémentation assumée pour ne pas régresser un composant déjà testé, à corriger si elle ne convient pas. | Déplacer `<CaseHistory>` vers `/dossiers/[id]/pilotage` pour suivre le wireframe à la lettre — possible en petit correctif ultérieur si demandé, non retenu par défaut |
| 14 | Composants interactifs : partagés ou dédiés à l'écran 06 ? | **Composants dédiés** dans `cases/pilotage/` (§6.4) : `pilotage-actions-list.tsx`, `pilotage-required-docs-list.tsx`, distincts de `actions-list.tsx`/`required-docs-list.tsx` (E4, lecture seule, restent inchangés sur l'écran 05). | Un seul composant par domaine avec une prop `interactive` — rejeté : risque qu'une régression sur la prop rende l'écran 05 « résultat d'analyse » accidentellement interactif, alors que US-4.1 le documente explicitement comme lecture seule |

---

## 3. Modèle de données et migration (PR-A)

### 3.1 `back/prisma/schema.prisma`

```prisma
/// Modèle à 6 statuts (décision D9 non réduite — décision de revue §2 #1, 2026-09-14).
enum CaseStatus {
  A_ANALYSER
  ACTION_REQUISE
  DOCUMENTS_A_PREPARER
  REPONSE_PRETE
  EN_ATTENTE
  TERMINE
}

model CaseFile {
  // ... champs existants inchangés ...
  status CaseStatus @default(A_ANALYSER)   // type déjà en place, valeurs de l'enum changent

  /// US-4.4 AC3 (existant) — étendu en E5 : "status" peut désormais aussi
  /// figurer dans userLockedFields (décision #4) quand l'utilisateur a changé
  /// le statut à la main.
  userLockedFields String[] @default([])
}

model ActionItem {
  // ... champs existants inchangés ...

  /// US-5.2 AC2 — origine de l'action : ANALYSE (issue de l'IA, E3) ou MANUEL
  /// (ajoutée par l'utilisateur, E5). Détermine la protection contre la
  /// ré-analyse (décision #5) et la présence d'un sourceExcerpt (décision #8).
  origin        ActionOrigin @default(ANALYSE)
  /// US-5.2 AC2 — description libre, distincte du titre. Toujours `null` pour
  /// une action issue de l'analyse (le contrat IA n'a qu'un `title`).
  description   String?      @db.Text
  /// Nullable depuis E5 : une action MANUEL n'a pas d'extrait source
  /// (décision #8). Une action ANALYSE en a toujours un (comme aujourd'hui).
  sourceExcerpt String?      @db.Text
}

model RequiredDocument {
  // ... champs existants inchangés ...

  /// US-5.3 AC2 — note libre (500 caractères max, contrôlé côté contrat/Zod,
  /// pas ici). `null`/chaîne vide = pas de note.
  userNote String? @db.Text
}

model Notification {
  // ... champs existants inchangés ...
  caseFileId String?
  /// E5 — passe de SetNull à Cascade (décision #11) : une notification liée à
  /// un dossier supprimé n'a plus de sens et doit disparaître avec lui.
  caseFile   CaseFile? @relation(fields: [caseFileId], references: [id], onDelete: Cascade)
}

enum ActionOrigin {
  ANALYSE
  MANUEL
}
```

### 3.2 Migration `back/prisma/migrations/<ts>_e5_pilotage/migration.sql`

```sql
-- E5 — Pilotage du dossier (ADR-019).

-- CaseStatus : 4 -> 6 valeurs (décision de revue §2 #1, retour à D9 non réduit). Postgres ne permet
-- pas de retirer/renommer une valeur d'enum in place proprement pour un renommage sémantique — on
-- recrée le type. Aucune donnée réelle en jeu (dépôt de démonstration) : le mapping de repli
-- ci-dessous (A_FAIRE -> ACTION_REQUISE, EN_ATTENTE_REPONSE -> EN_ATTENTE) est un choix pragmatique,
-- pas une reconstruction fidèle de l'état métier réel de chaque dossier existant.
CREATE TYPE "CaseStatus_new" AS ENUM (
  'A_ANALYSER', 'ACTION_REQUISE', 'DOCUMENTS_A_PREPARER', 'REPONSE_PRETE', 'EN_ATTENTE', 'TERMINE'
);
ALTER TABLE "CaseFile" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CaseFile" ALTER COLUMN "status" TYPE "CaseStatus_new" USING (
  CASE "status"::text
    WHEN 'A_FAIRE' THEN 'ACTION_REQUISE'
    WHEN 'EN_ATTENTE_REPONSE' THEN 'EN_ATTENTE'
    ELSE "status"::text
  END
)::"CaseStatus_new";
ALTER TABLE "CaseFile" ALTER COLUMN "status" SET DEFAULT 'A_ANALYSER';
DROP TYPE "CaseStatus";
ALTER TYPE "CaseStatus_new" RENAME TO "CaseStatus";

-- ActionItem / RequiredDocument (décisions #5, #8, #9).
CREATE TYPE "ActionOrigin" AS ENUM ('ANALYSE', 'MANUEL');
ALTER TABLE "ActionItem"
  ADD COLUMN "origin" "ActionOrigin" NOT NULL DEFAULT 'ANALYSE',
  ADD COLUMN "description" TEXT,
  ALTER COLUMN "sourceExcerpt" DROP NOT NULL;
ALTER TABLE "RequiredDocument" ADD COLUMN "userNote" TEXT;

-- Notification.caseFileId : SetNull -> Cascade (décision #11).
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_caseFileId_fkey";
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_caseFileId_fkey"
  FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

Générer via `prisma migrate dev --create-only`, relire le SQL généré (les noms de contrainte FK et
la stratégie exacte de recréation d'enum peuvent différer de ce que Prisma produit par défaut —
vérifier avec `\d "CaseFile"` / `\d "Notification"` en local avant de committer).

### 3.3 Impacts

- `back/src/server/database/analysis-store.ts` : `applyAnalysis` — statut conditionnel
  `ACTION_REQUISE`/`TERMINE` (décision #4), requêtes `deleteMany` d'`ActionItem`/`RequiredDocument`
  restreintes (décision #5), `createMany` des actions IA avec `origin: "ANALYSE"` explicite.
- `back/test/helpers/factories.ts` `seedCaseGraph` : accepter `status` (toutes les 6 valeurs),
  `origin`/`description` sur les actions (défaut `ANALYSE`/`null`), `userNote` sur les justificatifs.
- `back/test/helpers/testDb.ts` `TABLES` : `Notification` doit déjà être tronquée entre tests (à
  vérifier, sinon l'ajouter).
- Tout code TS existant qui compare `CaseFile.status` à `"A_FAIRE"` ou `"EN_ATTENTE_REPONSE"` casse à
  la compilation (les deux valeurs n'existent plus) — recherche exhaustive avant PR-A : ces deux
  littéraux n'apparaissent aujourd'hui que dans `analysis-store.ts` (`status: "A_FAIRE"`, ligne à
  remplacer par la logique conditionnelle) et les fixtures de test.
- Aucun usage TS existant de `sourceExcerpt` supposant non-null sur `ActionItem` en dehors de
  `cases.mapper.ts::toCaseResultDto` (`isLiteralExcerpt(action.sourceExcerpt, extractedText)`) — à
  garder derrière une garde `action.sourceExcerpt != null` (décision #8).

---

## 4. Contrat `@capclair/contract`

### 4.1 `contract/src/analysis.ts` (extensions)

```ts
/** US-5.1 — les 6 statuts (décision #1, retour à D9 non réduit). Libellés FR portés par le front. */
export const CaseStatusSchema = z.enum([
  "A_ANALYSER",
  "ACTION_REQUISE",
  "DOCUMENTS_A_PREPARER",
  "REPONSE_PRETE",
  "EN_ATTENTE",
  "TERMINE",
]);
export type CaseStatus = z.infer<typeof CaseStatusSchema>;

/** US-5.1 AC2. */
export const UpdateCaseStatusInputSchema = z.object({ status: CaseStatusSchema });
export type UpdateCaseStatusInput = z.infer<typeof UpdateCaseStatusInputSchema>;

/** "status" rejoint LOCKABLE_FIELDS (décision #4) — hérité de E4, valeur ajoutée seulement. */
export const LOCKABLE_FIELDS = ["organisme", "title", "documentDate", "mainDeadline", "status"] as const;

// ---------------------------------------------------------------------------
// E5 — Pilotage du dossier
// ---------------------------------------------------------------------------

/** US-5.2 — origine d'une action (décision #5/#8). */
export const ActionOriginSchema = z.enum(["ANALYSE", "MANUEL"]);

/** Étend ResultActionSchema (E4) : origin + description + sourceExcerpt/verifiable nullables. */
export const ResultActionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  done: z.boolean(),
  position: z.number().int(),
  origin: ActionOriginSchema,
  dueDate: z.string().datetime().nullable(),
  dueDateType: EcheanceTypeIASchema.nullable(),
  dueDateConfidence: DisplayConfidenceSchema.nullable(),
  dueDateSourceExcerpt: z.string().nullable(),
  sourceExcerpt: z.string().nullable(),   // null pour une action MANUEL (décision #8)
  verifiable: z.boolean().nullable(),     // null si sourceExcerpt est null
});

/** US-5.2 AC2 — ajout d'une action manuelle. */
export const CreateActionInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.string().date().optional(),  // "YYYY-MM-DD" ; pas de rawText, l'utilisateur saisit une date de calendrier
});
export type CreateActionInput = z.infer<typeof CreateActionInputSchema>;

/** US-5.2 AC1 — cocher/décocher (toggle explicite, pas un simple booléen "true seulement"). */
export const UpdateActionInputSchema = z.object({ done: z.boolean() });
export type UpdateActionInput = z.infer<typeof UpdateActionInputSchema>;

/** US-5.3 — étend ResultRequiredDocSchema (E4) : userNote. */
export const ResultRequiredDocSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  provided: z.boolean(),
  userNote: z.string().nullable(),
  sourceExcerpt: z.string(),
  verifiable: z.boolean(),
});

/** US-5.3 AC1/AC2 — cocher disponible/non disponible + note. Au moins une clé. */
export const UpdateRequiredDocInputSchema = z
  .object({
    provided: z.boolean().optional(),
    userNote: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => v.provided !== undefined || v.userNote !== undefined, {
    message: ANALYSIS_MESSAGES.nothingToUpdate,
  });
export type UpdateRequiredDocInput = z.infer<typeof UpdateRequiredDocInputSchema>;

/** US-5.4 — résumé du tableau de bord, calculé serveur (décision #12). */
export const DashboardSummarySchema = z.object({
  activeCount: z.number().int(),              // status != TERMINE
  deadlineWithin7DaysCount: z.number().int(),  // mainDeadline entre aujourd'hui et +7j, dossiers actifs
  remainingActionsCount: z.number().int(),     // actions non cochées, tous dossiers actifs confondus
  recentAnalyses: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    organisme: OrganismeIASchema,
    analysisStatus: AnalysisStatusSchema,
    analyzedAt: z.string().datetime().nullable(),
  })).max(5),
  recentNotifications: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(["ANALYSE_TERMINEE", "ANALYSE_ECHEC", "RAPPEL", "SYSTEME"]),
    title: z.string(),
    body: z.string(),
    read: z.boolean(),
    createdAt: z.string().datetime(),
  })),
});

/** US-5.4 — item de la liste de dossiers (tuile tableau de bord). */
export const CaseFileListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  organisme: OrganismeIASchema,
  status: CaseStatusSchema,
  analysisStatus: AnalysisStatusSchema,
  mainDeadline: z.string().datetime().nullable(),
  actionsRemaining: z.number().int(),
  actionsTotal: z.number().int(),
  lastActivityAt: z.string().datetime(),
});

export const CaseFileListResponseSchema = z.object({
  cases: z.array(CaseFileListItemSchema),
  summary: DashboardSummarySchema,
});
export type CaseFileListResponse = z.infer<typeof CaseFileListResponseSchema>;
```

`CaseFileResultResponseSchema` (E4, extension) : ajoute `status: CaseStatusSchema` — consommé par
les deux écrans (05 affiche le badge, 06 affiche le sélecteur), un seul champ pour les deux.

`ANALYSIS_MESSAGES` (extensions) :

```ts
deleteConfirmationRequired: "Cette action est définitive et supprime tout le dossier.", // texte de référence pour le front, pas une validation serveur
```

### 4.2 `contract/src/paths.ts`

```ts
export const CASE_FILE_PATHS = {
  // ... existants (detail, consentAi, analyze, result, updateInfo, deadline, history) ...
  list: () => `/api/dossiers`,                                    // US-5.4
  status: (id: string) => `/api/dossiers/${id}/statut`,            // US-5.1
  actions: (id: string) => `/api/dossiers/${id}/actions`,          // US-5.2 (POST)
  action: (id: string, actionId: string) =>
    `/api/dossiers/${id}/actions/${actionId}`,                     // US-5.2 (PATCH/DELETE)
  requiredDoc: (id: string, docId: string) =>
    `/api/dossiers/${id}/justificatifs/${docId}`,                  // US-5.3 (PATCH)
} as const;
```

---

## 5. Back — `features/cases/`

### 5.1 `server/database/repositories.ts`

`CaseFileRepository` (+ méthodes, toutes scopées `userId`, `deletedAt: null`) :

```ts
/** US-5.4 — liste + résumé en une passe (décision #12). */
listWithSummaryForUser(): Promise<{ cases: CaseFileListRow[]; summary: DashboardSummaryRow }>
// 1 requête findMany (cases actifs+terminés, include léger : actionItems { select: done }, pas le
//   graphe complet — jamais extractedInfos/documents ici, US-5.4 n'en a pas besoin) ;
// 1 requête count/aggregate pour deadlineWithin7DaysCount (where: status != TERMINE,
//   mainDeadline between now and now+7d) ;
// 1 requête findMany limitée à 5, orderBy lastActivityAt desc (proxy d'"analyzedAt", pas de colonne
//   dédiée), where analysisStatus = TERMINEE, pour recentAnalyses ;
// 1 requête notifications.findMany (userId, take ~10, orderBy createdAt desc).

/** US-5.1 AC2 — change le statut ; verrouille "status" si en dehors de l'auto-transition. */
updateStatusForUser(id, status: CaseStatus): Promise<{ from: CaseStatus }>

/** US-5.5 — cascade complète (décision #10). Renvoie les storagePath à purger sur disque. */
deleteForUser(id): Promise<{ storagePaths: string[] }>
```

`ActionItemRepository` (nouveau, `LinkedRepository`) :

```ts
/** US-5.2 AC2 — création manuelle, origin: "MANUEL", position = max(position)+1. */
createForUser(caseFileId, data: CreateActionInput): Promise<ActionItem>

/** US-5.2 AC1 — toggle done ; done=true fixe doneAt=now, done=false le remet à null. 404 si hors scope. */
updateForUser(caseFileId, actionId, data: { done: boolean }): Promise<ActionItem>

/** US-5.2 AC3 — suppression définitive (pas de soft-delete pour une sous-ligne). 404 si hors scope. */
deleteForUser(caseFileId, actionId): Promise<void>
```

`RequiredDocumentRepository` (nouveau, `LinkedRepository`) :

```ts
/** US-5.3 AC1/AC2 — provided et/ou userNote (au moins un, garanti par le schéma). 404 si hors scope. */
updateForUser(caseFileId, docId, data: { provided?: boolean; userNote?: string | null }): Promise<RequiredDocument>
```

### 5.2 `features/cases/cases.service.ts` (+ fonctions)

```ts
listCasesWithSummary(db): Promise<CaseFileListResponse>
//  const { cases, summary } = await db.caseFiles.listWithSummaryForUser();
//  return toCaseListDto(cases, summary);

updateCaseStatus(db, caseFileId, input): Promise<void>
//  const { from } = await db.caseFiles.updateStatusForUser(caseFileId, input.status);
//  if (from !== input.status)
//    await db.auditEvents.record({ caseFileId, eventType: "case.status_changed",
//                                 metadata: { from, to: input.status } });

createAction(db, caseFileId, input): Promise<{ id: string }>
//  const action = await db.actionItems.createForUser(caseFileId, input);
//  return { id: action.id };  // pas d'AuditEvent dédié — voir remarque §5.3

toggleAction(db, caseFileId, actionId, input): Promise<void>
//  const action = await db.actionItems.updateForUser(caseFileId, actionId, input);
//  await db.auditEvents.record({ caseFileId,
//    eventType: input.done ? "action.completed" : "action.reopened", metadata: { actionId } });

deleteAction(db, caseFileId, actionId): Promise<void>
//  await db.actionItems.deleteForUser(caseFileId, actionId);
//  await db.auditEvents.record({ caseFileId, eventType: "action.deleted", metadata: { actionId } });
//  // "action.deleted" à AJOUTER à history-label.ts (absent de la liste E4 — oubli à corriger).

updateRequiredDocument(db, caseFileId, docId, input): Promise<void>
//  await db.requiredDocs.updateForUser(caseFileId, docId, input);
//  // Pas d'AuditEvent : aucune AC US-5.3 ne demande de journalisation pour la checklist.

deleteCase(db, caseFileId): Promise<void>
//  const { storagePaths } = await db.caseFiles.deleteForUser(caseFileId);
//    // deleteForUser crée l'AuditEvent "case.deleted" AVANT de supprimer (décision #10) ; ce qui
//    // suit est post-transaction, best-effort.
//  await Promise.all(storagePaths.map((p) => storage.deleteDocument(p).catch(() => {})));
```

### 5.3 `features/cases/cases.mapper.ts` (+ fonctions)

```ts
/** US-5.4 — DTO liste + résumé. Aucun contenu de courrier (pas de sourceExcerpt/extractedText ici). */
export function toCaseListDto(cases: CaseFileListRow[], summary: DashboardSummaryRow): CaseFileListResponse
```

`toCaseResultDto` (existant, E4) — modifications :

- Ajoute `status` au niveau racine du DTO (consommé par écran 05 en badge et écran 06 en sélecteur).
- `actions[]` : ajoute `origin`, `description` ; `verifiable` devient
  `action.sourceExcerpt != null ? isLiteralExcerpt(action.sourceExcerpt, extractedText) : null`
  (décision #8) — **jamais** `false` par défaut pour une action `MANUEL`.
- `requiredDocuments[]` : ajoute `userNote`.

`toCaseStatusDto` (E3, polling écran 04) **reste inchangé** : `{id, analysisStatus}` — le polling
d'attente n'a pas besoin du statut de pilotage, l'ajouter alourdirait un appel toutes les 2s pour un
champ jamais lu à cet écran.

`history-label.ts` — un ajout, oublié en E4, à corriger au passage :

| `eventType` | Libellé FR |
|---|---|
| `action.deleted` | Action supprimée *(absent de la table E4 — complète la paire completed/reopened)* |

### 5.4 `features/cases/cases.routes.ts` (+ routes)

| Méthode / chemin | US | Body (Zod) | Réponse |
|---|---|---|---|
| `GET /api/dossiers` | 5.4 | — | `200 CaseFileListResponse` |
| `PATCH /api/dossiers/:id/statut` | 5.1 AC2 | `UpdateCaseStatusInputSchema` | `200 { ok:true }` · `404` |
| `POST /api/dossiers/:id/actions` | 5.2 AC2 | `CreateActionInputSchema` | `201 { id }` · `404` |
| `PATCH /api/dossiers/:id/actions/:actionId` | 5.2 AC1 | `UpdateActionInputSchema` | `200 { ok:true }` · `404` |
| `DELETE /api/dossiers/:id/actions/:actionId` | 5.2 AC3 | — | `200 { ok:true }` · `404` |
| `PATCH /api/dossiers/:id/justificatifs/:docId` | 5.3 AC1/AC2 | `UpdateRequiredDocInputSchema` | `200 { ok:true }` · `400` · `404` |
| `DELETE /api/dossiers/:id` | 5.5 | — | `200 { ok:true }` · `404` |

- `params` pour les routes `/actions/:actionId` et `/justificatifs/:docId` :
  `z.object({ id: z.string().uuid(), actionId/docId: z.string().uuid() })`, gabarit
  `IdInfoParamsSchema` (E4).
- `GET /api/dossiers` : **pas** de `RATE_LIMITS.analysis` (lecture d'écran, comme les autres `GET`
  de `cases.routes.ts`). Tous les `PATCH`/`POST`/`DELETE` : `config: RATE_LIMITS.analysis` — reprise
  du préset existant (nommé « analysis » mais déjà utilisé comme préset générique d'écriture
  authentifiée depuis E4, pas la peine d'en créer un nouveau pour six routes de plus).
- `DELETE /api/dossiers/:id` : **aucune confirmation côté serveur** au-delà de l'appel DELETE
  lui-même (la confirmation explicite, US-5.5 AC1, est une responsabilité **front**, cf. §6).

### 5.5 `features/cases/cases.dto.ts`

Re-export des nouveaux schémas/consts (`CaseStatusSchema`, `UpdateCaseStatusInputSchema`,
`CreateActionInputSchema`, `UpdateActionInputSchema`, `UpdateRequiredDocInputSchema`,
`CaseFileListResponseSchema`, `DashboardSummarySchema`).

### 5.6 `server/database/analysis-store.ts` (garde ré-analyse étendue)

```ts
// Statut conditionnel (décision #4) :
if (!locked.has("status")) {
  data.status = result.actions.length > 0 ? "ACTION_REQUISE" : "TERMINE"
  /* dossier déjà avancé manuellement (ex. "EN_ATTENTE") puis ré-analysé : couvert par le verrou
     userLockedFields si l'utilisateur a changé le statut lui-même ; sinon une ré-analyse peut
     ramener un dossier à ACTION_REQUISE/TERMINE, cohérent avec "la ré-analyse reflète le dernier
     résultat connu" tant que rien n'a été figé à la main. */
}

// ActionItem : protection décision #5 — ne supprime que ce qui est sûr de pouvoir être remplacé.
await tx.actionItem.deleteMany({
  where: { caseFileId, origin: "ANALYSE", done: false },
});
// RequiredDocument : idem, décision #5.
await tx.requiredDocument.deleteMany({
  where: { caseFileId, provided: false, userNote: null },
});
```

`server/queues`/`worker/analysis.ts` (extension, décision #7) : au point d'appel de
`recordAnalysisEvent({ eventType: "analysis.completed" | "analysis.failed", ... })`, ajouter la
création d'une `Notification` correspondante (`type: ANALYSE_TERMINEE`/`ANALYSE_ECHEC`, `title`/
`body` courts et génériques — jamais de contenu de courrier, même contrainte que `AuditEvent`).

---

## 6. Frontend — deux écrans (`/dossiers/[id]` inchangé + `/dossiers/[id]/pilotage` nouveau)

### 6.1 `front/src/lib/api/cases.ts` (+)

```ts
listCases(cookieHeader?): Promise<CaseFileListResponse>              // GET list.path
updateCaseStatus(id, body: UpdateCaseStatusInput): Promise<{ ok: true }>       // PATCH status.path
createAction(id, body: CreateActionInput): Promise<{ id: string }>            // POST actions.path
toggleAction(id, actionId, body: UpdateActionInput): Promise<{ ok: true }>    // PATCH action.path
deleteAction(id, actionId): Promise<{ ok: true }>                             // DELETE action.path
updateRequiredDoc(id, docId, body: UpdateRequiredDocInput): Promise<{ ok: true }> // PATCH requiredDoc.path
deleteCase(id): Promise<{ ok: true }>                                         // DELETE detail.path
```

`getCaseResult` (E4, existant) est **réutilisé tel quel** par les deux pages (décision de cadre §1) :
un seul point d'entrée réseau, chaque page choisit les sections du DTO qu'elle affiche.

### 6.2 `front/src/app/(app)/dossiers/[id]/page.tsx` (écran 05, inchangé dans sa structure)

Ajouts minimes : le badge de statut du header (aujourd'hui un texte fixe « À faire », commentaire
« gestion du cycle de vie = E5 ») devient **dynamique** (`data.status`, libellé FR, non cliquable —
la modification se fait sur l'écran 06) ; un lien « Piloter ce dossier » → `/dossiers/[id]/pilotage`
apparaît à côté. Les listes d'actions/justificatifs **restent en lecture seule**, comme documenté
dans le code E4 (`ActionsList` : « lecture seule en E4 — le cochage est US-5.2 »**, toujours vrai sur
cet écran, faux seulement sur l'écran 06**).

### 6.3 `front/src/app/(app)/dossiers/[id]/pilotage/page.tsx` (écran 06, NOUVEAU)

```tsx
export default async function PilotagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = await readCookieHeader();
  const data = await getCaseResult(id, cookieHeader);  // même endpoint que l'écran 05 ; 404/409 gérés pareil
  return <CasePilotage data={data} caseFileId={id} />;
}
```

`metadata` : titre « Pilotage du dossier — CapClair ».

`CasePilotage` (orchestrateur, nouveau) : en-tête (titre, lien retour « Voir le résultat de
l'analyse » → `/dossiers/[id]`), `CaseStatusSelect`, `PilotageActionsList`,
`PilotageRequiredDocsList`, `DeleteCaseDialog` en pied de page. Ordre libre (aucune AC n'impose de
séquence de lecture sur cet écran, contrairement à US-4.1 AC1 sur l'écran 05).

### 6.4 Arborescence `front/src/components/dashboard/` (nouveau, US-5.4)

```
dashboard/
  empty-dashboard.tsx        AC3 — écran d'accueil expliquant la première étape (CTA import)
  dashboard-summary-tiles.tsx AC1 — dossiers actifs / échéance <7j / actions restantes /
                              5 dernières analyses / notifications récentes
  case-file-list.tsx         liste des dossiers (tuile par dossier), lien vers /dossiers/[id]
  case-file-tile.tsx         titre, organisme, statut (CaseStatusBadge), progression actions
```

### 6.5 Arborescence `front/src/components/cases/pilotage/` (nouveau, écran 06 — décision #14)

```
cases/pilotage/
  case-pilotage.tsx           orchestrateur de l'écran 06
  case-status-select.tsx      US-5.1 AC2 — sélecteur de statut, submit → updateCaseStatus →
                               router.refresh(). 6 libellés FR (mapping décision #1).
  pilotage-actions-list.tsx   US-5.2 AC1/AC4 — cases RÉELLEMENT cochables, mise à jour optimiste
                               locale + router.refresh() en arrière-plan ("sans rechargement").
                               Compteur de progression (terminées/total, arrondi entier).
  action-add-form.tsx         US-5.2 AC2 — formulaire inline (titre, description, échéance
                               facultative), gabarit info-edit-form.tsx (E4)
  action-delete-button.tsx    US-5.2 AC3 — confirmation légère puis deleteAction → router.refresh()
  pilotage-required-docs-list.tsx  US-5.3 AC1/AC2/AC3 — cases cochables + champ note (TextField
                               existant, 500 car. max côté contrat) + compteur "X sur Y prêts"
  delete-case-dialog.tsx      US-5.5 AC1 — confirmation explicite mentionnant l'irréversibilité,
                               double étape (bouton "Supprimer" → panneau de confirmation avec le
                               texte ANALYSIS_MESSAGES.deleteConfirmationRequired → deuxième clic)
```

`cases/actions-list.tsx` et `cases/required-docs-list.tsx` (E4, écran 05) **ne changent pas** — la
version interactive vit exclusivement sous `cases/pilotage/` (décision #14), pour ne jamais risquer
de rendre l'écran 05 accidentellement interactif.

### 6.6 Responsive & a11y

- `CaseStatusSelect` : `<select>` natif (pas de `<Combobox>` custom — aucune primitive de ce genre
  n'existe encore dans `components/ui/`, et un `<select>` natif est accessible par défaut). 6 options.
- Cases à cocher (actions/justificatifs) : réutilise `checkbox-field.tsx` existant ; cible ≥ 44 px
  déjà garantie par le composant.
- `delete-case-dialog.tsx` : pas de `<dialog>`/modal générique existant dans `components/ui/` — à
  construire en composant local pour E5 (panneau inline avec `aria-live="assertive"` sur le message
  d'irréversibilité, focus renvoyé sur le bouton d'annulation à l'ouverture), **pas** un nouveau
  composant `ui/dialog.tsx` générique tant qu'un deuxième besoin ne le justifie pas (même choix que
  `deadline-edit-dialog.tsx` en E4, qui n'est pas non plus un vrai dialog modal).
- Tableau de bord : `DashboardSummaryTiles` — chaque compteur porte un `<h2>`/label textuel, jamais
  seulement une grosse icône ou un chiffre nu (cohérent avec la règle « jamais la couleur/icône
  seule », déjà appliquée à `ConfidenceBadge` en E4).
- Navigation entre écrans 05/06 : lien texte explicite dans les deux sens (« Piloter ce dossier » /
  « Voir le résultat de l'analyse »), jamais une icône seule — cohérent avec le reste du produit.

### 6.7 Fidélité Figma

**Bloquant avant merge des PR front (6.4/6.5) : node-ids Hi-Fi des écrans 2 (tableau de bord) et 6
(pilotage) à fournir par l'utilisateur** (clic droit sur le frame → Copy link), comme pour E4. En
attendant : `04-maquettes/wireframes.html` §Screen 2 / §Screen 6, `04-maquettes/design-system.md`.
L'écran 6 du wireframe montre les 6 statuts tels quels (cohérent avec la décision #1) et regroupe
US-4.5 avec le pilotage (écart assumé §2 décision #13 : l'historique reste sur l'écran 05). Lancer
`figma-fidelity-review` sur les deux écrans une fois les node-ids fournis, avant de considérer
PR-D/PR-E terminées.

---

## 7. Tests

### 7.1 Unitaires (`src/**/*.test.ts`, projet `unit`)

- `features/cases/cases.mapper.test.ts` (extension) : `toCaseResultDto` — `status` propagé tel
  quel dans le DTO ; action `origin: MANUEL` avec `sourceExcerpt: null` → `verifiable: null`, pas de
  crash `isLiteralExcerpt` sur `null` ; action `origin: ANALYSE` inchangée (verifiable calculé comme
  avant, régression E4) ; `requiredDocuments` porte `userNote`.
- `features/cases/cases.mapper.test.ts` (nouveau bloc) : `toCaseListDto` — compteurs corrects sur un
  jeu de dossiers mixte (actifs/terminés, avec/sans échéance < 7j, actions cochées/non cochées) ;
  `recentAnalyses` plafonné à 5 même avec plus de dossiers `TERMINEE`.
- `features/cases/history-label.test.ts` (extension) : `action.deleted` → libellé FR ; toujours
  aucun eventType technique brut.

### 7.2 Intégration back (`test/integration/**`, Postgres `_test`, `truncateAll`, 1 IP par fichier)

- `cases.status.test.ts` : `PATCH …/statut` → `200`, `GET …/resultat` reflète le nouveau `status` ;
  `AuditEvent` `case.status_changed` avec `{from, to}` corrects ; statut identique en entrée →
  **aucun** `AuditEvent` créé (pas de bruit journal) ; les 6 valeurs acceptées, une valeur hors enum
  → `400` (validation Zod) ; `404` cross-compte.
- `cases.auto-status.test.ts` : ré-analyse (`runAnalysisJob` mocké, gabarit `analysis.worker.test.ts`)
  d'un dossier avec ≥ 1 action → `status: ACTION_REQUISE` ; avec 0 action → `status: TERMINE` ;
  dossier dont le statut a été changé à la main (`userLockedFields` contient `"status"`) → ré-analyse
  ne l'écrase **pas**, quel que soit le nombre d'actions produites (US-4.4 AC3 étendu, décision #4).
- `cases.actions.test.ts` : `POST …/actions` → `201`, `origin: "MANUEL"`, `sourceExcerpt: null` en
  sortie de `GET …/resultat` ; `PATCH …/actions/:id { done: true }` → `200`, `doneAt` renseigné,
  `AuditEvent action.completed` ; `{ done: false }` → `doneAt: null`, `action.reopened` ; `DELETE` →
  action absente du prochain `GET …/resultat`, `AuditEvent action.deleted` ; `actionId` d'un autre
  dossier/compte → `404` pour les trois verbes.
- `cases.actions-survive-reanalysis.test.ts` (**cœur du risque 9.6/E3**) : coche une action IA, en
  ajoute une manuelle, relance l'analyse (mock produisant un jeu d'actions différent) → l'action
  cochée ET l'action manuelle sont **toutes deux** encore présentes après ré-analyse ; les actions
  IA non cochées de l'ancien résultat ont bien disparu, remplacées par les nouvelles.
- `cases.required-docs.test.ts` : `PATCH …/justificatifs/:id { provided: true }` → `200`, reflété en
  lecture ; `{ userNote: "..." }` (500 car. max, `501` chars → `400`) ; ré-analyse ne supprime pas un
  justificatif `provided: true` ou avec une note (même gabarit que `actions-survive-reanalysis`).
- `cases.list.test.ts` (US-5.4) : `GET /api/dossiers` → `200 CaseFileListResponseSchema.parse` OK ;
  compteurs vérifiés sur un jeu de données construit (2 actifs, 1 terminé, 1 avec échéance à J+3,
  1 à J+10 → `deadlineWithin7DaysCount = 1`) ; `recentAnalyses` reflète l'ordre `lastActivityAt desc` ;
  `recentNotifications` reflète les lignes écrites par le worker (décision #7) ; liste vide pour un
  compte sans dossier ; **aucune fuite cross-compte** (dossiers/notifications d'un autre compte
  absents).
- `analysis.worker.test.ts` (extension, décision #7) : après `runAnalysisJob` réussi, une
  `Notification type: ANALYSE_TERMINEE` existe pour le dossier ; après échec, `ANALYSE_ECHEC`.
- `cases.delete.test.ts` (US-5.5 — le plus critique de la PR-E) : `DELETE /api/dossiers/:id` sur un
  dossier `TERMINEE` complet (documents, infos, actions, justificatifs, brouillon, au moins un
  `Reminder`/`Notification` seedés) → `200` ; **assertions d'absence de ligne orpheline** :
  `prisma.document/extractedInformation/actionItem/requiredDocument/responseDraft/reminder/
  notification.findMany({ where: { caseFileId } })` tous vides ; **exception documentée** :
  `prisma.auditEvent.findMany({ where: { caseFileId: null, eventType: "case.deleted" } })` contient
  exactement 1 ligne (AC4) ; les `AuditEvent` antérieurs du dossier (`information.corrected`, etc.)
  ont disparu (pas seulement orphelins) ; fichier(s) sur disque absents
  (`fs.existsSync(storagePath)` → `false`) ; `404` cross-compte, `404` id inconnu.

### 7.3 Front (`front/src/**/*.test.tsx`, RTL)

- `case-status-select.test.tsx` : les 6 statuts listés, libellés FR corrects ; sélection →
  `updateCaseStatus` appelé avec le bon statut ; erreur API → message affiché.
- `pilotage-actions-list.test.tsx` : clic sur une case → `toggleAction` appelé, état visuel mis à
  jour immédiatement (pas d'attente réseau avant le changement visuel — AC "sans rechargement") ;
  compteur de progression correct (arrondi entier vérifié sur un cas non entier, ex. 1/3 → 33 %).
- `action-add-form.test.tsx` : soumission → `createAction` appelé avec `{ title, description?,
  dueDate? }` ; échéance facultative omise sans erreur.
- `pilotage-required-docs-list.test.tsx` : case cochable → `updateRequiredDoc` ; note saisie →
  soumise ; compteur « X sur Y prêts » correct.
- `delete-case-dialog.test.tsx` : premier clic ouvre la confirmation (pas d'appel API) ; le texte
  d'irréversibilité est présent ; deuxième clic → `deleteCase` appelé ; `Échap`/bouton annuler
  referme sans appel.
- `dossier-page.test.tsx` (extension E4) : le badge de statut affiche le libellé FR correspondant à
  `data.status` ; les listes d'actions/justificatifs restent non interactives sur cet écran (pas de
  `toggleAction`/`updateRequiredDoc` importés/appelés depuis cette page).
- `pilotage-page.test.tsx` : rendu à partir du même DTO que l'écran 05 (mock `getCaseResult`
  partagé) ; `409`/`404` gérés identiquement (même garde que l'écran 05, pas de logique dupliquée).
- `dashboard-page.test.tsx` : `listCases` vide → rend `<EmptyDashboard>` ; non vide → tuiles de
  résumé + liste ; bouton « Importer un courrier » présent dans le DOM sans dépendre du scroll
  (l'assertion de visibilité sans défilement reste hors de portée de jsdom — cf. réserve KAN-31/AC2,
  mémoire `jira-sync-e3` — seule la présence dans le markup est testée ici).

### 7.4 Hors portée automatisable (à documenter, pas à simuler)

US-5.4 AC5 (chargement < 1,5 s pour 20 dossiers) : pas de test Vitest fiable pour un budget de temps
réel. Mitigation : vérifier par la forme des requêtes (§5.1 — nombre de requêtes borné, pas de N+1
sur les `actionItems` par dossier) plutôt que par un chronomètre ; si une mesure réelle est demandée
plus tard, en discuter explicitement (même principe que les agents `corpus-validation-runner`/
`test-hygiene-review`, bornés pour ne jamais monter d'infra de mesure sans confirmation).

---

## 8. Risques

**8.1 Ré-analyse et perte d'état utilisateur (hérité du risque 9.6 du plan E3, maintenant central).**
Sans la protection décision #5, cocher une action ou une case justificatif serait perdu au premier
retry d'analyse. Mitigation : `origin`/protection dérivée en PR-A, **avant** toute UI interactive
(PR-B/C) — livrer l'UI cochable sans la protection serait pire que ne pas la livrer (l'utilisateur
perdrait confiance en cochant une case qui « revient » après un retry silencieux). Test dédié
`cases.actions-survive-reanalysis.test.ts`.

**8.2 Migration d'enum `CaseStatus` — risque de casse silencieuse ailleurs dans le code.**
Recréer le type Postgres (§3.2) et changer les littéraux TS cassent la compilation partout où
`"A_FAIRE"`/`"EN_ATTENTE_REPONSE"` sont utilisés en dur. Mitigation : recherche exhaustive avant
PR-A (§3.3) ; `tsc --noEmit` sur back **et** front (les fixtures/tests front peuvent aussi référencer
ces littéraux) fait partie de la definition of done de PR-A, pas seulement le back.

**8.3 Suppression définitive — fichiers orphelins sur disque en cas d'échec partiel.**
La suppression des fichiers (best-effort, hors transaction) peut échouer silencieusement
(`.catch(() => {})`, cohérent avec le reste du code E2/E4) alors que les lignes DB sont bien
supprimées. Un fichier orphelin sur disque est **préférable** à une ligne DB orpheline, mais reste
une dette : prévoir un job de nettoyage de `STORAGE_DIR` comparant aux `Document.storagePath`
connus — **hors périmètre E5**, à tracer comme dette pour E10 (déploiement/exploitation).

**8.4 `GET /api/dossiers` et la charge du tableau de bord.**
4 requêtes par chargement (décision #12) : acceptable pour un MVP à échelle personnelle (un seul
utilisateur par compte, dizaines de dossiers au plus), mais à revisiter si le produit grandit
(agrégation SQL unique via une vue ou des `COUNT` conditionnels dans une seule requête `$queryRaw`)
— prématuré tant que US-5.4 AC5 (< 1,5 s / 20 dossiers) n'est pas mesuré en conditions réelles
(§7.4).

**8.5 Action manuelle sans `sourceExcerpt` — cohérence avec l'écran 05 existant (US-4.2).**
`SourceExcerptDisclosure` (E4) suppose aujourd'hui toujours un `excerpt: string` nécessaire. Une
action `MANUEL` n'en a pas : le composant ne doit **pas** être rendu du tout pour ces lignes
(décision #8), plutôt que de le forcer avec une chaîne vide et lui faire afficher un message
« non vérifiable » trompeur pour un contenu que l'utilisateur a lui-même saisi. Mitigation : le
composant qui rend une action teste `action.sourceExcerpt != null` avant de rendre
`<SourceExcerptDisclosure>` — pertinent sur l'écran 05 (lecture seule, affiche quand même les
actions manuelles ajoutées sur l'écran 06) autant que sur `pilotage-actions-list.tsx`. Test dédié
(§7.3).

**8.6 `Notification` nouvellement alimentée — volume et bruit.**
Un utilisateur qui importe plusieurs courriers d'affilée verra sa liste de notifications grossir
sans mécanisme de purge (contrairement à `AuditEvent`, purgé avec le dossier). Mitigation : hors
périmètre strict d'US-5.4 (qui ne demande qu'un affichage des notifications « récentes », pas leur
cycle de vie complet), mais à signaler en revue de PR-D — une purge/passage à `read: true` groupé
pourra suivre en E7 ou en epic de maintenance, pas à inventer ici sans AC qui le demande.

**8.7 Régression sur `cases.reanalyze-preserves-corrections.test.ts` (E4).**
Le test existant vérifie que les corrections US-4.4 survivent à une ré-analyse ; la modification de
`applyAnalysis` (décision #4, #5) touche le même bloc de code. Mitigation : étendre ce test existant
plutôt que d'en écrire un nouveau isolé, pour garantir que les gardes E4 (organisme/title/
documentDate/mainDeadline verrouillés) et les nouvelles gardes E5 (status, actions, justificatifs)
coexistent dans le même scénario de ré-analyse.

**8.8 Deux écrans (05/06) qui divergent dans le temps.**
Le DTO `GET …/resultat` est désormais consommé par deux pages avec des besoins différents ; un futur
changement pensé pour l'un (ex. alléger le payload de l'écran 05) peut casser l'autre sans qu'on s'en
rende compte immédiatement (pas de erreur de compilation, juste un champ manquant à l'exécution).
Mitigation : `CaseFileResultResponseSchema` reste la source de vérité unique (Zod), toute PR qui la
modifie doit relire les deux pages consommatrices, pas seulement celle visée par le ticket.

---

## 9. Découpage en PR et livraison

Contrairement à E4 (découpage back → front → corrections, USs fortement couplées), les 5 USs d'E5
sont **largement indépendantes** une fois la protection anti-ré-analyse posée (PR-A) — un découpage
1 PR ≈ 1 US est donc plus lisible et permet de livrer/tester chaque US isolément.

### PR-A — Socle : statuts (6 valeurs) + protection anti-ré-analyse (back uniquement)
Satisfait **US-5.1** (back) et pose la fondation nécessaire à US-5.2/US-5.3 (protection).
Créer : migration `<ts>_e5_pilotage` · `back/test/integration/{cases.status,cases.auto-status}.test.ts`.
Modifier : `back/prisma/schema.prisma` · `contract/src/analysis.ts` (`CaseStatusSchema` 6 valeurs,
`UpdateCaseStatusInputSchema`, `LOCKABLE_FIELDS`, `status` dans `CaseFileResultResponseSchema`) ·
`back/src/features/cases/{cases.routes.ts,cases.service.ts,cases.mapper.ts,cases.dto.ts,
history-label.ts}` · `back/src/server/database/{repositories.ts,analysis-store.ts}` ·
`back/test/integration/cases.reanalyze-preserves-corrections.test.ts` (extension, risque 8.7).
**Definition of done supplémentaire (risque 8.2) : `tsc --noEmit` vert sur back ET front, pas
seulement back.**
**Estimation : ~7 pts-équiv** (US-5.1 = 5 pts Jira + le socle de protection, transversal).

### PR-B — Actions : cocher, ajouter, supprimer (US-5.2) + écran 06 (amorce)
Créer : `back/test/integration/{cases.actions,cases.actions-survive-reanalysis}.test.ts` ·
`front/src/app/(app)/dossiers/[id]/pilotage/page.tsx` (amorce de l'écran 06 — statut + actions
seulement, PR-C complète la checklist) · `front/src/components/cases/pilotage/{case-pilotage,
case-status-select,pilotage-actions-list,action-add-form,action-delete-button}.tsx` + tests.
Modifier : `back/src/features/cases/{cases.routes.ts,cases.service.ts,cases.dto.ts}` ·
`back/src/server/database/repositories.ts` (`ActionItemRepository`) · `contract/src/{analysis.ts,
paths.ts}` · `front/src/lib/api/cases.ts` · `front/src/app/(app)/dossiers/[id]/page.tsx` (badge
statut dynamique + lien vers l'écran 06).
**Prérequis : PR-A mergée.** **Estimation : 7 pts** (5 pts Jira US-5.2 + l'amorce de l'écran 06,
portée une fois pour toutes par cette PR plutôt que dupliquée dans PR-C/E).

### PR-C — Checklist des justificatifs (US-5.3)
Créer : `back/test/integration/cases.required-docs.test.ts` ·
`front/src/components/cases/pilotage/pilotage-required-docs-list.tsx` + test.
Modifier : `back/src/features/cases/{cases.routes.ts,cases.service.ts,cases.dto.ts,cases.mapper.ts}` ·
`back/src/server/database/repositories.ts` (`RequiredDocumentRepository`) · `contract/src/{analysis.ts,
paths.ts}` · `front/src/lib/api/cases.ts` · `front/src/components/cases/pilotage/case-pilotage.tsx`
(intègre la checklist à l'écran 06 amorcé en PR-B).
**Prérequis : PR-A + PR-B mergées** (protection décision #5 + page pilotage déjà en place).
**Estimation : 3 pts.**

### PR-D — Tableau de bord (US-5.4)
Créer : `back/test/integration/cases.list.test.ts` · `back/src/features/cases/cases.mapper.test.ts`
(bloc `toCaseListDto`) · `front/src/components/dashboard/*` + tests.
Modifier : `back/src/features/cases/{cases.routes.ts,cases.service.ts,cases.mapper.ts,cases.dto.ts}` ·
`back/src/server/database/repositories.ts` (`listWithSummaryForUser`) ·
`back/src/server/database/analysis-store.ts` / `worker/analysis.ts` (écriture `Notification` sur
`analysis.completed`/`analysis.failed`, décision #7) · `contract/src/{analysis.ts,paths.ts}` ·
`front/src/lib/api/cases.ts` · `front/src/app/(app)/dashboard/page.tsx` (remplace le stub).
**Prérequis : PR-A mergée** (peut se paralléliser avec PR-B/C). **Estimation : 5 pts.**

### PR-E — Suppression définitive (US-5.5)
Créer : `back/test/integration/cases.delete.test.ts` (le plus long de l'epic, §7.2) ·
`front/src/components/cases/pilotage/delete-case-dialog.tsx` + test.
Modifier : `back/prisma/schema.prisma` (relation `Notification.caseFileId`, incluse dans la migration
PR-A si PR-E est livrée en même sprint — sinon deuxième migration additive) ·
`back/src/features/cases/{cases.routes.ts,cases.service.ts}` ·
`back/src/server/database/repositories.ts` (`deleteForUser`) · `front/src/lib/api/cases.ts` ·
`front/src/components/cases/pilotage/case-pilotage.tsx` (bouton de suppression en pied d'écran 06).
**Prérequis : PR-A + PR-B mergées** (écran 06 doit exister pour y placer le bouton).
**Estimation : 4 pts-équiv** (3 pts Jira + le poids du test d'absence de ligne orpheline).

### Ordre de livraison

`PR-A` d'abord, obligatoire. `PR-B` ensuite (amorce l'écran 06, prérequis de C et E). `PR-C`, `PR-D`,
`PR-E` peuvent ensuite se paralléliser (`PR-D` est même indépendante de B/C, seule PR-A la
concerne). Nœuds Hi-Fi Figma (écrans 2 et 6) à obtenir avant de finaliser les PR front (D et
B/C/E en particulier — dashboard et pilotage quasi entièrement visuels).
Total : **~26 pts-équiv** (24 pts Jira + le poids transversal de la protection anti-ré-analyse et de
l'amorce d'écran, absorbés respectivement dans PR-A et PR-B plutôt que comptés à part).

---

## 10. Fichiers les plus critiques

- `07-developpement/back/src/server/database/analysis-store.ts` — `applyAnalysis` : statut
  conditionnel (décision #4) et protection `ActionItem`/`RequiredDocument` (décision #5). Le point
  le plus sensible du plan : une régression ici réintroduit silencieusement le risque 9.6 d'E3.
- `07-developpement/back/prisma/schema.prisma` — `CaseStatus` (6 valeurs, décision #1),
  `ActionOrigin`, nullabilité de `ActionItem.sourceExcerpt`, `Notification.caseFileId` (`Cascade`) :
  quatre changements de modèle qui touchent des invariants déjà établis en E3/E4 (à revoir avec
  attention en PR-A) ou qui recréent un type Postgres existant (risque 8.2).
- `07-developpement/back/src/server/database/repositories.ts` — `deleteForUser` (US-5.5, cascade +
  ordre des opérations pour préserver exactement un `AuditEvent`) et `listWithSummaryForUser`
  (US-5.4, forme des requêtes du tableau de bord).
- `07-developpement/contract/src/analysis.ts` — `CaseStatusSchema` (décision #1, 6 statuts figés),
  `DashboardSummarySchema`/`CaseFileListResponseSchema` (contrat du tableau de bord), `status` ajouté
  à `CaseFileResultResponseSchema` (partagé par les deux écrans, risque 8.8).
- `07-developpement/front/src/app/(app)/dossiers/[id]/pilotage/page.tsx` +
  `07-developpement/front/src/components/cases/pilotage/case-pilotage.tsx` — le nouvel écran 06,
  seul endroit interactif du dossier (décision #2/#14) ; toute confusion avec l'écran 05 (lecture
  seule) serait une régression du contrat US-4.1.
- `07-developpement/back/test/integration/cases.actions-survive-reanalysis.test.ts` — le test qui
  prouve (ou infirme) que le risque central de ce plan (8.1) est effectivement couvert.
