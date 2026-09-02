# Plan d'implémentation — Epic E2 « Import et lecture du document »

Statut : **PR-A fusionnée** (#63) · **PR-B implémentée** (branche `feat/e2-extract-pdf`) · PR-C à venir · Sprint 4 · Prérequis : E1 (auth) fusionné sur `main`.
Écarts PR-B : décision #12 tranchée en revue PR-A — CSP `default-src 'none'` **sans** `sandbox` (le sandbox désactive le viewer PDF de Chrome) ; test US-8.2 réalisé en unitaire sur la config `redact` du logger (`logger.redact.test.ts`), le logger applicatif étant silencieux en test ; `montants[].valeur` du dataset parfois interprétée (« €/jour ») → le test corpus n'asserte que la partie numérique.
Décisions tranchées le 2026-09-01 : #1 `INDETERMINE`, #2 `CaseFile` créé à l'import, #3 rejet PDF > 10 pages, #4 `unpdf`. Reste à trancher : #5–#14 (recommandations par défaut applicables).

**Écart de mise en œuvre (PR-A)** : `@fastify/multipart` v10 a `throwFileSizeLimit: true` par défaut (lève `FST_REQ_FILE_TOO_LARGE` dans `toBuffer()`). On l'enregistre avec `throwFileSizeLimit: false` pour que `assertValidUpload` reste le seul point qui décide du 413 et de son message exact (cf. risque 12.2). `@fastify/multipart` retenu en `^10.1.1` (aligné sur les autres plugins @fastify du dépôt), pas `~9.x`.
Périmètre : US-2.1, US-2.2, US-2.3, US-2.4, US-2.6 (must) + US-2.5 (image acceptée → parcours illisible).
Adjacents notés, hors focus : US-5.5 (hard-delete dossier), US-8.2 (logs sans contenu sensible).

---

## 1. Cadre

- Pipeline (doc archi §6) confirmé : étapes 2→5 **synchrones** dans la requête web ; l'enfilement BullMQ de la tâche « analyse » (étape 6) = frontière E2/E3. **E2 ne touche pas au worker.**
- Barrière dure < 100 caractères utiles (US-2.6) : dans le handler HTTP, arrêt sans dossier d'analyse ni appel externe.
- Corpus US-9.1 présent : `05-courriers-fictifs/` (15 PDF + `dataset-reference.json`), hors `07-developpement/` → test d'extraction derrière `describe.skipIf(!existsSync(...))`.
- Modules back à implémenter (aujourd'hui `export {}`) : `src/features/documents/index.ts`, `src/server/storage/index.ts`.

## 2. Décisions ouvertes à valider

| # | Sujet | Décision / proposition | Alternative |
|---|---|---|---|
| 1 | Enum organisme indéterminé | ✅ **tranché — `INDETERMINE`** | ~~`INCERTAIN`~~ |
| 2 | Modèle dossier à l'import | ✅ **tranché — créer `CaseFile` dès l'étape 2**, `caseFileId` NOT NULL (1 doc ↔ 1 dossier) | ~~`Document.caseFileId` nullable~~ |
| 3 | PDF > 10 pages | ✅ **tranché — rejet `422` + message explicite** (SLA < 5 s + budget jetons IA) | ~~Traiter jusqu'à un plafond~~ |
| 4 | Librairie PDF | ✅ **tranché — `unpdf`** (ESM, maintenu, wrap PDF.js, sans effet de bord fichier ; isolé dans `server/pdf/extract.ts`) | ~~`pdf-parse`~~ ; `pdfjs-dist` en direct = repli documenté |
| 5 | `ConsentType` `ANALYSE_IA → AI_PROCESSING` | **Reporter** à E3/US-3.1 ; en E2 ajouter seulement `FICTIONAL_DOCUMENT` | Renommer maintenant |
| 6 | `MAX_UPLOAD_BYTES` | `10485760` (10 Mio) | `10000000` (10 Mo décimal — le message dit « 10 Mo ») |
| 7 | Consentement fictif | Endpoint dédié `POST /api/documents/:id/confirm-fictional` livré en E2 | Fondre dans le déclencheur d'analyse E3 (US-2.3 AC2 non vérifiable avant E3) |
| 8 | `STORAGE_DIR` | Défaut dev `back/storage/` (gitignoré) | Variable obligatoire sans défaut (rigueur US-8.4) |
| 9 | Bouton « Lancer l'analyse » en E2 | Présent mais inerte (placeholder → `/dossiers/:id`) ; logique d'activation US-2.3 AC1 réelle | Masqué jusqu'à E3 |
| 10 | Corpus pour test extraction | Lecture via `../../../05-courriers-fictifs` + `skipIf` | Copier un sous-ensemble dans `back/test/fixtures/` |
| 11 | US-2.4 AC1 | Vérif « sur-ensemble dérivé du dataset d'analyse » en attendant fichier d'attentes dédié US-9.1 | Produire maintenant le fichier d'attentes extraction (15 × ~4 chaînes) |
| 12 | En-têtes route d'aperçu | CSP par-réponse `sandbox` sur le flux binaire | `Cross-Origin-Resource-Policy: same-origin` seul (plus compatible visualiseurs) |
| 13 | Test rate-limit import | Garder `MAX = 20` + fixture 70 octets | Isoler le test avec env `MAX = 5` |
| 14 | Logs | Ajouter `redact` pino global (`originalName`/`extractedText`/`filename`) dès PR-A | Convention de champs loggables seule |

---

## 3. Modèle de données et migration (PR-A)

### 3.1 `back/prisma/schema.prisma`

```prisma
enum Organisme { CAF  CPAM  FRANCE_TRAVAIL  INDETERMINE }        // + INDETERMINE
enum ConsentType { ANALYSE_IA  CGU  FICTIONAL_DOCUMENT }         // + FICTIONAL_DOCUMENT

model Document {
  id                String   @id @default(uuid())
  caseFileId        String
  caseFile          CaseFile @relation(fields: [caseFileId], references: [id], onDelete: Cascade)
  originalName      String   // renommé depuis `filename` (US-2.1 AC4 : nom d'origine en base uniquement)
  mimeType          String   // mime canonique déduit des magic bytes, jamais le mime déclaré client
  sizeBytes         Int
  storagePath       String   // chemin RELATIF sous STORAGE_DIR ; basename = <uuid>.<ext>
  extractedText     String?  @db.Text
  extractedTextHash String?  // + : cache d'analyse IA (E3, doc archi §7)
  createdAt         DateTime @default(now())
  @@index([caseFileId])
}
```

`CaseFile.organisme` / `CaseFile.title` restent NOT NULL sans défaut : le **service** les renseigne (`organisme: INDETERMINE`, `title` = nom de fichier nettoyé). E3 les écrase à l'analyse.

### 3.2 Migration `back/prisma/migrations/<ts>_e2_import_documents/migration.sql`

Générer via `prisma migrate dev --create-only`, relire (aucun `INSERT`/`UPDATE` dans le fichier).

```sql
-- E2 — Import et lecture du document (ADR-011, ADR-015).
-- Aucune ligne n'utilise INDETERMINE / FICTIONAL_DOCUMENT ici : ADD VALUE sûr en transaction (PG >= 12).
-- Ne pas ajouter d'INSERT utilisant ces valeurs dans ce fichier.

ALTER TYPE "Organisme"   ADD VALUE 'INDETERMINE';
ALTER TYPE "ConsentType" ADD VALUE 'FICTIONAL_DOCUMENT';

ALTER TABLE "Document" RENAME COLUMN "filename" TO "originalName";
ALTER TABLE "Document" ADD COLUMN "extractedTextHash" TEXT;
```

### 3.3 Impacts

- `back/test/helpers/factories.ts` `seedCaseGraph` : `filename` → `originalName` ; `storagePath` → chemin relatif factice.
- `back/test/helpers/testDb.ts` `TABLES` : inchangé (`Document`, `ConsentLog`, `CaseFile` déjà listés).
- Aucun autre usage de `Document.filename` dans le code.

---

## 4. Infrastructure back

### 4.1 `src/server/storage/index.ts` (PR-A) — ADR-012

```
saveDocument(bytes: Buffer, ext: "pdf"|"png"|"jpeg"): Promise<{ storagePath: string }>
openDocumentStream(storagePath: string): NodeJS.ReadableStream
deleteDocument(storagePath: string): Promise<void>
```

- Racine = `env.STORAGE_DIR` (résolu absolu au boot). Nom = `randomUUID() + "." + ext`. Stockage plat ; `storagePath` en base = basename seul.
- `open`/`delete` : toujours `path.join(STORAGE_DIR, path.basename(storagePath))` → anti-traversal.
- Hors de toute racine servie : le back ne sert aucun static ; en prod Caddy ne mappe que `/api/*` et `/auth/*` (ADR-005). US-2.1 AC5 par construction.

### 4.2 `src/lib/magic-bytes.ts` (PR-A) — sans dépendance

```
detectKind(bytes: Buffer): "pdf" | "png" | "jpeg" | null
CANONICAL_MIME, EXT
```

- PDF `25 50 44 46 2D` (`%PDF-`) offset 0 · PNG `89 50 4E 47 0D 0A 1A 0A` · JPEG `FF D8 FF` · buffer < 8 octets ou inconnu → `null`.

### 4.3 `src/lib/filename.ts` (PR-A)

`safeName(name): string` — retire chemin, décode, retire `[\x00-\x1f\x7f]`, borne 120, repli non vide (« Document importé »). Utilisé pour `originalName` **et** `title` du `CaseFile`.

### 4.4 `src/server/pdf/extract.ts` (PR-B) — ADR-013 / ADR-016

```
extractPdfText(bytes: Buffer): Promise<{ text: string; pageCount: number }>
```

- Via `unpdf`. `try/catch` global : tout throw → `{ text: "", pageCount: 0 }` (parcours illisible), jamais de 500.
- Timeout `env.PDF_EXTRACT_TIMEOUT_MS` via `Promise.race` → dépassement = illisible.

### 4.5 `src/lib/useful-text.ts` (PR-B)

`usefulLength(text) = text.replace(/\s+/g," ").trim().length` · `SEUIL_ILLISIBLE = 100` (constante exportée par `@capclair/contract`).

### 4.6 `src/env.ts` + `back/.env.example` + `back/.gitignore`

| Variable | Zod | Défaut | PR |
|---|---|---|---|
| `STORAGE_DIR` | `z.string().min(1)` | `"storage"` (rel. à `back/`, gitignoré) | A |
| `MAX_UPLOAD_BYTES` | `z.coerce.number().int().positive()` | `10485760` | A |
| `PDF_MAX_PAGES` | `z.coerce.number().int().positive()` | `10` | B |
| `PDF_EXTRACT_TIMEOUT_MS` | `z.coerce.number().int().positive()` | `5000` | B |

- `env.ts` `VITEST_FALLBACK` : `STORAGE_DIR = join(tmpdir(), "capclair-vitest-storage")`.
- `vitest.workspace.ts` `unitEnv` : `STORAGE_DIR` + `MAX_UPLOAD_BYTES`.
- `test/setup.ts` : `STORAGE_DIR = mkdtempSync(join(tmpdir(),"capclair-it-"))` ; retourner un teardown `rmSync(..., { recursive:true, force:true })`.
- `back/.env.example` : section `# --- Stockage & extraction (E2) ---`, sans valeur.
- `back/.gitignore` : `/storage/`, `/storage-test/`.

---

## 5. Couche d'accès aux données

### 5.1 `src/server/database/repositories.ts`

```ts
// CaseFileRepository (+ PR-A)
create(data: { organisme; title }) // prisma.caseFile.create({ data: { userId: this.userId, ...data } })
// (US-5.5 adjacent) hardDeleteForUser(id)

// DocumentRepository (+ PR-A / PR-B)
createWithCase(data)                       // $transaction : caseFile.create + document.create (extractedText inclus)
deleteForUser(id): Promise<{ storagePath }>        // deleteMany scoped, renvoie le chemin pour purge disque
replaceFileForUser(id, data): Promise<{ oldStoragePath }>
setExtractedText(id, { text, hash })              // updateMany scoped (chemin `replace`)
listStoragePathsForCase(caseFileId)              // pour US-5.5

// ConsentLogRepository (+ PR-A, nouveau)
record({ caseFileId; consentType; granted; policyVersion })  // userId = this.userId
findLatest({ caseFileId; consentType })
```

### 5.2 `src/server/database/context.ts`

- `UserScopedDb` : + `readonly consentLogs: ConsentLogRepository`.
- `forUser()` : instancier `consentLogs`. `caseFiles` déjà exposé.

Règle ESLint `no-restricted-syntax` (Prisma direct interdit dans `features/**`) : le service documents passe **exclusivement** par `forUser()`.

---

## 6. Feature module `src/features/documents/`

Fichiers (miroir de `features/auth/`) : `documents.dto.ts` (barrel contrat), `documents.mapper.ts`, `documents.service.ts`, `documents.routes.ts`, `upload-validation.ts`, `index.ts` (`export { documentRoutes }`).

### 6.1 Endpoints (tous `/api`, scope gardé, `config: RATE_LIMITS.import`)

| Méthode / chemin | US | Corps | Réponse |
|---|---|---|---|
| `POST /api/documents` | 2.1, 2.4, 2.6 | multipart `file` | `201 { documentId, caseFileId, originalName, mimeType, kind:"pdf"\|"image", sizeBytes, pageCount?, extractedTextLength, readable }` |
| `POST /api/documents/:id/replace` | 2.2 AC2, 2.6 AC4 | multipart `file` | idem, **même** `caseFileId` |
| `GET /api/documents/:id` | 2.2 | — | `200` DTO métadonnées (sans `storagePath` ni contenu) |
| `GET /api/documents/:id/file` | 2.2 AC1/AC3 | — | flux binaire ; `content-type` = mime stocké ; `content-disposition: inline` (sans `filename`) ; `x-content-type-options: nosniff` ; CSP par-réponse (cf. décision #12) ; `Cache-Control: private, no-store` |
| `DELETE /api/documents/:id` | 2.2 AC2 | — | `204` ; supprime Document + fichier disque + `CaseFile` non analysé (`analysisStatus = EN_ATTENTE`, aucune `ExtractedInformation`) |
| `POST /api/documents/:id/confirm-fictional` | 2.3 AC2 | `{ confirmed: true }` (Zod) | `200 { ok:true }` ; **une** ligne `ConsentLog` `FICTIONAL_DOCUMENT` |

### 6.2 Flux `POST /api/documents` (ordre = rejet avant toute écriture)

1. `part = await request.file()` ; `buffer = await part.toBuffer()`.
2. **Taille** : `if (part.file.truncated || buffer.length > env.MAX_UPLOAD_BYTES) throw new AppError(413, DOCUMENT_MESSAGES.fileTooLarge, { code:"file_too_large" })` → « Ce fichier dépasse 10 Mo. Choisissez un fichier plus léger. »
3. **Signature** : `detectKind(buffer)` `null` → `throw new AppError(415, DOCUMENT_MESSAGES.wrongFormat, { code:"unsupported_media_type" })` → « Formats acceptés : PDF, PNG, JPEG. »
4. Si `kind === "pdf"` : `extractPdfText(buffer)` **en mémoire** ; `pageCount > env.PDF_MAX_PAGES` → `throw new AppError(422, DOCUMENT_MESSAGES.tooManyPages, { code:"too_many_pages" })` (ADR-014).
5. **Persistance** (rien écrit avant ici) : `storage.saveDocument` → `db.documents.createWithCase({ organisme:"INDETERMINE", title: safeName(part.filename), originalName: safeName(part.filename), mimeType: CANONICAL_MIME[kind], sizeBytes: buffer.length, storagePath, extractedText, extractedTextHash })` dans un `$transaction`. Sur échec après `saveDocument` : `storage.deleteDocument` best-effort puis re-throw.
6. `kind === "image"` : OCR coupé (US-2.5) → `text=""`, `len=0` → parcours illisible. `readable = len >= SEUIL_ILLISIBLE`.
7. **Aucun enfilement** : pas d'import `bullmq` dans `features/documents/**`. US-2.6 AC3 vérifié structurellement + test de non-appel.
8. `201`.

`replace` : idem à partir de l'étape 1, réutilise `caseFileId`, `replaceFileForUser`, supprime l'ancien fichier, ré-extrait (transition illisible → lisible sans recréer le dossier, US-2.6 AC4).

### 6.3 `src/app.ts`

```ts
import multipart from "@fastify/multipart";
import { documentRoutes } from "./features/documents/index.js";
...
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 4, parts: 6 } });
...
await app.register(async (secured) => {
  await secured.register(authGuard);
  secured.addHook("preHandler", secured.authenticate);
  secured.get("/api/_ping", ...);                 // conservé
  await secured.register(documentRoutes);         // + E2
});
```

Gestionnaire d'erreurs : branche `error instanceof AppError` déjà en place → 413/415/422 ressortent avec message exact. Ajouter **une** ligne défensive : `statusCode === 413` non-`AppError` → `code:"file_too_large"` (le front réaffiche `DOCUMENT_MESSAGES.fileTooLarge` depuis le contrat, message jamais dupliqué dans `app.ts`).

---

## 7. Contrat `@capclair/contract`

### 7.1 `contract/src/documents.ts` (nouveau — gabarit `auth.ts`)

```ts
export const DOCUMENT_MESSAGES = {
  fileTooLarge: "Ce fichier dépasse 10 Mo. Choisissez un fichier plus léger.",
  wrongFormat: "Formats acceptés : PDF, PNG, JPEG.",
  tooManyPages: "Ce PDF compte plus de 10 pages. Importez un courrier de 10 pages maximum.",
  unreadable: "Nous n'avons pas réussi à lire ce document.",
  unreadableSuggestions: [
    "Scannez le document plutôt que de le photographier.",
    "Placez-vous dans un endroit bien éclairé et mettez le courrier à plat.",
    "Si vous avez un PDF généré par ordinateur, importez-le plutôt qu'une photo.",
  ],
  fictionalRequired: "Vous devez confirmer que ce document est fictif.",
} as const;

export const ACCEPTED_MIME = ["application/pdf","image/png","image/jpeg"] as const;
export const ACCEPTED_EXT  = [".pdf",".png",".jpg",".jpeg"] as const;
export const MAX_UPLOAD_BYTES = 10_485_760;
export const UNREADABLE_TEXT_THRESHOLD = 100;

export const UploadDocumentResponseSchema = z.object({
  documentId: z.string(), caseFileId: z.string(), originalName: z.string(),
  mimeType: z.enum(ACCEPTED_MIME), kind: z.enum(["pdf","image"]),
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().positive().optional(),
  extractedTextLength: z.number().int().nonnegative(), readable: z.boolean(),
});
export const DocumentMetadataSchema = z.object({
  id: z.string(), caseFileId: z.string(), originalName: z.string(),
  mimeType: z.string(), sizeBytes: z.number().int(), createdAt: z.string(),
});
export const ConfirmFictionalInputSchema = z.object({ confirmed: z.literal(true) });
// + types inférés
```

### 7.2 `contract/src/paths.ts`

```ts
export const DOCUMENT_PATHS = {
  UPLOAD: "/api/documents",
  detail: (id: string) => `/api/documents/${id}`,
  file:   (id: string) => `/api/documents/${id}/file`,
  replace:(id: string) => `/api/documents/${id}/replace`,
  confirmFictional: (id: string) => `/api/documents/${id}/confirm-fictional`,
} as const;
```

### 7.3 `contract/src/index.ts` : `export * from "./documents.js";`

Rappel ADR-003/007 : `npm run build --workspace @capclair/contract` avant back/front.

---

## 8. Frontend `front/` (PR-C)

- `src/lib/api/client.ts` : support `FormData` — `const isForm = options.body instanceof FormData; if (hasBody && !isForm) headers["content-type"]="application/json"; body: hasBody ? (isForm ? options.body : JSON.stringify(options.body)) : undefined`.
- `src/lib/api/documents.ts` (nouveau) : `uploadDocument(file)`, `replaceDocument(id,file)`, `deleteDocument(id)`, `confirmFictional(id)`, `documentFileSrc(id)` = `${BROWSER_API_BASE}${DOCUMENT_PATHS.file(id)}`.
- `src/lib/validation/documents.ts` (+ `.test.ts`) : re-export schémas contrat + `validateFile(file): string | null` (taille/extension avant upload ; serveur = autorité).
- `src/app/(app)/importer/page.tsx` : Server Component fin, `<h1>` + `<ImportForm />` ; hérite garde + `<AppHeader>` du `(app)/layout.tsx`.
- `src/components/documents/import-form.tsx` (`"use client"`) : machine `idle → uploading → ready(readable) → ready(unreadable) → error` ; layout 2 colonnes (formulaire / aperçu, maquette écran 03).
  - Fichier choisi/déposé → `validateFile` → `uploadDocument` → stocke la réponse.
  - « Retirer » → `deleteDocument(id)` → `idle` (US-2.2 AC2).
  - « Choisir un autre fichier » (état normal ou illisible) → `replaceDocument(id, newFile)` (conserve `caseFileId`, US-2.6 AC4).
  - État illisible : `<Alert tone="error">` `DOCUMENT_MESSAGES.unreadable` + `<ul>` des 3 suggestions ; case fictif + « Lancer l'analyse » désactivés (US-2.6 AC1/AC2).
  - `<CheckboxField label="Je confirme que ce document est fictif" />` (primitive existante), désactivée tant que `!readable` ; au cochage → `confirmFictional(id)` (US-2.3 AC1/AC2).
  - « Lancer l'analyse » : `disabled = !readable || !fictionalConfirmed` ; en E2 → `confirmFictional` si besoin puis `router.push(\`/dossiers/${caseFileId}\`)` (placeholder E3, décision #9).
  - « Annuler » → `deleteDocument(id)` + `router.push("/dashboard")`.
  - `err.isRateLimited` → afficher `err.message`.
- `src/components/documents/dropzone.tsx` : zone pointillée ~150 px, `onDragOver/Leave/Drop` + `<input type="file" hidden accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg">` déclenché au clic ; icône `ri-upload-2-line` (`@remixicon/react` déjà dispo). US-2.1 AC6.
- `src/components/documents/document-preview.tsx` : `kind==="pdf"` → `<iframe src={documentFileSrc(id)} title="Aperçu du document">` ; image → `<img src={documentFileSrc(id)} alt="Aperçu du document">` ; `onError` → « Aperçu indisponible dans ce navigateur » + lien « Ouvrir dans un nouvel onglet ». Cookie first-party envoyé automatiquement (même origine via rewrite `next.config.ts`). US-2.2 AC1.
- `src/middleware.ts` : matcher `["/dashboard/:path*","/dossiers/:path*","/importer/:path*"]` ; `src/middleware.test.ts` : `/importer` sans cookie → `/connexion?next=/importer`.
- `src/app/(app)/dashboard/page.tsx` : bouton `<Link href="/importer">` « + Importer un courrier » + texte d'état vide.

Aucune nouvelle dépendance front. Repli `pdfjs-dist` hors périmètre.

---

## 9. Tests

### 9.1 Fixtures `back/test/fixtures/`

`courrier-1p.pdf` (1 page, date+montant+référence connus) · `scanne-vide.pdf` (< 100 car. utiles) · `many-pages.pdf` (≥ 11 pages) · `pixel.png`, `pixel.jpg` · `faux.pdf` (extension `.pdf`, octets texte) · `png-en-pdf.pdf` (extension/`content-type` PDF, octets PNG) · gros buffer généré au test.

### 9.2 Unitaires (`src/**/*.test.ts`, projet `unit`)

- `lib/magic-bytes.test.ts` : détection pdf/png/jpeg ; extension usurpée démasquée ; buffer vide/tronqué → `null`.
- `lib/useful-text.test.ts` : bornes 99 vs 100, compactage espaces, sauts de ligne.
- `lib/filename.test.ts` : `../../etc/passwd` → `passwd` ; `a"b\r\nc.pdf` sans `"`/CRLF ; `''` → repli ; 500 car. → ≤ 120.
- `server/pdf/extract.test.ts` : import ne jette pas ; `courrier-1p.pdf` → texte + `pageCount===1` + `< 5000 ms` ; buffer corrompu → `{ text:"", pageCount:0 }` sans throw ; `scanne-vide.pdf` → `usefulLength < 100`.
- `server/storage/index.test.ts` : `save` → fichier `<uuid>.<ext>` sous `STORAGE_DIR` ; `openDocumentStream` restitue les octets ; `delete` supprime ; `storagePath` avec `../` neutralisé.
- `features/documents/documents.dto.test.ts` : `ConfirmFictionalInputSchema` rejette `{confirmed:false}` ; `UploadDocumentResponseSchema` round-trip ; `assertValidUpload` lève la bonne `AppError` par cas.

### 9.3 Intégration (`test/integration/**`, Postgres `_test`, `truncateAll` en `beforeEach`)

Helper `test/helpers/documents.ts` : `uploadFixture(app, cookie, fixtureName, { filename?, contentType?, remoteAddress? })`. Convention : **une IP par fichier de test** (`198.51.100.x`), IP dédiée pour le test rate-limit (`203.0.113.42`).

- `documents.upload.test.ts` : `401` sans cookie (`POST /api/documents` et `GET /file`) · PDF lisible `201` + forme + `Document.originalName` = nom envoyé + `storagePath` basename `/^[0-9a-f-]{36}\.(pdf|png|jpe?g)$/` + fichier présent sous `STORAGE_DIR` + `CaseFile` `organisme:"INDETERMINE"` · `faux.pdf` → `415` message exact · `png-en-pdf.pdf` → `201` `kind:"image"` · buffer `MAX+1` → `413` message exact (égalité stricte) · `many-pages.pdf` → `422` message documenté · `scanne-vide.pdf` → `201` `readable:false` + aucun `ConsentLog` IA + `analysisStatus` inchangé + `extractedText` stocké · image PNG/JPEG → `201` `readable:false` sans plantage · cross-compte → `404` (`GET /:id` et `/file`) · échec forcé de `createWithCase` → 0 `CaseFile` en base + `STORAGE_DIR` vide.
- `documents.preview.test.ts` : propriétaire `GET /file` → `200`, `content-type` = mime stocké, `content-disposition:"inline"`, `x-content-type-options:"nosniff"`, CSP contient `sandbox`, octets == upload.
- `documents.extraction.test.ts` : `courrier-1p.pdf` → `extractedText` contient date/montant/référence + `extractedTextHash` non nul + durée bout-en-bout `< 5000 ms`.
- `documents.corpus.test.ts` : `describe.skipIf(!existsSync(datasetPath))` ; pour chaque entrée, upload → `normalize(extractedText).toContain(normalize(fragment))` pour `echeance.source_excerpt`, `actions_attendues[].source_excerpt`, `montants[].valeur`, partie numérique de `reference_personne` ; message d'échec avec `id`+`fragment` ; compteur « X/Y fragments par courrier ».
- `documents.replace.test.ts` : `caseFileId` conservé, ancien fichier disque supprimé, ré-extraction, transition `readable:false → true`.
- `documents.delete.test.ts` : supprime Document + fichier + `CaseFile` non analysé ; `GET` suivant → `404`.
- `documents.fictional.test.ts` : `POST /:id/confirm-fictional` → **une** ligne `ConsentLog { consentType:"FICTIONAL_DOCUMENT", granted:true, policyVersion: LEGAL_BUNDLE_VERSION, userId, caseFileId }` ; `{confirmed:false}` → `400` ; cross-compte → `404`.
- `documents.ratelimit.test.ts` : IP dédiée, `RATE_LIMIT_IMPORT_MAX+1` requêtes (fixture 70 octets) → dernier `429` + `code:"rate_limited"` + `error` `/^Trop de tentatives\. Réessayez dans .+\.$/` + header `retry-after` (mêmes assertions que `auth.login.test.ts`). Test voisin avec autre IP → `201` (isolation par IP).
- `documents.logs.test.ts` : stream de capture sur le `logger` pino ; upload + extraction + cas illisible → la sortie ne contient ni `originalName` envoyé ni fragment connu de `extractedText` (US-8.2).

### 9.4 Front (`front/src/**/*.test.ts`)

- `lib/validation/documents.test.ts` : `validateFile` → bon message surtaille / mauvais type / OK.
- `middleware.test.ts` : `/importer` sans cookie.

---

## 10. Documentation

### 10.1 `07-developpement/decisions.md` — nouvelles ADR

- **ADR-011** — Import : création du `CaseFile` dès le dépôt ; `Organisme.INDETERMINE`. `title` = nom de fichier nettoyé ; `caseFileId` NOT NULL (1 doc ↔ 1 dossier MVP) ; E3 écrase `organisme`/`title`. Re-import via `replace` (US-2.6 AC4) ; suppression avant analyse → dossier + document. La suppression de dossier E5 (US-5.5) réutilise `documentsService.purge`.
- **ADR-012** — Stockage : volume local monté, module `server/storage`, `STORAGE_DIR` hors racine servie, noms UUID, `storagePath` relatif, anti-traversal par basename, abstraction pour S3/MinIO. Pas d'antivirus au MVP. Note dimensionnement mémoire conteneur `web`.
- **ADR-013** — Extraction PDF synchrone dans la requête web ; frontière E2/E3 = enfilement BullMQ ; barrière < 100 car. utiles = arrêt sans dossier d'analyse ni appel externe (test).
- **ADR-014** — PDF > 10 pages : rejet `422` avec message explicite. Justif : SLA < 5 s + budget jetons IA. Statut : à confirmer PO.
- **ADR-015** — `ConsentType` : `FICTIONAL_DOCUMENT` ajouté en E2 ; renommage `ANALYSE_IA → AI_PROCESSING` reporté E3/US-3.1 (complète ADR-006).
- **ADR-016** — Librairie extraction PDF : `unpdf` (ESM, maintenu, sans effet de bord fichier) plutôt que `pdf-parse`. Encapsulé derrière `server/pdf/extract.ts`. Plan B : `pdf-parse/lib/pdf-parse.js`.

### 10.2 Autres

- `07-developpement/README.md` : nouvelles variables d'env, `back/storage/` gitignoré, emplacement du corpus pour `documents.corpus.test.ts`, module `features/documents/`.
- `back/.env.example` : section stockage/extraction.
- **US-8.1 #48** : les routes d'import portent `config: RATE_LIMITS.import` → il ne reste que les routes d'analyse (E3) pour clore #48.

---

## 11. Découpage en PR

### PR-A — Socle : schéma, stockage, upload + validation, dossier/document, rate-limit
Satisfait : **US-2.1 (AC1–6)**, **US-2.2 AC2 + AC3**, US-8.1 #48 partiel.

Créer : `back/prisma/migrations/<ts>_e2_import_documents/migration.sql` · `back/src/lib/magic-bytes.ts` (+test) · `back/src/lib/filename.ts` (+test) · `back/src/features/documents/{documents.dto.ts,documents.mapper.ts,documents.service.ts,documents.routes.ts,upload-validation.ts}` · `contract/src/documents.ts` · `back/test/helpers/documents.ts` · `back/test/fixtures/*` · `back/test/integration/{documents.upload,documents.preview,documents.delete,documents.ratelimit}.test.ts` · `back/src/server/storage/index.test.ts`

Modifier : `back/prisma/schema.prisma` · `back/src/env.ts` (+ `VITEST_FALLBACK`) · `back/.env.example` · `back/.gitignore` · `back/src/server/storage/index.ts` · `back/src/server/database/repositories.ts` · `back/src/server/database/context.ts` · `back/src/features/documents/index.ts` · `back/src/app.ts` · `back/package.json` (+`@fastify/multipart@~9`) · `contract/src/paths.ts` · `contract/src/index.ts` · `back/test/helpers/factories.ts` · `back/test/setup.ts` · `back/vitest.workspace.ts`

Dépendances : `@fastify/multipart` (~9.x, Fastify 5).

### PR-B — Extraction PDF, barrière illisible, consentement fictif
Satisfait : **US-2.3 (AC1–2)**, **US-2.4 (AC1–4)**, **US-2.6 (AC1–4)**, **US-2.5** (image acceptée → illisible).

Créer : `back/src/server/pdf/extract.ts` (+test) · `back/src/lib/useful-text.ts` (+test) · `back/test/integration/{documents.extraction,documents.corpus,documents.unreadable,documents.fictional,documents.replace,documents.logs}.test.ts` · fixtures `scanne-vide.pdf`, `many-pages.pdf`

Modifier : `back/src/features/documents/documents.service.ts` · `documents.routes.ts` (+ `replace`, + `confirm-fictional`) · `back/src/server/database/repositories.ts` (`setExtractedText`, `replaceFileForUser`, `ConsentLogRepository`) · `back/src/env.ts` (`PDF_MAX_PAGES`, `PDF_EXTRACT_TIMEOUT_MS`) · `back/.env.example` · `back/vitest.workspace.ts` · `contract/src/documents.ts` · `back/src/lib/logger.ts` (redact, décision #14) · `back/package.json` (+`unpdf`) · `07-developpement/decisions.md` · `07-developpement/README.md`

Dépendances : `unpdf` (ou `pdf-parse` + `@types/pdf-parse`).

### PR-C — Écran `/importer` (front)
Satisfait : volet UI **US-2.1 AC6**, **US-2.2 AC1–2**, **US-2.3 AC1**, **US-2.6 AC2/AC4**.

Créer : `front/src/lib/api/documents.ts` · `front/src/lib/validation/documents.ts` (+test) · `front/src/app/(app)/importer/page.tsx` · `front/src/components/documents/{import-form.tsx,dropzone.tsx,document-preview.tsx}`

Modifier : `front/src/lib/api/client.ts` · `front/src/middleware.ts` · `front/src/middleware.test.ts` · `front/src/app/(app)/dashboard/page.tsx`

Dépendances : aucune.

---

## 12. Analyse détaillée des risques

### 12.1 `@fastify/multipart` contourne la validation Zod du contrat
Le corps multipart n'a pas de `schema.body` → la seule validation est impérative. **Mitigation** : pas de `schema.body` sur les routes d'upload ; validation centralisée dans `upload-validation.ts` (`assertValidUpload(buffer, filename)`) réutilisable ; `schema.params` (uuid) reste actif ; commentaire d'en-tête dans `documents.routes.ts`. **Test** : `documents.dto.test.ts` (chaque `AppError`) + intégration `POST` sans partie fichier → `400` propre, pas de 500. **Résiduel** : faible ; toute future route multipart doit réutiliser `assertValidUpload`.

### 12.2 `part.file.truncated` et mapping du 413 vers le message exact
`truncated` n'est renseigné **qu'après** `toBuffer()`. Le handler global actuel traduirait `FST_ERR_CTP_BODY_TOO_LARGE` en « Requête invalide. » → AC2 échoue. **Mitigation** : lire via `toBuffer()`, tester `truncated || length > MAX`, lever soi-même `AppError(413, DOCUMENT_MESSAGES.fileTooLarge)` (branche `AppError` du handler → message tel quel) ; `limits.fileSize` = garde-fou mémoire ; ligne défensive `app.ts` mappant un 413 résiduel vers `code:"file_too_large"` sans message métier (front réaffiche depuis le contrat). **Test** : payload `MAX+1` → `res.json().error` === message exact (égalité stricte). **Résiduel** : moyen-faible, dépend de la version du plugin → verrouiller `~9.x` + test qui casse à la régression.

### 12.3 `pdf-parse` : effet de bord `module.parent` et maintenance
`pdf-parse@1.1.1` lit un fichier local à l'import quand `!module.parent` (contexte ESM/`tsx`/Vitest = celui du repo) ; paquet non maintenu. **Mitigation** : `unpdf` (ADR-016), isolé dans `server/pdf/extract.ts` (un seul point de dépendance), `try/catch` → `{ text:"", pageCount:0 }`. **Test** : `extract.test.ts` s'exécute dans le contexte à risque → l'import ne jette pas ; corpus 15 PDF via `documents.corpus.test.ts`. **Résiduel** : faible-moyen ; `unpdf` embarque `pdfjs` (polyfills DOM possibles) — chemin « texte seul » n'en a pas besoin ; valider au spike PR-B. Plan B : `pdf-parse/lib/pdf-parse.js`.

### 12.4 `ALTER TYPE ... ADD VALUE` et la transaction de migration
PG interdit d'**utiliser** une valeur d'enum dans la transaction de son `ADD VALUE`. **Analyse** : la migration n'insère aucune ligne utilisant `INDETERMINE`/`FICTIONAL_DOCUMENT` → contrainte non violée ; PG ≥ 12 accepte `ADD VALUE` en transaction sans usage ultérieur → passe telle quelle. Seul cas cassant : un `INSERT` utilisant ces valeurs ajouté au même fichier. **Mitigation** : `--create-only` + relecture (aucun `INSERT`/`UPDATE`) ; commentaire d'en-tête ; création `CaseFile` `INDETERMINE` au runtime uniquement ; `migrate deploy` en CI (déjà branché via `test/helpers/testDb.ts`). **Test** : `test/setup.ts` applique toutes les migrations avant la suite ; + un test créant `CaseFile INDETERMINE` et `ConsentLog FICTIONAL_DOCUMENT`. **Résiduel** : très faible (garde-fou humain + CI).

### 12.5 Nettoyage disque et isolation de `STORAGE_DIR` en test
`truncateAll` ne vide que Postgres ; chaque upload écrit un vrai fichier ; risque d'accumulation et de faux positifs sur la preview. **Mitigation** : `test/setup.ts` crée `mkdtempSync(...)` par run, `process.env.STORAGE_DIR = ...`, retourne un teardown `rmSync(recursive, force)` ; `VITEST_FALLBACK` + `unitEnv` fournissent un `STORAGE_DIR` ; `server/storage/index.test.ts` isole ses fichiers en `mkdtemp` + `afterEach` ; `.gitignore` `/storage/`, `/storage-test/`. **Test** : après upload, `existsSync(join(STORAGE_DIR, basename(storagePath)))` + regex UUID ; après `DELETE`, le fichier n'existe plus. **Résiduel** : faible ; dépendance implicite au `--no-file-parallelism` de `test:int` (déjà en place).

### 12.6 US-2.4 AC1 : dataset orienté « sortie d'analyse », pas « texte brut »
`dataset-reference.json` décrit le résultat d'analyse (champs `source_excerpt`, `echeance.type`…), dates en toutes lettres, `montants` variables. **Analyse** : suffisant pour une assertion **de sur-ensemble** en n'extrayant que les fragments littéraux (`echeance.source_excerpt`, `actions_attendues[].source_excerpt` — « extraits exacts » par construction du corpus —, `montants[].valeur`, partie numérique de `reference_personne`) et en normalisant (minuscules, espaces/nbsp, apostrophes). Ne pas asserter `date_courrier` en toutes lettres tel quel. **Mitigation** : `documents.corpus.test.ts` `skipIf` + assertions `toContain` normalisées + compteur « X/Y fragments ». Documenter la limite dans le PR. **Résiduel** : moyen — **à trancher avec le PO** (décision #11) : accepter « vérif par sur-ensemble » ou produire le fichier d'attentes extraction dédié.

### 12.7 Aperçu PDF via `<iframe>` : navigateur, `nosniff`, contenu actif
**7a rendu** : dépend du visualiseur PDF natif ; absent sur navigateur verrouillé → aperçu in-page KO. **7b `nosniff`** (actif via helmet, `app.ts:39` ne désactive que la CSP) : le navigateur refuse de rendre si `Content-Type` ≠ contenu réel. **7c contenu actif** : un PDF peut embarquer du JS. **Mitigation** : `Content-Type` = mime canonique déduit des magic bytes (toujours exact) ; `Content-Disposition: inline` sans `filename` ; `x-content-type-options: nosniff` explicite ; CSP par-réponse `default-src 'none'; object-src 'self'; sandbox` (ou `Cross-Origin-Resource-Policy: same-origin` si le viewer casse — décision #12) ; images via `<img>` (aucune de ces incertitudes) ; `onError` front → lien « ouvrir dans un nouvel onglet » ; repli `pdfjs-dist` documenté hors périmètre. **Test** : `documents.preview.test.ts` assert les en-têtes + octets ; le rendu navigateur (7a) → recette manuelle Chrome/Firefox en PR-C. **Résiduel** : faible images, faible-moyen PDF (rendu + compatibilité `sandbox`).

### 12.8 US-5.5 et US-8.2 adjacents — ne pas installer de dette
**US-5.5** : cascade DB OK (`Document.onDelete: Cascade`) ; les fichiers disque ne sont pas en cascade → E2 expose `listStoragePathsForCase` + fait du `DELETE /api/documents/:id` un service (`purge`) que US-5.5 généralisera au dossier analysé ; ADR-011 le mentionne. Orphelins disque sur crash : inoffensifs (UUID, hors web), purge balai possible avec la rétention 12 mois. **US-8.2** : `disableRequestLogging: !isProd` → request-logging actif en prod ; un `request.log` maladroit fuiterait `originalName`. E2 pose : convention champs loggables (`documentId`, `caseFileId`, `kind`, `sizeBytes`, `pageCount`, `readable`, `extractedTextLength` uniquement), `redact` pino sur `originalName`/`extractedText`/`filename` (décision #14), `AuditEvent.metadata` sans contenu, `documents.logs.test.ts` (capture de logs). **Résiduel** : faible si la convention + le `redact` sont tenus.

### 12.9 Atomicité de l'upload : 3 écritures non transactionnelles
Fichier disque + `CaseFile` + `Document` : échec intermédiaire → orphelins. **Mitigation** : tout valider (signature, taille, extraction+pages **en mémoire**) **avant** toute écriture ; `createWithCase` = `$transaction` (`CaseFile` + `Document` avec `extractedText` inclus, plus de `setExtractedText` séparé sur ce chemin) ; sur échec après `saveDocument` → `deleteDocument` best-effort puis re-throw. **Test** : échec forcé de `createWithCase` → `caseFile.count() === 0` + `STORAGE_DIR` vide ; PDF > 10 pages → 0 `CaseFile` + `STORAGE_DIR` vide. **Résiduel** : faible ; crash entre commit DB et réponse HTTP → doublon possible sur retry client, acceptable MVP.

### 12.10 Empreinte mémoire : `toBuffer()` = 10 Mo/requête en RAM
Avec `RATE_LIMIT_IMPORT_MAX = 20`, pic concurrent = dizaines de buffers 10 Mo. **Mitigation** : `limits` multipart (`files:1`, `fileSize`, `parts:6`) ; un seul `Buffer` réutilisé pour `detectKind` + `unpdf` + `saveDocument` ; note dimensionnement conteneur `web` dans ADR-012 ; évolution streaming possible hors E2. **Test** : non pertinent en unit/intégration ; le test `413` prouve la coupure au plafond. **Résiduel** : négligeable au volume MVP.

### 12.11 Injection d'en-tête via `originalName` dans `Content-Disposition`
`part.filename` est contrôlé par le client (CRLF, `"`, `;`…). **Mitigation** : `Content-Disposition: inline` **sans** `filename` sur la route d'aperçu (choix volontaire) ; `safeName()` retire chemins + `[\x00-\x1f\x7f]` + borne 120, appliqué avant stockage sur `originalName` et `title` ; futur endpoint de téléchargement → `filename*` RFC 5987. **Test** : `filename.test.ts` (traversal, guillemets, CRLF, vide, longueur) ; intégration `filename: 'x";evil.pdf'` → `Document.originalName` nettoyé en base, en-tête `content-disposition` === `"inline"`. **Résiduel** : très faible.

### 12.12 `unpdf`/`pdfjs` sous Node : polyfills et démarrage à froid
`pdfjs` peut réclamer `DOMMatrix`/`Path2D` (surtout rendu) ; coût de 1ᵉʳ appel non nul vs SLA < 5 s. **Mitigation** : spike début PR-B (temps 1ᵉʳ vs 2ᵉ appel sur les 15 PDF) ; API « texte seul » (pas de `renderPageAsImage`) ; `PDF_EXTRACT_TIMEOUT_MS` (5000) via `Promise.race` → dépassement = illisible, pas de 500 ni requête pendante ; polyfill éventuel confiné à `extract.ts`. **Test** : `extract.test.ts` mesure `< 5000 ms` (idéal < 2000) ; `documents.extraction.test.ts` bout-en-bout ; `documents.corpus.test.ts` échoue si un PDF dépasse le budget. **Résiduel** : faible-moyen, levé par le spike. Plan B : `pdf-parse/lib/pdf-parse.js`.

### 12.13 `getApp()` mémoïsé : multipart enregistré une fois, store rate-limit partagé
Le store rate-limit `import` n'est pas réinitialisé entre tests (ADR-009) → un test qui consomme le quota impacte les suivants sur la même IP. **Mitigation** : **une IP par fichier de test** (`198.51.100.x`) ; `documents.ratelimit.test.ts` sur IP dédiée (`203.0.113.42`), `MAX+1` requêtes avec fixture 70 octets (pas d'extraction 21×), assertions alignées sur `auth.login.test.ts` (`429`, `code:"rate_limited"`, `error` regex, `retry-after`) ; test voisin autre IP → `201` (isolation). Convention documentée en tête de `test/helpers/documents.ts`. **Résiduel** : faible si la convention IP est tenue.

---

## 13. Fichiers les plus critiques

- `back/prisma/schema.prisma` + `back/prisma/migrations/<ts>_e2_import_documents/migration.sql`
- `back/src/app.ts`
- `back/src/server/database/repositories.ts` (+ `context.ts`)
- `back/src/features/documents/documents.service.ts` (+ `documents.routes.ts`, `upload-validation.ts`)
- `back/src/server/storage/index.ts` et `back/src/server/pdf/extract.ts`
- `contract/src/documents.ts`
- `front/src/components/documents/import-form.tsx` (+ `front/src/lib/api/client.ts`)
