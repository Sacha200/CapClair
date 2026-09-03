# Plan d'implémentation — Epic E4 « Consultation et vérification du dossier »

Statut : **décisions §2 verrouillées** (revue 2026-09-03) — prêt pour PR-A ·
Prérequis : **E1 (auth) + E2 (import/lecture) + E3 (consentement + analyse IA)** fusionnés sur `main`
(le graphe `CaseFile → ExtractedInformation / ActionItem / RequiredDocument / ResponseDraft` est
peuplé par le worker E3 ; `AnalysisStatus.TERMINEE` est l'état d'entrée d'E4).

Écarts anticipés (vs une lecture littérale des US) :

- **GET riche = nouvel endpoint `GET /api/dossiers/:id/resultat`**, pas un enrichissement de
  `GET /api/dossiers/:id` (qui reste le statut nu, polling écran 04, sans preset serré — cf.
  `cases.status.test.ts`). `resultat` répond `200` seulement si `TERMINEE`, sinon `409`.
- **US-4.2 « non vérifiable » = calculé à la lecture** (mapper `features/cases`), **non persisté** →
  rétro-remplit gratuitement les dossiers E3, aucune migration pour ce champ. Seule migration E4 :
  `CaseFile.userLockedFields String[]`.
- **US-4.4 AC5 (reprogrammation des rappels)** : `Reminder` n'est jamais alimenté avant E7/US-7.1.
  E4 recalcule et écrit la date côté serveur ; la reprogrammation des rappels est un **hook
  documenté et différé** (`remindersService.rescheduleForCaseFile`, no-op jusqu'à E7). AC5 est donc
  satisfait à moitié — à acter avec le PO.
- **US-4.4 AC1 (organisme, type éditables)** : `organisme` et `type de courrier` sont des colonnes de
  `CaseFile` (E3 décision #5), pas des lignes `ExtractedInformation` → endpoint distinct
  `PATCH /api/dossiers/:id` (scalaires), en plus de `PATCH …/informations/:infoId`.
- **US-4.5 (historique)** sortie en **PR-D distincte**, livrable après PR-C et **droppable** si le
  sprint se resserre (priorité S).
- **Maquette** : le fichier Figma `ikpl3eoij9BEAwIYsfSLNO` ne contient qu'une page « Page 1 »
  étiquetée « Itération 2 · basse fidélité ». L'écran 05 existe (frame **`11:145` — « 05 — Résultat
  d'analyse »**, 1440×1024) mais **il n'y a pas de page « ✨ Hi-Fi »** visible dans le listing.
  Cf. memory `figma-fidelity` : `get_metadata` sans nodeId ne liste pas la page Hi-Fi même si elle
  existe. Le frame `11:145` **omet** le bandeau permanent (US-4.1 AC3) et le bandeau récapitulatif
  (US-4.3 AC3), ajoutés d'après les AC.
  **Le node-id Hi-Fi de l'écran 05 doit être fourni par l'utilisateur** (clic droit sur le frame →
  Copy link) avant la PR-B front ; en attendant, référence = `11:145` (basse fidélité) +
  `04-maquettes/wireframes.html` §Screen 5 + `04-maquettes/design-system.md`.

---

## 1. Cadre

- E4 hérite de tout E3. Les frontières d'E3 tiennent : **une seule frontière IA** (`server/ai/`),
  **une seule frontière file** (`server/queues/` + `worker/`). E4 n'appelle jamais l'IA et n'enfile
  jamais rien.
- E4 est **scopé `userId`** (contrairement au worker) : tout passe par `context.forUser()` /
  `repositories.ts` ; règle ESLint `no-restricted-syntax` — aucun `prisma.*` direct dans
  `features/**`. Le seul module hors scope qu'E4 modifie est `server/database/analysis-store.ts`
  (couche système, déjà autorisée à toucher Prisma) pour la garde `userLockedFields`.
- **D7** (doc archi §3) : dates/montants jamais calculés par l'IA, dérivés serveur. E4 applique ça à
  la **correction** : `PATCH …/echeance` revalide la date côté serveur avec la règle de cohérence de
  `lib/dates.ts` (échéance ≥ date du courrier, US-3.6 AC5) ; aucune valeur envoyée par le client
  n'est écrite sans contrôle.
- **D8** : l'analyse reste asynchrone. E4 ne fait que **lire** son résultat et l'écran 05 réutilise
  l'URL `/dossiers/[id]` (acté en-tête plan E3) : quand `analysisStatus === "TERMINEE"`, on affiche
  le résultat au lieu de l'écran d'attente.
- **D10** : `confidenceScore` stocké mais jamais affiché brut ; 3 niveaux (`FAIBLE|MOYEN|ELEVE`).
  Seul `FAIBLE` est mis en avant, mais US-4.3 AC2 impose un signal **texte** dès `MOYEN`.
- Module `features/cases/` existant (E3) : `cases.routes.ts`, `cases.service.ts`, `cases.mapper.ts`,
  `cases.dto.ts`, `index.ts`. E4 les étend, ne les réécrit pas.
- `lib/dates.ts` existant : `deriveDeadline`, `deriveDeadlineFromText`, `parseExplicitFrenchDate`,
  `resolveRelativeDelay`. E4 réutilise la règle de cohérence, n'ajoute rien de structurel.

## 2. Décisions à verrouiller

| # | Sujet | Décision | Alternative |
|---|---|---|---|
| 1 | Forme du GET riche | **Nouvel endpoint `GET /api/dossiers/:id/resultat`** — `200` + graphe complet si `analysisStatus === TERMINEE`, `409 { code:"analysis_not_ready", analysisStatus }` sinon, `404` si absent/autre compte. `GET /api/dossiers/:id` (statut nu) **inchangé** : reste la route de polling de l'écran 04 (pas de preset `RATE_LIMITS.analysis`, cf. `cases.status.test.ts`). | Enrichir `GET /api/dossiers/:id` avec le graphe (ou `?include=resultat`) — rejeté : alourdit chaque tick de polling (2 s) d'une requête à 5 jointures, et mélange deux contrats testés séparément |
| 2 | Impact sur le polling écran 04 | **Aucun changement de contrat**. Le server component tente `GET …/resultat` ; sur `409` il rend `<AnalysisWaiting>` (polling `detail` inchangé) ; au passage `done`, `AnalysisWaiting` déclenche `router.refresh()` → le server component re-fetch et bascule sur `<AnalysisResult>`. | Faire poller `…/resultat` directement — rejeté (charge), voir #1 |
| 3 | Vérification substring US-4.2 | **À la lecture, dans `cases.mapper.ts`** : `verifiable = isLiteralExcerpt(sourceExcerpt, Document.extractedText)` avec normalisation (NFD sans accents, minuscules, espaces/NBSP compactés, apostrophes typographiques `’→'`, guillemets). Vaut pour `ExtractedInformation`, `ActionItem`, `RequiredDocument`. | À l'analyse dans `worker/analysis.ts` / `server/ai/postprocess.ts` + persistance — rejeté : oblige un backfill des dossiers E3, et devient obsolète si `Document` est remplacé après analyse (E2 `replace`) |
| 4 | Rétro-remplissage des dossiers E3 | **Aucun backfill** : `verifiable` étant calculé à la lecture, tout dossier déjà `TERMINEE` est couvert dès le déploiement de PR-A. | Job de backfill unique — inutile avec #3 |
| 5 | Champ « non vérifiable » | **Calculé à la volée**, pas de colonne. Conséquence directe de #3 → **pas de champ `ExtractedInformation.verifiable`**. | `ExtractedInformation.verifiable Boolean` persisté — rejeté (staleness sur `replace`, backfill) |
| 6 | Abaissement de confiance si `!verifiable` (US-4.2 AC3) | **Dérivé serveur dans le mapper** : `confidenceLevel` du DTO = `FAIBLE` si `!verifiable` ; `ELEVE` si `isUserCorrected` (l'utilisateur a tranché) ; sinon `row.confidenceLevel`. La colonne `confidenceLevel` en base n'est pas modifiée. | Écrire `FAIBLE` en base à la lecture — rejeté : effet de bord dans un GET |
| 7 | Endpoint de correction d'une info | **`PATCH /api/dossiers/:id/informations/:infoId`**, body `{ value: string(1..500), label?: string(1..200) }`. Effets : `isUserCorrected = true`, valeur écrite, `AuditEvent` `information.corrected` (métadonnées = `{ infoId, categoryCode }`, **jamais la valeur**, US-8.2). `404` si l'info n'appartient pas au dossier/au compte. | Un seul PATCH générique sur le dossier avec un tableau de patches — rejeté : moins testable, pas de granularité 404 |
| 8 | Correction de l'échéance principale (US-4.4 AC5) | **`PATCH /api/dossiers/:id/echeance`**, body `{ date: "YYYY-MM-DD" }`. Serveur : rejette `date < documentDate` (`400 deadlineBeforeDocument`, règle US-3.6 AC5) ; écrit `mainDeadline`, `mainDeadlineConfidence = ELEVE`, `mainDeadlineType` conservé, `mainDeadlineSourceExcerpt = "Corrigée par vous"` ; ajoute `"mainDeadline"` à `userLockedFields` ; `AuditEvent` `deadline.corrected` ; appelle le hook `remindersService.rescheduleForCaseFile(id)` (**no-op documenté jusqu'à E7**). | Body `{ rawText }` re-passé dans `deriveDeadlineFromText` — gardé en alternative (utile si l'UI veut coller un délai) ; l'ISO explicite est plus simple et suffit à l'AC |
| 9 | Correction organisme / type de courrier (US-4.4 AC1) | **`PATCH /api/dossiers/:id`**, body `{ organisme?, title?, documentDate? }` (≥ 1 clé). Écrit les champs, les ajoute à `userLockedFields`, `AuditEvent` `case.updated`. | Étendre `…/informations/:infoId` à des « pseudo-infos » synthétiques — rejeté : complexe, non aligné sur le modèle |
| 10 | Protection contre la ré-analyse (US-4.4 AC3) | **Nouvelle colonne `CaseFile.userLockedFields String[] @default([])`**. Valeurs admises **figées par la constante `LOCKABLE_FIELDS` du contrat** (`["organisme","title","documentDate","mainDeadline"]` — union TS `LockableField` + garde runtime avant toute écriture, pour éviter une valeur poubelle sur faute de frappe). `analysis-store.ts::applyAnalysis` omet chaque champ listé. `ExtractedInformation.isUserCorrected` (déjà géré par `applyAnalysis`) reste le mécanisme pour les lignes d'info. | N booléens `*IsUserCorrected` — rejeté : 4 colonnes + 4 migrations à venir, un tableau + constante est extensible et presque aussi sûr typé |
| 11 | Aperçu du brouillon | DTO `responseDraft = { hasContent, preview }` — `preview` = 2 premières lignes non vides / ~200 caractères. « Ouvrir le brouillon complet » pointe vers `/dossiers/[id]/brouillon` (**route E6, stub désactivé en E4**). | Renvoyer `content` complet — rejeté : hors périmètre E4, et l'édition du brouillon est US-6.2 |
| 12 | US-4.5 dans E4 ou différée | **PR-D distincte**, livrée après PR-C, **droppable**. Auto-portante : humaniseur FR de `AuditEvent.eventType` + `GET /api/dossiers/:id/historique` + section front. AC3 (aucun contenu de document) déjà garantie par la façon dont `AuditEvent` est écrit (E3). | Fondre dans PR-C — rejeté : alourdit une PR déjà dense (édition + audit scopé) |
| 13 | `AuditEvent` scopé utilisateur | **Nouveau `AuditEventRepository`** (scopé `userId`) exposé par `context.forUser()` — `analysis-store.ts::recordAnalysisEvent` (système, worker) reste pour les événements d'analyse. | Réutiliser `recordAnalysisEvent` depuis `features/cases` — rejeté : contourne le scope `userId`, casse la règle ESLint |
| 14 | Ordre imposé US-4.1 vs maquette 2 colonnes | **L'ordre DOM/lecture/tabulation est toujours** échéance → résumé → actions → justificatifs → informations extraites → brouillon. Mobile 375 px : une colonne dans cet ordre, carte échéance en premier écran (AC2). Desktop ≥ `lg` : grille 2 colonnes **cosmétique** (`11:145` : infos + brouillon à droite) sans réordonner le DOM. | Suivre la maquette au pixel (2 col figées) — rejeté : casserait l'ordre de lecture exigé par l'AC1 |

---

## 3. Modèle de données et migration (PR-A)

### 3.1 `back/prisma/schema.prisma`

```prisma
model CaseFile {
  // ... champs existants inchangés ...

  /// US-4.4 AC3 — champs verrouillés par une correction manuelle : une ré-analyse
  /// ne les écrase plus. Valeurs : "organisme" | "title" | "documentDate" | "mainDeadline".
  /// Les lignes ExtractedInformation gardent leur propre flag `isUserCorrected`.
  userLockedFields String[] @default([])
}
```

Aucun autre modèle touché. `ExtractedInformation.isUserCorrected`, `ActionItem`, `RequiredDocument`,
`ResponseDraft`, `AuditEvent` sont déjà au bon niveau (schéma E2/E3).

### 3.2 Migration `back/prisma/migrations/<ts>_e4_result_and_corrections/migration.sql`

```sql
-- E4 — Consultation et vérification du dossier (ADR-018).
ALTER TABLE "CaseFile" ADD COLUMN "userLockedFields" TEXT[] NOT NULL DEFAULT '{}';
```

Pas de `ALTER TYPE`, pas de renommage, aucun `INSERT`/`UPDATE` : migration additive triviale, sûre
sur les lignes existantes (défaut `'{}'`). Générer via `prisma migrate dev --create-only`, relire.

### 3.3 Impacts

- `back/src/server/database/analysis-store.ts` : `applyAnalysis` lit `userLockedFields` (étendre le
  `select` du garde `exists`) et **omet conditionnellement** `organisme` / `title` / `documentDate` +
  `documentDateSourceExcerpt` / `mainDeadline*` du `data` de `tx.caseFile.update`.
- `back/test/helpers/factories.ts` `seedCaseGraph` : accepter `userLockedFields` (défaut `[]`) et un
  `Document.extractedText` maîtrisé (pour les tests substring US-4.2).
- `back/test/helpers/testDb.ts` `TABLES` : `AuditEvent` déjà tronqué ? sinon l'ajouter.
- Aucun usage TS existant de `userLockedFields` — pas de casse.

---

## 4. Contrat `@capclair/contract`

### 4.1 `contract/src/analysis.ts` (extensions)

```ts
/** US-4.1 AC3 — texte EXACT, source unique, repris tel quel par l'UI. */
export const RESULT_WARNING_BANNER =
  "Cette analyse est générée automatiquement à partir d'un document fictif. " +
  "Vérifiez les informations importantes avant toute utilisation." as const;

/** Niveau de confiance affiché — dérivé serveur (peut différer de la valeur stockée). */
export const DisplayConfidenceSchema = ConfianceIASchema; // "FAIBLE" | "MOYEN" | "ELEVE"

export const ResultInfoSchema = z.object({
  id: z.string().uuid(),
  categoryCode: CategorieInfoSchema,
  categoryLabel: z.string(),
  categoryIcon: z.string().nullable(),   // nom Remix Icon (table Category)
  label: z.string(),
  value: z.string(),
  sourceExcerpt: z.string(),
  verifiable: z.boolean(),               // US-4.2 : sous-chaîne littérale de Document.extractedText
  confidenceLevel: DisplayConfidenceSchema, // abaissé si !verifiable ; ELEVE si isUserCorrected
  isUserCorrected: z.boolean(),
});

export const ResultActionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  done: z.boolean(),
  position: z.number().int(),
  dueDate: z.string().datetime().nullable(),
  dueDateType: EcheanceTypeIASchema.nullable(),
  dueDateConfidence: DisplayConfidenceSchema.nullable(),
  dueDateSourceExcerpt: z.string().nullable(),
  sourceExcerpt: z.string(),
  verifiable: z.boolean(),
});

export const ResultRequiredDocSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  provided: z.boolean(),
  sourceExcerpt: z.string(),
  verifiable: z.boolean(),
});

export const ResultDeadlineSchema = z.object({
  date: z.string().datetime().nullable(),
  type: EcheanceTypeIASchema.nullable(),
  confidence: DisplayConfidenceSchema.nullable(),
  sourceExcerpt: z.string().nullable(),
  computedFromDelay: z.boolean(),  // type === "RELATIVE" → libellé « calculée à partir du délai indiqué »
  overdue: z.boolean(),            // date < aujourd'hui (serveur) → libellé « Échéance dépassée » (US-3.6 AC4)
  isUserCorrected: z.boolean(),
});

export const ResultDraftSchema = z.object({
  hasContent: z.boolean(),
  preview: z.string(),             // 2 premières lignes / ~200 car. — jamais tout le corps (E6)
});

export const CaseFileResultResponseSchema = z.object({
  id: z.string().uuid(),
  analysisStatus: z.literal("TERMINEE"),
  organisme: OrganismeIASchema,
  title: z.string(),               // « type de courrier »
  documentDate: z.string().datetime().nullable(),
  documentDateSourceExcerpt: z.string().nullable(),
  summary: z.string().nullable(),
  warnings: z.array(z.string()),   // CaseFile.warnings (E3) — voir risque 8.2
  mainDeadline: ResultDeadlineSchema.nullable(),
  actions: z.array(ResultActionSchema),
  requiredDocuments: z.array(ResultRequiredDocSchema),
  informations: z.array(ResultInfoSchema),
  infosToVerify: z.array(z.object({ id: z.string().uuid(), label: z.string() })), // US-4.3 AC3
  responseDraft: ResultDraftSchema.nullable(),
  lockedFields: z.array(z.string()), // "organisme" | "title" | "documentDate" | "mainDeadline"
});
export type CaseFileResultResponse = z.infer<typeof CaseFileResultResponseSchema>;

/** US-4.4 — correction d'une information extraite. */
export const UpdateExtractedInfoInputSchema = z.object({
  value: z.string().trim().min(1).max(500),
  label: z.string().trim().min(1).max(200).optional(),
});
export type UpdateExtractedInfoInput = z.infer<typeof UpdateExtractedInfoInputSchema>;

/** US-4.4 AC5 — correction de l'échéance principale (date de calendrier). */
export const UpdateMainDeadlineInputSchema = z.object({
  date: z.string().date(), // "YYYY-MM-DD" ; serveur : rejet si < documentDate (US-3.6 AC5)
});
export type UpdateMainDeadlineInput = z.infer<typeof UpdateMainDeadlineInputSchema>;

/** US-4.4 AC3 — seules valeurs admises dans `CaseFile.userLockedFields`. */
export const LOCKABLE_FIELDS = ["organisme", "title", "documentDate", "mainDeadline"] as const;
export type LockableField = (typeof LOCKABLE_FIELDS)[number];

/** US-4.4 AC1 — organisme / type / date du courrier. */
export const UpdateCaseScalarsInputSchema = z
  .object({
    organisme: OrganismeIASchema.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    documentDate: z.string().date().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Aucune modification fournie.",
  });
export type UpdateCaseScalarsInput = z.infer<typeof UpdateCaseScalarsInputSchema>;

/** PR-D — US-4.5. */
export const HistoryEntrySchema = z.object({
  id: z.string().uuid(),
  at: z.string().datetime(),
  label: z.string(),  // FR humanisé, jamais l'eventType technique (AC2)
});
export const CaseFileHistoryResponseSchema = z.object({
  entries: z.array(HistoryEntrySchema),
});
export type CaseFileHistoryResponse = z.infer<typeof CaseFileHistoryResponseSchema>;
```

`ANALYSIS_MESSAGES` (extensions) :

```ts
analysisNotReady: "L'analyse de ce dossier n'est pas encore terminée.",
deadlineBeforeDocument: "L'échéance ne peut pas précéder la date du courrier.",
nothingToUpdate: "Aucune modification fournie.",
```

### 4.2 `contract/src/paths.ts`

```ts
export const CASE_FILE_PATHS = {
  detail: (id: string) => `/api/dossiers/${id}`,
  consentAi: (id: string) => `/api/dossiers/${id}/consentement-ia`,
  analyze: (id: string) => `/api/dossiers/${id}/analyser`,
  // + E4
  result: (id: string) => `/api/dossiers/${id}/resultat`,
  updateInfo: (id: string, infoId: string) => `/api/dossiers/${id}/informations/${infoId}`,
  deadline: (id: string) => `/api/dossiers/${id}/echeance`,
  // scalaires : PATCH sur `detail`
  history: (id: string) => `/api/dossiers/${id}/historique`, // PR-D
} as const;
```

`contract/src/index.ts` inchangé (`export * from "./analysis.js"` couvre les ajouts). Rappel
ADR-003/007 : `npm run build --workspace @capclair/contract` avant back/front.

---

## 5. Back — `features/cases/`

### 5.1 `server/database/repositories.ts`

`CaseFileRepository` (+ méthodes, toutes scopées `userId`, `deletedAt: null`) :

```ts
/** Graphe complet pour l'écran 05. Lève NotFoundError si absent/autre compte. */
findResultForUser(id): Promise<CaseFileWithGraph>
// findFirst({ where:{ id, userId, deletedAt:null }, include:{
//   documents:  { orderBy:{createdAt:"desc"}, take:1, select:{ extractedText:true } },
//   extractedInfos: { include:{ category:true }, orderBy:{ createdAt:"asc" } },
//   actionItems:  { orderBy:{ position:"asc" } },
//   requiredDocs: { orderBy:{ createdAt:"asc" } },
//   responseDraft: true,
// }})

/** US-4.4 AC1 — organisme / type / date ; verrouille les champs touchés. */
updateScalarsForUser(id, data: { organisme?; title?; documentDate?: Date | null }):
  Promise<CaseFile>   // updateMany scopé + userLockedFields = union(existants, clés reçues)

/** US-4.4 AC5 — échéance corrigée ; verrouille "mainDeadline". */
setCorrectedDeadlineForUser(id, date: Date): Promise<CaseFile>
```

`ExtractedInformationRepository` (+) :

```ts
/** 404 si l'info n'est pas dans CE dossier de CE compte. */
updateForUser(caseFileId, infoId, data: { value: string; label?: string }):
  Promise<ExtractedInformation>
// findFirst({ where:{ id: infoId, caseFileId, caseFile: caseFileScope } }) → NotFound
// update({ data: { ...data, isUserCorrected: true } })
```

Nouveau `AuditEventRepository extends LinkedRepository` (+ `context.ts` : champ `auditEvents` dans
`UserScopedDb` et `forUser()`) :

```ts
record(data: { caseFileId: string; eventType: string; metadata?: Record<string, unknown> }):
  Promise<void>
// vérifie la propriété du dossier (findFirst scopé) puis prisma.auditEvent.create
// avec userId = this.userId ; metadata = compteurs/ids seulement (US-8.2)

listForCaseFileForUser(caseFileId): Promise<AuditEvent[]>   // PR-D, orderBy createdAt desc
```

### 5.2 `features/cases/cases.service.ts` (+ fonctions)

```ts
getCaseResult(db, caseFileId): Promise<CaseFileResultResponse>
//  const row = await db.caseFiles.findResultForUser(caseFileId);       // 404
//  if (row.analysisStatus !== "TERMINEE")
//     throw new AppError(409, ANALYSIS_MESSAGES.analysisNotReady,
//                        { code: "analysis_not_ready", analysisStatus: row.analysisStatus });
//  return toCaseResultDto(row, row.documents[0]?.extractedText ?? "");

correctInformation(db, caseFileId, infoId, input): Promise<void>
//  await db.extractedInfos.updateForUser(caseFileId, infoId, input);   // 404 granulaire
//  await db.auditEvents.record({ caseFileId, eventType: "information.corrected",
//                               metadata: { infoId, categoryCode: row.category.code } });

correctMainDeadline(db, caseFileId, input): Promise<void>
//  const cf = await db.caseFiles.findByIdForUser(caseFileId);
//  const date = parseIsoDate(input.date);
//  if (cf.documentDate && date < cf.documentDate)
//     throw new AppError(400, ANALYSIS_MESSAGES.deadlineBeforeDocument, { code: "deadline_before_document" });
//  await db.caseFiles.setCorrectedDeadlineForUser(caseFileId, date);
//  await db.auditEvents.record({ caseFileId, eventType: "deadline.corrected", metadata: {} });
//  await rescheduleForCaseFile(caseFileId);   // hook E7, no-op documenté

updateCaseScalars(db, caseFileId, input): Promise<void>
//  await db.caseFiles.updateScalarsForUser(caseFileId, { ...coerce(input) });
//  await db.auditEvents.record({ caseFileId, eventType: "case.updated",
//                               metadata: { fields: Object.keys(input) } });

getCaseHistory(db, caseFileId): Promise<CaseFileHistoryResponse>   // PR-D
```

Hook rappels (PR-C) : `back/src/features/reminders/reschedule.ts`

```ts
/** US-7.1 AC4 — reprogrammation après changement d'échéance.
 *  E7 non implémenté : no-op tracé. Le AuditEvent `deadline.corrected` permettra
 *  à E7 de rejouer les échéances corrigées lors de sa mise en place. */
export async function rescheduleForCaseFile(caseFileId: string): Promise<void> {
  logger.info({ caseFileId }, "rescheduleForCaseFile — différé (E7/US-7.1 non implémenté)");
}
```

### 5.3 `features/cases/cases.mapper.ts` (graphe → DTO)

```ts
/** US-4.2 AC2 — l'extrait doit être un passage LITTÉRAL du texte. */
export function normalizeForExcerptMatch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, " ").trim().toLowerCase();
}
export function isLiteralExcerpt(excerpt: string, sourceText: string): boolean {
  if (!excerpt || !sourceText) return false;
  return normalizeForExcerptMatch(sourceText).includes(normalizeForExcerptMatch(excerpt));
}

export function toCaseResultDto(row, extractedText): CaseFileResultResponse
```

Règles du mapper :

- `informations[]` : `verifiable = isLiteralExcerpt(row.sourceExcerpt, extractedText)` ;
  `confidenceLevel = row.isUserCorrected ? "ELEVE" : !verifiable ? "FAIBLE" : row.confidenceLevel` ;
  `categoryLabel/Icon` depuis `row.category`.
- `infosToVerify` = `informations` dont `confidenceLevel === "FAIBLE"` **et** `!isUserCorrected`
  (US-4.3 AC3) → alimente le bandeau récap.
- `mainDeadline.overdue = date != null && date < startOfTodayUTC()` (dérivé serveur, US-3.6 AC4) ;
  `computedFromDelay = type === "RELATIVE"` ; `isUserCorrected = lockedFields.includes("mainDeadline")`.
- `actions[] / requiredDocuments[]` : `verifiable` idem sur leur `sourceExcerpt`.
- `responseDraft` : `hasContent = !!draft?.content?.trim()` ;
  `preview` = 2 premières lignes non vides, tronquées à ~200 car. + `…`.
- **Le DTO ne contient jamais `Document.extractedText`** — seulement le booléen `verifiable`.
  Les `sourceExcerpt` (déjà des passages littéraux, vérifiés par l'IA en E3) sont légitimes sur
  l'écran 05, c'est l'objet même de US-4.2.
- `toCaseStatusDto` (existant) reste pour `GET /api/dossiers/:id`.

PR-D : `historyLabel(eventType, metadata): string` — table de correspondance FR (AC2, jamais le
code technique), fallback générique `"Modification du dossier"` :

| `eventType` | Libellé FR |
|---|---|
| `document.imported` | Courrier importé |
| `analysis.completed` | Analyse terminée |
| `analysis.failed` | L'analyse n'a pas abouti |
| `information.corrected` | Information corrigée |
| `deadline.corrected` | Échéance modifiée |
| `case.updated` | Détails du courrier modifiés |
| `case.status_changed` | Statut du dossier changé *(E5)* |
| `action.completed` / `action.reopened` | Action cochée / rouverte *(E5)* |
| `reminder.sent` | Rappel envoyé *(E7)* |
| `case.deleted` | Dossier supprimé *(E5)* |

### 5.4 `features/cases/cases.routes.ts` (+ routes)

| Méthode / chemin | US | Body (Zod) | Réponse |
|---|---|---|---|
| `GET /api/dossiers/:id/resultat` | 4.1–4.3 | — | `200 CaseFileResultResponse` · `409 analysis_not_ready` · `404` |
| `PATCH /api/dossiers/:id/informations/:infoId` | 4.4 | `UpdateExtractedInfoInputSchema` | `200 { ok:true }` · `404` · `400` |
| `PATCH /api/dossiers/:id/echeance` | 4.4 AC5 | `UpdateMainDeadlineInputSchema` | `200 { ok:true }` · `400 deadline_before_document` · `404` |
| `PATCH /api/dossiers/:id` | 4.4 AC1 | `UpdateCaseScalarsInputSchema` | `200 { ok:true }` · `400` · `404` |
| `GET /api/dossiers/:id/historique` *(PR-D)* | 4.5 | — | `200 CaseFileHistoryResponse` · `404` |

- `params` : `IdParamsSchema` existant ; pour `updateInfo`, `z.object({ id: z.string().uuid(), infoId: z.string().uuid() })`.
- `GET …/resultat` et `…/historique` : **pas** de `RATE_LIMITS.analysis` (lecture d'écran, comme
  `GET /api/dossiers/:id`). Les `PATCH` : `config: RATE_LIMITS.analysis` (écritures, cohérent avec
  US-8.1 #48).
- Toutes héritent du scope gardé `/api/*` (`app.ts`, `secured.register(caseRoutes)`), `forUser(requireUser(request).id)`.

### 5.5 `features/cases/cases.dto.ts`

Re-export des nouveaux schémas/consts du contrat (`CaseFileResultResponseSchema`,
`UpdateExtractedInfoInputSchema`, `UpdateMainDeadlineInputSchema`, `UpdateCaseScalarsInputSchema`,
`RESULT_WARNING_BANNER`, `LOCKABLE_FIELDS`, `CaseFileHistoryResponseSchema`).

### 5.6 `server/database/analysis-store.ts` (garde ré-analyse)

`applyAnalysis` : `select` du garde `exists` étendu à `userLockedFields` ; construction du `data`
de `tx.caseFile.update` en omettant les clés verrouillées :

```ts
const locked = new Set(row.userLockedFields);
const data: Prisma.CaseFileUpdateInput = {
  summary: result.summary, warnings: result.warnings,
  status: "A_FAIRE", analysisStatus: "TERMINEE", lastActivityAt: new Date(),
};
if (!locked.has("organisme"))    data.organisme = result.organisme;
if (!locked.has("title"))        data.title = result.title;
if (!locked.has("documentDate")) { data.documentDate = result.documentDate;
                                   data.documentDateSourceExcerpt = result.documentDateSourceExcerpt; }
if (!locked.has("mainDeadline")) { data.mainDeadline = result.mainDeadline?.date ?? null; /* + Type/SourceExcerpt/Confidence */ }
```

`ExtractedInformation` : le `deleteMany({ where: { caseFileId, isUserCorrected: false } })` existant
est déjà conforme à US-4.4 AC3 — inchangé.

---

## 6. Frontend — écran 05 (`/dossiers/[id]`)

### 6.1 `front/src/lib/api/cases.ts` (+)

```ts
getCaseResult(id, cookieHeader?): Promise<CaseFileResultResponse>   // GET result.path ; 409 → ApiError
updateExtractedInfo(id, infoId, body: UpdateExtractedInfoInput): Promise<{ ok: true }>  // PATCH
updateMainDeadline(id, body: UpdateMainDeadlineInput): Promise<{ ok: true }>            // PATCH
updateCaseScalars(id, body: UpdateCaseScalarsInput): Promise<{ ok: true }>              // PATCH detail
getCaseHistory(id, cookieHeader?): Promise<CaseFileHistoryResponse>                     // PR-D
```

### 6.2 `front/src/app/(app)/dossiers/[id]/page.tsx` (server component — choix attente / résultat)

```tsx
export default async function DossierPage({ params }) {
  const { id } = await params;
  const cookieHeader = await readCookieHeader();          // cf. lib/session.ts
  try {
    const data = await getCaseResult(id, cookieHeader);   // 200 seulement si TERMINEE
    return <AnalysisResult data={data} caseFileId={id} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    // 409 analysis_not_ready | 0 réseau | 5xx → on retombe sur l'écran d'attente,
    // qui gère lui-même le polling et l'erreur.
    return (
      <section>
        <h1 className="sr-only">Analyse de votre courrier</h1>
        <AnalysisWaiting caseFileId={id} />
      </section>
    );
  }
}
```

`metadata` : titre dynamique « Résultat de l'analyse — CapClair » (statique acceptable au MVP).

### 6.3 `front/src/components/cases/analysis-waiting.tsx` (édit minime)

Au passage `view === "done"` : au lieu d'afficher « Analyse terminée » en dur, appeler
`router.refresh()` (nouveau `useRouter` de `next/navigation`) une fois → le server component
re-fetch et rend `<AnalysisResult>`. Garder le bloc « done » actuel comme fallback très bref
(anti-flash) avec `role="status"`.

### 6.4 Arborescence `front/src/components/cases/`

```
cases/
  analysis-waiting.tsx          (existant — + router.refresh() au done)
  analysis-result.tsx           NOUVEAU — orchestrateur ; impose l'ordre US-4.1 dans le DOM ;
                                grille 1 col (mobile) → 2 col lg (cosmétique, sans réordonner)
  result-warning-banner.tsx     US-4.1 AC3 — <Alert tone="warning">, texte = RESULT_WARNING_BANNER
                                (contrat). Rendu APRÈS la carte échéance sur mobile (garantit AC2),
                                au-dessus du reste.
  organisme-tag.tsx             « CAF détectée » / « Organisme non déterminé » ; « Corriger » (PR-C)
  main-deadline-card.tsx        US-4.1 #1 ; date FR (date-fns/locale/fr) ; si overdue → libellé
                                « Échéance dépassée » (sobre, non alarmiste, US-3.6 AC4) ;
                                si computedFromDelay → « Calculée par le serveur à partir de … » ;
                                <ConfidenceBadge> ; bouton « Corriger l'échéance » → <DeadlineEditDialog> (PR-C)
  summary-section.tsx           police lecture (Spectral, --font-reading) ; US-4.1 #2
  warnings-note.tsx             CaseFile.warnings, liste sobre sous le résumé (voir risque 8.2)
  actions-list.tsx             US-4.1 #3 — lecture seule en E4 ; cases visuelles non cochables
                                (le cochage = US-5.2/E5) ; chaque item → <SourceExcerptDisclosure>
  required-docs-list.tsx       US-4.1 #4 — idem
  extracted-info-list.tsx      US-4.1 #5 — compteur, rendu des lignes
  extracted-info-row.tsx       valeur + libellé + <ConfidenceBadge> + <SourceExcerptDisclosure>
                                + « Corriger cette information » → <InfoEditForm> (PR-C)
  source-excerpt-disclosure.tsx US-4.2 — <details>/<summary> « Voir l'extrait » ; contenu = extrait
                                littéral ; si !verifiable → « Extrait non retrouvé dans le
                                document — information à vérifier » (pas d'extrait affiché)
  confidence-badge.tsx         US-4.3 — icône ri-alert-line + TEXTE :
                                FAIBLE → « À vérifier » ; MOYEN → « Confiance moyenne » ;
                                ELEVE → rien (D10). Jamais la couleur seule.
  confidence-recap-banner.tsx  US-4.3 AC3 — affiché si data.infosToVerify.length > 0 ;
                                liste les libellés + ancres vers les lignes concernées
  response-draft-preview.tsx   US-4.1 #6 — 2 lignes + « Ouvrir le brouillon complet »
                                (lien /dossiers/[id]/brouillon, aria-disabled en E4 — route E6)
  info-edit-form.tsx           PR-C — formulaire inline (TextField existant) ; submit →
                                updateExtractedInfo → router.refresh() ; états loading/erreur
  deadline-edit-dialog.tsx     PR-C — <input type="date"> min = documentDate ; submit →
                                updateMainDeadline ; message d'erreur deadlineBeforeDocument
  case-history.tsx             PR-D — <ol> date+heure+libellé FR (getCaseHistory)
```

Réutilise `components/ui/` existants : `alert.tsx`, `button.tsx`, `text-field.tsx`,
`checkbox-field.tsx`. Icônes `@remixicon/react` (déjà en dépendance).

### 6.5 Responsive & a11y

- **375 px** : une seule colonne, ordre `analysis-result.tsx` = échéance → (bandeau AC3) → résumé →
  avertissements → actions → justificatifs → infos → brouillon. La carte échéance est le 1ᵉʳ bloc
  → visible sans défilement (US-4.1 AC2). Bandeau AC3 compact (2 lignes max) juste en dessous.
- **≥ `lg`** : `grid lg:grid-cols-[minmax(0,1fr)_360px]` — col. droite = infos + brouillon
  (fidélité `11:145`) ; l'ordre DOM et l'ordre de tabulation restent ceux du mobile (col. droite
  placée après les justificatifs dans le markup, repositionnée en CSS).
- **Confiance jamais par la couleur seule** (US-4.3 AC2, design-system §a11y) : `ConfidenceBadge`
  = icône + libellé texte ; `warning-light/warning` en fond, mais l'information passe par le texte.
- `SourceExcerptDisclosure` : `<details>` natif (clavier OK) ou bouton `aria-expanded` ; cible ≥ 44 px.
- Formulaires d'édition : `<label>` associé, `aria-invalid` + message lié en erreur, focus renvoyé
  sur le champ à l'ouverture, `Échap` referme sans enregistrer.
- Tokens : `globals.css` (`--color-primary #1F5F8B`, `--color-warning`, `--radius-card`, etc.).

### 6.6 Fidélité Figma

Référence actuelle : frame **`11:145`** (basse fidélité) + `wireframes.html` §Screen 5 +
`design-system.md`. Éléments repris : tag « CAF détectée », cartes titrées (Échéance principale /
Résumé / Actions à faire (n) / Justificatifs à préparer (n) / Informations extraites / Brouillon de
réponse), badge « ⚠ À vérifier », note « Calculée par le serveur à partir de … », lien « Voir
l'extrait source », bouton « Corriger cette information », aperçu brouillon 2 lignes + « Ouvrir le
brouillon complet ». Ajouts imposés par les AC et **absents** du frame low-fi : bandeau permanent
US-4.1 AC3, bandeau récap US-4.3 AC3, déclencheur « Voir l'extrait » sur **chaque** info/action/
justificatif. **Bloquant avant merge PR-B : node-id Hi-Fi de l'écran 05 fourni par l'utilisateur**
(clic droit frame → Copy link) pour caler espacements, typographie et états.

---

## 7. Tests

### 7.1 Unitaires (`src/**/*.test.ts`, projet `unit`)

- `features/cases/cases.mapper.test.ts` :
  - `normalizeForExcerptMatch` — accents, apostrophes `’/'`, guillemets, NBSP, compactage d'espaces.
  - `isLiteralExcerpt` — sous-chaîne présente → `true` ; absente → `false` ; texte vide → `false`
    (US-4.2 AC2).
  - `toCaseResultDto` — `confidenceLevel` abaissé à `FAIBLE` quand `!verifiable` ; relevé à `ELEVE`
    quand `isUserCorrected` ; `infosToVerify` = infos `FAIBLE` non corrigées ; `overdue` calculé ;
    `computedFromDelay` = `type RELATIVE` ; `preview` tronqué, sans corps complet.
- `features/cases/history-label.test.ts` (PR-D) — chaque `eventType` connu → libellé FR ; inconnu →
  fallback ; aucun libellé ne contient de `.`/underscore technique (AC2).

### 7.2 Intégration back (`test/integration/**`, Postgres `_test`, `truncateAll` en `beforeEach`, 1 IP par fichier)

- `cases.result.test.ts` :
  - `401` sans cookie.
  - Dossier `TERMINEE` du propriétaire → `200`, forme `CaseFileResultResponseSchema.parse` OK,
    sections toutes présentes, `analysisStatus: "TERMINEE"`.
  - Dossier `EN_ATTENTE` / `EN_COURS` → `409` `code:"analysis_not_ready"` + `analysisStatus`.
  - Cross-compte → `404` ; id inconnu → `404`.
  - **US-4.2 AC2/AC3** : `seedCaseGraph` avec `Document.extractedText` maîtrisé + 2 infos, l'une
    dont `sourceExcerpt` est une sous-chaîne littérale (→ `verifiable:true`, confiance conservée),
    l'autre dont l'extrait est absent du texte (→ `verifiable:false`, `confidenceLevel:"FAIBLE"`,
    présente dans `infosToVerify`).
  - `Document.extractedText` **jamais** dans la réponse (recherche d'un fragment connu → absent).
- `cases.correct-info.test.ts` :
  - `PATCH …/informations/:infoId` `{ value }` → `200` ; re-`GET …/resultat` renvoie la nouvelle
    valeur, `isUserCorrected:true`, `confidenceLevel:"ELEVE"` (US-4.4 AC2).
  - Une ligne `AuditEvent` `eventType:"information.corrected"`, `userId` du compte, `metadata`
    **sans** la valeur corrigée (US-4.4 AC4 + US-8.2).
  - Body `{ value:"" }` → `400` ; `value` > 500 car. → `400`.
  - `infoId` d'un autre dossier / autre compte → `404`.
- `cases.correct-deadline.test.ts` :
  - `PATCH …/echeance` `{ date }` valide → `200` ; `GET …/resultat` : `mainDeadline.date` mis à
    jour, `confidence:"ELEVE"`, `isUserCorrected:true`, `lockedFields` contient `"mainDeadline"`.
  - `date` < `documentDate` → `400` `code:"deadline_before_document"` (US-3.6 AC5).
  - `AuditEvent` `deadline.corrected` écrit ; hook `rescheduleForCaseFile` appelé (spy) — pas de
    `Reminder` créé (E7 différé).
- `cases.correct-scalars.test.ts` : `PATCH /api/dossiers/:id` `{ organisme }` → `200`, verrou
  `"organisme"` posé, `AuditEvent` `case.updated` ; body vide → `400`.
- `cases.reanalyze-preserves-corrections.test.ts` (**US-4.4 AC3**) : corriger une info + l'échéance
  + l'organisme, puis rejouer `runAnalysisJob(caseFileId)` (`analyzeLetter` mocké, gabarit
  `analysis.worker.test.ts`) → l'info corrigée, la date corrigée et l'organisme corrigé sont
  intacts ; les infos non corrigées, elles, sont remplacées.
- `cases.history.test.ts` (PR-D) : entrées triées desc, libellés FR, aucune ne contient de contenu
  de document ni d'`eventType` brut ; cross-compte → `404`.
- `cases.logs.test.ts` (gabarit `documents.logs.test.ts`) : parcours GET résultat + PATCH → la
  sortie `logger` ne contient ni fragment d'`extractedText`, ni valeur corrigée, ni `sourceExcerpt`.

### 7.3 Front (`front/src/**/*.test.tsx`, RTL)

- `analysis-result.test.tsx` : les 6 sections rendues dans l'ordre imposé (assert sur l'ordre DOM) ;
  la carte échéance précède le résumé ; bandeau AC3 présent avec le **texte exact**
  (`RESULT_WARNING_BANNER`) ; `overdue` → « Échéance dépassée » ; `computedFromDelay` → mention
  « Calculée … ».
- `confidence-badge.test.tsx` : `FAIBLE`/`MOYEN` → texte visible (« À vérifier » / « Confiance
  moyenne ») ; `ELEVE` → rien ; le libellé n'est jamais porté par la seule classe de couleur
  (le nœud texte existe dans le DOM).
- `confidence-recap-banner.test.tsx` : rendu ssi `infosToVerify.length > 0` ; liste les libellés.
- `source-excerpt-disclosure.test.tsx` : fermé par défaut ; « Voir l'extrait » révèle l'extrait
  littéral ; `verifiable:false` → message « non vérifiable », pas d'extrait.
- `info-edit-form.test.tsx` : soumission → `updateExtractedInfo` appelé avec `{ value }` ;
  erreur API → message affiché ; `Échap` annule.
- `dossier-page.test.tsx` (ou test du routeur) : mock `getCaseResult` → `409` rend
  `<AnalysisWaiting>` ; `200` rend `<AnalysisResult>` ; `404` → `notFound()`.

### 7.4 Corpus (rappel)

Le run corpus reste **E3** (`RUN_AI_CORPUS_TESTS`, hors CI). E4 n'ajoute pas d'appel IA. Un
assert facultatif peut être greffé au run corpus E3 : pour chaque courrier analysé,
`isLiteralExcerpt(sourceExcerpt, extractedText)` vrai pour ≥ X % des infos (mesure de la qualité
des extraits IA, alimente le risque 8.2).

---

## 8. Risques

**8.1 Dépendance E7 pour les rappels (US-4.4 AC5).**
`Reminder` n'est jamais alimenté avant E7/US-7.1. E4 recalcule et **écrit** la date corrigée côté
serveur (faisable maintenant) et journalise `deadline.corrected`, mais **ne reprogramme aucun
rappel**. Mitigation : hook `remindersService.rescheduleForCaseFile(id)` en place dès PR-C (no-op
tracé) ; l'`AuditEvent` `deadline.corrected` permettra à E7 de rejouer les échéances corrigées à sa
mise en service. **AC5 partiellement satisfait** — à faire acter par le PO à la revue de PR-C.

**8.2 Qualité du champ `avertissements` (repérée sur CAF-01).**
E3 a introduit `CaseFile.warnings` ; le run corpus a montré des avertissements parfois verbeux ou
peu fiables. L'écran 05 les affiche (`warnings-note.tsx`). Mitigation : rendu sobre sous le résumé,
sans langage alarmiste, séparé du bandeau fixe AC3 ; **si** le run corpus E3 (`RUN_AI_CORPUS_TESTS`,
renvoi au rapport plan E3 §8 / risque 9.2) confirme la dérive, basculer `warnings-note.tsx` derrière
un flag et ne garder que le bandeau AC3 au MVP. Décision de contenu, à trancher avec le PO au vu des
chiffres, pas une suppression silencieuse.

**8.3 Rétro-compatibilité des dossiers E3.**
`userLockedFields` : défaut `'{}'`, aucun impact sur les dossiers existants. `verifiable` calculé à
la lecture → rétro-rempli sans backfill (décision #3/#4). **Point d'attention** : un dossier dont le
`Document` a été **remplacé** (E2 `replace`) après l'analyse a un `extractedText` différent de celui
analysé → des extraits pourtant légitimes peuvent apparaître « non vérifiables ». Comportement
acceptable (il signale une vraie incohérence) ; documenté dans le PR et le README.

**8.4 `applyAnalysis` et la garde de verrou (régression E3).**
La transaction E3 écrase `organisme/title/summary/mainDeadline*/documentDate*` inconditionnellement.
PR-A ajoute la garde `userLockedFields`. Risque de régression sur `analysis.worker.test.ts` et
`cases.analyze.test.ts`. Mitigation : étendre `analysis.worker.test.ts` avec un cas
« champ verrouillé non écrasé » ; le `deleteMany({ isUserCorrected:false })` des
`ExtractedInformation` est déjà conforme et n'est pas touché.

**8.5 Ordre imposé US-4.1 vs maquette 2 colonnes (`11:145`).**
Le frame place infos + brouillon dans une colonne de droite. Risque : une grille CSS qui réordonne
le flux de lecture / de tabulation. Mitigation : ordre **DOM** figé (échéance → résumé → actions →
justificatifs → infos → brouillon), grille desktop purement cosmétique, test `analysis-result.test.tsx`
qui assert l'ordre des nœuds. Mobile 375 : empilement dans cet ordre, échéance en premier écran.

**8.6 Fuite de contenu de courrier (US-8.2).**
`sourceExcerpt` **est** du contenu de courrier ; son affichage est l'objet de US-4.2, donc autorisé
dans le DTO de résultat et dans l'UI. En revanche : `Document.extractedText` complet ne doit jamais
entrer dans le DTO (seul le booléen `verifiable`) ni dans un log ; les `AuditEvent` de correction ne
portent jamais la valeur corrigée (ids et `categoryCode` seulement). Vérifié par `cases.result.test.ts`
et `cases.logs.test.ts`.

**8.7 `GET …/resultat` mis en polling par erreur.**
Requête à 5 jointures ; si le front la boucle toutes les 2 s, la charge explose. Mitigation :
`GET /api/dossiers/:id` (statut nu) reste la seule route de polling (écran 04 inchangé) ;
`…/resultat` renvoie `409` tant que `!TERMINEE` et n'est appelée **qu'une fois** par le server
component ; `AnalysisWaiting` déclenche `router.refresh()` au passage `done`. Test :
`cases.result.test.ts` (409) + `cases.status.test.ts` reste vert (pas de preset serré ajouté).

**8.8 US-4.5 (PR-D) — événement « création » manquant.**
E2 n'écrit pas d'`AuditEvent` à l'import. Sans lui, l'historique d'un dossier pré-E4 commence à
l'analyse (AC1 « création » non couvert pour l'existant). Mitigation PR-D : ajouter un
`db.auditEvents.record({ eventType:"document.imported" })` dans `features/documents` à la création,
et accepter que les dossiers antérieurs démarrent leur historique à `analysis.completed`.

---

## 9. Découpage en PR et livraison

### PR-A — Contrat, migration, GET résultat, mapper, vérification substring (back)
Satisfait la **logique** de US-4.1 (socle données), **US-4.2 (AC1–3)**, US-4.3 (dérivation serveur
de la confiance). Testable sans front.
Créer : `back/prisma/migrations/<ts>_e4_result_and_corrections/migration.sql` ·
`back/test/integration/cases.result.test.ts` · `back/src/features/cases/cases.mapper.test.ts`.
Modifier : `back/prisma/schema.prisma` · `contract/src/analysis.ts` · `contract/src/paths.ts` ·
`back/src/features/cases/{cases.routes.ts,cases.service.ts,cases.mapper.ts,cases.dto.ts}` ·
`back/src/server/database/{repositories.ts,context.ts,analysis-store.ts}` ·
`back/test/helpers/factories.ts` · `back/test/integration/analysis.worker.test.ts` (cas verrou).
**Estimation : ~9 pts-équiv.**

### PR-B — Écran 05, lecture seule (front)
Satisfait le volet UI de **US-4.1**, **US-4.2 (affichage)**, **US-4.3 (AC1–3)**.
Créer : `front/src/components/cases/{analysis-result,result-warning-banner,organisme-tag,main-deadline-card,summary-section,warnings-note,actions-list,required-docs-list,extracted-info-list,extracted-info-row,source-excerpt-disclosure,confidence-badge,confidence-recap-banner,response-draft-preview}.tsx`
+ tests RTL associés.
Modifier : `front/src/app/(app)/dossiers/[id]/page.tsx` · `front/src/components/cases/analysis-waiting.tsx` ·
`front/src/lib/api/cases.ts` (`getCaseResult`).
**Prérequis : node-id Hi-Fi écran 05 fourni.** **Estimation : ~9 pts-équiv.**

### PR-C — Correction manuelle (US-4.4)
Satisfait **US-4.4 (AC1–4 ; AC5 partiel, rappels différés)**.
Créer : `back/src/features/reminders/reschedule.ts` (hook no-op) ·
`back/test/integration/{cases.correct-info,cases.correct-deadline,cases.correct-scalars,cases.reanalyze-preserves-corrections,cases.logs}.test.ts` ·
`front/src/components/cases/{info-edit-form,deadline-edit-dialog}.tsx` + tests.
Modifier : `back/src/features/cases/{cases.routes.ts,cases.service.ts}` ·
`back/src/server/database/repositories.ts` (`updateForUser`, `setCorrectedDeadlineForUser`,
`updateScalarsForUser`, `AuditEventRepository`) · `front/src/lib/api/cases.ts` ·
`front/src/components/cases/{extracted-info-row,main-deadline-card,organisme-tag}.tsx`.
**Estimation : ~5 pts.**

### PR-D — Historique du dossier (US-4.5, priorité S, droppable)
Satisfait **US-4.5 (AC1–3)**.
Créer : `back/src/features/cases/history-label.ts` (+test) ·
`back/test/integration/cases.history.test.ts` · `front/src/components/cases/case-history.tsx` (+test).
Modifier : `contract/src/analysis.ts` (`HistoryEntrySchema`, `CaseFileHistoryResponseSchema`) ·
`contract/src/paths.ts` (`history`) · `back/src/features/cases/{cases.routes.ts,cases.service.ts}` ·
`back/src/server/database/repositories.ts` (`AuditEventRepository.listForCaseFileForUser`) ·
`back/src/features/documents/*` (event `document.imported`) · `front/src/lib/api/cases.ts` ·
`front/src/components/cases/analysis-result.tsx` (section historique).
**Estimation : ~5 pts.**

### Ordre de livraison
`PR-A → PR-B → PR-C`, séquentiel (B dépend du contrat de A ; C dépend des composants de B).
`PR-D` après C, ou en parallèle de C (indépendante : lecture seule d'`AuditEvent`). Peut glisser au
sprint suivant sans bloquer E5.
Total : **26 pts** (23 hors PR-D).

---

## 10. Fichiers les plus critiques

- `07-developpement/contract/src/analysis.ts` — `CaseFileResultResponseSchema` + schémas de
  correction : contrat entre le graphe serveur et l'écran 05.
- `07-developpement/back/src/features/cases/cases.mapper.ts` — dérivation `verifiable` (US-4.2) et
  abaissement de confiance (US-4.3) ; frontière anti-fuite (`extractedText` jamais exposé).
- `07-developpement/back/src/features/cases/cases.service.ts` + `cases.routes.ts` — `getCaseResult`
  (409/404), endpoints `PATCH` (US-4.4), scope `userId`.
- `07-developpement/back/src/server/database/repositories.ts` (+ `context.ts`) — méthodes scopées,
  nouveau `AuditEventRepository`.
- `07-developpement/back/src/server/database/analysis-store.ts` — garde `userLockedFields` dans
  `applyAnalysis` (US-4.4 AC3, non-écrasement à la ré-analyse).
- `07-developpement/front/src/app/(app)/dossiers/[id]/page.tsx` +
  `07-developpement/front/src/components/cases/analysis-result.tsx` — bascule attente/résultat et
  ordre imposé US-4.1.
