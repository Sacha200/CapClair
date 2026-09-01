import { afterEach, describe, expect, it } from "vitest";
import * as storage from "./index.js";

function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolveP, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolveP(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

describe("storage", () => {
  const saved: string[] = [];

  afterEach(async () => {
    for (const p of saved.splice(0)) {
      await storage.deleteDocument(p).catch(() => {});
    }
  });

  it("écrit un fichier nommé <uuid>.<ext> et restitue les mêmes octets", async () => {
    const bytes = Buffer.from("contenu de test");
    const { storagePath } = await storage.saveDocument(bytes, "pdf");
    saved.push(storagePath);

    expect(storagePath).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    await expect(readAll(storage.openDocumentStream(storagePath))).resolves.toEqual(bytes);
  });

  it("supprime le fichier : une lecture ultérieure échoue", async () => {
    const { storagePath } = await storage.saveDocument(Buffer.from("x"), "png");
    await storage.deleteDocument(storagePath);

    await expect(readAll(storage.openDocumentStream(storagePath))).rejects.toThrow();
  });

  it("neutralise un storagePath contenant des séparateurs de chemin (anti-traversal)", async () => {
    const { storagePath } = await storage.saveDocument(Buffer.from("secret"), "jpeg");
    saved.push(storagePath);

    // Un chemin qui tenterait de sortir de STORAGE_DIR est réduit à son basename :
    // il retombe donc sur le MÊME fichier, jamais sur une ressource hors du dossier.
    const traversal = `../../../${storagePath}`;
    await expect(readAll(storage.openDocumentStream(traversal))).resolves.toEqual(
      Buffer.from("secret"),
    );
  });
});
