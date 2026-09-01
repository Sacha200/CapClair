/** US-2.1 — Import d'un fichier. */
import { basename, join } from "node:path";
import { existsSync } from "node:fs";
import { DOCUMENT_MESSAGES } from "@capclair/contract";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/env.js";
import { getApp, sessionCookie } from "../helpers/app.js";
import { readFixture, uploadBytes, uploadFixture } from "../helpers/documents.js";
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

describe("POST /api/documents", () => {
  it("sans cookie → 401", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "POST", url: "/api/documents" });
    expect(res.statusCode).toBe(401);
  });

  it("PDF lisible → 201, dossier + document créés, fichier sur disque (AC1, AC4, AC5, AC6)", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.10");

    const res = await uploadFixture(app, "sample.pdf", {
      cookie,
      remoteAddress: "198.51.100.10",
      filename: "courrier-caf.pdf",
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      originalName: "courrier-caf.pdf",
      mimeType: "application/pdf",
      kind: "pdf",
      sizeBytes: readFixture("sample.pdf").length,
    });
    expect(body.documentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.caseFileId).toMatch(/^[0-9a-f-]{36}$/);

    const doc = await prisma.document.findUniqueOrThrow({
      where: { id: body.documentId },
      include: { caseFile: true },
    });
    expect(doc.originalName).toBe("courrier-caf.pdf");
    // Nom de fichier sur disque = UUID généré serveur (jamais le nom d'origine) — AC4.
    expect(basename(doc.storagePath)).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(doc.caseFile.organisme).toBe("INDETERMINE");
    expect(doc.caseFile.userId).toBeTruthy();

    // Stocké hors de toute racine servie, sous STORAGE_DIR — AC5.
    expect(existsSync(join(env.STORAGE_DIR, basename(doc.storagePath)))).toBe(true);
  });

  it("signature invalide malgré une extension .pdf → 415 message exact (AC1, AC3)", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.11");

    const res = await uploadFixture(app, "faux.pdf", {
      cookie,
      remoteAddress: "198.51.100.11",
      filename: "faux.pdf",
    });

    expect(res.statusCode).toBe(415);
    expect(res.json()).toMatchObject({
      error: DOCUMENT_MESSAGES.wrongFormat,
      code: "unsupported_media_type",
    });
  });

  it("octets PNG sous une extension .pdf → accepté comme image, signature prime sur le nom (AC1)", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.12");

    const res = await uploadFixture(app, "png-en-pdf.pdf", {
      cookie,
      remoteAddress: "198.51.100.12",
      filename: "png-en-pdf.pdf",
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ kind: "image", mimeType: "image/png" });
  });

  it("fichier de plus de 10 Mo → 413 message exact (AC2)", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.13");

    const tooBig = Buffer.alloc(env.MAX_UPLOAD_BYTES + 1, 0x41);
    const res = await uploadBytes(app, tooBig, {
      cookie,
      remoteAddress: "198.51.100.13",
      filename: "gros.pdf",
    });

    expect(res.statusCode).toBe(413);
    expect(res.json()).toMatchObject({
      error: DOCUMENT_MESSAGES.fileTooLarge,
      code: "file_too_large",
    });
  });
});

describe("cross-compte (US-1.5)", () => {
  it("GET /api/documents/:id et /:id/file d'un autre compte → 404 (jamais 403)", async () => {
    const app = await getApp();
    const aliceCookie = await loginCookie("198.51.100.20");
    const bobCookie = await loginCookie("198.51.100.21");

    const upload = await uploadFixture(app, "sample.pdf", {
      cookie: aliceCookie,
      remoteAddress: "198.51.100.20",
    });
    const documentId = upload.json().documentId as string;

    const metadata = await app.inject({
      method: "GET",
      url: `/api/documents/${documentId}`,
      headers: { cookie: bobCookie },
      remoteAddress: "198.51.100.21",
    });
    expect(metadata.statusCode).toBe(404);

    const file = await app.inject({
      method: "GET",
      url: `/api/documents/${documentId}/file`,
      headers: { cookie: bobCookie },
      remoteAddress: "198.51.100.21",
    });
    expect(file.statusCode).toBe(404);
  });
});
