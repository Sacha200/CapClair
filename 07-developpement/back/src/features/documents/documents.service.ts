/**
 * Service d'import de documents (US-2.1 à US-2.4, US-2.6).
 *
 * Ne touche jamais Prisma directement (règle ESLint) : passe par `UserScopedDb`
 * (`server/database/context.ts`).
 *
 * Frontière E2/E3 (ADR-013) : l'extraction PDF est synchrone dans la requête ;
 * AUCUN enfilement BullMQ ici — la barrière « illisible » (< 100 caractères
 * utiles, US-2.6 AC1/AC3) arrête le parcours sans appel externe.
 */
import { createHash } from "node:crypto";
import type { UserScopedDb } from "../../server/database/context.js";
import { CANONICAL_MIME, EXT, type DetectedKind } from "../../lib/magic-bytes.js";
import { safeName } from "../../lib/filename.js";
import { isReadable, usefulLength } from "../../lib/useful-text.js";
import { AppError } from "../../lib/errors.js";
import { env } from "../../env.js";
import { LEGAL_BUNDLE_VERSION } from "../../lib/legal.js";
import * as storage from "../../server/storage/index.js";
import { extractPdfText } from "../../server/pdf/extract.js";
import { assertValidUpload } from "./upload-validation.js";
import { DOCUMENT_MESSAGES } from "./documents.dto.js";

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
  /** Absent pour une image (pas d'extraction au MVP, US-2.5 coupée). */
  pageCount?: number;
  extractedTextLength: number;
  readable: boolean;
}

function toKindLabel(kind: DetectedKind): "pdf" | "image" {
  return kind === "pdf" ? "pdf" : "image";
}

interface ValidatedUpload {
  kind: DetectedKind;
  name: string;
  mimeType: (typeof CANONICAL_MIME)[DetectedKind];
  /** `null` quand rien n'a été extrait (image, PDF illisible). */
  extractedText: string | null;
  extractedTextHash: string | null;
  pageCount?: number;
  extractedTextLength: number;
  readable: boolean;
}

/**
 * Valide puis extrait, ENTIÈREMENT en mémoire : aucun octet n'est écrit
 * (disque ou base) tant que cette étape n'a pas réussi — le rejet 413/415/422
 * ne laisse jamais d'orphelin (plan E2 §12.9).
 *
 * Image (US-2.5 coupée, décision C1) : OCR non branché → texte vide, parcours
 * « illisible » (US-2.6), sans erreur.
 */
async function validateAndExtract(part: UploadedFilePart): Promise<ValidatedUpload> {
  const kind = assertValidUpload(part.buffer, part.truncated);
  const name = safeName(part.filename);
  const mimeType = CANONICAL_MIME[kind];

  if (kind !== "pdf") {
    return {
      kind,
      name,
      mimeType,
      extractedText: null,
      extractedTextHash: null,
      extractedTextLength: 0,
      readable: false,
    };
  }

  const { text, pageCount } = await extractPdfText(part.buffer);
  if (pageCount > env.PDF_MAX_PAGES) {
    throw new AppError(422, DOCUMENT_MESSAGES.tooManyPages, { code: "too_many_pages" });
  }
  const length = usefulLength(text);
  return {
    kind,
    name,
    mimeType,
    extractedText: length > 0 ? text : null,
    extractedTextHash:
      length > 0 ? createHash("sha256").update(text, "utf8").digest("hex") : null,
    pageCount,
    extractedTextLength: length,
    readable: isReadable(text),
  };
}

/**
 * Valide, extrait, stocke, puis crée le dossier + document (transaction unique
 * — voir `DocumentRepository.createWithCase`). Un échec après l'écriture disque
 * purge le fichier avant de propager l'erreur (pas d'orphelin).
 */
export async function uploadDocument(
  db: UserScopedDb,
  part: UploadedFilePart,
): Promise<UploadDocumentResult> {
  const upload = await validateAndExtract(part);

  const { storagePath } = await storage.saveDocument(part.buffer, EXT[upload.kind]);
  try {
    const { caseFile, document } = await db.documents.createWithCase({
      organisme: "INDETERMINE",
      title: upload.name,
      originalName: upload.name,
      mimeType: upload.mimeType,
      sizeBytes: part.buffer.length,
      storagePath,
      extractedText: upload.extractedText,
      extractedTextHash: upload.extractedTextHash,
    });
    return {
      documentId: document.id,
      caseFileId: caseFile.id,
      originalName: document.originalName,
      mimeType: upload.mimeType,
      kind: toKindLabel(upload.kind),
      sizeBytes: document.sizeBytes,
      ...(upload.pageCount !== undefined ? { pageCount: upload.pageCount } : {}),
      extractedTextLength: upload.extractedTextLength,
      readable: upload.readable,
    };
  } catch (err) {
    await storage.deleteDocument(storagePath).catch(() => {});
    throw err;
  }
}

/**
 * Remplacement du fichier (US-2.2 AC2, US-2.6 AC4) : même document, même
 * dossier — la transition « illisible → lisible » ne repasse pas par la
 * création. Ré-extrait le nouveau fichier, purge l'ancien (best-effort).
 */
export async function replaceDocument(
  db: UserScopedDb,
  documentId: string,
  part: UploadedFilePart,
): Promise<UploadDocumentResult> {
  const upload = await validateAndExtract(part);

  const { storagePath } = await storage.saveDocument(part.buffer, EXT[upload.kind]);
  try {
    const { oldStoragePath, caseFileId } = await db.documents.replaceFileForUser(documentId, {
      originalName: upload.name,
      mimeType: upload.mimeType,
      sizeBytes: part.buffer.length,
      storagePath,
      extractedText: upload.extractedText,
      extractedTextHash: upload.extractedTextHash,
    });
    await storage.deleteDocument(oldStoragePath).catch(() => {});
    return {
      documentId,
      caseFileId,
      originalName: upload.name,
      mimeType: upload.mimeType,
      kind: toKindLabel(upload.kind),
      sizeBytes: part.buffer.length,
      ...(upload.pageCount !== undefined ? { pageCount: upload.pageCount } : {}),
      extractedTextLength: upload.extractedTextLength,
      readable: upload.readable,
    };
  } catch (err) {
    await storage.deleteDocument(storagePath).catch(() => {});
    throw err;
  }
}

/**
 * Consentement « document fictif » (US-2.3 AC2) : UNE ligne `ConsentLog`
 * `FICTIONAL_DOCUMENT` par dossier — idempotent, un second appel n'en crée
 * pas de doublon. 404 si le document est absent ou d'un autre compte.
 */
export async function confirmFictional(db: UserScopedDb, documentId: string): Promise<void> {
  const doc = await db.documents.findByIdForUser(documentId);
  const existing = await db.consentLogs.findLatest({
    caseFileId: doc.caseFileId,
    consentType: "FICTIONAL_DOCUMENT",
  });
  if (existing?.granted) return;
  await db.consentLogs.record({
    caseFileId: doc.caseFileId,
    consentType: "FICTIONAL_DOCUMENT",
    granted: true,
    policyVersion: LEGAL_BUNDLE_VERSION,
  });
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
