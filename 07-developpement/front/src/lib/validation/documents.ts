/**
 * Validation côté client d'un fichier à importer (US-2.1) — confort UX
 * uniquement : le serveur reste l'autorité (magic bytes + taille, PR-A/B).
 * Messages et seuils = le contrat partagé.
 */
export {
  DOCUMENT_MESSAGES,
  MAX_UPLOAD_BYTES,
  UNREADABLE_TEXT_THRESHOLD,
} from "@capclair/contract";
export type { UploadDocumentResponse, DocumentKind } from "@capclair/contract";

import { ACCEPTED_EXT, ACCEPTED_MIME, DOCUMENT_MESSAGES, MAX_UPLOAD_BYTES } from "@capclair/contract";

/** Attribut `accept` de l'input fichier (extensions + mimes). */
export const FILE_INPUT_ACCEPT = [...ACCEPTED_EXT, ...ACCEPTED_MIME].join(",");

/**
 * Vérifie taille et type avant l'upload. Renvoie le message d'erreur à
 * afficher, ou `null` si le fichier peut partir. Le type est jugé sur le mime
 * déclaré OU l'extension : un fichier déguisé passera ici mais sera rejeté par
 * la signature côté serveur (415).
 */
export function validateFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return DOCUMENT_MESSAGES.fileTooLarge;

  const mimeOk = (ACCEPTED_MIME as readonly string[]).includes(file.type);
  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  const extOk = (ACCEPTED_EXT as readonly string[]).includes(ext);
  if (!mimeOk && !extOk) return DOCUMENT_MESSAGES.wrongFormat;

  return null;
}
