# Plan d'implémentation — Epic E3 « Consentement et appel à l'IA »

Statut : **PR-A + PR-B + PR-C implémentées** (branche `feat/e3-ai-contract-client`, PR #67) ·
Prérequis : E1 (auth) + E2 (import/lecture) fusionnés sur `main`.

Écarts PR-C (vs §7) :
- **Consentement IA = 2ᵉ case sur l'écran 03**, révélée une fois « document fictif » confirmée (se lit
  comme une étape sans modale — la maquette n'en dessine pas). Case + endpoint + `ConsentType`
  distincts (AC2) ; texte nommant **Anthropic** (AC1). La ligne `ConsentLog AI_PROCESSING` est écrite
  au clic « Lancer l'analyse » (`confirmAiConsent` → `startAnalysis`), pas au cochage.
- Écran 04 : maquette node `1:16` (basse fidélité, itération 2 — pas de page « Hi-Fi » dans le fichier
  Figma courant). Route `/dossiers/[id]` sans suffixe `/analyse` (le wireframe le montrait) : E4
  réutilisera la même URL pour le résultat quand `analysisStatus === TERMINEE`.

Écarts PR-B (vs §6/§8/§10) :
- **Accès BDD du worker** : `server/database/analysis-store.ts` (couche **système**, non scopée
  `userId`) plutôt que des méthodes ajoutées à `CaseFileRepository` (scopé). Raison : le worker n'a
  pas d'utilisateur courant ; la route (`features/cases`) reste scopée et vérifie propriété +
  consentement avant d'enfiler. Seul `requeueForAnalysis` est ajouté à `CaseFileRepository` (garde
  409 / relance après ECHEC).
- **Test du worker** : `runAnalysisJob()` appelé en direct (`analysis.worker.test.ts`), `analyzeLetter`
  mocké — pas de `Worker` BullMQ ni de Redis dans `test/setup.ts`. La route `202/EN_ATTENTE` est testée
  avec la file mockée (`cases.analyze.test.ts`). Redis reste ajouté à `docker-compose.yml` pour le
  worker en local.
