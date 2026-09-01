/**
 * Service d'import de documents (US-2.1, US-2.2).
 *
 * Ne touche jamais Prisma directement (règle ESLint) : passe par `UserScopedDb`
 * (`server/database/context.ts`). L'extraction de texte PDF et la barrière
 * "illisible" (US-2.4, US-2.6) arrivent en PR-B — ce service stocke le fichier
 * et crée le dossier/document sans encore lire le contenu du PDF.
 */
import type { UserScopedDb } from "../../server/database/context.js";
import { CANONICAL_MIME, EXT, type DetectedKind } from "../../lib/magic-bytes.js";
import { safeName } from "../../lib/filename.js";
import * as storage from "../../server/storage/index.js";
import { assertValidUpload } from "./upload-validation.js";

export interface UploadedFilePart {
  buffer: Buffer;
  /** `part.file.truncated` — fiable seulement après lecture complète du flux. */
  truncated: boolean;
  filename: string;
}

export interface UploadDocumentResult {
  documentId: string;
  caseFileId: string;
  originalName: string;
  mimeType: (typeof CANONICAL_MIME)[DetectedKind];
  kind: "pdf" | "image";
  sizeBytes: number;
}

function toKindLabel(kind: DetectedKind): "pdf" | "image" {
  return kind === "pdf" ? "pdf" : "image";
}

/**
 * Valide, stocke, puis crée le dossier + document (transaction unique — voir
 * `DocumentRepository.createWithCase`). Rien n'est écrit (disque ou base) tant
 * que la validation n'a pas réussi ; un échec après l'écriture disque purge le
 * fichier avant de propager l'erreur (pas d'orphelin sur le chemin d'échec).
 */
export async function uploadDocument(
  db: UserScopedDb,
  part: UploadedFilePart,
): Promise<UploadDocumentResult> {
  const kind = assertValidUpload(part.buffer, part.truncated);
  const name = safeName(part.filename);
  const mimeType = CANONICAL_MIME[kind];

  const { storagePath } = await storage.saveDocument(part.buffer, EXT[kind]);
  try {
    const { caseFile, document } = await db.documents.createWithCase({
      organisme: "INDETERMINE",
      title: name,
      originalName: name,
      mimeType,
      sizeBytes: part.buffer.length,
      storagePath,
    });
    return {
      documentId: document.id,
      caseFileId: caseFile.id,
      originalName: document.originalName,
      mimeType,
      kind: toKindLabel(kind),
      sizeBytes: document.sizeBytes,
    };
  } catch (err) {
    await storage.deleteDocument(storagePath).catch(() => {});
    throw err;
  }
}

/** 404 (jamais 403) si le document n'existe pas ou appartient à un autre compte. */
export function getDocumentMetadata(db: UserScopedDb, documentId: string) {
  return db.documents.findByIdForUser(documentId);
}

export interface DocumentFile {
  mimeType: string;
  stream: NodeJS.ReadableStream;
}

/** Route d'aperçu authentifiée (US-2.2 AC1/AC3) : 404 si absent/autre compte. */
export async function openDocumentFile(
  db: UserScopedDb,
  documentId: string,
): Promise<DocumentFile> {
  const doc = await db.documents.findByIdForUser(documentId);
  return { mimeType: doc.mimeType, stream: storage.openDocumentStream(doc.storagePath) };
}

/**
 * Retrait avant analyse (US-2.2 AC2) : supprime le document, purge le fichier
 * disque (best-effort — un orphelin est inoffensif, nom UUID hors racine web),
 * et supprime le dossier s'il n'a pas encore été analysé (1 doc ↔ 1 dossier
 * au MVP, ADR-011).
 */
export async function removeDocument(db: UserScopedDb, documentId: string): Promise<void> {
  const doc = await db.documents.findByIdForUser(documentId); // 404 si absent/autre compte
  const { storagePath } = await db.documents.deleteForUser(doc.id);
  await db.caseFiles.deleteIfUnanalyzed(doc.caseFileId);
  await storage.deleteDocument(storagePath).catch(() => {});
}
