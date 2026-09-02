/** US-2.2 AC2 — Retirer un document avant analyse. */
import { basename, join } from "node:path";
import { existsSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/env.js";
import { getApp, sessionCookie } from "../helpers/app.js";
import { uploadFixture } from "../helpers/documents.js";
import { createUser } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

async function loginCookie(remoteAddress: string) {
  const app = await getApp();
  const { email, password } = await createUser(prisma);
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
    remoteAddress,
  });
  return sessionCookie(res)!;
}

describe("DELETE /api/documents/:id", () => {
  it("supprime le document, le fichier disque et le dossier non analysé", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.40");

    const upload = await uploadFixture(app, "sample.pdf", {
      cookie,
      remoteAddress: "198.51.100.40",
    });
    const { documentId, caseFileId } = upload.json();
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    const diskPath = join(env.STORAGE_DIR, basename(doc.storagePath));
    expect(existsSync(diskPath)).toBe(true);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/documents/${documentId}`,
      headers: { cookie },
      remoteAddress: "198.51.100.40",
    });
    expect(del.statusCode).toBe(204);

    expect(await prisma.document.findUnique({ where: { id: documentId } })).toBeNull();
    expect(await prisma.caseFile.findUnique({ where: { id: caseFileId } })).toBeNull();
    expect(existsSync(diskPath)).toBe(false);

    const get = await app.inject({
      method: "GET",
      url: `/api/documents/${documentId}`,
      headers: { cookie },
      remoteAddress: "198.51.100.40",
    });
    expect(get.statusCode).toBe(404);
  });

  it("cross-compte → 404, rien n'est supprimé", async () => {
    const app = await getApp();
    const aliceCookie = await loginCookie("198.51.100.41");
    const bobCookie = await loginCookie("198.51.100.42");

    const upload = await uploadFixture(app, "sample.pdf", {
      cookie: aliceCookie,
      remoteAddress: "198.51.100.41",
    });
    const { documentId } = upload.json();

    const del = await app.inject({
      method: "DELETE",
      url: `/api/documents/${documentId}`,
      headers: { cookie: bobCookie },
      remoteAddress: "198.51.100.42",
    });
    expect(del.statusCode).toBe(404);
    expect(await prisma.document.findUnique({ where: { id: documentId } })).not.toBeNull();
  });
});
