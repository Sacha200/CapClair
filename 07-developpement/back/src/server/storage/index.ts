/**
 * Abstraction de stockage des fichiers importés (US-2.1 AC4/AC5, ADR-012).
 *
 * MVP : volume local monté, hors de toute racine servie (le back ne sert
 * aucun fichier statique ; en prod le reverse-proxy ne mappe que `/api/*` et
 * `/auth/*`, ADR-005). Nom sur disque = UUID généré serveur ; le nom
 * d'origine ne vit qu'en base (`Document.originalName`). `storagePath` en
 * base est le basename seul — `resolvePath` ne retient jamais que ce
 * basename (anti path-traversal), même si la valeur stockée était corrompue.
 *
 * Remplaçable par un backend S3/MinIO plus tard sans changer cette API.
 */
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../../env.js";

const BACK_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const STORAGE_ROOT = resolve(BACK_ROOT, env.STORAGE_DIR);

function resolvePath(storagePath: string): string {
  // Ne jamais suivre un chemin fourni tel quel : seul le nom de fichier compte.
  return resolve(STORAGE_ROOT, basename(storagePath));
}

export async function saveDocument(
  bytes: Buffer,
  ext: "pdf" | "png" | "jpeg",
): Promise<{ storagePath: string }> {
  await mkdir(STORAGE_ROOT, { recursive: true });
  const storagePath = `${randomUUID()}.${ext}`;
  await writeFile(resolvePath(storagePath), bytes);
  return { storagePath };
}

export function openDocumentStream(storagePath: string): NodeJS.ReadableStream {
  return createReadStream(resolvePath(storagePath));
}

export async function deleteDocument(storagePath: string): Promise<void> {
  await unlink(resolvePath(storagePath));
}