- `lib/dates.ts` gagne `deriveDeadlineFromText` (type d'échéance **inféré**) pour les délais d'action,
  que l'IA ne qualifie pas (US-3.5, `ActionIA.dueDateRawText` sans `type`).
Modèle IA retenu avec l'utilisateur : **Claude Sonnet 5** (`claude-sonnet-5`, $2/$10 par Mtok) — rapport
qualité/coût adapté à une extraction structurée sur texte court ; Opus 5 reste un repli si la précision
sur le corpus s'avère insuffisante (voir §9, risque 9.5).
Périmètre : US-3.1 (consentement), US-3.2 (schéma strict), US-3.3 (organisme), US-3.4 (résumé),
US-3.5 (actions/justificatifs), US-3.6 (échéances). Écran 05 (affichage du résultat) est **E4**, hors
périmètre — E3 s'arrête à la persistance en base + l'écran d'attente (US I-13/D8).

---

## 1. Cadre

- Flux de référence : `03-architecture/01-architecture-technique.md` §6 (asynchrone, D8) et §3 D7
  (dates/montants jamais calculés par l'IA). Rien de nouveau à trancher sur ces deux points : ils sont
  actés depuis l'amorçage.
- **Une seule frontière avec l'IA** : `server/ai/`. Aucun autre module n'importe le SDK Anthropic.
- **Une seule frontière avec la file** : `server/queues/` + `worker/`. Le module `features/analysis`
  enfile une tâche, ne l'exécute jamais en ligne (pas d'appel IA synchrone dans une requête HTTP).
- Modules aujourd'hui stubs à implémenter : `back/src/server/ai/index.ts`, la queue « analyse » dans
  `back/src/server/queues/`, le traitement dans `back/src/worker/index.ts`.
- `RATE_LIMITS.analysis` et `RATE_LIMIT_ANALYSIS_MAX/WINDOW` sont **déjà provisionnés** (US-8.1 #48,
  laissé en attente depuis E2/PR-A) — il ne reste qu'à les brancher sur la route de déclenchement.
- Redis **absent** de `back/docker-compose.yml` (seul Postgres y est) alors que `REDIS_URL` est déjà une
  variable obligatoire (`env.ts`) — ajout du service en PR-B (première brique qui en a réellement besoin).

## 2. Décisions à verrouiller

| # | Sujet | Décision | Alternative |
|---|---|---|---|
| 1 | Modèle IA | ✅ **tranché avec l'utilisateur — Claude Sonnet 5** (`claude-sonnet-5`) | Opus 5 (repli si précision insuffisante), Haiku 4.5 (écarté, risque sur les seuils ≥93 %/≥85 %) |
| 2 | Sortie structurée | **`messages.create()` + `output_config.format` (JSON Schema)** — écart vs l'intention initiale : `zodOutputFormat()`/`messages.parse()` du SDK importent `zod/v4` en interne, incompatible avec les schémas zod v3 du reste du contrat. `zod-to-json-schema` convertit `AnalysisResultSchema` en JSON Schema pour contraindre la sortie ; c'est notre propre `AnalysisResultSchema.safeParse()` qui valide (même garantie AC2, sans forker le contrat en zod v4) | Convertir tout `@capclair/contract` en zod v4 — écarté, risque de régression disproportionné sur E1/E2 pour ce seul appel ; tool use forcé — écarté, plus verbeux pour un besoin d'extraction pure |
| 3 | `ConsentType.ANALYSE_IA` → `AI_PROCESSING` | ✅ **renommage maintenant** (`ALTER TYPE ... RENAME VALUE`) — reporté depuis ADR-006/ADR-015, aucune ligne n'utilise cette valeur à ce jour (grep confirmé) | Ajouter `AI_PROCESSING` en parallèle sans renommer — rejeté, ADR-006 promettait la réconciliation à E3 |
| 4 | Prompt « distinct par organisme » (US-3.3 AC3) | **Un seul appel IA** : classification heuristique légère (mots-clés déterministes sur `extractedText` — « Caisse d'Allocations Familiales », « CPAM »/« Assurance Maladie », « France Travail »/« Pôle emploi ») sélectionne l'un des 3 gabarits de prompt organisme-spécifiques (vocabulaire, sigles, tournures propres à chaque organisme) ; repli sur un gabarit générique + `INDETERMINE` si aucun mot-clé ne matche | Classification par un premier appel IA séparé — rejeté : double le coût par courrier pour un gain marginal sur un texte de 1-2 pages |
| 5 | Champ `type de courrier` (US-3.2 AC1, champ 2/13) | Stocké dans `CaseFile.title` (ADR-011 l'anticipait déjà : « écrasé à l'analyse ») | Nouveau champ `documentType` |
| 6 | Champ `date du courrier` (champ 3/13) | **Nouveau** `CaseFile.documentDate` + `documentDateSourceExcerpt` (migration PR-A) — nécessaire comme ancre du calcul des délais relatifs (D7) et absent du schéma actuel | Ne pas persister, recalculer à la volée — rejeté, perd la traçabilité et oblige à re-dériver à chaque affichage |
| 7 | Champ `avertissements` (champ 13/13) | **Nouveau** `CaseFile.warnings String[] @default([])` (migration PR-A) | Les fondre dans `summary` — rejeté, perd la structure pour un affichage futur (E4) |
| 8 | Champ `extraits justificatifs` (US-3.2 énonce 13 champs) | **Pas un 14ᵉ champ à plat** : interprété comme le `sourceExcerpt` obligatoire porté par chaque item des tableaux actions/justificatifs/échéances/références/montants (déjà AC5). Décision documentée ici faute de formulation univoque dans la user story. | Ajouter un tableau plat `extraits: string[]` séparé — rejeté, redondant avec les `sourceExcerpt` déjà par item |
| 9 | Montants | Restent des lignes `ExtractedInformation` (catégorie `MONTANT`, `value: String`) — cohérent avec le schéma actuel (pas de colonne `Decimal` dédiée) | Ajouter un type `Decimal` dédié — reporté : aucun besoin d'arithmétique sur les montants au MVP |
| 10 | Cache d'analyse (hash → réutilisation, doc archi §3 D11) | **Hors périmètre E3**, documenté comme tel | Implémenter maintenant — écarté : complexifie l'isolation `userId` (copier des lignes IA d'un dossier à l'autre) pour un gain non testé par aucune AC, sur un corpus de démo de 15 courriers |
| 11 | Préservation des corrections lors d'une ré-analyse | `ExtractedInformation.isUserCorrected = true` protégée (delete-and-recreate des autres lignes) — le seul flag prévu à cet effet dans le schéma actuel. `ActionItem`/`RequiredDocument` n'ont pas de flag équivalent : remplacés intégralement à chaque analyse réussie. Limitation documentée en risque 9.6 (E4/E5). | Ajouter `isUserCorrected` à `ActionItem`/`RequiredDocument` maintenant — reporté, aucune US d'E3 ne l'exige |
| 12 | Tentatives de validation (US-3.2 AC3) | **2 tentatives au total** (1 appel initial + 1 relance si `parsed_output` est `null`), puis `AnalysisStatus.ECHEC` | 1 initial + 2 relances (3 au total) — écarté, l'AC dit « limitée à 2 tentatives » |
| 13 | Endpoints | `POST /api/dossiers/:id/consentement-ia` (US-3.1, miroir de `confirm-fictional`), `POST /api/dossiers/:id/analyser` (déclenche, vérifie le consentement, enfile), `GET /api/dossiers/:id` (statut, pour le polling écran 04) | Fusionner consentement + déclenchement en un seul appel — rejeté, AC2 exige une action distincte de la confirmation « document fictif », par symétrie il vaut mieux aussi la distinguer du déclenchement pour rester testable indépendamment |

---

## 3. Modèle de données et migration (PR-A)

### 3.1 `back/prisma/schema.prisma`

```prisma
enum ConsentType { AI_PROCESSING  CGU  FICTIONAL_DOCUMENT }   // renommé depuis ANALYSE_IA

model CaseFile {
  // ... champs existants inchangés ...

  // + Ancre du calcul des délais relatifs (D7) ; traçabilité de l'origine.
  documentDate              DateTime?
  documentDateSourceExcerpt String?

  // + US-3.2 champ 13/13 — avertissements spécifiques au courrier (ex. « suspension possible »).
  warnings String[] @default([])
}
```

### 3.2 Migration `back/prisma/migrations/<ts>_e3_analysis/migration.sql`

```sql
-- E3 — Consentement et appel à l'IA (ADR-017, complète ADR-006/ADR-015).
ALTER TYPE "ConsentType" RENAME VALUE 'ANALYSE_IA' TO 'AI_PROCESSING';

ALTER TABLE "CaseFile" ADD COLUMN "documentDate" TIMESTAMP(3);
ALTER TABLE "CaseFile" ADD COLUMN "documentDateSourceExcerpt" TEXT;
ALTER TABLE "CaseFile" ADD COLUMN "warnings" TEXT[] NOT NULL DEFAULT '{}';
```

`RENAME VALUE` ne nécessite pas de transaction spéciale (contrairement à `ADD VALUE`, cf. ADR-004 du
plan E2) — sûr même si des lignes existantes portent `ANALYSE_IA` (aucune actuellement).

### 3.3 Impacts

- `back/test/helpers/factories.ts` `seedCaseGraph` : ajouter `documentDate`/`warnings` par défaut si le
  test d'isolation (US-1.5) instancie un `CaseFile` complet.
- Aucun usage existant de `ConsentType.ANALYSE_IA` dans le code (vérifié) — pas de casse à prévoir côté TS.

---

## 4. Contrat `@capclair/contract` — `contract/src/analysis.ts` (nouveau)

Schéma de sortie IA, 13 champs (§2 décision #8 pour la lecture de « extraits justificatifs ») :

```ts
export const OrganismeIASchema = z.enum(["CAF", "CPAM", "FRANCE_TRAVAIL", "INDETERMINE"]);
export const CategorieInfoSchema = z.enum(["REFERENCE", "MONTANT", "DATE", "IDENTITE", "CONTACT", "AUTRE"]);
export const ConfianceSchema = z.enum(["FAIBLE", "MOYEN", "ELEVE"]);

const AvecExtrait = z.object({ sourceExcerpt: z.string().min(1) }); // AC5 : jamais vide

export const InfoExtraiteSchema = AvecExtrait.extend({
  category: CategorieInfoSchema,
  label: z.string().min(1),
  value: z.string().min(1),
  confidence: ConfianceSchema,
});

export const ActionSchema = AvecExtrait.extend({
  title: z.string().min(1).max(120), // infinitif, ≤ 15 mots (US-3.5 AC1) — vérifié en post-traitement
  // rawText/sourceExcerpt du délai propre à l'action ; jamais une date déjà calculée (D7).
  dueDateRawText: z.string().nullable(),
});

export const JustificatifSchema = AvecExtrait.extend({ name: z.string().min(1) });

export const EcheanceSchema = AvecExtrait.extend({
  type: z.enum(["EXPLICITE", "RELATIVE"]),
  rawText: z.string().min(1), // jamais une valeur déjà calculée par l'IA (D7)
});

export const AnalysisResultSchema = z.object({
  organisme: OrganismeIASchema,                    // 1
  typeCourrier: z.string().min(1).max(120),         // 2 → CaseFile.title
  dateCourrierRawText: z.string().nullable(),       // 3 → CaseFile.documentDate (calculé serveur)
  informationsExtraites: z.array(InfoExtraiteSchema), // 4 (références) + 5 (montants), via `category`
  resume: z.string().min(1),                        // 6 — 3 à 8 phrases, ≤ 25 mots chacune (post-traitement)
  actions: z.array(ActionSchema),                    // 7
  justificatifs: z.array(JustificatifSchema),         // 8
  echeancePrincipale: EcheanceSchema.nullable(),       // 9 → CaseFile.mainDeadline*
  brouillonReponse: z.string().min(1),                 // 10 → ResponseDraft.content
  avertissements: z.array(z.string().min(1)),           // 13 → CaseFile.warnings
  // 11 (extraits justificatifs) : porté par `sourceExcerpt` sur chaque item ci-dessus.
  // 12 (niveau de confiance) : `confidence` par item + confiance de l'échéance dérivée serveur (D7).
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
```

`ANALYSIS_MESSAGES` (messages FR, gabarit `documents.ts`) : `consentRequired`, `analysisFailed`,
`analysisPending`. `CASE_FILE_PATHS` dans `contract/src/paths.ts` : `detail`, `consentAi`, `analyze`.

---

## 5. `server/ai/` — client IA (PR-A)

### 5.1 `server/ai/client.ts`

```ts
export async function analyzeLetter(text: string, organisme: HeuristicOrganisme): Promise<AnalysisResult | null>
```

- `client.messages.create({ model, max_tokens: 4096, system: buildSystemPrompt(organisme), output_config: { format: { type: "json_schema", schema: zodToJsonSchema(AnalysisResultSchema) } }, messages: [{ role: "user", content: text }] })`,
  puis `AnalysisResultSchema.safeParse(JSON.parse(textBlock.text))` (§2 #2 — écart vs `zodOutputFormat`, zod v3/v4).
- `safeParse().success === false` (JSON malformé ou schéma invalide) → l'appelant décide de la relance (§2 #12).
- **Aucun retry réseau interne ici** (429/5xx) : laissé au SDK (`max_retries` par défaut) — pas de double
  logique de retry à maintenir.
- Erreurs SDK typées (`Anthropic.APIError` et sous-classes) propagées telles quelles ; le service appelant
  les traduit en `AnalysisStatus.ECHEC` + `AuditEvent` (jamais de contenu de courrier dans les logs, US-8.2).

### 5.2 `server/ai/prompts.ts`

- `classifyOrganismeHeuristic(text: string): "CAF" | "CPAM" | "FRANCE_TRAVAIL" | null` — mots-clés
  déterministes (§2 #4), testée unitairement sur des extraits synthétiques **et** sur les 15 courriers
  du corpus (≥ 14/15, US-3.3 AC1 — mesuré ici, avant même l'appel IA, car la maquette du prompt en dépend).
- `buildSystemPrompt(organisme)` : bloc commun (contrat de sortie, règle D7 « ne jamais calculer de date
  ou de délai, seulement le texte source », ton simple/A2-B1 pour `resume`, interdiction d'inventer une
  action non rattachable à un extrait — US-3.5 AC3/AC4) + bloc spécifique par organisme (vocabulaire,
  types de courriers fréquents, pièges connus du corpus).
- Prompts en constantes versionnées dans le fichier — pas de template engine, le volume ne le justifie pas.

### 5.3 `lib/dates.ts` (PR-A) — D7, jamais délégué à l'IA

```ts
export function parseExplicitFrenchDate(text: string): Date | null   // "15 mars 2026", "15/03/2026"
export function resolveRelativeDelay(anchor: Date, text: string): Date | null // "30 jours", "un mois"
export function deriveDeadline(courrier: { documentDate: Date | null }, echeance: EcheanceIA | null):
  { date: Date | null; type: EcheanceType; confidence: ConfidenceLevel; sourceExcerpt: string } | null
```

- Date explicite reconnue → `confidence: ELEVE`. Délai relatif + `documentDate` connue → date calculée,
  `confidence: MOYEN`, `type: RELATIVE` (affiché « calculée à partir du délai indiqué », US-3.6 AC3).
  `documentDate` absente → repli sur la date d'import, `confidence: FAIBLE` (doc archi §3 D7).
  Aucune date résolue → `date: null`, échéance affichée comme absente plutôt que devinée.
- **Règle de cohérence (US-3.6 AC5)** : toute échéance `< documentDate` (ou date d'import à défaut) est
  **rejetée** (`date: null`), jamais silencieusement acceptée.
- `date-fns` (+ `date-fns/locale/fr`) : dépendance ajoutée en PR-A, seul point d'import dans ce fichier.

---

## 6. Persistance et orchestration (PR-B)

### 6.1 `server/database/repositories.ts` — `CaseFileRepository` (+ méthodes)

```ts
// Transaction unique : idempotente, préserve les lignes ExtractedInformation corrigées (§2 #11).
applyAnalysis(id, result: PersistableAnalysis): Promise<void>
setAnalysisStatus(id, status: AnalysisStatus): Promise<void>
```

`PersistableAnalysis` = `AnalysisResult` déjà passé par `lib/dates.ts` (dates résolues, jamais les
`rawText` bruts de l'IA) + résolution `category → categoryId` via la table `Category` (seedée, D14).

### 6.2 `server/queues/analysis.ts` (nouveau) + `worker/index.ts`

- Une queue BullMQ `analysis`. Job = `{ caseFileId }` (jamais de contenu de courrier dans le payload —
  US-8.2 : le worker relit `Document.extractedText` depuis la base par l'id).
- `worker/index.ts` enregistre un `Worker` qui exécute, dans l'ordre du flux (doc archi §6, étapes 8-15) :
  `EN_COURS` → classification organisme → prompt → `analyzeLetter` (retry ×1 si `parsed_output: null`,
  §2 #12) → `lib/dates.ts` → `applyAnalysis` (transaction) → `AuditEvent` (`eventType: "analysis.completed"`,
  métadonnées = compteurs uniquement) → `TERMINEE`. Toute exception non gérée → `ECHEC` + `AuditEvent`
  (`eventType: "analysis.failed"`, message d'erreur générique, jamais la trace complète avec contenu).
- Concurrency `1` par défaut (pas de besoin de parallélisme au volume MVP ; évite aussi la compétition
  sur un même dossier si une relance manuelle croise un job encore en file).

### 6.3 `features/cases/` (nouveau module back, miroir de `features/documents/`)

| Route | US | Corps | Réponse |
|---|---|---|---|
| `GET /api/dossiers/:id` | — (support écran 04) | — | `200` statut (`analysisStatus`, pas le contenu) |
| `POST /api/dossiers/:id/consentement-ia` | 3.1 AC1/AC2/AC4 | `{ confirmed: true }` | `200 { ok:true }` ; **une** ligne `ConsentLog` `AI_PROCESSING` |
| `POST /api/dossiers/:id/analyser` | 3.1 AC3, D8 | — | `202 { analysisStatus:"EN_ATTENTE" }` ; 409 si déjà `EN_COURS`/`TERMINEE` |

- `analyser` vérifie **avant tout enfilement** qu'un `ConsentLog { consentType: AI_PROCESSING, granted: true }`
  postérieur à la création du dossier existe (US-3.1 AC3, « vérifié par test d'intégration ») — sinon `403`
  message `ANALYSIS_MESSAGES.consentRequired`. Aucun appel IA possible sans cette vérification, structurellement
  (le worker ne fait confiance à aucun état côté client).
- Toutes les routes portent `config: RATE_LIMITS.analysis` (clôt US-8.1 #48).

---

## 7. Frontend (PR-C)

- `front/src/lib/api/cases.ts` (nouveau) : `getCaseFile(id)`, `confirmAiConsent(id)`, `startAnalysis(id)`.
- `import-form.tsx` : le clic « Lancer l'analyse » n'est plus un simple `router.push` — il affiche l'étape
  de consentement IA (US-3.1 AC1 : texte nommant explicitement le prestataire IA externe — « Anthropic »,
  case dédiée, **distincte** de « document fictif ») puis appelle `confirmAiConsent` + `startAnalysis`
  avant de rediriger vers `/dossiers/:id`.
- `front/src/app/(app)/dossiers/[id]/page.tsx` : écran 04 « Attente d'analyse » (maquette Hi-Fi à
  relire — même piège que l'écran 03, vérifier `get_design_context` sur le bon node avant d'implémenter,
  pas seulement le plan texte). Polling léger (`setInterval` 2 s, doc archi §6) sur `GET /api/dossiers/:id`
  jusqu'à `TERMINEE`/`ECHEC` ; bouton « Relancer l'analyse » sur `ECHEC` (ré-appelle `startAnalysis`).
  Rendu du résultat lui-même = **E4**, hors périmètre ; afficher un état minimal type « Analyse terminée »
  en attendant.

---

## 8. Tests

- **Unitaires** : `classifyOrganismeHeuristic` (mots-clés + 15 courriers du corpus, `skipIf` comme en E2) ;
  `lib/dates.test.ts` (dates explicites, délais relatifs, repli date d'import, rejet antérieur au courrier
  — US-3.6 AC1/AC2/AC5) ; validation Zod de `AnalysisResultSchema` (item sans `sourceExcerpt` rejeté, AC5) ;
  post-traitement résumé (3-8 phrases, ≤25 mots — US-3.4 AC1/AC2).
- **Intégration** : `cases.consent.test.ts` (une ligne `ConsentLog AI_PROCESSING`, idempotent, cross-compte
  404, distincte de `FICTIONAL_DOCUMENT`) ; `cases.analyze.test.ts` (403 sans consentement — **vérifié par
  test**, US-3.1 AC3 ; 202 + `EN_ATTENTE` ; 409 si déjà en cours) ; `worker/analysis.test.ts` (job traité,
  transitions de statut, `AuditEvent` sans contenu sensible) — nécessite Redis en plus de Postgres dans
  `test/setup.ts`.
- **Corpus (appel réel à l'API, coûteux — à isoler)** : `documents.analysis-corpus.test.ts`, hors suite
  standard (variable d'env dédiée, ex. `RUN_AI_CORPUS_TESTS=1`, jamais en CI faute de clé/budget) : sur
  les 15 courriers, organisme correct ≥ 14/15 (US-3.3 AC1), 0 échec de validation sur 3 exécutions
  (US-3.2 AC6), ≥ 85 % des actions attendues retrouvées et 0 % inventées (US-3.5 AC3), dates explicites
  100 % correctes (US-3.6 AC1). Rapport chiffré, même format que `documents.corpus.test.ts` (E2).

---

## 9. Risques

- **9.1 Coût des tests corpus** : 15 courriers × plusieurs exécutions = appels API facturés à chaque run.
  Isolés du `npm test` standard (variable d'env dédiée), jamais exécutés en CI. Documenté dans le README.
- **9.2 Fiabilité de `messages.parse()`** : à vérifier au premier spike (début PR-A) — comportement sur
  un item de tableau invalide (rejette tout le message ou tente une correction partielle ?). Si le taux
  d'échec sur le corpus dépasse ce qu'absorbe la relance unique (§2 #12), reconsidérer Opus 5 (repli acté
  avec l'utilisateur, §2 #1) avant de complexifier la logique de retry.
- **9.3 Classification heuristique (§2 #4)** : un mot-clé peut apparaître dans un courrier d'un autre
  organisme (ex. mention de la CAF dans un courrier CPAM). Mesurée sur le corpus avant de généraliser ;
  repli sur le prompt générique + `INDETERMINE` en cas de doute plutôt que de deviner.
- **9.4 `documentDate` absente** : certains courriers pourraient ne pas dater explicitement leur émission.
  `lib/dates.ts` doit avoir un repli propre (date d'import, `confidence: FAIBLE`) — jamais d'exception.
- **9.5 Précision insuffisante avec Sonnet 5** : si les seuils US-3.3 AC1 (≥93 %) ou US-3.5 AC3 (≥85 %,
  0 % inventé) ne sont pas tenus sur le corpus, remonter à l'utilisateur avec les chiffres avant de
  basculer sur Opus 5 — décision de coût, pas une bascule silencieuse.
- **9.6 Ré-analyse et corrections utilisateur** : `ActionItem`/`RequiredDocument` n'ont pas de flag de
  protection (§2 #11) — une ré-analyse après que l'utilisateur a coché des actions (E5, US-5.2) perdrait
  cet état. Aucune US d'E3 ne l'exige, mais à traiter avant que E5 rende le problème visible.

---

## 10. Découpage en PR

### PR-A — Contrat, client IA, prompts, règles déterministes de date
Satisfait la **logique** de US-3.2, US-3.3 (classification), US-3.4, US-3.5, US-3.6 (règles), testable
sans route ni worker.

Créer : `contract/src/analysis.ts` · `back/src/server/ai/{client.ts,prompts.ts}` (+tests) ·
`back/src/lib/dates.ts` (+test) · `back/prisma/migrations/<ts>_e3_analysis/migration.sql`

Modifier : `back/prisma/schema.prisma` · `contract/src/index.ts` · `back/package.json`
(+`@anthropic-ai/sdk`, +`date-fns`) · `back/.env.example` (+`ANTHROPIC_API_KEY`) · `back/src/env.ts`

### PR-B — Consentement, file, worker, routes de dossier
Satisfait **US-3.1**, l'orchestration asynchrone (D8), la persistance (D7 appliqué en pratique).

Créer : `back/src/server/queues/analysis.ts` · `back/src/features/cases/*` · tests d'intégration §8

Modifier : `back/src/worker/index.ts` · `back/src/server/database/repositories.ts` · `back/src/app.ts` ·
`back/docker-compose.yml` (+service `redis`) · `back/test/setup.ts` (Redis de test)

### PR-C — Consentement + écran d'attente (front)
Satisfait le volet UI de **US-3.1**, D8/I-13 (écran 04).

Créer : `front/src/lib/api/cases.ts` · composant de consentement IA · écran `/dossiers/[id]` (attente)

Modifier : `front/src/components/documents/import-form.tsx`

---

## 11. Fichiers les plus critiques

- `contract/src/analysis.ts` (le schéma est le contrat entre l'IA et tout le reste du produit)
- `back/src/server/ai/client.ts` + `prompts.ts`
- `back/src/lib/dates.ts` (D7 — risque R1 du projet)
- `back/src/server/database/repositories.ts` (`applyAnalysis` — idempotence, isolation `userId`)
- `back/src/worker/index.ts`
