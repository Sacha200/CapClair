import type { UploadDocumentResult } from "./documents.service.js";
import type { DocumentMetadata, UploadDocumentResponse } from "./documents.dto.js";

/** Projette le résultat d'upload vers le DTO exposé (aucun `storagePath`). */
export function toUploadResponseDto(result: UploadDocumentResult): UploadDocumentResponse {
  return {
    documentId: result.documentId,
    caseFileId: result.caseFileId,
    originalName: result.originalName,
    mimeType: result.mimeType,
    kind: result.kind,
    sizeBytes: result.sizeBytes,
  };
}

/** Projette l'entité vers le DTO de métadonnées (jamais `storagePath` ni contenu). */
export function toDocumentMetadataDto(doc: {
  id: string;
  caseFileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): DocumentMetadata {
  return {
    id: doc.id,
    caseFileId: doc.caseFileId,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt.toISOString(),
  };
}
