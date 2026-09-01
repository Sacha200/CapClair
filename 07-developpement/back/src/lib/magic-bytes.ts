/**
 * Détection du type de fichier par signature (magic bytes), jamais par
 * extension ni par mime déclaré côté client (US-2.1 AC1).
 */

export type DetectedKind = "pdf" | "png" | "jpeg";

/** Mime canonique à utiliser pour le fichier stocké, dérivé des octets. */
export const CANONICAL_MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
} as const satisfies Record<DetectedKind, string>;

/** Extension de stockage associée (nom UUID généré serveur, US-2.1 AC4). */
export const EXT = {
  pdf: "pdf",
  png: "png",
  jpeg: "jpeg",
} as const satisfies Record<DetectedKind, string>;

const SIGNATURES: Array<{ kind: DetectedKind; bytes: number[] }> = [
  { kind: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { kind: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: "jpeg", bytes: [0xff, 0xd8, 0xff] },
];

function startsWith(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

/** `null` si aucune signature connue en tête de fichier. */
export function detectKind(buffer: Buffer): DetectedKind | null {
  for (const { kind, bytes } of SIGNATURES) {
    if (startsWith(buffer, bytes)) return kind;
  }
  return null;
}
