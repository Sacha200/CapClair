/** US-2.2 AC2 / US-2.6 AC4 — Remplacer le fichier sans recréer le dossier. IPs : 198.51.100.80/.81. */
import { basename, join } from "node:path";
import { existsSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/env.js";
import { getApp, sessionCookie } from "../helpers/app.js";
import { readFixture, uploadFixture } from "../helpers/documents.js";
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

function replaceWithFixture(
  cookie: string,
  documentId: string,
  fixtureName: string,
  remoteAddress: string,
) {
  const bytes = readFixture(fixtureName);
  const boundary = "capclairReplaceBoundary";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fixtureName}"\r\n` +
        `Content-Type: application/pdf\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return getApp().then((app) =>
    app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/replace`,
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
      remoteAddress,
    }),
  );
}

describe("POST /api/documents/:id/replace", () => {
  it("transition illisible → lisible : même document, même dossier, ancien fichier purgé (AC4)", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.80");

    const upload = await uploadFixture(app, "scanne-vide.pdf", {
      cookie,
      remoteAddress: "198.51.100.80",
    });
    expect(upload.json().readable).toBe(false);
    const { documentId, caseFileId } = upload.json();
    const oldPath = (await prisma.document.findUniqueOrThrow({ where: { id: documentId } }))
      .storagePath;
    const oldDiskPath = join(env.STORAGE_DIR, basename(oldPath));
    expect(existsSync(oldDiskPath)).toBe(true);

    const res = await replaceWithFixture(cookie, documentId, "courrier-1p.pdf", "198.51.100.80");

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      documentId,
      caseFileId, // même dossier : la transition ne recrée rien
      readable: true,
      pageCount: 1,
    });

    const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(doc.caseFileId).toBe(caseFileId);
    expect(doc.extractedText).toContain("0847213C");
    expect(doc.storagePath).not.toBe(oldPath);
    expect(existsSync(oldDiskPath)).toBe(false);
    expect(existsSync(join(env.STORAGE_DIR, basename(doc.storagePath)))).toBe(true);
    expect(await prisma.caseFile.count()).toBe(1);
  });

  it("cross-compte → 404, document intact (US-1.5)", async () => {
    const app = await getApp();
    const aliceCookie = await loginCookie("198.51.100.81");
    const bobCookie = await loginCookie("198.51.100.82");
    const upload = await uploadFixture(app, "sample.pdf", {
      cookie: aliceCookie,
      remoteAddress: "198.51.100.81",
    });
    const { documentId } = upload.json();
    const before = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

    const res = await replaceWithFixture(bobCookie, documentId, "courrier-1p.pdf", "198.51.100.82");
    expect(res.statusCode).toBe(404);

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(after.storagePath).toBe(before.storagePath);
  });
});
