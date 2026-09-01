/**
 * Validation impérative d'un fichier importé (US-2.1 AC1/AC2).
 *
 * Le corps d'un upload est `multipart/form-data` : aucun schéma Zod ne peut
 * s'appliquer au fichier lui-même (voir `documents.routes.ts`). Cette
 * fonction est le point d'entrée UNIQUE de cette validation — toute route
 * qui reçoit un fichier doit passer par elle plutôt que de dupliquer la
 * logique (plan E2, risque 12.1).
 */
import { AppError } from "../../lib/errors.js";
import { env } from "../../env.js";
import { detectKind, type DetectedKind } from "../../lib/magic-bytes.js";
import { DOCUMENT_MESSAGES } from "./documents.dto.js";

/**
 * @param truncated `part.file.truncated` — n'est fiable qu'APRÈS lecture
 *   complète du flux (`part.toBuffer()`), jamais avant.
 */
export function assertValidUpload(buffer: Buffer, truncated: boolean): DetectedKind {
  if (truncated || buffer.length > env.MAX_UPLOAD_BYTES) {
    throw new AppError(413, DOCUMENT_MESSAGES.fileTooLarge, { code: "file_too_large" });
  }

  const kind = detectKind(buffer);
  if (!kind) {
    throw new AppError(415, DOCUMENT_MESSAGES.wrongFormat, { code: "unsupported_media_type" });
  }

  return kind;
}
