import { z } from "zod";

/**
 * Messages — repris à l'identique dans l'UI (persona Nadia, A2/B1).
 * `tooManyPages`, `unreadable*` et `fictionalRequired` sont posés par PR-A pour
 * la forme du contrat ; ils sont produits par le service à partir de PR-B
 * (extraction PDF, barrière illisible, US-2.3/2.4/2.6).
 */
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

export const ACCEPTED_MIME = ["application/pdf", "image/png", "image/jpeg"] as const;
export const ACCEPTED_EXT = [".pdf", ".png", ".jpg", ".jpeg"] as const;
export const MAX_UPLOAD_BYTES = 10_485_760;
/** Barrière US-2.6 AC1 : sous ce seuil de caractères utiles, pas d'appel IA. */
export const UNREADABLE_TEXT_THRESHOLD = 100;

export const DocumentKindSchema = z.enum(["pdf", "image"]);

/**
 * Réponse de `POST /api/documents` (et `/replace`). `pageCount` n'existe que
 * pour un PDF (pas d'extraction d'image au MVP — US-2.5 coupée, décision C1) ;
 * un PDF illisible (corrompu, scanné sans texte, timeout) a `pageCount: 0`.
 * `readable === false` déclenche le parcours « document illisible » (US-2.6).
 */
export const UploadDocumentResponseSchema = z.object({
  documentId: z.string(),
  caseFileId: z.string(),
  originalName: z.string(),
  mimeType: z.enum(ACCEPTED_MIME),
  kind: DocumentKindSchema,
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative().optional(),
  extractedTextLength: z.number().int().nonnegative(),
  readable: z.boolean(),
});

export const DocumentMetadataSchema = z.object({
  id: z.string(),
  caseFileId: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
});

/** US-2.3 AC1/AC2 : `confirmed` doit être littéralement `true` — `false` est rejeté. */
export const ConfirmFictionalInputSchema = z.object({ confirmed: z.literal(true) });

export type DocumentKind = z.infer<typeof DocumentKindSchema>;
export type UploadDocumentResponse = z.infer<typeof UploadDocumentResponseSchema>;
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
export type ConfirmFictionalInput = z.infer<typeof ConfirmFictionalInputSchema>;
